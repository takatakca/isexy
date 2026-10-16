// Points, credits, loyalty, boosts and payments (wf/rewards) end to end on a
// mocked backend: the browser never sends an amount, every balance comes from
// the server, every protected write goes through an RPC or a function, and the
// "payments not configured" state is clear.
//   node --import ./e2e/offline-browser.mjs e2e/rewards-e2e.mjs
// (E2E_BASE defaults to http://127.0.0.1:4173, E2E_SHOTS to a temp folder.)
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "/opt/node22/lib/node_modules/playwright/index.mjs");
import { SB, newState, installMock, seedBrowser, makeUser, completeProfile } from "./accounts-mockdb.mjs";

const base = process.env.E2E_BASE ?? "http://127.0.0.1:4173";
const out = process.env.E2E_SHOTS ?? `${tmpdir()}/isexy-rewards-shots`;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" });
const results = [];
const check = (name, ok, extra = "") => { results.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };

const ID = "dddddddd-0000-4000-8000-0000000000aa";

// Tables and profile columns the browser must never write (the Security stage drops those policies).
const PROTECTED_TABLES = ["credit_transactions", "boost_transactions", "boost_wallets", "star_transactions", "gift_transactions",
  "coupon_redemptions", "allowances", "user_credits", "user_stars", "subscriptions", "star_cashout_requests", "plan_grants",
  "loyalty_accounts", "loyalty_events", "cuban_points", "entitlements_cache", "chat_subscriptions", "referrals"];
const PROTECTED_COLUMNS = ["is_premium", "subscription_tier", "subscription_expires_at", "is_verified", "shadow_banned",
  "likes_remaining", "super_likes_remaining", "boosts_remaining", "super_boost_until", "daily_swipe_count",
  "swipe_cooldown_until", "first_purchase_promo_used", "promo_expires_at", "is_cuban", "referral_code"];

function wallet(over = {}) {
  return {
    tier: "free", is_premium: false, plan_expires_at: null, plan_source: null,
    credits: 25, phone_minutes: 5, video_minutes: 10,
    boosts: 2, primetime_boosts: 1, super_boost_hours: 0, monthly_boost_available: false, boost_active_until: null,
    super_likes: 3, weekly_super_likes: 0, weekly_super_likes_max: 0, super_likes_unlimited: false,
    weekly_first_impressions: 0, weekly_first_impressions_max: 0, weekly_reset_at: null,
    likes_remaining: 100, likes_unlimited: false, chat_subscription_until: null, stars: 0,
    ...over,
  };
}

const GATE = {
  not_configured: { liveEnabled: false, isTestKey: false, isLiveKey: false, configured: false, blocked: true, mode: "unknown", reason: "not_configured", firstWeekPromo: false },
  test: { liveEnabled: false, isTestKey: true, isLiveKey: false, configured: true, blocked: false, mode: "test", reason: null, firstWeekPromo: false },
  test_promo: { liveEnabled: false, isTestKey: true, isLiveKey: false, configured: true, blocked: false, mode: "test", reason: null, firstWeekPromo: true },
  paused: { liveEnabled: false, isTestKey: false, isLiveKey: true, configured: true, blocked: true, mode: "live", reason: "live_disabled", firstWeekPromo: false },
};

/**
 * One signed-in member with a stateful wallet. `rpc` maps an RPC name to a
 * handler (body, s) => [status, json]; functions likewise in `fns`.
 */
