-- Drop broad receiver UPDATE policy
DROP POLICY IF EXISTS "Receiver can mark replies as read" ON public.phone_line_voice_replies;

-- Secure RPC: only receiver can mark their reply as read
CREATE OR REPLACE FUNCTION public.mark_voice_reply_read(p_reply_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile_id uuid;
  v_reply public.phone_line_voice_replies%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = auth.uid();
  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_profile');
  END IF;

  SELECT * INTO v_reply FROM public.phone_line_voice_replies WHERE id = p_reply_id;
  IF v_reply.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  IF v_reply.to_profile_id <> v_profile_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;

  UPDATE public.phone_line_voice_replies
     SET is_read = true, updated_at = now()
   WHERE id = p_reply_id;

  RETURN jsonb_build_object('success', true);
END;
$$;