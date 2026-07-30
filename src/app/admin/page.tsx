import { createServiceClient } from "@/lib/supabase";

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

  return {
    totalPlayers: totalPlayers ?? 0,
    totalSessions: totalSessions ?? 0,
    activeSessions: activeSessions ?? 0,
    totalQuestions: totalQuestions ?? 0,
    openTickets: openTickets ?? 0,
    recentSignups: recentSignups ?? 0,
  };
}

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const stats = await getStats();

  const cards = [
    { label: "Total Players", value: stats.totalPlayers.toLocaleString(), icon: "👥", color: "text-blue-400" },
    { label: "New This Week", value: stats.recentSignups.toLocaleString(), icon: "📈", color: "text-green-400" },
    { label: "Active Sessions", value: stats.activeSessions.toString(), icon: "🔴", color: "text-red-400" },
    { label: "Total Sessions", value: stats.totalSessions.toString(), icon: "🎮", color: "text-purple-400" },
    { label: "Questions", value: stats.totalQuestions.toString(), icon: "❓", color: "text-yellow-400" },
    { label: "Open Tickets", value: stats.openTickets.toString(), icon: "🎫", color: "text-orange-400" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-gray-500 mt-1">Overview of your GuessWhat platform</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-gray-800 bg-gray-900 p-5">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{card.icon}</span>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">{card.label}</p>
                <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick actions */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-2">
            <a href="/admin/questions" className="flex items-center gap-3 rounded-lg px-4 py-3 bg-gray-800/50 hover:bg-gray-800 transition-colors">
              <span>➕</span>
              <span className="text-sm">Create Question</span>
            </a>
            <a href="/admin/sessions" className="flex items-center gap-3 rounded-lg px-4 py-3 bg-gray-800/50 hover:bg-gray-800 transition-colors">
              <span>🎮</span>
              <span className="text-sm">Create Session</span>
            </a>
            <a href="/admin/players" className="flex items-center gap-3 rounded-lg px-4 py-3 bg-gray-800/50 hover:bg-gray-800 transition-colors">
              <span>👥</span>
              <span className="text-sm">View Players</span>
            </a>
          </div>
        </div>

        {/* Platform health */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-lg font-semibold mb-4">Platform Health</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Database</span>
              <span className="text-xs font-medium text-green-400 bg-green-500/15 px-2 py-1 rounded">Connected</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Auth Service</span>
              <span className="text-xs font-medium text-green-400 bg-green-500/15 px-2 py-1 rounded">Active</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Supabase Project</span>
              <span className="text-xs text-gray-500">wexnqxxjdzubtgqyedlm</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
