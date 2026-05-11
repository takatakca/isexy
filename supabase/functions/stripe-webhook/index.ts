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

// Authoritative server-side credit catalog (must match BuyCredits.tsx)
const CREDIT_PACKAGES: Record<string, { credits: number }> = {
  credits_10: { credits: 10 },
  credits_25: { credits: 30 },   // 25 + 5 bonus
  credits_50: { credits: 65 },   // 50 + 15 bonus
  credits_100: { credits: 140 }, // 100 + 40 bonus
};

// Authoritative server-side minute catalog (must match create-minute-purchase)
const MINUTE_PACKAGES: Record<string, { minutes: number; type: "phone" | "video" }> = {
  phone_20: { minutes: 20, type: "phone" },
  phone_150: { minutes: 150, type: "phone" },
  phone_450: { minutes: 450, type: "phone" },
  video_20: { minutes: 20, type: "video" },
  video_150: { minutes: 150, type: "video" },
  video_450: { minutes: 450, type: "video" },
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
    if (!webhookSecret) {
      logStep("STRIPE_WEBHOOK_SECRET not configured — refusing event");
      return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return new Response(JSON.stringify({ error: "Missing stripe-signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
      logStep("Webhook signature verified");
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : String(err);
      logStep("Webhook signature verification failed", { error: errMessage });
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    logStep("Processing event", { type: event.type, id: event.id });

    // ---- Webhook event logging + duplicate guard ----
    const sessionIdForLog =
      (event.data.object as any)?.id && event.type.startsWith("checkout.")
        ? (event.data.object as any).id
        : null;

    const { data: insertedLog, error: logInsertError } = await supabaseClient
      .from("stripe_webhook_events")
      .insert({
        stripe_event_id: event.id,
        event_type: event.type,
        stripe_session_id: sessionIdForLog,
        processing_status: "received",
      })
      .select("id")
      .maybeSingle();

    if (logInsertError) {
      // Unique violation on stripe_event_id => duplicate event
      if ((logInsertError as any).code === "23505") {
        await supabaseClient
          .from("stripe_webhook_events")
          .update({ processing_status: "skipped_duplicate", processed_at: new Date().toISOString() })
          .eq("stripe_event_id", event.id)
          .eq("processing_status", "received");
        logStep("Duplicate event skipped", { eventId: event.id });
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      logStep("Failed to insert webhook log row", { error: logInsertError.message });
    }
    const logRowId = insertedLog?.id ?? null;

    async function markProcessed() {
      if (!logRowId) return;
      await supabaseClient
        .from("stripe_webhook_events")
        .update({ processing_status: "processed", processed_at: new Date().toISOString() })
        .eq("id", logRowId);
    }
    async function markFailed(errMsg: string) {
      if (!logRowId) return;
      await supabaseClient
        .from("stripe_webhook_events")
        .update({
          processing_status: "failed",
          error_message: errMsg.slice(0, 2000),
          processed_at: new Date().toISOString(),
        })
        .eq("id", logRowId);
    }

    try {

    const VALID_TIERS = ["free", "plus", "gold", "platinum"];
    const VALID_DURATIONS = ["week", "month", "six_months"];

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

          // ---- Chat subscription (chat_1mo) ----
          if (meta.type === "chat_sub" || meta.package_id === "chat_1mo") {
            const months = parseInt(meta.plan_months || "1", 10) || 1;
            const { data: existingChatSub } = await supabaseClient
              .from("chat_subscriptions").select("id")
              .eq("stripe_session_id", session.id).maybeSingle();
            if (existingChatSub) {
              logStep("Chat sub already fulfilled", { sessionId: session.id });
              break;
            }
            const expiresAt = new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000).toISOString();
            await supabaseClient.from("chat_subscriptions").insert({
              profile_id: profileId,
              plan_months: months,
              status: "active",
              expires_at: expiresAt,
              stripe_session_id: session.id,
            });
            await supabaseClient.from("credit_transactions").insert({
              profile_id: profileId, amount: 0, type: "purchase", category: "chat_sub",
              description: `Chat subscription ${months} month(s)`,
              stripe_session_id: session.id,
            });
            logStep("Chat subscription fulfilled", { profileId, months });
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
          const customerId = session.customer as string;
          const customer = customerId ? await stripe.customers.retrieve(customerId) : null;
          const email = (customer as Stripe.Customer | null)?.email ?? session.customer_details?.email ?? null;
          const meta = (session.metadata ?? {}) as Record<string, string>;
          const productId = meta.product_id || "";
          const packageId = meta.package_id;

          const profileId = await resolveProfileId({
            metaProfileId: meta.profile_id,
            metaUserId: meta.user_id,
            email,
          });
          if (!profileId) {
            logStep("Could not resolve profile for one-time payment");
            break;
          }

          // ---- Credits (legacy: package_id) ----
          if (packageId && CREDIT_PACKAGES[packageId]) {
            const credits = CREDIT_PACKAGES[packageId].credits;
            // Idempotency: check existing transaction
            const { data: existingTx } = await supabaseClient
              .from("credit_transactions").select("id")
              .eq("stripe_session_id", session.id).maybeSingle();
            if (existingTx) { logStep("Credit purchase already fulfilled", { sessionId: session.id }); break; }

            const { data: existing } = await supabaseClient
              .from("user_credits").select("credits").eq("profile_id", profileId).maybeSingle();
            const newBalance = (existing?.credits ?? 0) + credits;
            await supabaseClient.from("user_credits").upsert(
              { profile_id: profileId, credits: newBalance, last_purchase_at: new Date().toISOString() },
              { onConflict: "profile_id" }
            );
            await supabaseClient.from("credit_transactions").insert({
              profile_id: profileId, amount: credits, type: "purchase",
              description: `Purchased ${credits} credits (${packageId})`,
              stripe_session_id: session.id,
            });
            logStep("Credits added", { profileId, credits, packageId });
            break;
          }

          // ---- Gift fulfillment ----
          if (productId.startsWith("gift_") || meta.type === "gift") {
            const giftPackageId = meta.gift_package_id || productId.replace(/^gift_/, "");
            const recipientId = meta.recipient_profile_id;
            const amountUsd = (session.amount_total ?? 0) / 100;
            // Idempotency
            const { data: existingGift } = await supabaseClient
              .from("gift_transactions").select("id,status")
              .eq("stripe_session_id", session.id).maybeSingle();
            if (existingGift) {
              if (existingGift.status !== "completed") {
                await supabaseClient.from("gift_transactions")
                  .update({ status: "completed", completed_at: new Date().toISOString() })
                  .eq("id", existingGift.id);
              }
              logStep("Gift already recorded", { sessionId: session.id });
              break;
            }
            if (recipientId && giftPackageId) {
              await supabaseClient.from("gift_transactions").insert({
                sender_profile_id: profileId,
                receiver_profile_id: recipientId,
                gift_package_id: giftPackageId,
                amount_usd: amountUsd,
                message: meta.message ?? null,
                status: "completed",
                stripe_session_id: session.id,
                completed_at: new Date().toISOString(),
              });
              logStep("Gift fulfilled", { profileId, recipientId, amountUsd });
            } else {
              logStep("Missing gift fulfillment metadata", { recipientId, giftPackageId });
            }
            break;
          }

          // ---- Donation / topup / food fulfillment ----
          if (productId.startsWith("donation_") || productId.startsWith("topup_") || productId.startsWith("food_")) {
            const amountUsd = (session.amount_total ?? 0) / 100;
            // Idempotency
            const { data: existingDon } = await supabaseClient
              .from("donations").select("id,status")
              .eq("stripe_session_id", session.id).maybeSingle();
            if (existingDon) {
              if (existingDon.status !== "completed") {
                await supabaseClient.from("donations")
                  .update({ status: "completed", completed_at: new Date().toISOString() })
                  .eq("id", existingDon.id);
              }
              logStep("Donation already recorded", { sessionId: session.id });
              break;
            }
            const donationType = productId.startsWith("topup_") ? "topup"
              : productId.startsWith("food_") ? "food" : "cash";
            await supabaseClient.from("donations").insert({
              donor_profile_id: profileId,
              recipient_profile_id: meta.recipient_profile_id ?? null,
              amount_usd: amountUsd,
              donation_type: donationType,
              phone_number: meta.phone_number ?? null,
              recipient_name: meta.recipient_name ?? null,
              status: "completed",
              stripe_session_id: session.id,
              completed_at: new Date().toISOString(),
            });
            logStep("Donation fulfilled", { profileId, amountUsd, donationType });
            break;
          }

          // ---- Boosts / Super Likes / Primetime / Super Boosts ----
          if (productId.startsWith("super_likes_") || productId.startsWith("boost_")
              || productId.startsWith("primetime_") || productId.startsWith("superboost_")) {
            const { data: existingBoost } = await supabaseClient
              .from("boost_transactions").select("id")
              .eq("stripe_session_id", session.id).maybeSingle();
            if (existingBoost) { logStep("Boost already fulfilled", { sessionId: session.id }); break; }

            // Map to wallet updates
            const qtyMatch = productId.match(/_(\d+)(h?)$/);
            const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
            let action = "credit";
            let boostType = productId;

            if (productId.startsWith("super_likes_")) {
              const { data: w } = await supabaseClient.from("allowances").select("weekly_super_likes_max").eq("profile_id", profileId).maybeSingle();
              await supabaseClient.from("allowances").upsert(
                { profile_id: profileId, weekly_super_likes_max: (w?.weekly_super_likes_max ?? 0) + qty },
                { onConflict: "profile_id" }
              );
              boostType = "super_like";
            } else if (productId.startsWith("boost_")) {
              const { data: w } = await supabaseClient.from("boost_wallets").select("boosts").eq("profile_id", profileId).maybeSingle();
              await supabaseClient.from("boost_wallets").upsert(
                { profile_id: profileId, boosts: (w?.boosts ?? 0) + qty },
                { onConflict: "profile_id" }
              );
              boostType = "boost";
            } else if (productId.startsWith("primetime_")) {
              const { data: w } = await supabaseClient.from("boost_wallets").select("primetime_boosts").eq("profile_id", profileId).maybeSingle();
              await supabaseClient.from("boost_wallets").upsert(
                { profile_id: profileId, primetime_boosts: (w?.primetime_boosts ?? 0) + qty },
                { onConflict: "profile_id" }
              );
              boostType = "primetime_boost";
            } else if (productId.startsWith("superboost_")) {
              const hours = qtyMatch ? parseInt(qtyMatch[1], 10) : 3;
              const { data: w } = await supabaseClient.from("boost_wallets").select("super_boost_hours").eq("profile_id", profileId).maybeSingle();
              await supabaseClient.from("boost_wallets").upsert(
                { profile_id: profileId, super_boost_hours: (w?.super_boost_hours ?? 0) + hours },
                { onConflict: "profile_id" }
              );
              boostType = "super_boost";
            }

            await supabaseClient.from("boost_transactions").insert({
              profile_id: profileId,
              boost_type: boostType,
              action,
              quantity: qty,
              stripe_session_id: session.id,
            });
            logStep("Boost fulfilled", { profileId, productId, qty });
            break;
          }

          logStep("Unrecognized one-time product_id", { productId });
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

      case "invoice.payment_succeeded":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Invoice event", { invoiceId: invoice.id, type: event.type });
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    await markProcessed();

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    } catch (innerErr) {
      const msg = innerErr instanceof Error ? innerErr.message : String(innerErr);
      logStep("Error during event processing", { error: msg });
      await markFailed(msg);
      return new Response(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("Error processing webhook", { error: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
