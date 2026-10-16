// Twilio webhooks of the Phone Line, run in Node against a fake Supabase:
// signature (public URL, constant-time, Twilio's own test vector), TwiML
// well-formedness and escaping, caller identification, one session per
// CallSid, IVR menu and browse keys, status callback.
//
//   node --experimental-strip-types --no-warnings --import ./e2e/calls-twilio-loader.mjs e2e/calls-twilio-test.mjs
//
// The functions are Deno code; Deno.serve / Deno.env are shimmed here and
// supabase-js is replaced by the in-memory fake below (calls-twilio-loader.mjs).
import { createHmac, randomUUID } from "node:crypto";

const FN_DIR = new URL("../supabase/functions/", import.meta.url);
const TOKEN = "twilio-test-token";
const ENV = {
  SUPABASE_URL: "https://proj.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
  ISEXY_TWILIO_AUTH_TOKEN: TOKEN,
  ISEXY_TWILIO_ACCOUNT_SID: "AC_TEST",
};
let served = null;
globalThis.Deno = { env: { get: (k) => ENV[k] }, serve: (h) => { served = h; } };

const results = [];
let failures = 0;
const check = (label, ok, extra = "") => {
  if (!ok) failures++;
  results.push(`${ok ? "PASS" : "FAIL"} ${label}${extra ? `  (${String(extra).slice(0, 160)})` : ""}`);
};

// ---------------- fake Supabase (service role) ----------------
const today = new Date();
const yearsAgo = (n) => new Date(Date.UTC(today.getUTCFullYear() - n, today.getUTCMonth(), today.getUTCDate())).toISOString().slice(0, 10);
const P = { dan: randomUUID(), kid: randomUUID(), zoe: randomUUID(), bee: randomUUID(), cee: randomUUID(), dee: randomUUID(), sha: randomUUID() };
const db = {
  profiles: [
    { id: P.dan, first_name: "Dan", birth_date: yearsAgo(30), is_active: true, shadow_banned: false },
    { id: P.kid, first_name: "Kid", birth_date: yearsAgo(17), is_active: true, shadow_banned: false },
    { id: P.zoe, first_name: "Zoë & <Al>", birth_date: yearsAgo(40), is_active: true, shadow_banned: false },
    { id: P.bee, first_name: "Bee", birth_date: yearsAgo(28), is_active: true, shadow_banned: false },
    { id: P.cee, first_name: "Cee", birth_date: yearsAgo(33), is_active: true, shadow_banned: false },
    { id: P.dee, first_name: "Dee", birth_date: yearsAgo(31), is_active: true, shadow_banned: false },
    { id: P.sha, first_name: "Sha", birth_date: yearsAgo(31), is_active: true, shadow_banned: true },
  ],
  phone_line_numbers: [
    { profile_id: P.dan, phone_number_e164: "+15145550123", phone_verified: true, updated_at: "2026-10-01" },
    { profile_id: P.kid, phone_number_e164: "+15145550177", phone_verified: true, updated_at: "2026-10-01" },
    { profile_id: P.zoe, phone_number_e164: "+15145550188", phone_verified: true, updated_at: "2026-10-01" },
    { profile_id: P.bee, phone_number_e164: "+15145550199", phone_verified: false, updated_at: "2026-10-01" },
  ],
  phone_line_profiles: [
    { id: "pl-bee", profile_id: P.bee, display_name: "Bee", age: 28, city: "Montréal", headline: null, status: "active", is_public: true, last_active_at: "2026-10-15" },
    { id: "pl-cee", profile_id: P.cee, display_name: "Cee", age: 33, city: null, headline: "Hi & <welcome>", status: "active", is_public: true, last_active_at: "2026-10-14" },
    { id: "pl-dee", profile_id: P.dee, display_name: "Dee", age: 31, city: "Laval", headline: null, status: "active", is_public: true, last_active_at: "2026-10-16" },
    { id: "pl-sha", profile_id: P.sha, display_name: "Sha", age: 31, city: "Gatineau", headline: null, status: "active", is_public: true, last_active_at: "2026-10-16" },
  ],
  voice_greetings: [
    { phone_line_profile_id: "pl-bee", audio_url: `${P.bee}/g.wav`, moderation_status: "approved", is_active: true, is_hidden: false, created_at: "2026-10-10" },
    { phone_line_profile_id: "pl-cee", audio_url: `${P.cee}/g.webm`, moderation_status: "approved", is_active: true, is_hidden: false, created_at: "2026-10-10" },
    { phone_line_profile_id: "pl-dee", audio_url: `${P.dee}/g.wav`, moderation_status: "approved", is_active: true, is_hidden: false, created_at: "2026-10-10" },
    { phone_line_profile_id: "pl-sha", audio_url: `${P.sha}/g.wav`, moderation_status: "approved", is_active: true, is_hidden: false, created_at: "2026-10-10" },
  ],
  blocks: [{ blocker_id: P.dee, blocked_id: P.dan }],
  phone_line_voice_replies: [
    { to_profile_id: P.dan, is_read: false, is_hidden: false, moderation_status: "pending" },
    { to_profile_id: P.dan, is_read: false, is_hidden: false, moderation_status: "rejected" },
  ],
  user_credits: [{ profile_id: P.dan, phone_minutes: 7 }],
  call_sessions: [],
  phone_line_inbound_call_logs: [],
};
const rpcLog = [];
let rpcFails = false;

