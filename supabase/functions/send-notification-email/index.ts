import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotificationEmailRequest {
  email: string;
  type: "new_match" | "new_message" | "super_like" | "profile_boost" | "welcome";
  data?: {
    matchName?: string;
    senderName?: string;
    messagePreview?: string;
    firstName?: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, type, data = {} }: NotificationEmailRequest = await req.json();

    if (!email || !type) {
      throw new Error("Email and type are required");
    }

    let subject: string;
    let htmlContent: string;
    const firstName = data.firstName || "there";

    switch (type) {
      case "new_match":
        subject = `🎉 You have a new match on CubaDate!`;
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
                    <a href="https://cubadate.com/matches" class="button">Say Hello →</a>
                  </center>
                  <p style="color: #666; font-size: 14px; margin-top: 30px;">Don't keep them waiting! The best connections start with a simple hello.</p>
                </div>
              </div>
            </body>
          </html>
        `;
        break;

      case "new_message":
        subject = `💬 New message from ${data.senderName || "someone"} on CubaDate`;
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
                    <a href="https://cubadate.com/matches" class="button">Reply Now →</a>
                  </center>
                </div>
              </div>
            </body>
          </html>
        `;
        break;

      case "super_like":
        subject = `⭐ Someone Super Liked you on CubaDate!`;
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
                    <a href="https://cubadate.com/likes" class="button">See Who →</a>
                  </center>
                  <p style="color: #666; font-size: 14px; margin-top: 30px;">Super Likes are 3x more likely to lead to a match!</p>
                </div>
              </div>
            </body>
          </html>
        `;
        break;

      case "welcome":
        subject = `🔥 Welcome to CubaDate!`;
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
                  <h1 style="font-size: 32px;">🔥 CubaDate</h1>
                  <p style="font-size: 20px; margin: 0;">¡Bienvenido!</p>
                </div>
                <div class="content">
                  <p style="font-size: 18px;">Hello ${firstName}! 👋</p>
                  <p>Welcome to CubaDate - where authentic Cuban connections meet the world!</p>
                  <div class="tips">
                    <p style="font-weight: bold; margin-bottom: 10px;">Quick tips to get started:</p>
                    <div class="tip">📸 Add at least 3 photos to boost your visibility</div>
                    <div class="tip">✍️ Write a bio that shows your personality</div>
                    <div class="tip">💬 Be genuine and start conversations</div>
                    <div class="tip">✅ Verify your profile for more trust</div>
                  </div>
                  <center>
                    <a href="https://cubadate.com/discover" class="button">Start Matching →</a>
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
          from: "CubaDate <notifications@cubadate.com>",
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
      JSON.stringify({ success: true, message: `Notification sent to ${email}` }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error sending notification email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
