import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "../_shared/supabase.ts";
import { isexyEnv } from "../_shared/env.ts";

// Daily scheduler job: plans that ended go back to free (or to another plan
// the member still has), free members get their 100 daily Likes back, and the
// weekly/monthly allowances follow the same SQL rules as
// isexy-reset-allowances (running both is harmless: each reset happens only
// when it is due). Super Likes are no longer overwritten here: the weekly
// allowance lives in isexy.allowances and bought Super Likes are kept.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Scheduler only: the service-role key or the x-cron-secret header.
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const cronSecret = isexyEnv("CRON_SECRET") ?? "";
  const authorized =
    (token.length > 0 && token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) ||
    (cronSecret.length >= 16 && req.headers.get("x-cron-secret") === cronSecret);
  if (!authorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  const errors: string[] = [];
  const results: Record<string, unknown> = {};
  for (const fn of ["expire_member_plans", "reset_daily_likes", "reset_weekly_allowances", "reset_monthly_allowances"]) {
    const { data, error } = await supabase.rpc(fn);
    if (error) errors.push(`${fn}: ${error.message}`);
    results[fn] = data ?? 0;
  }
  console.log("[SUBSCRIPTION-RESETS]", JSON.stringify({ results, errors }));
  return new Response(JSON.stringify({ success: errors.length === 0, results, errors, timestamp: new Date().toISOString() }), {
    status: errors.length ? 500 : 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
