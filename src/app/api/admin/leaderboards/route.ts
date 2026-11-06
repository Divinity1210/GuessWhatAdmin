import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

type PrizeTier = {
  rank_from: number;
  rank_to: number;
  amount: number;
};

type ArchivedAnswerItem = {
  question_id: string;
  option_id: string;
  response_ms?: number;
};

type ArchivedAttemptDetail = {
  entry_id?: string;
  session_id?: string;
  attempt_number?: number;
  questions_answered?: number;
  total_score?: number;
  total_response_ms?: number;
  final_rank?: number | null;
  answers?: ArchivedAnswerItem[];
  completed_at?: string;
};

type CalculationStep = {
  questionNumber: number;
  questionId: string;
  questionTitle: string;
  category: string;
  pickedOptionId: string;
  pickedOptionLabel: string;
  optionTotalPicks: number;
  optionPercentage: number;
  consensusRank: number;
  pointsAwarded: number;
  responseMs: number;
};

const DEFAULT_36_STRUCTURE: PrizeTier[] = [
  { rank_from: 1, rank_to: 1, amount: 100000 },
  { rank_from: 2, rank_to: 2, amount: 50000 },
  { rank_from: 3, rank_to: 3, amount: 20000 },
  { rank_from: 4, rank_to: 36, amount: 10000 },
];

