// Notifications, badges, missed calls, settings, group chat and matches list
// against `vite preview` with a mocked Supabase (nothing reaches a backend).
//   npm run build && npx vite preview --port 4303 --strictPort
//   node e2e/chat-notifications-e2e.mjs http://127.0.0.1:4303 /tmp/chat-shots public/og-image.png
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { readFileSync, mkdirSync } from "node:fs";

const [, , base = "http://127.0.0.1:4303", out = "./shots", pngPath = "public/og-image.png"] = process.argv;
mkdirSync(out, { recursive: true });
const png = readFileSync(pngPath);
const USER = "00000000-0000-4000-8000-00000000000a", ME = USER;
const BEA = "00000000-0000-4000-8000-000000000100", HANA = "00000000-0000-4000-8000-000000000101";
const M1 = "11111111-0000-4000-8000-000000000001", M2 = "11111111-0000-4000-8000-000000000002";
const G1 = "22222222-0000-4000-8000-000000000001";
const now = Date.now();
const iso = (minAgo) => new Date(now - minAgo * 60000).toISOString();

const inbox = [
  { match_id: M1, matched_at: iso(9000), other_id: BEA, first_name: "Bea", photo_url: "https://img.test/bea.png", is_verified: true, last_active_at: iso(2), last_message_at: iso(10), last_message_preview: "See you soon", last_message_mine: false, unread_count: 3, is_unlocked: true },
  { match_id: M2, matched_at: iso(60), other_id: HANA, first_name: "Hana", photo_url: null, is_verified: false, last_active_at: null, last_message_at: null, last_message_preview: null, last_message_mine: null, unread_count: 0, is_unlocked: false },
];
let storedPrefs = {};
const calls = { pushSubs: [], prefWrites: [], groupInserts: [] };

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript(([USER]) => {
  localStorage.setItem("sb-pcjfahhlozsseqqevimi-auth-token", JSON.stringify({ access_token: "h.eyJzdWIiOiIxIn0.s", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r", user: { id: USER, aud: "authenticated", role: "authenticated", email: "alex@isexy.ca", email_confirmed_at: "2026-01-01T00:00:00Z", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" } }));
  localStorage.setItem("isexy_consent", JSON.stringify({ analytics: false, marketing: false, decidedAt: "2026-10-07T00:00:00Z", version: 1 }));
  localStorage.setItem("cubadate_safety_seen", "true");
  sessionStorage.setItem("isexy_assistant_teaser_seen", "1");
  // Headless Chromium has no push service: fake the browser subscription.
  if (window.PushManager) {
    PushManager.prototype.subscribe = async function () {
      const sub = { endpoint: "https://push.test/endpoint-1", toJSON() { return { endpoint: this.endpoint, keys: { p256dh: "BPkey", auth: "authkey" } }; }, unsubscribe: async () => { localStorage.removeItem("__fake_sub"); return true; } };
      localStorage.setItem("__fake_sub", "1");
      return sub;
    };
    PushManager.prototype.getSubscription = async function () {
      return localStorage.getItem("__fake_sub") ? { endpoint: "https://push.test/endpoint-1", toJSON() { return { endpoint: this.endpoint, keys: { p256dh: "BPkey", auth: "authkey" } }; }, unsubscribe: async () => { localStorage.removeItem("__fake_sub"); return true; } } : null;
    };
  }
}, [USER]);
await ctx.route("https://img.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: png }));
await ctx.routeWebSocket(/supabase\.co\/realtime/, (ws) => {
  ws.onMessage((raw) => {
    const { topic, event, payload, ref, join_ref } = JSON.parse(String(raw));
    const pc = event === "phx_join" ? (payload?.config?.postgres_changes ?? []).map((b, i) => ({ ...b, id: 5000 + i })) : undefined;
    ws.send(JSON.stringify({ topic, event: "phx_reply", payload: { status: "ok", response: pc ? { postgres_changes: pc } : {} }, ref, join_ref }));
  });
});

await ctx.route("**/*.supabase.co/**", async (route) => {
  const req = route.request(); const url = decodeURIComponent(req.url()); const m = req.method();
  const wantsObject = (req.headers()["accept"] ?? "").includes("vnd.pgrst.object");
  const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*", "access-control-expose-headers": "content-range" }, body: JSON.stringify(body) });
  const rows = (list) => json(wantsObject ? (list[0] ?? null) : list);
  if (m === "OPTIONS") return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
  const body = () => { try { return JSON.parse(req.postData() || "{}"); } catch { return {}; } };

  if (url.includes("/rest/v1/profile_photos") && m === "HEAD") return route.fulfill({ status: 200, headers: { "content-range": "0-0/3", "access-control-allow-origin": "*", "access-control-expose-headers": "content-range" } });
  if (url.includes("/rest/v1/profiles") && url.includes("user_id=eq")) return json({ id: ME, user_id: USER, first_name: "Alex", birth_date: "1995-01-01", gender: "man", interested_in: ["women"], bio: "Montréal", is_premium: false, country: "Canada", is_active: true });
  if (url.includes("/rest/v1/profiles") && url.includes("id=in.")) return rows([{ id: ME, first_name: "Alex", birth_date: "1995-01-01", city: "Montréal" }, { id: BEA, first_name: "Bea", birth_date: "1996-05-01", city: "Laval" }, { id: HANA, first_name: "Hana", birth_date: "1994-02-01", city: "Québec" }]);
  if (url.includes("/rpc/get_my_conversations")) return json(inbox);
  if (url.includes("/rpc/get_my_badge_counts")) return json([{ unread_messages: 3, new_likes: 4 }]);
  if (url.includes("/rest/v1/missed_calls") && m === "GET") return rows([{ id: "mc1", match_id: M1, caller_id: BEA, created_at: iso(5), caller: { first_name: "Bea" }, call: { call_type: "phone" } }]);
  if (url.includes("/rest/v1/push_subscriptions")) { calls.pushSubs.push({ method: m, url, body: body() }); return json(null, 201); }
  if (url.includes("/rest/v1/user_preferences")) {
    if (m === "GET") return rows([{ preferred_language: "en", auto_translate: true, notification_settings: storedPrefs }]);
    const b = body(); calls.prefWrites.push({ method: m, body: b });
    if (b.notification_settings) storedPrefs = b.notification_settings;
    return json([{ id: "pref-1" }]);
  }
  if (url.includes("/rest/v1/group_chats")) return rows([{ name: "Weekend crew" }]);
  if (url.includes("/rest/v1/group_chat_members")) return rows([{ profile_id: ME }, { profile_id: BEA }, { profile_id: HANA }]);
  if (url.includes("/rest/v1/group_messages") && m === "GET") return rows([
    { id: "g3", sender_id: HANA, content: "Who's in for Saturday?", created_at: iso(30) },
    { id: "g2", sender_id: BEA, content: "Me!", created_at: iso(40) },
    { id: "g1", sender_id: ME, content: "Hi all", created_at: iso(50) },
  ]);
  if (url.includes("/rest/v1/group_messages") && m === "POST") { const b = body(); calls.groupInserts.push(b); return json({ id: "g-new", sender_id: b.sender_id, content: b.content, created_at: new Date().toISOString() }, 201); }
  if (url.includes("/rest/v1/")) return json(m === "GET" ? (wantsObject ? null : []) : null);
  return json({});
});

const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const log = [];
const check = (name, ok, extra = "") => log.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? ` (${extra})` : ""}`);

// 1. Badges + missed call banner on the Chat tab
await page.goto(base + "/matches", { waitUntil: "networkidle" });
await page.waitForTimeout(600);
check("Likes badge shows likes received (4)", await page.getByRole("link", { name: "Likes, 4 new" }).isVisible());
check("Chat badge shows unread (3)", await page.getByRole("link", { name: "Chat, 3 new" }).isVisible());
check("missed phone call banner", await page.getByText("Missed call from Bea").isVisible());
await page.screenshot({ path: `${out}/n1-inbox-badges.png` });
await page.getByRole("button", { name: "Call Bea back" }).click();
await page.waitForURL(/\/video-call\//);
check("call back uses the call type", page.url().includes(`/video-call/${M1}?type=phone`), page.url());
await page.goto(base + "/matches", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Dismiss" }).click();
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(400);
check("dismissed missed call stays dismissed", (await page.getByText("Missed call from Bea").count()) === 0);

// 2. Locked conversation opens the contact sheet above the nav
await page.getByText("Hana").first().click();
await page.getByRole("dialog", { name: "Contact Hana" }).waitFor();
const sheetOnTop = await page.evaluate(() => {
  const nav = document.querySelector("nav");
  const r = nav.getBoundingClientRect();
  const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return !nav.contains(el);
});
check("contact sheet is above the bottom nav", sheetOnTop);
await page.screenshot({ path: `${out}/n2-contact-sheet.png` });
await page.keyboard.press("Escape");
check("Escape closes the sheet", (await page.getByRole("dialog", { name: "Contact Hana" }).count()) === 0);

// 3. Push opt-in prompt (signed in, in-app page) saves the subscription
await page.evaluate(() => localStorage.removeItem("push_notification_prompt_shown"));
await page.reload({ waitUntil: "networkidle" });
await page.getByRole("dialog").getByText("Stay connected").waitFor({ timeout: 6000 }).catch(() => undefined);
check("push prompt appears in the app", await page.getByText("Stay connected").isVisible());
await page.screenshot({ path: `${out}/n3-push-prompt.png` });
// The member says yes to the browser's question.
await ctx.grantPermissions(["notifications"], { origin: base });
await page.getByRole("button", { name: "Enable notifications" }).click();
await page.waitForTimeout(1500);
const sub = calls.pushSubs.find((c) => c.method === "POST");
check("subscription stored in push_subscriptions", !!sub && sub.body.user_id === USER && sub.body.endpoint === "https://push.test/endpoint-1" && sub.body.p256dh === "BPkey" && sub.body.auth === "authkey" && sub.url.includes("on_conflict=user_id,endpoint"), JSON.stringify(sub?.body));
check("prompt closed", (await page.getByText("Stay connected").count()) === 0);

// 4. Push settings page: device switch + saved choices
await page.goto(base + "/push-notifications", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
check("device switch shows on", await page.getByText("On for this device.").isVisible());
await page.screenshot({ path: `${out}/n4-push-settings.png` });
const writesBefore = calls.prefWrites.length;
await page.locator("div", { hasText: /^MessagesSomeone sent you a new message$/ }).getByRole("switch").click();
await page.waitForTimeout(1200);
const pushWrite = calls.prefWrites.slice(writesBefore).find((w) => w.body.notification_settings?.push);
check("push choices saved to the account", pushWrite?.body.notification_settings.push.messages === false, JSON.stringify(pushWrite?.body));
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(800);
const messagesSwitch = page.locator("div", { hasText: /^MessagesSomeone sent you a new message$/ }).getByRole("switch");
check("choice survives a reload (was reset to defaults before)", (await messagesSwitch.getAttribute("aria-checked")) === "false");

// 5. Email settings
await page.goto(base + "/email-settings", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
check("real email shown", await page.getByText("alex@isexy.ca").isVisible());
const before5 = calls.prefWrites.length;
await page.getByRole("switch", { name: "New messages emails" }).click();
await page.waitForTimeout(800);
const emailWrite = calls.prefWrites.slice(before5).find((w) => w.body.notification_settings?.email);
check("email choice saved", emailWrite?.body.notification_settings.email.new_messages === false && emailWrite?.body.notification_settings.push?.messages === false, JSON.stringify(emailWrite?.body));
await page.screenshot({ path: `${out}/n5-email-settings.png` });

// 6. Group chat
await page.goto(base + `/group-chat/${G1}`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
check("group name + members", await page.getByText("Weekend crew").isVisible() && await page.getByText("3 members").isVisible());
check("sender names from one batch", await page.getByText("Hana", { exact: true }).isVisible() && await page.getByText("Who's in for Saturday?").isVisible());
await page.getByRole("button", { name: "Group members" }).click();
check("members sheet", await page.getByRole("dialog", { name: "Group members" }).isVisible() && await page.getByText("Alex (you)").isVisible());
await page.screenshot({ path: `${out}/n6-group-members.png` });
await page.getByRole("button", { name: "Close" }).click();
await page.getByLabel("Message", { exact: true }).fill("Count me in");
await page.keyboard.press("Enter");
await page.waitForTimeout(600);
check("group message sent and shown", calls.groupInserts.length === 1 && calls.groupInserts[0].sender_id === ME && await page.getByText("Count me in").isVisible());
await page.screenshot({ path: `${out}/n7-group-chat.png` });

// 7. Matches list opens unlocked chats directly
await page.goto(base + "/matches-list", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/n8-matches-list.png` });
const opened = page.waitForURL(new RegExp(`/chat/${M1}`), { timeout: 3000 }).then(() => true, () => false);
await page.getByRole("button", { name: /Bea, 30.*See you soon/ }).click();
check("unlocked match opens the chat directly (no contact sheet)", await opened && (await page.getByRole("dialog", { name: "Contact Bea" }).count()) === 0, page.url());

console.log(log.join("\n"));
console.log("pageerrors:", JSON.stringify(errors, null, 1));
const failed = log.filter((l) => l.startsWith("FAIL")).length;
console.log(failed ? `${failed} FAILED` : "ALL PASSED");
await browser.close();
process.exit(failed ? 1 : 0);
