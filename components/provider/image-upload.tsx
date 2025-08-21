'use client'

import { useState, useCallback } from 'react'
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  validateImageFile,
  FILE_SIZE_LIMITS,
  ALLOWED_IMAGE_TYPES,
} from '@/lib/supabase/storage-helpers'

interface ImageUploadProps {
  onUpload: (file: File) => Promise<{ publicUrl: string }>
  onRemove?: () => Promise<void>
  currentImageUrl?: string | null
  maxSize?: number
  label?: string
  description?: string
  aspectRatio?: 'square' | 'video' | 'banner'
  className?: string
  disabled?: boolean
}

export function ImageUpload({
  onUpload,
  onRemove,
  currentImageUrl,
  maxSize = FILE_SIZE_LIMITS.PROFILE_IMAGE,
  label = 'Upload Image',
  description,
  aspectRatio = 'square',
  className,
  disabled = false,
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)

  const handleFile = useCallback(
    async (file: File) => {
      setError(null)

      // Validate file
      const validation = validateImageFile(file, maxSize)
      if (!validation.valid) {
        setError(validation.error || 'Invalid file')
        return
      }

      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result as string)
      }
      reader.readAsDataURL(file)

      // Upload file
      setIsUploading(true)
      try {
        const result = await onUpload(file)
        setPreview(result.publicUrl)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed')
        setPreview(currentImageUrl || null)
      } finally {
        setIsUploading(false)
      }
    },
    [onUpload, currentImageUrl, maxSize]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)

      if (disabled || isUploading) return

      const file = e.dataTransfer.files[0]
      if (file) {
        handleFile(file)
      }
    },
    [handleFile, disabled, isUploading]
  )

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      if (!disabled && !isUploading) {
        setDragActive(true)
      }
    },
    [disabled, isUploading]
  )

  const handleDragLeave = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)
    },
    []
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        handleFile(file)
      }
    },
    [handleFile]
  )

  const handleRemove = useCallback(async () => {
    if (onRemove && !isUploading) {
      setIsUploading(true)
      try {
        await onRemove()
        setPreview(null)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Remove failed')
      } finally {
        setIsUploading(false)
      }
    }
  }, [onRemove, isUploading])

  const aspectRatioClasses = {
    square: 'aspect-square',
    video: 'aspect-video',
    banner: 'aspect-[3/1]',
  }

  const maxSizeMB = Math.round(maxSize / (1024 * 1024))
  const acceptedTypes = ALLOWED_IMAGE_TYPES.map(type => 
    type.replace('image/', '.')
  ).join(', ')

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {label}
        </label>
      )}
      
      {description && (
        <p className="text-sm text-muted-foreground">
          {description}
        </p>
      )}

      <div
        className={cn(
          'relative overflow-hidden rounded-lg border-2 border-dashed transition-colors',
          aspectRatioClasses[aspectRatio],
          dragActive && 'border-primary bg-primary/5',
          !dragActive && 'border-muted-foreground/25 hover:border-muted-foreground/50',
          disabled && 'opacity-50 cursor-not-allowed',
          error && 'border-destructive'
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {preview ? (
          <>
            <img
              src={preview}
              alt="Upload preview"
              className="h-full w-full object-cover"
            />
            {!disabled && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity hover:opacity-100">
                {isUploading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-white" />
                ) : (
                  <div className="flex gap-2">
                    <label
                      htmlFor={`image-upload-${label}`}
                      className="cursor-pointer rounded-full bg-white p-2 text-black transition-transform hover:scale-110"
                    >
                      <Upload className="h-5 w-5" />
                      <input
                        id={`image-upload-${label}`}
                        type="file"
                        accept={ALLOWED_IMAGE_TYPES.join(',')}
                        onChange={handleChange}
                        disabled={disabled || isUploading}
                        className="sr-only"
                      />
                    </label>
                    {onRemove && (
                      <button
                        onClick={handleRemove}
                        disabled={isUploading}
                        className="rounded-full bg-white p-2 text-black transition-transform hover:scale-110"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <label
            htmlFor={`image-upload-${label}`}
            className={cn(
              'flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 p-8',
              disabled && 'cursor-not-allowed'
            )}
          >
            {isUploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : (
              <>
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm font-medium">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {acceptedTypes} (max {maxSizeMB}MB)
                  </p>
                </div>
              </>
            )}
            <input
              id={`image-upload-${label}`}
              type="file"
              accept={ALLOWED_IMAGE_TYPES.join(',')}
              onChange={handleChange}
              disabled={disabled || isUploading}
              className="sr-only"
            />
          </label>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}

// Gallery upload component for multiple images
interface GalleryUploadProps {
  images: string[]
  maxImages?: number
  onUpload: (file: File, index: number) => Promise<{ publicUrl: string }>
  onRemove: (index: number) => Promise<void>
  maxSize?: number
  disabled?: boolean
}

export function GalleryUpload({
  images,
  maxImages = 12,
  onUpload,
  onRemove,
  maxSize = FILE_SIZE_LIMITS.GALLERY_IMAGE,
  disabled = false,
}: GalleryUploadProps) {
  const [isUploading, setIsUploading] = useState<number | null>(null)
  const [errors, setErrors] = useState<Record<number, string>>({})

  const handleUpload = useCallback(
    async (file: File, index: number) => {
      setErrors(prev => ({ ...prev, [index]: '' }))

      // Validate file
      const validation = validateImageFile(file, maxSize)
      if (!validation.valid) {
        setErrors(prev => ({ ...prev, [index]: validation.error || 'Invalid file' }))
        return
      }

      setIsUploading(index)
      try {
        await onUpload(file, index)
        setErrors(prev => {
          const newErrors = { ...prev }
          delete newErrors[index]
          return newErrors
        })
      } catch (err) {
        setErrors(prev => ({
          ...prev,
          [index]: err instanceof Error ? err.message : 'Upload failed',
        }))
      } finally {
        setIsUploading(null)
      }
    },
    [onUpload, maxSize]
  )

  const handleRemove = useCallback(
    async (index: number) => {
      setIsUploading(index)
      try {
        await onRemove(index)
        setErrors(prev => {
          const newErrors = { ...prev }
          delete newErrors[index]
          return newErrors
        })
      } catch (err) {
        setErrors(prev => ({
          ...prev,
          [index]: err instanceof Error ? err.message : 'Remove failed',
        }))
      } finally {
        setIsUploading(null)
      }
    },
    [onRemove]
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Gallery Images</h3>
          <p className="text-sm text-muted-foreground">
            Upload up to {maxImages} images to showcase your work
          </p>
        </div>
        <span className="text-sm text-muted-foreground">
          {images.filter(Boolean).length} / {maxImages}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {Array.from({ length: maxImages }).map((_, index) => {
          const imageUrl = images[index]
          const isCurrentlyUploading = isUploading === index
          const error = errors[index]

          return (
            <div key={index} className="relative aspect-square">
              {imageUrl ? (
                <div className="group relative h-full w-full overflow-hidden rounded-lg border">
                  <img
                    src={imageUrl}
                    alt={`Gallery image ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                  {!disabled && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                      {isCurrentlyUploading ? (
                        <Loader2 className="h-6 w-6 animate-spin text-white" />
                      ) : (
                        <button
                          onClick={() => handleRemove(index)}
                          className="rounded-full bg-white p-2 text-black transition-transform hover:scale-110"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <label
                  className={cn(
                    'flex h-full w-full cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 transition-colors hover:border-muted-foreground/50',
                    disabled && 'cursor-not-allowed opacity-50',
                    error && 'border-destructive'
                  )}
                >
                  {isCurrentlyUploading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  ) : (
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  )}
                  <input
                    type="file"
                    accept={ALLOWED_IMAGE_TYPES.join(',')}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleUpload(file, index)
                    }}
                    disabled={disabled || isCurrentlyUploading}
                    className="sr-only"
                  />
                </label>
              )}
              {error && (
                <p className="absolute -bottom-5 left-0 text-xs text-destructive">
                  {error}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}