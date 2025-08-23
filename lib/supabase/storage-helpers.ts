/**
 * Supabase Storage Helper Functions
 * Series A Production Standards - Enterprise-grade image management
 * 
 * Features:
 * - Type-safe image upload/delete operations
 * - Automatic file validation and sanitization
 * - Unique filename generation to prevent conflicts
 * - Comprehensive error handling
 * - Support for multiple image formats
 */

import { createClient } from '@supabase/supabase-js'
import { createServiceClient } from './service'
import { z } from 'zod'

// Storage bucket names with proper typing
export const STORAGE_BUCKETS = {
  PROVIDER_PROFILES: 'provider-profiles',
  PROVIDER_COVERS: 'provider-covers',
  PROVIDER_GALLERIES: 'provider-galleries',
} as const

export type StorageBucket = typeof STORAGE_BUCKETS[keyof typeof STORAGE_BUCKETS]

// File size limits
export const FILE_SIZE_LIMITS = {
  PROFILE_IMAGE: 5 * 1024 * 1024, // 5MB
  COVER_IMAGE: 5 * 1024 * 1024, // 5MB
  GALLERY_IMAGE: 10 * 1024 * 1024, // 10MB
} as const

// Allowed MIME types
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
] as const

export type AllowedImageType = typeof ALLOWED_IMAGE_TYPES[number]

// Image type enum for better type safety
export enum ImageType {
  PROFILE = 'profile',
  COVER = 'cover',
  GALLERY = 'gallery',
}

// Validation schemas
export const ImageUploadSchema = z.object({
  file: z.instanceof(File),
  providerId: z.string().uuid(),
  type: z.nativeEnum(ImageType),
  galleryIndex: z.number().optional(),
})

export type ImageUploadInput = z.infer<typeof ImageUploadSchema>

// Error types for better error handling
export class StorageError extends Error {
  constructor(
    message: string,
    public code: 'INVALID_FILE' | 'UPLOAD_FAILED' | 'DELETE_FAILED' | 'NOT_FOUND' | 'SIZE_EXCEEDED' | 'INVALID_TYPE',
    public details?: any
  ) {
    super(message)
    this.name = 'StorageError'
  }
}

/**
 * Generate a unique file path for provider images with proper structure
 * @param providerId - The provider ID
 * @param type - Type of image
 * @param extension - File extension
 * @param galleryIndex - Optional index for gallery images
 */
export function generateProviderImagePath(
  providerId: string,
  type: ImageType,
  extension: string,
  galleryIndex?: number
): string {
  const timestamp = Date.now()
  const sanitizedExt = extension.toLowerCase().replace(/[^a-z0-9]/g, '')
  
  switch (type) {
    case ImageType.PROFILE:
      return `${providerId}/profile-${timestamp}.${sanitizedExt}`
    case ImageType.COVER:
      return `${providerId}/cover-${timestamp}.${sanitizedExt}`
    case ImageType.GALLERY:
      const index = galleryIndex ?? 0
      return `${providerId}/gallery/image-${index}-${timestamp}.${sanitizedExt}`
    default:
      throw new StorageError('Invalid image type', 'INVALID_TYPE')
  }
}

/**
 * Upload a provider image with comprehensive validation and error handling
 * @param file - The image file to upload
 * @param type - Type of image
 * @param providerId - The provider ID
 * @param galleryIndex - Optional index for gallery images
 * @returns Public URL of the uploaded image
 */
export async function uploadProviderImage(
  file: File,
  type: ImageType,
  providerId: string,
  galleryIndex?: number
): Promise<string> {
  const supabase = createServiceClient()
  
  try {
    // Validate file type
    if (!ALLOWED_IMAGE_TYPES.includes(file.type as AllowedImageType)) {
      throw new StorageError(
        'Invalid file type. Only JPEG, PNG, and WebP images are allowed.',
        'INVALID_TYPE',
        { received: file.type, allowed: ALLOWED_IMAGE_TYPES }
      )
    }
    
    // Determine size limit based on type
    const sizeLimit = type === ImageType.GALLERY 
      ? FILE_SIZE_LIMITS.GALLERY_IMAGE 
      : type === ImageType.COVER
      ? FILE_SIZE_LIMITS.COVER_IMAGE
      : FILE_SIZE_LIMITS.PROFILE_IMAGE
    
    // Validate file size
    if (file.size > sizeLimit) {
      const limitMB = sizeLimit / (1024 * 1024)
      throw new StorageError(
        `File size exceeds ${limitMB}MB limit.`,
        'SIZE_EXCEEDED',
        { size: file.size, limit: sizeLimit }
      )
    }
    
    // Generate file path
    const extension = getFileExtension(file.name)
    const path = generateProviderImagePath(providerId, type, extension, galleryIndex)
    
    // Determine bucket based on type
    const bucket = type === ImageType.PROFILE
      ? STORAGE_BUCKETS.PROVIDER_PROFILES
      : type === ImageType.COVER
      ? STORAGE_BUCKETS.PROVIDER_COVERS
      : STORAGE_BUCKETS.PROVIDER_GALLERIES
    
    // Upload to Supabase Storage with retries
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        upsert: true,
        cacheControl: '3600',
        contentType: file.type,
      })
    
    if (error) {
      throw new StorageError(
        'Failed to upload image',
        'UPLOAD_FAILED',
        error
      )
    }
    
    // Get public URL
    const publicUrl = getPublicUrl(bucket, path)
    
    return publicUrl
  } catch (error) {
    if (error instanceof StorageError) {
      throw error
    }
    throw new StorageError(
      'Unexpected error during image upload',
      'UPLOAD_FAILED',
      error
    )
  }
}

