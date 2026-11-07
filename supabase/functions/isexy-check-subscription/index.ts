import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "../_shared/supabase.ts";
import { isexyEnv } from "../_shared/env.ts";
import { findStripeCustomerId } from "../_shared/stripe-customer.ts";
import { corsHeaders, json, signedInMember, subscriptionPeriod } from "../_shared/payments.ts";
import { checkoutOwnerId } from "../_shared/stripe-identity.ts";

// "Restore purchases" and My Subscription: reads the member's Stripe
// subscriptions and applies them to the database the same way the webhook
// does (a missed or failed webhook is caught up here), then answers with the
// member's plan from the database (Stripe, a redeemed code or a reward).
// Only Stripe objects whose server-written metadata names this member are
// applied (main 1d2d5e7: an email is never an identity).

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

const VALID_TIERS = ["plus", "gold", "platinum"];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const db = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const member = await signedInMember(req);
    if (!member) return json({ error: "Not authenticated" }, 401);

    // { restore: true } (Restore Purchase page): also replay the member's paid
    // one-time checkouts of the last 90 days. fulfill_stripe_payment is
    // idempotent per Stripe session, so only purchases a missed webhook never
    // credited are added.
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const restoreOneTime = body?.restore === true;

    let restored = 0;
    let purchasesRestored = 0;
    const stripeKey = isexyEnv("STRIPE_SECRET_KEY");
    if (stripeKey) {
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
      const customerId = await findStripeCustomerId(stripe, member);
      if (customerId) {
        const subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 20 });
        // findStripeCustomerId only returns a customer tagged with this member.
        const customerMeta = { isexy_user_id: member.id };
        const ownedBy = (meta: Record<string, string>): boolean => {
          try {
            return checkoutOwnerId(meta, customerMeta).toLowerCase() === member.id.toLowerCase();
          } catch {
            return false;
          }
        };
        for (const sub of subs.data) {
          const meta = (sub.metadata ?? {}) as Record<string, string>;
          if (!["active", "trialing"].includes(sub.status)) continue;
          if (!ownedBy(meta)) {
            logStep("Subscription without this member's identity skipped", { subscriptionId: sub.id });
            continue;
          }
          const period = subscriptionPeriod(sub);
          if (meta.type === "chat_sub" || meta.package_id === "chat_1mo") {
            const { error } = await db.rpc("apply_chat_subscription", {
              p_profile_id: member.id, p_subscription_id: sub.id, p_session_id: null,
              p_status: sub.status, p_expires_at: period.end, p_plan_months: 1,
            });
            if (error) throw new Error(error.message);
            restored++;
            continue;
          }
          const tier = VALID_TIERS.includes(meta.tier) ? meta.tier : null;
          if (!tier) continue;
          const { error } = await db.rpc("apply_stripe_subscription", {
            p_profile_id: member.id, p_customer_id: customerId, p_subscription_id: sub.id, p_tier: tier,
            p_status: sub.status, p_period_start: period.start, p_period_end: period.end,
          });
          if (error) throw new Error(error.message);
          restored++;
        }

        if (restoreOneTime) {
          const since = Math.floor(Date.now() / 1000) - 90 * 24 * 3600;
          const sessions = await stripe.checkout.sessions.list({
            customer: customerId,
            status: "complete",
            created: { gte: since },
            limit: 100,
          });
          for (const session of sessions.data) {
            if (session.mode !== "payment" || session.payment_status !== "paid") continue;
            const meta = (session.metadata ?? {}) as Record<string, string>;
            const product = meta.product_id || meta.package_id || "";
            if (!ownedBy(meta) || !product) continue;
            const { data, error } = await db.rpc("fulfill_stripe_payment", {
              p_session_id: session.id,
              p_profile_id: member.id,
              p_product: product,
              p_amount_cents: session.amount_total ?? null,
              p_currency: session.currency ?? null,
              p_meta: meta,
            });
            if (error) throw new Error(error.message);
            const result = data as { success?: boolean; already_fulfilled?: boolean; error?: string } | null;
            if (!result?.success) {
              logStep("One-time purchase not restorable", { sessionId: session.id, product, error: result?.error });
              continue;
            }
            if (!result.already_fulfilled) {
              restored++;
              purchasesRestored++;
              logStep("One-time purchase restored", { sessionId: session.id, product });
            }
          }
        }
      }
    } else {
      logStep("STRIPE_SECRET_KEY not set: database plan only");
    }

    const [{ data: profile }, { data: sub }] = await Promise.all([
      db.from("profiles").select("is_premium, subscription_tier, subscription_expires_at").eq("id", member.id).maybeSingle(),
      db.from("subscriptions").select("tier, status, current_period_end, stripe_subscription_id").eq("profile_id", member.id).maybeSingle(),
    ]);
    const paid = !!profile?.is_premium && VALID_TIERS.includes(profile?.subscription_tier ?? "");
    const fromStripe = !!sub && ["active", "trialing"].includes(sub.status) && sub.tier === profile?.subscription_tier;

    return json({
      subscribed: paid,
      tier: paid ? profile!.subscription_tier : null,
      subscription_end: paid ? profile!.subscription_expires_at : null,
      source: paid ? (fromStripe ? "stripe" : "other") : null,
      manageable: fromStripe,
      restored,
      purchases_restored: purchasesRestored,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return json({ error: errorMessage }, 500);
  }
});
