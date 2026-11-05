"use client";

import { useEffect, useState, useCallback } from "react";

type OptionStat = {
  id: string;
  label: string;
  position: number;
  media_url: string | null;
  rank: number;
  points: number;
  selections: number;
  percentage: number;
  avgResponseMs: number;
  isMostSelected: boolean;
  isLeastSelected: boolean;
};

type QuestionBreakdown = {
  id: string;
  title: string;
  category: string;
  type: string;
  assignedToSession?: boolean;
  sessionPosition?: number | null;
  sessionsUsedCount?: number;
  usedSessionNames?: string[];
  totalSelections: number;
  avgResponseMs: number;
  fastestMs: number;
  slowestMs: number;
  mostSelected: OptionStat | null;
  leastSelected: OptionStat | null;
  options: OptionStat[];
};

type MostLeastItem = {
  questionId: string;
  questionTitle: string;
  category: string;
  type: string;
  totalSelections: number;
  mostSelected: {
    optionId: string;
    label: string;
    selections: number;
    percentage: number;
    points: number;
    avgResponseMs: number;
  };
  leastSelected: {
    optionId: string;
    label: string;
    selections: number;
    percentage: number;
    points: number;
    avgResponseMs: number;
  };
};

type LiveActivityItem = {
  id: string;
  answeredAt: string;
  sessionId: string;
  sessionName: string;
  userId: string;
  username: string;
  state: string;
  questionId: string;
  questionTitle: string;
  questionCategory: string;
  optionId: string;
  optionLabel: string;
  pointsAssigned: number;
  optionPercentage: number;
  responseMs: number;
};

type HistoricalPlayItem = {
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
  status: "Completed" | "In Progress" | "Archived Replay";
  questionsAnswered: number;
  totalScore: number;
  totalPlayTimeMs: number;
  avgQuestionTimeMs: number;
  rank: number | null;
  timestamp: string;
};

type RepeatPlayerItem = {
  userId: string;
  username: string;
  fullName: string;
  state: string;
  totalPlays: number;
  replayCount: number;
  sessionsParticipated: number;
  firstScore: number;
  bestScore: number;
  latestScore: number;
  scoreImprovement: number;
  totalTimeSpentMs: number;
  avgQuestionTimeMs: number;
  lastPlayedAt: string;
};

type SessionComparisonItem = {
  sessionId: string;
  sessionName: string;
  status: string;
  startsAt: string;
  endsAt: string;
  prizePool: number;
  participatingPlayers: number;
  totalPlays: number;
  repeatPlays: number;
  repeatRatePct: number;
  totalQuestionsAnswered: number;
  liveQuestionsAnswered: number;
  avgScore: number;
  avgQuestionTimeMs: number;
  totalTimeSpentMs: number;
};

type GameplayAnalyticsResponse = {
  generatedAt: string;
  overview: {
    totalPlays: number;
    completedPlays: number;
    totalQuestionsAnswered: number;
    liveAnswersInScope: number;
    participatingPlayers: number;
    inProgressPlayers: number;
    totalRegisteredPlayers: number;
    participationRatePct: number;
  };
  timingMetrics: {
    avgQuestionTimeMs: number;
    fastestAnswerMs: number;
    slowestAnswerMs: number;
    totalTimeSpentMs: number;
    avgSessionPlayTimeMs: number;
  };
  pointsDistribution: {
    byGuessPoints: {
      points: number;
      label: string;
      guesses: number;
      percentage: number;
      avgResponseMs: number;
    }[];
    byPlayerScoreBracket: {
      label: string;
      min: number;
      max: number;
      count: number;
      percentage: number;
    }[];
    scoreStats: {
      minScore: number;
      avgScore: number;
      medianScore: number;
      maxScore: number;
    };
  };
  repeatGameplay: {
    totalRepeatPlays: number;
    repeatPlayersCount: number;
    repeatPlayerRatePct: number;
    avgPlaysPerPlayer: number;
    players: RepeatPlayerItem[];
  };
  sessionComparison: SessionComparisonItem[];
  mostAndLeastSelected: MostLeastItem[];
  questionBreakdown: QuestionBreakdown[];
  liveActivity: LiveActivityItem[];
  historicalPlays: HistoricalPlayItem[];
  filters: {
    sessions: { id: string; name: string; status: string }[];
    questions: { id: string; title: string; category: string }[];
  };
};

function formatSeconds(ms: number): string {
  if (!ms || ms <= 0) return "0.0s";
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return "0s";
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  return `${mins}m ${secs}s`;
}

