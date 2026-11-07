// Phone Line pages e2e (one browser, fake microphone, mocked Supabase):
// voice recorder (WAV upload, microphone released on stop / leave / max
// length, blocked microphone), Voice profile save rules (no status on Save
// draft, banned stays banned, new greeting before older ones are switched
// off), hub statuses + link my phone for the IVR, Browse voices (audio stops
// on leaving, reply recorder, load error), Voice inbox, staff review queue.
//
//   VITE_PHONE_LINE_NUMBER="+1 514 555 0100" NODE_OPTIONS="--import=./e2e/no-network.mjs" npm run build
//   npx vite preview --host 127.0.0.1 --port 4304 --strictPort &
//   node --import ./e2e/offline-browser.mjs e2e/calls-phone-line-pages.mjs [outDir] [baseUrl]
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { mkdirSync } from "node:fs";

const out = process.argv[2] ?? "/tmp/calls-phone-line-pages";
const base = process.argv[3] ?? "http://127.0.0.1:4304";
mkdirSync(out, { recursive: true });

const SUPA = "https://pcjfahhlozsseqqevimi.supabase.co";
const me = { userId: "10000000-0000-4000-8000-0000000000aa", profileId: "00000000-0000-4000-8000-0000000000aa", name: "Mia" };
const BEE = "00000000-0000-4000-8000-0000000000bb";

const results = [];
let failures = 0;
const check = (label, ok, extra = "") => {
  if (!ok) failures++;
  results.push(`${ok ? "PASS" : "FAIL"} ${label}${extra ? `  (${String(extra).slice(0, 200)})` : ""}`);
};
const pageErrors = [];

// ---------------- mocked backend state ----------------
const draftProfile = () => ({ id: "pl-me", profile_id: me.profileId, display_name: "Mia", age: 25, city: "Laval", gender: "woman", headline: null, status: "draft", is_public: false, last_active_at: null });
const state = {
  plProfile: draftProfile(),
  greetings: [],
  browse: [{ id: "pl-bee", profile_id: BEE, display_name: "Bee", age: 28, city: "Montréal", headline: "Hi there" }],
  browseGreetings: [{ id: "g-bee", phone_line_profile_id: "pl-bee", duration_seconds: 12, created_at: "2026-10-10T00:00:00Z" }],
  failBrowse: false,
  received: [{ id: "r-1", from_profile_id: BEE, to_profile_id: me.profileId, duration_seconds: 5, is_read: false, created_at: "2026-10-15T10:00:00Z" }],
  numbers: [],
  linkResult: { success: false, error: "no_verified_phone" },
  admin: false,
  reviews: [
    { greeting_id: "g-1", phone_line_profile_id: "pl-bee", profile_id: BEE, display_name: "Bee", age: 28, city: "Montréal", headline: "Hi there", profile_status: "active", duration_seconds: 12, report_count: 0, moderation_status: "pending", created_at: "2026-10-15T10:00:00Z" },
    { greeting_id: "g-2", phone_line_profile_id: "pl-cee", profile_id: "cee", display_name: "Cee", age: 33, city: null, headline: null, profile_status: "active", duration_seconds: 20, report_count: 2, moderation_status: "approved", created_at: "2026-10-14T10:00:00Z" },
  ],
  inApp: [{ id: "v-1", match_id: "m-1", caller_id: me.profileId, receiver_id: BEE, call_type: "video", status: "ended", created_at: "2026-10-15T10:00:00Z", connected_at: "2026-10-15T10:00:05Z", ended_at: "2026-10-15T10:03:00Z", duration_seconds: 175, credits_used: 3, end_reason: "hangup" }],
};
const writes = []; // { table, method, url, body }
const uploads = []; // { bucket, path, buf }
const rpcs = []; // { fn, args }
const fns = []; // { fn, args }
const getUrls = [];

/** 1 s, 440 Hz, 16 kHz mono WAV for greeting / reply playback. */
function sineWav() {
  const rate = 16000, n = rate;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVE", 8); buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 8000), 44 + i * 2);
  return buf;
}
const WAV = sineWav();

/** The WAV inside a multipart upload: header fields, or null. */
function wavInfo(buf) {
  const i = buf.indexOf("RIFF");
  if (i < 0 || buf.toString("latin1", i + 8, i + 12) !== "WAVE") return null;
  return { format: buf.readUInt16LE(i + 20), channels: buf.readUInt16LE(i + 22), rate: buf.readUInt32LE(i + 24), bits: buf.readUInt16LE(i + 34), dataBytes: buf.readUInt32LE(i + 40), partType: /content-type:\s*([^\r\n]+)/i.exec(buf.toString("latin1", 0, i))?.[1]?.trim() };
}

