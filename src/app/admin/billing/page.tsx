export default function BillingPage() {
  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-300 mb-2">
          💎 VAS & Paystack Billing
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Billing & Monetization</h1>
        <p className="text-slate-400 text-sm mt-1">
          Coin package sales, subscription cycles, VAS billing feeds, and payout reconciliations.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="wimbf-glass rounded-2xl p-6 space-y-2 border border-amber-500/20">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Coin Revenue</p>
          <p className="text-3xl font-extrabold text-amber-400">₦0.00</p>
          <p className="text-xs text-slate-500">Phase 3 Integration</p>
        </div>

        <div className="wimbf-glass rounded-2xl p-6 space-y-2 border border-emerald-500/20">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Prizes Paid Out</p>
          <p className="text-3xl font-extrabold text-emerald-400">₦0.00</p>
          <p className="text-xs text-slate-500">Automated RPC Payouts</p>
        </div>

        <div className="wimbf-glass rounded-2xl p-6 space-y-2 border border-indigo-500/20">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Gateway Status</p>
          <p className="text-xl font-bold text-indigo-300">Standing By</p>
          <p className="text-xs text-slate-500">Paystack / Telco VAS</p>
        </div>
      </div>

      <div className="wimbf-glass rounded-3xl p-12 text-center space-y-4 border border-white/5">
        <span className="text-5xl">💎</span>
        <h2 className="text-xl font-bold text-white">VAS & Direct Billing Hub</h2>
        <p className="text-sm text-slate-400 max-w-lg mx-auto">
          Subscription metrics, recurring billing webhooks, carrier billing settlement, and token conversion feeds will automatically populate here upon Phase 3 activation.
        </p>
      </div>
    </div>
  );
}
