import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { isexyEnv } from "../_shared/env.ts";
import { ensureStripeCustomerId } from "../_shared/stripe-customer.ts";
import { appBaseUrl, corsHeaders, gateRefusal, json, signedInMember } from "../_shared/payments.ts";

// Phone / video minute packs, charged in CAD at the prices Buy Minutes shows
// (the hard-coded Lovable-era Stripe price ids are gone). Minutes are added
// by isexy.fulfill_stripe_payment when Stripe confirms the payment.
const MINUTE_PACKAGES: Record<string, { priceCents: number; label: string }> = {
  phone_20: { priceCents: 999, label: "20 phone minutes" },
  phone_150: { priceCents: 4500, label: "150 phone minutes" },
  phone_450: { priceCents: 9000, label: "450 phone minutes" },
  video_20: { priceCents: 1500, label: "20 video minutes" },
  video_150: { priceCents: 10000, label: "150 video minutes" },
  video_450: { priceCents: 25000, label: "450 video minutes" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const refused = gateRefusal();
    if (refused) return refused;

    const member = await signedInMember(req);
    if (!member) return json({ error: "Not authenticated" }, 401);

    const body = await req.json().catch(() => ({}));
    const packageId: string = typeof body?.packageId === "string" ? body.packageId : "";
    const base = appBaseUrl(req);
    const stripe = new Stripe(isexyEnv("STRIPE_SECRET_KEY") ?? "", { apiVersion: "2025-08-27.basil" });

    // Monthly chat subscription: a recurring Stripe price set by the owner.
    if (packageId === "chat_1mo") {
      const priceId = isexyEnv("STRIPE_PRICE_CHAT_1MO");
      if (!priceId) return json({ error: "The chat subscription is not available yet.", code: "price_missing" }, 503);
      const customerId = await ensureStripeCustomerId(stripe, member);
      const metadata = { user_id: member.id, profile_id: member.id, package_id: "chat_1mo", type: "chat_sub", plan_months: "1" };
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        mode: "subscription",
        metadata,
        subscription_data: { metadata },
        success_url: `${base}/messages?checkout=success`,
        cancel_url: `${base}/messages?checkout=cancelled`,
      });
      return json({ url: session.url });
    }

    const pkg = MINUTE_PACKAGES[packageId];
    if (!pkg) return json({ error: "Invalid package" }, 400);

    const customerId = await ensureStripeCustomerId(stripe, member);
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{
        price_data: { currency: "cad", product_data: { name: pkg.label }, unit_amount: pkg.priceCents },
        quantity: 1,
      }],
      mode: "payment",
      success_url: `${base}/buy-minutes?checkout=success&package=${packageId}`,
      cancel_url: `${base}/buy-minutes?checkout=cancelled`,
      metadata: { user_id: member.id, profile_id: member.id, product_id: packageId, package_id: packageId },
    });

    return json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[CREATE-MINUTE-PURCHASE]", message);
    return json({ error: message }, 500);
  }
});
