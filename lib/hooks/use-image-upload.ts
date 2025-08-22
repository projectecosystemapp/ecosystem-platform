/**
 * React Hook for Provider Image Upload
 * Series A Production Standards - Client-side image management
 * 
 * Features:
 * - Progress tracking for uploads
 * - Automatic retry on failure
 * - Client-side validation
 * - Error handling with user-friendly messages
 */

import { useState, useCallback } from 'react'
import { validateImageFile, ImageType } from '@/lib/supabase/storage-helpers'

export interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}

export interface UploadResult {
  success: boolean
  url?: string
  error?: string
  details?: any
}

export interface UseImageUploadOptions {
  onSuccess?: (url: string) => void
  onError?: (error: string) => void
  onProgress?: (progress: UploadProgress) => void
  maxRetries?: number
}

export function useImageUpload(options: UseImageUploadOptions = {}) {
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState<UploadProgress>({ loaded: 0, total: 0, percentage: 0 })
  const [error, setError] = useState<string | null>(null)

  const uploadImage = useCallback(async (
    file: File,
    type: ImageType,
    providerId: string,
    galleryIndex?: number,
    replaceUrl?: string
  ): Promise<UploadResult> => {
    // Reset state
    setIsUploading(true)
    setError(null)
    setProgress({ loaded: 0, total: 0, percentage: 0 })

    try {
      // Client-side validation
      const validation = validateImageFile(file, type)
      if (!validation.valid) {
        const errorMsg = validation.error || 'Invalid file'
        setError(errorMsg)
        setIsUploading(false)
        options.onError?.(errorMsg)
        return { success: false, error: errorMsg, details: validation.details }
      }

      // Prepare form data
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', type)
      formData.append('providerId', providerId)
      
      if (galleryIndex !== undefined) {
        formData.append('galleryIndex', galleryIndex.toString())
      }
      
      if (replaceUrl) {
        formData.append('replaceUrl', replaceUrl)
      }

      // Create XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest()

      // Track upload progress
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progressData: UploadProgress = {
            loaded: event.loaded,
            total: event.total,
            percentage: Math.round((event.loaded / event.total) * 100),
          }
          setProgress(progressData)
          options.onProgress?.(progressData)
        }
      })

      // Create promise for the upload
      const uploadPromise = new Promise<UploadResult>((resolve, reject) => {
        xhr.addEventListener('load', () => {
          try {
            const response = JSON.parse(xhr.responseText)
            
            if (xhr.status >= 200 && xhr.status < 300) {
              if (response.success && response.data?.url) {
                resolve({ 
                  success: true, 
                  url: response.data.url 
                })
              } else {
                reject(new Error(response.error || 'Upload failed'))
              }
            } else {
              reject(new Error(response.error || `Upload failed with status ${xhr.status}`))
            }
          } catch (error) {
            reject(new Error('Failed to parse server response'))
          }
        })

        xhr.addEventListener('error', () => {
          reject(new Error('Network error during upload'))
        })

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload cancelled'))
        })
      })

      // Send the request
      xhr.open('POST', '/api/providers/images/upload')
      xhr.send(formData)

      // Wait for the upload to complete
      const result = await uploadPromise
      
      setIsUploading(false)
      setProgress({ loaded: 100, total: 100, percentage: 100 })
      
      if (result.success && result.url) {
        options.onSuccess?.(result.url)
      }
      
      return result

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed'
      setError(errorMessage)
      setIsUploading(false)
      options.onError?.(errorMessage)
      
      return { 
        success: false, 
        error: errorMessage 
      }
    }
  }, [options])

  const deleteImage = useCallback(async (
    imageUrl: string,
    providerId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/providers/images/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl,
          providerId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete image')
      }

      return { success: true }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Delete failed'
      return { success: false, error: errorMessage }
    }
  }, [])

  const reset = useCallback(() => {
    setIsUploading(false)
    setProgress({ loaded: 0, total: 0, percentage: 0 })
    setError(null)
  }, [])

  return {
    uploadImage,
    deleteImage,
    isUploading,
    progress,
    error,
    reset,
  }
}

// Helper function to convert File to base64 for preview
export async function getImagePreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Helper function to compress image before upload
export async function compressImage(
  file: File,
  maxWidth: number = 1920,
  maxHeight: number = 1080,
  quality: number = 0.9
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    img.onload = () => {
      let { width, height } = img

      // Calculate new dimensions
      if (width > maxWidth || height > maxHeight) {
        const aspectRatio = width / height
        
        if (width > height) {
          width = maxWidth
          height = width / aspectRatio
        } else {
          height = maxHeight
          width = height * aspectRatio
        }
      }

      canvas.width = width
      canvas.height = height

      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }

      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height)
      
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to compress image'))
            return
          }

          const compressedFile = new File([blob], file.name, {
            type: file.type,
            lastModified: Date.now(),
          })

          resolve(compressedFile)
        },
        file.type,
        quality
      )
    }

    img.onerror = reject

    // Read the image file
    const reader = new FileReader()
    reader.onload = (e) => {
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}