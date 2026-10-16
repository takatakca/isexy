// Two-browser e2e for in-app calls (VideoCall, useCallConnection, IncomingCallNotification).
// Real WebRTC between two Chromium contexts (fake camera/mic); Supabase REST, RPCs and
// Realtime (Phoenix websocket: broadcast relay + postgres_changes) are mocked here.
//
//   NODE_OPTIONS="--import=./e2e/no-network.mjs" npm run build
//   npx vite preview --host 127.0.0.1 --port 4304 --strictPort &
//   node --import ./e2e/offline-browser.mjs e2e/calls-e2e.mjs [outDir] [baseUrl]
// About 3 minutes (ring timeout, out-of-minutes tick and reconnect give-up run in real time).
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { mkdirSync } from "node:fs";

const out = process.argv[2] ?? "/tmp/calls-e2e";
const base = process.argv[3] ?? "http://127.0.0.1:4304";
mkdirSync(out, { recursive: true });

const MATCH = "11111111-0000-4000-8000-000000000001";
const users = {
  alex: { userId: "10000000-0000-4000-8000-00000000000a", profileId: "00000000-0000-4000-8000-00000000000a", name: "Alex" },
  bea: { userId: "10000000-0000-4000-8000-00000000000b", profileId: "00000000-0000-4000-8000-00000000000b", name: "Bea" },
};
const byProfile = (id) => Object.values(users).find((u) => u.profileId === id);

// ---------------- state ----------------
const sessions = new Map(); // id -> row (video_call_sessions)
const plSessions = new Map(); // id -> row (call_sessions, Phone Line)
let plMinutes = 5;
const rpcLog = []; // { who, fn, args }
const signals = []; // broadcast signal payloads (type, seq, from)
const sockets = new Set();
const pageErrors = [];
let seq = 0;
let chargeMode = "ok"; // "ok" | "no_minutes"
let minutes = 10;
const results = [];
// ONLY=8,9 runs just those sections.
const only = process.env.ONLY ? process.env.ONLY.split(",").map(Number) : null;
const run = (n) => !only || only.includes(n);
let failures = 0;
const check = (label, ok, extra = "") => {
  if (!ok) failures++;
  results.push(`${ok ? "PASS" : "FAIL"} ${label}${extra ? `  (${extra})` : ""}`);
};

