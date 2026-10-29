import { createServiceClient } from "@/lib/supabase";
import Link from "next/link";

async function getStats() {
  const sb = createServiceClient();

  const [
    { count: totalPlayers },
    { count: totalAnswers },
    { count: totalQuestions },
    { data: activeSessionData },
  ] = await Promise.all([
    sb.from("profiles").select("id", { count: "exact", head: true }),
    sb.from("answers").select("id", { count: "exact", head: true }),
    sb.from("questions").select("id", { count: "exact", head: true }),
    sb
      .from("game_sessions")
      .select("id, name, prize_pool, ends_at")
      .eq("status", "active")
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    totalPlayers: totalPlayers ?? 0,
    totalAnswers: totalAnswers ?? 0,
    totalQuestions: totalQuestions ?? 0,
    activeSession: activeSessionData,
  };
}

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const stats = await getStats();

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Clean Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Admin Overview
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage live sessions, 10-option crowd questions, and export clean consumer data for brands.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/insights"
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm transition-colors"
          >
            Open Brand &amp; Market Data
          </Link>
          <Link
            href="/admin/questions"
            className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-semibold text-xs sm:text-sm transition-colors"
          >
            Manage Questions
          </Link>
        </div>
      </div>

      {/* 4 Essential Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl p-5 bg-[#0f1219] border border-white/10">
          <p className="text-xs font-semibold text-slate-400">Total Crowd Responses</p>
          <p className="text-3xl font-extrabold text-amber-400 mt-1 tabular-nums">
            {stats.totalAnswers.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Monetizable preference data points</p>
        </div>

        <div className="rounded-2xl p-5 bg-[#0f1219] border border-white/10">
          <p className="text-xs font-semibold text-slate-400">Registered Players</p>
          <p className="text-3xl font-extrabold text-white mt-1 tabular-nums">
            {stats.totalPlayers.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Demographic respondent pool</p>
        </div>

        <div className="rounded-2xl p-5 bg-[#0f1219] border border-white/10">
          <p className="text-xs font-semibold text-slate-400">Question Bank</p>
          <p className="text-3xl font-extrabold text-indigo-400 mt-1 tabular-nums">
            {stats.totalQuestions.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">10-option crowd questions</p>
        </div>

        <div className="rounded-2xl p-5 bg-[#0f1219] border border-white/10">
          <p className="text-xs font-semibold text-slate-400">Active Session</p>
          <p className="text-lg font-extrabold text-emerald-400 mt-1 truncate">
            {stats.activeSession ? stats.activeSession.name : "None"}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {stats.activeSession
              ? `Free Entry · ₦${Number(stats.activeSession.prize_pool).toLocaleString()} Pool`
              : "No active session"}
          </p>
        </div>
      </div>

      {/* Core Modules */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Link
          href="/admin/insights"
          className="rounded-2xl p-6 bg-[#0f1219] border border-emerald-500/30 hover:border-emerald-500/60 transition-colors space-y-2"
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
            Data Monetization
          </span>
          <h2 className="text-lg font-bold text-white">Brand &amp; Market Data</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Filter crowd answers by Gender, Age Bracket, and State. Export clean Brand Summary CSVs or anonymized respondent microdata.
          </p>
        </Link>

        <Link
          href="/admin/questions"
          className="rounded-2xl p-6 bg-[#0f1219] border border-white/10 hover:border-amber-500/40 transition-colors space-y-2"
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
            Question Bank
          </span>
          <h2 className="text-lg font-bold text-white">Questions &amp; Live Points Chart</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Create 10-option questions across Text, Number, Colour, and Image formats, and view real-time points (10 down to 1).
          </p>
        </Link>

        <Link
          href="/admin/sessions"
          className="rounded-2xl p-6 bg-[#0f1219] border border-white/10 hover:border-indigo-500/40 transition-colors space-y-2"
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
            Game Operations
          </span>
          <h2 className="text-lg font-bold text-white">3-Day Game Sessions</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Schedule free-to-play 72-hour sessions, assign 10 questions, and review live session leaderboards.
          </p>
        </Link>
      </div>
    </div>
  );
}
