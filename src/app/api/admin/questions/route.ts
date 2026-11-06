import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(req.url);
    const sessionFilter = searchParams.get("sessionId") || "all";

    const [
      { data: questions, error },
      { data: answers },
      { data: sessions },
      { data: sessionQuestions },
    ] = await Promise.all([
      supabase
        .from("questions")
        .select("*, question_options(*)")
        .order("created_at", { ascending: false }),
      supabase
        .from("answers")
        .select("question_id, option_id, session_id, response_ms"),
      supabase
        .from("game_sessions")
        .select("id, name, status, starts_at, ends_at")
        .order("starts_at", { ascending: false }),
      supabase
        .from("session_questions")
        .select("session_id, question_id, position")
        .order("position", { ascending: true }),
    ]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const sessionMap = new Map<
      string,
      { id: string; name: string; status: string; starts_at: string; ends_at: string }
    >();
    for (const s of sessions ?? []) {
      sessionMap.set(s.id, s);
    }

    // Track which sessions each question is assigned to
    const sessionsByQuestion = new Map<
      string,
      { session_id: string; session_name: string; status: string; position: number }[]
    >();
    const sessionQuestionOrder = new Map<string, number>();

    for (const sq of sessionQuestions ?? []) {
      const sInfo = sessionMap.get(sq.session_id);
      const list = sessionsByQuestion.get(sq.question_id) ?? [];
      list.push({
        session_id: sq.session_id,
        session_name: sInfo?.name || "Game Session",
        status: sInfo?.status || "upcoming",
        position: sq.position,
      });
      sessionsByQuestion.set(sq.question_id, list);

      if (sessionFilter !== "all" && sq.session_id === sessionFilter) {
        sessionQuestionOrder.set(sq.question_id, sq.position);
      }
    }

    // Count real-time guesses and response time per option_id (scoped by sessionFilter if set)
    const countByOption = new Map<string, number>();
    const timeByOption = new Map<string, number>();
    for (const ans of answers ?? []) {
      if (sessionFilter !== "all" && ans.session_id !== sessionFilter) continue;
      countByOption.set(ans.option_id, (countByOption.get(ans.option_id) ?? 0) + 1);
      timeByOption.set(
        ans.option_id,
        (timeByOption.get(ans.option_id) ?? 0) + Number(ans.response_ms ?? 0)
      );
    }

    // Enrich each question's options with real-time guesses, percentage, avg time, and ascribed points (10 down to 1)
    let enriched = (questions ?? []).map((q) => {
      const rawOpts = [...(q.question_options ?? [])].sort(
        (a: { position: number }, b: { position: number }) => a.position - b.position
      );

      // Rank options by guesses DESC, tie-broken by position ASC
      const ranked = [...rawOpts].sort((a, b) => {
        const diff = (countByOption.get(b.id) ?? 0) - (countByOption.get(a.id) ?? 0);
        return diff !== 0 ? diff : a.position - b.position;
      });

      const pointsByOption = new Map<string, number>();
      const rankByOption = new Map<string, number>();
      ranked.forEach((opt, idx) => {
        pointsByOption.set(opt.id, Math.max(10 - idx, 1));
        rankByOption.set(opt.id, idx + 1);
      });

      const totalQuestionGuesses = rawOpts.reduce(
        (sum, opt) => sum + (countByOption.get(opt.id) ?? 0),
        0
      );

      const assignedList = sessionsByQuestion.get(q.id) ?? [];

      return {
        ...q,
        total_guesses: totalQuestionGuesses,
        sessions_used_count: assignedList.length,
        assigned_sessions: assignedList,
        session_position: sessionQuestionOrder.get(q.id) ?? null,
        question_options: rawOpts.map((opt) => {
          const guesses = countByOption.get(opt.id) ?? 0;
          const percentage =
            totalQuestionGuesses > 0
              ? Number(((guesses / totalQuestionGuesses) * 100).toFixed(1))
              : 0;
          const avg_response_ms =
            guesses > 0 ? Math.round((timeByOption.get(opt.id) ?? 0) / guesses) : 0;
          return {
            ...opt,
            guesses,
            percentage,
            avg_response_ms,
            rank: rankByOption.get(opt.id) ?? 10,
            points: pointsByOption.get(opt.id) ?? 1,
          };
        }),
      };
    });

    if (sessionFilter !== "all") {
      enriched = enriched
        .filter((q) => sessionQuestionOrder.has(q.id))
        .sort((a, b) => (a.session_position ?? 99) - (b.session_position ?? 99));
    }

    const sessionsWithCounts = (sessions ?? []).map((s) => {
      const qCount = (sessionQuestions ?? []).filter((sq) => sq.session_id === s.id).length;
      return {
        ...s,
        question_count: qCount,
      };
    });

    return NextResponse.json({
      questions: enriched,
      sessions: sessionsWithCounts,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load questions" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await req.json();

    if (body.action === "delete" && body.id) {
      return performDeleteQuestion(supabase, body.id);
    }

    const {
      title,
      category = "General",
      type = "text",
      status = "published",
      tags = [],
      notes = null,
      options = [],
      assignToSessionId,
    } = body;

    if (!title || !Array.isArray(options) || options.length < 2) {
      return NextResponse.json(
        { error: "Question title and at least 2 options are required." },
        { status: 400 }
      );
    }

    const hasImageOptions = options.some(
      (opt: unknown) =>
        typeof opt === "object" &&
        opt !== null &&
        "media_url" in opt &&
        typeof (opt as { media_url?: unknown }).media_url === "string" &&
        ((opt as { media_url: string }).media_url.startsWith("http") ||
          (opt as { media_url: string }).media_url.startsWith("data:image/"))
    );
    const resolvedType = type === "text" && hasImageOptions ? "image" : type;

    const { data: q, error: qError } = await supabase
      .from("questions")
      .insert({
        title: title.trim(),
        category: category || "General",
        type: resolvedType,
        status,
        tags,
        notes: notes || null,
      })
      .select()
      .single();

    if (qError || !q) {
      return NextResponse.json(
        { error: qError?.message || "Failed to insert question" },
        { status: 500 }
      );
    }

    const cleanOptions = options
      .map((opt: string | { label: string; media_url?: string | null }, idx: number) => {
        if (typeof opt === "string") {
          return {
            question_id: q.id,
            label: opt.trim(),
            media_url: null,
            position: idx,
          };
        }
        return {
          question_id: q.id,
          label: (opt.label || "").trim(),
          media_url: opt.media_url ? opt.media_url.trim() : null,
          position: idx,
        };
      })
      .filter((o: { label: string }) => Boolean(o.label));

    const { error: optError } = await supabase.from("question_options").insert(cleanOptions);
    if (optError) {
      return NextResponse.json({ error: optError.message }, { status: 500 });
    }

    if (assignToSessionId && assignToSessionId !== "all") {
      const { data: existingSq } = await supabase
        .from("session_questions")
        .select("position")
        .eq("session_id", assignToSessionId)
        .order("position", { ascending: false })
        .limit(1);
      const nextPos = (existingSq?.[0]?.position ?? 0) + 1;
      await supabase.from("session_questions").insert({
        session_id: assignToSessionId,
        question_id: q.id,
        position: nextPos,
      });
    }

    return NextResponse.json({ ok: true, question: q });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create question" },
      { status: 500 }
    );
  }
}