// ---------------- fake Realtime ----------------
function sendMsg(conn, format, msg) {
  const frame = format === "array" ? JSON.stringify([msg.join_ref ?? null, msg.ref ?? null, msg.topic, msg.event, msg.payload]) : JSON.stringify(msg);
  try { conn.ws.send(frame); } catch { /* closed */ }
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
  if (payload?.event === "signal" && payload.payload) signals.push({ topic, ...payload.payload });
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
    const data = JSON.parse(typeof raw === "string" ? raw : raw.toString());
    const format = Array.isArray(data) ? "array" : "object";
    const m = format === "array" ? { join_ref: data[0], ref: data[1], topic: data[2], event: data[3], payload: data[4] } : data;
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

// ---------------- fake RPCs ----------------
function update(id, patch) {
  const row = sessions.get(id);
  if (!row) return null;
  const old = { ...row };
  Object.assign(row, patch);
  emitPostgres("video_call_sessions", "UPDATE", { ...row }, old);
  return row;
}
function plUpdate(id, patch) {
  const row = plSessions.get(id);
  if (!row) return null;
  const old = { ...row };
  Object.assign(row, patch);
  emitPostgres("call_sessions", "UPDATE", { ...row }, old);
  return row;
}
function rpc(who, fn, args) {
  rpcLog.push({ who, fn, args });
  const me = users[who].profileId;
  const s = args.p_call_session_id ? sessions.get(args.p_call_session_id) : null;
  const pl = args.p_call_session_id ? plSessions.get(args.p_call_session_id) : null;
  switch (fn) {
    case "start_phone_line_call_session": {
      if (plMinutes <= 0) return { success: false, error: "no_minutes", phone_minutes: 0 };
      const id = `44444444-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
      const row = { id, caller_profile_id: me, receiver_profile_id: args.p_target_profile_id, provider: "in_app", call_type: "phone_line_profile", status: "ringing", started_at: new Date().toISOString(), answered_at: null };
      plSessions.set(id, row);
      setTimeout(() => emitPostgres("call_sessions", "INSERT", { ...row }), 50);
      return { success: true, call_session_id: id, phone_minutes: plMinutes, display_name: byProfile(args.p_target_profile_id)?.name ?? "Voice" };
    }
    case "answer_call_session":
      if (!pl || pl.receiver_profile_id !== me) return { success: false, error: "not_found" };
      if (!["ringing", "connected"].includes(pl.status)) return { success: false, error: "call_not_active", status: pl.status };
      if (pl.status !== "connected") plUpdate(pl.id, { status: "connected" });
      return { success: true, status: "connected", caller_name: byProfile(pl.caller_profile_id)?.name };
    case "decline_call_session":
      if (!pl || pl.receiver_profile_id !== me) return { success: false, error: "not_found" };
      plUpdate(pl.id, { status: "declined" });
      return { success: true, status: "declined" };
    case "mark_call_session_connected":
      if (!pl || ![pl.caller_profile_id, pl.receiver_profile_id].includes(me)) return { success: false, error: "not_found" };
      if (pl.status !== "connected") return { success: false, error: "call_not_active", status: pl.status };
      plUpdate(pl.id, { answered_at: pl.answered_at ?? new Date().toISOString() });
      return { success: true };
    case "charge_call_session_minute":
      if (!pl || pl.caller_profile_id !== me) return { success: false, error: "not_authorized" };
      if (pl.status !== "connected" || !pl.answered_at) return { success: false, error: "not_connected" };
      plMinutes -= 1;
      return { success: true, charged: true, remaining: plMinutes };
    case "end_call_session":
      if (!pl) return { success: false, error: "session_not_found" };
      if (["completed", "missed", "declined", "canceled", "failed"].includes(pl.status)) return { success: true, already_ended: true, status: pl.status };
      plUpdate(pl.id, { status: pl.answered_at ? "completed" : args.p_end_reason === "no_answer" ? "missed" : me === pl.receiver_profile_id ? "declined" : "canceled", end_reason: args.p_end_reason });
      return { success: true, status: pl.status };
    case "start_call": {
      const id = `22222222-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
      const other = me === users.alex.profileId ? users.bea.profileId : users.alex.profileId;
      const row = { id, match_id: args.p_match_id, caller_id: me, receiver_id: other, status: "ringing", call_type: args.p_call_type, created_at: new Date().toISOString() };
      sessions.set(id, row);
      setTimeout(() => emitPostgres("video_call_sessions", "INSERT", { ...row }), 50);
      return { success: true, call_session_id: id, remaining: minutes, receiver_id: other };
    }
    case "answer_call":
      if (!s || s.receiver_id !== me) return { success: false, error: "not_found" };
      if (!["ringing", "connecting", "connected"].includes(s.status)) return { success: false, error: "call_not_active", status: s.status };
      if (s.status !== "connected") update(s.id, { status: "connecting" });
      return { success: true, match_id: s.match_id, caller_id: s.caller_id, call_type: s.call_type };
    case "decline_call":
      if (!s || s.receiver_id !== me) return { success: false, error: "not_found" };
      update(s.id, { status: "declined" });
      return { success: true, status: "declined" };
    case "mark_call_connected":
      if (!s || ![s.caller_id, s.receiver_id].includes(me)) return { success: false, error: "not_found" };
      if (!["connecting", "connected"].includes(s.status)) return { success: false, error: "call_not_active" };
      update(s.id, { status: "connected", connected_at: s.connected_at ?? new Date().toISOString() });
      return { success: true };
    case "charge_call_minute":
      if (!s || s.caller_id !== me) return { success: false, error: "not_found" };
      if (s.status !== "connected") return { success: false, error: "call_not_active" };
      if (chargeMode === "no_minutes") return { success: false, error: "no_minutes", remaining: 0 };
      minutes -= 1;
      return { success: true, charged: true, remaining: minutes };
    case "end_call":
      if (!s) return { success: false, error: "not_found" };
      if (["ended", "missed", "declined"].includes(s.status)) return { success: true, already_ended: true, status: s.status };
      update(s.id, { status: s.status === "connected" ? "ended" : me === s.receiver_id ? "declined" : "ended", end_reason: args.p_reason });
      return { success: true, status: s.status };
    case "record_missed_call":
      if (!s || s.caller_id !== me) return { success: false, error: "not_found" };
      if (s.status !== "ringing") return { success: false, error: "call_not_ringing", status: s.status };
      update(s.id, { status: "missed" });
      return { success: true, missed_call_id: "33333333-0000-4000-8000-000000000001" };
    default:
      return null;
  }
}

// ---------------- browser context per member ----------------
const fakeMedia = ({ denyCamera, denyMic, twoCameras }) => {
  // Record every stream handed out (to prove hang-up stops all tracks) and
  // let the test deny camera or microphone.
  window.__streams = [];
  const md = navigator.mediaDevices;
  const real = md.getUserMedia.bind(md);
  md.getUserMedia = async (c) => {
    if (denyMic && c?.audio) throw new DOMException("denied", "NotAllowedError");
    if (denyCamera && c?.video) throw new DOMException("denied", "NotAllowedError");
    const plain = { ...c };
    if (plain.video && typeof plain.video === "object") plain.video = true; // fake device has no facing modes
    const s = await real(plain);
    window.__streams.push(s);
    return s;
  };
  if (twoCameras) {
    const realEnum = md.enumerateDevices.bind(md);
    md.enumerateDevices = async () => [...(await realEnum()), { kind: "videoinput", deviceId: "back", label: "Back camera", groupId: "b" }];
  }
  // Keep every peer connection reachable so the test can simulate a network drop.
  window.__pcs = [];
  const RealPC = window.RTCPeerConnection;
  window.RTCPeerConnection = function (...a) {
    const pc = new RealPC(...a);
    window.__pcs.push(pc);
    for (const prop of ["connectionState", "iceConnectionState"]) {
      const desc = Object.getOwnPropertyDescriptor(RealPC.prototype, prop);
      Object.defineProperty(pc, prop, { get() { return window.__forceIce ?? desc.get.call(pc); } });
    }
    return pc;
  };
  window.RTCPeerConnection.prototype = RealPC.prototype;
  window.__setIce = (state) => {
    window.__forceIce = state ?? undefined;
    for (const pc of window.__pcs) {
      pc.dispatchEvent(new Event("iceconnectionstatechange"));
      pc.dispatchEvent(new Event("connectionstatechange"));
    }
  };
};

async function setup(browser, who, media = {}) {
  const u = users[who];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["camera", "microphone"] });
  await ctx.addInitScript(([u]) => {
    localStorage.setItem("sb-pcjfahhlozsseqqevimi-auth-token", JSON.stringify({ access_token: "h.eyJzdWIiOiIxIn0.s", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r", user: { id: u.userId, aud: "authenticated", role: "authenticated", email: `${u.name}@isexy.ca`, app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" } }));
    localStorage.setItem("isexy_consent", JSON.stringify({ analytics: false, marketing: false, decidedAt: "2026-10-07T00:00:00Z", version: 1 }));
    localStorage.setItem("cubadate_safety_seen", "true");
    sessionStorage.setItem("isexy_assistant_teaser_seen", "1");
  }, [u]);
  await ctx.addInitScript(fakeMedia, media);
  await ctx.routeWebSocket(/realtime\/v1\/websocket/, realtime);
  await ctx.route("**/*.supabase.co/**", async (route) => {
    const req = route.request(); const url = decodeURIComponent(req.url()); const m = req.method();
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*", "access-control-expose-headers": "content-range" }, body: JSON.stringify(body) });
    if (m === "OPTIONS") return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
    const rpcMatch = url.match(/\/rest\/v1\/rpc\/([a-z_]+)/);
    if (rpcMatch) {
      const res = rpc(who, rpcMatch[1], JSON.parse(req.postData() || "{}"));
      if (res) return json(res);
      return json(null);
    }
    if (url.includes("/rest/v1/profiles") && url.includes("user_id=eq")) return json({ id: u.profileId, user_id: u.userId, first_name: u.name, birth_date: "1995-01-01", gender: "x", interested_in: ["everyone"], bio: "bio bio bio", is_premium: false, country: "CA", is_active: true });
    if (url.includes("/rest/v1/profiles")) { const o = Object.values(users).find((x) => url.includes(x.profileId)); return json(o ? { id: o.profileId, first_name: o.name } : null); }
    if (url.includes("/rest/v1/profile_photos") && m === "HEAD") return route.fulfill({ status: 200, headers: { "content-range": "0-0/3", "access-control-allow-origin": "*", "access-control-expose-headers": "content-range" } });
    if (url.includes("/rest/v1/user_preferences")) return json({ preferred_language: "en", auto_translate: false });
    if (url.includes("/rest/v1/matches") && url.includes("profile1_id,profile2_id,is_active")) return json({ profile1_id: users.alex.profileId, profile2_id: users.bea.profileId, is_active: true });
    if (url.includes("/rest/v1/video_call_sessions") && m === "GET") {
      const rows = [...sessions.values()].filter((r) => url.includes(`receiver_id=eq.${r.receiver_id}`) && (!url.includes("status=eq.ringing") || r.status === "ringing"));
      return json(rows.reverse());
    }
    if (url.includes("/rest/v1/video_call_sessions")) { pageErrors.push(`[${who}] direct ${m} on video_call_sessions`); return json(null, 403); }
    if (url.includes("/rest/v1/call_sessions") && m === "GET") {
      const rows = [...plSessions.values()].filter((r) => url.includes(`receiver_profile_id=eq.${r.receiver_profile_id}`) && (!url.includes("status=eq.ringing") || r.status === "ringing"));
      return json(rows.reverse());
    }
    if (url.includes("/rest/v1/call_sessions")) { pageErrors.push(`[${who}] direct ${m} on call_sessions`); return json(null, 403); }
    if (url.includes("/realtime/v1/api/broadcast")) {
      const body = JSON.parse(req.postData() || "{}");
      for (const msg of body.messages ?? []) relayBroadcast(null, msg.topic?.startsWith("realtime:") ? msg.topic : `realtime:${msg.topic}`, { type: "broadcast", event: msg.event, payload: msg.payload });
      return json({}, 202);
    }
    if (url.includes("/functions/v1/")) { rpcLog.push({ who, fn: `fn:${url.split("/functions/v1/")[1]}`, args: JSON.parse(req.postData() || "{}") }); return json({ success: true }); }
    if (url.includes("/rest/v1/")) return json(m === "GET" ? [] : null);
    return json({});
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => pageErrors.push(`[${who} pageerror] ${e.message}`));
  page.on("console", (c) => { if (c.type() === "error" && !/Failed to load resource|status of 40[34]/.test(c.text())) pageErrors.push(`[${who} console] ${c.text().slice(0, 160)}`); });
  return { ctx, page };
}

