import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = createServiceClient();
    const [{ data: questions, error }, { data: answers }] = await Promise.all([
      supabase
        .from("questions")
        .select("*, question_options(*)")
        .order("created_at", { ascending: false }),
      supabase.from("answers").select("question_id, option_id"),
    ]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Count real-time guesses per option_id
    const countByOption = new Map<string, number>();
    for (const ans of answers ?? []) {
      countByOption.set(ans.option_id, (countByOption.get(ans.option_id) ?? 0) + 1);
    }

    // Enrich each question's options with real-time guesses and ascribed points (10 down to 1) per Page 32
    const enriched = (questions ?? []).map((q) => {
      const rawOpts = [...(q.question_options ?? [])].sort(
        (a: { position: number }, b: { position: number }) => a.position - b.position
      );

      // Rank options by guesses DESC, tie-broken by position ASC
      const ranked = [...rawOpts].sort((a, b) => {
        const diff = (countByOption.get(b.id) ?? 0) - (countByOption.get(a.id) ?? 0);
        return diff !== 0 ? diff : a.position - b.position;
      });

      const pointsByOption = new Map<string, number>();
      ranked.forEach((opt, idx) => {
        pointsByOption.set(opt.id, Math.max(10 - idx, 1));
      });

      const totalQuestionGuesses = rawOpts.reduce(
        (sum, opt) => sum + (countByOption.get(opt.id) ?? 0),
        0
      );

      return {
        ...q,
        total_guesses: totalQuestionGuesses,
        question_options: rawOpts.map((opt) => ({
          ...opt,
          guesses: countByOption.get(opt.id) ?? 0,
          points: pointsByOption.get(opt.id) ?? 1,
        })),
      };
    });

    return NextResponse.json({ questions: enriched });
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

    const {
      title,
      category = "General",
      type = "text",
      status = "published",
      tags = [],
      options = [],
    } = body;

    if (!title || !Array.isArray(options) || options.length < 2) {
      return NextResponse.json(
        { error: "Question title and options are required." },
        { status: 400 }
      );
    }

    const { data: q, error: qError } = await supabase
      .from("questions")
      .insert({
        title: title.trim(),
        category: category || "General",
        type,
        status,
        tags,
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
      .map((opt: string | { label: string; media_url?: string }, idx: number) => {
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

    return NextResponse.json({ ok: true, question: q });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create question" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { id, status, title, category } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Question ID is required" }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status) updates.status = status;
    if (title) updates.title = title;
    if (category) updates.category = category;

    const { data, error } = await supabase
      .from("questions")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, question: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update question" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Question ID is required" }, { status: 400 });
    }

    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete question" },
      { status: 500 }
    );
  }
}
