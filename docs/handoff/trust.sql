-- ISEXY trust area (branch wf/trust): moderation, reports, blocks, support,
-- staff tools. NOT a migration file: the integrator folds it into the next
-- isexy migration (after 0004_app_completion.sql; before or together with the
-- Security stage's 0005). Idempotent (CREATE OR REPLACE, IF NOT EXISTS,
-- DROP POLICY IF EXISTS before CREATE POLICY). No row is deleted except a
-- staff role an admin revokes on purpose (T6, staff_set_role). Tested on a
-- throwaway Postgres 16 with v1-mock.sql + 0001-0004 (applied twice), smoke
-- test scripts/isexy/test/trust-smoke.sql.
--
-- Conventions: every function SECURITY DEFINER with
-- SET search_path = isexy, extensions; REVOKE ALL FROM PUBLIC, anon; GRANT
-- EXECUTE TO authenticated (service_role where an edge function calls it).
-- Staff = isexy.user_roles admin or moderator (isexy.is_staff()).
--
-- T1. Moderation: contact-sharing strikes and messaging restrictions
--     - user_warnings.lifted_at / lifted_by: a lifted restriction keeps its
--       row (history) instead of being rewritten or deleted.
--     - isexy.is_staff(): admin or moderator (helper for RPCs and policies).
--     - isexy.active_restriction(profile): the member's active messaging
--       restriction (permanent, or ban_until in the future, not lifted).
--     - record_contact_sharing(types, match): the chat refused a message with
--       contact details; records content_violations rows for the caller and
--       the next strike (24 h, then 7 days, then permanent) unless a
--       restriction is already active. Replaces the browser INSERTs into
--       user_warnings that RLS always refused.
--     - get_my_moderation_status(): the caller's restriction (members cannot
--       read user_warnings).
--     - validate_message_allowed (messages trigger, 0001): also refuses a
--       message from a member with an active restriction (it was only shown
--       in the browser).

-- =====================================================================
-- T1. Moderation
-- =====================================================================
ALTER TABLE isexy.user_warnings ADD COLUMN IF NOT EXISTS lifted_at timestamptz;
ALTER TABLE isexy.user_warnings ADD COLUMN IF NOT EXISTS lifted_by uuid;
ALTER TABLE isexy.user_warnings ADD COLUMN IF NOT EXISTS lift_reason text;

CREATE OR REPLACE FUNCTION isexy.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
  SELECT auth.uid() IS NOT NULL
     AND (isexy.has_role(auth.uid(), 'admin') OR isexy.has_role(auth.uid(), 'moderator'))
$$;
REVOKE ALL ON FUNCTION isexy.is_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.is_staff() TO authenticated, service_role;

-- Active messaging restriction of a member (NULL when none). Internal.
CREATE OR REPLACE FUNCTION isexy.active_restriction(p_profile_id uuid)
RETURNS isexy.user_warnings
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
  SELECT w.*
    FROM isexy.user_warnings w
   WHERE w.profile_id = p_profile_id
     AND w.lifted_at IS NULL
     AND (w.is_permanent_ban IS TRUE OR w.ban_until > now())
   ORDER BY w.is_permanent_ban DESC NULLS LAST, w.ban_until DESC NULLS LAST, w.created_at DESC
   LIMIT 1
