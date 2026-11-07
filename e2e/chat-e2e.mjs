// Chat end-to-end against `vite preview` with a mocked Supabase (REST, RPC,
// functions AND the realtime websocket: nothing reaches a real backend).
//   npm run build && npx vite preview --port 4303 --strictPort
//   node e2e/chat-e2e.mjs http://127.0.0.1:4303 /tmp/chat-shots public/og-image.png
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { readFileSync, mkdirSync } from "node:fs";

const [, , base = "http://127.0.0.1:4303", out = "./shots", pngPath = "public/og-image.png"] = process.argv;
mkdirSync(out, { recursive: true });
const png = readFileSync(pngPath);
const USER = "00000000-0000-4000-8000-00000000000a", ME = USER; // profiles.id = user_id
const BEA = "00000000-0000-4000-8000-000000000100", HANA = "00000000-0000-4000-8000-000000000101";
const M1 = "11111111-0000-4000-8000-000000000001", M2 = "11111111-0000-4000-8000-000000000002";
const now = Date.now();
const iso = (minAgo) => new Date(now - minAgo * 60000).toISOString();

// 120 messages over 3 days, alternating, Bea writes in Spanish.
const history = [];
for (let i = 0; i < 120; i++) {
  const mine = i % 3 === 0;
  history.push({
    id: `00000000-0000-4000-9000-${String(i).padStart(12, "0")}`,
    match_id: M1,
    sender_id: mine ? ME : BEA,
    content: mine ? `My message number ${i}` : `Mensaje número ${i} de Bea`,
    is_read: mine ? true : i < 117,
    created_at: iso((120 - i) * 40),
  });
}
const inbox = [
  { match_id: M1, matched_at: iso(9000), other_id: BEA, first_name: "Bea", photo_url: "https://img.test/bea.png", is_verified: true, last_active_at: iso(2), last_message_at: history.at(-1).created_at, last_message_preview: history.at(-1).content, last_message_mine: false, unread_count: 3, is_unlocked: true },
  { match_id: M2, matched_at: iso(60), other_id: HANA, first_name: "Hana", photo_url: "https://img.test/hana.png", is_verified: false, last_active_at: null, last_message_at: null, last_message_preview: null, last_message_mine: null, unread_count: 0, is_unlocked: true },
];
const cachedIds = new Set(history.slice(-6).filter((m) => m.sender_id === BEA).slice(0, 1).map((m) => m.id));

