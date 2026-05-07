import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Authoritative server catalog. Client only sends packageId.
const PACKAGES: Record<string, { credits: number; priceCents: number; label: string }> = {
  credits_10: { credits: 10, priceCents: 999, label: "10 Video Chat Credits" },
  credits_25: { credits: 30, priceCents: 1999, label: "25 Credits + 5 Bonus" },
  credits_50: { credits: 65, priceCents: 3499, label: "50 Credits + 15 Bonus" },
  credits_100: { credits: 140, priceCents: 5999, label: "100 Credits + 40 Bonus" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    const body = await req.json().catch(() => ({}));
    const packageId: string | undefined = body?.packageId;
    if (!packageId || !PACKAGES[packageId]) {
      return new Response(JSON.stringify({ error: "Invalid packageId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const pkg = PACKAGES[packageId];

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data[0]?.id;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: pkg.label },
            unit_amount: pkg.priceCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/buy-credits?success=true`,
      cancel_url: `${req.headers.get("origin")}/buy-credits?canceled=true`,
      metadata: {
        user_id: user.id,
        package_id: packageId,
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Credit purchase error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
