import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "../_shared/supabase.ts";
import { isexyEnv } from "../_shared/env.ts";
import { ensureStripeCustomerId } from "../_shared/stripe-customer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Package definitions
const PACKAGES: Record<string, { price_id: string; minutes: number; type: "phone" | "video" | "chat_sub"; mode: "payment" | "subscription" }> = {
  phone_20: { price_id: isexyEnv("STRIPE_PRICE_PHONE_20") ?? "price_1T5gn6DTp0s6enQIcCJbsJpM", minutes: 20, type: "phone", mode: "payment" },
  phone_150: { price_id: isexyEnv("STRIPE_PRICE_PHONE_150") ?? "price_1T5gn7DTp0s6enQIEXXR6BTU", minutes: 150, type: "phone", mode: "payment" },
  phone_450: { price_id: isexyEnv("STRIPE_PRICE_PHONE_450") ?? "price_1T5gn8DTp0s6enQIELZPsXl3", minutes: 450, type: "phone", mode: "payment" },
  video_20: { price_id: isexyEnv("STRIPE_PRICE_VIDEO_20") ?? "price_1T5gn9DTp0s6enQIT3feQyeR", minutes: 20, type: "video", mode: "payment" },
  video_150: { price_id: isexyEnv("STRIPE_PRICE_VIDEO_150") ?? "price_1T5gnADTp0s6enQIh54j1Rs8", minutes: 150, type: "video", mode: "payment" },
  video_450: { price_id: isexyEnv("STRIPE_PRICE_VIDEO_450") ?? "price_1T5gnADTp0s6enQIsG1Rm3IY", minutes: 450, type: "video", mode: "payment" },
  chat_1mo: { price_id: isexyEnv("STRIPE_PRICE_CHAT_1MO") ?? "price_1T5gn5DTp0s6enQIUw91aDQV", minutes: 0, type: "chat_sub", mode: "subscription" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    const { packageId } = await req.json();
    const pkg = PACKAGES[packageId];
    if (!pkg) throw new Error("Invalid package");

    const stripeKey = isexyEnv("STRIPE_SECRET_KEY") || "";
    const liveEnabled = (isexyEnv("PAYMENTS_LIVE_ENABLED") || "false").toLowerCase() === "true";
    if (!liveEnabled && !stripeKey.startsWith("sk_test_")) {
      return new Response(JSON.stringify({ error: "Live payments are disabled until testing is complete." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const stripeCustomerId = await ensureStripeCustomerId(stripe, user);
    const customerId = stripeCustomerId;

    const origin = req.headers.get("origin") || isexyEnv("APP_URL") || "https://isexy.onrender.com";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email ?? undefined,
      line_items: [{ price: pkg.price_id, quantity: 1 }],
      mode: pkg.mode,
      success_url: `${origin}/buy-minutes?success=true&package=${packageId}`,
      cancel_url: `${origin}/buy-minutes?canceled=true`,
      metadata: {
        user_id: user.id,
        package_id: packageId,
        minutes: pkg.minutes.toString(),
        type: pkg.type,
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Purchase error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
