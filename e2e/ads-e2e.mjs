// Ads end to end (TAKATAK ads -> Google AdSense -> house banner; ad-free for
// paying members), on a mocked backend: TAKATAK's serve/events/click endpoints
// and adsbygoogle.js are stubs inside this script, nothing leaves the browser.
//
// Two builds, one run each (both on vite preview):
//   configured (TAKATAK on a test host + AdSense with the 5 slot ids):
//     NODE_OPTIONS="--import=./e2e/no-network.mjs" VITE_TAKATAK_ADS_URL=https://ads.takatak.test \
//       VITE_ADSENSE_CLIENT=ca-pub-1234567890123456 VITE_ADSENSE_SLOT_DISCOVER=1111111111 \
//       VITE_ADSENSE_SLOT_LIST=2222222222 VITE_ADSENSE_SLOT_FEED=3333333333 \
//       VITE_ADSENSE_SLOT_PROFILE=4444444444 VITE_ADSENSE_SLOT_CONTENT=5555555555 \
//       VITE_GOOGLE_SITE_VERIFICATION=isexyTestToken_0123456789-abcdefXYZ \
//       npx vite build --outDir /tmp/isexy-dist-ads
//     npx vite preview --outDir /tmp/isexy-dist-ads --port 4410 --strictPort --host 127.0.0.1 &
//     E2E_ADS_MODE=configured E2E_BASE=http://127.0.0.1:4410 node --experimental-strip-types --no-warnings \
//       --import ./e2e/offline-browser.mjs e2e/ads-e2e.mjs
//   plain (nothing set: the usual `npm run build`, then the same preview of dist/):
//     E2E_ADS_MODE=plain E2E_BASE=http://127.0.0.1:4410 node --experimental-strip-types --no-warnings \
//       --import ./e2e/offline-browser.mjs e2e/ads-e2e.mjs
// (E2E_SHOTS: screenshot folder, default a temp folder.) Prints PASS/FAIL, exits 1 on a failure.
import { mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "/opt/node22/lib/node_modules/playwright/index.mjs");

const MODE = process.env.E2E_ADS_MODE === "plain" ? "plain" : "configured";
const base = process.env.E2E_BASE ?? "http://127.0.0.1:4410";
const out = process.env.E2E_SHOTS ?? `${tmpdir()}/isexy-ads-shots`;
mkdirSync(out, { recursive: true });
const PNG = readFileSync(new URL("../public/apple-touch-icon.png", import.meta.url));
const APP = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "PASS" : "FAIL"} [${MODE}] ${name}${extra ? ` — ${extra}` : ""}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ADS_HOST = MODE === "configured" ? "https://ads.takatak.test" : "https://takatak.ca";
const CLIENT = "ca-pub-1234567890123456";
const SITE_VERIFICATION = "isexyTestToken_0123456789-abcdefXYZ"; // Search Console token of the configured build
const SLOT_IDS = {
  "isexy-discover-banner": "1111111111", "isexy-list-banner": "2222222222", "isexy-feed-inline": "3333333333",
  "isexy-profile-banner": "4444444444", "isexy-content-inline": "5555555555",
};
const ME = "adadadad-0000-4000-8000-00000000000a";
const CHAT_MATCH = "bbbbbbbb-0000-4000-8000-000000000001";
const FRIEND = "cccccccc-0000-4000-8000-000000000001";

