// Trust area end to end (mocked backend, preview build, 390x844): block and
// report, 404, EN/FR switch, Help search, ticket tracking, the assistant
// (streamed answer, "talk to a person" for guests and members), and the staff
// tools for a moderator and an admin (every action through a staff RPC, no
// direct write of profiles / reports / warnings / tickets).
//
//   E2E_BASE=http://127.0.0.1:4173 node --import ./e2e/offline-browser.mjs e2e/trust-e2e.mjs
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "/opt/node22/lib/node_modules/playwright/index.mjs");
import { SB, newState, installMock, seedBrowser, makeUser, completeProfile, deniedRequests } from "./accounts-mockdb.mjs";

const base = process.env.E2E_BASE ?? "http://127.0.0.1:4173";
const out = process.env.E2E_SHOTS ?? `${tmpdir()}/isexy-trust-shots`;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" });
const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);

const ANA = "dddd0000-0000-4000-8000-00000000000a"; // member
const BEN = "dddd0000-0000-4000-8000-00000000000b"; // member
const MOD = "dddd0000-0000-4000-8000-00000000000d"; // moderator
const ADM = "dddd0000-0000-4000-8000-00000000000e"; // admin
const now = () => new Date().toISOString();
// Script/HTML injection payloads written by members (reports, chat attempts,
// tickets) or carried into the audit log. Each would set window.__xss if run.
const XSS = {
  report: `<img src=x onerror="window.__xss='report'">harassed me`,
  violation: `<script>window.__xss='violation'</script>call me`,
  audit: `<img src=x onerror="window.__xss='audit'">`,
  ticketName: `<b onmouseover="window.__xss='name'">Eve</b>`,
  ticketSubject: `<img src=x onerror="window.__xss='subject'">refund`,
  ticketMessage: `<svg onload="window.__xss='message'"></svg>please help`,
};
const xssRan = (page) => page.evaluate(() => window.__xss ?? null);
const injectedNodes = (page) => page.evaluate(() => document.querySelectorAll('img[src="x"], body script:not([src]), svg[onload], [onerror], [onmouseover]').length);

function trustState() {
  const state = newState({
    user_roles: [
      { id: "r1", user_id: MOD, role: "moderator", created_at: now() },
      { id: "r2", user_id: ADM, role: "admin", created_at: now() },
    ],
    reports: [
      { id: "rep00000-0000-4000-8000-000000000001", reporter_id: ANA, reported_id: BEN, reason: "scam", description: "asked for gift cards", status: "pending", source: "chat", resolution_note: null, created_at: now() },
      // Member-written text shown on staff pages: must stay text (D checks).
      { id: "rep00000-0000-4000-8000-000000000002", reporter_id: BEN, reported_id: ANA, reason: "other", description: XSS.report, status: "pending", source: "profile", resolution_note: null, created_at: now() },
    ],
    user_warnings: [],
    content_violations: [
      { id: "cv1", profile_id: BEN, violation_type: "phone_number", detected_content: "514 555 0100", action_taken: "message_blocked", created_at: now() },
      { id: "cv2", profile_id: ANA, violation_type: "other", detected_content: XSS.violation, action_taken: "message_blocked", created_at: now() },
    ],
    live_chat_sessions: [],
    live_chat_messages: [],
    staff_actions: [
      { id: "sa1", actor_user_id: MOD, action: "suspend", target_profile_id: BEN, target_id: null, details: { reason: "spam wave" }, created_at: now() },
      { id: "sa2", actor_user_id: MOD, action: "edit_profile", target_profile_id: ANA, target_id: null, details: { reason: XSS.audit }, created_at: now() },
    ],
    forum_categories: [],
    knowledge_base: [],
    rpc: [],
  });
  state.shadowBans = new Map(); // profile id -> reason, read through staff_get_shadow_bans (members cannot read bans, 0015 K3)
  completeProfile(state, ANA, { first_name: "Ana" });
  completeProfile(state, BEN, { first_name: "Ben", city: "Laval" });
  completeProfile(state, MOD, { first_name: "Mo" });
  completeProfile(state, ADM, { first_name: "Xan" });
  state.support_tickets.push({ id: "tk000000-0000-4000-8000-000000000001", ticket_number: "IS-ABC123", user_id: null, name: "Guest", email: "guest@example.ca", subject: "Cannot sign in", category: "account", priority: "high", message: "help please", status: "open", response: "We reset your sign-in.", responded_at: now(), admin_notes: "[2026-10-22 10:00 Xan] called the guest back", assigned_to: null, created_at: now(), updated_at: now() });
  // 0015 K2: a member's ticket (only its owner tracks it) and a ticket sent without signing in from Ana's e-mail.
  state.support_tickets.push({ id: "tk000000-0000-4000-8000-000000000003", ticket_number: "IS-BEN001", user_id: BEN, name: "Ben", email: "ben@example.ca", subject: "Billing", category: "billing", priority: "high", message: "charged twice", status: "open", response: null, admin_notes: null, assigned_to: null, created_at: new Date(Date.now() - 120_000).toISOString(), updated_at: now() });
  state.support_tickets.push({ id: "tk000000-0000-4000-8000-000000000004", ticket_number: "IS-ANA777", user_id: null, name: "Ana", email: "ana@example.com", subject: "Sent before signing in", category: "account", priority: "low", message: "hello from before", status: "resolved", response: "Welcome back, Ana.", responded_at: now(), admin_notes: null, assigned_to: null, created_at: new Date(Date.now() - 180_000).toISOString(), updated_at: now() });
  state.ticket_categories = [{ id: "cat1", name: "Account", description: null, is_active: true }];
  state.support_tickets.push({ id: "tk000000-0000-4000-8000-000000000002", ticket_number: "IS-XSS001", user_id: null, name: XSS.ticketName, email: "x@example.ca", subject: XSS.ticketSubject, category: "other", priority: "low", message: XSS.ticketMessage, status: "open", response: null, admin_notes: null, assigned_to: null, attachments: ["javascript:window.__xss='attachment'"], created_at: new Date(Date.now() - 60_000).toISOString(), updated_at: now() });
  state.cuban_verifications = [{ id: "cu000000-0000-4000-8000-000000000001", profile_id: ANA, whatsapp_number: "+5355550000", whatsapp_verified: true, carnet_id: "90010112345", carnet_verified: false, carnet_front_url: "javascript:window.__xss='carnet'", carnet_back_url: `${ANA}/carnet-back.jpg`, video_verified: false, video_url: null, audio_verified: false, audio_url: null, verification_status: "pending", rejection_reason: null, submitted_at: now(), verified_at: null, profile: { first_name: "Ana", city: "Havana", country: "Cuba" } }];
  state.photo_verifications.push({ id: "pv000000-0000-4000-8000-000000000001", profile_id: BEN, selfie_path: `${BEN}/selfie.jpg`, status: "pending", submitted_at: now(), reviewed_at: null, rejection_reason: null });
  return state;
}

