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
  } | null>(null);
  const [search, setSearch] = useState<string>("");
  const [disputeFilter, setDisputeFilter] = useState<"all" | "disputed">("all");
  const [loading, setLoading] = useState<boolean>(true);
  const [recalculating, setRecalculating] = useState<boolean>(false);
  const [toast, setToast] = useState<string>("");

  // Calculation Audit Modal State
  const [inspectingPlayer, setInspectingPlayer] = useState<LeaderboardRow | null>(null);
  const [editingRankPrize, setEditingRankPrize] = useState<number | null>(null);
  const [editingRankAmount, setEditingRankAmount] = useState<string>("");
  const [savingRankPrize, setSavingRankPrize] = useState<boolean>(false);

  const handleSavePositionPrize = async (position: number, amount: number) => {
    const sid = selectedSessionId || activeSession?.id;
    if (!sid) return;
    setSavingRankPrize(true);
    try {
      const res = await fetch("/api/admin/winners", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sid,
          action: "update_position_prize",
          position,
          amount: Math.max(0, Number(amount) || 0),
        }),
      });
      if (res.ok) {
        setEditingRankPrize(null);
        showToastMsg(
          `Updated position #${position} prize money to ₦${Number(amount).toLocaleString()}!`
        );
        await fetchLeaderboard();
      }
    } finally {
      setSavingRankPrize(false);
    }
  };

  // Read initial ?sessionId from window location on mount
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

  const currentIdx = sessions.findIndex((s) => s.id === (selectedSessionId || activeSession?.id));
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
          "Leaderboard recalculated using live consensus points (10–1) and millisecond tie-breakers, and published!"
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

  const displayedRows = leaderboard.filter((r) => {
    if (disputeFilter === "disputed") return r.disputeStatus !== "Clear";
    return true;
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/15 border border-sky-500/30 text-xs font-semibold text-sky-300 mb-2">
            Page 39 · Leaderboard &amp; Calculation Audit
          </span>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Leaderboard Management &amp; Score Verification
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Inspect active and completed session leaderboards, verify 10-question consensus point calculations &amp; millisecond tie-breakers, investigate disputes, and publish final rankings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            disabled={recalculating}
            onClick={handleRecalculateAndPublish}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs sm:text-sm transition-all shadow-lg shadow-amber-500/20"
          >
            {recalculating ? "Recalculating..." : "↻ Recalculate & Publish Final Rankings"}
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
                    isSelected ? "bg-black/25 text-white" : "bg-white/10 text-slate-300"
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
          <p className="text-[11px] text-slate-500 mt-0.5">Sorted by Points DESC, Time ASC</p>
        </div>

        <div className="rounded-2xl p-4 bg-[#0f1219] border border-white/10">
          <p className="text-xs font-semibold text-slate-400">Highest Consensus Score</p>
          <p className="text-2xl font-extrabold text-amber-400 mt-1 tabular-nums">
            {summary?.topScore ?? 0} <span className="text-xs text-slate-400">/ 100 pts</span>
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">10 questions × max 10 pts</p>
        </div>

        <div className="rounded-2xl p-4 bg-[#0f1219] border border-white/10">
          <p className="text-xs font-semibold text-slate-400">Session Prize Pool</p>
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

      {/* Search & Dispute Filter Bar */}
      <div className="rounded-2xl p-4 bg-[#0f1219] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDisputeFilter("all")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold ${
              disputeFilter === "all"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                : "bg-white/[0.03] text-slate-400"
            }`}
          >
            All Ranked Players ({leaderboard.length})
          </button>
          <button
            onClick={() => setDisputeFilter("disputed")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold ${
              disputeFilter === "disputed"
                ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                : "bg-white/[0.03] text-slate-400"
            }`}
          >
            Disputed / Under Investigation ({summary?.disputedCount ?? 0})
          </button>
        </div>

        <div className="w-full sm:w-80">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search player by @username, name, or state..."
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
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
                  <th className="px-4 py-4">Score (Points)</th>
                  <th className="px-4 py-4">Total Time (Tie-Breaker)</th>
                  <th className="px-4 py-4">Guesses</th>
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

                  return (
                    <tr key={row.entryId} className="hover:bg-white/[0.02] transition-colors">
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
                        <span className="font-mono text-base font-black text-amber-400">
                          {row.score} pts
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs">
                        <p className="text-slate-200 font-bold">{t.formatted}</p>
                        <p className="text-[10px] text-slate-500">{t.rawMs}</p>
                      </td>
                      <td className="px-4 py-3.5 text-xs font-mono text-slate-300">
                        {row.guessesSubmitted}/10
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
                        {editingRankPrize === row.rank ? (
                          <div className="flex items-center gap-1.5">
                            <label htmlFor={`lb-prize-rank-${row.rank}`} className="sr-only">
                              Prize money for position #{row.rank}
                            </label>
                            <input
                              id={`lb-prize-rank-${row.rank}`}
                              type="number"
                              min={0}
                              inputMode="numeric"
                              value={editingRankAmount}
                              onChange={(e) => setEditingRankAmount(e.target.value)}
                              className="w-24 rounded-lg border border-amber-500 bg-[#0a0d14] px-2 py-1 text-xs font-mono font-bold text-amber-300"
                            />
                            <button
                              type="button"
                              disabled={savingRankPrize}
                              onClick={() =>
                                handleSavePositionPrize(
                                  row.rank,
                                  Number(editingRankAmount)
                                )
                              }
                              className="px-2 py-1 rounded bg-emerald-500 text-slate-950 text-[10px] font-extrabold"
                            >
                              {savingRankPrize ? "..." : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingRankPrize(null)}
                              className="px-1.5 py-1 rounded bg-white/10 text-slate-300 text-[10px] font-bold"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            {row.allocatedPrize > 0 ? (
                              <span className="text-emerald-400">
                                ₦{row.allocatedPrize.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRankPrize(row.rank);
                                setEditingRankAmount(String(row.allocatedPrize ?? 0));
                              }}
                              title={`Edit prize money for position #${row.rank}`}
                              className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[10px] font-sans font-semibold text-amber-300 border border-amber-500/30"
                            >
                              ✎ Edit
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <select
                          value={row.disputeStatus}
                          onChange={(e) => handleUpdateDispute(row.entryId, e.target.value)}
                          className={`rounded-xl border px-2.5 py-1 text-xs font-bold ${
                            row.disputeStatus === "Under Investigation"
                              ? "border-rose-500/40 bg-rose-500/15 text-rose-300"
                              : row.disputeStatus === "Resolved"
                              ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                              : "border-white/10 bg-[#0b0e14] text-slate-300"
                          }`}
                        >
                          <option value="Clear">Clear</option>
                          <option value="Under Investigation">Under Investigation</option>
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
                  Page 39 · Leaderboard Calculation Audit
                </span>
                <h2 className="text-xl font-black text-white mt-1">
                  Rank #{inspectingPlayer.rank} — @{inspectingPlayer.username} ({inspectingPlayer.fullName})
                </h2>
                <p className="text-xs text-slate-400">
                  Question-by-question breakdown of selected options, crowd consensus rank (#1–#10), points awarded (10–1), and response time (ms).
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
                          {step.optionTotalPicks.toLocaleString()} ({step.optionPercentage}%)
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
                    Verified Total Score
                  </p>
                  <p className="text-xl font-black text-amber-400">
                    {inspectingPlayer.score} Points
                  </p>
                </div>
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
                    handleUpdateDispute(inspectingPlayer.entryId, "Under Investigation");
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
