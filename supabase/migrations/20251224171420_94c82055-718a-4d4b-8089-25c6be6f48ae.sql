-- Create ticket_categories table
CREATE TABLE public.ticket_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ticket_categories ENABLE ROW LEVEL SECURITY;

-- Everyone can view active categories
CREATE POLICY "Anyone can view active categories"
ON public.ticket_categories
FOR SELECT
USING (is_active = true);

-- Admins can manage all categories
CREATE POLICY "Admins can manage categories"
ON public.ticket_categories
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Insert default categories
INSERT INTO public.ticket_categories (name, description) VALUES
('Account Issues', 'Problems with account access, login, or settings'),
('Technical Support', 'App bugs, crashes, or technical problems'),
('Billing & Payments', 'Subscription, payment, or billing inquiries'),
('Safety & Privacy', 'Report safety concerns or privacy issues'),
('Feature Request', 'Suggestions for new features or improvements'),
('Other', 'General inquiries and other topics');

-- Create trigger for updated_at
CREATE TRIGGER update_ticket_categories_updated_at
BEFORE UPDATE ON public.ticket_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();