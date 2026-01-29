-- Fix overly permissive RLS policies

-- Drop and recreate missed_calls insert policy to be more restrictive
DROP POLICY IF EXISTS "System can insert missed calls" ON public.missed_calls;
CREATE POLICY "Authenticated users can insert missed calls"
ON public.missed_calls FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Drop and recreate content_violations insert policy
DROP POLICY IF EXISTS "System can insert violations" ON public.content_violations;
CREATE POLICY "Authenticated users can report violations"
ON public.content_violations FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Drop and recreate user_warnings insert policy to be admin/moderator only
DROP POLICY IF EXISTS "Admins can insert warnings" ON public.user_warnings;
CREATE POLICY "Admins and moderators can insert warnings"
ON public.user_warnings FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));