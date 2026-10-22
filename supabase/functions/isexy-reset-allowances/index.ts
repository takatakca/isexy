import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "../_shared/supabase.ts";
import { isexyEnv } from "../_shared/env.ts";

// Scheduler: POST with a gateway JWT (verify_jwt = true) and x-cron-secret
// (.github/workflows/isexy-allowance-cron.yml). Plans that ended, weekly Super
// Likes / First Impressions, the monthly Boost (only when 30 days have
// passed) and old promotions. The rules live in SQL (0013_app_completion.sql
// part R8, after 0007_secure_allowance_resets).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Allow": "POST, OPTIONS" },
    });
  }

  try {
    // Require a strong independent secret, even after the Supabase gateway
    // verifies the caller's JWT. The secret is never exposed to browsers.
    const cronSecret = isexyEnv("CRON_SECRET");
    const provided = req.headers.get("x-cron-secret");
    if (!cronSecret || cronSecret.length < 16 || !provided ||
        provided.length !== cronSecret.length ||
        !Array.from(provided).every((char, i) => char === cronSecret[i])) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Each task is reported by name only (details go to the function log): the
    // scheduler gets HTTP 500 when one of them failed (main 5949610).
    const failedTasks: string[] = [];
    const run = async (fn: string, task: string): Promise<number> => {
      const { data, error } = await supabase.rpc(fn);
      if (error) {
        console.error(`[RESET-ALLOWANCES] ${fn} failed:`, error);
        failedTasks.push(task);
        return 0;
      }
      return (data as number | null) ?? 0;
    };
    // Plans whose end date passed first, so the resets see the right tier.
    const expired = await run("expire_member_plans", "expired_plans");
    const weekly = await run("reset_weekly_allowances", "weekly_allowances");
    const monthly = await run("reset_monthly_allowances", "monthly_allowances");

    // Expire promotions that have passed their deadline
    const { error: promoError } = await supabase
      .from("promotions")
      .update({ eligible: false })
      .lt("offer_expires_at", new Date().toISOString())
      .is("redeemed_at", null)
      .eq("eligible", true);
    if (promoError) {
      console.error("Promo expiry error:", promoError);
      failedTasks.push("expired_promotions");
    }

    if (failedTasks.length > 0) {
      return new Response(JSON.stringify({
        error: "Scheduled maintenance incomplete",
        failed_tasks: failedTasks,
      }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[RESET-ALLOWANCES] expired plans: ${expired}, weekly: ${weekly}, monthly: ${monthly}`);
    return new Response(JSON.stringify({ expired_plans: expired, weekly_reset: weekly, monthly_reset: monthly }), {
      status: 200,
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