async function open({ gate = "test", w = {}, loyalty = null, rpc = {}, fns = {}, profile = {}, signedIn = true } = {}) {
  const user = makeUser(ID);
  const state = newState();
  completeProfile(state, ID, profile);
  const s = {
    state,
    wallet: wallet(w),
    calls: [], // { kind: "rpc"|"fn"|"write", name, body }
    loyalty: loyalty ?? { points: 320, lifetime_points: 420, streak: 4, longest_streak: 6, earned: ["profile_complete"],
      history: [
        { reason: "daily_visit", points: 5, detail: "Daily visit", created_at: new Date().toISOString() },
        { reason: "redeem", points: -100, detail: "super_like_1", created_at: new Date(Date.now() - 86_400_000).toISOString() },
        { reason: "profile_complete", points: 50, detail: "Complete profile", created_at: new Date(Date.now() - 3 * 86_400_000).toISOString() },
      ] },
  };
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await seedBrowser(ctx, signedIn ? user : null);
  await installMock(ctx, state, { user: signedIn ? user : null });
  const reply = (route, status, body) => route.fulfill({
    status, contentType: "application/json",
    headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" },
    body: JSON.stringify(body),
  });
  // Every REST write is recorded (then handled by the accounts mock).
  await ctx.route(`${SB}/rest/v1/**`, async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname;
    if (req.method() !== "GET" && req.method() !== "HEAD" && req.method() !== "OPTIONS" && !p.startsWith("/rest/v1/rpc/")) {
      let body = null;
      try { body = JSON.parse(req.postData() || "null"); } catch { /* not json */ }
      s.calls.push({ kind: "write", name: `${req.method()} ${p.slice("/rest/v1/".length)}`, body });
    }
    return route.fallback();
  });
  await ctx.route(`${SB}/rest/v1/rpc/**`, async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fallback();
    const name = new URL(req.url()).pathname.split("/").pop();
    const body = JSON.parse(req.postData() || "{}");
    s.calls.push({ kind: "rpc", name, body });
    if (rpc[name]) { const [status, json] = rpc[name](body, s); return reply(route, status, json); }
    switch (name) {
      case "get_my_wallet": return reply(route, 200, s.wallet);
      case "record_daily_visit": return reply(route, 200, { streak: s.loyalty.streak, longest_streak: s.loyalty.longest_streak, first_visit_today: false, points: s.loyalty.points, points_earned: 0, new_badges: [], badges: ["3_day"] });
      case "get_my_loyalty": return reply(route, 200, s.loyalty);
      case "get_my_referral_code": return reply(route, 200, "ANA7K2PQ");
      case "redeem_loyalty_reward": {
        const cost = { super_like_1: 100, boost_1: 250, super_like_5: 400, boost_3: 600, gold_week: 1000 }[body.p_reward] ?? 99999;
        if (s.loyalty.points < cost) return reply(route, 200, { success: false, error: "not_enough_points" });
        s.loyalty.points -= cost;
        s.loyalty.history.unshift({ reason: "redeem", points: -cost, detail: body.p_reward, created_at: new Date().toISOString() });
        if (body.p_reward === "super_like_1") s.wallet.super_likes += 1;
        return reply(route, 200, { success: true, reward: body.p_reward, points: s.loyalty.points, expires_at: null });
      }
      case "use_boost":
        if (s.wallet.boosts <= 0) return reply(route, 200, { success: false, error: "no_boosts" });
        s.wallet.boosts -= 1;
        s.wallet.boost_active_until = new Date(Date.now() + 1800_000).toISOString();
        return reply(route, 200, { success: true, boost_type: body.p_boost_type, duration: 1800, active_until: s.wallet.boost_active_until });
      case "convert_credits_to_minutes":
        if (body.p_credits > s.wallet.credits) return reply(route, 200, { success: false, error: "not_enough_credits" });
        s.wallet.credits -= body.p_credits;
        s.wallet[body.p_type === "phone" ? "phone_minutes" : "video_minutes"] += body.p_credits;
        return reply(route, 200, { success: true, credits: s.wallet.credits, phone_minutes: s.wallet.phone_minutes, video_minutes: s.wallet.video_minutes });
      case "apply_referral_code":
        return reply(route, 200, body.p_friend_code === "FRIEND42" ? { success: true, credits: 10 } : { success: false, error: "Invalid referral code" });
      case "redeem_coupon":
        if (body.p_code !== "GOLDTRIAL7") return reply(route, 200, { success: false, error: "Invalid or expired code" });
        Object.assign(s.wallet, { tier: "gold", is_premium: true, plan_source: "coupon", plan_expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString() });
        return reply(route, 200, { success: true, code_type: "trial", subscription_tier: "gold", expires_at: s.wallet.plan_expires_at, description: "7 days of Gold", plan: { tier: "gold" } });
      default: return route.fallback();
    }
  });
  await ctx.route(`${SB}/functions/v1/**`, async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fallback();
    const name = new URL(req.url()).pathname.split("/").pop();
    let body = null;
    try { body = JSON.parse(req.postData() || "null"); } catch { /* none */ }
    s.calls.push({ kind: "fn", name, body });
    if (fns[name]) { const [status, json] = fns[name](body, s); return reply(route, status, json); }
    if (name === "isexy-payments-gate-status") return reply(route, 200, GATE[gate]);
    if (name === "isexy-check-subscription") return reply(route, 200, { subscribed: s.wallet.is_premium, tier: s.wallet.is_premium ? s.wallet.tier : null, subscription_end: s.wallet.plan_expires_at, restored: 0, purchases_restored: 0 });
    if (/^isexy-create-|^isexy-customer-portal$/.test(name)) {
      // Stripe "sends the member back" at once: the returned URL is the success page.
      const back = name === "isexy-create-checkout" ? "/my-subscription" : name === "isexy-customer-portal" ? "/my-subscription" : new URL(req.headers()["referer"] ?? base).pathname;
      return reply(route, 200, { url: `${base}${back}?checkout=success` });
    }
    return route.fallback();
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { ctx, page, s, errors };
}

