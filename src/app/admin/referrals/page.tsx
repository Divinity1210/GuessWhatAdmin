"use client";

import { useEffect, useState, useMemo, useRef } from "react";
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
  RotateCcw,
  Coins,
  Archive,
  X,
} from "lucide-react";

type PrizeTier = {
  rank_from: number;
  rank_to: number;
  amount: number;
};

type ReferralLeaderboardConfig = {
  title: string;
  enabled: boolean;
  cycleNumber: number;
  cycleStartedAt: string | null;
  endsNote: string;
  prizeTiers: PrizeTier[];
  totalPool: number;
  totalWinnerSpots: number;
  updatedAt: string;
};

type ArchiveWinner = {
  rank: number;
  userId: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  state: string;
  referralCode: string;
  verifiedReferrals: number;
  cycleSignups: number;
  prizeAmount: number;
};

type ReferralCycleArchive = {
  id: string;
  cycleNumber: number;
  title: string;
  startedAt: string | null;
  endedAt: string;
  totalPool: number;
  winners: ArchiveWinner[];
};

type LeaderboardRow = {
  rank: number;
  cashRank: number | null;
  userId: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  state: string;
  status: string;
  referralCode: string;
  totalReferrals: number;
  monthlyReferrals: number;
  activePlayingReferrals: number;
  cycleSignups: number;
  cycleVerifiedReferrals: number;
  prizeAmount: number;
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
  inCurrentCycle: boolean;
  isVerified: boolean;
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
  cycleVerifiedTotal: number;
  cyclePool: number;
  eligibleWinnersCount: number;
};

type BasicPlayer = {
  id: string;
  username: string;
  fullName: string;
  referredBy: string | null;
};

function formatOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatTierRange(t: PrizeTier): string {
  return t.rank_from === t.rank_to
    ? formatOrdinal(t.rank_from)
    : `${formatOrdinal(t.rank_from)} to ${formatOrdinal(t.rank_to)}`;
}