/** Trust RPCs and the assistant on top of the generic mock (later routes win). */
async function installTrust(ctx, state) {
  const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "x-conversation-id, x-kb-sources, content-range" };
  const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });

  await ctx.route(`${SB}/rest/v1/rpc/**`, async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fallback();
    const fn = new URL(req.url()).pathname.split("/").pop();
    const body = JSON.parse(req.postData() || "{}");
    state.rpc.push({ fn, body });
    switch (fn) {
      case "get_my_hidden_member_ids": return json(route, []);
      case "block_member":
        state.blocks.push({ id: `b${state.blocks.length}`, blocker_id: ANA, blocked_id: body.p_profile_id, created_at: now() });
        return json(route, { blocked: true, already: false });
      case "report_member": return json(route, { report_id: "new", duplicate: false, blocked: !!body.p_block });
      case "get_ticket_status": {
        // As 0015 K2: content and reply only for the owner or someone signed in with
        // the ticket's e-mail; a guest ticket's status for anyone else; a member's
        // ticket for nobody else.
        const t = state.support_tickets.find((x) => x.ticket_number === String(body.p_ticket_number).trim().toUpperCase() && x.email === String(body.p_email).trim().toLowerCase());
        if (!t) return json(route, []);
        const me = state.user;
        const proven = !!me && (t.user_id === me.id || (!!me.email && t.email === me.email.toLowerCase()));
        if (!proven && t.user_id) return json(route, []);
        const { ticket_number, category, priority, status, responded_at = null, created_at, updated_at } = t;
        return json(route, [{ ticket_number, category, priority, status, responded_at, created_at, updated_at,
          subject: proven ? t.subject : null, message: proven ? t.message : null, response: proven ? t.response : null }]);
      }
      case "staff_list_tickets":
        state.ticketListCalls = (state.ticketListCalls ?? 0) + 1;
        return json(route, [...state.support_tickets].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)));
      case "staff_get_shadow_bans": {
        const ids = body.p_profile_ids;
        return json(route, [...state.shadowBans.entries()].filter(([id]) => !ids || ids.includes(id))
          .map(([profile_id, reason]) => ({ profile_id, shadow_banned_at: now(), shadow_banned_reason: reason })));
      }
      case "staff_dashboard_stats": {
        const isAdmin = req.headers()["x-test-role"] === "admin" || state.as === ADM;
        return json(route, {
          members: { total: 4, active: 4, suspended: 0, shadow_banned: 0, premium: 1, verified: 1, new_today: 1, new_week: 3 },
          by_gender: { woman: 2, man: 2 },
          by_tier: { free: 3, gold: 1 },
          signups_14d: Array.from({ length: 14 }, (_, i) => ({ day: new Date(Date.now() - (13 - i) * 86400000).toISOString().slice(0, 10), count: i % 3 })),
          queues: { pending_reports: 1, active_restrictions: 0, pending_photo_checks: 1, waiting_live_chats: 1, pending_voice_greetings: 1, open_tickets: isAdmin ? 1 : null },
          revenue: isAdmin ? { credits_purchased: 95, credit_purchases: 2, active_subscriptions: 1, active_chat_subscriptions: 0, call_credits_used: 12 } : null,
          is_admin: isAdmin,
        });
      }
      case "staff_set_shadow_ban":
        if (body.p_banned) state.shadowBans.set(body.p_profile_id, body.p_reason); else state.shadowBans.delete(body.p_profile_id);
        return json(route, { shadow_banned: !!body.p_banned });
      case "staff_set_account_active": case "staff_issue_warning": case "staff_lift_restrictions":
      case "staff_update_profile": case "staff_set_profile_verified": case "staff_grant_role":
        return json(route, fn === "staff_lift_restrictions" ? 1 : { ok: true });
      case "staff_resolve_report": {
        const r = state.reports.find((x) => x.id === body.p_report_id);
        if (r) r.status = body.p_status;
        return json(route, { report_id: body.p_report_id, old_status: "pending", status: body.p_status });
      }
      case "staff_list_roles": return json(route, state.user_roles.filter((r) => body.p_user_ids.includes(r.user_id)).map(({ user_id, role }) => ({ user_id, role })));
      case "review_photo_verification": {
        const v = state.photo_verifications.find((x) => x.id === body.p_request_id);
        if (v) v.status = body.p_approve ? "approved" : "rejected";
        return json(route, v);
      }
      case "get_voice_greetings_for_review":
        return json(route, state.voiceDone ? [] : [{ greeting_id: "g1", display_name: "Ben", age: 31, city: "Laval", headline: "Hi", profile_status: "active", duration_seconds: 12, report_count: 0, moderation_status: "pending", created_at: now() }]);
      case "review_voice_greeting": state.voiceDone = true; return json(route, { success: true, moderation_status: "approved" });
      case "staff_get_live_chat_transcript": return json(route, [{ role: "user", content: "I was charged twice", created_at: now() }]);
      case "staff_accept_live_chat": {
        const s = state.live_chat_sessions.find((x) => x.id === body.p_session_id);
        Object.assign(s, { status: "active", agent_id: state.as });
        state.live_chat_messages.push({ id: `m${state.live_chat_messages.length}`, session_id: s.id, sender_type: "system", sender_id: state.as, content: "Mo from ISEXY Support joined the chat.", created_at: now() });
        return json(route, s);
      }
      case "staff_close_live_chat": {
        const s = state.live_chat_sessions.find((x) => x.id === body.p_session_id);
        Object.assign(s, { status: "closed" });
        return json(route, s);
      }
      case "end_my_live_chat": {
        const s = state.live_chat_sessions.find((x) => x.id === body.p_session_id);
        if (s) s.status = "closed";
        return json(route, true);
      }
      case "staff_update_ticket": {
        const t = state.support_tickets.find((x) => x.id === body.p_ticket_id);
        const old = t.status;
        if (body.p_status) t.status = body.p_status;
        if (body.p_response) t.response = body.p_response;
        return json(route, { ticket_id: t.id, ticket_number: t.ticket_number, old_status: old, new_status: t.status, responded: !!body.p_response, notify: old !== t.status || !!body.p_response });
      }
      default: return route.fallback();
    }
  });

  // Every write to a moderated table is recorded with its body (staff must use RPCs).
  state.writes = [];
  await ctx.route(/\/rest\/v1\/(profiles|reports|user_warnings|support_tickets|user_roles|blocks|live_chat_sessions)(\?|$)/, async (route) => {
    const req = route.request();
    if (["POST", "PATCH", "DELETE"].includes(req.method())) {
      const table = new URL(req.url()).pathname.split("/").pop();
      state.writes.push({ table, method: req.method(), body: JSON.parse(req.postData() || "null") });
    }
    return route.fallback();
  });
  await ctx.route(/\/rest\/v1\/live_chat_messages(\?|$)/, async (route) => {
    const req = route.request();
    if (req.method() !== "POST") return route.fallback();
    const item = JSON.parse(req.postData() || "{}");
    const row = { id: `m${state.live_chat_messages.length}-${Date.now()}`, created_at: now(), ...item };
    state.live_chat_messages.push(row);
    const single = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
    return route.fulfill({ status: 201, contentType: "application/json", headers: cors, body: JSON.stringify(single ? row : [row]) });
  });

  await ctx.route(`${SB}/functions/v1/isexy-ai-chat`, async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 200, headers: cors });
    const body = JSON.parse(req.postData() || "{}");
    state.log.push(`fn isexy-ai-chat ${body.action ?? "chat"}`);
    if (body.action === "handoff") {
      const s = { id: "lc000000-0000-4000-8000-000000000001", user_id: ANA, agent_id: null, status: "waiting", started_at: now(), created_at: now(), ticket_id: null, chatbot_conversation_id: "cv-1" };
      state.live_chat_sessions.push(s);
      state.live_chat_messages.push({ id: "m-agent", session_id: s.id, sender_type: "agent", sender_id: MOD, content: "Hi Ana, Mo here. How can I help?", created_at: now() });
      return json(route, { ok: true, sessionId: s.id, conversationId: "cv-1" });
    }
    const sse = 'data: {"choices":[{"delta":{"content":"To report someone, open their profile "}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"and tap Report."}}]}';  // last line without a newline
    return route.fulfill({ status: 200, contentType: "text/event-stream", headers: { ...cors, "x-conversation-id": "cv-1", "x-kb-sources": "%5B%5D" }, body: sse });
  });
}

