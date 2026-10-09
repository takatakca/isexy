import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "../_shared/supabase.ts";
import { isexyEnv } from "../_shared/env.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WhatsAppCallPayload {
  receiverId: string;
  callerId: string;
  callerName: string;
  matchId: string;
  callSessionId: string;
}


/**
 * Only a signed-in participant of the match may notify the other participant.
 * Recipient and display name come from the database, never from the request
 * (this endpoint used to let anyone message any member with any name).
 */
async function resolveCall(
  // deno-lint-ignore no-explicit-any
  admin: any,
  req: Request,
  matchId: unknown,
): Promise<{ ok: true; callerId: string; callerName: string; receiverId: string } | { ok: false; status: number; error: string }> {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const { data: auth } = await admin.auth.getUser(token);
  if (!auth?.user) return { ok: false, status: 401, error: "Sign in required" };
  if (typeof matchId !== "string") return { ok: false, status: 400, error: "matchId required" };
  const { data: caller } = await admin.from("profiles").select("id, first_name").eq("user_id", auth.user.id).maybeSingle();
  const { data: match } = await admin.from("matches").select("profile1_id, profile2_id, is_active").eq("id", matchId).maybeSingle();
  if (!caller || !match || match.is_active === false || (match.profile1_id !== caller.id && match.profile2_id !== caller.id)) {
    return { ok: false, status: 403, error: "Not allowed" };
  }
  const key = `${matchId}:${caller.id}`;
  if (Date.now() - (recentCalls.get(key) ?? 0) < 60_000) return { ok: false, status: 429, error: "Please wait a minute" };
  recentCalls.set(key, Date.now());
  if (recentCalls.size > 10_000) recentCalls.clear();
  return {
    ok: true,
    callerId: caller.id,
    callerName: String(caller.first_name ?? "Someone").slice(0, 40),
    receiverId: match.profile1_id === caller.id ? match.profile2_id : match.profile1_id,
  };
}

const recentCalls = new Map<string, number>();

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const payload = await req.json() as WhatsAppCallPayload;
    const { matchId, callSessionId } = payload;
    const resolved = await resolveCall(supabaseClient, req, matchId);
    if (!resolved.ok) {
      return new Response(JSON.stringify({ error: resolved.error }), {
        status: resolved.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { receiverId, callerId, callerName } = resolved;
    void callerId;

    console.log(`[WHATSAPP-CALL] Notifying user ${receiverId} about call from ${callerName}`);

    // Get receiver's Cuban verification info (which has their WhatsApp number)
    const { data: verification, error: verifyError } = await supabaseClient
      .from("cuban_verifications")
      .select("whatsapp_number, whatsapp_verified")
      .eq("profile_id", receiverId)
      .eq("verification_status", "approved")
      .maybeSingle();

    if (verifyError) {
      console.error("[WHATSAPP-CALL] Error fetching verification:", verifyError);
      throw verifyError;
    }

    if (!verification?.whatsapp_number || !verification.whatsapp_verified) {
      console.log("[WHATSAPP-CALL] User has no verified WhatsApp number");
      return new Response(
        JSON.stringify({ success: false, message: "No verified WhatsApp number" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format WhatsApp number (remove any non-digit characters)
    const whatsappNumber = verification.whatsapp_number.replace(/\D/g, "");

    // WhatsApp Business API integration
    // Note: This requires a WhatsApp Business API account and approved template
    const WHATSAPP_API_TOKEN = isexyEnv("WHATSAPP_API_TOKEN");
    const WHATSAPP_PHONE_NUMBER_ID = isexyEnv("WHATSAPP_PHONE_NUMBER_ID");

    if (!WHATSAPP_API_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
      console.log("[WHATSAPP-CALL] WhatsApp API not configured, sending SMS fallback");
      
      // Fallback: Log the call notification for now
      console.log(`[WHATSAPP-CALL] Would notify +${whatsappNumber}: Incoming video call from ${callerName}`);
      
      // Also send push notification as backup
      await supabaseClient.functions.invoke("isexy-send-push-notification", {
        body: {
          userId: receiverId,
          title: "📹 Incoming Video Call",
          body: `${callerName} is calling you on ISEXY!`,
          data: {
            type: "video_call",
            matchId: matchId,
            callSessionId: callSessionId,
            url: `/video-call/${matchId}`,
          },
          tag: "video-call",
        },
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Push notification sent (WhatsApp API not configured)",
          whatsappNumber: whatsappNumber.slice(-4), // Last 4 digits for verification
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send WhatsApp message using Business API
    const whatsappResponse = await fetch(
      `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${WHATSAPP_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: whatsappNumber,
          type: "template",
          template: {
            name: "video_call_notification", // Must be pre-approved template
            language: { code: "es" }, // Spanish for Cuba
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: callerName },
                ],
              },
              {
                type: "button",
                sub_type: "url",
                index: "0",
                parameters: [
                  { type: "text", text: matchId },
                ],
              },
            ],
          },
        }),
      }
    );

    const whatsappData = await whatsappResponse.json();
    
    if (!whatsappResponse.ok) {
      console.error("[WHATSAPP-CALL] WhatsApp API error:", whatsappData);
      throw new Error(whatsappData.error?.message || "WhatsApp API error");
    }

    console.log("[WHATSAPP-CALL] WhatsApp notification sent:", whatsappData);

    // Also send push notification
    await supabaseClient.functions.invoke("isexy-send-push-notification", {
      body: {
        userId: receiverId,
        title: "📹 Incoming Video Call",
        body: `${callerName} is calling you on ISEXY!`,
        data: {
          type: "video_call",
          matchId: matchId,
          callSessionId: callSessionId,
          url: `/video-call/${matchId}`,
        },
        tag: "video-call",
      },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "WhatsApp notification sent",
        messageId: whatsappData.messages?.[0]?.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[WHATSAPP-CALL] Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
