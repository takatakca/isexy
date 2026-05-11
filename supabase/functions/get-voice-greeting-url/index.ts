// Edge function: get-voice-greeting-url
// Returns a short-lived signed URL to a voice greeting audio file.
// Owners can fetch their own greeting at any status.
// Other authenticated users can only fetch greetings that are
// approved + active + not hidden, on a public + active phone-line profile,
// and only if neither party has blocked the other.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SIGNED_URL_TTL_SECONDS = 300; // 5 minutes

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userId = user.id;

    const body = await req.json().catch(() => ({}));
    const greetingId = typeof body?.greeting_id === "string" ? body.greeting_id : null;
    if (!greetingId) {
      return json({ error: "greeting_id is required" }, 400);
    }

    // Use service role for the lookup so we can do all checks server-side
    // without depending on RLS quirks. We then enforce access rules ourselves.
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: greeting, error: gErr } = await admin
      .from("voice_greetings")
      .select(
        "id, profile_id, phone_line_profile_id, audio_url, moderation_status, is_active, is_hidden"
      )
      .eq("id", greetingId)
      .maybeSingle();

    if (gErr || !greeting) {
      return json({ error: "Not found" }, 404);
    }

    // Resolve viewer profile id
    const { data: viewerProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    const viewerProfileId = viewerProfile?.id ?? null;
    const isOwner = viewerProfileId && viewerProfileId === greeting.profile_id;

    if (!isOwner) {
      // Public access checks
      if (
        greeting.moderation_status !== "approved" ||
        greeting.is_active !== true ||
        greeting.is_hidden === true
      ) {
        return json({ error: "Not available" }, 403);
      }

      const { data: plp } = await admin
        .from("phone_line_profiles")
        .select("status, is_public")
        .eq("id", greeting.phone_line_profile_id)
        .maybeSingle();

      if (!plp || plp.status !== "active" || plp.is_public !== true) {
        return json({ error: "Not available" }, 403);
      }

      // Block check
      if (viewerProfileId) {
        const { data: blocks } = await admin
          .from("blocks")
          .select("id")
          .or(
            `and(blocker_id.eq.${viewerProfileId},blocked_id.eq.${greeting.profile_id}),and(blocker_id.eq.${greeting.profile_id},blocked_id.eq.${viewerProfileId})`
          )
          .limit(1);
        if (blocks && blocks.length > 0) {
          return json({ error: "Not available" }, 403);
        }
      }
    }

    const { data: signed, error: sErr } = await admin.storage
      .from("voice-greetings")
      .createSignedUrl(greeting.audio_url, SIGNED_URL_TTL_SECONDS);

    if (sErr || !signed?.signedUrl) {
      return json({ error: "Could not sign URL" }, 500);
    }

    return json({
      signed_url: signed.signedUrl,
      expires_in: SIGNED_URL_TTL_SECONDS,
    });
  } catch (e) {
    console.error("get-voice-greeting-url error:", e);
    return json({ error: "Server error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
