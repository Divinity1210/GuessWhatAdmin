import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export type PrizeTier = {
  rank_from: number;
  rank_to: number;
  amount: number;
};

export const PRESET_36_WINNERS: PrizeTier[] = [
  { rank_from: 1, rank_to: 1, amount: 100000 },
  { rank_from: 2, rank_to: 2, amount: 50000 },
  { rank_from: 3, rank_to: 3, amount: 20000 },
  { rank_from: 4, rank_to: 36, amount: 10000 },
];

export const PRESET_49_WINNERS: PrizeTier[] = [
  { rank_from: 1, rank_to: 1, amount: 100000 },
  { rank_from: 2, rank_to: 2, amount: 50000 },
  { rank_from: 3, rank_to: 3, amount: 20000 },
  { rank_from: 4, rank_to: 23, amount: 10000 },
  { rank_from: 24, rank_to: 49, amount: 5000 },
];

function getPrizeForRank(rank: number, structure: PrizeTier[]): number {
  for (const tier of structure) {
    if (rank >= Number(tier.rank_from) && rank <= Number(tier.rank_to)) {
      return Number(tier.amount ?? 0);
    }
  }
  return 0;
}

export async function GET() {
  try {
    const supabase = createServiceClient();
    const [
      { data: sessions, error: sErr },
      { data: questions, error: qErr },
      { data: sessionQuestions },
      { data: entries },
      { data: answers },
      { data: auditLogs },
      { data: appSettings },
    ] = await Promise.all([
      supabase
        .from("game_sessions")
        .select("*")
        .order("starts_at", { ascending: false }),
      supabase
        .from("questions")
        .select("id, title, category, type, status, question_options(id, label, position)")
        .order("created_at", { ascending: false }),
      supabase
        .from("session_questions")
        .select("session_id, question_id, position")
        .order("position", { ascending: true }),
      supabase
        .from("session_entries")
        .select("id, session_id, user_id, total_score, final_rank"),
      supabase
        .from("answers")
        .select("id, session_id, question_id"),
      supabase
        .from("audit_logs")
        .select("id, target_id, detail")
        .eq("action", "gameplay_attempt_archived"),
      supabase.from("app_settings").select("key, value"),
    ]);

    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
    if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });

    const questionMap = new Map<
      string,
      { id: string; title: string; category: string; type: string; status: string; optionCount: number }
    >();
    for (const q of questions ?? []) {
      questionMap.set(q.id, {
        id: q.id,
        title: q.title,
        category: q.category || "General",
        type: q.type || "text",
        status: q.status || "published",
        optionCount: (q.question_options ?? []).length,
      });
    }

    const pausedMap = new Map<string, boolean>();
    for (const row of appSettings ?? []) {
      if (row.key.startsWith("session_paused_")) {
        const sid = row.key.replace("session_paused_", "");
        const val = (row.value ?? {}) as { paused?: boolean };
        if (val.paused) pausedMap.set(sid, true);
      }
    }

    // Enrich sessions with participating players, guesses submitted, repeat plays, and assigned questions
    const enrichedSessions = (sessions ?? []).map((s) => {
      const sEntries = (entries ?? []).filter((e) => e.session_id === s.id);
      const sAnswers = (answers ?? []).filter((a) => a.session_id === s.id);
      const sArchived = (auditLogs ?? []).filter((l) => {
        const d = (l.detail ?? {}) as { session_id?: string };
        return (d.session_id || l.target_id) === s.id;
      });

      const sqList = (sessionQuestions ?? [])
        .filter((sq) => sq.session_id === s.id)
        .sort((a, b) => a.position - b.position)
        .map((sq) => {
          const qMeta = questionMap.get(sq.question_id);
          const qGuesses = sAnswers.filter((a) => a.question_id === sq.question_id).length;
          return {
            position: sq.position,
            question_id: sq.question_id,
            title: qMeta?.title || "Question",
            category: qMeta?.category || "General",
            type: qMeta?.type || "text",
            option_count: qMeta?.optionCount ?? 10,
            guesses_count: qGuesses,
          };
        });

      const uniquePlayers = new Set(sEntries.map((e) => e.user_id)).size;

      return {
        ...s,
        is_paused: pausedMap.get(s.id) ?? false,
        participating_players: uniquePlayers,
        entries_count: sEntries.length,
        total_plays: sEntries.length + sArchived.length,
        repeat_plays: sArchived.length,
        guesses_submitted: sAnswers.length,
        assigned_questions: sqList,
        session_questions: [{ count: sqList.length }],
        session_entries: [{ count: sEntries.length }],
      };
    });

    const publishedQuestions = (questions ?? [])
      .filter((q) => q.status === "published")
      .map((q) => ({
        id: q.id,
        title: q.title,
        category: q.category || "General",
        type: q.type || "text",
      }));

    return NextResponse.json({
      sessions: enrichedSessions,
      publishedQuestions,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch sessions" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await req.json();
    const {
      name,
      startsAt,
      endsAt,
      entryFee = 0,
      prizePool = 500000,
      status = "active",
      selectedQuestionIds = [],
      prizePreset = "36_winners",
      prizeStructure,
    } = body;

    if (!name || !startsAt || !endsAt) {
      return NextResponse.json(
        { error: "Name, start time, and end time are required." },
        { status: 400 }
      );
    }
    if (!Array.isArray(selectedQuestionIds) || selectedQuestionIds.length < 1) {
      return NextResponse.json(
        { error: "Please select questions for this session (standard is 10 questions)." },
        { status: 400 }
      );
    }

    const poolNum = Number(prizePool);
    const chosenStructure: PrizeTier[] =
      Array.isArray(prizeStructure) && prizeStructure.length > 0
        ? prizeStructure
        : prizePreset === "49_winners"
        ? PRESET_49_WINNERS
        : PRESET_36_WINNERS;

    const { data: session, error: sError } = await supabase
      .from("game_sessions")
      .insert({
        name: name.trim(),
        status,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
        entry_fee_coins: Number(entryFee),
        prize_pool: poolNum,
        prize_structure: chosenStructure,
      })
      .select()
      .single();

    if (sError || !session) {
      return NextResponse.json(
        { error: sError?.message || "Failed to create session" },
        { status: 500 }
      );
    }

    const sqRows = selectedQuestionIds.map((qid: string, idx: number) => ({
      session_id: session.id,
      question_id: qid,
      position: idx + 1,
    }));

    const { error: sqError } = await supabase.from("session_questions").insert(sqRows);
    if (sqError) {
      return NextResponse.json({ error: sqError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, session });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create session" },
      { status: 500 }
    );
  }
}

