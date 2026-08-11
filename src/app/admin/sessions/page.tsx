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
  const [prizePool, setPrizePool] = useState(5000);
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

  useEffect(() => {
    loadData();
  }, []);

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

    if (error) {
      alert(error.message);
      setCreating(false);
      return;
    }

    // Link questions
    const { error: sqErr } = await sb.from("session_questions").insert(
      selectedQuestions.map((qid, i) => ({
        session_id: sess.id,
        question_id: qid,
        position: i,
      }))
    );
    if (sqErr) alert(sqErr.message);

    setShowCreate(false);
    setName("");
    setStartsAt("");
    setEndsAt("");
    setSelectedQuestions([]);
    setCreating(false);
    loadData();
  };

  const updateStatus = async (id: string, status: string) => {
    await sb.from("game_sessions").update({ status }).eq("id", id);
    loadData();
  };

  const closeSession = async (id: string) => {
    if (!confirm("Close this session? This will calculate scores and pay out prizes.")) return;
    const { error } = await sb.rpc("close_session", { p_session_id: id });
    if (error) alert(error.message);
    else loadData();
  };

  const filtered = tab === "all" ? sessions : sessions.filter((s) => s.status === tab);

  const statusBadgeStyle: Record<string, string> = {
    upcoming: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    active: "bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.25)] animate-pulse",
    closing: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    completed: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-xs font-semibold text-violet-300 mb-2">
            🎯 Game Operations
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Game Sessions</h1>
          <p className="text-slate-400 text-sm mt-1">
            Build game sessions, attach question rosters, and launch live runs.
          </p>
        </div>

        <button
          onClick={() => setShowCreate(!showCreate)}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-violet-600/20 transition-all duration-200 hover:scale-[1.02]"
        >
          <span>{showCreate ? "✕" : "🎮"}</span>
          <span>{showCreate ? "Close Drawer" : "Create Session"}</span>
        </button>
      </div>

      {/* Creation Drawer */}
      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="wimbf-glass rounded-3xl p-6 md:p-8 space-y-6 border border-violet-500/30 shadow-2xl animate-fade-in"
        >
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white">Create Game Session</h2>
              <p className="text-xs text-slate-400">Configure parameters and question roster</p>
            </div>
            <span className="px-3 py-1 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 text-xs font-semibold">
              Upcoming Status
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Session Name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-sm text-white placeholder:text-slate-500 focus:border-violet-500/50 focus:outline-none"
                placeholder="e.g., Friday Night Trivia Blitz #102"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Entry Fee (Coins)
              </label>
              <input
                type="number"
                value={entryFee}
                onChange={(e) => setEntryFee(+e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-sm text-white focus:border-violet-500/50 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Starts At
              </label>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                required
                className="w-full rounded-2xl border border-white/10 bg-[#0e121b] px-4 py-3.5 text-sm text-white focus:border-violet-500/50 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Ends At
              </label>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                required
                className="w-full rounded-2xl border border-white/10 bg-[#0e121b] px-4 py-3.5 text-sm text-white focus:border-violet-500/50 focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Prize Pool Amount (₦)
              </label>
              <input
                type="number"
                value={prizePool}
                onChange={(e) => setPrizePool(+e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-sm font-bold text-amber-400 focus:border-violet-500/50 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Attach Published Questions ({selectedQuestions.length} selected)
            </label>
            <div className="max-h-56 overflow-y-auto space-y-2 border border-white/10 rounded-2xl p-3 bg-white/[0.01]">
              {questions.length === 0 ? (
                <p className="text-xs text-slate-500 p-2">
                  No published questions found. Create and publish questions first.
                </p>
              ) : (
                questions.map((q) => {
                  const isChecked = selectedQuestions.includes(q.id);
                  return (
                    <label
                      key={q.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                        isChecked
                          ? "bg-violet-500/15 border-violet-500/40 text-white"
                          : "bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/5"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) =>
                          setSelectedQuestions(
                            e.target.checked
                              ? [...selectedQuestions, q.id]
                              : selectedQuestions.filter((id) => id !== q.id)
                          )
                        }
                        className="size-4 rounded border-white/20 text-violet-500 focus:ring-0 accent-violet-500"
                      />
                      <span className="text-sm font-medium flex-1 truncate">{q.title}</span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-400">
                        {q.category}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-white/5 flex gap-3">
            <button
              type="submit"
              disabled={creating}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-sm transition-all disabled:opacity-50"
            >
              {creating ? "Creating Session..." : "Save & Create Session"}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-6 py-3 rounded-2xl bg-white/5 text-slate-300 font-semibold text-sm transition-all"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Tabs */}
      <div className="wimbf-glass rounded-2xl p-2 inline-flex gap-1">
        {["all", "upcoming", "active", "completed"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all ${
              tab === t
                ? "bg-violet-500/20 text-violet-300 border border-violet-500/40 shadow-md shadow-violet-500/10"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Sessions List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="size-10 animate-spin rounded-full border-2 border-violet-500 border-t-transparent mb-3" />
          <p className="text-xs text-slate-400">Loading game sessions...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="wimbf-glass rounded-3xl p-12 text-center space-y-3">
          <span className="text-4xl">🎯</span>
          <h3 className="text-lg font-bold text-white">No Sessions Found</h3>
          <p className="text-xs text-slate-400">No sessions match the selected filter category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map((s) => (
            <div
              key={s.id}
              className="wimbf-glass wimbf-glass-hover rounded-3xl p-6 border border-white/5 space-y-5 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-bold text-base text-white leading-snug">{s.name}</h3>
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                      statusBadgeStyle[s.status] ?? "bg-slate-500/10 text-slate-400"
                    }`}
                  >
                    {s.status}
                  </span>
                </div>

                <div className="text-xs text-slate-400 flex flex-col space-y-1">
                  <span>
                    Starts:{" "}
                    <strong className="text-slate-200">
                      {new Date(s.starts_at).toLocaleString("en-NG", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </strong>
                  </span>
                  <span>
                    Ends:{" "}
                    <strong className="text-slate-200">
                      {new Date(s.ends_at).toLocaleString("en-NG", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </strong>
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-white/5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-xs">
                  <span className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 font-bold">
                    ₦{s.prize_pool.toLocaleString()}
                  </span>
                  <span className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 font-medium">
                    🪙 {s.entry_fee_coins} coins
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {s.status === "upcoming" && (
                    <button
                      onClick={() => updateStatus(s.id, "active")}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-md shadow-emerald-500/20"
                    >
                      Activate Now
                    </button>
                  )}
                  {s.status === "active" && (
                    <button
                      onClick={() => closeSession(s.id)}
                      className="px-3.5 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs transition-all shadow-md shadow-rose-500/20"
                    >
                      Close & Score
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
