import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { isexyEnv } from "../_shared/env.ts";
import { ensureStripeCustomerId } from "../_shared/stripe-customer.ts";
import { appBaseUrl, corsHeaders, gateRefusal, json, signedInMember } from "../_shared/payments.ts";

// Credit packs, charged in CAD. The client only sends packageId; what a pack
// gives is decided again by isexy.fulfill_stripe_payment when Stripe confirms.
const PACKAGES: Record<string, { priceCents: number; label: string }> = {
  credits_10: { priceCents: 999, label: "10 ISEXY credits" },
  credits_25: { priceCents: 1999, label: "25 ISEXY credits + 5 bonus" },
  credits_50: { priceCents: 3499, label: "50 ISEXY credits + 15 bonus" },
  credits_100: { priceCents: 5999, label: "100 ISEXY credits + 40 bonus" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const refused = gateRefusal();
    if (refused) return refused;

    const member = await signedInMember(req);
    if (!member) return json({ error: "Not authenticated" }, 401);

    const body = await req.json().catch(() => ({}));
    const packageId: string | undefined = body?.packageId;
    const pkg = packageId ? PACKAGES[packageId] : undefined;
    if (!packageId || !pkg) return json({ error: "Invalid packageId" }, 400);

    const stripe = new Stripe(isexyEnv("STRIPE_SECRET_KEY") ?? "", { apiVersion: "2025-08-27.basil" });
    const customerId = await ensureStripeCustomerId(stripe, member);
    const base = appBaseUrl(req);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{
        price_data: { currency: "cad", product_data: { name: pkg.label }, unit_amount: pkg.priceCents },
        quantity: 1,
      }],
      mode: "payment",
      success_url: `${base}/buy-credits?checkout=success`,
      cancel_url: `${base}/buy-credits?checkout=cancelled`,
      metadata: { user_id: member.id, profile_id: member.id, product_id: packageId, package_id: packageId },
    });

    return json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[CREATE-CREDIT-PURCHASE]", message);
    return json({ error: message }, 500);
  }
});
