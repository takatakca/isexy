/** Stripe metadata is authoritative only when composed by the server.
 *  The client can supply limited recipient information, never billing roles. */
export function safeCheckoutMetadata(
  productId: string,
  client: unknown,
  userId: string,
  giftPackageId?: string,
): Record<string, string> {
  const values: Record<string, unknown> =
    client && typeof client === "object" && !Array.isArray(client)
      ? client as Record<string, unknown> : {};
  const result: Record<string, string> = { user_id: userId, product_id: productId };

  function addIfValid(key: string, maxLength: number) {
    const value = values[key];
    if (typeof value === "string" && value.trim().length > 0 &&
        value.length <= maxLength) {
      result[key] = value.trim();
    }
  }

  const isGift = productId.startsWith("gift_");
  const isDonation = /^(donation_|topup_|food_)/.test(productId);
  if (isGift || isDonation) {
    addIfValid("recipient_profile_id", 36);
    if (result.recipient_profile_id &&
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result.recipient_profile_id)) {
      throw new Error("Invalid recipient profile ID");
    }
  }
  if (isGift) {
    if (!giftPackageId || !result.recipient_profile_id) {
      throw new Error("Gift package and recipient must be specified");
    }
    result.type = "gift";
    result.gift_package_id = giftPackageId;
    addIfValid("message", 200);
  } else if (isDonation) {
    result.type = productId.startsWith("topup_")
      ? "topup" : productId.startsWith("food_") ? "food" : "donation";
    addIfValid("phone_number", 32);
    addIfValid("recipient_name", 120);
  }
  return result;
}
