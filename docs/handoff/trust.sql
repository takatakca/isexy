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

-- =====================================================================
-- T2. Blocks and reports (members)
-- =====================================================================
-- Hidden either way: a member never reads the profile row of someone who
-- blocked them (the policy calls my_blocker_ids() once per statement), and
-- can always read their own profile (a suspended member, is_active = false,
-- used to lose it and was sent to profile setup).
-- get_my_hidden_member_ids(): ids blocked either way, for the pages that list
-- people (Likes sent, web profile, group chat, chat links).
-- block_member(): idempotent block. report_member(): one RPC for the report
-- (+ optional block): reasons checked, no self-report, one pending report
-- per pair, at most 20 reports a day per member.
ALTER TABLE isexy.reports ADD COLUMN IF NOT EXISTS source text;

CREATE OR REPLACE FUNCTION isexy.my_blocker_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
  SELECT coalesce(array_agg(b.blocker_id), ARRAY[]::uuid[])
    FROM isexy.blocks b
    JOIN isexy.profiles me ON me.id = b.blocked_id
   WHERE me.user_id = auth.uid()
$$;
REVOKE ALL ON FUNCTION isexy.my_blocker_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.my_blocker_ids() TO authenticated;

DROP POLICY IF EXISTS "Authenticated users can view active profiles" ON isexy.profiles;
CREATE POLICY "Authenticated users can view active profiles" ON isexy.profiles
  FOR SELECT TO authenticated
  USING (is_active = true AND NOT (id = ANY ((SELECT isexy.my_blocker_ids())::uuid[])));

DROP POLICY IF EXISTS "Members view own profile" ON isexy.profiles;
CREATE POLICY "Members view own profile" ON isexy.profiles
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION isexy.get_my_hidden_member_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
  SELECT coalesce(array_agg(DISTINCT x.other), ARRAY[]::uuid[])
    FROM isexy.profiles me
    CROSS JOIN LATERAL (
      SELECT b.blocked_id AS other FROM isexy.blocks b WHERE b.blocker_id = me.id
      UNION
      SELECT b.blocker_id FROM isexy.blocks b WHERE b.blocked_id = me.id
    ) x
   WHERE me.user_id = auth.uid()
$$;
REVOKE ALL ON FUNCTION isexy.get_my_hidden_member_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.get_my_hidden_member_ids() TO authenticated;

