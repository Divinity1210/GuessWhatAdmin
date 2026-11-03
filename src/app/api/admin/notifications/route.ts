import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = createServiceClient();

    const [
      { data: notifications, error: nErr },
      { data: profiles },
      { data: activeSession },
      { data: entries },
      { data: scheduledLogs },
    ] = await Promise.all([
      supabase
        .from("notifications")
        .select("id, user_id, title, body, read, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("profiles")
        .select("id, username, full_name, status, state")
        .order("created_at", { ascending: false }),
      supabase
        .from("game_sessions")
        .select("id, name, status, starts_at, ends_at, prize_pool")
        .in("status", ["active", "upcoming"])
        .order("starts_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("session_entries")
        .select("user_id, session_id, final_rank, prize_awarded"),
      supabase
        .from("audit_logs")
        .select("id, action, detail, created_at")
        .eq("action", "admin_notification_scheduled")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (nErr) {
      return NextResponse.json({ error: nErr.message }, { status: 500 });
    }

    const profileMap = new Map<
      string,
      { username: string; fullName: string; status: string }
    >();
    for (const p of profiles ?? []) {
      profileMap.set(p.id, {
        username: p.username || "player",
        fullName: p.full_name || p.username || "Player",
        status: p.status || "active",
      });
    }

    // Group notifications into broadcast batches by (title, body, minute)
    const batchMap = new Map<
      string,
      {
        batchKey: string;
        title: string;
        body: string;
        sentAt: string;
        deliveredCount: number;
        readCount: number;
        unreadCount: number;
        readRatePct: number;
        sampleRecipients: string[];
      }
    >();

    const recentDeliveries = (notifications ?? []).slice(0, 100).map((n) => {
      const p = profileMap.get(n.user_id);
      const minuteKey = n.created_at ? n.created_at.slice(0, 16) : "unknown";
      const bKey = `${n.title}|||${n.body}|||${minuteKey}`;

      const existing = batchMap.get(bKey);
      if (!existing) {
        batchMap.set(bKey, {
          batchKey: bKey,
          title: n.title,
          body: n.body,
          sentAt: n.created_at,
          deliveredCount: 1,
          readCount: n.read ? 1 : 0,
          unreadCount: n.read ? 0 : 1,
          readRatePct: n.read ? 100 : 0,
          sampleRecipients: [p?.username || "player"],
        });
      } else {
        existing.deliveredCount += 1;
        if (n.read) existing.readCount += 1;
        else existing.unreadCount += 1;
        existing.readRatePct = Math.round(
          (existing.readCount / existing.deliveredCount) * 100
        );
        if (
          p?.username &&
          existing.sampleRecipients.length < 5 &&
          !existing.sampleRecipients.includes(p.username)
        ) {
          existing.sampleRecipients.push(p.username);
        }
      }

      return {
        id: n.id,
        userId: n.user_id,
        username: p?.username || "player",
        fullName: p?.fullName || "Player",
        title: n.title,
        body: n.body,
        read: Boolean(n.read),
        createdAt: n.created_at,
      };
    });

    // Also include remaining notifications in batch aggregation beyond top 100
    for (const n of (notifications ?? []).slice(100)) {
      const p = profileMap.get(n.user_id);
      const minuteKey = n.created_at ? n.created_at.slice(0, 16) : "unknown";
      const bKey = `${n.title}|||${n.body}|||${minuteKey}`;
      const existing = batchMap.get(bKey);
      if (existing) {
        existing.deliveredCount += 1;
        if (n.read) existing.readCount += 1;
        else existing.unreadCount += 1;
        existing.readRatePct = Math.round(
          (existing.readCount / existing.deliveredCount) * 100
        );
      } else {
        batchMap.set(bKey, {
          batchKey: bKey,
          title: n.title,
          body: n.body,
          sentAt: n.created_at,
          deliveredCount: 1,
          readCount: n.read ? 1 : 0,
          unreadCount: n.read ? 0 : 1,
          readRatePct: n.read ? 100 : 0,
          sampleRecipients: [p?.username || "player"],
        });
      }
    }

    const batches = Array.from(batchMap.values()).sort(
      (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
    );

    const totalDelivered = (notifications ?? []).length;
    const totalRead = (notifications ?? []).filter((n) => n.read).length;

    const activeSessionPlayerSet = new Set(
      (entries ?? [])
        .filter((e) => (activeSession ? e.session_id === activeSession.id : true))
        .map((e) => e.user_id)
    );
    const winnersSet = new Set(
      (entries ?? [])
        .filter((e) => (e.final_rank != null && e.final_rank <= 36) || Number(e.prize_awarded ?? 0) > 0)
        .map((e) => e.user_id)
    );

    return NextResponse.json({
      summary: {
        totalBroadcasts: batches.length,
        totalDelivered,
        totalRead,
        overallReadRatePct:
          totalDelivered > 0 ? Math.round((totalRead / totalDelivered) * 100) : 0,
        allPlayersCount: (profiles ?? []).length,
        activeSessionPlayersCount: activeSessionPlayerSet.size,
        winnersCount: winnersSet.size,
      },
      activeSession: activeSession ?? null,
      batches,
      recentDeliveries,
      scheduledQueue: (scheduledLogs ?? []).map((l) => ({
        id: l.id,
        detail: l.detail,
        createdAt: l.created_at,
      })),
      players: (profiles ?? []).map((p) => ({
        id: p.id,
        username: p.username,
        fullName: p.full_name || p.username,
        status: p.status || "active",
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load notifications" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const {
      audienceType,
      specificUserId,
      title,
      body,
      scheduledFor,
    } = await req.json();

    if (!title?.trim() || !body?.trim()) {
      return NextResponse.json(
        { error: "Notification title and message body are required." },
        { status: 400 }
      );
    }

    const [{ data: profiles }, { data: activeSession }, { data: entries }] =
      await Promise.all([
        supabase.from("profiles").select("id, username, status"),
        supabase
          .from("game_sessions")
          .select("id, name")
          .eq("status", "active")
          .limit(1)
          .maybeSingle(),
        supabase
          .from("session_entries")
          .select("user_id, session_id, final_rank, prize_awarded"),
      ]);

    const allProfiles = profiles ?? [];
    let recipientIds: string[] = [];

    if (audienceType === "specific") {
      if (!specificUserId) {
        return NextResponse.json(
          { error: "Please select a specific player recipient." },
          { status: 400 }
        );
      }
      recipientIds = [specificUserId];
    } else if (audienceType === "active_session") {
      const set = new Set(
        (entries ?? [])
          .filter((e) => (activeSession ? e.session_id === activeSession.id : true))
          .map((e) => e.user_id)
      );
      recipientIds = Array.from(set);
      if (recipientIds.length === 0) {
        recipientIds = allProfiles.filter((p) => p.status === "active").map((p) => p.id);
      }
    } else if (audienceType === "winners") {
      const set = new Set(
        (entries ?? [])
          .filter(
            (e) =>
              (e.final_rank != null && e.final_rank <= 36) ||
              Number(e.prize_awarded ?? 0) > 0
          )
          .map((e) => e.user_id)
      );
      recipientIds = Array.from(set);
      if (recipientIds.length === 0) {
        recipientIds = allProfiles.slice(0, 10).map((p) => p.id);
      }
    } else if (audienceType === "status_active") {
      recipientIds = allProfiles
        .filter((p) => (p.status || "active") === "active")
        .map((p) => p.id);
    } else if (audienceType === "status_suspended") {
      recipientIds = allProfiles
        .filter((p) => p.status === "suspended" || p.status === "blocked")
        .map((p) => p.id);
    } else {
      // "all"
      recipientIds = allProfiles.map((p) => p.id);
    }

    if (recipientIds.length === 0) {
      return NextResponse.json(
        { error: "No matching players found in the selected target group." },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    const rows = recipientIds.map((uid) => ({
      user_id: uid,
      title: title.trim(),
      body: body.trim(),
      read: false,
      created_at: nowIso,
    }));

    const { error: insErr } = await supabase.from("notifications").insert(rows);
    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    await supabase.from("audit_logs").insert({
      action: scheduledFor
        ? "admin_notification_scheduled"
        : "admin_notification_broadcast",
      target_table: "notifications",
      detail: {
        audience_type: audienceType,
        recipient_count: recipientIds.length,
        title: title.trim(),
        body: body.trim(),
        scheduled_for: scheduledFor || null,
      },
    });

    return NextResponse.json({
      ok: true,
      deliveredCount: recipientIds.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send notification" },
      { status: 500 }
    );
  }
}
