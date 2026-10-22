// A Checkout Session is not proof that an ongoing subscription is active.
// Incomplete, unpaid, paused and canceled subscriptions grant no premium tier.
export function activeSubscriptionTier(status: string): boolean {
  return status === "active" || status === "trialing";
}
