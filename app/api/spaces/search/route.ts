import { NextRequest, NextResponse } from "next/server";
import { searchSpaces, searchSpacesByAmenities } from "@/db/queries/spaces-queries";
import { z } from "zod";
import { createSecureApiHandler, createApiResponse, createApiError, getValidatedQuery } from "@/lib/security/api-handler";

/**
 * Spaces Advanced Search API
 * GET /api/spaces/search - Advanced search for spaces by features and amenities
 */

// Advanced search schema
const advancedSearchSchema = z.object({
  // Text search
  q: z.string().optional(),
  
  // Location
  location: z.string().optional(), // Can be "City, State" or just "City"
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().min(1).max(100).default(25),
  
  // Space specifications
  type: z.string().optional(), // Comma-separated list of space types
  minCapacity: z.coerce.number().min(1).optional(),
  maxCapacity: z.coerce.number().min(1).optional(),
  minSize: z.coerce.number().min(1).optional(), // Square feet
  maxSize: z.coerce.number().min(1).optional(),
  
  // Amenities (comma-separated)
  amenities: z.string().optional(),
  mustHaveWifi: z.coerce.boolean().optional(),
  mustHaveParking: z.coerce.boolean().optional(),
  mustHaveKitchen: z.coerce.boolean().optional(),
  mustHaveAC: z.coerce.boolean().optional(),
  mustHaveProjector: z.coerce.boolean().optional(),
  mustHaveSoundSystem: z.coerce.boolean().optional(),
  mustBeAccessible: z.coerce.boolean().optional(),
  mustHaveElevator: z.coerce.boolean().optional(),
  petFriendly: z.coerce.boolean().optional(),
  
  // Pricing
  budget: z.enum(["hourly", "daily", "weekly"]).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  
  // Availability
  dateFrom: z.string().optional().transform(val => val ? new Date(val) : undefined),
  dateTo: z.string().optional().transform(val => val ? new Date(val) : undefined),
  
  // Booking preferences
  instantBook: z.coerce.boolean().optional(),
  verified: z.coerce.boolean().optional(),
  noDeposit: z.coerce.boolean().optional(),
  
  // Sorting
  sort: z.enum(["relevance", "price_low", "price_high", "rating", "popular", "newest", "distance"]).default("relevance"),
  
  // Pagination
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
});

/**
 * GET handler - Advanced search
 */
