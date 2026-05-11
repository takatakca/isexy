// Twilio call status callback — updates call_sessions by provider_call_sid.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createHmac } from "node:crypto";

const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
const SIG_BYPASS = Deno.env.get("TWILIO_SIGNATURE_BYPASS") === "true";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function verifyTwilioSignature(url: string, params: Record<string, string>, sig: string): boolean {
  if (SIG_BYPASS) return true;
  if (!TWILIO_AUTH_TOKEN || !sig) return false;
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const k of sortedKeys) data += k + params[k];
  const expected = createHmac("sha1", TWILIO_AUTH_TOKEN).update(data).digest("base64");
  return expected === sig;
}

const STATUS_MAP: Record<string, string> = {
  "ringing": "initiating",
  "in-progress": "connected",
  "completed": "completed",
  "busy": "missed",
  "no-answer": "missed",
  "failed": "failed",
  "canceled": "canceled",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const url = req.url;
  const sig = req.headers.get("x-twilio-signature") ?? "";
  const formText = await req.text();
  const form = new URLSearchParams(formText);
  const params: Record<string, string> = {};
  form.forEach((v, k) => (params[k] = v));

  if (!verifyTwilioSignature(url, params, sig)) {
    return new Response("Invalid Twilio signature", { status: 403 });
  }

  const callSid = params["CallSid"];
  const callStatus = params["CallStatus"];
  const duration = parseInt(params["CallDuration"] ?? "0", 10) || 0;

  if (!callSid) return new Response("ok");

  const mapped = STATUS_MAP[callStatus] ?? "initiating";
  const update: Record<string, unknown> = {
    status: mapped,
    updated_at: new Date().toISOString(),
  };
  if (["completed", "failed", "missed", "canceled"].includes(mapped)) {
    update.ended_at = new Date().toISOString();
    if (duration > 0) update.duration_seconds = duration;
  }
  if (mapped === "connected") {
    update.answered_at = new Date().toISOString();
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  await supabase.from("call_sessions").update(update).eq("provider_call_sid", callSid);

  return new Response("ok");
});
