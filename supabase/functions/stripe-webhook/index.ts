import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    let event: Stripe.Event;

    // Verify webhook signature if secret is configured
    if (webhookSecret && signature) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
        logStep("Webhook signature verified");
      } catch (err) {
        const errMessage = err instanceof Error ? err.message : String(err);
        logStep("Webhook signature verification failed", { error: errMessage });
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // Parse without verification (development mode)
      event = JSON.parse(body);
      logStep("Webhook parsed without signature verification");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    logStep("Processing event", { type: event.type });

    // Map Stripe product IDs to app tier names
    const PRODUCT_TO_TIER: Record<string, string> = {
      prod_Tf4swUnx8LI3BR: "plus",
      prod_Tf4sVyy62yF0cy: "gold",
      prod_Tf4sF4GddOh8RM: "platinum",
    };
    const VALID_TIERS = ["free", "plus", "gold", "platinum"];

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        logStep("Checkout completed", { sessionId: session.id, mode: session.mode });

        if (session.mode === "subscription") {
          // Handle subscription purchase
          const customerId = session.customer as string;
          const subscriptionId = session.subscription as string;

          // Get customer email
          const customer = await stripe.customers.retrieve(customerId);
          const email = (customer as Stripe.Customer).email;

          if (email) {
            // Find user by email
            const { data: profile } = await supabaseClient
              .from("profiles")
              .select("id, user_id")
              .eq("user_id", (await supabaseClient.auth.admin.listUsers()).data.users.find(u => u.email === email)?.id)
              .single();

            if (profile) {
              // Get subscription details
              const subscription = await stripe.subscriptions.retrieve(subscriptionId);
              const productId = subscription.items.data[0].price.product as string;
              const appTier = PRODUCT_TO_TIER[productId] ?? (session.metadata?.tier as string);

              if (!appTier || !VALID_TIERS.includes(appTier)) {
                logStep("Unknown product/tier, skipping", { productId, appTier });
                break;
              }

              // Update or create subscription record
              await supabaseClient
                .from("subscriptions")
                .upsert({
                  profile_id: profile.id,
                  stripe_customer_id: customerId,
                  stripe_subscription_id: subscriptionId,
                  status: subscription.status,
                  tier: appTier,
                  current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                  current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                }, { onConflict: "profile_id" });

              // Update profile (only app tier names: free/plus/gold/platinum)
              await supabaseClient
                .from("profiles")
                .update({
                  is_premium: true,
                  subscription_tier: appTier,
                  subscription_expires_at: new Date(subscription.current_period_end * 1000).toISOString(),
                  first_purchase_promo_used: true,
                })
                .eq("id", profile.id);

              // Sync entitlements cache
              await supabaseClient.rpc("sync_entitlements", { p_profile_id: profile.id });

              logStep("Subscription created for user", { profileId: profile.id, tier: appTier });
            }
          }
        } else if (session.mode === "payment") {
          // Handle one-time payment (credits purchase)
          const customerId = session.customer as string;
          const customer = await stripe.customers.retrieve(customerId);
          const email = (customer as Stripe.Customer).email;

          if (email && session.metadata?.credits) {
            const credits = parseInt(session.metadata.credits);
            
            // Find user
            const { data: users } = await supabaseClient.auth.admin.listUsers();
            const user = users.users.find(u => u.email === email);

            if (user) {
              const { data: profile } = await supabaseClient
                .from("profiles")
                .select("id")
                .eq("user_id", user.id)
                .single();

              if (profile) {
                // Add credits
                await supabaseClient
                  .from("user_credits")
                  .upsert({
                    profile_id: profile.id,
                    credits: credits,
                    last_purchase_at: new Date().toISOString(),
                  }, { 
                    onConflict: "profile_id",
                  });

                // Record transaction
                await supabaseClient
                  .from("credit_transactions")
                  .insert({
                    profile_id: profile.id,
                    amount: credits,
                    type: "purchase",
                    description: `Purchased ${credits} credits`,
                    stripe_session_id: session.id,
                  });

                logStep("Credits added", { profileId: profile.id, credits });
              }
            }
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription updated", { subscriptionId: subscription.id, status: subscription.status });

        // Update subscription in database
        const { error } = await supabaseClient
          .from("subscriptions")
          .update({
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);

        if (error) {
          logStep("Error updating subscription", { error: error.message });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription cancelled", { subscriptionId: subscription.id });

        // Update subscription status
        await supabaseClient
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("stripe_subscription_id", subscription.id);

        // Update profile
        const { data: sub } = await supabaseClient
          .from("subscriptions")
          .select("profile_id")
          .eq("stripe_subscription_id", subscription.id)
          .single();

        if (sub) {
          await supabaseClient
            .from("profiles")
            .update({
              is_premium: false,
              subscription_tier: null,
              subscription_expires_at: null,
            })
            .eq("id", sub.profile_id);
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Invoice paid", { invoiceId: invoice.id });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Invoice payment failed", { invoiceId: invoice.id });
        
        // Optionally send notification to user
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("Error processing webhook", { error: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
