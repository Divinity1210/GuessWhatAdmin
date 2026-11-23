"use client";

import { useEffect, useState, useMemo } from "react";
import {
  MessageSquare,
  Send,
  CheckCircle2,
  Search,
  RotateCcw,
  Sparkles,
  Check,
  Clock,
  HelpCircle,
  BookOpen,
  Plus,
  Trash2,
} from "lucide-react";

type KnowledgeEntry = {
  id: string;
  title: string;
  category: string;
  keywords: string[];
  sampleQuestions: string[];
  answer: string;
  ctaLabel?: string;
  ctaHref?: string;
  active: boolean;
  updatedAt: string;
};

type TicketMessage = {
  id: number;
  sender_id: string | null;
  body: string;
  is_internal: boolean;
  created_at: string;
  profiles?: { username: string; role: string } | null;
};

type Ticket = {
  id: string;
  user_id: string;
  subject: string;
  category: string | null;
  status: "open" | "pending" | "resolved" | "closed";
  created_at: string;
  updated_at?: string;
  profiles?: {
    id: string;
    username: string;
    full_name: string | null;
    phone: string | null;
    state: string | null;
  } | null;
  ticket_messages?: TicketMessage[];
};

const QUICK_REPLIES = [
  {
    label: "Acknowledge & Investigating",
    text: "Hello! Thank you for contacting the GuessWhat Support Desk. Our operations team is reviewing your account details and will update you shortly.",
  },
  {
    label: "Explain Consensus Points (10–1)",
    text: "In GuessWhat, points are assigned dynamically based on crowd selections: the most selected option earns 10 points, 2nd earns 9 points, down to 1 point for the least selected option.",
  },
  {
    label: "Prize Payout & Bank Verification",
    text: "Your cash prize payout is being processed! Please ensure your 10-digit Nigerian bank account (NUBAN) and bank name are saved accurately in your Player Profile.",
  },
  {
    label: "Thank Player for Gameplay Feedback",
    text: "Thank you for sharing your gameplay feedback! We have forwarded your suggestion to our Game Operations team for upcoming 72-hour sessions.",
  },
];

function isFeedbackCategory(cat: string | null, subject?: string | null): boolean {
  const c = `${cat || ""} ${subject || ""}`.toLowerCase();
  return c.includes("feedback") || c.includes("suggestion") || c.includes("gameplay");
}

