"use client";

import { useState, useEffect, useCallback } from "react";

type PrizeTier = {
  rank_from: number;
  rank_to: number;
  amount: number;
};

type PositionPrize = {
  position: number;
  amount: number;
};

function expandTiersToPositions(tiers: PrizeTier[], count?: number): PositionPrize[] {
  const safeTiers = Array.isArray(tiers) && tiers.length > 0 ? tiers : PRESET_36_TIERS;
  const maxRank =
    count !== undefined && count > 0
      ? count
      : Math.max(...safeTiers.map((t) => Number(t.rank_to ?? 0)), 36);
  const result: PositionPrize[] = [];
  for (let p = 1; p <= maxRank; p++) {
    const matched = safeTiers.find(
      (t) => p >= Number(t.rank_from) && p <= Number(t.rank_to)
    );
    const fallbackAmt = safeTiers[safeTiers.length - 1]?.amount ?? 10000;
    result.push({
      position: p,
      amount: matched ? Number(matched.amount) : Number(fallbackAmt),
    });
  }
  return result;
}

function compressPositionsToTiers(positions: PositionPrize[]): PrizeTier[] {
  const tiers: PrizeTier[] = [];
  const sorted = [...positions].sort((a, b) => a.position - b.position);
  for (const item of sorted) {
    const amt = Math.max(0, Number(item.amount) || 0);
    const last = tiers[tiers.length - 1];
    if (last && last.amount === amt && last.rank_to === item.position - 1) {
      last.rank_to = item.position;
    } else {
      tiers.push({
        rank_from: item.position,
        rank_to: item.position,
        amount: amt,
      });
    }
  }
  return tiers;
}

type WinnerRow = {
  entryId: string;
  userId: string;
  position: number;
  username: string;
  fullName: string;
  state: string;
  gender: string;
  points: number;
  totalTimeMs: number;
  prizeAllocated: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
  paymentStatus: "Pending" | "Paid" | "Failed";
  isPotentialWinner: boolean;
};

type SessionMeta = {
  id: string;
  name: string;
  status: string;
  startsAt: string;
  endsAt: string;
  prizePool: number;
};

const PRESET_36_TIERS: PrizeTier[] = [
  { rank_from: 1, rank_to: 1, amount: 100000 },
  { rank_from: 2, rank_to: 2, amount: 50000 },
  { rank_from: 3, rank_to: 3, amount: 20000 },
  { rank_from: 4, rank_to: 36, amount: 10000 },
];

const PRESET_49_TIERS: PrizeTier[] = [
  { rank_from: 1, rank_to: 1, amount: 100000 },
  { rank_from: 2, rank_to: 2, amount: 50000 },
  { rank_from: 3, rank_to: 3, amount: 20000 },
  { rank_from: 4, rank_to: 23, amount: 10000 },
  { rank_from: 24, rank_to: 49, amount: 5000 },
];

function formatOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatTimeShort(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  const remMs = ms % 1000;
  return `${mins}:${String(secs).padStart(2, "0")}.${String(remMs).padStart(3, "0")}`;
}