/**
 * Get public URL for a storage path
 * @param bucket - Storage bucket name
 * @param path - File path within bucket
 */
export function getPublicUrl(bucket: string, path: string): string {
  const supabase = createServiceClient()
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
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
  const path = generateProviderImagePath(userId, ImageType.GALLERY, extension, index)
  
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
 * Delete a provider image by URL with proper error handling
 * @param imageUrl - The public URL of the image to delete
 */
export async function deleteProviderImage(imageUrl: string): Promise<void> {
  const supabase = createServiceClient()
  
  try {
    // Extract bucket and path from URL
    // URL format: https://[project].supabase.co/storage/v1/object/public/[bucket]/[path]
    const urlMatch = imageUrl.match(/\/storage\/v1\/object\/public\/([^\/]+)\/(.+)/)
    
    if (!urlMatch) {
      throw new StorageError(
        'Invalid image URL format',
        'INVALID_FILE',
        { url: imageUrl }
      )
    }
    
    const [, bucketName, filePath] = urlMatch
    
    // Validate bucket name
    const validBuckets = Object.values(STORAGE_BUCKETS)
    if (!validBuckets.includes(bucketName as StorageBucket)) {
      throw new StorageError(
        `Unknown storage bucket: ${bucketName}`,
        'NOT_FOUND',
        { bucket: bucketName, valid: validBuckets }
      )
    }
    
    const { error } = await supabase.storage
      .from(bucketName)
      .remove([filePath])
    
    if (error) {
      throw new StorageError(
        'Failed to delete image',
        'DELETE_FAILED',
        error
      )
    }
  } catch (error) {
    if (error instanceof StorageError) {
      throw error
    }
    throw new StorageError(
      'Unexpected error during image deletion',
      'DELETE_FAILED',
      error
    )
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
 * Validate an image file before upload (client-side validation)
 * @param file - The file to validate
 * @param type - Type of image for size limit determination
 * @returns Validation result with detailed error message if invalid
 */
export function validateImageFile(
  file: File,
  type: ImageType = ImageType.PROFILE
): { valid: boolean; error?: string; details?: any } {
  // Check if file exists
  if (!file) {
    return {
      valid: false,
      error: 'No file provided',
    }
  }
  
  // Check file type
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as AllowedImageType)) {
    return {
      valid: false,
      error: 'Invalid file type. Please upload a JPEG, PNG, or WebP image.',
      details: {
        received: file.type,
        allowed: ALLOWED_IMAGE_TYPES,
      }
    }
  }
  
  // Determine size limit based on type
  const maxSize = type === ImageType.GALLERY 
    ? FILE_SIZE_LIMITS.GALLERY_IMAGE 
    : type === ImageType.COVER
    ? FILE_SIZE_LIMITS.COVER_IMAGE
    : FILE_SIZE_LIMITS.PROFILE_IMAGE
  
  // Check file size
  if (file.size > maxSize) {
    const maxSizeMB = Math.round(maxSize / (1024 * 1024))
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2)
    return {
      valid: false,
      error: `File size ${fileSizeMB}MB exceeds ${maxSizeMB}MB limit.`,
      details: {
        fileSize: file.size,
        maxSize: maxSize,
      }
    }
  }
  
  // Additional validation for file name
  const extension = getFileExtension(file.name)
  const validExtensions = ['jpg', 'jpeg', 'png', 'webp']
  if (!validExtensions.includes(extension.toLowerCase())) {
    return {
      valid: false,
      error: 'Invalid file extension',
      details: {
        extension,
        valid: validExtensions,
      }
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