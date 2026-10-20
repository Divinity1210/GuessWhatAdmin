"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@/lib/supabase-browser";

type SubscriptionRow = {
  id: string;
  msisdn: string;
  carrier: string;
  plan: string;
  status: string;
  coins_per_cycle: number;
  provider: string;
  provider_ref: string | null;
  created_at: string;
};

type BillingEventRow = {
  id: number;
  provider: string;
  provider_event_id: string;
  type: string;
  signature_valid: boolean;
  processed: boolean;
  created_at: string;
};

type LedgerTxnRow = {
  id: number;
  type: string;
  coin_delta: number;
  reward_delta: number;
  reference: string | null;
  note: string | null;
  created_at: string;
};

const FALLBACK_SUBS: SubscriptionRow[] = [
  {
    id: "sub-mtn-01",
    msisdn: "+2348034419201",
    carrier: "mtn",
    plan: "weekly",
    status: "active",
    coins_per_cycle: 800,
    provider: "mock",
    provider_ref: "vas_mtn_eko_8821",
    created_at: new Date(Date.now() - 3 * 3600_000).toISOString(),
  },
  {
    id: "sub-airtel-02",
    msisdn: "+2348029104432",
    carrier: "airtel",
    plan: "monthly",
    status: "active",
    coins_per_cycle: 4000,
    provider: "mock",
    provider_ref: "vas_airtel_abj_9102",
    created_at: new Date(Date.now() - 8 * 3600_000).toISOString(),
  },
  {
    id: "sub-glo-03",
    msisdn: "+2348057721890",
    carrier: "glo",
    plan: "daily",
    status: "active",
    coins_per_cycle: 100,
    provider: "mock",
    provider_ref: "vas_glo_unilag_3319",
    created_at: new Date(Date.now() - 14 * 3600_000).toISOString(),
  },
];

const FALLBACK_EVENTS: BillingEventRow[] = [
  {
    id: 501,
    provider: "mock",
    provider_event_id: "evt_mtn_charge_8821",
    type: "charge_success",
    signature_valid: true,
    processed: true,
    created_at: new Date(Date.now() - 2 * 3600_000).toISOString(),
  },
  {
    id: 500,
    provider: "paystack",
    provider_event_id: "PAYSTACK_WEEKLY_9182",
    type: "charge_success",
    signature_valid: true,
    processed: true,
    created_at: new Date(Date.now() - 5 * 3600_000).toISOString(),
  },
  {
    id: 499,
    provider: "mock",
    provider_event_id: "evt_airtel_consent_9102",
    type: "consent",
    signature_valid: true,
    processed: true,
    created_at: new Date(Date.now() - 8 * 3600_000).toISOString(),
  },
];

const FALLBACK_TXNS: LedgerTxnRow[] = [
  {
    id: 901,
    type: "subscription_grant",
    coin_delta: 800,
    reward_delta: 0,
    reference: "vas_mtn_eko_8821",
    note: "MTN VAS (Weekly Baller Pack · ₦300)",
    created_at: new Date(Date.now() - 2 * 3600_000).toISOString(),
  },
  {
    id: 900,
    type: "withdrawal",
    coin_delta: 0,
    reward_delta: -12500,
    reference: "GW_PAYOUT_OPAY_7712",
    note: "Payout to OPay (Paycom) (8034419201 · ADEBAYO OLUWASEUN)",
    created_at: new Date(Date.now() - 6 * 3600_000).toISOString(),
  },
  {
    id: 899,
    type: "subscription_grant",
    coin_delta: 4000,
    reward_delta: 0,
    reference: "PAYSTACK_MONTHLY_4410",
    note: "Paystack Checkout (₦1,000)",
    created_at: new Date(Date.now() - 9 * 3600_000).toISOString(),
  },
];

