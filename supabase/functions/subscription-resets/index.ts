import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    console.log("[SUBSCRIPTION-RESETS] Starting weekly/monthly reset job");

    // 1. Reset weekly Super Likes for all users based on tier
    // Free: 0, Plus: 0, Gold: 5, Platinum: unlimited (set to 99)
    const tierResets: Record<string, number> = {
      free: 0,
      plus: 0,
      gold: 5,
      platinum: 99,
    };

    for (const [tier, amount] of Object.entries(tierResets)) {
      if (amount === 0) continue;
      const { error } = await supabase
        .from("profiles")
        .update({ super_likes_remaining: amount })
        .eq("subscription_tier", tier)
        .eq("is_active", true);

      if (error) {
        console.error(`[SUBSCRIPTION-RESETS] Error resetting super likes for ${tier}:`, error);
      } else {
        console.log(`[SUBSCRIPTION-RESETS] Reset super likes for tier=${tier} to ${amount}`);
      }
    }

    // 2. Reset daily likes for free users (100 per day)
    const { error: likesError } = await supabase
      .from("profiles")
      .update({ likes_remaining: 100 })
      .or("subscription_tier.is.null,subscription_tier.eq.free")
      .eq("is_active", true);

    if (likesError) {
      console.error("[SUBSCRIPTION-RESETS] Error resetting daily likes:", likesError);
    } else {
      console.log("[SUBSCRIPTION-RESETS] Reset daily likes for free users");
    }

    // 3. Monthly boost grant (Gold: 1, Platinum: 1)
    // Only run on 1st of month
    const now = new Date();
    if (now.getUTCDate() === 1) {
      for (const tier of ["gold", "platinum"]) {
        const { error } = await supabase.rpc("grant_monthly_boost", { p_tier: tier });
        if (error) {
          // Fallback: direct update
          const { error: updateError } = await supabase
            .from("profiles")
            .update({ boosts_remaining: 1 })
            .eq("subscription_tier", tier)
            .eq("is_active", true);
          if (updateError) {
            console.error(`[SUBSCRIPTION-RESETS] Error granting monthly boost for ${tier}:`, updateError);
          }
        }
        console.log(`[SUBSCRIPTION-RESETS] Granted monthly boost for tier=${tier}`);
      }
    }

    // 4. Expire subscriptions past their end date
    const { error: expireError } = await supabase
      .from("profiles")
      .update({ is_premium: false, subscription_tier: "free" })
      .lt("subscription_expires_at", now.toISOString())
      .eq("is_premium", true);

    if (expireError) {
      console.error("[SUBSCRIPTION-RESETS] Error expiring subscriptions:", expireError);
    } else {
      console.log("[SUBSCRIPTION-RESETS] Expired past-due subscriptions");
    }

    return new Response(JSON.stringify({ success: true, timestamp: now.toISOString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[SUBSCRIPTION-RESETS] ERROR:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
