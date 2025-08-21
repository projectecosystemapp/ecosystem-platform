-- Storage RLS Policies for Provider Images
-- This migration sets up Row Level Security policies for Supabase Storage buckets

-- Enable RLS on storage.objects table (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- PROVIDER-IMAGES BUCKET POLICIES
-- =============================================================================

-- Policy: Allow public read access for provider profile and cover images
CREATE POLICY "Public read access for provider images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'provider-images');

-- Policy: Allow authenticated providers to upload their own images
-- Path format: provider-images/{user_id}/profile.jpg or cover.jpg
CREATE POLICY "Providers can upload their own profile images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'provider-images' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow authenticated providers to update their own images
CREATE POLICY "Providers can update their own profile images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'provider-images' 
    AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
    bucket_id = 'provider-images' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow authenticated providers to delete their own images
CREATE POLICY "Providers can delete their own profile images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'provider-images' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- =============================================================================
-- PROVIDER-GALLERIES BUCKET POLICIES
-- =============================================================================

-- Policy: Allow public read access for provider gallery images
CREATE POLICY "Public read access for provider galleries"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'provider-galleries');

-- Policy: Allow authenticated providers to upload to their gallery
-- Path format: provider-galleries/{user_id}/image1.jpg
CREATE POLICY "Providers can upload to their gallery"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'provider-galleries' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow authenticated providers to update their gallery images
CREATE POLICY "Providers can update their gallery images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'provider-galleries' 
    AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
    bucket_id = 'provider-galleries' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow authenticated providers to delete their gallery images
CREATE POLICY "Providers can delete their gallery images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'provider-galleries' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- =============================================================================
-- TESTIMONIAL-IMAGES BUCKET POLICIES
-- =============================================================================

-- Policy: Allow public read access for testimonial images
CREATE POLICY "Public read access for testimonial images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'testimonial-images');

-- Policy: Allow authenticated users to upload testimonial images
-- Note: In production, you might want to restrict this further
CREATE POLICY "Authenticated users can upload testimonial images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'testimonial-images'
);

-- Policy: Allow users to update their own testimonial images
-- Path format: testimonial-images/{user_id}/testimonial.jpg
CREATE POLICY "Users can update their own testimonial images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'testimonial-images' 
    AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
    bucket_id = 'testimonial-images' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow users to delete their own testimonial images
CREATE POLICY "Users can delete their own testimonial images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'testimonial-images' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- =============================================================================
-- Additional security notes:
-- 1. File paths should follow the pattern: {bucket}/{user_id}/{filename}
-- 2. This ensures users can only modify their own files
-- 3. Public read access allows displaying images on provider profiles
-- 4. The storage.foldername() function extracts folder parts from the path
-- =============================================================================