function rpc(fn, args) {
  rpcs.push({ fn, args });
  switch (fn) {
    case "link_my_verified_phone":
      if (state.linkResult.success) state.numbers = [{ phone_number_e164: "+15145550123" }];
      return state.linkResult;
    case "get_voice_greetings_for_review":
      return state.reviews;
    case "review_voice_greeting":
      state.reviews = state.reviews.filter((r) => r.greeting_id !== args.p_greeting_id);
      return { success: true, moderation_status: args.p_approve ? "approved" : "rejected" };
    case "mark_voice_reply_read":
      return { success: true };
    default:
      return null;
  }
}

function rest(table, method, url, accept, body) {
  const object = accept.includes("vnd.pgrst.object");
  const one = (row) => (object ? row : row ? [row] : []);
  if (method !== "GET" && method !== "HEAD") writes.push({ table, method, url, body });
  switch (table) {
    case "profiles":
      if (url.includes("user_id=eq")) return one({ id: me.profileId, user_id: me.userId, first_name: me.name, birth_date: "1995-01-01", gender: "woman", city: "Laval", interested_in: ["everyone"], bio: "bio bio bio", is_premium: false, country: "CA", is_active: true });
      return [{ id: BEE, first_name: "Bee", city: "Montréal" }];
    case "user_roles":
      return state.admin ? one({ role: "admin" }) : object ? null : [];
    case "phone_line_profiles":
      if (method === "GET" && url.includes("status=eq.active")) return state.failBrowse ? { __status: 500 } : state.browse;
      if (method === "GET") return one(state.plProfile);
      if (method === "PATCH") { Object.assign(state.plProfile, body); return { __status: 204 }; }
      if (method === "POST") { state.plProfile = { id: "pl-me", ...body }; return object ? { id: "pl-me" } : { __status: 201 }; }
      return [];
    case "voice_greetings":
      if (method === "GET" && url.includes("phone_line_profile_id=in.")) return state.browseGreetings;
      if (method === "GET") return object ? state.greetings[0] ?? null : state.greetings;
      if (method === "POST") return object ? { id: "g-new" } : { __status: 201 };
      return { __status: 204 };
    case "phone_line_numbers":
      return state.numbers;
    case "phone_line_voice_replies":
      if (method === "GET") { getUrls.push(url); return url.includes("to_profile_id=eq") ? state.received : []; }
      return { __status: 201 };
    case "video_call_sessions":
      return state.inApp;
    case "call_sessions":
    case "call_minute_transactions":
    case "blocks":
      return [];
    default:
      return method === "GET" ? [] : { __status: 204 };
  }
}

// ---------------- browser context ----------------
const initScript = ({ user, denyMic }) => {
  localStorage.setItem("sb-pcjfahhlozsseqqevimi-auth-token", JSON.stringify({ access_token: "h.eyJzdWIiOiIxIn0.s", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r", user: { id: user.userId, aud: "authenticated", role: "authenticated", email: "mia@isexy.ca", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" } }));
  localStorage.setItem("isexy_consent", JSON.stringify({ analytics: false, marketing: false, decidedAt: "2026-10-07T00:00:00Z", version: 1 }));
  localStorage.setItem("cubadate_safety_seen", "true");
  sessionStorage.setItem("isexy_assistant_teaser_seen", "1");
  // Every microphone stream and every played <audio> stays reachable for the checks.
  window.__streams = [];
  window.__audios = [];
  const md = navigator.mediaDevices;
  const real = md.getUserMedia.bind(md);
  md.getUserMedia = async (c) => {
    if (denyMic && c?.audio) throw new DOMException("denied", "NotAllowedError");
    const s = await real(c);
    window.__streams.push(s);
    return s;
  };
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...a) {
    if (!window.__audios.includes(this)) window.__audios.push(this);
    return play.apply(this, a);
  };
};

function realtime(ws) {
  ws.onMessage((raw) => {
    const data = JSON.parse(typeof raw === "string" ? raw : raw.toString());
    const arr = Array.isArray(data);
    const m = arr ? { join_ref: data[0], ref: data[1], topic: data[2], event: data[3], payload: data[4] } : data;
    if (!m.ref) return;
    const payload = { status: "ok", response: m.event === "phx_join" ? { postgres_changes: (m.payload?.config?.postgres_changes ?? []).map((b, i) => ({ ...b, id: i + 1 })) } : {} };
    const msg = { topic: m.topic, event: "phx_reply", ref: m.ref, join_ref: m.join_ref, payload };
    ws.send(arr ? JSON.stringify([msg.join_ref ?? null, msg.ref, msg.topic, msg.event, msg.payload]) : JSON.stringify(msg));
  });
}