export default function SupportPage() {
  const [activeTab, setActiveTab] = useState<"tickets" | "knowledge">("tickets");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "open" | "pending" | "resolved" | "closed"
  >("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "support" | "feedback">("all");
  const [search, setSearch] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState("");

  // AI FAQ Knowledge Bank state
  const [kbEntries, setKbEntries] = useState<KnowledgeEntry[]>([]);
  const [kbLoading, setKbLoading] = useState(false);
  const [kbEditingId, setKbEditingId] = useState<string | null>(null);
  const [kbTitle, setKbTitle] = useState("");
  const [kbCategory, setKbCategory] = useState("Gameplay & Scoring");
  const [kbKeywords, setKbKeywords] = useState("");
  const [kbSamples, setKbSamples] = useState("");
  const [kbAnswer, setKbAnswer] = useState("");
  const [kbCtaLabel, setKbCtaLabel] = useState("");
  const [kbCtaHref, setKbCtaHref] = useState("");
  const [kbSaving, setKbSaving] = useState(false);

  async function loadKnowledgeBank() {
    setKbLoading(true);
    try {
      const res = await fetch("/api/admin/knowledge-bank", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setKbEntries((data.entries as KnowledgeEntry[]) ?? []);
      }
    } finally {
      setKbLoading(false);
    }
  }

  async function loadTickets() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/support", { cache: "no-store" });
      const data = await res.json();
      const list = (data.tickets as Ticket[]) ?? [];
      setTickets(list);
      if (!selectedId && list.length > 0) {
        setSelectedId(list[0].id);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTickets();
    loadKnowledgeBank();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetKbForm = () => {
    setKbEditingId(null);
    setKbTitle("");
    setKbCategory("Gameplay & Scoring");
    setKbKeywords("");
    setKbSamples("");
    setKbAnswer("");
    setKbCtaLabel("");
    setKbCtaHref("");
  };

  async function handleSaveKbEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!kbTitle.trim() || !kbAnswer.trim()) return;
    setKbSaving(true);
    try {
      const method = kbEditingId ? "PATCH" : "POST";
      const res = await fetch("/api/admin/knowledge-bank", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: kbEditingId || undefined,
          title: kbTitle.trim(),
          category: kbCategory.trim() || "General",
          keywords: kbKeywords,
          sampleQuestions: kbSamples,
          answer: kbAnswer.trim(),
          ctaLabel: kbCtaLabel.trim() || undefined,
          ctaHref: kbCtaHref.trim() || undefined,
          active: true,
        }),
      });
      if (res.ok) {
        setToast(
          kbEditingId
            ? "AI Knowledge Bank entry updated live."
            : "New AI Knowledge Bank entry published live to Player FAQ Assistant!",
        );
        setTimeout(() => setToast(""), 4000);
        resetKbForm();
        await loadKnowledgeBank();
      }
    } finally {
      setKbSaving(false);
    }
  }

  async function handleToggleKbEntry(entry: KnowledgeEntry) {
    await fetch("/api/admin/knowledge-bank", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: entry.id, active: !entry.active }),
    });
    await loadKnowledgeBank();
  }

  async function handleDeleteKbEntry(id: string) {
    await fetch(`/api/admin/knowledge-bank?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (kbEditingId === id) resetKbForm();
    setToast("Knowledge entry removed.");
    setTimeout(() => setToast(""), 3000);
    await loadKnowledgeBank();
  }

  const filteredTickets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (categoryFilter === "feedback" && !isFeedbackCategory(t.category, t.subject)) return false;
      if (categoryFilter === "support" && isFeedbackCategory(t.category, t.subject)) return false;

      if (q) {
        const hay = [
          t.subject,
          t.category,
          t.profiles?.username,
          t.profiles?.full_name,
          ...(t.ticket_messages ?? []).map((m) => m.body),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [tickets, statusFilter, categoryFilter, search]);

  const selectedTicket = useMemo(
    () => tickets.find((t) => t.id === selectedId) ?? filteredTickets[0] ?? null,
    [tickets, selectedId, filteredTickets]
  );

  async function handleStatusChange(ticketId: string, status: Ticket["status"]) {
    await fetch("/api/admin/support", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId, status }),
    });
    setToast(`Ticket marked as ${status.toUpperCase()}.`);
    setTimeout(() => setToast(""), 3500);
    await loadTickets();
  }

  async function handleReply(e: React.FormEvent, markResolved = false) {
    e.preventDefault();
    if (!selectedTicket || !replyBody.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/admin/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: selectedTicket.id,
          body: replyBody.trim(),
          status: markResolved ? "resolved" : "pending",
        }),
      });
      if (res.ok) {
        setReplyBody("");
        setToast(
          `Reply sent to @${
            selectedTicket.profiles?.username || "player"
          } and delivered to their Player App Inbox!`
        );
        setTimeout(() => setToast(""), 4000);
        await loadTickets();
      }
    } finally {
      setSending(false);
    }
  }

  const openCount = tickets.filter((t) => t.status === "open").length;
  const pendingCount = tickets.filter((t) => t.status === "pending").length;
  const resolvedCount = tickets.filter((t) => t.status === "resolved" || t.status === "closed").length;
  const feedbackCount = tickets.filter((t) => isFeedbackCategory(t.category, t.subject)).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Customer Support &amp; Feedback
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
              Helpdesk &amp; AI FAQ
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Review player support requests and feedback popup submissions, and manage the live AI FAQ Knowledge Bank.
          </p>
        </div>

        <div className="inline-flex items-center gap-1 rounded-2xl border border-white/10 bg-[#0f1219] p-1 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab("tickets")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
              activeTab === "tickets"
                ? "bg-amber-500 text-slate-950"
                : "text-slate-300 hover:text-white"
            }`}
          >
            <MessageSquare className="size-3.5" />
            <span>Support &amp; Feedback ({tickets.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("knowledge")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
              activeTab === "knowledge"
                ? "bg-amber-500 text-slate-950"
                : "text-slate-300 hover:text-white"
            }`}
          >
            <BookOpen className="size-3.5" />
            <span>AI FAQ Knowledge Bank ({kbEntries.length})</span>
          </button>
        </div>
      </div>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold"
        >
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {activeTab === "knowledge" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Add / Edit Knowledge Entry Form */}
          <form
            onSubmit={handleSaveKbEntry}
            className="lg:col-span-5 rounded-3xl bg-[#0f1219] border border-white/10 p-5 sm:p-6 space-y-4 self-start"
          >
            <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div>
                <h2 className="text-base font-extrabold text-white">
                  {kbEditingId ? "Edit Knowledge Entry" : "Add AI Knowledge Entry"}
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Published entries are used immediately by the Player App AI FAQ Assistant alongside the 24 built-in GuessWhat rules and live session stats.
                </p>
              </div>
              {kbEditingId && (
                <button
                  type="button"
                  onClick={resetKbForm}
                  className="text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Topic Title *
              </label>
              <input
                required
                value={kbTitle}
                onChange={(e) => setKbTitle(e.target.value)}
                placeholder="e.g. Weekend Bonus Jackpot Rules"
                className="w-full rounded-xl border border-white/10 bg-[#07090e] px-3.5 py-2 text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Category
                </label>
                <select
                  value={kbCategory}
                  onChange={(e) => setKbCategory(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#07090e] px-3 py-2 text-xs text-white"
                >
                  <option value="Gameplay & Scoring">Gameplay &amp; Scoring</option>
                  <option value="Prizes & Payouts">Prizes &amp; Payouts</option>
                  <option value="Referrals">Referrals</option>
                  <option value="Community Arena">Community Arena</option>
                  <option value="Account & Technical">Account &amp; Technical</option>
                  <option value="Promotions & Events">Promotions &amp; Events</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Trigger Keywords (comma-separated)
                </label>
                <input
                  value={kbKeywords}
                  onChange={(e) => setKbKeywords(e.target.value)}
                  placeholder="jackpot, weekend, bonus, promo"
                  className="w-full rounded-xl border border-white/10 bg-[#07090e] px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Sample User Questions (one per line)
              </label>
              <textarea
                rows={2}
                value={kbSamples}
                onChange={(e) => setKbSamples(e.target.value)}
                placeholder={"How do I qualify for the weekend bonus?\nWhen are promo winners announced?"}
                className="w-full rounded-xl border border-white/10 bg-[#07090e] px-3.5 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Authoritative AI Answer *
              </label>
              <textarea
                required
                rows={4}
                value={kbAnswer}
                onChange={(e) => setKbAnswer(e.target.value)}
                placeholder="Write the exact factual answer the AI Assistant should give players..."
                className="w-full rounded-xl border border-white/10 bg-[#07090e] px-3.5 py-2 text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Optional Button Label
                </label>
                <input
                  value={kbCtaLabel}
                  onChange={(e) => setKbCtaLabel(e.target.value)}
                  placeholder="e.g. Open Referrals"
                  className="w-full rounded-xl border border-white/10 bg-[#07090e] px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Optional App Route
                </label>
                <input
                  value={kbCtaHref}
                  onChange={(e) => setKbCtaHref(e.target.value)}
                  placeholder="e.g. /referrals or /play"
                  className="w-full rounded-xl border border-white/10 bg-[#07090e] px-3 py-2 text-xs font-mono text-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={kbSaving}
              className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-extrabold text-xs transition-colors"
            >
              <Plus className="size-4" />
              <span>
                {kbSaving
                  ? "Saving..."
                  : kbEditingId
                    ? "Save Updated Entry"
                    : "Publish to AI Knowledge Bank"}
              </span>
            </button>
          </form>

          {/* Existing Custom Knowledge Entries */}
          <div className="lg:col-span-7 rounded-3xl bg-[#0f1219] border border-white/10 p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div>
                <h2 className="text-base font-extrabold text-white">
                  Custom Knowledge Bank Entries ({kbEntries.length})
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Built-in baseline covers 24 core topics (rules, 10-to-1 scoring, payouts, receipts, referrals, Arena, login). Add custom promo/policy entries here anytime.
                </p>
              </div>
            </div>

            {kbLoading ? (
              <p className="text-xs text-slate-400 py-8 text-center">Loading knowledge bank...</p>
            ) : kbEntries.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center space-y-2">
                <p className="text-sm font-bold text-white">No custom entries added yet</p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  The AI FAQ Assistant is already active with 24 built-in GuessWhat Knowledge Bank topics plus live session data. Add custom announcements, brand promos, or special payout rules on the left anytime.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {kbEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className={`rounded-2xl border p-4 space-y-2.5 ${
                      entry.active
                        ? "border-white/10 bg-white/[0.02]"
                        : "border-white/5 bg-white/[0.01] opacity-60"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold text-white">{entry.title}</h3>
                          <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[10px] font-bold">
                            {entry.category}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              entry.active
                                ? "bg-emerald-500/15 text-emerald-300"
                                : "bg-slate-700 text-slate-300"
                            }`}
                          >
                            {entry.active ? "Active" : "Paused"}
                          </span>
                        </div>
                        {entry.keywords.length > 0 && (
                          <p className="text-[11px] text-slate-400 mt-1">
                            Keywords: {entry.keywords.join(", ")}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setKbEditingId(entry.id);
                            setKbTitle(entry.title);
                            setKbCategory(entry.category);
                            setKbKeywords(entry.keywords.join(", "));
                            setKbSamples(entry.sampleQuestions.join("\n"));
                            setKbAnswer(entry.answer);
                            setKbCtaLabel(entry.ctaLabel || "");
                            setKbCtaHref(entry.ctaHref || "");
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-semibold text-slate-200"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleKbEntry(entry)}
                          className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-semibold text-amber-300"
                        >
                          {entry.active ? "Pause" : "Enable"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteKbEntry(entry.id)}
                          aria-label="Delete entry"
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                      {entry.answer}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="rounded-2xl p-4 bg-[#0f1219] border border-white/10">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Total Threads
          </p>
          <p className="text-2xl font-extrabold text-white mt-1 tabular-nums">
            {tickets.length}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Support &amp; feedback</p>
        </div>

        <div className="rounded-2xl p-4 bg-[#0f1219] border border-white/10">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Open Complaints
          </p>
          <p className="text-2xl font-extrabold text-amber-400 mt-1 tabular-nums">
            {openCount}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">{pendingCount} awaiting player</p>
        </div>

        <div className="rounded-2xl p-4 bg-[#0f1219] border border-white/10">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Gameplay Feedback
          </p>
          <p className="text-2xl font-extrabold text-indigo-400 mt-1 tabular-nums">
            {feedbackCount}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Player suggestions &amp; reviews</p>
        </div>

        <div className="rounded-2xl p-4 bg-[#0f1219] border border-white/10">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Resolved Issues
          </p>
          <p className="text-2xl font-extrabold text-emerald-400 mt-1 tabular-nums">
            {resolvedCount}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Completed support tickets</p>
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="rounded-2xl p-4 bg-[#0f1219] border border-white/10 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter: All vs Support Requests vs Gameplay Feedback */}
          <div className="flex items-center gap-1 bg-white/[0.03] border border-white/10 rounded-xl p-1">
            {(
              [
                { id: "all", label: "All Inquiries" },
                { id: "support", label: "Support Complaints" },
                { id: "feedback", label: "Gameplay Feedback" },
              ] as const
            ).map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  categoryFilter === cat.id
                    ? "bg-amber-500 text-slate-950 font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <select
            aria-label="Filter by ticket status"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value as "all" | "open" | "pending" | "resolved" | "closed"
              )
            }
            className="px-3 py-2 rounded-xl bg-[#161b27] border border-white/10 text-xs font-semibold text-white"
          >
            <option value="all">Status: All</option>
            <option value="open">Open</option>
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        <div className="relative flex-1 lg:max-w-xs">
          <Search className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subject, @username, or message..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>
      </div>

      {/* Main Split View: Ticket Queue (Left) & Active Conversation Thread (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Ticket Queue */}
        <div className="lg:col-span-5 rounded-3xl overflow-hidden bg-[#0f1219] border border-white/10">
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">
              Support &amp; Feedback Queue ({filteredTickets.length})
            </h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">
              Loading player support tickets...
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No support requests or feedback match your filter.
            </div>
          ) : (
            <div className="divide-y divide-white/5 max-h-[620px] overflow-y-auto">
              {filteredTickets.map((t) => {
                const isSelected = selectedTicket?.id === t.id;
                const isFeedback = isFeedbackCategory(t.category, t.subject);
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    className={`p-4 cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-amber-500/10 border-l-4 border-l-amber-400"
                        : "hover:bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-white text-sm line-clamp-1">{t.subject}</p>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                          t.status === "open"
                            ? "bg-amber-500/20 text-amber-300"
                            : t.status === "pending"
                            ? "bg-indigo-500/20 text-indigo-300"
                            : "bg-emerald-500/20 text-emerald-300"
                        }`}
                      >
                        {t.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 mt-1.5">
                      <span>
                        @{t.profiles?.username || "player"}{" "}
                        {t.profiles?.state ? `· ${t.profiles.state}` : ""}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          isFeedback
                            ? "bg-indigo-500/15 text-indigo-300"
                            : "bg-white/5 text-slate-300"
                        }`}
                      >
                        {t.category || "Support Request"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                      <span>{(t.ticket_messages ?? []).length} messages</span>
                      <span>
                        {new Date(t.created_at).toLocaleDateString("en-NG", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Active Ticket Thread & Reply */}
        <div className="lg:col-span-7 rounded-3xl p-6 bg-[#0f1219] border border-white/10 space-y-5">
          {!selectedTicket ? (
            <div className="p-12 text-center text-sm text-slate-400">
              Select a support request or feedback thread on the left to inspect and reply.
            </div>
          ) : (
            <>
              {/* Thread Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-white/10 pb-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <MessageSquare className="size-4 text-amber-400" />
                    <h2 className="text-lg font-extrabold text-white">
                      {selectedTicket.subject}
                    </h2>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Player:{" "}
                    <strong className="text-white">
                      @{selectedTicket.profiles?.username || "player"}
                    </strong>{" "}
                    ({selectedTicket.profiles?.full_name || "Registered Player"}) · Category:{" "}
                    <strong className="text-amber-300">
                      {selectedTicket.category || "Support Request"}
                    </strong>
                  </p>
                </div>

                {/* Status Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {selectedTicket.status !== "resolved" ? (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(selectedTicket.id, "resolved")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold"
                    >
                      <Check className="size-3.5" />
                      <span>Mark Resolved</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(selectedTicket.id, "open")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-bold"
                    >
                      <RotateCcw className="size-3.5" />
                      <span>Reopen Ticket</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Conversation Messages */}
              <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                {(selectedTicket.ticket_messages ?? []).length === 0 ? (
                  <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 text-xs text-slate-400 flex items-center gap-2">
                    <HelpCircle className="size-4 text-slate-500" />
                    <span>No messages in this thread yet. Send a response below.</span>
                  </div>
                ) : (
                  (selectedTicket.ticket_messages ?? []).map((m) => {
                    const isStaff =
                      m.body.startsWith("[Support Team]:") ||
                      m.profiles?.role === "super_admin" ||
                      m.profiles?.role === "support";
                    return (
                      <div
                        key={m.id}
                        className={`p-4 rounded-2xl border ${
                          isStaff
                            ? "bg-amber-500/10 border-amber-500/30 ml-6"
                            : "bg-white/[0.03] border-white/10 mr-6"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] mb-1.5">
                          <span
                            className={`font-bold ${
                              isStaff ? "text-amber-300" : "text-white"
                            }`}
                          >
                            {isStaff
                              ? "GuessWhat Support Desk"
                              : `@${
                                  m.profiles?.username ??
                                  selectedTicket.profiles?.username ??
                                  "player"
                                }`}
                          </span>
                          <span className="text-slate-400 flex items-center gap-1">
                            <Clock className="size-3" />
                            {new Date(m.created_at).toLocaleString("en-NG", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                          {m.body.replace(/^\[Support Team\]:\s*/, "")}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Quick Canned Responses */}
              <div className="space-y-2 border-t border-white/10 pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-amber-400" />
                  <span>Quick Canned Responses</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_REPLIES.map((qr) => (
                    <button
                      key={qr.label}
                      type="button"
                      onClick={() => setReplyBody(qr.text)}
                      className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-amber-500/15 border border-white/10 hover:border-amber-500/30 text-[11px] font-semibold text-slate-300 hover:text-amber-300 transition-colors"
                    >
                      {qr.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reply Form */}
              <form onSubmit={(e) => handleReply(e, false)} className="space-y-3">
                <label
                  htmlFor="support-reply"
                  className="block text-xs font-semibold text-slate-300"
                >
                  Reply to @{selectedTicket.profiles?.username ?? "player"} (Also notifies Player App Inbox)
                </label>
                <textarea
                  id="support-reply"
                  name="replyBody"
                  rows={3}
                  placeholder="Write a clear, helpful response..."
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50"
                />
                <div className="flex flex-wrap items-center justify-end gap-2.5">
                  <button
                    type="button"
                    disabled={sending || !replyBody.trim()}
                    onClick={(e) => handleReply(e, true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs transition-colors"
                  >
                    <CheckCircle2 className="size-4" />
                    <span>Send &amp; Mark Resolved</span>
                  </button>
                  <button
                    type="submit"
                    disabled={sending || !replyBody.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs transition-colors"
                  >
                    <Send className="size-4" />
                    <span>{sending ? "Sending..." : "Send Reply"}</span>
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
        </>
      )}
    </div>
  );
}
