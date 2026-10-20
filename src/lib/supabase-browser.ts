"use client";

import { createClient } from "@supabase/supabase-js";

let adminOfflineUntil = 0;

async function fastAdminSupabaseFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  if (Date.now() < adminOfflineUntil) {
    return new Response(
      JSON.stringify({ message: "Supabase offline circuit breaker active" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2200);

  try {
    const res = await fetch(input, {
      ...init,
      signal: init?.signal ?? controller.signal,
    });
    clearTimeout(timer);
    return res;
  } catch {
    clearTimeout(timer);
    adminOfflineUntil = Date.now() + 60_000;
    return new Response(
      JSON.stringify({ message: "Supabase connection timed out (offline fallback)" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }
}

export function createClientComponentClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

  return createClient(url, key, {
    global: {
      fetch: fastAdminSupabaseFetch,
    },
  });
}
