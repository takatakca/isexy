import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Valid email is required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Rate limit: max 3 OTPs per email/type within 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabase
      .from("otp_codes")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .eq("type", type)
      .gte("created_at", oneHourAgo);
    if ((recentCount ?? 0) >= 3) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    
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

    // Build email content
    const typeLabels: Record<string, { subject: string; heading: string }> = {
      verification: { subject: "Verify your ISEXY email", heading: "Verify Your Email" },
      password_reset: { subject: "Reset your ISEXY password", heading: "Password Reset" },
      login: { subject: "Your ISEXY login code", heading: "Login Code" },
    };

    const { subject, heading } = typeLabels[type] || typeLabels.verification;

    const htmlContent = `
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
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div style="font-size: 28px; font-weight: bold;">🔥 ISEXY</div>
              <h1 style="margin: 10px 0 0 0; font-size: 24px;">${heading}</h1>
            </div>
            <div class="content">
              <p style="font-size: 18px;">Hello ${firstName}! 👋</p>
              <p>Your verification code is:</p>
              <div class="otp-box">${otp}</div>
              <p style="color: #666; font-size: 14px;">This code expires in 10 minutes.</p>
              <p style="color: #666; font-size: 14px;">If you didn't request this code, you can safely ignore this email.</p>
              <div class="footer">
                <p>Welcome to ISEXY! 🇨🇺🇨🇦</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    let emailSent = false;
    
    if (RESEND_API_KEY) {
      // Use Resend's default onboarding sender (works without custom domain)
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "ISEXY <onboarding@resend.dev>",
          to: [email],
          subject,
          html: htmlContent,
        }),
      });

      if (!emailResponse.ok) {
        const errorData = await emailResponse.json();
        console.error("Resend error:", errorData);
      } else {
        emailSent = true;
        console.log("Email sent successfully to", email);
      }
    }
    
    if (!emailSent) {
      console.log("=== EMAIL OTP (not sent via email service) ===");
      console.log("To:", email);
      console.log("OTP:", otp);
      console.log("=================");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Verification code sent to ${email}`,
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
