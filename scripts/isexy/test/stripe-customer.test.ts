import { ensureStripeCustomerId, findStripeCustomerId } from "../../../supabase/functions/_shared/stripe-customer.ts";

Deno.test("ISEXY must not hijack a customer owned by another member", async () => {
  let updated = false;
  let created = 0;
  const stripe = {
    customers: {
      search: async () => ({ data: [] }),
      list: async () => ({
        data: [{ id: "cus_other", metadata: { isexy_user_id: "another-member" } }],
      }),
      update: async () => { updated = true; },
      create: async () => {
        created++;
        return { id: "cus_new" };
      },
    },
  };
  const member = { id: "correct-member", email: "reused@example.com" };
  const found = await findStripeCustomerId(stripe, member);
  if (found !== null) throw new Error("An unrelated Stripe customer was reused");
  const ensured = await ensureStripeCustomerId(stripe, member);
  if (ensured !== "cus_new" || created !== 1 || updated) {
    throw new Error("Customer ownership is not isolated");
  }
});

Deno.test("ISEXY can reuse only its own customer with the same email", async () => {
  const stripe = {
    customers: {
      search: async () => ({ data: [] }),
      list: async () => ({
        data: [
          { id: "cus_other", metadata: { isexy_user_id: "someone-else" } },
          { id: "cus_correct", metadata: { isexy_user_id: "correct-member" } },
        ],
      }),
    },
  };
  const found = await findStripeCustomerId(stripe, { id: "correct-member", email: "shared@example.com" });
  if (found !== "cus_correct") throw new Error("ISEXY lost its correctly tagged Stripe customer");
});
