import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { isexyEnv } from "../_shared/env.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const stripeKey = isexyEnv("STRIPE_SECRET_KEY") || "";
  const liveEnabled = (isexyEnv("PAYMENTS_LIVE_ENABLED") || "false").toLowerCase() === "true";
  const isTestKey = stripeKey.startsWith("sk_test_");
  const isLiveKey = stripeKey.startsWith("sk_live_");
  // The opt-in flag alone must not enable purchases with a missing or
  // malformed secret key. Test mode remains available with test keys.
  const blocked = !isTestKey && !(liveEnabled && isLiveKey);
  return new Response(JSON.stringify({
    liveEnabled,
    isTestKey,
    isLiveKey,
    blocked,
    mode: isTestKey ? "test" : isLiveKey ? "live" : "unknown",
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
});