const flowing = (page, kind = "video") => page.evaluate((kind) => {
  const el = document.querySelector("[data-remote-media]");
  if (!el || !(el.srcObject instanceof MediaStream)) return false;
  const live = el.srcObject.getTracks().some((t) => t.readyState === "live");
  return kind === "video" ? live && el.videoWidth > 0 : live && el.srcObject.getAudioTracks().length > 0;
}, kind);
const waitFor = async (fn, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return Date.now() - t0; await new Promise((r) => setTimeout(r, 300)); } return -1; };
const status = (page) => page.locator("[data-testid=call-status]").textContent({ timeout: 2000 }).catch(() => null);
const fnCalls = (fn, who) => rpcLog.filter((r) => r.fn === fn && (!who || r.who === who));
const allTracksEnded = (page) => page.evaluate(() => window.__streams.flatMap((s) => s.getTracks()).every((t) => t.readyState === "ended"));

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });

// ===== 1. Video call: ring, answer, media both ways, controls, reconnect, hang up =====
if (run(1)) {
  const bea = await setup(browser, "bea");
  await bea.page.goto(`${base}/matches`, { waitUntil: "networkidle" });
  const alex = await setup(browser, "alex", { twoCameras: true });
  await alex.page.goto(`${base}/video-call/${MATCH}?type=video`, { waitUntil: "domcontentloaded" });

  const sheet = bea.page.getByRole("alertdialog", { name: /Incoming video call from Alex/ });
  check("callee sees incoming video call sheet", await sheet.waitFor({ timeout: 10000 }).then(() => true).catch(() => false));
  check("caller shows Ringing… and nothing charged yet", /Ringing/.test(await status(alex.page) ?? "") && fnCalls("charge_call_minute").length === 0, await status(alex.page));
  check("start_call RPC used (no direct table writes)", fnCalls("start_call", "alex").length === 1 && !pageErrors.some((e) => e.includes("direct")));
  check("incoming-call push requested with the session id", fnCalls("fn:isexy-send-whatsapp-call-notification").some((c) => c.args.callSessionId));
  await bea.page.screenshot({ path: `${out}/1_incoming.png` });
  await bea.page.getByRole("button", { name: "Answer" }).click();
  await bea.page.waitForURL(/video-call/);

  const t = await waitFor(async () => (await flowing(alex.page)) && (await flowing(bea.page)));
  check("remote video flowing both ways", t >= 0, `${t} ms`);
  check("signaling on the per-call topic call-<sessionId>", signals.length > 0 && signals.every((s) => /realtime:call-22222222-/.test(s.topic)), signals[0]?.topic);
  await waitFor(async () => fnCalls("charge_call_minute", "alex").length > 0, 5000);
  check("both sides mark connected; only the caller is charged", fnCalls("mark_call_connected").length === 2 && fnCalls("charge_call_minute", "alex").length === 1 && fnCalls("charge_call_minute", "bea").length === 0);
  await alex.page.waitForTimeout(1500);
  check("caller sees minutes left from the server", await alex.page.getByText("9 min left").isVisible().catch(() => false));
  await alex.page.screenshot({ path: `${out}/2_alex_connected.png` });
  await bea.page.screenshot({ path: `${out}/2_bea_connected.png` });

  // mute + camera off reach the other side
  await alex.page.getByRole("button", { name: "Mute" }).click();
  check("peer sees 'Alex muted their microphone'", await bea.page.getByText("Alex muted their microphone").waitFor({ timeout: 5000 }).then(() => true).catch(() => false));
  await alex.page.getByRole("button", { name: "Turn camera off" }).click();
  check("peer sees Alex's camera is off", await bea.page.getByText("Alex's camera is off").waitFor({ timeout: 5000 }).then(() => true).catch(() => false));
  await bea.page.screenshot({ path: `${out}/3_bea_peer_camera_off.png` });
  await alex.page.getByRole("button", { name: "Turn camera on" }).click();
  await alex.page.getByRole("button", { name: "Unmute" }).click();
  check("camera back on: remote video shown again", await bea.page.getByText("Alex's camera is off").waitFor({ state: "hidden", timeout: 5000 }).then(() => true).catch(() => false));

  // speaker
  await bea.page.getByRole("button", { name: "Speaker on" }).click();
  check("speaker off mutes the remote media", await bea.page.evaluate(() => document.querySelector("[data-remote-media]").muted === true));
  await bea.page.getByRole("button", { name: "Speaker off" }).click();

  // switch camera (Alex has 2 cameras reported)
  const before = await alex.page.evaluate(() => window.__pcs.at(-1).getSenders().find((s) => s.track?.kind === "video")?.track?.id);
  await alex.page.getByRole("button", { name: "Switch camera" }).click();
  await alex.page.waitForTimeout(1500);
  const after = await alex.page.evaluate(() => window.__pcs.at(-1).getSenders().find((s) => s.track?.kind === "video")?.track?.id);
  check("switch camera replaces the sent video track", before && after && before !== after, `${before?.slice(0, 8)} -> ${after?.slice(0, 8)}`);
  check("video still flowing to Bea after the switch", (await waitFor(() => flowing(bea.page), 8000)) >= 0);

  // network blip: ICE reported disconnected on both sides -> Reconnecting -> ICE restart -> back
  const offersBefore = signals.filter((s) => s.type === "offer").length;
  await Promise.all([alex.page.evaluate(() => window.__setIce("disconnected")), bea.page.evaluate(() => window.__setIce("disconnected"))]);
  check("Reconnecting shown on drop", await alex.page.getByText("Reconnecting").first().waitFor({ timeout: 5000 }).then(() => true).catch(() => false));
  await alex.page.screenshot({ path: `${out}/4_alex_reconnecting.png` });
  await waitFor(async () => signals.filter((s) => s.type === "offer").length > offersBefore, 8000);
  check("caller sends an ICE-restart offer after the grace period", signals.filter((s) => s.type === "offer").length > offersBefore);
  check("callee asks the caller to restart", signals.some((s) => s.type === "restart"));
  await Promise.all([alex.page.evaluate(() => window.__setIce(null)), bea.page.evaluate(() => window.__setIce(null))]);
  check("back to connected after the restart", await alex.page.getByText("Reconnecting").first().waitFor({ state: "hidden", timeout: 8000 }).then(() => true).catch(() => false));
  check("still exactly one session, no double start", fnCalls("start_call").length === 1);

  // Bea hangs up -> Alex goes back to chat; all tracks stopped on both sides
  await bea.page.getByRole("button", { name: "Hang up" }).click();
  await alex.page.waitForURL(/\/chat\//, { timeout: 10000 }).catch(() => undefined);
  check("peer hang-up returns caller to chat", /\/chat\//.test(alex.page.url()), alex.page.url().replace(base, ""));
  check("end_call RPC called", fnCalls("end_call").length >= 1);
  await bea.page.waitForTimeout(500);
  check("hang-up stops every camera/mic track (callee)", await allTracksEnded(bea.page));
  check("hang-up stops every camera/mic track (caller)", await allTracksEnded(alex.page));
  await alex.ctx.close(); await bea.ctx.close();
}

// ===== 2. Decline =====
if (run(2)) {
  const bea = await setup(browser, "bea");
  await bea.page.goto(`${base}/matches`, { waitUntil: "networkidle" });
  const alex = await setup(browser, "alex");
  await alex.page.goto(`${base}/video-call/${MATCH}?type=phone`, { waitUntil: "domcontentloaded" });
  const sheet = bea.page.getByRole("alertdialog", { name: /Incoming phone call from Alex/ });
  check("audio call sheet shown", await sheet.waitFor({ timeout: 10000 }).then(() => true).catch(() => false));
  await bea.page.getByRole("button", { name: "Decline" }).click();
  check("decline_call RPC used", (await waitFor(async () => fnCalls("decline_call", "bea").length > 0, 5000)) >= 0);
  check("caller sees 'can't take your call' with Call again / Message", await alex.page.getByText("Bea can't take your call right now").waitFor({ timeout: 8000 }).then(() => true).catch(() => false)
    && await alex.page.getByRole("button", { name: "Call again" }).isVisible() && await alex.page.getByRole("button", { name: "Message Bea" }).isVisible());
  await alex.page.screenshot({ path: `${out}/5_alex_declined.png` });
  check("caller tracks stopped after decline", await allTracksEnded(alex.page));
  await alex.ctx.close(); await bea.ctx.close();
}

// ===== 3. Audio-only call connects; callee opened later (catch-up, e.g. from the push) =====
if (run(3)) {
  const alex = await setup(browser, "alex");
  await alex.page.goto(`${base}/video-call/${MATCH}?type=phone`, { waitUntil: "domcontentloaded" });
  await waitFor(async () => /Ringing/.test(await status(alex.page) ?? ""), 8000);
  const bea = await setup(browser, "bea");
  await bea.page.goto(`${base}/matches`, { waitUntil: "networkidle" });
  const sheet = bea.page.getByRole("alertdialog", { name: /Incoming phone call from Alex/ });
  check("callee opening the app later still sees the ringing call", await sheet.waitFor({ timeout: 10000 }).then(() => true).catch(() => false));
  await bea.page.getByRole("button", { name: "Answer" }).click();
  const t = await waitFor(async () => (await flowing(alex.page, "audio")) && (await flowing(bea.page, "audio")));
  check("audio-only call: audio flowing both ways", t >= 0, `${t} ms`);
  check("audio call shows 'On call'", await waitFor(async () => /On call/.test(await status(alex.page) ?? ""), 5000) >= 0);
  check("no camera opened for an audio call", await alex.page.evaluate(() => window.__streams.every((s) => s.getVideoTracks().length === 0)));
  await alex.page.screenshot({ path: `${out}/6_alex_audio_call.png` });

  // out of minutes on the next charge -> clear screen with Buy minutes
  chargeMode = "no_minutes";
  await alex.page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await alex.page.waitForTimeout(31000); // next charge tick
  check("out of minutes ends the call with Buy minutes", await alex.page.getByRole("button", { name: "Buy minutes" }).waitFor({ timeout: 5000 }).then(() => true).catch(() => false));
  await alex.page.screenshot({ path: `${out}/7_alex_out_of_minutes.png` });
  check("callee is told the call ended", (await waitFor(async () => /\/chat\//.test(bea.page.url()), 8000)) >= 0);
  chargeMode = "ok";
  await alex.ctx.close(); await bea.ctx.close();
}

// ===== 4. Camera blocked: audio-only fallback, still receives video =====
if (run(4)) {
  const bea = await setup(browser, "bea");
  await bea.page.goto(`${base}/matches`, { waitUntil: "networkidle" });
  const alex = await setup(browser, "alex", { denyCamera: true });
  await alex.page.goto(`${base}/video-call/${MATCH}?type=video`, { waitUntil: "domcontentloaded" });
  check("camera blocked: banner, call continues on audio", await alex.page.getByText("Camera blocked · you're on audio only").waitFor({ timeout: 8000 }).then(() => true).catch(() => false));
  await bea.page.getByRole("alertdialog").waitFor({ timeout: 10000 });
  await bea.page.getByRole("button", { name: "Answer" }).click();
  const t = await waitFor(() => flowing(alex.page, "video"));
  check("caller without camera still sees the callee's video", t >= 0, `${t} ms`);
  check("callee sees caller's camera is off", await bea.page.getByText("Alex's camera is off").waitFor({ timeout: 8000 }).then(() => true).catch(() => false));
  await alex.page.screenshot({ path: `${out}/8_alex_camera_blocked.png` });
  await alex.page.getByRole("button", { name: "Hang up" }).click();
  await alex.ctx.close(); await bea.ctx.close();
}

// ===== 5. Microphone blocked: nothing rings, clear message =====
if (run(5)) {
  const before = fnCalls("start_call").length;
  const alex = await setup(browser, "alex", { denyMic: true });
  await alex.page.goto(`${base}/video-call/${MATCH}?type=video`, { waitUntil: "domcontentloaded" });
  check("mic blocked: clear message + Try again", await alex.page.getByText("Microphone access is blocked").waitFor({ timeout: 8000 }).then(() => true).catch(() => false)
    && await alex.page.getByRole("button", { name: "Try again" }).isVisible());
  check("mic blocked: nobody was rung", fnCalls("start_call").length === before);
  await alex.page.screenshot({ path: `${out}/9_alex_mic_blocked.png` });
  await alex.ctx.close();
}

// ===== 6. No answer: missed call recorded through the RPC =====
if (run(6)) {
  const alex = await setup(browser, "alex");
  await alex.page.goto(`${base}/video-call/${MATCH}?type=video`, { waitUntil: "domcontentloaded" });
  check("missed: 'Bea didn't answer' after the ring timeout", await alex.page.getByText("Bea didn't answer").waitFor({ timeout: 45000 }).then(() => true).catch(() => false));
  check("missed: record_missed_call RPC by the caller", fnCalls("record_missed_call", "alex").length === 1);
  check("missed: notification function told the session id", fnCalls("fn:isexy-send-missed-call-notification").some((c) => c.args.callSessionId && c.args.callType === "video"));
  await alex.page.screenshot({ path: `${out}/10_alex_missed.png` });
  await alex.ctx.close();
}

// ===== 7. Connection lost for good -> gives up with a clear message =====
if (run(7)) {
  const bea = await setup(browser, "bea");
  await bea.page.goto(`${base}/matches`, { waitUntil: "networkidle" });
  const alex = await setup(browser, "alex");
  await alex.page.goto(`${base}/video-call/${MATCH}?type=video`, { waitUntil: "domcontentloaded" });
  await bea.page.getByRole("alertdialog").waitFor({ timeout: 10000 });
  await bea.page.getByRole("button", { name: "Answer" }).click();
  await waitFor(async () => (await flowing(alex.page)) && (await flowing(bea.page)));
  await Promise.all([alex.page.evaluate(() => window.__setIce("failed")), bea.page.evaluate(() => window.__setIce("failed"))]);
  const shown = await alex.page.getByText("Connection lost").waitFor({ timeout: 35000 }).then(() => true).catch(() => false);
  check("gives up after the reconnect timeout with 'Connection lost'", shown);
  await alex.page.screenshot({ path: `${out}/11_alex_connection_lost.png` });
  check("connection lost: tracks stopped", await allTracksEnded(alex.page));
  await alex.ctx.close(); await bea.ctx.close();
}

// ===== 8. Phone Line call: ring, answer, audio both ways, billed once audio flows, hang up =====
if (run(8)) {
  const bea = await setup(browser, "bea");
  await bea.page.goto(`${base}/phone-line`, { waitUntil: "networkidle" });
  const alex = await setup(browser, "alex");
  await alex.page.goto(`${base}/phone-line/call/new?to=${users.bea.profileId}`, { waitUntil: "domcontentloaded" });
  const sheet = bea.page.getByRole("alertdialog", { name: /Incoming Phone Line call from Alex/ });
  check("phone line: receiver sees the incoming Phone Line call", await sheet.waitFor({ timeout: 10000 }).then(() => true).catch(() => false));
  check("phone line: caller rings, nothing charged", /Ringing/.test(await status(alex.page) ?? "") && fnCalls("charge_call_session_minute").length === 0, await status(alex.page));
  await bea.page.screenshot({ path: `${out}/12_bea_phone_line_incoming.png` });
  await alex.page.screenshot({ path: `${out}/12_alex_phone_line_ringing.png` });
  await bea.page.getByRole("button", { name: "Answer" }).click();
  await bea.page.waitForURL(/phone-line\/call\//);
  const t = await waitFor(async () => (await flowing(alex.page, "audio")) && (await flowing(bea.page, "audio")));
  check("phone line: audio flowing both ways", t >= 0, `${t} ms`);
  check("phone line: both show On call", await waitFor(async () => /On call/.test(await status(alex.page) ?? "") && /On call/.test(await status(bea.page) ?? ""), 8000) >= 0);
  await waitFor(async () => fnCalls("charge_call_session_minute", "alex").length > 0, 5000);
  check("phone line: billing starts after media (caller only)", fnCalls("mark_call_session_connected").length >= 1 && fnCalls("charge_call_session_minute", "alex").length === 1 && fnCalls("charge_call_session_minute", "bea").length === 0);
  check("phone line: no camera opened", await alex.page.evaluate(() => window.__streams.every((s) => s.getVideoTracks().length === 0)));
  check("phone line: signaling on its own topic call-pl-<id>", signals.some((x) => /realtime:call-pl-44444444-/.test(x.topic)));
  await alex.page.waitForTimeout(800);
  await alex.page.screenshot({ path: `${out}/13_alex_phone_line_on_call.png` });
  await alex.page.getByRole("button", { name: "Mute" }).click();
  check("phone line: peer sees the mute", await bea.page.getByText("Alex muted their microphone").waitFor({ timeout: 5000 }).then(() => true).catch(() => false));
  await alex.page.getByRole("button", { name: "Hang up" }).click();
  check("phone line: end_call_session called", (await waitFor(async () => fnCalls("end_call_session").length > 0, 5000)) >= 0);
  await bea.page.waitForURL(/\/phone-line$/, { timeout: 10000 }).catch(() => undefined);
  check("phone line: receiver returns to Phone Line when the caller hangs up", /\/phone-line$/.test(bea.page.url()), bea.page.url().replace(base, ""));
  await alex.page.waitForTimeout(500);
  check("phone line: every mic track stopped (both)", (await allTracksEnded(alex.page)) && (await allTracksEnded(bea.page)));
  await alex.ctx.close(); await bea.ctx.close();
}

// ===== 9. Phone Line: decline, no minutes, microphone blocked =====
if (run(9)) {
  const bea = await setup(browser, "bea");
  await bea.page.goto(`${base}/phone-line`, { waitUntil: "networkidle" });
  const alex = await setup(browser, "alex");
  await alex.page.goto(`${base}/phone-line/call/new?to=${users.bea.profileId}`, { waitUntil: "domcontentloaded" });
  await bea.page.getByRole("alertdialog").waitFor({ timeout: 10000 });
  await bea.page.getByRole("button", { name: "Decline" }).click();
  check("phone line: decline_call_session used", (await waitFor(async () => fnCalls("decline_call_session", "bea").length > 0, 5000)) >= 0);
  check("phone line: caller sees the decline with Leave a voice reply", await alex.page.getByText("Bea can't take your call right now").waitFor({ timeout: 8000 }).then(() => true).catch(() => false)
    && await alex.page.getByRole("button", { name: "Leave a voice reply" }).isVisible());
  await alex.page.screenshot({ path: `${out}/14_alex_phone_line_declined.png` });
  check("phone line: caller mic released after decline", await allTracksEnded(alex.page));
  await alex.ctx.close(); await bea.ctx.close();

  plMinutes = 0;
  const before = fnCalls("start_phone_line_call_session").length;
  const a2 = await setup(browser, "alex");
  await a2.page.goto(`${base}/phone-line/call/new?to=${users.bea.profileId}`, { waitUntil: "domcontentloaded" });
  check("phone line: no minutes -> clear screen with Buy minutes", await a2.page.getByText("You need phone minutes to call").waitFor({ timeout: 8000 }).then(() => true).catch(() => false)
    && await a2.page.getByRole("button", { name: "Buy minutes" }).isVisible());
  check("phone line: no minutes -> nobody rang", plSessions.size === [...plSessions.values()].length && fnCalls("start_phone_line_call_session").length === before + 1 && [...plSessions.values()].every((r) => r.status !== "ringing"));
  await a2.page.screenshot({ path: `${out}/15_alex_phone_line_no_minutes.png` });
  await a2.ctx.close();
  plMinutes = 5;

  const before2 = fnCalls("start_phone_line_call_session").length;
  const a3 = await setup(browser, "alex", { denyMic: true });
  await a3.page.goto(`${base}/phone-line/call/new?to=${users.bea.profileId}`, { waitUntil: "domcontentloaded" });
  check("phone line: mic blocked -> clear message, nobody rang", await a3.page.getByText("Microphone access is blocked").waitFor({ timeout: 8000 }).then(() => true).catch(() => false)
    && fnCalls("start_phone_line_call_session").length === before2);
  await a3.ctx.close();
}

await browser.close();
const errs = pageErrors.filter((e) => !e.includes("direct"));
check("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
console.log(results.join("\n"));
console.log(failures ? `${failures} FAILED` : "ALL PASS");
process.exit(failures ? 1 : 0);
