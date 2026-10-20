import { safeCheckoutMetadata } from "../../../supabase/functions/_shared/checkout-metadata.ts";

Deno.test("client cannot override Stripe payer identity or fulfillment type", () => {
  const m = safeCheckoutMetadata("boost_1", {
    profile_id: "victim", user_id: "victim", package_id: "credits_100",
    product_id: "super_likes_30", type: "gift",
    gift_package_id: "fake", tier: "platinum", quantity: "9999",
  }, "payer");
  if (JSON.stringify(m) !== JSON.stringify({ user_id: "payer", product_id: "boost_1" })) {
    throw new Error("User-controlled Stripe metadata escaped server allowlist");
  }
});

Deno.test("gift retains only trusted package and recipient information", () => {
  const recipient = "2d66cdaa-d8d5-4488-82d9-28a9f92340f0";
  const m = safeCheckoutMetadata("gift_pack", {
    recipient_profile_id: recipient, gift_package_id: "wrong", type: "donation",
    message: "Thank you", profile_id: "victim",
  }, "payer", "pack");
  if (m.gift_package_id !== "pack" || m.recipient_profile_id !== recipient ||
      m.type !== "gift" || m.profile_id) throw new Error("Gift metadata isolation failed");
});

Deno.test("gift without an identifiable recipient is rejected before charging", () => {
  let failed = false;
  try {
    safeCheckoutMetadata("gift_pack", { recipient_profile_id: "not-uuid" }, "payer", "pack");
  } catch { failed = true; }
  if (!failed) throw new Error("Invalid recipient was accepted");
});

Deno.test("donation details are allowlisted but cannot change purchased product", () => {
  const m = safeCheckoutMetadata("topup_10", {
    phone_number: "+53 555 1234", recipient_name: "Example",
    type: "gift", profile_id: "victim",
  }, "payer");
  if (m.type !== "topup" || m.product_id !== "topup_10" ||
      m.phone_number !== "+53 555 1234" || m.profile_id) {
    throw new Error("Unsafe donation metadata");
  }
});
