"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type AssignedQuestion = {
  position: number;
  question_id: string;
  title: string;
  category: string;
  type: string;
  option_count: number;
  guesses_count: number;
};

type PrizeTier = {
  rank_from: number;
  rank_to: number;
  amount: number;
};

type Session = {
  id: string;
  name: string;
  status: "upcoming" | "active" | "scoring" | "completed" | "cancelled";
  is_paused?: boolean;
  starts_at: string;
  ends_at: string;
  entry_fee_coins: number;
  prize_pool: number;
  prize_structure?: PrizeTier[];
  participating_players?: number;
  total_plays?: number;
  repeat_plays?: number;
  guesses_submitted?: number;
  assigned_questions?: AssignedQuestion[];
};

type Question = {
  id: string;
  title: string;
  category: string;
  type: string;
};

function formatCountdown(startsAt: string, endsAt: string, status: string, isPaused?: boolean): string {
  if (status === "completed") return "Completed";
  if (isPaused) return "Paused by Admin";
  const now = Date.now();
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();

  if (status === "upcoming" && start > now) {
    const diff = start - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hrs = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return `Starts in ${days}d ${String(hrs).padStart(2, "0")}h`;
  }

  const diff = end - now;
  if (diff <= 0) return "Window Ended (Ready to Score)";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hrs = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (days > 0) return `${days}d ${String(hrs).padStart(2, "0")}h remaining`;
  return `${hrs}h ${String(mins).padStart(2, "0")}m remaining`;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [publishedQuestions, setPublishedQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabFilter, setTabFilter] = useState<"all" | "active" | "upcoming" | "completed">("all");
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  // Create / Edit Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [name, setName] = useState("Weekend Crowd Challenge");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [entryFee, setEntryFee] = useState("0");
  const [prizePool, setPrizePool] = useState("500000");
  const [prizePreset, setPrizePreset] = useState<"36_winners" | "49_winners">("36_winners");
  const [initialStatus, setInitialStatus] = useState<"active" | "upcoming">("active");
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [busySessionId, setBusySessionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const showToastMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 5000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/sessions", { cache: "no-store" });
      const data = await res.json();
      setSessions((data.sessions as Session[]) ?? []);
      setPublishedQuestions((data.publishedQuestions as Question[]) ?? []);
    } catch {
      setError("Failed to load sessions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const now = new Date();
    const start = new Date(now.getTime() - 60 * 60 * 1000);
    const end = new Date(now.getTime() + 72 * 60 * 60 * 1000);
    setStartsAt(start.toISOString().slice(0, 16));
    setEndsAt(end.toISOString().slice(0, 16));
  }, [load]);

  function openCreateModal() {
    setEditingSessionId(null);
    setName(`Guess What Session #${sessions.length + 1}`);
    const now = new Date();
    const start = new Date(now.getTime());
    const end = new Date(now.getTime() + 72 * 60 * 60 * 1000);
    setStartsAt(start.toISOString().slice(0, 16));
    setEndsAt(end.toISOString().slice(0, 16));
    setEntryFee("0");
    setPrizePool("500000");
    setPrizePreset("36_winners");
    setInitialStatus("active");
    setSelectedQuestionIds(publishedQuestions.slice(0, 10).map((q) => q.id));
    setError("");
    setShowModal(true);
  }

  function openEditModal(s: Session) {
    setEditingSessionId(s.id);
    setName(s.name);
    setStartsAt(s.starts_at ? new Date(s.starts_at).toISOString().slice(0, 16) : "");
    setEndsAt(s.ends_at ? new Date(s.ends_at).toISOString().slice(0, 16) : "");
    setEntryFee(String(s.entry_fee_coins ?? 0));
    setPrizePool(String(s.prize_pool ?? 500000));
    const maxRank = Math.max(
      ...(s.prize_structure ?? []).map((t) => Number(t.rank_to ?? 0)),
      36
    );
    setPrizePreset(maxRank >= 49 ? "49_winners" : "36_winners");
    setInitialStatus(s.status === "upcoming" ? "upcoming" : "active");
    setSelectedQuestionIds(
      (s.assigned_questions ?? []).map((aq) => aq.question_id)
    );
    setError("");
    setShowModal(true);
  }

  function toggleQuestion(id: string) {
    setSelectedQuestionIds((prev) =>
      prev.includes(id) ? prev.filter((q) => q !== id) : [...prev, id]
    );
  }

  function autoPick10Questions() {
    setSelectedQuestionIds(publishedQuestions.slice(0, 10).map((q) => q.id));
  }

  async function handleSaveSession(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim() || !startsAt || !endsAt) {
      setError("Session name, start date/time, and end date/time are required.");
      return;
    }
    if (selectedQuestionIds.length < 1) {
      setError("Please select questions for this session (standard is 10 questions).");
      return;
    }

    setSaving(true);
    try {
      if (editingSessionId) {
        const res = await fetch("/api/admin/sessions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingSessionId,
            action: "edit_session",
            name: name.trim(),
            startsAt,
            endsAt,
            entryFee: Number(entryFee),
            prizePool: Number(prizePool),
            prizePreset,
            status: initialStatus,
            selectedQuestionIds,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to update session.");
          setSaving(false);
          return;
        }
        showToastMsg(`Session "${name}" updated with ${selectedQuestionIds.length} questions!`);
      } else {
        const res = await fetch("/api/admin/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            startsAt,
            endsAt,
            entryFee: Number(entryFee),
            prizePool: Number(prizePool),
            prizePreset,
            status: initialStatus,
            selectedQuestionIds,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to create session.");
          setSaving(false);
          return;
        }
        showToastMsg(`Session "${name}" created with ${selectedQuestionIds.length} questions!`);
      }

      setShowModal(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save session.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSessionAction(id: string, action: "start" | "pause" | "resume" | "close_and_score") {
    setBusySessionId(id);
    setError("");
    try {
      const res = await fetch("/api/admin/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to perform session action.");
      } else {
        if (action === "close_and_score") {
          showToastMsg("Session ended, consensus points (10–1) calculated, and final leaderboard & winners published!");
        } else if (action === "pause") {
          showToastMsg("Session paused.");
        } else {
          showToastMsg("Session is now live and accepting player guesses!");
        }
      }
      await load();
    } finally {
      setBusySessionId(null);
    }
  }

  const filteredSessions = sessions.filter((s) => {
    if (tabFilter === "all") return true;
    if (tabFilter === "active") return s.status === "active";
    if (tabFilter === "upcoming") return s.status === "upcoming";
    if (tabFilter === "completed") return s.status === "completed";
    return true;
  });

  const activeCount = sessions.filter((s) => s.status === "active").length;
  const upcomingCount = sessions.filter((s) => s.status === "upcoming").length;
  const completedCount = sessions.filter((s) => s.status === "completed").length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-xs font-semibold text-indigo-300 mb-2">
            Page 37 · Game Session Management
          </span>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Game Sessions &amp; 10-Question Assignments
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Create, edit, start, pause, and end 3-day game sessions, assign 10 crowd questions, and publish final consensus scores.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-all shrink-0"
        >
          <span>+ Create New Game Session</span>
        </button>
      </div>

      {toast && (
        <div className="rounded-2xl px-4 py-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
          ✓ {toast}
        </div>
      )}

      {error && (
        <div className="rounded-2xl px-4 py-3 bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold">
          ⚠ {error}
        </div>
      )}

      {/* Session-to-Session Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0f1219] p-4 rounded-2xl border border-white/10">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: "all", label: `All Sessions (${sessions.length})` },
              { id: "active", label: `Active / Ongoing (${activeCount})` },
              { id: "upcoming", label: `Scheduled / Paused (${upcomingCount})` },
              { id: "completed", label: `Completed (${completedCount})` },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTabFilter(t.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                tabFilter === t.id
                  ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20"
                  : "bg-white/[0.03] text-slate-300 hover:bg-white/[0.08] border border-white/5"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <Link
          href="/admin/questions"
          className="text-xs font-bold text-amber-400 hover:text-amber-300"
        >
          Inspect Question Bank ({publishedQuestions.length} Published) →
        </Link>
      </div>

      {/* Sessions Cards / Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="size-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent mb-3" />
          <p className="text-xs text-slate-400">Loading game sessions...</p>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="rounded-3xl p-12 bg-[#0f1219] border border-white/10 text-center space-y-3">
          <p className="text-base font-bold text-white">No sessions match this filter</p>
          <p className="text-xs text-slate-400">
            Click &ldquo;+ Create New Game Session&rdquo; above to schedule or launch a 10-question session.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSessions.map((s) => {
            const qList = s.assigned_questions ?? [];
            const isExpanded = expandedSessionId === s.id;
            const countdown = formatCountdown(s.starts_at, s.ends_at, s.status, s.is_paused);
            const busy = busySessionId === s.id;

            return (
              <div
                key={s.id}
                className="rounded-3xl p-6 bg-[#0f1219] border border-white/10 hover:border-white/20 transition-all space-y-5"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase tracking-wider ${
                          s.status === "active"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                            : s.status === "completed"
                            ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40"
                            : s.is_paused
                            ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                            : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        }`}
                      >
                        {s.is_paused && s.status === "upcoming" ? "PAUSED" : s.status}
                      </span>
                      <span className="px-3 py-0.5 rounded-full bg-white/5 border border-white/10 text-xs font-mono font-bold text-amber-300">
                        ⏱ {countdown}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(s.starts_at).toLocaleString("en-NG", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}{" "}
                        →{" "}
                        {new Date(s.ends_at).toLocaleString("en-NG", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>
                    <h2 className="text-xl font-black text-white">{s.name}</h2>
                  </div>

                  {/* Session Lifecycle Controls (Start, Pause/Resume, End & Publish, Edit) */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => openEditModal(s)}
                      className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-200"
                    >
                      ✎ Edit Session
                    </button>

                    {s.status === "upcoming" && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          handleSessionAction(s.id, s.is_paused ? "resume" : "start")
                        }
                        className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold"
                      >
                        ▶ {s.is_paused ? "Resume Session" : "Start Session Live"}
                      </button>
                    )}

                    {s.status === "active" && (
                      <>
                        <button
                          disabled={busy}
                          onClick={() => handleSessionAction(s.id, "pause")}
                          className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold"
                        >
                          ⏸ Pause Session
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => handleSessionAction(s.id, "close_and_score")}
                          className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-extrabold shadow-lg shadow-indigo-500/25"
                        >
                          {busy ? "Scoring..." : "✓ End & Publish Session Results"}
                        </button>
                      </>
                    )}

                    {s.status === "completed" && (
                      <button
                        disabled={busy}
                        onClick={() => handleSessionAction(s.id, "close_and_score")}
                        className="px-3.5 py-2 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 text-xs font-bold"
                      >
                        ↻ Recalculate Scores
                      </button>
                    )}
                  </div>
                </div>

                {/* Key Session Metrics Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="rounded-2xl p-3.5 bg-white/[0.02] border border-white/5">
                    <p className="text-[11px] font-semibold text-slate-400">Prize Pool</p>
                    <p className="text-lg font-black text-amber-400 mt-0.5">
                      ₦{Number(s.prize_pool ?? 0).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {s.entry_fee_coins > 0 ? `${s.entry_fee_coins} Coins` : "Free Entry (0 Coins)"}
                    </p>
                  </div>

                  <div className="rounded-2xl p-3.5 bg-white/[0.02] border border-white/5">
                    <p className="text-[11px] font-semibold text-slate-400">
                      Participating Players
                    </p>
                    <p className="text-lg font-black text-white mt-0.5">
                      {(s.participating_players ?? 0).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {s.total_plays ?? 0} total plays ({s.repeat_plays ?? 0} replays)
                    </p>
                  </div>

                  <div className="rounded-2xl p-3.5 bg-white/[0.02] border border-white/5">
                    <p className="text-[11px] font-semibold text-slate-400">
                      Guesses Submitted
                    </p>
                    <p className="text-lg font-black text-emerald-400 mt-0.5">
                      {(s.guesses_submitted ?? 0).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Live answers recorded in session
                    </p>
                  </div>

                  <div className="rounded-2xl p-3.5 bg-white/[0.02] border border-white/5 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold text-slate-400">
                        Assigned Questions
                      </p>
                      <button
                        onClick={() =>
                          setExpandedSessionId(isExpanded ? null : s.id)
                        }
                        className="text-[11px] font-bold text-indigo-300 hover:text-indigo-200"
                      >
                        {isExpanded ? "Hide ▲" : "Preview 10 Qs ▼"}
                      </button>
                    </div>
                    <p className="text-lg font-black text-indigo-300 mt-0.5">
                      {qList.length} questions
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Standard 10-question session set
                    </p>
                  </div>
                </div>

                {/* Expandable 10 Assigned Questions Preview */}
                {isExpanded && (
                  <div className="rounded-2xl p-4 bg-white/[0.02] border border-indigo-500/25 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                        Assigned Questions in {s.name} ({qList.length})
                      </h3>
                      <Link
                        href="/admin/questions"
                        className="text-xs font-semibold text-amber-400 hover:underline"
                      >
                        Open in Question Bank →
                      </Link>
                    </div>
                    {qList.length === 0 ? (
                      <p className="text-xs text-slate-400">
                        No questions assigned yet. Click &ldquo;Edit Session&rdquo; to assign 10 questions.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {qList.map((aq) => (
                          <div
                            key={`${s.id}_${aq.question_id}_${aq.position}`}
                            className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#0b0e14] border border-white/5 text-xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-black shrink-0">
                                Q{aq.position}
                              </span>
                              <span className="text-white font-semibold truncate">
                                {aq.title}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="px-2 py-0.5 rounded bg-white/5 text-slate-300 text-[10px]">
                                {aq.category}
                              </span>
                              <span className="font-mono text-[11px] text-emerald-400">
                                {aq.guesses_count} picks
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Direct Cross-Module Action Links (Inspect Gameplay, View Leaderboard, Manage Winners) */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/gameplay?sessionId=${s.id}`}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold transition-colors"
                    >
                      Inspect Gameplay ↗
                    </Link>
                    <Link
                      href={`/admin/leaderboards?sessionId=${s.id}`}
                      className="px-3.5 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 text-xs font-bold transition-colors"
                    >
                      View Leaderboard ↗
                    </Link>
                    <Link
                      href={`/admin/winners?sessionId=${s.id}`}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition-colors"
                    >
                      Manage Winners &amp; Prizes ↗
                    </Link>
                  </div>
                  <button
                    onClick={() => setExpandedSessionId(isExpanded ? null : s.id)}
                    className="text-xs font-semibold text-slate-400 hover:text-white"
                  >
                    {isExpanded ? "Collapse Questions ▲" : `Inspect ${qList.length} Assigned Questions ▼`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Session Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-3xl bg-[#0f1219] border border-amber-500/30 p-6 md:p-8 space-y-6 max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h2 className="text-xl font-extrabold text-white">
                  {editingSessionId ? "Edit Game Session Details" : "Create New Game Session"}
                </h2>
                <p className="text-xs text-slate-400">
                  Configure session schedule, ₦500,000 prize pool preset (36 or 49 winners), and assign the 10 session questions.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300"
              >
                ✕ Close
              </button>
            </div>

            <form onSubmit={handleSaveSession} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Session Name *
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white"
                    placeholder="e.g., Weekend Crowd Challenge"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Prize Pool (₦) *
                  </label>
                  <input
                    type="number"
                    value={prizePool}
                    onChange={(e) => setPrizePool(e.target.value)}
                    required
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-amber-300 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Start Date &amp; Time *
                  </label>
                  <input
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    required
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    End Date &amp; Time (72h Window) *
                  </label>
                  <input
                    type="datetime-local"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    required
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Session Status
                  </label>
                  <select
                    value={initialStatus}
                    onChange={(e) => setInitialStatus(e.target.value as "active" | "upcoming")}
                    className="w-full rounded-xl border border-white/10 bg-[#0e121b] px-3 py-2.5 text-xs font-bold text-white"
                  >
                    <option value="active">Active (Live Immediately)</option>
                    <option value="upcoming">Upcoming (Scheduled)</option>
                  </select>
                </div>
              </div>

              {/* Prize Distribution Preset (Page 20: 36 Winners vs 49 Winners) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPrizePreset("36_winners");
                    setPrizePool("500000");
                  }}
                  className={`p-3.5 rounded-2xl border text-left transition-all ${
                    prizePreset === "36_winners"
                      ? "bg-amber-500/15 border-amber-500 text-white"
                      : "bg-white/[0.02] border-white/10 text-slate-300"
                  }`}
                >
                  <p className="text-xs font-extrabold text-amber-400">
                    Preset A: 36 Winners / ₦500,000 (Page 20 Left)
                  </p>
                  <p className="text-[11px] text-slate-300 mt-1">
                    1st: ₦100k · 2nd: ₦50k · 3rd: ₦20k · 4th–36th: ₦10k each
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPrizePreset("49_winners");
                    setPrizePool("500000");
                  }}
                  className={`p-3.5 rounded-2xl border text-left transition-all ${
                    prizePreset === "49_winners"
                      ? "bg-emerald-500/15 border-emerald-500 text-white"
                      : "bg-white/[0.02] border-white/10 text-slate-300"
                  }`}
                >
                  <p className="text-xs font-extrabold text-emerald-400">
                    Preset B: 49 Winners / ₦500,000 (Page 20 Right)
                  </p>
                  <p className="text-[11px] text-slate-300 mt-1">
                    1st: ₦100k · 2nd: ₦50k · 3rd: ₦20k · 4th–23rd: ₦10k · 24th–49th: ₦5k
                  </p>
                </button>
              </div>

              {/* Standard 10 Questions Picker */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Select Standard 10 Questions ({selectedQuestionIds.length} / 10 selected) *
                  </label>
                  <button
                    type="button"
                    onClick={autoPick10Questions}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold"
                  >
                    ✦ Auto-Select 10 Questions
                  </button>
                </div>

                <div className="max-h-60 overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0d14] p-2.5 space-y-1.5">
                  {publishedQuestions.map((q) => {
                    const idx = selectedQuestionIds.indexOf(q.id);
                    const selected = idx !== -1;
                    return (
                      <div
                        key={q.id}
                        onClick={() => toggleQuestion(q.id)}
                        className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl cursor-pointer text-xs transition-colors ${
                          selected
                            ? "bg-indigo-500/20 border border-indigo-500/40 text-white"
                            : "hover:bg-white/[0.04] text-slate-300 border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`size-6 rounded-lg flex items-center justify-center font-black text-[11px] shrink-0 ${
                              selected
                                ? "bg-amber-500 text-slate-950"
                                : "bg-white/5 text-slate-500"
                            }`}
                          >
                            {selected ? `Q${idx + 1}` : "+"}
                          </span>
                          <span className="truncate font-semibold">{q.title}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-white/5 text-[10px] text-slate-400 shrink-0">
                          {q.category}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold"
                >
                  {saving
                    ? "Saving..."
                    : editingSessionId
                    ? "Save Session Changes"
                    : "Create Session"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