const calls = (s, kind, name) => s.calls.filter((c) => c.kind === kind && (!name || c.name === name));
const noHorizontalScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const settle = (page, ms = 600) => page.waitForTimeout(ms);
const toastText = (page) => page.locator("[data-sonner-toast]").allInnerTexts().then((t) => t.join(" | "));

function protectedWrites(s) {
  return s.calls.filter((c) => c.kind === "write").filter((c) => {
    const table = c.name.split(" ")[1].split("?")[0];
    if (PROTECTED_TABLES.includes(table)) return true;
    if (table === "profiles") {
      const rows = Array.isArray(c.body) ? c.body : [c.body ?? {}];
      return rows.some((r) => r && PROTECTED_COLUMNS.some((col) => col in r));
    }
    return false;
  });
}

const everyProtectedWrite = [];
async function finish(t, label) {
  everyProtectedWrite.push(...protectedWrites(t.s).map((c) => `${label}: ${c.name} ${JSON.stringify(c.body).slice(0, 80)}`));
  check(`${label}: no page errors`, t.errors.length === 0, t.errors.join(" | "));
  await t.ctx.close();
}

// ---------------------------------------------------------------- 1. Payments not configured
{
  const t = await open({ gate: "not_configured" });
  for (const [path, label] of [["/premium", "Premium"], ["/get-boosts", "Get Boosts"], ["/get-super-likes", "Get Super Likes"], ["/buy-credits", "Buy Credits"], ["/buy-minutes", "Buy Minutes"], ["/compare-plans", "Compare Plans"]]) {
    await t.page.goto(base + path);
    await settle(t.page, 900);
    const notice = await t.page.getByText("Payments are not open yet", { exact: false }).first().isVisible().catch(() => false);
    const disabledBuy = await t.page.locator("button:disabled").filter({ hasText: /not open yet|Get (Plus|Gold|Platinum)/ }).count();
    check(`not configured: ${label} says so and disables buying`, notice && disabledBuy > 0, `notice=${notice} disabled=${disabledBuy}`);
    check(`not configured: ${label} no horizontal scroll`, await noHorizontalScroll(t.page));
    check(`${label}: assistant button does not cover the buy bar`, !(await t.page.getByRole("button", { name: "Open ISEXY Concierge" }).isVisible().catch(() => false)));
    if (path === "/premium") await t.page.screenshot({ path: `${out}/premium-not-configured.png` });
  }
  check("not configured: no checkout function called", calls(t.s, "fn").every((c) => !/create-|customer-portal/.test(c.name)), calls(t.s, "fn").map((c) => c.name).join(","));
  await finish(t, "not configured");
}

// ---------------------------------------------------------------- 2. Paused live payments
{
  const t = await open({ gate: "paused" });
  await t.page.goto(base + "/get-boosts");
  await settle(t.page, 900);
  check("paused: Get Boosts button says Purchases paused", await t.page.getByRole("button", { name: "Purchases paused" }).isDisabled());
  await finish(t, "paused");
}

// ---------------------------------------------------------------- 3. Premium checkout (test mode) and return
{
  const t = await open({ gate: "test" });
  await t.page.goto(base + "/premium");
  await settle(t.page, 900);
  check("premium: test mode said", await t.page.getByText("Test mode: use a Stripe test card", { exact: false }).isVisible());
  check("premium: no promo banner without the Stripe coupon", !(await t.page.getByText("First week special offer").isVisible().catch(() => false)));
  await t.page.getByRole("button", { name: /Continue Gold/ }).click();
  await t.page.waitForURL((u) => u.pathname === "/my-subscription", { timeout: 8000 }).catch(() => {});
  const checkout = calls(t.s, "fn", "isexy-create-checkout")[0];
  check("premium: checkout sends tier + duration only (no price)", checkout && JSON.stringify(Object.keys(checkout.body).sort()) === '["duration","tier"]' && checkout.body.tier === "gold", JSON.stringify(checkout?.body));
  check("premium: same-tab redirect to the returned URL", new URL(t.page.url()).pathname === "/my-subscription");
  await settle(t.page, 800);
  check("return: payment toast shown", /Payment received/.test(await toastText(t.page)), await toastText(t.page));
  check("return: ?checkout removed from the URL", !new URL(t.page.url()).search.includes("checkout"));
  check("return: wallet refreshed", calls(t.s, "rpc", "get_my_wallet").length >= 2, String(calls(t.s, "rpc", "get_my_wallet").length));
  await finish(t, "premium");
}

