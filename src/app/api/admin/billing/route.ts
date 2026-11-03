import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

const PLAN_CONFIG = {
  daily: { coins: 100, price: 100, cycleDays: 1 },
  weekly: { coins: 350, price: 300, cycleDays: 7 },
} as const;

export async function GET() {
  try {
    const supabase = createServiceClient();
    const [{ data: subs }, { data: evs }, { data: txs }] = await Promise.all([
      supabase
        .from("subscriptions")
        .select("*, profiles(username)")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("billing_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("wallet_transactions")
        .select("*, profiles(username)")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    return NextResponse.json({
      subscriptions: subs ?? [],
      events: evs ?? [],
      transactions: txs ?? [],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load billing data" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const {
      phone = "08030001234",
      telco = "MTN",
      eventType = "RENEWAL_SUCCESS",
      planType = "daily",
    } = await req.json();

    const plan = PLAN_CONFIG[planType as keyof typeof PLAN_CONFIG] ?? PLAN_CONFIG.daily;
    const telcoRef = `${String(telco).toUpperCase()}-VAS-${Date.now().toString(36).toUpperCase()}`;

    const { data: matchedProfile } = await supabase
      .from("profiles")
      .select("id, username")
      .or(`phone.eq.${phone},username.eq.naija_striker`)
      .limit(1)
      .maybeSingle();

    let userId = matchedProfile?.id;
    let username = matchedProfile?.username ?? "naija_striker";
    if (!userId) {
      const { data: firstProfile } = await supabase
        .from("profiles")
        .select("id, username")
        .limit(1)
        .single();
      userId = firstProfile?.id;
      username = firstProfile?.username ?? "player";
    }

    const isCredit = eventType === "RENEWAL_SUCCESS" || eventType === "SUBSCRIPTION_CREATED";
    const subStatus =
      eventType === "UNSUBSCRIBED"
        ? "cancelled"
        : eventType === "RENEWAL_FAILED"
        ? "past_due"
        : "active";

    const nextBillingAt = new Date(Date.now() + plan.cycleDays * 86400_000).toISOString();

    let subId: string | undefined;
    if (userId) {
      const { data: existingSub } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("user_id", userId)
        .eq("msisdn", phone)
        .maybeSingle();

      if (existingSub) {
        subId = existingSub.id;
        await supabase
          .from("subscriptions")
          .update({
            carrier: String(telco).toLowerCase(),
            plan: planType,
            status: subStatus,
            coins_per_cycle: plan.coins,
            next_billing_at: nextBillingAt,
            updated_at: new Date().toISOString(),
          })
          .eq("id", subId);
      } else {
        const { data: createdSub } = await supabase
          .from("subscriptions")
          .insert({
            user_id: userId,
            msisdn: phone,
            carrier: String(telco).toLowerCase(),
            plan: planType,
            status: subStatus,
            coins_per_cycle: plan.coins,
            provider: "mock",
            provider_ref: telcoRef,
            next_billing_at: nextBillingAt,
          })
          .select("id")
          .single();
        subId = createdSub?.id;
      }
    }

    const dbEventType =
      eventType === "UNSUBSCRIBED"
        ? "cancel"
        : eventType === "RENEWAL_FAILED"
        ? "charge_failed"
        : eventType === "SUBSCRIPTION_CREATED"
        ? "opt_in"
        : "renewal";

    const { data: billingEvent } = await supabase
      .from("billing_events")
      .insert({
        provider: String(telco).toLowerCase(),
        provider_event_id: telcoRef,
        subscription_id: subId ?? null,
        type: dbEventType,
        raw_payload: {
          msisdn: phone,
          telco,
          plan: planType,
          coins: isCredit ? plan.coins : 0,
          amount_naira: plan.price,
        },
        signature_valid: true,
        processed: true,
      })
      .select()
      .single();

    if (isCredit && userId) {
      const { data: wallet } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", userId)
        .single();

      const nextCoins = Number(wallet?.coin_balance ?? 0) + plan.coins;
      const currentRewards = Number(wallet?.reward_balance ?? 0);

      await supabase.from("wallets").upsert({
        user_id: userId,
        coin_balance: nextCoins,
        reward_balance: currentRewards,
        withdrawable_balance: Number(wallet?.withdrawable_balance ?? currentRewards),
        updated_at: new Date().toISOString(),
      });

      await supabase.from("wallet_transactions").insert({
        user_id: userId,
        type: "topup",
        coin_delta: plan.coins,
        reward_delta: 0,
        coin_balance_after: nextCoins,
        reward_balance_after: currentRewards,
        reference: telcoRef,
        note: `${telco} VAS ${eventType === "SUBSCRIPTION_CREATED" ? "Opt-In" : "Renewal"} (${planType} · ${phone})`,
      });
    }

    return NextResponse.json({
      ok: true,
      telcoRef,
      username,
      coinsCredited: isCredit ? plan.coins : 0,
      billingEvent,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to process webhook" },
      { status: 500 }
    );
  }
}
