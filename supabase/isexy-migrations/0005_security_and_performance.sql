-- ISEXY security + DB performance pass (claude/zealous-brown-kv2hmx). Runs
-- after 0004_app_completion.sql; NOT applied anywhere yet (neither is 0004).
-- Closes the member write holes listed in docs/HANDOFF.md › Next pass and the
-- ones found by auditing every isexy policy, SECURITY DEFINER function and
-- grant on a local copy of the schema (0001-0004), then speeds up RLS.
-- Audit notes, generator queries and what was left alone (and why):
-- docs/handoff/security.md. Tests: scripts/isexy/test/security-smoke.sql.
--
-- isexy schema only (plus "isexy: " storage policies, which the migrate.sh
-- guard allows). Idempotent: DROP ... IF EXISTS, CREATE OR REPLACE FUNCTION,
-- DROP TRIGGER IF EXISTS before CREATE TRIGGER, CREATE INDEX IF NOT EXISTS,
-- ALTER POLICY (fails loudly if a policy was renamed meanwhile, instead of
-- silently re-creating an old version). No row is deleted or rewritten.
-- Before this file: no client code writes any table or column closed here
-- (grep of every .insert/.update/.upsert in src/ and supabase/functions/,
-- listed in docs/handoff/security.md); the edge functions write with the
-- service role, which RLS and the triggers below do not restrict.
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
--        and is_active (audit: staff set it to ban; a banned member could
--        switch it back). Plans, limits and flags change only through the
--        RPCs (refresh_member_plan, perform_like, use_boost, get_my_referral_code,
--        staff_set_profile_verified, review_photo_verification...). The Cuban
--        signup (on hold, unchanged) sets is_cuban through set_my_cuban_flag
--        (0004 R11). Every isexy function that UPDATEs profiles is SECURITY
--        DEFINER (checked), so none of them is affected. If a later migration
--        changes one of these defaults, change profiles_protect_columns too
--        (security-smoke inserts a profile with the defaults to catch it).
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
--          re-activate a match the other member closed. No client UPDATEs
--          matches.
--        - swipes "Users can create swipes" dropped: direct inserts skipped
--          perform_like (daily likes, Super Like allowance, rate limit) and
--          still made matches. Likes and passes go through perform_like (undo
--          keeps the DELETE of the member's own swipe).
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
--          file "detected violations" against any member; Chat files the
--          sender's own).
--        - forum_posts / forum_replies INSERT: author_id must be the member's
--          own profile (was: post as anyone); members cannot pin posts.
--        - scheduled_calls INSERT: only for an active match between the
--          scheduler and the recipient, starting "pending"; trigger
--          scheduled_calls_member_guard keeps match/scheduler/recipient fixed
--          on UPDATE (a participant could move the call to a stranger).
--        - double_date_pairs: trigger double_date_pairs_member_guard
--          (invitations start "pending", only the invitee accepts or
--          declines, either member ends, the pair cannot be changed; was:
--          insert an "active" pair with anyone, or swap the partner).
--        - cuban_verifications INSERT must be "pending" with no reviewer
--          fields (a member could file an "approved" request; on hold: bug
--          fix only, the signup sends none of these columns).
--        - storage "isexy: Authenticated users can upload profile photos":
--          own folder only (was: any path in the bucket, so a member could add
--          files under another member's folder).
--    B3. Functions:
--        - get_admin_users(): staff only (anyone, anon too, could list every
--          admin/moderator with name and ids); EXECUTE authenticated.
--        - purge_old_telemetry(), cleanup_expired_otps(): service_role only
--          (anyone could run the deletes); calculate_profile_score(uuid):
--          service_role only (unused; revealed any member's plan/boost).
--        - deduct_call_minute, mark_voice_reply_read: no PUBLIC/anon EXECUTE;
--          assert_profile_owner, analytics_overview: no anon EXECUTE (they
--          refuse anon anyway).
--        - SECURITY DEFINER trigger functions check_and_create_match,
--          increment_reply_count, validate_message_allowed: no EXECUTE for
--          PUBLIC/anon/authenticated (triggers do not need it; hygiene).
--        Checked and left as they are: every SECURITY DEFINER function pins
--        search_path; every other member RPC checks auth.uid() (directly or
--        through assert_profile_owner); anon RPCs by design (verify_otp,
--        kb_record_view, kb_record_feedback, track_events,
--        report_client_error) and has_role (policies evaluated for anon
--        need it); service-only RPCs are already service_role only.
--    B4. Grants: TRUNCATE (bypasses RLS), TRIGGER and REFERENCES revoked from
--        anon/authenticated on every isexy table, UPDATE (setval) on every
--        isexy sequence (USAGE keeps nextval); same for future objects
--        (schema default privileges of the migration role).
--
-- C. Performance
--    C1. Covering indexes for the 51 unindexed foreign keys (generated from
--        pg_constraint/pg_index on a 0001-0004 copy; FKs covered by a partial
--        "col IS NOT NULL" index left alone; query in docs/handoff/security.md).
--    C2. Every isexy policy (and every "isexy: " storage policy) calling
--        auth.uid() / auth.jwt() / auth.role() per row now calls
--        (select auth.uid()) etc., evaluated once per statement, and the
--        staff checks isexy.has_role(auth.uid(), '<role>') become
--        (select isexy.has_role((select auth.uid()), '<role>')): same logic,
--        once per statement. Static ALTER POLICY statements generated by
--        scripts/isexy/gen-rls-initplan.sql from pg_policies (search_path =
--        public) on 0001-0004 + parts A-B, then reviewed. A guard first checks
--        that the live policies are exactly the ones the statements were
--        generated from (fingerprint), so a policy changed meanwhile (e.g. by
--        the trust work in 0004) is never reverted: the migration stops and
--        asks to regenerate. Re-running finds nothing left to rewrite.
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

-- Trigger functions: never called directly, triggers need no EXECUTE grant.
REVOKE ALL ON FUNCTION isexy.check_and_create_match() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION isexy.increment_reply_count() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION isexy.validate_message_allowed() FROM PUBLIC, anon, authenticated;

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
-- C2. auth.uid() / auth.jwt() / auth.role() / has_role once per statement
-- =====================================================================
-- @@C2 begin@@ generated by scripts/isexy/gen-rls-initplan.sh (133 policies); do not edit by hand
DO $c2$
DECLARE
  c_expected CONSTANT text := '49e24390cdc2646c2546806ffe9c6471';
  c_count CONSTANT integer := 133;
  v_path text := current_setting('search_path');
  v_n integer;
  v_fp text;
  v_sql text;
BEGIN
  -- Guard: the policies that still call auth.*() per row, rewritten the same
  -- way as below, must be exactly the ones this block was generated from.
  PERFORM set_config('search_path', 'public', true);
  SELECT count(*), md5(coalesce(string_agg(format('%s.%s.%s|%s|%s', schemaname, tablename, policyname,
           coalesce(nq, ''), coalesce(nc, '')), E'\n' ORDER BY schemaname, tablename, policyname), ''))
    INTO v_n, v_fp
    FROM (SELECT p.schemaname, p.tablename, p.policyname, p.qual, p.with_check,
                 regexp_replace(regexp_replace(p.qual, $re$(?<!SELECT )isexy\.has_role\((auth\.uid\(\)|\( SELECT auth\.uid\(\) AS uid\)), ('[a-z_]+'::isexy\.app_role)\)$re$, $re$( SELECT isexy.has_role(( SELECT auth.uid() AS uid), \2) AS has_role)$re$, 'g'), $re$(?<!SELECT )auth\.(uid|jwt|role)\(\)$re$, $re$( SELECT auth.\1() AS \1)$re$, 'g') AS nq,
                 regexp_replace(regexp_replace(p.with_check, $re$(?<!SELECT )isexy\.has_role\((auth\.uid\(\)|\( SELECT auth\.uid\(\) AS uid\)), ('[a-z_]+'::isexy\.app_role)\)$re$, $re$( SELECT isexy.has_role(( SELECT auth.uid() AS uid), \2) AS has_role)$re$, 'g'), $re$(?<!SELECT )auth\.(uid|jwt|role)\(\)$re$, $re$( SELECT auth.\1() AS \1)$re$, 'g') AS nc
            FROM pg_policies p
           WHERE p.schemaname = 'isexy' OR (p.schemaname = 'storage' AND p.policyname LIKE 'isexy: %')) x
   WHERE nq IS DISTINCT FROM qual OR nc IS DISTINCT FROM with_check;
  IF v_n = 0 THEN
    PERFORM set_config('search_path', v_path, true);
    RAISE NOTICE 'C2: no policy left to rewrite (already applied)';
    RETURN;
  END IF;
  IF v_fp IS DISTINCT FROM c_expected THEN
    RAISE EXCEPTION 'C2: % policies call auth.*() per row, not the % this block was generated from (fingerprint % <> %)',
      v_n, c_count, v_fp, c_expected
      USING HINT = 'A policy changed after 0005 was generated: run scripts/isexy/gen-rls-initplan.sh on a throwaway 0001-0004 copy, review the diff, commit.';
  END IF;
  FOREACH v_sql IN ARRAY ARRAY[
$s$ALTER POLICY "Users can view own allowances" ON isexy.allowances
  USING ((profile_id IN ( SELECT profiles.id
   FROM isexy.profiles
  WHERE (profiles.user_id = ( SELECT auth.uid() AS uid)))))$s$,
$s$ALTER POLICY "Admins can read analytics" ON isexy.analytics_events
  USING (( SELECT isexy.has_role(( SELECT auth.uid() AS uid), 'admin'::isexy.app_role) AS has_role))$s$,
$s$ALTER POLICY "Users can manage own blocks" ON isexy.blocks
  USING ((blocker_id IN ( SELECT profiles.id
   FROM isexy.profiles
  WHERE (profiles.user_id = ( SELECT auth.uid() AS uid)))))$s$,
$s$ALTER POLICY "Users can view own boost transactions" ON isexy.boost_transactions
  USING ((profile_id IN ( SELECT profiles.id
   FROM isexy.profiles
  WHERE (profiles.user_id = ( SELECT auth.uid() AS uid)))))$s$,
$s$ALTER POLICY "Users can view own boost wallet" ON isexy.boost_wallets
  USING ((profile_id IN ( SELECT profiles.id
   FROM isexy.profiles
  WHERE (profiles.user_id = ( SELECT auth.uid() AS uid)))))$s$,
$s$ALTER POLICY "Admins can read all minute transactions" ON isexy.call_minute_transactions
  USING (( SELECT isexy.has_role(( SELECT auth.uid() AS uid), 'admin'::isexy.app_role) AS has_role))$s$,
$s$ALTER POLICY "Owners can read their minute transactions" ON isexy.call_minute_transactions
  USING ((EXISTS ( SELECT 1
   FROM isexy.profiles p
  WHERE ((p.user_id = ( SELECT auth.uid() AS uid)) AND (p.id = call_minute_transactions.profile_id)))))$s$,
$s$ALTER POLICY "Admins can read all call sessions" ON isexy.call_sessions
  USING (( SELECT isexy.has_role(( SELECT auth.uid() AS uid), 'admin'::isexy.app_role) AS has_role))$s$,
$s$ALTER POLICY "Participants can read their call sessions" ON isexy.call_sessions
  USING ((EXISTS ( SELECT 1
   FROM isexy.profiles p
  WHERE ((p.user_id = ( SELECT auth.uid() AS uid)) AND ((p.id = call_sessions.caller_profile_id) OR (p.id = call_sessions.receiver_profile_id))))))$s$,
$s$ALTER POLICY "Users can view own chat subscriptions" ON isexy.chat_subscriptions
  USING ((profile_id IN ( SELECT profiles.id
   FROM isexy.profiles
  WHERE (profiles.user_id = ( SELECT auth.uid() AS uid)))))$s$,
$s$ALTER POLICY "Users can create chatbot conversations" ON isexy.chatbot_conversations
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)))$s$,
$s$ALTER POLICY "Users can update own chatbot conversations" ON isexy.chatbot_conversations
  USING ((user_id = ( SELECT auth.uid() AS uid)))$s$,
$s$ALTER POLICY "Users can view own chatbot conversations" ON isexy.chatbot_conversations
  USING ((user_id = ( SELECT auth.uid() AS uid)))$s$,
$s$ALTER POLICY "Users can create messages in their conversations" ON isexy.chatbot_messages
  WITH CHECK ((EXISTS ( SELECT 1
   FROM isexy.chatbot_conversations
  WHERE ((chatbot_conversations.id = chatbot_messages.conversation_id) AND (chatbot_conversations.user_id = ( SELECT auth.uid() AS uid))))))$s$,
$s$ALTER POLICY "Users can view messages in their conversations" ON isexy.chatbot_messages
  USING ((EXISTS ( SELECT 1
   FROM isexy.chatbot_conversations
  WHERE ((chatbot_conversations.id = chatbot_messages.conversation_id) AND (chatbot_conversations.user_id = ( SELECT auth.uid() AS uid))))))$s$,
$s$ALTER POLICY "Admins can read client errors" ON isexy.client_errors
  USING (( SELECT isexy.has_role(( SELECT auth.uid() AS uid), 'admin'::isexy.app_role) AS has_role))$s$,
$s$ALTER POLICY "Admins can view violations" ON isexy.content_violations
  USING ((( SELECT isexy.has_role(( SELECT auth.uid() AS uid), 'admin'::isexy.app_role) AS has_role) OR ( SELECT isexy.has_role(( SELECT auth.uid() AS uid), 'moderator'::isexy.app_role) AS has_role)))$s$,
$s$ALTER POLICY "Users can view own unlocks" ON isexy.conversation_unlocks
  USING ((unlocked_by IN ( SELECT profiles.id
   FROM isexy.profiles
  WHERE (profiles.user_id = ( SELECT auth.uid() AS uid)))))$s$,
$s$ALTER POLICY "Users can view unlocks for their matches" ON isexy.conversation_unlocks
  USING ((match_id IN ( SELECT matches.id
   FROM isexy.matches
  WHERE ((matches.profile1_id IN ( SELECT profiles.id
           FROM isexy.profiles
          WHERE (profiles.user_id = ( SELECT auth.uid() AS uid)))) OR (matches.profile2_id IN ( SELECT profiles.id
           FROM isexy.profiles
          WHERE (profiles.user_id = ( SELECT auth.uid() AS uid))))))))$s$,
$s$ALTER POLICY "Admins can manage coupon codes" ON isexy.coupon_codes
  USING (( SELECT isexy.has_role(( SELECT auth.uid() AS uid), 'admin'::isexy.app_role) AS has_role))
  WITH CHECK (( SELECT isexy.has_role(( SELECT auth.uid() AS uid), 'admin'::isexy.app_role) AS has_role))$s$,
$s$ALTER POLICY "Admins can view all redemptions" ON isexy.coupon_redemptions
  USING (( SELECT isexy.has_role(( SELECT auth.uid() AS uid), 'admin'::isexy.app_role) AS has_role))$s$,
$s$ALTER POLICY "Users can view their own redemptions" ON isexy.coupon_redemptions
  USING ((profile_id IN ( SELECT profiles.id
   FROM isexy.profiles
  WHERE (profiles.user_id = ( SELECT auth.uid() AS uid)))))$s$,
$s$ALTER POLICY "Users can view own transactions" ON isexy.credit_transactions
  USING ((EXISTS ( SELECT 1
   FROM isexy.profiles p
  WHERE ((p.id = credit_transactions.profile_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))))$s$,
$s$ALTER POLICY "Admins can manage all verifications" ON isexy.cuban_verifications
  USING (( SELECT isexy.has_role(( SELECT auth.uid() AS uid), 'admin'::isexy.app_role) AS has_role))$s$,
$s$ALTER POLICY "Users can update own pending verification" ON isexy.cuban_verifications
  USING (((profile_id IN ( SELECT profiles.id
   FROM isexy.profiles
  WHERE (profiles.user_id = ( SELECT auth.uid() AS uid)))) AND (verification_status = 'pending'::text)))$s$,
$s$ALTER POLICY "Users can view own verification" ON isexy.cuban_verifications
  USING ((profile_id IN ( SELECT profiles.id
   FROM isexy.profiles
  WHERE (profiles.user_id = ( SELECT auth.uid() AS uid)))))$s$,
$s$ALTER POLICY "Admins manage donations" ON isexy.donations
  USING (( SELECT isexy.has_role(( SELECT auth.uid() AS uid), 'admin'::isexy.app_role) AS has_role))
  WITH CHECK (( SELECT isexy.has_role(( SELECT auth.uid() AS uid), 'admin'::isexy.app_role) AS has_role))$s$,
$s$ALTER POLICY "Users view own donations" ON isexy.donations
  USING (((donor_profile_id IN ( SELECT profiles.id
   FROM isexy.profiles
  WHERE (profiles.user_id = ( SELECT auth.uid() AS uid)))) OR (recipient_profile_id IN ( SELECT profiles.id
   FROM isexy.profiles
  WHERE (profiles.user_id = ( SELECT auth.uid() AS uid))))))$s$,
$s$ALTER POLICY "Users can view matches for their pairs" ON isexy.double_date_matches
  USING ((EXISTS ( SELECT 1
   FROM (isexy.double_date_pairs ddp
     JOIN isexy.profiles p ON (((p.id = ddp.user1_id) OR (p.id = ddp.user2_id))))
  WHERE ((p.user_id = ( SELECT auth.uid() AS uid)) AND ((ddp.id = double_date_matches.pair1_id) OR (ddp.id = double_date_matches.pair2_id))))))$s$,
$s$ALTER POLICY "Users can create pairs as inviter" ON isexy.double_date_pairs
  WITH CHECK ((EXISTS ( SELECT 1
   FROM isexy.profiles
  WHERE ((profiles.id = double_date_pairs.user1_id) AND (profiles.user_id = ( SELECT auth.uid() AS uid))))))$s$,
$s$ALTER POLICY "Users can update pairs they're part of" ON isexy.double_date_pairs
  USING (((EXISTS ( SELECT 1
   FROM isexy.profiles
  WHERE ((profiles.id = double_date_pairs.user1_id) AND (profiles.user_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
   FROM isexy.profiles
  WHERE ((profiles.id = double_date_pairs.user2_id) AND (profiles.user_id = ( SELECT auth.uid() AS uid)))))))$s$,
$s$ALTER POLICY "Users can view pairs they're part of" ON isexy.double_date_pairs
  USING (((EXISTS ( SELECT 1
   FROM isexy.profiles
  WHERE ((profiles.id = double_date_pairs.user1_id) AND (profiles.user_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
   FROM isexy.profiles
  WHERE ((profiles.id = double_date_pairs.user2_id) AND (profiles.user_id = ( SELECT auth.uid() AS uid)))))))$s$,
$s$ALTER POLICY "Users can create their own settings" ON isexy.double_date_settings
  WITH CHECK ((EXISTS ( SELECT 1
   FROM isexy.profiles
  WHERE ((profiles.id = double_date_settings.profile_id) AND (profiles.user_id = ( SELECT auth.uid() AS uid))))))$s$,
$s$ALTER POLICY "Users can update their own settings" ON isexy.double_date_settings
  USING ((EXISTS ( SELECT 1
   FROM isexy.profiles
  WHERE ((profiles.id = double_date_settings.profile_id) AND (profiles.user_id = ( SELECT auth.uid() AS uid))))))$s$,
$s$ALTER POLICY "Users can view their own settings" ON isexy.double_date_settings
  USING ((EXISTS ( SELECT 1
   FROM isexy.profiles
  WHERE ((profiles.id = double_date_settings.profile_id) AND (profiles.user_id = ( SELECT auth.uid() AS uid))))))$s$,
$s$ALTER POLICY "Users can create swipes for their pairs" ON isexy.double_date_swipes
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (isexy.double_date_pairs ddp
     JOIN isexy.profiles p ON (((p.id = ddp.user1_id) OR (p.id = ddp.user2_id))))
  WHERE ((p.user_id = ( SELECT auth.uid() AS uid)) AND (ddp.id = double_date_swipes.swiper_pair_id) AND (ddp.status = 'active'::text)))))$s$,
$s$ALTER POLICY "Users can view swipes for their pairs" ON isexy.double_date_swipes
  USING ((EXISTS ( SELECT 1
   FROM (isexy.double_date_pairs ddp
     JOIN isexy.profiles p ON (((p.id = ddp.user1_id) OR (p.id = ddp.user2_id))))
  WHERE ((p.user_id = ( SELECT auth.uid() AS uid)) AND (ddp.id = double_date_swipes.swiper_pair_id)))))$s$,
$s$ALTER POLICY "Admins can manage email templates" ON isexy.email_templates
  USING (( SELECT isexy.has_role(( SELECT auth.uid() AS uid), 'admin'::isexy.app_role) AS has_role))$s$,
$s$ALTER POLICY "Users can view own entitlements" ON isexy.entitlements_cache
  USING ((profile_id IN ( SELECT profiles.id
   FROM isexy.profiles
  WHERE (profiles.user_id = ( SELECT auth.uid() AS uid)))))$s$,
$s$ALTER POLICY "Admins can manage forum categories" ON isexy.forum_categories
  USING (( SELECT isexy.has_role(( SELECT auth.uid() AS uid), 'admin'::isexy.app_role) AS has_role))$s$,
$s$ALTER POLICY "Users can delete own posts" ON isexy.forum_posts
  USING (((author_id IN ( SELECT profiles.id
   FROM isexy.profiles
  WHERE (profiles.user_id = ( SELECT auth.uid() AS uid)))) OR ( SELECT isexy.has_role(( SELECT auth.uid() AS uid), 'admin'::isexy.app_role) AS has_role)))$s$,
$s$ALTER POLICY "Users can update own posts" ON isexy.forum_posts
  USING ((author_id IN ( SELECT profiles.id
   FROM isexy.profiles
  WHERE (profiles.user_id = ( SELECT auth.uid() AS uid)))))
  WITH CHECK (((author_id IN ( SELECT p.id
   FROM isexy.profiles p
  WHERE (p.user_id = ( SELECT auth.uid() AS uid)))) AND (COALESCE(is_pinned, false) = false)))$s$,
$s$ALTER POLICY "Users can delete own replies" ON isexy.forum_replies
  USING (((author_id IN ( SELECT profiles.id
   FROM isexy.profiles
  WHERE (profiles.user_id = ( SELECT auth.uid() AS uid)))) OR ( SELECT isexy.has_role(( SELECT auth.uid() AS uid), 'admin'::isexy.app_role) AS has_role)))$s$,
$s$ALTER POLICY "Users can update own replies" ON isexy.forum_replies
  USING ((author_id IN ( SELECT profiles.id
   FROM isexy.profiles
  WHERE (profiles.user_id = ( SELECT auth.uid() AS uid)))))$s$,
$s$ALTER POLICY "Users can view their gift transactions" ON isexy.gift_transactions
  USING (((( SELECT auth.uid() AS uid) IN ( SELECT profiles.user_id
   FROM isexy.profiles
  WHERE (profiles.id = gift_transactions.sender_profile_id))) OR (( SELECT auth.uid() AS uid) IN ( SELECT profiles.user_id
   FROM isexy.profiles
  WHERE (profiles.id = gift_transactions.receiver_profile_id)))))$s$,
$s$ALTER POLICY "Admins can manage knowledge base" ON isexy.knowledge_base
  USING (( SELECT isexy.has_role(( SELECT auth.uid() AS uid), 'admin'::isexy.app_role) AS has_role))$s$,
$s$ALTER POLICY "Users can insert messages in their sessions" ON isexy.live_chat_messages
  WITH CHECK ((session_id IN ( SELECT live_chat_sessions.id
   FROM isexy.live_chat_sessions
  WHERE ((live_chat_sessions.user_id = ( SELECT auth.uid() AS uid)) OR (live_chat_sessions.agent_id = ( SELECT auth.uid() AS uid))))))$s$,
$s$ALTER POLICY "Users can view messages in their sessions" ON isexy.live_chat_messages
  USING ((session_id IN ( SELECT live_chat_sessions.id
   FROM isexy.live_chat_sessions
  WHERE ((live_chat_sessions.user_id = ( SELECT auth.uid() AS uid)) OR (live_chat_sessions.agent_id = ( SELECT auth.uid() AS uid))))))$s$,
$s$ALTER POLICY "Admins can manage chat sessions" ON isexy.live_chat_sessions
  USING ((( SELECT isexy.has_role(( SELECT auth.uid() AS uid), 'admin'::isexy.app_role) AS has_role) OR (agent_id = ( SELECT auth.uid() AS uid))))$s$,
$s$ALTER POLICY "Users can create own chat sessions" ON isexy.live_chat_sessions
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)))$s$,
$s$ALTER POLICY "Users can view own chat sessions" ON isexy.live_chat_sessions
  USING ((user_id = ( SELECT auth.uid() AS uid)))$s$,
