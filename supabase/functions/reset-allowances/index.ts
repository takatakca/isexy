import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Reset weekly allowances (super likes + first impressions)
    const { data: weeklyResult, error: weeklyError } = await supabase.rpc("reset_weekly_allowances");
    if (weeklyError) console.error("Weekly reset error:", weeklyError);

    // Reset monthly allowances (monthly boosts)
    const { data: monthlyResult, error: monthlyError } = await supabase.rpc("reset_monthly_allowances");
    if (monthlyError) console.error("Monthly reset error:", monthlyError);

    // Expire promotions that have passed their deadline
    const { error: promoError } = await supabase
      .from("promotions")
      .update({ eligible: false })
      .lt("offer_expires_at", new Date().toISOString())
      .is("redeemed_at", null)
      .eq("eligible", true);
    if (promoError) console.error("Promo expiry error:", promoError);

    console.log(`[RESET-ALLOWANCES] Weekly: ${weeklyResult ?? 0}, Monthly: ${monthlyResult ?? 0}`);

    return new Response(JSON.stringify({
      weekly_reset: weeklyResult ?? 0,
      monthly_reset: monthlyResult ?? 0,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[RESET-ALLOWANCES] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
