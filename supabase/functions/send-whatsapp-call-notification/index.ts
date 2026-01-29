import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

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

    const { receiverId, callerId, callerName, matchId, callSessionId } = await req.json() as WhatsAppCallPayload;

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
    const WHATSAPP_API_TOKEN = Deno.env.get("WHATSAPP_API_TOKEN");
    const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

    if (!WHATSAPP_API_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
      console.log("[WHATSAPP-CALL] WhatsApp API not configured, sending SMS fallback");
      
      // Fallback: Log the call notification for now
      console.log(`[WHATSAPP-CALL] Would notify +${whatsappNumber}: Incoming video call from ${callerName}`);
      
      // Also send push notification as backup
      await supabaseClient.functions.invoke("send-push-notification", {
        body: {
          userId: receiverId,
          title: "📹 Incoming Video Call",
          body: `${callerName} is calling you on CubaDate!`,
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
    await supabaseClient.functions.invoke("send-push-notification", {
      body: {
        userId: receiverId,
        title: "📹 Incoming Video Call",
        body: `${callerName} is calling you on CubaDate!`,
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
