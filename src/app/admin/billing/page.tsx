"use client";

import { useEffect, useState } from "react";
import { Radio, Send, CheckCircle2, RefreshCw } from "lucide-react";

type SubRow = {
  id: string;
  msisdn?: string;
  phone?: string;
  carrier?: string | null;
  telco?: string | null;
  plan?: string;
  plan_type?: string;
  coins_per_cycle: number;
  price_naira?: number;
  status: string;
  next_billing_at?: string | null;
  expires_at?: string | null;
  profiles?: { username: string } | null;
};

type BillingEventRow = {
  id: number;
  type?: string;
  event_type?: string;
  provider_event_id?: string | null;
  telco_ref?: string | null;
  processed: boolean;
  created_at?: string;
  received_at?: string;
};

type WalletTxRow = {
  id: number;
  type: string;
  coin_delta: number;
  reward_delta: number;
  reference: string | null;
  note: string | null;
  created_at: string;
  profiles?: { username: string } | null;
};

export default function BillingPage() {
  const [subscriptions, setSubscriptions] = useState<SubRow[]>([]);
  const [events, setEvents] = useState<BillingEventRow[]>([]);
  const [transactions, setTransactions] = useState<WalletTxRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Webhook Simulator State
  const [simPhone, setSimPhone] = useState("08030001234");
  const [simTelco, setSimTelco] = useState("MTN");
  const [simEvent, setSimEvent] = useState("RENEWAL_SUCCESS");
  const [simPlan, setSimPlan] = useState<"daily" | "weekly">("daily");
  const [simSending, setSimSending] = useState(false);
  const [simToast, setSimToast] = useState("");

  async function loadBillingData() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/billing", { cache: "no-store" });
      const data = await res.json();
      setSubscriptions((data.subscriptions as SubRow[]) ?? []);
      setEvents((data.events as BillingEventRow[]) ?? []);
      setTransactions((data.transactions as WalletTxRow[]) ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBillingData();
  }, []);

  async function handleSimulateWebhook(e: React.FormEvent) {
    e.preventDefault();
    setSimSending(true);
    setSimToast("");

    try {
      const res = await fetch("/api/admin/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: simPhone,
          telco: simTelco,
          eventType: simEvent,
          planType: simPlan,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSimToast(
          `Webhook ${simEvent} (${data.telcoRef}) processed! ${
            data.coinsCredited > 0
              ? `+${data.coinsCredited} coins credited to @${data.username}.`
              : "Subscription status updated."
          }`
        );
        await loadBillingData();
      }
    } finally {
      setSimSending(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 700 }}>VAS Billing & Subscriptions</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginTop: 4 }}>
            Monitor telco subscription statuses, simulate live VAS aggregator webhooks, and audit wallet top-ups & payouts.
          </p>
        </div>
        <button className="btn btn-ghost" onClick={loadBillingData}>
          <RefreshCw size={14} /> Refresh Logs
        </button>
      </div>

      {/* Live Telco VAS Webhook Simulator */}
      <div className="card" style={{ borderColor: "rgba(245,200,66,0.35)", background: "linear-gradient(135deg, rgba(245,200,66,0.06), rgba(124,92,252,0.06))" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Radio size={18} color="#F5C842" />
            <h2 style={{ fontWeight: 700, fontSize: "1rem" }}>Live VAS Telco Webhook Simulator (SDP / Aggregator Testbench)</h2>
          </div>
          <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#F5C842", background: "rgba(245,200,66,0.12)", padding: "3px 10px", borderRadius: 99 }}>
            Persists to Supabase & Credits Wallet
          </span>
        </div>

        <form onSubmit={handleSimulateWebhook} className="grid-4" style={{ alignItems: "end" }}>
          <div>
            <label className="form-label" htmlFor="sim-phone">Subscriber MSISDN</label>
            <input
              id="sim-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              className="form-input"
              value={simPhone}
              onChange={(e) => setSimPhone(e.target.value)}
              placeholder="08030001234"
            />
          </div>
          <div>
            <label className="form-label" htmlFor="sim-telco">Telco Operator</label>
            <select id="sim-telco" name="telco" className="form-select" value={simTelco} onChange={(e) => setSimTelco(e.target.value)}>
              <option value="MTN">MTN Nigeria (*555*1#)</option>
              <option value="Airtel">Airtel NG (*555*2#)</option>
              <option value="Glo">Glo Mobile (*555*3#)</option>
              <option value="9mobile">9mobile (*555*4#)</option>
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="sim-event">Webhook Event Type</label>
            <select id="sim-event" name="eventType" className="form-select" value={simEvent} onChange={(e) => setSimEvent(e.target.value)}>
              <option value="SUBSCRIPTION_CREATED">SUBSCRIPTION_CREATED (+100 🪙)</option>
              <option value="RENEWAL_SUCCESS">RENEWAL_SUCCESS (+100 🪙)</option>
              <option value="RENEWAL_FAILED">RENEWAL_FAILED (Low Airtime)</option>
              <option value="UNSUBSCRIBED">UNSUBSCRIBED (STOP SMS)</option>
            </select>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <select
              aria-label="Billing Plan Cycle"
              className="form-select"
              style={{ width: 120 }}
              value={simPlan}
              onChange={(e) => setSimPlan(e.target.value as "daily" | "weekly")}
            >
              <option value="daily">Daily ₦100</option>
              <option value="weekly">Weekly ₦300</option>
            </select>
            <button type="submit" className="btn btn-primary" disabled={simSending} style={{ flex: 1, justifyContent: "center" }}>
              <Send size={14} /> {simSending ? "Firing..." : "Fire Signed Webhook"}
            </button>
          </div>
        </form>

        {simToast && (
          <div
            role="status"
            aria-live="polite"
            style={{
              marginTop: 14, padding: "10px 14px", borderRadius: 8,
              background: "rgba(0,229,160,0.1)", border: "1px solid rgba(0,229,160,0.3)",
              display: "flex", alignItems: "center", gap: 8, color: "#00E5A0", fontSize: "0.82rem", fontWeight: 600,
            }}
          >
            <CheckCircle2 size={16} /> {simToast}
          </div>
        )}
      </div>

      {/* Active Subscriptions */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ fontWeight: 700, fontSize: "1rem" }}>Subscriptions ({subscriptions.length})</h2>
        </div>
        {loading ? (
          <p style={{ padding: 24, color: "var(--muted)" }}>Loading subscriptions...</p>
        ) : subscriptions.length === 0 ? (
          <p style={{ padding: 24, color: "var(--muted)" }}>
            No subscriptions yet. Use the Live VAS Telco Webhook Simulator above to test a subscription event!
          </p>
        ) : (
          <div className="table-wrap" role="region" tabIndex={0} aria-label="VAS Subscriptions">
            <table>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Phone</th>
                  <th>Telco</th>
                  <th>Plan</th>
                  <th>Coins/Cycle</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Expires</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>@{s.profiles?.username ?? "—"}</td>
                    <td>{s.msisdn ?? s.phone ?? "—"}</td>
                    <td style={{ textTransform: "uppercase" }}>{s.carrier ?? s.telco ?? "—"}</td>
                    <td style={{ textTransform: "capitalize" }}>{s.plan ?? s.plan_type ?? "daily"}</td>
                    <td style={{ color: "var(--accent-gold)", fontWeight: 600 }}>{s.coins_per_cycle} 🪙</td>
                    <td>₦{s.price_naira ?? (s.plan === "weekly" ? 300 : 100)}</td>
                    <td><span className={`badge badge-${s.status === "active" ? "active" : "cancelled"}`}>{s.status}</span></td>
                    <td style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                      {(s.next_billing_at ?? s.expires_at)
                        ? new Date((s.next_billing_at ?? s.expires_at)!).toLocaleDateString("en-NG")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Wallet Top-ups & Bank Payout Ledger */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ fontWeight: 700, fontSize: "1rem" }}>Recent Coin Top-ups & Bank Withdrawals</h2>
        </div>
        {transactions.length === 0 ? (
          <p style={{ padding: 24, color: "var(--muted)" }}>No wallet transactions recorded yet.</p>
        ) : (
          <div className="table-wrap" role="region" tabIndex={0} aria-label="Recent Coin Top-ups and Bank Withdrawals">
            <table>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Type</th>
                  <th>Coin Delta</th>
                  <th>Cash Delta</th>
                  <th>Reference</th>
                  <th>Note</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td style={{ fontWeight: 600 }}>@{tx.profiles?.username ?? "player"}</td>
                    <td>
                      <span className={`badge ${tx.type === "withdrawal" ? "badge-pending" : "badge-active"}`}>
                        {tx.type}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: tx.coin_delta > 0 ? "var(--accent-gold)" : "var(--muted)" }}>
                      {tx.coin_delta > 0 ? `+${tx.coin_delta} 🪙` : tx.coin_delta < 0 ? `${tx.coin_delta} 🪙` : "—"}
                    </td>
                    <td style={{ fontWeight: 600, color: tx.reward_delta < 0 ? "var(--danger)" : tx.reward_delta > 0 ? "var(--accent)" : "var(--muted)" }}>
                      {tx.reward_delta !== 0
                        ? `${tx.reward_delta > 0 ? "+" : "-"}₦${Math.abs(Number(tx.reward_delta)).toLocaleString()}`
                        : "—"}
                    </td>
                    <td><code style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{tx.reference ?? "—"}</code></td>
                    <td style={{ fontSize: "0.8rem" }}>{tx.note ?? "—"}</td>
                    <td style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                      {new Date(tx.created_at).toLocaleString("en-NG", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Billing Webhook Events Log */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ fontWeight: 700, fontSize: "1rem" }}>Recent Webhook Events</h2>
        </div>
        {events.length === 0 ? (
          <p style={{ padding: 24, color: "var(--muted)" }}>No billing events received yet.</p>
        ) : (
          <div className="table-wrap" role="region" tabIndex={0} aria-label="Recent Webhook Events">
            <table>
              <thead>
                <tr>
                  <th>Event Type</th>
                  <th>Telco Ref</th>
                  <th>Processed</th>
                  <th>Received</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id}>
                    <td style={{ fontWeight: 600 }}>{ev.type ?? ev.event_type}</td>
                    <td><code style={{ fontSize: "0.78rem" }}>{ev.provider_event_id ?? ev.telco_ref ?? "—"}</code></td>
                    <td>
                      <span className={`badge ${ev.processed ? "badge-published" : "badge-pending"}`}>
                        {ev.processed ? "Processed" : "Pending"}
                      </span>
                    </td>
                    <td style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                      {new Date((ev.created_at ?? ev.received_at)!).toLocaleString("en-NG", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
