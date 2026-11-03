"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Send,
  Sparkles,
  CheckCircle2,
  Clock,
  Users,
  Eye,
  MailCheck,
  AlertCircle,
} from "lucide-react";

type BroadcastBatch = {
  batchKey: string;
  title: string;
  body: string;
  sentAt: string;
  deliveredCount: number;
  readCount: number;
  unreadCount: number;
  readRatePct: number;
  sampleRecipients: string[];
};

type DeliveryReceipt = {
  id: number;
  userId: string;
  username: string;
  fullName: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
};

type BasicPlayer = {
  id: string;
  username: string;
  fullName: string;
  status: string;
};

type Summary = {
  totalBroadcasts: number;
  totalDelivered: number;
  totalRead: number;
  overallReadRatePct: number;
  allPlayersCount: number;
  activeSessionPlayersCount: number;
  winnersCount: number;
};

const QUICK_TEMPLATES = [
  {
    id: "upcoming",
    label: "Announce Upcoming Session",
    audience: "all" as const,
    title: "🔥 Upcoming 72-Hour GuessWhat Session!",
    body: "Get ready! Our next 3-day Free-to-Play GuessWhat session starts soon with a ₦62,500 cash prize pool for the Top 36 players. Log in and lock in your 10 crowd predictions!",
  },
  {
    id: "begun",
    label: "Notify Session Has Begun",
    audience: "all" as const,
    title: "🚀 Live Now: 3-Day Game Session Has Begun!",
    body: "The 72-hour GuessWhat session is now LIVE! Answer all 10 ten-option questions and guess the most popular crowd choices (10 pts down to 1 pt). Play & replay free now!",
  },
  {
    id: "winners",
    label: "Announce Session Winners",
    audience: "active_session" as const,
    title: "🏆 Official Session Results & Top 36 Winners Announced!",
    body: "Consensus scoring is complete! Check the Live Leaderboard to see the final option percentages, your assigned points, and the Top 36 cash prize winners.",
  },
  {
    id: "payouts",
    label: "Notify Winners About Prize Payments",
    audience: "winners" as const,
    title: "💳 Congratulations! Your GuessWhat Cash Prize Payout Update",
    body: "Congratulations on finishing in the Top 36! Your cash prize has been approved for bank transfer. Please ensure your Nigerian bank account (NUBAN) is up to date in your Profile.",
  },
  {
    id: "promo",
    label: "Send Promotional Message",
    audience: "all" as const,
    title: "🎁 Invite Friends & Climb the Monthly Referral Leaderboard!",
    body: "Share your unique GuessWhat referral code with friends across Nigeria! Play unlimited free replays to improve your consensus score before the 72-hour timer closes.",
  },
];

