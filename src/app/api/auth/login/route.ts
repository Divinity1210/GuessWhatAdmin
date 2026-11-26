import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, createSupabaseServerClient } from "@/lib/supabase";
import { resolveAdminUser } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const identifier = String(body?.identifier ?? "").trim();
    const password = String(body?.password ?? "");

    if (!identifier || !password) {
      return NextResponse.json(
        { error: "Username/email and password are required." },
        { status: 400 },
      );
    }

    let emailToUse = identifier;
    if (!identifier.includes("@")) {
      const cleanUsername = identifier.replace(/^@+/, "").trim();
      const service = createServiceClient();
      const { data: profile } = await service
        .from("profiles")
        .select("id")
        .ilike("username", cleanUsername)
        .maybeSingle();

      if (!profile?.id) {
        return NextResponse.json(
          { error: "Invalid username or password." },
          { status: 401 },
        );
      }

      const { data: userLookup, error: lookupError } =
        await service.auth.admin.getUserById(profile.id);

      if (lookupError || !userLookup.user?.email) {
        return NextResponse.json(
          { error: "Invalid username or password." },
          { status: 401 },
        );
      }
      emailToUse = userLookup.user.email;
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password,
    });

    if (error || !data.user) {
      return NextResponse.json(
        { error: "Invalid username or password." },
        { status: 401 },
      );
    }

    const adminUser = await resolveAdminUser(data.user);
    if (!adminUser) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: "Access denied. This account does not have Admin Portal permissions." },
        { status: 403 },
      );
    }

    return NextResponse.json({ ok: true, user: adminUser });
  } catch {
    return NextResponse.json(
      { error: "Authentication service error. Please try again." },
      { status: 500 },
    );
  }
}
