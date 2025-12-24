import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TicketEmailRequest {
  name: string;
  email: string;
  ticketNumber: string;
  subject: string;
  category: string;
  priority: string;
  message: string;
}

const replaceVariables = (template: string, variables: Record<string, string>): string => {
  let result = template;
  Object.entries(variables).forEach(([key, value]) => {
    result = result.replace(new RegExp(`{{${key}}}`, "g"), value || "");
  });
  return result;
};

const getDefaultTemplate = (variables: Record<string, string>): { subject: string; html: string } => {
  const priorityColors: Record<string, string> = {
    low: "#22c55e",
    medium: "#f59e0b",
    high: "#ef4444",
    urgent: "#dc2626",
  };

  const subject = `Support Ticket #${variables.ticket_number} - ${variables.subject}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f8f9fa;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #e11d48 0%, #be185d 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">💕 CubaDate</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">Support Ticket Confirmation</p>
        </div>
        
        <!-- Main Content -->
        <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #1f2937; margin-top: 0;">Hello ${variables.name}! 👋</h2>
          
          <p style="color: #4b5563; line-height: 1.6;">
            Thank you for contacting CubaDate Support. We have received your support request and our team is working on it.
          </p>
          
          <!-- Ticket Details Box -->
          <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #1f2937; margin-top: 0; margin-bottom: 15px;">📋 Ticket Details</h3>
            
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Ticket Number:</td>
                <td style="padding: 8px 0; color: #1f2937; font-weight: 600; font-size: 14px;">#${variables.ticket_number}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Subject:</td>
                <td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${variables.subject}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Category:</td>
                <td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${variables.category}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Priority:</td>
                <td style="padding: 8px 0;">
                  <span style="background: ${priorityColors[variables.priority] || '#6b7280'}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; text-transform: uppercase;">
                    ${variables.priority}
                  </span>
                </td>
              </tr>
            </table>
          </div>
          
          <!-- Response Time -->
          <div style="background: #ecfdf5; border-radius: 8px; padding: 15px; margin: 20px 0; text-align: center;">
            <p style="color: #059669; margin: 0; font-weight: 600;">
              ⏱️ Expected Response Time: 24-48 hours
            </p>
          </div>
          
          <p style="color: #4b5563; line-height: 1.6;">
            You can track your ticket status anytime by visiting your Ticket Tracking page in the app.
          </p>
          
          <p style="color: #4b5563; line-height: 1.6; margin-bottom: 0;">
            Best regards,<br>
            <strong style="color: #e11d48;">The CubaDate Support Team</strong>
          </p>
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
          <p style="margin: 0;">© 2024 CubaDate. All rights reserved.</p>
          <p style="margin: 5px 0 0 0;">This is an automated message. Please do not reply directly to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  return { subject, html };
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, email, ticketNumber, subject, category, priority, message }: TicketEmailRequest = await req.json();

    console.log("Sending ticket confirmation email to:", email);
    console.log("Ticket number:", ticketNumber);

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Try to get email template from database
    let emailSubject: string;
    let emailHtml: string;

    const variables = {
      name,
      ticket_number: ticketNumber,
      subject,
      category,
      priority,
    };

    try {
      const { data: template, error } = await supabase
        .from("email_templates")
        .select("subject, body_html")
        .eq("name", "ticket_confirmation")
        .eq("is_active", true)
        .single();

      if (error || !template) {
        console.log("Using default template - no custom template found");
        const defaultTemplate = getDefaultTemplate(variables);
        emailSubject = defaultTemplate.subject;
        emailHtml = defaultTemplate.html;
      } else {
        emailSubject = replaceVariables(template.subject, variables);
        emailHtml = replaceVariables(template.body_html, variables);
      }
    } catch (templateError) {
      console.log("Using default template - error fetching template:", templateError);
      const defaultTemplate = getDefaultTemplate(variables);
      emailSubject = defaultTemplate.subject;
      emailHtml = defaultTemplate.html;
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "CubaDate Support <onboarding@resend.dev>",
        to: [email],
        subject: emailSubject,
        html: emailHtml,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Resend API error:", errorText);
      throw new Error(`Failed to send email: ${errorText}`);
    }

    const data = await res.json();
    console.log("Email sent successfully:", data);

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-ticket-confirmation function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