async function setup(user, state) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await seedBrowser(ctx, user);
  await installMock(ctx, state, { user });
  await installTrust(ctx, state);
  state.as = user?.id ?? null;
  state.user = user ?? null;
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { ctx, page, errors };
}
const waitUntil = async (cond, ms = 5000) => { const end = Date.now() + ms; while (!cond() && Date.now() < end) await new Promise((r) => setTimeout(r, 100)); return cond(); };
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const rpcCalls = (state, fn) => state.rpc.filter((c) => c.fn === fn);
/** Direct writes to these tables, except the streak tracker's own last_active_at. */
const directWrites = (state, tables) => state.writes
  .filter((w) => tables.includes(w.table))
  .filter((w) => !(w.table === "profiles" && w.method === "PATCH" && w.body && Object.keys(w.body).every((k) => k === "last_active_at")))
  .map((w) => `${w.method} ${w.table} ${JSON.stringify(w.body)}`);

// ------------------------------------------------------------- A. members
{
  const state = trustState();
  const { ctx, page, errors } = await setup(makeUser(ANA), state);

  // A1 block
  await page.goto(`${base}/block-report/${BEN}`);
  await page.getByRole("heading", { name: "Block or report Ben" }).waitFor();
  check("A1 block/report page names the member", true);
  check("A1 phone layout: no horizontal scroll", await noHScroll(page));
  await page.screenshot({ path: `${out}/block-report-390.png` });
  await page.getByRole("button", { name: /^Block/ }).click();
  await page.waitForTimeout(600);
  check("A1 block goes through block_member", rpcCalls(state, "block_member").some((c) => c.body.p_profile_id === BEN));
  check("A1 no direct insert into blocks", directWrites(state, ["blocks"]).length === 0, directWrites(state, ["blocks"]).join(" | "));

  // A2 report + block
  await page.goto(`${base}/block-report/${BEN}`);
  await page.getByRole("button", { name: /^Report/ }).click();
  await page.getByRole("button", { name: /Scam or Fraud/ }).click();
  await page.getByPlaceholder(/What happened/).fill("Asked me for gift cards");
  await page.getByRole("button", { name: "Submit Report" }).click();
  await page.getByRole("heading", { name: "Report Submitted" }).waitFor();
  const rep = rpcCalls(state, "report_member").at(-1)?.body ?? {};
  check("A2 report goes through report_member (reason, details, block)", rep.p_reported_id === BEN && rep.p_reason === "scam" && rep.p_details === "Asked me for gift cards" && rep.p_block === true, JSON.stringify(rep));
  check("A2 no direct insert into reports", directWrites(state, ["reports"]).length === 0);

  // A3 own profile
  await page.goto(`${base}/block-report/${ANA}`);
  await page.getByText("This is your own profile.").waitFor();
  check("A3 cannot block or report yourself", await page.getByRole("button", { name: /^Block/ }).isDisabled());

  // A5 404 + A6 EN/FR
  await page.goto(`${base}/no-such-page`);
  await page.getByTestId("not-found").waitFor();
  check("A5 404 is branded with a way back", await page.getByRole("heading", { name: "This page doesn't exist" }).isVisible());
  check("A5 404 link goes to Discover when signed in (in-app link)", (await page.getByRole("link", { name: "Back to Discover" }).getAttribute("href")) === "/discover");
  check("A5 404 phone layout", await noHScroll(page));
  await page.screenshot({ path: `${out}/404-en-390.png` });

  await page.goto(`${base}/knowledge-base`);
  const langBtn = page.getByRole("button", { name: /^Language: / }).first();
  await langBtn.waitFor();
  check("A6 language button says which language is on", /English/.test(await langBtn.getAttribute("aria-label")), await langBtn.getAttribute("aria-label"));
  check("A6 language button shows EN", (await langBtn.innerText()).toLowerCase().includes("en"));
  await langBtn.click();
  await page.getByRole("menuitem", { name: /Français/ }).click();
  await page.waitForTimeout(300);
  check("A6 switched to French: button shows FR", (await page.getByRole("button", { name: /^Language: Français/ }).first().innerText()).toLowerCase().includes("fr"));
  check("A6 <html lang> follows the language (RouteSeo)", (await page.evaluate(() => document.documentElement.lang)) === "fr", await page.evaluate(() => document.documentElement.lang));
  await page.goto(`${base}/encore-une-page`);
  await page.getByTestId("not-found").waitFor();
  check("A6 404 in French", await page.getByRole("heading", { name: "Cette page n'existe pas" }).isVisible());
  await page.screenshot({ path: `${out}/404-fr-390.png` });
  await page.goto(`${base}/knowledge-base`);
  await page.getByRole("button", { name: /^Language: Français/ }).first().click();
  await page.getByRole("menuitem", { name: /English/ }).click();
  await page.waitForTimeout(300);
  check("A6 back to English", (await page.evaluate(() => document.documentElement.lang)) === "en", await page.evaluate(() => document.documentElement.lang));

  // A7 help search
  await page.goto(`${base}/help-support`);
  await page.getByRole("searchbox", { name: "Search the Help Centre" }).fill("billing");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/knowledge-base\?q=billing/);
  check("A7 Help search opens the Help Centre with the query", page.url().includes("/knowledge-base?q=billing"));

  // A9 assistant (member): streamed answer, then a person
  await page.goto(`${base}/help-support`);
  await page.getByRole("button", { name: /^Open ISEXY Concierge/ }).click();
  await page.getByPlaceholder("Ask me anything…").fill("How do I report someone?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByText("To report someone, open their profile and tap Report.").waitFor({ timeout: 5000 });
  check("A9 assistant answer streams in full (last line without newline)", true);
  await page.getByRole("button", { name: "Talk to a human" }).click();
  await page.getByText("Hi Ana, Mo here. How can I help?").waitFor({ timeout: 5000 });
  check("A9 member handoff: the agent's reply shows in the assistant", true);
  check("A9 header says live chat", await page.getByText(/Live chat/).first().isVisible());
  await page.getByPlaceholder("Write to the team…").fill("I was charged twice");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.waitForTimeout(500);
  const sent = state.live_chat_messages.find((m) => m.content === "I was charged twice");
  check("A9 member message goes to the live chat as the member", sent?.sender_type === "user" && sent?.sender_id === ANA && sent?.session_id === "lc000000-0000-4000-8000-000000000001", JSON.stringify(sent));
  await page.screenshot({ path: `${out}/assistant-live-390.png` });
  await page.getByRole("button", { name: "End chat" }).click();
  await page.waitForTimeout(400);
  check("A9 ending the chat uses end_my_live_chat", rpcCalls(state, "end_my_live_chat").length === 1);
  check("A9 assistant panel fits the phone", await noHScroll(page));

  // A10 Contact Us, signed in: the ticket goes under the sign-in e-mail (0015 K2)
  await page.goto(`${base}/contact-us`);
  const emailBox = page.locator("#email");
  await emailBox.waitFor();
  check("A10 signed in: the e-mail is the account's, read-only", (await emailBox.inputValue()) === "ana@example.com" && (await emailBox.getAttribute("readonly")) !== null);
  await page.locator("#name").fill("Ana");
  await page.getByRole("combobox").filter({ hasText: "Select a category" }).click();
  await page.getByRole("option", { name: "Account" }).click();
  await page.locator("#subject").fill("Question about my plan");
  await page.locator("#message").fill("Does Gold include Super Likes?");
  await page.getByRole("button", { name: /Submit Ticket/ }).click();
  await page.getByText(/Ticket #IS-[A-Z0-9]{6} sent/).waitFor({ timeout: 5000 });
  const filed = state.writes.filter((w) => w.table === "support_tickets" && w.method === "POST").at(-1)?.body;
  const filedRow = Array.isArray(filed) ? filed[0] : filed;
  check("A10 the ticket is filed under the sign-in e-mail with the member's id", filedRow?.email === "ana@example.com" && filedRow?.user_id === ANA, JSON.stringify(filedRow));
  check("A10 the confirmation is asked for (own address)", state.log.includes("fn isexy-send-ticket-confirmation"));

  // A11 Ticket Tracking, signed in: a ticket sent without signing in from Ana's e-mail opens in full
  await page.goto(`${base}/ticket-tracking`);
  await page.getByLabel("Ticket number").fill("IS-ANA777");
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByText("Welcome back, Ana.").first().waitFor({ timeout: 5000 });
  check("A11 signed in with the ticket's e-mail: content and reply shown", await page.getByText("hello from before").first().isVisible());
  check("A11 the list marks a ticket sent without signing in", await page.getByText("Sent without signing in, from your e-mail address.").first().isVisible());
  check("A11 the member's ticket list names its columns (no staff notes)",
    state.log.filter((l) => l.startsWith("GET support_tickets")).every((l) => !/select=\*|admin_notes/.test(l)), state.log.filter((l) => l.startsWith("GET support_tickets")).join(" | "));
  check("A no request the database would refuse (shadow-ban columns, staff notes, own e-mail, 0015 K)", deniedRequests().length === 0, deniedRequests().join(" | "));
  check("A members: no page errors", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------- A'. guests
{
  const state = trustState();
  const { ctx, page, errors } = await setup(null, state);
  await page.goto(`${base}/block-report/${BEN}`);
  await page.waitForURL(/\/auth/);
  check("A4 signed out: block/report asks to sign in", page.url().includes("/auth"));

  await page.goto(`${base}/ticket-tracking`);
  await page.getByLabel("Ticket number").fill("is-abc123");
  await page.getByLabel("E-mail used for the ticket").fill("Guest@Example.ca");
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByTestId("ticket-status-only").waitFor({ timeout: 5000 });
  check("A8 guest tracks a guest ticket by number + e-mail: its status", await page.getByText(/IS-ABC123/).first().isVisible() && await page.getByText(/We replied by e-mail on/).isVisible());
  check("A8 ...but not its content or the staff reply (0015 K2: the e-mail is not proven)",
    !(await page.getByText("We reset your sign-in.").isVisible()) && !(await page.getByText("help please").isVisible()));
  check("A8 tracking uses get_ticket_status (no table read)", rpcCalls(state, "get_ticket_status").length === 1 && !state.log.some((l) => l.startsWith("GET support_tickets")));
  check("A8 phone layout", await noHScroll(page));
  await page.screenshot({ path: `${out}/ticket-status-only-390.png` });
  await page.getByLabel("Ticket number").fill("IS-BEN001");
  await page.getByLabel("E-mail used for the ticket").fill("ben@example.ca");
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByText("Ticket not found").first().waitFor({ timeout: 5000 });
  check("A8 a member's ticket is not shown to a guest with its number + e-mail", !(await page.getByText("charged twice").isVisible()));

  // A12 Contact Us as a guest: any address (cannot be checked), field editable
  await page.goto(`${base}/contact-us`);
  await page.locator("#email").waitFor();
  check("A12 guest types an e-mail address", (await page.locator("#email").getAttribute("readonly")) === null);
  await page.locator("#name").fill("Guest");
  await page.locator("#email").fill("Someone@Example.ca");
  await page.getByRole("combobox").filter({ hasText: "Select a category" }).click();
  await page.getByRole("option", { name: "Account" }).click();
  await page.locator("#subject").fill("Cannot sign in");
  await page.locator("#message").fill("The code never arrives.");
  await page.getByRole("button", { name: /Submit Ticket/ }).click();
  await page.getByText(/Ticket #IS-[A-Z0-9]{6} sent/).waitFor({ timeout: 5000 });
  const guestRow = state.support_tickets.at(-1);
  check("A12 guest support still works (ticket stored, no account)", guestRow?.email === "someone@example.ca" && guestRow?.user_id === null, JSON.stringify(guestRow));

  await page.goto(`${base}/help-support`);
  await page.getByRole("button", { name: /^Open ISEXY Concierge/ }).click();
  await page.getByRole("button", { name: "Talk to a human" }).click();
  await page.getByRole("link", { name: "sign in" }).waitFor();
  check("A9 guests are offered sign-in or a ticket (no dead queue)", await page.getByRole("link", { name: "send us a ticket" }).isVisible());
  check("A9 no handoff call for guests", !state.log.some((l) => l === "fn isexy-ai-chat handoff"));
  check("A' no request the database would refuse (0015 K)", deniedRequests().length === 0, deniedRequests().join(" | "));
  check("A guests: no page errors", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------- B. moderator
{
  const state = trustState();
  const { ctx, page, errors } = await setup(makeUser(MOD, { email: "mo@isexy.ca" }), state);

  await page.goto(`${base}/admin/tickets`);
  await page.waitForURL(/\/admin$/);
  check("B2 moderator on an admin-only page lands on the staff home", new URL(page.url()).pathname === "/admin");
  await page.getByRole("heading", { name: "Staff" }).waitFor();
  await page.getByText("Reports to review").waitFor();
  check("B1 staff home loads numbers from staff_dashboard_stats", await waitUntil(() => rpcCalls(state, "staff_dashboard_stats").length >= 1), `${rpcCalls(state, "staff_dashboard_stats").length} call(s)`);
  await page.getByText("Ben").first().waitFor();
  check("B1 moderator sees no Revenue tab", !(await page.getByRole("tab", { name: "Revenue" }).isVisible()));
  check("B1 moderator sees no open-tickets tile", !(await page.getByText("Open tickets").isVisible()));
  check("B1 phone layout", await noHScroll(page));
  await page.screenshot({ path: `${out}/staff-home-mod-390.png` });

  // B3 member sheet actions
  await page.getByTestId("staff-member").filter({ hasText: "Ben" }).click();
  await page.getByTestId("member-sheet").waitFor();
  await page.getByRole("button", { name: "Suspend", exact: true }).click();
  await page.getByPlaceholder("Reason (required)").fill("repeated harassment");
  await page.getByRole("button", { name: "Suspend account" }).click();
  await page.waitForTimeout(500);
  const sus = rpcCalls(state, "staff_set_account_active").at(-1)?.body;
  check("B3 suspend through staff_set_account_active with a reason", sus?.p_profile_id === BEN && sus?.p_active === false && sus?.p_reason === "repeated harassment", JSON.stringify(sus));
  await page.getByRole("button", { name: "Warn", exact: true }).click();
  await page.locator("#warn-restriction").selectOption("24h");
  await page.getByPlaceholder("Note for the team (what happened)").fill("insults");
  await page.getByRole("button", { name: "Record warning" }).click();
  await page.waitForTimeout(500);
  const warn = rpcCalls(state, "staff_issue_warning").at(-1)?.body;
  check("B3 warning + 24 h restriction through staff_issue_warning", warn?.p_profile_id === BEN && warn?.p_restriction === "24h" && warn?.p_warning_type === "harassment", JSON.stringify(warn));
  await page.getByRole("button", { name: "Shadow ban" }).first().click();
  await page.getByPlaceholder("Reason").fill("fake photos");
  await page.getByRole("button", { name: "Shadow ban" }).last().click();
  await page.waitForTimeout(500);
  check("B3 shadow ban through staff_set_shadow_ban", rpcCalls(state, "staff_set_shadow_ban").at(-1)?.body?.p_banned === true);
  await page.getByTestId("member-sheet").getByText("Shadow banned").waitFor({ timeout: 5000 }).catch(() => {});
  check("B3 the sheet shows the ban, read through staff_get_shadow_bans (0015 K3)",
    await page.getByTestId("member-sheet").getByText("Shadow banned").isVisible()
      && rpcCalls(state, "staff_get_shadow_bans").some((c) => JSON.stringify(c.body.p_profile_ids) === JSON.stringify([BEN])));
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await page.waitForTimeout(500);
  check("B3 verification through staff_set_profile_verified", rpcCalls(state, "staff_set_profile_verified").at(-1)?.body?.p_verified === true);
  await page.screenshot({ path: `${out}/member-sheet-390.png` });
  check("B3 member sheet fits the phone", await noHScroll(page));
  await page.keyboard.press("Escape");
  await page.getByRole("group", { name: "Filter members" }).getByRole("button", { name: "Shadow banned" }).click();
  await page.waitForTimeout(700);
  const listed = await page.getByTestId("staff-member").allInnerTexts();
  check("B3 'Shadow banned' filter lists the banned members (ids from staff_get_shadow_bans)",
    listed.length === 1 && /Ben/.test(listed[0]) && /Shadow/.test(listed[0])
      && rpcCalls(state, "staff_get_shadow_bans").some((c) => c.body.p_profile_ids === null), JSON.stringify(listed));

  // B4-B6 moderation page
  await page.goto(`${base}/admin/moderation`);
  await page.getByTestId("staff-report").first().waitFor();
  check("B4 reports listed for a moderator", await page.getByText("asked for gift cards").isVisible());
  await page.getByTestId("staff-report").filter({ hasText: "asked for gift cards" }).getByRole("button", { name: "Resolve" }).click();
  await page.waitForTimeout(500);
  check("B4 report resolved through staff_resolve_report", rpcCalls(state, "staff_resolve_report").at(-1)?.body?.p_status === "resolved");
  check("B4 moderation phone layout", await noHScroll(page));
  check("D1 a report with HTML/script shows as text on the moderation page", await page.getByText("harassed me", { exact: false }).first().isVisible() && await page.getByText(XSS.report).first().isVisible());
  check("D1 nothing injected ran or became an element (reports)", (await xssRan(page)) === null && (await injectedNodes(page)) === 0, `${await xssRan(page)} / ${await injectedNodes(page)}`);
  await page.getByRole("tab", { name: "Attempts" }).click();
  await page.getByText(XSS.violation).first().waitFor({ timeout: 5000 });
  check("D2 a blocked chat attempt with a script shows as text", await page.getByText(XSS.violation).first().isVisible());
  check("D2 nothing injected ran or became an element (attempts)", (await xssRan(page)) === null && (await injectedNodes(page)) === 0, `${await xssRan(page)} / ${await injectedNodes(page)}`);
  await page.screenshot({ path: `${out}/moderation-390.png` });
  await page.getByRole("tab", { name: "Photos" }).click();
  await page.getByTestId("photo-check").first().waitFor();
  await page.getByRole("button", { name: "Approve" }).click();
  await page.waitForTimeout(500);
  check("B5 photo verification approved through review_photo_verification", rpcCalls(state, "review_photo_verification").at(-1)?.body?.p_approve === true);
  await page.getByRole("tab", { name: "Voice" }).click();
  await page.getByTestId("voice-review").getByText("Ben, 31").waitFor();
  await page.getByTestId("voice-review").getByRole("button", { name: "Approve" }).click();
  await page.waitForTimeout(500);
  check("B6 moderators review voice greetings (review_voice_greeting)", rpcCalls(state, "review_voice_greeting").length === 1);

  // B7 live chat
  state.live_chat_sessions.push({ id: "lc000000-0000-4000-8000-0000000000a1", user_id: ANA, agent_id: null, status: "waiting", started_at: now(), created_at: now(), ticket_id: null, chatbot_conversation_id: "cv-1" });
  await page.goto(`${base}/admin/agent`);
  await page.getByTestId("queue-session").waitFor();
  check("B7 queue shows the member's name", await page.getByTestId("queue-session").getByText("Ana").isVisible());
  check("B7 moderators see no tickets tab", !(await page.getByRole("tab", { name: "Tickets" }).isVisible()));
  await page.getByRole("button", { name: "Accept chat" }).click();
  await page.getByText("Mo from ISEXY Support joined the chat.").waitFor({ timeout: 5000 });
  check("B7 accept through staff_accept_live_chat", rpcCalls(state, "staff_accept_live_chat").length === 1);
  await page.getByRole("button", { name: /Conversation with the assistant/ }).click();
  check("B7 the assistant transcript is shown", await page.getByText("I was charged twice").isVisible());
  await page.getByPlaceholder("Write to the member…").fill("Hello Ana, I can help.");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.waitForTimeout(500);
  const agentMsg = state.live_chat_messages.find((m) => m.content === "Hello Ana, I can help.");
  check("B7 agent message posted as the agent (own id)", agentMsg?.sender_type === "agent" && agentMsg?.sender_id === MOD, JSON.stringify(agentMsg));
  check("B7 chat view fits the phone", await noHScroll(page));
  await page.screenshot({ path: `${out}/agent-chat-390.png` });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.waitForTimeout(500);
  check("B7 close through staff_close_live_chat", rpcCalls(state, "staff_close_live_chat").length === 1);
  check("B7 no direct update of live_chat_sessions", directWrites(state, ["live_chat_sessions"]).length === 0);

  // B8 support portal
  await page.goto(`${base}/support`);
  await page.getByTestId("staff-reports").waitFor();
  check("B8 portal opens on reports for a moderator", true);
  await page.getByRole("button", { name: "Menu" }).click();
  check("B8 no Tickets or Audit log for a moderator", !(await page.getByRole("button", { name: "Tickets" }).isVisible()) && !(await page.getByRole("button", { name: "Audit log" }).isVisible()));
  await page.getByRole("button", { name: "Suspended" }).click();
  await page.getByTestId("staff-members").waitFor();
  check("B8 'Suspended' opens the suspended members (no dead link)", await page.getByRole("button", { name: "Suspended" }).first().isVisible());
  check("B8 portal fits the phone", await noHScroll(page));

  check("B9 no direct write of profiles, reports, warnings or tickets by staff",
    directWrites(state, ["profiles", "reports", "user_warnings", "support_tickets", "user_roles", "blocks"]).length === 0,
    directWrites(state, ["profiles", "reports", "user_warnings", "support_tickets", "user_roles"]).join(" | "));
  check("B no request the database would refuse (shadow-ban columns, staff notes, 0015 K)", deniedRequests().length === 0, deniedRequests().join(" | "));
  check("B moderator: no page errors", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------- C. admin
{
  const state = trustState();
  const { ctx, page, errors } = await setup(makeUser(ADM, { email: "xan@isexy.ca" }), state);
  await page.goto(`${base}/admin`);
  await page.getByRole("heading", { name: "Staff" }).waitFor();
  await page.waitForTimeout(400);
  check("C1 admin sees Revenue and open tickets", await page.getByRole("tab", { name: "Revenue" }).isVisible() && await page.getByText("Open tickets").isVisible());

  await page.goto(`${base}/support`);
  await page.getByTestId("portal-ticket").first().waitFor();
  check("C2 admin portal opens on tickets", true);
  check("C2 tickets with staff notes come from staff_list_tickets (0015 K1), not a table read",
    (state.ticketListCalls ?? 0) >= 1 && !state.log.some((l) => /^GET support_tickets .*select=\*/.test(l)));
  await page.getByTestId("portal-ticket").filter({ hasText: "IS-ABC123" }).first().click();
  await page.getByText("called the guest back").first().waitFor({ timeout: 5000 });
  check("C2 the admin still reads a ticket's staff notes", await page.getByText("called the guest back").first().isVisible());
  await page.keyboard.press("Escape");
  await page.goto(`${base}/support`);
  await page.getByTestId("portal-ticket").first().waitFor();
  await page.getByTestId("portal-ticket").first().click();
  await page.locator("#saved-reply").selectOption("Account access");
  check("C2 saved reply inserted", (await page.getByPlaceholder(/Reply to the member/).inputValue()).startsWith("Thanks for reaching out."));
  await page.getByRole("button", { name: /Send reply & resolve/ }).click();
  await page.waitForTimeout(600);
  const upd = rpcCalls(state, "staff_update_ticket").at(-1)?.body;
  check("C2 reply through staff_update_ticket", upd?.p_status === "resolved" && upd?.p_response?.startsWith("Thanks for reaching out."), JSON.stringify(upd));
  check("C2 status e-mail sent after a real change", state.log.includes("fn isexy-send-ticket-status-update"));
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Audit log" }).click();
  await page.getByTestId("audit-log").getByText("Suspended").waitFor();
  check("C3 audit log lists staff actions with names", await page.getByTestId("audit-log").getByText("Mo").first().isVisible());
  check("D3 a reason with HTML shows as text in the audit log", await page.getByTestId("audit-log").getByText(XSS.audit, { exact: false }).first().isVisible());
  check("D3 nothing injected ran or became an element (audit log)", (await xssRan(page)) === null && (await injectedNodes(page)) === 0, `${await xssRan(page)} / ${await injectedNodes(page)}`);

  await page.goto(`${base}/support`);
  await page.getByTestId("portal-ticket").filter({ hasText: "refund" }).first().click();
  await page.getByText("please help").first().waitFor({ timeout: 5000 });
  check("D4 a ticket's name, subject and message with HTML show as text", await page.getByText(XSS.ticketMessage).first().isVisible() && await page.getByText(XSS.ticketSubject).first().isVisible());
  check("D4 nothing injected ran or became an element (tickets)", (await xssRan(page)) === null && (await injectedNodes(page)) === 0, `${await xssRan(page)} / ${await injectedNodes(page)}`);

  await page.goto(`${base}/admin/verifications`);
  await page.getByRole("tab", { name: "Cuban ID (on hold)" }).click();
  await page.getByText("Havana", { exact: false }).first().click();
  const popupsBefore = ctx.pages().length;
  await page.getByRole("button", { name: "Front" }).click();
  await page.getByText("This file link is not valid.").waitFor({ timeout: 5000 });
  check("D5 a 'javascript:' ID link from a member is not opened", (await xssRan(page)) === null && ctx.pages().length === popupsBefore, `${await xssRan(page)} / ${ctx.pages().length - popupsBefore} popup(s)`);
  await page.getByRole("button", { name: "Back" }).click();
  check("D5 a stored file path opens through a signed URL of the private bucket",
    await waitUntil(() => state.log.some((l) => l.includes(`sign/isexy-cuban-verifications/${ANA}/carnet-back.jpg`))), state.log.filter((l) => l.startsWith("storage")).join(" | "));
  for (const extra of ctx.pages()) if (extra !== page) await extra.close();

  await page.goto(`${base}/admin/users`);
  await page.getByText("User & Access Management").waitFor();
  await page.waitForTimeout(500);
  check("C4 roles listed through staff_list_roles", rpcCalls(state, "staff_list_roles").length >= 1 && await page.getByText("moderator", { exact: true }).first().isVisible());
  check("C admin: no direct write of tickets, roles or profiles", directWrites(state, ["support_tickets", "user_roles", "profiles"]).length === 0);
  check("C no request the database would refuse (0015 K)", deniedRequests().length === 0, deniedRequests().join(" | "));
  check("C admin: no page errors", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

await browser.close();
for (const r of results) console.log(r);
const failed = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
