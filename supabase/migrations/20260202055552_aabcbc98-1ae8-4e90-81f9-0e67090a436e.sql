-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view other users' stars (limited)" ON public.user_stars;

-- Create a more restrictive policy - users can only see stars of Cuban verified users
CREATE POLICY "Users can view Cuban users stars" ON public.user_stars
  FOR SELECT USING (
    profile_id IN (
      SELECT id FROM public.profiles WHERE is_cuban = true AND is_verified = true
    )
  );