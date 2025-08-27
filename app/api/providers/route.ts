import { NextRequest, NextResponse } from "next/server";
import { searchProviders, getFeaturedProviders } from "@/db/queries/providers-queries";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { createSecureApiHandler } from "@/lib/security/api-handler";

/**
 * Provider Search and Listing API
 * GET /api/providers - Search and list providers with filters
 */

// Search filters schema
const searchFiltersSchema = z.object({
  query: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  isVerified: z.coerce.boolean().optional(),
  featured: z.coerce.boolean().optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
  offset: z.coerce.number().min(0).default(0),
  page: z.coerce.number().min(1).optional(),
});

async function handleGetProviders(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    
    // Parse and validate query parameters
    const rawFilters = Object.fromEntries(searchParams.entries());
    const parseResult = searchFiltersSchema.safeParse(rawFilters);
    
    if (!parseResult.success) {
      return NextResponse.json(
        { 
          error: "Invalid search parameters",
          details: parseResult.error.errors,
        },
        { status: 400 }
      );
    }
    
    const filters = parseResult.data;
    
    // Convert page to offset if provided
    if (filters.page) {
      filters.offset = (filters.page - 1) * filters.limit;
    }
    
    try {
      let providers;
      let total;
      
      // Handle featured providers request
      if (filters.featured) {
        const featuredProviders = await getFeaturedProviders(filters.limit);
        providers = featuredProviders;
        total = featuredProviders.length;
      } else {
        // Regular search
        const result = await searchProviders({
          query: filters.query,
          city: filters.city,
          state: filters.state,
          minPrice: filters.minPrice,
          maxPrice: filters.maxPrice,
          minRating: filters.minRating,
          isVerified: filters.isVerified,
          limit: filters.limit,
          offset: filters.offset,
        });
        
        providers = result.providers;
        total = result.total;
      }
      
      // Transform providers for frontend consumption
      const transformedProviders = providers.map((provider) => ({
        id: provider.id,
        displayName: provider.displayName,
        slug: provider.slug,
        tagline: provider.tagline,
        bio: provider.bio,
        profileImageUrl: provider.profileImageUrl,
        locationCity: provider.locationCity,
        locationState: provider.locationState,
        locationCountry: provider.locationCountry,
        hourlyRate: provider.hourlyRate,
        currency: provider.currency,
        averageRating: parseFloat(provider.averageRating?.toString() || "0"),
        totalReviews: provider.totalReviews,
        completedBookings: provider.completedBookings,
        isVerified: provider.isVerified,
        isActive: provider.isActive,
        services: provider.services,
        // Don't expose sensitive information
        stripeConnectAccountId: undefined,
        stripeOnboardingComplete: provider.stripeOnboardingComplete,
        createdAt: provider.createdAt,
        updatedAt: provider.updatedAt,
      }));
      
      // Calculate pagination metadata
      const hasMore = filters.offset + filters.limit < total;
      const totalPages = Math.ceil(total / filters.limit);
      const currentPage = Math.floor(filters.offset / filters.limit) + 1;
      
      return NextResponse.json({
        providers: transformedProviders,
        pagination: {
          total,
          limit: filters.limit,
          offset: filters.offset,
          page: currentPage,
          totalPages,
          hasMore,
        },
        filters: {
          query: filters.query,
          city: filters.city,
          state: filters.state,
          minPrice: filters.minPrice,
          maxPrice: filters.maxPrice,
          minRating: filters.minRating,
          isVerified: filters.isVerified,
          featured: filters.featured,
        },
      });
      
    } catch (dbError) {
      console.error("Database error in provider search:", dbError);
      return NextResponse.json(
        { error: "Failed to search providers" },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error("Error in provider search API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Apply secure API handler with validation
export const GET = createSecureApiHandler(
  handleGetProviders,
  {
    requireAuth: false, // Public API
    validateQuery: searchFiltersSchema,
    rateLimit: { requests: 100, window: '1m' },
    auditLog: false, // Don't log every provider search
    allowedMethods: ['GET', 'HEAD'],
  }
);

/**
 * Health check endpoint for providers API
 */
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}