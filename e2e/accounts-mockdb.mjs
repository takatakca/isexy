// Stateful in-memory stand-in for the TAKATAK V1 Supabase API (PostgREST,
// Auth, Storage, Functions) so the ISEXY build can be driven end to end
// locally. Nothing here talks to the network.
import { readFileSync } from "node:fs";

export const PNG = readFileSync(new URL("../public/apple-touch-icon.png", import.meta.url));
export const SB = "https://pcjfahhlozsseqqevimi.supabase.co";

let seq = 1;
const uuid = () => `00000000-0000-4000-8000-${String(seq++).padStart(12, "0")}`;

export function newState(overrides = {}) {
  return {
    profiles: [],
    profile_photos: [],
    user_preferences: [],
    blocks: [],
    support_tickets: [],
    photo_verifications: [],
    push_subscriptions: [],
    storage: new Map(),
    log: [],
    // failures: { "PATCH user_preferences": {status, body} }
    failures: {},
    missingColumns: {}, // e.g. { user_preferences: ["settings"] } to mimic an un-migrated DB
    ...overrides,
  };
}

function parseFilters(url) {
  const filters = [];
  let order = null, limit = null, onConflict = null;
  for (const [k, v] of url.searchParams) {
    if (k === "select" || k === "columns") continue;
    if (k === "order") { const [col, dir] = v.split("."); order = { col, desc: dir === "desc" }; continue; }
    if (k === "limit") { limit = Number(v); continue; }
    if (k === "on_conflict") { onConflict = v.split(","); continue; }
    if (k === "or" || k === "and") { filters.push({ unsupported: true }); continue; }
    const m = v.match(/^(not\.)?(eq|neq|in|is|gte|lte|gt|lt)\.(.*)$/);
    if (!m) continue;
    filters.push({ col: k, not: !!m[1], op: m[2], val: m[3] });
  }
  return { filters, order, limit, onConflict };
}

function matches(row, f) {
  if (f.unsupported) return true;
  const v = row[f.col];
  let ok;
  switch (f.op) {
    case "eq": ok = String(v) === f.val; break;
    case "neq": ok = String(v) !== f.val; break;
    case "is": ok = f.val === "null" ? v == null : String(v) === f.val; break;
    case "in": ok = f.val.replace(/^\(|\)$/g, "").split(",").map((s) => s.replace(/^"|"$/g, "")).includes(String(v)); break;
    case "gte": ok = v >= f.val; break;
    case "lte": ok = v <= f.val; break;
    case "gt": ok = v > f.val; break;
    case "lt": ok = v < f.val; break;
    default: ok = true;
  }
  return f.not ? !ok : ok;
}

