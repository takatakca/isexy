-- Add storage policies for cuban-verifications bucket so authenticated users can upload
CREATE POLICY "Authenticated users can upload cuban verification files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'cuban-verifications' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Authenticated users can view their own verification files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'cuban-verifications' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Authenticated users can update their own verification files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'cuban-verifications' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Also allow admins to view all verification files
CREATE POLICY "Admins can view all cuban verification files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'cuban-verifications'
  AND public.has_role(auth.uid(), 'admin')
);