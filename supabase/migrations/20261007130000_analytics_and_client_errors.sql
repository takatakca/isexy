-- First-party product analytics + client error reporting.
--
-- Privacy (Québec Law 25 / PIPEDA): the web client only sends analytics
-- events after the visitor opts in (ConsentBanner). Events carry no free text
-- from users; props are size-capped; user_id is stamped server-side from the
-- session (never trusted from the client). Raw rows are admin-only and purged
-- after 13 months.

-- 1. Events -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id BIGSERIAL PRIMARY KEY,
  event TEXT NOT NULL,
  props JSONB NOT NULL DEFAULT '{}'::jsonb,
  path TEXT,
  referrer TEXT,
  utm JSONB,
  session_id TEXT,
  anonymous_id TEXT,
  user_id UUID,
  locale TEXT,
  device TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_events_created_idx ON public.analytics_events (created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_event_created_idx ON public.analytics_events (event, created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_user_idx ON public.analytics_events (user_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read analytics" ON public.analytics_events;
CREATE POLICY "Admins can read analytics"
  ON public.analytics_events FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.track_events(p_events JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF jsonb_typeof(p_events) <> 'array' OR jsonb_array_length(p_events) = 0 OR jsonb_array_length(p_events) > 25 THEN
    RETURN 0;
  END IF;

  INSERT INTO public.analytics_events (event, props, path, referrer, utm, session_id, anonymous_id, user_id, locale, device)
  SELECT
    e->>'event',
    CASE WHEN jsonb_typeof(e->'props') = 'object' AND pg_column_size(e->'props') <= 2048 THEN e->'props' ELSE '{}'::jsonb END,
    left(e->>'path', 300),
    left(e->>'referrer', 300),
    CASE WHEN jsonb_typeof(e->'utm') = 'object' AND pg_column_size(e->'utm') <= 1024 THEN e->'utm' ELSE NULL END,
    left(e->>'session_id', 64),
    left(e->>'anonymous_id', 64),
    auth.uid(),
    left(e->>'locale', 8),
    left(e->>'device', 16)
  FROM jsonb_array_elements(p_events) AS e
  WHERE coalesce(e->>'event', '') ~ '^[a-z][a-z0-9_]{1,39}$';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.track_events(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_events(JSONB) TO anon, authenticated;

-- Admin summary: event counts, daily sessions and the core dating funnel.
CREATE OR REPLACE FUNCTION public.analytics_overview(p_days INTEGER DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since TIMESTAMPTZ := now() - make_interval(days => greatest(1, least(p_days, 395)));
  v_result JSONB;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'since', v_since,
    'events', coalesce((
      SELECT jsonb_object_agg(event, n) FROM (
        SELECT event, count(*) AS n FROM analytics_events WHERE created_at >= v_since GROUP BY event
      ) t), '{}'::jsonb),
    'daily', coalesce((
      SELECT jsonb_agg(jsonb_build_object('day', day, 'sessions', sessions, 'users', users, 'page_views', page_views) ORDER BY day)
      FROM (
        SELECT date_trunc('day', created_at)::date AS day,
               count(DISTINCT session_id) AS sessions,
               count(DISTINCT user_id) AS users,
               count(*) FILTER (WHERE event = 'page_view') AS page_views
        FROM analytics_events WHERE created_at >= v_since
        GROUP BY 1
      ) d), '[]'::jsonb),
    'funnel', (
      SELECT jsonb_build_array(
        jsonb_build_object('step', 'visit', 'sessions', count(DISTINCT session_id) FILTER (WHERE event = 'page_view')),
        jsonb_build_object('step', 'sign_up', 'sessions', count(DISTINCT session_id) FILTER (WHERE event = 'sign_up')),
        jsonb_build_object('step', 'profile_completed', 'sessions', count(DISTINCT session_id) FILTER (WHERE event = 'profile_completed')),
        jsonb_build_object('step', 'like', 'sessions', count(DISTINCT session_id) FILTER (WHERE event IN ('like', 'super_like'))),
        jsonb_build_object('step', 'match', 'sessions', count(DISTINCT session_id) FILTER (WHERE event = 'match')),
        jsonb_build_object('step', 'message_sent', 'sessions', count(DISTINCT session_id) FILTER (WHERE event = 'message_sent')),
        jsonb_build_object('step', 'checkout_started', 'sessions', count(DISTINCT session_id) FILTER (WHERE event = 'checkout_started'))
      )
      FROM analytics_events WHERE created_at >= v_since
    ),
    'top_pages', coalesce((
      SELECT jsonb_agg(jsonb_build_object('path', path, 'views', n) ORDER BY n DESC)
      FROM (
        SELECT path, count(*) AS n FROM analytics_events
        WHERE created_at >= v_since AND event = 'page_view' AND path IS NOT NULL
        GROUP BY path ORDER BY n DESC LIMIT 10
      ) p), '[]'::jsonb),
    'sources', coalesce((
      SELECT jsonb_agg(jsonb_build_object('source', source, 'sessions', n) ORDER BY n DESC)
      FROM (
        SELECT coalesce(utm->>'utm_source', nullif(split_part(split_part(referrer, '://', 2), '/', 1), ''), 'direct') AS source,
               count(DISTINCT session_id) AS n
        FROM analytics_events
        WHERE created_at >= v_since AND event = 'page_view'
        GROUP BY 1 ORDER BY n DESC LIMIT 10
      ) s), '[]'::jsonb),
    'web_vitals', coalesce((
      SELECT jsonb_object_agg(metric, p75)
      FROM (
        SELECT props->>'metric' AS metric,
               round((percentile_cont(0.75) WITHIN GROUP (ORDER BY (props->>'value')::numeric))::numeric, 3) AS p75
        FROM analytics_events
        WHERE created_at >= v_since AND event = 'web_vital' AND (props->>'value') ~ '^[0-9.]+$'
        GROUP BY 1
      ) v), '{}'::jsonb),
    'errors', (SELECT count(*) FROM client_errors WHERE created_at >= v_since)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- 2. Client errors ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_errors (
  id BIGSERIAL PRIMARY KEY,
  message TEXT NOT NULL,
  stack TEXT,
  path TEXT,
  context JSONB,
  release TEXT,
  user_agent TEXT,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_errors_created_idx ON public.client_errors (created_at DESC);

ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read client errors" ON public.client_errors;
CREATE POLICY "Admins can read client errors"
  ON public.client_errors FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.report_client_error(
  p_message TEXT,
  p_stack TEXT DEFAULT NULL,
  p_path TEXT DEFAULT NULL,
  p_context JSONB DEFAULT NULL,
  p_release TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.client_errors (message, stack, path, context, release, user_agent, user_id)
  SELECT left(p_message, 500), left(p_stack, 4000), left(p_path, 300),
         CASE WHEN p_context IS NOT NULL AND pg_column_size(p_context) <= 2048 THEN p_context END,
         left(p_release, 40), left(p_user_agent, 300), auth.uid()
  WHERE coalesce(length(p_message), 0) > 0;
$$;

REVOKE ALL ON FUNCTION public.report_client_error(TEXT, TEXT, TEXT, JSONB, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_client_error(TEXT, TEXT, TEXT, JSONB, TEXT, TEXT) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.analytics_overview(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.analytics_overview(INTEGER) TO authenticated;

-- 3. Retention ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purge_old_telemetry()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.analytics_events WHERE created_at < now() - interval '395 days';
  DELETE FROM public.client_errors WHERE created_at < now() - interval '90 days';
$$;

REVOKE ALL ON FUNCTION public.purge_old_telemetry() FROM PUBLIC;