// ---------------------------------------------------------------- 4. First-week offer only when the coupon exists
{
  const t = await open({ gate: "test_promo" });
  await t.page.goto(base + "/premium");
  await settle(t.page, 900);
  check("promo: banner shown when the coupon exists", await t.page.getByText("First week special offer").isVisible());
  await t.page.getByRole("button", { name: /Claim Your 50% Discount/ }).click();
  await settle(t.page, 800);
  const checkout = calls(t.s, "fn", "isexy-create-checkout")[0];
  check("promo: asks for the week plan with promo:true (server applies the coupon)", checkout?.body?.promo === true && checkout?.body?.duration === "week", JSON.stringify(checkout?.body));
  await finish(t, "promo");
}

// ---------------------------------------------------------------- 5. A Stripe payer is sent to billing, not a second checkout
{
  const t = await open({ gate: "test", w: { tier: "gold", is_premium: true, plan_source: "stripe", plan_expires_at: new Date(Date.now() + 20 * 86_400_000).toISOString() } });
  await t.page.goto(base + "/premium");
  await settle(t.page, 900);
  await t.page.getByRole("button", { name: "Manage my plan" }).click();
  await t.page.waitForURL((u) => u.pathname === "/my-subscription", { timeout: 5000 }).catch(() => {});
  check("stripe payer: Premium → My Subscription, no checkout", new URL(t.page.url()).pathname === "/my-subscription" && calls(t.s, "fn", "isexy-create-checkout").length === 0);
  await settle(t.page, 800);
  check("my subscription: DB plan shown (Gold, paid until)", await t.page.getByText("ISEXY Gold", { exact: true }).isVisible() && await t.page.getByText(/Paid until/).isVisible());
  await t.page.getByRole("button", { name: "Manage" }).click();
  await settle(t.page, 800);
  check("my subscription: Manage opens the Stripe billing page", calls(t.s, "fn", "isexy-customer-portal").length === 1);
  await finish(t, "stripe payer");
}

// ---------------------------------------------------------------- 6. Plan from a code shows in My Subscription
{
  const t = await open({ w: { tier: "platinum", is_premium: true, plan_source: "coupon", plan_expires_at: new Date(Date.now() + 5 * 86_400_000).toISOString() } });
  await t.page.goto(base + "/my-subscription");
  await settle(t.page, 900);
  check("my subscription: code plan shown (not 'Free plan')", await t.page.getByText("ISEXY Platinum", { exact: true }).isVisible() && await t.page.getByText(/From a code · ends on/).isVisible());
  check("my subscription: no Stripe Manage for a code plan", !(await t.page.getByRole("button", { name: "Manage" }).isVisible().catch(() => false)));
  await t.page.screenshot({ path: `${out}/my-subscription-code.png` });
  await finish(t, "code plan");
}

// ---------------------------------------------------------------- 7. Boosts: balances, use, buy
{
  const t = await open({ gate: "test" });
  await t.page.goto(base + "/get-boosts");
  await settle(t.page, 900);
  const section = t.page.getByRole("region", { name: "Your Boosts" });
  check("boosts: wallet balances shown", (await section.innerText()).includes("2") && (await section.innerText()).includes("1"), (await section.innerText()).replace(/\s+/g, " "));
  await t.page.getByRole("button", { name: "Use Boosts" }).click();
  await settle(t.page, 800);
  const use = calls(t.s, "rpc", "use_boost")[0];
  check("boosts: Use spends one through use_boost", use?.body?.p_boost_type === "boost" && use?.body?.p_profile_id === ID, JSON.stringify(use?.body));
  check("boosts: running Boost said", await t.page.getByText(/Boost on until/).first().isVisible());
  await t.page.getByRole("button", { name: /Continue — \$32\.90 CAD/ }).click();
  await settle(t.page, 800);
  const buy = calls(t.s, "fn", "isexy-create-one-time-payment")[0];
  check("boosts: buy sends the product id only", buy && JSON.stringify(buy.body) === '{"productId":"boost_10"}', JSON.stringify(buy?.body));
  await finish(t, "boosts");
}

