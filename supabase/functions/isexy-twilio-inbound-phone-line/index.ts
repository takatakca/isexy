// Twilio inbound voice webhook for the ISEXY phone line.
// Checks the Twilio signature against the public URL, identifies the caller by
// a verified number, records one call_sessions row per CallSid and answers
// with the IVR menu (TwiML). Configure in Twilio (phone number > Voice):
//   A call comes in:      POST {SUPABASE_URL}/functions/v1/isexy-twilio-inbound-phone-line
//   Call status changes:  POST {SUPABASE_URL}/functions/v1/isexy-twilio-call-status
import { createClient } from "../_shared/supabase.ts";
import { isexyEnv } from "../_shared/env.ts";
import { functionsBase, identifyCaller, mainMenu, normalizeE164, readTwilioRequest, say, twiml } from "../_shared/twilio.ts";

const FN = "isexy-twilio-inbound-phone-line";

const notConfigured = () =>
  twiml(`${say("The ISEXY phone line is not available yet. Please try again later.")}<Hangup/>`);

const unknownCaller = () =>
  twiml(`${say("Welcome to ISEXY. To use the phone line, open the ISEXY app, go to Phone Line, and link the phone number you signed in with. Your number stays private. Goodbye.")}<Hangup/>`);

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!isexyEnv("TWILIO_AUTH_TOKEN") && isexyEnv("TWILIO_SIGNATURE_BYPASS") !== "true") return notConfigured();

  const read = await readTwilioRequest(FN, req);
  if ("error" in read) return read.error;
  const params = read.params;

  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: { persistSession: false },
  });
  const callSid = params["CallSid"] ?? "";
  const from = normalizeE164(params["From"]);
  const caller = await identifyCaller(admin, from);

  if ("reason" in caller) {
    // Unknown or unverified caller: keep a safe trace (hash + masked number, never the raw number).
    let callerHash: string | null = null;
    let callerMasked: string | null = null;
    if (from) {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(from));
      callerHash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
      callerMasked = `${from.slice(0, 3)}***${from.slice(-2)}`;
    }
    await admin.from("phone_line_inbound_call_logs").insert({
      call_sid: callSid || null,
      caller_hash: callerHash,
      caller_masked: callerMasked,
      call_status: params["CallStatus"] || "received",
      reason: caller.reason,
    });
    return unknownCaller();
  }

  // One session per CallSid: Twilio retries this webhook on timeouts.
  if (callSid) {
    const { data: existing } = await admin.from("call_sessions").select("id").eq("provider_call_sid", callSid).limit(1);
    if (!existing?.length) {
      const now = new Date().toISOString();
      const { error } = await admin.from("call_sessions").insert({
        caller_profile_id: caller.profileId,
        call_type: "phone_line_menu",
        provider: "twilio",
        provider_call_sid: callSid,
        status: "connected", // the IVR answers right away
        started_at: now,
        answered_at: now,
      });
      if (error && error.code !== "23505") console.error(`[${FN}] call_sessions insert failed:`, error.message);
    }
  }

  const greeting = caller.firstName ? `Welcome back to ISEXY, ${caller.firstName}.` : "Welcome to the ISEXY phone line.";
  return mainMenu(`${functionsBase()}/isexy-twilio-phone-line-menu`, greeting);
});
