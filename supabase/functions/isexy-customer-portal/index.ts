import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { isexyEnv } from "../_shared/env.ts";
import { findStripeCustomerId } from "../_shared/stripe-customer.ts";
import { corsHeaders, gateRefusal, json, signedInMember } from "../_shared/payments.ts";
import { isexyAppUrl } from "../_shared/app-url.ts";

// Stripe's billing page (cancel, change card, invoices) for members who paid
// with Stripe.

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const refused = gateRefusal();
    if (refused) return refused;

    const member = await signedInMember(req);
    if (!member) return json({ error: "Not authenticated" }, 401);

    const stripe = new Stripe(isexyEnv("STRIPE_SECRET_KEY") ?? "", { apiVersion: "2025-08-27.basil" });
    const customerId = await findStripeCustomerId(stripe, member);
    if (!customerId) {
      return json({ error: "No payment account yet: nothing was bought with this account.", code: "no_customer" }, 404);
    }

    // Return URL from ISEXY_APP_URL only, never the request Origin (main d713375).
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: isexyAppUrl("/my-subscription"),
    });
    return json({ url: portalSession.url });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[CUSTOMER-PORTAL]", errorMessage);
    return json({ error: errorMessage }, 500);
  }
});
