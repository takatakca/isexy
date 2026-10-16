// SQL test for docs/handoff/calls.sql in PGlite (V1 mock + 0001-0003 + calls.sql twice).
// PGlite is not a project dependency: copy calls-sql-test.mjs and calls-sql-base.mjs
// into a scratch dir, `npm i @electric-sql/pglite` there, then
// `node calls-sql-test.mjs <repo root>`.
import { boot } from "./calls-sql-base.mjs";
const repo = process.argv[2];
const sql = `${repo}/docs/handoff/calls.sql`;
const { db, q, as } = await boot(repo, [sql, sql]);
console.log("applied calls.sql twice");
const U = { a: "aaaaaaaa-0000-4000-8000-000000000001", b: "bbbbbbbb-0000-4000-8000-000000000002", c: "cccccccc-0000-4000-8000-000000000003" };
const P = {};
for (const [k, id] of Object.entries(U)) {
  await q(`INSERT INTO auth.users(id) VALUES ($1)`, [id]);
  P[k] = (await q(`INSERT INTO isexy.profiles(user_id, first_name, birth_date, gender) VALUES ($1,$2,'1990-01-01','woman') RETURNING id`, [id, k.toUpperCase()]))[0].id;
}
const M = (await q(`INSERT INTO isexy.matches(profile1_id, profile2_id, is_active) VALUES ($1,$2,true) RETURNING id`, [P.a, P.b]))[0].id;
await q(`INSERT INTO isexy.user_credits(profile_id, phone_minutes, video_minutes) VALUES ($1, 5, 5)`, [P.a]);
let fails = 0;
const check = (label, cond, extra = "") => { if (!cond) fails++; console.log(`${cond ? "PASS" : "FAIL"} ${label}${extra ? "  " + extra : ""}`); };
const rpc = async (who, fn, args) => (await as(U[who], () => q(`SELECT isexy.${fn}(${args.map((_, i) => `$${i + 1}`).join(",")}) r`, args)))[0].r;
const row = async (id) => (await q(`SELECT * FROM isexy.video_call_sessions WHERE id=$1`, [id]))[0];
const bal = async () => (await q(`SELECT video_minutes v, phone_minutes p FROM isexy.user_credits WHERE profile_id=$1`, [P.a]))[0];

// constraint widened: legacy RPC works again
check("deduct_call_minute works after CHECK widened", (await rpc("a", "deduct_call_minute", [P.a, "video"])).success === true);
await q(`UPDATE isexy.user_credits SET video_minutes=5 WHERE profile_id=$1`, [P.a]);

let r = await rpc("c", "start_call", [M, "video"]);
check("outsider cannot ring a match", r.error === "match_unavailable", JSON.stringify(r));
r = await rpc("a", "start_call", [M, "bogus"]);
check("invalid call type refused", r.error === "invalid_type");
r = await rpc("a", "start_call", [M, "video"]);
check("caller starts call", r.success && r.call_session_id, JSON.stringify(r));
const S1 = r.call_session_id;
check("session ringing, receiver set", (await row(S1)).status === "ringing" && (await row(S1)).receiver_id === P.b);
check("caller cannot answer own call", (await rpc("a", "answer_call", [S1])).error === "not_found");
check("charge before connect refused", (await rpc("a", "charge_call_minute", [S1])).error === "call_not_active");
check("cannot mark connected before answer", (await rpc("a", "mark_call_connected", [S1])).error === "call_not_active");
r = await rpc("b", "answer_call", [S1]);
check("receiver answers", r.success && r.call_type === "video", JSON.stringify(r));
check("record missed refused after answer", (await rpc("a", "record_missed_call", [S1])).error === "call_not_ringing");
check("receiver marks connected", (await rpc("b", "mark_call_connected", [S1])).success === true);
check("receiver cannot charge", (await rpc("b", "charge_call_minute", [S1])).error === "not_found");
r = await rpc("a", "charge_call_minute", [S1]);
check("first minute charged at connect", r.success && r.charged === true && r.remaining === 4, JSON.stringify(r));
r = await rpc("a", "charge_call_minute", [S1]);
check("second charge right away not due", r.success && r.charged === false && r.remaining === 4, JSON.stringify(r));
await q(`UPDATE isexy.video_call_sessions SET connected_at = now() - interval '130 seconds' WHERE id=$1`, [S1]);
const c2 = await rpc("a", "charge_call_minute", [S1]); const c3 = await rpc("a", "charge_call_minute", [S1]); const c4 = await rpc("a", "charge_call_minute", [S1]);
check("time gate: 130 s => 3 minutes max", c2.charged && c3.charged && !c4.charged && c4.remaining === 2, JSON.stringify([c2, c3, c4]));
const tx = await q(`SELECT type, category, amount, video_call_id FROM isexy.credit_transactions WHERE profile_id=$1 AND video_call_id=$2`, [P.a, S1]);
check("each minute logged against the session", tx.length === 3 && tx.every((t) => t.type === "video_call" && t.category === "video"), JSON.stringify(tx[0]));
r = await rpc("b", "end_call", [S1, "hangup"]);
check("receiver ends connected call", r.success && r.status === "ended" && r.duration_seconds >= 129 && r.credits_used === 3, JSON.stringify(r));
check("no extra charge (already paid 3)", (await bal()).v === 2);
r = await rpc("a", "end_call", [S1, "hangup"]);
check("second end is a no-op", r.already_ended === true);
check("charge after end refused", (await rpc("a", "charge_call_minute", [S1])).error === "call_not_active");

