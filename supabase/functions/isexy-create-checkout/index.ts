import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "../_shared/supabase.ts";
import { isexyEnv } from "../_shared/env.ts";
import { ensureStripeCustomerId } from "../_shared/stripe-customer.ts";
import { appBaseUrl, corsHeaders, gateRefusal, json, signedInMember } from "../_shared/payments.ts";

// Plus / Gold / Platinum checkout. Prices are Stripe Price ids set as function
// secrets (ISEXY_STRIPE_PRICE_<TIER>_<DURATION>, in CAD). The plan itself is
// applied by isexy-stripe-webhook once Stripe confirms the payment.

const VALID_TIERS = ["plus", "gold", "platinum"] as const;
const VALID_DURATIONS = ["week", "month", "six_months"] as const;

type Tier = typeof VALID_TIERS[number];
type Duration = typeof VALID_DURATIONS[number];

const ENV_KEY: Record<Tier, Record<Duration, string>> = {
  plus: {
    week: "STRIPE_PRICE_PLUS_WEEK",
    month: "STRIPE_PRICE_PLUS_MONTH",
    six_months: "STRIPE_PRICE_PLUS_SIX_MONTHS",
  },
  gold: {
    week: "STRIPE_PRICE_GOLD_WEEK",
    month: "STRIPE_PRICE_GOLD_MONTH",
    six_months: "STRIPE_PRICE_GOLD_SIX_MONTHS",
  },
  platinum: {
    week: "STRIPE_PRICE_PLATINUM_WEEK",
    month: "STRIPE_PRICE_PLATINUM_MONTH",
    six_months: "STRIPE_PRICE_PLATINUM_SIX_MONTHS",
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const refused = gateRefusal();
    if (refused) return refused;

    const member = await signedInMember(req);
    if (!member) return json({ error: "Not authenticated" }, 401);

    const body = await req.json().catch(() => ({}));
    const tier = body?.tier as Tier;
    const duration = (body?.duration === "6months" ? "six_months" : body?.duration) as Duration;
    if (!VALID_TIERS.includes(tier)) return json({ error: "Invalid tier" }, 400);
    if (!VALID_DURATIONS.includes(duration)) return json({ error: "Invalid duration" }, 400);

    const envKey = ENV_KEY[tier][duration];
    const priceId = isexyEnv(envKey);
    if (!priceId) {
      console.error(`[CREATE-CHECKOUT] Missing Stripe price configuration: ${envKey}`);
      return json({ error: "This plan is not available yet.", code: "price_missing" }, 503);
    }

    const db = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );
    const { data: profile } = await db
      .from("profiles")
      .select("id, first_purchase_promo_used")
      .eq("user_id", member.id)
      .maybeSingle();
    if (!profile?.id) return json({ error: "Finish your profile first." }, 400);

    // First-week offer: weekly plans, members who never subscribed, and only
    // when the owner created the Stripe coupon (ISEXY_STRIPE_COUPON_FIRST_WEEK).
    const coupon = isexyEnv("STRIPE_COUPON_FIRST_WEEK");
    let discounts: { coupon: string }[] | undefined;
    if (body?.promo === true && duration === "week" && coupon && profile.first_purchase_promo_used !== true) {
      const { count } = await db.from("subscriptions").select("id", { count: "exact", head: true }).eq("profile_id", profile.id);
      if (!count) discounts = [{ coupon }];
    }

    const stripe = new Stripe(isexyEnv("STRIPE_SECRET_KEY") ?? "", { apiVersion: "2025-08-27.basil" });
    const customerId = await ensureStripeCustomerId(stripe, member);

    const metadata: Record<string, string> = {
      purchase_type: "subscription",
      user_id: member.id,
      profile_id: profile.id,
      tier,
      duration,
    };
    const base = appBaseUrl(req);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      metadata,
      subscription_data: { metadata },
      ...(discounts ? { discounts } : {}),
      success_url: `${base}/my-subscription?checkout=success`,
      cancel_url: `${base}/premium?checkout=cancelled`,
    });

    return json({ url: session.url });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[CREATE-CHECKOUT]", errorMessage);
    return json({ error: errorMessage }, 500);
  }
});
