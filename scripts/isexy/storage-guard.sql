SELECT md5(coalesce(string_agg(id || ' ' || public::text, ',' ORDER BY id), '')) FROM storage.buckets WHERE id NOT LIKE 'isexy-%';