$s$ALTER POLICY "Users can view own matches" ON isexy.matches
  USING (((profile1_id IN ( SELECT profiles.id
   FROM isexy.profiles
  WHERE (profiles.user_id = ( SELECT auth.uid() AS uid)))) OR (profile2_id IN ( SELECT profiles.id
   FROM isexy.profiles
  WHERE (profiles.user_id = ( SELECT auth.uid() AS uid))))))$s$,
$s$ALTER POLICY "Users can view translations for their messages" ON isexy.message_translations
  USING ((EXISTS ( SELECT 1
   FROM ((isexy.messages m
     JOIN isexy.matches mt ON ((m.match_id = mt.id)))
     JOIN isexy.profiles p ON (((p.id = mt.profile1_id) OR (p.id = mt.profile2_id))))
  WHERE ((m.id = message_translations.message_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))))$s$,
$s$ALTER POLICY "Users can send messages in their matches" ON isexy.messages
  WITH CHECK (((sender_id IN ( SELECT profiles.id
   FROM isexy.profiles
  WHERE (profiles.user_id = ( SELECT auth.uid() AS uid)))) AND (match_id IN ( SELECT matches.id
   FROM isexy.matches
  WHERE ((matches.profile1_id IN ( SELECT profiles.id
           FROM isexy.profiles
          WHERE (profiles.user_id = ( SELECT auth.uid() AS uid)))) OR (matches.profile2_id IN ( SELECT profiles.id
           FROM isexy.profiles
          WHERE (profiles.user_id = ( SELECT auth.uid() AS uid)))))))))$s$,
$s$ALTER POLICY "Users can view messages in their matches" ON isexy.messages
  USING ((match_id IN ( SELECT matches.id
   FROM isexy.matches
  WHERE ((matches.profile1_id IN ( SELECT profiles.id
           FROM isexy.profiles
          WHERE (profiles.user_id = ( SELECT auth.uid() AS uid)))) OR (matches.profile2_id IN ( SELECT profiles.id
           FROM isexy.profiles
          WHERE (profiles.user_id = ( SELECT auth.uid() AS uid))))))))$s$,
$s$ALTER POLICY "Users can view their missed calls" ON isexy.missed_calls
  USING ((( SELECT auth.uid() AS uid) IN ( SELECT profiles.user_id
   FROM isexy.profiles
  WHERE (profiles.id = missed_calls.caller_id)
UNION
 SELECT profiles.user_id
   FROM isexy.profiles
  WHERE (profiles.id = missed_calls.receiver_id))))$s$,
$s$ALTER POLICY "Admins can read inbound call logs" ON isexy.phone_line_inbound_call_logs
  USING (( SELECT isexy.has_role(( SELECT auth.uid() AS uid), 'admin'::isexy.app_role) AS has_role))$s$,
$s$ALTER POLICY "Owner can delete own phone number" ON isexy.phone_line_numbers
  USING ((EXISTS ( SELECT 1
   FROM isexy.profiles p
  WHERE ((p.id = phone_line_numbers.profile_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))))$s$,
$s$ALTER POLICY "Owner can insert own phone number" ON isexy.phone_line_numbers
  WITH CHECK ((EXISTS ( SELECT 1
   FROM isexy.profiles p
  WHERE ((p.id = phone_line_numbers.profile_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))))$s$,
$s$ALTER POLICY "Owner can read own phone number" ON isexy.phone_line_numbers
  USING ((EXISTS ( SELECT 1
   FROM isexy.profiles p
  WHERE ((p.id = phone_line_numbers.profile_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))))$s$,
$s$ALTER POLICY "Owner can update own phone number" ON isexy.phone_line_numbers
  USING ((EXISTS ( SELECT 1
   FROM isexy.profiles p
  WHERE ((p.id = phone_line_numbers.profile_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))))$s$,
$s$ALTER POLICY "Owner can delete own phone-line profile" ON isexy.phone_line_profiles
  USING ((EXISTS ( SELECT 1
   FROM isexy.profiles p
  WHERE ((p.id = phone_line_profiles.profile_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))))$s$,
$s$ALTER POLICY "Owner can insert own phone-line profile" ON isexy.phone_line_profiles
  WITH CHECK ((EXISTS ( SELECT 1
   FROM isexy.profiles p
  WHERE ((p.id = phone_line_profiles.profile_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))))$s$,
$s$ALTER POLICY "Owner can read own phone-line profile" ON isexy.phone_line_profiles
  USING ((EXISTS ( SELECT 1
   FROM isexy.profiles p
  WHERE ((p.id = phone_line_profiles.profile_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))))$s$,
$s$ALTER POLICY "Owner can update own phone-line profile" ON isexy.phone_line_profiles
  USING ((EXISTS ( SELECT 1
   FROM isexy.profiles p
  WHERE ((p.id = phone_line_profiles.profile_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))))$s$,
$s$ALTER POLICY "Receiver can read incoming replies" ON isexy.phone_line_voice_replies
  USING ((EXISTS ( SELECT 1
   FROM isexy.profiles p
  WHERE ((p.id = phone_line_voice_replies.to_profile_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))))$s$,
$s$ALTER POLICY "Sender can delete own replies" ON isexy.phone_line_voice_replies
  USING ((EXISTS ( SELECT 1
   FROM isexy.profiles p
  WHERE ((p.id = phone_line_voice_replies.from_profile_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))))$s$,
$s$ALTER POLICY "Sender can insert own replies" ON isexy.phone_line_voice_replies
  WITH CHECK ((EXISTS ( SELECT 1
   FROM isexy.profiles p
  WHERE ((p.id = phone_line_voice_replies.from_profile_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))))$s$,
$s$ALTER POLICY "Sender can read own sent replies" ON isexy.phone_line_voice_replies
  USING ((EXISTS ( SELECT 1
   FROM isexy.profiles p
  WHERE ((p.id = phone_line_voice_replies.from_profile_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))))$s$,
$s$ALTER POLICY "Staff view photo verifications" ON isexy.photo_verifications
  USING ((( SELECT isexy.has_role(( SELECT auth.uid() AS uid), 'admin'::isexy.app_role) AS has_role) OR ( SELECT isexy.has_role(( SELECT auth.uid() AS uid), 'moderator'::isexy.app_role) AS has_role)))$s$,
$s$ALTER POLICY "Users can manage own photos" ON isexy.profile_photos
  USING ((profile_id IN ( SELECT profiles.id
   FROM isexy.profiles
  WHERE (profiles.user_id = ( SELECT auth.uid() AS uid)))))$s$,
$s$ALTER POLICY "Users can insert own profile" ON isexy.profiles
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id))$s$,
$s$ALTER POLICY "Users can update own profile" ON isexy.profiles
  USING ((( SELECT auth.uid() AS uid) = user_id))$s$,
$s$ALTER POLICY "System can manage promotions" ON isexy.promotions
  USING (( SELECT isexy.has_role(( SELECT auth.uid() AS uid), 'admin'::isexy.app_role) AS has_role))$s$,
$s$ALTER POLICY "Users can view own promotions" ON isexy.promotions
  USING ((profile_id IN ( SELECT profiles.id
   FROM isexy.profiles
  WHERE (profiles.user_id = ( SELECT auth.uid() AS uid)))))$s$,
$s$ALTER POLICY "Users can manage their own push subscriptions" ON isexy.push_subscriptions
  USING ((( SELECT auth.uid() AS uid) = user_id))$s$,
$s$ALTER POLICY "Users can view their own referrals" ON isexy.referrals
  USING ((EXISTS ( SELECT 1
   FROM isexy.profiles
  WHERE ((profiles.id = referrals.referrer_id) AND (profiles.user_id = ( SELECT auth.uid() AS uid))))))$s$,
$s$ALTER POLICY "Users can create reports" ON isexy.reports
  WITH CHECK ((reporter_id IN ( SELECT profiles.id
   FROM isexy.profiles
  WHERE (profiles.user_id = ( SELECT auth.uid() AS uid)))))$s$,
$s$ALTER POLICY "Users can view own reports" ON isexy.reports
  USING ((reporter_id IN ( SELECT profiles.id
   FROM isexy.profiles
  WHERE (profiles.user_id = ( SELECT auth.uid() AS uid)))))$s$,
$s$ALTER POLICY "Participants can update scheduled calls" ON isexy.scheduled_calls
  USING ((( SELECT auth.uid() AS uid) IN ( SELECT profiles.user_id
   FROM isexy.profiles
  WHERE (profiles.id = scheduled_calls.scheduler_id)
UNION
 SELECT profiles.user_id
   FROM isexy.profiles
  WHERE (profiles.id = scheduled_calls.recipient_id))))$s$,
$s$ALTER POLICY "Users can view their scheduled calls" ON isexy.scheduled_calls
  USING ((( SELECT auth.uid() AS uid) IN ( SELECT profiles.user_id
   FROM isexy.profiles
  WHERE (profiles.id = scheduled_calls.scheduler_id)
UNION
 SELECT profiles.user_id
   FROM isexy.profiles
  WHERE (profiles.id = scheduled_calls.recipient_id))))$s$,
$s$ALTER POLICY "Users can view their own cashout requests" ON isexy.star_cashout_requests
  USING ((( SELECT auth.uid() AS uid) IN ( SELECT profiles.user_id
   FROM isexy.profiles
  WHERE (profiles.id = star_cashout_requests.profile_id))))$s$,
$s$ALTER POLICY "Users can view their own transactions" ON isexy.star_transactions
  USING (((( SELECT auth.uid() AS uid) IN ( SELECT profiles.user_id
   FROM isexy.profiles
  WHERE (profiles.id = star_transactions.sender_profile_id))) OR (( SELECT auth.uid() AS uid) IN ( SELECT profiles.user_id
   FROM isexy.profiles
  WHERE (profiles.id = star_transactions.receiver_profile_id)))))$s$,
$s$ALTER POLICY "Users can view their own badges" ON isexy.streak_badges
  USING ((( SELECT auth.uid() AS uid) IN ( SELECT profiles.user_id
   FROM isexy.profiles
  WHERE (profiles.id = streak_badges.profile_id))))$s$,
$s$ALTER POLICY "Admins can view webhook events" ON isexy.stripe_webhook_events
  USING (( SELECT isexy.has_role(( SELECT auth.uid() AS uid), 'admin'::isexy.app_role) AS has_role))$s$,
$s$ALTER POLICY "Users can view own subscription" ON isexy.subscriptions
  USING ((profile_id IN ( SELECT profiles.id
   FROM isexy.profiles
  WHERE (profiles.user_id = ( SELECT auth.uid() AS uid)))))$s$,
$s$ALTER POLICY "Admins can update all tickets" ON isexy.support_tickets
  USING (( SELECT isexy.has_role(( SELECT auth.uid() AS uid), 'admin'::isexy.app_role) AS has_role))$s$,
$s$ALTER POLICY "Admins can view all tickets" ON isexy.support_tickets
  USING (( SELECT isexy.has_role(( SELECT auth.uid() AS uid), 'admin'::isexy.app_role) AS has_role))$s$,
$s$ALTER POLICY "Users can create tickets with proper ownership" ON isexy.support_tickets
  WITH CHECK ((((user_id IS NULL) OR (user_id = ( SELECT auth.uid() AS uid))) AND ((char_length(COALESCE(name, ''::text)) >= 1) AND (char_length(COALESCE(name, ''::text)) <= 200)) AND ((char_length(email) >= 3) AND (char_length(email) <= 320)) AND ((char_length(COALESCE(subject, ''::text)) >= 1) AND (char_length(COALESCE(subject, ''::text)) <= 300)) AND ((char_length(COALESCE(message, ''::text)) >= 1) AND (char_length(COALESCE(message, ''::text)) <= 10000))))$s$,
$s$ALTER POLICY "Users can update own tickets" ON isexy.support_tickets
  USING (((email = ( SELECT users.email
   FROM auth.users
  WHERE (users.id = ( SELECT auth.uid() AS uid)))) OR (user_id = ( SELECT auth.uid() AS uid))))$s$,
$s$ALTER POLICY "Users can view own tickets by email" ON isexy.support_tickets
  USING (((email = ( SELECT users.email
   FROM auth.users
  WHERE (users.id = ( SELECT auth.uid() AS uid)))) OR (user_id = ( SELECT auth.uid() AS uid))))$s$,
$s$ALTER POLICY "Users can delete own swipes" ON isexy.swipes
  USING ((swiper_id IN ( SELECT profiles.id
   FROM isexy.profiles
  WHERE (profiles.user_id = ( SELECT auth.uid() AS uid)))))$s$,
$s$ALTER POLICY "Users can view own swipes" ON isexy.swipes
  USING ((swiper_id IN ( SELECT profiles.id
   FROM isexy.profiles
  WHERE (profiles.user_id = ( SELECT auth.uid() AS uid)))))$s$,
$s$ALTER POLICY "Users can view own TAKATAK link" ON isexy.takatak_identity_links
  USING ((user_id = ( SELECT auth.uid() AS uid)))$s$,
$s$ALTER POLICY "Admins can manage categories" ON isexy.ticket_categories
  USING (( SELECT isexy.has_role(( SELECT auth.uid() AS uid), 'admin'::isexy.app_role) AS has_role))$s$,
$s$ALTER POLICY "Users can insert own alias" ON isexy.user_aliases
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)))$s$,
$s$ALTER POLICY "Users can update own alias" ON isexy.user_aliases
  USING ((user_id = ( SELECT auth.uid() AS uid)))$s$,
$s$ALTER POLICY "Users can view own alias" ON isexy.user_aliases
  USING ((user_id = ( SELECT auth.uid() AS uid)))$s$,
$s$ALTER POLICY "Users can view own credits" ON isexy.user_credits
  USING ((EXISTS ( SELECT 1
   FROM isexy.profiles p
  WHERE ((p.id = user_credits.profile_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))))$s$,
$s$ALTER POLICY "Users can insert their own preferences" ON isexy.user_preferences
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)))$s$,
$s$ALTER POLICY "Users can update their own preferences" ON isexy.user_preferences
  USING ((user_id = ( SELECT auth.uid() AS uid)))$s$,
$s$ALTER POLICY "Users can view their own preferences" ON isexy.user_preferences
  USING ((user_id = ( SELECT auth.uid() AS uid)))$s$,
$s$ALTER POLICY "Users can view own roles" ON isexy.user_roles
  USING ((user_id = ( SELECT auth.uid() AS uid)))$s$,
$s$ALTER POLICY "Users can view their own stars balance" ON isexy.user_stars
  USING ((( SELECT auth.uid() AS uid) IN ( SELECT profiles.user_id
   FROM isexy.profiles
  WHERE (profiles.id = user_stars.profile_id))))$s$,
$s$ALTER POLICY "Admins and moderators can insert warnings" ON isexy.user_warnings
  WITH CHECK ((( SELECT isexy.has_role(( SELECT auth.uid() AS uid), 'admin'::isexy.app_role) AS has_role) OR ( SELECT isexy.has_role(( SELECT auth.uid() AS uid), 'moderator'::isexy.app_role) AS has_role)))$s$,
$s$ALTER POLICY "Admins can update warnings" ON isexy.user_warnings
  USING ((( SELECT isexy.has_role(( SELECT auth.uid() AS uid), 'admin'::isexy.app_role) AS has_role) OR ( SELECT isexy.has_role(( SELECT auth.uid() AS uid), 'moderator'::isexy.app_role) AS has_role)))$s$,
$s$ALTER POLICY "Admins can view all warnings" ON isexy.user_warnings
  USING ((( SELECT isexy.has_role(( SELECT auth.uid() AS uid), 'admin'::isexy.app_role) AS has_role) OR ( SELECT isexy.has_role(( SELECT auth.uid() AS uid), 'moderator'::isexy.app_role) AS has_role)))$s$,
$s$ALTER POLICY "Admins can read all video call sessions" ON isexy.video_call_sessions
  USING (( SELECT isexy.has_role(( SELECT auth.uid() AS uid), 'admin'::isexy.app_role) AS has_role))$s$,
$s$ALTER POLICY "Users can view their call sessions" ON isexy.video_call_sessions
  USING (((EXISTS ( SELECT 1
   FROM isexy.profiles p
  WHERE ((p.id = video_call_sessions.caller_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
   FROM isexy.profiles p
  WHERE ((p.id = video_call_sessions.receiver_id) AND (p.user_id = ( SELECT auth.uid() AS uid)))))))$s$,
$s$ALTER POLICY "Owner can delete own greeting" ON isexy.voice_greetings
  USING ((EXISTS ( SELECT 1
   FROM isexy.profiles p
  WHERE ((p.id = voice_greetings.profile_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))))$s$,
$s$ALTER POLICY "Owner can insert greeting" ON isexy.voice_greetings
  WITH CHECK ((EXISTS ( SELECT 1
   FROM isexy.profiles p
  WHERE ((p.id = voice_greetings.profile_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))))$s$,
$s$ALTER POLICY "Owner can read own greetings" ON isexy.voice_greetings
  USING ((EXISTS ( SELECT 1
   FROM isexy.profiles p
  WHERE ((p.id = voice_greetings.profile_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))))$s$,
$s$ALTER POLICY "Owner can update own greeting" ON isexy.voice_greetings
  USING ((EXISTS ( SELECT 1
   FROM isexy.profiles p
  WHERE ((p.id = voice_greetings.profile_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))))$s$,
$s$ALTER POLICY "isexy: Admins can view all cuban verification files" ON storage.objects
  USING (((bucket_id = 'isexy-cuban-verifications'::text) AND ( SELECT isexy.has_role(( SELECT auth.uid() AS uid), 'admin'::isexy.app_role) AS has_role)))$s$,
$s$ALTER POLICY "isexy: Admins can view all verification files" ON storage.objects
  USING (((bucket_id = 'isexy-cuban-verifications'::text) AND (EXISTS ( SELECT 1
   FROM isexy.user_roles
  WHERE ((user_roles.user_id = ( SELECT auth.uid() AS uid)) AND (user_roles.role = ANY (ARRAY['admin'::isexy.app_role, 'moderator'::isexy.app_role])))))))$s$,
$s$ALTER POLICY "isexy: Authenticated users can update their own verification fi" ON storage.objects
  USING (((bucket_id = 'isexy-cuban-verifications'::text) AND ((( SELECT auth.uid() AS uid))::text = (storage.foldername(name))[1])))$s$,
$s$ALTER POLICY "isexy: Authenticated users can upload cuban verification files" ON storage.objects
  WITH CHECK (((bucket_id = 'isexy-cuban-verifications'::text) AND ((( SELECT auth.uid() AS uid))::text = (storage.foldername(name))[1])))$s$,
$s$ALTER POLICY "isexy: Authenticated users can view their own verification file" ON storage.objects
  USING (((bucket_id = 'isexy-cuban-verifications'::text) AND ((( SELECT auth.uid() AS uid))::text = (storage.foldername(name))[1])))$s$,
$s$ALTER POLICY "isexy: Sender can delete own voice reply files" ON storage.objects
  USING (((bucket_id = 'isexy-voice-replies'::text) AND ((( SELECT auth.uid() AS uid))::text = (storage.foldername(name))[1])))$s$,
$s$ALTER POLICY "isexy: Sender can read own voice reply files" ON storage.objects
  USING (((bucket_id = 'isexy-voice-replies'::text) AND ((( SELECT auth.uid() AS uid))::text = (storage.foldername(name))[1])))$s$,
$s$ALTER POLICY "isexy: Sender can update own voice reply files" ON storage.objects
  USING (((bucket_id = 'isexy-voice-replies'::text) AND ((( SELECT auth.uid() AS uid))::text = (storage.foldername(name))[1])))$s$,
$s$ALTER POLICY "isexy: Sender can upload own voice reply files" ON storage.objects
  WITH CHECK (((bucket_id = 'isexy-voice-replies'::text) AND ((( SELECT auth.uid() AS uid))::text = (storage.foldername(name))[1])))$s$,
$s$ALTER POLICY "isexy: Users can delete their own photos" ON storage.objects
  USING (((bucket_id = 'isexy-profile-photos'::text) AND ((( SELECT auth.uid() AS uid))::text = (storage.foldername(name))[1])))$s$,
$s$ALTER POLICY "isexy: Users can delete their own voice greetings" ON storage.objects
  USING (((bucket_id = 'isexy-voice-greetings'::text) AND ((( SELECT auth.uid() AS uid))::text = (storage.foldername(name))[1])))$s$,
$s$ALTER POLICY "isexy: Users can read their own voice greetings" ON storage.objects
  USING (((bucket_id = 'isexy-voice-greetings'::text) AND ((( SELECT auth.uid() AS uid))::text = (storage.foldername(name))[1])))$s$,
$s$ALTER POLICY "isexy: Users can update their own photos" ON storage.objects
  USING (((bucket_id = 'isexy-profile-photos'::text) AND ((( SELECT auth.uid() AS uid))::text = (storage.foldername(name))[1])))$s$,
$s$ALTER POLICY "isexy: Users can update their own voice greetings" ON storage.objects
  USING (((bucket_id = 'isexy-voice-greetings'::text) AND ((( SELECT auth.uid() AS uid))::text = (storage.foldername(name))[1])))$s$,
$s$ALTER POLICY "isexy: Users can upload their own verification files" ON storage.objects
  WITH CHECK (((bucket_id = 'isexy-cuban-verifications'::text) AND ((( SELECT auth.uid() AS uid))::text = (storage.foldername(name))[1])))$s$,
$s$ALTER POLICY "isexy: Users can upload their own voice greetings" ON storage.objects
  WITH CHECK (((bucket_id = 'isexy-voice-greetings'::text) AND ((( SELECT auth.uid() AS uid))::text = (storage.foldername(name))[1])))$s$,
$s$ALTER POLICY "isexy: Users can view their own verification files" ON storage.objects
  USING (((bucket_id = 'isexy-cuban-verifications'::text) AND ((( SELECT auth.uid() AS uid))::text = (storage.foldername(name))[1])))$s$,
$s$ALTER POLICY "isexy: Users read own ticket attachments" ON storage.objects
  USING (((bucket_id = 'isexy-ticket-attachments'::text) AND (((( SELECT auth.uid() AS uid))::text = (storage.foldername(name))[1]) OR ( SELECT isexy.has_role(( SELECT auth.uid() AS uid), 'admin'::isexy.app_role) AS has_role) OR ( SELECT isexy.has_role(( SELECT auth.uid() AS uid), 'moderator'::isexy.app_role) AS has_role))))$s$,
$s$ALTER POLICY "isexy: Users upload own ticket attachments" ON storage.objects
  WITH CHECK (((bucket_id = 'isexy-ticket-attachments'::text) AND ((( SELECT auth.uid() AS uid))::text = (storage.foldername(name))[1])))$s$,
$s$ALTER POLICY "isexy: members and staff view verification selfies" ON storage.objects
  USING (((bucket_id = 'isexy-photo-verifications'::text) AND (((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) OR ( SELECT isexy.has_role(( SELECT auth.uid() AS uid), 'admin'::isexy.app_role) AS has_role) OR ( SELECT isexy.has_role(( SELECT auth.uid() AS uid), 'moderator'::isexy.app_role) AS has_role))))$s$
  ] LOOP
    EXECUTE v_sql;
  END LOOP;
  PERFORM set_config('search_path', v_path, true);
  RAISE NOTICE 'C2: % policies now evaluate auth.*() and has_role once per statement', c_count;
END
$c2$;
-- @@C2 end@@

-- =====================================================================
-- C3. Fixed search_path
-- =====================================================================
ALTER FUNCTION isexy.normalize_gender(text) SET search_path = isexy, extensions;

-- =====================================================================
-- C4. Redundant plain index on swipes
-- =====================================================================
DROP INDEX IF EXISTS isexy.swipes_swiper_idx;
