// Twilio call status callback: saves the status of the call_sessions row with
// this CallSid through isexy.apply_twilio_call_status (service role), which
// only moves statuses forward (a late 'in-progress' never reopens a finished
// call) and keeps the first answered_at.
import { createClient } from "../_shared/supabase.ts";
import { readTwilioRequest } from "../_shared/twilio.ts";

const FN = "isexy-twilio-call-status";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const read = await readTwilioRequest(FN, req);
  if ("error" in read) return read.error;
  const { params } = read;

  const callSid = params["CallSid"];
  const callStatus = params["CallStatus"];
  if (!callSid || !callStatus) return new Response("ok");
  const duration = Number.parseInt(params["CallDuration"] ?? "", 10);

  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: { persistSession: false },
  });
  const { data, error } = await admin.rpc("apply_twilio_call_status", {
    p_call_sid: callSid,
    p_status: callStatus,
    p_duration: Number.isFinite(duration) ? duration : null,
  });
  if (error) {
    console.error(`[${FN}] ${callSid} ${callStatus}:`, error.message);
    // 500 makes Twilio retry later (e.g. a database blip).
    return new Response("error", { status: 500 });
  }
  const result = data as { success?: boolean; error?: string } | null;
  if (result && !result.success && result.error !== "session_not_found") {
    console.warn(`[${FN}] ${callSid} ${callStatus}: ${result.error}`);
  }
  return new Response("ok");
});
