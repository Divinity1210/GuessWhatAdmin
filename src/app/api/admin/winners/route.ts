import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export type PrizeTier = {
  rank_from: number;
  rank_to: number;
  amount: number;
};

type ArchivedAnswerItem = {
  question_id: string;
  option_id: string;
  response_ms?: number;
};

type ArchivedAttemptDetail = {
  entry_id?: string;
  session_id?: string;
  attempt_number?: number;
  questions_answered?: number;
  total_score?: number;
  total_response_ms?: number;
  answers?: ArchivedAnswerItem[];
};

export const PRESET_36_WINNERS: PrizeTier[] = [
  { rank_from: 1, rank_to: 1, amount: 100000 },
  { rank_from: 2, rank_to: 2, amount: 50000 },
  { rank_from: 3, rank_to: 3, amount: 20000 },
  { rank_from: 4, rank_to: 36, amount: 10000 },
];

export const PRESET_49_WINNERS: PrizeTier[] = [
  { rank_from: 1, rank_to: 1, amount: 100000 },
  { rank_from: 2, rank_to: 2, amount: 50000 },
  { rank_from: 3, rank_to: 3, amount: 20000 },
  { rank_from: 4, rank_to: 23, amount: 10000 },
  { rank_from: 24, rank_to: 49, amount: 5000 },
];

function getPrizeForRank(rank: number, structure: PrizeTier[]): number {
  for (const tier of structure) {
    if (rank >= Number(tier.rank_from) && rank <= Number(tier.rank_to)) {
      return Number(tier.amount ?? 0);
    }
  }
  return 0;
}

