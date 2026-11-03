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
} from "lucide-react";

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

function isFeedbackCategory(cat: string | null): boolean {
  const c = (cat || "").toLowerCase();
  return c.includes("feedback") || c.includes("suggestion") || c.includes("gameplay");
}

export default function SupportPage() {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredTickets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (categoryFilter === "feedback" && !isFeedbackCategory(t.category)) return false;
      if (categoryFilter === "support" && isFeedbackCategory(t.category)) return false;

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
  const feedbackCount = tickets.filter((t) => isFeedbackCategory(t.category)).length;

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
              Helpdesk &amp; Inbox Sync
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            View player support requests, review gameplay feedback, respond to player complaints, and resolve issues in real time.
          </p>
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
                const isFeedback = isFeedbackCategory(t.category);
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
    </div>
  );
}
