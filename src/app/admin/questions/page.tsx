"use client";

import { useEffect, useState } from "react";

type QuestionOption = {
  id: string;
  label: string;
  media_url?: string | null;
  position: number;
  guesses?: number;
  points?: number;
};

type Question = {
  id: string;
  title: string;
  category: string;
  type: "text" | "number" | "color" | "image";
  status: string;
  tags: string[];
  created_at: string;
  total_guesses?: number;
  question_options: QuestionOption[];
};

const STATUSES = ["draft", "published", "archived"];
const CATEGORIES = [
  "Family Role",
  "Hangout",
  "Colour",
  "Number",
  "Food",
  "Cars",
  "Country to Visit",
  "Romantic Gesture",
  "Snacks",
  "Social Media",
  "Drinks",
  "Fruits",
  "Protein",
  "Lifestyle",
];

const DEFAULT_COLOR_OPTIONS = [
  { label: "Blue", media_url: "#0018F9" },
  { label: "Red", media_url: "#FF1100" },
  { label: "Yellow", media_url: "#FFE600" },
  { label: "Purple", media_url: "#9E00FF" },
  { label: "Green", media_url: "#05FF00" },
  { label: "Sky Blue", media_url: "#00F0FF" },
  { label: "Light Green", media_url: "#ADFF00" },
  { label: "Black", media_url: "#050505" },
  { label: "White", media_url: "#FFFFFF" },
  { label: "Pink", media_url: "#FF00C7" },
];

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);

  // Create form state (10 options per Product Doc)
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [qType, setQType] = useState<"text" | "number" | "color" | "image">("text");
  const [options, setOptions] = useState<{ label: string; media_url: string }[]>(
    Array.from({ length: 10 }, () => ({ label: "", media_url: "" }))
  );
  const [creating, setCreating] = useState(false);

  async function loadQuestions() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/questions", { cache: "no-store" });
      const data = await res.json();
      const list = (data.questions ?? []) as Question[];
      setQuestions(list);
      if (!selectedQuestionId && list.length > 0) {
        setSelectedQuestionId(list[0].id);
      }
    } catch (err) {
      console.error("Failed to load questions:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQuestions();
  }, []);

  const handleTypeChange = (nextType: "text" | "number" | "color" | "image") => {
    setQType(nextType);
    if (nextType === "number") {
      setOptions(
        ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map((n) => ({
          label: n,
          media_url: "",
        }))
      );
    } else if (nextType === "color") {
      setOptions(DEFAULT_COLOR_OPTIONS.map((c) => ({ ...c })));
    } else {
      setOptions(Array.from({ length: 10 }, () => ({ label: "", media_url: "" })));
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const validOpts = options.filter((o) => o.label.trim());
    if (!title.trim() || validOpts.length < 2) return;
    setCreating(true);

    try {
      const res = await fetch("/api/admin/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          category,
          type: qType,
          status: "published",
          options: validOpts,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to create question");
      } else {
        setTitle("");
        setOptions(Array.from({ length: 10 }, () => ({ label: "", media_url: "" })));
        setShowCreate(false);
        await loadQuestions();
      }
    } finally {
      setCreating(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    await fetch("/api/admin/questions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    await loadQuestions();
  };

  const filteredQuestions = questions.filter((q) => {
    if (filter !== "all" && q.status !== filter) return false;
    if (search) {
      return (
        q.title.toLowerCase().includes(search.toLowerCase()) ||
        q.category.toLowerCase().includes(search.toLowerCase())
      );
    }
    return true;
  });

  const selectedQuestion =
    questions.find((q) => q.id === selectedQuestionId) ?? filteredQuestions[0] ?? null;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-300 mb-2">
            Question Bank &amp; Live Crowd Chart
          </span>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Questions &amp; Real-Time Points
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Create 10-option questions (Text, Number, Colour, Image) and inspect real-time guesses &amp; ascribed points (10 down to 1).
          </p>
        </div>

        <button
          onClick={() => setShowCreate(!showCreate)}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-all"
        >
          <span>{showCreate ? "Close Creator" : "+ Create 10-Option Question"}</span>
        </button>
      </div>

      {/* Create Question Form */}
      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="wimbf-glass rounded-3xl p-6 md:p-8 space-y-6 border border-amber-500/30 shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white">Create 10-Option Question</h2>
              <p className="text-xs text-slate-400">
                Supports Text, Number (0–9), Colour (Hex circles), and Image (Medium photos)
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Question Prompt
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white focus:border-amber-500 focus:outline-none"
                placeholder="e.g., Select a hangout spot that you think other players will select"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Format
                </label>
                <select
                  value={qType}
                  onChange={(e) =>
                    handleTypeChange(e.target.value as "text" | "number" | "color" | "image")
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#0e121b] px-3 py-3 text-sm text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="text">Text (10 words)</option>
                  <option value="number">Number (0–9)</option>
                  <option value="color">Colour (10 circles)</option>
                  <option value="image">Image (10 photos)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#0e121b] px-3 py-3 text-sm text-white focus:border-amber-500 focus:outline-none"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              10 Options {qType === "color" ? "(Label + Hex Code)" : qType === "image" ? "(Label + Image URL)" : ""}
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="size-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-bold text-xs text-amber-400 shrink-0">
                    {i + 1}
                  </span>
                  <input
                    value={opt.label}
                    onChange={(e) => {
                      const next = [...options];
                      next[i] = { ...next[i], label: e.target.value };
                      setOptions(next);
                    }}
                    placeholder={`Option ${i + 1} label`}
                    className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none"
                  />
                  {(qType === "color" || qType === "image") && (
                    <input
                      value={opt.media_url}
                      onChange={(e) => {
                        const next = [...options];
                        next[i] = { ...next[i], media_url: e.target.value };
                        setOptions(next);
                      }}
                      placeholder={qType === "color" ? "#FF1100" : "https://..."}
                      className="w-36 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 flex gap-3">
            <button
              type="submit"
              disabled={creating}
              className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm"
            >
              {creating ? "Saving..." : "Publish Question"}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Real-Time Guesses & Ascribed Points Chart (Product Document Page 32) */}
      {selectedQuestion && (
        <div className="wimbf-glass rounded-3xl p-6 md:p-8 border border-white/10 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold uppercase">
                  {selectedQuestion.category}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-slate-300 text-xs font-semibold uppercase">
                  Format: {selectedQuestion.type}
                </span>
              </div>
              <h2 className="text-xl font-black text-white mt-2">
                {selectedQuestion.title}
              </h2>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider text-slate-400">Total Guesses</p>
              <p className="text-2xl font-black text-amber-400">
                {(selectedQuestion.total_guesses ?? 0).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Horizontal Bar Chart of 10 Options with Live Points (10 pts down to 1 pt) */}
          <div className="space-y-3">
            {(() => {
              const opts = selectedQuestion.question_options ?? [];
              const maxGuesses = Math.max(...opts.map((o) => o.guesses ?? 0), 1);

              return opts.map((opt) => {
                const guesses = opt.guesses ?? 0;
                const pts = opt.points ?? 1;
                const widthPct = Math.max(Math.round((guesses / maxGuesses) * 100), 4);
                const isTop = pts === 10;
                const isBottom = pts === 1;

                return (
                  <div key={opt.id} className="grid grid-cols-12 items-center gap-3 text-sm">
                    <div className="col-span-3 sm:col-span-2 flex items-center gap-2 truncate font-semibold text-slate-200">
                      {selectedQuestion.type === "color" && opt.media_url && (
                        <span
                          className="size-3.5 rounded-full shrink-0 border border-white/20"
                          style={{ backgroundColor: opt.media_url }}
                        />
                      )}
                      <span className="truncate">{opt.label}</span>
                    </div>

                    <div className="col-span-6 sm:col-span-7 flex items-center gap-3">
                      <div className="flex-1 h-6 rounded-lg bg-white/5 overflow-hidden flex items-center">
                        <div
                          className={`h-full transition-all duration-300 ${
                            isTop
                              ? "bg-emerald-500"
                              : isBottom
                              ? "bg-[#F7911B]"
                              : "bg-sky-500/80"
                          }`}
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                      <span className="w-12 text-right font-mono text-xs text-slate-300">
                        {guesses.toLocaleString()}
                      </span>
                    </div>

                    <div className="col-span-3 text-right">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-lg text-xs font-black ${
                          isTop
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : isBottom
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-white/5 text-slate-300"
                        }`}
                      >
                        - {pts} {pts === 1 ? "point" : "points"}
                      </span>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="wimbf-glass rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="w-full md:w-auto flex items-center gap-2 overflow-x-auto">
          {["all", ...STATUSES].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider ${
                filter === s
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "bg-white/[0.02] text-slate-400 hover:text-slate-200"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="w-full md:w-64">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions..."
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Questions Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="size-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent mb-3" />
          <p className="text-xs text-slate-400">Loading question bank...</p>
        </div>
      ) : (
        <div className="wimbf-glass rounded-3xl overflow-hidden border border-white/5">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02] text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                  <th className="px-6 py-4">Question</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Format</th>
                  <th className="px-6 py-4">Options</th>
                  <th className="px-6 py-4">Total Guesses</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredQuestions.map((q) => {
                  const isSelected = selectedQuestion?.id === q.id;
                  return (
                    <tr
                      key={q.id}
                      onClick={() => setSelectedQuestionId(q.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? "bg-amber-500/10" : "hover:bg-white/[0.02]"
                      }`}
                    >
                      <td className="px-6 py-4 font-semibold text-white max-w-md truncate">
                        {q.title}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-300">{q.category}</td>
                      <td className="px-6 py-4 text-xs uppercase font-bold text-amber-400">
                        {q.type}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-300">
                        {q.question_options?.length ?? 0} options
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-emerald-400">
                        {(q.total_guesses ?? 0).toLocaleString()}
                      </td>
                      <td
                        className="px-6 py-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <select
                          value={q.status}
                          onChange={(e) => updateStatus(q.id, e.target.value)}
                          className="rounded-xl border border-white/10 bg-[#0e121b] text-xs font-semibold px-3 py-1.5 text-slate-200"
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s.toUpperCase()}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
