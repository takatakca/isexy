// Mocked end-to-end checks for the Discover area (wf/discover).
// usage: node --import ./e2e/offline-browser.mjs e2e/discover-e2e.mjs <outDir> public/og-image.png  (E2E_BASE, default http://127.0.0.1:4173)
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { readFileSync, mkdirSync } from "node:fs";

const [, , out, pngPath] = process.argv;
mkdirSync(out, { recursive: true });
const base = process.env.E2E_BASE ?? "http://127.0.0.1:4173";
const png = readFileSync(pngPath);
const ME = "10000000-0000-4000-8000-00000000000a";
const pid = (i) => `00000000-0000-4000-8000-${String(100 + i).padStart(12, "0")}`;
const now = Date.now();
const iso = (minAgo) => new Date(now - minAgo * 60000).toISOString();
const names = ["Bea", "Carla", "Dania", "Elena", "Fran", "Gabi"];
const feed = names.map((n, i) => ({
  id: pid(i), first_name: n, birth_date: `199${i}-05-01`, bio: `Hi, I'm ${n} from Montréal`,
  city: "Montréal", job_title: "Designer", company: null, school: null, is_verified: i % 2 === 0, interests: ["Hiking"],
  distance_km: 3 + i, photos: [`https://img.test/${n}-1.png`, `https://img.test/${n}-2.png`],
}));
const results = [];
const check = (label, ok, extra = "") => results.push(`${ok ? "PASS" : "FAIL"} ${label}${extra ? ` (${extra})` : ""}`);

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

