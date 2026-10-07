import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotificationEmailRequest {
  /** Service-role callers only. Members never choose the recipient. */
  email?: string;
  /** Member callers: the match the new message was sent in. */
  matchId?: string;
  type: "new_match" | "new_message" | "super_like" | "profile_boost" | "welcome" | "video_call_request";
  data?: {
    matchName?: string;
    senderName?: string;
    messagePreview?: string;
    firstName?: string;
    recipientEmail?: string;
    fromName?: string;
  };
}

const recentlyNotified = new Map<string, number>();

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: NotificationEmailRequest = await req.json();
    const type = body.type;
    let email = "";
    let rawData: NonNullable<NotificationEmailRequest["data"]> = body.data ?? {};

    // --- Who is calling? -----------------------------------------------------
    // Previously this endpoint was public and sent any content to any address.
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const isServiceRole = token.length > 0 && token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (isServiceRole) {
      email = body.email ?? "";
    } else {
      const { data: auth } = await admin.auth.getUser(token);
      if (!auth?.user) return json({ error: "Sign in required" }, 401);
      // Members may only notify the other participant of their own match.
      if (type !== "new_message" || !body.matchId) return json({ error: "Not allowed" }, 403);

      const { data: me } = await admin.from("profiles").select("id, first_name").eq("user_id", auth.user.id).maybeSingle();
      const { data: match } = await admin
        .from("matches")
        .select("profile1_id, profile2_id, is_active")
        .eq("id", body.matchId)
        .maybeSingle();
      if (!me || !match || match.is_active === false || (match.profile1_id !== me.id && match.profile2_id !== me.id)) {
        return json({ error: "Not allowed" }, 403);
      }
      const otherId = match.profile1_id === me.id ? match.profile2_id : match.profile1_id;
      const { data: other } = await admin.from("profiles").select("user_id, first_name").eq("id", otherId).maybeSingle();
      if (!other?.user_id) return json({ success: true, skipped: "no_recipient" });

      // At most one "new message" email per conversation every 10 minutes.
      const key = `${body.matchId}:${otherId}`;
      const last = recentlyNotified.get(key) ?? 0;
      if (Date.now() - last < 10 * 60_000) return json({ success: true, skipped: "throttled" });
      recentlyNotified.set(key, Date.now());
      if (recentlyNotified.size > 10_000) recentlyNotified.clear();

      const { data: recipient } = await admin.auth.admin.getUserById(other.user_id);
      email = recipient?.user?.email ?? "";
      if (!email || email.endsWith("@phone.isexy.ca")) return json({ success: true, skipped: "no_email" });
      rawData = {
        senderName: me.first_name,
        firstName: other.first_name,
        messagePreview: (body.data?.messagePreview ?? "").slice(0, 80),
      };
    }

    if (!email || !type) {
      return json({ error: "Email and type are required" }, 400);
    }

    // Everything interpolated into the HTML is escaped.
    const data = Object.fromEntries(
      Object.entries(rawData).map(([k, v]) => [k, typeof v === "string" ? escapeHtml(v) : v]),
    ) as typeof rawData;

    let subject: string;
    let htmlContent: string;
    const firstName = data.firstName || "there";

    switch (type) {
      case "new_match":
        subject = `🎉 You have a new match on ISEXY!`;
        htmlContent = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #E91E63, #FF5722); color: white; padding: 40px; text-align: center; border-radius: 16px 16px 0 0; }
                .content { background: #fff; padding: 40px; border-radius: 0 0 16px 16px; border: 1px solid #e0e0e0; }
                .button { display: inline-block; background: linear-gradient(135deg, #E91E63, #FF5722); color: white; padding: 16px 32px; text-decoration: none; border-radius: 30px; font-weight: bold; margin: 20px 0; }
                .emoji { font-size: 48px; margin-bottom: 20px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <div class="emoji">💕</div>
                  <h1>It's a Match!</h1>
                </div>
                <div class="content">
                  <p style="font-size: 18px;">Hey ${firstName}!</p>
                  <p>Great news! You and <strong>${data.matchName || "someone special"}</strong> have liked each other. Start a conversation now!</p>
                  <center>
                    <a href="https://isexy.ca/matches" class="button">Say Hello →</a>
                  </center>
                  <p style="color: #666; font-size: 14px; margin-top: 30px;">Don't keep them waiting! The best connections start with a simple hello.</p>
                </div>
              </div>
            </body>
          </html>
        `;
        break;

      case "new_message":
        subject = `💬 New message from ${data.senderName || "someone"} on ISEXY`;
        htmlContent = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #2196F3, #03A9F4); color: white; padding: 40px; text-align: center; border-radius: 16px 16px 0 0; }
                .content { background: #fff; padding: 40px; border-radius: 0 0 16px 16px; border: 1px solid #e0e0e0; }
                .message-preview { background: #f5f5f5; padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #E91E63; }
                .button { display: inline-block; background: linear-gradient(135deg, #E91E63, #FF5722); color: white; padding: 16px 32px; text-decoration: none; border-radius: 30px; font-weight: bold; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>💬 New Message</h1>
                </div>
                <div class="content">
                  <p style="font-size: 18px;">Hey ${firstName}!</p>
                  <p><strong>${data.senderName || "Someone"}</strong> sent you a message:</p>
                  <div class="message-preview">
                    <p style="margin: 0; font-style: italic;">"${data.messagePreview || "..."}"</p>
                  </div>
                  <center>
                    <a href="https://isexy.ca/matches" class="button">Reply Now →</a>
                  </center>
                </div>
              </div>
            </body>
          </html>
        `;
        break;

      case "super_like":
        subject = `⭐ Someone Super Liked you on ISEXY!`;
        htmlContent = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #2196F3, #00BCD4); color: white; padding: 40px; text-align: center; border-radius: 16px 16px 0 0; }
                .content { background: #fff; padding: 40px; border-radius: 0 0 16px 16px; border: 1px solid #e0e0e0; }
                .button { display: inline-block; background: linear-gradient(135deg, #E91E63, #FF5722); color: white; padding: 16px 32px; text-decoration: none; border-radius: 30px; font-weight: bold; }
                .star { font-size: 64px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <div class="star">⭐</div>
                  <h1>Super Like!</h1>
                </div>
                <div class="content">
                  <p style="font-size: 18px;">Wow, ${firstName}!</p>
                  <p>Someone really stands out from the crowd - they Super Liked your profile! This means they're <em>really</em> interested in getting to know you.</p>
                  <center>
                    <a href="https://isexy.ca/likes" class="button">See Who →</a>
                  </center>
                  <p style="color: #666; font-size: 14px; margin-top: 30px;">Super Likes are 3x more likely to lead to a match!</p>
                </div>
              </div>
            </body>
          </html>
        `;
        break;

      case "video_call_request":
        subject = `📹 Video call request on ISEXY`;
        htmlContent = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #9C27B0, #673AB7); color: white; padding: 40px; text-align: center; border-radius: 16px 16px 0 0; }
                .content { background: #fff; padding: 40px; border-radius: 0 0 16px 16px; border: 1px solid #e0e0e0; }
                .button { display: inline-block; background: linear-gradient(135deg, #E91E63, #FF5722); color: white; padding: 16px 32px; text-decoration: none; border-radius: 30px; font-weight: bold; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>📹 Video Call</h1>
                </div>
                <div class="content">
                  <p style="font-size: 18px;">Hey ${firstName}!</p>
                  <p><strong>${data.fromName || data.senderName || "Your match"}</strong> wants to video chat with you! Don't miss the chance to connect face-to-face.</p>
                  <center>
                    <a href="https://isexy.ca/matches" class="button">Open App →</a>
                  </center>
                  <p style="color: #666; font-size: 14px; margin-top: 30px;">Video calls help you build real connections faster!</p>
                </div>
              </div>
            </body>
          </html>
        `;
        break;

      case "welcome":
        subject = `🔥 Welcome to ISEXY!`;
        htmlContent = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #E91E63, #FF5722); color: white; padding: 50px; text-align: center; border-radius: 16px 16px 0 0; }
                .content { background: #fff; padding: 40px; border-radius: 0 0 16px 16px; border: 1px solid #e0e0e0; }
                .button { display: inline-block; background: linear-gradient(135deg, #E91E63, #FF5722); color: white; padding: 16px 32px; text-decoration: none; border-radius: 30px; font-weight: bold; }
                .tips { background: #fce4ec; padding: 20px; border-radius: 12px; margin: 20px 0; }
                .tip { padding: 8px 0; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1 style="font-size: 32px;">🔥 ISEXY</h1>
                  <p style="font-size: 20px; margin: 0;">¡Bienvenido!</p>
                </div>
                <div class="content">
                  <p style="font-size: 18px;">Hello ${firstName}! 👋</p>
                  <p>Welcome to ISEXY - where authentic Cuban connections meet the world!</p>
                  <div class="tips">
                    <p style="font-weight: bold; margin-bottom: 10px;">Quick tips to get started:</p>
                    <div class="tip">📸 Add at least 3 photos to boost your visibility</div>
                    <div class="tip">✍️ Write a bio that shows your personality</div>
                    <div class="tip">💬 Be genuine and start conversations</div>
                    <div class="tip">✅ Verify your profile for more trust</div>
                  </div>
                  <center>
                    <a href="https://isexy.ca/discover" class="button">Start Matching →</a>
                  </center>
                  <p style="color: #666; font-size: 14px; margin-top: 30px; text-align: center;">Happy matching! 💕</p>
                </div>
              </div>
            </body>
          </html>
        `;
        break;

      default:
        throw new Error("Invalid notification type");
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    
    if (RESEND_API_KEY) {
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "ISEXY <notifications@isexy.ca>",
          to: [email],
          subject,
          html: htmlContent,
        }),
      });

      if (!emailResponse.ok) {
        const errorData = await emailResponse.json();
        console.error("Resend error:", errorData);
      } else {
        console.log("Notification email sent successfully");
      }
    } else {
      console.log("=== NOTIFICATION EMAIL ===");
      console.log("To:", email);
      console.log("Type:", type);
      console.log("Subject:", subject);
      console.log("=========================");
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error sending notification email:", error);
    return new Response(
      JSON.stringify({ error: "Could not send notification" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
