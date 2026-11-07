import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { readFileSync } from "node:fs";
const [, , out, ogPath] = process.argv;
const base = process.env.E2E_BASE ?? "http://127.0.0.1:4173";
const png = readFileSync(ogPath);
const USER = "10000000-0000-4000-8000-00000000000a", ME = "00000000-0000-4000-8000-00000000000a";
const feed = ["Bea", "Carla", "Dania", "Elena"].map((n, i) => ({
  id: `00000000-0000-4000-8000-00000000010${i}`, first_name: n, birth_date: `199${i}-05-01`, bio: `Hola, soy ${n} de La Habana`,
  city: "La Habana", job_title: "Dancer", company: null, school: null, is_verified: i === 0, interests: ["Salsa"],
  distance_km: 2600 + i, photos: [`https://img.test/${n}-1.png`, `https://img.test/${n}-2.png`],
}));
const calls = { perform_like: [], swipesDelete: 0 };
let failNext = false;

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: false });
await ctx.addInitScript(([USER]) => {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  localStorage.setItem("sb-pcjfahhlozsseqqevimi-auth-token", JSON.stringify({
    access_token: "header.eyJzdWIiOiIxIn0.sig", token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: "r",
    user: { id: USER, aud: "authenticated", role: "authenticated", email: "test@isexy.ca", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" },
  }));
  localStorage.setItem("isexy_consent", JSON.stringify({ analytics: false, marketing: false, decidedAt: "2026-10-07T00:00:00Z", version: 1 }));
  sessionStorage.setItem("isexy_assistant_teaser_seen", "1");
  localStorage.setItem("push_notification_prompt_shown", "true"); // push opt-in prompt (wf/chat) asked already
}, [USER]);
await ctx.route("https://img.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: png }));
await ctx.route("**/*.supabase.co/**", async (route) => {
  const req = route.request(); const url = req.url(); const m = req.method();
  const json = (body, status = 200, headers = {}) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*", "access-control-expose-headers": "content-range", ...headers }, body: JSON.stringify(body) });
  if (m === "OPTIONS") return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
  if (url.includes("/rest/v1/profiles") && url.includes("user_id=eq")) return json({ id: ME, user_id: USER, first_name: "Alex", birth_date: "1995-01-01", gender: "man", interested_in: ["women"], bio: "Montréal, salsa, travel", likes_remaining: 42, is_premium: false, subscription_tier: "free", country: "CA", is_active: true });
  if (url.includes("/rest/v1/profile_photos") && m === "HEAD") return route.fulfill({ status: 200, headers: { "content-range": "0-0/3", "access-control-allow-origin": "*", "access-control-expose-headers": "content-range" } });
  if (url.includes("/rpc/get_discover_feed")) return json(feed);
  if (url.includes("/rpc/check_swipe_rate_limit")) return json({ allowed: true, remaining: 50 });
  if (url.includes("/rpc/perform_like")) {
    const body = JSON.parse(req.postData() || "{}");
    calls.perform_like.push(`${body.p_action}:${feed.find((f) => f.id === body.p_swiped_id)?.first_name}`);
    if (failNext) { failNext = false; return json({ message: "boom" }, 500); }
    return json({ success: true, likes_remaining: 41 });
  }
  if (url.includes("/rest/v1/matches") && url.includes(feed[1].id)) return json({ id: "match-1" });
  if (url.includes("/rest/v1/matches")) return json(null);
  if (url.includes("/rest/v1/swipes") && m === "DELETE") { calls.swipesDelete++; return json([]); }
  if (url.includes("/functions/v1/isexy-translate-message")) return json({ translatedText: null });
  if (url.includes("/rest/v1/")) return json(m === "GET" ? [] : null);
  return json({});
});
const page = await ctx.newPage();
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.goto(base + "/discover", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const topName = () => page.locator('[style*="z-index: 1"] h2').first().textContent().catch(() => null);
const log = [];
log.push(`url=${page.url().replace(base, "")} top=${await topName()}`);
await page.screenshot({ path: `${out}/discover_1_loaded.png` });

// 1. Drag right half-way: LIKE badge should fade in, then release past threshold.
const card = page.locator('[style*="z-index: 1"]').first();
const box = await card.boundingBox();
const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
await page.mouse.move(cx, cy); await page.mouse.down();
for (let i = 1; i <= 8; i++) await page.mouse.move(cx + i * 20, cy + i * 2);
const likeOpacity = await card.evaluate((el) => getComputedStyle(el).getPropertyValue("--like"));
log.push(`mid-drag --like=${likeOpacity}`);
await page.screenshot({ path: `${out}/discover_2_dragging.png` });
await page.mouse.up();
await page.waitForTimeout(600);
log.push(`after drag-right top=${await topName()} calls=${calls.perform_like.join(",")}`);

// 2. Like Carla with the button → mutual match → celebration.
await page.getByRole("button", { name: "Like", exact: true }).click();
await page.waitForTimeout(900);
const celebration = await page.getByText(/match/i).first().isVisible().catch(() => false);
log.push(`after like Carla: match celebration visible=${celebration}`);
await page.screenshot({ path: `${out}/discover_3_match.png` });
await page.keyboard.press("Escape");
const closeBtn = page.getByRole("button", { name: /keep swiping|close|later/i }).first();
if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();
await page.waitForTimeout(400);

// 3. Server failure on next swipe → card comes back on top.
log.push(`before failing swipe top=${await topName()}`);
failNext = true;
await page.keyboard.press("ArrowLeft");
await page.waitForTimeout(1200);
log.push(`after failed pass (keyboard): top=${await topName()} calls=${calls.perform_like.join(",")}`);
// The error toast sits just above the bottom nav (over the action row) for a few
// seconds; hovering it pauses it, so move the pointer away and let it go.
await page.mouse.move(5, 5);
await page.locator("[data-sonner-toast]").first().waitFor({ state: "detached", timeout: 10000 }).catch(() => {});

// 4. Keyboard pass succeeds, then undo restores it.
await page.keyboard.press("ArrowLeft");
await page.waitForTimeout(700);
log.push(`after keyboard pass: top=${await topName()}`);
await page.getByRole("button", { name: "Undo last swipe" }).click();
await page.waitForTimeout(700);
log.push(`after undo: top=${await topName()} swipesDelete=${calls.swipesDelete}`);

// 5. Photo tap zone flips photo, not a swipe.
await page.getByRole("button", { name: "Next photo" }).click();
await page.waitForTimeout(200);
log.push(`after tap next photo: top=${await topName()}`);
await page.screenshot({ path: `${out}/discover_4_final.png` });
console.log(log.join("\n"));
console.log("pageerrors:", JSON.stringify(errors));
await browser.close();
