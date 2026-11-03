"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  Download,
  UserCheck,
  UserX,
  ShieldAlert,
  Eye,
  X,
  Building2,
  Gamepad2,
  History,
  Users,
  MessageSquareWarning,
  Calendar,
  MapPin,
  Phone,
  Mail,
  CheckCircle2,
} from "lucide-react";

type GameplayRecord = {
  id: string;
  sessionId: string;
  sessionName: string;
  sessionStatus: string;
  joinedAt: string;
  completedAt: string | null;
  totalScore: number;
  totalResponseMs: number;
  finalRank: number | null;
  prizeAwarded: number;
  isReplay: boolean;
};

type ActivityLogRecord = {
  id: number;
  action: string;
  targetTable: string | null;
  targetId: string | null;
  detail: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
};

type ComplaintRecord = {
  id: string;
  subject: string;
  category: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessage: string | null;
};

type ReferralItem = {
  id: string;
  username: string;
  fullName: string;
  state: string | null;
  status: string;
  createdAt: string;
};

type Player = {
  id: string;
  username: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  gender: string | null;
  date_of_birth: string | null;
  ageBand: string;
  state: string | null;
  role: string;
  status: "active" | "suspended" | "blocked";
  risk_score: number;
  referral_code: string;
  referred_by: string | null;
  referredByPlayer: { id: string; username: string; fullName: string; referralCode: string | null } | null;
  referralsCount: number;
  referralsMade: ReferralItem[];
  created_at: string;
  updated_at: string;
  lastSignInAt: string | null;
  wallet: {
    coin_balance: number;
    reward_balance: number;
    withdrawable_balance: number;
  };
  bankAccount: {
    bankName: string;
    accountNumber: string;
    accountName: string;
    updatedAt?: string;
  } | null;
  sessionsPlayed: number;
  bestScore: number;
  totalPrizesWon: number;
  gameplayHistory: GameplayRecord[];
  activityLogs: ActivityLogRecord[];
  complaints: ComplaintRecord[];
};

