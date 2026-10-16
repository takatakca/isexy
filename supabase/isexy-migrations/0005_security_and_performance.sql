-- ISEXY security + DB performance pass (claude/zealous-brown-kv2hmx). Runs
-- after 0004_app_completion.sql; NOT applied anywhere yet (neither is 0004).
-- Closes the member write holes listed in docs/HANDOFF.md › Next pass and the
-- ones found by auditing every isexy policy, SECURITY DEFINER function and
-- grant on a local copy of the schema (0001-0004), then speeds up RLS.
--
-- isexy schema only (plus one "isexy: " storage policy, which the migrate.sh
-- guard allows). Idempotent: DROP ... IF EXISTS, CREATE OR REPLACE FUNCTION,
-- DROP TRIGGER IF EXISTS before CREATE TRIGGER, CREATE INDEX IF NOT EXISTS,
-- ALTER POLICY (fails loudly if a policy was renamed meanwhile, instead of
-- silently re-creating an old version). No row is deleted or rewritten.
-- Before this file: no client code writes any table or column closed here
-- (grep of every .insert/.update/.upsert in src/ and supabase/functions/,
-- docs/handoff/security.md); the edge functions write with the service role.
--
-- A. Protected profile columns
--    A1. Trigger profiles_protect_columns (BEFORE INSERT OR UPDATE on
--        isexy.profiles): when current_user is authenticated or anon (direct
--        PostgREST writes; SECURITY DEFINER RPCs run as their owner, the
--        service role and migrations are not checked) and the caller is not
--        staff (admin or moderator), a change of a protected column is
--        refused with 42501; on INSERT the column must keep its default.
--        Protected: is_premium, subscription_tier, subscription_expires_at,
--        is_verified, shadow_banned, shadow_banned_at, shadow_banned_reason,
--        likes_remaining, super_likes_remaining, boosts_remaining,
--        last_boost_at, super_boost_until, daily_swipe_count,
--        last_swipe_reset_at, swipe_cooldown_until, first_purchase_promo_used,
--        promo_expires_at, is_cuban, referral_code, user_id, id, created_at,
--        and is_active (audit: staff use it to ban; a banned member could
--        switch it back). Plans, limits and flags change only through the
--        RPCs (refresh_member_plan, perform_like, use_boost, get_my_referral_code,
--        staff_set_profile_verified, review_photo_verification...). The Cuban
--        signup (on hold, unchanged) sets is_cuban through set_my_cuban_flag
--        (0004 R11). If a later migration changes one of these defaults,
--        change profiles_protect_columns too (0005-smoke checks they agree).
--
-- B. Member write policies closed (SELECT policies kept)
--    B1. Dropped (RPCs / service-role functions write these): credit_transactions
--        "Users can insert own transactions"; boost_transactions "Users can
--        insert own boost transactions"; boost_wallets "Users can insert own
--        boost wallet" + "Users can update own boost wallet"; allowances
--        "Users can insert own allowances" + "Users can update own allowances";
--        star_transactions "Users can send stars"; gift_transactions "Users
--        can create gift transactions"; coupon_redemptions "Users can redeem
--        coupons"; missed_calls "Authenticated users can insert missed calls"
--        (any member, for anyone; record_missed_call and the missed-call
--        function insert); messages "Users can update message read status"
--        (any column of any message in the member's matches; chat uses
--        mark_messages_read). user_credits "Users can update own credits" was
--        already dropped in 0001.
--    B2. Same class, found by the audit:
--        - matches "Users can update own matches" dropped: a member could
--          swap the other participant (then message or call anyone) or
--          re-activate a match. No client UPDATEs matches.
--        - swipes "Users can create swipes" dropped: direct inserts skipped
--          perform_like (daily likes, Super Like allowance, rate limit) and
--          still made matches. Likes go through perform_like (undo keeps the
--          DELETE of the member's own swipe).
--        - referrals "Users can create referrals" dropped: a member could
--          insert "completed" referrals for anyone (200 loyalty points each,
--          loyalty_sync); apply_referral_code inserts them.
--        - star_cashout_requests "Cuban users can request cashout" dropped:
--          any usd_amount, no balance check; request_star_cashout (0004 R11)
--          is the only path (Cuba on hold: bug fix only).
--        - message_translations "Users can insert translations for their
--          messages" dropped: a member could plant a "translation" of their
--          own message (skipping message moderation) or of the other
--          member's; isexy-translate-message writes the cache (service role).
--        - content_violations INSERT: own profile only (was: anyone could
--          file "detected violations" against any member).
--        - forum_posts / forum_replies INSERT: author_id must be the member's
--          own profile (was: post as anyone); members cannot pin posts.
--        - scheduled_calls INSERT: only for an active match between the
--          scheduler and the recipient, starting "pending"; trigger
--          scheduled_calls_member_guard keeps match/scheduler/recipient fixed
--          on UPDATE (a participant could move the call to a stranger).
--        - double_date_pairs: trigger double_date_pairs_member_guard
--          (invitations start "pending", only the invitee accepts or
--          declines, either member ends, the pair cannot be changed).
--        - cuban_verifications INSERT must be "pending" with no reviewer
--          fields (a member could file an "approved" request; on hold: bug
--          fix only, the signup sends none of these columns).
--        - storage "isexy: Authenticated users can upload profile photos":
--          own folder only (was: any path in the bucket).
--    B3. Functions:
--        - get_admin_users(): staff only (anyone, anon too, could list every
--          admin/moderator with name and ids); EXECUTE authenticated.
--        - purge_old_telemetry(), cleanup_expired_otps(): service_role only
--          (anyone could run the deletes); calculate_profile_score(uuid):
--          service_role only (unused; revealed any member's plan/boost).
--        - deduct_call_minute, mark_voice_reply_read: no PUBLIC/anon EXECUTE;
--          assert_profile_owner, analytics_overview: no anon EXECUTE (they
--          refuse anon anyway). Every SECURITY DEFINER function already pins
--          search_path (checked); the rest are member RPCs that check
--          auth.uid(), anon RPCs by design (verify_otp, kb_record_view,
--          kb_record_feedback, track_events, report_client_error), has_role
--          (policies need it) or trigger functions (not callable directly).
--    B4. Grants: TRUNCATE (bypasses RLS), TRIGGER and REFERENCES revoked from
--        anon/authenticated on every isexy table, UPDATE (setval) on every
--        isexy sequence; same for future objects (schema default privileges).
--
-- C. Performance
--    C1. Covering indexes for the 51 unindexed foreign keys (generated from
--        pg_constraint/pg_index on a 0001-0004 copy; FKs covered by a partial
--        "col IS NOT NULL" unique index left alone).
--    C2. Every isexy policy (and every "isexy: " storage policy) calling
--        auth.uid() / auth.jwt() / auth.role() per row now calls
--        (select auth.uid()) etc. (evaluated once per statement), via ALTER
--        POLICY with the current expression text, so the logic is identical
--        and later edits are never reverted. Re-running finds nothing to do.
--    C3. isexy.normalize_gender(text) gets SET search_path = isexy, extensions.
--    C4. swipes_swiper_idx (swiper_id) dropped: a plain index, duplicated by
--        the leading column of UNIQUE (swiper_id, swiped_id). The identical
--        UNIQUE pairs on matches (matches_profile1_id_profile2_id_key /
--        matches_pair_unique) and swipes (swipes_swiper_id_swiped_id_key /
--        swipes_swiper_swiped_unique) both back constraints: kept.

-- =====================================================================
-- A1. Protected profile columns
-- =====================================================================
CREATE OR REPLACE FUNCTION isexy.profiles_protect_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = isexy, extensions
AS $$
DECLARE
  c_cols CONSTANT text[] := ARRAY[
    'is_premium', 'subscription_tier', 'subscription_expires_at', 'is_verified',
    'shadow_banned', 'shadow_banned_at', 'shadow_banned_reason',
    'likes_remaining', 'super_likes_remaining', 'boosts_remaining', 'last_boost_at',
    'super_boost_until', 'daily_swipe_count', 'last_swipe_reset_at', 'swipe_cooldown_until',
    'first_purchase_promo_used', 'promo_expires_at', 'is_cuban', 'referral_code',
    'user_id', 'id', 'created_at', 'is_active'];
  v_uid uuid;
  v_new jsonb;
  v_ref jsonb;
  v_bad text[];
BEGIN
  -- Direct client writes only. SECURITY DEFINER functions run as their owner,
  -- so the RPCs (and the service role, and migrations) are not checked here.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  v_uid := auth.uid();
  v_new := to_jsonb(NEW);
  IF TG_OP = 'UPDATE' THEN
    v_ref := to_jsonb(OLD);
  ELSE
    -- Column defaults (0001); profiles_id_from_user has already set id = user_id.
    v_ref := jsonb_build_object(
      'is_premium', false,
      'subscription_tier', 'free',
      'subscription_expires_at', NULL::timestamptz,
      'is_verified', false,
      'shadow_banned', false,
      'shadow_banned_at', NULL::timestamptz,
      'shadow_banned_reason', NULL::text,
      'likes_remaining', 100,
      'super_likes_remaining', 1,
      'boosts_remaining', 0,
      'last_boost_at', NULL::timestamptz,
      'super_boost_until', NULL::timestamptz,
      'daily_swipe_count', 0,
      'last_swipe_reset_at', now(),
      'swipe_cooldown_until', NULL::timestamptz,
      'first_purchase_promo_used', false,
      'promo_expires_at', NULL::timestamptz,
      'is_cuban', false,
      'referral_code', NULL::text,
      'user_id', v_uid,
      'id', v_uid,
      'created_at', now(),
      'is_active', true);
  END IF;

  SELECT array_agg(c ORDER BY c) INTO v_bad
    FROM unnest(c_cols) AS c
   WHERE (v_new -> c) IS DISTINCT FROM (v_ref -> c);

  IF v_bad IS NULL THEN
    RETURN NEW;
  END IF;
  IF v_uid IS NOT NULL AND (isexy.has_role(v_uid, 'admin'::isexy.app_role)
                            OR isexy.has_role(v_uid, 'moderator'::isexy.app_role)) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'profiles: % cannot be set by the member', array_to_string(v_bad, ', ')
    USING ERRCODE = '42501',
          HINT = 'Plans, limits, flags and ids change only through the ISEXY RPCs and functions.';
END;
$$;
REVOKE ALL ON FUNCTION isexy.profiles_protect_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_protect_columns ON isexy.profiles;
-- Name sorts after profiles_id_from_user (BEFORE triggers fire by name), so on
-- INSERT it sees the final id.
CREATE TRIGGER profiles_protect_columns
  BEFORE INSERT OR UPDATE ON isexy.profiles
  FOR EACH ROW EXECUTE FUNCTION isexy.profiles_protect_columns();

-- =====================================================================
-- B1. Member INSERT/UPDATE policies on the money, ledger and call tables
-- =====================================================================
DROP POLICY IF EXISTS "Users can insert own transactions" ON isexy.credit_transactions;
DROP POLICY IF EXISTS "Users can insert own boost transactions" ON isexy.boost_transactions;
DROP POLICY IF EXISTS "Users can insert own boost wallet" ON isexy.boost_wallets;
DROP POLICY IF EXISTS "Users can update own boost wallet" ON isexy.boost_wallets;
DROP POLICY IF EXISTS "Users can insert own allowances" ON isexy.allowances;
DROP POLICY IF EXISTS "Users can update own allowances" ON isexy.allowances;
DROP POLICY IF EXISTS "Users can send stars" ON isexy.star_transactions;
DROP POLICY IF EXISTS "Users can create gift transactions" ON isexy.gift_transactions;
DROP POLICY IF EXISTS "Users can redeem coupons" ON isexy.coupon_redemptions;
DROP POLICY IF EXISTS "Authenticated users can insert missed calls" ON isexy.missed_calls;
DROP POLICY IF EXISTS "Users can update message read status" ON isexy.messages;

-- =====================================================================
-- B2. Same class of hole, found by the audit
-- =====================================================================
DROP POLICY IF EXISTS "Users can update own matches" ON isexy.matches;
DROP POLICY IF EXISTS "Users can create swipes" ON isexy.swipes;
DROP POLICY IF EXISTS "Users can create referrals" ON isexy.referrals;
DROP POLICY IF EXISTS "Cuban users can request cashout" ON isexy.star_cashout_requests;
DROP POLICY IF EXISTS "Users can insert translations for their messages" ON isexy.message_translations;

ALTER POLICY "Authenticated users can report violations" ON isexy.content_violations
  WITH CHECK (profile_id IN (SELECT p.id FROM isexy.profiles p WHERE p.user_id = (SELECT auth.uid())));

ALTER POLICY "Authenticated users can create posts" ON isexy.forum_posts
  WITH CHECK (author_id IN (SELECT p.id FROM isexy.profiles p WHERE p.user_id = (SELECT auth.uid()))
              AND coalesce(is_pinned, false) = false);
ALTER POLICY "Users can update own posts" ON isexy.forum_posts
  WITH CHECK (author_id IN (SELECT p.id FROM isexy.profiles p WHERE p.user_id = (SELECT auth.uid()))
              AND coalesce(is_pinned, false) = false);
ALTER POLICY "Authenticated users can create replies" ON isexy.forum_replies
  WITH CHECK (author_id IN (SELECT p.id FROM isexy.profiles p WHERE p.user_id = (SELECT auth.uid())));

ALTER POLICY "Users can insert own verification" ON isexy.cuban_verifications
  WITH CHECK (profile_id IN (SELECT p.id FROM isexy.profiles p WHERE p.user_id = (SELECT auth.uid()))
              AND coalesce(verification_status, 'pending') = 'pending'
              AND verified_at IS NULL AND verified_by IS NULL AND rejection_reason IS NULL);

ALTER POLICY "Users can create scheduled calls" ON isexy.scheduled_calls
  WITH CHECK (scheduler_id IN (SELECT p.id FROM isexy.profiles p WHERE p.user_id = (SELECT auth.uid()))
              AND coalesce(status, 'pending') = 'pending'
              AND EXISTS (SELECT 1 FROM isexy.matches m
                           WHERE m.id = scheduled_calls.match_id AND m.is_active
                             AND ((m.profile1_id = scheduled_calls.scheduler_id AND m.profile2_id = scheduled_calls.recipient_id)
                               OR (m.profile2_id = scheduled_calls.scheduler_id AND m.profile1_id = scheduled_calls.recipient_id))));

CREATE OR REPLACE FUNCTION isexy.scheduled_calls_member_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = isexy, extensions
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF NEW.match_id IS DISTINCT FROM OLD.match_id
     OR NEW.scheduler_id IS DISTINCT FROM OLD.scheduler_id
     OR NEW.recipient_id IS DISTINCT FROM OLD.recipient_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'scheduled_calls: the match and the participants cannot be changed'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION isexy.scheduled_calls_member_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS scheduled_calls_member_guard ON isexy.scheduled_calls;
CREATE TRIGGER scheduled_calls_member_guard
  BEFORE UPDATE ON isexy.scheduled_calls
  FOR EACH ROW EXECUTE FUNCTION isexy.scheduled_calls_member_guard();

CREATE OR REPLACE FUNCTION isexy.double_date_pairs_member_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = isexy, extensions
AS $$
DECLARE
  v_me uuid;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'pending' OR NEW.accepted_at IS NOT NULL THEN
      RAISE EXCEPTION 'double_date_pairs: an invitation starts pending' USING ERRCODE = '42501';
    END IF;
    IF NEW.user1_id = NEW.user2_id THEN
      RAISE EXCEPTION 'double_date_pairs: cannot pair with yourself' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.user1_id IS DISTINCT FROM OLD.user1_id
     OR NEW.user2_id IS DISTINCT FROM OLD.user2_id
     OR NEW.invited_at IS DISTINCT FROM OLD.invited_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'double_date_pairs: the pair cannot be changed' USING ERRCODE = '42501';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT id INTO v_me FROM isexy.profiles WHERE user_id = auth.uid();
    IF NEW.status IN ('active', 'declined') THEN
      -- Only the invitee answers, and only a pending invitation.
      IF OLD.status <> 'pending' OR v_me IS DISTINCT FROM OLD.user2_id THEN
        RAISE EXCEPTION 'double_date_pairs: only the invited member can answer' USING ERRCODE = '42501';
      END IF;
    ELSIF NEW.status <> 'ended' THEN
      RAISE EXCEPTION 'double_date_pairs: invalid status change' USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.accepted_at IS DISTINCT FROM OLD.accepted_at THEN
    RAISE EXCEPTION 'double_date_pairs: accepted_at follows the answer' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION isexy.double_date_pairs_member_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS double_date_pairs_member_guard ON isexy.double_date_pairs;
CREATE TRIGGER double_date_pairs_member_guard
  BEFORE INSERT OR UPDATE ON isexy.double_date_pairs
  FOR EACH ROW EXECUTE FUNCTION isexy.double_date_pairs_member_guard();

ALTER POLICY "isexy: Authenticated users can upload profile photos" ON storage.objects
  WITH CHECK (bucket_id = 'isexy-profile-photos'
              AND ((SELECT auth.uid()))::text = (storage.foldername(name))[1]);

-- =====================================================================
-- B3. Functions
-- =====================================================================
CREATE OR REPLACE FUNCTION isexy.get_admin_users()
RETURNS TABLE(user_id uuid, role isexy.app_role, first_name text, profile_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
  SELECT ur.user_id, ur.role, p.first_name, p.id AS profile_id
    FROM isexy.user_roles ur
    LEFT JOIN isexy.profiles p ON p.user_id = ur.user_id
   WHERE ur.role IN ('admin', 'moderator')
     AND (isexy.has_role(auth.uid(), 'admin'::isexy.app_role)
          OR isexy.has_role(auth.uid(), 'moderator'::isexy.app_role));
$$;
REVOKE ALL ON FUNCTION isexy.get_admin_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.get_admin_users() TO authenticated, service_role;

REVOKE ALL ON FUNCTION isexy.purge_old_telemetry() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION isexy.purge_old_telemetry() TO service_role;
REVOKE ALL ON FUNCTION isexy.cleanup_expired_otps() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION isexy.cleanup_expired_otps() TO service_role;
REVOKE ALL ON FUNCTION isexy.calculate_profile_score(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION isexy.calculate_profile_score(uuid) TO service_role;

REVOKE ALL ON FUNCTION isexy.deduct_call_minute(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.deduct_call_minute(uuid, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION isexy.mark_voice_reply_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.mark_voice_reply_read(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION isexy.assert_profile_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.assert_profile_owner(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION isexy.analytics_overview(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.analytics_overview(integer) TO authenticated, service_role;

-- =====================================================================
-- B4. Grants PostgREST does not need
-- =====================================================================
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA isexy FROM anon, authenticated;
REVOKE UPDATE ON ALL SEQUENCES IN SCHEMA isexy FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA isexy REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA isexy REVOKE UPDATE ON SEQUENCES FROM anon, authenticated;

-- =====================================================================
-- C1. Covering indexes for unindexed foreign keys
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_blocks_blocked_id ON isexy.blocks (blocked_id);
CREATE INDEX IF NOT EXISTS idx_boost_transactions_profile_id ON isexy.boost_transactions (profile_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_conversations_transferred_to ON isexy.chatbot_conversations (transferred_to);
CREATE INDEX IF NOT EXISTS idx_chatbot_conversations_user_id ON isexy.chatbot_conversations (user_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_messages_conversation_id ON isexy.chatbot_messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_content_violations_message_id ON isexy.content_violations (message_id);
CREATE INDEX IF NOT EXISTS idx_content_violations_profile_id ON isexy.content_violations (profile_id);
CREATE INDEX IF NOT EXISTS idx_conversation_unlocks_unlocked_by ON isexy.conversation_unlocks (unlocked_by);
CREATE INDEX IF NOT EXISTS idx_coupon_codes_created_by ON isexy.coupon_codes (created_by);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_profile_id ON isexy.coupon_redemptions (profile_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_profile_id ON isexy.credit_transactions (profile_id);
CREATE INDEX IF NOT EXISTS idx_cuban_verifications_profile_id ON isexy.cuban_verifications (profile_id);
CREATE INDEX IF NOT EXISTS idx_donations_donor_profile_id ON isexy.donations (donor_profile_id);
CREATE INDEX IF NOT EXISTS idx_donations_recipient_profile_id ON isexy.donations (recipient_profile_id);
CREATE INDEX IF NOT EXISTS idx_double_date_matches_pair2_id ON isexy.double_date_matches (pair2_id);
CREATE INDEX IF NOT EXISTS idx_double_date_pairs_user2_id ON isexy.double_date_pairs (user2_id);
CREATE INDEX IF NOT EXISTS idx_double_date_swipes_swiped_pair_id ON isexy.double_date_swipes (swiped_pair_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_author_id ON isexy.forum_posts (author_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_category_id ON isexy.forum_posts (category_id);
CREATE INDEX IF NOT EXISTS idx_forum_replies_author_id ON isexy.forum_replies (author_id);
CREATE INDEX IF NOT EXISTS idx_forum_replies_post_id ON isexy.forum_replies (post_id);
CREATE INDEX IF NOT EXISTS idx_gift_transactions_gift_package_id ON isexy.gift_transactions (gift_package_id);
CREATE INDEX IF NOT EXISTS idx_gift_transactions_receiver_profile_id ON isexy.gift_transactions (receiver_profile_id);
CREATE INDEX IF NOT EXISTS idx_gift_transactions_sender_profile_id ON isexy.gift_transactions (sender_profile_id);
CREATE INDEX IF NOT EXISTS idx_group_chat_members_profile_id ON isexy.group_chat_members (profile_id);
CREATE INDEX IF NOT EXISTS idx_group_chats_double_date_match_id ON isexy.group_chats (double_date_match_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_group_chat_id ON isexy.group_messages (group_chat_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_sender_id ON isexy.group_messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_live_chat_messages_session_id ON isexy.live_chat_messages (session_id);
CREATE INDEX IF NOT EXISTS idx_live_chat_sessions_chatbot_conversation_id ON isexy.live_chat_sessions (chatbot_conversation_id);
CREATE INDEX IF NOT EXISTS idx_live_chat_sessions_ticket_id ON isexy.live_chat_sessions (ticket_id);
CREATE INDEX IF NOT EXISTS idx_matches_profile2_id ON isexy.matches (profile2_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON isexy.messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_missed_calls_caller_id ON isexy.missed_calls (caller_id);
CREATE INDEX IF NOT EXISTS idx_missed_calls_match_id ON isexy.missed_calls (match_id);
CREATE INDEX IF NOT EXISTS idx_missed_calls_receiver_id ON isexy.missed_calls (receiver_id);
CREATE INDEX IF NOT EXISTS idx_phone_line_voice_replies_greeting_id ON isexy.phone_line_voice_replies (greeting_id);
CREATE INDEX IF NOT EXISTS idx_reports_reported_id ON isexy.reports (reported_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON isexy.reports (reporter_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_calls_match_id ON isexy.scheduled_calls (match_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_calls_recipient_id ON isexy.scheduled_calls (recipient_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_calls_scheduler_id ON isexy.scheduled_calls (scheduler_id);
CREATE INDEX IF NOT EXISTS idx_star_cashout_requests_profile_id ON isexy.star_cashout_requests (profile_id);
CREATE INDEX IF NOT EXISTS idx_star_transactions_receiver_profile_id ON isexy.star_transactions (receiver_profile_id);
CREATE INDEX IF NOT EXISTS idx_star_transactions_sender_profile_id ON isexy.star_transactions (sender_profile_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to ON isexy.support_tickets (assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON isexy.support_tickets (user_id);
CREATE INDEX IF NOT EXISTS idx_user_warnings_issued_by ON isexy.user_warnings (issued_by);
CREATE INDEX IF NOT EXISTS idx_user_warnings_profile_id ON isexy.user_warnings (profile_id);
CREATE INDEX IF NOT EXISTS idx_video_call_sessions_match_id ON isexy.video_call_sessions (match_id);
CREATE INDEX IF NOT EXISTS idx_voice_greetings_profile_id ON isexy.voice_greetings (profile_id);

-- =====================================================================
-- C2. auth.uid() / auth.jwt() / auth.role() once per statement in RLS
-- =====================================================================
-- pg_get_expr prints the stored expression with every name schema-qualified
-- (search_path = pg_catalog here); calls already wrapped print as
-- "( SELECT auth.uid() AS uid)" and are skipped by the look-behind.
DO $c2$
DECLARE
  v_path text := current_setting('search_path');
  v_pat CONSTANT text := '(?<!SELECT )auth\.(uid|jwt|role)\(\)';
  r record;
  v_qual text;
  v_check text;
  v_sql text;
  v_n integer := 0;
BEGIN
  PERFORM set_config('search_path', 'pg_catalog', true);
  FOR r IN
    SELECT pol.polname, n.nspname, c.relname,
           pg_get_expr(pol.polqual, pol.polrelid) AS qual,
           pg_get_expr(pol.polwithcheck, pol.polrelid) AS wcheck
      FROM pg_policy pol
      JOIN pg_class c ON c.oid = pol.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'isexy'
        OR (n.nspname = 'storage' AND pol.polname LIKE 'isexy: %')
     ORDER BY n.nspname, c.relname, pol.polname
  LOOP
    v_qual := regexp_replace(r.qual, v_pat, '( SELECT auth.\1() AS \1)', 'g');
    v_check := regexp_replace(r.wcheck, v_pat, '( SELECT auth.\1() AS \1)', 'g');
    IF v_qual IS NOT DISTINCT FROM r.qual AND v_check IS NOT DISTINCT FROM r.wcheck THEN
      CONTINUE;
    END IF;
    v_sql := format('ALTER POLICY %I ON %I.%I', r.polname, r.nspname, r.relname);
    IF v_qual IS DISTINCT FROM r.qual THEN
      v_sql := v_sql || format(' USING (%s)', v_qual);
    END IF;
    IF v_check IS DISTINCT FROM r.wcheck THEN
      v_sql := v_sql || format(' WITH CHECK (%s)', v_check);
    END IF;
    EXECUTE v_sql;
    v_n := v_n + 1;
  END LOOP;
  PERFORM set_config('search_path', v_path, true);
  RAISE NOTICE 'C2: % policies now evaluate auth.*() once per statement', v_n;
END
$c2$;

-- =====================================================================
-- C3. Fixed search_path
-- =====================================================================
ALTER FUNCTION isexy.normalize_gender(text) SET search_path = isexy, extensions;

-- =====================================================================
-- C4. Redundant plain index on swipes
-- =====================================================================
DROP INDEX IF EXISTS isexy.swipes_swiper_idx;
