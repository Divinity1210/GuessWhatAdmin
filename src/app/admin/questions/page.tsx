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
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [options, setOptions] = useState(["", "", "", ""]);
  const [creating, setCreating] = useState(false);

  const sb = createClientComponentClient();

  async function loadQuestions() {
    setLoading(true);
    let query = sb.from("questions").select("*, question_options(id, label, position)").order("created_at", { ascending: false }).limit(100);
    if (filter !== "all") query = query.eq("status", filter);
    const { data } = await query;
    setQuestions((data ?? []) as Question[]);
    setLoading(false);
  }

  useEffect(() => { loadQuestions(); }, [filter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || options.filter((o) => o.trim()).length < 2) return;
    setCreating(true);

    const { data: q, error: qErr } = await sb
      .from("questions")
      .insert({ title: title.trim(), category, type: "text", status: "draft" })
      .select("id")
      .single();

    if (qErr) { alert(qErr.message); setCreating(false); return; }

    const validOptions = options.filter((o) => o.trim());
    const { error: oErr } = await sb.from("question_options").insert(
      validOptions.map((label, i) => ({ question_id: q.id, label: label.trim(), position: i })),
    );

    if (oErr) { alert(oErr.message); setCreating(false); return; }

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

  const statusColor: Record<string, string> = {
    draft: "bg-gray-700 text-gray-300",
    submitted: "bg-blue-900 text-blue-300",
    review: "bg-yellow-900 text-yellow-300",
    approved: "bg-green-900 text-green-300",
    scheduled: "bg-purple-900 text-purple-300",
    published: "bg-orange-900 text-orange-300",
    archived: "bg-gray-800 text-gray-500",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Questions</h1>
          <p className="text-gray-500 mt-1">{questions.length} questions</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors"
        >
          {showCreate ? "Cancel" : "➕ New Question"}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="rounded-xl border border-gray-800 bg-gray-900 p-6 space-y-4">
          <h2 className="text-lg font-semibold">Create Question</h2>
          <div>
            <label className="block text-xs text-gray-500 uppercase mb-1.5">Question</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm focus:border-orange-500 focus:outline-none" placeholder="e.g., Which country will be chosen the most?" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 uppercase mb-1.5">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm focus:border-orange-500 focus:outline-none">
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 uppercase mb-1.5">Options (min 2)</label>
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-600 w-6">{String.fromCharCode(65 + i)}</span>
                <input value={opt} onChange={(e) => { const n = [...options]; n[i] = e.target.value; setOptions(n); }}
                  className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" placeholder={`Option ${i + 1}`} />
              </div>
            ))}
            <button type="button" onClick={() => setOptions([...options, ""])} className="text-xs text-orange-400 hover:text-orange-300">+ Add option</button>
          </div>
          <button type="submit" disabled={creating} className="rounded-lg bg-orange-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50">
            {creating ? "Creating..." : "Create Question"}
          </button>
        </form>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {["all", ...STATUSES].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
              filter === s ? "bg-orange-500/15 text-orange-400" : "bg-gray-800 text-gray-400 hover:text-gray-200"
            }`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Questions table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="size-6 animate-spin rounded-full border-2 border-orange-400 border-t-transparent" />
        </div>
      ) : questions.length === 0 ? (
        <p className="text-center text-gray-500 py-12">No questions found.</p>
      ) : (
        <div className="rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900 text-xs text-gray-500 uppercase">
                <th className="text-left px-4 py-3">Question</th>
                <th className="text-left px-4 py-3">Category</th>
                <th className="text-left px-4 py-3">Options</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {questions.map((q) => (
                <tr key={q.id} className="hover:bg-gray-900/50">
                  <td className="px-4 py-3 max-w-xs truncate">{q.title}</td>
                  <td className="px-4 py-3 text-gray-400">{q.category}</td>
                  <td className="px-4 py-3 text-gray-400">{q.question_options?.length ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-md ${statusColor[q.status] ?? ""}`}>{q.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <select
                      value={q.status}
                      onChange={(e) => updateStatus(q.id, e.target.value)}
                      className="rounded border border-gray-700 bg-gray-800 text-xs px-2 py-1 focus:outline-none"
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
