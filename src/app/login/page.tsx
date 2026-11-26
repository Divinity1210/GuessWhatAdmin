"use client";

import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";

const PLAYER_APP_URL =
  process.env.NEXT_PUBLIC_PLAYER_APP_URL || "https://guesswhat9ja.com";

function AdminLoginForm() {
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next") ?? "/admin";
  const safeNext =
    rawNext.startsWith("/admin") && !rawNext.startsWith("//") ? rawNext : "/admin";

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!identifier.trim() || !password) {
      setError("Enter your admin username/email and password.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: identifier.trim(),
          password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Sign-in failed. Check your credentials.");
        setSubmitting(false);
        return;
      }
      window.location.href = safeNext;
    } catch {
      setError("Unable to reach the authentication server. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b0e17] p-7 sm:p-8 shadow-2xl">
        <div className="flex items-center justify-between gap-3 mb-6">
          <img
            src="/gw-logo.png"
            alt="GuessWhat"
            className="h-10 w-auto object-contain"
          />
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
            Admin Portal
          </span>
        </div>

        <div className="mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="size-5 text-amber-400" />
            Staff Sign In
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Restricted to authorized GuessWhat administrators and operations staff.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-200"
          >
            <AlertCircle className="size-4 shrink-0 text-red-400 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="admin-identifier"
              className="block text-xs font-semibold text-slate-300 mb-1.5"
            >
              Username or Email
            </label>
            <input
              id="admin-identifier"
              type="text"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="superadmin or admin@guesswhat.ng"
              disabled={submitting}
              className="w-full rounded-xl border border-white/10 bg-[#07090e] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-amber-500/60 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="admin-password"
              className="block text-xs font-semibold text-slate-300 mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                disabled={submitting}
                className="w-full rounded-xl border border-white/10 bg-[#07090e] px-3.5 py-2.5 pr-10 text-sm text-white placeholder:text-slate-500 focus:border-amber-500/60 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 px-4 py-2.5 text-sm font-bold text-slate-950 transition-colors cursor-pointer"
          >
            <Lock className="size-4" />
            <span>{submitting ? "Verifying session..." : "Sign In to Admin Portal"}</span>
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-slate-500">
          <span>Protected by Supabase Auth</span>
          <a
            href={PLAYER_APP_URL}
            className="text-amber-400 hover:underline font-medium"
          >
            Back to Player App ↗
          </a>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#07090e] text-slate-400 flex items-center justify-center text-sm">
          Loading Admin Portal...
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}
