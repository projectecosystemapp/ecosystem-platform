import { NextRequest, NextResponse } from "next/server";
import { getFeaturedSpaces } from "@/db/queries/spaces-queries";
import { z } from "zod";
import { createSecureApiHandler, createApiResponse, createApiError, getValidatedQuery } from "@/lib/security/api-handler";

/**
 * Featured Spaces API
 * GET /api/spaces/featured - Get featured/popular spaces
 */

// Query schema
const featuredQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(50).default(10),
  city: z.string().optional(),
  state: z.string().optional(),
  spaceType: z.enum(["office", "studio", "venue", "meeting_room", "classroom", "gallery", "workshop", "coworking", "other"]).optional(),
});

/**
 * GET handler - Get featured spaces
 */
async function handleGetFeaturedSpaces(req: NextRequest) {
  try {
    const query = getValidatedQuery<z.infer<typeof featuredQuerySchema>>(req);
    
    if (!query) {
      return createApiError("Invalid query parameters", { status: 400 });
    }
    
    // Get featured spaces
    const spaces = await getFeaturedSpaces(query.limit);
    
    // Filter by location if provided
    let filteredSpaces = spaces;
    if (query.city) {
      filteredSpaces = filteredSpaces.filter(space => 
        space.city.toLowerCase().includes(query.city!.toLowerCase())
      );
    }
    if (query.state) {
      filteredSpaces = filteredSpaces.filter(space => 
        space.state.toLowerCase() === query.state!.toLowerCase()
      );
    }
    if (query.spaceType) {
      filteredSpaces = filteredSpaces.filter(space => 
        space.spaceType === query.spaceType
      );
    }
    
    // Transform for frontend
    const transformedSpaces = filteredSpaces.map(space => ({
      id: space.id,
      name: space.name,
      slug: space.slug,
      description: space.description,
      spaceType: space.spaceType,
      category: space.category,
      address: space.address,
      city: space.city,
      state: space.state,
      zipCode: space.zipCode,
      neighborhood: space.neighborhood,
      capacity: space.capacity,
      squareFeet: space.squareFeet,
      amenities: space.amenities,
      features: space.features,
      hourlyRate: space.hourlyRate ? Number(space.hourlyRate) : null,
      dailyRate: space.dailyRate ? Number(space.dailyRate) : null,
      weeklyRate: space.weeklyRate ? Number(space.weeklyRate) : null,
      coverImageUrl: space.coverImageUrl,
      galleryImages: space.galleryImages,
      instantBooking: space.instantBooking,
      isVerified: space.isVerified,
      totalBookings: space.totalBookings,
      favoriteCount: space.favoriteCount,
      averageRating: space.averageRating,
      totalReviews: space.totalReviews,
      provider: space.provider,
      
      // Calculate a popularity score for sorting
      popularityScore: (
        (space.averageRating || 0) * 10 +
        space.totalBookings * 2 +
        space.favoriteCount +
        (space.isVerified ? 20 : 0)
      ),
    }));
    
    // Sort by popularity score (already sorted by query, but we can re-sort after filtering)
    transformedSpaces.sort((a, b) => b.popularityScore - a.popularityScore);
    
    return createApiResponse({
      spaces: transformedSpaces,
      total: transformedSpaces.length,
      filters: {
        city: query.city,
        state: query.state,
        spaceType: query.spaceType,
      },
    });
    
  } catch (error) {
    console.error("Error fetching featured spaces:", error);
    return createApiError("Failed to fetch featured spaces", { 
      status: 500,
      details: error instanceof Error ? error.message : undefined
    });
  }
}

// GET: Public endpoint for featured spaces
export const GET = createSecureApiHandler(
  handleGetFeaturedSpaces,
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