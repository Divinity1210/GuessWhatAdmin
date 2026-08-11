"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@/lib/supabase-browser";

type Question = {
  id: string;
  title: string;
  category: string;
  type: string;
  status: string;
  tags: string[];
  created_at: string;
  question_options: { id: string; label: string; position: number }[];
};

const STATUSES = ["draft", "submitted", "review", "approved", "scheduled", "published", "archived"];
const CATEGORIES = ["General Knowledge", "Sports", "Entertainment", "Food", "Lifestyle", "Technology", "Culture"];

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [options, setOptions] = useState(["", "", "", ""]);
  const [creating, setCreating] = useState(false);

  const sb = createClientComponentClient();

  async function loadQuestions() {
    setLoading(true);
    let query = sb
      .from("questions")
      .select("*, question_options(id, label, position)")
      .order("created_at", { ascending: false })
      .limit(100);

    if (filter !== "all") query = query.eq("status", filter);
    const { data } = await query;
    setQuestions((data ?? []) as Question[]);
    setLoading(false);
  }

  useEffect(() => {
    loadQuestions();
  }, [filter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || options.filter((o) => o.trim()).length < 2) return;
    setCreating(true);

    const { data: q, error: qErr } = await sb
      .from("questions")
      .insert({ title: title.trim(), category, type: "text", status: "draft" })
      .select("id")
      .single();

    if (qErr) {
      alert(qErr.message);
      setCreating(false);
      return;
    }

    const validOptions = options.filter((o) => o.trim());
    const { error: oErr } = await sb.from("question_options").insert(
      validOptions.map((label, i) => ({
        question_id: q.id,
        label: label.trim(),
        position: i,
      }))
    );

    if (oErr) {
      alert(oErr.message);
      setCreating(false);
      return;
    }

    setTitle("");
    setOptions(["", "", "", ""]);
    setShowCreate(false);
    setCreating(false);
    loadQuestions();
  };

  const updateStatus = async (id: string, status: string) => {
    await sb.from("questions").update({ status }).eq("id", id);
    loadQuestions();
  };

  const statusBadgeStyle: Record<string, string> = {
    draft: "bg-slate-500/10 text-slate-300 border-slate-500/20",
    submitted: "bg-sky-500/10 text-sky-300 border-sky-500/20",
    review: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    approved: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20",
    scheduled: "bg-violet-500/10 text-violet-300 border-violet-500/20",
    published: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.15)]",
    archived: "bg-rose-500/10 text-rose-300 border-rose-500/20",
  };

  const filteredQuestions = questions.filter((q) =>
    search ? q.title.toLowerCase().includes(search.toLowerCase()) || q.category.toLowerCase().includes(search.toLowerCase()) : true
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-300 mb-2">
            🧠 Trivia Pool
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Question Bank</h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage, approve, and curate trivia questions for session rosters.
          </p>
        </div>

        <button
          onClick={() => setShowCreate(!showCreate)}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-amber-500/20 transition-all duration-200 hover:scale-[1.02]"
        >
          <span>{showCreate ? "✕" : "➕"}</span>
          <span>{showCreate ? "Close Drawer" : "Create Question"}</span>
        </button>
      </div>

      {/* Creation Drawer / Card */}
      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="wimbf-glass rounded-3xl p-6 md:p-8 space-y-6 border border-amber-500/30 shadow-2xl animate-fade-in"
        >
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white">Create New Question</h2>
              <p className="text-xs text-slate-400">Add a new trivia item to the database pool</p>
            </div>
            <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold">
              Draft Status
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Question Text
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-sm text-white placeholder:text-slate-500 focus:border-amber-500/50 focus:outline-none transition-colors"
                placeholder="e.g., Which African nation won the 2024 AFCON championship?"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-[#0e121b] px-4 py-3.5 text-sm text-white focus:border-amber-500/50 focus:outline-none transition-colors"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Options (Minimum 2 required)
              </label>
              <div className="space-y-3">
                {options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="size-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center font-bold text-xs text-amber-400">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <input
                      value={opt}
                      onChange={(e) => {
                        const n = [...options];
                        n[i] = e.target.value;
                        setOptions(n);
                      }}
                      className="flex-1 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-amber-500/50 focus:outline-none"
                      placeholder={`Option ${i + 1}`}
                    />
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setOptions([...options, ""])}
                className="mt-3 text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1"
              >
                <span>+ Add another option choice</span>
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-white/5 flex gap-3">
            <button
              type="submit"
              disabled={creating}
              className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-all disabled:opacity-50"
            >
              {creating ? "Saving..." : "Save Question"}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-sm transition-all"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Filter & Search Bar */}
      <div className="wimbf-glass rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="w-full md:w-auto flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
          {["all", ...STATUSES].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider whitespace-nowrap transition-all ${
                filter === s
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-md shadow-amber-500/10"
                  : "bg-white/[0.02] text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="w-full md:w-64 relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title/category..."
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:border-amber-500/50 focus:outline-none"
          />
        </div>
      </div>

      {/* Questions Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="size-10 animate-spin rounded-full border-2 border-amber-500 border-t-transparent mb-3" />
          <p className="text-xs text-slate-400">Loading trivia question bank...</p>
        </div>
      ) : filteredQuestions.length === 0 ? (
        <div className="wimbf-glass rounded-3xl p-12 text-center space-y-3">
          <span className="text-4xl">🧠</span>
          <h3 className="text-lg font-bold text-white">No Questions Found</h3>
          <p className="text-xs text-slate-400">No trivia items match the current status filter.</p>
        </div>
      ) : (
        <div className="wimbf-glass rounded-3xl overflow-hidden border border-white/5">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02] text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                  <th className="px-6 py-4">Question</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Options</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Update Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredQuestions.map((q) => (
                  <tr key={q.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 font-semibold text-white max-w-xs truncate">
                      {q.title}
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-300">
                      <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
                        {q.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400">
                      <span className="font-bold text-amber-400">
                        {q.question_options?.length ?? 0}
                      </span>{" "}
                      choices
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                          statusBadgeStyle[q.status] ?? "bg-slate-500/10 text-slate-400"
                        }`}
                      >
                        {q.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <select
                        value={q.status}
                        onChange={(e) => updateStatus(q.id, e.target.value)}
                        className="rounded-xl border border-white/10 bg-[#0e121b] text-xs font-semibold px-3 py-1.5 text-slate-200 focus:border-amber-500/50 focus:outline-none"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s.toUpperCase()}
                          </option>
                        ))}
                      </select>
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
