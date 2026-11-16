import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

function escapeCsv(val: string | number | null | undefined): string {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export type PromoCodeItem = {
  code: string;
  campaign: string;
  bonusNote: string;
  uses: number;
  active: boolean;
  createdAt: string;
};

export type ReferralPrizeTier = {
  rank_from: number;
  rank_to: number;
  amount: number;
};

export type ReferralLeaderboardConfig = {
  title: string;
  enabled: boolean;
  cycleNumber: number;
  cycleStartedAt: string | null;
  endsNote: string;
  prizeTiers: ReferralPrizeTier[];
  updatedAt: string;
};

export type ReferralArchiveWinner = {
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

export type ReferralCycleArchive = {
  id: string;
  cycleNumber: number;
  title: string;
  startedAt: string | null;
  endedAt: string;
  totalPool: number;
  winners: ReferralArchiveWinner[];
};

const DEFAULT_PRIZE_TIERS: ReferralPrizeTier[] = [
  { rank_from: 1, rank_to: 1, amount: 50000 },
  { rank_from: 2, rank_to: 2, amount: 30000 },
  { rank_from: 3, rank_to: 3, amount: 20000 },
  { rank_from: 4, rank_to: 10, amount: 5000 },
];

const DEFAULT_REFERRAL_CONFIG: ReferralLeaderboardConfig = {
  title: "Referral Cash Challenge #1",
  enabled: true,
  cycleNumber: 1,
  cycleStartedAt: null,
  endsNote: "Top verified referrers win cash prizes",
  prizeTiers: DEFAULT_PRIZE_TIERS,
  updatedAt: new Date(0).toISOString(),
};

const DEFAULT_PROMO_CODES: PromoCodeItem[] = [
  {
    code: "GWLAUNCH",
    campaign: "National Launch Campaign",
    bonusNote: "Free entry pass + priority leaderboard badge",
    uses: 42,
    active: true,
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    code: "UNILAGVIP",
    campaign: "Campus Ambassador Drive (UNILAG)",
    bonusNote: "Campus Ambassador referral tracking code",
    uses: 19,
    active: true,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    code: "WEEKENDHEAT",
    campaign: "Weekend Radio & TikTok Promo",
    bonusNote: "Weekend Session Fast-Track",
    uses: 11,
    active: false,
    createdAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

function sanitizePrizeTiers(input: unknown): ReferralPrizeTier[] {
  if (!Array.isArray(input) || input.length === 0) {
    return DEFAULT_PRIZE_TIERS.map((t) => ({ ...t }));
  }
  const cleaned: ReferralPrizeTier[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const obj = raw as Record<string, unknown>;
    const rankFrom = Math.max(1, Math.floor(Number(obj.rank_from ?? obj.rankFrom ?? 1) || 1));
    const rankTo = Math.max(
      rankFrom,
      Math.floor(Number(obj.rank_to ?? obj.rankTo ?? rankFrom) || rankFrom)
    );
    const amount = Math.max(0, Math.round(Number(obj.amount ?? 0) || 0));
    cleaned.push({ rank_from: rankFrom, rank_to: rankTo, amount });
  }
  if (cleaned.length === 0) {
    return DEFAULT_PRIZE_TIERS.map((t) => ({ ...t }));
  }
  cleaned.sort((a, b) => a.rank_from - b.rank_from || a.rank_to - b.rank_to);
  return cleaned;
}

function normalizeReferralConfig(raw: unknown): ReferralLeaderboardConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_REFERRAL_CONFIG, prizeTiers: DEFAULT_PRIZE_TIERS.map((t) => ({ ...t })) };
  }
  const obj = raw as Record<string, unknown>;
  const cycleNumber = Math.max(1, Math.floor(Number(obj.cycleNumber ?? 1) || 1));
  const cycleStartedAt =
    typeof obj.cycleStartedAt === "string" && obj.cycleStartedAt.trim()
      ? obj.cycleStartedAt
      : null;

  return {
    title:
      typeof obj.title === "string" && obj.title.trim()
        ? obj.title.trim()
        : `Referral Cash Challenge #${cycleNumber}`,
    enabled: typeof obj.enabled === "boolean" ? obj.enabled : true,
    cycleNumber,
    cycleStartedAt,
    endsNote:
      typeof obj.endsNote === "string" && obj.endsNote.trim()
        ? obj.endsNote.trim()
        : DEFAULT_REFERRAL_CONFIG.endsNote,
    prizeTiers: Array.isArray(obj.prizeTiers)
      ? sanitizePrizeTiers(obj.prizeTiers)
      : DEFAULT_PRIZE_TIERS.map((t) => ({ ...t })),
    updatedAt:
      typeof obj.updatedAt === "string" && obj.updatedAt.trim()
        ? obj.updatedAt
        : new Date().toISOString(),
  };
}

function computeReferralPool(prizeTiers: ReferralPrizeTier[]): {
  totalPool: number;
  totalWinnerSpots: number;
} {
  let totalPool = 0;
  let totalWinnerSpots = 0;
  for (const tier of prizeTiers) {
    const count = Math.max(1, tier.rank_to - tier.rank_from + 1);
    totalPool += count * Math.max(0, tier.amount);
    if (tier.amount > 0 && tier.rank_to > totalWinnerSpots) {
      totalWinnerSpots = tier.rank_to;
    }
  }
  return { totalPool, totalWinnerSpots };
}

function lookupReferralPrize(
  rank: number | null,
  prizeTiers: ReferralPrizeTier[],
  enabled: boolean,
  verifiedReferrals: number,
  isRestricted: boolean
): number {
  if (!enabled || !rank || verifiedReferrals <= 0 || isRestricted) return 0;
  const tier = prizeTiers.find((t) => rank >= t.rank_from && rank <= t.rank_to);
  return tier ? Math.max(0, Number(tier.amount) || 0) : 0;
}

function buildNextCycleTitle(currentTitle: string, nextCycleNumber: number): string {
  if (/#\d+\b/.test(currentTitle)) {
    return currentTitle.replace(/#\d+\b/, `#${nextCycleNumber}`);
  }
  return `Referral Cash Challenge #${nextCycleNumber}`;
}

async function computeReferralDashboardData(
  supabase: ReturnType<typeof createServiceClient>
) {
  const [{ data: profiles, error: pErr }, { data: entries }, { data: settingsRows }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, username, full_name, avatar_url, phone, state, gender, status, risk_score, referral_code, referred_by, created_at"
        )
        .order("created_at", { ascending: false }),
      supabase.from("session_entries").select("id, user_id, session_id, total_score"),
      supabase
        .from("app_settings")
        .select("key, value")
        .in("key", [
          "promo_codes",
          "referral_leaderboard_config",
          "referral_leaderboard_archives",
        ]),
    ]);

  if (pErr) {
    throw new Error(pErr.message);
  }

  const settingsMap = new Map<string, unknown>();
  for (const row of settingsRows ?? []) {
    settingsMap.set(row.key, row.value);
  }

  const config = normalizeReferralConfig(settingsMap.get("referral_leaderboard_config"));
  const { totalPool, totalWinnerSpots } = computeReferralPool(config.prizeTiers);
  const archives: ReferralCycleArchive[] = Array.isArray(
    settingsMap.get("referral_leaderboard_archives")
  )
    ? (settingsMap.get("referral_leaderboard_archives") as ReferralCycleArchive[])
    : [];
  const promoCodes: PromoCodeItem[] = Array.isArray(settingsMap.get("promo_codes"))
    ? (settingsMap.get("promo_codes") as PromoCodeItem[])
    : DEFAULT_PROMO_CODES;

  const allProfiles = profiles ?? [];
  const playsByUser = new Map<string, number>();
  for (const e of entries ?? []) {
    playsByUser.set(e.user_id, (playsByUser.get(e.user_id) ?? 0) + 1);
  }

  const profileMap = new Map<
    string,
    {
      id: string;
      username: string;
      fullName: string;
      avatarUrl: string | null;
      state: string;
      status: string;
      riskScore: number;
      referralCode: string;
      referredBy: string | null;
      createdAt: string;
    }
  >();

  for (const p of allProfiles) {
    profileMap.set(p.id, {
      id: p.id,
      username: p.username || "player",
      fullName: p.full_name || p.username || "Player",
      avatarUrl: p.avatar_url || null,
      state: p.state || "Nigeria",
      status: p.status || "active",
      riskScore: Number(p.risk_score ?? 0),
      referralCode: p.referral_code || (p.username ? p.username.toUpperCase() : "GWUSER"),
      referredBy: p.referred_by || null,
      createdAt: p.created_at,
    });
  }

  const cycleStartMs = config.cycleStartedAt
    ? new Date(config.cycleStartedAt).getTime()
    : null;
  const now = new Date();
  const thirtyDaysAgoMs = now.getTime() - 30 * 24 * 60 * 60 * 1000;

  const referralsByReferrer = new Map<
    string,
    {
      id: string;
      username: string;
      fullName: string;
      state: string;
      status: string;
      riskScore: number;
      sessionsPlayed: number;
      createdAt: string;
      inCurrentCycle: boolean;
      isVerified: boolean;
    }[]
  >();

  const referralRecords: {
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
  }[] = [];

  for (const p of allProfiles) {
    if (!p.referred_by) continue;
    const referrer = profileMap.get(p.referred_by);
    if (!referrer) continue;

    const sessionsPlayed = playsByUser.get(p.id) ?? 0;
    const childRisk = Number(p.risk_score ?? 0);
    const childStatus = p.status || "active";
    const createdMs = new Date(p.created_at).getTime();
    const inCurrentCycle = cycleStartMs === null || createdMs >= cycleStartMs;
    const childBlocked =
      childStatus === "suspended" || childStatus === "blocked" || childRisk >= 50;
    const isVerified = inCurrentCycle && sessionsPlayed >= 1 && !childBlocked;

    const item = {
      id: p.id,
      username: p.username || "player",
      fullName: p.full_name || p.username || "Player",
      state: p.state || "Nigeria",
      status: childStatus,
      riskScore: childRisk,
      sessionsPlayed,
      createdAt: p.created_at,
      inCurrentCycle,
      isVerified,
    };

    const list = referralsByReferrer.get(referrer.id) ?? [];
    list.push(item);
    referralsByReferrer.set(referrer.id, list);
  }

  type AdminLeaderboardItem = {
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
    lastVerifiedAtMs: number;
    prizeAmount: number;
    conversionRatePct: number;
    suspiciousFlag: boolean;
    suspiciousReason: string | null;
    joinedAt: string;
  };

  const leaderboard: AdminLeaderboardItem[] = [];

  for (const p of allProfiles) {
    const refs = referralsByReferrer.get(p.id) ?? [];
    const code = p.referral_code || (p.username ? p.username.toUpperCase() : "GWUSER");
    const totalReferrals = refs.length;
    const monthlyReferrals = refs.filter(
      (r) => new Date(r.createdAt).getTime() >= thirtyDaysAgoMs
    ).length;
    const activePlayingReferrals = refs.filter((r) => r.sessionsPlayed > 0).length;
    const cycleRefs = refs.filter((r) => r.inCurrentCycle);
    const cycleSignups = cycleRefs.length;
    const verifiedCycleRefs = cycleRefs.filter((r) => r.isVerified);
    const cycleVerifiedReferrals = verifiedCycleRefs.length;
    const lastVerifiedAtMs =
      verifiedCycleRefs.length > 0
        ? Math.max(...verifiedCycleRefs.map((r) => new Date(r.createdAt).getTime()))
        : Number.MAX_SAFE_INTEGER;
    const conversionRatePct =
      totalReferrals > 0
        ? Number(((activePlayingReferrals / totalReferrals) * 100).toFixed(1))
        : 0;

    const dayBuckets = new Map<string, number>();
    for (const r of refs) {
      const dayKey = r.createdAt.slice(0, 10);
      dayBuckets.set(dayKey, (dayBuckets.get(dayKey) ?? 0) + 1);
    }
    const maxSameDay = Math.max(0, ...Array.from(dayBuckets.values()));
    const highRiskChild = refs.some(
      (r) => r.riskScore >= 50 || r.status === "blocked"
    );

    let suspiciousFlag = false;
    let suspiciousReason: string | null = null;

    if (Number(p.risk_score ?? 0) >= 50 || p.status === "blocked" || p.status === "suspended") {
      suspiciousFlag = true;
      suspiciousReason = `Referrer account restricted or elevated risk score (${p.risk_score ?? 0})`;
    } else if (maxSameDay >= 3 && activePlayingReferrals === 0) {
      suspiciousFlag = true;
      suspiciousReason = `${maxSameDay} referrals registered on the same day with 0 gameplay sessions`;
    } else if (totalReferrals >= 3 && activePlayingReferrals === 0) {
      suspiciousFlag = true;
      suspiciousReason = `${totalReferrals} referrals with 0% active gameplay conversion (dormant/bot signups)`;
    } else if (highRiskChild) {
      suspiciousFlag = true;
      suspiciousReason = "One or more referred accounts flagged for high fraud risk";
    }

    if (totalReferrals > 0 || p.referral_code) {
      leaderboard.push({
        rank: 0,
        cashRank: null,
        userId: p.id,
        username: p.username || "player",
        fullName: p.full_name || p.username || "Player",
        avatarUrl: p.avatar_url || null,
        state: p.state || "Nigeria",
        status: p.status || "active",
        referralCode: code,
        totalReferrals,
        monthlyReferrals,
        activePlayingReferrals,
        cycleSignups,
        cycleVerifiedReferrals,
        lastVerifiedAtMs,
        prizeAmount: 0,
        conversionRatePct,
        suspiciousFlag,
        suspiciousReason,
        joinedAt: p.created_at,
      });
    }

    for (const r of refs) {
      const recSuspicious =
        suspiciousFlag || r.riskScore >= 50 || (r.sessionsPlayed === 0 && maxSameDay >= 3);
      referralRecords.push({
        id: `${p.id}_${r.id}`,
        referredUserId: r.id,
        referredUsername: r.username,
        referredFullName: r.fullName,
        referredState: r.state,
        referredStatus: r.status,
        referredRiskScore: r.riskScore,
        sessionsPlayed: r.sessionsPlayed,
        referrerId: p.id,
        referrerUsername: p.username || "player",
        referrerFullName: p.full_name || p.username || "Player",
        referralCodeUsed: code,
        createdAt: r.createdAt,
        inCurrentCycle: r.inCurrentCycle,
        isVerified: r.isVerified,
        suspicious: recSuspicious,
        suspiciousReason: recSuspicious
          ? suspiciousReason || "Dormant multi-account referral pattern"
          : null,
      });
    }
  }

  // Primary competition ranking: verified active-cycle referrals, fastest to reach count, cycle signups, total referrals
  leaderboard.sort((a, b) => {
    if (b.cycleVerifiedReferrals !== a.cycleVerifiedReferrals) {
      return b.cycleVerifiedReferrals - a.cycleVerifiedReferrals;
    }
    if (a.cycleVerifiedReferrals > 0 && a.lastVerifiedAtMs !== b.lastVerifiedAtMs) {
      return a.lastVerifiedAtMs - b.lastVerifiedAtMs;
    }
    if (b.cycleSignups !== a.cycleSignups) {
      return b.cycleSignups - a.cycleSignups;
    }
    if (b.totalReferrals !== a.totalReferrals) {
      return b.totalReferrals - a.totalReferrals;
    }
    return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
  });

  let eligibleCounter = 0;
  leaderboard.forEach((row, idx) => {
    row.rank = idx + 1;
    const isRestricted = row.status === "suspended" || row.status === "blocked";
    if (!isRestricted && row.cycleVerifiedReferrals > 0) {
      eligibleCounter += 1;
      row.cashRank = eligibleCounter;
      row.prizeAmount = lookupReferralPrize(
        eligibleCounter,
        config.prizeTiers,
        config.enabled,
        row.cycleVerifiedReferrals,
        false
      );
    } else {
      row.cashRank = null;
      row.prizeAmount = 0;
    }
  });

  referralRecords.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const cycleVerifiedTotal = leaderboard.reduce(
    (sum, l) => sum + l.cycleVerifiedReferrals,
    0
  );

  return {
    config: {
      ...config,
      totalPool,
      totalWinnerSpots,
    },
    archives,
    promoCodes,
    leaderboard,
    referralRecords,
    playersList: allProfiles.map((p) => ({
      id: p.id,
      username: p.username,
      fullName: p.full_name || p.username,
      referredBy: p.referred_by,
    })),
    summary: {
      totalPlayers: allProfiles.length,
      totalReferredPlayers: referralRecords.length,
      referralAcquisitionSharePct:
        allProfiles.length > 0
          ? Number(((referralRecords.length / allProfiles.length) * 100).toFixed(1))
          : 0,
      activeReferredPlayers: referralRecords.filter((r) => r.sessionsPlayed > 0).length,
      activeReferrersCount: leaderboard.filter((l) => l.totalReferrals > 0).length,
      suspiciousClustersCount: leaderboard.filter((l) => l.suspiciousFlag).length,
      cycleVerifiedTotal,
      cyclePool: totalPool,
      eligibleWinnersCount: eligibleCounter,
    },
  };
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "json";

    const data = await computeReferralDashboardData(supabase);

    if (format === "csv") {
      const header = [
        "Leaderboard_Rank",
        "Cash_Rank",
        "Projected_Prize_NGN",
        "Referrer_Username",
        "Referrer_Full_Name",
        "State",
        "Referral_Code",
        "Cycle_Verified_Referrals",
        "Cycle_Signups",
        "Total_Lifetime_Referrals",
        "Active_Playing_Referrals",
        "Conversion_Rate_Pct",
        "Suspicious_Flag",
        "Suspicious_Reason",
        "Joined_At",
      ];
      const rows = [header.join(",")];
      for (const row of data.leaderboard) {
        rows.push(
          [
            row.rank,
            row.cashRank ?? "",
            row.prizeAmount,
            escapeCsv(row.username),
            escapeCsv(row.fullName),
            escapeCsv(row.state),
            escapeCsv(row.referralCode),
            row.cycleVerifiedReferrals,
            row.cycleSignups,
            row.totalReferrals,
            row.activePlayingReferrals,
            row.conversionRatePct,
            row.suspiciousFlag ? "YES" : "NO",
            escapeCsv(row.suspiciousReason || ""),
            escapeCsv(row.joinedAt),
          ].join(",")
        );
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      return new NextResponse(rows.join("\n"), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="guesswhat_referrals_report_${dateStr}.csv"`,
        },
      });
    }

    return NextResponse.json({
      summary: data.summary,
      config: data.config,
      archives: data.archives,
      leaderboard: data.leaderboard,
      referralRecords: data.referralRecords,
      promoCodes: data.promoCodes,
      playersList: data.playersList,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load referrals data" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await req.json();
    const { action } = body;

    if (action === "save_prize_config") {
      const { data: existingRow } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "referral_leaderboard_config")
        .maybeSingle();

      const current = normalizeReferralConfig(existingRow?.value);
      const nextTiers = sanitizePrizeTiers(body.prizeTiers);
      const nextConfig: ReferralLeaderboardConfig = {
        title:
          typeof body.title === "string" && body.title.trim()
            ? body.title.trim()
            : current.title,
        enabled: typeof body.enabled === "boolean" ? body.enabled : current.enabled,
        cycleNumber: current.cycleNumber,
        cycleStartedAt: current.cycleStartedAt,
        endsNote:
          typeof body.endsNote === "string" && body.endsNote.trim()
            ? body.endsNote.trim()
            : DEFAULT_REFERRAL_CONFIG.endsNote,
        prizeTiers: nextTiers,
        updatedAt: new Date().toISOString(),
      };

      const { error: upsertErr } = await supabase.from("app_settings").upsert({
        key: "referral_leaderboard_config",
        value: nextConfig,
        updated_at: nextConfig.updatedAt,
      });

      if (upsertErr) {
        return NextResponse.json({ error: upsertErr.message }, { status: 500 });
      }

      const { totalPool, totalWinnerSpots } = computeReferralPool(nextConfig.prizeTiers);
      await supabase.from("audit_logs").insert({
        actor_id: null,
        action: "referral_prize_config_updated",
        target_table: "app_settings",
        target_id: "referral_leaderboard_config",
        detail: {
          title: nextConfig.title,
          enabled: nextConfig.enabled,
          totalPool,
          prizeTiers: nextConfig.prizeTiers,
        },
      });

      return NextResponse.json({
        ok: true,
        config: {
          ...nextConfig,
          totalPool,
          totalWinnerSpots,
        },
      });
    }

    if (action === "reset_leaderboard") {
      const snapshotData = await computeReferralDashboardData(supabase);
      const nowIso = new Date().toISOString();

      const eligibleWinners: ReferralArchiveWinner[] = snapshotData.leaderboard
        .filter((row) => row.cashRank !== null && row.cycleVerifiedReferrals > 0)
        .slice(0, Math.max(snapshotData.config.totalWinnerSpots, 20))
        .map((row) => ({
          rank: row.cashRank as number,
          userId: row.userId,
          username: row.username,
          fullName: row.fullName,
          avatarUrl: row.avatarUrl,
          state: row.state,
          referralCode: row.referralCode,
          verifiedReferrals: row.cycleVerifiedReferrals,
          cycleSignups: row.cycleSignups,
          prizeAmount: row.prizeAmount,
        }));

      const archiveEntry: ReferralCycleArchive = {
        id: `cycle-${snapshotData.config.cycleNumber}-${Date.now()}`,
        cycleNumber: snapshotData.config.cycleNumber,
        title: snapshotData.config.title,
        startedAt: snapshotData.config.cycleStartedAt,
        endedAt: nowIso,
        totalPool: snapshotData.config.totalPool,
        winners: eligibleWinners,
      };

      const nextArchives = [archiveEntry, ...snapshotData.archives].slice(0, 25);
      const nextCycleNumber = snapshotData.config.cycleNumber + 1;
      const requestedTitle =
        typeof body.nextTitle === "string" && body.nextTitle.trim()
          ? body.nextTitle.trim()
          : buildNextCycleTitle(snapshotData.config.title, nextCycleNumber);

      const nextConfig: ReferralLeaderboardConfig = {
        title: requestedTitle,
        enabled: snapshotData.config.enabled,
        cycleNumber: nextCycleNumber,
        cycleStartedAt: nowIso,
        endsNote: snapshotData.config.endsNote,
        prizeTiers: snapshotData.config.prizeTiers,
        updatedAt: nowIso,
      };

      const [{ error: archErr }, { error: cfgErr }] = await Promise.all([
        supabase.from("app_settings").upsert({
          key: "referral_leaderboard_archives",
          value: nextArchives,
          updated_at: nowIso,
        }),
        supabase.from("app_settings").upsert({
          key: "referral_leaderboard_config",
          value: nextConfig,
          updated_at: nowIso,
        }),
      ]);

      if (archErr || cfgErr) {
        return NextResponse.json(
          { error: archErr?.message || cfgErr?.message || "Failed to reset referral cycle" },
          { status: 500 }
        );
      }

      await supabase.from("audit_logs").insert({
        actor_id: null,
        action: "referral_leaderboard_reset",
        target_table: "app_settings",
        target_id: "referral_leaderboard_config",
        detail: {
          archivedCycleNumber: archiveEntry.cycleNumber,
          archivedTitle: archiveEntry.title,
          archivedWinnersCount: eligibleWinners.length,
          nextCycleNumber,
          nextTitle: requestedTitle,
        },
      });

      const { totalPool, totalWinnerSpots } = computeReferralPool(nextConfig.prizeTiers);
      return NextResponse.json({
        ok: true,
        archivedCount: eligibleWinners.length,
        config: {
          ...nextConfig,
          totalPool,
          totalWinnerSpots,
        },
        archives: nextArchives,
      });
    }

    if (action === "assign_referral") {
      const { referredUserId, referrerUserId } = body;
      if (!referredUserId || !referrerUserId || referredUserId === referrerUserId) {
        return NextResponse.json(
          { error: "Valid distinct referred and referrer players are required." },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          referred_by: referrerUserId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", referredUserId);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    // Default POST: Create a new marketing promo code in app_settings (`promo_codes`)
    const { code, campaign, bonusNote } = body;
    const cleanCode = String(code || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, "");

    if (!cleanCode || !campaign?.trim()) {
      return NextResponse.json(
        { error: "Promo code and campaign name are required." },
        { status: 400 }
      );
    }

    const { data: existingRow } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "promo_codes")
      .maybeSingle();

    const currentList: PromoCodeItem[] = Array.isArray(existingRow?.value)
      ? (existingRow.value as PromoCodeItem[])
      : [...DEFAULT_PROMO_CODES];

    if (currentList.some((c) => c.code.toUpperCase() === cleanCode)) {
      return NextResponse.json(
        { error: `Promo code "${cleanCode}" already exists.` },
        { status: 400 }
      );
    }

    const newPromo: PromoCodeItem = {
      code: cleanCode,
      campaign: String(campaign).trim(),
      bonusNote: String(bonusNote || "Promotional referral campaign").trim(),
      uses: 0,
      active: true,
      createdAt: new Date().toISOString(),
    };

    const nextList = [newPromo, ...currentList];

    const { error } = await supabase.from("app_settings").upsert({
      key: "promo_codes",
      value: nextList,
      updated_at: new Date().toISOString(),
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, promoCodes: nextList });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save referral action" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { action, code, userId } = await req.json();

    if (action === "toggle_promo" || action === "delete_promo") {
      const { data: existingRow } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "promo_codes")
        .maybeSingle();

      const currentList: PromoCodeItem[] = Array.isArray(existingRow?.value)
        ? (existingRow.value as PromoCodeItem[])
        : [...DEFAULT_PROMO_CODES];

      const nextList =
        action === "delete_promo"
          ? currentList.filter((c) => c.code !== code)
          : currentList.map((c) => (c.code === code ? { ...c, active: !c.active } : c));

      const { error } = await supabase.from("app_settings").upsert({
        key: "promo_codes",
        value: nextList,
        updated_at: new Date().toISOString(),
      });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, promoCodes: nextList });
    }

    if (action === "flag_suspicious" && userId) {
      const { error } = await supabase
        .from("profiles")
        .update({
          status: "suspended",
          risk_score: 80,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      await supabase.from("audit_logs").insert({
        actor_id: userId,
        action: "suspicious_referral_restricted",
        target_table: "profiles",
        target_id: userId,
        detail: { reason: "Flagged in Admin Referral Management for suspicious referral activity" },
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update referral settings" },
      { status: 500 }
    );
  }
}
