// Twilio inbound voice webhook for the ISEXY phone line.
// Validates Twilio signature, identifies caller, returns IVR TwiML.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createHmac } from "node:crypto";

const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
const TWILIO_PHONE_LINE_NUMBER = Deno.env.get("TWILIO_PHONE_LINE_NUMBER") ?? "";
const SIG_BYPASS = Deno.env.get("TWILIO_SIGNATURE_BYPASS") === "true";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const xml = (body: string) =>
  new Response(`<?xml version="1.0" encoding="UTF-8"?>${body}`, {
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });

const safeNotConfigured = () =>
  xml(`<Response><Say voice="Polly.Joanna">The ISEXY phone line is not configured yet. Please try again later.</Say><Hangup/></Response>`);

function verifyTwilioSignature(url: string, params: Record<string, string>, sig: string): boolean {
  if (SIG_BYPASS) return true;
  if (!TWILIO_AUTH_TOKEN || !sig) return false;
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const k of sortedKeys) data += k + params[k];
  const expected = createHmac("sha1", TWILIO_AUTH_TOKEN).update(data).digest("base64");
  return expected === sig;
}

function normalizeE164(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^\+\d{7,16}$/.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 7 && digits.length <= 16) return "+" + digits;
  return null;
}

function welcomeMenuTwiml(actionUrl: string, name?: string) {
  const greet = name
    ? `Welcome back to ISEXY, ${name}.`
    : `Welcome to the ISEXY phone line.`;
  return xml(`<Response>
<Gather numDigits="1" action="${actionUrl}" method="POST" timeout="6">
<Say voice="Polly.Joanna">${greet} You are eighteen plus only. Your phone number stays private. Press 1 for your voice profile status. Press 2 to browse voice profiles. Press 3 to listen to voice replies. Press 4 to check phone minutes. Press 5 for safety tips. Press 9 to repeat this menu.</Say>
</Gather>
<Redirect method="POST">${actionUrl}?repeat=1</Redirect>
</Response>`);
}

function unknownCallerTwiml() {
  return xml(`<Response>
<Say voice="Polly.Joanna">Welcome to ISEXY. To use the phone line, please create an account in the ISEXY app and verify your phone number. Your phone number stays private. Goodbye.</Say>
<Hangup/>
</Response>`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  if (!TWILIO_AUTH_TOKEN || !TWILIO_ACCOUNT_SID || !TWILIO_PHONE_LINE_NUMBER) {
    return safeNotConfigured();
  }

  const url = req.url;
  const sig = req.headers.get("x-twilio-signature") ?? "";
  const formText = await req.text();
  const form = new URLSearchParams(formText);
  const params: Record<string, string> = {};
  form.forEach((v, k) => (params[k] = v));

  if (!verifyTwilioSignature(url, params, sig)) {
    return new Response("Invalid Twilio signature", { status: 403 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const fromRaw = params["From"] ?? "";
  const callSid = params["CallSid"] ?? "";
  const callStatus = params["CallStatus"] ?? "";
  const fromE164 = normalizeE164(fromRaw);

  const menuUrl = `${SUPABASE_URL}/functions/v1/twilio-phone-line-menu`;

  // Helper: log unknown/unverified callers to the safe log table (no raw phone numbers)
  const logUnknown = async (reason: string) => {
    let callerHash: string | null = null;
    let callerMasked: string | null = null;
    if (fromE164) {
      const enc = new TextEncoder().encode(fromE164);
      const buf = await crypto.subtle.digest("SHA-256", enc);
      callerHash = Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      callerMasked = fromE164.slice(0, 3) + "***" + fromE164.slice(-2);
    }
    await supabase.from("phone_line_inbound_call_logs").insert({
      call_sid: callSid || null,
      caller_hash: callerHash,
      caller_masked: callerMasked,
      call_status: callStatus || "received",
      reason,
    });
  };

  if (!fromE164) {
    await logUnknown("no_caller_id");
    return unknownCallerTwiml();
  }

  // Lookup verified phone number → profile
  const { data: pln } = await supabase
    .from("phone_line_numbers")
    .select("profile_id, phone_verified")
    .eq("phone_number_e164", fromE164)
    .eq("phone_verified", true)
    .maybeSingle();

  let callerProfileId: string | null = null;
  let firstName: string | undefined;

  if (pln?.profile_id) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("id, first_name, age, status")
      .eq("id", pln.profile_id)
      .maybeSingle();
    if (prof && (prof.age ?? 0) >= 18 && (prof.status ?? "active") !== "banned") {
      callerProfileId = prof.id;
      firstName = prof.first_name ?? undefined;
    }
  }

  if (!callerProfileId) {
    await logUnknown(pln ? "profile_inactive_or_underage" : "unverified_caller");
    return unknownCallerTwiml();
  }

  // Verified caller — log full call session
  const sessionStatus = callStatus === "in-progress" ? "connected" : "initiating";
  await supabase.from("call_sessions").insert({
    caller_profile_id: callerProfileId,
    call_type: "phone_line_menu",
    provider: "twilio",
    provider_call_sid: callSid || null,
    status: sessionStatus,
    started_at: new Date().toISOString(),
    answered_at: new Date().toISOString(),
  });

  return welcomeMenuTwiml(menuUrl, firstName);
});
