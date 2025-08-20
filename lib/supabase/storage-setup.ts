// This file contains the setup for Supabase Storage buckets
// Run this once to create the necessary storage buckets for the marketplace

import { createServiceClient } from './service'

export async function setupStorageBuckets() {
  const supabase = createServiceClient()

  // Create provider-images bucket for profile and cover images
  const { data: providerBucket, error: providerError } = await supabase
    .storage
    .createBucket('provider-images', {
      public: true,
      fileSizeLimit: 5242880, // 5MB
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
    })

  if (providerError && !providerError.message.includes('already exists')) {
    console.error('Error creating provider-images bucket:', providerError)
  } else {
    console.log('✅ Provider images bucket ready')
  }

  // Create provider-galleries bucket for portfolio images
  const { data: galleryBucket, error: galleryError } = await supabase
    .storage
    .createBucket('provider-galleries', {
      public: true,
      fileSizeLimit: 10485760, // 10MB
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
    })

  if (galleryError && !galleryError.message.includes('already exists')) {
    console.error('Error creating provider-galleries bucket:', galleryError)
  } else {
    console.log('✅ Provider galleries bucket ready')
  }

  // Create testimonial-images bucket for customer testimonial photos
  const { data: testimonialBucket, error: testimonialError } = await supabase
    .storage
    .createBucket('testimonial-images', {
      public: true,
      fileSizeLimit: 2097152, // 2MB
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
    })

  if (testimonialError && !testimonialError.message.includes('already exists')) {
    console.error('Error creating testimonial-images bucket:', testimonialError)
  } else {
    console.log('✅ Testimonial images bucket ready')
  }

  console.log('Storage setup complete!')
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