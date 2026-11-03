"use client";

import { useEffect, useState } from "react";
import {
  Check,
  CheckCircle2,
  Shield,
  Sliders,
  Smartphone,
  UserCog,
  UserPlus,
  AlertCircle,
} from "lucide-react";

type SessionDefaults = {
  duration_hours: number;
  entry_fee_coins: number;
  questions_per_session: number;
};

type SubscriptionPlans = {
  daily: { coins: number; price_naira: number };
  weekly: { coins: number; price_naira: number };
};

type FraudThresholds = {
  min_response_ms: number;
  max_sessions_per_day: number;
};

type StaffUser = {
  id: string;
  username: string;
  fullName: string;
  phone: string | null;
  state: string;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  super_admin: "Full system access: Sessions, Questions, Payouts, Players, Analytics & Settings",
  moderator: "Game Operations: Manage Questions, 72h Sessions, Notifications & Content",
  support: "Customer Support: Reply to Support Tickets, Feedback & Player Inquiries",
  finance: "Prize & Payouts: Review Top 36 Winners, Approve Bank Transfers & Financial Reports",
  fraud: "Integrity & Risk: Monitor Repeat Plays, Suspicious Referrals & Account Restrictions",
};

export default function SettingsPage() {
  const [sessionDefaults, setSessionDefaults] = useState<SessionDefaults>({
    duration_hours: 72,
    entry_fee_coins: 0,
    questions_per_session: 10,
  });
  const [subPlans, setSubPlans] = useState<SubscriptionPlans>({
    daily: { coins: 100, price_naira: 100 },
    weekly: { coins: 350, price_naira: 300 },
  });
  const [fraudThresholds, setFraudThresholds] = useState<FraudThresholds>({
    min_response_ms: 400,
    max_sessions_per_day: 20,
  });

  const [adminUsers, setAdminUsers] = useState<StaffUser[]>([]);
  const [allUsers, setAllUsers] = useState<StaffUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [identifierInput, setIdentifierInput] = useState("");
  const [assignRole, setAssignRole] = useState("moderator");
  const [assigningRole, setAssigningRole] = useState(false);

  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings", { cache: "no-store" });
      const data = await res.json();
      for (const row of data.settings ?? []) {
        if (row.key === "session_defaults") setSessionDefaults(row.value);
        if (row.key === "subscription_plans") setSubPlans(row.value);
        if (row.key === "fraud_thresholds") setFraudThresholds(row.value);
      }
      setAdminUsers(data.adminUsers ?? []);
      setAllUsers(data.allUsers ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function saveSetting(key: string, value: unknown, label: string) {
    setSavingKey(key);
    setToast("");
    setError("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      if (res.ok) {
        setToast(`${label} saved to Supabase app_settings!`);
        setTimeout(() => setToast(""), 3500);
      }
    } finally {
      setSavingKey(null);
    }
  }

  async function handlePromoteUser(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setToast("");

    if (!selectedUserId && !identifierInput.trim()) {
      setError("Select a registered user or enter their username/email to assign an admin role.");
      return;
    }

    setAssigningRole(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUserId || undefined,
          identifier: identifierInput.trim() || undefined,
          role: assignRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update user role.");
      } else {
        setSelectedUserId("");
        setIdentifierInput("");
        setToast(
          `Assigned "${assignRole.toUpperCase()}" permissions to @${
            data.user?.username || "user"
          }!`
        );
        setTimeout(() => setToast(""), 4000);
        await load();
      }
    } finally {
      setAssigningRole(false);
    }
  }

  async function handleRoleChange(userId: string, newRole: string, username: string) {
    setError("");
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role: newRole }),
    });
    if (res.ok) {
      setToast(
        newRole === "player"
          ? `Revoked staff permissions for @${username}.`
          : `Updated @${username} role to ${newRole.toUpperCase()}.`
      );
      setTimeout(() => setToast(""), 3500);
      await load();
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Admin Users &amp; Platform Settings
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
              System &amp; RBAC
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Manage staff administrator accounts and role permissions, default 72-hour session parameters, and anti-bot fraud thresholds.
          </p>
        </div>
      </div>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold"
        >
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold"
        >
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="rounded-3xl p-12 bg-[#0f1219] border border-white/10 text-center text-sm text-slate-400">
          Loading admin accounts and platform configuration...
        </div>
      ) : (
        <div className="space-y-6">
          {/* 1. Admin Users & Permissions Management (Page 34 #16) */}
          <div className="rounded-3xl p-6 bg-[#0f1219] border border-white/10 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <UserCog className="size-5 text-amber-400" />
                  <span>Admin Users &amp; Permissions Management</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Grant or modify staff access across Super Admin, Moderator, Customer Support, Finance, and Fraud roles.
                </p>
              </div>
              <span className="px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-slate-300">
                Active Staff: <strong className="text-white">{adminUsers.length}</strong>
              </span>
            </div>

            {/* Promote / Assign Staff Role Form */}
            <form
              onSubmit={handlePromoteUser}
              className="p-4 rounded-2xl bg-[#141926] border border-white/10 grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Select Registered User
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#0f1219] border border-white/10 text-xs text-white"
                >
                  <option value="">Choose account...</option>
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      @{u.username} ({u.fullName}) — [{u.role}]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Or Enter Username / Email
                </label>
                <input
                  type="text"
                  value={identifierInput}
                  onChange={(e) => setIdentifierInput(e.target.value)}
                  placeholder="e.g. @chidi or admin@guesswhat.ng"
                  className="w-full px-3 py-2.5 rounded-xl bg-[#0f1219] border border-white/10 text-xs text-white placeholder:text-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Permission Role *
                </label>
                <select
                  value={assignRole}
                  onChange={(e) => setAssignRole(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#0f1219] border border-white/10 text-xs font-semibold text-amber-300"
                >
                  <option value="super_admin">Super Admin (Full Control)</option>
                  <option value="moderator">Moderator (Sessions &amp; Questions)</option>
                  <option value="support">Support Desk (Tickets &amp; Feedback)</option>
                  <option value="finance">Finance Officer (Prizes &amp; Payouts)</option>
                  <option value="fraud">Fraud Analyst (Risk &amp; Referrals)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={assigningRole}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
              >
                <UserPlus className="size-4" />
                <span>{assigningRole ? "Assigning..." : "Grant Admin Role"}</span>
              </button>
            </form>

            {/* Staff Accounts Table */}
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02] text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-3">Staff Member</th>
                    <th className="px-4 py-3">Assigned Role</th>
                    <th className="px-4 py-3">Scope &amp; Permissions</th>
                    <th className="px-4 py-3 text-right">Modify Role / Revoke</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {adminUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <p className="font-bold text-white text-xs">@{u.username}</p>
                        <p className="text-[11px] text-slate-400">
                          {u.fullName} · {u.state}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            u.role === "super_admin"
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                          }`}
                        >
                          {u.role.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {ROLE_DESCRIPTIONS[u.role] || "Administrative staff role"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <select
                          aria-label={`Change role for ${u.username}`}
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value, u.username)}
                          className="px-2.5 py-1.5 rounded-xl bg-[#161b27] border border-white/10 text-xs font-semibold text-slate-200"
                        >
                          <option value="super_admin">super_admin</option>
                          <option value="moderator">moderator</option>
                          <option value="support">support</option>
                          <option value="finance">finance</option>
                          <option value="fraud">fraud</option>
                          <option value="player">Revoke (Demote to Player)</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. Session Defaults */}
          <div className="rounded-3xl p-6 bg-[#0f1219] border border-white/10 space-y-5">
            <div className="flex items-center gap-2.5">
              <Sliders className="size-5 text-amber-400" />
              <div>
                <h2 className="text-base font-bold text-white">3-Day Game Session Defaults</h2>
                <p className="text-xs text-slate-400">
                  Default duration window, entry fee (0 for Free-to-Play Launch), and questions per session.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="set-duration">
                  Default Session Window (Hours)
                </label>
                <input
                  id="set-duration"
                  type="number"
                  value={sessionDefaults.duration_hours}
                  onChange={(e) =>
                    setSessionDefaults({
                      ...sessionDefaults,
                      duration_hours: Number(e.target.value),
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="set-fee">
                  Default Entry Fee (Coins — 0 = Free)
                </label>
                <input
                  id="set-fee"
                  type="number"
                  value={sessionDefaults.entry_fee_coins}
                  onChange={(e) =>
                    setSessionDefaults({
                      ...sessionDefaults,
                      entry_fee_coins: Number(e.target.value),
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="set-qcount">
                  Questions per Session
                </label>
                <input
                  id="set-qcount"
                  type="number"
                  value={sessionDefaults.questions_per_session}
                  onChange={(e) =>
                    setSessionDefaults({
                      ...sessionDefaults,
                      questions_per_session: Number(e.target.value),
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={savingKey === "session_defaults"}
                onClick={() =>
                  saveSetting("session_defaults", sessionDefaults, "Session defaults")
                }
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
              >
                <Check className="size-4" />
                <span>
                  {savingKey === "session_defaults" ? "Saving..." : "Save Session Defaults"}
                </span>
              </button>
            </div>
          </div>

          {/* 3. Telco VAS Subscription Tiers */}
          <div className="rounded-3xl p-6 bg-[#0f1219] border border-white/10 space-y-5">
            <div className="flex items-center gap-2.5">
              <Smartphone className="size-5 text-indigo-400" />
              <div>
                <h2 className="text-base font-bold text-white">Telco VAS Subscription Tiers</h2>
                <p className="text-xs text-slate-400">
                  Configure optional telco billing tiers for post-launch VAS monetization.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="set-daily-price">
                  Daily Plan Price (₦)
                </label>
                <input
                  id="set-daily-price"
                  type="number"
                  value={subPlans.daily.price_naira}
                  onChange={(e) =>
                    setSubPlans({
                      ...subPlans,
                      daily: { ...subPlans.daily, price_naira: Number(e.target.value) },
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="set-daily-coins">
                  Daily Plan Coins (🪙)
                </label>
                <input
                  id="set-daily-coins"
                  type="number"
                  value={subPlans.daily.coins}
                  onChange={(e) =>
                    setSubPlans({
                      ...subPlans,
                      daily: { ...subPlans.daily, coins: Number(e.target.value) },
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="set-weekly-price">
                  Weekly Plan Price (₦)
                </label>
                <input
                  id="set-weekly-price"
                  type="number"
                  value={subPlans.weekly.price_naira}
                  onChange={(e) =>
                    setSubPlans({
                      ...subPlans,
                      weekly: { ...subPlans.weekly, price_naira: Number(e.target.value) },
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="set-weekly-coins">
                  Weekly Plan Coins (🪙)
                </label>
                <input
                  id="set-weekly-coins"
                  type="number"
                  value={subPlans.weekly.coins}
                  onChange={(e) =>
                    setSubPlans({
                      ...subPlans,
                      weekly: { ...subPlans.weekly, coins: Number(e.target.value) },
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={savingKey === "subscription_plans"}
                onClick={() =>
                  saveSetting("subscription_plans", subPlans, "Subscription plans")
                }
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
              >
                <Check className="size-4" />
                <span>
                  {savingKey === "subscription_plans" ? "Saving..." : "Save VAS Tiers"}
                </span>
              </button>
            </div>
          </div>

          {/* 4. Anti-Bot & Tie-Breaker Thresholds */}
          <div className="rounded-3xl p-6 bg-[#0f1219] border border-white/10 space-y-5">
            <div className="flex items-center gap-2.5">
              <Shield className="size-5 text-emerald-400" />
              <div>
                <h2 className="text-base font-bold text-white">
                  Anti-Bot &amp; Tie-Breaker Thresholds
                </h2>
                <p className="text-xs text-slate-400">
                  Configure minimum human response speed and daily replay velocity thresholds.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="set-min-ms">
                  Minimum Human Response Time (ms)
                </label>
                <input
                  id="set-min-ms"
                  type="number"
                  value={fraudThresholds.min_response_ms}
                  onChange={(e) =>
                    setFraudThresholds({
                      ...fraudThresholds,
                      min_response_ms: Number(e.target.value),
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="set-max-sess">
                  Max Plays per Player / Day
                </label>
                <input
                  id="set-max-sess"
                  type="number"
                  value={fraudThresholds.max_sessions_per_day}
                  onChange={(e) =>
                    setFraudThresholds({
                      ...fraudThresholds,
                      max_sessions_per_day: Number(e.target.value),
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={savingKey === "fraud_thresholds"}
                onClick={() =>
                  saveSetting("fraud_thresholds", fraudThresholds, "Fraud thresholds")
                }
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
              >
                <Check className="size-4" />
                <span>
                  {savingKey === "fraud_thresholds" ? "Saving..." : "Save Fraud Thresholds"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
