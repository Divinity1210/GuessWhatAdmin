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
    bonusNote: "Weekend 72h Session Fast-Track",
    uses: 11,
    active: false,
    createdAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "json";

    const [{ data: profiles, error: pErr }, { data: entries }, { data: promoRow }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id, username, full_name, phone, state, gender, status, risk_score, referral_code, referred_by, created_at"
          )
          .order("created_at", { ascending: false }),
        supabase.from("session_entries").select("id, user_id, session_id, total_score"),
        supabase.from("app_settings").select("value").eq("key", "promo_codes").maybeSingle(),
      ]);

    if (pErr) {
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    }

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
        state: p.state || "Nigeria",
        status: p.status || "active",
        riskScore: Number(p.risk_score ?? 0),
        referralCode: p.referral_code || (p.username ? p.username.toUpperCase() : "GWUSER"),
        referredBy: p.referred_by || null,
        createdAt: p.created_at,
      });
    }

    // Group referrals by referrer ID
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
      suspicious: boolean;
      suspiciousReason: string | null;
    }[] = [];

    const now = new Date();
    const thirtyDaysAgoMs = now.getTime() - 30 * 24 * 60 * 60 * 1000;

    for (const p of allProfiles) {
      if (!p.referred_by) continue;
      const referrer = profileMap.get(p.referred_by);
      if (!referrer) continue;

      const sessionsPlayed = playsByUser.get(p.id) ?? 0;
      const item = {
        id: p.id,
        username: p.username || "player",
        fullName: p.full_name || p.username || "Player",
        state: p.state || "Nigeria",
        status: p.status || "active",
        riskScore: Number(p.risk_score ?? 0),
        sessionsPlayed,
        createdAt: p.created_at,
      };

      const list = referralsByReferrer.get(referrer.id) ?? [];
      list.push(item);
      referralsByReferrer.set(referrer.id, list);
    }

    // Build Monthly Referral Leaderboard & Suspicious Detection
    const leaderboard: {
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
    }[] = [];

    for (const p of allProfiles) {
      const refs = referralsByReferrer.get(p.id) ?? [];
      const code = p.referral_code || (p.username ? p.username.toUpperCase() : "GWUSER");
      const totalReferrals = refs.length;
      const monthlyReferrals = refs.filter(
        (r) => new Date(r.createdAt).getTime() >= thirtyDaysAgoMs
      ).length;
      const activePlayingReferrals = refs.filter((r) => r.sessionsPlayed > 0).length;
      const conversionRatePct =
        totalReferrals > 0
          ? Number(((activePlayingReferrals / totalReferrals) * 100).toFixed(1))
          : 0;

      // Detect suspicious referral patterns:
      // 1) Multiple referrals created on the exact same day from the same state with 0 gameplay
      // 2) Referrer or referred account has high risk_score (>= 50)
      // 3) >= 3 referrals with 0% active gameplay conversion
      const dayBuckets = new Map<string, number>();
      for (const r of refs) {
        const dayKey = r.createdAt.slice(0, 10);
        dayBuckets.set(dayKey, (dayBuckets.get(dayKey) ?? 0) + 1);
      }
      const maxSameDay = Math.max(0, ...Array.from(dayBuckets.values()));
      const highRiskChild = refs.some((r) => r.riskScore >= 50 || r.status === "blocked");

      let suspiciousFlag = false;
      let suspiciousReason: string | null = null;

      if (Number(p.risk_score ?? 0) >= 50 || p.status === "blocked") {
        suspiciousFlag = true;
        suspiciousReason = `Referrer account has elevated risk score (${p.risk_score ?? 0})`;
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
          userId: p.id,
          username: p.username || "player",
          fullName: p.full_name || p.username || "Player",
          state: p.state || "Nigeria",
          status: p.status || "active",
          referralCode: code,
          totalReferrals,
          monthlyReferrals,
          activePlayingReferrals,
          conversionRatePct,
          suspiciousFlag,
          suspiciousReason,
          joinedAt: p.created_at,
        });
      }

      // Populate individual referral records
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
          suspicious: recSuspicious,
          suspiciousReason: recSuspicious
            ? suspiciousReason || "Dormant multi-account referral pattern"
            : null,
        });
      }
    }

    leaderboard.sort(
      (a, b) =>
        b.totalReferrals - a.totalReferrals ||
        b.activePlayingReferrals - a.activePlayingReferrals ||
        new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()
    );
    leaderboard.forEach((row, idx) => {
      row.rank = idx + 1;
    });

    referralRecords.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const promoCodes: PromoCodeItem[] = Array.isArray(promoRow?.value)
      ? (promoRow.value as PromoCodeItem[])
      : DEFAULT_PROMO_CODES;

    if (format === "csv") {
      const header = [
        "Leaderboard_Rank",
        "Referrer_Username",
        "Referrer_Full_Name",
        "State",
        "Referral_Code",
        "Total_Referrals",
        "Monthly_Referrals_30d",
        "Active_Playing_Referrals",
        "Conversion_Rate_Pct",
        "Suspicious_Flag",
        "Suspicious_Reason",
        "Joined_At",
      ];
      const rows = [header.join(",")];
      for (const row of leaderboard) {
        rows.push(
          [
            row.rank,
            escapeCsv(row.username),
            escapeCsv(row.fullName),
            escapeCsv(row.state),
            escapeCsv(row.referralCode),
            row.totalReferrals,
            row.monthlyReferrals,
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

    const totalPlayers = allProfiles.length;
    const totalReferredPlayers = referralRecords.length;
    const activeReferredPlayers = referralRecords.filter((r) => r.sessionsPlayed > 0).length;
    const activeReferrersCount = leaderboard.filter((l) => l.totalReferrals > 0).length;
    const suspiciousClustersCount = leaderboard.filter((l) => l.suspiciousFlag).length;

    return NextResponse.json({
      summary: {
        totalPlayers,
        totalReferredPlayers,
        referralAcquisitionSharePct:
          totalPlayers > 0
            ? Number(((totalReferredPlayers / totalPlayers) * 100).toFixed(1))
            : 0,
        activeReferredPlayers,
        activeReferrersCount,
        suspiciousClustersCount,
      },
      leaderboard,
      referralRecords,
      promoCodes,
      playersList: allProfiles.map((p) => ({
        id: p.id,
        username: p.username,
        fullName: p.full_name || p.username,
        referredBy: p.referred_by,
      })),
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
      { error: err instanceof Error ? err.message : "Failed to save promo code" },
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
