"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Users,
  Trophy,
  Ticket,
  ShieldAlert,
  Download,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Power,
  Trash2,
  UserPlus,
} from "lucide-react";

type LeaderboardRow = {
  rank: number;
  userId: string;
  username: string;
  fullName: string;
  state: string;
  status: string;
  referralCode: string;
  totalReferrals: number;
  monthlyReferrals: number;
  activePlayingReferrals: number;
  conversionRatePct: number;
  suspiciousFlag: boolean;
  suspiciousReason: string | null;
  joinedAt: string;
};

type ReferralRecord = {
  id: string;
  referredUserId: string;
  referredUsername: string;
  referredFullName: string;
  referredState: string;
  referredStatus: string;
  referredRiskScore: number;
  sessionsPlayed: number;
  referrerId: string;
  referrerUsername: string;
  referrerFullName: string;
  referralCodeUsed: string;
  createdAt: string;
  suspicious: boolean;
  suspiciousReason: string | null;
};

type PromoCodeItem = {
  code: string;
  campaign: string;
  bonusNote: string;
  uses: number;
  active: boolean;
  createdAt: string;
};

type Summary = {
  totalPlayers: number;
  totalReferredPlayers: number;
  referralAcquisitionSharePct: number;
  activeReferredPlayers: number;
  activeReferrersCount: number;
  suspiciousClustersCount: number;
};

type BasicPlayer = {
  id: string;
  username: string;
  fullName: string;
  referredBy: string | null;
};

