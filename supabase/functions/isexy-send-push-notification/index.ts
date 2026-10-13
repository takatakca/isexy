import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "../_shared/supabase.ts";
import { isexyEnv } from "../_shared/env.ts";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  tag?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require an authenticated member, or an internal call with the service key.
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const isServiceRole = token.length > 0 && token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const request = await req.json() as PushPayload;
    const title = String(request.title ?? "").slice(0, 80);
    const body = String(request.body ?? "").slice(0, 200);
    const { data, tag } = request;

    // Callers pass either an auth user id or a profile id; resolve both.
    let userId = request.userId;
    const { data: byUser } = await supabaseClient.from("profiles").select("id, user_id").eq("user_id", userId).maybeSingle();
    const target = byUser ?? (await supabaseClient.from("profiles").select("id, user_id").eq("id", userId).maybeSingle()).data;
    if (!target) {
      return new Response(JSON.stringify({ error: "Recipient not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    userId = target.user_id;

    if (!isServiceRole) {
      const { data: ud } = await supabaseClient.auth.getUser(token);
      if (!ud?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Members can only notify themselves or someone they're matched with.
      if (ud.user.id !== userId) {
        const { data: callerProfile } = await supabaseClient
          .from("profiles").select("id").eq("user_id", ud.user.id).maybeSingle();
        const { data: shared } = callerProfile ? await supabaseClient
          .from("matches")
          .select("id")
          .or(`and(profile1_id.eq.${callerProfile.id},profile2_id.eq.${target.id}),and(profile1_id.eq.${target.id},profile2_id.eq.${callerProfile.id})`)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle() : { data: null };
        if (!shared) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    console.log(`[PUSH] Sending notification to user: ${userId}`);

    // Get user's push subscriptions
    const { data: subscriptions, error: subError } = await supabaseClient
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", userId);

    if (subError) {
      console.error("[PUSH] Error fetching subscriptions:", subError);
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log("[PUSH] No subscriptions found for user");
      return new Response(
        JSON.stringify({ success: false, message: "No push subscriptions found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const VAPID_PUBLIC_KEY = isexyEnv("VAPID_PUBLIC_KEY");
    const VAPID_PRIVATE_KEY = isexyEnv("VAPID_PRIVATE_KEY");

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      console.log("[PUSH] VAPID keys not configured, skipping push notification");
      return new Response(
        JSON.stringify({ success: false, message: "VAPID keys not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clicking the notification opens data.url (public/sw.js); only same-site paths.
    const safeData: Record<string, string> = {};
    for (const [k, v] of Object.entries(data ?? {})) {
      if (typeof v === "string") safeData[k] = v.slice(0, 200);
    }
    if (!safeData.url || !safeData.url.startsWith("/") || safeData.url.startsWith("//")) safeData.url = "/matches";

    const payload = JSON.stringify({
      title,
      body,
      data: safeData,
      tag: String(tag || "default").slice(0, 64),
    });

    webpush.setVapidDetails(isexyEnv("VAPID_SUBJECT") ?? isexyEnv("APP_URL") ?? "https://isexy.ca", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const results = await Promise.allSettled(
      subscriptions.map((s) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 60 * 60 },
        )
      ),
    );
    let sent = 0;
    let expired = 0;
    results.forEach((r) => {
      if (r.status === "fulfilled") {
        sent++;
        return;
      }
      const statusCode = (r.reason as { statusCode?: number } | undefined)?.statusCode;
      // 404/410: the browser unsubscribed. The row is kept (no deletes); it just fails quietly.
      if (statusCode === 404 || statusCode === 410) expired++;
      else console.error("[PUSH] Send failed:", statusCode, (r.reason as Error | undefined)?.message);
    });
    console.log(`[PUSH] Sent ${sent}/${subscriptions.length} (expired ${expired})`);

    return new Response(
      JSON.stringify({ success: sent > 0, sent, expired, failed: subscriptions.length - sent - expired }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[PUSH] Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