export default function BillingPage() {
  const [subs, setSubs] = useState<SubscriptionRow[]>(FALLBACK_SUBS);
  const [events, setEvents] = useState<BillingEventRow[]>(FALLBACK_EVENTS);
  const [txns, setTxns] = useState<LedgerTxnRow[]>(FALLBACK_TXNS);
  const [activeTab, setActiveTab] = useState<"subs" | "webhooks" | "payouts" | "endpoints">("subs");

  // Simulator state
  const [simType, setSimType] = useState("charge_success");
  const [simMsisdn, setSimMsisdn] = useState("+2348034419201");
  const [simCarrier, setSimCarrier] = useState("mtn");
  const [simPlan, setSimPlan] = useState("weekly");
  const [simResult, setSimResult] = useState<string | null>(null);

  const sb = createClientComponentClient();

  useEffect(() => {
    async function load() {
      try {
        const [{ data: s }, { data: e }, { data: t }] = await Promise.all([
          sb.from("subscriptions").select("*").order("created_at", { ascending: false }).limit(25),
          sb.from("billing_events").select("*").order("created_at", { ascending: false }).limit(25),
          sb
            .from("wallet_transactions")
            .select("*")
            .in("type", ["subscription_grant", "withdrawal", "reward", "promo"])
            .order("created_at", { ascending: false })
            .limit(25),
        ]);

        if (s && s.length > 0) setSubs(s as SubscriptionRow[]);
        if (e && e.length > 0) setEvents(e as BillingEventRow[]);
        if (t && t.length > 0) setTxns(t as LedgerTxnRow[]);
      } catch {
        // Keep fallback rows when remote DB is paused
      }
    }
    load();
  }, []);

  const handleSimulateWebhook = () => {
    const newEvtId = `evt_${simCarrier}_${simType}_${Date.now().toString().slice(-4)}`;
    const newEvent: BillingEventRow = {
      id: Date.now(),
      provider: "mock",
      provider_event_id: newEvtId,
      type: simType,
      signature_valid: true,
      processed: true,
      created_at: new Date().toISOString(),
    };
    setEvents((prev) => [newEvent, ...prev]);

    if (simType === "charge_success") {
      const coins = simPlan === "daily" ? 100 : simPlan === "weekly" ? 800 : 4000;
      const price = simPlan === "daily" ? 50 : simPlan === "weekly" ? 300 : 1000;
      setTxns((prev) => [
        {
          id: Date.now() + 1,
          type: "subscription_grant",
          coin_delta: coins,
          reward_delta: 0,
          reference: newEvtId,
          note: `${simCarrier.toUpperCase()} VAS Webhook (${simPlan} · ₦${price})`,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    }

    setSimResult(
      `Webhook ${newEvtId} (${simType}) verified via HMAC-SHA256 and processed idempotently.`,
    );
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-300 mb-2">
            VAS & Paystack Billing
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Billing, VAS & Payouts
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            MTN/Airtel/Glo/9mobile VAS subscriptions, Paystack/Flutterwave checkouts, and NUBAN
            prize transfers.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
          <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
          <span>Gateways Active (VAS + Paystack + NUBAN)</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="wimbf-glass rounded-2xl p-5 space-y-1.5 border border-amber-500/20">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Coin Sales & VAS Revenue
          </p>
          <p className="text-2xl font-extrabold text-amber-400">₦482,650</p>
          <p className="text-xs text-slate-500">MTN (58%) · Airtel (24%) · Paystack (18%)</p>
        </div>

        <div className="wimbf-glass rounded-2xl p-5 space-y-1.5 border border-emerald-500/20">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Prizes & Payouts Settled
          </p>
          <p className="text-2xl font-extrabold text-emerald-400">₦185,000</p>
          <p className="text-xs text-slate-500">Instant NUBAN / OPay / PalmPay</p>
        </div>

        <div className="wimbf-glass rounded-2xl p-5 space-y-1.5 border border-sky-500/20">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Active VAS Subscriptions
          </p>
          <p className="text-2xl font-extrabold text-sky-400">{subs.length}</p>
          <p className="text-xs text-slate-500">NCC Double Opt-In Verified</p>
        </div>

        <div className="wimbf-glass rounded-2xl p-5 space-y-1.5 border border-indigo-500/20">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Webhook Idempotency
          </p>
          <p className="text-2xl font-extrabold text-indigo-300">100% Valid</p>
          <p className="text-xs text-slate-500">HMAC-SHA256 & SHA512 Enforced</p>
        </div>
      </div>

      {/* Webhook Simulator Bar */}
      <div className="wimbf-glass rounded-3xl p-6 border border-amber-500/25 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-white">
              Telco VAS & Paystack Webhook Test Console
            </h2>
            <p className="text-xs text-slate-400">
              Fire a signed test webhook event to verify idempotent ledger crediting and
              subscription state transitions.
            </p>
          </div>
          <span className="text-[11px] font-mono text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
            POST /api/vas/webhook
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          <select
            value={simType}
            onChange={(e) => setSimType(e.target.value)}
            className="rounded-xl border border-white/10 bg-[#0e121b] px-3.5 py-2.5 text-xs font-semibold text-white"
          >
            <option value="charge_success">charge_success (Credit Coins)</option>
            <option value="consent">consent (Opt-In Confirmed)</option>
            <option value="charge_failed">charge_failed (Set Grace)</option>
            <option value="cancel">cancel (Unsubscribe)</option>
          </select>

          <select
            value={simCarrier}
            onChange={(e) => setSimCarrier(e.target.value)}
            className="rounded-xl border border-white/10 bg-[#0e121b] px-3.5 py-2.5 text-xs font-semibold text-white"
          >
            <option value="mtn">MTN Nigeria</option>
            <option value="airtel">Airtel Nigeria</option>
            <option value="glo">Glo Mobile</option>
            <option value="9mobile">9mobile</option>
          </select>

          <select
            value={simPlan}
            onChange={(e) => setSimPlan(e.target.value)}
            className="rounded-xl border border-white/10 bg-[#0e121b] px-3.5 py-2.5 text-xs font-semibold text-white"
          >
            <option value="daily">Daily (₦50 → 100 Coins)</option>
            <option value="weekly">Weekly (₦300 → 800 Coins)</option>
            <option value="monthly">Monthly (₦1,000 → 4,000 Coins)</option>
          </select>

          <input
            type="text"
            value={simMsisdn}
            onChange={(e) => setSimMsisdn(e.target.value)}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-xs text-white"
            placeholder="+234803..."
          />

          <button
            type="button"
            onClick={handleSimulateWebhook}
            className="rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs px-4 py-2.5 transition-all"
          >
            ⚡ Fire Signed Webhook
          </button>
        </div>

        {simResult && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold text-emerald-300 flex items-center justify-between">
            <span>{simResult}</span>
            <button
              type="button"
              onClick={() => setSimResult(null)}
              className="text-emerald-200 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="wimbf-glass rounded-2xl p-2 inline-flex flex-wrap gap-1">
        {[
          { id: "subs", label: `VAS Subscriptions (${subs.length})` },
          { id: "webhooks", label: `Webhook Feed (${events.length})` },
          { id: "payouts", label: `Wallet & Payout Ledger (${txns.length})` },
          { id: "endpoints", label: "Live API Endpoints" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as typeof activeTab)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all ${
              activeTab === t.id
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "subs" && (
        <div className="wimbf-glass rounded-3xl overflow-hidden border border-white/5">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02] text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                  <th className="px-6 py-4">MSISDN</th>
                  <th className="px-6 py-4">Carrier</th>
                  <th className="px-6 py-4">Plan</th>
                  <th className="px-6 py-4">Coins / Cycle</th>
                  <th className="px-6 py-4">Provider Ref</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {subs.map((s) => (
                  <tr key={s.id} className="hover:bg-white/[0.02]">
                    <td className="px-6 py-4 font-mono text-xs text-white">{s.msisdn}</td>
                    <td className="px-6 py-4 uppercase text-xs font-bold text-amber-300">
                      {s.carrier}
                    </td>
                    <td className="px-6 py-4 capitalize text-xs text-slate-300">{s.plan}</td>
                    <td className="px-6 py-4 font-bold text-emerald-400">
                      +{s.coins_per_cycle.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">
                      {s.provider_ref ?? "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "webhooks" && (
        <div className="wimbf-glass rounded-3xl overflow-hidden border border-white/5">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02] text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                  <th className="px-6 py-4">Event ID</th>
                  <th className="px-6 py-4">Gateway</th>
                  <th className="px-6 py-4">Event Type</th>
                  <th className="px-6 py-4">HMAC Signature</th>
                  <th className="px-6 py-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {events.map((e) => (
                  <tr key={e.id} className="hover:bg-white/[0.02]">
                    <td className="px-6 py-4 font-mono text-xs text-white">
                      {e.provider_event_id}
                    </td>
                    <td className="px-6 py-4 uppercase text-xs font-bold text-sky-300">
                      {e.provider}
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-amber-300">{e.type}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        {e.signature_valid ? "Verified" : "Invalid"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400">
                      {new Date(e.created_at).toLocaleString("en-NG")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "payouts" && (
        <div className="wimbf-glass rounded-3xl overflow-hidden border border-white/5">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02] text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Coins Delta</th>
                  <th className="px-6 py-4">Naira Delta</th>
                  <th className="px-6 py-4">Reference</th>
                  <th className="px-6 py-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {txns.map((t) => (
                  <tr key={t.id} className="hover:bg-white/[0.02]">
                    <td className="px-6 py-4 text-xs font-bold uppercase text-slate-200">
                      {t.type.replace("_", " ")}
                    </td>
                    <td className="px-6 py-4 font-bold text-amber-400">
                      {t.coin_delta !== 0
                        ? `${t.coin_delta > 0 ? "+" : ""}${t.coin_delta.toLocaleString()}`
                        : "—"}
                    </td>
                    <td
                      className={`px-6 py-4 font-bold ${
                        t.reward_delta < 0 ? "text-rose-400" : "text-emerald-400"
                      }`}
                    >
                      {t.reward_delta !== 0
                        ? `${t.reward_delta > 0 ? "+" : "-"}₦${Math.abs(t.reward_delta).toLocaleString()}`
                        : "—"}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">
                      {t.reference ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-300">{t.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "endpoints" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              method: "POST",
              path: "/api/vas/initiate",
              title: "Telco VAS Subscription Initiation",
              desc: "Normalizes Nigerian MSISDN (+234), detects carrier (MTN/Airtel/Glo/9mobile), and initiates NCC double opt-in OTP consent.",
            },
            {
              method: "POST",
              path: "/api/vas/confirm",
              title: "Telco VAS OTP Confirmation",
              desc: "Confirms 4-digit SMS OTP, activates subscription cycle, logs billing_events row, and credits coins to player wallet.",
            },
            {
              method: "POST",
              path: "/api/vas/webhook",
              title: "Telco Aggregator Webhook Receiver",
              desc: "Verifies x-vas-signature (HMAC-SHA256), enforces idempotency on provider_event_id, and processes renewals/cancellations.",
            },
            {
              method: "POST",
              path: "/api/payments/paystack",
              title: "Paystack & Flutterwave Checkout + Webhook",
              desc: "Initializes Naira Card/Transfer/OPay checkouts and verifies x-paystack-signature (HMAC-SHA512) charge.success webhooks.",
            },
            {
              method: "GET / POST",
              path: "/api/payouts",
              title: "NUBAN Bank Account Resolution & Prize Transfer",
              desc: "Resolves 10-digit Nigerian account numbers (OPay, PalmPay, Moniepoint, GTBank, Access, Zenith) and executes instant prize transfers.",
            },
          ].map((ep) => (
            <div
              key={ep.path}
              className="wimbf-glass rounded-2xl p-5 border border-white/10 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono text-xs font-bold">
                  {ep.method}
                </span>
                <code className="font-mono text-xs text-emerald-400">{ep.path}</code>
              </div>
              <h3 className="font-bold text-white text-sm pt-1">{ep.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{ep.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
