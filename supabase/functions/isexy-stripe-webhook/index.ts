import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "../_shared/supabase.ts";
import { isexyEnv } from "../_shared/env.ts";
import { subscriptionPeriod } from "../_shared/payments.ts";

// Stripe -> ISEXY. Every balance and plan change happens in one SQL function
// (isexy.fulfill_stripe_payment, apply_stripe_subscription,
// apply_chat_subscription): atomic, and idempotent per Stripe session or
// subscription, so a retried or duplicated event never credits twice. What a
// product gives is decided by the SQL catalog, never by the session metadata.
// A failed event answers 500 so Stripe retries it, and the retry is processed
// again (it used to be skipped as a "duplicate").

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const VALID_TIERS = ["plus", "gold", "platinum"];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripeKey = isexyEnv("STRIPE_SECRET_KEY");
  const webhookSecret = isexyEnv("STRIPE_WEBHOOK_SECRET");
  if (!stripeKey || !webhookSecret) {
    logStep("Stripe key or webhook secret not configured: refusing event");
    return reply({ error: "Webhook not configured" }, 500);
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) return reply({ error: "Missing stripe-signature" }, 400);

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    logStep("Signature verification failed", { error: err instanceof Error ? err.message : String(err) });
    return reply({ error: "Invalid signature" }, 400);
  }

  const db = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  // ---- Event log: process each event until it succeeds once ----
  // deno-lint-ignore no-explicit-any
  const obj = event.data.object as any;
  const sessionIdForLog = event.type.startsWith("checkout.") ? obj?.id ?? null : null;
  const { data: seen, error: seenError } = await db
    .from("stripe_webhook_events")
    .select("id, processing_status")
    .eq("stripe_event_id", event.id)
    .maybeSingle();
  if (seenError) {
    logStep("Event log unreadable", { error: seenError.message });
    return reply({ error: "event log unavailable" }, 500);
  }
  let logRowId: string | null = seen?.id ?? null;
  if (seen && seen.processing_status === "processed") {
    logStep("Already processed", { eventId: event.id });
    return reply({ received: true, duplicate: true });
  }
  if (!seen) {
    const { data: inserted, error: insertError } = await db
      .from("stripe_webhook_events")
      .insert({ stripe_event_id: event.id, event_type: event.type, stripe_session_id: sessionIdForLog, processing_status: "received" })
      .select("id")
      .maybeSingle();
    if (insertError) {
      // 23505: the same event is being processed right now by another delivery.
      if ((insertError as { code?: string }).code === "23505") return reply({ received: true, duplicate: true });
      logStep("Event log insert failed", { error: insertError.message });
      return reply({ error: "event log unavailable" }, 500);
    }
    logRowId = inserted?.id ?? null;
  } else {
    logStep("Retrying event", { eventId: event.id, previous: seen.processing_status });
  }

  const mark = async (status: "processed" | "failed", error?: string) => {
    if (!logRowId) return;
    await db.from("stripe_webhook_events").update({
      processing_status: status,
      error_message: error ? error.slice(0, 2000) : null,
      processed_at: new Date().toISOString(),
    }).eq("id", logRowId);
  };

  // deno-lint-ignore no-explicit-any
  const rpc = async (fn: string, args: Record<string, unknown>): Promise<any> => {
    const { data, error } = await db.rpc(fn, args);
    if (error) throw new Error(`${fn}: ${error.message}`);
    return data;
  };

  /** The member a Stripe object belongs to: our own metadata, then the customer's isexy_user_id tag. */
  const memberId = async (meta: Record<string, string> | null | undefined, customer: unknown): Promise<string | null> => {
    const fromMeta = meta?.profile_id || meta?.user_id;
    if (fromMeta) return fromMeta;
    const customerId = typeof customer === "string" ? customer : (customer as { id?: string } | null)?.id;
    if (!customerId) return null;
    const c = await stripe.customers.retrieve(customerId);
    return (c as Stripe.Customer).metadata?.isexy_user_id ?? null;
  };

  const tierOf = (...metas: (Record<string, string> | null | undefined)[]): string | null => {
    for (const m of metas) if (m?.tier && VALID_TIERS.includes(m.tier)) return m.tier;
    return null;
  };

  const isChatSub = (meta: Record<string, string> | null | undefined) =>
    meta?.type === "chat_sub" || meta?.package_id === "chat_1mo";

  async function fulfilPayment(session: Stripe.Checkout.Session) {
    if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
      logStep("Payment not settled yet, waiting for async_payment_succeeded", { sessionId: session.id, status: session.payment_status });
      return;
    }
    const meta = (session.metadata ?? {}) as Record<string, string>;
    const product = meta.product_id || meta.package_id || "";
    const profileId = await memberId(meta, session.customer);
    if (!profileId || !product) {
      throw new Error(`payment ${session.id}: member or product missing`);
    }
    const result = await rpc("fulfill_stripe_payment", {
      p_session_id: session.id,
      p_profile_id: profileId,
      p_product: product,
      p_amount_cents: session.amount_total ?? null,
      p_currency: session.currency ?? null,
      p_meta: meta,
    });
    logStep("Payment fulfilled", { sessionId: session.id, product, result });
  }

  async function applySubscription(sub: Stripe.Subscription, fallbackMeta: Record<string, string> = {}, deleted = false) {
    const meta = (sub.metadata ?? {}) as Record<string, string>;
    const period = subscriptionPeriod(sub);
    const status = deleted ? "canceled" : sub.status;
    const profileId = await memberId({ ...fallbackMeta, ...meta }, sub.customer);
    if (isChatSub(meta) || isChatSub(fallbackMeta)) {
      const result = await rpc("apply_chat_subscription", {
        p_profile_id: profileId,
        p_subscription_id: sub.id,
        p_session_id: null,
        p_status: status,
        p_expires_at: period.end,
        p_plan_months: parseInt(meta.plan_months || fallbackMeta.plan_months || "1", 10) || 1,
      });
      logStep("Chat subscription", { subscriptionId: sub.id, status, result });
      return;
    }
    const result = await rpc("apply_stripe_subscription", {
      p_profile_id: profileId,
      p_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null,
      p_subscription_id: sub.id,
      p_tier: tierOf(meta, fallbackMeta),
      p_status: status,
      p_period_start: period.start,
      p_period_end: period.end,
    });
    logStep("Subscription", { subscriptionId: sub.id, status, result });
  }

  try {
    logStep("Processing", { type: event.type, id: event.id });
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        const meta = (session.metadata ?? {}) as Record<string, string>;
        if (session.mode === "subscription") {
          if (event.type !== "checkout.session.completed" || !session.subscription) break;
          const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          if (isChatSub(meta) || isChatSub(sub.metadata as Record<string, string>)) {
            const profileId = await memberId(meta, session.customer);
            const result = await rpc("apply_chat_subscription", {
              p_profile_id: profileId,
              p_subscription_id: sub.id,
              p_session_id: session.id,
              p_status: sub.status,
              p_expires_at: subscriptionPeriod(sub).end,
              p_plan_months: parseInt(meta.plan_months || "1", 10) || 1,
            });
            logStep("Chat subscription started", { sessionId: session.id, result });
          } else {
            await applySubscription(sub, meta);
          }
        } else if (session.mode === "payment") {
          await fulfilPayment(session);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await applySubscription(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await applySubscription(event.data.object as Stripe.Subscription, {}, true);
        break;
      default:
        logStep("Unhandled event type", { type: event.type });
    }
    await mark("processed");
    return reply({ received: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logStep("Event failed (Stripe will retry)", { error: msg });
    await mark("failed", msg);
    return reply({ error: msg }, 500);
  }
});