async function session({ tier = "free", premium = false, signedIn = true, interested = ["women"], hooks = {}, shareStub = false } = {}) {
  const calls = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: base });
  await ctx.addInitScript(([ME, signedIn, shareStub]) => {
    if (signedIn) {
      localStorage.setItem("sb-pcjfahhlozsseqqevimi-auth-token", JSON.stringify({
        access_token: "h.eyJzdWIiOiIxIn0.s", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r",
        user: { id: ME, aud: "authenticated", role: "authenticated", email: "t@isexy.ca", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" },
      }));
    }
    localStorage.setItem("isexy_consent", JSON.stringify({ analytics: false, marketing: false, decidedAt: "2026-10-07T00:00:00Z", version: 1 }));
    localStorage.setItem("cubadate_safety_seen", "true");
    sessionStorage.setItem("isexy_assistant_teaser_seen", "1");
    localStorage.setItem("push_notification_prompt_shown", "true"); // push opt-in prompt (wf/chat) asked already
    window.__nav = [];
    for (const k of ["pushState", "replaceState"]) {
      const orig = history[k].bind(history);
      history[k] = (st, t, url) => { window.__nav.push(String(url)); return orig(st, t, url); };
    }
    if (shareStub) {
      window.__shared = [];
      Object.defineProperty(navigator, "share", { configurable: true, value: (d) => { window.__shared.push(d); return Promise.resolve(); } });
    }
  }, [ME, signedIn, shareStub]);
  await ctx.route("https://img.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: png }));
  await ctx.route("https://images.unsplash.com/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: png }));
  await ctx.route("**/*.supabase.co/**", async (route) => {
    const req = route.request(); const url = decodeURIComponent(req.url()); const m = req.method();
    const json = (body, status = 200, headers = {}) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*", "access-control-expose-headers": "content-range", ...headers }, body: JSON.stringify(body) });
    if (m === "OPTIONS") return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
    const path = url.split(".supabase.co")[1];
    let body = null; try { body = JSON.parse(req.postData() || "null"); } catch { /* not json */ }
    calls.push({ m, path, body });
    for (const [pattern, fn] of Object.entries(hooks)) {
      if (path.includes(pattern)) { const r = fn({ m, path, body, json, route }); if (r !== undefined) return await r; }
    }
    if (path.includes("/rest/v1/profiles") && path.includes("user_id=eq")) return json({ id: ME, user_id: ME, first_name: "Alex", birth_date: "1995-01-01", gender: "man", interested_in: interested, bio: "Montréal, hiking, coffee", likes_remaining: 42, is_premium: premium, subscription_tier: tier, country: "Canada", is_active: true, age_min: 18, age_max: 50, distance_preference: 80 });
    if (path.includes("/rest/v1/profile_photos") && m === "HEAD") return route.fulfill({ status: 200, headers: { "content-range": "0-0/3", "access-control-allow-origin": "*", "access-control-expose-headers": "content-range" } });
    if (path.includes("/rest/v1/user_preferences")) return json({ preferred_language: "en", auto_translate: false });
    if (path.includes("/rpc/get_discover_feed")) return json(body?.p_verified_only ? feed.filter((f) => f.is_verified) : feed.filter((f) => !(body?.p_exclude ?? []).includes(f.id)));
    if (path.includes("/rpc/check_swipe_rate_limit")) return json({ allowed: true, remaining: 50 });
    if (path.includes("/rpc/perform_like")) return json({ success: true, likes_remaining: 41 });
    if (path.includes("/rest/v1/matches") && m === "GET") return json(null);
    if (path.includes("/functions/v1/")) return json({});
    if (path.includes("/rest/v1/")) return json(m === "GET" ? [] : null);
    return json({});
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { ctx, page, calls, errors };
}
const toastText = (page) => page.locator("[data-sonner-toast]").allInnerTexts().then((t) => t.join(" | "));
const topName = (page) => page.locator('[style*="z-index: 1"] h2').first().textContent().catch(() => null);
const likes = (calls) => calls.filter((c) => c.path.includes("/rpc/perform_like")).map((c) => `${c.body.p_action}:${names[feed.findIndex((f) => f.id === c.body.p_swiped_id)] ?? c.body.p_swiped_id}`);

// ---------------------------------------------------------------------------
// A. Discover (free member): drag, buttons, keyboard, undo, match → chat, filters
{
  const s = await session({
    hooks: {
      "/rest/v1/matches": ({ m, path, json }) => (m === "GET" && path.includes(pid(1)) ? json({ id: "match-carla" }) : undefined),
      "/rest/v1/chat_subscriptions": ({ json }) => json([]),
      "/rest/v1/user_credits": ({ json }) => json(null),
    },
  });
  const { page, calls } = s;
  await page.goto(base + "/discover", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  check("A1 deck loads with first card", (await topName(page)) === "Bea", await topName(page));
  await page.screenshot({ path: `${out}/A1_discover.png` });

  const card = page.locator('[style*="z-index: 1"]').first();
  const box = await card.boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy); await page.mouse.down();
  for (let i = 1; i <= 9; i++) await page.mouse.move(cx + i * 18, cy + i * 2);
  const likeVar = await card.evaluate((el) => getComputedStyle(el).getPropertyValue("--like"));
  await page.screenshot({ path: `${out}/A2_drag.png` });
  await page.mouse.up(); await page.waitForTimeout(700);
  check("A2 drag right likes Bea", likes(calls).includes("like:Bea") && (await topName(page)) === "Carla", `--like=${likeVar} calls=${likes(calls)}`);

  await page.getByRole("button", { name: "Like", exact: true }).click();
  await page.waitForTimeout(900);
  const matchVisible = await page.getByRole("dialog", { name: /match/i }).isVisible().catch(() => false);
  await page.screenshot({ path: `${out}/A3_match.png` });
  check("A3 like button on Carla → It's a Match dialog", matchVisible);
  await page.getByRole("button", { name: /chat now/i }).click();
  await page.waitForTimeout(600);
  const contact = await page.getByText("Contact Carla").isVisible().catch(() => false);
  await page.screenshot({ path: `${out}/A4_contact.png` });
  check("A4 Chat now (free member) → contact options for Carla", contact);
  await page.mouse.click(195, 60); // backdrop closes the modal
  await page.waitForTimeout(400);

  await page.keyboard.press("ArrowLeft"); await page.waitForTimeout(700);
  check("A5 ArrowLeft passes Dania", likes(calls).includes("pass:Dania") && (await topName(page)) === "Elena", likes(calls).join(","));
  await page.getByRole("button", { name: "Undo last swipe" }).click(); await page.waitForTimeout(700);
  const del = calls.filter((c) => c.m === "DELETE" && c.path.includes("/rest/v1/swipes")).length;
  check("A6 undo brings Dania back and deletes the swipe", (await topName(page)) === "Dania" && del === 1, `top=${await topName(page)} deletes=${del}`);
  await page.keyboard.press("ArrowUp"); await page.waitForTimeout(700);
  check("A7 ArrowUp super-likes (free tier: no First Impression)", likes(calls).includes("super_like:Dania"), likes(calls).join(","));
  await page.keyboard.press("ArrowRight"); await page.waitForTimeout(700);
  check("A8 ArrowRight likes", likes(calls).includes("like:Elena"));

  // Filters: profile stores ["women"] → Women on, Men off; Apply keeps ["women"].
  await page.getByRole("button", { name: "Discovery settings" }).click(); await page.waitForTimeout(500);
  const women = await page.locator("#show-women").getAttribute("data-state");
  const men = await page.locator("#show-men").getAttribute("data-state");
  await page.screenshot({ path: `${out}/A9_filters.png` });
  await page.getByRole("button", { name: "Apply" }).click(); await page.waitForTimeout(800);
  const patch = calls.find((c) => c.m === "PATCH" && c.path.includes("/rest/v1/profiles") && c.body?.interested_in);
  const allPatches = calls.filter((c) => c.m === "PATCH").map((c) => c.path.split("?")[0] + " " + Object.keys(c.body ?? {}).join("+"));
  check("A9 filters show saved Show-me (women on, men off) and save it back", women === "checked" && men === "unchecked" && JSON.stringify(patch?.body?.interested_in) === '["women"]', `women=${women} men=${men} saved=${JSON.stringify(patch?.body?.interested_in)} patches=${allPatches.join(";")}`);
  // Turning both off is refused.
  await page.getByRole("button", { name: "Discovery settings" }).click(); await page.waitForTimeout(400);
  await page.locator("#show-women").click();
  await page.getByRole("button", { name: "Apply" }).click(); await page.waitForTimeout(500);
  const patches = calls.filter((c) => c.m === "PATCH" && c.path.includes("/rest/v1/profiles") && c.body?.interested_in).length;
  check("A10 cannot save an empty Show-me", patches === 1 && /Pick at least one/.test(await toastText(page)), await toastText(page));
  check("A* no page errors", s.errors.length === 0, s.errors.join(" | "));
  await s.ctx.close();
}

// ---------------------------------------------------------------------------
// B. Platinum First Impression: cancel sends nothing; send attaches the message.
{
  const s = await session({
    tier: "platinum", premium: true,
    hooks: {
      "/rpc/set_first_impression": ({ json }) => json({ success: true, remaining: 2 }),
      "/rest/v1/allowances": ({ json }) => json({ weekly_first_impressions: 3 }),
    },
  });
  const { page, calls } = s;
  await page.goto(base + "/discover", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.keyboard.press("ArrowUp"); await page.waitForTimeout(500);
  const modal = await page.getByRole("dialog", { name: "First Impression" }).isVisible();
  await page.screenshot({ path: `${out}/B1_first_impression.png` });
  await page.getByRole("button", { name: "Cancel" }).click(); await page.waitForTimeout(500);
  check("B1 First Impression opens; X cancels without a Super Like", modal && likes(calls).length === 0 && (await topName(page)) === "Bea", likes(calls).join(","));
  await page.getByRole("button", { name: "Super Like" }).click(); await page.waitForTimeout(400);
  await page.getByPlaceholder(/Say something/).fill("Hi Bea, which trail is your favourite?");
  await page.getByRole("button", { name: /Send Super Like/ }).click(); await page.waitForTimeout(1200);
  const fi = calls.find((c) => c.path.includes("/rpc/set_first_impression"));
  check("B2 send → super_like + set_first_impression(message)", likes(calls).includes("super_like:Bea") && fi?.body?.p_message === "Hi Bea, which trail is your favourite?" && fi?.body?.p_swiped_id === pid(0), `${likes(calls)} ${JSON.stringify(fi?.body)} toast=${await toastText(page)}`);
  check("B* no page errors", s.errors.length === 0, s.errors.join(" | "));
  await s.ctx.close();
}

// ---------------------------------------------------------------------------
// C. Gold: Top Picks (no swiped people, click → details → like), Who liked you
{
  const page1 = Array.from({ length: 30 }, (_, i) => ({
    liker_id: `22222222-0000-4000-8000-${String(i).padStart(12, "0")}`, first_name: `Liker${i}`, birth_date: "1994-02-02", city: "Laval",
    is_verified: i === 0, photo_url: "https://img.test/liker.png", action: i === 0 ? "super_like" : "like",
    message: i === 0 ? "Coffee this weekend with the hiking group?" : null, liked_at: iso(i + 1), locked: false,
  }));
  const page2 = Array.from({ length: 4 }, (_, i) => ({ ...page1[0], liker_id: `33333333-0000-4000-8000-${String(i).padStart(12, "0")}`, first_name: `Older${i}`, message: null, action: "like", liked_at: iso(100 + i) }));
  const s = await session({
    tier: "gold", premium: true,
    hooks: {
      "/rpc/get_likes_received": ({ body, json }) => json(body?.p_before ? page2 : page1),
      "/rest/v1/matches": ({ m, path, json }) => (m === "GET" && path.includes("22222222-0000-4000-8000-000000000000") ? json({ id: "match-liker0" }) : undefined),
    },
  });
  const { page, calls } = s;
  await page.goto(base + "/discover", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const picks = await page.getByRole("button", { name: /open profile$/ }).allInnerTexts();
  await page.screenshot({ path: `${out}/C1_top_picks.png` });
  check("C1 Top Picks (gold) show verified people from the feed", picks.length === 3, picks.map((t) => t.split("\n")[0]).join(","));
  await page.getByRole("button", { name: /^Dania, \d+: open profile$/ }).click(); await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/C2_pick_detail.png` });
  await page.getByRole("dialog", { name: "Dania's profile" }).getByRole("button", { name: "Like", exact: true }).click(); await page.waitForTimeout(900);
  const picksAfter = await page.getByRole("button", { name: /open profile$/ }).count();
  check("C2 liking a Top Pick sends like:Dania and removes it from the carousel; top card unchanged", likes(calls).includes("like:Dania") && picksAfter === 2 && (await topName(page)) === "Bea", `${likes(calls)} picks=${picksAfter} top=${await topName(page)}`);

  await page.keyboard.press("ArrowRight"); await page.waitForTimeout(800);
  const picksAfterDeck = await page.getByRole("button", { name: /open profile$/ }).allInnerTexts();
  check("C2b liking Bea in the deck also hides her from Top Picks", likes(calls).includes("like:Bea") && !picksAfterDeck.some((t) => t.startsWith("Bea")) && picksAfterDeck.length === 1, picksAfterDeck.map((t) => t.split("\n")[0]).join(","));

  await page.goto(base + "/who-liked-you", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const firstCard = await page.getByText("Liker0").isVisible();
  const msg = await page.getByText(/Coffee this weekend/).isVisible();
  await page.screenshot({ path: `${out}/C3_who_liked_you.png` });
  check("C3 Who liked you (gold) lists likers with First Impression", firstCard && msg);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(1200);
  const more = calls.filter((c) => c.path.includes("/rpc/get_likes_received")).map((c) => c.body?.p_before ? "before" : "first");
  check("C4 infinite scroll loads the next page with p_before", more.includes("before") && (await page.getByText("Older3").isVisible()), more.join(","));
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Like Liker0 back" }).click(); await page.waitForTimeout(900);
  const match = await page.getByRole("dialog", { name: /match/i }).isVisible().catch(() => false);
  await page.screenshot({ path: `${out}/C5_like_back_match.png` });
  await page.getByRole("button", { name: /chat now/i }).click(); await page.waitForTimeout(800);
  const nav = await page.evaluate(() => window.__nav);
  check("C5 like back → It's a Match → Chat now opens the chat (premium)", match && nav.includes("/chat/match-liker0"), nav.join(" → "));
  check("C* no page errors", s.errors.length === 0, s.errors.join(" | "));
  await s.ctx.close();
}

// ---------------------------------------------------------------------------
// D. Free member: Who liked you is locked (count, no identities), RPC missing → message
{
  const locked = [0, 1].map((i) => ({ liker_id: null, first_name: null, birth_date: null, city: null, is_verified: null, photo_url: null, action: i ? "like" : "super_like", message: null, liked_at: iso(i + 1), locked: true }));
  const s = await session({ hooks: { "/rpc/get_likes_received": ({ json }) => json(locked) } });
  const { page } = s;
  await page.goto(base + "/likes", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const count = await page.getByText("2 people like you").isVisible();
  const someone = await page.getByText("Someone likes you").count();
  await page.screenshot({ path: `${out}/D1_likes_locked.png` });
  check("D1 free: Likes tab shows '2 people like you', locked tiles", count && someone === 2);
  await s.ctx.close();

  const s2 = await session({ hooks: { "/rpc/get_likes_received": ({ json }) => json({ code: "PGRST202", message: "Could not find the function isexy.get_likes_received" }, 404) } });
  await s2.page.goto(base + "/who-liked-you", { waitUntil: "networkidle" });
  await s2.page.waitForTimeout(600);
  check("D2 RPC not deployed → honest 'being switched on' state", await s2.page.getByText("Likes are on their way").isVisible());
  await s2.ctx.close();
}

// ---------------------------------------------------------------------------
// E. Web profile: member view + Share (native share stub), copy fallback, anonymous prompt
{
  const BEA = pid(0);
  const s = await session({
    shareStub: true,
    hooks: {
      "/rest/v1/profiles": ({ m, path, json }) => (m === "GET" && path.includes(`id=eq.${BEA}`) ? json({ id: BEA, first_name: "Bea", birth_date: "1990-05-01", bio: "Hiking and coffee", city: "Montréal", job_title: "Designer", company: null, school: null, is_verified: true, interests: ["Hiking", "Coffee"] }) : undefined),
      "/rest/v1/profile_photos": ({ m, path, json }) => (m === "GET" && path.includes(BEA) ? json([{ photo_url: "https://img.test/Bea-1.png", position: 0 }, { photo_url: "https://img.test/Bea-2.png", position: 1 }]) : undefined),
      "/rest/v1/swipes": ({ m, json }) => (m === "GET" ? json(null) : undefined),
      "/rest/v1/blocks": ({ m, json }) => (m === "GET" ? json(null) : undefined),
    },
  });
  const { page, calls } = s;
  await page.goto(base + `/web-profile/${BEA}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const shown = await page.getByRole("heading", { name: /Bea, \d+/ }).isVisible();
  await page.screenshot({ path: `${out}/E1_web_profile.png`, fullPage: true });
  await page.getByRole("button", { name: "Share this profile" }).click(); await page.waitForTimeout(300);
  const shared = await page.evaluate(() => window.__shared);
  check("E1 member profile renders and Share uses navigator.share with /web-profile/<id>", shown && shared?.[0]?.url === `${base}/web-profile/${BEA}`, JSON.stringify(shared));
  await page.getByRole("button", { name: "Like", exact: true }).click(); await page.waitForTimeout(800);
  check("E2 Like from the web profile", calls.some((c) => c.path.includes("/rpc/perform_like") && c.body.p_swiped_id === BEA) && (await page.locator("p", { hasText: "You liked Bea" }).isVisible()));
  check("E* no page errors", s.errors.length === 0, s.errors.join(" | "));
  await s.ctx.close();

  // Copy fallback on the manage page (no navigator.share in desktop Chromium).
  const s2 = await session();
  await s2.page.goto(base + "/web-profile", { waitUntil: "networkidle" });
  await s2.page.waitForTimeout(500);
  const linkShown = await s2.page.getByText(`${base.replace(/^https?:\/\//, "")}/web-profile/${ME}`).isVisible();
  await s2.page.getByRole("button", { name: "Share", exact: true }).click(); await s2.page.waitForTimeout(500);
  const clip = await s2.page.evaluate(() => navigator.clipboard.readText()).catch((e) => `ERR ${e.message}`);
  await s2.page.screenshot({ path: `${out}/E3_manage_web_profile.png` });
  check("E3 manage page shows the real link; Share falls back to copy + toast", linkShown && clip === `${base}/web-profile/${ME}` && /Link copied/.test(await toastText(s2.page)), `clip=${clip} toast=${await toastText(s2.page)}`);
  await s2.ctx.close();

  const s3 = await session({ signedIn: false });
  await s3.page.goto(base + `/web-profile/${BEA}`, { waitUntil: "networkidle" });
  await s3.page.waitForTimeout(600);
  await s3.page.screenshot({ path: `${out}/E4_web_profile_anonymous.png` });
  check("E4 visitor (not signed in) gets a sign-in prompt, no profile data", await s3.page.getByText("Sign in to see this profile").isVisible());
  await s3.ctx.close();
}

// ---------------------------------------------------------------------------
// F. News + Community Stories share; deep link opens the item
{
  const s = await session({ signedIn: false, shareStub: true });
  const { page } = s;
  await page.goto(base + "/news", { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /Introducing Double Hangout/ }).click(); await page.waitForTimeout(400);
  const dlg = await page.getByRole("dialog").isVisible();
  await page.screenshot({ path: `${out}/F1_news_article.png` });
  await page.getByRole("button", { name: "Share", exact: true }).click(); await page.waitForTimeout(300);
  const shared = await page.evaluate(() => window.__shared);
  check("F1 News article opens and shares /news#news-3", dlg && shared?.[0]?.url === `${base}/news#news-3`, JSON.stringify(shared?.[0]));
  await page.goto(base + "/news#news-4", { waitUntil: "networkidle" }); await page.waitForTimeout(400);
  check("F2 /news#news-4 opens that article", await page.getByRole("dialog").getByText("Profile Verification Explained").isVisible());
  await page.goto(base + "/community-stories#story-3", { waitUntil: "networkidle" }); await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Share this story" }).click(); await page.waitForTimeout(300);
  const shared2 = await page.evaluate(() => window.__shared);
  await page.screenshot({ path: `${out}/F3_stories.png` });
  check("F3 Community story deep link + share", (await page.getByRole("heading", { name: "Kate & Leila" }).isVisible()) && shared2?.[0]?.url === `${base}/community-stories#story-3`, JSON.stringify(shared2?.[0]));
  check("F* no page errors", s.errors.length === 0, s.errors.join(" | "));
  await s.ctx.close();
}

// ---------------------------------------------------------------------------
// G. Category deck error state, Explore, Matches list, Double Hangout settings
{
  const s = await session({ hooks: { "/rpc/get_discover_feed": ({ json }) => json({ code: "XX000", message: "boom" }, 500) } });
  await s.page.goto(base + "/explore/travel", { waitUntil: "networkidle" }); await s.page.waitForTimeout(600);
  await s.page.screenshot({ path: `${out}/G1_category_error.png` });
  check("G1 category deck shows an error state with retry", await s.page.getByText("We couldn't load profiles").isVisible());
  await s.page.goto(base + "/explore", { waitUntil: "networkidle" }); await s.page.waitForTimeout(500);
  await s.page.screenshot({ path: `${out}/G2_explore.png` });
  check("G2 Explore has no invented member counts", !(await s.page.getByText(/^(3K|1K|776|448)$/).count()));
  await s.ctx.close();

  const inbox = [
    { match_id: "m1", matched_at: iso(3000), other_id: pid(0), first_name: "Bea", photo_url: "https://img.test/Bea-1.png", is_verified: true, last_active_at: iso(2), last_message_at: iso(10), last_message_preview: "See you at the café", last_message_mine: false, unread_count: 2, is_unlocked: true },
    { match_id: "m2", matched_at: iso(60), other_id: pid(1), first_name: "Carla", photo_url: null, is_verified: false, last_active_at: null, last_message_at: null, last_message_preview: null, last_message_mine: null, unread_count: 0, is_unlocked: false },
  ];
  const s2 = await session({
    hooks: {
      "/rpc/get_my_conversations": ({ json }) => json(inbox),
      "/rest/v1/profiles?select=id,birth_date": ({ json }) => json([{ id: pid(0), birth_date: "1990-05-01", city: "Montréal" }]),
      "/rest/v1/chat_subscriptions": ({ json }) => json([]),
      "/rest/v1/user_credits": ({ json }) => json(null),
    },
  });
  await s2.page.goto(base + "/matches-list", { waitUntil: "networkidle" }); await s2.page.waitForTimeout(600);
  await s2.page.screenshot({ path: `${out}/G3_matches_list.png` });
  const n = s2.calls.filter((c) => c.path.includes("/rest/v1/") || c.path.includes("/rpc/")).filter((c) => !c.path.includes("user_id=eq") && !c.path.includes("profile_photos") && !c.path.includes("user_preferences")).length;
  const bea = await s2.page.getByText("See you at the café").isVisible();
  await s2.page.getByRole("button", { name: /Carla/ }).last().click(); await s2.page.waitForTimeout(500);
  const contact = await s2.page.getByText("Contact Carla").isVisible();
  await s2.page.mouse.click(195, 60); await s2.page.waitForTimeout(300);
  await s2.page.getByRole("button", { name: /Bea/ }).last().click(); await s2.page.waitForTimeout(500);
  const nav2 = await s2.page.evaluate(() => window.__nav);
  check("G3 matches list from one inbox RPC; locked → contact options, unlocked → chat", bea && contact && nav2.includes("/chat/m1"), `requests=${n} nav=${nav2.join(" → ")}`);
  await s2.ctx.close();

  const s3 = await session({ hooks: { "/rest/v1/double_date_settings": ({ m, json }) => (m === "GET" ? json(null) : json(null, 201)) } });
  await s3.page.goto(base + "/double-hangout", { waitUntil: "networkidle" }); await s3.page.waitForTimeout(500);
  await s3.page.getByRole("switch").first().click(); await s3.page.waitForTimeout(400);
  await s3.page.getByRole("switch").nth(1).click(); await s3.page.waitForTimeout(400);
  const ups = s3.calls.filter((c) => c.m === "POST" && c.path.includes("double_date_settings"));
  await s3.page.screenshot({ path: `${out}/G4_double_hangout.png` });
  check("G4 Double Hangout settings upsert on profile_id (works after the first save)", ups.length === 2 && ups.every((u) => u.path.includes("on_conflict=profile_id")), ups.map((u) => u.path).join(" ; "));
  await s3.ctx.close();
}

console.log(results.join("\n"));
await browser.close();
if (results.some((r) => r.startsWith("FAIL"))) process.exitCode = 1;
