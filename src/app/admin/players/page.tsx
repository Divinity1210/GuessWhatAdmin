import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Player = {
  id: string;
  username: string;
  full_name: string | null;
  phone: string | null;
  gender: string | null;
  date_of_birth: string | null;
  state: string | null;
  role: string;
  status: string;
  created_at: string;
};

function getAgeBand(dob: string | null): string {
  if (!dob) return "—";
  const birthYear = new Date(dob).getFullYear();
  if (Number.isNaN(birthYear)) return "—";
  const age = new Date().getFullYear() - birthYear;
  if (age < 18) return "< 18";
  if (age <= 24) return "18–24";
  if (age <= 34) return "25–34";
  if (age <= 44) return "35–44";
  return "45+";
}

export default async function PlayersPage() {
  const sb = createServiceClient();

  const { data } = await sb
    .from("profiles")
    .select("id, username, full_name, phone, gender, date_of_birth, state, role, status, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const players = (data ?? []) as Player[];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Players &amp; Demographics
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Registered player accounts and demographic attributes used for brand insights.
          </p>
        </div>

        <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300 font-semibold">
          Total: <span className="text-white font-bold tabular-nums">{players.length}</span>
        </div>
      </div>

      <div className="rounded-3xl overflow-hidden bg-[#0f1219] border border-white/10">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-6 py-4">Player</th>
                <th className="px-6 py-4">Gender</th>
                <th className="px-6 py-4">Age Bracket</th>
                <th className="px-6 py-4">Location (State)</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4 text-right">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {players.map((p) => (
                <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-3.5">
                    <p className="font-bold text-white">{p.username}</p>
                    <p className="text-xs text-slate-400">{p.full_name || "—"}</p>
                  </td>
                  <td className="px-6 py-3.5 text-xs capitalize text-slate-300">
                    {p.gender || "—"}
                  </td>
                  <td className="px-6 py-3.5 text-xs font-mono text-slate-300 tabular-nums">
                    {getAgeBand(p.date_of_birth)}
                  </td>
                  <td className="px-6 py-3.5 text-xs text-slate-300">
                    {p.state || "—"}
                  </td>
                  <td className="px-6 py-3.5">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        p.role === "super_admin"
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-white/5 text-slate-300"
                      }`}
                    >
                      {p.role}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-right text-xs text-slate-400 tabular-nums">
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
    </div>
  );
}