export default function ReferralsPage() {
  const [summary, setSummary] = useState<Summary>({
    totalPlayers: 0,
    totalReferredPlayers: 0,
    referralAcquisitionSharePct: 0,
    activeReferredPlayers: 0,
    activeReferrersCount: 0,
    suspiciousClustersCount: 0,
    cycleVerifiedTotal: 0,
    cyclePool: 135000,
    eligibleWinnersCount: 0,
  });
  const [config, setConfig] = useState<ReferralLeaderboardConfig>({
    title: "Referral Cash Challenge #1",
    enabled: true,
    cycleNumber: 1,
    cycleStartedAt: null,
    endsNote: "Top verified referrers win cash prizes",
    prizeTiers: [
      { rank_from: 1, rank_to: 1, amount: 50000 },
      { rank_from: 2, rank_to: 2, amount: 30000 },
      { rank_from: 3, rank_to: 3, amount: 20000 },
      { rank_from: 4, rank_to: 10, amount: 5000 },
    ],
    totalPool: 135000,
    totalWinnerSpots: 10,
    updatedAt: "",
  });
  const [archives, setArchives] = useState<ReferralCycleArchive[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [referralRecords, setReferralRecords] = useState<ReferralRecord[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCodeItem[]>([]);
  const [playersList, setPlayersList] = useState<BasicPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<
    "leaderboard" | "records" | "promos" | "suspicious" | "archives"
  >("leaderboard");
  const [search, setSearch] = useState("");
  const [onlySuspicious, setOnlySuspicious] = useState(false);

  // Prize configuration studio
  const [showPrizeStudio, setShowPrizeStudio] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftEnabled, setDraftEnabled] = useState(true);
  const [draftEndsNote, setDraftEndsNote] = useState("");
  const [draftTiers, setDraftTiers] = useState<PrizeTier[]>([]);
  const [savingConfig, setSavingConfig] = useState(false);

  // Reset confirmation native <dialog>
  const resetDialogRef = useRef<HTMLDialogElement | null>(null);
  const [nextCycleTitle, setNextCycleTitle] = useState("");
  const [resettingCycle, setResettingCycle] = useState(false);

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
      if (data.config) {
        setConfig(data.config);
        setDraftTitle(data.config.title);
        setDraftEnabled(Boolean(data.config.enabled));
        setDraftEndsNote(data.config.endsNote);
        setDraftTiers(
          Array.isArray(data.config.prizeTiers)
            ? data.config.prizeTiers.map((t: PrizeTier) => ({ ...t }))
            : []
        );
      }
      setArchives(data.archives ?? []);
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

  const draftTotalPool = useMemo(() => {
    return draftTiers.reduce((sum, t) => {
      const from = Math.max(1, Number(t.rank_from) || 1);
      const to = Math.max(from, Number(t.rank_to) || from);
      const amt = Math.max(0, Number(t.amount) || 0);
      return sum + (to - from + 1) * amt;
    }, 0);
  }, [draftTiers]);

  const draftWinnerSpots = useMemo(() => {
    return draftTiers.reduce((maxRank, t) => {
      const amt = Math.max(0, Number(t.amount) || 0);
      if (amt <= 0) return maxRank;
      const to = Math.max(Number(t.rank_from) || 1, Number(t.rank_to) || 1);
      return Math.max(maxRank, to);
    }, 0);
  }, [draftTiers]);

  const currentCashWinners = useMemo(
    () => leaderboard.filter((r) => r.cashRank !== null && r.cycleVerifiedReferrals > 0),
    [leaderboard]
  );

  const currentProjectedPayoutTotal = useMemo(
    () => currentCashWinners.reduce((sum, w) => sum + w.prizeAmount, 0),
    [currentCashWinners]
  );

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

  function showSuccess(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 4500);
  }

  async function handleSavePrizeConfig(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (draftTiers.length === 0) {
      setError("Add at least one prize tier before saving.");
      return;
    }
    setSavingConfig(true);
    try {
      const res = await fetch("/api/admin/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_prize_config",
          title: draftTitle,
          enabled: draftEnabled,
          endsNote: draftEndsNote,
          prizeTiers: draftTiers,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save prize configuration.");
      } else {
        setShowPrizeStudio(false);
        showSuccess("Referral cash prize tiers updated across Player and Admin leaderboards.");
        await loadReferrals();
      }
    } finally {
      setSavingConfig(false);
    }
  }

  function openResetModal() {
    const nextNum = config.cycleNumber + 1;
    const suggestedTitle = /#\d+\b/.test(config.title)
      ? config.title.replace(/#\d+\b/, `#${nextNum}`)
      : `Referral Cash Challenge #${nextNum}`;
    setNextCycleTitle(suggestedTitle);
    resetDialogRef.current?.showModal();
  }

  async function handleConfirmReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResettingCycle(true);
    try {
      const res = await fetch("/api/admin/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset_leaderboard",
          nextTitle: nextCycleTitle,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to reset referral leaderboard.");
      } else {
        resetDialogRef.current?.close("confirmed");
        showSuccess(
          `Cycle #${config.cycleNumber} archived (${data.archivedCount ?? 0} referrers saved). New cycle started at 0.`
        );
        await loadReferrals();
      }
    } finally {
      setResettingCycle(false);
    }
  }

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
        showSuccess("Promo code created and activated.");
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
        showSuccess("Referral attribution linked and leaderboard updated.");
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
    showSuccess(`@${username} suspended and flagged for suspicious referral activity.`);
    await loadReferrals();
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Referral Cash Leaderboard &amp; Promo Control
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
              Cycle #{config.cycleNumber}
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Set referral cash prizes by rank, track verified playing referrals, reset cycles cleanly with archived winners, and audit promo codes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowPrizeStudio((prev) => !prev)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
          >
            <Coins className="size-4" />
            <span>{showPrizeStudio ? "Close Prize Editor" : "Configure Cash Prizes"}</span>
          </button>
          <button
            type="button"
            onClick={openResetModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-300 font-bold text-xs transition-colors"
          >
            <RotateCcw className="size-4" />
            <span>Reset Leaderboard</span>
          </button>
          <Link
            href="/admin/players"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 transition-colors"
          >
            <Users className="size-4 text-slate-400" />
            <span>Players</span>
          </Link>
          <a
            href="/api/admin/referrals?format=csv"
            download
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors"
          >
            <Download className="size-4" />
            <span>Export CSV</span>
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

      {/* Collapsible Cash Prize Configuration Studio */}
      {showPrizeStudio && (
        <form
          onSubmit={handleSavePrizeConfig}
          className="rounded-3xl p-5 sm:p-6 bg-[#0f1219] border border-amber-500/35 space-y-5 shadow-2xl"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                Cash Prize Configuration
              </span>
              <h2 className="text-lg font-extrabold text-white">
                {config.title} Prize Structure
              </h2>
              <p className="text-xs text-slate-400">
                Each ranked winner on the Player Referral Leaderboard displays their projected cash amount prominently beside their rank.
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-[11px] uppercase tracking-wider text-slate-400">
                Configured Total Pool
              </p>
              <p className="text-2xl font-extrabold text-emerald-400 font-mono tabular-nums">
                ₦{draftTotalPool.toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-400">
                {draftWinnerSpots} paid winner spot{draftWinnerSpots === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="ref-cycle-title"
                className="block text-xs font-semibold text-slate-300 mb-1.5"
              >
                Challenge Title
              </label>
              <input
                id="ref-cycle-title"
                type="text"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-white focus:border-amber-500 focus:outline-none"
                placeholder="e.g. Referral Cash Challenge #1"
              />
            </div>

            <div>
              <label
                htmlFor="ref-cycle-note"
                className="block text-xs font-semibold text-slate-300 mb-1.5"
              >
                Qualification / Closing Note
              </label>
              <input
                id="ref-cycle-note"
                type="text"
                value={draftEndsNote}
                onChange={(e) => setDraftEndsNote(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-white focus:border-amber-500 focus:outline-none"
                placeholder="e.g. Friends must play at least 1 round to qualify"
              />
            </div>

            <div>
              <label
                htmlFor="ref-cycle-status"
                className="block text-xs font-semibold text-slate-300 mb-1.5"
              >
                Cash Rewards Status
              </label>
              <select
                id="ref-cycle-status"
                value={draftEnabled ? "enabled" : "paused"}
                onChange={(e) => setDraftEnabled(e.target.value === "enabled")}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#161b27] border border-white/10 text-xs font-semibold text-white focus:border-amber-500 focus:outline-none"
              >
                <option value="enabled">Active (Cash Prizes Displayed Live)</option>
                <option value="paused">Paused (Show Referrals Count Only)</option>
              </select>
            </div>
          </div>

          <fieldset className="space-y-3 border border-white/10 rounded-2xl p-4 bg-[#0b0e14]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <legend className="text-xs font-bold uppercase tracking-wider text-amber-300">
                Rank Prize Tiers (NGN)
              </legend>
              <button
                type="button"
                onClick={() => {
                  const lastTo =
                    draftTiers.length > 0
                      ? Math.max(...draftTiers.map((t) => Number(t.rank_to) || 1))
                      : 0;
                  setDraftTiers([
                    ...draftTiers,
                    { rank_from: lastTo + 1, rank_to: lastTo + 1, amount: 5000 },
                  ]);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold"
              >
                <Plus className="size-3.5" />
                <span>Add Prize Tier</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {draftTiers.map((tier, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.02] border border-white/10"
                >
                  <div className="col-span-3 sm:col-span-3">
                    <label
                      htmlFor={`tier-from-${idx}`}
                      className="block text-[10px] uppercase text-slate-400 mb-1"
                    >
                      From Rank
                    </label>
                    <input
                      id={`tier-from-${idx}`}
                      type="number"
                      min={1}
                      value={tier.rank_from}
                      onChange={(e) => {
                        const val = Math.max(1, Number(e.target.value) || 1);
                        const next = [...draftTiers];
                        next[idx] = {
                          ...next[idx],
                          rank_from: val,
                          rank_to: Math.max(val, next[idx].rank_to),
                        };
                        setDraftTiers(next);
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-xs font-mono text-white"
                    />
                  </div>

                  <div className="col-span-3 sm:col-span-3">
                    <label
                      htmlFor={`tier-to-${idx}`}
                      className="block text-[10px] uppercase text-slate-400 mb-1"
                    >
                      To Rank
                    </label>
                    <input
                      id={`tier-to-${idx}`}
                      type="number"
                      min={tier.rank_from}
                      value={tier.rank_to}
                      onChange={(e) => {
                        const val = Math.max(tier.rank_from, Number(e.target.value) || tier.rank_from);
                        const next = [...draftTiers];
                        next[idx] = { ...next[idx], rank_to: val };
                        setDraftTiers(next);
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-xs font-mono text-white"
                    />
                  </div>

                  <div className="col-span-4 sm:col-span-4">
                    <label
                      htmlFor={`tier-amt-${idx}`}
                      className="block text-[10px] uppercase text-slate-400 mb-1"
                    >
                      Cash Prize Each (₦)
                    </label>
                    <input
                      id={`tier-amt-${idx}`}
                      type="number"
                      min={0}
                      step={500}
                      value={tier.amount}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value) || 0);
                        const next = [...draftTiers];
                        next[idx] = { ...next[idx], amount: val };
                        setDraftTiers(next);
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-xs font-mono font-bold text-emerald-300"
                    />
                  </div>

                  <div className="col-span-2 flex justify-end pt-4">
                    <button
                      type="button"
                      disabled={draftTiers.length <= 1}
                      onClick={() => setDraftTiers(draftTiers.filter((_, i) => i !== idx))}
                      aria-label={`Remove tier ${idx + 1}`}
                      className="p-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 disabled:opacity-35 text-rose-300"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => setShowPrizeStudio(false)}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingConfig}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
            >
              {savingConfig ? "Saving..." : "Save Prize Structure"}
            </button>
          </div>
        </form>
      )}

      {/* Active Cycle Summary Banner */}
      <div className="rounded-2xl p-4 bg-[#0f1219] border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-white">{config.title}</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                config.enabled
                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                  : "bg-white/10 text-slate-400"
              }`}
            >
              {config.enabled ? "Cash Prizes Active" : "Prizes Paused"}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            {config.endsNote}.{" "}
            {config.cycleStartedAt
              ? `Cycle started ${new Date(config.cycleStartedAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}.`
              : "Counting all verified playing referrals since launch."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {config.prizeTiers.slice(0, 4).map((tier, idx) => (
            <span
              key={idx}
              className="px-2.5 py-1 rounded-xl bg-white/[0.04] border border-white/10 text-[11px] font-mono text-slate-200"
            >
              {formatTierRange(tier)}: <strong className="text-emerald-300">₦{tier.amount.toLocaleString()}</strong>
            </span>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="rounded-2xl p-4 bg-[#0f1219] border border-white/10">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Cycle Prize Pool
          </p>
          <p className="text-2xl font-extrabold text-emerald-400 mt-1 tabular-nums">
            ₦{config.totalPool.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Top {config.totalWinnerSpots} paid spot{config.totalWinnerSpots === 1 ? "" : "s"}
          </p>
        </div>

        <div className="rounded-2xl p-4 bg-[#0f1219] border border-white/10">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Cycle Verified Refs
          </p>
          <p className="text-2xl font-extrabold text-amber-400 mt-1 tabular-nums">
            {summary.cycleVerifiedTotal.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {summary.eligibleWinnersCount} ranked referrer{summary.eligibleWinnersCount === 1 ? "" : "s"}
          </p>
        </div>

        <div className="rounded-2xl p-4 bg-[#0f1219] border border-white/10">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Lifetime Referred
          </p>
          <p className="text-2xl font-extrabold text-white mt-1 tabular-nums">
            {summary.totalReferredPlayers.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {summary.activeReferredPlayers} played at least 1 round
          </p>
        </div>

        <div className="rounded-2xl p-4 bg-[#0f1219] border border-white/10">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Active Promo Codes
          </p>
          <p className="text-2xl font-extrabold text-sky-400 mt-1 tabular-nums">
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
            { id: "leaderboard", label: "Referral Cash Leaderboard", icon: Trophy },
            {
              id: "records",
              label: `All Referral Attribution (${referralRecords.length})`,
              icon: Users,
            },
            { id: "archives", label: `Past Cycles (${archives.length})`, icon: Archive },
            { id: "promos", label: `Promo Codes (${promoCodes.length})`, icon: Ticket },
            {
              id: "suspicious",
              label: `Suspicious (${summary.suspiciousClustersCount})`,
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
                  setActiveTab(
                    tab.id as "leaderboard" | "records" | "promos" | "suspicious" | "archives"
                  )
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

      {/* TAB 1: Referral Cash Leaderboard */}
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
            <div
              tabIndex={0}
              role="region"
              aria-labelledby="admin-ref-lb-caption"
              className="overflow-x-auto"
            >
              <table className="w-full text-left text-sm">
                <caption id="admin-ref-lb-caption" className="sr-only">
                  Active cycle referral cash prize leaderboard
                </caption>
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02] text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <th className="px-5 py-3.5">Rank</th>
                    <th className="px-4 py-3.5">Cash Prize (₦)</th>
                    <th className="px-4 py-3.5">Referrer Player</th>
                    <th className="px-4 py-3.5">Referral Code</th>
                    <th className="px-4 py-3.5">Cycle Verified</th>
                    <th className="px-4 py-3.5">Lifetime Active / Total</th>
                    <th className="px-4 py-3.5">Integrity</th>
                    <th className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredLeaderboard.map((row) => (
                    <tr key={row.userId} className="hover:bg-white/[0.02] transition-colors">
                      <th scope="row" className="px-5 py-3.5 text-left font-normal">
                        <span
                          className={`inline-flex items-center justify-center min-w-8 h-7 px-2 rounded-lg text-xs font-extrabold ${
                            row.cashRank === 1
                              ? "bg-amber-500 text-slate-950"
                              : row.cashRank === 2
                              ? "bg-slate-300 text-slate-950"
                              : row.cashRank === 3
                              ? "bg-amber-700 text-white"
                              : "bg-white/5 text-slate-300"
                          }`}
                        >
                          {row.cashRank ? formatOrdinal(row.cashRank) : `#${row.rank}`}
                        </span>
                      </th>

                      <td className="px-4 py-3.5 font-mono font-extrabold tabular-nums">
                        {row.prizeAmount > 0 ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs">
                            ₦{row.prizeAmount.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">-</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <p className="font-bold text-white">@{row.username}</p>
                        <p className="text-xs text-slate-400">
                          {row.fullName} · {row.state}
                        </p>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-500/30 font-mono text-xs font-bold text-sky-300">
                          {row.referralCode}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 tabular-nums">
                        <span className="font-extrabold text-amber-400 text-base">
                          {row.cycleVerifiedReferrals}
                        </span>
                        {row.cycleSignups > row.cycleVerifiedReferrals && (
                          <span className="ml-1.5 text-[11px] text-slate-400">
                            ({row.cycleSignups} signups)
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-xs tabular-nums">
                        <span className="font-bold text-emerald-400">
                          {row.activePlayingReferrals}
                        </span>{" "}
                        <span className="text-slate-400">
                          / {row.totalReferrals} ({row.conversionRatePct}%)
                        </span>
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
              <div
                tabIndex={0}
                role="region"
                aria-labelledby="admin-ref-records-caption"
                className="overflow-x-auto"
              >
                <table className="w-full text-left text-sm">
                  <caption id="admin-ref-records-caption" className="sr-only">
                    Individual referral attribution records
                  </caption>
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.02] text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      <th className="px-5 py-3.5">Referred Player</th>
                      <th className="px-4 py-3.5">Referred By</th>
                      <th className="px-4 py-3.5">Code Used</th>
                      <th className="px-4 py-3.5">Sessions Played</th>
                      <th className="px-4 py-3.5">Cycle Status</th>
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
                          <p className="font-bold text-sky-300">@{rec.referrerUsername}</p>
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
                          ) : rec.isVerified ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-300">
                              Verified (Cycle)
                            </span>
                          ) : !rec.inCurrentCycle ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-white/10 text-slate-400">
                              Past Cycle
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/15 text-amber-300">
                              Pending 1st Game
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

      {/* TAB 3: Past Archived Referral Cycles */}
      {activeTab === "archives" && (
        <div className="space-y-4">
          {archives.length === 0 ? (
            <div className="rounded-3xl p-10 bg-[#0f1219] border border-white/10 text-center space-y-2">
              <p className="text-sm font-bold text-white">No archived referral cycles yet</p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Whenever you click <strong>Reset Leaderboard</strong>, the current cycle&apos;s top verified referrers and their cash prize amounts are archived here before starting a new cycle from 0.
              </p>
            </div>
          ) : (
            archives.map((arc) => (
              <div
                key={arc.id}
                className="rounded-3xl p-5 sm:p-6 bg-[#0f1219] border border-white/10 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-[11px] font-bold text-slate-200">
                        Cycle #{arc.cycleNumber}
                      </span>
                      <h2 className="text-base font-bold text-white">{arc.title}</h2>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Ended {new Date(arc.endedAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] uppercase text-slate-400">Cycle Pool</p>
                    <p className="font-mono text-base font-extrabold text-emerald-400">
                      ₦{arc.totalPool.toLocaleString()}
                    </p>
                  </div>
                </div>

                {arc.winners.length === 0 ? (
                  <p className="text-xs text-slate-400">No verified referrals were recorded in this cycle.</p>
                ) : (
                  <div
                    tabIndex={0}
                    role="region"
                    aria-label={`Archived winners for ${arc.title}`}
                    className="overflow-x-auto"
                  >
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b border-white/10 text-slate-400 text-[11px] uppercase">
                          <th className="py-2 pr-3">Rank</th>
                          <th className="py-2 pr-3">Prize (₦)</th>
                          <th className="py-2 pr-3">Winner</th>
                          <th className="py-2 text-right">Verified Refs</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {arc.winners.map((w) => (
                          <tr key={`${arc.id}_${w.userId}`}>
                            <td className="py-2.5 pr-3 font-bold text-amber-300">
                              {formatOrdinal(w.rank)}
                            </td>
                            <td className="py-2.5 pr-3 font-mono font-bold text-emerald-400">
                              ₦{w.prizeAmount.toLocaleString()}
                            </td>
                            <td className="py-2.5 pr-3 font-semibold text-white">
                              @{w.username} <span className="text-slate-400 font-normal">({w.state})</span>
                            </td>
                            <td className="py-2.5 text-right font-mono font-bold text-slate-200">
                              {w.verifiedReferrals}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 4: Create and Manage Promo Codes */}
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

      {/* TAB 5: Identify Suspicious Referral Activity */}
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

      {/* Native <dialog> Confirmation Modal for Resetting Referral Leaderboard */}
      <dialog
        ref={resetDialogRef}
        aria-labelledby="reset-ref-title"
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl bg-[#0f1219] border border-rose-500/40 p-6 text-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[11px] font-bold uppercase">
              New Referral Cycle
            </span>
            <h2 id="reset-ref-title" className="text-lg font-extrabold text-white mt-1.5">
              Archive &amp; Reset Referral Leaderboard?
            </h2>
          </div>
          <button
            type="button"
            onClick={() => resetDialogRef.current?.close("dismissed")}
            aria-label="Close reset dialog"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleConfirmReset} className="space-y-4">
          <div className="rounded-2xl p-3.5 bg-white/[0.03] border border-white/10 space-y-1 text-xs">
            <p className="font-bold text-white">{config.title}</p>
            <p className="text-slate-300">
              <strong>{currentCashWinners.length}</strong> ranked referrer(s) totaling{" "}
              <strong className="text-emerald-400">
                ₦{currentProjectedPayoutTotal.toLocaleString()}
              </strong>{" "}
              will be archived under Past Cycles.
            </p>
            <p className="text-slate-400">
              All lifetime referral links stay intact, while the active cycle count resets to 0 for new signups starting now.
            </p>
          </div>

          <div>
            <label
              htmlFor="next-cycle-title"
              className="block text-xs font-semibold text-slate-300 mb-1.5"
            >
              Next Cycle Title
            </label>
            <input
              id="next-cycle-title"
              type="text"
              value={nextCycleTitle}
              onChange={(e) => setNextCycleTitle(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white focus:border-amber-500 focus:outline-none"
              placeholder={`Referral Cash Challenge #${config.cycleNumber + 1}`}
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
            <button
              type="button"
              autoFocus
              disabled={resettingCycle}
              onClick={() => resetDialogRef.current?.close("cancel")}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={resettingCycle}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 text-xs font-extrabold"
            >
              <RotateCcw className="size-3.5" />
              <span>{resettingCycle ? "Resetting..." : "Archive Winners & Reset to 0"}</span>
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
