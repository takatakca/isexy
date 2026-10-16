// Shared by the isexy payment functions: CORS, JSON replies, the signed-in
// member, the payments gate and the URL Stripe sends members back to.
import { createClient } from "./supabase.ts";
import { isexyEnv } from "./env.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export interface PaymentsGate {
  /** A Stripe key and the webhook secret are set: purchases can be charged AND credited. */
  configured: boolean;
  liveEnabled: boolean;
  isTestKey: boolean;
  isLiveKey: boolean;
  /** Checkout refuses to start (not configured, or a live key before PAYMENTS_LIVE_ENABLED). */
  blocked: boolean;
  mode: "test" | "live" | "unknown";
  reason: "not_configured" | "live_disabled" | null;
  /** The first-week discount coupon exists (Premium shows the offer only then). */
  firstWeekPromo: boolean;
}

export function paymentsGate(): PaymentsGate {
  const key = isexyEnv("STRIPE_SECRET_KEY") || "";
  const webhookSecret = isexyEnv("STRIPE_WEBHOOK_SECRET") || "";
  const liveEnabled = (isexyEnv("PAYMENTS_LIVE_ENABLED") || "false").toLowerCase() === "true";
  const isTestKey = key.startsWith("sk_test_") || key.startsWith("rk_test_");
  const isLiveKey = key.startsWith("sk_live_") || key.startsWith("rk_live_");
  const configured = (isTestKey || isLiveKey) && webhookSecret.length > 0;
  const reason = !configured ? "not_configured" : isLiveKey && !liveEnabled ? "live_disabled" : null;
  return {
    configured,
    liveEnabled,
    isTestKey,
    isLiveKey,
    blocked: reason !== null,
    mode: isTestKey ? "test" : isLiveKey ? "live" : "unknown",
    reason,
    firstWeekPromo: configured && !!isexyEnv("STRIPE_COUPON_FIRST_WEEK"),
  };
}

/** 403 reply when checkout must not start, null when it may. */
export function gateRefusal(): Response | null {
  const gate = paymentsGate();
  if (!gate.blocked) return null;
  return json({
    error: gate.reason === "live_disabled"
      ? "Live payments are disabled until testing is complete."
      : "Payments are not available yet.",
    code: gate.reason,
  }, 403);
}

export interface Member {
  id: string;
  email?: string | null;
  phone?: string | null;
}

/** The signed-in Takatak member (email, SMS or Google: an email is not required). */
export async function signedInMember(req: Request): Promise<Member | null> {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token) return null;
  const auth = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");
  const { data, error } = await auth.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null, phone: data.user.phone ?? null };
}

/** Where Stripe sends the member back: APP_URL, else the calling site's origin. */
export function appBaseUrl(req: Request): string {
  const configured = isexyEnv("APP_URL");
  if (configured) return configured.replace(/\/+$/, "");
  const origin = req.headers.get("origin") ?? "";
  if (/^https?:\/\/[a-z0-9.-]+(:\d+)?$/i.test(origin)) return origin;
  return "https://isexy.ca";
}

/** Stripe's subscription period (top level before API 2025-03-31.basil, on the item after). */
// deno-lint-ignore no-explicit-any
export function subscriptionPeriod(sub: any): { start: string | null; end: string | null } {
  const item = sub?.items?.data?.[0];
  const start = sub?.current_period_start ?? item?.current_period_start ?? null;
  const end = sub?.current_period_end ?? item?.current_period_end ?? null;
  return {
    start: typeof start === "number" ? new Date(start * 1000).toISOString() : null,
    end: typeof end === "number" ? new Date(end * 1000).toISOString() : null,
  };
}
