
-- Update check_and_create_match to create a match on ANY like (one-sided)
-- This allows users to message after liking without waiting for mutual like
CREATE OR REPLACE FUNCTION public.check_and_create_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Create a match on any like or super_like (one-sided messaging allowed)
  IF NEW.action IN ('like', 'super_like') THEN
    INSERT INTO public.matches (profile1_id, profile2_id)
    VALUES (
      LEAST(NEW.swiper_id, NEW.swiped_id),
      GREATEST(NEW.swiper_id, NEW.swiped_id)
    )
    ON CONFLICT (profile1_id, profile2_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;