async function handleAdvancedSearch(req: NextRequest) {
  try {
    const query = getValidatedQuery<z.infer<typeof advancedSearchSchema>>(req);
    
    if (!query) {
      return createApiError("Invalid query parameters", { status: 400 });
    }
    
    // Parse location if provided
    let city: string | undefined;
    let state: string | undefined;
    if (query.location) {
      const parts = query.location.split(',').map(p => p.trim());
      city = parts[0];
      state = parts.length > 1 ? parts[1] : undefined;
    }
    
    // Parse space types
    const spaceTypes = query.type ? query.type.split(',').map(t => t.trim()) : undefined;
    
    // Parse amenities
    const requiredAmenities: string[] = [];
    if (query.amenities) {
      requiredAmenities.push(...query.amenities.split(',').map(a => a.trim()));
    }
    
    // Add feature-based amenities
    if (query.mustHaveWifi) requiredAmenities.push("WiFi");
    if (query.mustHaveParking) requiredAmenities.push("Parking");
    if (query.mustHaveKitchen) requiredAmenities.push("Kitchen");
    if (query.mustHaveAC) requiredAmenities.push("Air Conditioning");
    if (query.mustHaveProjector) requiredAmenities.push("Projector");
    if (query.mustHaveSoundSystem) requiredAmenities.push("Sound System");
    if (query.mustBeAccessible) requiredAmenities.push("Wheelchair Accessible");
    if (query.mustHaveElevator) requiredAmenities.push("Elevator");
    if (query.petFriendly) requiredAmenities.push("Pet Friendly");
    
    // Build features filter
    const features: any = {};
    if (query.mustHaveWifi !== undefined) features.hasWifi = query.mustHaveWifi;
    if (query.mustHaveParking !== undefined) features.hasParking = query.mustHaveParking;
    if (query.mustHaveKitchen !== undefined) features.hasKitchen = query.mustHaveKitchen;
    if (query.mustHaveAC !== undefined) features.hasAC = query.mustHaveAC;
    if (query.mustHaveProjector !== undefined) features.hasProjector = query.mustHaveProjector;
    if (query.mustHaveSoundSystem !== undefined) features.hasSoundSystem = query.mustHaveSoundSystem;
    if (query.mustBeAccessible !== undefined) features.isAccessible = query.mustBeAccessible;
    if (query.mustHaveElevator !== undefined) features.hasElevator = query.mustHaveElevator;
    if (query.petFriendly !== undefined) features.allowsPets = query.petFriendly;
    
    // Determine price range based on budget type
    let hourlyMin: number | undefined;
    let hourlyMax: number | undefined;
    let dailyMin: number | undefined;
    let dailyMax: number | undefined;
    let weeklyMin: number | undefined;
    let weeklyMax: number | undefined;
    
    if (query.budget === "hourly") {
      hourlyMin = query.minPrice;
      hourlyMax = query.maxPrice;
    } else if (query.budget === "daily") {
      dailyMin = query.minPrice;
      dailyMax = query.maxPrice;
    } else if (query.budget === "weekly") {
      weeklyMin = query.minPrice;
      weeklyMax = query.maxPrice;
    } else {
      // Apply to all if no specific budget type
      hourlyMin = query.minPrice;
      hourlyMax = query.maxPrice;
      dailyMin = query.minPrice;
      dailyMax = query.maxPrice;
      weeklyMin = query.minPrice;
      weeklyMax = query.maxPrice;
    }
    
    // Map sort parameter to sortBy and sortOrder
    let sortBy: any = "created";
    let sortOrder: "asc" | "desc" = "desc";
    
    switch (query.sort) {
      case "price_low":
        sortBy = query.budget === "daily" ? "price_daily" : 
                 query.budget === "weekly" ? "price_weekly" : "price_hourly";
        sortOrder = "asc";
        break;
      case "price_high":
        sortBy = query.budget === "daily" ? "price_daily" : 
                 query.budget === "weekly" ? "price_weekly" : "price_hourly";
        sortOrder = "desc";
        break;
      case "rating":
        sortBy = "rating";
        sortOrder = "desc";
        break;
      case "popular":
        sortBy = "popularity";
        sortOrder = "desc";
        break;
      case "newest":
        sortBy = "created";
        sortOrder = "desc";
        break;
      case "distance":
        if (query.latitude && query.longitude) {
          sortBy = "distance";
          sortOrder = "asc";
        }
        break;
      case "relevance":
      default:
        if (query.q) {
          sortBy = "popularity"; // Use popularity as proxy for relevance
        }
        break;
    }
    
    // Calculate offset
    const offset = (query.page - 1) * query.limit;
    
    // If searching specifically by amenities
    if (requiredAmenities.length > 0 && !query.q && !city && !spaceTypes) {
      const spaces = await searchSpacesByAmenities(requiredAmenities, query.limit);
      
      return createApiResponse({
        spaces: spaces.map(space => ({
          id: space.id,
          name: space.name,
          slug: space.slug,
          description: space.description,
          spaceType: space.spaceType,
          category: space.category,
          address: space.address,
          city: space.city,
          state: space.state,
          capacity: space.capacity,
          amenities: space.amenities,
          features: space.features,
          hourlyRate: space.hourlyRate ? Number(space.hourlyRate) : null,
          dailyRate: space.dailyRate ? Number(space.dailyRate) : null,
          weeklyRate: space.weeklyRate ? Number(space.weeklyRate) : null,
          coverImageUrl: space.coverImageUrl,
          instantBooking: space.instantBooking,
          provider: space.provider,
        })),
        total: spaces.length,
        page: query.page,
        totalPages: 1,
        searchCriteria: {
          amenities: requiredAmenities,
        },
      });
    }
    
    // Perform general search
    const result = await searchSpaces({
      query: query.q,
      spaceType: spaceTypes && spaceTypes.length === 1 ? spaceTypes[0] as any : undefined,
      city,
      state,
      minCapacity: query.minCapacity,
      maxCapacity: query.maxCapacity,
      minSquareFeet: query.minSize,
      maxSquareFeet: query.maxSize,
      amenities: requiredAmenities.length > 0 ? requiredAmenities : undefined,
      features: Object.keys(features).length > 0 ? features : undefined,
      hourlyRateMin: hourlyMin,
      hourlyRateMax: hourlyMax,
      dailyRateMin: dailyMin,
      dailyRateMax: dailyMax,
      weeklyRateMin: weeklyMin,
      weeklyRateMax: weeklyMax,
      instantBooking: query.instantBook,
      verified: query.verified,
      latitude: query.latitude,
      longitude: query.longitude,
      radiusMiles: query.radius,
      availableFrom: query.dateFrom,
      availableTo: query.dateTo,
      sortBy,
      sortOrder,
      limit: query.limit,
      offset,
    });
    
    // Filter by no deposit if requested
    let filteredSpaces = result.spaces;
    if (query.noDeposit) {
      filteredSpaces = filteredSpaces.filter(space => 
        !space.securityDeposit || Number(space.securityDeposit) === 0
      );
    }
    
    // Filter by multiple space types if provided
    if (spaceTypes && spaceTypes.length > 1) {
      filteredSpaces = filteredSpaces.filter(space => 
        spaceTypes.includes(space.spaceType)
      );
    }
    
    // Calculate total pages
    const totalPages = Math.ceil(result.total / query.limit);
    
    // Transform results
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
      distance: space.distance,
      capacity: space.capacity,
      squareFeet: space.squareFeet,
      amenities: space.amenities,
      features: space.features,
      hourlyRate: space.hourlyRate ? Number(space.hourlyRate) : null,
      dailyRate: space.dailyRate ? Number(space.dailyRate) : null,
      weeklyRate: space.weeklyRate ? Number(space.weeklyRate) : null,
      cleaningFee: space.cleaningFee ? Number(space.cleaningFee) : null,
      securityDeposit: space.securityDeposit ? Number(space.securityDeposit) : null,
      coverImageUrl: space.coverImageUrl,
      galleryImages: space.galleryImages,
      instantBooking: space.instantBooking,
      requiresApproval: space.requiresApproval,
      isVerified: space.isVerified,
      averageRating: space.averageRating,
      totalReviews: space.totalReviews,
      provider: space.provider,
      
      // Calculate match score for relevance
      matchScore: calculateMatchScore(space, query),
    }));
    
    // Sort by match score if relevance sorting
    if (query.sort === "relevance") {
      transformedSpaces.sort((a, b) => b.matchScore - a.matchScore);
    }
    
    return createApiResponse({
      spaces: transformedSpaces,
      pagination: {
        total: result.total,
        page: query.page,
        limit: query.limit,
        totalPages,
        hasMore: query.page < totalPages,
      },
      searchCriteria: {
        query: query.q,
        location: query.location,
        spaceTypes,
        amenities: requiredAmenities,
        budget: query.budget,
        priceRange: query.minPrice || query.maxPrice ? {
          min: query.minPrice,
          max: query.maxPrice,
        } : undefined,
        dateRange: query.dateFrom || query.dateTo ? {
          from: query.dateFrom,
          to: query.dateTo,
        } : undefined,
        instantBook: query.instantBook,
        verified: query.verified,
      },
    });
    
  } catch (error) {
    console.error("Error in advanced spaces search:", error);
    return createApiError("Failed to search spaces", { 
      status: 500,
      details: error instanceof Error ? error.message : undefined
    });
  }
}