export default function ReferralsPage() {
  const [summary, setSummary] = useState<Summary>({
    totalPlayers: 0,
    totalReferredPlayers: 0,
    referralAcquisitionSharePct: 0,
    activeReferredPlayers: 0,
    activeReferrersCount: 0,
    suspiciousClustersCount: 0,
  });
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [referralRecords, setReferralRecords] = useState<ReferralRecord[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCodeItem[]>([]);
  const [playersList, setPlayersList] = useState<BasicPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<"leaderboard" | "records" | "promos" | "suspicious">(
    "leaderboard"
  );
  const [search, setSearch] = useState("");
  const [onlySuspicious, setOnlySuspicious] = useState(false);

  // Promo code form
  const [promoCode, setPromoCode] = useState("");
  const [promoCampaign, setPromoCampaign] = useState("");
  const [promoNote, setPromoNote] = useState("");
  const [savingPromo, setSavingPromo] = useState(false);

  // Manual referral attribution form
  const [referredUserId, setReferredUserId] = useState("");
  const [referrerUserId, setReferrerUserId] = useState("");
  const [linkingReferral, setLinkingReferral] = useState(false);

  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  async function loadReferrals() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/referrals", { cache: "no-store" });
      const data = await res.json();
      if (data.summary) setSummary(data.summary);
      setLeaderboard(data.leaderboard ?? []);
      setReferralRecords(data.referralRecords ?? []);
      setPromoCodes(data.promoCodes ?? []);
      setPlayersList(data.playersList ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReferrals();
  }, []);

  const filteredLeaderboard = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leaderboard.filter((row) => {
      if (onlySuspicious && !row.suspiciousFlag) return false;
      if (q) {
        const hay = `${row.username} ${row.fullName} ${row.referralCode} ${row.state}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [leaderboard, search, onlySuspicious]);

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    return referralRecords.filter((rec) => {
      if (onlySuspicious && !rec.suspicious) return false;
      if (q) {
        const hay = `${rec.referredUsername} ${rec.referredFullName} ${rec.referrerUsername} ${rec.referralCodeUsed} ${rec.referredState}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [referralRecords, search, onlySuspicious]);

  async function handleCreatePromo(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!promoCode.trim() || !promoCampaign.trim()) {
      setError("Promo code and campaign name are required.");
      return;
    }
    setSavingPromo(true);
    try {
      const res = await fetch("/api/admin/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: promoCode,
          campaign: promoCampaign,
          bonusNote: promoNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create promo code.");
      } else {
        setPromoCode("");
        setPromoCampaign("");
        setPromoNote("");
        setPromoCodes(data.promoCodes ?? []);
        setToast("Promo code created and activated!");
        setTimeout(() => setToast(""), 4000);
      }
    } finally {
      setSavingPromo(false);
    }
  }

  async function handleTogglePromo(code: string) {
    const res = await fetch("/api/admin/referrals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle_promo", code }),
    });
    const data = await res.json();
    if (res.ok && data.promoCodes) {
      setPromoCodes(data.promoCodes);
    }
  }

  async function handleDeletePromo(code: string) {
    const res = await fetch("/api/admin/referrals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_promo", code }),
    });
    const data = await res.json();
    if (res.ok && data.promoCodes) {
      setPromoCodes(data.promoCodes);
    }
  }

  async function handleAssignReferral(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!referredUserId || !referrerUserId || referredUserId === referrerUserId) {
      setError("Please select two distinct players to link referral attribution.");
      return;
    }
    setLinkingReferral(true);
    try {
      const res = await fetch("/api/admin/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign_referral",
          referredUserId,
          referrerUserId,
        }),
      });
      if (res.ok) {
        setReferredUserId("");
        setReferrerUserId("");
        setToast("Referral attribution linked and leaderboard updated!");
        setTimeout(() => setToast(""), 4000);
        await loadReferrals();
      }
    } finally {
      setLinkingReferral(false);
    }
  }

  async function handleFlagSuspiciousReferrer(userId: string, username: string) {
    await fetch("/api/admin/referrals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "flag_suspicious", userId }),
    });
    setToast(`@${username} suspended and flagged for suspicious referral activity.`);
    setTimeout(() => setToast(""), 4000);
    await loadReferrals();
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Referral &amp; Promo Management
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
              Growth &amp; Attribution
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Track player referrals, monitor the monthly referral leaderboard, manage marketing promo codes, and detect suspicious referral clusters.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/admin/players"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 transition-colors"
          >
            <Users className="size-4 text-slate-400" />
            <span>Back to Players</span>
          </Link>
          <a
            href="/api/admin/referrals?format=csv"
            download
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors"
          >
            <Download className="size-4" />
            <span>Generate Referral Report (CSV)</span>
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

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold"
        >
          <AlertTriangle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="rounded-2xl p-4 bg-[#0f1219] border border-white/10">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Referred Players
          </p>
          <p className="text-2xl font-extrabold text-amber-400 mt-1 tabular-nums">
            {summary.totalReferredPlayers.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {summary.referralAcquisitionSharePct}% of {summary.totalPlayers} total players
          </p>
        </div>

        <div className="rounded-2xl p-4 bg-[#0f1219] border border-white/10">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Active Playing Referrals
          </p>
          <p className="text-2xl font-extrabold text-emerald-400 mt-1 tabular-nums">
            {summary.activeReferredPlayers.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Played at least 1 game session</p>
        </div>

        <div className="rounded-2xl p-4 bg-[#0f1219] border border-white/10">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Active Referrers
          </p>
          <p className="text-2xl font-extrabold text-white mt-1 tabular-nums">
            {summary.activeReferrersCount.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Ambassadors &amp; players</p>
        </div>

        <div className="rounded-2xl p-4 bg-[#0f1219] border border-white/10">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Active Promo Codes
          </p>
          <p className="text-2xl font-extrabold text-indigo-400 mt-1 tabular-nums">
            {promoCodes.filter((c) => c.active).length}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {promoCodes.length} total campaign codes
          </p>
        </div>

        <div className="rounded-2xl p-4 bg-[#0f1219] border border-white/10">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Suspicious Clusters
          </p>
          <p className="text-2xl font-extrabold text-rose-400 mt-1 tabular-nums">
            {summary.suspiciousClustersCount}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Bot / dormant signup flags</p>
        </div>
      </div>

      {/* Section Tabs & Search */}
      <div className="rounded-2xl p-4 bg-[#0f1219] border border-white/10 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: "leaderboard", label: "Monthly Referral Leaderboard", icon: Trophy },
            {
              id: "records",
              label: `All Referral Attribution (${referralRecords.length})`,
              icon: Users,
            },
            { id: "promos", label: `Promo Codes (${promoCodes.length})`, icon: Ticket },
            {
              id: "suspicious",
              label: `Suspicious Activity (${summary.suspiciousClustersCount})`,
              icon: ShieldAlert,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() =>
                  setActiveTab(tab.id as "leaderboard" | "records" | "promos" | "suspicious")
                }
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
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

        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 sm:w-64">
            <Search className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search referrer, code, or state..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>
          <button
            type="button"
            onClick={() => setOnlySuspicious(!onlySuspicious)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
              onlySuspicious
                ? "bg-rose-500/20 border-rose-500/40 text-rose-300"
                : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
            }`}
          >
            Flagged Only
          </button>
        </div>
      </div>

      {/* TAB 1: Monthly Referral Leaderboard */}
      {activeTab === "leaderboard" && (
        <div className="rounded-3xl overflow-hidden bg-[#0f1219] border border-white/10">
          {loading ? (
            <div className="p-12 text-center text-sm text-slate-400">
              Loading referral leaderboard...
            </div>
          ) : filteredLeaderboard.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-400">
              No referrer records match your filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02] text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <th className="px-5 py-3.5">Rank</th>
                    <th className="px-4 py-3.5">Referrer Player</th>
                    <th className="px-4 py-3.5">Referral Code</th>
                    <th className="px-4 py-3.5">Total Referrals</th>
                    <th className="px-4 py-3.5">This Month (30d)</th>
                    <th className="px-4 py-3.5">Active Playing</th>
                    <th className="px-4 py-3.5">Integrity Status</th>
                    <th className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredLeaderboard.map((row) => (
                    <tr key={row.userId} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center justify-center size-7 rounded-lg text-xs font-extrabold ${
                            row.rank === 1
                              ? "bg-amber-500 text-slate-950"
                              : row.rank === 2
                              ? "bg-slate-300 text-slate-950"
                              : row.rank === 3
                              ? "bg-amber-700 text-white"
                              : "bg-white/5 text-slate-300"
                          }`}
                        >
                          #{row.rank}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <p className="font-bold text-white">@{row.username}</p>
                        <p className="text-xs text-slate-400">
                          {row.fullName} · {row.state}
                        </p>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 font-mono text-xs font-bold text-indigo-300">
                          {row.referralCode}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 font-extrabold text-amber-400 tabular-nums">
                        {row.totalReferrals}
                      </td>

                      <td className="px-4 py-3.5 font-semibold text-white tabular-nums">
                        {row.monthlyReferrals}
                      </td>

                      <td className="px-4 py-3.5 text-xs tabular-nums">
                        <span className="font-bold text-emerald-400">
                          {row.activePlayingReferrals}
                        </span>{" "}
                        <span className="text-slate-400">({row.conversionRatePct}%)</span>
                      </td>

                      <td className="px-4 py-3.5">
                        {row.suspiciousFlag ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-500/15 text-rose-300 border border-rose-500/30">
                              <AlertTriangle className="size-3" /> Suspicious
                            </span>
                            {row.suspiciousReason && (
                              <p className="text-[11px] text-rose-300/80 mt-0.5 max-w-xs">
                                {row.suspiciousReason}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-300">
                            Verified Clean
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        {row.status !== "suspended" && row.suspiciousFlag ? (
                          <button
                            type="button"
                            onClick={() => handleFlagSuspiciousReferrer(row.userId, row.username)}
                            className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-bold"
                          >
                            Suspend Referrer
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 capitalize">{row.status}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: All Referral Attribution Records + Link Referral Tool */}
      {activeTab === "records" && (
        <div className="space-y-5">
          {/* Assign Referral Attribution Form */}
          <form
            onSubmit={handleAssignReferral}
            className="rounded-2xl p-5 bg-[#0f1219] border border-white/10 flex flex-col md:flex-row items-stretch md:items-end gap-3"
          >
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Referred Player (New Account)
              </label>
              <select
                value={referredUserId}
                onChange={(e) => setReferredUserId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#161b27] border border-white/10 text-xs text-white"
              >
                <option value="">Select player who was referred...</option>
                {playersList.map((p) => (
                  <option key={p.id} value={p.id}>
                    @{p.username} ({p.fullName})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Referred By (Referrer Ambassador / Player)
              </label>
              <select
                value={referrerUserId}
                onChange={(e) => setReferrerUserId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#161b27] border border-white/10 text-xs text-white"
              >
                <option value="">Select referrer player...</option>
                {playersList.map((p) => (
                  <option key={p.id} value={p.id}>
                    @{p.username} ({p.fullName})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={linkingReferral}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
            >
              <UserPlus className="size-4" />
              <span>{linkingReferral ? "Linking..." : "Record Referral Attribution"}</span>
            </button>
          </form>

          <div className="rounded-3xl overflow-hidden bg-[#0f1219] border border-white/10">
            {filteredRecords.length === 0 ? (
              <div className="p-12 text-center text-sm text-slate-400">
                No referral attribution records yet. Use the form above to link a referral or share referral codes with players.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.02] text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      <th className="px-5 py-3.5">Referred Player</th>
                      <th className="px-4 py-3.5">Referred By</th>
                      <th className="px-4 py-3.5">Code Used</th>
                      <th className="px-4 py-3.5">Sessions Played</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-5 py-3.5 text-right">Signup Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredRecords.map((rec) => (
                      <tr key={rec.id} className="hover:bg-white/[0.02]">
                        <td className="px-5 py-3.5">
                          <p className="font-bold text-white">@{rec.referredUsername}</p>
                          <p className="text-xs text-slate-400">
                            {rec.referredFullName} · {rec.referredState}
                          </p>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-bold text-indigo-300">@{rec.referrerUsername}</p>
                          <p className="text-xs text-slate-400">{rec.referrerFullName}</p>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs font-bold text-amber-300">
                          {rec.referralCodeUsed}
                        </td>
                        <td className="px-4 py-3.5 text-xs font-bold text-white tabular-nums">
                          {rec.sessionsPlayed} sessions
                        </td>
                        <td className="px-4 py-3.5">
                          {rec.suspicious ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-500/15 text-rose-300">
                              Flagged
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-300">
                              {rec.referredStatus}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right text-xs text-slate-400">
                          {new Date(rec.createdAt).toLocaleDateString("en-NG")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Create and Manage Promo Codes */}
      {activeTab === "promos" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="rounded-3xl p-6 bg-[#0f1219] border border-white/10 space-y-4 h-fit">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="size-4 text-amber-400" />
              <span>Create Marketing Promo Code</span>
            </h2>
            <p className="text-xs text-slate-400">
              Create custom promo codes for radio, influencer, or campus ambassador campaigns.
            </p>
            <form onSubmit={handleCreatePromo} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Promo Code *
                </label>
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  placeholder="e.g. LAGOSVIP2026"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs font-mono uppercase text-white placeholder:text-slate-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Campaign Name *
                </label>
                <input
                  type="text"
                  value={promoCampaign}
                  onChange={(e) => setPromoCampaign(e.target.value)}
                  placeholder="e.g. BeatFM Weekend Promo"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-white placeholder:text-slate-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Campaign Perk / Note
                </label>
                <input
                  type="text"
                  value={promoNote}
                  onChange={(e) => setPromoNote(e.target.value)}
                  placeholder="e.g. Tracks BeatFM listener signups"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-white placeholder:text-slate-500"
                />
              </div>
              <button
                type="submit"
                disabled={savingPromo}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
              >
                {savingPromo ? "Saving..." : "Create Promo Code"}
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 rounded-3xl overflow-hidden bg-[#0f1219] border border-white/10">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02] text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <th className="px-5 py-3.5">Code</th>
                    <th className="px-4 py-3.5">Campaign</th>
                    <th className="px-4 py-3.5">Redemptions</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {promoCodes.map((c) => (
                    <tr key={c.code} className="hover:bg-white/[0.02]">
                      <td className="px-5 py-3.5">
                        <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 font-mono text-xs font-bold text-amber-300">
                          {c.code}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-bold text-white text-xs">{c.campaign}</p>
                        <p className="text-[11px] text-slate-400">{c.bonusNote}</p>
                      </td>
                      <td className="px-4 py-3.5 font-bold text-white tabular-nums text-xs">
                        {c.uses} uses
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            c.active
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-white/10 text-slate-400"
                          }`}
                        >
                          {c.active ? "Active" : "Paused"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleTogglePromo(c.code)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300"
                            title={c.active ? "Pause Promo Code" : "Activate Promo Code"}
                          >
                            <Power className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePromo(c.code)}
                            className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300"
                            title="Delete Promo Code"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Identify Suspicious Referral Activity */}
      {activeTab === "suspicious" && (
        <div className="rounded-3xl p-6 bg-[#0f1219] border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldAlert className="size-5 text-rose-400" />
                <span>Suspicious Referral Activity Monitor</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Automatically detects same-day multi-account signups, 0% gameplay conversion farms, and high-risk referrers.
              </p>
            </div>
          </div>

          {leaderboard.filter((l) => l.suspiciousFlag).length === 0 ? (
            <div className="p-8 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="size-4" />
              <span>
                No suspicious referral rings detected. All referral conversions pass anti-fraud heuristics.
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              {leaderboard
                .filter((l) => l.suspiciousFlag)
                .map((row) => (
                  <div
                    key={row.userId}
                    className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div>
                      <p className="font-bold text-white text-sm">
                        @{row.username} ({row.fullName}) · Code:{" "}
                        <span className="font-mono text-amber-300">{row.referralCode}</span>
                      </p>
                      <p className="text-xs text-rose-300 mt-1">{row.suspiciousReason}</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Total Referrals: {row.totalReferrals} · Active Playing:{" "}
                        {row.activePlayingReferrals} ({row.conversionRatePct}%)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleFlagSuspiciousReferrer(row.userId, row.username)}
                      className="px-3.5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-xs shrink-0"
                    >
                      Suspend &amp; Restrict Referrer
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
