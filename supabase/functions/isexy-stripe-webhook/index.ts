import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "../_shared/supabase.ts";
import { isexyEnv } from "../_shared/env.ts";
import { subscriptionPeriod } from "../_shared/payments.ts";
import { checkoutOwnerId } from "../_shared/stripe-identity.ts";

// Stripe -> ISEXY. Every balance and plan change happens in one SQL function
// (isexy.fulfill_stripe_payment, apply_stripe_subscription,
// apply_chat_subscription): atomic, and idempotent per Stripe session or
// subscription, so a retried or duplicated event never credits twice. What a
// product gives is decided by the SQL catalog, never by the session metadata.
//
// Kept from main (live webhook v6): the member is only the TAKATAK user id
// the checkout function wrote in the metadata, and it must agree with the
// Stripe customer's isexy_user_id tag (never an email lookup); one-time
// payments are credited only once paid (async_payment_succeeded handled);
// Premium only for active/trialing subscriptions (in SQL: refresh_member_plan);
// an event is acknowledged only after it was really processed: a delivery of
// an event another delivery is still processing answers 503, every write
// error fails the event. A failed event answers 500 and the next delivery
// processes it again: that is safe because every effect is one idempotent SQL
// transaction (the atomic recovery path main's decision 22 asked for).

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
/** An unfinished delivery younger than this is still running elsewhere: answer 503 and let Stripe retry. */
const IN_FLIGHT_MS = 5 * 60 * 1000;

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

  // ---- Event log: acknowledge an event only once it was processed ----
  // deno-lint-ignore no-explicit-any
  const obj = event.data.object as any;
  const sessionIdForLog = event.type.startsWith("checkout.") ? obj?.id ?? null : null;
  const { data: seen, error: seenError } = await db
    .from("stripe_webhook_events")
    .select("id, processing_status, created_at")
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
  if (seen && seen.processing_status === "received" &&
      Date.now() - new Date(seen.created_at).getTime() < IN_FLIGHT_MS) {
    // Another delivery is processing it right now: never acknowledge it here.
    logStep("Event in flight elsewhere", { eventId: event.id });
    return reply({ error: "Event is being processed" }, 503);
  }
  if (!seen) {
    const { data: inserted, error: insertError } = await db
      .from("stripe_webhook_events")
      .insert({ stripe_event_id: event.id, event_type: event.type, stripe_session_id: sessionIdForLog, processing_status: "received" })
      .select("id")
      .maybeSingle();
    if (insertError) {
      // 23505: another delivery of the same event started a moment ago.
      if ((insertError as { code?: string }).code === "23505") {
        logStep("Event in flight elsewhere", { eventId: event.id });
        return reply({ error: "Event is being processed" }, 503);
      }
      logStep("Event log insert failed", { error: insertError.message });
      return reply({ error: "event log unavailable" }, 500);
    }
    if (!inserted?.id) return reply({ error: "event log unavailable" }, 500);
    logRowId = inserted.id;
  } else {
    // A failed event, or one whose delivery died midway: process it again
    // (every effect below is idempotent).
    logStep("Retrying event", { eventId: event.id, previous: seen.processing_status });
  }

  const mark = async (status: "processed" | "failed", error?: string) => {
    if (!logRowId) throw new Error("Webhook event log not recorded");
    const { error: updateError } = await db.from("stripe_webhook_events").update({
      processing_status: status,
      error_message: error ? error.slice(0, 2000) : null,
      processed_at: new Date().toISOString(),
    }).eq("id", logRowId);
    if (updateError) throw new Error("Unable to finalize Stripe webhook audit record");
  };

  // deno-lint-ignore no-explicit-any
  const rpc = async (fn: string, args: Record<string, unknown>): Promise<any> => {
    const { data, error } = await db.rpc(fn, args);
    if (error) throw new Error(`${fn}: ${error.message}`);
    return data;
  };

  /** Metadata of the Stripe customer (its isexy_user_id tag), or null when the object has no customer. */
  const customerMetadata = async (customer: unknown): Promise<Record<string, string> | null> => {
    const customerId = typeof customer === "string" ? customer : (customer as { id?: string } | null)?.id;
    if (!customerId) return null;
    const c = await stripe.customers.retrieve(customerId);
    if ((c as { deleted?: boolean }).deleted) throw new Error("Stripe checkout customer was deleted");
    return ((c as Stripe.Customer).metadata ?? {}) as Record<string, string>;
  };

  /**
   * The ISEXY member a checkout belongs to: the TAKATAK user id written by our
   * checkout function, matching the customer's tag and an existing profile.
   * No email lookup: a wrong account must never be credited.
   */
  const checkoutMember = async (meta: Record<string, string>, customer: unknown): Promise<string> => {
    const userId = checkoutOwnerId(meta, await customerMetadata(customer));
    const { data, error } = await db
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .eq("id", userId)
      .maybeSingle();
    if (error || !data?.id) {
      throw new Error("ISEXY checkout account not found: manual reconciliation required");
    }
    return data.id;
  };

  const tierOf = (...metas: (Record<string, string> | null | undefined)[]): string | null => {
    for (const m of metas) if (m?.tier && VALID_TIERS.includes(m.tier)) return m.tier;
    return null;
  };

  const isChatSub = (meta: Record<string, string> | null | undefined) =>
    meta?.type === "chat_sub" || meta?.package_id === "chat_1mo";

  async function fulfilPayment(session: Stripe.Checkout.Session) {
    if (session.payment_status !== "paid") {
      // Async methods complete the checkout before the money settles.
      logStep("Payment not settled yet, waiting for async_payment_succeeded", { sessionId: session.id, status: session.payment_status });
      return;
    }
    const meta = (session.metadata ?? {}) as Record<string, string>;
    const product = meta.product_id || meta.package_id || "";
    const profileId = await checkoutMember(meta, session.customer);
    if (!product) throw new Error(`payment ${session.id}: product missing`);
    const result = await rpc("fulfill_stripe_payment", {
      p_session_id: session.id,
      p_profile_id: profileId,
      p_product: product,
      p_amount_cents: session.amount_total ?? null,
      p_currency: session.currency ?? null,
      p_meta: meta,
    });
    if (result?.error === "unknown_product") {
      // As main's v6: not an ISEXY catalog product (the Stripe account may be
      // shared with other TAKATAK products). Logged for reconciliation.
      logStep("Unrecognized one-time product", { sessionId: session.id, product });
      return;
    }
    // Paid but not credited (e.g. bad gift details): never acknowledge it.
    if (!result?.success) throw new Error(`payment ${session.id}: ${result?.error ?? "not fulfilled"} (${product})`);
    logStep(result.already_fulfilled ? "Payment already fulfilled" : "Payment fulfilled", { sessionId: session.id, product });
  }

  /**
   * A subscription's current state (fetched again from Stripe, so a retried
   * or late event never applies an older state). The member comes from the
   * subscription's metadata when it has one (checked against the customer
   * tag); otherwise only an existing row with that Stripe id is updated.
   */
  async function applySubscription(subId: string, fallbackMeta: Record<string, string> = {}) {
    const sub = await stripe.subscriptions.retrieve(subId);
    const meta = { ...fallbackMeta, ...((sub.metadata ?? {}) as Record<string, string>) };
    const period = subscriptionPeriod(sub);
    const profileId = meta.user_id ? await checkoutMember(meta, sub.customer) : null;
    if (isChatSub(meta)) {
      const result = await rpc("apply_chat_subscription", {
        p_profile_id: profileId,
        p_subscription_id: sub.id,
        p_session_id: null,
        p_status: sub.status,
        p_expires_at: period.end,
        p_plan_months: parseInt(meta.plan_months || "1", 10) || 1,
      });
      logStep("Chat subscription", { subscriptionId: sub.id, status: sub.status, result });
      return;
    }
    const result = await rpc("apply_stripe_subscription", {
      p_profile_id: profileId,
      p_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null,
      p_subscription_id: sub.id,
      p_tier: tierOf(meta),
      p_status: sub.status,
      p_period_start: period.start,
      p_period_end: period.end,
    });
    // unknown_subscription: not an ISEXY plan subscription (no row, no member).
    logStep("Subscription", { subscriptionId: sub.id, status: sub.status, result });
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
          const checkoutCustomer = typeof session.customer === "string" ? session.customer : session.customer?.id;
          const subCustomer = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
          if (subCustomer !== checkoutCustomer) {
            throw new Error("Subscription customer does not match checkout customer");
          }
          const profileId = await checkoutMember(meta, session.customer);
          if (isChatSub(meta) || isChatSub(sub.metadata as Record<string, string>)) {
            if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
              logStep("Chat checkout awaiting payment", { sessionId: session.id });
              break;
            }
            const result = await rpc("apply_chat_subscription", {
              p_profile_id: profileId,
              p_subscription_id: sub.id,
              p_session_id: session.id,
              p_status: sub.status,
              p_expires_at: subscriptionPeriod(sub).end,
              p_plan_months: parseInt(meta.plan_months || "1", 10) || 1,
            });
            if (!result?.success) throw new Error(`chat subscription ${sub.id}: ${result?.error ?? "not applied"}`);
            logStep("Chat subscription started", { sessionId: session.id, result });
          } else {
            if (!tierOf(sub.metadata as Record<string, string>, meta)) {
              throw new Error("Paid subscription missing its authoritative tier metadata");
            }
            await applySubscription(sub.id, { ...meta, user_id: profileId });
          }
        } else if (session.mode === "payment") {
          await fulfilPayment(session);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await applySubscription((event.data.object as Stripe.Subscription).id);
        break;
      default:
        logStep("Unhandled event type", { type: event.type });
    }
    await mark("processed");
    return reply({ received: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logStep("Event failed (Stripe will retry)", { error: msg });
    try {
      await mark("failed", msg);
    } catch (markError) {
      logStep("Could not record the failure", { error: markError instanceof Error ? markError.message : String(markError) });
    }
    return reply({ error: msg }, 500);
  }
});
