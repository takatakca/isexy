-- ISEXY trust area: moderation, blocks and reports, support tickets, live chat
-- with a person, staff tools (branch wf/trust, on top of PR #2). Runs after
-- 0014_security_and_performance.sql; NOT applied anywhere yet. Written from
-- the branch notes docs/handoff/trust.sql (T1-T4, kept there as history),
-- deduplicated against 0013/0014 and main's 0009/0010:
--   - support tickets: main's 0009 trigger (only admins or the service role
--     change staff fields), 0010 policies (no auth.users reads) and 0014 D2
--     (staff fields at INSERT) are kept as they are. The branch notes dropped
--     the members' UPDATE policy and re-created the SELECT policy: not done
--     here (0010 already fixed the auth.users read and 0009 limits members to
--     message/attachments). Staff ticket RPCs are admin only, like 0009.
--   - live chat: 0014 D5's message policy is tightened in place (same name),
--     not replaced.
--   - blocked_with_me (0014 D3) is reused; nothing of 0013/0014 is redefined
--     except validate_message_allowed (0001 body + two checks, D below), whose
--     0014 B3 grants are restated.
-- Every policy written here already uses (select auth.uid()) /
-- (select isexy.has_role(...)) / (select isexy.is_staff()), so 0014 C2's
-- guard stays quiet if 0014 is ever re-run.
--
-- isexy schema only. Idempotent: ADD COLUMN IF NOT EXISTS, CREATE TABLE/INDEX
-- IF NOT EXISTS, CREATE OR REPLACE FUNCTION, DROP POLICY IF EXISTS before
-- CREATE POLICY, ALTER POLICY. No row is deleted: a lifted restriction keeps
-- its row (lifted_at), a resolved report keeps its row (status), a role is
-- only ever granted here (removing one stays a manual owner task).
-- Every function is SECURITY DEFINER with a pinned search_path, REVOKE ALL
-- FROM PUBLIC (and anon unless guests need it), explicit GRANTs; every staff
-- RPC checks has_role itself (admin, or admin/moderator where noted) and
-- writes one isexy.staff_actions row (audit log, admins read it).
-- Tests: scripts/isexy/test/trust-smoke.sql.
--
-- A. Staff helpers and audit log
--    A1. is_staff(): the caller is admin or moderator.
--    A2. staff_actions table (who did what to whom, details jsonb), read by
--        admins; written only by the staff RPCs through log_staff_action().
--    A3. Staff (admin + moderator) read every profile, also suspended ones
--        (the members' policy shows active profiles only, so banned members
--        vanished from every staff list), and every report.
-- B. Members: blocks and reports
--    B1. reports.source / reviewed_by / reviewed_at / resolution_note.
--    B2. profiles SELECT: a member never reads the profile of someone who
--        blocked them (my_blocker_ids(), once per statement), and always
--        reads their own (a suspended member kept getting sent to profile
--        setup).
--    B3. get_my_hidden_member_ids(): blocked either way, for the pages that
--        list people. block_member(id): idempotent. report_member(id, reason,
--        details, block, source): reasons checked, no self-report, one pending
--        report per pair (details appended), 20 a day.
--    B4. reports INSERT (direct, older clients): reporter is the member, not
--        themselves, status pending, no review fields (security.md: a report
--        could be filed as already "resolved").
-- C. Moderation (members)
--    C1. user_warnings.lifted_at / lifted_by / lift_reason.
--    C2. active_restriction(profile) (internal), get_my_moderation_status(),
--        record_contact_sharing(types, excerpt, match): the chat refused a
--        message with contact details; the strike (24 h, 7 days, permanent)
--        is recorded on the server (the browser INSERT into user_warnings
--        was always refused by RLS, so restrictions never happened).
-- D. validate_message_allowed (messages trigger): also refuses a message from
--    a member with an active restriction or a suspended account.
-- E. Staff moderation RPCs (admin or moderator; acting on a staff account
--    needs admin; nobody acts on themselves):
--    staff_issue_warning, staff_lift_restrictions, staff_set_shadow_ban,
--    staff_set_account_active (suspend / reinstate), staff_resolve_report,
--    staff_update_profile (first name / bio). Verification stays
--    staff_set_profile_verified / review_photo_verification (0013).
--    Admin only: staff_list_roles, staff_grant_role.
-- F. Support tickets (admin only, main's 0009 rule): get_ticket_status(number,
--    email) for guests and members (RLS only ever showed signed-in members
--    their own tickets), staff_update_ticket, staff_bulk_update_tickets.
-- G. Live chat with a person ("Talk to a person" in the assistant): staff
--    (admin + moderator) read the queue and messages; staff_accept_live_chat,
--    staff_close_live_chat, staff_get_live_chat_transcript; members end their
--    chat with end_my_live_chat. 0014 D5's message policy tightened: a member
--    posts only as "user" in their own open chat, an agent only as "agent"
--    in an active chat assigned to them, nobody posts "system" messages
--    directly (the RPCs do), sender_id is always the caller.
-- H. staff_dashboard_stats(): the staff home page's numbers in one call
--    (the page loaded every profile row into the browser, and its revenue
--    cards summed tables admins cannot read in full, so they showed the
--    admin's own purchases). Members and moderation queues for staff; open
--    tickets and revenue for admins only.
-- I. Admins read the payment ledgers (credit_transactions, boost_transactions,
--    gift_transactions, subscriptions, chat_subscriptions) for the payment
--    check page: each table only had "own rows" policies, so the page counted
--    the admin's own purchases. Read only; writes stay with the RPCs and the
--    service role.

-- =====================================================================
-- A1. is_staff()
-- =====================================================================
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

-- =====================================================================
-- A2. Audit log of staff actions
-- =====================================================================
CREATE TABLE IF NOT EXISTS isexy.staff_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL,
  action text NOT NULL,
  target_profile_id uuid,
  target_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE isexy.staff_actions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS staff_actions_created_idx ON isexy.staff_actions (created_at DESC);
CREATE INDEX IF NOT EXISTS staff_actions_target_profile_idx ON isexy.staff_actions (target_profile_id, created_at DESC)
  WHERE target_profile_id IS NOT NULL;
REVOKE ALL ON isexy.staff_actions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON isexy.staff_actions TO authenticated;
GRANT ALL ON isexy.staff_actions TO service_role;

DROP POLICY IF EXISTS "Admins read staff actions" ON isexy.staff_actions;
CREATE POLICY "Admins read staff actions" ON isexy.staff_actions
  FOR SELECT TO authenticated
  USING ((SELECT isexy.has_role((SELECT auth.uid()), 'admin'::isexy.app_role)));

-- Internal: called by the staff RPCs below (never by clients).
CREATE OR REPLACE FUNCTION isexy.log_staff_action(
  p_action text,
  p_target_profile_id uuid,
  p_target_id uuid,
  p_details jsonb
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
  INSERT INTO isexy.staff_actions (actor_user_id, action, target_profile_id, target_id, details)
  VALUES (auth.uid(), p_action, p_target_profile_id, p_target_id, coalesce(p_details, '{}'::jsonb));
$$;
REVOKE ALL ON FUNCTION isexy.log_staff_action(text, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;

-- =====================================================================
-- A3. Staff read every profile and every report
-- =====================================================================
DROP POLICY IF EXISTS "Staff view all profiles" ON isexy.profiles;
CREATE POLICY "Staff view all profiles" ON isexy.profiles
  FOR SELECT TO authenticated
  USING ((SELECT isexy.is_staff()));

DROP POLICY IF EXISTS "Staff view all reports" ON isexy.reports;
CREATE POLICY "Staff view all reports" ON isexy.reports
  FOR SELECT TO authenticated
  USING ((SELECT isexy.is_staff()));

-- =====================================================================
-- B1. Report columns
-- =====================================================================
ALTER TABLE isexy.reports ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE isexy.reports ADD COLUMN IF NOT EXISTS reviewed_by uuid;
ALTER TABLE isexy.reports ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE isexy.reports ADD COLUMN IF NOT EXISTS resolution_note text;
CREATE INDEX IF NOT EXISTS reports_pending_idx ON isexy.reports (created_at DESC)
  WHERE coalesce(status, 'pending') = 'pending';

-- =====================================================================
-- B2. Profiles: hidden from the members their owner blocked; own profile always
-- =====================================================================
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

-- =====================================================================
-- B3. Blocks and reports (members)
-- =====================================================================
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
  IF p_reason IS NULL OR NOT (p_reason = ANY (c_reasons)) THEN
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
   LIMIT 1
   FOR UPDATE;
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
-- B4. Direct report inserts (older clients): pending, unreviewed, not self
-- =====================================================================
ALTER POLICY "Users can create reports" ON isexy.reports
  WITH CHECK (
    reporter_id IN (SELECT profiles.id FROM isexy.profiles WHERE profiles.user_id = (SELECT auth.uid()))
    AND reported_id <> reporter_id
    AND coalesce(status, 'pending') = 'pending'
    AND reviewed_by IS NULL AND reviewed_at IS NULL AND resolution_note IS NULL
  );

-- =====================================================================
-- C1. Lifted restrictions keep their row
-- =====================================================================
ALTER TABLE isexy.user_warnings ADD COLUMN IF NOT EXISTS lifted_at timestamptz;
ALTER TABLE isexy.user_warnings ADD COLUMN IF NOT EXISTS lifted_by uuid;
ALTER TABLE isexy.user_warnings ADD COLUMN IF NOT EXISTS lift_reason text;

-- =====================================================================
-- C2. Members: restriction status, contact-sharing strikes
-- =====================================================================
-- Active messaging restriction of a member (NULL row when none). Internal.
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

  -- One strike at a time per member (two tabs, double clicks).
  PERFORM pg_advisory_xact_lock(hashtextextended('isexy.contact_sharing:' || v_profile::text, 0));

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

  -- Strikes lifted by staff as a mistake do not count.
  SELECT count(*) INTO v_strikes
    FROM isexy.user_warnings
   WHERE profile_id = v_profile AND warning_type = 'contact_sharing'
     AND coalesce(lift_reason, '') NOT LIKE 'mistake%';
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

-- =====================================================================
-- D. Messages: restricted or suspended senders are refused
-- =====================================================================
-- Same body as 0001 plus the two checks at the end.
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

  IF EXISTS (SELECT 1 FROM isexy.profiles WHERE id = NEW.sender_id AND is_active IS DISTINCT FROM true) THEN
    RAISE EXCEPTION 'This account is suspended' USING ERRCODE = 'P0001';
  END IF;

  v_restriction := isexy.active_restriction(NEW.sender_id);
  IF v_restriction.id IS NOT NULL THEN
    RAISE EXCEPTION 'Messaging is restricted for this member' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION isexy.validate_message_allowed() FROM PUBLIC, anon, authenticated;

-- =====================================================================
-- E. Staff moderation RPCs
-- =====================================================================
-- Internal: the caller may act on this member (staff, not themselves, a staff
-- account only by an admin). Returns the target's user id.
CREATE OR REPLACE FUNCTION isexy.assert_staff_may_act_on(p_profile_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_target_user uuid;
BEGIN
  IF NOT isexy.is_staff() THEN
    RAISE EXCEPTION 'Only ISEXY staff can do this' USING ERRCODE = '42501';
  END IF;
  SELECT user_id INTO v_target_user FROM isexy.profiles WHERE id = p_profile_id;
  IF v_target_user IS NULL THEN
    RAISE EXCEPTION 'Member not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_target_user = auth.uid() THEN
    RAISE EXCEPTION 'Staff cannot act on their own account' USING ERRCODE = '42501';
  END IF;
  IF (isexy.has_role(v_target_user, 'admin') OR isexy.has_role(v_target_user, 'moderator'))
     AND NOT isexy.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only an admin can act on a staff account' USING ERRCODE = '42501';
  END IF;
  RETURN v_target_user;
END;
$$;
REVOKE ALL ON FUNCTION isexy.assert_staff_may_act_on(uuid) FROM PUBLIC, anon, authenticated;

-- Warning, optionally with a messaging restriction: p_restriction none | 24h |
-- 7d | permanent. p_warning_type: user_warnings' CHECK list.
CREATE OR REPLACE FUNCTION isexy.staff_issue_warning(
  p_profile_id uuid,
  p_warning_type text,
  p_restriction text DEFAULT 'none',
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  c_types CONSTANT text[] := ARRAY['contact_sharing', 'harassment', 'spam', 'fake_profile', 'other'];
  v_restriction text := coalesce(p_restriction, 'none');
  v_until timestamptz;
  v_permanent boolean := false;
  v_level int;
  v_issuer uuid;
  v_id uuid;
BEGIN
  PERFORM isexy.assert_staff_may_act_on(p_profile_id);
  IF p_warning_type IS NULL OR NOT (p_warning_type = ANY (c_types)) THEN
    RAISE EXCEPTION 'Unknown warning type' USING ERRCODE = '22023';
  END IF;
  CASE v_restriction
    WHEN 'none' THEN v_level := 1;
    WHEN '24h' THEN v_level := 1; v_until := now() + interval '24 hours';
    WHEN '7d' THEN v_level := 2; v_until := now() + interval '7 days';
    WHEN 'permanent' THEN v_level := 3; v_permanent := true;
    ELSE RAISE EXCEPTION 'Unknown restriction' USING ERRCODE = '22023';
  END CASE;
  SELECT id INTO v_issuer FROM isexy.profiles WHERE user_id = auth.uid();

  INSERT INTO isexy.user_warnings (profile_id, warning_type, warning_level, ban_until, is_permanent_ban, evidence, issued_by)
  VALUES (p_profile_id, p_warning_type, v_level, v_until, v_permanent,
          jsonb_build_object('source', 'staff', 'note', left(nullif(btrim(p_note), ''), 1000))::text, v_issuer)
  RETURNING id INTO v_id;

  PERFORM isexy.log_staff_action('issue_warning', p_profile_id, v_id,
    jsonb_build_object('type', p_warning_type, 'restriction', v_restriction, 'note', left(nullif(btrim(p_note), ''), 1000)));
  RETURN jsonb_build_object('warning_id', v_id, 'level', v_level, 'until', v_until, 'permanent', v_permanent);
END;
$$;
REVOKE ALL ON FUNCTION isexy.staff_issue_warning(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.staff_issue_warning(uuid, text, text, text) TO authenticated;

-- Lifts every active restriction of a member (rows kept, lifted_at set).
-- A reason starting with "mistake" also stops the strike from counting
-- towards the next contact-sharing step.
CREATE OR REPLACE FUNCTION isexy.staff_lift_restrictions(p_profile_id uuid, p_reason text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_count int;
BEGIN
  PERFORM isexy.assert_staff_may_act_on(p_profile_id);
  UPDATE isexy.user_warnings
     SET lifted_at = now(), lifted_by = auth.uid(), lift_reason = left(nullif(btrim(p_reason), ''), 500)
   WHERE profile_id = p_profile_id
     AND lifted_at IS NULL
     AND (is_permanent_ban IS TRUE OR ban_until > now());
  GET DIAGNOSTICS v_count = ROW_COUNT;
  PERFORM isexy.log_staff_action('lift_restrictions', p_profile_id, NULL,
    jsonb_build_object('lifted', v_count, 'reason', left(nullif(btrim(p_reason), ''), 500)));
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION isexy.staff_lift_restrictions(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.staff_lift_restrictions(uuid, text) TO authenticated;

-- Shadow ban: the member keeps using ISEXY but is left out of Discover,
-- Top Picks, likes received and the phone line (0013 feeds honour it).
CREATE OR REPLACE FUNCTION isexy.staff_set_shadow_ban(p_profile_id uuid, p_banned boolean, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
BEGIN
  PERFORM isexy.assert_staff_may_act_on(p_profile_id);
  IF p_banned IS NULL THEN
    RAISE EXCEPTION 'Missing decision' USING ERRCODE = '22023';
  END IF;
  UPDATE isexy.profiles
     SET shadow_banned = p_banned,
         shadow_banned_at = CASE WHEN p_banned THEN now() ELSE NULL END,
         shadow_banned_reason = CASE WHEN p_banned THEN left(nullif(btrim(p_reason), ''), 500) ELSE NULL END,
         updated_at = now()
   WHERE id = p_profile_id;
  PERFORM isexy.log_staff_action(CASE WHEN p_banned THEN 'shadow_ban' ELSE 'shadow_unban' END, p_profile_id, NULL,
    jsonb_build_object('reason', left(nullif(btrim(p_reason), ''), 500)));
  RETURN jsonb_build_object('shadow_banned', p_banned);
END;
$$;
REVOKE ALL ON FUNCTION isexy.staff_set_shadow_ban(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.staff_set_shadow_ban(uuid, boolean, text) TO authenticated;

-- Suspend (is_active = false: hidden from everyone, messages refused, the
-- member sees a "suspended" screen) or reinstate an account.
CREATE OR REPLACE FUNCTION isexy.staff_set_account_active(p_profile_id uuid, p_active boolean, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
BEGIN
  PERFORM isexy.assert_staff_may_act_on(p_profile_id);
  IF p_active IS NULL THEN
    RAISE EXCEPTION 'Missing decision' USING ERRCODE = '22023';
  END IF;
  IF NOT p_active AND nullif(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'A reason is required to suspend an account' USING ERRCODE = '22023';
  END IF;
  UPDATE isexy.profiles SET is_active = p_active, updated_at = now() WHERE id = p_profile_id;
  PERFORM isexy.log_staff_action(CASE WHEN p_active THEN 'reinstate' ELSE 'suspend' END, p_profile_id, NULL,
    jsonb_build_object('reason', left(nullif(btrim(p_reason), ''), 500)));
  RETURN jsonb_build_object('is_active', p_active);
END;
$$;
REVOKE ALL ON FUNCTION isexy.staff_set_account_active(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.staff_set_account_active(uuid, boolean, text) TO authenticated;

-- Report review: reviewing | resolved | dismissed (the row is kept).
CREATE OR REPLACE FUNCTION isexy.staff_resolve_report(p_report_id uuid, p_status text, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_old text;
  v_reported uuid;
BEGIN
  IF NOT isexy.is_staff() THEN
    RAISE EXCEPTION 'Only ISEXY staff can review reports' USING ERRCODE = '42501';
  END IF;
  IF p_status IS NULL OR NOT (p_status = ANY (ARRAY['reviewing', 'resolved', 'dismissed'])) THEN
    RAISE EXCEPTION 'Unknown report status' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(status, 'pending'), reported_id INTO v_old, v_reported
    FROM isexy.reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found' USING ERRCODE = 'P0002';
  END IF;
  UPDATE isexy.reports
     SET status = p_status,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         resolution_note = coalesce(left(nullif(btrim(p_note), ''), 2000), resolution_note)
   WHERE id = p_report_id;
  PERFORM isexy.log_staff_action('report_' || p_status, v_reported, p_report_id,
    jsonb_build_object('old_status', v_old, 'note', left(nullif(btrim(p_note), ''), 2000)));
  RETURN jsonb_build_object('report_id', p_report_id, 'old_status', v_old, 'status', p_status);
END;
$$;
REVOKE ALL ON FUNCTION isexy.staff_resolve_report(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.staff_resolve_report(uuid, text, text) TO authenticated;

-- Staff edit of a member's public text (an offensive name or bio). NULL =
-- unchanged; an empty bio clears it; the name cannot be empty.
CREATE OR REPLACE FUNCTION isexy.staff_update_profile(
  p_profile_id uuid,
  p_first_name text DEFAULT NULL,
  p_bio text DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_old isexy.profiles;
BEGIN
  PERFORM isexy.assert_staff_may_act_on(p_profile_id);
  IF p_first_name IS NOT NULL AND (length(btrim(p_first_name)) = 0 OR length(btrim(p_first_name)) > 50) THEN
    RAISE EXCEPTION 'A first name needs 1 to 50 characters' USING ERRCODE = '22023';
  END IF;
  IF p_first_name IS NULL AND p_bio IS NULL THEN
    RAISE EXCEPTION 'Nothing to change' USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'A reason is required' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_old FROM isexy.profiles WHERE id = p_profile_id FOR UPDATE;
  UPDATE isexy.profiles
     SET first_name = coalesce(btrim(p_first_name), first_name),
         bio = CASE WHEN p_bio IS NULL THEN bio ELSE nullif(left(btrim(p_bio), 500), '') END,
         updated_at = now()
   WHERE id = p_profile_id;
  PERFORM isexy.log_staff_action('edit_profile', p_profile_id, NULL,
    jsonb_strip_nulls(jsonb_build_object(
      'reason', left(btrim(p_reason), 500),
      'old_first_name', CASE WHEN p_first_name IS NOT NULL THEN v_old.first_name END,
      'old_bio', CASE WHEN p_bio IS NOT NULL THEN v_old.bio END)));
  RETURN jsonb_build_object('updated', true);
END;
$$;
REVOKE ALL ON FUNCTION isexy.staff_update_profile(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.staff_update_profile(uuid, text, text, text) TO authenticated;

-- Roles of the listed accounts (admin only; members read only their own).
CREATE OR REPLACE FUNCTION isexy.staff_list_roles(p_user_ids uuid[])
RETURNS TABLE (user_id uuid, role isexy.app_role)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT isexy.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  IF coalesce(array_length(p_user_ids, 1), 0) > 500 THEN
    RAISE EXCEPTION 'At most 500 accounts at a time' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT r.user_id, r.role FROM isexy.user_roles r WHERE r.user_id = ANY (p_user_ids) ORDER BY r.user_id, r.role;
END;
$$;
REVOKE ALL ON FUNCTION isexy.staff_list_roles(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.staff_list_roles(uuid[]) TO authenticated;

-- Grant admin or moderator (admin only). Removing a role is not done from the
-- app (no row deletion): the owner removes it in the database.
CREATE OR REPLACE FUNCTION isexy.staff_grant_role(p_user_id uuid, p_role isexy.app_role)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_id uuid;
  v_profile uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT isexy.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  IF p_role IS NULL OR p_role NOT IN ('admin', 'moderator') THEN
    RAISE EXCEPTION 'Only admin or moderator can be granted' USING ERRCODE = '22023';
  END IF;
  SELECT id INTO v_profile FROM isexy.profiles WHERE user_id = p_user_id;
  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'Member not found' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO isexy.user_roles (user_id, role) VALUES (p_user_id, p_role)
  ON CONFLICT (user_id, role) DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN
    PERFORM isexy.log_staff_action('grant_role', v_profile, v_id, jsonb_build_object('role', p_role));
  END IF;
  RETURN jsonb_build_object('granted', true, 'already', v_id IS NULL);
END;
$$;
REVOKE ALL ON FUNCTION isexy.staff_grant_role(uuid, isexy.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.staff_grant_role(uuid, isexy.app_role) TO authenticated;

-- =====================================================================
-- F. Support tickets
-- =====================================================================
-- Tracking by number + the e-mail the ticket was sent from (guests too).
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

-- Admin only (main's 0009 trigger lets only admins or the service role change
-- staff fields; this RPC checks the same first). Note appended with the author
-- and time; assignee must be an admin. Returns what the status e-mail needs.
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
  IF v_uid IS NULL OR NOT isexy.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'Only ISEXY admins can update tickets' USING ERRCODE = '42501';
  END IF;
  IF p_status IS NOT NULL AND NOT (p_status = ANY (c_statuses)) THEN
    RAISE EXCEPTION 'Unknown ticket status' USING ERRCODE = '22023';
  END IF;
  IF p_change_assignee AND p_assigned_to IS NOT NULL AND NOT isexy.has_role(p_assigned_to, 'admin') THEN
    RAISE EXCEPTION 'Tickets can only be assigned to an admin' USING ERRCODE = '22023';
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

  PERFORM isexy.log_staff_action('update_ticket', NULL, p_ticket_id,
    jsonb_build_object('ticket_number', v_new.ticket_number, 'old_status', v_old.status, 'new_status', v_new.status,
                       'responded', v_response IS NOT NULL, 'note', v_note IS NOT NULL,
                       'assignee_changed', p_change_assignee AND v_new.assigned_to IS DISTINCT FROM v_old.assigned_to));

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
  IF auth.uid() IS NULL OR NOT isexy.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only ISEXY admins can update tickets' USING ERRCODE = '42501';
  END IF;
  IF p_status IS NOT NULL AND NOT (p_status = ANY (c_statuses)) THEN
    RAISE EXCEPTION 'Unknown ticket status' USING ERRCODE = '22023';
  END IF;
  IF coalesce(array_length(p_ticket_ids, 1), 0) > 200 THEN
    RAISE EXCEPTION 'At most 200 tickets at a time' USING ERRCODE = '22023';
  END IF;
  IF p_change_assignee AND p_assigned_to IS NOT NULL AND NOT isexy.has_role(p_assigned_to, 'admin') THEN
    RAISE EXCEPTION 'Tickets can only be assigned to an admin' USING ERRCODE = '22023';
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

  PERFORM isexy.log_staff_action('bulk_update_tickets', NULL, NULL,
    jsonb_build_object('updated', v_count, 'status', p_status, 'assignee_changed', p_change_assignee));
  RETURN jsonb_build_object('updated', v_count, 'status_changed', v_changed);
END;
$$;
REVOKE ALL ON FUNCTION isexy.staff_bulk_update_tickets(uuid[], text, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.staff_bulk_update_tickets(uuid[], text, uuid, boolean) TO authenticated;

-- =====================================================================
-- G. Live chat with a person
-- =====================================================================
DROP POLICY IF EXISTS "Staff view live chat sessions" ON isexy.live_chat_sessions;
CREATE POLICY "Staff view live chat sessions" ON isexy.live_chat_sessions
  FOR SELECT TO authenticated
  USING ((SELECT isexy.is_staff()));

DROP POLICY IF EXISTS "Staff view live chat messages" ON isexy.live_chat_messages;
CREATE POLICY "Staff view live chat messages" ON isexy.live_chat_messages
  FOR SELECT TO authenticated
  USING ((SELECT isexy.is_staff()));

-- 0014 D5's policy, tightened (same name): the sender is always the caller;
-- a member posts as "user" in their own waiting/active chat, an agent as
-- "agent" in an active chat assigned to them; "system" lines come only from
-- the RPCs below and the service role.
ALTER POLICY "Users can insert messages in their sessions" ON isexy.live_chat_messages
  WITH CHECK (
    sender_id = (SELECT auth.uid())
    AND (
      (sender_type = 'user'
       AND session_id IN (SELECT s.id FROM isexy.live_chat_sessions s
                           WHERE s.user_id = (SELECT auth.uid()) AND s.status IN ('waiting', 'active')))
      OR (sender_type = 'agent'
          AND session_id IN (SELECT s.id FROM isexy.live_chat_sessions s
                              WHERE s.agent_id = (SELECT auth.uid()) AND s.status = 'active'))
    )
  );

CREATE OR REPLACE FUNCTION isexy.staff_accept_live_chat(p_session_id uuid)
RETURNS isexy.live_chat_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row isexy.live_chat_sessions;
  v_name text;
BEGIN
  IF NOT isexy.is_staff() THEN
    RAISE EXCEPTION 'Only ISEXY staff can answer live chats' USING ERRCODE = '42501';
  END IF;
  UPDATE isexy.live_chat_sessions
     SET agent_id = v_uid, status = 'active', updated_at = now()
   WHERE id = p_session_id
     AND (status = 'waiting' OR (status = 'active' AND agent_id = v_uid))
  RETURNING * INTO v_row;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This chat was taken by someone else or has ended' USING ERRCODE = 'P0002';
  END IF;
  SELECT first_name INTO v_name FROM isexy.profiles WHERE user_id = v_uid;
  INSERT INTO isexy.live_chat_messages (session_id, sender_type, sender_id, content)
  VALUES (p_session_id, 'system', v_uid, coalesce(v_name, 'A team member') || ' from ISEXY Support joined the chat.');
  PERFORM isexy.log_staff_action('accept_live_chat', NULL, p_session_id, '{}'::jsonb);
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION isexy.staff_accept_live_chat(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.staff_accept_live_chat(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION isexy.staff_close_live_chat(p_session_id uuid)
RETURNS isexy.live_chat_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row isexy.live_chat_sessions;
BEGIN
  IF NOT isexy.is_staff() THEN
    RAISE EXCEPTION 'Only ISEXY staff can close live chats' USING ERRCODE = '42501';
  END IF;
  UPDATE isexy.live_chat_sessions
     SET status = 'closed', ended_at = now(), updated_at = now()
   WHERE id = p_session_id AND status <> 'closed'
     AND (agent_id = v_uid OR agent_id IS NULL OR isexy.has_role(v_uid, 'admin'))
  RETURNING * INTO v_row;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chat not found, already closed or assigned to someone else' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO isexy.live_chat_messages (session_id, sender_type, sender_id, content)
  VALUES (p_session_id, 'system', v_uid, 'This chat has ended. You can start a new one any time from the assistant.');
  PERFORM isexy.log_staff_action('close_live_chat', NULL, p_session_id, '{}'::jsonb);
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION isexy.staff_close_live_chat(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.staff_close_live_chat(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION isexy.end_my_live_chat(p_session_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501';
  END IF;
  UPDATE isexy.live_chat_sessions
     SET status = 'closed', ended_at = now(), updated_at = now()
   WHERE id = p_session_id AND user_id = auth.uid() AND status <> 'closed';
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  INSERT INTO isexy.live_chat_messages (session_id, sender_type, sender_id, content)
  VALUES (p_session_id, 'system', auth.uid(), 'The member ended the chat.');
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION isexy.end_my_live_chat(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.end_my_live_chat(uuid) TO authenticated;

-- The assistant conversation that led to the handoff (staff only).
CREATE OR REPLACE FUNCTION isexy.staff_get_live_chat_transcript(p_session_id uuid)
RETURNS TABLE (role text, content text, created_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
BEGIN
  IF NOT isexy.is_staff() THEN
    RAISE EXCEPTION 'Staff only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT m.role, m.content, m.created_at
      FROM isexy.live_chat_sessions s
      JOIN isexy.chatbot_messages m ON m.conversation_id = s.chatbot_conversation_id
     WHERE s.id = p_session_id
     ORDER BY m.created_at
     LIMIT 200;
END;
$$;
REVOKE ALL ON FUNCTION isexy.staff_get_live_chat_transcript(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.staff_get_live_chat_transcript(uuid) TO authenticated;

-- =====================================================================
-- H. Staff home page numbers
-- =====================================================================
CREATE OR REPLACE FUNCTION isexy.staff_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_admin boolean;
  v_today timestamptz := date_trunc('day', now() AT TIME ZONE 'America/Toronto') AT TIME ZONE 'America/Toronto';
  v_result jsonb;
BEGIN
  IF NOT isexy.is_staff() THEN
    RAISE EXCEPTION 'Staff only' USING ERRCODE = '42501';
  END IF;
  v_admin := isexy.has_role(auth.uid(), 'admin');

  SELECT jsonb_build_object(
    'members', (SELECT jsonb_build_object(
        'total', count(*),
        'active', count(*) FILTER (WHERE is_active),
        'suspended', count(*) FILTER (WHERE NOT coalesce(is_active, true)),
        'shadow_banned', count(*) FILTER (WHERE coalesce(shadow_banned, false)),
        'premium', count(*) FILTER (WHERE coalesce(is_premium, false)),
        'verified', count(*) FILTER (WHERE coalesce(is_verified, false)),
        'new_today', count(*) FILTER (WHERE created_at >= v_today),
        'new_week', count(*) FILTER (WHERE created_at >= v_today - interval '6 days'))
      FROM isexy.profiles),
    'by_gender', coalesce((SELECT jsonb_object_agg(g, n) FROM (
        SELECT coalesce(nullif(gender, ''), 'unknown') AS g, count(*) AS n FROM isexy.profiles GROUP BY 1) x), '{}'::jsonb),
    'by_tier', coalesce((SELECT jsonb_object_agg(t, n) FROM (
        SELECT CASE WHEN coalesce(is_premium, false) THEN coalesce(nullif(subscription_tier, ''), 'plus') ELSE 'free' END AS t,
               count(*) AS n
          FROM isexy.profiles GROUP BY 1) x), '{}'::jsonb),
    'signups_14d', (SELECT jsonb_agg(jsonb_build_object('day', d::date, 'count',
        (SELECT count(*) FROM isexy.profiles p
          WHERE p.created_at >= d AND p.created_at < d + interval '1 day')) ORDER BY d)
      FROM generate_series(v_today - interval '13 days', v_today, interval '1 day') AS d),
    'queues', jsonb_build_object(
      'pending_reports', (SELECT count(*) FROM isexy.reports WHERE coalesce(status, 'pending') IN ('pending', 'reviewing')),
      'active_restrictions', (SELECT count(DISTINCT profile_id) FROM isexy.user_warnings
                               WHERE lifted_at IS NULL AND (is_permanent_ban IS TRUE OR ban_until > now())),
      'pending_photo_checks', (SELECT count(*) FROM isexy.photo_verifications WHERE status = 'pending'),
      'waiting_live_chats', (SELECT count(*) FROM isexy.live_chat_sessions WHERE status = 'waiting'),
      'pending_voice_greetings', (SELECT count(*) FROM isexy.voice_greetings
                                   WHERE is_active AND (moderation_status = 'pending' OR report_count > 0)),
      'open_tickets', CASE WHEN v_admin THEN (SELECT count(*) FROM isexy.support_tickets WHERE status IN ('open', 'in_progress')) END),
    'revenue', CASE WHEN v_admin THEN jsonb_build_object(
      'credits_purchased', (SELECT coalesce(sum(abs(amount)), 0) FROM isexy.credit_transactions WHERE type = 'purchase'),
      'credit_purchases', (SELECT count(*) FROM isexy.credit_transactions WHERE type = 'purchase'),
      'active_subscriptions', (SELECT count(*) FROM isexy.subscriptions WHERE status IN ('active', 'trialing')),
      'active_chat_subscriptions', (SELECT count(*) FROM isexy.chat_subscriptions WHERE status = 'active'),
      'call_credits_used', (SELECT coalesce(sum(credits_used), 0) FROM isexy.video_call_sessions)) END,
    'is_admin', v_admin
  ) INTO v_result;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION isexy.staff_dashboard_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.staff_dashboard_stats() TO authenticated;

-- =====================================================================
-- I. Admins read the payment ledgers
-- =====================================================================
DROP POLICY IF EXISTS "Admins read all credit transactions" ON isexy.credit_transactions;
CREATE POLICY "Admins read all credit transactions" ON isexy.credit_transactions
  FOR SELECT TO authenticated
  USING ((SELECT isexy.has_role((SELECT auth.uid()), 'admin'::isexy.app_role)));
DROP POLICY IF EXISTS "Admins read all boost transactions" ON isexy.boost_transactions;
CREATE POLICY "Admins read all boost transactions" ON isexy.boost_transactions
  FOR SELECT TO authenticated
  USING ((SELECT isexy.has_role((SELECT auth.uid()), 'admin'::isexy.app_role)));
DROP POLICY IF EXISTS "Admins read all gift transactions" ON isexy.gift_transactions;
CREATE POLICY "Admins read all gift transactions" ON isexy.gift_transactions
  FOR SELECT TO authenticated
  USING ((SELECT isexy.has_role((SELECT auth.uid()), 'admin'::isexy.app_role)));
DROP POLICY IF EXISTS "Admins read all subscriptions" ON isexy.subscriptions;
CREATE POLICY "Admins read all subscriptions" ON isexy.subscriptions
  FOR SELECT TO authenticated
  USING ((SELECT isexy.has_role((SELECT auth.uid()), 'admin'::isexy.app_role)));
DROP POLICY IF EXISTS "Admins read all chat subscriptions" ON isexy.chat_subscriptions;
CREATE POLICY "Admins read all chat subscriptions" ON isexy.chat_subscriptions
  FOR SELECT TO authenticated
  USING ((SELECT isexy.has_role((SELECT auth.uid()), 'admin'::isexy.app_role)));
