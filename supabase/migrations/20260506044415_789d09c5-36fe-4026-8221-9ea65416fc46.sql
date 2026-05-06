-- Validate a message is allowed: sender in active match, no blocks between the two profiles
CREATE OR REPLACE FUNCTION public.validate_message_allowed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_other_id uuid;
  v_blocked_count int;
BEGIN
  SELECT id, profile1_id, profile2_id, is_active
    INTO v_match
  FROM public.matches
  WHERE id = NEW.match_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found' USING ERRCODE = 'P0001';
  END IF;

  IF v_match.is_active IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Match is no longer active' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.sender_id <> v_match.profile1_id AND NEW.sender_id <> v_match.profile2_id THEN
    RAISE EXCEPTION 'Sender is not part of this match' USING ERRCODE = 'P0001';
  END IF;

  v_other_id := CASE WHEN NEW.sender_id = v_match.profile1_id
                     THEN v_match.profile2_id ELSE v_match.profile1_id END;

  SELECT COUNT(*) INTO v_blocked_count
  FROM public.blocks
  WHERE (blocker_id = NEW.sender_id AND blocked_id = v_other_id)
     OR (blocker_id = v_other_id AND blocked_id = NEW.sender_id);

  IF v_blocked_count > 0 THEN
    RAISE EXCEPTION 'Messaging is blocked between these users' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_validate_allowed ON public.messages;
CREATE TRIGGER messages_validate_allowed
BEFORE INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.validate_message_allowed();