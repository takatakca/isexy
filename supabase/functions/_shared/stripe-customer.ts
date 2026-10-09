// One Stripe customer per ISEXY member, keyed by the Takatak auth user id.
// Members who sign in by SMS have no email, and stripe.customers.list({ email:
// undefined }) returns *any* customer, so never look up by a missing email.

type Member = { id: string; email?: string | null; phone?: string | null };

// deno-lint-ignore no-explicit-any
type StripeLike = any;

export async function findStripeCustomerId(stripe: StripeLike, member: Member): Promise<string | null> {
  const byId = await stripe.customers.search({ query: `metadata['isexy_user_id']:'${member.id}'`, limit: 1 });
  if (byId.data[0]?.id) return byId.data[0].id;
  if (member.email) {
    const byEmail = await stripe.customers.list({ email: member.email, limit: 1 });
    const found = byEmail.data[0];
    if (found?.id) {
      // Tag it so the next lookup works even if the member's email changes.
      if (found.metadata?.isexy_user_id !== member.id) {
        await stripe.customers.update(found.id, { metadata: { ...found.metadata, isexy_user_id: member.id } });
      }
      return found.id;
    }
  }
  return null;
}

/** For checkouts: reuse the member's customer or create one tagged with their id. */
export async function ensureStripeCustomerId(stripe: StripeLike, member: Member): Promise<string> {
  const existing = await findStripeCustomerId(stripe, member);
  if (existing) return existing;
  const created = await stripe.customers.create({
    email: member.email ?? undefined,
    phone: member.phone ?? undefined,
    metadata: { isexy_user_id: member.id },
  });
  return created.id;
}