async function scoreAndPublishSession(sessionId: string) {
  const supabase = createServiceClient();

  // First try calling the DB RPC if available
  await supabase.from("game_sessions").update({ status: "active" }).eq("id", sessionId);
  await supabase.rpc("close_session", { p_session_id: sessionId });

  // Also run explicit consensus calculation (10 pts down to 1 pt per question) to guarantee exact rankings & prize allocations
  const [
    { data: session },
    { data: entries },
    { data: answers },
    { data: questions },
    { data: archivedLogs },
  ] = await Promise.all([
    supabase.from("game_sessions").select("*").eq("id", sessionId).single(),
    supabase.from("session_entries").select("*").eq("session_id", sessionId),
    supabase.from("answers").select("*").eq("session_id", sessionId),
    supabase.from("questions").select("id, question_options(id, position)"),
    supabase
      .from("audit_logs")
      .select("actor_id, detail")
      .eq("target_id", sessionId)
      .eq("action", "gameplay_attempt_archived"),
  ]);

  if (!session) return;

  const optionCount = new Map<string, number>();
  for (const a of answers ?? []) {
    optionCount.set(a.option_id, (optionCount.get(a.option_id) ?? 0) + 1);
  }
  for (const log of archivedLogs ?? []) {
    const detail = (log.detail ?? {}) as {
      entry_id?: string;
      answers?: { question_id?: string; option_id?: string; response_ms?: number }[];
    };
    for (const a of detail.answers ?? []) {
      if (a.option_id) {
        optionCount.set(a.option_id, (optionCount.get(a.option_id) ?? 0) + 1);
      }
    }
  }

  const optionPoints = new Map<string, number>();
  for (const q of questions ?? []) {
    const opts = [...(q.question_options ?? [])].sort(
      (a: { position: number }, b: { position: number }) => a.position - b.position
    );
    const ranked = [...opts].sort((a, b) => {
      const diff = (optionCount.get(b.id) ?? 0) - (optionCount.get(a.id) ?? 0);
      return diff !== 0 ? diff : a.position - b.position;
    });
    ranked.forEach((opt, idx) => {
      optionPoints.set(opt.id, Math.max(10 - idx, 1));
    });
  }

  const answersByEntry = new Map<string, { score: number; ms: number; count: number }>();
  for (const a of answers ?? []) {
    const cur = answersByEntry.get(a.entry_id) ?? { score: 0, ms: 0, count: 0 };
    cur.score += optionPoints.get(a.option_id) ?? 1;
    cur.ms += Number(a.response_ms ?? 0);
    cur.count += 1;
    answersByEntry.set(a.entry_id, cur);
  }

  const scoredEntries = (entries ?? []).map((e) => {
    const agg = answersByEntry.get(e.id);
    const myArch = (archivedLogs ?? []).filter((l) => {
      const d = (l.detail ?? {}) as { entry_id?: string };
      return d.entry_id === e.id || l.actor_id === e.user_id;
    });

    const candidates: { score: number; ms: number }[] = [];
    if (agg && agg.count > 0) {
      candidates.push({ score: agg.score, ms: agg.ms });
    }
    for (const arch of myArch) {
      const d = (arch.detail ?? {}) as {
        total_score?: number;
        total_response_ms?: number;
        answers?: { option_id?: string; response_ms?: number }[];
      };
      const archAns = Array.isArray(d.answers) ? d.answers : [];
      if (archAns.length > 0) {
        const dynScore = archAns.reduce(
          (s, a) => s + (a.option_id ? optionPoints.get(a.option_id) ?? 1 : 1),
          0
        );
        const dynMs = archAns.reduce((s, a) => s + Number(a.response_ms ?? 0), 0);
        candidates.push({
          score: dynScore,
          ms: Number(d.total_response_ms || dynMs || 0),
        });
      } else if (Number(d.total_score ?? 0) > 0) {
        candidates.push({
          score: Number(d.total_score ?? 0),
          ms: Number(d.total_response_ms ?? 0),
        });
      }
    }
    if (candidates.length === 0 && Number(e.total_score ?? 0) > 0) {
      candidates.push({
        score: Number(e.total_score ?? 0),
        ms: Number(e.total_response_ms ?? 0),
      });
    }

    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.ms - b.ms;
    });

    const best = candidates[0] ?? { score: 0, ms: 0 };
    return {
      ...e,
      computed_score: best.score,
      computed_ms: best.ms,
    };
  });

  scoredEntries.sort((a, b) => {
    if (b.computed_score !== a.computed_score) return b.computed_score - a.computed_score;
    return a.computed_ms - b.computed_ms;
  });

  const structure: PrizeTier[] =
    Array.isArray(session.prize_structure) && session.prize_structure.length > 0
      ? (session.prize_structure as PrizeTier[])
      : PRESET_36_WINNERS;

  const lbRows: {
    session_id: string;
    user_id: string;
    rank: number;
    points: number;
    response_ms: number;
    prize: number;
  }[] = [];

  for (let i = 0; i < scoredEntries.length; i++) {
    const e = scoredEntries[i];
    const rank = i + 1;
    const prize = getPrizeForRank(rank, structure);
    lbRows.push({
      session_id: sessionId,
      user_id: e.user_id,
      rank,
      points: e.computed_score,
      response_ms: e.computed_ms,
      prize,
    });
    await supabase
      .from("session_entries")
      .update({
        total_score: e.computed_score,
        total_response_ms: e.computed_ms,
        final_rank: rank,
        prize_awarded: prize,
        completed_at: e.completed_at || new Date().toISOString(),
      })
      .eq("id", e.id);
  }

  await supabase.from("leaderboards").delete().eq("session_id", sessionId);
  if (lbRows.length > 0) {
    await supabase.from("leaderboards").insert(lbRows);
  }

  await supabase
    .from("game_sessions")
    .update({ status: "completed" })
    .eq("id", sessionId);

  await supabase.from("app_settings").upsert({
    key: `session_paused_${sessionId}`,
    value: { paused: false },
    updated_at: new Date().toISOString(),
  });
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await req.json();
    const {
      id,
      action,
      status,
      name,
      startsAt,
      endsAt,
      entryFee,
      prizePool,
      prizePreset,
      prizeStructure,
      selectedQuestionIds,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    if (action === "close_and_score") {
      await scoreAndPublishSession(id);
      return NextResponse.json({ ok: true });
    }

    if (action === "pause") {
      await supabase.from("game_sessions").update({ status: "upcoming" }).eq("id", id);
      await supabase.from("app_settings").upsert({
        key: `session_paused_${id}`,
        value: { paused: true, paused_at: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "resume" || action === "start") {
      await supabase.from("game_sessions").update({ status: "active" }).eq("id", id);
      await supabase.from("app_settings").upsert({
        key: `session_paused_${id}`,
        value: { paused: false, resumed_at: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "edit_session") {
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name.trim();
      if (startsAt !== undefined) updates.starts_at = new Date(startsAt).toISOString();
      if (endsAt !== undefined) updates.ends_at = new Date(endsAt).toISOString();
      if (entryFee !== undefined) updates.entry_fee_coins = Number(entryFee);
      if (prizePool !== undefined) updates.prize_pool = Number(prizePool);
      if (status !== undefined) updates.status = status;

      if (Array.isArray(prizeStructure) && prizeStructure.length > 0) {
        updates.prize_structure = prizeStructure;
      } else if (prizePreset === "49_winners") {
        updates.prize_structure = PRESET_49_WINNERS;
      } else if (prizePreset === "36_winners") {
        updates.prize_structure = PRESET_36_WINNERS;
      }

      const { data: updatedSession, error: uErr } = await supabase
        .from("game_sessions")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (uErr) {
        return NextResponse.json({ error: uErr.message }, { status: 500 });
      }

      // Sync prize_awarded and leaderboards.prize when prize_structure changes
      if (updates.prize_structure) {
        const nextStructure = updates.prize_structure as PrizeTier[];
        const [{ data: entries }, { data: lbRows }] = await Promise.all([
          supabase
            .from("session_entries")
            .select("id, total_score, total_response_ms, final_rank")
            .eq("session_id", id),
          supabase
            .from("leaderboards")
            .select("user_id, rank")
            .eq("session_id", id),
        ]);

        const sorted = [...(entries ?? [])].sort((a, b) => {
          const diff = Number(b.total_score ?? 0) - Number(a.total_score ?? 0);
          if (diff !== 0) return diff;
          return Number(a.total_response_ms ?? Infinity) - Number(b.total_response_ms ?? Infinity);
        });

        await Promise.all([
          ...sorted.map((entry, idx) => {
            const rank = idx + 1;
            const prize = getPrizeForRank(rank, nextStructure);
            return supabase
              .from("session_entries")
              .update({ final_rank: rank, prize_awarded: prize })
              .eq("id", entry.id);
          }),
          ...(lbRows ?? []).map((lb) => {
            const prize = getPrizeForRank(Number(lb.rank), nextStructure);
            return supabase
              .from("leaderboards")
              .update({ prize })
              .eq("session_id", id)
              .eq("user_id", lb.user_id);
          }),
        ]);
      }

      if (Array.isArray(selectedQuestionIds) && selectedQuestionIds.length > 0) {
        await supabase.from("session_questions").delete().eq("session_id", id);
        const sqRows = selectedQuestionIds.map((qid: string, idx: number) => ({
          session_id: id,
          question_id: qid,
          position: idx + 1,
        }));
        await supabase.from("session_questions").insert(sqRows);
      }

      return NextResponse.json({ ok: true, session: updatedSession });
    }

    if (status) {
      const { data, error } = await supabase
        .from("game_sessions")
        .update({ status })
        .eq("id", id)
        .select()
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, session: data });
    }

    return NextResponse.json({ error: "No valid action or status provided" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update session" },
      { status: 500 }
    );
  }
}