// ---------------------------------------------------------------- 8. Super Likes and credits
{
  const t = await open({ gate: "test" });
  await t.page.goto(base + "/get-super-likes");
  await settle(t.page, 900);
  await t.page.locator("button.cta-primary").click();
  await settle(t.page, 800);
  const sl = calls(t.s, "fn", "isexy-create-one-time-payment")[0];
  check("super likes: buy sends the product id only", sl && Object.keys(sl.body).join() === "productId" && /^super_likes_\d+$/.test(sl.body.productId), JSON.stringify(sl?.body));

  await t.page.goto(base + "/buy-credits");
  await settle(t.page, 900);
  check("credits: balance from the wallet", await t.page.getByText(/^25\s*credits$/).isVisible() && await t.page.getByText(/You have 10 video and 5 phone minutes/).isVisible());
  await t.page.locator("#convert-amount").fill("10");
  await t.page.getByRole("button", { name: /Video min/ }).click();
  await settle(t.page, 800);
  const conv = calls(t.s, "rpc", "convert_credits_to_minutes")[0];
  check("credits: converted to minutes server-side", conv?.body?.p_credits === 10 && conv?.body?.p_type === "video", JSON.stringify(conv?.body));
  check("credits: new balances shown after converting", await t.page.getByText(/^15\s*credits$/).isVisible() && await t.page.getByText(/You have 20 video and 5 phone minutes/).isVisible());
  await t.page.locator("button.cta-primary").click();
  await settle(t.page, 800);
  const cr = calls(t.s, "fn", "isexy-create-credit-purchase")[0];
  check("credits: buy sends the package id only", cr && Object.keys(cr.body).join() === "packageId", JSON.stringify(cr?.body));
  await finish(t, "super likes + credits");
}

// ---------------------------------------------------------------- 9. Loyalty Rewards
{
  const t = await open();
  await t.page.goto(base + "/loyalty-rewards");
  await settle(t.page, 900);
  check("loyalty: points from the server (no fake 650)", (await t.page.getByTestId("loyalty-points").innerText()) === "320");
  check("loyalty: streak shown", await t.page.getByText(/4-day streak/).isVisible());
  check("loyalty: real referral code", await t.page.getByText("ANA7K2PQ").isVisible());
  check("loyalty: history from the server", await t.page.getByText("Redeemed: 1 Super Like").isVisible() && await t.page.getByText("Daily visit", { exact: true }).isVisible());
  check("loyalty: achievement done is marked", await t.page.getByText("Done").first().isVisible());
  await t.page.getByRole("tab", { name: "Redeem Rewards" }).click();
  check("loyalty: unaffordable reward disabled", await t.page.getByRole("button", { name: "Redeem 1 Week Gold for 1000 points" }).isDisabled());
  await t.page.getByRole("button", { name: "Redeem 1 Super Like for 100 points" }).click();
  await settle(t.page, 900);
  const red = calls(t.s, "rpc", "redeem_loyalty_reward")[0];
  check("loyalty: redeemed through redeem_loyalty_reward", red?.body?.p_reward === "super_like_1", JSON.stringify(red?.body));
  check("loyalty: new balance from the server", (await t.page.getByTestId("loyalty-points").innerText()) === "220");
  check("loyalty: no horizontal scroll", await noHorizontalScroll(t.page));
  await t.page.screenshot({ path: `${out}/loyalty.png` });
  await finish(t, "loyalty");
}

// ---------------------------------------------------------------- 10. Loyalty before deploy: honest state
{
  const t = await open({ rpc: { get_my_loyalty: () => [404, { code: "PGRST202", message: "Could not find the function isexy.get_my_loyalty without parameters in the schema cache" }] } });
  await t.page.goto(base + "/loyalty-rewards");
  await settle(t.page, 900);
  check("loyalty not deployed: honest notice, no number", await t.page.getByText(/not switched on yet/).isVisible() && !(await t.page.getByTestId("loyalty-points").isVisible().catch(() => false)));
  await finish(t, "loyalty not deployed");
}

