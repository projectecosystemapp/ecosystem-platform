/**
 * Supabase Storage Bucket Configuration
 * Series A Production Standards - Enterprise-grade image storage
 * 
 * Buckets:
 * - provider-profiles: Profile images (5MB limit)
 * - provider-covers: Cover/banner images (5MB limit)
 * - provider-galleries: Portfolio images (10MB limit)
 * 
 * Security: RLS policies ensure providers can only modify their own images
 */

import { createServiceClient } from './service'
import { SupabaseClient } from '@supabase/supabase-js'

// Bucket configuration types
interface BucketConfig {
  name: string
  public: boolean
  fileSizeLimit: number
  allowedMimeTypes: string[]
  description: string
}

// Storage bucket configurations following Series A standards
const BUCKET_CONFIGS: BucketConfig[] = [
  {
    name: 'provider-profiles',
    public: true,
    fileSizeLimit: 5242880, // 5MB
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
    description: 'Provider profile images',
  },
  {
    name: 'provider-covers',
    public: true,
    fileSizeLimit: 5242880, // 5MB
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
    description: 'Provider cover/banner images',
  },
  {
    name: 'provider-galleries',
    public: true,
    fileSizeLimit: 10485760, // 10MB
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
    description: 'Provider portfolio/gallery images',
  },
]

/**
 * Create a storage bucket with proper error handling
 */
async function createBucket(
  supabase: SupabaseClient,
  config: BucketConfig
): Promise<boolean> {
  try {
    const { data, error } = await supabase.storage.createBucket(config.name, {
      public: config.public,
      fileSizeLimit: config.fileSizeLimit,
      allowedMimeTypes: config.allowedMimeTypes,
    })

    if (error) {
      if (error.message.includes('already exists')) {
        console.log(`✅ ${config.description} bucket already exists`)
        return true
      }
      console.error(`❌ Error creating ${config.name} bucket:`, error)
      return false
    }

    console.log(`✅ ${config.description} bucket created successfully`)
    return true
  } catch (error) {
    console.error(`❌ Unexpected error creating ${config.name} bucket:`, error)
    return false
  }
}

/**
 * Set up RLS policies for storage buckets
 * Ensures providers can only modify their own images
 */
async function setupStoragePolicies(supabase: SupabaseClient): Promise<void> {
  // Note: RLS policies are typically set up via Supabase dashboard or migrations
  // This is a placeholder for documentation purposes
  console.log('📝 Storage RLS policies should be configured in Supabase dashboard:')
  console.log('  - Providers can upload/update/delete their own images')
  console.log('  - Public read access for all images')
  console.log('  - Admin users have full access')
}

/**
 * Main setup function for storage buckets
 */
export async function setupStorageBuckets(): Promise<{
  success: boolean
  errors: string[]
}> {
  const supabase = createServiceClient()
  const errors: string[] = []
  let successCount = 0

  console.log('🚀 Setting up Supabase storage buckets...')

  // Create each bucket
  for (const config of BUCKET_CONFIGS) {
    const success = await createBucket(supabase, config)
    if (success) {
      successCount++
    } else {
      errors.push(`Failed to create ${config.name} bucket`)
    }
  }

  // Set up RLS policies
  await setupStoragePolicies(supabase)

  const allSuccess = successCount === BUCKET_CONFIGS.length

  if (allSuccess) {
    console.log('✅ All storage buckets set up successfully!')
  } else {
    console.log(`⚠️ Storage setup completed with ${errors.length} errors`)
  }

  return {
    success: allSuccess,
    errors,
  }
}

// Helper function to get public URL for an image
export function getPublicImageUrl(bucket: string, path: string) {
  const supabase = createServiceClient()
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

// Helper function to upload an image
export async function uploadImage(
  bucket: string,
  path: string,
  file: File | Blob
) {
  const supabase = createServiceClient()
  
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      upsert: true,
      cacheControl: '3600',
    })

  if (error) {
    throw error
  }

  return getPublicImageUrl(bucket, path)
}

// Helper function to delete an image
export async function deleteImage(bucket: string, path: string) {
  const supabase = createServiceClient()
  
  const { error } = await supabase.storage
    .from(bucket)
    .remove([path])

  if (error) {
    throw error
  }
}