export default function AdminWinnersPage() {
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [activeSession, setActiveSession] = useState<{
    id: string;
    name: string;
    status: string;
    startsAt: string;
    endsAt: string;
    prizePool: number;
    prizeStructure: PrizeTier[];
    maxWinnerRank: number;
  } | null>(null);
  const [summary, setSummary] = useState<{
    winnersCount: number;
    maxWinnerSlots: number;
    configuredPool: number;
    totalAllocated: number;
    totalPaid: number;
    totalPending: number;
    paidCount: number;
    pendingCount: number;
    failedCount: number;
  } | null>(null);
  const [winners, setWinners] = useState<WinnerRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "Pending" | "Paid" | "Failed">("all");
  const [search, setSearch] = useState<string>("");
  const [toast, setToast] = useState<string>("");

  // Prize Distribution Configurator state
  const [showPrizeConfigurator, setShowPrizeConfigurator] = useState<boolean>(true);
  const [tiers, setTiers] = useState<PrizeTier[]>(PRESET_36_TIERS);
  const [numWinnersInput, setNumWinnersInput] = useState<number>(36);
  const [positionPrizes, setPositionPrizes] = useState<PositionPrize[]>(() =>
    expandTiersToPositions(PRESET_36_TIERS, 36)
  );
  const [rangeFrom, setRangeFrom] = useState<string>("4");
  const [rangeTo, setRangeTo] = useState<string>("36");
  const [rangeAmount, setRangeAmount] = useState<string>("10000");
  const [savingStructure, setSavingStructure] = useState<boolean>(false);

  // Inline table position prize editor state
  const [editingPositionNum, setEditingPositionNum] = useState<number | null>(null);
  const [editingPositionAmount, setEditingPositionAmount] = useState<string>("");
  const [savingPositionPrize, setSavingPositionPrize] = useState<boolean>(false);

  // Bank Account Editor modal state
  const [editingBankWinner, setEditingBankWinner] = useState<WinnerRow | null>(null);
  const [bankNameInput, setBankNameInput] = useState<string>("");
  const [accountNumberInput, setAccountNumberInput] = useState<string>("");
  const [accountNameInput, setAccountNameInput] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const sid = sp.get("sessionId");
      if (sid) setSelectedSessionId(sid);
    }
  }, []);

  const showToastMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4500);
  };

  const fetchWinners = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedSessionId) params.set("sessionId", selectedSessionId);
      const res = await fetch(`/api/admin/winners?${params.toString()}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions ?? []);
        setActiveSession(data.activeSession ?? null);
        if (!selectedSessionId && data.activeSession?.id) {
          setSelectedSessionId(data.activeSession.id);
        }
        if (data.activeSession?.prizeStructure) {
          const loadedTiers = data.activeSession.prizeStructure as PrizeTier[];
          setTiers(loadedTiers);
          const expanded = expandTiersToPositions(loadedTiers);
          setPositionPrizes(expanded);
          setNumWinnersInput(expanded.length);
          setRangeTo(String(expanded.length));
        }
        setSummary(data.summary ?? null);
        setWinners(data.winners ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch winners:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedSessionId]);

  useEffect(() => {
    fetchWinners();
  }, [fetchWinners]);

  const currentIdx = sessions.findIndex((s) => s.id === (selectedSessionId || activeSession?.id));
  const goPrevSession = () => {
    if (currentIdx > 0) setSelectedSessionId(sessions[currentIdx - 1].id);
  };
  const goNextSession = () => {
    if (currentIdx >= 0 && currentIdx < sessions.length - 1) {
      setSelectedSessionId(sessions[currentIdx + 1].id);
    }
  };

  const handlePaymentStatusChange = async (
    userId: string,
    nextStatus: "Pending" | "Paid" | "Failed"
  ) => {
    const sid = selectedSessionId || activeSession?.id;
    if (!sid) return;
    await fetch("/api/admin/winners", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sid,
        action: "update_payment_status",
        userId,
        paymentStatus: nextStatus,
      }),
    });
    showToastMsg(`Payment status updated to ${nextStatus}`);
    await fetchWinners();
  };

  const handleBulkPaymentStatus = async (nextStatus: "Paid" | "Pending") => {
    const sid = selectedSessionId || activeSession?.id;
    if (!sid) return;
    await fetch("/api/admin/winners", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sid,
        action: "bulk_payment_status",
        paymentStatus: nextStatus,
      }),
    });
    showToastMsg(`All session winners marked as ${nextStatus}!`);
    await fetchWinners();
  };

  const handleNumWinnersChange = (nextCountRaw: number) => {
    const nextCount = Math.max(1, Math.min(200, Math.floor(nextCountRaw || 1)));
    setNumWinnersInput(nextCount);
    setPositionPrizes((prev) => {
      const next: PositionPrize[] = [];
      const fallbackAmt = prev.length > 0 ? prev[prev.length - 1].amount : 10000;
      for (let p = 1; p <= nextCount; p++) {
        const existing = prev.find((x) => x.position === p);
        next.push({
          position: p,
          amount: existing ? existing.amount : fallbackAmt,
        });
      }
      setTiers(compressPositionsToTiers(next));
      return next;
    });
    setRangeTo(String(nextCount));
  };

  const handlePositionPrizeInput = (pos: number, amtVal: number) => {
    const safeAmt = Math.max(0, Number(amtVal) || 0);
    setPositionPrizes((prev) => {
      const next = prev.map((item) =>
        item.position === pos ? { ...item, amount: safeAmt } : item
      );
      setTiers(compressPositionsToTiers(next));
      return next;
    });
  };

  const handleApplyRangePrize = () => {
    const fromP = Math.max(1, Math.floor(Number(rangeFrom) || 1));
    const toP = Math.min(
      numWinnersInput,
      Math.max(fromP, Math.floor(Number(rangeTo) || numWinnersInput))
    );
    const amt = Math.max(0, Number(rangeAmount) || 0);
    setPositionPrizes((prev) => {
      const next = prev.map((item) =>
        item.position >= fromP && item.position <= toP
          ? { ...item, amount: amt }
          : item
      );
      setTiers(compressPositionsToTiers(next));
      return next;
    });
  };

  const handleSaveSinglePositionPrize = async (position: number, amount: number) => {
    const sid = selectedSessionId || activeSession?.id;
    if (!sid) return;
    setSavingPositionPrize(true);
    try {
      const res = await fetch("/api/admin/winners", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sid,
          action: "update_position_prize",
          position,
          amount: Math.max(0, Number(amount) || 0),
        }),
      });
      if (res.ok) {
        setEditingPositionNum(null);
        showToastMsg(
          `Updated ${formatOrdinal(position)} position prize to ₦${Number(amount).toLocaleString()}!`
        );
        await fetchWinners();
      }
    } finally {
      setSavingPositionPrize(false);
    }
  };

  const handleSavePrizeDistribution = async (customTiers?: PrizeTier[]) => {
    const sid = selectedSessionId || activeSession?.id;
    if (!sid) return;
    const targetTiers = customTiers ?? compressPositionsToTiers(positionPrizes);
    const totalPool = targetTiers.reduce(
      (sum, t) =>
        sum + (Number(t.rank_to) - Number(t.rank_from) + 1) * Number(t.amount ?? 0),
      0
    );

    setSavingStructure(true);
    try {
      const res = await fetch("/api/admin/winners", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sid,
          action: "configure_prize_distribution",
          prizePool: totalPool,
          prizeStructure: targetTiers,
        }),
      });
      if (res.ok) {
        setTiers(targetTiers);
        const expanded = expandTiersToPositions(targetTiers);
        setPositionPrizes(expanded);
        setNumWinnersInput(expanded.length);
        showToastMsg(
          `Saved ${expanded.length} winners & per-position prizes (₦${totalPool.toLocaleString()} total pool)!`
        );
        await fetchWinners();
      }
    } finally {
      setSavingStructure(false);
    }
  };

  const handleSaveBankDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBankWinner) return;
    await fetch("/api/admin/winners", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_bank",
        userId: editingBankWinner.userId,
        bankName: bankNameInput,
        accountNumber: accountNumberInput,
        accountName: accountNameInput,
      }),
    });
    setEditingBankWinner(null);
    showToastMsg(`Updated bank account details for @${editingBankWinner.username}`);
    await fetchWinners();
  };

  const filteredWinners = winners.filter((w) => {
    if (statusFilter !== "all" && w.paymentStatus !== statusFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        w.username.toLowerCase().includes(q) ||
        w.fullName.toLowerCase().includes(q) ||
        w.bankName.toLowerCase().includes(q) ||
        w.accountNumber.includes(q)
      );
    }
    return true;
  });

  const currentSessionId = selectedSessionId || activeSession?.id || "";

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-xs font-semibold text-emerald-300 mb-2">
            Pages 20 &amp; 40 · Winners &amp; Prize Management
          </span>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Winners, Prize Distribution &amp; Manual Payouts
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            View potential winners for ongoing sessions and final winners for completed sessions, configure 36-winner or 49-winner ₦500k prize distributions, manage bank payouts, and export CSV reports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowPrizeConfigurator(!showPrizeConfigurator)}
            className="px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold text-xs sm:text-sm transition-colors"
          >
            {showPrizeConfigurator
              ? "Hide Prize Configurator"
              : "⚙ Configure Prize Distribution (Page 20)"}
          </button>
          <a
            href={`/api/admin/winners?sessionId=${encodeURIComponent(
              currentSessionId
            )}&format=csv`}
            className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs sm:text-sm transition-colors"
          >
            ⬇ Export Winners &amp; Prize CSV
          </a>
        </div>
      </div>

      {toast && (
        <div className="rounded-2xl px-4 py-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
          ✓ {toast}
        </div>
      )}

      {/* Session-to-Session Selector (Potential Winners vs Previous Winners) */}
      <div className="rounded-2xl p-4 bg-[#0f1219] border border-white/10 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Session-to-Session Winners Selector:
            </span>
            {activeSession && (
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase ${
                  activeSession.status === "completed"
                    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                    : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                }`}
              >
                {activeSession.status === "completed"
                  ? "Previous Winners (Completed Session)"
                  : "Potential Winners (Live Active Session)"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={goPrevSession}
              disabled={currentIdx <= 0}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 text-xs font-bold text-slate-200 border border-white/10"
            >
              ◀ Prev Session
            </button>
            <button
              onClick={goNextSession}
              disabled={currentIdx < 0 || currentIdx >= sessions.length - 1}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 text-xs font-bold text-slate-200 border border-white/10"
            >
              Next Session ▶
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {sessions.map((s) => {
            const isSelected = currentSessionId === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSelectedSessionId(s.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-2 ${
                  isSelected
                    ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20"
                    : "bg-white/[0.03] text-slate-300 hover:bg-white/[0.08] border border-white/10"
                }`}
              >
                <span>{s.name}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] uppercase ${
                    isSelected ? "bg-black/25 text-white" : "bg-white/10 text-slate-300"
                  }`}
                >
                  {s.status === "completed" ? "Final Winners" : "Potential Winners"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Configure Number of Winners & Per-Position Prize Money Panel */}
      {showPrizeConfigurator && (
        <div
          id="prize-configurator-panel"
          className="rounded-3xl p-6 md:p-8 bg-[#0f1219] border border-amber-500/40 space-y-6 shadow-2xl"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Page 20 · Editable Winners Count &amp; Per-Position Prize Money
              </span>
              <h2 className="text-xl font-extrabold text-white mt-0.5">
                Edit Number of Winners &amp; Prize Money per Position — {activeSession?.name}
              </h2>
              <p className="text-xs text-slate-400">
                Set the exact number of winners and edit the prize money (₦) for each individual position (1st through {formatOrdinal(numWinnersInput)}).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={savingStructure}
                onClick={() => handleSavePrizeDistribution(PRESET_36_TIERS)}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold"
              >
                Preset: 36 Winners (₦500k)
              </button>
              <button
                type="button"
                disabled={savingStructure}
                onClick={() => handleSavePrizeDistribution(PRESET_49_TIERS)}
                className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold"
              >
                Preset: 49 Winners (₦500k)
              </button>
            </div>
          </div>

          {/* Step 1: Edit Number of Winners & Quick Range Setter */}
          <fieldset className="rounded-2xl p-4 bg-white/[0.02] border border-white/10 space-y-4">
            <legend className="px-2 text-xs font-extrabold uppercase tracking-wider text-emerald-300">
              1. Number of Winners &amp; Bulk Range Helper
            </legend>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-3">
                <label
                  htmlFor="winners-total-count"
                  className="block text-xs font-bold uppercase tracking-wider text-emerald-300 mb-1.5"
                >
                  Total Number of Winners *
                </label>
                <input
                  id="winners-total-count"
                  name="numWinners"
                  type="number"
                  min={1}
                  max={200}
                  inputMode="numeric"
                  value={numWinnersInput}
                  onChange={(e) => handleNumWinnersChange(Number(e.target.value))}
                  className="w-full rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2 text-sm font-black font-mono text-emerald-300"
                />
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor="winners-range-from"
                  className="block text-[11px] font-semibold text-slate-400 mb-1.5"
                >
                  From Position
                </label>
                <input
                  id="winners-range-from"
                  type="number"
                  min={1}
                  max={numWinnersInput}
                  inputMode="numeric"
                  value={rangeFrom}
                  onChange={(e) => setRangeFrom(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#0a0d14] px-3 py-2 text-xs font-mono text-white"
                />
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor="winners-range-to"
                  className="block text-[11px] font-semibold text-slate-400 mb-1.5"
                >
                  To Position
                </label>
                <input
                  id="winners-range-to"
                  type="number"
                  min={1}
                  max={numWinnersInput}
                  inputMode="numeric"
                  value={rangeTo}
                  onChange={(e) => setRangeTo(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#0a0d14] px-3 py-2 text-xs font-mono text-white"
                />
              </div>

              <div className="md:col-span-3">
                <label
                  htmlFor="winners-range-amount"
                  className="block text-[11px] font-semibold text-slate-400 mb-1.5"
                >
                  Prize Money (₦)
                </label>
                <input
                  id="winners-range-amount"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={rangeAmount}
                  onChange={(e) => setRangeAmount(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#0a0d14] px-3 py-2 text-xs font-mono font-bold text-amber-300"
                />
              </div>

              <div className="md:col-span-2">
                <button
                  type="button"
                  onClick={handleApplyRangePrize}
                  className="w-full px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-extrabold"
                >
                  Apply to {rangeFrom}–{rangeTo}
                </button>
              </div>
            </div>
          </fieldset>

          {/* Step 2: Individual Position Prize Money Editor (1st .. Nth Position) */}
          <fieldset className="rounded-2xl p-4 bg-white/[0.02] border border-amber-500/30 space-y-3">
            <legend className="px-2 text-xs font-extrabold uppercase tracking-wider text-amber-300">
              2. Edit Prize Money for Each Individual Position (1st – {formatOrdinal(numWinnersInput)})
            </legend>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
              <span>
                Every position below is individually editable. Total Winners:{" "}
                <strong className="text-white">{numWinnersInput}</strong>
              </span>
              <span className="font-mono font-extrabold text-amber-400">
                Total Prize Pool: ₦
                {positionPrizes
                  .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
                  .toLocaleString()}
              </span>
            </div>

            <div className="max-h-72 overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
              {positionPrizes.map((item) => (
                <div
                  key={item.position}
                  className={`rounded-xl p-2.5 border flex flex-col gap-1.5 ${
                    item.position === 1
                      ? "bg-amber-500/10 border-amber-500/40"
                      : item.position === 2
                      ? "bg-slate-300/10 border-slate-300/30"
                      : item.position === 3
                      ? "bg-amber-700/15 border-amber-600/30"
                      : "bg-[#0a0d14] border-white/10"
                  }`}
                >
                  <label
                    htmlFor={`winner-pos-prize-${item.position}`}
                    className="text-[11px] font-extrabold text-slate-200 flex items-center justify-between"
                  >
                    <span>{formatOrdinal(item.position)} Position</span>
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-2.5 text-xs font-bold text-slate-400">
                      ₦
                    </span>
                    <input
                      id={`winner-pos-prize-${item.position}`}
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={item.amount}
                      onChange={(e) =>
                        handlePositionPrizeInput(
                          item.position,
                          Number(e.target.value)
                        )
                      }
                      className="w-full rounded-lg border border-white/15 bg-black/40 pl-6 pr-2 py-1.5 text-xs font-mono font-bold text-amber-300 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
              <button
                type="button"
                disabled={savingStructure}
                onClick={() =>
                  handleSavePrizeDistribution(compressPositionsToTiers(positionPrizes))
                }
                className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold shadow-lg shadow-amber-500/20"
              >
                {savingStructure
                  ? "Saving..."
                  : `Save ${numWinnersInput} Winners & Position Prizes (₦${positionPrizes
                      .reduce((s, p) => s + (Number(p.amount) || 0), 0)
                      .toLocaleString()})`}
              </button>
            </div>
          </fieldset>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl p-4 bg-[#0f1219] border border-white/10">
          <p className="text-xs font-semibold text-slate-400">
            {activeSession?.status === "completed" ? "Final Winners" : "Potential Winners"}
          </p>
          <p className="text-2xl font-extrabold text-white mt-1 tabular-nums">
            {summary?.winnersCount ?? 0}{" "}
            <span className="text-xs font-normal text-slate-400">
              / {summary?.maxWinnerSlots ?? 36} slots
            </span>
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Top ranked players in {activeSession?.name}
          </p>
        </div>

        <div className="rounded-2xl p-4 bg-[#0f1219] border border-amber-500/25">
          <p className="text-xs font-semibold text-amber-300">Total Prize Allocated</p>
          <p className="text-2xl font-extrabold text-amber-400 mt-1 tabular-nums">
            ₦{(summary?.totalAllocated ?? 0).toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Pool: ₦{(summary?.configuredPool ?? 500000).toLocaleString()}
          </p>
        </div>

        <div className="rounded-2xl p-4 bg-[#0f1219] border border-emerald-500/25">
          <p className="text-xs font-semibold text-emerald-300">Total Prize Paid</p>
          <p className="text-2xl font-extrabold text-emerald-400 mt-1 tabular-nums">
            ₦{(summary?.totalPaid ?? 0).toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {summary?.paidCount ?? 0} winners marked Paid
          </p>
        </div>

        <div className="rounded-2xl p-4 bg-[#0f1219] border border-white/10">
          <p className="text-xs font-semibold text-slate-400">Pending Manual Payouts</p>
          <p className="text-2xl font-extrabold text-sky-400 mt-1 tabular-nums">
            ₦{(summary?.totalPending ?? 0).toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {summary?.pendingCount ?? 0} pending · {summary?.failedCount ?? 0} failed
          </p>
        </div>
      </div>

      {/* Filter, Search & Bulk Payout Bar */}
      <div className="rounded-2xl p-4 bg-[#0f1219] border border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "Pending", "Paid", "Failed"] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold ${
                statusFilter === st
                  ? "bg-amber-500 text-slate-950"
                  : "bg-white/[0.03] text-slate-300 hover:bg-white/[0.08]"
              }`}
            >
              {st === "all" ? `All Winners (${winners.length})` : st}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search winner or bank account..."
            className="w-64 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
          />
          <button
            onClick={() => handleBulkPaymentStatus("Paid")}
            className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold"
          >
            ✓ Mark All Winners Paid
          </button>
        </div>
      </div>

      {/* Winners Table (Page 40 Columns: Position, Player, Points, Total Time, Prize Allocated, Bank Account Details, Payment Status) */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="size-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent mb-3" />
          <p className="text-xs text-slate-400">Loading session winners...</p>
        </div>
      ) : filteredWinners.length === 0 ? (
        <div className="rounded-3xl p-12 bg-[#0f1219] border border-white/10 text-center text-sm text-slate-400">
          No winners found for this filter.
        </div>
      ) : (
        <div className="rounded-3xl overflow-hidden bg-[#0f1219] border border-white/10">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-4">Position</th>
                  <th className="px-4 py-4">Player</th>
                  <th className="px-4 py-4">Points</th>
                  <th className="px-4 py-4">Total Time</th>
                  <th className="px-4 py-4">Prize Allocated</th>
                  <th className="px-4 py-4">Bank Account Details</th>
                  <th className="px-4 py-4 text-right">Payment Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredWinners.map((w) => (
                  <tr key={w.entryId} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg font-black text-xs ${
                          w.position === 1
                            ? "bg-amber-500 text-slate-950"
                            : w.position === 2
                            ? "bg-slate-300 text-slate-950"
                            : w.position === 3
                            ? "bg-amber-700 text-white"
                            : "bg-white/5 text-slate-200"
                        }`}
                      >
                        {formatOrdinal(w.position)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-white">@{w.username}</p>
                        {w.isPotentialWinner && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[10px] font-bold">
                            Potential
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {w.fullName} · {w.state}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 font-mono font-black text-amber-400">
                      {w.points} pts
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-300">
                      {formatTimeShort(w.totalTimeMs)}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-sm font-black text-emerald-400">
                      {editingPositionNum === w.position ? (
                        <div className="flex items-center gap-1.5">
                          <label htmlFor={`inline-prize-pos-${w.position}`} className="sr-only">
                            Prize for {formatOrdinal(w.position)} position
                          </label>
                          <input
                            id={`inline-prize-pos-${w.position}`}
                            type="number"
                            min={0}
                            inputMode="numeric"
                            value={editingPositionAmount}
                            onChange={(e) => setEditingPositionAmount(e.target.value)}
                            className="w-28 rounded-lg border border-amber-500 bg-[#0a0d14] px-2 py-1 text-xs font-mono font-bold text-amber-300"
                          />
                          <button
                            type="button"
                            disabled={savingPositionPrize}
                            onClick={() =>
                              handleSaveSinglePositionPrize(
                                w.position,
                                Number(editingPositionAmount)
                              )
                            }
                            className="px-2 py-1 rounded bg-emerald-500 text-slate-950 text-[10px] font-extrabold"
                          >
                            {savingPositionPrize ? "..." : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingPositionNum(null)}
                            className="px-1.5 py-1 rounded bg-white/10 text-slate-300 text-[10px] font-bold"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span>₦{w.prizeAllocated.toLocaleString()}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPositionNum(w.position);
                              setEditingPositionAmount(String(w.prizeAllocated));
                            }}
                            title={`Edit prize money for ${formatOrdinal(w.position)} position`}
                            className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[10px] font-sans font-semibold text-amber-300 border border-amber-500/30"
                          >
                            ✎ Edit
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs">
                      <div className="flex items-center justify-between gap-2 max-w-xs">
                        <div>
                          <p className="font-bold text-slate-200">
                            {w.bankName} ·{" "}
                            <span className="font-mono text-amber-300">
                              {w.accountNumber}
                            </span>
                          </p>
                          <p className="text-[11px] text-slate-400 truncate">
                            {w.accountName}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setEditingBankWinner(w);
                            setBankNameInput(w.bankName);
                            setAccountNumberInput(w.accountNumber);
                            setAccountNameInput(w.accountName);
                          }}
                          className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[10px] font-semibold text-slate-300 shrink-0"
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <select
                        value={w.paymentStatus}
                        onChange={(e) =>
                          handlePaymentStatusChange(
                            w.userId,
                            e.target.value as "Pending" | "Paid" | "Failed"
                          )
                        }
                        className={`rounded-xl border px-3 py-1.5 text-xs font-extrabold ${
                          w.paymentStatus === "Paid"
                            ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
                            : w.paymentStatus === "Failed"
                            ? "border-rose-500/40 bg-rose-500/20 text-rose-300"
                            : "border-amber-500/40 bg-amber-500/15 text-amber-300"
                        }`}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Paid">Paid</option>
                        <option value="Failed">Failed</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bank Account Details Editor Modal */}
      {editingBankWinner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-3xl bg-[#0f1219] border border-white/15 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-extrabold text-white">
                Bank Account Details — @{editingBankWinner.username}
              </h3>
              <button
                onClick={() => setEditingBankWinner(null)}
                className="text-xs font-bold text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBankDetails} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Bank Name
                </label>
                <input
                  value={bankNameInput}
                  onChange={(e) => setBankNameInput(e.target.value)}
                  required
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  10-Digit NUBAN Account Number
                </label>
                <input
                  value={accountNumberInput}
                  onChange={(e) => setAccountNumberInput(e.target.value)}
                  required
                  maxLength={10}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Account Holder Name
                </label>
                <input
                  value={accountNameInput}
                  onChange={(e) => setAccountNameInput(e.target.value)}
                  required
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingBankWinner(null)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-xs font-semibold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-extrabold"
                >
                  Save Bank Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
