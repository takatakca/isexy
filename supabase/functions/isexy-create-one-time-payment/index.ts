import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "../_shared/supabase.ts";
import { isexyEnv } from "../_shared/env.ts";
import { ensureStripeCustomerId } from "../_shared/stripe-customer.ts";
import { appBaseUrl, corsHeaders, gateRefusal, json, signedInMember } from "../_shared/payments.ts";

// Server-side authoritative catalog. Client sends only `productId` (+ gift or
// donation details). What a product gives is decided by
// isexy.fulfill_stripe_payment when Stripe confirms the payment.
type CatalogItem = { name: string; amountCents: number; currency: "usd" | "cad" };
const CATALOG: Record<string, CatalogItem> = {
  // Super Likes
  super_likes_3:  { name: "3 Super Likes",  amountCents: 1197, currency: "cad" },
  super_likes_15: { name: "15 Super Likes", amountCents: 4890, currency: "cad" },
  super_likes_30: { name: "30 Super Likes", amountCents: 7470, currency: "cad" },
  // Boosts
  boost_1:  { name: "1 Boost",  amountCents: 649,  currency: "cad" },
  boost_10: { name: "10 Boosts", amountCents: 3290, currency: "cad" },
  boost_20: { name: "20 Boosts", amountCents: 4980, currency: "cad" },
  // Primetime Boosts
  primetime_1: { name: "1 Primetime Boost",  amountCents: 999,  currency: "cad" },
  primetime_3: { name: "3 Primetime Boosts", amountCents: 2799, currency: "cad" },
  primetime_5: { name: "5 Primetime Boosts", amountCents: 3895, currency: "cad" },
  // Super Boosts
  superboost_3h:  { name: "Super Boost 3 hours",  amountCents: 4999,  currency: "cad" },
  superboost_6h:  { name: "Super Boost 6 hours",  amountCents: 9299,  currency: "cad" },
  superboost_12h: { name: "Super Boost 12 hours", amountCents: 16999, currency: "cad" },
  // Cuban Donations (server-defined amounts)
  donation_5:   { name: "Donation $5",   amountCents: 500,   currency: "usd" },
  donation_10:  { name: "Donation $10",  amountCents: 1000,  currency: "usd" },
  donation_25:  { name: "Donation $25",  amountCents: 2500,  currency: "usd" },
  donation_50:  { name: "Donation $50",  amountCents: 5000,  currency: "usd" },
  donation_100: { name: "Donation $100", amountCents: 10000, currency: "usd" },
  // Mobile top-ups
  topup_10: { name: "Mobile Top-Up $10", amountCents: 1000, currency: "usd" },
  topup_20: { name: "Mobile Top-Up $20", amountCents: 2000, currency: "usd" },
  topup_30: { name: "Mobile Top-Up $30", amountCents: 3000, currency: "usd" },
  topup_50: { name: "Mobile Top-Up $50", amountCents: 5000, currency: "usd" },
  // Food packages
  food_25:  { name: "Food Package - Basic",   amountCents: 2500,  currency: "usd" },
  food_50:  { name: "Food Package - Family",  amountCents: 5000,  currency: "usd" },
  food_100: { name: "Food Package - Premium", amountCents: 10000, currency: "usd" },
};

// The only details a member may attach (gift recipient and note, donation
// recipient). Anything else in the request body is ignored: the webhook
// used to trust e.g. a client-sent package_id or profile_id.
const ALLOWED_META: Record<string, number> = {
  recipient_profile_id: 36,
  message: 200,
  phone_number: 40,
  recipient_name: 120,
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function defaultReturnPath(productId: string): string {
  if (productId.startsWith("super_likes_")) return "/get-super-likes";
  if (/^(boost|primetime|superboost)_/.test(productId)) return "/get-boosts";
  if (/^(donation|topup|food)_/.test(productId)) return "/donate";
  return "/discover";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const refused = gateRefusal();
    if (refused) return refused;

    const member = await signedInMember(req);
    if (!member) return json({ error: "Not authenticated" }, 401);

    const body = await req.json().catch(() => ({}));
    const productId: string = typeof body?.productId === "string" ? body.productId : "";
    const clientMeta = (body?.metadata && typeof body.metadata === "object" ? body.metadata : {}) as Record<string, unknown>;

    const meta: Record<string, string> = {};
    for (const [key, max] of Object.entries(ALLOWED_META)) {
      const v = clientMeta[key];
      if (typeof v === "string" && v.trim() !== "") meta[key] = v.trim().slice(0, max);
    }
    if (meta.recipient_profile_id && !UUID.test(meta.recipient_profile_id)) delete meta.recipient_profile_id;

    let item: CatalogItem | null = null;

    // Gifts: priced from the gift_packages row (server-trusted).
    if (productId.startsWith("gift_")) {
      const giftPackageId = productId.slice(5);
      if (!UUID.test(giftPackageId) || !meta.recipient_profile_id || meta.recipient_profile_id === member.id) {
        return json({ error: "Invalid gift" }, 400);
      }
      const [{ data: pkg }, { data: recipient }] = await Promise.all([
        supabaseAdmin.from("gift_packages").select("id,name,price_usd,is_active").eq("id", giftPackageId).eq("is_active", true).maybeSingle(),
        supabaseAdmin.from("profiles").select("id").eq("id", meta.recipient_profile_id).eq("is_active", true).maybeSingle(),
      ]);
      if (!pkg || !recipient) return json({ error: "Invalid gift package" }, 400);
      item = { name: `Gift: ${pkg.name}`, amountCents: Math.round(Number(pkg.price_usd) * 100), currency: "usd" };
      meta.type = "gift";
      meta.gift_package_id = pkg.id;
    } else if (CATALOG[productId]) {
      item = CATALOG[productId];
      if (/^(donation|topup|food)_/.test(productId)) {
        meta.type = productId.startsWith("topup_") ? "topup" : productId.startsWith("food_") ? "food" : "donation";
      }
    }
    if (!item) return json({ error: "Invalid productId" }, 400);

    // Server-set keys last, so nothing above can override them.
    meta.user_id = member.id;
    meta.profile_id = member.id;
    meta.product_id = productId;

    const stripe = new Stripe(isexyEnv("STRIPE_SECRET_KEY") ?? "", { apiVersion: "2025-08-27.basil" });
    const customerId = await ensureStripeCustomerId(stripe, member);

    const requested = typeof body?.returnPath === "string" ? body.returnPath : "";
    const returnPath = /^\/[A-Za-z0-9/_-]{0,120}$/.test(requested) ? requested : defaultReturnPath(productId);
    const base = appBaseUrl(req);
    const sep = returnPath.includes("?") ? "&" : "?";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{
        price_data: { currency: item.currency, product_data: { name: item.name }, unit_amount: item.amountCents },
        quantity: 1,
      }],
      mode: "payment",
      success_url: `${base}${returnPath}${sep}checkout=success`,
      cancel_url: `${base}${returnPath}${sep}checkout=cancelled`,
      metadata: meta,
    });

    return json({ url: session.url });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[CREATE-ONE-TIME-PAYMENT]", errorMessage);
    return json({ error: errorMessage }, 500);
  }
});
