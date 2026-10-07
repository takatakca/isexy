-- Inbox in one query.
-- The Matches screen used to run 5 queries per match (profile, photo, unread,
-- unlock, last message): 200 requests for 40 matches. get_my_conversations()
-- returns the whole inbox for the signed-in member in a single call.

CREATE INDEX IF NOT EXISTS messages_match_created_idx ON public.messages (match_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_unread_idx ON public.messages (match_id, sender_id) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS matches_profile1_idx ON public.matches (profile1_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS matches_profile2_idx ON public.matches (profile2_id) WHERE is_active = true;

CREATE OR REPLACE FUNCTION public.get_my_conversations()
RETURNS TABLE (
  match_id UUID,
  matched_at TIMESTAMPTZ,
  other_id UUID,
  first_name TEXT,
  photo_url TEXT,
  is_verified BOOLEAN,
  last_active_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  last_message_mine BOOLEAN,
  unread_count INTEGER,
  is_unlocked BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT id, coalesce(is_premium, false) AS premium FROM profiles WHERE user_id = auth.uid() LIMIT 1
  ),
  my_matches AS (
    SELECT m.id, m.matched_at, m.last_message_at,
           CASE WHEN m.profile1_id = me.id THEN m.profile2_id ELSE m.profile1_id END AS other_id
    FROM matches m, me
    WHERE m.is_active = true AND (m.profile1_id = me.id OR m.profile2_id = me.id)
  )
  SELECT
    mm.id,
    mm.matched_at,
    mm.other_id,
    o.first_name,
    (SELECT ph.photo_url FROM profile_photos ph WHERE ph.profile_id = mm.other_id ORDER BY ph.position LIMIT 1),
    coalesce(o.is_verified, false),
    o.last_active_at,
    coalesce(lm.created_at, mm.last_message_at),
    left(lm.content, 140),
    lm.sender_id = me.id,
    (SELECT count(*)::int FROM messages u WHERE u.match_id = mm.id AND u.sender_id <> me.id AND u.is_read = false),
    me.premium OR EXISTS (
      SELECT 1 FROM conversation_unlocks cu
      WHERE cu.match_id = mm.id AND cu.unlocked_by = me.id AND cu.unlock_type = 'chat'
    )
  FROM my_matches mm
  CROSS JOIN me
  JOIN profiles o ON o.id = mm.other_id
  LEFT JOIN LATERAL (
    SELECT msg.content, msg.created_at, msg.sender_id
    FROM messages msg WHERE msg.match_id = mm.id
    ORDER BY msg.created_at DESC LIMIT 1
  ) lm ON true
  WHERE NOT EXISTS (
    SELECT 1 FROM blocks b
    WHERE (b.blocker_id = me.id AND b.blocked_id = mm.other_id)
       OR (b.blocker_id = mm.other_id AND b.blocked_id = me.id)
  )
  ORDER BY coalesce(lm.created_at, mm.last_message_at, mm.matched_at) DESC;
$$;

REVOKE ALL ON FUNCTION public.get_my_conversations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_conversations() TO authenticated;
