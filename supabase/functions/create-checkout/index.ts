import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

function jsonError(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const body = await req.json();
    const tier = body?.tier as Tier;
    // Normalize legacy "6months" to "six_months"
    const rawDuration = body?.duration === "6months" ? "six_months" : body?.duration;
    const duration = rawDuration as Duration;

    if (!VALID_TIERS.includes(tier)) return jsonError("Invalid tier");
    if (!VALID_DURATIONS.includes(duration)) return jsonError("Invalid duration");

    const envKey = ENV_KEY[tier][duration];
    const priceId = Deno.env.get(envKey);
    if (!priceId) {
      return jsonError(`Missing Stripe price configuration: ${envKey}`, 500);
    }

    const appUrl = Deno.env.get("APP_URL");
    if (!appUrl) {
      return jsonError("Missing configuration: APP_URL", 500);
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return jsonError("STRIPE_SECRET_KEY not configured", 500);

    // Live Payment Safety Gate
    const liveEnabled = (Deno.env.get("PAYMENTS_LIVE_ENABLED") || "false").toLowerCase() === "true";
    const isTestKey = stripeKey.startsWith("sk_test_");
    if (!liveEnabled && !isTestKey) {
      return jsonError("Live payments are disabled until testing is complete.", 403);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonError("No authorization header", 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user?.email) return jsonError("Not authenticated", 401);
    const user = userData.user;

    // Look up profile.id
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data[0]?.id;

    const metadata: Record<string, string> = {
      purchase_type: "subscription",
      user_id: user.id,
      tier,
      duration,
    };
    if (profile?.id) metadata.profile_id = profile.id;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      metadata,
      subscription_data: { metadata },
      success_url: `${appUrl}/discover?success=true`,
      cancel_url: `${appUrl}/premium?cancelled=true`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return jsonError(errorMessage, 500);
  }
});
