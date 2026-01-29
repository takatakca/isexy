-- Create scheduled_calls table for call scheduling
CREATE TABLE public.scheduled_calls (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    scheduler_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'missed')),
    reminder_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduled_calls ENABLE ROW LEVEL SECURITY;

-- Policies for scheduled_calls
CREATE POLICY "Users can view their scheduled calls"
ON public.scheduled_calls FOR SELECT
USING (auth.uid() IN (
    SELECT user_id FROM profiles WHERE id = scheduler_id
    UNION
    SELECT user_id FROM profiles WHERE id = recipient_id
));

CREATE POLICY "Users can create scheduled calls"
ON public.scheduled_calls FOR INSERT
WITH CHECK (auth.uid() = (SELECT user_id FROM profiles WHERE id = scheduler_id));

CREATE POLICY "Participants can update scheduled calls"
ON public.scheduled_calls FOR UPDATE
USING (auth.uid() IN (
    SELECT user_id FROM profiles WHERE id = scheduler_id
    UNION
    SELECT user_id FROM profiles WHERE id = recipient_id
));

-- Create missed_calls table for missed call tracking
CREATE TABLE public.missed_calls (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    call_session_id UUID REFERENCES public.video_call_sessions(id) ON DELETE SET NULL,
    caller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    notified_email BOOLEAN DEFAULT FALSE,
    notified_whatsapp BOOLEAN DEFAULT FALSE,
    notified_push BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.missed_calls ENABLE ROW LEVEL SECURITY;

-- Policies for missed_calls
CREATE POLICY "Users can view their missed calls"
ON public.missed_calls FOR SELECT
USING (auth.uid() IN (
    SELECT user_id FROM profiles WHERE id = caller_id
    UNION
    SELECT user_id FROM profiles WHERE id = receiver_id
));

CREATE POLICY "System can insert missed calls"
ON public.missed_calls FOR INSERT
WITH CHECK (true);

-- Create user_warnings table for moderation system
CREATE TABLE public.user_warnings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    warning_type TEXT NOT NULL CHECK (warning_type IN ('contact_sharing', 'harassment', 'spam', 'fake_profile', 'other')),
    warning_level INTEGER NOT NULL DEFAULT 1 CHECK (warning_level >= 1 AND warning_level <= 3),
    ban_until TIMESTAMP WITH TIME ZONE,
    is_permanent_ban BOOLEAN DEFAULT FALSE,
    evidence TEXT,
    issued_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_warnings ENABLE ROW LEVEL SECURITY;

-- Policies for user_warnings (admins only)
CREATE POLICY "Admins can view all warnings"
ON public.user_warnings FOR SELECT
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Admins can insert warnings"
ON public.user_warnings FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator') OR auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update warnings"
ON public.user_warnings FOR UPDATE
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

-- Create content_violations table for tracking detected violations
CREATE TABLE public.content_violations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    violation_type TEXT NOT NULL CHECK (violation_type IN ('phone_number', 'email', 'address', 'social_media', 'payment_info', 'other')),
    detected_content TEXT NOT NULL,
    action_taken TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.content_violations ENABLE ROW LEVEL SECURITY;

-- Policies for content_violations
CREATE POLICY "Admins can view violations"
ON public.content_violations FOR SELECT
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "System can insert violations"
ON public.content_violations FOR INSERT
WITH CHECK (true);

-- Add unique constraint to cuban_verifications for carnet_id (1 user per verification)
ALTER TABLE public.cuban_verifications 
ADD CONSTRAINT unique_carnet_id UNIQUE (carnet_id);

-- Add realtime for scheduled_calls
ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.missed_calls;