export default function AdminGameplayAnalyticsPage() {
  const [data, setData] = useState<GameplayAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState("all");
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>("");
  const [showOnlySessionQuestions, setShowOnlySessionQuestions] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [livePolling, setLivePolling] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "all" | "live_options" | "points_time" | "repeat_sessions" | "history"
  >("all");

  // Support deep-linking ?sessionId=... from Sessions / Leaderboards pages
  useEffect(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const sid = sp.get("sessionId");
      if (sid) setSessionId(sid);
    }
  }, []);

  const fetchAnalytics = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const params = new URLSearchParams();
        if (sessionId !== "all") params.set("sessionId", sessionId);
        if (searchQuery.trim()) params.set("q", searchQuery.trim());
        const res = await fetch(`/api/admin/gameplay?${params.toString()}`, {
          cache: "no-store",
        });
        const json = (await res.json()) as GameplayAnalyticsResponse;
        setData(json);
        if (json.questionBreakdown?.length > 0) {
          const currentExists = json.questionBreakdown.some(
            (q) => q.id === selectedQuestionId && (sessionId === "all" || !showOnlySessionQuestions || q.assignedToSession)
          );
          if (!currentExists) {
            const firstAssigned =
              json.questionBreakdown.find(
                (q) => (sessionId === "all" || q.assignedToSession) && q.totalSelections > 0
              ) ??
              json.questionBreakdown.find((q) => sessionId === "all" || q.assignedToSession) ??
              json.questionBreakdown[0];
            if (firstAssigned) setSelectedQuestionId(firstAssigned.id);
          }
        }
      } catch (err) {
        console.error("Failed to fetch gameplay analytics:", err);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [sessionId, searchQuery, selectedQuestionId, showOnlySessionQuestions]
  );

  useEffect(() => {
    fetchAnalytics(false);
  }, [fetchAnalytics]);

  // Real-time 5-second polling when live mode is active
  useEffect(() => {
    if (!livePolling) return;
    const timer = setInterval(() => {
      fetchAnalytics(true);
    }, 5000);
    return () => clearInterval(timer);
  }, [livePolling, fetchAnalytics]);

  const buildExportUrl = (format: "plays_csv" | "options_csv" | "sessions_csv") => {
    const params = new URLSearchParams();
    if (sessionId !== "all") params.set("sessionId", sessionId);
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    params.set("format", format);
    return `/api/admin/gameplay?${params.toString()}`;
  };

  const sessionsList = data?.filters.sessions ?? [];
  const currentSessionIndex = sessionsList.findIndex((s) => s.id === sessionId);

  const handleStepSession = (dir: -1 | 1) => {
    if (sessionsList.length === 0) return;
    if (sessionId === "all") {
      setSessionId(sessionsList[0].id);
      return;
    }
    const nextIdx = (currentSessionIndex + dir + sessionsList.length) % sessionsList.length;
    setSessionId(sessionsList[nextIdx].id);
  };

  const visibleQuestions = (data?.questionBreakdown ?? []).filter((q) => {
    if (sessionId !== "all" && showOnlySessionQuestions) {
      return q.assignedToSession !== false;
    }
    return true;
  });

  const activeQuestion =
    visibleQuestions.find((q) => q.id === selectedQuestionId) ??
    visibleQuestions[0] ??
    data?.questionBreakdown[0] ??
    null;

  const activeQuestionIndex = visibleQuestions.findIndex(
    (q) => q.id === activeQuestion?.id
  );

  const handleStepQuestion = (dir: -1 | 1) => {
    if (visibleQuestions.length === 0) return;
    const nextIdx =
      (Math.max(0, activeQuestionIndex) + dir + visibleQuestions.length) %
      visibleQuestions.length;
    setSelectedQuestionId(visibleQuestions[nextIdx].id);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* ── Header & Report Exports ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-xs font-bold text-amber-300">
              ADMIN Gameplay Monitoring &amp; Analytics
            </span>
            <button
              type="button"
              onClick={() => setLivePolling(!livePolling)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                livePolling
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                  : "bg-white/5 border-white/10 text-slate-400"
              }`}
            >
              <span
                className={`size-2 rounded-full ${
                  livePolling ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
                }`}
              />
              {livePolling ? "LIVE REAL-TIME (5s)" : "PAUSED"}
            </button>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Gameplay Monitoring &amp; Analytics
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Step session-to-session or inspect the standalone Question Bank: 10 questions are assigned per 3-day session, and reusable across sessions.
          </p>
        </div>

        {/* 1-Click Gameplay Report Exports */}
        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href={buildExportUrl("plays_csv")}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
          >
            <span>⬇ Export Gameplay Report (CSV)</span>
          </a>
          <a
            href={buildExportUrl("options_csv")}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold text-xs transition-colors"
          >
            <span>⬇ Export Options &amp; Points (CSV)</span>
          </a>
          <a
            href={buildExportUrl("sessions_csv")}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-semibold text-xs transition-colors"
          >
            <span>⬇ Export Session Comparison (CSV)</span>
          </a>
        </div>
      </div>

      {/* ── Session-to-Session Navigator Bar ── */}
      <div className="rounded-2xl bg-[#0f1219] border border-white/10 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
              Session-to-Session Navigation
            </span>
            <p className="text-xs text-slate-400">
              Navigate across 3-day tournament sessions (10 assigned questions per session) or view global Question Bank totals.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleStepSession(-1)}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-200"
            >
              ◀ Prev Session
            </button>
            <button
              type="button"
              onClick={() => handleStepSession(1)}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-200"
            >
              Next Session ▶
            </button>
            <button
              type="button"
              onClick={() => fetchAnalytics(false)}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300"
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSessionId("all")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-colors ${
              sessionId === "all"
                ? "bg-amber-500 text-slate-950 border-amber-400"
                : "bg-[#080b11] text-slate-300 border-white/10 hover:border-white/25"
            }`}
          >
            All Sessions (Global Bank)
          </button>
          {sessionsList.map((s, idx) => {
            const selected = sessionId === s.id;
            const comp = data?.sessionComparison.find((c) => c.sessionId === s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSessionId(s.id)}
                className={`px-3.5 py-2 rounded-xl text-left text-xs whitespace-nowrap border transition-colors flex items-center gap-2 ${
                  selected
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold"
                    : "bg-[#080b11] text-slate-300 border-white/10 hover:border-white/25"
                }`}
              >
                <span className="font-mono text-[10px] text-slate-400">S{idx + 1}</span>
                <span>{s.name}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                    s.status === "active"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : s.status === "completed"
                      ? "bg-sky-500/20 text-sky-300"
                      : "bg-white/10 text-slate-400"
                  }`}
                >
                  {s.status}
                </span>
                {comp && (
                  <span className="text-[10px] font-mono text-slate-400">
                    ({comp.totalPlays} plays)
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Module Navigation Bar ── */}
      <div className="rounded-2xl bg-[#0f1219] border border-white/10 p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: "all", label: "All Analytics" },
              { id: "live_options", label: "Real-Time & Option Selections" },
              { id: "points_time", label: "Points & Timing Distribution" },
              { id: "repeat_sessions", label: "Repeat Plays & Session Compare" },
              { id: "history", label: "Historical Gameplay Data" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                activeTab === tab.id
                  ? "bg-amber-500 text-slate-950"
                  : "bg-white/[0.03] text-slate-400 hover:text-white border border-white/5"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {sessionId !== "all" && (
          <div className="flex items-center gap-2">
            <a
              href={`/admin/leaderboards?sessionId=${sessionId}`}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-amber-300"
            >
              Session Leaderboard ↗
            </a>
            <a
              href={`/admin/winners?sessionId=${sessionId}`}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-emerald-300"
            >
              Session Winners ↗
            </a>
          </div>
        )}
      </div>

      {loading && !data ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="size-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent mb-3" />
          <p className="text-xs text-slate-400">Loading real-time gameplay telemetry...</p>
        </div>
      ) : data ? (
        <>
          {/* ── 5 Core KPI Cards (Covers Total Plays, Session Players, Time per Question, Total Time Played, Repeat Gameplay) ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="rounded-2xl p-5 bg-[#0f1219] border border-white/10">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Total Plays
              </p>
              <p className="text-3xl font-extrabold text-amber-400 mt-1 tabular-nums">
                {data.overview.totalPlays.toLocaleString()}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                <strong className="text-white">{data.overview.completedPlays}</strong> completed ·{" "}
                <strong className="text-white">
                  {data.overview.totalQuestionsAnswered.toLocaleString()}
                </strong>{" "}
                guesses
              </p>
            </div>

            <div className="rounded-2xl p-5 bg-[#0f1219] border border-white/10">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Players in Session
              </p>
              <p className="text-3xl font-extrabold text-emerald-400 mt-1 tabular-nums">
                {data.overview.participatingPlayers.toLocaleString()}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                <strong className="text-white">{data.overview.participationRatePct}%</strong> of{" "}
                {data.overview.totalRegisteredPlayers} registered players
              </p>
            </div>

            <div className="rounded-2xl p-5 bg-[#0f1219] border border-white/10">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Avg Time / Question
              </p>
              <p className="text-3xl font-extrabold text-sky-400 mt-1 font-mono tabular-nums">
                {formatSeconds(data.timingMetrics.avgQuestionTimeMs)}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Fastest <strong className="text-emerald-300">{formatSeconds(data.timingMetrics.fastestAnswerMs)}</strong>{" "}
                · Max <strong className="text-amber-300">{formatSeconds(data.timingMetrics.slowestAnswerMs)}</strong>
              </p>
            </div>

            <div className="rounded-2xl p-5 bg-[#0f1219] border border-white/10">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Total Time Spent Playing
              </p>
              <p className="text-2xl sm:text-3xl font-extrabold text-white mt-1 font-mono tabular-nums">
                {formatDuration(data.timingMetrics.totalTimeSpentMs)}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Avg <strong className="text-white">{formatSeconds(data.timingMetrics.avgSessionPlayTimeMs)}</strong>{" "}
                per 10-question play
              </p>
            </div>

            <div className="rounded-2xl p-5 bg-[#0f1219] border border-white/10">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Repeat Gameplay
              </p>
              <p className="text-3xl font-extrabold text-purple-400 mt-1 tabular-nums">
                {data.repeatGameplay.totalRepeatPlays.toLocaleString()}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                <strong className="text-white">{data.repeatGameplay.repeatPlayersCount}</strong> repeat players (
                {data.repeatGameplay.avgPlaysPerPlayer}x avg)
              </p>
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════════════════
              SECTION 1: REAL-TIME GAMEPLAY ACTIVITY & QUESTION OPTION SELECTIONS
             ════════════════════════════════════════════════════════════════════════ */}
          {(activeTab === "all" || activeTab === "live_options") && (
            <div className="space-y-8">
              {/* 1A. Track Selections, Percentage, Points Assigned, & Answer Time per Question Option */}
              <div className="rounded-2xl bg-[#0f1219] border border-white/10 p-6 space-y-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-4">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                      Option Selection Tracker · Percentage Share · Assigned Points (10–1)
                    </span>
                    <h2 className="text-xl font-bold text-white mt-0.5">
                      Question Option Selections, Percentages &amp; Live Points
                    </h2>
                    {activeQuestion?.usedSessionNames && activeQuestion.usedSessionNames.length > 0 && (
                      <p className="text-xs text-slate-400 mt-1">
                        Assigned to <strong className="text-white">{activeQuestion.sessionsUsedCount}</strong>{" "}
                        {activeQuestion.sessionsUsedCount === 1 ? "session" : "sessions"}:{" "}
                        <span className="text-amber-300">{activeQuestion.usedSessionNames.join(" · ")}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {sessionId !== "all" && (
                      <div className="inline-flex rounded-xl bg-[#080b11] border border-white/10 p-1">
                        <button
                          type="button"
                          onClick={() => setShowOnlySessionQuestions(true)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                            showOnlySessionQuestions
                              ? "bg-amber-500 text-slate-950"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          Session&apos;s 10 Questions
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowOnlySessionQuestions(false)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                            !showOnlySessionQuestions
                              ? "bg-amber-500 text-slate-950"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          All Bank ({data.questionBreakdown.length})
                        </button>
                      </div>
                    )}

                    <select
                      id="question-picker"
                      aria-label="Inspect Question"
                      value={activeQuestion?.id ?? ""}
                      onChange={(e) => setSelectedQuestionId(e.target.value)}
                      className="max-w-md rounded-xl border border-white/10 bg-[#080b11] px-3.5 py-2 text-xs font-semibold text-white focus:border-amber-500 focus:outline-none"
                    >
                      {visibleQuestions.map((q, idx) => (
                        <option key={q.id} value={q.id}>
                          {q.sessionPosition != null ? `Q${q.sessionPosition}` : `#${idx + 1}`} [{q.category}]{" "}
                          {q.title} ({q.totalSelections} picks)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Question Stepper Bar (Q1 .. Q10) */}
                <div className="flex items-center justify-between gap-2 bg-[#080b11] border border-white/5 rounded-xl p-2.5">
                  <button
                    type="button"
                    onClick={() => handleStepQuestion(-1)}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-200 shrink-0"
                  >
                    ◀ Prev Q
                  </button>

                  <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                    {visibleQuestions.map((q, idx) => {
                      const isCurr = q.id === activeQuestion?.id;
                      const label = q.sessionPosition != null ? `Q${q.sessionPosition}` : `Q${idx + 1}`;
                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => setSelectedQuestionId(q.id)}
                          title={`${q.category}: ${q.title}`}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-colors ${
                            isCurr
                              ? "bg-amber-500 text-slate-950"
                              : q.totalSelections > 0
                              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25"
                              : "bg-white/5 text-slate-400 hover:text-white"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleStepQuestion(1)}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-200 shrink-0"
                  >
                    Next Q ▶
                  </button>
                </div>

                {activeQuestion && (
                  <div className="space-y-6">
                    {/* Question Summary Banner with Most & Least Selected Highlights */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4">
                        <p className="text-[11px] uppercase tracking-wider text-slate-400">
                          Question Selections
                        </p>
                        <p className="text-2xl font-extrabold text-white mt-1 tabular-nums">
                          {activeQuestion.totalSelections.toLocaleString()}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Format: <span className="uppercase text-amber-300 font-semibold">{activeQuestion.type}</span>
                        </p>
                      </div>

                      <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4">
                        <p className="text-[11px] uppercase tracking-wider text-slate-400">
                          Avg Time to Answer
                        </p>
                        <p className="text-2xl font-extrabold text-sky-400 mt-1 font-mono tabular-nums">
                          {formatSeconds(activeQuestion.avgResponseMs)}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Range: {formatSeconds(activeQuestion.fastestMs)} – {formatSeconds(activeQuestion.slowestMs)}
                        </p>
                      </div>

                      <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                          ★ Most Selected Option (10 Pts)
                        </p>
                        <p className="text-lg font-extrabold text-white mt-1 truncate">
                          {activeQuestion.mostSelected?.label ?? "—"}
                        </p>
                        <p className="text-xs text-emerald-300 mt-0.5">
                          {activeQuestion.mostSelected?.selections ?? 0} picks (
                          {activeQuestion.mostSelected?.percentage ?? 0}%) ·{" "}
                          {formatSeconds(activeQuestion.mostSelected?.avgResponseMs ?? 0)} avg
                        </p>
                      </div>

                      <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-4">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-rose-400">
                          ▼ Least Selected Option (1 Pt)
                        </p>
                        <p className="text-lg font-extrabold text-white mt-1 truncate">
                          {activeQuestion.leastSelected?.label ?? "—"}
                        </p>
                        <p className="text-xs text-rose-300 mt-0.5">
                          {activeQuestion.leastSelected?.selections ?? 0} picks (
                          {activeQuestion.leastSelected?.percentage ?? 0}%) ·{" "}
                          {formatSeconds(activeQuestion.leastSelected?.avgResponseMs ?? 0)} avg
                        </p>
                      </div>
                    </div>

                    {/* 10 Options Table with Selections, Percentage Bar, Points Assigned, and Time Taken */}
                    <div
                      tabIndex={0}
                      role="region"
                      aria-label="Option selections, percentages, and points assigned"
                      className="overflow-x-auto rounded-xl border border-white/10"
                    >
                      <table className="w-full text-left text-sm border-separate border-spacing-0">
                        <thead className="sticky top-0 z-10 bg-[#141926] text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          <tr>
                            <th scope="col" className="px-4 py-3 border-b border-white/10">
                              Rank
                            </th>
                            <th scope="col" className="px-4 py-3 border-b border-white/10">
                              Option
                            </th>
                            <th scope="col" className="px-4 py-3 border-b border-white/10">
                              Selections
                            </th>
                            <th scope="col" className="px-4 py-3 border-b border-white/10 w-64">
                              Percentage of Selections
                            </th>
                            <th scope="col" className="px-4 py-3 border-b border-white/10">
                              Points Assigned
                            </th>
                            <th scope="col" className="px-4 py-3 border-b border-white/10">
                              Avg Answer Time
                            </th>
                            <th scope="col" className="px-4 py-3 border-b border-white/10 text-right">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {activeQuestion.options.map((opt) => (
                            <tr
                              key={opt.id}
                              className={
                                opt.isMostSelected
                                  ? "bg-emerald-500/[0.06]"
                                  : opt.isLeastSelected
                                  ? "bg-rose-500/[0.05]"
                                  : "hover:bg-white/[0.02]"
                              }
                            >
                              <td className="px-4 py-3 font-mono text-xs text-slate-400">
                                #{opt.rank}
                              </td>
                              <th
                                scope="row"
                                className="px-4 py-3 font-semibold text-white flex items-center gap-2.5"
                              >
                                {activeQuestion.type === "color" && opt.media_url && (
                                  <span
                                    className="size-4 rounded-full border border-white/30 shrink-0"
                                    style={{ backgroundColor: opt.media_url }}
                                  />
                                )}
                                <span>{opt.label}</span>
                              </th>
                              <td className="px-4 py-3 font-mono font-bold text-slate-200 tabular-nums">
                                {opt.selections.toLocaleString()}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="flex-1 h-2.5 rounded-full bg-white/5 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${
                                        opt.isMostSelected
                                          ? "bg-emerald-400"
                                          : opt.isLeastSelected
                                          ? "bg-rose-400"
                                          : "bg-amber-400"
                                      }`}
                                      style={{ width: `${Math.max(opt.percentage, 3)}%` }}
                                    />
                                  </div>
                                  <span className="w-12 text-right font-mono text-xs font-bold text-slate-200 tabular-nums">
                                    {opt.percentage}%
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-extrabold ${
                                    opt.points === 10
                                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                      : opt.points === 1
                                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                      : "bg-amber-500/15 text-amber-300 border border-amber-500/25"
                                  }`}
                                >
                                  {opt.points} {opt.points === 1 ? "pt" : "pts"}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-mono text-xs text-sky-300 tabular-nums">
                                {opt.selections > 0 ? formatSeconds(opt.avgResponseMs) : "—"}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {opt.isMostSelected ? (
                                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase">
                                    Most Selected
                                  </span>
                                ) : opt.isLeastSelected ? (
                                  <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold uppercase">
                                    Least Selected
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-500">Rank #{opt.rank}</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* 1B. Identify Most & Least Selected Options Across All Questions + Real-Time Activity Stream */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Most & Least Selected Options Matrix (7 cols) */}
                <div className="lg:col-span-7 rounded-2xl bg-[#0f1219] border border-white/10 p-6 space-y-4">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                      Consensus Extremes
                    </span>
                    <h3 className="text-lg font-bold text-white">
                      Most vs. Least Selected Options by Question
                    </h3>
                  </div>

                  <div
                    tabIndex={0}
                    role="region"
                    aria-label="Most and least selected options across questions"
                    className="overflow-x-auto max-h-96 rounded-xl border border-white/10"
                  >
                    <table className="w-full text-left text-xs border-separate border-spacing-0">
                      <thead className="sticky top-0 z-10 bg-[#141926] text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        <tr>
                          <th scope="col" className="px-3.5 py-3 border-b border-white/10">
                            Question
                          </th>
                          <th scope="col" className="px-3.5 py-3 border-b border-white/10">
                            Most Selected (10 Pts)
                          </th>
                          <th scope="col" className="px-3.5 py-3 border-b border-white/10">
                            Least Selected (1 Pt)
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {data.mostAndLeastSelected.map((item) => (
                          <tr
                            key={item.questionId}
                            onClick={() => setSelectedQuestionId(item.questionId)}
                            className="cursor-pointer hover:bg-white/[0.03]"
                          >
                            <th scope="row" className="px-3.5 py-3 font-semibold text-white max-w-xs">
                              <span className="block text-[10px] uppercase text-amber-400">
                                {item.category} · {item.totalSelections} picks
                              </span>
                              <span className="line-clamp-1">{item.questionTitle}</span>
                            </th>
                            <td className="px-3.5 py-3">
                              <span className="font-bold text-emerald-300 block">
                                {item.mostSelected.label}
                              </span>
                              <span className="text-slate-400">
                                {item.mostSelected.selections} picks ({item.mostSelected.percentage}%) ·{" "}
                                {formatSeconds(item.mostSelected.avgResponseMs)}
                              </span>
                            </td>
                            <td className="px-3.5 py-3">
                              <span className="font-bold text-rose-300 block">
                                {item.leastSelected.label}
                              </span>
                              <span className="text-slate-400">
                                {item.leastSelected.selections} picks ({item.leastSelected.percentage}%) ·{" "}
                                {formatSeconds(item.leastSelected.avgResponseMs)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Real-Time Gameplay Activity Feed (5 cols) */}
                <div className="lg:col-span-5 rounded-2xl bg-[#0f1219] border border-white/10 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
                        Real-Time Gameplay Stream
                      </span>
                      <h3 className="text-lg font-bold text-white">
                        Live Player Selections &amp; Speed
                      </h3>
                    </div>
                    <span className="text-xs font-mono text-slate-400">
                      {data.liveActivity.length} recent events
                    </span>
                  </div>

                  <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                    {data.liveActivity.map((act) => (
                      <div
                        key={act.id}
                        className="rounded-xl bg-white/[0.02] border border-white/5 p-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-white truncate">
                              @{act.username}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400">
                              {act.state}
                            </span>
                            <span className="text-[10px] text-slate-500 truncate">
                              {act.questionCategory}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 truncate mt-0.5">
                            Picked <strong className="text-amber-300">{act.optionLabel}</strong> (
                            {act.optionPercentage}%)
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="inline-block px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-xs font-extrabold">
                            +{act.pointsAssigned} pts
                          </span>
                          <p className="text-[11px] font-mono text-sky-300 mt-0.5">
                            {formatSeconds(act.responseMs)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              SECTION 2: POINTS DISTRIBUTION & TIME TAKEN TELEMETRY
             ════════════════════════════════════════════════════════════════════════ */}
          {(activeTab === "all" || activeTab === "points_time") && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 2A. Monitor the Distribution of Points Assigned to Each Guess (10 pts down to 1 pt) */}
              <div className="rounded-2xl bg-[#0f1219] border border-white/10 p-6 space-y-5">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                    Points Distribution
                  </span>
                  <h2 className="text-lg font-bold text-white">
                    Distribution of Points Assigned per Guess (10 pts → 1 pt)
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Shows how frequently players land on high-consensus options (10 pts) vs. rare options (1 pt).
                  </p>
                </div>

                <div className="space-y-2.5">
                  {data.pointsDistribution.byGuessPoints.map((tier) => (
                    <div key={tier.points} className="grid grid-cols-12 items-center gap-2 text-xs">
                      <div className="col-span-3 font-bold text-slate-200">
                        {tier.points} {tier.points === 1 ? "Point" : "Points"}
                      </div>
                      <div className="col-span-6 flex items-center gap-2">
                        <div className="flex-1 h-3 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              tier.points >= 8
                                ? "bg-emerald-400"
                                : tier.points >= 4
                                ? "bg-amber-400"
                                : "bg-rose-400"
                            }`}
                            style={{ width: `${Math.max(tier.percentage, 3)}%` }}
                          />
                        </div>
                        <span className="w-11 text-right font-mono font-semibold text-slate-300">
                          {tier.percentage}%
                        </span>
                      </div>
                      <div className="col-span-3 text-right font-mono text-slate-400">
                        {tier.guesses} picks · {formatSeconds(tier.avgResponseMs)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2B. Player Total Score Distribution & Question Timing Breakdown */}
              <div className="rounded-2xl bg-[#0f1219] border border-white/10 p-6 space-y-6">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400">
                    Session Score &amp; Answer Speed Distribution
                  </span>
                  <h2 className="text-lg font-bold text-white">
                    Player Score Brackets &amp; Time per Question
                  </h2>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3 text-center">
                    <p className="text-[10px] uppercase text-slate-400">Min Score</p>
                    <p className="text-xl font-extrabold text-white mt-0.5">
                      {data.pointsDistribution.scoreStats.minScore}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3 text-center">
                    <p className="text-[10px] uppercase text-slate-400">Avg Score</p>
                    <p className="text-xl font-extrabold text-amber-400 mt-0.5">
                      {data.pointsDistribution.scoreStats.avgScore}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3 text-center">
                    <p className="text-[10px] uppercase text-slate-400">Median</p>
                    <p className="text-xl font-extrabold text-sky-400 mt-0.5">
                      {data.pointsDistribution.scoreStats.medianScore}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3 text-center">
                    <p className="text-[10px] uppercase text-slate-400">Top Score</p>
                    <p className="text-xl font-extrabold text-emerald-400 mt-0.5">
                      {data.pointsDistribution.scoreStats.maxScore}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Session Score Brackets (Out of 100 Pts)
                  </p>
                  {data.pointsDistribution.byPlayerScoreBracket.map((br) => (
                    <div key={br.label} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-200">{br.label}</span>
                        <span className="font-mono text-slate-300">
                          {br.count} plays ({br.percentage}%)
                        </span>
                      </div>
                      <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-amber-400"
                          style={{ width: `${Math.max(br.percentage, 3)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              SECTION 3: COMPARE GAMEPLAY ACROSS SESSIONS & MONITOR REPEAT GAMEPLAY
             ════════════════════════════════════════════════════════════════════════ */}
          {(activeTab === "all" || activeTab === "repeat_sessions") && (
            <div className="space-y-8">
              {/* 3A. Compare Gameplay Activity Across Sessions */}
              <div className="rounded-2xl bg-[#0f1219] border border-white/10 p-6 space-y-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
                    Cross-Session Benchmarking
                  </span>
                  <h2 className="text-xl font-bold text-white">
                    Compare Gameplay Activity Across Sessions
                  </h2>
                </div>

                <div
                  tabIndex={0}
                  role="region"
                  aria-label="Compare gameplay activity across sessions"
                  className="overflow-x-auto rounded-xl border border-white/10"
                >
                  <table className="w-full text-left text-sm border-separate border-spacing-0">
                    <thead className="sticky top-0 z-10 bg-[#141926] text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      <tr>
                        <th scope="col" className="px-4 py-3 border-b border-white/10">
                          Session Name
                        </th>
                        <th scope="col" className="px-4 py-3 border-b border-white/10">
                          Status
                        </th>
                        <th scope="col" className="px-4 py-3 border-b border-white/10">
                          Players Participating
                        </th>
                        <th scope="col" className="px-4 py-3 border-b border-white/10">
                          Total Plays
                        </th>
                        <th scope="col" className="px-4 py-3 border-b border-white/10">
                          Repeat Plays
                        </th>
                        <th scope="col" className="px-4 py-3 border-b border-white/10">
                          Questions Answered
                        </th>
                        <th scope="col" className="px-4 py-3 border-b border-white/10">
                          Avg Score
                        </th>
                        <th scope="col" className="px-4 py-3 border-b border-white/10">
                          Avg Answer Time
                        </th>
                        <th scope="col" className="px-4 py-3 border-b border-white/10">
                          Total Play Time
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {data.sessionComparison.map((s) => (
                        <tr key={s.sessionId} className="hover:bg-white/[0.02]">
                          <th scope="row" className="px-4 py-3.5 font-bold text-white">
                            {s.sessionName}
                          </th>
                          <td className="px-4 py-3.5">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                                s.status === "active"
                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                  : s.status === "completed"
                                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                                  : "bg-white/10 text-slate-300"
                              }`}
                            >
                              {s.status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 font-mono font-bold text-emerald-300">
                            {s.participatingPlayers}
                          </td>
                          <td className="px-4 py-3.5 font-mono font-bold text-amber-300">
                            {s.totalPlays}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-purple-300">
                            {s.repeatPlays} ({s.repeatRatePct}%)
                          </td>
                          <td className="px-4 py-3.5 font-mono text-slate-200">
                            {s.totalQuestionsAnswered.toLocaleString()}
                          </td>
                          <td className="px-4 py-3.5 font-mono font-bold text-white">
                            {s.avgScore > 0 ? `${s.avgScore} pts` : "—"}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-sky-300">
                            {s.avgQuestionTimeMs > 0 ? formatSeconds(s.avgQuestionTimeMs) : "—"}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-slate-300">
                            {formatDuration(s.totalTimeSpentMs)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 3B. Monitor Repeat Gameplay & Total Time Spent per Player */}
              <div className="rounded-2xl bg-[#0f1219] border border-white/10 p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400">
                      Retention &amp; Replay Telemetry
                    </span>
                    <h2 className="text-xl font-bold text-white">
                      Monitor Repeat Gameplay &amp; Player Play Time
                    </h2>
                  </div>
                  <div className="text-xs text-slate-400">
                    Repeat Player Rate:{" "}
                    <strong className="text-purple-300">
                      {data.repeatGameplay.repeatPlayerRatePct}%
                    </strong>{" "}
                    · Avg Plays/Player:{" "}
                    <strong className="text-white">{data.repeatGameplay.avgPlaysPerPlayer}</strong>
                  </div>
                </div>

                <div
                  tabIndex={0}
                  role="region"
                  aria-label="Repeat gameplay and player play time"
                  className="overflow-x-auto rounded-xl border border-white/10"
                >
                  <table className="w-full text-left text-sm border-separate border-spacing-0">
                    <thead className="sticky top-0 z-10 bg-[#141926] text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      <tr>
                        <th scope="col" className="px-4 py-3 border-b border-white/10">
                          Player
                        </th>
                        <th scope="col" className="px-4 py-3 border-b border-white/10">
                          Location
                        </th>
                        <th scope="col" className="px-4 py-3 border-b border-white/10">
                          Total Plays
                        </th>
                        <th scope="col" className="px-4 py-3 border-b border-white/10">
                          Repeat Plays
                        </th>
                        <th scope="col" className="px-4 py-3 border-b border-white/10">
                          Sessions
                        </th>
                        <th scope="col" className="px-4 py-3 border-b border-white/10">
                          First → Best Score
                        </th>
                        <th scope="col" className="px-4 py-3 border-b border-white/10">
                          Avg Time / Q
                        </th>
                        <th scope="col" className="px-4 py-3 border-b border-white/10">
                          Total Time Spent Playing
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {data.repeatGameplay.players.map((p) => (
                        <tr key={p.userId} className="hover:bg-white/[0.02]">
                          <th scope="row" className="px-4 py-3 font-semibold text-white">
                            @{p.username}
                          </th>
                          <td className="px-4 py-3 text-xs text-slate-400">{p.state}</td>
                          <td className="px-4 py-3 font-mono font-bold text-amber-300">
                            {p.totalPlays} {p.totalPlays === 1 ? "play" : "plays"}
                          </td>
                          <td className="px-4 py-3 font-mono">
                            {p.replayCount > 0 ? (
                              <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-xs font-bold">
                                {p.replayCount} {p.replayCount === 1 ? "replay" : "replays"}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-500">0 replays</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-300">
                            {p.sessionsParticipated}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">
                            <span className="text-slate-300">{p.firstScore} pts</span>
                            {" → "}
                            <strong className="text-emerald-300">{p.bestScore} pts</strong>
                            {p.scoreImprovement > 0 && (
                              <span className="ml-1.5 text-emerald-400 font-bold">
                                (+{p.scoreImprovement})
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-sky-300">
                            {formatSeconds(p.avgQuestionTimeMs)}
                          </td>
                          <td className="px-4 py-3 font-mono font-semibold text-white">
                            {formatDuration(p.totalTimeSpentMs)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              SECTION 4: VIEW HISTORICAL GAMEPLAY DATA ARCHIVE
             ════════════════════════════════════════════════════════════════════════ */}
          {(activeTab === "all" || activeTab === "history") && (
            <div className="rounded-2xl bg-[#0f1219] border border-white/10 p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                    Complete Audit &amp; Attempt Log
                  </span>
                  <h2 className="text-xl font-bold text-white">
                    Historical Gameplay Data ({data.historicalPlays.length} Attempts)
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter by player, session, state..."
                    className="w-64 rounded-xl border border-white/10 bg-[#080b11] px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div
                tabIndex={0}
                role="region"
                aria-label="Historical gameplay data"
                className="overflow-x-auto max-h-[520px] rounded-xl border border-white/10"
              >
                <table className="w-full text-left text-sm border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10 bg-[#141926] text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <tr>
                      <th scope="col" className="px-4 py-3 border-b border-white/10">
                        Timestamp
                      </th>
                      <th scope="col" className="px-4 py-3 border-b border-white/10">
                        Player
                      </th>
                      <th scope="col" className="px-4 py-3 border-b border-white/10">
                        Session
                      </th>
                      <th scope="col" className="px-4 py-3 border-b border-white/10">
                        Attempt
                      </th>
                      <th scope="col" className="px-4 py-3 border-b border-white/10">
                        Status
                      </th>
                      <th scope="col" className="px-4 py-3 border-b border-white/10">
                        Questions
                      </th>
                      <th scope="col" className="px-4 py-3 border-b border-white/10">
                        Points Scored
                      </th>
                      <th scope="col" className="px-4 py-3 border-b border-white/10">
                        Avg Time / Q
                      </th>
                      <th scope="col" className="px-4 py-3 border-b border-white/10">
                        Total Play Time
                      </th>
                      <th scope="col" className="px-4 py-3 border-b border-white/10 text-right">
                        Rank
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {data.historicalPlays.map((hp) => (
                      <tr key={hp.id} className="hover:bg-white/[0.02]">
                        <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                          {new Date(hp.timestamp).toLocaleString("en-NG", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </td>
                        <th scope="row" className="px-4 py-3 font-semibold text-white">
                          @{hp.username}
                          <span className="block text-[11px] font-normal text-slate-400">
                            {hp.state}
                          </span>
                        </th>
                        <td className="px-4 py-3 text-xs text-slate-200">{hp.sessionName}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold ${
                              hp.isReplay
                                ? "bg-purple-500/20 text-purple-300"
                                : "bg-white/5 text-slate-300"
                            }`}
                          >
                            Attempt #{hp.attemptNumber}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              hp.status === "Completed"
                                ? "bg-emerald-500/20 text-emerald-300"
                                : hp.status === "Archived Replay"
                                ? "bg-amber-500/15 text-amber-300"
                                : "bg-sky-500/20 text-sky-300"
                            }`}
                          >
                            {hp.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-300">
                          {hp.questionsAnswered}/10
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-amber-300">
                          {hp.totalScore} pts
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-sky-300">
                          {formatSeconds(hp.avgQuestionTimeMs)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-white">
                          {formatSeconds(hp.totalPlayTimeMs)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-slate-300">
                          {hp.rank ? `#${hp.rank}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
