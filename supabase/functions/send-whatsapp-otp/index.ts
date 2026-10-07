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
  return (100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000)).toString();
}

// Per-isolate guard against SMS/WhatsApp pumping (cycling through many numbers).
const sendsByUser = new Map<string, number[]>();
const sendsByIp = new Map<string, number[]>();
function overLimit(map: Map<string, number[]>, key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (map.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    map.set(key, recent);
    return true;
  }
  recent.push(now);
  map.set(key, recent);
  if (map.size > 20_000) map.clear();
  return false;
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

    // The WhatsApp step happens after the account is created: require it.
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const { data: auth } = await supabase.auth.getUser(token);
    if (!auth?.user) {
      return new Response(
        JSON.stringify({ error: "Please sign in to verify your WhatsApp number." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (action === "send") {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
      if (overLimit(sendsByUser, auth.user.id, 5, 24 * 3600_000) || overLimit(sendsByIp, ip, 10, 3600_000)) {
        return new Response(
          JSON.stringify({ error: "Too many codes requested. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!phoneNumber || !action) {
      return new Response(
        JSON.stringify({ error: "Missing phoneNumber or action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize phone number
    const normalizedPhone = phoneNumber.replace(/[\s\-\(\)]/g, "");
    if (!/^\+?\d{8,15}$/.test(normalizedPhone)) {
      return new Response(
        JSON.stringify({ error: "Enter a valid phone number with country code." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
        // Provider not configured — do NOT log the OTP in production.
        console.warn("WhatsApp provider not configured; OTP stored in DB only.");
      }

      // Never return the OTP to the client.
      return new Response(
        JSON.stringify({
          success: true,
          message: "Verification code sent!",
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
