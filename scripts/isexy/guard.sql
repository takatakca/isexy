-- Fingerprint of everything ISEXY must never change on TAKATAK V1:
-- V1's public schema (tables, columns, functions, types, grants, policies,
-- triggers), auth triggers/policies, non-ISEXY storage buckets and storage
-- policies, and the non-isexy part of the realtime publication.
SELECT md5(coalesce(string_agg(x, E'\n' ORDER BY x), '')) AS fingerprint FROM (
  SELECT 'rel ' || c.relname || ' ' || c.relkind::text || ' ' || coalesce(c.relacl::text, '') || ' rls=' || c.relrowsecurity::text
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public'
  UNION ALL
  SELECT 'col ' || a.attrelid::regclass || '.' || a.attname || ' ' || format_type(a.atttypid, a.atttypmod) || ' nn=' || a.attnotnull::text
    FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND a.attnum > 0 AND NOT a.attisdropped
  UNION ALL
  SELECT 'fn ' || p.oid::regprocedure || ' ' || md5(coalesce(p.prosrc, '')) || ' ' || coalesce(p.proacl::text, '')
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public'
  UNION ALL
  SELECT 'type ' || t.typname FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public'
  UNION ALL
  SELECT 'policy ' || pol.polrelid::regclass || ' ' || pol.polname || ' ' || md5(coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') || coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), ''))
    FROM pg_policy pol JOIN pg_class c ON c.oid = pol.polrelid JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname IN ('public', 'auth', 'realtime') OR (n.nspname = 'storage' AND pol.polname NOT LIKE 'isexy: %')
  UNION ALL
  SELECT 'trigger ' || t.tgrelid::regclass || ' ' || t.tgname
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE NOT t.tgisinternal AND n.nspname IN ('public', 'auth', 'storage')
  UNION ALL
  SELECT 'pub ' || schemaname || '.' || tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname <> 'isexy'
  UNION ALL
  SELECT 'schema ' || nspname || ' ' || coalesce(nspacl::text, '') FROM pg_namespace WHERE nspname IN ('public', 'auth', 'storage')
) s(x);
