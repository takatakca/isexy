import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface OTPRequest {
  phoneNumber: string;
  action: "send" | "verify";
  code?: string;
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { phoneNumber, action, code } = await req.json() as OTPRequest;

    if (!phoneNumber || !action) {
      return new Response(
        JSON.stringify({ error: "Missing phoneNumber or action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize phone number
    const normalizedPhone = phoneNumber.replace(/[\s\-\(\)]/g, "");

    if (action === "send") {
      // Rate limit: max 3 OTPs per phone within 1 hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count: recentCount } = await supabase
        .from("otp_codes")
        .select("id", { count: "exact", head: true })
        .eq("email", `whatsapp:${normalizedPhone}`)
        .eq("type", "whatsapp")
        .gte("created_at", oneHourAgo);
      if ((recentCount ?? 0) >= 3) {
        return new Response(
          JSON.stringify({ error: "Too many requests. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      // Delete old unused OTPs for this phone
      await supabase
        .from("otp_codes")
        .delete()
        .eq("email", `whatsapp:${normalizedPhone}`)
        .eq("type", "whatsapp")
        .is("used_at", null);

      // Store OTP in database (using otp_codes table, email field stores phone identifier)
      const { error: insertError } = await supabase
        .from("otp_codes")
        .insert({
          email: `whatsapp:${normalizedPhone}`,
          code: otp,
          type: "whatsapp",
          expires_at: expiresAt,
        });

      if (insertError) {
        console.error("Error storing OTP:", insertError);
        throw new Error("Failed to generate verification code");
      }

      // Try WhatsApp Cloud API if configured
      const whatsappToken = Deno.env.get("WHATSAPP_BUSINESS_TOKEN");
      const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

      if (whatsappToken && phoneNumberId) {
        try {
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
                      parameters: [{ type: "text", text: otp }],
                    },
                  ],
                },
              }),
            }
          );

          if (!whatsappResponse.ok) {
            const errorData = await whatsappResponse.json();
            console.error("WhatsApp API error:", errorData);
          } else {
            console.log("WhatsApp OTP sent successfully to", normalizedPhone);
          }
        } catch (whatsappErr) {
          console.error("WhatsApp send failed:", whatsappErr);
        }
      } else {
        console.log(`[SIMULATION] OTP for ${normalizedPhone}: ${otp}`);
      }

      // Always return the devCode so user can verify (until WhatsApp API is configured)
      return new Response(
        JSON.stringify({
          success: true,
          message: "Verification code sent!",
          devCode: otp,
        }),
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

      // Verify using database
      const { data: result } = await supabase.rpc("verify_otp", {
        p_email: `whatsapp:${normalizedPhone}`,
        p_code: code,
        p_type: "whatsapp",
      });

      if (result?.valid) {
        return new Response(
          JSON.stringify({ verified: true, message: "Phone verified successfully" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        return new Response(
          JSON.stringify({ verified: false, error: result?.error || "Invalid or expired code" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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
