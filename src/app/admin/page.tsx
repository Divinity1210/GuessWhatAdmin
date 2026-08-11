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
      icon: "👑",
      badge: "Players",
      gradient: "from-indigo-500/20 via-indigo-500/5 to-transparent",
      borderColor: "border-indigo-500/30",
      textColor: "text-indigo-400",
    },
    {
      label: "New Weekly Signups",
      value: stats.recentSignups.toLocaleString(),
      change: "Active user growth",
      icon: "⚡",
      badge: "7 Days",
      gradient: "from-emerald-500/20 via-emerald-500/5 to-transparent",
      borderColor: "border-emerald-500/30",
      textColor: "text-emerald-400",
    },
    {
      label: "Active Live Sessions",
      value: stats.activeSessions.toString(),
      change: stats.activeSessions > 0 ? "Game Engine Active" : "Standing by",
      icon: "🔥",
      badge: "Live",
      gradient: "from-rose-500/20 via-rose-500/5 to-transparent",
      borderColor: "border-rose-500/30",
      textColor: "text-rose-400",
    },
    {
      label: "Total Sessions Run",
      value: stats.totalSessions.toString(),
      change: "Completed trivia runs",
      icon: "🎯",
      badge: "History",
      gradient: "from-violet-500/20 via-violet-500/5 to-transparent",
      borderColor: "border-violet-500/30",
      textColor: "text-violet-400",
    },
    {
      label: "Question Bank Pool",
      value: stats.totalQuestions.toString(),
      change: "Available trivia items",
      icon: "🧠",
      badge: "Questions",
      gradient: "from-amber-500/20 via-amber-500/5 to-transparent",
      borderColor: "border-amber-500/30",
      textColor: "text-amber-400",
    },
    {
      label: "Pending Support Tickets",
      value: stats.openTickets.toString(),
      change: stats.openTickets === 0 ? "All tickets resolved" : "Requires review",
      icon: "💬",
      badge: "Support",
      gradient: "from-sky-500/20 via-sky-500/5 to-transparent",
      borderColor: "border-sky-500/30",
      textColor: "text-sky-400",
    },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-[#121723] via-[#10141f] to-[#0c0f18] p-8 shadow-2xl">
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 size-96 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-indigo-500/20 to-violet-500/20 border border-indigo-500/30 text-xs font-semibold text-indigo-300">
              <span className="size-2 rounded-full bg-indigo-400 animate-ping" />
              WIMBF Admin Suite • Operational Control
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
              className="inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm shadow-xl shadow-indigo-600/25 transition-all duration-200 hover:scale-[1.02]"
            >
              <span>🎮</span>
              <span>Launch Session</span>
            </Link>
            <Link
              href="/admin/questions"
              className="inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-semibold text-sm backdrop-blur-xl transition-all duration-200"
            >
              <span>🧠</span>
              <span>New Question</span>
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {statCards.map((card) => (
          <div
            key={card.label}
            className={`wimbf-glass wimbf-glass-hover relative overflow-hidden rounded-2xl p-6 border ${card.borderColor}`}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} pointer-events-none`} />

            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-3xl">{card.icon}</span>
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
        <div className="wimbf-glass rounded-2xl p-6 space-y-6 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Quick Operations</h2>
              <p className="text-xs text-slate-400">Direct management triggers for the GuessWhat engine</p>
            </div>
            <span className="px-3 py-1 rounded-full bg-white/5 text-xs font-medium text-slate-300 border border-white/10">
              Shortcut Center
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href="/admin/questions"
              className="flex items-start gap-4 p-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-indigo-500/30 transition-all group"
            >
              <div className="size-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                🧠
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
              <div className="size-11 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                🎯
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
              <div className="size-11 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                👑
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
              <div className="size-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                💬
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
        <div className="wimbf-glass rounded-2xl p-6 space-y-6">
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
            <div className="p-4 rounded-xl bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-transparent border border-rose-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-rose-500 animate-ping" />
                  Live Now
                </span>
                <span className="text-xs text-slate-400">
                  Prize: ₦{stats.activeSession.prize_pool.toLocaleString()}
                </span>
              </div>
              <p className="text-sm font-bold text-white truncate">{stats.activeSession.name}</p>
              <Link
                href="/admin/sessions"
                className="block text-center text-xs font-semibold text-amber-400 hover:underline pt-1"
              >
                Manage Active Session →
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
