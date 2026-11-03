import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

const ADMIN_ROLES = ["super_admin", "moderator", "support", "finance", "fraud"];

export async function GET() {
  try {
    const supabase = createServiceClient();
    const [{ data: settings, error: sErr }, { data: profiles, error: pErr }] =
      await Promise.all([
        supabase.from("app_settings").select("*"),
        supabase
          .from("profiles")
          .select("id, username, full_name, phone, state, role, status, created_at, updated_at")
          .order("created_at", { ascending: false }),
      ]);

    if (sErr) {
      return NextResponse.json({ error: sErr.message }, { status: 500 });
    }
    if (pErr) {
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    }

    const allUsers = (profiles ?? []).map((p) => ({
      id: p.id,
      username: p.username,
      fullName: p.full_name || p.username,
      phone: p.phone || null,
      state: p.state || "Nigeria",
      role: p.role || "player",
      status: p.status || "active",
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));

    const adminUsers = allUsers.filter((u) => ADMIN_ROLES.includes(u.role));

    return NextResponse.json({
      settings: settings ?? [],
      adminUsers,
      allUsers,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load app settings" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { key, value } = await req.json();
    if (!key || typeof value !== "object") {
      return NextResponse.json(
        { error: "key and value object are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("app_settings")
      .upsert({
        key,
        value,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, setting: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { userId, identifier, role } = await req.json();

    if (!role) {
      return NextResponse.json({ error: "Target role is required" }, { status: 400 });
    }

    let targetId = userId;

    if (!targetId && identifier?.trim()) {
      const clean = String(identifier)
        .trim()
        .replace(/^@/, "")
        .replace(/@guesswhat\.ng$/i, "");
      const { data: match } = await supabase
        .from("profiles")
        .select("id")
        .ilike("username", clean)
        .maybeSingle();

      if (!match) {
        return NextResponse.json(
          { error: `No registered account found matching "${identifier}".` },
          { status: 404 }
        );
      }
      targetId = match.id;
    }

    if (!targetId) {
      return NextResponse.json(
        { error: "userId or username/email is required" },
        { status: 400 }
      );
    }

    const { data: updated, error } = await supabase
      .from("profiles")
      .update({
        role,
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetId)
      .select("id, username, full_name, role")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase.from("audit_logs").insert({
      actor_id: targetId,
      action: "admin_role_updated",
      target_table: "profiles",
      target_id: targetId,
      detail: {
        username: updated?.username,
        assigned_role: role,
      },
    });

    return NextResponse.json({ ok: true, user: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update admin role" },
      { status: 500 }
    );
  }
}
