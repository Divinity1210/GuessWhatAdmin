"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type OverviewMetrics = {
  totalRegisteredPlayers: number;
  newRegistrationsInPeriod: number;
  activePlayersInPeriod: number;
  allTimeActivePlayers: number;
  totalSessions: number;
  completedSessions: number;
  activeSessionsCount: number;
  upcomingSessionsCount: number;
  totalPlays: number;
  liveEntries: number;
  repeatPlays: number;
  totalGuessesSubmitted: number;
  totalQuestionsInBank: number;
  publishedQuestionsCount: number;
  totalPrizePoolAllocated: number;
  totalPrizePaid: number;
  paidWinnersCount: number;
  pendingWinnersCount: number;
};

type SessionPerf = {
  sessionId: string;
  sessionName: string;
  status: string;
  startsAt: string;
  endsAt: string;
  prizePool: number;
  uniquePlayers: number;
  totalPlays: number;
  repeatPlays: number;
  guessesSubmitted: number;
  avgScore: number;
};

type RegistrationRow = {
  id: string;
  username: string;
  fullName: string;
  state: string;
  gender: string;
  status: string;
  createdAt: string;
};

type OverviewResponse = {
  range: string;
  metrics: OverviewMetrics;
  activeSession: {
    id: string;
    name: string;
    prizePool: number;
    startsAt: string;
    endsAt: string;
  } | null;
  sessionPerformance: SessionPerf[];
  recentRegistrations: RegistrationRow[];
};

const DATE_RANGES = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "7d", label: "Last 7 Days" },
  { id: "30d", label: "Last 30 Days" },
  { id: "all", label: "All Time" },
  { id: "custom", label: "Custom Date Range" },
] as const;

