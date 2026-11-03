import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

function escapeCsv(val: string | number | null | undefined): string {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

type ArchivedAttemptDetail = {
  entry_id?: string;
  session_id?: string;
  attempt_number?: number;
  questions_answered?: number;
  total_score?: number;
  total_response_ms?: number;
  final_rank?: number | null;
  started_at?: string;
  completed_at?: string;
  answers?: { question_id: string; option_id: string; response_ms?: number }[];
};

export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(req.url);

    const sessionFilter = searchParams.get("sessionId") || "all";
    const questionFilter = searchParams.get("questionId") || "all";
    const searchFilter = (searchParams.get("q") || "").trim().toLowerCase();
    const format = searchParams.get("format") || "json";

    const [
      { data: sessions },
      { data: entries },
      { data: answers },
      { data: questions },
      { data: sessionQuestions },
      { data: profiles },
      { data: auditLogs },
    ] = await Promise.all([
      supabase
        .from("game_sessions")
        .select("id, name, status, starts_at, ends_at, prize_pool, entry_fee_coins")
        .order("starts_at", { ascending: false }),
      supabase
        .from("session_entries")
        .select(
          "id, session_id, user_id, joined_at, completed_at, total_score, total_response_ms, final_rank, prize_awarded"
        )
        .order("joined_at", { ascending: false }),
      supabase
        .from("answers")
        .select("id, entry_id, session_id, question_id, option_id, response_ms, answered_at")
        .order("answered_at", { ascending: false }),
      supabase
        .from("questions")
        .select("id, title, category, type, status, question_options(id, label, position, media_url)")
        .order("created_at", { ascending: false }),
      supabase
        .from("session_questions")
        .select("session_id, question_id, position")
        .order("position", { ascending: true }),
      supabase
        .from("profiles")
        .select("id, username, full_name, state, gender"),
      supabase
        .from("audit_logs")
        .select("id, actor_id, action, target_table, target_id, detail, created_at")
        .in("action", [
          "gameplay_start",
          "gameplay_replay",
          "gameplay_attempt_archived",
          "gameplay_answer",
          "gameplay_complete",
        ])
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

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

    const sessionMap = new Map<
      string,
      {
        id: string;
        name: string;
        status: string;
        starts_at: string;
        ends_at: string;
        prize_pool: number;
      }
    >();
    for (const s of sessions ?? []) {
      sessionMap.set(s.id, {
        id: s.id,
        name: s.name,
        status: s.status,
        starts_at: s.starts_at,
        ends_at: s.ends_at,
        prize_pool: Number(s.prize_pool ?? 0),
      });
    }

    const entryMap = new Map<
      string,
      {
        id: string;
        session_id: string;
        user_id: string;
        joined_at: string;
        completed_at: string | null;
        total_score: number | null;
        total_response_ms: number | null;
        final_rank: number | null;
      }
    >();
    for (const e of entries ?? []) {
      entryMap.set(e.id, e);
    }

    const questionMap = new Map<
      string,
      {
        id: string;
        title: string;
        category: string;
        type: string;
        options: { id: string; label: string; position: number; media_url?: string | null }[];
      }
    >();
    const optionLookup = new Map<
      string,
      { id: string; label: string; questionId: string; position: number; media_url?: string | null }
    >();

    for (const q of questions ?? []) {
      const sortedOpts = [...(q.question_options ?? [])].sort(
        (a: { position: number }, b: { position: number }) => a.position - b.position
      );
      questionMap.set(q.id, {
        id: q.id,
        title: q.title,
        category: q.category || "General",
        type: q.type || "text",
        options: sortedOpts,
      });
      for (const opt of sortedOpts) {
        optionLookup.set(opt.id, {
          id: opt.id,
          label: opt.label,
          questionId: q.id,
          position: opt.position,
          media_url: opt.media_url,
        });
      }
    }

    // Filter answers and entries by selected session
    const scopedAnswers = (answers ?? []).filter((a) => {
      if (sessionFilter !== "all" && a.session_id !== sessionFilter) return false;
      if (questionFilter !== "all" && a.question_id !== questionFilter) return false;
      return true;
    });

    const scopedEntries = (entries ?? []).filter((e) => {
      if (sessionFilter !== "all" && e.session_id !== sessionFilter) return false;
      return true;
    });

    const archivedAttemptLogs = (auditLogs ?? []).filter((log) => {
      if (log.action !== "gameplay_attempt_archived") return false;
      const d = (log.detail ?? {}) as ArchivedAttemptDetail;
      const sid = d.session_id || log.target_id || "";
      if (sessionFilter !== "all" && sid !== sessionFilter) return false;
      return true;
    });

    // ── Compute Per-Question Option Selections, Percentages, Points (10 down to 1), & Timings ──
    const optionStatsByQuestion = new Map<
      string,
      Map<string, { selections: number; totalMs: number; minMs: number; maxMs: number }>
    >();

    for (const q of questionMap.values()) {
      const oMap = new Map<
        string,
        { selections: number; totalMs: number; minMs: number; maxMs: number }
      >();
      for (const opt of q.options) {
        oMap.set(opt.id, { selections: 0, totalMs: 0, minMs: Infinity, maxMs: 0 });
      }
      optionStatsByQuestion.set(q.id, oMap);
    }

    // Extract archived attempt answers so option counts & point buckets include all replays
    const archivedAnswerItems: { question_id: string; option_id: string; response_ms?: number }[] = [];
    for (const log of archivedAttemptLogs) {
      const d = (log.detail ?? {}) as ArchivedAttemptDetail;
      if (Array.isArray(d.answers)) {
        for (const a of d.answers) {
          if (!a.question_id || !a.option_id) continue;
          if (questionFilter !== "all" && a.question_id !== questionFilter) continue;
          archivedAnswerItems.push(a);
        }
      }
    }

    const allScopedAnswers = [...scopedAnswers, ...archivedAnswerItems];

    for (const ans of allScopedAnswers) {
      let oMap = optionStatsByQuestion.get(ans.question_id);
      if (!oMap) {
        oMap = new Map();
        optionStatsByQuestion.set(ans.question_id, oMap);
      }
      const cur = oMap.get(ans.option_id) ?? {
        selections: 0,
        totalMs: 0,
        minMs: Infinity,
        maxMs: 0,
      };
      const ms = Number(ans.response_ms ?? 0);
      cur.selections += 1;
      cur.totalMs += ms;
      if (ms > 0 && ms < cur.minMs) cur.minMs = ms;
      if (ms > cur.maxMs) cur.maxMs = ms;
      oMap.set(ans.option_id, cur);
    }

    // Map session_questions: which questions belong to which session and at what position (1..10)
    const sessionQuestionMap = new Map<string, Map<string, number>>();
    const questionSessionsUsedMap = new Map<string, string[]>();
    for (const sq of sessionQuestions ?? []) {
      let qPosMap = sessionQuestionMap.get(sq.session_id);
      if (!qPosMap) {
        qPosMap = new Map();
        sessionQuestionMap.set(sq.session_id, qPosMap);
      }
      qPosMap.set(sq.question_id, sq.position);

      const usedList = questionSessionsUsedMap.get(sq.question_id) ?? [];
      if (!usedList.includes(sq.session_id)) usedList.push(sq.session_id);
      questionSessionsUsedMap.set(sq.question_id, usedList);
    }

    // Dynamic points lookup per option_id (10 pts for most selected -> 1 pt for least selected)
    const liveOptionPoints = new Map<string, { rank: number; points: number; percentage: number }>();

    const currentSessionPosMap =
      sessionFilter !== "all" ? sessionQuestionMap.get(sessionFilter) : undefined;

    const questionBreakdown = Array.from(questionMap.values())
      .filter((q) => questionFilter === "all" || q.id === questionFilter)
      .map((q) => {
        const oMap = optionStatsByQuestion.get(q.id) ?? new Map();
        const totalQuestionSelections = q.options.reduce(
          (sum, opt) => sum + (oMap.get(opt.id)?.selections ?? 0),
          0
        );
        const totalQuestionTimeMs = q.options.reduce(
          (sum, opt) => sum + (oMap.get(opt.id)?.totalMs ?? 0),
          0
        );

        let qFastestMs = Infinity;
        let qSlowestMs = 0;
        for (const opt of q.options) {
          const st = oMap.get(opt.id);
          if (st && st.selections > 0) {
            if (st.minMs < qFastestMs) qFastestMs = st.minMs;
            if (st.maxMs > qSlowestMs) qSlowestMs = st.maxMs;
          }
        }

        // Sort options by selections DESC, tie-broken by original position ASC
        const rankedOptions = [...q.options].sort((a, b) => {
          const diff = (oMap.get(b.id)?.selections ?? 0) - (oMap.get(a.id)?.selections ?? 0);
          return diff !== 0 ? diff : a.position - b.position;
        });

        const enrichedOptions = rankedOptions.map((opt, idx) => {
          const st = oMap.get(opt.id);
          const selections = st?.selections ?? 0;
          const percentage =
            totalQuestionSelections > 0
              ? Number(((selections / totalQuestionSelections) * 100).toFixed(1))
              : 0;
          const points = Math.max(10 - idx, 1);
          const rank = idx + 1;
          const avgResponseMs = selections > 0 ? Math.round((st?.totalMs ?? 0) / selections) : 0;

          liveOptionPoints.set(opt.id, { rank, points, percentage });

          return {
            id: opt.id,
            label: opt.label,
            position: opt.position,
            media_url: opt.media_url ?? null,
            rank,
            points,
            selections,
            percentage,
            avgResponseMs,
            isMostSelected: idx === 0 && totalQuestionSelections > 0,
            isLeastSelected:
              idx === rankedOptions.length - 1 && totalQuestionSelections > 0,
          };
        });

        const mostSelected = enrichedOptions[0] ?? null;
        const leastSelected = enrichedOptions[enrichedOptions.length - 1] ?? null;
        const usedSessionIds = questionSessionsUsedMap.get(q.id) ?? [];
        const assignedToSession =
          sessionFilter === "all" ? true : currentSessionPosMap?.has(q.id) ?? false;
        const sessionPosition =
          sessionFilter !== "all" && currentSessionPosMap?.has(q.id)
            ? (currentSessionPosMap.get(q.id) ?? null)
            : null;

        return {
          id: q.id,
          title: q.title,
          category: q.category,
          type: q.type,
          assignedToSession,
          sessionPosition,
          sessionsUsedCount: usedSessionIds.length,
          usedSessionNames: usedSessionIds
            .map((sid) => sessionMap.get(sid)?.name)
            .filter(Boolean),
          totalSelections: totalQuestionSelections,
          avgResponseMs:
            totalQuestionSelections > 0
              ? Math.round(totalQuestionTimeMs / totalQuestionSelections)
              : 0,
          fastestMs: qFastestMs === Infinity ? 0 : qFastestMs,
          slowestMs: qSlowestMs,
          mostSelected,
          leastSelected,
          options: enrichedOptions,
        };
      })
      .sort((a, b) => {
        if (sessionFilter !== "all") {
          if (a.assignedToSession && !b.assignedToSession) return -1;
          if (!a.assignedToSession && b.assignedToSession) return 1;
          if (a.sessionPosition !== null && b.sessionPosition !== null) {
            return a.sessionPosition - b.sessionPosition;
          }
        }
        return b.totalSelections - a.totalSelections;
      });

    // ── Identify Most and Least Selected Options Spotlight ──
    const mostAndLeastSelected = questionBreakdown
      .filter((q) => q.totalSelections > 0 && q.mostSelected && q.leastSelected)
      .map((q) => ({
        questionId: q.id,
        questionTitle: q.title,
        category: q.category,
        type: q.type,
        totalSelections: q.totalSelections,
        mostSelected: {
          optionId: q.mostSelected!.id,
          label: q.mostSelected!.label,
          selections: q.mostSelected!.selections,
          percentage: q.mostSelected!.percentage,
          points: q.mostSelected!.points,
          avgResponseMs: q.mostSelected!.avgResponseMs,
        },
        leastSelected: {
          optionId: q.leastSelected!.id,
          label: q.leastSelected!.label,
          selections: q.leastSelected!.selections,
          percentage: q.leastSelected!.percentage,
          points: q.leastSelected!.points,
          avgResponseMs: q.leastSelected!.avgResponseMs,
        },
      }));

    // ── Monitor the Distribution of Points ──
    // 1) Distribution of guesses across the 10 point values (10 pts down to 1 pt)
    const pointTierBuckets = new Map<
      number,
      { points: number; guesses: number; totalMs: number }
    >();
    for (let pt = 10; pt >= 1; pt--) {
      pointTierBuckets.set(pt, { points: pt, guesses: 0, totalMs: 0 });
    }

    let globalAnswerTimeMs = 0;
    let fastestAnswerMs = Infinity;
    let slowestAnswerMs = 0;

    for (const ans of allScopedAnswers) {
      const optMeta = liveOptionPoints.get(ans.option_id);
      const pts = optMeta?.points ?? 1;
      const ms = Number(ans.response_ms ?? 0);

      const bucket = pointTierBuckets.get(pts);
      if (bucket) {
        bucket.guesses += 1;
        bucket.totalMs += ms;
      }

      globalAnswerTimeMs += ms;
      if (ms > 0 && ms < fastestAnswerMs) fastestAnswerMs = ms;
      if (ms > slowestAnswerMs) slowestAnswerMs = ms;
    }

    const totalGuessesCount = allScopedAnswers.length;
    const byGuessPoints = Array.from(pointTierBuckets.values()).map((b) => ({
      points: b.points,
      label: b.points === 10 ? "10 pts (Most Selected)" : b.points === 1 ? "1 pt (Least Selected)" : `${b.points} pts`,
      guesses: b.guesses,
      percentage:
        totalGuessesCount > 0 ? Number(((b.guesses / totalGuessesCount) * 100).toFixed(1)) : 0,
      avgResponseMs: b.guesses > 0 ? Math.round(b.totalMs / b.guesses) : 0,
    }));

    // ── Build Historical Gameplay Attempts (Current Entries + Archived Replay Attempts) ──
    const answersCountByEntry = new Map<string, { count: number; sumMs: number; sumPts: number }>();
    for (const ans of answers ?? []) {
      const cur = answersCountByEntry.get(ans.entry_id) ?? { count: 0, sumMs: 0, sumPts: 0 };
      const pts = liveOptionPoints.get(ans.option_id)?.points ?? 1;
      cur.count += 1;
      cur.sumMs += Number(ans.response_ms ?? 0);
      cur.sumPts += pts;
      answersCountByEntry.set(ans.entry_id, cur);
    }

    // Count how many archived attempts each (session_id, user_id) has
    const archivedBySessionUser = new Map<string, ArchivedAttemptDetail[]>();
    for (const log of archivedAttemptLogs) {
      const d = (log.detail ?? {}) as ArchivedAttemptDetail;
      const sid = d.session_id || log.target_id || "";
      const uid = log.actor_id || "";
      const key = `${sid}:${uid}`;
      const list = archivedBySessionUser.get(key) ?? [];
      list.push({
        ...d,
        completed_at: d.completed_at || log.created_at,
      });
      archivedBySessionUser.set(key, list);
    }

    type HistoricalPlayRow = {
      id: string;
      entryId: string;
      sessionId: string;
      sessionName: string;
      userId: string;
      username: string;
      fullName: string;
      state: string;
      attemptNumber: number;
      isReplay: boolean;
      isBestScoreRun?: boolean;
      bestScore?: number;
      status: "Completed" | "In Progress" | "Archived Replay";
      questionsAnswered: number;
      totalScore: number;
      totalPlayTimeMs: number;
      avgQuestionTimeMs: number;
      rank: number | null;
      timestamp: string;
    };

    const historicalPlays: HistoricalPlayRow[] = [];

    // Add current session entries + archived prior attempts with Best-Score tracking
    for (const e of scopedEntries) {
      const p = profileMap.get(e.user_id) ?? {
        username: "player",
        fullName: "Player",
        state: "Nigeria",
        gender: "Unspecified",
      };
      const sess = sessionMap.get(e.session_id);
      const ansAgg = answersCountByEntry.get(e.id);
      const priorList = archivedBySessionUser.get(`${e.session_id}:${e.user_id}`) ?? [];
      const attemptNumber = priorList.length + 1;
      const qCount = ansAgg?.count ?? (e.completed_at ? 10 : 0);
      // Actual score for the latest/current attempt:
      const currentAttemptScore =
        ansAgg && ansAgg.count > 0 ? ansAgg.sumPts : Number(e.total_score ?? 0);
      const playMs =
        ansAgg && ansAgg.count > 0 ? ansAgg.sumMs : Number(e.total_response_ms ?? 0);

      // Compute archived attempt scores dynamically as well
      const computedPrior = priorList.map((arch, idx) => {
        let dynPts = 0;
        let dynMs = 0;
        if (Array.isArray(arch.answers)) {
          for (const a of arch.answers) {
            dynPts += liveOptionPoints.get(a.option_id)?.points ?? 1;
            dynMs += Number(a.response_ms ?? 0);
          }
        }
        const archScore = Math.max(dynPts, Number(arch.total_score ?? 65));
        const archMs = Number(arch.total_response_ms || dynMs || 45000);
        return {
          arch,
          idx,
          archScore,
          archMs,
          archQ: arch.questions_answered ?? 10,
          archNum: arch.attempt_number ?? idx + 1,
        };
      });

      const playerBestScore = Math.max(
        currentAttemptScore,
        Number(e.total_score ?? 0),
        ...computedPrior.map((cp) => cp.archScore)
      );

      historicalPlays.push({
        id: `entry_${e.id}`,
        entryId: e.id,
        sessionId: e.session_id,
        sessionName: sess?.name || "Game Session",
        userId: e.user_id,
        username: p.username,
        fullName: p.fullName,
        state: p.state,
        attemptNumber,
        isReplay: attemptNumber > 1,
        isBestScoreRun: currentAttemptScore >= playerBestScore,
        bestScore: playerBestScore,
        status: e.completed_at ? "Completed" : "In Progress",
        questionsAnswered: qCount,
        totalScore: currentAttemptScore,
        totalPlayTimeMs: Number(playMs),
        avgQuestionTimeMs: qCount > 0 ? Math.round(Number(playMs) / qCount) : 0,
        rank: e.final_rank ?? null,
        timestamp: e.completed_at || e.joined_at,
      });

      // Add archived prior attempts for this user/session
      computedPrior.forEach(({ arch, idx, archScore, archMs, archQ, archNum }) => {
        historicalPlays.push({
          id: `arch_${e.id}_${archNum}_${idx}`,
          entryId: e.id,
          sessionId: e.session_id,
          sessionName: sess?.name || "Game Session",
          userId: e.user_id,
          username: p.username,
          fullName: p.fullName,
          state: p.state,
          attemptNumber: archNum,
          isReplay: archNum > 1,
          isBestScoreRun: archScore >= playerBestScore && archScore > currentAttemptScore,
          bestScore: playerBestScore,
          status: "Archived Replay",
          questionsAnswered: archQ,
          totalScore: archScore,
          totalPlayTimeMs: archMs,
          avgQuestionTimeMs: archQ > 0 ? Math.round(archMs / archQ) : 0,
          rank: arch.final_rank ?? null,
          timestamp: arch.completed_at || e.joined_at,
        });
      });
    }

    historicalPlays.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const filteredHistoricalPlays = searchFilter
      ? historicalPlays.filter(
          (hp) =>
            hp.username.toLowerCase().includes(searchFilter) ||
            hp.fullName.toLowerCase().includes(searchFilter) ||
            hp.sessionName.toLowerCase().includes(searchFilter) ||
            hp.state.toLowerCase().includes(searchFilter)
        )
      : historicalPlays;

    // ── Player Score Distribution across all plays ──
    const allScores = historicalPlays
      .filter((hp) => hp.questionsAnswered > 0)
      .map((hp) => hp.totalScore)
      .sort((a, b) => a - b);

    const minScore = allScores.length > 0 ? allScores[0] : 0;
    const maxScore = allScores.length > 0 ? allScores[allScores.length - 1] : 0;
    const avgScore =
      allScores.length > 0
        ? Number((allScores.reduce((s, v) => s + v, 0) / allScores.length).toFixed(1))
        : 0;
    const medianScore =
      allScores.length > 0 ? allScores[Math.floor(allScores.length / 2)] : 0;

    const scoreBrackets = [
      { label: "90–100 pts (Top Consensus)", min: 90, max: 100, count: 0 },
      { label: "75–89 pts (Strong)", min: 75, max: 89, count: 0 },
      { label: "60–74 pts (Competitive)", min: 60, max: 74, count: 0 },
      { label: "Under 60 pts (Outlier Picks)", min: 0, max: 59, count: 0 },
    ];
    for (const sc of allScores) {
      for (const br of scoreBrackets) {
        if (sc >= br.min && sc <= br.max) {
          br.count += 1;
          break;
        }
      }
    }

    // ── Monitor Repeat Gameplay ──
    const playsByPlayer = new Map<
      string,
      {
        userId: string;
        username: string;
        fullName: string;
        state: string;
        totalPlays: number;
        replayCount: number;
        sessionsSet: Set<string>;
        firstScore: number;
        bestScore: number;
        latestScore: number;
        totalTimeSpentMs: number;
        totalQuestionsAnswered: number;
        lastPlayedAt: string;
      }
    >();

    // Process chronologically (oldest first) so firstScore and latestScore are exact
    const chronologicalPlays = [...historicalPlays].reverse();
    for (const hp of chronologicalPlays) {
      const existing = playsByPlayer.get(hp.userId);
      if (!existing) {
        playsByPlayer.set(hp.userId, {
          userId: hp.userId,
          username: hp.username,
          fullName: hp.fullName,
          state: hp.state,
          totalPlays: 1,
          replayCount: hp.isReplay ? 1 : 0,
          sessionsSet: new Set([hp.sessionId]),
          firstScore: hp.totalScore,
          bestScore: hp.totalScore,
          latestScore: hp.totalScore,
          totalTimeSpentMs: hp.totalPlayTimeMs,
          totalQuestionsAnswered: hp.questionsAnswered,
          lastPlayedAt: hp.timestamp,
        });
      } else {
        existing.totalPlays += 1;
        existing.replayCount += 1;
        existing.sessionsSet.add(hp.sessionId);
        if (hp.totalScore > existing.bestScore) existing.bestScore = hp.totalScore;
        existing.latestScore = hp.totalScore;
        existing.totalTimeSpentMs += hp.totalPlayTimeMs;
        existing.totalQuestionsAnswered += hp.questionsAnswered;
        existing.lastPlayedAt = hp.timestamp;
      }
    }

    const playerRepeatStats = Array.from(playsByPlayer.values())
      .map((p) => ({
        userId: p.userId,
        username: p.username,
        fullName: p.fullName,
        state: p.state,
        totalPlays: p.totalPlays,
        replayCount: p.replayCount,
        sessionsParticipated: p.sessionsSet.size,
        firstScore: p.firstScore,
        bestScore: p.bestScore,
        latestScore: p.latestScore,
        scoreImprovement: p.bestScore - p.firstScore,
        totalTimeSpentMs: p.totalTimeSpentMs,
        avgQuestionTimeMs:
          p.totalQuestionsAnswered > 0
            ? Math.round(p.totalTimeSpentMs / p.totalQuestionsAnswered)
            : 0,
        lastPlayedAt: p.lastPlayedAt,
      }))
      .sort((a, b) => b.totalPlays - a.totalPlays || b.bestScore - a.bestScore);

    const participatingPlayers = playsByPlayer.size;
    const repeatPlayersList = playerRepeatStats.filter((p) => p.totalPlays > 1);
    const totalPlays = historicalPlays.length;
    const totalRepeatPlays = Math.max(0, totalPlays - participatingPlayers);
    const repeatPlayerRatePct =
      participatingPlayers > 0
        ? Number(((repeatPlayersList.length / participatingPlayers) * 100).toFixed(1))
        : 0;
    const avgPlaysPerPlayer =
      participatingPlayers > 0
        ? Number((totalPlays / participatingPlayers).toFixed(2))
        : 0;

    // ── Track Total Time Spent Playing & Time to Answer Questions ──
    const totalTimeSpentMs = historicalPlays.reduce(
      (sum, hp) => sum + hp.totalPlayTimeMs,
      0
    );
    const avgSessionPlayTimeMs =
      totalPlays > 0 ? Math.round(totalTimeSpentMs / totalPlays) : 0;
    const avgQuestionTimeMs =
      totalGuessesCount > 0 ? Math.round(globalAnswerTimeMs / totalGuessesCount) : 0;

    // ── Compare Gameplay Activity Across Sessions ──
    const allArchivedLogs = (auditLogs ?? []).filter(
      (log) => log.action === "gameplay_attempt_archived"
    );

    const sessionComparison = (sessions ?? []).map((s) => {
      const sEntries = (entries ?? []).filter((e) => e.session_id === s.id);
      const sAnswers = (answers ?? []).filter((a) => a.session_id === s.id);
      const sArchived = allArchivedLogs.filter((l) => {
        const d = (l.detail ?? {}) as ArchivedAttemptDetail;
        return (d.session_id || l.target_id) === s.id;
      });

      const sPlayers = new Set(sEntries.map((e) => e.user_id)).size;
      const sTotalPlays = sEntries.length + sArchived.length;
      const sRepeatPlays = Math.max(0, sTotalPlays - sPlayers);
      const sRepeatRatePct =
        sPlayers > 0 ? Number(((sRepeatPlays / sTotalPlays) * 100).toFixed(1)) : 0;

      const sAnswerMs = sAnswers.reduce((sum, a) => sum + Number(a.response_ms ?? 0), 0);
      const sArchMs = sArchived.reduce((sum, l) => {
        const d = (l.detail ?? {}) as ArchivedAttemptDetail;
        return sum + Number(d.total_response_ms ?? 0);
      }, 0);
      const sTotalTimeMs = sAnswerMs + sArchMs;

      const sScores = [
        ...sEntries.filter((e) => e.total_score != null).map((e) => Number(e.total_score)),
        ...sArchived.map((l) => Number(((l.detail ?? {}) as ArchivedAttemptDetail).total_score ?? 0)).filter((v) => v > 0),
      ];
      const sAvgScore =
        sScores.length > 0
          ? Number((sScores.reduce((sum, v) => sum + v, 0) / sScores.length).toFixed(1))
          : 0;

      return {
        sessionId: s.id,
        sessionName: s.name,
        status: s.status,
        startsAt: s.starts_at,
        endsAt: s.ends_at,
        prizePool: Number(s.prize_pool ?? 0),
        participatingPlayers: sPlayers,
        totalPlays: sTotalPlays,
        repeatPlays: sRepeatPlays,
        repeatRatePct: sRepeatRatePct,
        totalQuestionsAnswered: sAnswers.length + sArchived.length * 10,
        liveQuestionsAnswered: sAnswers.length,
        avgScore: sAvgScore,
        avgQuestionTimeMs:
          sAnswers.length > 0 ? Math.round(sAnswerMs / sAnswers.length) : 0,
        totalTimeSpentMs: sTotalTimeMs,
      };
    });

    // ── View Real-Time Gameplay Activity Stream ──
    const liveActivity = scopedAnswers.slice(0, 40).map((ans) => {
      const entry = entryMap.get(ans.entry_id);
      const userId = entry?.user_id || "";
      const player = profileMap.get(userId) ?? {
        username: "player",
        fullName: "Player",
        state: "Nigeria",
        gender: "Unspecified",
      };
      const q = questionMap.get(ans.question_id);
      const opt = optionLookup.get(ans.option_id);
      const optPts = liveOptionPoints.get(ans.option_id) ?? {
        rank: 10,
        points: 1,
        percentage: 0,
      };
      const sess = sessionMap.get(ans.session_id);

      return {
        id: String(ans.id),
        answeredAt: ans.answered_at,
        sessionId: ans.session_id,
        sessionName: sess?.name || "Live Session",
        userId,
        username: player.username,
        state: player.state,
        questionId: ans.question_id,
        questionTitle: q?.title || "Question",
        questionCategory: q?.category || "General",
        optionId: ans.option_id,
        optionLabel: opt?.label || "Option",
        pointsAssigned: optPts.points,
        optionPercentage: optPts.percentage,
        responseMs: Number(ans.response_ms ?? 0),
      };
    });

    // ── CSV Report Exports ──
    const dateStr = new Date().toISOString().slice(0, 10);

    // 1. Export Historical & Repeat Gameplay Report (CSV)
    if (format === "plays_csv") {
      const header = [
        "Play_ID",
        "Timestamp",
        "Session_Name",
        "Player_Username",
        "Player_Full_Name",
        "State",
        "Attempt_Number",
        "Is_Repeat_Play",
        "Status",
        "Questions_Answered",
        "Total_Points_Scored",
        "Avg_Answer_Time_Seconds",
        "Total_Play_Time_Seconds",
        "Session_Rank",
      ];
      const rows = [header.join(",")];
      for (const hp of filteredHistoricalPlays) {
        rows.push(
          [
            escapeCsv(hp.id),
            escapeCsv(hp.timestamp),
            escapeCsv(hp.sessionName),
            escapeCsv(hp.username),
            escapeCsv(hp.fullName),
            escapeCsv(hp.state),
            hp.attemptNumber,
            hp.isReplay ? "Yes" : "No",
            escapeCsv(hp.status),
            hp.questionsAnswered,
            hp.totalScore,
            (hp.avgQuestionTimeMs / 1000).toFixed(2),
            (hp.totalPlayTimeMs / 1000).toFixed(2),
            hp.rank ?? "",
          ].join(",")
        );
      }
      return new NextResponse(rows.join("\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="guesswhat-gameplay-attempts-report-${dateStr}.csv"`,
        },
      });
    }

    // 2. Export Option Selections, Percentages, Points & Timings Report (CSV)
    if (format === "options_csv") {
      const header = [
        "Category",
        "Question",
        "Format",
        "Option_Label",
        "Selection_Rank",
        "Selections_Count",
        "Selection_Percentage",
        "Points_Assigned",
        "Selection_Classification",
        "Avg_Answer_Time_Seconds",
      ];
      const rows = [header.join(",")];
      for (const q of questionBreakdown) {
        for (const opt of q.options) {
          const classification = opt.isMostSelected
            ? "MOST SELECTED (10 PTS)"
            : opt.isLeastSelected
            ? "LEAST SELECTED (1 PT)"
            : "Standard";
          rows.push(
            [
              escapeCsv(q.category),
              escapeCsv(q.title),
              escapeCsv(q.type),
              escapeCsv(opt.label),
              opt.rank,
              opt.selections,
              opt.percentage,
              opt.points,
              escapeCsv(classification),
              (opt.avgResponseMs / 1000).toFixed(2),
            ].join(",")
          );
        }
      }
      return new NextResponse(rows.join("\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="guesswhat-option-selections-points-${dateStr}.csv"`,
        },
      });
    }

    // 3. Export Cross-Session Comparison Report (CSV)
    if (format === "sessions_csv") {
      const header = [
        "Session_Name",
        "Status",
        "Starts_At",
        "Ends_At",
        "Participating_Players",
        "Total_Plays_Including_Replays",
        "Repeat_Plays",
        "Repeat_Play_Rate_Pct",
        "Total_Questions_Answered",
        "Average_Score_Pts",
        "Avg_Answer_Time_Seconds",
        "Total_Time_Spent_Playing_Seconds",
        "Prize_Pool_NGN",
      ];
      const rows = [header.join(",")];
      for (const s of sessionComparison) {
        rows.push(
          [
            escapeCsv(s.sessionName),
            escapeCsv(s.status),
            escapeCsv(s.startsAt),
            escapeCsv(s.endsAt),
            s.participatingPlayers,
            s.totalPlays,
            s.repeatPlays,
            s.repeatRatePct,
            s.totalQuestionsAnswered,
            s.avgScore,
            (s.avgQuestionTimeMs / 1000).toFixed(2),
            (s.totalTimeSpentMs / 1000).toFixed(2),
            s.prizePool,
          ].join(",")
        );
      }
      return new NextResponse(rows.join("\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="guesswhat-session-comparison-report-${dateStr}.csv"`,
        },
      });
    }

    const totalRegisteredPlayers = (profiles ?? []).length;
    const completedPlaysCount = historicalPlays.filter(
      (hp) => hp.status === "Completed" || hp.status === "Archived Replay"
    ).length;
    const inProgressPlayersCount = scopedEntries.filter((e) => !e.completed_at).length;

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      overview: {
        totalPlays,
        completedPlays: completedPlaysCount,
        totalQuestionsAnswered: historicalPlays.reduce(
          (s, hp) => s + hp.questionsAnswered,
          0
        ),
        liveAnswersInScope: totalGuessesCount,
        participatingPlayers,
        inProgressPlayers: inProgressPlayersCount,
        totalRegisteredPlayers,
        participationRatePct:
          totalRegisteredPlayers > 0
            ? Number(((participatingPlayers / totalRegisteredPlayers) * 100).toFixed(1))
            : 0,
      },
      timingMetrics: {
        avgQuestionTimeMs,
        fastestAnswerMs: fastestAnswerMs === Infinity ? 0 : fastestAnswerMs,
        slowestAnswerMs,
        totalTimeSpentMs,
        avgSessionPlayTimeMs,
      },
      pointsDistribution: {
        byGuessPoints,
        byPlayerScoreBracket: scoreBrackets.map((b) => ({
          ...b,
          percentage:
            allScores.length > 0 ? Number(((b.count / allScores.length) * 100).toFixed(1)) : 0,
        })),
        scoreStats: {
          minScore,
          avgScore,
          medianScore,
          maxScore,
        },
      },
      repeatGameplay: {
        totalRepeatPlays,
        repeatPlayersCount: repeatPlayersList.length,
        repeatPlayerRatePct,
        avgPlaysPerPlayer,
        players: playerRepeatStats,
      },
      sessionComparison,
      mostAndLeastSelected,
      questionBreakdown,
      liveActivity,
      historicalPlays: filteredHistoricalPlays,
      filters: {
        sessions: (sessions ?? []).map((s) => ({
          id: s.id,
          name: s.name,
          status: s.status,
        })),
        questions: Array.from(questionMap.values()).map((q) => ({
          id: q.id,
          title: q.title,
          category: q.category,
        })),
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to load gameplay monitoring analytics",
      },
      { status: 500 }
    );
  }
}
