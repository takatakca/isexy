import { supabase } from "@/integrations/supabase/client";

/**
 * Payments helpers shared by the purchase pages. The browser never decides an
 * amount: it sends a product id, the isexy-* checkout function prices it, and
 * isexy-stripe-webhook credits the member once Stripe confirms the payment.
 */

/** Prices are in Canadian dollars. "$9.99" (the CTA adds " CAD"). */
export function cad(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export interface InvokeFailure {
  status?: number;
  message?: string;
  code?: string;
}

/** Status and server message of a failed supabase.functions.invoke(). */
export async function readInvokeError(error: unknown): Promise<InvokeFailure> {
  const context = (error as { context?: Response } | null)?.context;
  if (context && typeof context.status === "number") {
    try {
      const body = await context.clone().json();
      return { status: context.status, message: typeof body?.error === "string" ? body.error : undefined, code: body?.code };
    } catch {
      return { status: context.status };
    }
  }
  return { message: error instanceof Error ? error.message : undefined };
}

/** Words for a member when a checkout could not start. */
export function checkoutErrorMessage(failure: InvokeFailure): string {
  if (failure.status === 403) return failure.message ?? "Payments are not available yet. Nothing was charged.";
  if (failure.status === 401) return "Please sign in again to continue.";
  if (failure.status === 503 || failure.code === "price_missing") return failure.message ?? "This option is not available yet.";
  if (failure.status === 404 && failure.code === "no_customer") return failure.message ?? "No payment account yet.";
  if (failure.status === undefined) return "Could not reach the payment service. Check your connection and try again.";
  return "Could not start the payment. Nothing was charged. Please try again.";
}

/** Stripe Checkout and the Stripe billing portal: the only pages a payment function may send members to. */
const STRIPE_HOSTS = ["checkout.stripe.com", "billing.stripe.com"];

/** ok: the browser is on its way to Stripe; otherwise `message` says why not. */
export interface CheckoutResult {
  ok: boolean;
  message?: string;
}

/**
 * Ask a checkout function for a Stripe page and go there in this tab
 * (window.open after an await is blocked as a popup on iOS Safari).
 */
export async function startCheckout(fn: string, body?: Record<string, unknown>): Promise<CheckoutResult> {
  try {
    const { data, error } = await supabase.functions.invoke(fn, body ? { body } : undefined);
    if (error) return { ok: false, message: checkoutErrorMessage(await readInvokeError(error)) };
    const url = (data as { url?: string } | null)?.url;
    if (!url) {
      const message = (data as { error?: string } | null)?.error;
      return { ok: false, message: message ?? "Could not start the payment. Nothing was charged." };
    }
    // Leave the site only for Stripe's own pages (main 705cc26): checkout and the billing portal.
    let target: URL;
    try {
      target = new URL(url);
    } catch {
      return { ok: false, message: "Could not start the payment. Nothing was charged." };
    }
    if (target.protocol !== "https:" || !STRIPE_HOSTS.includes(target.hostname)) {
      return { ok: false, message: "Unexpected payment page. Nothing was charged." };
    }
    window.location.assign(target.toString());
    return { ok: true };
  } catch (e) {
    return { ok: false, message: checkoutErrorMessage({ message: e instanceof Error ? e.message : undefined }) };
  }
}

/** True when an RPC failed because it is not deployed yet (PostgREST 404 / PGRST202). */
export function isMissingRpc(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "PGRST202" || error.code === "42883" || /could not find the function/i.test(error.message ?? "");
}