function getPrizeForRank(rank: number, structure: PrizeTier[]): number {
  for (const tier of structure) {
    if (rank >= Number(tier.rank_from) && rank <= Number(tier.rank_to)) {
      return Number(tier.amount ?? 0);
    }
  }
  return 0;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(req.url);
    const requestedSessionId = searchParams.get("sessionId") || "";
    const searchQuery = (searchParams.get("q") || "").trim().toLowerCase();

    const [
      { data: sessions },
      { data: entries },
      { data: answers },
      { data: questions },
      { data: sessionQuestions },
      { data: profiles },
      { data: appSettings },
      { data: auditLogs },
    ] = await Promise.all([
      supabase
        .from("game_sessions")
        .select("*")
        .order("starts_at", { ascending: false }),
      supabase
        .from("session_entries")
        .select("*"),
      supabase
        .from("answers")
        .select("*"),
      supabase
        .from("questions")
        .select("id, title, category, type, question_options(id, label, position, media_url)"),
      supabase
        .from("session_questions")
        .select("session_id, question_id, position")
        .order("position", { ascending: true }),
      supabase
        .from("profiles")
        .select("id, username, full_name, state, gender"),
      supabase.from("app_settings").select("key, value"),
      supabase
        .from("audit_logs")
        .select("id, actor_id, target_id, detail, created_at")
        .eq("action", "gameplay_attempt_archived")
        .order("created_at", { ascending: false }),
    ]);

    const allSessions = sessions ?? [];
    if (allSessions.length === 0) {
      return NextResponse.json({
        sessions: [],
        activeSession: null,
        leaderboard: [],
      });
    }

    // Pick requested session, or active session, or most recent session
    const targetSession =
      allSessions.find((s) => s.id === requestedSessionId) ??
      allSessions.find((s) => s.status === "active") ??
      allSessions[0];

    const sessionId = targetSession.id;

    const profileMap = new Map<
      string,
      { username: string; fullName: string; state: string; gender: string }
    >();
    for (const p of profiles ?? []) {
      profileMap.set(p.id, {
        username: p.username || "player",
        fullName: p.full_name || p.username || "Player",
        state: p.state || "Nigeria",
        gender: p.gender || "Unspecified",
      });
    }

    // Lookup dispute statuses for this session
    const disputeKey = `leaderboard_disputes_${sessionId}`;
    const disputeSetting = (appSettings ?? []).find((r) => r.key === disputeKey);
    const disputeMap: Record<string, { status: string; note?: string; updatedAt?: string }> =
      ((disputeSetting?.value as {
        disputes?: Record<string, { status: string; note?: string; updatedAt?: string }>;
      })?.disputes ??
        (disputeSetting?.value as Record<
          string,
          { status: string; note?: string; updatedAt?: string }
        >) ??
        {});

    // Filter archived logs for this session
    const sessionArchivedLogs = (auditLogs ?? []).filter((log) => {
      const d = (log.detail ?? {}) as ArchivedAttemptDetail;
      return (d.session_id || log.target_id) === sessionId;
    });

    // Build question and option consensus rankings for this session (live answers + archived replay answers)
    const sessionAnswers = (answers ?? []).filter((a) => a.session_id === sessionId);
    const optionPickCounts = new Map<string, number>();
    const questionTotalPicks = new Map<string, number>();

    for (const a of sessionAnswers) {
      optionPickCounts.set(a.option_id, (optionPickCounts.get(a.option_id) ?? 0) + 1);
      questionTotalPicks.set(a.question_id, (questionTotalPicks.get(a.question_id) ?? 0) + 1);
    }

    let archivedAnswerCount = 0;
    for (const log of sessionArchivedLogs) {
      const d = (log.detail ?? {}) as ArchivedAttemptDetail;
      if (Array.isArray(d.answers)) {
        for (const ans of d.answers) {
          if (ans.option_id && ans.question_id) {
            optionPickCounts.set(
              ans.option_id,
              (optionPickCounts.get(ans.option_id) ?? 0) + 1
            );
            questionTotalPicks.set(
              ans.question_id,
              (questionTotalPicks.get(ans.question_id) ?? 0) + 1
            );
            archivedAnswerCount += 1;
          }
        }
      }
    }

    const questionMeta = new Map<
      string,
      {
        id: string;
        title: string;
        category: string;
        type: string;
        totalPicks: number;
      }
    >();
    const optionConsensus = new Map<
      string,
      {
        optionId: string;
        label: string;
        questionId: string;
        picks: number;
        percentage: number;
        consensusRank: number;
        pointsAwarded: number;
      }
    >();

    for (const q of questions ?? []) {
      const totalQ = questionTotalPicks.get(q.id) ?? 0;
      questionMeta.set(q.id, {
        id: q.id,
        title: q.title,
        category: q.category || "General",
        type: q.type || "text",
        totalPicks: totalQ,
      });

      const opts = [...(q.question_options ?? [])].sort(
        (a: { position: number }, b: { position: number }) => a.position - b.position
      );
      const ranked = [...opts].sort((a, b) => {
        const diff = (optionPickCounts.get(b.id) ?? 0) - (optionPickCounts.get(a.id) ?? 0);
        return diff !== 0 ? diff : a.position - b.position;
      });

      let currentRankIdx = 0;
      ranked.forEach((opt, idx) => {
        const picks = optionPickCounts.get(opt.id) ?? 0;
        const prevPicks =
          idx > 0 ? (optionPickCounts.get(ranked[idx - 1].id) ?? 0) : picks;
        if (idx > 0 && picks < prevPicks) {
          currentRankIdx = idx;
        }
        const pct = totalQ > 0 ? Number(((picks / totalQ) * 100).toFixed(1)) : 0;
        optionConsensus.set(opt.id, {
          optionId: opt.id,
          label: opt.label,
          questionId: q.id,
          picks,
          percentage: pct,
          consensusRank: currentRankIdx + 1,
          pointsAwarded: picks > 0 ? Math.max(10 - currentRankIdx, 1) : 1,
        });
      });
    }

    // Order of questions in this session
    const sqOrder = new Map<string, number>();
    for (const sq of sessionQuestions ?? []) {
      if (sq.session_id === sessionId) {
        sqOrder.set(sq.question_id, sq.position);
      }
    }

    const buildBreakdownFromAnswerList = (
      rawList: { question_id: string; option_id: string; response_ms?: number }[]
    ): CalculationStep[] => {
      const steps: CalculationStep[] = rawList.map((ans, idx) => {
        const q = questionMeta.get(ans.question_id);
        const opt = optionConsensus.get(ans.option_id);
        return {
          questionNumber: sqOrder.get(ans.question_id) ?? idx + 1,
          questionId: ans.question_id,
          questionTitle: q?.title || "Question",
          category: q?.category || "General",
          pickedOptionId: ans.option_id,
          pickedOptionLabel: opt?.label || "Selected Option",
          optionTotalPicks: opt?.picks ?? 1,
          optionPercentage: opt?.percentage ?? 0,
          consensusRank: opt?.consensusRank ?? 1,
          pointsAwarded: opt?.pointsAwarded ?? 1,
          responseMs: Number(ans.response_ms ?? 0),
        };
      });
      return steps.sort((a, b) => a.questionNumber - b.questionNumber);
    };

    // Group live answers by entry_id
    const answersByEntry = new Map<string, CalculationStep[]>();
    const rawAnswersByEntry = new Map<
      string,
      { question_id: string; option_id: string; response_ms?: number }[]
    >();

    for (const ans of sessionAnswers) {
      const list = rawAnswersByEntry.get(ans.entry_id) ?? [];
      list.push(ans);
      rawAnswersByEntry.set(ans.entry_id, list);
    }
    for (const [entryId, list] of rawAnswersByEntry.entries()) {
      answersByEntry.set(entryId, buildBreakdownFromAnswerList(list));
    }

    const sessionEntries = (entries ?? []).filter((e) => e.session_id === sessionId);
    const structure: PrizeTier[] =
      Array.isArray(targetSession.prize_structure) && targetSession.prize_structure.length > 0
        ? (targetSession.prize_structure as PrizeTier[])
        : DEFAULT_36_STRUCTURE;

    const computedRows = sessionEntries.map((e) => {
      const currentBreakdown = answersByEntry.get(e.id) ?? [];
      const currentScore =
        currentBreakdown.length > 0
          ? currentBreakdown.reduce((sum, b) => sum + b.pointsAwarded, 0)
          : Number(e.total_score ?? 0);
      const currentTimeMs =
        currentBreakdown.length > 0
          ? currentBreakdown.reduce((sum, b) => sum + b.responseMs, 0)
          : Number(e.total_response_ms ?? 0);

      // Inspect all archived attempts for this player in this session
      const playerArchivedLogs = sessionArchivedLogs.filter((l) => {
        const d = (l.detail ?? {}) as ArchivedAttemptDetail;
        return d.entry_id === e.id || l.actor_id === e.user_id;
      });

      type CandidateAttempt = {
        score: number;
        totalTimeMs: number;
        breakdown: CalculationStep[];
        guessesCount: number;
        isFromArchive: boolean;
      };

      const candidates: CandidateAttempt[] = [];

      if (
        currentBreakdown.length > 0 ||
        (playerArchivedLogs.length === 0 && e.total_score != null)
      ) {
        candidates.push({
          score: currentScore,
          totalTimeMs: currentTimeMs > 0 ? currentTimeMs : 45000,
          breakdown: currentBreakdown,
          guessesCount: currentBreakdown.length > 0 ? currentBreakdown.length : e.completed_at ? 10 : 0,
          isFromArchive: false,
        });
      }

      for (const log of playerArchivedLogs) {
        const d = (log.detail ?? {}) as ArchivedAttemptDetail;
        const hasArchAnswers = Array.isArray(d.answers) && d.answers.length > 0;
        const archBreakdown = hasArchAnswers
          ? buildBreakdownFromAnswerList(d.answers!)
          : currentBreakdown;
        const dynScore =
          archBreakdown.length > 0
            ? archBreakdown.reduce((sum, b) => sum + b.pointsAwarded, 0)
            : 0;
        // Always use live dynamic crowd-consensus score when answers exist so scores move up OR down as votes change
        const bestArchScore = hasArchAnswers ? dynScore : Number(d.total_score ?? dynScore);
        const dynTimeMs =
          archBreakdown.length > 0
            ? archBreakdown.reduce((sum, b) => sum + b.responseMs, 0)
            : 0;
        const archTimeMs = Number(d.total_response_ms || dynTimeMs || 45000);

        candidates.push({
          score: bestArchScore,
          totalTimeMs: archTimeMs,
          breakdown: archBreakdown,
          guessesCount: Number(d.questions_answered ?? (archBreakdown.length || 10)),
          isFromArchive: true,
        });
      }

      // Sort candidates: highest score first, shortest totalTimeMs tie-breaker
      candidates.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.totalTimeMs - b.totalTimeMs;
      });

      const bestAttempt: CandidateAttempt = candidates[0] ?? {
        score: currentScore,
        totalTimeMs: currentTimeMs,
        breakdown: currentBreakdown,
        guessesCount: currentBreakdown.length,
        isFromArchive: false,
      };

      const attemptsCount = Math.max(
        1,
        playerArchivedLogs.length + (currentBreakdown.length > 0 || e.completed_at ? 1 : 0)
      );

      const prof = profileMap.get(e.user_id) ?? {
        username: "player",
        fullName: "Player",
        state: "Nigeria",
        gender: "Unspecified",
      };

      const disp = disputeMap[e.id] || disputeMap[e.user_id] || {
        status: "Clear",
        note: "",
      };

      return {
        entryId: e.id,
        userId: e.user_id,
        username: prof.username,
        fullName: prof.fullName,
        state: prof.state,
        gender: prof.gender,
        storedRank: e.final_rank ?? null,
        score: bestAttempt.score,
        latestScore: currentScore > 0 ? currentScore : bestAttempt.score,
        latestTimeMs: currentTimeMs > 0 ? currentTimeMs : bestAttempt.totalTimeMs,
        attemptsCount,
        isBestFromPriorAttempt:
          bestAttempt.isFromArchive && currentScore > 0 && bestAttempt.score > currentScore,
        storedScore: e.total_score ?? null,
        totalTimeMs: bestAttempt.totalTimeMs,
        guessesSubmitted: bestAttempt.guessesCount,
        completedAt: e.completed_at || e.joined_at,
        disputeStatus: disp.status || "Clear",
        disputeNote: disp.note || "",
        calculationBreakdown: bestAttempt.breakdown,
        storedPrize: Number(e.prize_awarded ?? 0),
      };
    });

    // Sort by Best Score DESC, then Best Total Time Taken (ms) ASC (Page 39 Tie-Breaker Rule)
    computedRows.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.totalTimeMs - b.totalTimeMs;
    });

    const leaderboard = computedRows
      .map((row, idx) => {
        const liveRank = idx + 1;
        const rankDelta =
          row.storedRank != null ? row.storedRank - liveRank : 0;
        const allocatedPrize =
          row.storedPrize > 0 ? row.storedPrize : getPrizeForRank(liveRank, structure);

        return {
          ...row,
          rank: liveRank,
          rankDelta,
          allocatedPrize,
        };
      })
      .filter((r) => {
        if (!searchQuery) return true;
        return (
          r.username.toLowerCase().includes(searchQuery) ||
          r.fullName.toLowerCase().includes(searchQuery) ||
          r.state.toLowerCase().includes(searchQuery)
        );
      });

    return NextResponse.json({
      sessions: allSessions.map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        startsAt: s.starts_at,
        endsAt: s.ends_at,
        prizePool: Number(s.prize_pool ?? 0),
      })),
      activeSession: {
        id: targetSession.id,
        name: targetSession.name,
        status: targetSession.status,
        startsAt: targetSession.starts_at,
        endsAt: targetSession.ends_at,
        prizePool: Number(targetSession.prize_pool ?? 0),
      },
      summary: {
        totalParticipants: computedRows.length,
        totalGuessesInSession: sessionAnswers.length + archivedAnswerCount,
        disputedCount: computedRows.filter((r) => r.disputeStatus !== "Clear").length,
        topScore: computedRows[0]?.score ?? 0,
        multiAttemptPlayersCount: computedRows.filter((r) => r.attemptsCount > 1).length,
      },
      leaderboard,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load leaderboard" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await req.json();
    const { sessionId, action, entryId, disputeStatus, disputeNote } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    if (action === "update_dispute" && entryId) {
      const disputeKey = `leaderboard_disputes_${sessionId}`;
      const { data: existing } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", disputeKey)
        .maybeSingle();

      const currentMap =
        ((existing?.value as { disputes?: Record<string, unknown> })?.disputes ??
          (existing?.value as Record<string, unknown>) ??
          {}) as Record<string, { status: string; note?: string; updatedAt: string }>;

      currentMap[entryId] = {
        status: disputeStatus || "Under Investigation",
        note: disputeNote || "",
        updatedAt: new Date().toISOString(),
      };

      await supabase.from("app_settings").upsert({
        key: disputeKey,
        value: { disputes: currentMap },
        updated_at: new Date().toISOString(),
      });

      return NextResponse.json({ ok: true });
    }

    if (action === "recalculate_and_publish") {
      // Recalculate Best-Score consensus points (10..1) and millisecond tie-breakers and persist to session_entries + leaderboards
      const [
        { data: session },
        { data: entries },
        { data: answers },
        { data: questions },
        { data: auditLogs },
      ] = await Promise.all([
        supabase.from("game_sessions").select("*").eq("id", sessionId).single(),
        supabase.from("session_entries").select("*").eq("session_id", sessionId),
        supabase.from("answers").select("*").eq("session_id", sessionId),
        supabase.from("questions").select("id, question_options(id, position)"),
        supabase
          .from("audit_logs")
          .select("id, actor_id, target_id, detail")
          .eq("action", "gameplay_attempt_archived"),
      ]);

      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      const sessionArchived = (auditLogs ?? []).filter((l) => {
        const d = (l.detail ?? {}) as ArchivedAttemptDetail;
        return (d.session_id || l.target_id) === sessionId;
      });

      const optionPicks = new Map<string, number>();
      for (const a of answers ?? []) {
        optionPicks.set(a.option_id, (optionPicks.get(a.option_id) ?? 0) + 1);
      }
      for (const l of sessionArchived) {
        const d = (l.detail ?? {}) as ArchivedAttemptDetail;
        if (Array.isArray(d.answers)) {
          for (const ans of d.answers) {
            if (ans.option_id) {
              optionPicks.set(ans.option_id, (optionPicks.get(ans.option_id) ?? 0) + 1);
            }
          }
        }
      }

      const optionPts = new Map<string, number>();
      for (const q of questions ?? []) {
        const opts = [...(q.question_options ?? [])].sort(
          (a: { position: number }, b: { position: number }) => a.position - b.position
        );
        const ranked = [...opts].sort((a, b) => {
          const diff = (optionPicks.get(b.id) ?? 0) - (optionPicks.get(a.id) ?? 0);
          return diff !== 0 ? diff : a.position - b.position;
        });
        let currentRankIdx = 0;
        ranked.forEach((opt, idx) => {
          const picks = optionPicks.get(opt.id) ?? 0;
          const prevPicks =
            idx > 0 ? (optionPicks.get(ranked[idx - 1].id) ?? 0) : picks;
          if (idx > 0 && picks < prevPicks) {
            currentRankIdx = idx;
          }
          optionPts.set(opt.id, picks > 0 ? Math.max(10 - currentRankIdx, 1) : 1);
        });
      }

      const entryAgg = new Map<string, { score: number; ms: number; count: number }>();
      for (const a of answers ?? []) {
        const cur = entryAgg.get(a.entry_id) ?? { score: 0, ms: 0, count: 0 };
        cur.score += optionPts.get(a.option_id) ?? 1;
        cur.ms += Number(a.response_ms ?? 0);
        cur.count += 1;
        entryAgg.set(a.entry_id, cur);
      }

      const scored = (entries ?? []).map((e) => {
        const agg = entryAgg.get(e.id);
        let bestScore = agg && agg.count > 0 ? agg.score : Number(e.total_score ?? 0);
        let bestMs =
          agg && agg.count > 0 && agg.ms > 0
            ? agg.ms
            : Number(e.total_response_ms ?? (agg?.ms || 45000));

        const pArch = sessionArchived.filter((l) => {
          const d = (l.detail ?? {}) as ArchivedAttemptDetail;
          return d.entry_id === e.id || l.actor_id === e.user_id;
        });

        for (const log of pArch) {
          const d = (log.detail ?? {}) as ArchivedAttemptDetail;
          let archDynScore = 0;
          let archDynMs = 0;
          const hasArchAnswers = Array.isArray(d.answers) && d.answers.length > 0;
          if (hasArchAnswers) {
            for (const ans of d.answers!) {
              archDynScore += optionPts.get(ans.option_id) ?? 1;
              archDynMs += Number(ans.response_ms ?? 0);
            }
          }
          const candScore = hasArchAnswers ? archDynScore : Number(d.total_score ?? 0);
          const candMs = Number(d.total_response_ms || archDynMs || 45000);
          if (
            candScore > bestScore ||
            (candScore === bestScore && candMs < bestMs)
          ) {
            bestScore = candScore;
            bestMs = candMs;
          }
        }

        return {
          ...e,
          calc_score: bestScore,
          calc_ms: bestMs,
        };
      });

      scored.sort((a, b) => {
        if (b.calc_score !== a.calc_score) return b.calc_score - a.calc_score;
        return a.calc_ms - b.calc_ms;
      });

      const structure: PrizeTier[] =
        Array.isArray(session.prize_structure) && session.prize_structure.length > 0
          ? (session.prize_structure as PrizeTier[])
          : DEFAULT_36_STRUCTURE;

      const lbRowsToInsert: {
        session_id: string;
        user_id: string;
        rank: number;
        points: number;
        response_ms: number;
        prize: number;
      }[] = [];

      for (let i = 0; i < scored.length; i++) {
        const row = scored[i];
        const rank = i + 1;
        const prize = getPrizeForRank(rank, structure);
        await supabase
          .from("session_entries")
          .update({
            total_score: row.calc_score,
            total_response_ms: row.calc_ms,
            final_rank: rank,
            prize_awarded: prize,
          })
          .eq("id", row.id);

        lbRowsToInsert.push({
          session_id: sessionId,
          user_id: row.user_id,
          rank,
          points: row.calc_score,
          response_ms: row.calc_ms,
          prize,
        });
      }

      await supabase.from("leaderboards").delete().eq("session_id", sessionId);
      if (lbRowsToInsert.length > 0) {
        await supabase.from("leaderboards").insert(lbRowsToInsert);
      }

      return NextResponse.json({ ok: true, updatedCount: scored.length });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update leaderboard" },
      { status: 500 }
    );
  }
}