class Query {
  constructor(table) { this.table = table; this.filters = []; this.op = "select"; this.opts = {}; this.max = null; this.sort = null; }
  select(_cols, opts = {}) { this.opts = opts; return this; }
  eq(c, v) { this.filters.push((r) => r[c] === v); return this; }
  neq(c, v) { this.filters.push((r) => r[c] !== v); return this; }
  in(c, vs) { this.filters.push((r) => vs.includes(r[c])); return this; }
  or(expr) {
    const parts = expr.split(",").map((p) => p.split("."));
    this.filters.push((r) => parts.some(([c, op, v]) => op === "eq" && r[c] === v));
    return this;
  }
  order(c, o = {}) { this.sort = [c, o.ascending !== false]; return this; }
  limit(n) { this.max = n; return this; }
  insert(row) { this.op = "insert"; this.row = row; return this; }
  run() {
    const rows = db[this.table] ?? (db[this.table] = []);
    if (this.op === "insert") {
      if (this.table === "call_sessions" && this.row.provider_call_sid && rows.some((r) => r.provider_call_sid === this.row.provider_call_sid)) {
        return { data: null, error: { code: "23505", message: "duplicate key" } };
      }
      rows.push({ id: randomUUID(), ...this.row });
      return { data: null, error: null };
    }
    let out = rows.filter((r) => this.filters.every((f) => f(r)));
    if (this.sort) {
      const [c, asc] = this.sort;
      out = [...out].sort((a, b) => (a[c] ?? "") < (b[c] ?? "") ? (asc ? -1 : 1) : (a[c] ?? "") > (b[c] ?? "") ? (asc ? 1 : -1) : 0);
    }
    if (this.max !== null) out = out.slice(0, this.max);
    if (this.opts.head) return { data: null, count: out.length, error: null };
    return { data: out, error: null };
  }
  maybeSingle() { const r = this.run(); return Promise.resolve({ data: r.data?.[0] ?? null, error: r.error }); }
  then(resolve, reject) { return Promise.resolve(this.run()).then(resolve, reject); }
}
globalThis.__fakeSupabase = () => ({
  from: (t) => new Query(t),
  rpc: async (fn, args) => {
    rpcLog.push({ fn, args });
    return rpcFails ? { data: null, error: { message: "db down" } } : { data: { success: true, status: "completed" }, error: null };
  },
  storage: { from: (b) => ({ createSignedUrl: async (p) => ({ data: { signedUrl: `https://proj.supabase.co/storage/v1/object/sign/${b}/${p}?token=abc&t=600` }, error: null }) }) },
});

