-- Create email_templates table for customizable email templates
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  description TEXT,
  variables TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Admins can manage templates
CREATE POLICY "Admins can manage email templates"
  ON public.email_templates
  FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Anyone can view active templates (for edge functions)
CREATE POLICY "Anyone can view active templates"
  ON public.email_templates
  FOR SELECT
  USING (is_active = true);

-- Create trigger for updated_at
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default email templates
INSERT INTO public.email_templates (name, subject, body_html, description, variables) VALUES
(
  'ticket_confirmation',
  'Support Ticket Received - {{ticket_number}}',
  '<h1>Thank you for contacting us, {{name}}!</h1>
<p>We have received your support ticket and our team will review it shortly.</p>
<h2>Ticket Details</h2>
<ul>
  <li><strong>Ticket Number:</strong> {{ticket_number}}</li>
  <li><strong>Subject:</strong> {{subject}}</li>
  <li><strong>Category:</strong> {{category}}</li>
  <li><strong>Priority:</strong> {{priority}}</li>
</ul>
<p>You can track your ticket status at any time by visiting our ticket tracking page.</p>
<p>Best regards,<br>The CubaDate Support Team</p>',
  'Sent when a new support ticket is created',
  ARRAY['name', 'ticket_number', 'subject', 'category', 'priority']
),
(
  'ticket_status_update',
  'Ticket {{ticket_number}} Status Updated',
  '<h1>Hello {{name}},</h1>
<p>Your support ticket status has been updated.</p>
<h2>Ticket Details</h2>
<ul>
  <li><strong>Ticket Number:</strong> {{ticket_number}}</li>
  <li><strong>Subject:</strong> {{subject}}</li>
  <li><strong>New Status:</strong> {{status}}</li>
</ul>
{{#if response}}
<h2>Response from our team:</h2>
<div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px;">
  {{response}}
</div>
{{/if}}
<p>Thank you for your patience.</p>
<p>Best regards,<br>The CubaDate Support Team</p>',
  'Sent when ticket status is updated',
  ARRAY['name', 'ticket_number', 'subject', 'status', 'response']
),
(
  'ticket_assigned',
  'Ticket {{ticket_number}} Has Been Assigned',
  '<h1>Hello {{name}},</h1>
<p>Your support ticket has been assigned to a team member who will assist you.</p>
<h2>Ticket Details</h2>
<ul>
  <li><strong>Ticket Number:</strong> {{ticket_number}}</li>
  <li><strong>Subject:</strong> {{subject}}</li>
  <li><strong>Assigned To:</strong> {{assignee_name}}</li>
</ul>
<p>You should expect a response soon.</p>
<p>Best regards,<br>The CubaDate Support Team</p>',
  'Sent when ticket is assigned to a team member',
  ARRAY['name', 'ticket_number', 'subject', 'assignee_name']
);

-- Create admin_users view to list users who can be assigned tickets
CREATE OR REPLACE VIEW public.admin_users AS
SELECT 
  ur.user_id,
  ur.role,
  p.first_name,
  p.id as profile_id
FROM public.user_roles ur
LEFT JOIN public.profiles p ON p.user_id = ur.user_id
WHERE ur.role IN ('admin', 'moderator');