export default function NotificationsPage() {
  const [summary, setSummary] = useState<Summary>({
    totalBroadcasts: 0,
    totalDelivered: 0,
    totalRead: 0,
    overallReadRatePct: 0,
    allPlayersCount: 0,
    activeSessionPlayersCount: 0,
    winnersCount: 0,
  });
  const [batches, setBatches] = useState<BroadcastBatch[]>([]);
  const [recentDeliveries, setRecentDeliveries] = useState<DeliveryReceipt[]>([]);
  const [players, setPlayers] = useState<BasicPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  // Composer state
  const [audienceType, setAudienceType] = useState<
    "all" | "active_session" | "winners" | "specific" | "status_active" | "status_suspended"
  >("all");
  const [specificUserId, setSpecificUserId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [sending, setSending] = useState(false);

  const [historyView, setHistoryView] = useState<"batches" | "receipts">("batches");
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  async function loadNotifications() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/notifications", { cache: "no-store" });
      const data = await res.json();
      if (data.summary) setSummary(data.summary);
      setBatches(data.batches ?? []);
      setRecentDeliveries(data.recentDeliveries ?? []);
      setPlayers(data.players ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  function applyTemplate(tpl: (typeof QUICK_TEMPLATES)[number]) {
    setAudienceType(tpl.audience);
    setTitle(tpl.title);
    setBody(tpl.body);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setToast("");

    if (!title.trim() || !body.trim()) {
      setError("Please enter both a notification title and message body.");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audienceType,
          specificUserId,
          title: title.trim(),
          body: body.trim(),
          scheduledFor: scheduledFor || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to send notification.");
      } else {
        setTitle("");
        setBody("");
        setScheduledFor("");
        setToast(
          `Message delivered to ${data.deliveredCount} player inbox${
            data.deliveredCount === 1 ? "" : "es"
          }!`
        );
        setTimeout(() => setToast(""), 4500);
        await loadNotifications();
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Notifications &amp; Messaging
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
              Push &amp; Player Inbox
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Broadcast session announcements, winner alerts, payout updates, and promotional messages directly to Player App inboxes.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/admin/players"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 transition-colors"
          >
            <Users className="size-4 text-slate-400" />
            <span>Player Directory</span>
          </Link>
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

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold"
        >
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="rounded-2xl p-4 bg-[#0f1219] border border-white/10">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Broadcast Campaigns
          </p>
          <p className="text-2xl font-extrabold text-white mt-1 tabular-nums">
            {summary.totalBroadcasts.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Total announcements sent</p>
        </div>

        <div className="rounded-2xl p-4 bg-[#0f1219] border border-white/10">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Messages Delivered
          </p>
          <p className="text-2xl font-extrabold text-amber-400 mt-1 tabular-nums">
            {summary.totalDelivered.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">In-app inbox deliveries</p>
        </div>

        <div className="rounded-2xl p-4 bg-[#0f1219] border border-white/10">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Read by Players
          </p>
          <p className="text-2xl font-extrabold text-emerald-400 mt-1 tabular-nums">
            {summary.totalRead.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {summary.overallReadRatePct}% open / read rate
          </p>
        </div>

        <div className="rounded-2xl p-4 bg-[#0f1219] border border-white/10">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Reachable Audience
          </p>
          <p className="text-2xl font-extrabold text-indigo-400 mt-1 tabular-nums">
            {summary.allPlayersCount.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {summary.activeSessionPlayersCount} active session · {summary.winnersCount} winners
          </p>
        </div>
      </div>

      {/* Main Composer & Quick Templates */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: 1-Click Quick Templates */}
        <div className="rounded-3xl p-6 bg-[#0f1219] border border-white/10 space-y-4 h-fit">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="size-4 text-amber-400" />
              <span>1-Click Quick Templates</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Pre-configured operational messages for session lifecycle and winner payouts.
            </p>
          </div>

          <div className="space-y-2.5">
            {QUICK_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => applyTemplate(tpl)}
                className="w-full text-left p-3.5 rounded-2xl bg-white/[0.03] hover:bg-amber-500/10 border border-white/10 hover:border-amber-500/40 transition-colors space-y-1"
              >
                <p className="text-xs font-bold text-amber-300">{tpl.label}</p>
                <p className="text-xs font-semibold text-white truncate">{tpl.title}</p>
                <p className="text-[11px] text-slate-400 line-clamp-2">{tpl.body}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Broadcast Composer Form */}
        <div className="lg:col-span-2 rounded-3xl p-6 bg-[#0f1219] border border-white/10 space-y-5">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Bell className="size-4 text-amber-400" />
                <span>Compose Push / Inbox Broadcast</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Messages appear immediately in the Player App notification bell and Inbox drawer.
              </p>
            </div>
          </div>

          <form onSubmit={handleSend} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Target Audience Group *
                </label>
                <select
                  value={audienceType}
                  onChange={(e) =>
                    setAudienceType(
                      e.target.value as
                        | "all"
                        | "active_session"
                        | "winners"
                        | "specific"
                        | "status_active"
                        | "status_suspended"
                    )
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#161b27] border border-white/10 text-xs font-semibold text-white"
                >
                  <option value="all">All Registered Players ({summary.allPlayersCount})</option>
                  <option value="active_session">
                    Active Session Players ({summary.activeSessionPlayersCount})
                  </option>
                  <option value="winners">
                    Session Winners — Top 36 ({summary.winnersCount})
                  </option>
                  <option value="specific">Specific Individual Player</option>
                  <option value="status_active">By Status: Active Accounts Only</option>
                  <option value="status_suspended">By Status: Suspended / Restricted Accounts</option>
                </select>
              </div>

              {audienceType === "specific" ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Select Recipient Player *
                  </label>
                  <select
                    value={specificUserId}
                    onChange={(e) => setSpecificUserId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#161b27] border border-white/10 text-xs text-white"
                  >
                    <option value="">Choose player...</option>
                    {players.map((p) => (
                      <option key={p.id} value={p.id}>
                        @{p.username} ({p.fullName})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Schedule Delivery (Optional — Leave blank for Instant)
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledFor}
                    onChange={(e) => setScheduledFor(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-white"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Notification Headline / Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 🚀 Weekend 72-Hour Session Is Now LIVE!"
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Message Content *
              </label>
              <textarea
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write the announcement or promotional message that players will see..."
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={sending}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs sm:text-sm transition-colors"
              >
                <Send className="size-4" />
                <span>
                  {sending
                    ? "Broadcasting..."
                    : scheduledFor
                    ? "Schedule & Dispatch Notification"
                    : "Send Notification Now"}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Message History & Delivery / Read Status Table */}
      <div className="rounded-3xl overflow-hidden bg-[#0f1219] border border-white/10">
        <div className="p-5 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white">
              Message History &amp; Delivery / Read Status
            </h2>
            <p className="text-xs text-slate-400">
              Track broadcast delivery batches and individual player inbox read receipts.
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/10 rounded-xl p-1">
            <button
              type="button"
              onClick={() => setHistoryView("batches")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                historyView === "batches"
                  ? "bg-amber-500 text-slate-950 font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Broadcast Batches ({batches.length})
            </button>
            <button
              type="button"
              onClick={() => setHistoryView("receipts")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                historyView === "receipts"
                  ? "bg-amber-500 text-slate-950 font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Player Delivery Receipts ({recentDeliveries.length})
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-slate-400">
            Loading message history and read receipts...
          </div>
        ) : historyView === "batches" ? (
          batches.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-400">
              No notifications sent yet. Use a quick template above to send your first broadcast!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02] text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <th className="px-5 py-3.5">Message Title &amp; Body</th>
                    <th className="px-4 py-3.5">Recipients</th>
                    <th className="px-4 py-3.5">Delivered</th>
                    <th className="px-4 py-3.5">Read Status</th>
                    <th className="px-5 py-3.5 text-right">Sent At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {batches.map((b) => (
                    <tr key={b.batchKey} className="hover:bg-white/[0.02]">
                      <td className="px-5 py-3.5 max-w-md">
                        <p className="font-bold text-white">{b.title}</p>
                        <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">{b.body}</p>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-300">
                        {b.deliveredCount > 1
                          ? `Broadcast (${b.sampleRecipients.map((u) => `@${u}`).join(", ")}${
                              b.deliveredCount > b.sampleRecipients.length ? "..." : ""
                            })`
                          : `@${b.sampleRecipients[0] || "player"}`}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300">
                          <MailCheck className="size-3" /> {b.deliveredCount} delivered
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs tabular-nums">
                        <span className="font-bold text-white">{b.readCount} read</span>{" "}
                        <span className="text-slate-400">({b.readRatePct}%)</span>
                      </td>
                      <td className="px-5 py-3.5 text-right text-xs text-slate-400 tabular-nums">
                        {new Date(b.sentAt).toLocaleString("en-NG", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3.5">Player</th>
                  <th className="px-4 py-3.5">Notification</th>
                  <th className="px-4 py-3.5">Delivery &amp; Read Status</th>
                  <th className="px-5 py-3.5 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentDeliveries.map((r) => (
                  <tr key={r.id} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3.5">
                      <p className="font-bold text-white text-xs">@{r.username}</p>
                      <p className="text-[11px] text-slate-400">{r.fullName}</p>
                    </td>
                    <td className="px-4 py-3.5 max-w-md">
                      <p className="font-bold text-white text-xs">{r.title}</p>
                      <p className="text-[11px] text-slate-400 line-clamp-1">{r.body}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      {r.read ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-300">
                          <Eye className="size-3" /> Read by Player
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/15 text-amber-300">
                          <Clock className="size-3" /> Delivered (Unread)
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right text-xs text-slate-400 tabular-nums">
                      {new Date(r.createdAt).toLocaleString("en-NG", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
