-- Create forum_categories table
CREATE TABLE IF NOT EXISTS public.forum_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  emoji TEXT NOT NULL DEFAULT '💬',
  color TEXT NOT NULL DEFAULT 'bg-primary',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create forum_posts table
CREATE TABLE IF NOT EXISTS public.forum_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.forum_categories(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  reply_count INTEGER NOT NULL DEFAULT 0,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create forum_replies table
CREATE TABLE IF NOT EXISTS public.forum_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create cuban_verifications table for Cuban signup verification tracking
CREATE TABLE IF NOT EXISTS public.cuban_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  whatsapp_number TEXT NOT NULL,
  whatsapp_verified BOOLEAN NOT NULL DEFAULT false,
  carnet_id TEXT NOT NULL,
  carnet_verified BOOLEAN NOT NULL DEFAULT false,
  video_verified BOOLEAN NOT NULL DEFAULT false,
  audio_verified BOOLEAN NOT NULL DEFAULT false,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add is_cuban field to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_cuban BOOLEAN DEFAULT false;

-- Enable RLS on all new tables
ALTER TABLE public.forum_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cuban_verifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate
DROP POLICY IF EXISTS "Anyone can view active forum categories" ON public.forum_categories;
DROP POLICY IF EXISTS "Admins can manage forum categories" ON public.forum_categories;
DROP POLICY IF EXISTS "Anyone can view forum posts" ON public.forum_posts;
DROP POLICY IF EXISTS "Authenticated users can create posts" ON public.forum_posts;
DROP POLICY IF EXISTS "Users can update own posts" ON public.forum_posts;
DROP POLICY IF EXISTS "Users can delete own posts" ON public.forum_posts;
DROP POLICY IF EXISTS "Anyone can view forum replies" ON public.forum_replies;
DROP POLICY IF EXISTS "Authenticated users can create replies" ON public.forum_replies;
DROP POLICY IF EXISTS "Users can update own replies" ON public.forum_replies;
DROP POLICY IF EXISTS "Users can delete own replies" ON public.forum_replies;
DROP POLICY IF EXISTS "Users can view own verification" ON public.cuban_verifications;
DROP POLICY IF EXISTS "Users can insert own verification" ON public.cuban_verifications;
DROP POLICY IF EXISTS "Users can update own pending verification" ON public.cuban_verifications;
DROP POLICY IF EXISTS "Admins can manage all verifications" ON public.cuban_verifications;

-- Forum categories policies (anyone can view, admins can manage)
CREATE POLICY "Anyone can view active forum categories" ON public.forum_categories
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage forum categories" ON public.forum_categories
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Forum posts policies
CREATE POLICY "Anyone can view forum posts" ON public.forum_posts
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create posts" ON public.forum_posts
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own posts" ON public.forum_posts
  FOR UPDATE USING (author_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own posts" ON public.forum_posts
  FOR DELETE USING (author_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

-- Forum replies policies
CREATE POLICY "Anyone can view forum replies" ON public.forum_replies
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create replies" ON public.forum_replies
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own replies" ON public.forum_replies
  FOR UPDATE USING (author_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own replies" ON public.forum_replies
  FOR DELETE USING (author_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

-- Cuban verifications policies
CREATE POLICY "Users can view own verification" ON public.cuban_verifications
  FOR SELECT USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own verification" ON public.cuban_verifications
  FOR INSERT WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own pending verification" ON public.cuban_verifications
  FOR UPDATE USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) AND verification_status = 'pending');

CREATE POLICY "Admins can manage all verifications" ON public.cuban_verifications
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Drop and recreate trigger for reply count
DROP TRIGGER IF EXISTS on_reply_insert ON public.forum_replies;
DROP FUNCTION IF EXISTS public.increment_reply_count();

CREATE OR REPLACE FUNCTION public.increment_reply_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.forum_posts SET reply_count = reply_count + 1 WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_reply_insert
  AFTER INSERT ON public.forum_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_reply_count();

-- Insert default forum categories if not exist
INSERT INTO public.forum_categories (name, description, emoji, color, sort_order) 
SELECT 'Dating & Relationships', 'Discuss dating tips, relationship advice, and share your experiences', '💕', 'bg-rose-500', 1
WHERE NOT EXISTS (SELECT 1 FROM public.forum_categories WHERE name = 'Dating & Relationships');

INSERT INTO public.forum_categories (name, description, emoji, color, sort_order) 
SELECT 'Cuban Culture & Travel', 'Share experiences about Cuban culture, travel tips, and local recommendations', '🇨🇺', 'bg-blue-500', 2
WHERE NOT EXISTS (SELECT 1 FROM public.forum_categories WHERE name = 'Cuban Culture & Travel');

INSERT INTO public.forum_categories (name, description, emoji, color, sort_order) 
SELECT 'Events & Meetups', 'Organize and discuss meetup events for the community', '🎉', 'bg-purple-500', 3
WHERE NOT EXISTS (SELECT 1 FROM public.forum_categories WHERE name = 'Events & Meetups');

INSERT INTO public.forum_categories (name, description, emoji, color, sort_order) 
SELECT 'General Discussion', 'Open discussions about anything and everything', '💬', 'bg-cyan-500', 4
WHERE NOT EXISTS (SELECT 1 FROM public.forum_categories WHERE name = 'General Discussion');

INSERT INTO public.forum_categories (name, description, emoji, color, sort_order) 
SELECT 'Success Stories', 'Share your success stories and celebrate connections made on CubaDate', '❤️', 'bg-pink-500', 5
WHERE NOT EXISTS (SELECT 1 FROM public.forum_categories WHERE name = 'Success Stories');

INSERT INTO public.forum_categories (name, description, emoji, color, sort_order) 
SELECT 'Safety & Support', 'Discuss safety tips and get support from the community', '🛡️', 'bg-orange-500', 6
WHERE NOT EXISTS (SELECT 1 FROM public.forum_categories WHERE name = 'Safety & Support');