// ---------------------------------------------------------------------------
// 0. Logic of src/lib/ads.ts, in Node (no browser)
// ---------------------------------------------------------------------------
const ads = await import("../src/lib/ads.ts");
{
  const sample = (p) => p.replace(/:[a-zA-Z]+\??/g, "abc").replace(/\/$/, "") || "/";
  const routes = [...new Set([...APP.matchAll(/<Route path="([^"]+)"/g)].map((m) => sample(m[1])))].filter((p) => p !== "*");
  routes.push("/nope-404-page");
  const expected = {
    "isexy-discover-banner": ["/discover"],
    "isexy-list-banner": ["/matches", "/matches-list", "/likes", "/who-liked-you"],
    "isexy-feed-inline": ["/explore", "/news", "/community-stories"],
    "isexy-profile-banner": ["/profile", "/settings"],
    "isexy-content-inline": ["/faq", "/safety-tips", "/help-support", "/about", "/knowledge-base", "/knowledge-base/abc"],
  };
  for (const [placement, want] of Object.entries(expected)) {
    const got = routes.filter((r) => ads.placementAllowedOn(placement, r));
    check(`L1 ${placement} only on ${want.join(" ")}`, JSON.stringify([...got].sort()) === JSON.stringify([...want].sort()), got.join(" "));
  }
  const never = ["/chat/abc", "/group-chat/abc", "/video-call/abc", "/phone-line", "/phone-line/call/abc", "/premium", "/compare-plans",
    "/get-super-likes", "/get-boosts", "/buy-credits", "/buy-minutes", "/my-subscription", "/restore-purchase", "/redeem-code",
    "/auth", "/onboarding", "/profile-setup", "/tourist-signup", "/admin", "/admin/tickets", "/agent-dashboard", "/staff-login",
    "/privacy", "/terms", "/cookie-policy", "/consumer-health-privacy", "/licenses", "/regulations", "/community-guidelines"];
  const leaks = never.filter((r) => !ads.isAdFreeRoute(r) || Object.keys(expected).some((p) => ads.placementAllowedOn(p, r)));
  check("L2 never on chat, calls, checkout/purchase, sign-in/onboarding/setup, staff, legal pages", leaks.length === 0, leaks.join(" "));
  check("L2b no placement on an unknown (404) path", !Object.keys(expected).some((p) => ads.placementAllowedOn(p, "/nope-404-page")));

  check("L3 lists: banner after the 3rd row, at the top when shorter",
    ads.listAdAfterIndex(0) === -1 && ads.listAdAfterIndex(2) === -1 && ads.listAdAfterIndex(3) === 2 && ads.listAdAfterIndex(40) === 2
      && ads.listAdAfterIndex(5, 2) === -1 && ads.listAdAfterIndex(6, 2) === 5);
  const feedIdx = (n) => Array.from({ length: n }, (_, i) => i).filter((i) => ads.feedAdAfter(i, n)).join(",");
  check("L4 feeds: one card every 6 items, one at the end of a shorter feed",
    feedIdx(22) === "5,11,17" && feedIdx(6) === "5" && feedIdx(5) === "4" && feedIdx(1) === "0" && feedIdx(0) === "", `22→${feedIdx(22)} 5→${feedIdx(5)}`);

  const served = (ad, extra = {}) => ({ ok: true, filled: true, ad: { campaignId: "c1", creativeId: "k1", placementId: "p1", headline: "Café Verdun",
    body: "Two for one", callToAction: "Visit", destinationUrl: "https://shop.test/offer?ttclid=a1", clickUrl: "https://ads.takatak.test/api/ads/click?t=tok",
    imageUrl: "https://ads.takatak.test/img.png", label: "Advertisement", trackingToken: "tok", attributionId: "a1", trackingEnabled: true, ...ad }, ...extra });
  const ok = ads.parseServedAd(served({}));
  check("L5 a served ad is kept with TAKATAK's click redirect", ok?.href === "https://ads.takatak.test/api/ads/click?t=tok" && ok.clickTracked && ok.trackingEnabled, JSON.stringify(ok));
  check("L5b no fill / not ok / malformed = no ad",
    ads.parseServedAd({ ok: true, filled: false, ad: null }) === null && ads.parseServedAd({ ok: false }) === null
      && ads.parseServedAd(null) === null && ads.parseServedAd("x") === null && ads.parseServedAd(served({ headline: "" })) === null);
  check("L5c a javascript: destination is refused", ads.parseServedAd(served({ destinationUrl: "javascript:alert(1)", clickUrl: null })) === null);
  const noClick = ads.parseServedAd(served({ clickUrl: "javascript:alert(1)", imageUrl: "http://plain.test/i.png" }));
  check("L5d a bad click URL falls back to the destination, a non-https image is dropped",
    noClick?.href === "https://shop.test/offer?ttclid=a1" && !noClick.clickTracked && noClick.imageUrl === null);
  const long = ads.parseServedAd(served({ headline: "x".repeat(300), body: "y".repeat(500), callToAction: "z".repeat(80), label: "Publicité" }));
  check("L5e long texts trimmed, French label kept", long.headline.length === 90 && long.body.length === 140 && long.callToAction.length === 24 && long.label === "Publicité");
  check("L5f tracking off without a token", ads.parseServedAd(served({ trackingToken: null, trackingEnabled: true }))?.trackingEnabled === false);

  check("L6 TAKATAK base URL: https only (http for localhost), no credentials",
    ads.cleanBaseUrl("https://takatak.ca/") === "https://takatak.ca" && ads.cleanBaseUrl("http://takatak.ca") === null
      && ads.cleanBaseUrl("javascript:alert(1)") === null && ads.cleanBaseUrl("https://u:p@takatak.ca") === null
      && ads.cleanBaseUrl("http://127.0.0.1:9999") === "http://127.0.0.1:9999" && ads.cleanBaseUrl("") === null);
  check("L7 AdSense client must be ca-pub-<digits>",
    ads.cleanAdSenseClient(CLIENT) === CLIENT && ads.cleanAdSenseClient("pub-1234567890123456") === null
      && ads.cleanAdSenseClient("ca-pub-12") === null && ads.cleanAdSenseClient('ca-pub-1234567890123456" onload="x') === null);
  const ctxOff = ads.buildAdsContext({ language: "fr", personalized: false, city: "Montréal", country: "Canada" });
  const ctxOn = ads.buildAdsContext({ language: "fr", personalized: true, city: "Montréal", country: "Canada" });
  check("L8 targeting context: city/country only with the Advertising consent, nothing personal",
    !("city" in ctxOff) && !("country" in ctxOff) && ctxOff.locale === "fr" && ctxOn.city === "Montréal" && ctxOn.country === "Canada"
      && Object.keys(ctxOn).every((k) => ["country", "region", "city", "postalPrefix", "category", "locale", "device"].includes(k)));
  check("L9 30 days, same number as 0016_ads.sql",
    ads.AD_FREE_DAYS_AFTER_PAYMENT === 30 && /c_ad_free_after_payment CONSTANT interval := interval '30 days'/.test(
      readFileSync(new URL("../supabase/isexy-migrations/0016_ads.sql", import.meta.url), "utf8")));
}

// ---------------------------------------------------------------------------
// Browser sessions
// ---------------------------------------------------------------------------
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" });

const feedProfiles = ["Bea", "Carla", "Dania"].map((n, i) => ({
  id: `00000000-0000-4000-8000-00000000010${i}`, first_name: n, birth_date: `199${i}-05-01`, bio: `Hi, I'm ${n}`, city: "Montréal",
  job_title: null, company: null, school: null, is_verified: false, interests: ["Hiking"], distance_km: 3 + i, photos: [`https://img.test/${n}.png`],
}));
const conversation = (i) => ({
  match_id: `bbbbbbbb-0000-4000-8000-00000000000${i}`, matched_at: new Date(Date.now() - i * 3600e3).toISOString(),
  other_id: `cccccccc-0000-4000-8000-00000000000${i}`, first_name: `Friend${i}`, photo_url: null, is_verified: false,
  last_active_at: null, last_message_at: new Date(Date.now() - i * 60e3).toISOString(), last_message_preview: `Hello ${i}`,
  last_message_mine: false, unread_count: 0, is_unlocked: true,
});

const ADSENSE_STUB = `(function () {
  var q = window.adsbygoogle = window.adsbygoogle || [];
  window.__adsense = window.__adsense || [];
  window.__adsenseScripts = (window.__adsenseScripts || 0) + 1;
  function fill() {
    var ins = document.querySelector('ins.adsbygoogle:not([data-adsbygoogle-status])');
    if (!ins) return;
    ins.setAttribute('data-adsbygoogle-status', 'done');
    window.__adsense.push({ client: ins.getAttribute('data-ad-client'), slot: ins.getAttribute('data-ad-slot'), npa: q.requestNonPersonalizedAds });
    if (window.__adsenseUnfilled) { ins.setAttribute('data-ad-status', 'unfilled'); return; }
    ins.setAttribute('data-ad-status', 'filled');
    ins.innerHTML = '<div class="stub-google-ad" style="width:100%;height:100%;background:#1f8bff">Google ad</div>';
  }
  var queued = q.splice(0, q.length);
  q.push = function () { setTimeout(fill, 30); return 0; };
  queued.forEach(function () { setTimeout(fill, 30); });
})();`;

/**
 * One visitor. adStatus: get_my_ad_status answer (object), or a number = HTTP error.
 * serve(placement, body) -> response object | number (HTTP status) | "abort".
 */
async function session({
  signedIn = true, adStatus = { ad_free: false, reason: "free", until: null }, adStatusDelay = 0, advertising = false,
  language = "en", conversations = 0, serve = null, serveDelay = 0, adsenseUnfilled = false, adsenseBlocked = false,
  viewport = { width: 390, height: 844 },
} = {}) {
  const s = { serves: [], events: [], clicks: [], rpcs: [], hosts: new Set(), adsenseScriptRequests: [], requests: [] };
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript(([ME, signedIn, advertising, unfilled]) => {
    if (signedIn && !sessionStorage.getItem("__seeded")) {
      localStorage.setItem("sb-pcjfahhlozsseqqevimi-auth-token", JSON.stringify({
        access_token: "h.eyJzdWIiOiIxIn0.s", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r",
        user: { id: ME, aud: "authenticated", role: "authenticated", email: "ads@isexy.test", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" },
      }));
      sessionStorage.setItem("__seeded", "1");
    }
    const consent = { analytics: false, marketing: false, decidedAt: "2026-10-07T00:00:00Z", version: 1 };
    if (advertising) consent.advertising = true;
    localStorage.setItem("isexy_consent", JSON.stringify(consent));
    localStorage.setItem("cubadate_safety_seen", "true");
    localStorage.setItem("push_notification_prompt_shown", "true");
    sessionStorage.setItem("isexy_assistant_teaser_seen", "1");
    if (unfilled) window.__adsenseUnfilled = true;
    // When each TAKATAK ad appeared (browser clock), for the impression timing check.
    window.__adShown = {};
    new MutationObserver(() => {
      document.querySelectorAll('aside[data-ad-source="takatak"]').forEach((el) => {
        const k = el.getAttribute("data-ad-placement");
        if (!window.__adShown[k]) window.__adShown[k] = Date.now();
      });
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-ad-source"] });
  }, [ME, signedIn, advertising, adsenseUnfilled]);

  ctx.on("request", (req) => {
    const u = new URL(req.url());
    s.hosts.add(u.host);
    s.requests.push(req.url());
  });
  const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };
  await ctx.route(/^https:\/\/(img\.test|images\.unsplash\.com)\//, (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));

  // TAKATAK ad server (configured: ads.takatak.test; plain: the default takatak.ca, never reached).
  await ctx.route(`${ADS_HOST}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (MODE === "plain") {
      s.serves.push({ placement: null, body: JSON.parse(req.postData() || "null"), origin: req.headers()["origin"], method: req.method() });
      return route.abort("connectionrefused");
    }
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (url.pathname === "/img.png") return route.fulfill({ status: 200, contentType: "image/png", body: PNG });
    if (url.pathname === "/api/ads/click") {
      s.clicks.push(url.searchParams.get("t"));
      return route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>Advertiser</title><h1>Advertiser page</h1>" });
    }
    const body = JSON.parse(req.postData() || "null");
    if (url.pathname === "/api/ads/events") {
      s.events.push({ ...body, at: Date.now() });
      return route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ ok: true, recorded: true, duplicate: false }) });
    }
    if (url.pathname === "/api/ads/serve") {
      s.serves.push({ placement: body?.placementCode, body, origin: req.headers()["origin"], at: Date.now() });
      if (serveDelay) await sleep(serveDelay);
      const answer = serve ? serve(body?.placementCode, body) : defaultServe(body?.placementCode);
      if (answer === "abort") return route.abort("connectionrefused");
      if (typeof answer === "number") return route.fulfill({ status: answer, headers: cors, contentType: "application/json", body: JSON.stringify({ ok: false }) });
      return route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(answer) });
    }
    return route.fulfill({ status: 404, headers: cors });
  });

  // Google AdSense script (stub) and anything else Google.
  await ctx.route(/^https:\/\/([a-z0-9-]+\.)*(googlesyndication|doubleclick|google|googleadservices|gstatic)\.[a-z.]+\//, (route) => {
    const u = route.request().url();
    if (u.includes("/pagead/js/adsbygoogle.js")) {
      s.adsenseScriptRequests.push(u);
      if (adsenseBlocked) return route.abort("blockedbyclient");
      return route.fulfill({ status: 200, contentType: "application/javascript", body: ADSENSE_STUB });
    }
    return route.abort("blockedbyclient");
  });

  // Supabase (TAKATAK V1), mocked.
  await ctx.route("**/*.supabase.co/**", async (route) => {
    const req = route.request();
    const m = req.method();
    const path = decodeURIComponent(req.url()).split(".supabase.co")[1];
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
    if (m === "OPTIONS") return route.fulfill({ status: 200, headers: cors });
    let body = null; try { body = JSON.parse(req.postData() || "null"); } catch { /* not json */ }
    if (path.startsWith("/rest/v1/rpc/")) s.rpcs.push(path.slice("/rest/v1/rpc/".length).split("?")[0]);
    if (path.startsWith("/auth/v1/user")) return json({ id: ME, aud: "authenticated", role: "authenticated", email: "ads@isexy.test" });
    if (path.startsWith("/auth/v1/")) return json({});
    if (path.includes("/rpc/get_my_ad_status")) {
      if (adStatusDelay) await sleep(adStatusDelay);
      return typeof adStatus === "number" ? json({ message: "boom" }, adStatus) : json(adStatus);
    }
    // One chat with a friend, so /chat/<id> really opens (and must show no ad).
    if (path.includes("/rest/v1/matches") && path.includes(`id=eq.${CHAT_MATCH}`)) return json({ profile1_id: ME, profile2_id: FRIEND, is_active: true });
    if (path.includes("/rest/v1/profiles") && path.includes(`id=eq.${FRIEND}`)) return json({ id: FRIEND, first_name: "Friend1" });
    if (path.includes("/rest/v1/conversation_unlocks")) return json([{ id: "unlock-1" }]);
    if (path.includes("/rest/v1/profiles") && path.includes("user_id=eq")) return json({
      id: ME, user_id: ME, first_name: "Alex", birth_date: "1995-01-01", gender: "man", interested_in: ["everyone"], bio: "Montréal",
      likes_remaining: 42, is_premium: false, subscription_tier: "free", country: "Canada", city: "Montréal", is_active: true,
      age_min: 18, age_max: 50, distance_preference: 80, interests: ["Hiking"], prompts: [],
    });
    if (path.includes("/rest/v1/profile_photos") && m === "HEAD") return route.fulfill({ status: 200, headers: { ...cors, "content-range": "0-0/3" } });
    if (path.includes("/rest/v1/user_preferences")) return json({ preferred_language: language, auto_translate: false, settings: {} });
    if (path.includes("/rpc/get_discover_feed")) return json(feedProfiles);
    if (path.includes("/rpc/check_swipe_rate_limit")) return json({ allowed: true, remaining: 50 });
    if (path.includes("/rpc/get_my_conversations")) return json(Array.from({ length: conversations }, (_, i) => conversation(i + 1)));
    if (path.includes("/rpc/get_likes_received")) return json([]);
    if (path.includes("/rpc/get_my_badge_counts")) return json({ unread_messages: 0, pending_likes: 0 });
    if (path.includes("/rest/v1/knowledge_base")) return json([
      { id: "a1", title: "Verify your profile", content: "Open Settings, then Verify.", category: "Account", is_published: true, view_count: 3, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
    ]);
    if (path.includes("/functions/v1/")) return json({});
    if (path.includes("/rest/v1/")) return json(m === "GET" ? [] : null);
    return json({});
  });

  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { ctx, page, s, errors };
}

function defaultServe(placement) {
  const token = `tok-${placement}`;
  return {
    ok: true, filled: true, ad: {
      campaignId: `camp-${placement}`, creativeId: "creative-1", placementId: `pl-${placement}`,
      headline: "Café Verdun: 2 for 1 lattes", body: "Local coffee on Wellington, open until 9 pm.", callToAction: "Visit",
      destinationUrl: "https://advertiser.test/offer?ttclid=att-1", clickUrl: `${ADS_HOST}/api/ads/click?t=${encodeURIComponent(token)}`,
      imageUrl: `${ADS_HOST}/img.png`, label: "Advertisement", trackingToken: token, attributionId: "att-1", trackingEnabled: true,
    },
  };
}
const unfilled = () => ({ ok: true, filled: false, ad: null });

const slots = (page) => page.locator("aside[data-ad-placement]");
async function visit(page, path, wait = 900) {
  await page.goto(base + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(wait);
}
async function slotInfo(page) {
  return page.$$eval("aside[data-ad-placement]", (els) => els.map((el) => ({
    placement: el.getAttribute("data-ad-placement"), source: el.getAttribute("data-ad-source"),
    label: el.getAttribute("aria-label"), height: Math.round(el.getBoundingClientRect().height),
  })));
}
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

const PLACEMENT_PAGES = [
  ["/discover", "isexy-discover-banner", 1], ["/matches", "isexy-list-banner", 1], ["/matches-list", "isexy-list-banner", 1],
  ["/likes", "isexy-list-banner", 1], ["/who-liked-you", "isexy-list-banner", 1], ["/explore", "isexy-feed-inline", 3],
  ["/news", "isexy-feed-inline", 1], ["/community-stories", "isexy-feed-inline", 1], ["/profile", "isexy-profile-banner", 1],
  ["/settings", "isexy-profile-banner", 1], ["/faq", "isexy-content-inline", 1], ["/safety-tips", "isexy-content-inline", 1],
  ["/help-support", "isexy-content-inline", 1], ["/knowledge-base", "isexy-content-inline", 1], ["/about", "isexy-content-inline", 1],
];

if (MODE === "configured") {
  // ---- A. Free member on Discover: TAKATAK banner, placement, impression, click
  {
    const { page, s, ctx, errors } = await session({ serveDelay: 500 });
    await page.goto(base + "/discover", { waitUntil: "domcontentloaded" });
    const slot = page.locator('aside[data-ad-placement="isexy-discover-banner"]');
    await slot.waitFor({ state: "attached", timeout: 8000 });
    const skeletonHeight = Math.round((await slot.boundingBox())?.height ?? 0);
    const skeletonSource = await slot.getAttribute("data-ad-source");
    await page.locator('aside[data-ad-source="takatak"]').waitFor({ timeout: 8000 });
    const shownAt = await page.evaluate(() => window.__adShown["isexy-discover-banner"]);
    const filledHeight = Math.round((await slot.boundingBox())?.height ?? 0);
    check("A1 Discover: the slot reserves its height before the ad arrives (no layout shift)",
      skeletonSource === "loading" && skeletonHeight === 72 && filledHeight === 72, `${skeletonSource} ${skeletonHeight}px → ${filledHeight}px`);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${out}/A1_discover_takatak.png` });

    const link = slot.locator("a");
    const label = await slot.getAttribute("aria-label");
    const [href, rel, target, text] = [await link.getAttribute("href"), await link.getAttribute("rel"), await link.getAttribute("target"), await slot.innerText()];
    check("A2 TAKATAK banner: labelled 'Advertisement', headline, CTA, sponsored link through TAKATAK's click URL",
      label === "Advertisement" && /ADVERTISEMENT/i.test(text) && text.includes("Café Verdun") && text.includes("Visit")
        && href === `${ADS_HOST}/api/ads/click?t=tok-isexy-discover-banner` && target === "_blank"
        && ["sponsored", "noopener", "noreferrer"].every((r) => (rel ?? "").split(" ").includes(r)), `${label} ${href} rel=${rel}`);

    const sv = s.serves[0];
    check("A3 one serve request: publisher isexy, placement code, contextual context only (no consent: no city)",
      s.serves.length === 1 && sv.body.publisherCode === "isexy" && sv.placement === "isexy-discover-banner"
        && sv.body.context.locale === "en" && sv.body.context.device === "mobile" && sv.body.context.category === "social"
        && !("city" in sv.body.context) && !("country" in sv.body.context) && sv.origin === base, JSON.stringify(sv?.body));

    // Placement: between the swipe card / action buttons and the bottom nav, inside the screen.
    const nav = await page.locator("nav").last().boundingBox();
    const like = await page.getByRole("button", { name: "Like", exact: true }).boundingBox();
    const card = await page.locator('[style*="z-index: 1"]').first().boundingBox();
    const box = await slot.boundingBox();
    check("A4 banner sits above the bottom nav and below the card and action buttons, never over them",
      !!(nav && like && card && box) && box.y + box.height <= nav.y + 0.5 && box.y >= like.y + like.height - 0.5
        && box.y >= card.y + card.height - 0.5 && box.y >= 0 && box.y + box.height <= 844,
      `card ${Math.round(card?.y + card?.height)} like ${Math.round(like?.y + like?.height)} ad ${Math.round(box?.y)}-${Math.round(box?.y + box?.height)} nav ${Math.round(nav?.y)}`);

    await page.waitForTimeout(1800);
    const imp = s.events.filter((e) => e.eventType === "impression");
    check("A5 one impression event after 1 s at least half visible, with TAKATAK's token",
      imp.length === 1 && imp[0].trackingToken === "tok-isexy-discover-banner" && imp[0].at - shownAt >= 950 && imp[0].context?.locale === "en",
      `${imp.length} after ${imp[0] ? imp[0].at - shownAt : "-"} ms`);
    await page.waitForTimeout(1500);
    check("A5b still one impression later (sent once per mount)", s.events.filter((e) => e.eventType === "impression").length === 1);

    const [popup] = await Promise.all([ctx.waitForEvent("page"), link.click()]);
    await popup.waitForLoadState("domcontentloaded").catch(() => undefined);
    await sleep(300);
    check("A6 tap opens the ad in a new tab through TAKATAK's click redirect (records the click)",
      popup.url() === `${ADS_HOST}/api/ads/click?t=tok-isexy-discover-banner` && s.clicks.length === 1 && s.clicks[0] === "tok-isexy-discover-banner",
      `${popup.url()} clicks=${s.clicks.length}`);
    await popup.close();
    check("A7 no page errors on Discover", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  // ---- B. Every placement for a free member, lists and feeds positions
  {
    const { page, s, ctx, errors } = await session({ conversations: 5 });
    const seen = [];
    for (const [path, placement, count] of PLACEMENT_PAGES) {
      await visit(page, path, 1300);
      const info = await slotInfo(page);
      const ok = info.length === count && info.every((i) => i.placement === placement && i.source === "takatak");
      seen.push(`${path}:${info.length}`);
      check(`B1 ${path}: ${count} × ${placement} from TAKATAK`, ok, JSON.stringify(info));
      check(`B1b ${path}: no horizontal scroll at 390 px`, await noHScroll(page));
      await page.screenshot({ path: `${out}/B1${path.replace(/\//g, "_")}.png`, fullPage: true });
    }
    // Messages inbox: banner right after the 3rd conversation.
    await visit(page, "/matches", 1200);
    const order = await page.$$eval("section[aria-label='Messages'] .space-y-2 > *", (els) => els.map((el) => el.tagName === "ASIDE" ? "AD" : (el.textContent || "").match(/Friend\d/)?.[0] ?? "?"));
    check("B2 Messages: banner after the 3rd chat", order.join(",") === "Friend1,Friend2,Friend3,AD,Friend4,Friend5", order.join(","));
    // Explore: inline cards after the 6th, 12th and 18th category.
    await visit(page, "/explore", 1200);
    const exploreOrder = await page.$$eval("[role=tabpanel] .grid > *", (els) => els.map((el) => (el.tagName === "ASIDE" ? "AD" : "c")).join(""));
    const positions = [...exploreOrder.matchAll(/AD/g)].map((m) => exploreOrder.slice(0, m.index).replace(/AD/g, "").length);
    check("B3 Explore: one inline card every 6 categories", JSON.stringify(positions) === "[6,12,18]", exploreOrder);
    const placementsServed = new Set(s.serves.map((x) => x.placement));
    check("B4 each placement code requested", ["isexy-discover-banner", "isexy-list-banner", "isexy-feed-inline", "isexy-profile-banner", "isexy-content-inline"].every((p) => placementsServed.has(p)), [...placementsServed].join(" "));
    check("B5 no page errors on placement pages", errors.length === 0, errors.slice(0, 3).join(" | "));
    await ctx.close();
  }
  {
    // A short inbox (1 chat): banner at the top.
    const { page, ctx } = await session({ conversations: 1 });
    await visit(page, "/matches", 1200);
    const firstIsAd = await page.evaluate(() => {
      const ad = document.querySelector("aside[data-ad-placement='isexy-list-banner']");
      const chat = [...document.querySelectorAll("button")].find((b) => /Friend1/.test(b.textContent || ""));
      return !!ad && !!chat && !!(ad.compareDocumentPosition(chat) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    check("B6 Messages with 1 chat: banner at the top", firstIsAd);
    await ctx.close();
  }

  // ---- C. Signed-out visitors: ads only on public content pages
  {
    const { page, s, ctx } = await session({ signedIn: false });
    for (const path of ["/faq", "/safety-tips", "/help-support", "/knowledge-base", "/about", "/news", "/community-stories"]) {
      await visit(page, path, 1200);
      const info = await slotInfo(page);
      check(`C1 visitor on ${path}: ad shown`, info.length >= 1 && info.every((i) => i.source === "takatak"), JSON.stringify(info));
    }
    await visit(page, "/", 1200);
    check("C2 visitor on the home page: no ad", (await slotInfo(page)).length === 0);
    check("C3 visitors never ask for an ad status", !s.rpcs.includes("get_my_ad_status"), s.rpcs.join(","));
    await ctx.close();
  }

  // ---- D. AdSense fallback, consent, unfilled, blocked, errors
  {
    const { page, s, ctx } = await session({ serve: () => unfilled() });
    await visit(page, "/faq", 1500);
    const info = await slotInfo(page);
    const ins = page.locator("aside[data-ad-placement] ins.adsbygoogle");
    const insAttrs = await ins.evaluate((el) => ({ client: el.getAttribute("data-ad-client"), slot: el.getAttribute("data-ad-slot"), status: el.getAttribute("data-ad-status"), h: Math.round(el.getBoundingClientRect().height) })).catch(() => null);
    const g = await page.evaluate(() => window.__adsense ?? []);
    check("D1 TAKATAK has no ad → AdSense unit with the content slot id, labelled 'Advertisements'",
      info.length === 1 && info[0].source === "adsense" && info[0].label === "Advertisements" && info[0].height === 300
        && insAttrs?.client === CLIENT && insAttrs?.slot === SLOT_IDS["isexy-content-inline"] && insAttrs?.status === "filled",
      `${JSON.stringify(info)} ${JSON.stringify(insAttrs)}`);
    check("D2 adsbygoogle.js loaded once with the client id", s.adsenseScriptRequests.length === 1 && s.adsenseScriptRequests[0].endsWith(`/pagead/js/adsbygoogle.js?client=${CLIENT}`), s.adsenseScriptRequests.join(" "));
    check("D3 without the Advertising consent every AdSense request is non-personalized (requestNonPersonalizedAds = 1)", g.length === 1 && g[0].npa === 1, JSON.stringify(g));
    await page.screenshot({ path: `${out}/D1_faq_adsense.png`, fullPage: true });
    await visit(page, "/explore", 1500);
    const g2 = await page.evaluate(() => ({ list: window.__adsense ?? [], scripts: window.__adsenseScripts ?? 0, tags: document.querySelectorAll("script[src*='adsbygoogle.js']").length }));
    check("D4 several AdSense units, one script", g2.list.length === 3 && g2.tags === 1 && g2.list.every((x) => x.slot === SLOT_IDS["isexy-feed-inline"] && x.npa === 1), JSON.stringify(g2));
    await ctx.close();
  }
  {
    const { page, s, ctx } = await session({ serve: () => unfilled(), advertising: true });
    await visit(page, "/profile", 1500);
    const g = await page.evaluate(() => window.__adsense ?? []);
    const sv = s.serves[0]?.body?.context ?? {};
    check("D5 with the Advertising consent: personalized AdSense (requestNonPersonalizedAds = 0) and the profile city in TAKATAK's context",
      g.length === 1 && g[0].npa === 0 && g[0].slot === SLOT_IDS["isexy-profile-banner"] && sv.city === "Montréal" && sv.country === "Canada",
      `${JSON.stringify(g)} ${JSON.stringify(sv)}`);
    // Withdrawing consent applies to the next requests.
    await page.evaluate(() => {
      localStorage.setItem("isexy_consent", JSON.stringify({ analytics: false, marketing: false, advertising: false, decidedAt: new Date().toISOString(), version: 1 }));
      window.dispatchEvent(new CustomEvent("isexy:consent-changed", { detail: { analytics: false, marketing: false, advertising: false, decidedAt: new Date().toISOString(), version: 1 } }));
    });
    const npaNow = await page.evaluate(() => window.adsbygoogle?.requestNonPersonalizedAds);
    check("D6 turning Advertising off switches the next AdSense requests to non-personalized", npaNow === 1, String(npaNow));
    await ctx.close();
  }
  {
    const { page, ctx } = await session({ serve: () => unfilled(), adsenseUnfilled: true });
    await visit(page, "/settings", 1800);
    const info = await slotInfo(page);
    const house = page.locator("aside[data-ad-placement] a[data-house-ad]");
    check("D7 AdSense unfilled → house banner 'Go ad-free with ISEXY Plus' linking /premium",
      info.length === 1 && info[0].source === "house" && (await house.getAttribute("href")) === "/premium"
        && (await house.innerText()).includes("Go ad-free with ISEXY Plus"), JSON.stringify(info));
    await page.screenshot({ path: `${out}/D7_settings_house.png`, fullPage: true });
    await ctx.close();
  }
  {
    const { page, ctx, errors } = await session({ serve: () => 500, adsenseBlocked: true });
    await visit(page, "/discover", 1500);
    const info = await slotInfo(page);
    check("D8 TAKATAK error + AdSense blocked → house banner, no page error", info.length === 1 && info[0].source === "house" && errors.length === 0, `${JSON.stringify(info)} ${errors.join("|")}`);
    await page.screenshot({ path: `${out}/D8_discover_house.png` });
    await ctx.close();
  }
  {
    const { page, ctx, errors } = await session({ serve: () => "abort" });
    await visit(page, "/news", 1500);
    const info = await slotInfo(page);
    check("D9 TAKATAK unreachable → AdSense", info.length === 1 && info[0].source === "adsense", JSON.stringify(info));
    await ctx.close();
  }
  {
    // Hostile creative: text stays text, a javascript: link is refused.
    const { page, ctx } = await session({
      serve: (placement) => placement === "isexy-content-inline"
        ? { ...defaultServe(placement), ad: { ...defaultServe(placement).ad, headline: '<img src=x onerror="window.__xss=1">Hi', body: "<b>bold</b>" } }
        : { ...defaultServe(placement), ad: { ...defaultServe(placement).ad, destinationUrl: "javascript:alert(1)", clickUrl: null } },
    });
    await visit(page, "/faq", 1500);
    const injected = await page.evaluate(() => ({ xss: window.__xss === 1, img: document.querySelectorAll("aside[data-ad-placement] img[src='x']").length, text: document.querySelector("aside[data-ad-placement]")?.textContent ?? "" }));
    check("D10 ad text is rendered as text (no HTML from the ad server)", !injected.xss && injected.img === 0 && injected.text.includes("<img src=x"), JSON.stringify(injected).slice(0, 160));
    await visit(page, "/profile", 1500);
    const info = await slotInfo(page);
    check("D11 a javascript: ad is refused (falls back to AdSense)", info.length === 1 && info[0].source === "adsense", JSON.stringify(info));
    await ctx.close();
  }

  // ---- E. Paying members and staff: never an ad, not even a flash
  for (const reason of ["plan", "recent_payment", "chat_subscription", "staff"]) {
    const { page, s, ctx } = await session({ adStatus: { ad_free: true, reason, until: null }, conversations: 5 });
    let total = 0;
    for (const [path] of PLACEMENT_PAGES) {
      await visit(page, path, 700);
      total += (await slotInfo(page)).length;
    }
    check(`E1 ad-free member (${reason}): no slot on any of the ${PLACEMENT_PAGES.length} ad pages, no ad request`,
      total === 0 && s.serves.length === 0 && s.adsenseScriptRequests.length === 0, `slots=${total} serves=${s.serves.length} adsense=${s.adsenseScriptRequests.length}`);
    await ctx.close();
  }
  {
    const { page, s, ctx } = await session({ adStatus: { ad_free: true, reason: "plan", until: null }, adStatusDelay: 1500 });
    await page.goto(base + "/discover", { waitUntil: "domcontentloaded" });
    let flashes = 0;
    for (let i = 0; i < 30; i++) { flashes += await slots(page).count(); await sleep(100); }
    check("E2 while the status loads (1.5 s) a paying member sees no ad slot at all", flashes === 0 && s.serves.length === 0, `flashes=${flashes}`);
    await ctx.close();
  }
  {
    const { page, s, ctx } = await session({ adStatus: 500 });
    await visit(page, "/discover", 1500);
    await visit(page, "/profile", 900);
    check("E3 status unavailable (error / not deployed) → no ads (fail closed)", (await slotInfo(page)).length === 0 && s.serves.length === 0);
    await ctx.close();
  }
  {
    const { page, s, ctx } = await session({ adStatus: { foo: 1 } });
    await visit(page, "/profile", 1200);
    check("E4 unexpected status shape → no ads", (await slotInfo(page)).length === 0 && s.serves.length === 0);
    await ctx.close();
  }

  // ---- F. Pages that never carry ads (free member)
  {
    const { page, s, ctx } = await session({ conversations: 5 });
    const never = ["/chat/bbbbbbbb-0000-4000-8000-000000000001", "/video-call/bbbbbbbb-0000-4000-8000-000000000001", "/phone-line",
      "/premium", "/compare-plans", "/get-super-likes", "/get-boosts", "/buy-credits", "/buy-minutes", "/my-subscription",
      "/restore-purchase", "/onboarding", "/profile-setup", "/admin", "/privacy", "/terms", "/cookie-policy",
      "/community-guidelines", "/licenses", "/regulations", "/consumer-health-privacy", "/this-page-does-not-exist"];
    const leaks = [], redirected = [];
    for (const path of never) {
      const before = s.serves.length;
      await visit(page, path, 900);
      // Some pages send this member elsewhere (setup done → Discover, not staff → Discover, call ended → chat):
      // the ad on the page they land on is expected there.
      if (new URL(page.url()).pathname !== path) { redirected.push(`${path}→${new URL(page.url()).pathname}`); continue; }
      const n = await slots(page).count();
      if (n > 0 || s.serves.length !== before) leaks.push(`${path}(${n},${s.serves.length - before})`);
    }
    const mustRender = ["/chat/bbbbbbbb-0000-4000-8000-000000000001", "/premium", "/compare-plans", "/get-super-likes", "/get-boosts",
      "/buy-credits", "/buy-minutes", "/privacy", "/terms", "/cookie-policy", "/this-page-does-not-exist"];
    check("F1 no ad on chat, calls, checkout/purchase, onboarding/setup, staff, legal and 404 pages", leaks.length === 0
      && mustRender.every((p) => !redirected.some((r) => r.startsWith(`${p}→`))), `leaks: ${leaks.join(" ")}; redirected (not applicable): ${redirected.join(" ")}`);
    await ctx.close();
  }
  {
    const { page, s, ctx } = await session({ signedIn: false });
    const leaks = [];
    for (const path of ["/auth", "/auth?mode=signup", "/onboarding", "/privacy", "/terms", "/cookie-policy", "/nope-404"]) {
      const before = s.serves.length;
      await visit(page, path, 900);
      if ((await slots(page).count()) > 0 || s.serves.length !== before) leaks.push(path);
    }
    check("F2 visitors: no ad on sign-in, onboarding, legal and 404 pages", leaks.length === 0, leaks.join(" "));
    await ctx.close();
  }

  // ---- G. French
  {
    const { page, s, ctx } = await session({ language: "fr" });
    await visit(page, "/discover", 1500);
    const info = await slotInfo(page);
    check("G1 French member: label 'Publicité', serve context locale fr", info[0]?.label === "Publicité"
      && /PUBLICITÉ/i.test(await slots(page).first().innerText()) && s.serves[0]?.body?.context?.locale === "fr", JSON.stringify(info));
    await page.screenshot({ path: `${out}/G1_discover_fr.png` });
    await ctx.close();
  }
  {
    const { page, ctx } = await session({ language: "fr", serve: () => unfilled() });
    await visit(page, "/faq", 1500);
    const a = await slotInfo(page);
    await ctx.close();
    const s2 = await session({ language: "fr", serve: () => unfilled(), adsenseUnfilled: true });
    await visit(s2.page, "/profile", 1800);
    const houseText = await s2.page.locator("a[data-house-ad]").innerText().catch(() => "");
    check("G2 French: AdSense labelled 'Publicités', house banner 'Sans publicité avec ISEXY Plus'",
      a[0]?.label === "Publicités" && houseText.includes("Sans publicité avec ISEXY Plus"), `${JSON.stringify(a)} ${houseText.slice(0, 60)}`);
    await s2.ctx.close();
  }

  // ---- H. Desktop
  {
    const { page, ctx } = await session({ viewport: { width: 1280, height: 800 } });
    await visit(page, "/discover", 1500);
    const box = await slots(page).first().boundingBox();
    const nav = await page.locator("nav").last().boundingBox();
    check("H1 desktop Discover: banner centred (max 384 px), above the nav", !!box && box.width <= 384.5 && Math.abs(box.x + box.width / 2 - 640) < 2
      && box.y + box.height <= nav.y + 0.5, JSON.stringify(box));
    await page.screenshot({ path: `${out}/H1_discover_desktop.png` });
    await visit(page, "/faq", 1200);
    check("H2 desktop FAQ: content ad, no horizontal scroll", (await slotInfo(page)).length === 1 && await noHScroll(page));
    await page.screenshot({ path: `${out}/H2_faq_desktop.png`, fullPage: true });
    await ctx.close();
  }

  // ---- I. Site verification for AdSense
  {
    const html = await (await fetch(base + "/")).text();
    const adsTxt = await (await fetch(base + "/ads.txt")).text();
    check("I1 built index.html carries <meta name=google-adsense-account> with the client id", html.includes(`<meta name="google-adsense-account" content="${CLIENT}" />`));
    check("I2 /ads.txt authorizes the publisher id", adsTxt.trim() === "google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0", adsTxt.slice(0, 80));
    // Google Search Console (VITE_GOOGLE_SITE_VERIFICATION), written by the same build step.
    check("I3 built index.html carries <meta name=google-site-verification> with the token, once",
      html.split(`<meta name="google-site-verification" content="${SITE_VERIFICATION}" />`).length === 2
        && html.indexOf("google-site-verification") < html.indexOf("</head>"));
  }

  // ---- J. Privacy and Cookie policies: Advertising section (EN + FR), real consent toggles
  const GOOGLE_LINKS = ["https://policies.google.com/technologies/partner-sites", "https://adssettings.google.com"];
  const sectionInfo = (page) => page.$eval("section#advertising", (el) => ({
    lang: el.getAttribute("data-advertising-policy"), heading: el.querySelector("h2")?.textContent ?? "",
    text: el.textContent ?? "", links: [...el.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")),
  })).catch(() => null);
  {
    const { page, s, ctx, errors } = await session();
    await visit(page, "/privacy", 900);
    const en = await sectionInfo(page);
    check("J1 Privacy Policy: '12. Advertising' (TAKATAK ads, AdSense, both Google links, consent, ad-free for paying members), no ad on the page",
      en?.lang === "en" && en.heading === "12. Advertising" && GOOGLE_LINKS.every((l) => en.links.includes(l))
        && /TAKATAK ads/.test(en.text) && /Google AdSense/.test(en.text) && /"Advertising" choice/.test(en.text)
        && /Members who pay for anything see no ads/.test(en.text) && /last 30 days/.test(en.text)
        && (await slots(page).count()) === 0 && s.serves.length === 0, JSON.stringify(en)?.slice(0, 200));
    await page.locator("section#advertising button", { hasText: "Français" }).click();
    const switched = await sectionInfo(page);
    check("J2 the section switches to French on request", switched?.lang === "fr" && switched.heading === "12. Publicité", switched?.heading);
    await page.locator("section#advertising button", { hasText: "Gérer mes choix de témoins" }).click();
    const dialog = page.locator('[role="dialog"][aria-labelledby="consent-title"]');
    await dialog.waitFor({ timeout: 3000 }).catch(() => undefined);
    check("J3 'Gérer mes choix de témoins' opens the consent settings with the Advertising choice",
      (await dialog.count()) === 1 && (await dialog.getByRole("switch", { name: "Advertising" }).count()) === 1);
    await page.screenshot({ path: `${out}/J1_privacy_advertising.png` });
    check("J4 no page errors on the Privacy Policy", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
  {
    const { page, ctx, errors } = await session({ language: "fr", signedIn: true });
    await visit(page, "/cookie-policy", 1200);
    const fr = await sectionInfo(page);
    check("J5 French member, Cookie Policy: 'Publicité' section in French with both Google links and the 30 days",
      fr?.lang === "fr" && fr.heading === "Publicité" && GOOGLE_LINKS.every((l) => fr.links.includes(l))
        && /Google AdSense/.test(fr.text) && /choix « Publicité »/.test(fr.text) && /30 derniers jours/.test(fr.text)
        && /ne voient aucune publicité/.test(fr.text), JSON.stringify(fr)?.slice(0, 200));
    const toggle = page.getByRole("switch", { name: "Personalized ads" });
    const before = await toggle.getAttribute("aria-checked");
    await toggle.click();
    await page.getByRole("button", { name: "Save Cookie Preferences" }).click();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("isexy_consent") || "{}"));
    check("J6 Cookie Policy toggles are the real consent: Advertising off → on, saved like the banner",
      before === "false" && saved.advertising === true && saved.analytics === false && saved.marketing === false && saved.version === 1 && !!saved.decidedAt,
      JSON.stringify(saved));
    const cookieTable = await page.locator("table").innerText();
    check("J7 Cookie table lists the AdSense cookies and the consent record", /__gads, __gpi/.test(cookieTable) && /IDE/.test(cookieTable) && /isexy_consent/.test(cookieTable));
    await page.screenshot({ path: `${out}/J5_cookie_policy_fr.png`, fullPage: false });
    check("J8 no page errors on the Cookie Policy", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
} else {
  // ---- P. Nothing configured: TAKATAK default only, no Google request, house banner
  const allowed = (s) => [...s.hosts].filter((h) => !["127.0.0.1:4410", new URL(base).host, "pcjfahhlozsseqqevimi.supabase.co", "takatak.ca", "img.test", "images.unsplash.com"].includes(h));
  {
    const { page, s, ctx, errors } = await session();
    await visit(page, "/discover", 2500);
    const info = await slotInfo(page);
    check("P1 free member, nothing configured: Discover shows the house banner", info.length === 1 && info[0].source === "house", JSON.stringify(info));
    check("P2 the only ad request goes to the default TAKATAK server (takatak.ca, publisher isexy)",
      s.serves.length === 1 && s.serves[0].body?.publisherCode === "isexy" && s.serves[0].body?.placementCode === "isexy-discover-banner", JSON.stringify(s.serves));
    await visit(page, "/explore", 2500);
    check("P3 no Google / third-party request", s.adsenseScriptRequests.length === 0 && allowed(s).length === 0
      && !s.requests.some((u) => /google|doubleclick/.test(u)), allowed(s).join(" "));
    check("P4 no page errors", errors.length === 0, errors.join(" | "));
    await page.screenshot({ path: `${out}/P1_explore_plain.png`, fullPage: true });
    await ctx.close();
  }
  {
    const { page, s, ctx } = await session({ signedIn: false });
    await visit(page, "/faq", 2500);
    const info = await slotInfo(page);
    check("P5 visitor on the FAQ: house banner, no third-party request", info.length === 1 && info[0].source === "house" && allowed(s).length === 0, JSON.stringify(info));
    await ctx.close();
  }
  {
    const html = await (await fetch(base + "/")).text();
    const res = await fetch(base + "/ads.txt");
    const body = await res.text();
    check("P6 no AdSense meta tag and no ads.txt when VITE_ADSENSE_CLIENT is unset",
      !html.includes("google-adsense-account") && !body.includes("google.com, pub-"), `ads.txt status ${res.status}`);
    check("P7 no Search Console tag when VITE_GOOGLE_SITE_VERIFICATION is unset", !html.includes("google-site-verification"));
  }
}

await browser.close();
console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("FAIL"));
console.log(`\n${results.length - failed.length}/${results.length} passed (${MODE})`);
process.exit(failed.length ? 1 : 0);
