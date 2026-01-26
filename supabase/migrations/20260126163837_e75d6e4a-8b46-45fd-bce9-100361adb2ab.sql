-- Create double_date_pairs table for friend pairing
CREATE TABLE public.double_date_pairs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'declined', 'ended')),
  invited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user1_id, user2_id)
);

-- Create double_date_matches table for pair-to-pair matching
CREATE TABLE public.double_date_matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pair1_id UUID NOT NULL REFERENCES public.double_date_pairs(id) ON DELETE CASCADE,
  pair2_id UUID NOT NULL REFERENCES public.double_date_pairs(id) ON DELETE CASCADE,
  matched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (pair1_id, pair2_id)
);

-- Create double_date_swipes for pair swiping
CREATE TABLE public.double_date_swipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  swiper_pair_id UUID NOT NULL REFERENCES public.double_date_pairs(id) ON DELETE CASCADE,
  swiped_pair_id UUID NOT NULL REFERENCES public.double_date_pairs(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('like', 'pass', 'super_like')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (swiper_pair_id, swiped_pair_id)
);

-- Create double_date_settings table
CREATE TABLE public.double_date_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  show_me_on_friend_profile BOOLEAN DEFAULT true,
  show_friends_on_profile BOOLEAN DEFAULT true,
  show_double_date_profiles BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.double_date_pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.double_date_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.double_date_swipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.double_date_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for double_date_pairs
CREATE POLICY "Users can view pairs they're part of"
ON public.double_date_pairs FOR SELECT
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = user1_id AND profiles.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = user2_id AND profiles.user_id = auth.uid())
);

CREATE POLICY "Users can create pairs as inviter"
ON public.double_date_pairs FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = user1_id AND profiles.user_id = auth.uid())
);

CREATE POLICY "Users can update pairs they're part of"
ON public.double_date_pairs FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = user1_id AND profiles.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = user2_id AND profiles.user_id = auth.uid())
);

-- RLS policies for double_date_matches
CREATE POLICY "Users can view matches for their pairs"
ON public.double_date_matches FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM double_date_pairs ddp
    JOIN profiles p ON (p.id = ddp.user1_id OR p.id = ddp.user2_id)
    WHERE p.user_id = auth.uid()
    AND (ddp.id = pair1_id OR ddp.id = pair2_id)
  )
);

-- RLS policies for double_date_swipes
CREATE POLICY "Users can view swipes for their pairs"
ON public.double_date_swipes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM double_date_pairs ddp
    JOIN profiles p ON (p.id = ddp.user1_id OR p.id = ddp.user2_id)
    WHERE p.user_id = auth.uid() AND ddp.id = swiper_pair_id
  )
);

CREATE POLICY "Users can create swipes for their pairs"
ON public.double_date_swipes FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM double_date_pairs ddp
    JOIN profiles p ON (p.id = ddp.user1_id OR p.id = ddp.user2_id)
    WHERE p.user_id = auth.uid() AND ddp.id = swiper_pair_id AND ddp.status = 'active'
  )
);

-- RLS policies for double_date_settings
CREATE POLICY "Users can view their own settings"
ON public.double_date_settings FOR SELECT
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = profile_id AND profiles.user_id = auth.uid())
);

CREATE POLICY "Users can create their own settings"
ON public.double_date_settings FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = profile_id AND profiles.user_id = auth.uid())
);

CREATE POLICY "Users can update their own settings"
ON public.double_date_settings FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = profile_id AND profiles.user_id = auth.uid())
);

-- Create trigger for updated_at
CREATE TRIGGER update_double_date_pairs_updated_at
BEFORE UPDATE ON public.double_date_pairs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_double_date_settings_updated_at
BEFORE UPDATE ON public.double_date_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();