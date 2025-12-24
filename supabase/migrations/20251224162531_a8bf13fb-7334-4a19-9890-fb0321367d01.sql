-- Create support_tickets table
CREATE TABLE public.support_tickets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    ticket_number text NOT NULL UNIQUE,
    name text NOT NULL,
    email text NOT NULL,
    subject text NOT NULL,
    category text NOT NULL,
    priority text NOT NULL DEFAULT 'medium',
    message text NOT NULL,
    status text NOT NULL DEFAULT 'open',
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own tickets (by email or user_id)
CREATE POLICY "Users can view own tickets by email"
ON public.support_tickets
FOR SELECT
USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR user_id = auth.uid()
);

-- Policy: Anyone can create tickets (for non-logged in users too)
CREATE POLICY "Anyone can create tickets"
ON public.support_tickets
FOR INSERT
WITH CHECK (true);

-- Policy: Users can update their own tickets
CREATE POLICY "Users can update own tickets"
ON public.support_tickets
FOR UPDATE
USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR user_id = auth.uid()
);

-- Create trigger for updated_at
CREATE TRIGGER update_support_tickets_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_support_tickets_email ON public.support_tickets(email);
CREATE INDEX idx_support_tickets_ticket_number ON public.support_tickets(ticket_number);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);