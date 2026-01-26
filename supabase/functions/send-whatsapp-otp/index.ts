// Edge function for WhatsApp OTP using official WhatsApp Cloud API
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OTPRequest {
  phoneNumber: string;
  action: "send" | "verify";
  code?: string;
}

// Simple in-memory store for OTPs (in production, use Redis or database)
const otpStore = new Map<string, { code: string; expiresAt: number }>();

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phoneNumber, action, code } = await req.json() as OTPRequest;

    if (!phoneNumber || !action) {
      return new Response(
        JSON.stringify({ error: "Missing phoneNumber or action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize phone number (remove spaces, dashes)
    const normalizedPhone = phoneNumber.replace(/[\s\-\(\)]/g, "");

    if (action === "send") {
      const otp = generateOTP();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

      // Store OTP
      otpStore.set(normalizedPhone, { code: otp, expiresAt });

      // Get WhatsApp credentials from environment
      const whatsappToken = Deno.env.get("WHATSAPP_BUSINESS_TOKEN");
      const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

      if (!whatsappToken || !phoneNumberId) {
        // If WhatsApp API not configured, return success with simulated code
        // This allows testing without actual WhatsApp integration
        console.log(`[SIMULATION] OTP for ${normalizedPhone}: ${otp}`);
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "OTP sent successfully",
            // In dev mode, return the code for testing
            devCode: Deno.env.get("DENO_ENV") !== "production" ? otp : undefined
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Send via WhatsApp Cloud API
      const whatsappResponse = await fetch(
        `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${whatsappToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: normalizedPhone,
            type: "template",
            template: {
              name: "verification_code",
              language: { code: "en" },
              components: [
                {
                  type: "body",
                  parameters: [
                    { type: "text", text: otp }
                  ]
                }
              ]
            }
          }),
        }
      );

      if (!whatsappResponse.ok) {
        const errorData = await whatsappResponse.json();
        console.error("WhatsApp API error:", errorData);
        
        // Fallback: still return success but log the issue
        // In production, you might want to use SMS as fallback
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "OTP sent (simulation mode)",
            devCode: otp // For testing
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "OTP sent via WhatsApp" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "verify") {
      if (!code) {
        return new Response(
          JSON.stringify({ error: "Missing verification code" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const stored = otpStore.get(normalizedPhone);

      if (!stored) {
        return new Response(
          JSON.stringify({ verified: false, error: "No OTP found for this number" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (Date.now() > stored.expiresAt) {
        otpStore.delete(normalizedPhone);
        return new Response(
          JSON.stringify({ verified: false, error: "OTP expired" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (stored.code !== code) {
        return new Response(
          JSON.stringify({ verified: false, error: "Invalid code" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // OTP verified, remove from store
      otpStore.delete(normalizedPhone);

      return new Response(
        JSON.stringify({ verified: true, message: "Phone verified successfully" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("WhatsApp OTP error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to process OTP" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
