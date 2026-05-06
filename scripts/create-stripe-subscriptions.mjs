#!/usr/bin/env node
/**
 * scripts/create-stripe-subscriptions.mjs
 *
 * Creates ISEXY subscription products + 9 recurring CAD prices in Stripe.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_... node scripts/create-stripe-subscriptions.mjs
 *
 * After it runs, copy the printed STRIPE_PRICE_* values into
 * Lovable / Supabase project secrets.
 */

import Stripe from "stripe";

const SECRET = process.env.STRIPE_SECRET_KEY;

if (!SECRET) {
  console.error("ERROR: STRIPE_SECRET_KEY is not set. Aborting.");
  process.exit(1);
}

const MODE = SECRET.startsWith("sk_live_")
  ? "LIVE"
  : SECRET.startsWith("sk_test_")
    ? "TEST"
    : "UNKNOWN";

console.log(`Stripe mode: ${MODE}`);
if (MODE === "UNKNOWN") {
  console.error("ERROR: STRIPE_SECRET_KEY does not look like a valid Stripe secret key.");
  process.exit(1);
}

const stripe = new Stripe(SECRET, { apiVersion: "2025-08-27.basil" });

// tier -> { name, plans: [{ duration, amountCad, interval, intervalCount }] }
const TIERS = {
  plus: {
    name: "ISEXY Plus",
    plans: [
      { duration: "week",       amount: 999,   interval: "week",  count: 1 },
      { duration: "month",      amount: 2649,  interval: "month", count: 1 },
      { duration: "six_months", amount: 7999,  interval: "month", count: 6 },
    ],
  },
  gold: {
    name: "ISEXY Gold",
    plans: [
      { duration: "week",       amount: 1499,  interval: "week",  count: 1 },
      { duration: "month",      amount: 3999,  interval: "month", count: 1 },
      { duration: "six_months", amount: 11999, interval: "month", count: 6 },
    ],
  },
  platinum: {
    name: "ISEXY Platinum",
    plans: [
      { duration: "week",       amount: 2399,  interval: "week",  count: 1 },
      { duration: "month",      amount: 6399,  interval: "month", count: 1 },
      { duration: "six_months", amount: 19199, interval: "month", count: 6 },
    ],
  },
};

async function findOrCreateProduct(tier, name) {
  // Search by metadata to avoid duplicates
  const search = await stripe.products.search({
    query: `metadata['app']:'isexy' AND metadata['tier']:'${tier}'`,
    limit: 1,
  });
  if (search.data.length > 0) {
    console.log(`  Reusing product ${search.data[0].id} (${name})`);
    return search.data[0];
  }
  const product = await stripe.products.create({
    name,
    metadata: { app: "isexy", tier },
  });
  console.log(`  Created product ${product.id} (${name})`);
  return product;
}

async function findOrCreatePrice(product, tier, plan) {
  const search = await stripe.prices.search({
    query: `product:'${product.id}' AND metadata['duration']:'${plan.duration}' AND active:'true'`,
    limit: 1,
  });
  if (search.data.length > 0) {
    const existing = search.data[0];
    if (existing.unit_amount === plan.amount && existing.currency === "cad") {
      console.log(`    Reusing price ${existing.id} (${plan.duration})`);
      return existing;
    }
    console.log(`    Existing price differs; creating new one for ${plan.duration}`);
  }
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: plan.amount,
    currency: "cad",
    recurring: { interval: plan.interval, interval_count: plan.count },
    metadata: {
      app: "isexy",
      tier,
      duration: plan.duration,
      purchase_type: "subscription",
    },
  });
  console.log(`    Created price ${price.id} (${plan.duration})`);
  return price;
}

const envOut = {};

for (const [tier, cfg] of Object.entries(TIERS)) {
  console.log(`\nTier: ${cfg.name}`);
  const product = await findOrCreateProduct(tier, cfg.name);
  for (const plan of cfg.plans) {
    const price = await findOrCreatePrice(product, tier, plan);
    const key = `STRIPE_PRICE_${tier.toUpperCase()}_${plan.duration.toUpperCase()}`;
    envOut[key] = price.id;
  }
}

console.log("\n========================================");
console.log("Copy these into Lovable / Supabase secrets:");
console.log("========================================\n");
for (const [k, v] of Object.entries(envOut)) {
  console.log(`${k}=${v}`);
}
console.log("\nAPP_URL=https://isexy.ca");
console.log(`\nMode: ${MODE}`);
