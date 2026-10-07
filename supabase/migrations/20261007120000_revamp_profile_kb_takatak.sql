-- ISEXY revamp (Oct 2026)
-- 1. Profile fields edited in /edit-profile that previously had no column
--    (values were silently discarded on save).
-- 2. Knowledge base: counters that anonymous visitors can bump safely
--    (direct UPDATEs were rejected by RLS for non-admins).
-- 3. TAKATAK v1 master identity link.

-- 1. Profile fields --------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS relationship_type TEXT,
  ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS zodiac TEXT,
  ADD COLUMN IF NOT EXISTS family_plans TEXT,
  ADD COLUMN IF NOT EXISTS social_media TEXT;

-- 2. Knowledge base counters ---------------------------------------------
CREATE OR REPLACE FUNCTION public.kb_record_view(p_article_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.knowledge_base
  SET view_count = view_count + 1
  WHERE id = p_article_id AND is_published = true;
$$;

CREATE OR REPLACE FUNCTION public.kb_record_feedback(p_article_id uuid, p_helpful boolean)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.knowledge_base
  SET helpful_count = helpful_count + CASE WHEN p_helpful THEN 1 ELSE 0 END,
      not_helpful_count = not_helpful_count + CASE WHEN p_helpful THEN 0 ELSE 1 END
  WHERE id = p_article_id AND is_published = true;
$$;

REVOKE ALL ON FUNCTION public.kb_record_view(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.kb_record_feedback(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kb_record_view(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kb_record_feedback(uuid, boolean) TO anon, authenticated;

-- Full-text index so the AI assistant can ground answers in articles.
CREATE INDEX IF NOT EXISTS knowledge_base_search_idx
  ON public.knowledge_base
  USING gin (to_tsvector('simple', title || ' ' || content));

-- 3. TAKATAK master identity link ------------------------------------------
-- Written only by the takatak-bridge edge function (service role).
CREATE TABLE IF NOT EXISTS public.takatak_identity_links (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  master_identity_id UUID NOT NULL,
  phone TEXT,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.takatak_identity_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own TAKATAK link" ON public.takatak_identity_links;
CREATE POLICY "Users can view own TAKATAK link"
  ON public.takatak_identity_links FOR SELECT
  USING (user_id = auth.uid());

CREATE UNIQUE INDEX IF NOT EXISTS takatak_identity_links_master_idx
  ON public.takatak_identity_links (master_identity_id);

-- 4. AI assistant → human handoff: let agents open the bot transcript.
ALTER TABLE public.live_chat_sessions
  ADD COLUMN IF NOT EXISTS chatbot_conversation_id UUID
    REFERENCES public.chatbot_conversations(id) ON DELETE SET NULL;

-- 5. Knowledge base clean-up: early seeds stored literal "\n" sequences and
--    the old CubaDate brand. (standard_conforming_strings: '\n' is backslash-n.)
UPDATE public.knowledge_base
SET content = replace(replace(content, '\r\n', E'\n'), '\n', E'\n')
WHERE position('\n' in content) > 0;

UPDATE public.knowledge_base
SET title = regexp_replace(title, 'CubaDate', 'ISEXY', 'g'),
    content = regexp_replace(
      regexp_replace(content, 'cubadate\.com', 'isexy.ca', 'gi'),
      'CubaDate', 'ISEXY', 'g')
WHERE title ~* 'cubadate' OR content ~* 'cubadate';
