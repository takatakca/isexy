
-- 1. Add DELETE RLS policy on swipes so users can undo their own swipes
CREATE POLICY "Users can delete own swipes"
ON public.swipes FOR DELETE
USING (swiper_id IN (
  SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()
));

-- 2. Add unique constraint on swipes to prevent duplicates
ALTER TABLE public.swipes
ADD CONSTRAINT swipes_swiper_swiped_unique UNIQUE (swiper_id, swiped_id);

-- 3. Add unique constraint on matches to prevent duplicate matches
ALTER TABLE public.matches
ADD CONSTRAINT matches_pair_unique UNIQUE (profile1_id, profile2_id);

-- 4. Create the trigger for auto-match creation on swipe insert
DROP TRIGGER IF EXISTS trigger_check_and_create_match ON public.swipes;
CREATE TRIGGER trigger_check_and_create_match
AFTER INSERT ON public.swipes
FOR EACH ROW
EXECUTE FUNCTION public.check_and_create_match();
