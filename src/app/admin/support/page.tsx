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

  const statusColor: Record<string, string> = {
    open: "bg-red-900 text-red-300",
    pending: "bg-yellow-900 text-yellow-300",
    resolved: "bg-green-900 text-green-300",
    closed: "bg-gray-700 text-gray-400",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Support Tickets</h1>
        <p className="text-gray-500 mt-1">{tickets.length} tickets</p>
      </div>

      {tickets.length === 0 ? (
        <p className="text-center text-gray-500 py-12">No support tickets yet.</p>
      ) : (
        <div className="rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900 text-xs text-gray-500 uppercase">
                <th className="text-left px-4 py-3">Subject</th>
                <th className="text-left px-4 py-3">Player</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {tickets.map((t) => (
                <tr key={t.id} className="hover:bg-gray-900/50">
                  <td className="px-4 py-3 font-medium">{t.subject}</td>
                  <td className="px-4 py-3 text-gray-400">{t.profiles?.[0]?.username ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-md ${statusColor[t.status] ?? ""}`}>{t.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(t.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
