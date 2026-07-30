"use client";

import { createClient } from "@supabase/supabase-js";
import { useMemo } from "react";

/**
 * Browser-side Supabase client for admin.
 * Uses the SERVICE_ROLE_KEY stored server-side, proxied through API routes.
 * For simplicity during development, we use the anon key + RLS staff policies.
 * In production, admin mutations go through server actions / API routes.
 */
export function createClientComponentClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
