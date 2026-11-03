import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

type ArchivedDetail = {
  entry_id?: string;
  session_id?: string;
  total_score?: number;
  total_response_ms?: number;
  questions_answered?: number;
  completed_at?: string;
  answers?: { question_id: string; option_id: string; response_ms?: number }[];
};

type PrizeTier = {
  rank_from: number;
  rank_to: number;
  amount: number;
};

function getPrizeForRank(rank: number | null | undefined, structure: PrizeTier[] | null | undefined): number {
  if (!rank || rank <= 0 || !Array.isArray(structure)) return 0;
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
    const range = searchParams.get("range") || "all";
    const fromParam = searchParams.get("from") || "";
    const toParam = searchParams.get("to") || "";
    const sessionFilter = searchParams.get("sessionId") || "all";

    const now = new Date();
    let startMs: number | null = null;
    let endMs: number | null = null;

    if (range === "today") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      startMs = start.getTime();
      endMs = now.getTime();
    } else if (range === "yesterday") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      startMs = start.getTime();
      endMs = end.getTime() - 1;
    } else if (range === "7d") {
      startMs = now.getTime() - 7 * 24 * 60 * 60 * 1000;
      endMs = now.getTime();
    } else if (range === "30d") {
      startMs = now.getTime() - 30 * 24 * 60 * 60 * 1000;
      endMs = now.getTime();
    } else if (range === "custom") {
      if (fromParam) {
        const parsedFrom = new Date(fromParam);
        if (!Number.isNaN(parsedFrom.getTime())) startMs = parsedFrom.getTime();
      }
      if (toParam) {
        const parsedTo = new Date(toParam);
        if (!Number.isNaN(parsedTo.getTime())) {
          parsedTo.setHours(23, 59, 59, 999);
          endMs = parsedTo.getTime();
        }
      }
    }

    const inDateRange = (iso: string | null | undefined): boolean => {
      if (startMs === null && endMs === null) return true;
      if (!iso) return false;
      const t = new Date(iso).getTime();
      if (Number.isNaN(t)) return false;
      if (startMs !== null && t < startMs) return false;
      if (endMs !== null && t > endMs) return false;
      return true;
    };

    const [
      { data: profiles },
      { data: sessions },
      { data: entries },
      { data: answers },
      { data: questions },
      { data: auditLogs },
      { data: appSettings },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, username, full_name, state, gender, status, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("game_sessions")
        .select("id, name, status, starts_at, ends_at, prize_pool, prize_structure, entry_fee_coins")
        .order("starts_at", { ascending: false }),
      supabase
        .from("session_entries")
        .select("id, session_id, user_id, joined_at, completed_at, total_score, total_response_ms, final_rank, prize_awarded")
        .order("joined_at", { ascending: false }),
      supabase
        .from("answers")
        .select("id, entry_id, session_id, question_id, option_id, response_ms, answered_at")
        .order("answered_at", { ascending: false }),
      supabase
        .from("questions")
        .select("id, status, category, type"),
      supabase
        .from("audit_logs")
        .select("id, actor_id, action, target_id, detail, created_at")
        .eq("action", "gameplay_attempt_archived")
        .order("created_at", { ascending: false }),
      supabase.from("app_settings").select("key, value"),
    ]);

    const allProfiles = profiles ?? [];
    const allSessions = sessions ?? [];
    const allEntries = entries ?? [];
    const allAnswers = answers ?? [];
    const allQuestions = questions ?? [];
    const allArchived = auditLogs ?? [];
    const settingsList = appSettings ?? [];

    const profileMap = new Map<
      string,
      { username: string; fullName: string; state: string; gender: string }
    >();
    for (const p of allProfiles) {
      profileMap.set(p.id, {
        username: p.username || "player",
        fullName: p.full_name || p.username || "Player",
        state: p.state || "Nigeria",
        gender: p.gender || "Unspecified",
      });
    }

    // Filter by date range and optional sessionFilter
    const filteredProfiles = allProfiles.filter((p) => inDateRange(p.created_at));
    const filteredEntries = allEntries.filter(
      (e) =>
        (sessionFilter === "all" || e.session_id === sessionFilter) &&
        inDateRange(e.completed_at || e.joined_at)
    );
    const filteredAnswers = allAnswers.filter(
      (a) =>
        (sessionFilter === "all" || a.session_id === sessionFilter) &&
        inDateRange(a.answered_at)
    );
    const filteredArchived = allArchived.filter((l) => {
      const d = (l.detail ?? {}) as ArchivedDetail;
      const sid = d.session_id || l.target_id || "";
      if (sessionFilter !== "all" && sid !== sessionFilter) return false;
      return inDateRange(l.created_at);
    });
    const filteredSessions = allSessions.filter(
      (s) =>
        (sessionFilter === "all" || s.id === sessionFilter) &&
        (inDateRange(s.starts_at) || inDateRange(s.ends_at))
    );

    // Map entry -> user_id for answers
    const entryUserMap = new Map<string, string>();
    for (const e of allEntries) {
      entryUserMap.set(e.id, e.user_id);
    }

    // Active players in period
    const activePlayerSet = new Set<string>();
    for (const e of filteredEntries) {
      if (e.user_id) activePlayerSet.add(e.user_id);
    }
    for (const a of filteredAnswers) {
      const uid = entryUserMap.get(a.entry_id);
      if (uid) activePlayerSet.add(uid);
    }
    for (const l of filteredArchived) {
      if (l.actor_id) activePlayerSet.add(l.actor_id);
    }

    // Total all-time active players for context
    const allTimeActiveSet = new Set<string>();
    for (const e of allEntries) {
      if (e.user_id) allTimeActiveSet.add(e.user_id);
    }

    // Sessions metrics
    const sessionsToCount =
      range === "all" && sessionFilter === "all"
        ? allSessions
        : filteredSessions.length > 0
        ? filteredSessions
        : sessionFilter !== "all"
        ? allSessions.filter((s) => s.id === sessionFilter)
        : allSessions;

    const totalSessions = sessionsToCount.length;
    const completedSessions = sessionsToCount.filter((s) => s.status === "completed").length;
    const activeSessionsCount = sessionsToCount.filter((s) => s.status === "active").length;
    const upcomingSessionsCount = sessionsToCount.filter((s) => s.status === "upcoming").length;

    const activeSession = allSessions.find((s) => s.status === "active") ?? null;

    // Prize money allocated & paid
    const totalPrizePoolAllocated = sessionsToCount.reduce(
      (sum, s) => sum + Number(s.prize_pool ?? 0),
      0
    );

    const payoutSettingsBySession = new Map<string, Record<string, string>>();
    for (const row of settingsList) {
      if (row.key.startsWith("payout_status_")) {
        const sid = row.key.replace("payout_status_", "");
        const val = (row.value ?? {}) as { statuses?: Record<string, string> };
        payoutSettingsBySession.set(
          sid,
          val.statuses ?? (row.value as Record<string, string>) ?? {}
        );
      }
    }

    // Helper to get Best Score per entry in a session
    const getBestScoreForEntry = (entry: (typeof allEntries)[number]) => {
      let bestScore = Number(entry.total_score ?? 0);
      let bestMs = Number(entry.total_response_ms ?? 45000);
      for (const l of allArchived) {
        const d = (l.detail ?? {}) as ArchivedDetail;
        const sid = d.session_id || l.target_id;
        if (sid === entry.session_id && (d.entry_id === entry.id || l.actor_id === entry.user_id)) {
          const archScore = Number(d.total_score ?? 0);
          const archMs = Number(d.total_response_ms ?? 45000);
          if (archScore > bestScore || (archScore === bestScore && archMs < bestMs)) {
            bestScore = archScore;
            bestMs = archMs;
          }
        }
      }
      return { bestScore, bestMs };
    };

    let totalPrizePaid = 0;
    let paidWinnersCount = 0;
    let pendingWinnersCount = 0;

    for (const s of sessionsToCount) {
      const sEntries = allEntries
        .filter((e) => e.session_id === s.id)
        .map((e) => {
          const { bestScore, bestMs } = getBestScoreForEntry(e);
          return { ...e, bestScore, bestMs };
        })
        .sort((a, b) => {
          if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
          return a.bestMs - b.bestMs;
        });

      const statusMap = payoutSettingsBySession.get(s.id) ?? {};
      const structure = Array.isArray(s.prize_structure)
        ? (s.prize_structure as PrizeTier[])
        : [];

      sEntries.forEach((e, idx) => {
        const rank = e.final_rank ?? idx + 1;
        const awarded =
          Number(e.prize_awarded ?? 0) > 0
            ? Number(e.prize_awarded)
            : getPrizeForRank(rank, structure);

        if (awarded > 0) {
          const st =
            statusMap[e.user_id] ||
            statusMap[e.id] ||
            (s.status === "completed" && Number(e.prize_awarded ?? 0) > 0
              ? "Paid"
              : "Pending");
          if (st === "Paid") {
            totalPrizePaid += awarded;
            paidWinnersCount += 1;
          } else if (st === "Pending") {
            pendingWinnersCount += 1;
          }
        }
      });
    }

    // Archived guesses count
    const archivedGuessesInPeriod = filteredArchived.reduce((sum, l) => {
      const d = (l.detail ?? {}) as ArchivedDetail;
      const qCount = Array.isArray(d.answers)
        ? d.answers.length
        : Number(d.questions_answered ?? 10);
      return sum + qCount;
    }, 0);

    // Gameplay performance per session for chart
    const sessionPerformance = allSessions.map((s) => {
      const sEntries = filteredEntries.filter((e) => e.session_id === s.id);
      const sAnswers = filteredAnswers.filter((a) => a.session_id === s.id);
      const sArchived = filteredArchived.filter((l) => {
        const d = (l.detail ?? {}) as ArchivedDetail;
        return (d.session_id || l.target_id) === s.id;
      });

      const sArchivedGuesses = sArchived.reduce((sum, l) => {
        const d = (l.detail ?? {}) as ArchivedDetail;
        return sum + (Array.isArray(d.answers) ? d.answers.length : Number(d.questions_answered ?? 10));
      }, 0);

      const uniquePlayers = new Set(sEntries.map((e) => e.user_id)).size;
      const totalPlays = sEntries.length + sArchived.length;
      const bestScores = sEntries
        .map((e) => getBestScoreForEntry(e).bestScore)
        .filter((v) => v > 0);

      const avgScore =
        bestScores.length > 0
          ? Number((bestScores.reduce((sum, v) => sum + v, 0) / bestScores.length).toFixed(1))
          : 0;

      return {
        sessionId: s.id,
        sessionName: s.name,
        status: s.status,
        startsAt: s.starts_at,
        endsAt: s.ends_at,
        prizePool: Number(s.prize_pool ?? 0),
        uniquePlayers,
        totalPlays,
        repeatPlays: Math.max(0, totalPlays - uniquePlayers),
        guessesSubmitted: sAnswers.length + sArchivedGuesses,
        avgScore,
      };
    });

    // Top 5 Contenders by Best Score
    const topContenders = filteredEntries
      .map((e) => {
        const { bestScore, bestMs } = getBestScoreForEntry(e);
        const p = profileMap.get(e.user_id) ?? {
          username: "player",
          fullName: "Player",
          state: "Nigeria",
          gender: "Unspecified",
        };
        const sName =
          allSessions.find((s) => s.id === e.session_id)?.name || "Game Session";
        return {
          entryId: e.id,
          userId: e.user_id,
          username: p.username,
          fullName: p.fullName,
          state: p.state,
          sessionName: sName,
          bestScore,
          bestTimeMs: bestMs,
        };
      })
      .sort((a, b) => {
        if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
        return a.bestTimeMs - b.bestTimeMs;
      })
      .slice(0, 5);

    // Recent player registrations
    const recentRegistrations = (range === "all" ? allProfiles : filteredProfiles)
      .slice(0, 12)
      .map((p) => ({
        id: p.id,
        username: p.username || "player",
        fullName: p.full_name || p.username || "Player",
        state: p.state || "Unspecified",
        gender: p.gender || "Unspecified",
        status: p.status || "active",
        createdAt: p.created_at,
      }));

    return NextResponse.json({
      range,
      metrics: {
        totalRegisteredPlayers: allProfiles.length,
        newRegistrationsInPeriod: filteredProfiles.length,
        activePlayersInPeriod: activePlayerSet.size,
        allTimeActivePlayers: allTimeActiveSet.size,
        totalSessions,
        completedSessions,
        activeSessionsCount,
        upcomingSessionsCount,
        totalPlays: filteredEntries.length + filteredArchived.length,
        liveEntries: filteredEntries.length,
        repeatPlays: filteredArchived.length,
        totalGuessesSubmitted: filteredAnswers.length + archivedGuessesInPeriod,
        totalQuestionsInBank: allQuestions.length,
        publishedQuestionsCount: allQuestions.filter((q) => q.status === "published").length,
        totalPrizePoolAllocated,
        totalPrizePaid,
        paidWinnersCount,
        pendingWinnersCount,
      },
      activeSession: activeSession
        ? {
            id: activeSession.id,
            name: activeSession.name,
            prizePool: Number(activeSession.prize_pool ?? 0),
            startsAt: activeSession.starts_at,
            endsAt: activeSession.ends_at,
          }
        : null,
      sessionPerformance,
      topContenders,
      recentRegistrations,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load admin overview" },
      { status: 500 }
    );
  }
}
