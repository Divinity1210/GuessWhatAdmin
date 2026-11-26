import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ALLOWED_ADMIN_ROLES = new Set([
  "super_admin",
  "moderator",
  "support",
  "finance",
  "fraud",
]);

const ALLOWED_ADMIN_EMAILS = new Set([
  "admin@guesswhat.ng",
  "master@guesswhat.ng",
  "muyiwa.a@gramefdigitalagency.com",
]);

function buildPublicUrl(request: NextRequest, pathname: string, search?: string): URL {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  const url = new URL(pathname, request.url);
  if (forwardedHost) {
    url.protocol = `${forwardedProto}:`;
    url.host = forwardedHost;
  }
  url.search = search || "";
  return url;
}

async function isAuthorizedAdmin(userId: string, email: string | undefined): Promise<boolean> {
  if (email && ALLOWED_ADMIN_EMAILS.has(email.trim().toLowerCase())) {
    return true;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !serviceKey) {
    return false;
  }

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=role&limit=1`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        cache: "no-store",
      },
    );
    if (!res.ok) return false;
    const rows = (await res.json()) as Array<{ role?: string | null }>;
    const role = String(rows?.[0]?.role ?? "").trim().toLowerCase();
    return ALLOWED_ADMIN_ROLES.has(role);
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const { pathname, search } = request.nextUrl;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    if (pathname.startsWith("/api/admin")) {
      return NextResponse.json(
        { error: "Unauthorized: Admin login required" },
        { status: 401 },
      );
    }
    if (pathname === "/" || pathname.startsWith("/admin")) {
      return NextResponse.redirect(buildPublicUrl(request, "/login"));
    }
    return supabaseResponse;
  }

  let isAdmin = false;
  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      isAdmin = await isAuthorizedAdmin(user.id, user.email);
    }
  } catch {
    isAdmin = false;
  }

  if (pathname.startsWith("/api/admin")) {
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Unauthorized: Admin login required" },
        { status: 401 },
      );
    }
    return supabaseResponse;
  }

  if (pathname === "/login") {
    if (isAdmin) {
      return NextResponse.redirect(buildPublicUrl(request, "/admin"));
    }
    return supabaseResponse;
  }

  if (pathname === "/" || pathname.startsWith("/admin")) {
    if (!isAdmin) {
      const nextParam =
        pathname.startsWith("/admin") && pathname !== "/admin"
          ? `?next=${encodeURIComponent(`${pathname}${search}`)}`
          : "";
      return NextResponse.redirect(buildPublicUrl(request, "/login", nextParam));
    }
    if (pathname === "/") {
      return NextResponse.redirect(buildPublicUrl(request, "/admin"));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/", "/login", "/admin/:path*", "/api/admin/:path*"],
};
