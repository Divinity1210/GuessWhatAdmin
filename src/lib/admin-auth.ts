import type { User } from "@supabase/supabase-js";
import { createServiceClient, createSupabaseServerClient } from "@/lib/supabase";

export const ALLOWED_ADMIN_ROLES = new Set([
  "super_admin",
  "moderator",
  "support",
  "finance",
  "fraud",
]);

export const ALLOWED_ADMIN_EMAILS = new Set([
  "admin@guesswhat.ng",
  "master@guesswhat.ng",
  "muyiwa.a@gramefdigitalagency.com",
]);

export interface AdminSessionUser {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: string;
}

/**
 * Verifies whether a Supabase Auth user holds an Admin Portal role or is an allow-listed founder/admin email.
 */
export async function resolveAdminUser(user: User | null | undefined): Promise<AdminSessionUser | null> {
  if (!user) return null;

  const email = (user.email ?? "").trim();
  const normalizedEmail = email.toLowerCase();
  const isAllowListedEmail = ALLOWED_ADMIN_EMAILS.has(normalizedEmail);

  const service = createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("id, username, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  const profileRole = String(profile?.role ?? "").trim().toLowerCase();
  const hasAllowedRole = ALLOWED_ADMIN_ROLES.has(profileRole);

  if (!hasAllowedRole && !isAllowListedEmail) {
    return null;
  }

  return {
    id: user.id,
    email,
    username: String(profile?.username ?? email.split("@")[0] ?? "admin"),
    fullName: String(profile?.full_name ?? "GuessWhat Admin"),
    role: hasAllowedRole ? profileRole : "super_admin",
  };
}

/**
 * Returns the authenticated Admin user from request cookies, or null if unauthenticated/unauthorized.
 */
export async function getAuthenticatedAdmin(): Promise<AdminSessionUser | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return null;
    return await resolveAdminUser(user);
  } catch {
    return null;
  }
}
