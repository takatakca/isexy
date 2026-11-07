import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, json, paymentsGate } from "../_shared/payments.ts";

// Can members pay right now? (no secrets in the answer). The pages disable
// their buy buttons and say why when `blocked` is true. The rule (main
// 705cc26 + this branch) lives in _shared/payments.ts paymentsGate(): the live
// flag alone never opens sales without a well-formed key and the webhook secret.
serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return json(paymentsGate());
});
