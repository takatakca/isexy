-- Security hardening + fast Discover feed.
--
-- 1. Several SECURITY DEFINER functions accepted a profile id from the client
--    without checking it belongs to the caller, so any signed-in (or anonymous)
--    client could like as someone else, spend another member's likes, boosts,
--    credits or coupons. Each one is renamed to *_unchecked (not callable by
--    clients) and replaced by a same-named wrapper that verifies ownership
--    first. Business logic is untouched. Server-side callers (service role,
--    e.g. the Stripe webhook) keep working.
-- 2. get_discover_feed(): the whole Discover deck in one round trip instead of
--    3 queries + one photo query per profile.

-- Ownership guard --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_profile_owner(p_profile_id UUID)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN;
  END IF;
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_profile_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not allowed for this profile' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_profile_owner(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_profile_owner(UUID) TO authenticated, service_role;

-- Rename the original once (idempotent), revoke client access to it.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('perform_like', 'uuid, uuid, text'),
      ('check_swipe_rate_limit', 'uuid'),
      ('use_boost', 'uuid, text'),
      ('redeem_coupon', 'text, uuid'),
      ('unlock_conversation', 'uuid, uuid, text'),
      ('sync_entitlements', 'uuid')
    ) AS t(fn, args)
  LOOP
    IF to_regprocedure(format('public.%I(%s)', r.fn, r.args)) IS NOT NULL
       AND to_regprocedure(format('public.%I(%s)', r.fn || '_unchecked', r.args)) IS NULL THEN
      EXECUTE format('ALTER FUNCTION public.%I(%s) RENAME TO %I', r.fn, r.args, r.fn || '_unchecked');
    END IF;
    IF to_regprocedure(format('public.%I(%s)', r.fn || '_unchecked', r.args)) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated', r.fn || '_unchecked', r.args);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role', r.fn || '_unchecked', r.args);
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.perform_like(p_swiper_id UUID, p_swiped_id UUID, p_action TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_profile_owner(p_swiper_id);
  RETURN public.perform_like_unchecked(p_swiper_id, p_swiped_id, p_action);
END;
$$;

CREATE OR REPLACE FUNCTION public.check_swipe_rate_limit(p_profile_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_profile_owner(p_profile_id);
  RETURN public.check_swipe_rate_limit_unchecked(p_profile_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.use_boost(p_profile_id UUID, p_boost_type TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_profile_owner(p_profile_id);
  RETURN public.use_boost_unchecked(p_profile_id, p_boost_type);
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_coupon(p_code TEXT, p_profile_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_profile_owner(p_profile_id);
  RETURN public.redeem_coupon_unchecked(p_code, p_profile_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.unlock_conversation(p_profile_id UUID, p_match_id UUID, p_unlock_type TEXT DEFAULT 'chat')
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_profile_owner(p_profile_id);
  RETURN public.unlock_conversation_unchecked(p_profile_id, p_match_id, p_unlock_type);
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_entitlements(p_profile_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_profile_owner(p_profile_id);
  RETURN public.sync_entitlements_unchecked(p_profile_id);
END;
$$;

REVOKE ALL ON FUNCTION public.perform_like(UUID, UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.check_swipe_rate_limit(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.use_boost(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.redeem_coupon(TEXT, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unlock_conversation(UUID, UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sync_entitlements(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.perform_like(UUID, UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_swipe_rate_limit(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.use_boost(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.redeem_coupon(TEXT, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.unlock_conversation(UUID, UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_entitlements(UUID) TO authenticated, service_role;

-- Discover feed ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_gender(p_value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN v IN ('man', 'male', 'men', 'm') THEN 'men'
    WHEN v IN ('woman', 'female', 'women', 'w', 'f') THEN 'women'
    WHEN v IN ('nonbinary', 'non-binary', 'non binary', 'nb', 'enby') THEN 'nonbinary'
    WHEN v IN ('everyone', 'all', 'any') THEN 'everyone'
    ELSE v
  END
  FROM (SELECT lower(btrim(coalesce(p_value, ''))) AS v) s;
$$;

CREATE INDEX IF NOT EXISTS profile_photos_profile_position_idx ON public.profile_photos (profile_id, position);
CREATE INDEX IF NOT EXISTS swipes_swiper_idx ON public.swipes (swiper_id);

/**
 * The caller's Discover deck, ranked, with photos, in one call.
 * Mutual gender preferences, the caller's age range (always 18+), blocks in
 * both directions, already-swiped and shadow-banned profiles are excluded.
 * p_exclude lets the client page without re-receiving cards it already holds.
 * p_interests (optional) keeps profiles with at least one matching interest
 * (case-insensitive substring), used by Explore categories.
 */
CREATE OR REPLACE FUNCTION public.get_discover_feed(
  p_limit INTEGER DEFAULT 30,
  p_exclude UUID[] DEFAULT '{}',
  p_verified_only BOOLEAN DEFAULT false,
  p_interests TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  first_name TEXT,
  birth_date DATE,
  bio TEXT,
  city TEXT,
  job_title TEXT,
  company TEXT,
  school TEXT,
  is_verified BOOLEAN,
  interests TEXT[],
  distance_km INTEGER,
  photos TEXT[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT p.*
    FROM profiles p
    WHERE p.user_id = auth.uid()
    LIMIT 1
  ),
  window_ AS (
    SELECT
      (current_date - make_interval(years => greatest(18, coalesce(me.age_min, 18))))::date AS max_birth,
      ((current_date - make_interval(years => least(99, coalesce(me.age_max, 99)) + 1))::date + 1) AS min_birth
    FROM me
  ),
  candidates AS (
    SELECT
      c.*,
      (SELECT array_agg(ph.photo_url ORDER BY ph.position)
         FROM profile_photos ph WHERE ph.profile_id = c.id) AS photo_urls,
      CASE
        WHEN me.latitude IS NOT NULL AND c.latitude IS NOT NULL THEN
          round(6371 * 2 * asin(sqrt(
            power(sin(radians(c.latitude - me.latitude) / 2), 2) +
            cos(radians(me.latitude)) * cos(radians(c.latitude)) *
            power(sin(radians(coalesce(c.longitude, 0) - coalesce(me.longitude, 0)) / 2), 2)
          )))::int
      END AS dist
    FROM profiles c, me, window_
    WHERE c.id <> me.id
      AND c.is_active = true
      AND coalesce(c.shadow_banned, false) = false
      AND c.first_name IS NOT NULL
      AND c.birth_date BETWEEN window_.min_birth AND window_.max_birth
      AND (NOT p_verified_only OR c.is_verified = true)
      AND NOT (c.id = ANY (coalesce(p_exclude, '{}')))
      AND (
        p_interests IS NULL OR cardinality(p_interests) = 0 OR EXISTS (
          SELECT 1 FROM unnest(coalesce(c.interests, '{}')) i, unnest(p_interests) q
          WHERE lower(i) LIKE '%' || lower(q) || '%'
        )
      )
      AND NOT EXISTS (SELECT 1 FROM swipes s WHERE s.swiper_id = me.id AND s.swiped_id = c.id)
      AND NOT EXISTS (
        SELECT 1 FROM blocks b
        WHERE (b.blocker_id = me.id AND b.blocked_id = c.id)
           OR (b.blocker_id = c.id AND b.blocked_id = me.id)
      )
      -- They match what I'm looking for…
      AND EXISTS (
        SELECT 1 FROM unnest(coalesce(me.interested_in, '{}')) pref
        WHERE normalize_gender(pref) IN ('everyone', normalize_gender(c.gender))
      )
      -- …and I match what they're looking for.
      AND EXISTS (
        SELECT 1 FROM unnest(coalesce(c.interested_in, '{}')) pref
        WHERE normalize_gender(pref) IN ('everyone', normalize_gender(me.gender))
      )
  ),
  scored AS (
    SELECT
      c.*,
      (
        (coalesce(cardinality(c.photo_urls), 0) * 7
         + CASE WHEN length(coalesce(c.bio, '')) >= 10 THEN 20 ELSE 0 END
         + CASE WHEN coalesce(cardinality(c.interests), 0) >= 3 THEN 12 ELSE 0 END
         + CASE WHEN c.is_verified THEN 8 ELSE 0 END
         + CASE WHEN c.job_title IS NOT NULL AND c.job_title <> '' THEN 8 ELSE 0 END
         + CASE WHEN c.school IS NOT NULL AND c.school <> '' THEN 6 ELSE 0 END
         + CASE WHEN c.city IS NOT NULL AND c.city <> '' THEN 6 ELSE 0 END)
        * CASE c.subscription_tier WHEN 'platinum' THEN 2.0 WHEN 'gold' THEN 1.5 WHEN 'plus' THEN 1.2 ELSE 1.0 END
        * CASE
            WHEN c.super_boost_until > now() THEN 5
            WHEN c.last_boost_at > now() - interval '30 minutes' THEN 3
            ELSE 1
          END
      ) AS score
    FROM candidates c
    WHERE cardinality(c.photo_urls) > 0
  )
  SELECT
    s.id, s.first_name, s.birth_date, s.bio, s.city, s.job_title, s.company, s.school,
    coalesce(s.is_verified, false), s.interests, s.dist, s.photo_urls
  FROM scored s
  ORDER BY s.score DESC, s.dist ASC NULLS LAST, s.id
  LIMIT greatest(1, least(coalesce(p_limit, 30), 50));
$$;

REVOKE ALL ON FUNCTION public.get_discover_feed(INTEGER, UUID[], BOOLEAN, TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_discover_feed(INTEGER, UUID[], BOOLEAN, TEXT[]) TO authenticated;