async function handleUpdateQuestion(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await req.json();
    const { id, status, title, category, type, notes, options } = body;

    if (!id) {
      return NextResponse.json({ error: "Question ID is required" }, { status: 400 });
    }

    const hasImageOptions =
      Array.isArray(options) &&
      options.some(
        (opt: unknown) =>
          typeof opt === "object" &&
          opt !== null &&
          "media_url" in opt &&
          typeof (opt as { media_url?: unknown }).media_url === "string" &&
          ((opt as { media_url: string }).media_url.startsWith("http") ||
            (opt as { media_url: string }).media_url.startsWith("data:image/"))
      );

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status !== undefined) updates.status = status;
    if (title !== undefined) updates.title = title.trim();
    if (category !== undefined) updates.category = category;
    if (notes !== undefined) updates.notes = notes;
    if (type !== undefined) {
      updates.type = type === "text" && hasImageOptions ? "image" : type;
    } else if (hasImageOptions) {
      updates.type = "image";
    }

    const { data, error } = await supabase
      .from("questions")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If options array is provided, update existing options in-place to preserve foreign keys
    if (Array.isArray(options) && options.length > 0) {
      const { data: existingOpts } = await supabase
        .from("question_options")
        .select("id, position")
        .eq("question_id", id)
        .order("position", { ascending: true });

      const existingList = existingOpts ?? [];

      for (let idx = 0; idx < options.length; idx++) {
        const opt = options[idx] as {
          id?: string;
          label?: string;
          media_url?: string | null;
        };
        const cleanLabel = (opt.label || "").trim();
        if (!cleanLabel) continue;
        const cleanMedia = opt.media_url ? opt.media_url.trim() : null;

        const targetId = opt.id || existingList[idx]?.id;
        if (targetId) {
          await supabase
            .from("question_options")
            .update({
              label: cleanLabel,
              media_url: cleanMedia,
              position: idx,
            })
            .eq("id", targetId);
        } else {
          await supabase.from("question_options").insert({
            question_id: id,
            label: cleanLabel,
            media_url: cleanMedia,
            position: idx,
          });
        }
      }
    }

    return NextResponse.json({ ok: true, question: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update question" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  return handleUpdateQuestion(req);
}

export async function PUT(req: NextRequest) {
  return handleUpdateQuestion(req);
}

async function performDeleteQuestion(
  supabase: ReturnType<typeof createServiceClient>,
  id: string
) {
  // Fetch all option IDs for this question so we also clean up any answers referencing option_id
  const { data: opts } = await supabase
    .from("question_options")
    .select("id")
    .eq("question_id", id);

  const optIds = (opts ?? []).map((o: { id: string }) => o.id);
  if (optIds.length > 0) {
    await supabase.from("answers").delete().in("option_id", optIds);
  }

  // Clean up dependent rows first so FK constraints never block deletion
  await supabase.from("answers").delete().eq("question_id", id);
  await supabase.from("session_questions").delete().eq("question_id", id);
  await supabase.from("question_options").delete().eq("question_id", id);

  const { error } = await supabase.from("questions").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, deletedId: id });
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(req.url);
    let id = searchParams.get("id");
    if (!id) {
      const body = await req.json().catch(() => ({}));
      id = body.id;
    }

    if (!id) {
      return NextResponse.json({ error: "Question ID is required" }, { status: 400 });
    }

    return performDeleteQuestion(supabase, id);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete question" },
      { status: 500 }
    );
  }
}
