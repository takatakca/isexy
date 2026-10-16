import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { readFileSync } from "node:fs";
const [, , out, ogPath] = process.argv;
const base = process.env.E2E_BASE ?? "http://127.0.0.1:4173";
const png = readFileSync(ogPath);
const USER = "10000000-0000-4000-8000-00000000000a", ME = "00000000-0000-4000-8000-00000000000a", BEA = "00000000-0000-4000-8000-000000000100", HANA = "00000000-0000-4000-8000-000000000101";
const M1 = "11111111-0000-4000-8000-000000000001", M2 = "11111111-0000-4000-8000-000000000002";
const now = Date.now();
const iso = (minAgo) => new Date(now - minAgo * 60000).toISOString();
const inbox = [
  { match_id: M1, matched_at: iso(3000), other_id: BEA, first_name: "Bea", photo_url: "https://img.test/bea.png", is_verified: true, last_active_at: iso(2), last_message_at: iso(10), last_message_preview: "¿Vienes a La Habana?", last_message_mine: false, unread_count: 2, is_unlocked: true },
  { match_id: M2, matched_at: iso(60), other_id: HANA, first_name: "Hana", photo_url: "https://img.test/hana.png", is_verified: false, last_active_at: null, last_message_at: null, last_message_preview: null, last_message_mine: null, unread_count: 0, is_unlocked: true },
];
const history = [
  { id: "m1", match_id: M1, sender_id: ME, content: "Hola Bea!", is_read: true, created_at: iso(30) },
  { id: "m2", match_id: M1, sender_id: BEA, content: "¡Hola! ¿Cómo estás?", is_read: false, created_at: iso(20) },
  { id: "m3", match_id: M1, sender_id: BEA, content: "¿Vienes a La Habana?", is_read: false, created_at: iso(10) },
];
let failInsert = false; const inserts = []; const notifyBodies = [];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(([USER]) => {
  localStorage.setItem("sb-pcjfahhlozsseqqevimi-auth-token", JSON.stringify({ access_token: "h.eyJzdWIiOiIxIn0.s", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r", user: { id: USER, aud: "authenticated", role: "authenticated", email: "t@isexy.ca", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" } }));
  localStorage.setItem("isexy_consent", JSON.stringify({ analytics: false, marketing: false, decidedAt: "2026-10-07T00:00:00Z", version: 1 }));
  localStorage.setItem("cubadate_safety_seen", "true");
  sessionStorage.setItem("isexy_assistant_teaser_seen", "1");
  localStorage.setItem("push_notification_prompt_shown", "true"); // push opt-in prompt (wf/chat) asked already
}, [USER]);
await ctx.route("https://img.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: png }));
await ctx.route("**/*.supabase.co/**", async (route) => {
  const req = route.request(); const url = req.url(); const m = req.method();
  const json = (body, status = 200, headers = {}) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*", "access-control-expose-headers": "content-range", ...headers }, body: JSON.stringify(body) });
  if (m === "OPTIONS") return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
  if (url.includes("/rest/v1/profiles") && url.includes("user_id=eq")) return json({ id: ME, user_id: USER, first_name: "Alex", birth_date: "1995-01-01", gender: "man", interested_in: ["women"], bio: "Montréal, salsa, travel", is_premium: false, country: "CA", is_active: true });
  if (url.includes("/rest/v1/profile_photos") && m === "HEAD") return route.fulfill({ status: 200, headers: { "content-range": "0-0/3", "access-control-allow-origin": "*", "access-control-expose-headers": "content-range" } });
  if (url.includes("/rpc/get_my_conversations")) return json(inbox);
  if (url.includes("/rest/v1/user_preferences")) return json({ preferred_language: "en", auto_translate: true });
  if (url.includes("/rest/v1/matches") && url.includes("profile1%3Aprofiles")) return json({ is_active: true, profile1: { id: ME, first_name: "Alex" }, profile2: { id: BEA, first_name: "Bea" } });
  // Chat page since wf/chat: the match row, the other member, and the unlock rule (premium or a chat unlock).
  if (url.includes("/rest/v1/matches") && url.includes(`id=eq.${M1}`)) return json([{ profile1_id: ME, profile2_id: BEA, is_active: true }]);
  if (url.includes("/rest/v1/profiles") && url.includes(`id=eq.${BEA}`)) return json([{ id: BEA, first_name: "Bea" }]);
  if (url.includes("/rest/v1/conversation_unlocks")) return json(url.includes(M1) ? [{ id: "unlock-1" }] : []);
  if (url.includes("/rest/v1/messages") && m === "GET") return json([...history].reverse());
  if (url.includes("/rest/v1/messages") && m === "POST") {
    const body = JSON.parse(req.postData()); inserts.push(body.content);
    await new Promise((r) => setTimeout(r, 900));
    if (failInsert) return json({ message: "network" }, 500);
    return json({ id: `srv-${inserts.length}`, ...body, is_read: false, created_at: new Date().toISOString() }, 201);
  }
  if (url.includes("/functions/v1/isexy-send-notification-email")) { notifyBodies.push(JSON.parse(req.postData())); return json({ success: true }); }
  if (url.includes("/functions/v1/isexy-translate-message")) { const b = JSON.parse(req.postData()); return json({ translatedText: b.text.includes("Habana") ? "Are you coming to Havana?" : "Hi! How are you?" }); }
  if (url.includes("/rest/v1/")) return json(m === "GET" ? [] : null);
  return json({});
});
const page = await ctx.newPage();
const errors = []; page.on("pageerror", (e) => errors.push(e.message + " @ " + (e.stack || "").split("\n").slice(1, 4).join(" | ")));
page.on("request", (r) => { if (r.url().includes("supabase.co")) reqlog.push(r.method() + " " + r.url().split(".co")[1].slice(0, 110)); });
const reqlog = [];
const log = [];
await page.goto(base + "/matches", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
log.push(`inbox: newMatches=${await page.getByRole("region", { name: "New matches" }).count()} threadBea=${await page.getByText("¿Vienes a La Habana?").isVisible()} unread2=${await page.getByText("2", { exact: true }).isVisible()} time=${await page.getByText("10m").isVisible()}`);
await page.screenshot({ path: `${out}/matches.png` });
await page.getByLabel("Search matches by name").fill("han");
log.push(`search 'han': Bea visible=${await page.getByText("¿Vienes a La Habana?").isVisible().catch(() => false)} Hana visible=${await page.getByText("Hana").first().isVisible()}`);
await page.getByLabel("Search matches by name").fill("");
await page.getByText("¿Vienes a La Habana?").click();
await page.waitForURL(/\/chat\//);
await page.waitForTimeout(1500);
log.push(`chat url=${page.url().replace(base, "")} history=${await page.getByText("Hola Bea!").isVisible()} translated=${await page.getByText("Are you coming to Havana?").isVisible().catch(() => false)}`);
const input = page.locator('input[placeholder], textarea').last();
await input.fill("Sí! En diciembre 🌴");
const t0 = Date.now();
await page.keyboard.press("Enter");
await page.getByText("Sí! En diciembre 🌴").waitFor({ timeout: 2000 });
log.push(`optimistic message visible after ${Date.now() - t0}ms (server takes 900ms), pending clock=${await page.getByLabel("Sending").isVisible().catch(() => false)}`);
await page.screenshot({ path: `${out}/chat_pending.png` });
await page.waitForTimeout(1200);
log.push(`after confirm: clock gone=${!(await page.getByLabel("Sending").isVisible().catch(() => false))} copies=${await page.getByText("Sí! En diciembre 🌴").count()} notify=${JSON.stringify(notifyBodies[0])}`);
failInsert = true;
await input.fill("This one will fail");
await page.keyboard.press("Enter");
await page.waitForTimeout(1500);
log.push(`failed send: bubble removed=${(await page.getByText("This one will fail").count()) === 0} input restored="${await input.inputValue()}"`);
await page.screenshot({ path: `${out}/chat_final.png` });
console.log(log.join("\n")); console.log("pageerrors:", JSON.stringify(errors, null, 1)); console.log(reqlog.filter((r) => !r.includes("profile_photos")).slice(0, 40).join("\n"));
await browser.close();
