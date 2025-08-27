import { NextRequest, NextResponse } from "next/server";
import { getFeaturedThings } from "@/db/queries/things-queries";
import { z } from "zod";
import { createSecureApiHandler, createApiResponse, createApiError, getValidatedQuery } from "@/lib/security/api-handler";

/**
 * Featured Things API
 * GET /api/things/featured - Get featured and trending items
 */

// Query schema
const featuredQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(50).default(12),
});

/**
 * GET handler - Get featured/trending things
 */
async function handleGetFeaturedThings(req: NextRequest) {
  try {
    const query = getValidatedQuery<z.infer<typeof featuredQuerySchema>>(req);
    
    if (!query) {
      return createApiError("Invalid query parameters", { status: 400 });
    }
    
    // Get featured things
    const things = await getFeaturedThings(query.limit);
    
    // Transform for frontend
    const transformedThings = things.map(thing => ({
      id: thing.id,
      title: thing.title,
      description: thing.description,
      category: thing.category,
      condition: thing.condition,
      brand: thing.brand,
      price: Number(thing.price),
      originalPrice: thing.originalPrice ? Number(thing.originalPrice) : null,
      negotiable: thing.negotiable,
      images: thing.images,
      thumbnailUrl: thing.thumbnailUrl,
      city: thing.city,
      state: thing.state,
      shippingAvailable: thing.shippingAvailable,
      localPickupOnly: thing.localPickupOnly,
      viewCount: thing.viewCount,
      favoriteCount: thing.favoriteCount,
      inquiryCount: thing.inquiryCount,
      featured: thing.featured,
      boosted: thing.boosted,
      createdAt: thing.createdAt,
      seller: thing.seller,
      popularity: thing.viewCount + (thing.favoriteCount * 2) + (thing.inquiryCount * 3),
    }));
    
    return createApiResponse({
      things: transformedThings,
      total: transformedThings.length,
    });
    
  } catch (error) {
    console.error("Error getting featured things:", error);
    return createApiError("Failed to get featured items", { 
      status: 500,
      details: error instanceof Error ? error.message : undefined
    });
  }
}

// GET: Public endpoint for featured things
export const GET = createSecureApiHandler(
  handleGetFeaturedThings,
  {
    requireAuth: false,
    validateQuery: featuredQuerySchema,
    rateLimit: { requests: 100, window: '1m' },
    auditLog: false,
    allowedMethods: ['GET'],
  }
);

// Health check
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}