const DEFAULTS = {
  profiles: (r) => ({ is_active: true, is_verified: false, country: "Canada", interested_in: [], interests: [], pets: [], prompts: [], languages: [], subscription_tier: "free", super_likes_remaining: 1, boosts_remaining: 0, likes_remaining: 100, distance_preference: 80, age_min: 18, age_max: 50, show_gender: true, show_orientation: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), id: r.user_id ?? r.id }),
  profile_photos: () => ({ id: uuid(), position: 0, created_at: new Date().toISOString() }),
  user_preferences: () => ({ id: uuid(), preferred_language: "en", auto_translate: true, settings: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
  blocks: () => ({ id: uuid(), created_at: new Date().toISOString() }),
  support_tickets: () => ({ id: uuid(), status: "open", priority: "medium", created_at: new Date().toISOString() }),
  photo_verifications: () => ({ id: uuid(), status: "pending", submitted_at: new Date().toISOString(), rejection_reason: null }),
  push_subscriptions: () => ({ id: uuid() }),
};

export async function installMock(ctx, state, { user } = {}) {
  await ctx.route(`${SB}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    const headers = req.headers();
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };
    const json = (body, status = 200, extra = {}) => route.fulfill({ status, contentType: "application/json", headers: { ...cors, ...extra }, body: body === undefined ? "" : JSON.stringify(body) });
    if (method === "OPTIONS") return route.fulfill({ status: 200, headers: cors });

    const p = url.pathname;
    // ---- auth
    if (p.startsWith("/auth/v1/")) {
      if (p.endsWith("/user")) return json(user ?? {});
      if (p.endsWith("/logout")) { state.log.push("auth logout"); return route.fulfill({ status: 204, headers: cors }); }
      if (p.endsWith("/otp")) { state.log.push("auth otp " + req.postData()); return json({}); }
      if (p.endsWith("/verify")) {
        state.log.push("auth verify");
        const now = Math.floor(Date.now() / 1000);
        return json({ access_token: "h.eyJzdWIiOiIxIn0.s", token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token: "r", user });
      }
      return json({});
    }
    // ---- storage
    if (p.startsWith("/storage/v1/object/public/")) return route.fulfill({ status: 200, contentType: "image/png", headers: cors, body: PNG });
    if (p.startsWith("/storage/v1/object/")) {
      const rest = decodeURIComponent(p.slice("/storage/v1/object/".length));
      if (method === "DELETE") {
        const body = JSON.parse(req.postData() || "{}");
        for (const prefix of body.prefixes ?? []) state.storage.delete(`${rest}/${prefix}`);
        state.log.push(`storage DELETE ${rest} ${JSON.stringify(body.prefixes)}`);
        return json([]);
      }
      const fail = state.failures[`storage ${rest.split("/")[0]}`];
      if (fail) return json(fail.body, fail.status);
      state.storage.set(rest, true);
      state.log.push(`storage ${method} ${rest}`);
      return json({ Key: rest, Id: uuid() });
    }
    // ---- functions
    if (p.startsWith("/functions/v1/")) { state.log.push(`fn ${p.split("/").pop()}`); return json({ success: true }); }
    // ---- rpc
    if (p.startsWith("/rest/v1/rpc/")) {
      const fn = p.split("/").pop();
      const body = JSON.parse(req.postData() || "{}");
      state.log.push(`rpc ${fn}`);
      if (fn === "get_web_profile") {
        const prof = state.profiles.find((x) => x.id === body.p_profile_id);
        const prefs = prof && state.user_preferences.find((u) => u.user_id === prof.user_id);
        if (!prof || !prefs?.settings?.webProfile?.enabled) return json([]);
        const age = new Date().getFullYear() - new Date(prof.birth_date).getFullYear();
        const photos = state.profile_photos.filter((x) => x.profile_id === prof.id).sort((a, b) => a.position - b.position).map((x) => x.photo_url);
        return json([{ id: prof.id, first_name: prof.first_name, age, bio: prof.bio, interests: prof.interests, is_verified: !!prof.is_verified, photos }]);
      }
      if (fn === "get_discover_feed" || fn === "get_my_conversations") return json([]);
      return json(null);
    }
    // ---- tables
    if (p.startsWith("/rest/v1/")) {
      const table = p.slice("/rest/v1/".length);
      const rows = state[table];
      const { filters, order, limit, onConflict } = parseFilters(url);
      const prefer = headers["prefer"] || "";
      const wantsObject = (headers["accept"] || "").includes("vnd.pgrst.object");
      const key = `${method} ${table}`;
      state.log.push(`${key} ${url.search.slice(0, 160)}`);
      if (state.delays?.[key]) await new Promise((r) => setTimeout(r, state.delays[key]));
      if (state.failures[key]) return json(state.failures[key].body, state.failures[key].status);
      if (!Array.isArray(rows)) return json(method === "GET" ? [] : null);
      const missing = state.missingColumns[table] ?? [];
      const reply = (out, status = 200) => {
        if (wantsObject) {
          if (out.length !== 1) return json({ code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: `The result contains ${out.length} rows` }, 406);
          return json(out[0], status);
        }
        return json(out, status);
      };
      if (method === "GET" || method === "HEAD") {
        if (missing.some((c) => (url.searchParams.get("select") || "").includes(c))) return json({ code: "42703", message: `column ${table}.${missing[0]} does not exist` }, 400);
        let out = rows.filter((r) => filters.every((f) => matches(r, f)));
        if (order) out = [...out].sort((a, b) => (a[order.col] > b[order.col] ? 1 : -1) * (order.desc ? -1 : 1));
        if (limit) out = out.slice(0, limit);
        if (method === "HEAD") return route.fulfill({ status: 200, headers: { ...cors, "content-range": `0-${Math.max(out.length - 1, 0)}/${out.length}` } });
        return reply(out);
      }
      const body = JSON.parse(req.postData() || "null");
      const touchesMissing = (obj) => missing.some((c) => obj && c in obj);
      if (method === "POST") {
        const items = Array.isArray(body) ? body : [body];
        if (items.some(touchesMissing)) return json({ code: "PGRST204", message: `Could not find the '${missing[0]}' column of '${table}' in the schema cache` }, 400);
        const created = [];
        for (const item of items) {
          if (prefer.includes("merge-duplicates") && onConflict) {
            const existing = rows.find((r) => onConflict.every((c) => String(r[c]) === String(item[c])));
            if (existing) { Object.assign(existing, item); created.push(existing); continue; }
          }
          if (table === "profiles" && rows.some((r) => r.user_id === item.user_id)) return json({ code: "23505", message: "duplicate key value violates unique constraint \"profiles_user_id_key\"" }, 409);
          if (table === "user_preferences" && rows.some((r) => r.user_id === item.user_id)) return json({ code: "23505", message: "duplicate key value violates unique constraint" }, 409);
          const row = { ...(DEFAULTS[table]?.(item) ?? { id: uuid() }), ...item };
          if (table === "profiles") row.id = row.user_id;
          rows.push(row);
          created.push(row);
        }
        if (!prefer.includes("return=representation")) return route.fulfill({ status: 201, headers: cors });
        return reply(created, 201);
      }
      if (method === "PATCH") {
        if (touchesMissing(body)) return json({ code: "PGRST204", message: `Could not find the '${missing[0]}' column of '${table}' in the schema cache` }, 400);
        const hit = rows.filter((r) => filters.every((f) => matches(r, f)));
        for (const r of hit) Object.assign(r, body, table === "profiles" ? { updated_at: new Date().toISOString() } : {});
        if (!prefer.includes("return=representation")) return route.fulfill({ status: 204, headers: cors });
        return reply(hit);
      }
      if (method === "DELETE") {
        const keep = rows.filter((r) => !filters.every((f) => matches(r, f)));
        const removed = rows.length - keep.length;
        rows.splice(0, rows.length, ...keep);
        state.log.push(`  deleted ${removed}`);
        return route.fulfill({ status: 204, headers: cors });
      }
    }
    return json({});
  });
}

export function session(user) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return JSON.stringify({ access_token: "header.eyJzdWIiOiIxIn0.sig", token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: "r", user });
}

export function makeUser(id, extra = {}) {
  return { id, aud: "authenticated", role: "authenticated", email: "ana@example.com", email_confirmed_at: "2026-10-01T00:00:00Z", phone: "15145550123", app_metadata: { provider: "email" }, user_metadata: {}, created_at: "2026-10-01T00:00:00Z", ...extra };
}

/** Pre-seed localStorage: a session (optional), consent decided, assistant teaser and push prompt seen. */
export async function seedBrowser(ctx, user) {
  await ctx.addInitScript(([sess]) => {
    if (sess && !sessionStorage.getItem("__seeded")) {
      localStorage.setItem("sb-pcjfahhlozsseqqevimi-auth-token", sess);
      sessionStorage.setItem("__seeded", "1");
    }
    localStorage.setItem("isexy_consent", JSON.stringify({ analytics: false, marketing: false, decidedAt: "2026-10-07T00:00:00Z", version: 1 }));
    localStorage.setItem("push_notification_prompt_shown", "true");
    sessionStorage.setItem("isexy_assistant_teaser_seen", "1");
  }, [user ? session(user) : null]);
}

export function completeProfile(state, id, extra = {}) {
  state.profiles.push({ ...DEFAULTS.profiles({ user_id: id }), user_id: id, id, first_name: "Ana", birth_date: "1994-05-01", gender: "woman", interested_in: ["everyone"], bio: "Montréal, café, randonnée et bons livres.", city: "Montréal", ...extra });
  state.profile_photos.push({ ...DEFAULTS.profile_photos(), profile_id: id, photo_url: `${SB}/storage/v1/object/public/isexy-profile-photos/${id}/a.png`, position: 0 });
}