// ---------------- helpers ----------------
const sign = (url, params, token = TOKEN) => {
  let data = url;
  for (const k of Object.keys(params).sort()) data += k + params[k];
  return createHmac("sha1", token).update(data).digest("base64");
};
async function post(handler, fn, query, params, { signUrl, signature } = {}) {
  const internal = `http://localhost:9999/${fn}${query}`; // what req.url looks like inside Supabase
  const publicUrl = `${ENV.SUPABASE_URL}/functions/v1/${fn}${query}`;
  const req = new Request(internal, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "x-twilio-signature": signature ?? sign(signUrl ?? publicUrl, params) },
    body: new URLSearchParams(params).toString(),
  });
  const res = await handler(req);
  return { status: res.status, type: res.headers.get("content-type") ?? "", body: await res.text() };
}
/** Minimal XML well-formedness: nesting, quoted attributes, no raw & or < in text/attributes. */
function wellFormed(xml) {
  const body = xml.replace(/^<\?xml[^?]*\?>/, "");
  const stack = [];
  const re = /<(\/?)([A-Za-z]+)((?:\s+[A-Za-z]+="[^"<]*")*)\s*(\/?)>|([^<]+)|(<)/g;
  const badAmp = /&(?!(amp|lt|gt|quot|apos|#\d+);)/;
  let m;
  while ((m = re.exec(body))) {
    if (m[6]) return "stray <";
    if (m[5] !== undefined) { if (badAmp.test(m[5])) return `raw & in text: ${m[5].slice(0, 60)}`; continue; }
    if (badAmp.test(m[3] ?? "")) return `raw & in attribute: ${m[3]}`;
    if (m[1]) { if (stack.pop() !== m[2]) return `bad close </${m[2]}>`; }
    else if (!m[4]) stack.push(m[2]);
  }
  return stack.length ? `unclosed ${stack.join(",")}` : null;
}
const twimlOk = (r) => r.status === 200 && r.type.startsWith("text/xml") && wellFormed(r.body) === null;
const gatherAction = (xml) => (xml.match(/<Gather[^>]*action="([^"]+)"/)?.[1] ?? "").replace(/&amp;/g, "&");

// ---------------- 1. signature helper ----------------
const { validTwilioSignature, xmlEscape } = await import(new URL("_shared/twilio.ts", FN_DIR).href);
const docParams = { CallSid: "CA1234567890ABCDE", Caller: "+12349013030", Digits: "1234", From: "+12349013030", To: "+18005551212" };
check("signature: Twilio's documented test vector validates",
  validTwilioSignature("https://mycompany.com/myapp.php?foo=1&bar=2", docParams, "0/KCTR6DLpKmkAf8muzZqo1nDgQ=", "12345"));
check("signature: one changed parameter fails",
  !validTwilioSignature("https://mycompany.com/myapp.php?foo=1&bar=2", { ...docParams, Digits: "1235" }, "0/KCTR6DLpKmkAf8muzZqo1nDgQ=", "12345"));
check("signature: empty token or signature fails", !validTwilioSignature("https://x", {}, "", "12345") && !validTwilioSignature("https://x", {}, "abc", ""));
check("xmlEscape escapes & < > \" '", xmlEscape(`a&b<c>"d'`) === "a&amp;b&lt;c&gt;&quot;d&apos;");

// ---------------- 2. inbound ----------------
await import(new URL("isexy-twilio-inbound-phone-line/index.ts", FN_DIR).href);
const inbound = served;
const IN = "isexy-twilio-inbound-phone-line";
const base = { AccountSid: "AC_TEST", CallStatus: "ringing", To: "+15145550000" };

let r = await post(inbound, IN, "", { ...base, CallSid: "CA_1", From: "+15145550123" }, { signature: "bogus" });
check("inbound: bad signature -> 403", r.status === 403);
r = await post(inbound, IN, "", { ...base, CallSid: "CA_1", From: "+15145550123" }, { signUrl: `http://localhost:9999/${IN}` });
check("inbound: signature over the internal req.url is refused (Twilio signs the public URL)", r.status === 403);
r = await post(inbound, IN, "", { ...base, AccountSid: "AC_OTHER", CallSid: "CA_1", From: "+15145550123" });
check("inbound: another Twilio account -> 403", r.status === 403);

r = await post(inbound, IN, "", { ...base, CallSid: "CA_U", From: "+15145559999" });
check("inbound: unknown number -> well-formed TwiML, link instructions, hang up", twimlOk(r) && /link the phone number/.test(r.body) && /<Hangup\/>/.test(r.body), wellFormed(r.body) ?? "");
const log = db.phone_line_inbound_call_logs.at(-1);
check("inbound: unknown caller logged hashed + masked, never the raw number",
  log?.reason === "unverified_caller" && /^[0-9a-f]{64}$/.test(log.caller_hash) && log.caller_masked === "+15***99" && !JSON.stringify(log).includes("5145559999"));
r = await post(inbound, IN, "", { ...base, CallSid: "CA_B", From: "+15145550199" });
check("inbound: number not verified -> unknown caller", /link the phone number/.test(r.body));
r = await post(inbound, IN, "", { ...base, CallSid: "CA_K", From: "+15145550177" });
check("inbound: under 18 (from birth_date) -> unknown caller", /link the phone number/.test(r.body) && db.phone_line_inbound_call_logs.at(-1).reason === "profile_inactive_or_underage");

r = await post(inbound, IN, "", { ...base, CallSid: "CA_1", From: "+1 (514) 555-0123" });
check("inbound: verified adult (profiles has no age/status column) -> menu", twimlOk(r) && /Welcome back to ISEXY, Dan\./.test(r.body), wellFormed(r.body) ?? r.body.slice(0, 120));
check("inbound: menu Gather posts to the public menu URL", gatherAction(r.body) === `${ENV.SUPABASE_URL}/functions/v1/isexy-twilio-phone-line-menu`, gatherAction(r.body));
check("inbound: one call_sessions row (twilio, CallSid, connected)", db.call_sessions.length === 1 && db.call_sessions[0].provider === "twilio" && db.call_sessions[0].provider_call_sid === "CA_1" && db.call_sessions[0].caller_profile_id === P.dan);
r = await post(inbound, IN, "", { ...base, CallSid: "CA_1", From: "+15145550123" });
check("inbound: Twilio retry of the same CallSid adds no second row", twimlOk(r) && db.call_sessions.length === 1);
r = await post(inbound, IN, "", { ...base, CallSid: "CA_Z", From: "+15145550188" });
check("inbound: names are XML-escaped", twimlOk(r) && r.body.includes("Zoë &amp; &lt;Al&gt;"), wellFormed(r.body) ?? "");

// ---------------- 3. menu ----------------
await import(new URL("isexy-twilio-phone-line-menu/index.ts", FN_DIR).href);
const menu = served;
const ME = "isexy-twilio-phone-line-menu";
const dan = { ...base, CallSid: "CA_1", From: "+15145550123", CallStatus: "in-progress" };
const press = (digits, query = "") => post(menu, ME, query, { ...dan, Digits: digits });

r = await post(menu, ME, "", { ...dan, Digits: "1" }, { signature: "bogus" });
check("menu: bad signature -> 403", r.status === 403);
r = await post(menu, ME, "", { ...dan, From: "+15145559999", Digits: "1" });
check("menu: unlinked number -> hang up", twimlOk(r) && /<Hangup\/>/.test(r.body));
r = await press("1");
check("menu 1: no voice profile yet", twimlOk(r) && /do not have a voice profile/.test(r.body));
db.phone_line_profiles.push({ id: "pl-dan", profile_id: P.dan, display_name: "Dan", age: 30, status: "active", is_public: true });
db.voice_greetings.push({ phone_line_profile_id: "pl-dan", audio_url: "x.wav", moderation_status: "pending", is_active: true, is_hidden: false, created_at: "2026-10-15" });
r = await press("1");
check("menu 1: live profile, greeting waiting for review", /greeting is waiting for review/.test(r.body));
r = await press("3");
check("menu 3: new replies counted (rejected ones left out)", twimlOk(r) && /You have 1 new voice reply\./.test(r.body), r.body.slice(60, 200));
r = await press("4");
check("menu 4: phone minutes", /You have 7 phone minutes left\./.test(r.body));
r = await press("5");
check("menu 5: safety tips, back to the menu", twimlOk(r) && /Safety tips/.test(r.body) && /<Redirect method="POST">https:\/\/proj\.supabase\.co\/functions\/v1\/isexy-twilio-phone-line-menu<\/Redirect>/.test(r.body));
r = await press("7");
check("menu 7: not an option -> menu again", twimlOk(r) && /not an option/.test(r.body) && /<Gather/.test(r.body));
r = await press("9");
check("menu 9: repeats the menu", twimlOk(r) && /Press 2 to browse/.test(r.body));
r = await press("", "?idle=1");
check("menu: silence repeats with a prompt and counts rounds", twimlOk(r) && /Are you still there/.test(r.body) && /idle=2/.test(r.body));
r = await press("", "?idle=3");
check("menu: still silent after 3 rounds -> goodbye, hang up", /<Hangup\/>/.test(r.body));

r = await press("2");
check("browse: first voice is Bee (Dee blocked Dan; shadow-banned Sha left out)", twimlOk(r) && /Bee, 28, from Montréal\./.test(r.body) && !/Dee|Sha/.test(r.body), wellFormed(r.body) ?? "");
check("browse: WAV greeting is played from a signed URL, & escaped", /<Play>https:\/\/proj\.supabase\.co\/storage\/v1\/object\/sign\/isexy-voice-greetings\/[^<]+\.wav\?token=abc&amp;t=600<\/Play>/.test(r.body));
let keys = new URL(gatherAction(r.body));
check("browse: keys go to action=browse with seen + current", keys.searchParams.get("action") === "browse" && keys.searchParams.get("current") === P.bee && keys.searchParams.get("seen") === P.bee, keys.search);
r = await press("2", keys.search);
check("browse 2: replays the same voice", twimlOk(r) && /Bee, 28/.test(r.body));
r = await press("1", keys.search);
check("browse 1: next voice (Cee)", twimlOk(r) && /Cee, 33\./.test(r.body), r.body.slice(60, 160));
check("browse: a WebM greeting Twilio cannot play is introduced by its headline instead (escaped)", !/<Play>/.test(r.body) && r.body.includes("Hi &amp; &lt;welcome&gt;"));
keys = new URL(gatherAction(r.body));
check("browse: seen carries both voices", keys.searchParams.get("seen") === `${P.bee},${P.cee}`);
r = await press("1", keys.search);
check("browse 1 at the end: that's everyone, back to the menu", twimlOk(r) && /That's everyone for now/.test(r.body));
r = await press("3", keys.search);
check("browse 3: voice replies are sent from the app", twimlOk(r) && /sent from the ISEXY app/.test(r.body));
r = await press("9", keys.search);
check("browse 9: main menu", twimlOk(r) && /Press 2 to browse/.test(r.body));

// ---------------- 4. status callback ----------------
await import(new URL("isexy-twilio-call-status/index.ts", FN_DIR).href);
const status = served;
const ST = "isexy-twilio-call-status";
r = await post(status, ST, "", { AccountSid: "AC_TEST", CallSid: "CA_1", CallStatus: "completed", CallDuration: "42" }, { signature: "bogus" });
check("status: bad signature -> 403, nothing saved", r.status === 403 && rpcLog.length === 0);
r = await post(status, ST, "", { AccountSid: "AC_TEST", CallSid: "CA_1", CallStatus: "completed", CallDuration: "42" });
check("status: saved through apply_twilio_call_status(CallSid, status, duration)", r.status === 200 && rpcLog.at(-1)?.fn === "apply_twilio_call_status"
  && rpcLog.at(-1).args.p_call_sid === "CA_1" && rpcLog.at(-1).args.p_status === "completed" && rpcLog.at(-1).args.p_duration === 42, JSON.stringify(rpcLog.at(-1)));
r = await post(status, ST, "", { AccountSid: "AC_TEST", CallSid: "CA_1", CallStatus: "ringing" });
check("status: no duration -> null", rpcLog.at(-1).args.p_duration === null);
const n = rpcLog.length;
r = await post(status, ST, "", { AccountSid: "AC_TEST", CallStatus: "completed" });
check("status: no CallSid -> ignored", r.status === 200 && rpcLog.length === n);
rpcFails = true;
r = await post(status, ST, "", { AccountSid: "AC_TEST", CallSid: "CA_1", CallStatus: "completed" });
check("status: database error -> 500 so Twilio retries", r.status === 500);

console.log(results.join("\n"));
console.log(failures ? `${failures} FAILED` : "ALL PASS");
process.exit(failures ? 1 : 0);
