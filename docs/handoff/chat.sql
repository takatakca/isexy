-- FOLDED INTO supabase/isexy-migrations/0013_app_completion.sql (part C). Kept as the branch notes; do not apply this file.
-- ISEXY chat, messages and notifications (branch wf/chat).
-- Not a migration file: the integrator folds this into the next isexy migration.
-- Idempotent, isexy schema only, no data is deleted. Safe to run more than once.

SET search_path = isexy, extensions;

-- ---------------------------------------------------------------------------
-- 1. Read state without a direct UPDATE on messages.
--    "Users can update message read status" lets a member UPDATE any column of
--    any message in their matches (even the other person's text). The client
--    now calls this RPC instead; it only flips is_read, only on messages the
--    other person sent to the caller. Once this is live the security pass can
--    drop that UPDATE policy (no client code updates isexy.messages any more).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION isexy.mark_messages_read(p_match_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_me uuid;
  v_count integer;
BEGIN
  SELECT p.id INTO v_me FROM isexy.profiles p WHERE p.user_id = auth.uid();
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM isexy.matches m
    WHERE m.id = p_match_id AND (m.profile1_id = v_me OR m.profile2_id = v_me)
  ) THEN
    RAISE EXCEPTION 'Not part of this conversation' USING ERRCODE = '42501';
  END IF;

  UPDATE isexy.messages
     SET is_read = true
   WHERE match_id = p_match_id
     AND sender_id <> v_me
     AND is_read = false;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION isexy.mark_messages_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.mark_messages_read(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. matches.last_message_at follows new messages server-side, so the chat no
--    longer UPDATEs isexy.matches from the browser after every send.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION isexy.touch_match_last_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
BEGIN
  UPDATE isexy.matches
     SET last_message_at = NEW.created_at
   WHERE id = NEW.match_id
     AND (last_message_at IS NULL OR last_message_at < NEW.created_at);
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION isexy.touch_match_last_message() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS messages_touch_match ON isexy.messages;
CREATE TRIGGER messages_touch_match
  AFTER INSERT ON isexy.messages
  FOR EACH ROW EXECUTE FUNCTION isexy.touch_match_last_message();

-- ---------------------------------------------------------------------------
-- 3. Bottom-nav badges in one call: unread messages (same rules as the inbox:
--    active matches, no blocks) and likes received that the member has not
--    answered yet. Members cannot read swipes made on them (RLS), so the
--    Likes badge needs this SECURITY DEFINER count.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION isexy.get_my_badge_counts()
RETURNS TABLE (unread_messages integer, new_likes integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
  WITH me AS (
    SELECT p.id FROM isexy.profiles p WHERE p.user_id = auth.uid() LIMIT 1
  ),
  blocked AS (
    SELECT CASE WHEN b.blocker_id = me.id THEN b.blocked_id ELSE b.blocker_id END AS other_id
    FROM isexy.blocks b, me
    WHERE b.blocker_id = me.id OR b.blocked_id = me.id
  )
  SELECT
    (SELECT count(*)::int
       FROM isexy.matches m
       JOIN isexy.messages msg ON msg.match_id = m.id
      WHERE m.is_active = true
        AND (m.profile1_id = me.id OR m.profile2_id = me.id)
        AND msg.sender_id <> me.id
        AND msg.is_read = false
        AND msg.sender_id NOT IN (SELECT other_id FROM blocked)),
    (SELECT count(*)::int
       FROM isexy.swipes s
       JOIN isexy.profiles liker ON liker.id = s.swiper_id AND liker.is_active = true
      WHERE s.swiped_id = me.id
        AND s.action IN ('like', 'super_like')
        AND NOT EXISTS (
          SELECT 1 FROM isexy.swipes mine
          WHERE mine.swiper_id = me.id AND mine.swiped_id = s.swiper_id
        )
        AND s.swiper_id NOT IN (SELECT other_id FROM blocked))
  FROM me;
$$;

REVOKE ALL ON FUNCTION isexy.get_my_badge_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.get_my_badge_counts() TO authenticated;

CREATE INDEX IF NOT EXISTS swipes_swiped_idx ON isexy.swipes (swiped_id);

-- ---------------------------------------------------------------------------
-- 4. Group chat RLS. The SELECT policy on group_chat_members queried
--    group_chat_members itself, so every group query failed with
--    "infinite recursion detected in policy". A SECURITY DEFINER membership
--    check replaces the self-reference. Sending also checks the sender is the
--    caller (before, any member could post as another member).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION isexy.is_group_chat_member(p_group_chat_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM isexy.group_chat_members gcm
    JOIN isexy.profiles p ON p.id = gcm.profile_id
    WHERE gcm.group_chat_id = p_group_chat_id AND p.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION isexy.is_group_chat_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.is_group_chat_member(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Members can view group chats" ON isexy.group_chats;
CREATE POLICY "Members can view group chats" ON isexy.group_chats
  FOR SELECT USING (isexy.is_group_chat_member(id));

DROP POLICY IF EXISTS "Members can view group members" ON isexy.group_chat_members;
CREATE POLICY "Members can view group members" ON isexy.group_chat_members
  FOR SELECT USING (isexy.is_group_chat_member(group_chat_id));

DROP POLICY IF EXISTS "Members can view group messages" ON isexy.group_messages;
CREATE POLICY "Members can view group messages" ON isexy.group_messages
  FOR SELECT USING (isexy.is_group_chat_member(group_chat_id));

DROP POLICY IF EXISTS "Members can send group messages" ON isexy.group_messages;
CREATE POLICY "Members can send group messages" ON isexy.group_messages
  FOR INSERT WITH CHECK (
    isexy.is_group_chat_member(group_chat_id)
    AND sender_id IN (SELECT p.id FROM isexy.profiles p WHERE p.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 5. Translation cache lookups (isexy-translate-message reads/writes
--    message_translations by message and target language).
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS message_translations_lookup_idx
  ON isexy.message_translations (message_id, target_language);

-- ---------------------------------------------------------------------------
-- 6. Notification preferences live with the member's other preferences, so
--    the push and email functions can honour them (the settings pages only
--    kept them in the browser, or nowhere). Shape:
--    {"email": {"new_matches": bool, "new_messages": bool, "promotions": bool},
--     "push":  {"messages": bool, "newMatches": bool, ...}}
--    user_preferences already has own-row RLS (user_id = auth.uid()).
-- ---------------------------------------------------------------------------
ALTER TABLE isexy.user_preferences
  ADD COLUMN IF NOT EXISTS notification_settings jsonb NOT NULL DEFAULT '{}'::jsonb;