async function setup(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["microphone"] });
  await ctx.addInitScript(initScript, { user: me, denyMic: !!opts.denyMic });
  await ctx.routeWebSocket(/realtime\/v1\/websocket/, realtime);
  await ctx.route("**/*.supabase.co/**", async (route) => {
    const req = route.request();
    const url = decodeURIComponent(req.url());
    const m = req.method();
    const cors = { "access-control-allow-origin": "*", "access-control-expose-headers": "content-range" };
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
    if (m === "OPTIONS") return route.fulfill({ status: 200, headers: { ...cors, "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
    if (url.includes("/auth/v1/user")) return json({ id: me.userId, aud: "authenticated", role: "authenticated", email: "mia@isexy.ca", app_metadata: {}, user_metadata: {} });
    const rpcMatch = url.match(/\/rest\/v1\/rpc\/([a-z_]+)/);
    if (rpcMatch) return json(rpc(rpcMatch[1], JSON.parse(req.postData() || "{}")));
    if (url.includes("/rest/v1/profile_photos") && m === "HEAD") return route.fulfill({ status: 200, headers: { ...cors, "content-range": "0-0/3" } });
    const table = url.match(/\/rest\/v1\/([a-z_]+)/)?.[1];
    if (table) {
      let body = null;
      try { body = JSON.parse(req.postData() || "null"); } catch { /* not json */ }
      const res = rest(table, m, url, req.headers()["accept"] ?? "", body);
      if (res && res.__status) return route.fulfill({ status: res.__status, headers: cors, body: "" });
      return json(res);
    }
    if (url.includes("/storage/v1/object/sign/") && m === "GET") return route.fulfill({ status: 200, contentType: "audio/wav", headers: cors, body: WAV });
    if (url.includes("/storage/v1/object/sign/")) return json({ signedURL: "/object/sign/isexy-voice-greetings/own.wav?token=t" });
    const up = url.match(/\/storage\/v1\/object\/([^/]+)\/(.+)$/);
    if (up && m === "POST") {
      uploads.push({ bucket: up[1], path: up[2].split("?")[0], buf: req.postDataBuffer() ?? Buffer.alloc(0) });
      return json({ Key: `${up[1]}/${up[2]}`, Id: "obj-1" });
    }
    const fn = url.match(/\/functions\/v1\/([a-z-]+)/)?.[1];
    if (fn) {
      fns.push({ fn, args: JSON.parse(req.postData() || "{}") });
      if (fn === "isexy-get-voice-greeting-url" || fn === "isexy-get-voice-reply-url") return json({ signed_url: `${SUPA}/storage/v1/object/sign/x/clip.wav?token=t` });
      return json({ success: true });
    }
    return json({});
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => pageErrors.push(`[pageerror] ${e.message}`));
  page.on("console", (c) => {
    if (c.type() === "error" && !/Failed to load resource|status of 40[34]|status of 500/.test(c.text())) pageErrors.push(`[console] ${c.text().slice(0, 160)}`);
  });
  return { ctx, page };
}

const micReleased = (page) => page.evaluate(() => window.__streams.length > 0 && window.__streams.flatMap((s) => s.getTracks()).every((t) => t.readyState === "ended"));
const micLive = (page) => page.evaluate(() => window.__streams.flatMap((s) => s.getTracks()).some((t) => t.readyState === "live"));
const audioPlaying = (page) => page.evaluate(() => window.__audios.some((a) => !a.paused));
const allAudioPaused = (page) => page.evaluate(() => window.__audios.length > 0 && window.__audios.every((a) => a.paused));
const recStatus = (page) => page.locator("[data-testid=recorder-status]").textContent({ timeout: 3000 }).catch(() => null);
const waitFor = async (fn, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 200)); } return false; };
const visible = (page, text, ms = 8000) => page.getByText(text).first().waitFor({ timeout: ms }).then(() => true).catch(() => false);

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });

// ===== 1. Voice profile: record, preview, save draft =====
{
  const { ctx, page } = await setup(browser);
  await page.goto(`${base}/phone-line/setup`, { waitUntil: "networkidle" });
  const age = page.locator("#age");
  check("setup: age comes from the birth date and is read-only", (await age.inputValue()) === "31" && (await age.getAttribute("readonly")) !== null, await age.inputValue());
  await page.getByRole("button", { name: "Start recording" }).click();
  check("setup: recording starts", await waitFor(async () => /Recording/.test((await recStatus(page)) ?? "")), await recStatus(page));
  check("setup: microphone live while recording", await micLive(page));
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: "Stop recording" }).click();
  check("setup: preview after stop", await waitFor(async () => /Preview your recording/.test((await recStatus(page)) ?? "")), await recStatus(page));
  check("setup: microphone released after stop", await micReleased(page));
  await page.getByRole("button", { name: "Play preview" }).click();
  check("setup: preview plays the converted clip", await waitFor(() => audioPlaying(page), 5000));
  await page.screenshot({ path: `${out}/1_setup_recorded.png` });
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.waitForURL(/\/phone-line$/, { timeout: 10000 }).catch(() => {});
  const upload = uploads.find((u) => u.bucket === "isexy-voice-greetings");
  const info = upload ? wavInfo(upload.buf) : null;
  check("save: greeting uploaded as .wav under the member's folder", !!upload && new RegExp(`^${me.userId}/pl-me-\\d+\\.wav$`).test(upload.path), upload?.path);
  check("save: file is a real 16 kHz mono 16-bit PCM WAV (Safari + Twilio can play it)", !!info && info.format === 1 && info.channels === 1 && info.rate === 16000 && info.bits === 16 && info.dataBytes > 16000 * 2 * 1.5, JSON.stringify(info));
  check("save: uploaded with type audio/wav", info?.partType === "audio/wav", info?.partType);
  const gIns = writes.find((w) => w.table === "voice_greetings" && w.method === "POST");
  check("save: greeting row has no moderation_status (server sets pending), duration from the clip", !!gIns && !("moderation_status" in gIns.body) && gIns.body.duration_seconds >= 2 && gIns.body.duration_seconds <= 4 && gIns.body.audio_url === upload?.path, JSON.stringify(gIns?.body));
  const gOff = writes.find((w) => w.table === "voice_greetings" && w.method === "PATCH");
  check("save: older greetings switched off after the new one exists (id=neq.new)", !!gOff && gOff.body.is_active === false && gOff.url.includes("id=neq.g-new") && writes.indexOf(gOff) > writes.indexOf(gIns), gOff?.url);
  const plPatch = writes.find((w) => w.table === "phone_line_profiles" && w.method === "PATCH");
  check("save draft: profile update never writes status / is_public", !!plPatch && !("status" in plPatch.body) && !("is_public" in plPatch.body), JSON.stringify(plPatch?.body));
  check("save: back on the hub", /\/phone-line$/.test(page.url()), page.url());
  await ctx.close();
}

