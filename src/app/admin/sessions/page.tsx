"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@/lib/supabase-browser";

type Session = {
  id: string;
  name: string;
  status: string;
  starts_at: string;
  ends_at: string;
  entry_fee_coins: number;
  prize_pool: number;
  prize_structure: { rank_from: number; rank_to: number; amount: number }[];
};

type PublishedQuestion = {
  id: string;
  title: string;
  category: string;
};

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [questions, setQuestions] = useState<PublishedQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [tab, setTab] = useState("all");

  // Create form
  const [name, setName] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [entryFee, setEntryFee] = useState(100);
  const [prizePool, setPrizePool] = useState(0);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const sb = createClientComponentClient();

  async function loadData() {
    setLoading(true);
    const [{ data: s }, { data: q }] = await Promise.all([
      sb.from("game_sessions").select("*").order("created_at", { ascending: false }).limit(50),
      sb.from("questions").select("id, title, category").eq("status", "published"),
    ]);
    setSessions((s ?? []) as Session[]);
    setQuestions((q ?? []) as PublishedQuestion[]);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !startsAt || !endsAt || selectedQuestions.length === 0) return;
    setCreating(true);

    const prizeStructure = [
      { rank_from: 1, rank_to: 1, amount: Math.round(prizePool * 0.4) },
      { rank_from: 2, rank_to: 2, amount: Math.round(prizePool * 0.2) },
      { rank_from: 3, rank_to: 3, amount: Math.round(prizePool * 0.1) },
      { rank_from: 4, rank_to: 10, amount: Math.round(prizePool * 0.03) },
    ];

    const { data: sess, error } = await sb
      .from("game_sessions")
      .insert({
        name: name.trim(),
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
        entry_fee_coins: entryFee,
        prize_pool: prizePool,
        prize_structure: prizeStructure,
        status: "upcoming",
      })
      .select("id")
      .single();

    if (error) { alert(error.message); setCreating(false); return; }

    // Link questions
    const { error: sqErr } = await sb.from("session_questions").insert(
      selectedQuestions.map((qid, i) => ({ session_id: sess.id, question_id: qid, position: i })),
    );
    if (sqErr) alert(sqErr.message);

    setShowCreate(false);
    setName(""); setStartsAt(""); setEndsAt(""); setSelectedQuestions([]);
    setCreating(false);
    loadData();
  };

  const updateStatus = async (id: string, status: string) => {
    await sb.from("game_sessions").update({ status }).eq("id", id);
    loadData();
  };

  const closeSession = async (id: string) => {
    if (!confirm("Close this session? This will calculate scores and pay prizes.")) return;
    const { error } = await sb.rpc("close_session", { p_session_id: id });
    if (error) alert(error.message);
    else loadData();
  };

  const filtered = tab === "all" ? sessions : sessions.filter((s) => s.status === tab);

  const statusColor: Record<string, string> = {
    upcoming: "bg-blue-900 text-blue-300",
    active: "bg-green-900 text-green-300",
    closing: "bg-yellow-900 text-yellow-300",
    completed: "bg-gray-700 text-gray-400",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sessions</h1>
          <p className="text-gray-500 mt-1">{sessions.length} total sessions</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)}
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors">
          {showCreate ? "Cancel" : "🎮 New Session"}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="rounded-xl border border-gray-800 bg-gray-900 p-6 space-y-4">
          <h2 className="text-lg font-semibold">Create Session</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 uppercase mb-1.5">Session Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm focus:border-orange-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 uppercase mb-1.5">Entry Fee (coins)</label>
              <input type="number" value={entryFee} onChange={(e) => setEntryFee(+e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm focus:border-orange-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 uppercase mb-1.5">Starts At</label>
              <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm focus:border-orange-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 uppercase mb-1.5">Ends At</label>
              <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm focus:border-orange-500 focus:outline-none" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 uppercase mb-1.5">Prize Pool (₦)</label>
              <input type="number" value={prizePool} onChange={(e) => setPrizePool(+e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm focus:border-orange-500 focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 uppercase mb-1.5">Select Questions ({selectedQuestions.length} selected)</label>
            <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-700 rounded-lg p-2">
              {questions.length === 0 ? (
                <p className="text-xs text-gray-500 p-2">No published questions. Create and publish questions first.</p>
              ) : questions.map((q) => (
                <label key={q.id} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-gray-800 cursor-pointer">
                  <input type="checkbox" checked={selectedQuestions.includes(q.id)}
                    onChange={(e) => setSelectedQuestions(e.target.checked ? [...selectedQuestions, q.id] : selectedQuestions.filter((id) => id !== q.id))}
                    className="rounded accent-orange-500" />
                  <span className="text-sm truncate">{q.title}</span>
                  <span className="text-xs text-gray-600 ml-auto">{q.category}</span>
                </label>
              ))}
            </div>
          </div>
          <button type="submit" disabled={creating} className="rounded-lg bg-orange-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50">
            {creating ? "Creating..." : "Create Session"}
          </button>
        </form>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {["all", "upcoming", "active", "completed"].map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t ? "bg-orange-500/15 text-orange-400" : "bg-gray-800 text-gray-400 hover:text-gray-200"
            }`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Sessions list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="size-6 animate-spin rounded-full border-2 border-orange-400 border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => (
            <div key={s.id} className="rounded-xl border border-gray-800 bg-gray-900 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{s.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(s.starts_at).toLocaleString()} → {new Date(s.ends_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-1 rounded-md ${statusColor[s.status] ?? ""}`}>{s.status}</span>
                  {s.status === "upcoming" && (
                    <button onClick={() => updateStatus(s.id, "active")} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700">Activate</button>
                  )}
                  {s.status === "active" && (
                    <button onClick={() => closeSession(s.id)} className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700">Close & Score</button>
                  )}
                </div>
              </div>
              <div className="flex gap-4 mt-3 text-xs text-gray-400">
                <span>💰 ₦{s.prize_pool.toLocaleString()}</span>
                <span>🪙 {s.entry_fee_coins} coins</span>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-center text-gray-500 py-8">No sessions found.</p>}
        </div>
      )}
    </div>
  );
}
