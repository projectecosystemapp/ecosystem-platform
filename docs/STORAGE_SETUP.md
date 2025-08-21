# Supabase Storage Setup Guide

This guide explains how to set up and use Supabase Storage for provider images in the Ecosystem marketplace.

## Overview

The storage system is configured with three buckets:
- **provider-images**: Profile and cover images (5MB limit)
- **provider-galleries**: Portfolio/gallery images (10MB limit)  
- **testimonial-images**: Customer testimonial photos (2MB limit)

## Initial Setup

### 1. Create Storage Buckets

Run the storage setup script to create the necessary buckets:

```bash
npm run storage:setup
```

This script will:
- Create the three storage buckets with proper configurations
- Set file size limits
- Configure allowed MIME types (JPEG, PNG, WebP)
- Make buckets publicly readable

### 2. Apply RLS Policies

Run the database migration to apply Row Level Security policies:

```bash
npm run db:migrate
```

This applies the migration in `db/migrations/0010_storage_rls_policies.sql` which:
- Enables RLS on the storage.objects table
- Allows public read access for all images
- Restricts uploads/updates/deletes to authenticated users who own the files
- Enforces folder structure: `{bucket}/{user_id}/{filename}`

## Usage in Code

### Import Storage Helpers

```typescript
import {
  uploadProviderImage,
  uploadGalleryImage,
  deleteProviderImage,
  listProviderGalleryImages,
  validateImageFile,
  STORAGE_BUCKETS,
  FILE_SIZE_LIMITS,
} from '@/lib/supabase/storage-helpers'
```

### Upload a Provider Profile Image

```typescript
const file = // File from input
const userId = // Current user ID

try {
  const { publicUrl, path } = await uploadProviderImage(
    file,
    userId,
    'profile' // or 'cover'
  )
  
  // Save publicUrl to provider profile in database
  console.log('Image uploaded:', publicUrl)
} catch (error) {
  console.error('Upload failed:', error)
}
```

### Upload Gallery Images

```typescript
const { publicUrl, path } = await uploadGalleryImage(
  file,
  userId,
  0 // index of the gallery image
)
```

### Use the Image Upload Component

```tsx
import { ImageUpload, GalleryUpload } from '@/components/provider/image-upload'

// Single image upload
<ImageUpload
  label="Profile Picture"
  description="Upload a professional photo"
  onUpload={async (file) => {
    const result = await uploadProviderImage(file, userId, 'profile')
    // Update database with result.publicUrl
    return result
  }}
  onRemove={async () => {
    await deleteProviderImage('PROVIDER_IMAGES', imagePath)
    // Update database to remove image URL
  }}
  currentImageUrl={provider.profileImageUrl}
  aspectRatio="square"
/>

// Gallery upload
<GalleryUpload
  images={provider.galleryImages || []}
  maxImages={12}
  onUpload={async (file, index) => {
    const result = await uploadGalleryImage(file, userId, index)
    // Update database with new gallery
    return result
  }}
  onRemove={async (index) => {
    // Remove from storage and database
  }}
/>
```

## File Structure

Files are organized in storage as follows:

```
provider-images/
├── {user_id}/
│   ├── profile-{timestamp}.jpg
│   └── cover-{timestamp}.jpg

provider-galleries/
├── {user_id}/
│   └── gallery/
│       ├── gallery-0-{timestamp}.jpg
│       ├── gallery-1-{timestamp}.jpg
│       └── ...

testimonial-images/
├── {user_id}/
│   └── testimonial-{timestamp}.jpg
```

## Security

### RLS Policies

The Row Level Security policies ensure:
1. **Public Read**: Anyone can view images (needed for provider profiles)
2. **Authenticated Upload**: Only logged-in users can upload
3. **Owner-Only Modification**: Users can only modify/delete their own images
4. **Path Enforcement**: File paths must follow the pattern `{user_id}/...`

### File Validation

The storage helpers include validation for:
- File type (only JPEG, PNG, WebP)
- File size (5MB for profiles, 10MB for galleries)
- Automatic file naming with timestamps to prevent collisions

## Best Practices

1. **Always validate files client-side** before uploading to provide immediate feedback
2. **Use the provided helper functions** instead of direct Supabase storage calls
3. **Store public URLs in the database** for quick access without additional API calls
4. **Implement proper error handling** for upload failures
5. **Consider image optimization** before upload to reduce file sizes
6. **Use the ImageUpload components** for consistent UI/UX

## Troubleshooting

### Common Issues

**1. "Bucket already exists" error**
- This is normal if buckets were previously created
- The script handles this gracefully

**2. "Permission denied" errors**
- Ensure RLS policies are applied: `npm run db:migrate`
- Check that the user is authenticated
- Verify file paths follow the `{user_id}/...` pattern

**3. Large file uploads failing**
- Check file size limits (5MB for profiles, 10MB for galleries)
- Consider client-side image compression
- Verify network stability for large uploads

**4. Images not displaying**
- Ensure buckets are set to public
- Check that public URLs are correctly saved in database
- Verify CORS settings in Supabase dashboard if needed

## Environment Variables

Ensure these are set in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Next Steps

1. Implement image optimization/compression before upload
2. Add image cropping functionality for profile pictures
3. Consider CDN integration for faster image delivery
4. Implement bulk upload for gallery images
5. Add progress indicators for large file uploads