const calls = { markRead: [], translate: [], push: [], email: [], inserts: [], olderPages: [], cacheReads: 0, badge: 0 };
let failInsert = false;

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript(([USER]) => {
  localStorage.setItem("sb-pcjfahhlozsseqqevimi-auth-token", JSON.stringify({ access_token: "h.eyJzdWIiOiIxIn0.s", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r", user: { id: USER, aud: "authenticated", role: "authenticated", email: "t@isexy.ca", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" } }));
  localStorage.setItem("isexy_consent", JSON.stringify({ analytics: false, marketing: false, decidedAt: "2026-10-07T00:00:00Z", version: 1 }));
  localStorage.setItem("cubadate_safety_seen", "true");
  localStorage.setItem("push_notification_prompt_shown", "true");
  sessionStorage.setItem("isexy_assistant_teaser_seen", "1");
}, [USER]);
await ctx.route("https://img.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: png }));

// ---- Realtime (Phoenix vsn 1.0.0 JSON) ----------------------------------------
const sockets = [];
let bindingId = 1000;
await ctx.routeWebSocket(/supabase\.co\/realtime/, (ws) => {
  const state = { ws, topics: new Map() };
  sockets.push(state);
  ws.onMessage((raw) => {
    const msg = JSON.parse(String(raw));
    const { topic, event, payload, ref, join_ref } = msg;
    const reply = (response = {}) => ws.send(JSON.stringify({ topic, event: "phx_reply", payload: { status: "ok", response }, ref, join_ref }));
    if (event === "phx_join") {
      const pc = (payload?.config?.postgres_changes ?? []).map((b) => ({ ...b, id: bindingId++ }));
      state.topics.set(topic, { join_ref: join_ref ?? ref, pc });
      reply({ postgres_changes: pc });
    } else {
      reply({});
    }
  });
});
const rt = {
  topics() { return sockets.flatMap((s) => [...s.topics.keys()]); },
  send(topicPart, event, payload) {
    let n = 0;
    for (const s of sockets) for (const [topic, t] of s.topics) {
      if (!topic.includes(topicPart)) continue;
      s.ws.send(JSON.stringify({ topic, event, payload, ref: null, join_ref: t.join_ref }));
      n++;
    }
    return n;
  },
  change(topicPart, type, table, record) {
    let n = 0;
    for (const s of sockets) for (const [topic, t] of s.topics) {
      if (!topic.includes(topicPart)) continue;
      const ids = t.pc.filter((b) => b.table === table && (b.event === "*" || b.event === type)).map((b) => b.id);
      if (!ids.length) continue;
      s.ws.send(JSON.stringify({ topic, event: "postgres_changes", payload: { ids, data: { type, schema: "isexy", table, commit_timestamp: new Date().toISOString(), columns: [], record, old_record: type === "INSERT" ? undefined : record, errors: null } }, ref: null, join_ref: t.join_ref }));
      n++;
    }
    return n;
  },
};

// ---- REST / RPC / functions ------------------------------------------------------
await ctx.route("**/*.supabase.co/**", async (route) => {
  const req = route.request(); const url = decodeURIComponent(req.url()); const m = req.method();
  const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*", "access-control-expose-headers": "content-range" }, body: JSON.stringify(body) });
  if (m === "OPTIONS") return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
  const body = () => { try { return JSON.parse(req.postData() || "{}"); } catch { return {}; } };

  if (url.includes("/rest/v1/profiles") && url.includes("user_id=eq")) return json({ id: ME, user_id: USER, first_name: "Alex", birth_date: "1995-01-01", gender: "man", interested_in: ["women"], bio: "Montréal", is_premium: false, country: "Canada", is_active: true });
  if (url.includes("/rest/v1/profile_photos") && m === "HEAD") return route.fulfill({ status: 200, headers: { "content-range": "0-0/3", "access-control-allow-origin": "*", "access-control-expose-headers": "content-range" } });
  if (url.includes("/rest/v1/profiles") && url.includes(`id=eq.${BEA}`)) return json([{ id: BEA, first_name: "Bea" }]);
  if (url.includes("/rest/v1/profile_photos") && url.includes(BEA)) return json([{ photo_url: "https://img.test/bea.png" }]);
  if (url.includes("/rpc/get_my_conversations")) return json(inbox);
  if (url.includes("/rpc/get_my_badge_counts")) { calls.badge++; return json([{ unread_messages: 3, new_likes: 4 }]); }
  if (url.includes("/rpc/mark_messages_read")) { calls.markRead.push(body()); return json(3); }
  if (url.includes("/rest/v1/user_preferences")) return json({ preferred_language: "en", auto_translate: true });
  if (url.includes("/rest/v1/matches") && url.includes(`id=eq.${M1}`)) return json([{ profile1_id: ME, profile2_id: BEA, is_active: true }]);
  if (url.includes("/rest/v1/matches") && url.includes(`id=eq.${M2}`)) return json([{ profile1_id: ME, profile2_id: HANA, is_active: true }]);
  if (url.includes("/rest/v1/profiles") && url.includes(`id=eq.${HANA}`)) return json([{ id: HANA, first_name: "Hana" }]);
  if (url.includes("/rest/v1/conversation_unlocks")) return json(url.includes(M1) ? [{ id: "unlock-1" }] : []);
  if (url.includes("/rest/v1/message_translations") && m === "GET") {
    calls.cacheReads++;
    return json([...cachedIds].filter((id) => url.includes(id)).map((id) => ({ message_id: id, translated_content: `CACHED translation of ${id.slice(-3)}` })));
  }
  if (url.includes("/rest/v1/messages") && m === "GET") {
    const lt = /created_at=lt\.([^&]+)/.exec(url)?.[1];
    const limit = Number(/limit=(\d+)/.exec(url)?.[1] ?? 1000);
    if (lt) calls.olderPages.push(lt);
    const rows = history.filter((h) => !lt || h.created_at < lt).slice().reverse().slice(0, limit);
    return json(rows);
  }
  if (url.includes("/rest/v1/messages") && m === "POST") {
    const b = body(); calls.inserts.push(b.content);
    await new Promise((r) => setTimeout(r, 700));
    if (failInsert) return json({ message: "Failed to fetch", code: "500" }, 500);
    const row = { id: `srv-${calls.inserts.length}`, ...b, is_read: false, created_at: new Date().toISOString() };
    return json(row, 201);
  }
  if (url.includes("/functions/v1/isexy-send-notification-email")) { calls.email.push(body()); return json({ success: true }); }
  if (url.includes("/functions/v1/isexy-send-push-notification")) { calls.push.push(body()); return json({ success: true }); }
  if (url.includes("/functions/v1/isexy-translate-message")) {
    const b = body(); calls.translate.push(b.messageId ?? b.text);
    return json({ translatedText: b.text.startsWith("Mensaje") ? b.text.replace("Mensaje número", "Message number").replace("de Bea", "from Bea") : b.text });
  }
  if (url.includes("/rest/v1/")) return json(m === "GET" ? [] : null);
  return json({});
});

const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (msg) => { if (msg.type() === "error") errors.push("console: " + msg.text()); });
const log = [];
const check = (name, ok, extra = "") => log.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? ` (${extra})` : ""}`);
const scroller = () => page.locator("main").first();
const scrollInfo = () => scroller().evaluate((el) => ({ top: Math.round(el.scrollTop), h: el.scrollHeight, ch: el.clientHeight }));

// 1. Inbox → open Bea
await page.goto(base + "/matches", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/01-inbox.png` });
await page.getByText(history.at(-1).content).click();
await page.waitForURL(/\/chat\//);
await page.getByText(history.at(-1).content).first().waitFor();
await page.waitForTimeout(1200);
const s1 = await scrollInfo();
check("opens at newest message", s1.h - s1.top - s1.ch < 4, JSON.stringify(s1));
check("first page only (50) + load earlier button", (await page.getByText("Load earlier messages").count()) === 1 && (await page.getByText("Mensaje número 69 de Bea").count()) === 0);
check("mark_messages_read RPC called for M1", calls.markRead.some((b) => b.p_match_id === M1), JSON.stringify(calls.markRead));
check("translation cache read before translating", calls.cacheReads >= 1);
check("cached translation shown", (await page.getByText(/CACHED translation/).count()) >= 1);
check("translate called with messageId", calls.translate.length > 0 && calls.translate.every((t) => /^0{8}-/.test(t)), `${calls.translate.length} calls`);
check("translations capped on open (<= 30)", calls.translate.length <= 30);
check("translation shown", await page.getByText("Message number 118 from Bea").isVisible().catch(() => false));
check("auto-translate banner", await page.getByText(/Auto-translating to/).isVisible());
check("day separator rendered", (await page.getByText(/Today|Yesterday/).count()) >= 1);
await page.screenshot({ path: `${out}/02-chat-open.png` });

// 2. Scroll to top → older page, position kept
const firstVisibleBefore = "Mensaje número 70 de Bea";
await scroller().evaluate((el) => { el.scrollTop = 0; });
await page.waitForTimeout(1200);
const s2 = await scrollInfo();
check("older page requested on scroll-up", calls.olderPages.length === 1, calls.olderPages.join(","));
check("older messages rendered", (await page.getByText("Mensaje número 22 de Bea").count()) === 1);
check("reader keeps place after prepend (not jumped to top)", s2.top > 500, JSON.stringify(s2));
const keptVisible = await page.getByText(firstVisibleBefore, { exact: true }).evaluate((el) => { const r = el.getBoundingClientRect(); return r.top > 0 && r.bottom < 844; }).catch(() => false);
check("message that was at the top is still on screen", keptVisible);
await page.screenshot({ path: `${out}/03-older-loaded.png` });
await scroller().evaluate((el) => { el.scrollTop = 0; });
await page.waitForTimeout(1000);
check("second older page then start of conversation", calls.olderPages.length === 2 && (await page.getByText("Start of your conversation").count()) === 1, String(calls.olderPages.length));

// 3. Send: optimistic, confirmed, notifications
await scroller().evaluate((el) => { el.scrollTop = el.scrollHeight; });
await page.waitForTimeout(300);
const input = page.getByLabel("Message", { exact: true });
await input.fill("Hola Bea! Line one");
await page.keyboard.press("Shift+Enter");
await page.keyboard.type("line two");
check("Shift+Enter makes a new line", (await input.inputValue()) === "Hola Bea! Line one\nline two");
const t0 = Date.now();
await page.keyboard.press("Enter");
await page.getByText("line two", { exact: false }).first().waitFor({ timeout: 1500 });
check("optimistic bubble immediately", Date.now() - t0 < 600, `${Date.now() - t0}ms`);
check("sending clock shown", await page.getByLabel("Sending").isVisible().catch(() => false));
await page.waitForTimeout(1000);
check("confirmed (clock gone, one copy)", !(await page.getByLabel("Sending").isVisible().catch(() => false)) && (await page.getByText(/line two/).count()) === 1);
check("push sent without message text", calls.push.length === 1 && calls.push[0].body === "Sent you a message" && calls.push[0].data?.url === `/chat/${M1}`, JSON.stringify(calls.push[0]));
check("email notification requested", calls.email.length === 1 && calls.email[0].matchId === M1);
const s3 = await scrollInfo();
check("scrolled to my new message", s3.h - s3.top - s3.ch < 4, JSON.stringify(s3));

// 4. Failure → Retry
failInsert = true;
await input.fill("This one fails first");
await page.keyboard.press("Enter");
await page.getByText("Not sent").waitFor({ timeout: 3000 });
check("failed send keeps bubble with Retry", (await page.getByText("This one fails first").count()) === 1 && await page.getByRole("button", { name: "Retry" }).isVisible());
await page.screenshot({ path: `${out}/04-failed-send.png` });
failInsert = false;
await page.getByRole("button", { name: "Retry" }).click();
await page.waitForTimeout(1200);
check("retry delivers (Not sent gone)", (await page.getByText("Not sent").count()) === 0 && (await page.getByText("This one fails first").count()) === 1 && calls.inserts.filter((c) => c === "This one fails first").length === 2);

// 5. Realtime receive, typing, presence
check("realtime joined chat topic", rt.topics().some((t) => t.includes(`chat-${M1}`)), rt.topics().join(","));
const markBefore = calls.markRead.length;
rt.send(`chat-${M1}`, "broadcast", { type: "broadcast", event: "typing", payload: { profileId: BEA } });
await page.waitForTimeout(300);
check("typing indicator", await page.getByText("typing…").isVisible());
await page.screenshot({ path: `${out}/05-typing.png` });
const live = { id: "00000000-0000-4000-9000-900000000001", match_id: M1, sender_id: BEA, content: "Mensaje en vivo de Bea", is_read: false, created_at: new Date().toISOString() };
rt.change(`chat-${M1}`, "INSERT", "messages", live);
await page.getByText("Mensaje en vivo de Bea").waitFor({ timeout: 2000 });
await page.waitForTimeout(800);
check("realtime message shown", true);
check("typing cleared on message", !(await page.getByText("typing…").isVisible()));
check("incoming message marked read via RPC", calls.markRead.length > markBefore);
check("incoming message translated", calls.translate.includes(live.id));
// read receipt from Bea on my message
rt.change(`chat-${M1}`, "UPDATE", "messages", { id: "srv-1", match_id: M1, sender_id: ME, content: "Hola Bea! Line one\nline two", is_read: true, created_at: new Date(now).toISOString() });
await page.waitForTimeout(300);
check("read receipt updates to Read", (await page.getByLabel("Read").count()) >= 1);

// 6. New-message pill when scrolled up
await scroller().evaluate((el) => { el.scrollTop = el.scrollHeight - el.clientHeight - 1500; });
await page.waitForTimeout(300);
rt.change(`chat-${M1}`, "INSERT", "messages", { ...live, id: "00000000-0000-4000-9000-900000000002", content: "Otro mensaje", created_at: new Date().toISOString() });
await page.getByText("New message", { exact: true }).waitFor({ timeout: 2000 }).catch(() => undefined);
check("new message pill instead of yanking the reader down", await page.getByText("New message", { exact: true }).isVisible());
await page.screenshot({ path: `${out}/06-new-pill.png` });
await page.getByText("New message", { exact: true }).click();
await page.waitForTimeout(700);
const s6 = await scrollInfo();
check("pill scrolls to newest", s6.h - s6.top - s6.ch < 4, JSON.stringify(s6));

// 7. Presence: Bea in the chat → no push for the next message
rt.send(`chat-${M1}`, "presence_state", { [BEA]: { metas: [{ phx_ref: "p1", visible: true }] } });
await page.waitForTimeout(300);
check("presence shows 'In this chat now'", await page.getByText("In this chat now").isVisible());
const pushBefore = calls.push.length;
await input.fill("You are here");
await page.keyboard.press("Enter");
await page.waitForTimeout(1200);
check("no push while the other member is in the chat", calls.push.length === pushBefore);
await page.screenshot({ path: `${out}/07-final.png` });

// 8. Direct link to a conversation that is not unlocked: same rule as the inbox
await page.goto(base + `/chat/${M2}`, { waitUntil: "networkidle" });
await page.getByRole("dialog", { name: "Contact Hana" }).waitFor({ timeout: 3000 }).catch(() => undefined);
check("locked chat shows the contact sheet", await page.getByRole("dialog", { name: "Contact Hana" }).isVisible());
check("composer disabled while locked", await page.getByLabel("Message", { exact: true }).isDisabled());
await page.screenshot({ path: `${out}/08-locked-chat.png` });
await page.keyboard.press("Escape");
await page.waitForURL(/\/matches$/, { timeout: 3000 }).catch(() => undefined);
check("closing the sheet goes back to the inbox", page.url().endsWith("/matches"), page.url());

console.log(log.join("\n"));
console.log("pageerrors:", JSON.stringify(errors.filter((e) => !/websocket|WebSocket/.test(e)), null, 1));
const failed = log.filter((l) => l.startsWith("FAIL")).length;
console.log(failed ? `${failed} FAILED` : "ALL PASSED");
await browser.close();
process.exit(failed ? 1 : 0);
