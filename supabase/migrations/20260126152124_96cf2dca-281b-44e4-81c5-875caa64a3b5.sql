-- Add last_active column to profiles for online status tracking
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create streak_badges table for consistency challenge
CREATE TABLE public.streak_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_type TEXT NOT NULL, -- '3_day', '7_day', '14_day', '30_day', '100_day'
  earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  streak_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(profile_id, badge_type)
);

-- Enable RLS
ALTER TABLE public.streak_badges ENABLE ROW LEVEL SECURITY;

-- Policies for streak_badges
CREATE POLICY "Users can view their own badges" 
ON public.streak_badges 
FOR SELECT 
USING (auth.uid() IN (SELECT user_id FROM profiles WHERE id = profile_id));

CREATE POLICY "Users can insert their own badges" 
ON public.streak_badges 
FOR INSERT 
WITH CHECK (auth.uid() IN (SELECT user_id FROM profiles WHERE id = profile_id));

CREATE POLICY "Users can update their own badges" 
ON public.streak_badges 
FOR UPDATE 
USING (auth.uid() IN (SELECT user_id FROM profiles WHERE id = profile_id));

-- Add index for performance
CREATE INDEX idx_profiles_last_active ON public.profiles(last_active_at);
CREATE INDEX idx_streak_badges_profile ON public.streak_badges(profile_id);