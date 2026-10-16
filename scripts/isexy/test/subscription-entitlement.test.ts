import { activeSubscriptionTier } from "../../../supabase/functions/_shared/subscription-entitlement.ts";

Deno.test("premium subscriptions require an active or trialing Stripe subscription", () => {
  for (const valid of ["active", "trialing"]) {
    if (!activeSubscriptionTier(valid)) throw new Error("Paid subscription denied");
  }
  for (const invalid of ["incomplete", "incomplete_expired", "past_due",
                         "unpaid", "canceled", "paused", ""]) {
    if (activeSubscriptionTier(invalid)) throw new Error("Unpaid subscription granted premium");
  }
});