CREATE OR REPLACE FUNCTION isexy.block_member(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_me uuid;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO v_me FROM isexy.profiles WHERE user_id = auth.uid();
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_profile_id IS NULL OR p_profile_id = v_me THEN
    RAISE EXCEPTION 'You cannot block yourself' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM isexy.profiles WHERE id = p_profile_id) THEN
    RAISE EXCEPTION 'Member not found' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO isexy.blocks (blocker_id, blocked_id)
  VALUES (v_me, p_profile_id)
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('blocked', true, 'already', v_id IS NULL);
END;
$$;
REVOKE ALL ON FUNCTION isexy.block_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.block_member(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION isexy.report_member(
  p_reported_id uuid,
  p_reason text,
  p_details text DEFAULT NULL,
  p_block boolean DEFAULT false,
  p_source text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  c_reasons CONSTANT text[] := ARRAY['fake', 'harassment', 'scam', 'inappropriate', 'underage', 'spam', 'other'];
  v_me uuid;
  v_report uuid;
  v_duplicate boolean := false;
  v_blocked boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO v_me FROM isexy.profiles WHERE user_id = auth.uid();
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_reported_id IS NULL OR p_reported_id = v_me THEN
    RAISE EXCEPTION 'You cannot report yourself' USING ERRCODE = '22023';
  END IF;
  IF NOT (p_reason = ANY (c_reasons)) THEN
    RAISE EXCEPTION 'Unknown report reason' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM isexy.profiles WHERE id = p_reported_id) THEN
    RAISE EXCEPTION 'Member not found' USING ERRCODE = 'P0002';
  END IF;

  -- One open report per pair: a second one adds its details to the first.
  SELECT id INTO v_report
    FROM isexy.reports
   WHERE reporter_id = v_me AND reported_id = p_reported_id
     AND coalesce(status, 'pending') = 'pending'
   ORDER BY created_at DESC
   LIMIT 1;
  IF v_report IS NOT NULL THEN
    v_duplicate := true;
    IF nullif(btrim(p_details), '') IS NOT NULL THEN
      UPDATE isexy.reports
         SET description = left(concat_ws(E'\n---\n', description, btrim(p_details)), 4000)
       WHERE id = v_report;
    END IF;
  ELSE
    IF (SELECT count(*) FROM isexy.reports
         WHERE reporter_id = v_me AND created_at > now() - interval '1 day') >= 20 THEN
      RAISE EXCEPTION 'Too many reports today, please contact support' USING ERRCODE = '54000';
    END IF;
    INSERT INTO isexy.reports (reporter_id, reported_id, reason, description, status, source)
    VALUES (v_me, p_reported_id, p_reason, left(nullif(btrim(p_details), ''), 2000), 'pending',
            left(nullif(btrim(p_source), ''), 40))
    RETURNING id INTO v_report;
  END IF;

  IF p_block THEN
    INSERT INTO isexy.blocks (blocker_id, blocked_id)
    VALUES (v_me, p_reported_id)
    ON CONFLICT (blocker_id, blocked_id) DO NOTHING;
    v_blocked := true;
  END IF;

  RETURN jsonb_build_object('report_id', v_report, 'duplicate', v_duplicate, 'blocked', v_blocked);
END;
$$;
REVOKE ALL ON FUNCTION isexy.report_member(uuid, text, text, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.report_member(uuid, text, text, boolean, text) TO authenticated;

-- =====================================================================
-- T3. Support tickets
-- =====================================================================
-- get_ticket_status(number, email): a guest (or a member who wrote from
-- another address) tracks a ticket with its number + the email it was sent
-- from; RLS only ever showed signed-in members their own tickets.
-- Members can no longer UPDATE their tickets (any column: status, response,
-- admin notes, assignee); no client code did. Members read their tickets by
-- user id or by the e-mail in their JWT (the old policy read auth.users and
-- failed for every signed-in reader, admins included).
-- Staff (admin or moderator) read every ticket; staff changes go through
-- staff_update_ticket / staff_bulk_update_tickets (status, response, internal
-- note appended with the author and time, assignee), which return what the
-- ticket email function needs to know.
CREATE OR REPLACE FUNCTION isexy.get_ticket_status(p_ticket_number text, p_email text)
RETURNS TABLE (
  ticket_number text, subject text, category text, priority text, status text,
  message text, response text, responded_at timestamptz, created_at timestamptz, updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
  SELECT t.ticket_number, t.subject, t.category, t.priority, t.status,
         t.message, t.response, t.responded_at, t.created_at, t.updated_at
    FROM isexy.support_tickets t
   WHERE t.ticket_number = upper(btrim(p_ticket_number))
     AND lower(t.email) = lower(btrim(p_email))
     AND length(btrim(coalesce(p_email, ''))) >= 3
   LIMIT 1
$$;
REVOKE ALL ON FUNCTION isexy.get_ticket_status(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION isexy.get_ticket_status(text, text) TO anon, authenticated;

DROP POLICY IF EXISTS "Users can update own tickets" ON isexy.support_tickets;

-- The old SELECT policy read auth.users, which the authenticated role cannot
-- read: every signed-in SELECT on support_tickets (members, and admins too,
-- since permissive policies are OR-ed) failed with "permission denied for
-- table users". The verified e-mail comes from the JWT instead.
DROP POLICY IF EXISTS "Users can view own tickets by email" ON isexy.support_tickets;
CREATE POLICY "Users can view own tickets by email" ON isexy.support_tickets
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid())
         OR lower(email) = lower(nullif((SELECT auth.jwt()) ->> 'email', '')));

DROP POLICY IF EXISTS "Staff view all tickets" ON isexy.support_tickets;
CREATE POLICY "Staff view all tickets" ON isexy.support_tickets
  FOR SELECT TO authenticated
  USING ((SELECT isexy.is_staff()));

CREATE OR REPLACE FUNCTION isexy.staff_update_ticket(
  p_ticket_id uuid,
  p_status text DEFAULT NULL,
  p_response text DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_assigned_to uuid DEFAULT NULL,
  p_change_assignee boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  c_statuses CONSTANT text[] := ARRAY['open', 'in_progress', 'resolved', 'closed'];
  v_uid uuid := auth.uid();
  v_old isexy.support_tickets;
  v_new isexy.support_tickets;
  v_author text;
  v_response text := nullif(btrim(p_response), '');
  v_note text := nullif(btrim(p_note), '');
BEGIN
  IF NOT isexy.is_staff() THEN
    RAISE EXCEPTION 'Only ISEXY staff can update tickets' USING ERRCODE = '42501';
  END IF;
  IF p_status IS NOT NULL AND NOT (p_status = ANY (c_statuses)) THEN
    RAISE EXCEPTION 'Unknown ticket status' USING ERRCODE = '22023';
  END IF;
  IF p_change_assignee AND p_assigned_to IS NOT NULL
     AND NOT (isexy.has_role(p_assigned_to, 'admin') OR isexy.has_role(p_assigned_to, 'moderator')) THEN
    RAISE EXCEPTION 'Tickets can only be assigned to staff' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_old FROM isexy.support_tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT coalesce(p.first_name, 'Staff') INTO v_author FROM isexy.profiles p WHERE p.user_id = v_uid;

  UPDATE isexy.support_tickets t
     SET status = coalesce(p_status, t.status),
         response = coalesce(left(v_response, 10000), t.response),
         responded_at = CASE WHEN v_response IS NOT NULL THEN now() ELSE t.responded_at END,
         admin_notes = CASE WHEN v_note IS NULL THEN t.admin_notes
                            ELSE left(concat_ws(E'\n', t.admin_notes,
                                   '[' || to_char(now() AT TIME ZONE 'America/Toronto', 'YYYY-MM-DD HH24:MI') || ' '
                                   || coalesce(v_author, 'Staff') || '] ' || v_note), 20000) END,
         assigned_to = CASE WHEN p_change_assignee THEN p_assigned_to ELSE t.assigned_to END,
         updated_at = now()
   WHERE t.id = p_ticket_id
  RETURNING * INTO v_new;

  RETURN jsonb_build_object(
    'ticket_id', v_new.id,
    'ticket_number', v_new.ticket_number,
    'old_status', v_old.status,
    'new_status', v_new.status,
    'responded', v_response IS NOT NULL,
    'notify', (v_new.status IS DISTINCT FROM v_old.status) OR v_response IS NOT NULL);
END;
$$;
REVOKE ALL ON FUNCTION isexy.staff_update_ticket(uuid, text, text, text, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.staff_update_ticket(uuid, text, text, text, uuid, boolean) TO authenticated;

-- Returns the tickets whose status changed (for the status e-mails).
CREATE OR REPLACE FUNCTION isexy.staff_bulk_update_tickets(
  p_ticket_ids uuid[],
  p_status text DEFAULT NULL,
  p_assigned_to uuid DEFAULT NULL,
  p_change_assignee boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  c_statuses CONSTANT text[] := ARRAY['open', 'in_progress', 'resolved', 'closed'];
  v_changed jsonb;
  v_count int;
BEGIN
  IF NOT isexy.is_staff() THEN
    RAISE EXCEPTION 'Only ISEXY staff can update tickets' USING ERRCODE = '42501';
  END IF;
  IF p_status IS NOT NULL AND NOT (p_status = ANY (c_statuses)) THEN
    RAISE EXCEPTION 'Unknown ticket status' USING ERRCODE = '22023';
  END IF;
  IF coalesce(array_length(p_ticket_ids, 1), 0) > 200 THEN
    RAISE EXCEPTION 'At most 200 tickets at a time' USING ERRCODE = '22023';
  END IF;
  IF p_change_assignee AND p_assigned_to IS NOT NULL
     AND NOT (isexy.has_role(p_assigned_to, 'admin') OR isexy.has_role(p_assigned_to, 'moderator')) THEN
    RAISE EXCEPTION 'Tickets can only be assigned to staff' USING ERRCODE = '22023';
  END IF;

  WITH old AS (
    SELECT id, status FROM isexy.support_tickets WHERE id = ANY (p_ticket_ids) FOR UPDATE
  ), upd AS (
    UPDATE isexy.support_tickets t
       SET status = coalesce(p_status, t.status),
           assigned_to = CASE WHEN p_change_assignee THEN p_assigned_to ELSE t.assigned_to END,
           updated_at = now()
      FROM old
     WHERE t.id = old.id
    RETURNING t.id, t.ticket_number, old.status AS old_status, t.status AS new_status
  )
  SELECT count(*)::int,
         coalesce(jsonb_agg(jsonb_build_object('ticket_id', id, 'ticket_number', ticket_number,
                                               'old_status', old_status, 'new_status', new_status))
                  FILTER (WHERE new_status IS DISTINCT FROM old_status), '[]'::jsonb)
    INTO v_count, v_changed
    FROM upd;

  RETURN jsonb_build_object('updated', v_count, 'status_changed', v_changed);
END;
$$;
REVOKE ALL ON FUNCTION isexy.staff_bulk_update_tickets(uuid[], text, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.staff_bulk_update_tickets(uuid[], text, uuid, boolean) TO authenticated;