// ---------------------------------------------------------------- 11. Referrals and invite link
{
  const t = await open();
  await t.page.goto(base + "/?ref=friend42");
  await settle(t.page, 600);
  await t.page.goto(base + "/referrals");
  await settle(t.page, 900);
  check("referrals: code from get_my_referral_code", await t.page.getByText("ANA7K2PQ").isVisible() && calls(t.s, "rpc", "get_my_referral_code").length > 0);
  check("referrals: invite link code pre-filled", (await t.page.getByLabel("Friend's referral code").inputValue()) === "FRIEND42");
  await t.page.getByRole("button", { name: "Apply" }).click();
  await settle(t.page, 800);
  const ap = calls(t.s, "rpc", "apply_referral_code")[0];
  check("referrals: applied server-side", ap?.body?.p_friend_code === "FRIEND42" && /received 10 credits/.test(await toastText(t.page)), JSON.stringify(ap?.body));
  await finish(t, "referrals");
}

// ---------------------------------------------------------------- 12. Restore purchases
{
  const t = await open({ fns: { "isexy-check-subscription": (body) => [200, { subscribed: true, tier: "gold", subscription_end: "2026-11-20T00:00:00Z", restored: 2, purchases_restored: body?.restore ? 1 : 0 }] } });
  await t.page.goto(base + "/restore-purchase");
  await settle(t.page, 600);
  await t.page.getByRole("button", { name: "Restore my purchases" }).click();
  await settle(t.page, 900);
  const rc = calls(t.s, "fn", "isexy-check-subscription")[0];
  check("restore: asks the server with restore:true", rc?.body?.restore === true, JSON.stringify(rc?.body));
  check("restore: says what was found", await t.page.getByText(/ISEXY Gold plan is active/).isVisible() && await t.page.getByText(/1 missing purchase was added/).isVisible());
  await finish(t, "restore");
}

// ---------------------------------------------------------------- 13. Redeem code
{
  const t = await open();
  await t.page.goto(base + "/redeem-code");
  await settle(t.page, 600);
  await t.page.getByLabel("Code").fill("GOLDTRIAL7");
  await t.page.getByRole("button", { name: /Redeem Code/ }).click();
  await settle(t.page, 900);
  check("redeem: tier really granted shown", await t.page.getByText("ISEXY Gold unlocked").isVisible());
  check("redeem: Gold features, not Platinum ones", await t.page.getByText("✓ 5 Super Likes per week").isVisible() && !(await t.page.getByText(/Unlimited Super Likes/).isVisible().catch(() => false)));
  await finish(t, "redeem");
}

// ---------------------------------------------------------------- 14. Balances on Profile and Settings
{
  const t = await open({ w: { boosts: 2, primetime_boosts: 1, super_likes: 3, weekly_super_likes: 0 } });
  await t.page.goto(base + "/profile");
  await settle(t.page, 1200);
  check("profile: Boosts from the wallet", await t.page.getByText("3 Boosts").isVisible());
  check("profile: Super Likes from the wallet", await t.page.getByText("3 Super Likes").isVisible());
  await t.page.goto(base + "/settings");
  await settle(t.page, 900);
  await t.page.getByText("Get Boosts", { exact: true }).click();
  await settle(t.page, 800);
  check("settings: My Boosts sheet shows wallet counts", await t.page.getByText("2 left").isVisible() && await t.page.getByText("1 left").isVisible());
  await finish(t, "profile + settings");
}

// ---------------------------------------------------------------- 15. Streak: one server visit per load
{
  const t = await open();
  await t.page.goto(base + "/discover");
  await settle(t.page, 1500);
  check("streak: record_daily_visit called once per load", calls(t.s, "rpc", "record_daily_visit").length === 1, String(calls(t.s, "rpc", "record_daily_visit").length));
  check("streak: no browser badge award with a browser streak", calls(t.s, "rpc", "award_streak_badge").length === 0);
  await finish(t, "streak");
}

// ---------------------------------------------------------------- 16. Reward pages need sign-in
{
  const t = await open({ signedIn: false });
  for (const path of ["/loyalty-rewards", "/referrals", "/redeem-code", "/my-stars", "/restore-purchase"]) {
    await t.page.goto(base + path);
    await settle(t.page, 700);
    check(`signed out: ${path} → /auth`, new URL(t.page.url()).pathname === "/auth", new URL(t.page.url()).pathname);
  }
  await t.ctx.close();
}

check("no browser write of protected tables or profile columns (whole run)", everyProtectedWrite.length === 0, everyProtectedWrite.join(" | "));

await browser.close();
console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
