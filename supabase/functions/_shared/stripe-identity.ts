// Stripe signs webhook events, but a customer's email is not an identity key.
// Session metadata is written only by ISEXY checkout handlers after Takatak
// Auth validation, and must agree with any tagged Stripe customer identity.
export function checkoutOwnerId(
  metadata: Record<string, string> | null | undefined,
  customerMetadata?: Record<string, string> | null,
): string {
  const userId = metadata?.user_id;
  if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    throw new Error("ISEXY checkout is missing its validated TAKATAK user ID");
  }
  if (metadata?.profile_id && metadata.profile_id.toLowerCase() !== userId.toLowerCase()) {
    throw new Error("ISEXY checkout has conflicting user and profile identities");
  }
  if (customerMetadata?.isexy_user_id &&
      customerMetadata.isexy_user_id.toLowerCase() !== userId.toLowerCase()) {
    throw new Error("Stripe customer belongs to a different ISEXY identity");
  }
  return userId;
}
