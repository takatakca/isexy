// Edge function: get-voice-reply-url
// Returns a short-lived signed URL to a voice reply audio file.
// Only the sender or receiver can fetch it.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SIGNED_URL_TTL_SECONDS = 300;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) return json({ error: "Unauthorized" }, 401);
    const userId = claimsData.claims.sub;

    const body = await req.json().catch(() => ({}));
    const replyId = typeof body?.reply_id === "string" ? body.reply_id : null;
    if (!replyId) return json({ error: "reply_id is required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: reply, error: rErr } = await admin
      .from("phone_line_voice_replies")
      .select("id, from_profile_id, to_profile_id, audio_url, moderation_status, is_hidden")
      .eq("id", replyId)
      .maybeSingle();
    if (rErr || !reply) return json({ error: "Not found" }, 404);

    const { data: viewer } = await admin
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    const viewerId = viewer?.id ?? null;

    const isSender = viewerId && viewerId === reply.from_profile_id;
    const isReceiver = viewerId && viewerId === reply.to_profile_id;
    if (!isSender && !isReceiver) return json({ error: "Forbidden" }, 403);

    if (reply.is_hidden && !isSender) return json({ error: "Not available" }, 403);
    if (reply.moderation_status === "rejected" && !isSender) {
      return json({ error: "Not available" }, 403);
    }

    const { data: signed, error: sErr } = await admin.storage
      .from("voice-replies")
      .createSignedUrl(reply.audio_url, SIGNED_URL_TTL_SECONDS);
    if (sErr || !signed?.signedUrl) return json({ error: "Could not sign URL" }, 500);

    return json({ signed_url: signed.signedUrl, expires_in: SIGNED_URL_TTL_SECONDS });
  } catch (e) {
    console.error("get-voice-reply-url error:", e);
    return json({ error: "Server error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