type Summary = {
  totalPlayers: number;
  activeCount: number;
  suspendedCount: number;
  blockedCount: number;
  withBankCount: number;
  newLast7Days: number;
};

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [summary, setSummary] = useState<Summary>({
    totalPlayers: 0,
    activeCount: 0,
    suspendedCount: 0,
    blockedCount: 0,
    withBankCount: 0,
    newLast7Days: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended" | "blocked">("all");
  const [dateRange, setDateRange] = useState<"all" | "today" | "7d" | "30d">("all");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<
    "overview" | "gameplay" | "activity" | "referrals" | "complaints"
  >("overview");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  async function loadPlayers() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/players", { cache: "no-store" });
      const data = await res.json();
      setPlayers((data.players as Player[]) ?? []);
      if (data.summary) setSummary(data.summary as Summary);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPlayers();
  }, []);

  const filteredPlayers = useMemo(() => {
    const nowMs = Date.now();
    const q = search.trim().toLowerCase();

    return players.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;

      if (dateRange !== "all") {
        const createdMs = new Date(p.created_at).getTime();
        const ageHours = (nowMs - createdMs) / (1000 * 60 * 60);
        if (dateRange === "today" && ageHours > 24) return false;
        if (dateRange === "7d" && ageHours > 24 * 7) return false;
        if (dateRange === "30d" && ageHours > 24 * 30) return false;
      }

      if (q) {
        const hay = [
          p.username,
          p.full_name,
          p.email,
          p.phone,
          p.state,
          p.referral_code,
          p.bankAccount?.bankName,
          p.bankAccount?.accountNumber,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [players, search, statusFilter, dateRange]);

  const selectedPlayer = useMemo(
    () => players.find((p) => p.id === selectedPlayerId) ?? null,
    [players, selectedPlayerId]
  );

  async function handleAccountAction(
    userId: string,
    actionType: "suspend" | "reactivate" | "restrict_fraud",
    username: string
  ) {
    setActionLoadingId(userId);
    setToast("");
    try {
      const payload =
        actionType === "suspend"
          ? { userId, action: "set_status", status: "suspended", note: "Admin suspended account" }
          : actionType === "reactivate"
          ? { userId, action: "set_status", status: "active", riskScore: 0, note: "Admin reactivated account" }
          : {
              userId,
              action: "restrict_fraud",
              status: "blocked",
              riskScore: 85,
              note: "Suspected fraudulent account restricted",
            };

      const res = await fetch("/api/admin/players", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const msg =
          actionType === "suspend"
            ? `@${username} has been suspended.`
            : actionType === "reactivate"
            ? `@${username} account reactivated.`
            : `@${username} restricted for suspected fraud (Risk Score: 85).`;
        setToast(msg);
        setTimeout(() => setToast(""), 4000);
        await loadPlayers();
      }
    } finally {
      setActionLoadingId(null);
    }
  }

  function exportCsvUrl() {
    const params = new URLSearchParams({ format: "csv" });
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (dateRange !== "all") params.set("dateRange", dateRange);
    if (search.trim()) params.set("q", search.trim());
    return `/api/admin/players?${params.toString()}`;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Player Management
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
              Audience &amp; KYC
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Inspect registered player profiles, bank payout accounts, session gameplay history, referrals, complaints, and account status controls.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/admin/referrals"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 transition-colors"
          >
            <Users className="size-4 text-amber-400" />
            <span>Referrals &amp; Promo Codes</span>
          </Link>
          <Link
            href="/admin/notifications"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 transition-colors"
          >
            <span>Send Push / Inbox</span>
          </Link>
          <a
            href={exportCsvUrl()}
            download
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors"
          >
            <Download className="size-4" />
            <span>Export Player Records (CSV)</span>
          </a>
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="rounded-2xl p-4 bg-[#0f1219] border border-white/10">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Total Registered
          </p>
          <p className="text-2xl font-extrabold text-white mt-1 tabular-nums">
            {summary.totalPlayers.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            +{summary.newLast7Days} in last 7 days
          </p>
        </div>

        <div className="rounded-2xl p-4 bg-[#0f1219] border border-white/10">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Active Accounts
          </p>
          <p className="text-2xl font-extrabold text-emerald-400 mt-1 tabular-nums">
            {summary.activeCount.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Eligible for sessions &amp; prizes</p>
        </div>

        <div className="rounded-2xl p-4 bg-[#0f1219] border border-white/10">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Suspended
          </p>
          <p className="text-2xl font-extrabold text-amber-400 mt-1 tabular-nums">
            {summary.suspendedCount.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Temporarily paused</p>
        </div>

        <div className="rounded-2xl p-4 bg-[#0f1219] border border-white/10">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Fraud Restricted
          </p>
          <p className="text-2xl font-extrabold text-rose-400 mt-1 tabular-nums">
            {summary.blockedCount.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Flagged / blocked accounts</p>
        </div>

        <div className="rounded-2xl p-4 bg-[#0f1219] border border-white/10">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Bank Details Linked
          </p>
          <p className="text-2xl font-extrabold text-indigo-400 mt-1 tabular-nums">
            {summary.withBankCount.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Ready for prize payouts</p>
        </div>
      </div>

      {/* Search & Filters Bar */}
      <div className="rounded-2xl p-4 bg-[#0f1219] border border-white/10 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="size-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by username, full name, email, phone number, state, or bank..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Registration Date Filter */}
          <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/10 rounded-xl p-1">
            {(
              [
                { id: "all", label: "All Time" },
                { id: "today", label: "Today" },
                { id: "7d", label: "Last 7 Days" },
                { id: "30d", label: "Last 30 Days" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDateRange(opt.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  dateRange === opt.id
                    ? "bg-amber-500 text-slate-950 font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Account Status Filter */}
          <select
            aria-label="Filter by account status"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "all" | "active" | "suspended" | "blocked")
            }
            className="px-3 py-2 rounded-xl bg-[#161b27] border border-white/10 text-xs font-semibold text-slate-200 focus:outline-none focus:border-amber-500/50"
          >
            <option value="all">Status: All Accounts</option>
            <option value="active">Active Only</option>
            <option value="suspended">Suspended Only</option>
            <option value="blocked">Fraud Restricted (Blocked)</option>
          </select>
        </div>
      </div>

      {/* Players Table */}
      <div className="rounded-3xl overflow-hidden bg-[#0f1219] border border-white/10">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-400">
            Loading player accounts and activity logs...
          </div>
        ) : filteredPlayers.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-400">
            No players match your current search or filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3.5">Player</th>
                  <th className="px-4 py-3.5">Contact &amp; State</th>
                  <th className="px-4 py-3.5">Demographics</th>
                  <th className="px-4 py-3.5">Gameplay</th>
                  <th className="px-4 py-3.5">Referrals</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Joined</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredPlayers.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => {
                      setSelectedPlayerId(p.id);
                      setInspectorTab("overview");
                    }}
                    className="hover:bg-white/[0.03] transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="size-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-xs font-extrabold text-amber-300 uppercase">
                          {p.username.slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-bold text-white flex items-center gap-1.5">
                            <span>@{p.username}</span>
                            {p.risk_score >= 50 && (
                              <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold">
                                Risk {p.risk_score}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-400">{p.full_name || "—"}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-xs">
                      <p className="text-slate-200 font-medium">{p.phone || p.email}</p>
                      <p className="text-slate-400">{p.state || "Nigeria"}</p>
                    </td>

                    <td className="px-4 py-3.5 text-xs">
                      <p className="capitalize text-slate-200">{p.gender || "—"}</p>
                      <p className="text-slate-400 font-mono">{p.ageBand}</p>
                    </td>

                    <td className="px-4 py-3.5 text-xs tabular-nums">
                      <p className="font-bold text-white">
                        {p.sessionsPlayed} <span className="font-normal text-slate-400">plays</span>
                      </p>
                      <p className="text-amber-400 font-semibold">
                        Best: {p.bestScore} pts
                        {p.totalPrizesWon > 0 && ` · ₦${p.totalPrizesWon.toLocaleString()}`}
                      </p>
                    </td>

                    <td className="px-4 py-3.5 text-xs">
                      <p className="font-semibold text-slate-200">
                        {p.referralsCount} <span className="text-slate-400 font-normal">referred</span>
                      </p>
                      {p.referredByPlayer && (
                        <p className="text-[11px] text-indigo-300">
                          by @{p.referredByPlayer.username}
                        </p>
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          p.status === "active"
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                            : p.status === "suspended"
                            ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                            : "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-xs text-slate-400 tabular-nums">
                      {new Date(p.created_at).toLocaleDateString("en-NG", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>

                    <td
                      className="px-5 py-3.5 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPlayerId(p.id);
                            setInspectorTab("overview");
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <Eye className="size-3.5" />
                          <span>Inspect</span>
                        </button>

                        {p.status === "active" ? (
                          <button
                            type="button"
                            disabled={actionLoadingId === p.id}
                            onClick={() => handleAccountAction(p.id, "suspend", p.username)}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-semibold"
                            title="Suspend Player Account"
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={actionLoadingId === p.id}
                            onClick={() => handleAccountAction(p.id, "reactivate", p.username)}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-xs font-semibold"
                            title="Reactivate Player Account"
                          >
                            Activate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Player Profile & Activity Inspector Modal/Drawer */}
      {selectedPlayer && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex justify-end"
          onClick={() => setSelectedPlayerId(null)}
        >
          <div
            className="w-full max-w-3xl bg-[#0b0e17] border-l border-white/10 h-full overflow-y-auto p-6 space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3.5">
                <div className="size-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-base font-black text-amber-300 uppercase">
                  {selectedPlayer.username.slice(0, 2)}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-extrabold text-white">
                      {selectedPlayer.full_name || selectedPlayer.username}
                    </h2>
                    <span className="text-xs font-mono text-slate-400">
                      @{selectedPlayer.username}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        selectedPlayer.status === "active"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : selectedPlayer.status === "suspended"
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-rose-500/20 text-rose-300"
                      }`}
                    >
                      {selectedPlayer.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Registered {new Date(selectedPlayer.created_at).toLocaleString("en-NG")} · Risk Score:{" "}
                    <strong className="text-white">{selectedPlayer.risk_score}/100</strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPlayerId(null)}
                aria-label="Close inspector"
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Account Enforcement Controls (Page 41) */}
            <div className="rounded-2xl p-4 bg-[#121723] border border-white/10 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Account Status &amp; Fraud Controls
                </p>
                <p className="text-[11px] text-slate-400">
                  Suspend, reactivate, or restrict accounts suspected of fraudulent activity.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {selectedPlayer.status !== "active" && (
                  <button
                    type="button"
                    disabled={actionLoadingId === selectedPlayer.id}
                    onClick={() =>
                      handleAccountAction(selectedPlayer.id, "reactivate", selectedPlayer.username)
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors"
                  >
                    <UserCheck className="size-4" />
                    <span>Reactivate Account</span>
                  </button>
                )}

                {selectedPlayer.status !== "suspended" && (
                  <button
                    type="button"
                    disabled={actionLoadingId === selectedPlayer.id}
                    onClick={() =>
                      handleAccountAction(selectedPlayer.id, "suspend", selectedPlayer.username)
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold text-xs transition-colors"
                  >
                    <UserX className="size-4" />
                    <span>Suspend Account</span>
                  </button>
                )}

                {selectedPlayer.status !== "blocked" && (
                  <button
                    type="button"
                    disabled={actionLoadingId === selectedPlayer.id}
                    onClick={() =>
                      handleAccountAction(
                        selectedPlayer.id,
                        "restrict_fraud",
                        selectedPlayer.username
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-bold text-xs transition-colors"
                  >
                    <ShieldAlert className="size-4" />
                    <span>Restrict Fraudulent Account</span>
                  </button>
                )}
              </div>
            </div>

            {/* Inspector Navigation Tabs */}
            <div className="flex flex-wrap gap-1.5 border-b border-white/10 pb-3">
              {[
                { id: "overview", label: "Profile & Bank Details", icon: Building2 },
                {
                  id: "gameplay",
                  label: `Gameplay (${selectedPlayer.gameplayHistory.length})`,
                  icon: Gamepad2,
                },
                {
                  id: "activity",
                  label: `Login & Activity (${selectedPlayer.activityLogs.length})`,
                  icon: History,
                },
                {
                  id: "referrals",
                  label: `Referrals (${selectedPlayer.referralsCount})`,
                  icon: Users,
                },
                {
                  id: "complaints",
                  label: `Complaints (${selectedPlayer.complaints.length})`,
                  icon: MessageSquareWarning,
                },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = inspectorTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() =>
                      setInspectorTab(
                        tab.id as
                          | "overview"
                          | "gameplay"
                          | "activity"
                          | "referrals"
                          | "complaints"
                      )
                    }
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                      active
                        ? "bg-amber-500 text-slate-950 font-bold"
                        : "bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    <Icon className="size-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab 1: Overview (Registration Details + Bank Account Details) */}
            {inspectorTab === "overview" && (
              <div className="space-y-5">
                <div className="rounded-2xl p-5 bg-[#0f1219] border border-white/10 space-y-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Registration &amp; Demographic Details
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                    <div>
                      <p className="text-slate-400">Full Name</p>
                      <p className="font-bold text-white mt-0.5">
                        {selectedPlayer.full_name || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Username</p>
                      <p className="font-bold text-white mt-0.5">@{selectedPlayer.username}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 flex items-center gap-1">
                        <Mail className="size-3" /> Email
                      </p>
                      <p className="font-bold text-white mt-0.5 break-all">
                        {selectedPlayer.email}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 flex items-center gap-1">
                        <Phone className="size-3" /> Phone Number
                      </p>
                      <p className="font-bold text-white mt-0.5">
                        {selectedPlayer.phone || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Gender</p>
                      <p className="font-bold text-white capitalize mt-0.5">
                        {selectedPlayer.gender || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 flex items-center gap-1">
                        <Calendar className="size-3" /> Date of Birth / Age
                      </p>
                      <p className="font-bold text-white mt-0.5">
                        {selectedPlayer.date_of_birth || "—"} ({selectedPlayer.ageBand})
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 flex items-center gap-1">
                        <MapPin className="size-3" /> Location (State)
                      </p>
                      <p className="font-bold text-white mt-0.5">
                        {selectedPlayer.state || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Last Active / Login</p>
                      <p className="font-bold text-white mt-0.5">
                        {selectedPlayer.lastSignInAt
                          ? new Date(selectedPlayer.lastSignInAt).toLocaleString("en-NG")
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Prize Wallet Balance</p>
                      <p className="font-bold text-emerald-400 mt-0.5">
                        ₦{selectedPlayer.wallet.reward_balance.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bank Account Details */}
                <div className="rounded-2xl p-5 bg-[#0f1219] border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Building2 className="size-4 text-amber-400" />
                      <span>Payout Bank Account Details</span>
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        selectedPlayer.bankAccount?.accountNumber
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-white/5 text-slate-400"
                      }`}
                    >
                      {selectedPlayer.bankAccount?.accountNumber ? "Configured" : "Not Submitted"}
                    </span>
                  </div>

                  {selectedPlayer.bankAccount?.accountNumber ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-2">
                      <div>
                        <p className="text-slate-400">Bank Name</p>
                        <p className="font-bold text-white mt-0.5">
                          {selectedPlayer.bankAccount.bankName}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400">Account Number (NUBAN)</p>
                        <p className="font-mono font-bold text-amber-300 text-sm mt-0.5">
                          {selectedPlayer.bankAccount.accountNumber}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400">Account Holder Name</p>
                        <p className="font-bold text-white mt-0.5">
                          {selectedPlayer.bankAccount.accountName}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">
                      This player has not yet saved payout bank account details in their profile.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: Gameplay History */}
            {inspectorTab === "gameplay" && (
              <div className="rounded-2xl bg-[#0f1219] border border-white/10 overflow-hidden">
                {selectedPlayer.gameplayHistory.length === 0 ? (
                  <p className="p-6 text-xs text-slate-400">
                    No gameplay sessions recorded for this player yet.
                  </p>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/[0.02] text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        <th className="px-4 py-3">Session</th>
                        <th className="px-4 py-3">Score</th>
                        <th className="px-4 py-3">Response Time</th>
                        <th className="px-4 py-3">Rank</th>
                        <th className="px-4 py-3">Prize Won</th>
                        <th className="px-4 py-3 text-right">Date Played</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {selectedPlayer.gameplayHistory.map((g) => (
                        <tr key={g.id}>
                          <td className="px-4 py-3">
                            <p className="font-bold text-white">{g.sessionName}</p>
                            {g.isReplay && (
                              <span className="text-[10px] text-amber-300">Repeat Play Attempt</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-bold text-amber-400 tabular-nums">
                            {g.totalScore} pts
                          </td>
                          <td className="px-4 py-3 text-slate-300 font-mono tabular-nums">
                            {(g.totalResponseMs / 1000).toFixed(2)}s
                          </td>
                          <td className="px-4 py-3 font-bold text-white">
                            {g.finalRank ? `#${g.finalRank}` : "—"}
                          </td>
                          <td className="px-4 py-3 font-bold text-emerald-400 tabular-nums">
                            {g.prizeAwarded > 0 ? `₦${g.prizeAwarded.toLocaleString()}` : "—"}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-400">
                            {new Date(g.completedAt || g.joinedAt).toLocaleString("en-NG", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Tab 3: Login & Activity History */}
            {inspectorTab === "activity" && (
              <div className="rounded-2xl bg-[#0f1219] border border-white/10 overflow-hidden">
                {selectedPlayer.activityLogs.length === 0 ? (
                  <p className="p-6 text-xs text-slate-400">
                    No audit activity logs recorded for this player yet.
                  </p>
                ) : (
                  <div className="divide-y divide-white/5">
                    {selectedPlayer.activityLogs.map((log) => (
                      <div
                        key={log.id}
                        className="px-4 py-3 flex items-center justify-between gap-4 text-xs"
                      >
                        <div>
                          <p className="font-bold text-white">{log.action}</p>
                          <p className="text-slate-400 text-[11px] mt-0.5">
                            {log.targetTable ? `Table: ${log.targetTable}` : "Player Activity"}
                            {log.ipAddress ? ` · IP: ${log.ipAddress}` : ""}
                          </p>
                        </div>
                        <span className="text-slate-400 tabular-nums">
                          {new Date(log.createdAt).toLocaleString("en-NG", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 4: Referrals */}
            {inspectorTab === "referrals" && (
              <div className="space-y-4">
                <div className="rounded-2xl p-4 bg-[#0f1219] border border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <p className="text-slate-400">Player Referral Code</p>
                    <p className="font-mono font-bold text-amber-300 text-sm mt-0.5">
                      {selectedPlayer.referral_code}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">Referred By</p>
                    <p className="font-bold text-white mt-0.5">
                      {selectedPlayer.referredByPlayer
                        ? `@${selectedPlayer.referredByPlayer.username} (${selectedPlayer.referredByPlayer.fullName})`
                        : "Direct Organic Signup"}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">Total Players Referred</p>
                    <p className="font-bold text-emerald-400 text-sm mt-0.5">
                      {selectedPlayer.referralsCount} players
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl bg-[#0f1219] border border-white/10 overflow-hidden">
                  {selectedPlayer.referralsMade.length === 0 ? (
                    <p className="p-6 text-xs text-slate-400">
                      This player has not referred any other accounts yet.
                    </p>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-white/10 bg-white/[0.02] text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          <th className="px-4 py-3">Referred Player</th>
                          <th className="px-4 py-3">State</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Signup Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {selectedPlayer.referralsMade.map((r) => (
                          <tr key={r.id}>
                            <td className="px-4 py-3 font-bold text-white">
                              @{r.username}{" "}
                              <span className="text-slate-400 font-normal">({r.fullName})</span>
                            </td>
                            <td className="px-4 py-3 text-slate-300">{r.state || "—"}</td>
                            <td className="px-4 py-3 capitalize text-emerald-300">{r.status}</td>
                            <td className="px-4 py-3 text-right text-slate-400">
                              {new Date(r.createdAt).toLocaleDateString("en-NG")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* Tab 5: Player Complaints / Support Tickets */}
            {inspectorTab === "complaints" && (
              <div className="space-y-3">
                {selectedPlayer.complaints.length === 0 ? (
                  <div className="rounded-2xl p-6 bg-[#0f1219] border border-white/10 text-xs text-slate-400">
                    No support complaints or feedback submitted by this player.
                  </div>
                ) : (
                  selectedPlayer.complaints.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-2xl p-4 bg-[#0f1219] border border-white/10 flex items-start justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">{c.subject}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-white/10 text-slate-300">
                            {c.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          Category: {c.category || "General"} · {c.messageCount} messages ·{" "}
                          {new Date(c.createdAt).toLocaleDateString("en-NG")}
                        </p>
                        {c.lastMessage && (
                          <p className="text-xs text-slate-300 mt-1 line-clamp-2">
                            “{c.lastMessage}”
                          </p>
                        )}
                      </div>
                      <Link
                        href="/admin/support"
                        className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold shrink-0"
                      >
                        Reply in Support →
                      </Link>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
