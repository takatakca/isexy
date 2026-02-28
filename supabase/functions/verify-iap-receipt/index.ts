import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Mobile IAP Receipt Verification Stub
 * 
 * Supports Google Play and Apple App Store receipt validation.
 * Replace the TODO sections with actual store API calls when ready.
 * 
 * Expected body:
 * {
 *   platform: "google" | "apple",
 *   receipt: string,           // Base64 receipt (Apple) or purchase token (Google)
 *   productId: string,         // The product/SKU being purchased
 *   packageName?: string       // Android package name (Google only)
 * }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Unauthorized");

    const { platform, receipt, productId, packageName } = await req.json();
    if (!platform || !receipt || !productId) {
      throw new Error("Missing required fields: platform, receipt, productId");
    }

    console.log(`[VERIFY-IAP] Platform: ${platform}, Product: ${productId}, User: ${userData.user.id}`);

    let verified = false;
    let subscriptionData: any = null;

    if (platform === "google") {
      // TODO: Implement Google Play receipt verification
      // Use Google Play Developer API:
      // GET https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{packageName}/purchases/subscriptions/{subscriptionId}/tokens/{token}
      // Requires: GOOGLE_PLAY_SERVICE_ACCOUNT_KEY secret
      
      console.log("[VERIFY-IAP] Google Play verification stub - implement with service account");
      // For now, return unverified
      verified = false;
      subscriptionData = {
        platform: "google",
        productId,
        status: "stub_not_implemented",
        message: "Google Play verification requires GOOGLE_PLAY_SERVICE_ACCOUNT_KEY. Add it as a secret and implement the API call."
      };

    } else if (platform === "apple") {
      // TODO: Implement Apple App Store receipt verification
      // Use App Store Server API v2:
      // POST https://buy.itunes.apple.com/verifyReceipt (production)
      // POST https://sandbox.itunes.apple.com/verifyReceipt (sandbox)
      // Requires: APPLE_SHARED_SECRET
      
      console.log("[VERIFY-IAP] Apple receipt verification stub - implement with shared secret");
      verified = false;
      subscriptionData = {
        platform: "apple",
        productId,
        status: "stub_not_implemented",
        message: "Apple receipt verification requires APPLE_SHARED_SECRET. Add it as a secret and implement the API call."
      };

    } else {
      throw new Error(`Unsupported platform: ${platform}. Use 'google' or 'apple'.`);
    }

    // When verified = true, you would:
    // 1. Look up the profile for this user
    // 2. Map productId to subscription tier
    // 3. Update profiles.subscription_tier, is_premium, subscription_expires_at
    // 4. Call sync_entitlements(profile_id)
    // 5. Insert into subscriptions table

    return new Response(JSON.stringify({
      verified,
      subscription: subscriptionData,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[VERIFY-IAP] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
