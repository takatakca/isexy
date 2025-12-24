-- Create storage bucket for ticket attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket-attachments', 'ticket-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for ticket attachments
CREATE POLICY "Anyone can upload ticket attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'ticket-attachments');

CREATE POLICY "Users can view their own ticket attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'ticket-attachments');

-- Create app_role enum if not exists
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create user_roles table for admin access
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Policy for users to view their own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
USING (user_id = auth.uid());

-- Add attachments column to support_tickets
ALTER TABLE public.support_tickets 
ADD COLUMN IF NOT EXISTS attachments TEXT[] DEFAULT '{}';

-- Add admin_notes column for internal notes
ALTER TABLE public.support_tickets 
ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Add assigned_to column for ticket assignment
ALTER TABLE public.support_tickets 
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id);

-- Add response column for admin responses
ALTER TABLE public.support_tickets 
ADD COLUMN IF NOT EXISTS response TEXT;

-- Add responded_at column
ALTER TABLE public.support_tickets 
ADD COLUMN IF NOT EXISTS responded_at TIMESTAMP WITH TIME ZONE;

-- Create policy for admins to view all tickets
CREATE POLICY "Admins can view all tickets"
ON public.support_tickets FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Create policy for admins to update all tickets
CREATE POLICY "Admins can update all tickets"
ON public.support_tickets FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Enable realtime for support_tickets
ALTER TABLE public.support_tickets REPLICA IDENTITY FULL;

-- Add table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;