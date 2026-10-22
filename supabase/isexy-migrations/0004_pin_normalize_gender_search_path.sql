-- Pin the execution search path for the ISEXY-only immutable gender
-- normalizer. All referenced functions are PostgreSQL built-ins.
-- This changes no TAKATAK V1 public/auth objects or user data.
SET LOCAL search_path = isexy, extensions;

ALTER FUNCTION isexy.normalize_gender(text) SET search_path = '';
