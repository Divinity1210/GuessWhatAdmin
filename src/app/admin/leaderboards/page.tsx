"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

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

type LeaderboardRow = {
  entryId: string;
  userId: string;
  username: string;
  fullName: string;
  state: string;
  gender: string;
  rank: number;
  storedRank: number | null;
  rankDelta: number;
  score: number;
  latestScore?: number;
  latestTimeMs?: number;
  attemptsCount?: number;
  isBestFromPriorAttempt?: boolean;
  totalTimeMs: number;
  guessesSubmitted: number;
  allocatedPrize: number;
  disputeStatus: string;
  disputeNote: string;
  completedAt: string;
  calculationBreakdown: CalculationStep[];
};

type SessionMeta = {
  id: string;
  name: string;
  status: string;
  startsAt: string;
  endsAt: string;
  prizePool: number;
};

function formatTimeDetailed(ms: number): { formatted: string; rawMs: string } {
  const totalSeconds = Math.floor(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  const remMs = ms % 1000;
  return {
    formatted: `${mins}:${String(secs).padStart(2, "0")}.${String(remMs).padStart(3, "0")}`,
    rawMs: `${ms.toLocaleString()} ms`,
  };
}

export default function AdminLeaderboardsPage() {
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [activeSession, setActiveSession] = useState<SessionMeta | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [summary, setSummary] = useState<{
    totalParticipants: number;
    totalGuessesInSession: number;
    disputedCount: number;
    topScore: number;
    multiAttemptPlayersCount?: number;
  } | null>(null);
  const [search, setSearch] = useState<string>("");
  const [segmentFilter, setSegmentFilter] = useState<
    "all" | "top36" | "replays" | "high80" | "disputed"
  >("all");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [loading, setLoading] = useState<boolean>(true);
  const [recalculating, setRecalculating] = useState<boolean>(false);
  const [toast, setToast] = useState<string>("");

  // Calculation Audit Modal State
  const [inspectingPlayer, setInspectingPlayer] = useState<LeaderboardRow | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const sid = sp.get("sessionId");
      if (sid) setSelectedSessionId(sid);
    }
  }, []);

  const showToastMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4500);
  };

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedSessionId) params.set("sessionId", selectedSessionId);
      if (search.trim()) params.set("q", search.trim());
      const res = await fetch(`/api/admin/leaderboards?${params.toString()}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions ?? []);
        setActiveSession(data.activeSession ?? null);
        if (!selectedSessionId && data.activeSession?.id) {
          setSelectedSessionId(data.activeSession.id);
        }
        setLeaderboard(data.leaderboard ?? []);
        setSummary(data.summary ?? null);
      }
    } catch (err) {
      console.error("Failed to fetch leaderboard:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedSessionId, search]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const currentIdx = sessions.findIndex(
    (s) => s.id === (selectedSessionId || activeSession?.id)
  );
  const goPrevSession = () => {
    if (currentIdx > 0) setSelectedSessionId(sessions[currentIdx - 1].id);
  };
  const goNextSession = () => {
    if (currentIdx >= 0 && currentIdx < sessions.length - 1) {
      setSelectedSessionId(sessions[currentIdx + 1].id);
    }
  };

  const handleRecalculateAndPublish = async () => {
    const sid = selectedSessionId || activeSession?.id;
    if (!sid) return;
    setRecalculating(true);
    try {
      const res = await fetch("/api/admin/leaderboards", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sid,
          action: "recalculate_and_publish",
        }),
      });
      if (res.ok) {
        showToastMsg(
          "Leaderboard recalculated using Best-Score consensus points (10–1) and millisecond tie-breakers, and published!"
        );
        await fetchLeaderboard();
      }
    } finally {
      setRecalculating(false);
    }
  };

  const handleUpdateDispute = async (entryId: string, nextStatus: string) => {
    const sid = selectedSessionId || activeSession?.id;
    if (!sid) return;
    await fetch("/api/admin/leaderboards", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sid,
        action: "update_dispute",
        entryId,
        disputeStatus: nextStatus,
      }),
    });
    showToastMsg(`Ranking audit status updated to "${nextStatus}"`);
    await fetchLeaderboard();
  };

  const availableStates = Array.from(
    new Set(leaderboard.map((r) => r.state).filter(Boolean))
  ).sort();

  const displayedRows = leaderboard.filter((r) => {
    if (stateFilter !== "all" && r.state !== stateFilter) return false;
    if (segmentFilter === "top36") return r.rank <= 36;
    if (segmentFilter === "replays") return (r.attemptsCount ?? 1) > 1;
    if (segmentFilter === "high80") return r.score >= 80;
    if (segmentFilter === "disputed") return r.disputeStatus !== "Clear";
    return true;
  });

  // Compute Analytics Chart metrics from leaderboard
  const avgBestScore =
    leaderboard.length > 0
      ? Math.round(
          leaderboard.reduce((sum, r) => sum + r.score, 0) / leaderboard.length
        )
      : 0;

  const scoreBrackets = [
    {
      label: "90–100 pts",
      sub: "Elite",
      color: "from-emerald-400 to-teal-500",
      count: leaderboard.filter((r) => r.score >= 90).length,
    },
    {
      label: "80–89 pts",
      sub: "Strong",
      color: "from-amber-400 to-orange-500",
      count: leaderboard.filter((r) => r.score >= 80 && r.score < 90).length,
    },
    {
      label: "70–79 pts",
      sub: "Competitive",
      color: "from-sky-400 to-indigo-500",
      count: leaderboard.filter((r) => r.score >= 70 && r.score < 80).length,
    },
    {
      label: "< 70 pts",
      sub: "Outlier",
      color: "from-purple-400 to-fuchsia-500",
      count: leaderboard.filter((r) => r.score < 70).length,
    },
  ];
  const maxBracketCount = Math.max(...scoreBrackets.map((b) => b.count), 1);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/15 border border-sky-500/30 text-xs font-semibold text-sky-300 mb-2">
            Page 39 · Best-Score Leaderboard &amp; Calculation Audit
          </span>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Leaderboard Management &amp; Best-Score Verification
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Rankings always preserve each player&apos;s <strong>Best Score</strong> across all attempts (with shortest total response time tie-breaker) while tracking every replay and guess.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            disabled={recalculating}
            onClick={handleRecalculateAndPublish}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs sm:text-sm transition-all shadow-lg shadow-amber-500/20"
          >
            {recalculating
              ? "Recalculating..."
              : "↻ Recalculate & Publish Final Rankings"}
          </button>
          {activeSession && (
            <Link
              href={`/admin/winners?sessionId=${activeSession.id}`}
              className="px-4 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold text-xs sm:text-sm"
            >
              Winners &amp; Prizes ↗
            </Link>
          )}
        </div>
      </div>

      {toast && (
        <div className="rounded-2xl px-4 py-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
          ✓ {toast}
        </div>
      )}

      {/* Session-to-Session Navigator */}
      <div className="rounded-2xl p-4 bg-[#0f1219] border border-white/10 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Session-to-Session Leaderboard Navigator:
            </span>
            {activeSession && (
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                  activeSession.status === "active"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-indigo-500/20 text-indigo-300"
                }`}
              >
                {activeSession.status === "active"
                  ? "Live Active Session Leaderboard"
                  : "Completed Session Final Leaderboard"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={goPrevSession}
              disabled={currentIdx <= 0}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 text-xs font-bold text-slate-200 border border-white/10"
            >
              ◀ Prev Session
            </button>
            <button
              onClick={goNextSession}
              disabled={currentIdx < 0 || currentIdx >= sessions.length - 1}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 text-xs font-bold text-slate-200 border border-white/10"
            >
              Next Session ▶
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {sessions.map((s) => {
            const isSelected = (selectedSessionId || activeSession?.id) === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSelectedSessionId(s.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-2 ${
                  isSelected
                    ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20"
                    : "bg-white/[0.03] text-slate-300 hover:bg-white/[0.08] border border-white/10"
                }`}
              >
                <span>{s.name}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] uppercase ${
                    isSelected
                      ? "bg-black/25 text-white"
                      : "bg-white/10 text-slate-300"
                  }`}
                >
                  {s.status}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl p-4 bg-[#0f1219] border border-white/10">
          <p className="text-xs font-semibold text-slate-400">Ranked Players in Session</p>
          <p className="text-2xl font-extrabold text-white mt-1 tabular-nums">
            {(summary?.totalParticipants ?? 0).toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {summary?.multiAttemptPlayersCount ?? 0} multi-attempt players · Best Score active
          </p>
        </div>

        <div className="rounded-2xl p-4 bg-[#0f1219] border border-amber-500/25">
          <p className="text-xs font-semibold text-amber-300">Highest Best Score</p>
          <p className="text-2xl font-extrabold text-amber-400 mt-1 tabular-nums">
            {summary?.topScore ?? 0} <span className="text-xs text-slate-400">/ 100 pts</span>
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {(summary?.totalGuessesInSession ?? 0).toLocaleString()} total guesses in session
          </p>
        </div>

        <div className="rounded-2xl p-4 bg-[#0f1219] border border-emerald-500/25">
          <p className="text-xs font-semibold text-emerald-300">Session Prize Pool</p>
          <p className="text-2xl font-extrabold text-emerald-400 mt-1 tabular-nums">
            ₦{(activeSession?.prizePool ?? 0).toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Allocated to top ranked winners</p>
        </div>

        <div className="rounded-2xl p-4 bg-[#0f1219] border border-white/10">
          <p className="text-xs font-semibold text-slate-400">Flagged / Disputed Rankings</p>
          <p className="text-2xl font-extrabold text-rose-400 mt-1 tabular-nums">
            {summary?.disputedCount ?? 0}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Click any row to audit 10 answers</p>
        </div>
      </div>

      {/* Session Score & Speed Analytics Chart Row */}
      {leaderboard.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* 1. Score Distribution Vertical Bar Chart (4 cols) */}
          <div className="lg:col-span-4 rounded-3xl p-5 bg-[#0f1219] border border-white/10 flex flex-col justify-between space-y-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                Best Score Distribution
              </span>
              <h2 className="text-base font-extrabold text-white">
                Player Best Scores by Bracket
              </h2>
            </div>

            <div className="grid grid-cols-4 gap-3 items-end h-36 pt-4 px-2">
              {scoreBrackets.map((b) => {
                const heightPct = Math.max(
                  Math.round((b.count / maxBracketCount) * 100),
                  10
                );
                return (
                  <div
                    key={b.label}
                    className="flex flex-col items-center justify-end h-full gap-1.5"
                  >
                    <span className="font-mono text-xs font-black text-white">
                      {b.count}
                    </span>
                    <div className="w-full bg-white/5 rounded-t-xl h-24 flex items-end overflow-hidden p-0.5">
                      <div
                        className={`w-full rounded-t-lg bg-gradient-to-t ${b.color} transition-all duration-500`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-slate-300 text-center leading-tight">
                      {b.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Top 5 Contenders Comparison Bar (5 cols) */}
          <div className="lg:col-span-5 rounded-3xl p-5 bg-[#0f1219] border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  Podium &amp; Contenders
                </span>
                <h2 className="text-base font-extrabold text-white">
                  Top 5 Best Scores &amp; Tie-Breaker Speeds
                </h2>
              </div>
              <span className="text-[11px] font-mono text-slate-400">Max 100 pts</span>
            </div>

            <div className="space-y-2.5">
              {leaderboard.slice(0, 5).map((r) => (
                <div key={r.entryId} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-black text-[10px]">
                        #{r.rank}
                      </span>
                      <span className="font-bold text-white truncate">
                        @{r.username}
                      </span>
                      {(r.attemptsCount ?? 1) > 1 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-semibold">
                          {r.attemptsCount} runs
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-xs text-slate-300 shrink-0">
                      <strong className="text-amber-400">{r.score} pts</strong> ·{" "}
                      {formatTimeDetailed(r.totalTimeMs).formatted}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-400"
                      style={{ width: `${Math.min(100, Math.max(r.score, 8))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Session Consensus Gauge Meter (3 cols) */}
          <div className="lg:col-span-3 rounded-3xl p-5 bg-[#0f1219] border border-white/10 flex flex-col items-center justify-between text-center">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
                Session Consensus Index
              </span>
              <h2 className="text-base font-extrabold text-white">
                Average Best Score
              </h2>
            </div>

            <div className="relative flex flex-col items-center justify-center my-1">
              <svg viewBox="0 0 160 95" className="w-40 h-24 overflow-visible">
                <defs>
                  <linearGradient id="lbGaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f59e0b" />
                    <stop offset="50%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                </defs>
                <path
                  d="M 16 80 A 64 64 0 0 1 144 80"
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="14"
                  strokeLinecap="round"
                />
                <path
                  d="M 16 80 A 64 64 0 0 1 144 80"
                  fill="none"
                  stroke="url(#lbGaugeGrad)"
                  strokeWidth="14"
                  strokeLinecap="round"
                  strokeDasharray="201"
                  strokeDashoffset={201 - (Math.min(100, avgBestScore) / 100) * 201}
                />
              </svg>
              <div className="-mt-8">
                <p className="text-2xl font-black text-white tabular-nums">
                  {avgBestScore}
                  <span className="text-xs font-normal text-slate-400">/100</span>
                </p>
                <p className="text-[11px] font-semibold text-emerald-400">
                  Top: {summary?.topScore ?? 0} pts
                </p>
              </div>
              <progress
                className="sr-only"
                max={100}
                value={avgBestScore}
              >
                {avgBestScore}%
              </progress>
            </div>

            <p className="text-[11px] text-slate-400">
              Best-Score engine active across all player replays
            </p>
          </div>
        </div>
      )}

      {/* Interactive Filter & Search Bar */}
      <div className="rounded-2xl p-4 bg-[#0f1219] border border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: "all", label: `All Players (${leaderboard.length})` },
              {
                id: "top36",
                label: `Top 36 Prize Zone (${leaderboard.filter((r) => r.rank <= 36).length})`,
              },
              {
                id: "replays",
                label: `Multi-Attempt Players (${
                  leaderboard.filter((r) => (r.attemptsCount ?? 1) > 1).length
                })`,
              },
              {
                id: "high80",
                label: `80+ Points (${leaderboard.filter((r) => r.score >= 80).length})`,
              },
              {
                id: "disputed",
                label: `Disputed / Flagged (${summary?.disputedCount ?? 0})`,
              },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              onClick={() => setSegmentFilter(f.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                segmentFilter === f.id
                  ? "bg-amber-500 text-slate-950"
                  : "bg-white/[0.03] text-slate-300 hover:bg-white/[0.08] border border-white/5"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Filter by Player State"
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-[#0b0e14] px-3 py-2 text-xs font-semibold text-slate-200 focus:border-amber-500 focus:outline-none"
          >
            <option value="all">All States ({availableStates.length})</option>
            {availableStates.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search @username, name, or state..."
            className="w-full sm:w-64 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Leaderboard Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="size-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent mb-3" />
          <p className="text-xs text-slate-400">Loading session leaderboard...</p>
        </div>
      ) : displayedRows.length === 0 ? (
        <div className="rounded-3xl p-12 bg-[#0f1219] border border-white/10 text-center text-sm text-slate-400">
          No leaderboard entries match your current filter.
        </div>
      ) : (
        <div className="rounded-3xl overflow-hidden bg-[#0f1219] border border-white/10">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-4">Rank</th>
                  <th className="px-4 py-4">Player</th>
                  <th className="px-4 py-4">Best Score (Points)</th>
                  <th className="px-4 py-4">Total Time (Tie-Breaker)</th>
                  <th className="px-4 py-4">Guesses / Runs</th>
                  <th className="px-4 py-4">Rank Change</th>
                  <th className="px-4 py-4">Allocated Prize</th>
                  <th className="px-4 py-4">Dispute Status</th>
                  <th className="px-4 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {displayedRows.map((row) => {
                  const t = formatTimeDetailed(row.totalTimeMs);
                  const isTop3 = row.rank <= 3;
                  const runs = row.attemptsCount ?? 1;

                  return (
                    <tr
                      key={row.entryId}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg font-black text-xs ${
                            row.rank === 1
                              ? "bg-amber-500 text-slate-950"
                              : row.rank === 2
                              ? "bg-slate-300 text-slate-950"
                              : row.rank === 3
                              ? "bg-amber-700 text-white"
                              : "bg-white/5 text-slate-300"
                          }`}
                        >
                          #{row.rank}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-bold text-white">@{row.username}</p>
                        <p className="text-[11px] text-slate-400">
                          {row.fullName} · {row.state}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-base font-black text-amber-400">
                            {row.score} pts
                          </span>
                          {row.isBestFromPriorAttempt && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-300">
                              Best Preserved
                            </span>
                          )}
                        </div>
                        {runs > 1 && row.latestScore != null && (
                          <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                            {runs} runs · Latest: {row.latestScore} pts
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs">
                        <p className="text-slate-200 font-bold">{t.formatted}</p>
                        <p className="text-[10px] text-slate-500">{t.rawMs}</p>
                      </td>
                      <td className="px-4 py-3.5 text-xs font-mono text-slate-300">
                        <span className="block">{row.guessesSubmitted}/10 Qs</span>
                        <span className="text-[10px] text-purple-300">
                          {runs} {runs === 1 ? "attempt" : "attempts"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs font-bold">
                        {row.rankDelta > 0 ? (
                          <span className="text-emerald-400">▲ +{row.rankDelta}</span>
                        ) : row.rankDelta < 0 ? (
                          <span className="text-rose-400">▼ {row.rankDelta}</span>
                        ) : isTop3 ? (
                          <span className="text-amber-300">★ Podium</span>
                        ) : (
                          <span className="text-slate-500">● Steady</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs font-bold">
                        {row.allocatedPrize > 0 ? (
                          <span className="text-emerald-400">
                            ₦{row.allocatedPrize.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <select
                          value={row.disputeStatus}
                          onChange={(e) =>
                            handleUpdateDispute(row.entryId, e.target.value)
                          }
                          className={`rounded-xl border px-2.5 py-1 text-xs font-bold ${
                            row.disputeStatus === "Under Investigation"
                              ? "border-rose-500/40 bg-rose-500/15 text-rose-300"
                              : row.disputeStatus === "Resolved"
                              ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                              : "border-white/10 bg-[#0b0e14] text-slate-300"
                          }`}
                        >
                          <option value="Clear">Clear</option>
                          <option value="Under Investigation">
                            Under Investigation
                          </option>
                          <option value="Resolved">Resolved</option>
                        </select>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => setInspectingPlayer(row)}
                          className="px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 text-xs font-bold transition-colors"
                        >
                          Inspect Calculation
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Review Leaderboard Calculations Modal (Page 39 Requirement) */}
      {inspectingPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
          <div className="w-full max-w-4xl rounded-3xl bg-[#0f1219] border border-sky-500/40 p-6 md:p-8 space-y-6 max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-xs font-bold uppercase">
                  Page 39 · Best-Score Calculation Audit
                </span>
                <h2 className="text-xl font-black text-white mt-1">
                  Rank #{inspectingPlayer.rank} — @{inspectingPlayer.username} (
                  {inspectingPlayer.fullName})
                </h2>
                <p className="text-xs text-slate-400">
                  Question-by-question breakdown of the player&apos;s{" "}
                  <strong>Best Score attempt ({inspectingPlayer.score} pts)</strong> across{" "}
                  {inspectingPlayer.attemptsCount ?? 1} total run(s).
                </p>
              </div>
              <button
                onClick={() => setInspectingPlayer(null)}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white self-start"
              >
                ✕ Close Breakdown
              </button>
            </div>

            {inspectingPlayer.calculationBreakdown.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Summary entry recorded ({inspectingPlayer.score} pts ·{" "}
                {inspectingPlayer.totalTimeMs.toLocaleString()} ms total time).
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.03] text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="px-3.5 py-3">#</th>
                      <th className="px-3.5 py-3">Question</th>
                      <th className="px-3.5 py-3">Player Picked Option</th>
                      <th className="px-3.5 py-3">Session Crowd Picks</th>
                      <th className="px-3.5 py-3">Consensus Rank</th>
                      <th className="px-3.5 py-3">Points Awarded</th>
                      <th className="px-3.5 py-3 text-right">Time Taken (ms)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {inspectingPlayer.calculationBreakdown.map((step, i) => (
                      <tr key={i} className="hover:bg-white/[0.02]">
                        <td className="px-3.5 py-2.5 font-black text-indigo-300">
                          Q{step.questionNumber}
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-200 max-w-xs truncate">
                          {step.questionTitle}
                        </td>
                        <td className="px-3.5 py-2.5 font-bold text-white">
                          {step.pickedOptionLabel}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-slate-300">
                          {step.optionTotalPicks.toLocaleString()} (
                          {step.optionPercentage}%)
                        </td>
                        <td className="px-3.5 py-2.5 font-mono font-bold text-sky-300">
                          #{step.consensusRank} of 10
                        </td>
                        <td className="px-3.5 py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded font-black ${
                              step.pointsAwarded === 10
                                ? "bg-emerald-500/20 text-emerald-300"
                                : step.pointsAwarded === 1
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-white/10 text-white"
                            }`}
                          >
                            +{step.pointsAwarded} pts
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono text-slate-300">
                          {step.responseMs.toLocaleString()} ms (
                          {(step.responseMs / 1000).toFixed(2)}s)
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/10 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">
                    Verified Best Score
                  </p>
                  <p className="text-xl font-black text-amber-400">
                    {inspectingPlayer.score} Points
                  </p>
                </div>
                {(inspectingPlayer.attemptsCount ?? 1) > 1 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400">
                      Latest Run Score
                    </p>
                    <p className="text-xl font-black text-slate-200">
                      {inspectingPlayer.latestScore ?? inspectingPlayer.score} Points
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">
                    Verified Total Time (Tie-Breaker)
                  </p>
                  <p className="text-xl font-black text-white font-mono">
                    {formatTimeDetailed(inspectingPlayer.totalTimeMs).formatted} (
                    {inspectingPlayer.totalTimeMs.toLocaleString()} ms)
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">
                    Prize Allocation
                  </p>
                  <p className="text-xl font-black text-emerald-400">
                    ₦{inspectingPlayer.allocatedPrize.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    handleUpdateDispute(
                      inspectingPlayer.entryId,
                      "Under Investigation"
                    );
                    setInspectingPlayer({
                      ...inspectingPlayer,
                      disputeStatus: "Under Investigation",
                    });
                  }}
                  className="px-3.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-bold"
                >
                  Flag for Investigation
                </button>
                <button
                  onClick={() => {
                    handleUpdateDispute(inspectingPlayer.entryId, "Resolved");
                    setInspectingPlayer({
                      ...inspectingPlayer,
                      disputeStatus: "Resolved",
                    });
                  }}
                  className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold"
                >
                  Mark Verified / Resolved
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
