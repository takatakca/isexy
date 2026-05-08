import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Server-side authoritative catalog. Client sends only `productId`.
type CatalogItem = { name: string; description?: string; amountCents: number; currency: "usd" | "cad" };
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseAuth = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseAuth.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    const body = await req.json().catch(() => ({}));
    const productId: string | undefined = body?.productId;
    const metadata = (body?.metadata ?? {}) as Record<string, string>;

    let item: CatalogItem | null = null;
    let resolvedName: string | undefined;

    // Gifts: priced from gift_packages DB row (server-trusted)
    if (productId?.startsWith("gift_")) {
      const giftPackageId = productId.slice(5);
      const { data: pkg, error: pkgErr } = await supabaseAdmin
        .from("gift_packages")
        .select("id,name,price_usd,is_active")
        .eq("id", giftPackageId)
        .eq("is_active", true)
        .maybeSingle();
      if (pkgErr || !pkg) {
        return new Response(JSON.stringify({ error: "Invalid gift package" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      item = {
        name: `Gift: ${pkg.name}`,
        amountCents: Math.round(Number(pkg.price_usd) * 100),
        currency: "usd",
      };
      resolvedName = item.name;
      metadata.gift_package_id = pkg.id;
      metadata.type = "gift";
    } else if (productId && CATALOG[productId]) {
      item = CATALOG[productId];
      if (productId.startsWith("donation_") || productId.startsWith("topup_") || productId.startsWith("food_")) {
        metadata.type = metadata.type || (productId.startsWith("topup_") ? "topup" : productId.startsWith("food_") ? "food" : "donation");
      }
    }

    if (!item || !productId) {
      return new Response(JSON.stringify({ error: "Invalid productId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
    const liveEnabled = (Deno.env.get("PAYMENTS_LIVE_ENABLED") || "false").toLowerCase() === "true";
    if (!liveEnabled && !stripeKey.startsWith("sk_test_")) {
      return new Response(JSON.stringify({ error: "Live payments are disabled until testing is complete." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data[0]?.id;

    // Sanitize metadata: drop any monetary fields the client tried to inject.
    const safeMeta: Record<string, string> = {};
    for (const [k, v] of Object.entries(metadata)) {
      if (typeof v === "string" && v.length <= 500 && !/(amount|price|cents|usd|cad)/i.test(k)) {
        safeMeta[k] = v;
      }
    }
    safeMeta.user_id = user.id;
    safeMeta.product_id = productId;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{
        price_data: {
          currency: item.currency,
          product_data: { name: resolvedName ?? item.name },
          unit_amount: item.amountCents,
        },
        quantity: 1,
      }],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/discover?purchase=success`,
      cancel_url: `${req.headers.get("origin")}/discover?purchase=cancelled`,
      metadata: safeMeta,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
