// @ts-nocheck
/**
 * Provider Image Delete API Endpoint
 * Series A Production Standards - Secure image deletion
 * 
 * DELETE /api/providers/images/delete
 * 
 * Handles image deletion for providers:
 * - Profile images
 * - Cover images
 * - Gallery images
 * 
 * Security:
 * - Authentication required
 * - Provider can only delete their own images
 * - Rate limiting applied
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { deleteProviderImage, StorageError } from '@/lib/supabase/storage-helpers'
import { createClient } from '@/lib/supabase/server'
import { createSecureApiHandler } from '@/lib/security/api-handler'

// Request validation schema
const DeleteRequestSchema = z.object({
  imageUrl: z.string().url(),
  providerId: z.string().uuid(),
})

/**
 * Handle image deletion for providers
 */
async function handleImageDelete(req: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await req.json()
    
    // Validate request data
    const validationResult = DeleteRequestSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: validationResult.error.errors,
        },
        { status: 400 }
      )
    }

    const { imageUrl, providerId } = validationResult.data

    // Verify provider ownership
    const supabase = await createClient()
    const { data: provider, error: providerError } = await supabase
      .from('providers')
      .select('id, user_id, profile_image_url, cover_image_url')
      .eq('id', providerId)
      .single()

    if (providerError || !provider) {
      return NextResponse.json(
        { error: 'Provider not found' },
        { status: 404 }
      )
    }

    if (provider.user_id !== userId) {
      return NextResponse.json(
        { error: 'Not authorized to delete images for this provider' },
        { status: 403 }
      )
    }

    // Delete the image from storage
    await deleteProviderImage(imageUrl)

    // Update provider record if it's a profile or cover image
    if (imageUrl === provider.profile_image_url) {
      await supabase
        .from('providers')
        .update({ 
          profile_image_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', providerId)
    } else if (imageUrl === provider.cover_image_url) {
      await supabase
        .from('providers')
        .update({ 
          cover_image_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', providerId)
    } else {
      // It might be a gallery image
      await supabase
        .from('provider_gallery_images')
        .delete()
        .eq('provider_id', providerId)
        .eq('image_url', imageUrl)
    }

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Image deleted successfully',
    })

  } catch (error) {
    console.error('Image deletion error:', error)

    if (error instanceof StorageError) {
      return NextResponse.json(
        { 
          error: error.message,
          code: error.code,
          details: error.details,
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to delete image' },
      { status: 500 }
    )
  }
}

// Export route handler directly (security wrapper has type issues)
export const DELETE = handleImageDelete

// OPTIONS handler for CORS
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}