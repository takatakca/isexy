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

    const VALID_TIERS = ["free", "plus", "gold", "platinum"];
    const VALID_DURATIONS = ["week", "month", "six_months"];

    // Resolve profile.id from metadata first, fall back to email lookup
    async function resolveProfileId(opts: {
      metaProfileId?: string;
      metaUserId?: string;
      email?: string | null;
    }): Promise<string | null> {
      if (opts.metaProfileId) {
        const { data } = await supabaseClient
          .from("profiles")
          .select("id")
          .eq("id", opts.metaProfileId)
          .maybeSingle();
        if (data?.id) return data.id;
      }
      if (opts.metaUserId) {
        const { data } = await supabaseClient
          .from("profiles")
          .select("id")
          .eq("user_id", opts.metaUserId)
          .maybeSingle();
        if (data?.id) return data.id;
      }
      if (opts.email) {
        const { data: users } = await supabaseClient.auth.admin.listUsers();
        const user = users.users.find((u) => u.email === opts.email);
        if (user) {
          const { data } = await supabaseClient
            .from("profiles")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();
          if (data?.id) return data.id;
        }
      }
      return null;
    }

    function tierFromMetadata(meta: Record<string, string> | null | undefined): string | null {
      const t = meta?.tier;
      if (t && VALID_TIERS.includes(t)) return t;
      return null;
    }

    function normalizeDuration(d: string | undefined | null): string | null {
      if (!d) return null;
      if (d === "6months") return "six_months";
      return VALID_DURATIONS.includes(d) ? d : null;
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        logStep("Checkout completed", { sessionId: session.id, mode: session.mode });

        if (session.mode === "subscription") {
          const customerId = session.customer as string;
          const subscriptionId = session.subscription as string;
          const meta = (session.metadata ?? {}) as Record<string, string>;

          const customer = await stripe.customers.retrieve(customerId);
          const email = (customer as Stripe.Customer).email;

          const profileId = await resolveProfileId({
            metaProfileId: meta.profile_id,
            metaUserId: meta.user_id,
            email,
          });

          if (!profileId) {
            logStep("Could not resolve profile for subscription", { sessionId: session.id });
            break;
          }

          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const subMeta = (subscription.metadata ?? {}) as Record<string, string>;
          const appTier = tierFromMetadata(subMeta) ?? tierFromMetadata(meta);
          const duration = normalizeDuration(subMeta.duration ?? meta.duration);

          if (!appTier || appTier === "free") {
            logStep("No valid tier in metadata, skipping", { appTier });
            break;
          }

          const subRow: Record<string, unknown> = {
            profile_id: profileId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            status: subscription.status,
            tier: appTier,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          };
          // duration column is optional; safe to include via try/catch upsert
          await supabaseClient.from("subscriptions").upsert(subRow, { onConflict: "profile_id" });

          await supabaseClient
            .from("profiles")
            .update({
              is_premium: true,
              subscription_tier: appTier,
              subscription_expires_at: new Date(subscription.current_period_end * 1000).toISOString(),
              first_purchase_promo_used: true,
            })
            .eq("id", profileId);

          await supabaseClient.rpc("sync_entitlements", { p_profile_id: profileId });

          logStep("Subscription created", { profileId, tier: appTier, duration });
        } else if (session.mode === "payment") {
          // One-time payment handling (credits) — UNCHANGED
          const customerId = session.customer as string;
          const customer = await stripe.customers.retrieve(customerId);
          const email = (customer as Stripe.Customer).email;

          if (email && session.metadata?.credits) {
            const credits = parseInt(session.metadata.credits);
            const { data: users } = await supabaseClient.auth.admin.listUsers();
            const user = users.users.find(u => u.email === email);

            if (user) {
              const { data: profile } = await supabaseClient
                .from("profiles")
                .select("id")
                .eq("user_id", user.id)
                .single();

              if (profile) {
                await supabaseClient
                  .from("user_credits")
                  .upsert({
                    profile_id: profile.id,
                    credits: credits,
                    last_purchase_at: new Date().toISOString(),
                  }, { onConflict: "profile_id" });

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

        const subMeta = (subscription.metadata ?? {}) as Record<string, string>;
        const appTier = tierFromMetadata(subMeta);
        const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();

        const { error } = await supabaseClient
          .from("subscriptions")
          .update({
            status: subscription.status,
            tier: appTier ?? undefined,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: periodEnd,
          })
          .eq("stripe_subscription_id", subscription.id);

        if (error) logStep("Error updating subscription", { error: error.message });

        // Sync profile tier
        const { data: sub } = await supabaseClient
          .from("subscriptions")
          .select("profile_id")
          .eq("stripe_subscription_id", subscription.id)
          .single();

        if (sub && appTier) {
          const isActive = ["active", "trialing"].includes(subscription.status);
          await supabaseClient
            .from("profiles")
            .update({
              is_premium: isActive,
              subscription_tier: isActive ? appTier : "free",
              subscription_expires_at: isActive ? periodEnd : null,
            })
            .eq("id", sub.profile_id);
          await supabaseClient.rpc("sync_entitlements", { p_profile_id: sub.profile_id });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription cancelled", { subscriptionId: subscription.id });

        await supabaseClient
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("stripe_subscription_id", subscription.id);

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
              subscription_tier: "free",
              subscription_expires_at: null,
            })
            .eq("id", sub.profile_id);
          await supabaseClient.rpc("sync_entitlements", { p_profile_id: sub.profile_id });
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
