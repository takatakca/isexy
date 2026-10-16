import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
const [, , out] = process.argv;
const base = process.env.E2E_BASE ?? "http://127.0.0.1:4173";
const MATCH = "11111111-0000-4000-8000-000000000001";
const users = {
  alex: { userId: "10000000-0000-4000-8000-00000000000a", profileId: "00000000-0000-4000-8000-00000000000a", name: "Alex" },
  bea: { userId: "10000000-0000-4000-8000-00000000000b", profileId: "00000000-0000-4000-8000-00000000000b", name: "Bea" },
};
const log = [];
const sessions = new Map();          // id -> row
const sockets = new Set();           // { ws, topics: Map<topic, {bindings, format}> }
const deducted = [];

// ---------- Fake Supabase Realtime (Phoenix) ----------
function sendMsg(conn, format, msg) {
  const frame = format === "array" ? JSON.stringify([msg.join_ref ?? null, msg.ref ?? null, msg.topic, msg.event, msg.payload]) : JSON.stringify(msg);
  try { conn.ws.send(frame); } catch {}
}
function emitPostgres(table, type, record, old) {
  for (const conn of sockets) for (const [topic, t] of conn.topics) {
    for (const b of t.bindings) {
      if (b.table !== table || (b.event !== "*" && b.event !== type)) continue;
      if (b.filter) { const [col, val] = b.filter.split("=eq."); if (String(record[col]) !== val) continue; }
      sendMsg(conn, t.format, { topic, event: "postgres_changes", ref: null, payload: { ids: [b.id], data: { type, table, schema: "isexy", record, old_record: old ?? {}, columns: [], commit_timestamp: new Date().toISOString(), errors: null } } });
    }
  }
}
function relayBroadcast(fromConn, topic, payload) {
  for (const conn of sockets) {
    if (conn === fromConn) continue;
    const t = conn.topics.get(topic);
    if (t) sendMsg(conn, t.format, { topic, event: "broadcast", ref: null, payload });
  }
}
function realtime(ws) {
  const conn = { ws, topics: new Map() };
  sockets.add(conn);
  ws.onMessage((raw) => {
    let m; const data = JSON.parse(typeof raw === "string" ? raw : raw.toString());
    const format = Array.isArray(data) ? "array" : "object";
    m = format === "array" ? { join_ref: data[0], ref: data[1], topic: data[2], event: data[3], payload: data[4] } : data;
    const reply = (response = {}) => sendMsg(conn, format, { topic: m.topic, event: "phx_reply", ref: m.ref, join_ref: m.join_ref, payload: { status: "ok", response } });
    if (m.event === "phx_join") {
      const pg = (m.payload?.config?.postgres_changes ?? []).map((b, i) => ({ ...b, id: 1000 + i }));
      conn.topics.set(m.topic, { bindings: pg, format });
      reply({ postgres_changes: pg });
    } else if (m.event === "phx_leave") { conn.topics.delete(m.topic); reply(); }
    else if (m.event === "heartbeat") reply();
    else if (m.event === "broadcast") { relayBroadcast(conn, m.topic, m.payload); if (m.ref) reply(); }
    else if (m.ref) reply();
  });
  ws.onClose(() => sockets.delete(conn));
}

