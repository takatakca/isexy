#!/usr/bin/env node
// Screenshots of the key ISEXY screens against the e2e suites' mocked backend
// (e2e/accounts-mockdb.mjs plus the feed, inbox, chat, likes and wallet data the
// suites use). Nothing leaves 127.0.0.1: run it with the offline browser guard.
//
//   node --import ./e2e/offline-browser.mjs scripts/design/screens.mjs <base> <outDir> [mobile|desktop|all]
//
// Writes <outDir>/<viewport>/<NN-name>.png (viewport top, 390x844 or 1440x900).
// scripts/design/contact-sheet.mjs turns a before/after pair into one PNG.
import { mkdirSync } from "node:fs";
import { newState, installMock, seedBrowser, makeUser, completeProfile, SB } from "../../e2e/accounts-mockdb.mjs";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "/opt/node22/lib/node_modules/playwright/index.mjs");
const [, , base = "http://127.0.0.1:4173", out = "shots", which = "all"] = process.argv;
const VIEWPORTS = { mobile: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };

const ME = "dddddddd-0000-4000-8000-0000000000aa";
const pid = (i) => `dddddddd-0000-4000-8000-0000000001${String(i).padStart(2, "0")}`;
const now = Date.now();
const iso = (minAgo) => new Date(now - minAgo * 60_000).toISOString();
const PEOPLE = [
  ["Béa", "Montréal", "Designer", true], ["Camille", "Québec", "Nurse", false], ["Dania", "Laval", "Photographer", true],
  ["Élodie", "Gatineau", "Teacher", true], ["Fatou", "Montréal", "Engineer", false], ["Gabrielle", "Sherbrooke", "Chef", true],
];
const HUES = [[204, 214], [262, 230], [18, 200], [168, 220], [330, 250], [46, 210]];

/** Placeholder portraits (abstract, no real people): rendered once per run. */
async function portraits(browser) {
  const page = await browser.newPage({ viewport: { width: 600, height: 800 } });
  const out = [];
  for (const [a, b] of HUES) {
    await page.setContent(`<body style="margin:0"><svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${a} 55% 62%)"/><stop offset="1" stop-color="hsl(${b} 60% 22%)"/></linearGradient>
      <radialGradient id="l" cx=".3" cy=".25" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
      <rect width="600" height="800" fill="url(#g)"/><rect width="600" height="800" fill="url(#l)"/>
      <circle cx="300" cy="330" r="118" fill="hsl(${a} 40% 85% / .55)"/>
      <path d="M90 800c0-150 94-250 210-250s210 100 210 250z" fill="hsl(${a} 40% 85% / .45)"/></svg></body>`);
    out.push(await page.screenshot({ type: "png" }));
  }
  await page.close();
  return out;
}

function memberState() {
  const state = newState();
  completeProfile(state, ME, { first_name: "Ana", subscription_tier: "free", is_premium: false, job_title: "Product designer", school: "UQAM", interests: ["Coffee", "Hiking", "Reading", "Live music"], is_verified: true, last_active_at: iso(1) });
  state.profile_photos[0].photo_url = "https://img.test/me.png";
  state.swipes = [];
  state.matches = [];
  state.messages = [];
  state.conversation_unlocks = [];
  PEOPLE.forEach(([name, city, job, verified], i) => {
    state.profiles.push({ id: pid(i), user_id: pid(i), first_name: name, birth_date: `199${i}-04-12`, city, job_title: job, is_verified: verified, last_active_at: iso(i * 7) });
    state.profile_photos.push({ id: `ph-${i}`, profile_id: pid(i), photo_url: `https://img.test/p${i}.png`, position: 0 });
    state.swipes.push({ id: `sw-${i}`, swiper_id: ME, swiped_id: pid(i), action: i === 1 ? "super_like" : "like", created_at: iso(30 + i * 90) });
  });
  state.matches.push({ id: "match-bea", profile1_id: ME, profile2_id: pid(0), is_active: true, created_at: iso(4000) });
  const lines = [
    [pid(0), "Salut Ana! Tu vas au Festival de jazz cette fin de semaine?"],
    [ME, "Oui! Samedi soir, avec deux amies. Tu veux te joindre à nous?"],
    [pid(0), "Avec plaisir 🎷 On se retrouve devant la Place des Arts?"],
    [ME, "Parfait, vers 19 h. Je t'envoie un message en arrivant."],
    [pid(0), "Super, à samedi!"],
  ];
  lines.forEach(([sender, content], i) => state.messages.push({ id: `00000000-0000-4000-9000-00000000000${i}`, match_id: "match-bea", sender_id: sender, content, is_read: true, created_at: iso(60 - i * 9) }));
  state.conversation_unlocks.push({ id: "unlock-1", match_id: "match-bea", unlocked_by: ME, unlock_type: "chat" });
  return state;
}

