import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Player = {
  id: string;
  username: string;
  full_name: string;
  phone: string | null;
  role: string;
  status: string;
  referral_code: string;
  risk_score: number;
  created_at: string;
  wallets: { coin_balance: number; reward_balance: number; withdrawable_balance: number }[];
};

export default async function PlayersPage() {
  const sb = createServiceClient();

  const { data } = await sb
    .from("profiles")
    .select("id, username, full_name, phone, role, status, referral_code, risk_score, created_at, wallets(coin_balance, reward_balance, withdrawable_balance)")
    .order("created_at", { ascending: false })
    .limit(100);

  const players = (data ?? []) as Player[];

  const statusBadgeStyle: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    suspended: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    blocked: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-semibold text-indigo-300 mb-2">
            👑 User Hub
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Player Directory</h1>
          <p className="text-slate-400 text-sm mt-1">
            Registered player accounts, coin wallets, rewards, and risk scores.
          </p>
        </div>

        <div className="px-4 py-2 rounded-2xl bg-white/5 border border-white/10 text-xs text-slate-300 font-semibold">
          Total Players: <span className="text-white font-extrabold">{players.length}</span>
        </div>
      </div>

      {/* Players Directory Table */}
      {players.length === 0 ? (
        <div className="wimbf-glass rounded-3xl p-12 text-center space-y-3">
          <span className="text-4xl">👑</span>
          <h3 className="text-lg font-bold text-white">No Players Found</h3>
          <p className="text-xs text-slate-400">No registered player accounts in the system.</p>
        </div>
      ) : (
        <div className="wimbf-glass rounded-3xl overflow-hidden border border-white/5">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02] text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                  <th className="px-6 py-4">Player</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Coin Balance</th>
                  <th className="px-6 py-4 text-right">Reward Balance</th>
                  <th className="px-6 py-4 text-right">Risk Score</th>
                  <th className="px-6 py-4 text-right">Joined Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {players.map((p) => (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-amber-500 p-0.5 shadow-sm">
                          <div className="w-full h-full bg-[#0b0e17] rounded-[10px] flex items-center justify-center font-bold text-xs text-white">
                            {p.username.charAt(0).toUpperCase()}
                          </div>
                        </div>
                        <div>
                          <p className="font-bold text-white tracking-tight">{p.username}</p>
                          <p className="text-xs text-slate-400">{p.full_name || "No name set"}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          p.role === "player"
                            ? "bg-slate-500/10 text-slate-300 border-slate-500/20"
                            : "bg-violet-500/15 text-violet-300 border-violet-500/30"
                        }`}
                      >
                        {p.role}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                          statusBadgeStyle[p.status] ?? "bg-slate-500/10 text-slate-400"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right font-bold text-amber-400">
                      🪙 {(p.wallets?.[0]?.coin_balance ?? 0).toLocaleString()}
                    </td>

                    <td className="px-6 py-4 text-right font-bold text-emerald-400">
                      ₦{(p.wallets?.[0]?.reward_balance ?? 0).toLocaleString()}
                    </td>

                    <td className="px-6 py-4 text-right font-semibold">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                          p.risk_score > 30
                            ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                            : "bg-white/5 text-slate-400 border-white/10"
                        }`}
                      >
                        {p.risk_score}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right text-xs text-slate-400 font-medium">
                      {new Date(p.created_at).toLocaleDateString("en-NG", {
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
