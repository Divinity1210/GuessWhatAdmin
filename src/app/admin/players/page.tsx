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

  const { data, error } = await sb
    .from("profiles")
    .select("id, username, full_name, phone, role, status, referral_code, risk_score, created_at, wallets(coin_balance, reward_balance, withdrawable_balance)")
    .order("created_at", { ascending: false })
    .limit(100);

  const players = (data ?? []) as Player[];

  const statusColor: Record<string, string> = {
    active: "bg-green-900 text-green-300",
    suspended: "bg-yellow-900 text-yellow-300",
    blocked: "bg-red-900 text-red-300",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Players</h1>
        <p className="text-gray-500 mt-1">{players.length} registered players</p>
      </div>

      <div className="rounded-xl border border-gray-800 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 text-xs text-gray-500 uppercase">
              <th className="text-left px-4 py-3">Username</th>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Role</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Coins</th>
              <th className="text-right px-4 py-3">Rewards</th>
              <th className="text-right px-4 py-3">Risk</th>
              <th className="text-left px-4 py-3">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {players.map((p) => (
              <tr key={p.id} className="hover:bg-gray-900/50">
                <td className="px-4 py-3 font-medium">{p.username}</td>
                <td className="px-4 py-3 text-gray-400">{p.full_name || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-md ${p.role === "player" ? "bg-gray-700 text-gray-300" : "bg-purple-900 text-purple-300"}`}>{p.role}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-md ${statusColor[p.status] ?? ""}`}>{p.status}</span>
                </td>
                <td className="px-4 py-3 text-right text-gray-300">{(p.wallets?.[0]?.coin_balance ?? 0).toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-gray-300">₦{(p.wallets?.[0]?.reward_balance ?? 0).toLocaleString()}</td>
                <td className="px-4 py-3 text-right">
                  <span className={p.risk_score > 30 ? "text-red-400" : "text-gray-500"}>{p.risk_score}</span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
