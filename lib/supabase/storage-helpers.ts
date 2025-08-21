import { createClient } from '@supabase/supabase-js'
import { createServiceClient } from './service'

// Storage bucket names
export const STORAGE_BUCKETS = {
  PROVIDER_IMAGES: 'provider-images',
  PROVIDER_GALLERIES: 'provider-galleries',
  TESTIMONIAL_IMAGES: 'testimonial-images',
} as const

// File size limits
export const FILE_SIZE_LIMITS = {
  PROFILE_IMAGE: 5 * 1024 * 1024, // 5MB
  GALLERY_IMAGE: 10 * 1024 * 1024, // 10MB
  TESTIMONIAL_IMAGE: 2 * 1024 * 1024, // 2MB
} as const

// Allowed MIME types
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
] as const

/**
 * Generate a unique file path for provider images
 * @param userId - The user ID of the provider
 * @param type - Type of image (profile, cover, or gallery-{index})
 * @param extension - File extension
 */
export function generateProviderImagePath(
  userId: string,
  type: 'profile' | 'cover' | string,
  extension: string
): string {
  const timestamp = Date.now()
  if (type.startsWith('gallery-')) {
    return `${userId}/gallery/${type}-${timestamp}.${extension}`
  }
  return `${userId}/${type}-${timestamp}.${extension}`
}

/**
 * Upload a provider profile or cover image
 * @param file - The image file to upload
 * @param userId - The user ID of the provider
 * @param type - Type of image (profile or cover)
 */
export async function uploadProviderImage(
  file: File,
  userId: string,
  type: 'profile' | 'cover'
) {
  const supabase = createServiceClient()
  
  // Validate file type
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as any)) {
    throw new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.')
  }
  
  // Validate file size
  if (file.size > FILE_SIZE_LIMITS.PROFILE_IMAGE) {
    throw new Error('File size exceeds 5MB limit.')
  }
  
  // Generate file path
  const extension = file.name.split('.').pop() || 'jpg'
  const path = generateProviderImagePath(userId, type, extension)
  
  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKETS.PROVIDER_IMAGES)
    .upload(path, file, {
      upsert: true,
      cacheControl: '3600',
    })
  
  if (error) {
    throw error
  }
  
  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from(STORAGE_BUCKETS.PROVIDER_IMAGES)
    .getPublicUrl(path)
  
  return {
    path,
    publicUrl,
  }
}

/**
 * Upload a gallery image for a provider
 * @param file - The image file to upload
 * @param userId - The user ID of the provider
 * @param index - Index of the gallery image
 */
export async function uploadGalleryImage(
  file: File,
  userId: string,
  index: number
) {
  const supabase = createServiceClient()
  
  // Validate file type
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as any)) {
    throw new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.')
  }
  
  // Validate file size
  if (file.size > FILE_SIZE_LIMITS.GALLERY_IMAGE) {
    throw new Error('File size exceeds 10MB limit.')
  }
  
  // Generate file path
  const extension = file.name.split('.').pop() || 'jpg'
  const path = generateProviderImagePath(userId, `gallery-${index}`, extension)
  
  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKETS.PROVIDER_GALLERIES)
    .upload(path, file, {
      upsert: true,
      cacheControl: '3600',
    })
  
  if (error) {
    throw error
  }
  
  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from(STORAGE_BUCKETS.PROVIDER_GALLERIES)
    .getPublicUrl(path)
  
  return {
    path,
    publicUrl,
  }
}

/**
 * Delete a provider image
 * @param bucket - The storage bucket name
 * @param path - The file path to delete
 */
export async function deleteProviderImage(
  bucket: keyof typeof STORAGE_BUCKETS,
  path: string
) {
  const supabase = createServiceClient()
  
  const { error } = await supabase.storage
    .from(STORAGE_BUCKETS[bucket])
    .remove([path])
  
  if (error) {
    throw error
  }
}

/**
 * Delete multiple gallery images
 * @param userId - The user ID of the provider
 * @param paths - Array of file paths to delete
 */
export async function deleteGalleryImages(userId: string, paths: string[]) {
  const supabase = createServiceClient()
  
  // Filter paths to only include images belonging to this user
  const userPaths = paths.filter(path => path.startsWith(`${userId}/`))
  
  if (userPaths.length === 0) {
    return
  }
  
  const { error } = await supabase.storage
    .from(STORAGE_BUCKETS.PROVIDER_GALLERIES)
    .remove(userPaths)
  
  if (error) {
    throw error
  }
}

/**
 * Get a signed URL for temporary access to a private image
 * @param bucket - The storage bucket name
 * @param path - The file path
 * @param expiresIn - Expiration time in seconds (default: 1 hour)
 */
export async function getSignedImageUrl(
  bucket: keyof typeof STORAGE_BUCKETS,
  path: string,
  expiresIn: number = 3600
) {
  const supabase = createServiceClient()
  
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKETS[bucket])
    .createSignedUrl(path, expiresIn)
  
  if (error) {
    throw error
  }
  
  return data.signedUrl
}

/**
 * List all images in a provider's gallery
 * @param userId - The user ID of the provider
 */
export async function listProviderGalleryImages(userId: string) {
  const supabase = createServiceClient()
  
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKETS.PROVIDER_GALLERIES)
    .list(`${userId}/gallery`, {
      limit: 100,
      offset: 0,
    })
  
  if (error) {
    throw error
  }
  
  // Map to public URLs
  const images = data.map(file => {
    const { data: { publicUrl } } = supabase.storage
      .from(STORAGE_BUCKETS.PROVIDER_GALLERIES)
      .getPublicUrl(`${userId}/gallery/${file.name}`)
    
    return {
      name: file.name,
      path: `${userId}/gallery/${file.name}`,
      publicUrl,
      createdAt: file.created_at,
      size: file.metadata?.size || 0,
    }
  })
  
  return images
}

/**
 * Validate an image file before upload
 * @param file - The file to validate
 * @param maxSize - Maximum file size in bytes
 */
export function validateImageFile(
  file: File,
  maxSize: number = FILE_SIZE_LIMITS.PROFILE_IMAGE
): { valid: boolean; error?: string } {
  // Check file type
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as any)) {
    return {
      valid: false,
      error: 'Invalid file type. Please upload a JPEG, PNG, or WebP image.',
    }
  }
  
  // Check file size
  if (file.size > maxSize) {
    const maxSizeMB = Math.round(maxSize / (1024 * 1024))
    return {
      valid: false,
      error: `File size exceeds ${maxSizeMB}MB limit.`,
    }
  }
  
  return { valid: true }
}

/**
 * Get the file extension from a filename
 * @param filename - The filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'jpg'
}

/**
 * Generate a thumbnail URL for an image (using Supabase's image transformation)
 * @param publicUrl - The public URL of the image
 * @param width - Desired width
 * @param height - Desired height
 */
export function getThumbnailUrl(
  publicUrl: string,
  width: number = 200,
  height: number = 200
): string {
  // Supabase supports image transformations via URL parameters
  // This requires enabling the Image Transformation extension in Supabase
  return `${publicUrl}?width=${width}&height=${height}&resize=contain`
}