export default function AdminDashboard() {
  const [range, setRange] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [chartMetric, setChartMetric] = useState<"plays" | "guesses" | "score">("plays");

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ range });
      if (range === "custom") {
        if (fromDate) params.set("from", fromDate);
        if (toDate) params.set("to", toDate);
      }
      const res = await fetch(`/api/admin/overview?${params.toString()}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const json = (await res.json()) as OverviewResponse;
        setData(json);
      }
    } catch (err) {
      console.error("Failed to fetch admin overview:", err);
    } finally {
      setLoading(false);
    }
  }, [range, fromDate, toDate]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const m = data?.metrics;
  const sessions = data?.sessionPerformance ?? [];
  const registrations = data?.recentRegistrations ?? [];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header & Quick Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-300 mb-2">
            Admin Central Command · Page 35
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Admin Dashboard &amp; Platform Overview
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time summary of player registrations, active players, game sessions, total plays, prize money allocated vs. paid, and session performance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/admin/gameplay"
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm transition-colors"
          >
            Gameplay Monitoring
          </Link>
          <Link
            href="/admin/sessions"
            className="px-4 py-2.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-200 font-bold text-xs sm:text-sm transition-colors"
          >
            Manage Sessions
          </Link>
          <Link
            href="/admin/winners"
            className="px-4 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold text-xs sm:text-sm transition-colors"
          >
            Winners &amp; Prizes
          </Link>
          <button
            onClick={fetchOverview}
            className="px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-semibold text-xs sm:text-sm transition-colors"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Date Range Filter Bar (Page 35: Today, Yesterday, Last 7 Days, Last 30 Days, All Time, Custom Date Range) */}
      <div className="rounded-2xl p-4 bg-[#0f1219] border border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-1">
            Period Filter:
          </span>
          {DATE_RANGES.map((dr) => {
            const active = range === dr.id;
            return (
              <button
                key={dr.id}
                onClick={() => setRange(dr.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  active
                    ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20"
                    : "bg-white/[0.03] text-slate-300 hover:bg-white/[0.08] border border-white/5"
                }`}
              >
                {dr.label}
              </button>
            );
          })}
        </div>

        {range === "custom" && (
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 font-semibold">From:</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded-xl border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 font-semibold">To:</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="rounded-xl border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Primary KPI Grid (Page 35 Core Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. Total Registered Players */}
        <div className="rounded-2xl p-5 bg-[#0f1219] border border-white/10 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Total Registered Players
            </p>
            <span className="px-2.5 py-0.5 rounded-full bg-white/5 text-[11px] font-semibold text-slate-300">
              Accounts
            </span>
          </div>
          <p className="text-3xl font-extrabold text-white mt-2 tabular-nums">
            {loading && !m ? "—" : (m?.totalRegisteredPlayers ?? 0).toLocaleString()}
          </p>
          <p className="text-xs text-slate-400 mt-1.5">
            {range === "all"
              ? "Verified demographic respondent pool"
              : `${(m?.newRegistrationsInPeriod ?? 0).toLocaleString()} registered in selected period`}
          </p>
        </div>

        {/* 2. Total Active Players */}
        <div className="rounded-2xl p-5 bg-[#0f1219] border border-emerald-500/25 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">
              Total Active Players
            </p>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-[11px] font-bold text-emerald-300">
              Active Participants
            </span>
          </div>
          <p className="text-3xl font-extrabold text-emerald-400 mt-2 tabular-nums">
            {loading && !m ? "—" : (m?.activePlayersInPeriod ?? 0).toLocaleString()}
          </p>
          <p className="text-xs text-slate-400 mt-1.5">
            {range === "all"
              ? "Unique players who entered & played sessions"
              : `Played in selected period · ${(m?.allTimeActivePlayers ?? 0).toLocaleString()} all-time`}
          </p>
        </div>

        {/* 3. Total Sessions & Completed Sessions */}
        <div className="rounded-2xl p-5 bg-[#0f1219] border border-indigo-500/25 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-300">
              Game Sessions &amp; Completed
            </p>
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-[11px] font-bold text-indigo-300">
              {m?.activeSessionsCount ?? 0} Live Now
            </span>
          </div>
          <div className="flex items-baseline gap-3 mt-2">
            <p className="text-3xl font-extrabold text-white tabular-nums">
              {loading && !m ? "—" : (m?.totalSessions ?? 0).toLocaleString()}
              <span className="text-sm font-semibold text-slate-400 ml-1.5">total</span>
            </p>
            <span className="text-slate-600">·</span>
            <p className="text-xl font-extrabold text-indigo-400 tabular-nums">
              {m?.completedSessions ?? 0}{" "}
              <span className="text-xs font-semibold text-slate-400">completed</span>
            </p>
          </div>
          <p className="text-xs text-slate-400 mt-1.5">
            {data?.activeSession
              ? `Active: ${data.activeSession.name} (₦${data.activeSession.prizePool.toLocaleString()})`
              : `${m?.upcomingSessionsCount ?? 0} scheduled upcoming`}
          </p>
        </div>

        {/* 4. Total Plays & Guesses Submitted */}
        <div className="rounded-2xl p-5 bg-[#0f1219] border border-amber-500/25 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
              Total Plays &amp; Guesses
            </p>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-[11px] font-bold text-amber-300">
              {m?.repeatPlays ?? 0} Replays
            </span>
          </div>
          <div className="flex items-baseline gap-3 mt-2">
            <p className="text-3xl font-extrabold text-amber-400 tabular-nums">
              {loading && !m ? "—" : (m?.totalPlays ?? 0).toLocaleString()}
              <span className="text-sm font-semibold text-slate-400 ml-1">plays</span>
            </p>
            <span className="text-slate-600">·</span>
            <p className="text-lg font-extrabold text-white tabular-nums">
              {(m?.totalGuessesSubmitted ?? 0).toLocaleString()}{" "}
              <span className="text-xs font-semibold text-slate-400">guesses</span>
            </p>
          </div>
          <p className="text-xs text-slate-400 mt-1.5">
            {m?.liveEntries ?? 0} primary entries + {m?.repeatPlays ?? 0} archived repeat attempts
          </p>
        </div>

        {/* 5. Total Prize Money Allocated */}
        <div className="rounded-2xl p-5 bg-[#0f1219] border border-white/10 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Total Prize Money Allocated
            </p>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-[11px] font-bold text-amber-300">
              Prize Pools
            </span>
          </div>
          <p className="text-3xl font-extrabold text-amber-300 mt-2 tabular-nums">
            ₦{loading && !m ? "—" : (m?.totalPrizePoolAllocated ?? 0).toLocaleString()}
          </p>
          <p className="text-xs text-slate-400 mt-1.5">
            Sum of configured session prize pools across {m?.totalSessions ?? 0} sessions
          </p>
        </div>

        {/* 6. Total Prize Money Paid */}
        <div className="rounded-2xl p-5 bg-[#0f1219] border border-emerald-500/25 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">
              Total Prize Money Paid
            </p>
            <Link
              href="/admin/winners"
              className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/30"
            >
              Manage Payouts ↗
            </Link>
          </div>
          <p className="text-3xl font-extrabold text-emerald-400 mt-2 tabular-nums">
            ₦{loading && !m ? "—" : (m?.totalPrizePaid ?? 0).toLocaleString()}
          </p>
          <p className="text-xs text-slate-400 mt-1.5">
            {m?.paidWinnersCount ?? 0} winners paid · {m?.pendingWinnersCount ?? 0} pending payout
          </p>
        </div>
      </div>

      {/* Gameplay Performance Chart & Recent Registrations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Gameplay Performance Visual Chart (7 cols) */}
        <div className="lg:col-span-7 rounded-3xl p-6 bg-[#0f1219] border border-white/10 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <h2 className="text-lg font-extrabold text-white">
                Gameplay Performance Across Sessions
              </h2>
              <p className="text-xs text-slate-400">
                Compare total plays, guesses submitted, and average consensus score per session
              </p>
            </div>
            <div className="flex items-center gap-1.5 bg-white/[0.03] p-1 rounded-xl border border-white/10">
              {(
                [
                  { id: "plays", label: "Plays" },
                  { id: "guesses", label: "Guesses" },
                  { id: "score", label: "Avg Score" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setChartMetric(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    chartMetric === tab.id
                      ? "bg-amber-500 text-slate-950"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {sessions.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              No sessions found for the selected period.
            </div>
          ) : (
            <div className="space-y-4">
              {(() => {
                const maxVal = Math.max(
                  ...sessions.map((s) =>
                    chartMetric === "plays"
                      ? s.totalPlays
                      : chartMetric === "guesses"
                      ? s.guessesSubmitted
                      : s.avgScore
                  ),
                  1
                );

                return sessions.map((s) => {
                  const val =
                    chartMetric === "plays"
                      ? s.totalPlays
                      : chartMetric === "guesses"
                      ? s.guessesSubmitted
                      : s.avgScore;
                  const pct = Math.max(Math.round((val / maxVal) * 100), 6);

                  return (
                    <div
                      key={s.sessionId}
                      className="rounded-2xl p-4 bg-white/[0.02] border border-white/5 space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${
                              s.status === "active"
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : s.status === "completed"
                                ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                                : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            }`}
                          >
                            {s.status}
                          </span>
                          <span className="font-bold text-sm text-white truncate">
                            {s.sessionName}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono text-sm font-black text-amber-400">
                            {chartMetric === "score"
                              ? `${val} pts avg`
                              : chartMetric === "plays"
                              ? `${val.toLocaleString()} plays`
                              : `${val.toLocaleString()} guesses`}
                          </span>
                        </div>
                      </div>

                      <div className="h-3.5 w-full rounded-full bg-white/5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            s.status === "active"
                              ? "bg-gradient-to-r from-emerald-500 to-amber-400"
                              : "bg-gradient-to-r from-indigo-500 to-sky-400"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-0.5">
                        <span>
                          {s.uniquePlayers} unique players · {s.repeatPlays} replays ·{" "}
                          {s.guessesSubmitted} answers
                        </span>
                        <span>
                          Pool: <strong className="text-slate-200">₦{s.prizePool.toLocaleString()}</strong> · Avg Score:{" "}
                          <strong className="text-emerald-300">{s.avgScore} pts</strong>
                        </span>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>

        {/* Recent Player Registrations Table (5 cols) */}
        <div className="lg:col-span-5 rounded-3xl p-6 bg-[#0f1219] border border-white/10 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h2 className="text-lg font-extrabold text-white">
                  Recent Player Registrations
                </h2>
                <p className="text-xs text-slate-400">
                  Newest player accounts &amp; demographic profile tags
                </p>
              </div>
              <Link
                href="/admin/players"
                className="text-xs font-bold text-amber-400 hover:text-amber-300"
              >
                View All ↗
              </Link>
            </div>

            {registrations.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">
                No player registrations in this date range.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="py-2.5 pr-2">Player</th>
                      <th className="py-2.5 px-2">Location / Gender</th>
                      <th className="py-2.5 pl-2 text-right">Registered</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {registrations.map((reg) => (
                      <tr key={reg.id} className="hover:bg-white/[0.02]">
                        <td className="py-2.5 pr-2">
                          <p className="font-bold text-white">@{reg.username}</p>
                          <p className="text-[11px] text-slate-400 truncate max-w-[140px]">
                            {reg.fullName}
                          </p>
                        </td>
                        <td className="py-2.5 px-2">
                          <span className="inline-block px-2 py-0.5 rounded bg-white/5 text-slate-200 font-medium">
                            {reg.state}
                          </span>
                          <span className="ml-1.5 text-slate-400">{reg.gender}</span>
                        </td>
                        <td className="py-2.5 pl-2 text-right font-mono text-[11px] text-slate-400">
                          {reg.createdAt
                            ? new Date(reg.createdAt).toLocaleDateString("en-NG", {
                                month: "short",
                                day: "numeric",
                              })
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
            <span>Question Bank Ready:</span>
            <Link
              href="/admin/questions"
              className="font-bold text-indigo-300 hover:text-indigo-200"
            >
              {m?.publishedQuestionsCount ?? 0} Published / {m?.totalQuestionsInBank ?? 0} Total Questions →
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards to All Admin Modules */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">
          Admin Modules &amp; Operations
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/admin/gameplay"
            className="rounded-2xl p-5 bg-[#0f1219] border border-amber-500/40 hover:border-amber-500/70 transition-colors space-y-1.5"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
              Page 38 · Live Telemetry
            </span>
            <h3 className="text-base font-bold text-white">
              Gameplay Monitoring &amp; Analytics
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Real-time gameplay stream, option selection %, assigned points (10–1), timings, repeat plays, and CSV reports.
            </p>
          </Link>

          <Link
            href="/admin/questions"
            className="rounded-2xl p-5 bg-[#0f1219] border border-white/10 hover:border-amber-500/40 transition-colors space-y-1.5"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
              Pages 30, 34, 36 · Question Bank
            </span>
            <h3 className="text-base font-bold text-white">
              Question Management &amp; AI Generator
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Create, edit, preview, and auto-generate 10-option questions (Text, Number, Colour, Image) and inspect session assignments.
            </p>
          </Link>

          <Link
            href="/admin/sessions"
            className="rounded-2xl p-5 bg-[#0f1219] border border-white/10 hover:border-indigo-500/40 transition-colors space-y-1.5"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
              Page 37 · Session Control
            </span>
            <h3 className="text-base font-bold text-white">
              Game Session Management
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Create, edit, start, pause, and score 10-question game sessions with live countdowns and prize pool presets.
            </p>
          </Link>

          <Link
            href="/admin/leaderboards"
            className="rounded-2xl p-5 bg-[#0f1219] border border-white/10 hover:border-sky-500/40 transition-colors space-y-1.5"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
              Page 39 · Rankings &amp; Audits
            </span>
            <h3 className="text-base font-bold text-white">
              Leaderboard Management
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Navigate session leaderboards, inspect per-question point &amp; millisecond calculations, flag disputes, and publish rankings.
            </p>
          </Link>

          <Link
            href="/admin/winners"
            className="rounded-2xl p-5 bg-[#0f1219] border border-emerald-500/30 hover:border-emerald-500/60 transition-colors space-y-1.5"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
              Pages 20 &amp; 40 · Payouts
            </span>
            <h3 className="text-base font-bold text-white">
              Winners &amp; Prize Management
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Configure 36-winner or 49-winner ₦500k prize distributions, view bank details, update payment status, and export CSVs.
            </p>
          </Link>

          <Link
            href="/admin/insights"
            className="rounded-2xl p-5 bg-[#0f1219] border border-white/10 hover:border-emerald-500/40 transition-colors space-y-1.5"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
              Data Monetization
            </span>
            <h3 className="text-base font-bold text-white">
              Brand &amp; Market Data
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Slice crowd preferences by Gender, Age Bracket, and State. Export Brand Summary or anonymized respondent CSVs.
            </p>
          </Link>

          <Link
            href="/admin/players"
            className="rounded-2xl p-5 bg-[#0f1219] border border-white/10 hover:border-white/30 transition-colors space-y-1.5"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Page 41 · User Directory
            </span>
            <h3 className="text-base font-bold text-white">
              Player Management
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Search players, inspect demographics, manage account status, and review participation history.
            </p>
          </Link>

          <Link
            href="/admin/referrals"
            className="rounded-2xl p-5 bg-[#0f1219] border border-white/10 hover:border-white/30 transition-colors space-y-1.5"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Pages 42–45 · Growth &amp; Ops
            </span>
            <h3 className="text-base font-bold text-white">
              Referrals, Notifications &amp; Support
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Track referral leaderboards, send announcements, resolve player support tickets, and manage admin roles.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
