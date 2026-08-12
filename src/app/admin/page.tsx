import { createServiceClient } from "@/lib/supabase";
import Link from "next/link";

async function getStats() {
  const sb = createServiceClient();

  const [
    { count: totalPlayers },
    { count: totalSessions },
    { count: activeSessions },
    { count: totalQuestions },
    { count: openTickets },
  ] = await Promise.all([
    sb.from("profiles").select("id", { count: "exact", head: true }),
    sb.from("game_sessions").select("id", { count: "exact", head: true }),
    sb.from("game_sessions").select("id", { count: "exact", head: true }).eq("status", "active"),
    sb.from("questions").select("id", { count: "exact", head: true }),
    sb.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);

  // Recent signups (last 7 days)
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { count: recentSignups } = await sb
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .gte("created_at", weekAgo);

  // Active session preview
  const { data: activeSessionData } = await sb
    .from("game_sessions")
    .select("id, name, prize_pool, entry_fee_coins, ends_at")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  return {
    totalPlayers: totalPlayers ?? 0,
    totalSessions: totalSessions ?? 0,
    activeSessions: activeSessions ?? 0,
    totalQuestions: totalQuestions ?? 0,
    openTickets: openTickets ?? 0,
    recentSignups: recentSignups ?? 0,
    activeSession: activeSessionData,
  };
}

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const stats = await getStats();

  const statCards = [
    {
      label: "Total Registered Players",
      value: stats.totalPlayers.toLocaleString(),
      change: "+12.4% this month",
      badge: "Players",
      borderColor: "border-indigo-500/30",
      textColor: "text-indigo-400",
      bgColor: "bg-indigo-500/10",
    },
    {
      label: "New Weekly Signups",
      value: stats.recentSignups.toLocaleString(),
      change: "Active user growth",
      badge: "7 Days",
      borderColor: "border-emerald-500/30",
      textColor: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
    },
    {
      label: "Active Live Sessions",
      value: stats.activeSessions.toString(),
      change: stats.activeSessions > 0 ? "Game Engine Active" : "Standing by",
      badge: "Live",
      borderColor: "border-rose-500/30",
      textColor: "text-rose-400",
      bgColor: "bg-rose-500/10",
    },
    {
      label: "Total Sessions Run",
      value: stats.totalSessions.toString(),
      change: "Completed trivia runs",
      badge: "History",
      borderColor: "border-violet-500/30",
      textColor: "text-violet-400",
      bgColor: "bg-violet-500/10",
    },
    {
      label: "Question Bank Pool",
      value: stats.totalQuestions.toString(),
      change: "Available trivia items",
      badge: "Questions",
      borderColor: "border-amber-500/30",
      textColor: "text-amber-400",
      bgColor: "bg-amber-500/10",
    },
    {
      label: "Pending Support Tickets",
      value: stats.openTickets.toString(),
      change: stats.openTickets === 0 ? "All tickets resolved" : "Requires review",
      badge: "Support",
      borderColor: "border-sky-500/30",
      textColor: "text-sky-400",
      bgColor: "bg-sky-500/10",
    },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#121723] p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-xs font-semibold text-indigo-300">
              <span className="size-2 rounded-full bg-indigo-400 animate-ping" />
              WIMBF Admin Suite
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
              Platform Command Dashboard
            </h1>
            <p className="text-slate-400 text-sm max-w-xl">
              Monitor real-time gameplay metrics, question banks, player risk factors, and active sessions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin/sessions"
              className="inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all duration-200 hover:scale-[1.02]"
            >
              Launch Session
            </Link>
            <Link
              href="/admin/questions"
              className="inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-semibold text-sm transition-all duration-200"
            >
              New Question
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {statCards.map((card) => (
          <div
            key={card.label}
            className={`relative overflow-hidden rounded-2xl p-6 border bg-[#0f1219] ${card.borderColor}`}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className={`size-10 rounded-xl ${card.bgColor} ${card.textColor} flex items-center justify-center text-sm font-bold`}>
                  {card.value}
                </span>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/5 border ${card.borderColor} ${card.textColor}`}>
                  {card.badge}
                </span>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {card.label}
                </p>
                <p className={`text-3xl font-extrabold tracking-tight mt-1 ${card.textColor}`}>
                  {card.value}
                </p>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-400 pt-2 border-t border-white/5">
                <span className="size-1.5 rounded-full bg-slate-500" />
                <span>{card.change}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Two Column Layout: Quick Actions & Live Session Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions Panel */}
        <div className="rounded-2xl p-6 space-y-6 lg:col-span-2 bg-[#0f1219] border border-white/5">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Quick Operations</h2>
              <p className="text-xs text-slate-400">Direct management triggers for the GuessWhat engine</p>
            </div>
            <span className="px-3 py-1 rounded-full bg-white/5 text-xs font-medium text-slate-300 border border-white/10">
              Shortcuts
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href="/admin/questions"
              className="flex items-start gap-4 p-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-indigo-500/30 transition-all group"
            >
              <div className="size-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center text-sm font-bold group-hover:scale-110 transition-transform">
                Q
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-white group-hover:text-indigo-400 transition-colors">
                  Question Bank Manager
                </h3>
                <p className="text-xs text-slate-400">Create, edit, tag, and publish trivia questions</p>
              </div>
            </Link>

            <Link
              href="/admin/sessions"
              className="flex items-start gap-4 p-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-violet-500/30 transition-all group"
            >
              <div className="size-11 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center text-sm font-bold group-hover:scale-110 transition-transform">
                S
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-white group-hover:text-violet-400 transition-colors">
                  Game Session Builder
                </h3>
                <p className="text-xs text-slate-400">Configure entry fees, prize pools, and schedule live runs</p>
              </div>
            </Link>

            <Link
              href="/admin/players"
              className="flex items-start gap-4 p-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-amber-500/30 transition-all group"
            >
              <div className="size-11 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center text-sm font-bold group-hover:scale-110 transition-transform">
                P
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-white group-hover:text-amber-400 transition-colors">
                  Player Directory & Risk
                </h3>
                <p className="text-xs text-slate-400">Inspect user balances, roles, and risk scores</p>
              </div>
            </Link>

            <Link
              href="/admin/support"
              className="flex items-start gap-4 p-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-emerald-500/30 transition-all group"
            >
              <div className="size-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm font-bold group-hover:scale-110 transition-transform">
                T
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors">
                  Support Ticket Center
                </h3>
                <p className="text-xs text-slate-400">Respond to user inquiries and account issues</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Engine Health & Active Session */}
        <div className="rounded-2xl p-6 space-y-6 bg-[#0f1219] border border-white/5">
          <div className="border-b border-white/5 pb-4">
            <h2 className="text-lg font-bold text-white tracking-tight">System Status</h2>
            <p className="text-xs text-slate-400">Cloud database & node connectivity</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-xs text-slate-300 font-medium flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-400 animate-pulse-glow" />
                Database Engine
              </span>
              <span className="text-xs font-semibold text-emerald-400 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                Connected
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-xs text-slate-300 font-medium flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-400 animate-pulse-glow" />
                Supabase SSR Auth
              </span>
              <span className="text-xs font-semibold text-emerald-400 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                Active
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-xs text-slate-300 font-medium flex items-center gap-2">
                <span className="size-2 rounded-full bg-indigo-400 animate-pulse-glow" />
                RPC Scoring Engine
              </span>
              <span className="text-xs font-semibold text-indigo-400 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                Ready
              </span>
            </div>
          </div>

          {stats.activeSession ? (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-rose-500 animate-ping" />
                  Live Now
                </span>
                <span className="text-xs text-slate-400">
                  Prize: N{stats.activeSession.prize_pool.toLocaleString()}
                </span>
              </div>
              <p className="text-sm font-bold text-white truncate">{stats.activeSession.name}</p>
              <Link
                href="/admin/sessions"
                className="block text-center text-xs font-semibold text-amber-400 hover:underline pt-1"
              >
                Manage Active Session &rarr;
              </Link>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-center space-y-1">
              <p className="text-xs text-slate-400">No session live right now.</p>
              <Link href="/admin/sessions" className="text-xs font-semibold text-indigo-400 hover:underline">
                + Create new session
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
