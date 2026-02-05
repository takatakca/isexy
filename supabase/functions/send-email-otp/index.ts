import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailOTPRequest {
  email: string;
  type: "verification" | "password_reset" | "login";
  firstName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, type, firstName = "there" }: EmailOTPRequest = await req.json();

    if (!email) {
      throw new Error("Email is required");
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP in database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Delete any existing unused OTPs for this email/type
    await supabase
      .from("otp_codes")
      .delete()
      .eq("email", email)
      .eq("type", type)
      .is("used_at", null);
    
    // Insert new OTP
    const { error: insertError } = await supabase
      .from("otp_codes")
      .insert({
        email,
        code: otp,
        type,
        expires_at: expiresAt.toISOString(),
      });
    
    if (insertError) {
      console.error("Error storing OTP:", insertError);
      throw new Error("Failed to generate verification code");
    }

    let subject: string;
    let htmlContent: string;

    switch (type) {
      case "verification":
        subject = "Verify your CubaDate email";
        htmlContent = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #E91E63, #FF5722); color: white; padding: 40px 30px; text-align: center; border-radius: 16px 16px 0 0; }
                .content { background: #ffffff; padding: 40px 30px; border-radius: 0 0 16px 16px; border: 1px solid #e0e0e0; border-top: none; }
                .otp-box { background: linear-gradient(135deg, #E91E63, #FF5722); color: white; font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 20px 40px; border-radius: 12px; text-align: center; margin: 30px 0; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
                .logo { font-size: 28px; font-weight: bold; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <div class="logo">🔥 CubaDate</div>
                  <h1 style="margin: 10px 0 0 0; font-size: 24px;">Verify Your Email</h1>
                </div>
                <div class="content">
                  <p style="font-size: 18px;">Hello ${firstName}! 👋</p>
                  <p>Welcome to CubaDate! Use the code below to verify your email address:</p>
                  <div class="otp-box">${otp}</div>
                  <p style="color: #666; font-size: 14px;">This code expires in 10 minutes.</p>
                  <p style="color: #666; font-size: 14px;">If you didn't request this code, you can safely ignore this email.</p>
                  <div class="footer">
                    <p>¡Bienvenido a la familia CubaDate! 🇨🇺</p>
                  </div>
                </div>
              </div>
            </body>
          </html>
        `;
        break;

      case "password_reset":
        subject = "Reset your CubaDate password";
        htmlContent = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #607D8B, #455A64); color: white; padding: 40px 30px; text-align: center; border-radius: 16px 16px 0 0; }
                .content { background: #ffffff; padding: 40px 30px; border-radius: 0 0 16px 16px; border: 1px solid #e0e0e0; border-top: none; }
                .otp-box { background: linear-gradient(135deg, #E91E63, #FF5722); color: white; font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 20px 40px; border-radius: 12px; text-align: center; margin: 30px 0; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
                .logo { font-size: 28px; font-weight: bold; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <div class="logo">🔥 CubaDate</div>
                  <h1 style="margin: 10px 0 0 0; font-size: 24px;">Password Reset</h1>
                </div>
                <div class="content">
                  <p style="font-size: 18px;">Hello ${firstName},</p>
                  <p>You requested to reset your password. Use this code to proceed:</p>
                  <div class="otp-box">${otp}</div>
                  <p style="color: #666; font-size: 14px;">This code expires in 10 minutes.</p>
                  <p style="color: #666; font-size: 14px;">If you didn't request this, please secure your account immediately.</p>
                  <div class="footer">
                    <p>Stay safe! - The CubaDate Team</p>
                  </div>
                </div>
              </div>
            </body>
          </html>
        `;
        break;

      case "login":
        subject = "Your CubaDate login code";
        htmlContent = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #E91E63, #FF5722); color: white; padding: 40px 30px; text-align: center; border-radius: 16px 16px 0 0; }
                .content { background: #ffffff; padding: 40px 30px; border-radius: 0 0 16px 16px; border: 1px solid #e0e0e0; border-top: none; }
                .otp-box { background: linear-gradient(135deg, #E91E63, #FF5722); color: white; font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 20px 40px; border-radius: 12px; text-align: center; margin: 30px 0; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
                .logo { font-size: 28px; font-weight: bold; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <div class="logo">🔥 CubaDate</div>
                  <h1 style="margin: 10px 0 0 0; font-size: 24px;">Login Code</h1>
                </div>
                <div class="content">
                  <p style="font-size: 18px;">Welcome back, ${firstName}! 👋</p>
                  <p>Here's your login code:</p>
                  <div class="otp-box">${otp}</div>
                  <p style="color: #666; font-size: 14px;">This code expires in 10 minutes.</p>
                  <p style="color: #666; font-size: 14px;">If you didn't try to log in, someone may be trying to access your account.</p>
                  <div class="footer">
                    <p>Happy matching! 💕</p>
                  </div>
                </div>
              </div>
            </body>
          </html>
        `;
        break;

      default:
        throw new Error("Invalid OTP type");
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
          from: "CubaDate <noreply@cubadate.com>",
          to: [email],
          subject,
          html: htmlContent,
        }),
      });

      if (!emailResponse.ok) {
        const errorData = await emailResponse.json();
        console.error("Resend error:", errorData);
      } else {
        console.log("Email sent successfully");
      }
    } else {
      console.log("=== EMAIL OTP ===");
      console.log("To:", email);
      console.log("Subject:", subject);
      console.log("OTP:", otp);
      console.log("=================");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `OTP sent to ${email}` 
      }),
      { 
        status: 200, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );
  } catch (error: any) {
    console.error("Error sending email OTP:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );
  }
};

serve(handler);