const feed = PEOPLE.map(([name, city, job, verified], i) => ({
  id: pid(i), first_name: name, birth_date: `199${i}-04-12`, bio: `${job} in ${city}. Coffee, long walks on the Lachine Canal and live music. Looking for new friends to explore the city with.`,
  city, job_title: job, company: null, school: null, is_verified: verified, interests: ["Coffee", "Hiking", "Live music"],
  distance_km: 2 + i * 3, photos: [`https://img.test/p${i}.png`, `https://img.test/p${(i + 1) % 6}.png`],
}));
const inbox = PEOPLE.slice(0, 5).map(([name, , , verified], i) => ({
  match_id: i === 0 ? "match-bea" : `match-${i}`, matched_at: iso(9000 - i * 500), other_id: pid(i), first_name: name, photo_url: `https://img.test/p${i}.png`,
  is_verified: verified, last_active_at: iso(i * 11), last_message_at: i < 3 ? iso(20 + i * 140) : null,
  last_message_preview: ["Super, à samedi!", "Haha yes, the poutine place on Saint-Laurent", "Thanks for the playlist!"][i] ?? null,
  last_message_mine: i === 1, unread_count: i === 0 ? 2 : 0, is_unlocked: true,
}));
const received = PEOPLE.map(([name, city, , verified], i) => ({
  liker_id: pid(i), first_name: name, birth_date: `199${i}-04-12`, city, is_verified: verified, photo_url: `https://img.test/p${i}.png`,
  action: i === 2 ? "super_like" : "like", message: null, liked_at: iso(15 + i * 80), locked: true,
}));
const wallet = {
  tier: "free", is_premium: false, plan_expires_at: null, plan_source: null, credits: 25, phone_minutes: 5, video_minutes: 10,
  boosts: 2, primetime_boosts: 1, super_boost_hours: 0, monthly_boost_available: false, boost_active_until: null,
  super_likes: 3, weekly_super_likes: 0, weekly_super_likes_max: 0, super_likes_unlimited: false, weekly_first_impressions: 0,
  weekly_first_impressions_max: 0, weekly_reset_at: null, likes_remaining: 100, likes_unlimited: false, chat_subscription_until: null, stars: 0,
};
const GATE = { liveEnabled: false, isTestKey: true, isLiveKey: false, configured: true, blocked: false, mode: "test", reason: null, firstWeekPromo: false };

// [name, path, signed in?]
const SCREENS = [
  ["welcome", "/", false],
  ["auth", "/auth", false],
  ["signup", "/auth?mode=signup", false],
  ["onboarding", "/onboarding", false],
  ["profile-setup", "/profile-setup", "new"],
  ["discover", "/discover", true],
  ["likes", "/likes", true],
  ["who-liked-you", "/who-liked-you", true],
  ["matches", "/matches", true],
  ["chat", "/chat/match-bea", true],
  ["profile", "/profile", true],
  ["edit-profile", "/edit-profile", true],
  ["premium", "/premium", true],
  ["compare-plans", "/compare-plans", true],
  ["buy-credits", "/buy-credits", true],
  ["buy-minutes", "/buy-minutes", true],
  ["settings", "/settings", true],
  ["help-support", "/help-support", false],
  ["explore", "/explore", true],
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" });
const imgs = await portraits(browser);
const reply = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" }, body: JSON.stringify(body) });

for (const vpName of which === "all" ? Object.keys(VIEWPORTS) : [which]) {
  const dir = `${out}/${vpName}`;
  mkdirSync(dir, { recursive: true });
  for (const [i, [name, path, who]] of SCREENS.entries()) {
    const ctx = await browser.newContext({ viewport: VIEWPORTS[vpName], deviceScaleFactor: 1 });
    const newcomer = who === "new";
    const id = newcomer ? "dddddddd-0000-4000-8000-0000000000bb" : ME;
    const user = who ? makeUser(id) : null;
    const state = newcomer ? newState() : memberState();
    await seedBrowser(ctx, user);
    await ctx.addInitScript(() => {
      localStorage.setItem("cubadate_safety_seen", "true");
      localStorage.setItem("isexy_first_impression_tip_seen", "1");
    });
    await installMock(ctx, state, { user });
    await ctx.route("https://img.test/**", (route) => {
      const m = /p(\d)\.png/.exec(route.request().url());
      return route.fulfill({ status: 200, contentType: "image/png", body: imgs[m ? Number(m[1]) : 3] });
    });
    await ctx.route(`${SB}/rest/v1/rpc/**`, (route) => {
      const req = route.request();
      if (req.method() === "OPTIONS") return route.fallback();
      const fn = new URL(req.url()).pathname.split("/").pop();
      switch (fn) {
        case "get_discover_feed": return reply(route, feed);
        case "get_my_conversations": return reply(route, inbox);
        case "get_my_badge_counts": return reply(route, [{ unread_messages: 2, new_likes: 4 }]);
        case "get_likes_received": return reply(route, received);
        case "get_my_wallet": return reply(route, wallet);
        case "check_swipe_rate_limit": return reply(route, { allowed: true, remaining: 42 });
        case "mark_messages_read": return reply(route, 0);
        default: return route.fallback();
      }
    });
    await ctx.route(`${SB}/functions/v1/**`, (route) => {
      const fn = new URL(route.request().url()).pathname.split("/").pop();
      if (fn === "isexy-payments-gate-status") return reply(route, GATE);
      return route.fallback();
    });
    const page = await ctx.newPage();
    await page.goto(base + path);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1600);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${dir}/${String(i + 1).padStart(2, "0")}-${name}.png` });
    await ctx.close();
  }
  console.log(`${vpName}: ${SCREENS.length} screens in ${dir}`);
}
await browser.close();
