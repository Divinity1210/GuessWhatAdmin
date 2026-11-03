import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

function escapeCsv(val: string | number | null | undefined): string {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function getAgeBand(dob: string | null): string {
  if (!dob) return "—";
  const birthYear = new Date(dob).getFullYear();
  if (Number.isNaN(birthYear)) return "—";
  const age = new Date().getFullYear() - birthYear;
  if (age < 18) return "< 18";
  if (age <= 24) return "18–24";
  if (age <= 34) return "25–34";
  if (age <= 44) return "35–44";
  return "45+";
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "json";
    const statusFilter = searchParams.get("status") || "all";
    const dateFilter = searchParams.get("dateRange") || "all";
    const search = (searchParams.get("q") || "").trim().toLowerCase();

    const [
      { data: profiles, error: pErr },
      { data: sessions },
      { data: entries },
      { data: tickets },
      { data: auditLogs },
      { data: settings },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("*, wallets(coin_balance, reward_balance, withdrawable_balance)")
        .order("created_at", { ascending: false }),
      supabase
        .from("game_sessions")
        .select("id, name, status, starts_at, ends_at, prize_pool"),
      supabase
        .from("session_entries")
        .select(
          "id, session_id, user_id, joined_at, completed_at, total_score, total_response_ms, final_rank, prize_awarded"
        )
        .order("joined_at", { ascending: false }),
      supabase
        .from("support_tickets")
        .select("id, user_id, subject, category, status, created_at, updated_at, ticket_messages(id, body, created_at)")
        .order("created_at", { ascending: false }),
      supabase
        .from("audit_logs")
        .select("id, actor_id, action, target_table, target_id, detail, ip_address, created_at")
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase
        .from("app_settings")
        .select("key, value"),
    ]);

    if (pErr) {
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    }

    // Attempt to fetch auth emails via service role admin API
    const emailMap = new Map<string, { email: string; lastSignInAt: string | null }>();
    try {
      const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      for (const u of authData?.users ?? []) {
        emailMap.set(u.id, {
          email: u.email || "",
          lastSignInAt: u.last_sign_in_at || null,
        });
      }
    } catch {
      // Fallback if auth admin listUsers is unavailable
    }

    // Bank details map from app_settings (`bank_${userId}`)
    const bankMap = new Map<
      string,
      { bankName: string; accountNumber: string; accountName: string; updatedAt?: string }
    >();
    for (const row of settings ?? []) {
      if (typeof row.key === "string" && row.key.startsWith("bank_")) {
        const uid = row.key.replace("bank_", "");
        const val = (row.value ?? {}) as Record<string, unknown>;
        bankMap.set(uid, {
          bankName: String(val.bankName || val.bank_name || ""),
          accountNumber: String(val.accountNumber || val.account_number || ""),
          accountName: String(val.accountName || val.account_name || ""),
          updatedAt: val.updatedAt ? String(val.updatedAt) : undefined,
        });
      }
    }

    // Session map
    const sessionMap = new Map<string, { id: string; name: string; status: string }>();
    for (const s of sessions ?? []) {
      sessionMap.set(s.id, { id: s.id, name: s.name, status: s.status });
    }

    // Profile lookup for referral resolution
    const profileBasicMap = new Map<
      string,
      { id: string; username: string; fullName: string; referralCode: string | null }
    >();
    for (const p of profiles ?? []) {
      profileBasicMap.set(p.id, {
        id: p.id,
        username: p.username || "player",
        fullName: p.full_name || p.username || "Player",
        referralCode: p.referral_code || null,
      });
    }

    // Referrals made by each player
    const referralsByReferrer = new Map<
      string,
      { id: string; username: string; fullName: string; state: string | null; status: string; createdAt: string }[]
    >();
    for (const p of profiles ?? []) {
      if (p.referred_by) {
        const list = referralsByReferrer.get(p.referred_by) ?? [];
        list.push({
          id: p.id,
          username: p.username,
          fullName: p.full_name || p.username,
          state: p.state || null,
          status: p.status || "active",
          createdAt: p.created_at,
        });
        referralsByReferrer.set(p.referred_by, list);
      }
    }

    // Gameplay history per player
    const gameplayByUser = new Map<
      string,
      {
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
      }[]
    >();

    for (const e of entries ?? []) {
      const sess = sessionMap.get(e.session_id);
      const list = gameplayByUser.get(e.user_id) ?? [];
      list.push({
        id: e.id,
        sessionId: e.session_id,
        sessionName: sess?.name || "Game Session",
        sessionStatus: sess?.status || "completed",
        joinedAt: e.joined_at,
        completedAt: e.completed_at,
        totalScore: Number(e.total_score ?? 0),
        totalResponseMs: Number(e.total_response_ms ?? 0),
        finalRank: e.final_rank ?? null,
        prizeAwarded: Number(e.prize_awarded ?? 0),
        isReplay: false,
      });
      gameplayByUser.set(e.user_id, list);
    }

    // Also include archived replay attempts from audit_logs
    const activityByUser = new Map<
      string,
      {
        id: number;
        action: string;
        targetTable: string | null;
        targetId: string | null;
        detail: Record<string, unknown> | null;
        ipAddress: string | null;
        createdAt: string;
      }[]
    >();

    for (const log of auditLogs ?? []) {
      if (!log.actor_id) continue;
      const list = activityByUser.get(log.actor_id) ?? [];
      list.push({
        id: log.id,
        action: log.action,
        targetTable: log.target_table ?? null,
        targetId: log.target_id ?? null,
        detail: (log.detail as Record<string, unknown>) ?? null,
        ipAddress: log.ip_address ?? null,
        createdAt: log.created_at,
      });
      activityByUser.set(log.actor_id, list);

      if (log.action === "gameplay_attempt_archived") {
        const d = (log.detail ?? {}) as Record<string, unknown>;
        const sid = String(d.session_id || log.target_id || "");
        const sess = sessionMap.get(sid);
        const gList = gameplayByUser.get(log.actor_id) ?? [];
        gList.push({
          id: `arch_${log.id}`,
          sessionId: sid,
          sessionName: sess?.name || "Game Session (Replay)",
          sessionStatus: sess?.status || "completed",
          joinedAt: String(d.started_at || log.created_at),
          completedAt: String(d.completed_at || log.created_at),
          totalScore: Number(d.total_score ?? 0),
          totalResponseMs: Number(d.total_response_ms ?? 0),
          finalRank: d.final_rank != null ? Number(d.final_rank) : null,
          prizeAwarded: 0,
          isReplay: true,
        });
        gameplayByUser.set(log.actor_id, gList);
      }
    }

    // Support tickets / complaints per player
    const ticketsByUser = new Map<
      string,
      {
        id: string;
        subject: string;
        category: string | null;
        status: string;
        createdAt: string;
        updatedAt: string;
        messageCount: number;
        lastMessage: string | null;
      }[]
    >();

    for (const t of tickets ?? []) {
      const list = ticketsByUser.get(t.user_id) ?? [];
      const msgs = Array.isArray(t.ticket_messages) ? t.ticket_messages : [];
      list.push({
        id: t.id,
        subject: t.subject,
        category: t.category ?? "Support Request",
        status: t.status,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
        messageCount: msgs.length,
        lastMessage: msgs.length > 0 ? msgs[msgs.length - 1].body : null,
      });
      ticketsByUser.set(t.user_id, list);
    }

    const nowMs = Date.now();
    const enrichedPlayers = (profiles ?? []).map((p) => {
      const authInfo = emailMap.get(p.id);
      const email = authInfo?.email || `${p.username}@guesswhat.ng`;
      const bank = bankMap.get(p.id) ?? null;
      const gHistory = gameplayByUser.get(p.id) ?? [];
      const aLogs = activityByUser.get(p.id) ?? [];
      const uTickets = ticketsByUser.get(p.id) ?? [];
      const referrer = p.referred_by ? profileBasicMap.get(p.referred_by) ?? null : null;
      const referralsMade = referralsByReferrer.get(p.id) ?? [];

      const bestScore = gHistory.reduce((max, g) => (g.totalScore > max ? g.totalScore : max), 0);
      const totalPrizesWon = gHistory.reduce((sum, g) => sum + g.prizeAwarded, 0);

      const walletRow = Array.isArray(p.wallets) ? p.wallets[0] : p.wallets;

      return {
        id: p.id,
        username: p.username,
        full_name: p.full_name || null,
        email,
        phone: p.phone || null,
        gender: p.gender || null,
        date_of_birth: p.date_of_birth || null,
        ageBand: getAgeBand(p.date_of_birth),
        state: p.state || null,
        role: p.role || "player",
        status: p.status || "active",
        risk_score: Number(p.risk_score ?? 0),
        referral_code: p.referral_code || p.username?.toUpperCase() || "—",
        referred_by: p.referred_by || null,
        referredByPlayer: referrer,
        referralsCount: referralsMade.length,
        referralsMade,
        created_at: p.created_at,
        updated_at: p.updated_at,
        lastSignInAt: authInfo?.lastSignInAt || (aLogs[0]?.createdAt ?? p.updated_at),
        wallet: {
          coin_balance: Number(walletRow?.coin_balance ?? 0),
          reward_balance: Number(walletRow?.reward_balance ?? 0),
          withdrawable_balance: Number(walletRow?.withdrawable_balance ?? 0),
        },
        bankAccount: bank,
        sessionsPlayed: gHistory.length,
        bestScore,
        totalPrizesWon,
        gameplayHistory: gHistory,
        activityLogs: aLogs.slice(0, 30),
        complaints: uTickets,
      };
    });

    // Apply filters
    const filteredPlayers = enrichedPlayers.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;

      if (dateFilter !== "all") {
        const createdMs = new Date(p.created_at).getTime();
        const ageHours = (nowMs - createdMs) / (1000 * 60 * 60);
        if (dateFilter === "today" && ageHours > 24) return false;
        if (dateFilter === "7d" && ageHours > 24 * 7) return false;
        if (dateFilter === "30d" && ageHours > 24 * 30) return false;
      }

      if (search) {
        const hay = [
          p.username,
          p.full_name,
          p.email,
          p.phone,
          p.state,
          p.referral_code,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(search)) return false;
      }

      return true;
    });

    if (format === "csv") {
      const header = [
        "Player_ID",
        "Username",
        "Full_Name",
        "Email",
        "Phone",
        "Gender",
        "Date_Of_Birth",
        "Age_Bracket",
        "State",
        "Account_Status",
        "Risk_Score",
        "Referral_Code",
        "Referred_By_Username",
        "Players_Referred_Count",
        "Sessions_Played",
        "Best_Score",
        "Total_Prizes_Won_NGN",
        "Bank_Name",
        "Account_Number",
        "Account_Holder_Name",
        "Complaints_Count",
        "Registered_At",
      ];

      const rows = [header.join(",")];
      for (const p of filteredPlayers) {
        rows.push(
          [
            escapeCsv(p.id),
            escapeCsv(p.username),
            escapeCsv(p.full_name || ""),
            escapeCsv(p.email),
            escapeCsv(p.phone || ""),
            escapeCsv(p.gender || ""),
            escapeCsv(p.date_of_birth || ""),
            escapeCsv(p.ageBand),
            escapeCsv(p.state || ""),
            escapeCsv(p.status),
            p.risk_score,
            escapeCsv(p.referral_code),
            escapeCsv(p.referredByPlayer?.username || ""),
            p.referralsCount,
            p.sessionsPlayed,
            p.bestScore,
            p.totalPrizesWon,
            escapeCsv(p.bankAccount?.bankName || ""),
            escapeCsv(p.bankAccount?.accountNumber || ""),
            escapeCsv(p.bankAccount?.accountName || ""),
            p.complaints.length,
            escapeCsv(p.created_at),
          ].join(",")
        );
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      return new NextResponse(rows.join("\n"), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="guesswhat_players_${dateStr}.csv"`,
        },
      });
    }

    const summary = {
      totalPlayers: enrichedPlayers.length,
      activeCount: enrichedPlayers.filter((p) => p.status === "active").length,
      suspendedCount: enrichedPlayers.filter((p) => p.status === "suspended").length,
      blockedCount: enrichedPlayers.filter((p) => p.status === "blocked").length,
      withBankCount: enrichedPlayers.filter((p) => Boolean(p.bankAccount?.accountNumber)).length,
      newLast7Days: enrichedPlayers.filter(
        (p) => nowMs - new Date(p.created_at).getTime() <= 7 * 24 * 60 * 60 * 1000
      ).length,
    };

    return NextResponse.json({
      players: filteredPlayers,
      summary,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch players" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { userId, action, coins, status, role, riskScore, note } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    if (action === "grant_coins") {
      const addCoins = Number(coins || 100);
      const { data: wallet } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      const nextCoins = Number(wallet?.coin_balance ?? 0) + addCoins;
      const currentRewards = Number(wallet?.reward_balance ?? 0);

      await supabase.from("wallets").upsert({
        user_id: userId,
        coin_balance: nextCoins,
        reward_balance: currentRewards,
        withdrawable_balance: Number(wallet?.withdrawable_balance ?? currentRewards),
        updated_at: new Date().toISOString(),
      });

      await supabase.from("wallet_transactions").insert({
        user_id: userId,
        type: "promo",
        coin_delta: addCoins,
        reward_delta: 0,
        coin_balance_after: nextCoins,
        reward_balance_after: currentRewards,
        reference: `ADMIN-GRANT-${Date.now().toString(36).toUpperCase()}`,
        note: note || `Admin bonus credit (+${addCoins} coins)`,
      });

      await supabase.from("audit_logs").insert({
        actor_id: userId,
        action: "admin_grant_coins",
        target_table: "wallets",
        target_id: userId,
        detail: { coins_added: addCoins, note },
      });

      return NextResponse.json({ ok: true, coinBalance: nextCoins });
    }

    if (action === "set_status" && status) {
      const updates: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      };
      if (typeof riskScore === "number") {
        updates.risk_score = riskScore;
      } else if (status === "blocked") {
        updates.risk_score = 85;
      } else if (status === "active") {
        updates.risk_score = 0;
      }

      const { error } = await supabase.from("profiles").update(updates).eq("id", userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      await supabase.from("audit_logs").insert({
        actor_id: userId,
        action: `account_status_${status}`,
        target_table: "profiles",
        target_id: userId,
        detail: {
          new_status: status,
          risk_score: updates.risk_score,
          reason: note || `Admin updated player status to ${status}`,
        },
      });

      return NextResponse.json({ ok: true });
    }

    if (action === "restrict_fraud") {
      const nextRisk = typeof riskScore === "number" ? riskScore : 85;
      const { error } = await supabase
        .from("profiles")
        .update({
          status: "blocked",
          risk_score: nextRisk,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      await supabase.from("audit_logs").insert({
        actor_id: userId,
        action: "account_fraud_restricted",
        target_table: "profiles",
        target_id: userId,
        detail: {
          new_status: "blocked",
          risk_score: nextRisk,
          reason: note || "Suspected fraudulent activity restricted by Admin",
        },
      });

      return NextResponse.json({ ok: true });
    }

    if (action === "set_role" && role) {
      const { error } = await supabase
        .from("profiles")
        .update({ role, updated_at: new Date().toISOString() })
        .eq("id", userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      await supabase.from("audit_logs").insert({
        actor_id: userId,
        action: "admin_role_updated",
        target_table: "profiles",
        target_id: userId,
        detail: { new_role: role },
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update player" },
      { status: 500 }
    );
  }
}
