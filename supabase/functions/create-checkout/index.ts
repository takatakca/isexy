import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Server-side mapping: tier + duration -> Stripe price ID
const PRICE_MAP: Record<string, Record<string, string>> = {
  plus: {
    week: "price_1TTy8TDTp0s6enQIwncoADHV",
    month: "price_1TTy8aDTp0s6enQIgteqRXkk",
    "6months": "price_1TTy8fDTp0s6enQIHMHbr2NF",
  },
  gold: {
    week: "price_1TTy8kDTp0s6enQIEWrLSt4p",
    month: "price_1TTy8nDTp0s6enQILlo2IRaL",
    "6months": "price_1TTy8rDTp0s6enQIqCNgNOhD",
  },
  platinum: {
    week: "price_1TTy8uDTp0s6enQIHE7Mr5pM",
    month: "price_1TTy8xDTp0s6enQIulowd3ET",
    "6months": "price_1TTy92DTp0s6enQIqM1gxUvF",
  },
};

const VALID_TIERS = ["plus", "gold", "platinum"];
const VALID_DURATIONS = ["week", "month", "6months"];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const { tier, duration } = await req.json();

    if (!VALID_TIERS.includes(tier)) {
      return new Response(JSON.stringify({ error: "Invalid tier" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }
    if (!VALID_DURATIONS.includes(duration)) {
      return new Response(JSON.stringify({ error: "Invalid duration" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const priceId = PRICE_MAP[tier][duration];
    if (!priceId) {
      return new Response(JSON.stringify({ error: "Price not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      metadata: { tier, duration, profile_user_id: user.id },
      subscription_data: {
        metadata: { tier, duration, profile_user_id: user.id },
      },
      success_url: `${req.headers.get("origin")}/discover?success=true`,
      cancel_url: `${req.headers.get("origin")}/premium?cancelled=true`,
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