// ===== 2. Recorder stops itself at the 90 s limit (clock fast-forward) and releases the mic =====
{
  const { ctx, page } = await setup(browser);
  await page.clock.install();
  await page.goto(`${base}/phone-line/setup`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Start recording" }).click();
  await waitFor(async () => /Recording/.test((await recStatus(page)) ?? ""));
  await page.waitForTimeout(1500);
  await page.clock.fastForward(91_000);
  check("max length: recording stops on its own at 90 s", await waitFor(async () => /Preview your recording/.test((await recStatus(page)) ?? ""), 10000), await recStatus(page));
  check("max length: microphone released", await micReleased(page));
  await ctx.close();
}

// ===== 3. Leaving the page while recording releases the microphone =====
{
  const { ctx, page } = await setup(browser);
  await page.goto(`${base}/phone-line`, { waitUntil: "networkidle" });
  await page.getByText("Your voice profile").click();
  await page.waitForURL(/\/phone-line\/setup/);
  await page.getByRole("button", { name: "Start recording" }).click();
  await waitFor(() => micLive(page));
  await page.getByRole("button", { name: "Go back" }).click();
  await page.waitForURL(/\/phone-line$/);
  check("leave while recording: microphone released", await waitFor(() => micReleased(page), 5000));
  await ctx.close();
}

// ===== 4. Microphone blocked: clear message, nothing recorded =====
{
  const { ctx, page } = await setup(browser, { denyMic: true });
  await page.goto(`${base}/phone-line/setup`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Start recording" }).click();
  check("mic blocked: 'Microphone access is blocked' with the next step", await page.getByRole("alert").filter({ hasText: "Microphone access is blocked" }).waitFor({ timeout: 5000 }).then(() => true).catch(() => false));
  check("mic blocked: back to Tap to start", /Tap to start recording/.test((await recStatus(page)) ?? ""), await recStatus(page));
  await page.screenshot({ path: `${out}/4_setup_mic_blocked.png` });
  await ctx.close();
}

// ===== 5. Banned voice profile =====
{
  state.plProfile = { ...draftProfile(), status: "banned" };
  const { ctx, page } = await setup(browser);
  await page.goto(`${base}/phone-line/setup`, { waitUntil: "networkidle" });
  check("banned: 'Removed by moderation' banner", await visible(page, "Removed by moderation"));
  check("banned: Save draft, Go live and recording disabled",
    (await page.getByRole("button", { name: "Save draft" }).isDisabled()) && (await page.getByRole("button", { name: "Go live" }).isDisabled()) && (await page.getByRole("button", { name: "Start recording" }).isDisabled()));
  await page.goto(`${base}/phone-line`, { waitUntil: "networkidle" });
  check("hub: banned profile shows 'Removed by moderation'", await visible(page, "Removed by moderation"));
  await page.screenshot({ path: `${out}/5_hub_banned.png` });
  await ctx.close();
}

// ===== 6. Hub: live with a greeting under review; link my phone for the IVR =====
{
  state.plProfile = { ...draftProfile(), status: "active", is_public: true };
  state.greetings = [{ id: "g-own", moderation_status: "pending", is_active: true, audio_url: "own.wav", duration_seconds: 9 }];
  const { ctx, page } = await setup(browser);
  await page.goto(`${base}/phone-line`, { waitUntil: "networkidle" });
  check("hub: live but greeting waiting for review (not 'receiving calls')", await visible(page, "Live · greeting waiting for review"));
  const card = page.getByTestId("phone-line-ivr");
  check("hub: phone line number shown with a tel: link", await card.getByRole("link", { name: "+1 514 555 0100" }).getAttribute("href").then((h) => h === "tel:+15145550100").catch(() => false));
  await card.getByRole("button", { name: "Link my phone number" }).click();
  check("link: no SMS-confirmed number -> says how to get one", await card.getByRole("alert").filter({ hasText: "confirmed by SMS code" }).waitFor({ timeout: 5000 }).then(() => true).catch(() => false));
  state.linkResult = { success: true, phone_masked: "+1••••••0123" };
  await card.getByRole("button", { name: "Link my phone number" }).click();
  check("link: linked number shown masked", await card.getByText("+1••••••0123").waitFor({ timeout: 5000 }).then(() => true).catch(() => false));
  check("link: link_my_verified_phone called twice, nothing else", rpcs.filter((r) => r.fn === "link_my_verified_phone").length === 2);
  await page.screenshot({ path: `${out}/6_hub_linked.png` });
  await page.reload({ waitUntil: "networkidle" });
  check("hub: after reload the linked number is read back masked", await card.getByText("+1••••••0123").waitFor({ timeout: 5000 }).then(() => true).catch(() => false));
  await ctx.close();
}

// ===== 7. Browse voices: audio stops on leaving, reply recorder, load error =====
{
  const { ctx, page } = await setup(browser);
  await page.goto(`${base}/phone-line`, { waitUntil: "networkidle" });
  await page.getByText("Browse voices").first().click();
  check("browse: voice listed", await visible(page, "Bee, 28"));
  await page.getByRole("button", { name: "Play greeting" }).click();
  check("browse: greeting plays", await waitFor(() => audioPlaying(page), 5000));
  check("browse: signed URL asked for this greeting", fns.some((f) => f.fn === "isexy-get-voice-greeting-url" && f.args.greeting_id === "g-bee"));
  await page.getByRole("button", { name: "Go back" }).click();
  await page.waitForURL(/\/phone-line$/);
  check("browse: leaving the page stops the greeting", await waitFor(() => allAudioPaused(page), 3000));

  await page.getByText("Browse voices").first().click();
  await page.getByRole("button", { name: "Voice reply" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Start recording" }).click();
  await waitFor(() => micLive(page));
  await page.waitForTimeout(1000);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  check("reply: Cancel while recording releases the microphone", await waitFor(() => micReleased(page), 5000));
  await page.getByRole("button", { name: "Voice reply" }).click();
  await dialog.getByRole("button", { name: "Start recording" }).click();
  await waitFor(async () => /Recording/.test((await recStatus(page)) ?? ""));
  await page.waitForTimeout(2000);
  await dialog.getByRole("button", { name: "Stop recording" }).click();
  check("reply: ready to send after stop", await waitFor(async () => /Listen, then send/.test((await recStatus(page)) ?? "")), await recStatus(page));
  await page.screenshot({ path: `${out}/7_reply_recorded.png` });
  await dialog.getByRole("button", { name: "Send reply" }).click();
  check("reply: sent", await visible(page, "Voice reply sent."));
  const up = uploads.find((u) => u.bucket === "isexy-voice-replies");
  check("reply: uploaded as WAV", !!up && /\.wav$/.test(up.path) && wavInfo(up.buf)?.rate === 16000, up?.path);
  const ins = writes.find((w) => w.table === "phone_line_voice_replies" && w.method === "POST");
  check("reply: row has no moderation_status, goes to Bee", !!ins && !("moderation_status" in ins.body) && ins.body.to_profile_id === BEE && ins.body.duration_seconds >= 1, JSON.stringify(ins?.body));
  check("reply: microphone released after sending", await micReleased(page));

  state.failBrowse = true;
  await page.reload({ waitUntil: "networkidle" });
  check("browse: load error shows Try again", await visible(page, "Voices couldn't load."));
  await page.screenshot({ path: `${out}/7_browse_error.png` });
  state.failBrowse = false;
  await page.getByRole("button", { name: "Try again" }).click();
  check("browse: Try again loads the voices", await visible(page, "Bee, 28"));
  await ctx.close();
}

// ===== 8. Voice inbox =====
{
  const { ctx, page } = await setup(browser);
  await page.goto(`${base}/phone-line`, { waitUntil: "networkidle" });
  await page.getByText("Voice inbox").first().click();
  check("inbox: reply from Bee listed as new", await visible(page, "NEW"));
  check("inbox: rejected replies left out of Received", getUrls.some((u) => u.includes("to_profile_id=eq") && u.includes("moderation_status=neq.rejected")));
  await page.getByRole("button", { name: "Play" }).first().click();
  check("inbox: reply plays and is marked read", (await waitFor(() => audioPlaying(page), 5000)) && (await waitFor(async () => rpcs.some((r) => r.fn === "mark_voice_reply_read" && r.args.p_reply_id === "r-1"), 3000)));
  await page.getByRole("button", { name: "Go back" }).click();
  await page.waitForURL(/\/phone-line$/);
  check("inbox: leaving the page stops the reply", await waitFor(() => allAudioPaused(page), 3000));
  await ctx.close();
}

// ===== 9. Staff: voice greetings to review, in-app calls =====
{
  state.admin = true;
  const { ctx, page } = await setup(browser);
  await page.goto(`${base}/admin/call-tests`, { waitUntil: "networkidle" });
  check("admin: review queue lists pending + reported greetings", await visible(page, "Voice greetings to review (2)"));
  check("admin: reported greeting flagged", await visible(page, "2 reports"));
  await page.getByRole("button", { name: "Play Bee" }).click();
  check("admin: staff can play a pending greeting", await waitFor(() => audioPlaying(page), 5000) && fns.some((f) => f.fn === "isexy-get-voice-greeting-url" && f.args.greeting_id === "g-1"));
  const review = page.getByTestId("voice-review");
  await review.getByRole("button", { name: "Approve" }).first().click();
  check("admin: approve -> review_voice_greeting(g-1, true), row leaves the queue",
    await waitFor(async () => rpcs.some((r) => r.fn === "review_voice_greeting" && r.args.p_greeting_id === "g-1" && r.args.p_approve === true), 5000) && (await visible(page, "Voice greetings to review (1)")));
  check("admin: approving stops the greeting being played", await allAudioPaused(page));
  await review.getByPlaceholder(/Reason if rejected/).fill("too quiet");
  await review.getByRole("button", { name: "Reject" }).click();
  check("admin: reject sends the reason", await waitFor(async () => rpcs.some((r) => r.fn === "review_voice_greeting" && r.args.p_greeting_id === "g-2" && r.args.p_approve === false && r.args.p_reason === "too quiet"), 5000));
  check("admin: queue empty", await visible(page, "Nothing to review."));
  check("admin: in-app calls listed", await visible(page, "Recent in-app calls (1)"));
  await page.screenshot({ path: `${out}/9_admin_review.png`, fullPage: true });
  await ctx.close();
}

check("no page errors", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));
await browser.close();
console.log(results.join("\n"));
console.log(failures ? `${failures} FAILED` : "ALL PASS");
process.exit(failures ? 1 : 0);
