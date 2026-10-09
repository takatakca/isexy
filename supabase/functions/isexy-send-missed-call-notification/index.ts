import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "../_shared/supabase.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { isexyEnv } from "../_shared/env.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MissedCallPayload {
  callerId: string;
  receiverId: string;
  matchId: string;
  callerName: string;
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

    const payload = await req.json() as MissedCallPayload;
    const { matchId } = payload;
    const resolved = await resolveCall(supabaseClient, req, matchId);
    if (!resolved.ok) {
      return new Response(JSON.stringify({ error: resolved.error }), {
        status: resolved.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { callerId, receiverId } = resolved;
    // Escaped: used in the email subject and HTML.
    const callerName = escapeHtml(resolved.callerName);

    console.log(`[MISSED-CALL] Processing missed call notification for receiver ${receiverId}`);

    // Record the missed call
    const { data: missedCall, error: insertError } = await supabaseClient
      .from("missed_calls")
      .insert({
        caller_id: callerId,
        receiver_id: receiverId,
        match_id: matchId,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[MISSED-CALL] Error recording missed call:", insertError);
    }

    // Get receiver's details
    const { data: receiverProfile } = await supabaseClient
      .from("profiles")
      .select("user_id, first_name")
      .eq("id", receiverId)
      .single();

    if (!receiverProfile) {
      throw new Error("Receiver profile not found");
    }

    // Get user email
    const { data: userData } = await supabaseClient.auth.admin.getUserById(receiverProfile.user_id);
    const receiverEmail = userData?.user?.email;

    // Send email notification
    if (receiverEmail) {
      const resendApiKey = isexyEnv("RESEND_API_KEY");
      if (resendApiKey) {
        const resend = new Resend(resendApiKey);
        
        await resend.emails.send({
          from: isexyEnv("RESEND_FROM") ?? "ISEXY <onboarding@resend.dev>",
          to: [receiverEmail],
          subject: `📞 Missed Video Call from ${callerName}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: 'Segoe UI', sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
                .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; }
                .header { background: linear-gradient(135deg, #E91E63, #FF5722); padding: 30px; text-align: center; }
                .header h1 { color: white; margin: 0; font-size: 24px; }
                .content { padding: 30px; }
                .message { font-size: 16px; color: #333; line-height: 1.6; }
                .cta { display: inline-block; background: #E91E63; color: white; padding: 14px 28px; border-radius: 25px; text-decoration: none; font-weight: bold; margin: 20px 0; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>📞 Missed Call</h1>
                </div>
                <div class="content">
                  <p class="message">Hi ${receiverProfile.first_name},</p>
                  <p class="message"><strong>${callerName}</strong> tried to video call you but couldn't reach you.</p>
                  <p class="message">You can call them back or send a message to schedule a call for later.</p>
                  <center>
                    <a href="${isexyEnv("APP_URL") ?? "https://isexy.onrender.com"}/chat/${matchId}" class="cta">Reply to ${callerName}</a>
                  </center>
                </div>
              </div>
            </body>
            </html>
          `,
        });

        // Update missed call record
        if (missedCall) {
          await supabaseClient
            .from("missed_calls")
            .update({ notified_email: true })
            .eq("id", missedCall.id);
        }

        console.log("[MISSED-CALL] Email notification sent");
      }
    }

    // Send WhatsApp notification (for Cuban users)
    const { data: verification } = await supabaseClient
      .from("cuban_verifications")
      .select("whatsapp_number, whatsapp_verified")
      .eq("profile_id", receiverId)
      .eq("verification_status", "approved")
      .maybeSingle();

    if (verification?.whatsapp_number && verification.whatsapp_verified) {
      const whatsappApiToken = isexyEnv("WHATSAPP_API_TOKEN");
      const whatsappPhoneId = isexyEnv("WHATSAPP_PHONE_NUMBER_ID");

      if (whatsappApiToken && whatsappPhoneId) {
        const whatsappNumber = verification.whatsapp_number.replace(/\D/g, "");

        await fetch(
          `https://graph.facebook.com/v18.0/${whatsappPhoneId}/messages`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${whatsappApiToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              recipient_type: "individual",
              to: whatsappNumber,
              type: "template",
              template: {
                name: "missed_call_notification",
                language: { code: "es" },
                components: [
                  {
                    type: "body",
                    parameters: [
                      { type: "text", text: callerName },
                    ],
                  },
                ],
              },
            }),
          }
        );

        if (missedCall) {
          await supabaseClient
            .from("missed_calls")
            .update({ notified_whatsapp: true })
            .eq("id", missedCall.id);
        }

        console.log("[MISSED-CALL] WhatsApp notification sent");
      }
    }

    // Send push notification
    await supabaseClient.functions.invoke("isexy-send-push-notification", {
      body: {
        userId: receiverId,
        title: "📞 Missed Video Call",
        body: `You missed a call from ${callerName}`,
        data: {
          type: "missed_call",
          matchId,
          callerId,
        },
      },
    });

    if (missedCall) {
      await supabaseClient
        .from("missed_calls")
        .update({ notified_push: true })
        .eq("id", missedCall.id);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Missed call notifications sent" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[MISSED-CALL] Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
