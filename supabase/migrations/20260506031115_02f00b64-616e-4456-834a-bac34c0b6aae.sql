
UPDATE storage.buckets SET public = true WHERE id = 'profile-photos';
DROP POLICY IF EXISTS "Authenticated users can view profile photos" ON storage.objects;
CREATE POLICY "Anyone can view profile photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-photos');
