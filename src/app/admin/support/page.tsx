import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Ticket = {
  id: string;
  subject: string;
  status: string;
  created_at: string;
  user_id: string;
  profiles: { username: string }[];
};

export default async function SupportPage() {
  const sb = createServiceClient();
  const { data } = await sb
    .from("support_tickets")
    .select("id, subject, status, created_at, user_id, profiles(username)")
    .order("updated_at", { ascending: false })
    .limit(50);

  const tickets = (data ?? []) as Ticket[];

  const statusBadgeStyle: Record<string, string> = {
    open: "bg-rose-500/15 text-rose-300 border-rose-500/30 animate-pulse",
    pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    resolved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    closed: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-300 mb-2">
            💬 Customer Care
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Support Tickets</h1>
          <p className="text-slate-400 text-sm mt-1">
            Player inquiries, feedback, and account issue management.
          </p>
        </div>

        <div className="px-4 py-2 rounded-2xl bg-white/5 border border-white/10 text-xs text-slate-300 font-semibold">
          Active Tickets: <span className="text-white font-extrabold">{tickets.length}</span>
        </div>
      </div>

      {/* Tickets List Table */}
      {tickets.length === 0 ? (
        <div className="wimbf-glass rounded-3xl p-12 text-center space-y-3">
          <span className="text-4xl">💬</span>
          <h3 className="text-lg font-bold text-white">No Support Tickets</h3>
          <p className="text-xs text-slate-400">All player inquiries are resolved!</p>
        </div>
      ) : (
        <div className="wimbf-glass rounded-3xl overflow-hidden border border-white/5">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02] text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                  <th className="px-6 py-4">Subject</th>
                  <th className="px-6 py-4">Player</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Created Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {tickets.map((t) => (
                  <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 font-bold text-white max-w-sm truncate">
                      {t.subject}
                    </td>

                    <td className="px-6 py-4 text-xs font-medium text-slate-300">
                      <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
                        {t.profiles?.[0]?.username ?? "Unknown Player"}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                          statusBadgeStyle[t.status] ?? "bg-slate-500/10 text-slate-400"
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right text-xs text-slate-400 font-medium">
                      {new Date(t.created_at).toLocaleDateString("en-NG", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
