-- Drop the security definer view and recreate as a regular view with proper RLS
DROP VIEW IF EXISTS public.admin_users;

-- Create a function to get admin users instead (security definer function is safer)
CREATE OR REPLACE FUNCTION public.get_admin_users()
RETURNS TABLE (
  user_id uuid,
  role app_role,
  first_name text,
  profile_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ur.user_id,
    ur.role,
    p.first_name,
    p.id as profile_id
  FROM public.user_roles ur
  LEFT JOIN public.profiles p ON p.user_id = ur.user_id
  WHERE ur.role IN ('admin', 'moderator')
$$;