// settlement when the caller skipped per-minute charges
r = await rpc("a", "start_call", [M, "phone"]);
const S2 = r.call_session_id;
await q(`UPDATE isexy.user_credits SET phone_minutes=3 WHERE profile_id=$1`, [P.a]);
await rpc("b", "answer_call", [S2]); await rpc("a", "mark_call_connected", [S2]);
await q(`UPDATE isexy.video_call_sessions SET connected_at = now() - interval '200 seconds' WHERE id=$1`, [S2]);
r = await rpc("a", "end_call", [S2, "hangup"]);
check("settlement takes what is owed, capped by balance (owed 4, had 3)", r.credits_used === 3 && (await bal()).p === 0, JSON.stringify(r));
check("phone minutes logged with phone category", (await q(`SELECT sum(amount)::int s FROM isexy.credit_transactions WHERE video_call_id=$1 AND category='phone'`, [S2]))[0].s === -3);

// no minutes
r = await rpc("a", "start_call", [M, "phone"]);
check("no phone minutes => no_minutes", r.error === "no_minutes", JSON.stringify(r));

// decline
r = await rpc("a", "start_call", [M, "video"]); const S3 = r.call_session_id;
check("caller cannot decline", (await rpc("a", "decline_call", [S3])).error === "not_found");
r = await rpc("b", "decline_call", [S3]);
check("receiver declines", r.status === "declined" && (await row(S3)).status === "declined");
check("answer after decline refused", (await rpc("b", "answer_call", [S3])).error === "call_not_active");

// missed
r = await rpc("a", "start_call", [M, "video"]); const S4 = r.call_session_id;
check("missed too early refused", (await rpc("a", "record_missed_call", [S4])).error === "too_early");
check("receiver cannot record missed", (await rpc("b", "record_missed_call", [S4])).error === "not_found");
check("outsider cannot record missed", (await rpc("c", "record_missed_call", [S4])).error === "not_found");
await q(`UPDATE isexy.video_call_sessions SET created_at = now() - interval '36 seconds' WHERE id=$1`, [S4]);
r = await rpc("a", "record_missed_call", [S4]);
check("caller records missed call", r.success && r.missed_call_id, JSON.stringify(r));
const mc = await q(`SELECT caller_id, receiver_id, match_id, call_session_id FROM isexy.missed_calls WHERE call_session_id=$1`, [S4]);
check("missed_calls row has caller, receiver, match, session", mc.length === 1 && mc[0].caller_id === P.a && mc[0].receiver_id === P.b && mc[0].match_id === M);
check("session marked missed", (await row(S4)).status === "missed");
r = await rpc("a", "record_missed_call", [S4]);
check("second record is idempotent", r.already_recorded === true && r.missed_call_id === mc[0].call_session_id ? false : r.already_recorded === true);
let dup = "inserted";
try { await q(`INSERT INTO isexy.missed_calls(call_session_id, caller_id, receiver_id, match_id) VALUES ($1,$2,$3,$4)`, [S4, P.a, P.b, M]); } catch (e) { dup = e.message; }
check("edge-function duplicate insert for same session rejected", /unique|duplicate/.test(dup), dup);