$$;
REVOKE ALL ON FUNCTION isexy.active_restriction(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION isexy.get_my_moderation_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile uuid;
  v_w isexy.user_warnings;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO v_profile FROM isexy.profiles WHERE user_id = v_uid;
  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('restricted', false);
  END IF;
  v_w := isexy.active_restriction(v_profile);
  IF v_w.id IS NULL THEN
    RETURN jsonb_build_object('restricted', false);
  END IF;
  RETURN jsonb_build_object(
    'restricted', true,
    'permanent', coalesce(v_w.is_permanent_ban, false),
    'until', v_w.ban_until,
    'reason', v_w.warning_type,
    'level', v_w.warning_level);
END;
$$;
REVOKE ALL ON FUNCTION isexy.get_my_moderation_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.get_my_moderation_status() TO authenticated;

-- The chat refused a message with contact details (detected in the browser,
-- the message itself is never sent). p_types: phone_number, email, address,
-- social_media, payment_info, other. p_excerpt: what was detected (kept short).
CREATE OR REPLACE FUNCTION isexy.record_contact_sharing(
  p_types text[],
  p_excerpt text DEFAULT NULL,
  p_match_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  c_allowed CONSTANT text[] := ARRAY['phone_number', 'email', 'address', 'social_media', 'payment_info', 'other'];
  v_uid uuid := auth.uid();
  v_profile uuid;
  v_types text[];
  v_active isexy.user_warnings;
  v_strikes int;
  v_level int;
  v_until timestamptz;
  v_permanent boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO v_profile FROM isexy.profiles WHERE user_id = v_uid;
  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT array_agg(DISTINCT t) INTO v_types
    FROM unnest(coalesce(p_types, ARRAY[]::text[])) AS t
   WHERE t = ANY (c_allowed);
  IF v_types IS NULL THEN
    RAISE EXCEPTION 'Unknown violation type' USING ERRCODE = '22023';
  END IF;

  -- A match id only counts when the caller is part of it.
  IF p_match_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM isexy.matches m
     WHERE m.id = p_match_id AND (m.profile1_id = v_profile OR m.profile2_id = v_profile)) THEN
    p_match_id := NULL;
  END IF;

  INSERT INTO isexy.content_violations (profile_id, message_id, violation_type, detected_content, action_taken)
  SELECT v_profile, NULL, t, left(coalesce(nullif(btrim(p_excerpt), ''), '(not sent)'), 200),
         'message_blocked'
    FROM unnest(v_types) AS t;

  -- Already restricted: the attempt is recorded, no new strike.
  v_active := isexy.active_restriction(v_profile);
  IF v_active.id IS NOT NULL THEN
    RETURN jsonb_build_object('restricted', true, 'new_strike', false,
      'permanent', coalesce(v_active.is_permanent_ban, false), 'until', v_active.ban_until,
      'level', v_active.warning_level);
  END IF;

  SELECT count(*) INTO v_strikes
    FROM isexy.user_warnings
   WHERE profile_id = v_profile AND warning_type = 'contact_sharing';
  v_level := least(v_strikes + 1, 3);
  IF v_level = 1 THEN
    v_until := now() + interval '24 hours';
  ELSIF v_level = 2 THEN
    v_until := now() + interval '7 days';
  ELSE
    v_permanent := true;
  END IF;

  INSERT INTO isexy.user_warnings (profile_id, warning_type, warning_level, ban_until, is_permanent_ban, evidence, issued_by)
  VALUES (v_profile, 'contact_sharing', v_level, v_until, v_permanent,
          jsonb_build_object('types', v_types, 'match_id', p_match_id, 'source', 'chat')::text, NULL);

  RETURN jsonb_build_object('restricted', true, 'new_strike', true,
    'permanent', v_permanent, 'until', v_until, 'level', v_level);
END;
$$;
REVOKE ALL ON FUNCTION isexy.record_contact_sharing(text[], text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.record_contact_sharing(text[], text, uuid) TO authenticated;

-- Same body as 0001 plus the restriction check (last).
CREATE OR REPLACE FUNCTION isexy.validate_message_allowed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_match RECORD;
  v_other_id uuid;
  v_blocked_count int;
  v_restriction isexy.user_warnings;
BEGIN
  SELECT id, profile1_id, profile2_id, is_active
    INTO v_match
  FROM isexy.matches
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
  FROM isexy.blocks
  WHERE (blocker_id = NEW.sender_id AND blocked_id = v_other_id)
     OR (blocker_id = v_other_id AND blocked_id = NEW.sender_id);

  IF v_blocked_count > 0 THEN
    RAISE EXCEPTION 'Messaging is blocked between these users' USING ERRCODE = 'P0001';
  END IF;

  v_restriction := isexy.active_restriction(NEW.sender_id);
  IF v_restriction.id IS NOT NULL THEN
    RAISE EXCEPTION 'Messaging is restricted for this member' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;
