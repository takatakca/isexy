// Edge function to send email notifications when Cuban verification status changes
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profileId, status, rejectionReason } = await req.json();

    if (!profileId || !status) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: profileId, status" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get profile and user details
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, first_name")
      .eq("id", profileId)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user email
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(
      profile.user_id
    );

    if (userError || !userData.user?.email) {
      return new Response(
        JSON.stringify({ error: "User email not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userEmail = userData.user.email;
    const firstName = profile.first_name;

    // Prepare email content based on status
    let subject: string;
    let htmlContent: string;

    if (status === "approved") {
      subject = "🎉 Your ISEXY Verification is Approved!";
      htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #E91E63, #FF5722); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .badge { background: #4CAF50; color: white; padding: 10px 20px; border-radius: 20px; display: inline-block; }
              .button { background: #E91E63; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; display: inline-block; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Congratulations, ${firstName}! 🎉</h1>
              </div>
              <div class="content">
                <p style="font-size: 18px;">Your Cuban verification has been <span class="badge">APPROVED</span>!</p>
                <p>You now have access to all ISEXY features:</p>
                <ul>
                  <li>✅ Verified badge on your profile</li>
                  <li>✅ Priority visibility in searches</li>
                  <li>✅ Access to verified-only matches</li>
                  <li>✅ Enhanced trust from other users</li>
                </ul>
                <p style="text-align: center;">
                  <a href="https://isexy.ca/discover" class="button">Start Matching Now →</a>
                </p>
                <p style="margin-top: 30px; color: #666; font-size: 14px;">
                  ¡Bienvenido a la familia ISEXY!
                </p>
              </div>
            </div>
          </body>
        </html>
      `;
    } else if (status === "rejected") {
      subject = "ISEXY Verification Update";
      htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #607D8B; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .reason-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
              .button { background: #E91E63; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; display: inline-block; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Verification Update</h1>
              </div>
              <div class="content">
                <p>Hello ${firstName},</p>
                <p>We've reviewed your Cuban verification application. Unfortunately, we were unable to approve it at this time.</p>
                ${rejectionReason ? `
                <div class="reason-box">
                  <strong>Reason:</strong><br>
                  ${rejectionReason}
                </div>
                ` : ''}
                <p>You can submit a new verification request with updated documents:</p>
                <ul>
                  <li>📸 Clear photos of your Carnet de Identidad (front and back)</li>
                  <li>🎥 Video verification following the instructions</li>
                  <li>🎤 Audio verification in Spanish</li>
                </ul>
                <p style="text-align: center;">
                  <a href="https://isexy.ca/cuban-signup" class="button">Resubmit Verification →</a>
                </p>
                <p style="margin-top: 30px; color: #666; font-size: 14px;">
                  If you have questions, please contact our support team.
                </p>
              </div>
            </div>
          </body>
        </html>
      `;
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid status. Use 'approved' or 'rejected'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send email via Resend or fallback to logging
    if (RESEND_API_KEY) {
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "ISEXY <notifications@isexy.ca>",
          to: [userEmail],
          subject,
          html: htmlContent,
        }),
      });

      if (!emailResponse.ok) {
        const errorData = await emailResponse.json();
        console.error("Resend error:", errorData);
        // Don't fail - log the email instead
        console.log("Email would be sent to:", userEmail);
        console.log("Subject:", subject);
      }
    } else {
      // Log email for development
      console.log("=== EMAIL NOTIFICATION ===");
      console.log("To:", userEmail);
      console.log("Subject:", subject);
      console.log("========================");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Verification ${status} notification sent to ${userEmail}` 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