// superseded ringing
r = await rpc("a", "start_call", [M, "video"]); const S5 = r.call_session_id;
r = await rpc("a", "start_call", [M, "video"]); const S6 = r.call_session_id;
check("new call stops my older ringing call", (await row(S5)).status === "ended" && (await row(S5)).end_reason === "superseded" && (await row(S6)).status === "ringing");
// caller cancels while ringing
r = await rpc("a", "end_call", [S6, "cancel"]);
check("caller cancel while ringing => ended, no charge", r.status === "ended" && r.credits_used === 0);
// rate limit
r = await rpc("a", "start_call", [M, "video"]);
check("6 calls in 2 minutes => too_many_calls", r.error === "too_many_calls", JSON.stringify(r));
await q(`UPDATE isexy.video_call_sessions SET created_at = created_at - interval '10 minutes'`);
// blocked
await q(`INSERT INTO isexy.blocks(blocker_id, blocked_id) VALUES ($1,$2)`, [P.b, P.a]);
check("blocked => unavailable", (await rpc("a", "start_call", [M, "video"])).error === "unavailable");
// ---------------- Phone Line calls (call_sessions) ----------------
// B blocked A above: a fresh caller "D" for the phone line.
const UD = "dddddddd-0000-4000-8000-000000000004";
await q(`INSERT INTO auth.users(id) VALUES ($1)`, [UD]);
U.d = UD;
P.d = (await q(`INSERT INTO isexy.profiles(user_id, first_name, birth_date, gender) VALUES ($1,'D','1990-01-01','man') RETURNING id`, [UD]))[0].id;
await q(`INSERT INTO isexy.user_credits(profile_id, phone_minutes) VALUES ($1, 5)`, [P.d]);
const PL = (await q(`INSERT INTO isexy.phone_line_profiles(profile_id, display_name, age, status, is_public) VALUES ($1,'Bee',30,'active',true) RETURNING id`, [P.b]))[0].id;
const cs = async (id) => (await q(`SELECT * FROM isexy.call_sessions WHERE id=$1`, [id]))[0];
const pbal = async () => (await q(`SELECT phone_minutes p FROM isexy.user_credits WHERE profile_id=$1`, [P.d]))[0].p;
r = await rpc("d", "start_phone_line_call_session", [P.b, "phone_line_profile"]);
check("phone line: start works (no profiles.age error) and rings", r.success && (await cs(r.call_session_id)).status === "ringing" && (await cs(r.call_session_id)).answered_at === null, JSON.stringify(r));
const L1 = r.call_session_id;
check("phone line: nothing charged while ringing", (await rpc("d", "charge_call_session_minute", [L1])).error === "not_connected" && (await pbal()) === 5);
check("phone line: caller cannot answer", (await rpc("d", "answer_call_session", [L1])).error === "not_found");
check("phone line: outsider cannot answer", (await rpc("c", "answer_call_session", [L1])).error === "not_found");
r = await rpc("b", "answer_call_session", [L1]);
check("phone line: receiver answers, gets caller name", r.success && r.caller_name === "D", JSON.stringify(r));
check("phone line: outsider cannot mark connected", (await rpc("c", "mark_call_session_connected", [L1])).error === "not_found");
check("phone line: receiver marks connected", (await rpc("b", "mark_call_session_connected", [L1])).success && (await cs(L1)).status === "connected");
r = await rpc("d", "charge_call_session_minute", [L1]);
check("phone line: first minute charged (credit_transactions 'spend' now accepted)", r.success && r.charged && r.remaining === 4, JSON.stringify(r));
await q(`UPDATE isexy.call_sessions SET answered_at = now() - interval '150 seconds' WHERE id=$1`, [L1]);
r = await rpc("b", "end_call_session", [L1, "hangup"]);
check("phone line: end settles unpaid minutes (150 s => 3, paid 1, take 2)", r.status === "completed" && r.minutes_charged === 3 && (await pbal()) === 2, JSON.stringify(r));
check("phone line: minute ledger has the settlement", (await q(`SELECT sum(minutes_charged)::int s FROM isexy.call_minute_transactions WHERE call_session_id=$1`, [L1]))[0].s === 3);
r = await rpc("d", "start_phone_line_call_session", [P.b, "phone_line_profile"]); const L2 = r.call_session_id;
r = await rpc("b", "decline_call_session", [L2]);
check("phone line: receiver declines", r.status === "declined" && (await cs(L2)).status === "declined");
r = await rpc("d", "start_phone_line_call_session", [P.b, "phone_line_profile"]); const L3 = r.call_session_id;
r = await rpc("d", "end_call_session", [L3, "no_answer"]);
check("phone line: caller ring timeout => missed, duration 0", r.status === "missed" && r.duration_seconds === 0);
r = await rpc("d", "start_phone_line_call_session", [P.b, "phone_line_profile"]); const L4 = r.call_session_id;
r = await rpc("d", "start_phone_line_call_session", [P.b, "phone_line_profile"]);
check("phone line: new call cancels my older ringing call", (await cs(L4)).status === "canceled" && (await cs(L4)).end_reason === "superseded");
await q(`UPDATE isexy.profiles SET birth_date = current_date - interval '17 years' WHERE id=$1`, [P.c]);
await q(`INSERT INTO isexy.user_credits(profile_id, phone_minutes) VALUES ($1, 5)`, [P.c]);
check("phone line: under 18 refused (from birth_date)", (await rpc("c", "start_phone_line_call_session", [P.b, "phone_line_profile"])).error === "age_restricted");
await q(`UPDATE isexy.phone_line_profiles SET status='paused' WHERE id=$1`, [PL]);
check("phone line: paused voice profile cannot be called", (await rpc("d", "start_phone_line_call_session", [P.b, "phone_line_profile"])).error === "voice_profile_unavailable");
const pub = await q(`SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='isexy' AND tablename='call_sessions'`);
check("phone line: call_sessions in the realtime publication", pub.length === 1);

// anon cannot execute
let anon = "executed";
await db.exec("SET ROLE anon");
try { await q(`SELECT isexy.start_call($1,'video')`, [M]); } catch (e) { anon = e.message; }
await db.exec("RESET ROLE");
check("anon has no EXECUTE", /permission denied/.test(anon), anon);
console.log(fails ? `${fails} FAILED` : "ALL PASS");