/**
 * Calculate match score for relevance sorting
 */
function calculateMatchScore(space: any, query: any): number {
  let score = 0;
  
  // Text match in name/description
  if (query.q) {
    const searchTerm = query.q.toLowerCase();
    if (space.name.toLowerCase().includes(searchTerm)) score += 50;
    if (space.description?.toLowerCase().includes(searchTerm)) score += 20;
  }
  
  // Verified spaces get a boost
  if (space.isVerified) score += 30;
  
  // Rating boost
  if (space.averageRating) {
    score += space.averageRating * 10;
  }
  
  // Popularity boost
  score += Math.min(space.totalBookings, 20);
  score += Math.min(space.totalReviews * 2, 20);
  
  // Instant booking preference
  if (query.instantBook && space.instantBooking) score += 25;
  
  // Distance penalty (if location search)
  if (space.distance !== null && space.distance !== undefined) {
    score -= Math.min(space.distance * 2, 50);
  }
  
  return score;
}

// GET: Public endpoint for advanced search
export const GET = createSecureApiHandler(
  handleAdvancedSearch,
  {
    requireAuth: false,
    validateQuery: advancedSearchSchema,
    rateLimit: { requests: 60, window: '1m' },
    auditLog: false,
    allowedMethods: ['GET'],
  }
);

// Health check
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}