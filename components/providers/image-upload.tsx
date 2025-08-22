/**
 * Provider Image Upload Component
 * Series A Production Standards - User-friendly image upload UI
 * 
 * Features:
 * - Drag and drop support
 * - Image preview before upload
 * - Progress indicator
 * - Error handling with retry
 * - Automatic image compression
 */

'use client'

import React, { useState, useRef, useCallback } from 'react'
import { Upload, X, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { ImageType } from '@/lib/supabase/storage-helpers'
import { useImageUpload, getImagePreview, compressImage } from '@/lib/hooks/use-image-upload'
import { cn } from '@/lib/utils'

interface ImageUploadProps {
  providerId: string
  type: ImageType
  currentImageUrl?: string
  onUploadComplete?: (url: string) => void
  onDelete?: (url: string) => void
  className?: string
  maxSizeMB?: number
  acceptedFormats?: string[]
  compress?: boolean
  galleryIndex?: number
}

export function ImageUpload({
  providerId,
  type,
  currentImageUrl,
  onUploadComplete,
  onDelete,
  className,
  maxSizeMB = type === ImageType.GALLERY ? 10 : 5,
  acceptedFormats = ['image/jpeg', 'image/png', 'image/webp'],
  compress = true,
  galleryIndex,
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const { uploadImage, deleteImage, isUploading, progress, error, reset } = useImageUpload({
    onSuccess: (url) => {
      setPreview(url)
      setUploadStatus('success')
      onUploadComplete?.(url)
      setTimeout(() => setUploadStatus('idle'), 3000)
    },
    onError: (error) => {
      setUploadStatus('error')
      console.error('Upload error:', error)
    },
  })

  const handleFileSelect = useCallback(async (file: File) => {
    try {
      // Reset states
      reset()
      setUploadStatus('idle')

      // Generate preview
      const previewUrl = await getImagePreview(file)
      setPreview(previewUrl)

      // Compress image if enabled and file is large
      let fileToUpload = file
      if (compress && file.size > 1024 * 1024) { // Compress if > 1MB
        fileToUpload = await compressImage(file)
      }

      // Upload the image
      const result = await uploadImage(
        fileToUpload,
        type,
        providerId,
        galleryIndex,
        currentImageUrl
      )

      if (!result.success) {
        setPreview(currentImageUrl || null)
      }
    } catch (err) {
      console.error('File selection error:', err)
      setUploadStatus('error')
      setPreview(currentImageUrl || null)
    }
  }, [compress, uploadImage, type, providerId, galleryIndex, currentImageUrl, reset])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    const imageFile = files.find(file => acceptedFormats.includes(file.type))

    if (imageFile) {
      handleFileSelect(imageFile)
    } else {
      setUploadStatus('error')
    }
  }, [acceptedFormats, handleFileSelect])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDelete = useCallback(async () => {
    if (!preview || !currentImageUrl) return

    const confirmed = window.confirm('Are you sure you want to delete this image?')
    if (!confirmed) return

    const result = await deleteImage(currentImageUrl, providerId)
    
    if (result.success) {
      setPreview(null)
      onDelete?.(currentImageUrl)
    } else {
      console.error('Delete error:', result.error)
    }
  }, [preview, currentImageUrl, deleteImage, providerId, onDelete])

  const getTypeLabel = () => {
    switch (type) {
      case ImageType.PROFILE:
        return 'Profile Image'
      case ImageType.COVER:
        return 'Cover Image'
      case ImageType.GALLERY:
        return `Gallery Image ${galleryIndex !== undefined ? galleryIndex + 1 : ''}`
      default:
        return 'Image'
    }
  }

  return (
    <div className={cn('relative', className)}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {getTypeLabel()}
      </label>

      <div
        className={cn(
          'relative border-2 border-dashed rounded-lg transition-colors',
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300',
          error ? 'border-red-500' : '',
          uploadStatus === 'success' ? 'border-green-500' : '',
          'hover:border-gray-400'
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedFormats.join(',')}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFileSelect(file)
          }}
          className="hidden"
        />

        {preview ? (
          <div className="relative aspect-video">
            <img
              src={preview}
              alt={getTypeLabel()}
              className="w-full h-full object-cover rounded-lg"
            />
            
            {/* Overlay with actions */}
            <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-50 transition-opacity rounded-lg flex items-center justify-center opacity-0 hover:opacity-100">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-white text-gray-700 px-4 py-2 rounded-md mr-2 hover:bg-gray-100"
                disabled={isUploading}
              >
                Replace
              </button>
              {currentImageUrl && (
                <button
                  onClick={handleDelete}
                  className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600"
                  disabled={isUploading}
                >
                  Delete
                </button>
              )}
            </div>

            {/* Upload progress overlay */}
            {isUploading && (
              <div className="absolute inset-0 bg-white bg-opacity-90 flex flex-col items-center justify-center rounded-lg">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-2" />
                <span className="text-sm text-gray-600">Uploading...</span>
                <div className="w-3/4 bg-gray-200 rounded-full h-2 mt-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${progress.percentage}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 mt-1">
                  {progress.percentage}%
                </span>
              </div>
            )}
          </div>
        ) : (
          <div
            className="p-8 text-center cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploading ? (
              <Loader2 className="w-12 h-12 mx-auto mb-4 text-gray-400 animate-spin" />
            ) : (
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            )}
            
            <p className="text-sm text-gray-600 mb-2">
              {isDragging
                ? 'Drop image here'
                : 'Click to upload or drag and drop'}
            </p>
            
            <p className="text-xs text-gray-500">
              {acceptedFormats.map(format => format.split('/')[1].toUpperCase()).join(', ')}
              {' '}up to {maxSizeMB}MB
            </p>
          </div>
        )}
      </div>

      {/* Status messages */}
      {error && (
        <div className="mt-2 flex items-center text-sm text-red-600">
          <AlertCircle className="w-4 h-4 mr-1" />
          {error}
        </div>
      )}

      {uploadStatus === 'success' && (
        <div className="mt-2 flex items-center text-sm text-green-600">
          <CheckCircle className="w-4 h-4 mr-1" />
          Upload successful!
        </div>
      )}
    </div>
  )
}