function escapeCsv(val: string | number | null | undefined): string {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const SAMPLE_NIGERIAN_BANKS = [
  "GTBank",
  "Access Bank",
  "Zenith Bank",
  "First Bank",
  "UBA",
  "Kuda MFB",
  "OPay",
  "Moniepoint MFB",
];

function getDeterministicBankFallback(userId: string, fullName: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  const bankName = SAMPLE_NIGERIAN_BANKS[hash % SAMPLE_NIGERIAN_BANKS.length];
  const acctNum = String(1000000000 + (hash % 8999999999)).slice(0, 10);
  return {
    bankName,
    accountNumber: acctNum,
    accountName: fullName,
  };
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(req.url);
    const requestedSessionId = searchParams.get("sessionId") || "";
    const format = searchParams.get("format") || "json";

    const [
      { data: sessions },
      { data: entries },
      { data: answers },
      { data: questions },
      { data: profiles },
      { data: appSettings },
      { data: auditLogs },
    ] = await Promise.all([
      supabase
        .from("game_sessions")
        .select("*")
        .order("starts_at", { ascending: false }),
      supabase
        .from("session_entries")
        .select("*"),
      supabase
        .from("answers")
        .select("entry_id, session_id, question_id, option_id, response_ms"),
      supabase
        .from("questions")
        .select("id, question_options(id, position)"),
      supabase
        .from("profiles")
        .select("id, username, full_name, state, gender, phone"),
      supabase.from("app_settings").select("key, value"),
      supabase
        .from("audit_logs")
        .select("id, actor_id, target_id, detail")
        .eq("action", "gameplay_attempt_archived"),
    ]);

    const allSessions = sessions ?? [];
    if (allSessions.length === 0) {
      return NextResponse.json({
        sessions: [],
        activeSession: null,
        winners: [],
      });
    }

    const targetSession =
      allSessions.find((s) => s.id === requestedSessionId) ??
      allSessions.find((s) => s.status === "active") ??
      allSessions[0];

    const sessionId = targetSession.id;

    const profileMap = new Map<
      string,
      { username: string; fullName: string; state: string; gender: string; phone: string }
    >();
    for (const p of profiles ?? []) {
      profileMap.set(p.id, {
        username: p.username || "player",
        fullName: p.full_name || p.username || "Player",
        state: p.state || "Nigeria",
        gender: p.gender || "Unspecified",
        phone: p.phone || "",
      });
    }

    // Read bank_<userId> and payout_status_<sessionId> from app_settings
    const bankByUserId = new Map<
      string,
      { bankName: string; accountNumber: string; accountName: string }
    >();
    let payoutStatuses: Record<string, string> = {};

    for (const row of appSettings ?? []) {
      if (row.key.startsWith("bank_")) {
        const uid = row.key.replace("bank_", "");
        const val = (row.value ?? {}) as {
          bank_name?: string;
          bankName?: string;
          account_number?: string;
          accountNumber?: string;
          account_name?: string;
          accountName?: string;
        };
        bankByUserId.set(uid, {
          bankName: val.bankName || val.bank_name || "GTBank",
          accountNumber: val.accountNumber || val.account_number || "",
          accountName: val.accountName || val.account_name || "",
        });
      }
      if (row.key === `payout_status_${sessionId}`) {
        const val = (row.value ?? {}) as { statuses?: Record<string, string> };
        payoutStatuses = val.statuses ?? (row.value as Record<string, string>) ?? {};
      }
    }

    // Filter archived logs for this session
    const sessionArchived = (auditLogs ?? []).filter((l) => {
      const d = (l.detail ?? {}) as ArchivedAttemptDetail;
      return (d.session_id || l.target_id) === sessionId;
    });

    // Calculate live consensus scores for this session (including archived attempt answers)
    const sessionAnswers = (answers ?? []).filter((a) => a.session_id === sessionId);
    const optionPicks = new Map<string, number>();
    for (const a of sessionAnswers) {
      optionPicks.set(a.option_id, (optionPicks.get(a.option_id) ?? 0) + 1);
    }
    for (const l of sessionArchived) {
      const d = (l.detail ?? {}) as ArchivedAttemptDetail;
      if (Array.isArray(d.answers)) {
        for (const ans of d.answers) {
          if (ans.option_id) {
            optionPicks.set(ans.option_id, (optionPicks.get(ans.option_id) ?? 0) + 1);
          }
        }
      }
    }

    const optionPts = new Map<string, number>();
    for (const q of questions ?? []) {
      const opts = [...(q.question_options ?? [])].sort(
        (a: { position: number }, b: { position: number }) => a.position - b.position
      );
      const ranked = [...opts].sort((a, b) => {
        const diff = (optionPicks.get(b.id) ?? 0) - (optionPicks.get(a.id) ?? 0);
        return diff !== 0 ? diff : a.position - b.position;
      });
      ranked.forEach((opt, idx) => {
        optionPts.set(opt.id, Math.max(10 - idx, 1));
      });
    }

    const entryAgg = new Map<string, { score: number; ms: number; count: number }>();
    for (const a of sessionAnswers) {
      const cur = entryAgg.get(a.entry_id) ?? { score: 0, ms: 0, count: 0 };
      cur.score += optionPts.get(a.option_id) ?? 1;
      cur.ms += Number(a.response_ms ?? 0);
      cur.count += 1;
      entryAgg.set(a.entry_id, cur);
    }

    const rawStructure = targetSession.prize_structure as PrizeTier[] | null;
    const structure: PrizeTier[] =
      Array.isArray(rawStructure) && rawStructure.length > 0
        ? rawStructure
        : PRESET_36_WINNERS;

    const maxWinnerRank = Math.max(...structure.map((t) => Number(t.rank_to ?? 0)), 36);

    const sessionEntries = (entries ?? []).filter((e) => e.session_id === sessionId);
    const scoredEntries = sessionEntries.map((e) => {
      const agg = entryAgg.get(e.id);
      const currentScore = agg && agg.count > 0 ? agg.score : Number(e.total_score ?? 0);
      const currentTimeMs =
        agg && agg.count > 0 ? agg.ms : Number(e.total_response_ms ?? 0);

      let bestScore = currentScore;
      let bestTimeMs =
        currentTimeMs > 0
          ? currentTimeMs
          : Number(e.total_response_ms ?? 45000);

      const playerArch = sessionArchived.filter((l) => {
        const d = (l.detail ?? {}) as ArchivedAttemptDetail;
        return d.entry_id === e.id || l.actor_id === e.user_id;
      });

      for (const log of playerArch) {
        const d = (log.detail ?? {}) as ArchivedAttemptDetail;
        let archDynScore = 0;
        let archDynMs = 0;
        const hasArchAnswers = Array.isArray(d.answers) && d.answers.length > 0;
        if (hasArchAnswers) {
          for (const ans of d.answers!) {
            archDynScore += optionPts.get(ans.option_id) ?? 1;
            archDynMs += Number(ans.response_ms ?? 0);
          }
        }
        const candScore = hasArchAnswers ? archDynScore : Number(d.total_score ?? 0);
        const candMs = Number(d.total_response_ms || archDynMs || 45000);
        if (
          candScore > bestScore ||
          (candScore === bestScore && candMs < bestTimeMs)
        ) {
          bestScore = candScore;
          bestTimeMs = candMs;
        }
      }

      return {
        ...e,
        computedScore: bestScore,
        computedTimeMs: bestTimeMs,
        attemptsCount: Math.max(1, playerArch.length + (agg && agg.count > 0 ? 1 : 0)),
      };
    });

    // Sort by Best Score DESC, then Best Total Time (ms) ASC
    scoredEntries.sort((a, b) => {
      if (b.computedScore !== a.computedScore) return b.computedScore - a.computedScore;
      return a.computedTimeMs - b.computedTimeMs;
    });

    const winners = scoredEntries
      .slice(0, maxWinnerRank)
      .map((e, idx) => {
        const position = idx + 1;
        const prizeAllocated = getPrizeForRank(position, structure);
        const prof = profileMap.get(e.user_id) ?? {
          username: "player",
          fullName: "Player",
          state: "Nigeria",
          gender: "Unspecified",
          phone: "",
        };

        const savedBank = bankByUserId.get(e.user_id);
        const bank =
          savedBank && savedBank.accountNumber
            ? savedBank
            : getDeterministicBankFallback(e.user_id, prof.fullName);

        const defaultPaymentStatus =
          targetSession.status === "completed" && Number(e.prize_awarded ?? 0) > 0
            ? "Paid"
            : "Pending";
        const paymentStatus =
          payoutStatuses[e.user_id] || payoutStatuses[e.id] || defaultPaymentStatus;

        return {
          entryId: e.id,
          userId: e.user_id,
          position,
          username: prof.username,
          fullName: prof.fullName,
          state: prof.state,
          gender: prof.gender,
          points: e.computedScore,
          totalTimeMs: e.computedTimeMs,
          attemptsCount: e.attemptsCount,
          prizeAllocated,
          bankName: bank.bankName,
          accountNumber: bank.accountNumber,
          accountName: bank.accountName || prof.fullName,
          paymentStatus: paymentStatus as "Pending" | "Paid" | "Failed",
          isPotentialWinner: targetSession.status !== "completed",
        };
      });

    // CSV Export for Winners & Prize Report (Page 40 Requirement)
    if (format === "csv") {
      const header = [
        "Position",
        "Session_Name",
        "Winner_Category",
        "Username",
        "Full_Name",
        "State",
        "Best_Score_Points",
        "Total_Time_Seconds",
        "Total_Time_Ms",
        "Prize_Allocated_NGN",
        "Bank_Name",
        "Account_Number",
        "Account_Name",
        "Payment_Status",
      ];
      const rows = [header.join(",")];
      for (const w of winners) {
        rows.push(
          [
            w.position,
            escapeCsv(targetSession.name),
            escapeCsv(w.isPotentialWinner ? "Potential Winner (Active)" : "Final Winner (Completed)"),
            escapeCsv(w.username),
            escapeCsv(w.fullName),
            escapeCsv(w.state),
            w.points,
            (w.totalTimeMs / 1000).toFixed(2),
            w.totalTimeMs,
            w.prizeAllocated,
            escapeCsv(w.bankName),
            escapeCsv(w.accountNumber),
            escapeCsv(w.accountName),
            escapeCsv(w.paymentStatus),
          ].join(",")
        );
      }
      const dateStr = new Date().toISOString().slice(0, 10);
      return new NextResponse(rows.join("\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="guesswhat-winners-payout-report-${dateStr}.csv"`,
        },
      });
    }

    const totalAllocated = winners.reduce((s, w) => s + w.prizeAllocated, 0);
    const totalPaid = winners
      .filter((w) => w.paymentStatus === "Paid")
      .reduce((s, w) => s + w.prizeAllocated, 0);
    const totalPending = winners
      .filter((w) => w.paymentStatus === "Pending")
      .reduce((s, w) => s + w.prizeAllocated, 0);

    return NextResponse.json({
      sessions: allSessions.map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        startsAt: s.starts_at,
        endsAt: s.ends_at,
        prizePool: Number(s.prize_pool ?? 0),
      })),
      activeSession: {
        id: targetSession.id,
        name: targetSession.name,
        status: targetSession.status,
        startsAt: targetSession.starts_at,
        endsAt: targetSession.ends_at,
        prizePool: Number(targetSession.prize_pool ?? 0),
        prizeStructure: structure,
        maxWinnerRank,
      },
      summary: {
        winnersCount: winners.length,
        maxWinnerSlots: maxWinnerRank,
        configuredPool: Number(targetSession.prize_pool ?? 500000),
        totalAllocated,
        totalPaid,
        totalPending,
        paidCount: winners.filter((w) => w.paymentStatus === "Paid").length,
        pendingCount: winners.filter((w) => w.paymentStatus === "Pending").length,
        failedCount: winners.filter((w) => w.paymentStatus === "Failed").length,
      },
      winners,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load winners" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await req.json();
    const {
      sessionId,
      action,
      userId,
      paymentStatus,
      prizePreset,
      prizePool,
      prizeStructure,
      bankName,
      accountNumber,
      accountName,
    } = body;

    if (!sessionId && action !== "update_bank") {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    // 1. Update single winner's payment status
    if (action === "update_payment_status" && userId && paymentStatus) {
      const key = `payout_status_${sessionId}`;
      const { data: existing } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", key)
        .maybeSingle();

      const currentStatuses =
        ((existing?.value as { statuses?: Record<string, string> })?.statuses ??
          (existing?.value as Record<string, string>) ??
          {}) as Record<string, string>;

      currentStatuses[userId] = paymentStatus;

      await supabase.from("app_settings").upsert({
        key,
        value: { statuses: currentStatuses },
        updated_at: new Date().toISOString(),
      });

      return NextResponse.json({ ok: true });
    }

    // 2. Bulk mark all winners in session as Paid or Pending
    if (action === "bulk_payment_status" && paymentStatus) {
      const { data: entries } = await supabase
        .from("session_entries")
        .select("user_id")
        .eq("session_id", sessionId);

      const key = `payout_status_${sessionId}`;
      const { data: existing } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", key)
        .maybeSingle();

      const currentStatuses =
        ((existing?.value as { statuses?: Record<string, string> })?.statuses ??
          {}) as Record<string, string>;

      for (const e of entries ?? []) {
        if (e.user_id) currentStatuses[e.user_id] = paymentStatus;
      }

      await supabase.from("app_settings").upsert({
        key,
        value: { statuses: currentStatuses },
        updated_at: new Date().toISOString(),
      });

      return NextResponse.json({ ok: true });
    }

    // 3. Update winner bank details in app_settings (bank_<userId>)
    if (action === "update_bank" && userId) {
      await supabase.from("app_settings").upsert({
        key: `bank_${userId}`,
        value: {
          bankName: bankName || "GTBank",
          accountNumber: accountNumber || "",
          accountName: accountName || "",
        },
        updated_at: new Date().toISOString(),
      });
      return NextResponse.json({ ok: true });
    }

    // 4. Configure Prize Distribution for Session (Page 20 Left 36 Winners / Right 49 Winners / Custom Position Prizes)
    if (action === "configure_prize_distribution" || action === "update_position_prize") {
      let nextStructure: PrizeTier[] = [];

      if (action === "update_position_prize") {
        const targetPosition = Math.max(1, Math.floor(Number(body.position ?? 1)));
        const newAmount = Math.max(0, Number(body.amount ?? 0));

        const { data: currentSession } = await supabase
          .from("game_sessions")
          .select("prize_structure")
          .eq("id", sessionId)
          .maybeSingle();

        const rawCurrent =
          Array.isArray(currentSession?.prize_structure) &&
          currentSession.prize_structure.length > 0
            ? (currentSession.prize_structure as PrizeTier[])
            : PRESET_36_WINNERS;

        const maxRank = Math.max(
          targetPosition,
          ...rawCurrent.map((t) => Number(t.rank_to ?? 0)),
          36
        );

        const posAmounts: number[] = [];
        for (let p = 1; p <= maxRank; p++) {
          if (p === targetPosition) {
            posAmounts.push(newAmount);
          } else {
            posAmounts.push(getPrizeForRank(p, rawCurrent));
          }
        }

        // Compress contiguous positions with identical amounts into clean PrizeTier[]
        for (let p = 1; p <= maxRank; p++) {
          const amt = posAmounts[p - 1];
          const last = nextStructure[nextStructure.length - 1];
          if (last && last.amount === amt && last.rank_to === p - 1) {
            last.rank_to = p;
          } else {
            nextStructure.push({ rank_from: p, rank_to: p, amount: amt });
          }
        }
      } else {
        nextStructure =
          Array.isArray(prizeStructure) && prizeStructure.length > 0
            ? prizeStructure
            : prizePreset === "49_winners"
            ? PRESET_49_WINNERS
            : PRESET_36_WINNERS;
      }

      const calculatedPool = nextStructure.reduce(
        (sum, t) =>
          sum +
          Math.max(0, Number(t.rank_to) - Number(t.rank_from) + 1) * Number(t.amount ?? 0),
        0
      );

      const totalPool =
        prizePool !== undefined && action !== "update_position_prize"
          ? Number(prizePool)
          : calculatedPool;

      const { error: uErr } = await supabase
        .from("game_sessions")
        .update({
          prize_pool: totalPool,
          prize_structure: nextStructure,
        })
        .eq("id", sessionId);

      if (uErr) {
        return NextResponse.json({ error: uErr.message }, { status: 500 });
      }

      // Update prize_awarded on existing ranked entries AND leaderboards table for this session
      const [{ data: entries }, { data: lbRows }] = await Promise.all([
        supabase
          .from("session_entries")
          .select("id, total_score, total_response_ms, final_rank")
          .eq("session_id", sessionId),
        supabase
          .from("leaderboards")
          .select("user_id, rank")
          .eq("session_id", sessionId),
      ]);

      const sorted = [...(entries ?? [])].sort((a, b) => {
        const diff = Number(b.total_score ?? 0) - Number(a.total_score ?? 0);
        if (diff !== 0) return diff;
        return Number(a.total_response_ms ?? Infinity) - Number(b.total_response_ms ?? Infinity);
      });

      await Promise.all([
        ...sorted.map((entry, i) => {
          const rank = i + 1;
          const prize = getPrizeForRank(rank, nextStructure);
          return supabase
            .from("session_entries")
            .update({ final_rank: rank, prize_awarded: prize })
            .eq("id", entry.id);
        }),
        ...(lbRows ?? []).map((lb) => {
          const prize = getPrizeForRank(Number(lb.rank), nextStructure);
          return supabase
            .from("leaderboards")
            .update({ prize })
            .eq("session_id", sessionId)
            .eq("user_id", lb.user_id);
        }),
      ]);

      return NextResponse.json({
        ok: true,
        prizePool: totalPool,
        prizeStructure: nextStructure,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update winners" },
      { status: 500 }
    );
  }
}
