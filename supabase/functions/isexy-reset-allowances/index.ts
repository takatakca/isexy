import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "../_shared/supabase.ts";
import { isexyEnv } from "../_shared/env.ts";

// Scheduler (x-cron-secret): weekly Super Likes / First Impressions, the
// monthly Boost (only when 30 days have passed), plans that ended, and old
// promotions. The rules live in SQL (docs/handoff/rewards.sql, R8).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const cronSecret = isexyEnv("CRON_SECRET");
    const provided = req.headers.get("x-cron-secret");
    if (!cronSecret || provided !== cronSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const errors: string[] = [];
    const run = async (fn: string) => {
      const { data, error } = await supabase.rpc(fn);
      if (error) errors.push(`${fn}: ${error.message}`);
      return data ?? 0;
    };
    const expired = await run("expire_member_plans");
    const weekly = await run("reset_weekly_allowances");
    const monthly = await run("reset_monthly_allowances");

    const { error: promoError } = await supabase
      .from("promotions")
      .update({ eligible: false })
      .lt("offer_expires_at", new Date().toISOString())
      .is("redeemed_at", null)
      .eq("eligible", true);
    if (promoError) errors.push(`promotions: ${promoError.message}`);

    console.log(`[RESET-ALLOWANCES] expired plans: ${expired}, weekly: ${weekly}, monthly: ${monthly}`);
    return new Response(JSON.stringify({ expired_plans: expired, weekly_reset: weekly, monthly_reset: monthly, errors }), {
      status: errors.length ? 500 : 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[RESET-ALLOWANCES] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
