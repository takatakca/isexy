import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StatusUpdateRequest {
  email: string;
  name: string;
  ticketNumber: string;
  subject: string;
  oldStatus: string;
  newStatus: string;
  response?: string;
}

const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    open: "Open",
    in_progress: "In Progress",
    resolved: "Resolved",
    closed: "Closed",
  };
  return labels[status] || status;
};

const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    open: "#3B82F6",
    in_progress: "#F59E0B",
    resolved: "#10B981",
    closed: "#6B7280",
  };
  return colors[status] || "#6B7280";
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { email, name, ticketNumber, subject, oldStatus, newStatus, response }: StatusUpdateRequest = await req.json();

    console.log(`Sending status update email to ${email} for ticket ${ticketNumber}`);

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🔥 CubaDate</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Ticket Status Update</p>
            </div>
            
            <div style="padding: 30px;">
              <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">Hi ${name},</p>
              
              <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">
                Your support ticket has been updated!
              </p>
              
              <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Ticket Number</p>
                <p style="margin: 0 0 15px 0; color: #111827; font-size: 18px; font-weight: bold; font-family: monospace;">#${ticketNumber}</p>
                
                <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Subject</p>
                <p style="margin: 0 0 15px 0; color: #111827; font-size: 16px;">${subject}</p>
                
                <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Status Changed</p>
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="background-color: ${getStatusColor(oldStatus)}20; color: ${getStatusColor(oldStatus)}; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 500;">${getStatusLabel(oldStatus)}</span>
                  <span style="color: #9ca3af;">→</span>
                  <span style="background-color: ${getStatusColor(newStatus)}20; color: ${getStatusColor(newStatus)}; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 500;">${getStatusLabel(newStatus)}</span>
                </div>
              </div>
              
              ${response ? `
              <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin-bottom: 20px; border-radius: 0 8px 8px 0;">
                <p style="margin: 0 0 10px 0; color: #059669; font-size: 14px; font-weight: 600;">Response from Support Team:</p>
                <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6;">${response}</p>
              </div>
              ` : ''}
              
              <p style="color: #6b7280; font-size: 14px; margin: 20px 0;">
                You can track your ticket status anytime by visiting the Ticket Tracking page in the app.
              </p>
              
              <p style="color: #374151; font-size: 14px; margin: 30px 0 0 0;">
                Best regards,<br>
                <strong>The CubaDate Support Team</strong>
              </p>
            </div>
            
            <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © 2024 CubaDate. All rights reserved.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "CubaDate Support <onboarding@resend.dev>",
        to: [email],
        subject: `Ticket #${ticketNumber} Status Update: ${getStatusLabel(newStatus)}`,
        html: emailHtml,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Resend API error:", data);
      return new Response(JSON.stringify({ error: data }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log("Status update email sent successfully:", data);
    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending status update email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
