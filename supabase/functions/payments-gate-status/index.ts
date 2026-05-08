import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
  const liveEnabled = (Deno.env.get("PAYMENTS_LIVE_ENABLED") || "false").toLowerCase() === "true";
  const isTestKey = stripeKey.startsWith("sk_test_");
  const isLiveKey = stripeKey.startsWith("sk_live_");
  const blocked = !liveEnabled && !isTestKey;
  return new Response(JSON.stringify({
    liveEnabled,
    isTestKey,
    isLiveKey,
    blocked,
    mode: isTestKey ? "test" : isLiveKey ? "live" : "unknown",
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
});
