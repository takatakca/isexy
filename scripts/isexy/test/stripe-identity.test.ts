import { checkoutOwnerId } from "../../../supabase/functions/_shared/stripe-identity.ts";

const member = "2d66cdaa-d8d5-4488-82d9-28a9f92340f0";
const another = "41db327f-a935-4027-b572-e66999776b4b";

Deno.test("accepts signed ISEXY server-issued user metadata for SMS members without email", () => {
  const id = checkoutOwnerId({ user_id: member, profile_id: member }, { isexy_user_id: member });
  if (id !== member) throw new Error("Valid TAKATAK identity rejected");
});
Deno.test("rejects any implicit email-only recipient mapping", () => {
  let rejected = false;
  try { checkoutOwnerId({ email: "shared@example.com" }); }
  catch { rejected = true; }
  if (!rejected) throw new Error("Email fallback can credit the wrong member");
});
Deno.test("rejects contradictory profile metadata", () => {
  let rejected = false;
  try { checkoutOwnerId({ user_id: member, profile_id: another }); }
  catch { rejected = true; }
  if (!rejected) throw new Error("Contradictory member metadata accepted");
});
Deno.test("rejects Stripe customer tagged to another ISEXY account", () => {
  let rejected = false;
  try { checkoutOwnerId({ user_id: member }, { isexy_user_id: another }); }
  catch { rejected = true; }
  if (!rejected) throw new Error("Cross-member Stripe customer reuse accepted");
});