// ---------- Fake REST ----------
async function setup(browser, who) {
  const u = users[who];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["camera", "microphone"] });
  await ctx.addInitScript(([u]) => {
    localStorage.setItem("sb-pcjfahhlozsseqqevimi-auth-token", JSON.stringify({ access_token: "h.eyJzdWIiOiIxIn0.s", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r", user: { id: u.userId, aud: "authenticated", role: "authenticated", email: `${u.name}@isexy.ca`, app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" } }));
    localStorage.setItem("isexy_consent", JSON.stringify({ analytics: false, marketing: false, decidedAt: "2026-10-07T00:00:00Z", version: 1 }));
    localStorage.setItem("cubadate_safety_seen", "true");
    sessionStorage.setItem("isexy_assistant_teaser_seen", "1");
    localStorage.setItem("push_notification_prompt_shown", "true"); // push opt-in prompt (wf/chat) asked already
  }, [u]);
  await ctx.routeWebSocket(/realtime\/v1\/websocket/, realtime);
  await ctx.route("**/*.supabase.co/**", async (route) => {
    const req = route.request(); const url = req.url(); const m = req.method();
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*", "access-control-expose-headers": "content-range" }, body: JSON.stringify(body) });
    if (m === "OPTIONS") return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
    if (url.includes("/rest/v1/profiles") && url.includes("user_id=eq")) return json({ id: u.profileId, user_id: u.userId, first_name: u.name, birth_date: "1995-01-01", gender: "x", interested_in: ["everyone"], bio: "bio bio bio", is_premium: false, country: "CA", is_active: true });
    if (url.includes("/rest/v1/profiles")) { const other = Object.values(users).find((x) => url.includes(x.profileId)); return json(other ? { id: other.profileId, first_name: other.name } : null); }
    if (url.includes("/rest/v1/profile_photos") && m === "HEAD") return route.fulfill({ status: 200, headers: { "content-range": "0-0/3", "access-control-allow-origin": "*", "access-control-expose-headers": "content-range" } });
    if (url.includes("/rest/v1/user_preferences")) return json({ preferred_language: "en", auto_translate: false });
    if (url.includes("/rest/v1/matches") && url.includes("profile1_id%2Cprofile2_id%2Cis_active")) return json({ profile1_id: users.alex.profileId, profile2_id: users.bea.profileId, is_active: true });
    if (url.includes("/rest/v1/user_credits")) return json({ phone_minutes: 10, video_minutes: 10 });
    if (url.includes("/rpc/deduct_call_minute")) { deducted.push(who); return json({ success: true, remaining: 10 - deducted.length }); }
    if (url.includes("/rest/v1/video_call_sessions") && m === "POST") {
      const body = JSON.parse(req.postData()); const row = { id: "22222222-0000-4000-8000-000000000001", created_at: new Date().toISOString(), ...body };
      sessions.set(row.id, row); log.push(`[db] ${who} INSERT session status=${row.status} type=${row.call_type}`);
      setTimeout(() => emitPostgres("video_call_sessions", "INSERT", row), 50);
      return json({ id: row.id }, 201);
    }
    if (url.includes("/rest/v1/video_call_sessions") && m === "PATCH") {
      const id = decodeURIComponent(url).match(/id=eq\.([0-9a-f-]+)/)?.[1]; const row = sessions.get(id);
      if (row) { const old = { ...row }; Object.assign(row, JSON.parse(req.postData())); log.push(`[db] ${who} UPDATE session status=${row.status}`); emitPostgres("video_call_sessions", "UPDATE", { ...row }, old); }
      return json(null, 204);
    }
    if (url.includes("/realtime/v1/api/broadcast")) {
      const body = JSON.parse(req.postData() || "{}");
      for (const msg of body.messages ?? []) relayBroadcast(null, msg.topic?.startsWith("realtime:") ? msg.topic : `realtime:${msg.topic}`, { type: "broadcast", event: msg.event, payload: msg.payload });
      return json({}, 202);
    }
    if (url.includes("/functions/v1/")) return json({ success: true });
    if (url.includes("/rest/v1/")) return json(m === "GET" ? [] : null);
    return json({});
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => log.push(`[${who} pageerror] ${e.message}`));
  page.on("console", (c) => { if (c.type() === "error" && !/Failed to load resource/.test(c.text())) log.push(`[${who} console] ${c.text().slice(0, 140)}`); });
  return { ctx, page };
}

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });
const bea = await setup(browser, "bea");
await bea.page.goto(base + "/matches", { waitUntil: "networkidle" });     // Bea is in the app, idle
const alex = await setup(browser, "alex");
await alex.page.goto(`${base}/video-call/${MATCH}?type=video`, { waitUntil: "domcontentloaded" });

// Bea sees the incoming call
const sheet = bea.page.getByRole("alertdialog", { name: /Incoming video call from Alex/ });
await sheet.waitFor({ timeout: 10000 });
log.push(`Bea sees incoming call sheet: ${await sheet.isVisible()}`);
log.push(`Alex status before answer: "${await alex.page.locator("p[aria-live=polite]").textContent()}"  minutes charged so far: ${deducted.length}`);
await bea.page.screenshot({ path: `${out}/call_incoming.png` });
await bea.page.getByRole("button", { name: "Answer" }).click();
await bea.page.waitForURL(/video-call/);
log.push(`Bea url: ${bea.page.url().replace(base, "")}`);

// Media actually flows both ways
const flowing = async (page) => page.evaluate(() => {
  const v = document.querySelector("video[data-remote-media]");
  return !!v && v.srcObject instanceof MediaStream && v.srcObject.getTracks().some((t) => t.readyState === "live") && v.videoWidth > 0;
});
const t0 = Date.now();
let ok = false;
while (Date.now() - t0 < 20000) { if ((await flowing(alex.page)) && (await flowing(bea.page))) { ok = true; break; } await alex.page.waitForTimeout(500); }
log.push(`remote video flowing both ways: ${ok} after ${Date.now() - t0}ms`);
await alex.page.waitForTimeout(2500);
const timer = await alex.page.locator(".tabular-nums").first().textContent().catch(() => null);
log.push(`Alex timer: ${timer}  minutes charged: ${JSON.stringify(deducted)} (only caller, only once connected)`);
await alex.page.screenshot({ path: `${out}/call_alex_connected.png` });
await bea.page.screenshot({ path: `${out}/call_bea_connected.png` });

// Bea hangs up -> Alex is told and leaves
await bea.page.getByRole("button", { name: "Hang up" }).click();
await alex.page.waitForURL(/\/chat\//, { timeout: 10000 }).catch(() => undefined);
log.push(`after Bea hangs up -> Alex url: ${alex.page.url().replace(base, "")}`);

// Decline scenario
sessions.clear();
// Bea is in the app first, then the call comes (IncomingCallNotification only
// hears calls that start while it is listening; see docs/HANDOFF.md).
await bea.page.goto(base + "/matches", { waitUntil: "networkidle" });
await alex.page.goto(`${base}/video-call/${MATCH}?type=phone`, { waitUntil: "domcontentloaded" });
const sheet2 = bea.page.getByRole("alertdialog", { name: /Incoming phone call from Alex/ });
await sheet2.waitFor({ timeout: 10000 }).catch(() => undefined);
log.push(`phone call sheet shown: ${await sheet2.isVisible()}`);
await bea.page.getByRole("button", { name: "Decline" }).click();
await alex.page.waitForURL(/\/chat\//, { timeout: 10000 }).catch(() => undefined);
log.push(`after decline -> Alex url: ${alex.page.url().replace(base, "")}  minutes charged total: ${deducted.length}`);
console.log(log.join("\n"));
await browser.close();