// Gallery upload component for multiple images
interface GalleryUploadProps {
  providerId: string
  maxImages?: number
  currentImages?: string[]
  onGalleryUpdate?: (images: string[]) => void
  className?: string
}

export function GalleryUpload({
  providerId,
  maxImages = 10,
  currentImages = [],
  onGalleryUpdate,
  className,
}: GalleryUploadProps) {
  const [images, setImages] = useState<string[]>(currentImages)

  const handleImageUpload = (index: number) => (url: string) => {
    const newImages = [...images]
    newImages[index] = url
    setImages(newImages)
    onGalleryUpdate?.(newImages)
  }

  const handleImageDelete = (index: number) => () => {
    const newImages = images.filter((_, i) => i !== index)
    setImages(newImages)
    onGalleryUpdate?.(newImages)
  }

  const addImageSlot = () => {
    if (images.length < maxImages) {
      setImages([...images, ''])
    }
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Gallery Images</h3>
        {images.length < maxImages && (
          <button
            onClick={addImageSlot}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Add Image ({images.length}/{maxImages})
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {images.map((imageUrl, index) => (
          <ImageUpload
            key={index}
            providerId={providerId}
            type={ImageType.GALLERY}
            currentImageUrl={imageUrl || undefined}
            onUploadComplete={handleImageUpload(index)}
            onDelete={handleImageDelete(index)}
            galleryIndex={index}
          />
        ))}
        
        {images.length === 0 && (
          <button
            onClick={addImageSlot}
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors"
          >
            <Upload className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <span className="text-sm text-gray-600">Add first image</span>
          </button>
        )}
      </div>
    </div>
  )
}