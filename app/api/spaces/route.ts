import { NextRequest, NextResponse } from "next/server";
import { searchSpaces, createSpace } from "@/db/queries/spaces-queries";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { createSecureApiHandler, createApiResponse, createApiError, getValidatedBody, getValidatedQuery } from "@/lib/security/api-handler";
import { db } from "@/db";
import { providersTable } from "@/db/schema/providers-schema";
import { eq } from "drizzle-orm";

/**
 * Spaces API
 * GET /api/spaces - Search and list spaces with filters
 * POST /api/spaces - Create a new space (providers only)
 */

// Search filters schema
const searchFiltersSchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  spaceType: z.enum(["office", "studio", "venue", "meeting_room", "classroom", "gallery", "workshop", "coworking", "other"]).optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  neighborhood: z.string().optional(),
  minCapacity: z.coerce.number().min(1).optional(),
  maxCapacity: z.coerce.number().min(1).optional(),
  minSquareFeet: z.coerce.number().min(1).optional(),
  maxSquareFeet: z.coerce.number().min(1).optional(),
  amenities: z.string().optional().transform(val => val ? val.split(',').map(a => a.trim()) : undefined),
  hasWifi: z.coerce.boolean().optional(),
  hasParking: z.coerce.boolean().optional(),
  hasKitchen: z.coerce.boolean().optional(),
  hasAC: z.coerce.boolean().optional(),
  hasProjector: z.coerce.boolean().optional(),
  hasSoundSystem: z.coerce.boolean().optional(),
  isAccessible: z.coerce.boolean().optional(),
  hasElevator: z.coerce.boolean().optional(),
  allowsPets: z.coerce.boolean().optional(),
  hourlyRateMin: z.coerce.number().min(0).optional(),
  hourlyRateMax: z.coerce.number().min(0).optional(),
  dailyRateMin: z.coerce.number().min(0).optional(),
  dailyRateMax: z.coerce.number().min(0).optional(),
  weeklyRateMin: z.coerce.number().min(0).optional(),
  weeklyRateMax: z.coerce.number().min(0).optional(),
  instantBooking: z.coerce.boolean().optional(),
  featured: z.coerce.boolean().optional(),
  verified: z.coerce.boolean().optional(),
  providerId: z.string().uuid().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  radiusMiles: z.coerce.number().min(1).max(100).optional(),
  availableFrom: z.string().optional().transform(val => val ? new Date(val) : undefined),
  availableTo: z.string().optional().transform(val => val ? new Date(val) : undefined),
  sortBy: z.enum(["price_hourly", "price_daily", "capacity", "rating", "popularity", "distance", "created"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  page: z.coerce.number().min(1).optional(),
});

// Create space schema
const createSpaceSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  spaceType: z.enum(["office", "studio", "venue", "meeting_room", "classroom", "gallery", "workshop", "coworking", "other"]),
  category: z.string().min(1).max(50),
  
  // Location
  address: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(2).max(2),
  zipCode: z.string().min(5).max(10),
  country: z.string().default("US"),
  neighborhood: z.string().optional(),
  
  // Specifications
  capacity: z.number().min(1),
  squareFeet: z.number().min(1).optional(),
  ceilingHeight: z.number().min(1).optional(),
  floorNumber: z.number().optional(),
  
  // Features & Amenities
  amenities: z.array(z.string()).optional(),
  features: z.object({
    hasWifi: z.boolean().optional(),
    hasParking: z.boolean().optional(),
    hasKitchen: z.boolean().optional(),
    hasAC: z.boolean().optional(),
    hasHeating: z.boolean().optional(),
    hasProjector: z.boolean().optional(),
    hasSoundSystem: z.boolean().optional(),
    hasWhiteboard: z.boolean().optional(),
    isAccessible: z.boolean().optional(),
    hasElevator: z.boolean().optional(),
    hasOutdoorSpace: z.boolean().optional(),
    allowsPets: z.boolean().optional(),
    allowsSmoking: z.boolean().optional(),
    allowsAlcohol: z.boolean().optional(),
    allowsFood: z.boolean().optional(),
  }).optional(),
  equipment: z.array(z.string()).optional(),
  
  // Rules & Restrictions
  rules: z.array(z.string()).optional(),
  noiseLevel: z.enum(["quiet", "moderate", "loud"]).default("moderate"),
  
  // Pricing
  hourlyRate: z.number().min(0).optional(),
  halfDayRate: z.number().min(0).optional(),
  dailyRate: z.number().min(0).optional(),
  weeklyRate: z.number().min(0).optional(),
  monthlyRate: z.number().min(0).optional(),
  cleaningFee: z.number().min(0).optional(),
  securityDeposit: z.number().min(0).optional(),
  
  // Availability
  operatingHours: z.record(
    z.object({
      open: z.string(),
      close: z.string(),
    })
  ).optional(),
  minimumBookingDuration: z.number().min(30).default(60),
  maximumBookingDuration: z.number().min(60).optional(),
  advanceNoticeHours: z.number().min(0).default(24),
  bufferTimeBetweenBookings: z.number().min(0).default(30),
  
  // Media
  coverImageUrl: z.string().url().optional(),
  galleryImages: z.array(z.string().url()).optional(),
  virtualTourUrl: z.string().url().optional(),
  floorPlanUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
  
  // Settings
  instantBooking: z.boolean().default(false),
  requiresApproval: z.boolean().default(true),
  cancellationPolicy: z.enum(["flexible", "moderate", "strict", "super_strict"]).default("moderate"),
  cancellationPolicyDetails: z.object({
    fullRefundHours: z.number().optional(),
    partialRefundHours: z.number().optional(),
    partialRefundPercent: z.number().optional(),
  }).optional(),
  
  // SEO
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
}).refine(data => {
  // At least one pricing option must be provided
  if (!data.hourlyRate && !data.dailyRate && !data.weeklyRate && !data.monthlyRate) {
    throw new Error("At least one pricing option must be provided");
  }
  return true;
});

/**
 * GET handler - Search and list spaces
 */
async function handleGetSpaces(req: NextRequest) {
  try {
    const filters = getValidatedQuery<z.infer<typeof searchFiltersSchema>>(req);
    
    if (!filters) {
      return createApiError("Invalid query parameters", { status: 400 });
    }
    
    // Convert page to offset if provided
    if (filters.page) {
      filters.offset = (filters.page - 1) * filters.limit;
    }
    
    // Build features object from individual feature flags
    const features: any = {};
    if (filters.hasWifi !== undefined) features.hasWifi = filters.hasWifi;
    if (filters.hasParking !== undefined) features.hasParking = filters.hasParking;
    if (filters.hasKitchen !== undefined) features.hasKitchen = filters.hasKitchen;
    if (filters.hasAC !== undefined) features.hasAC = filters.hasAC;
    if (filters.hasProjector !== undefined) features.hasProjector = filters.hasProjector;
    if (filters.hasSoundSystem !== undefined) features.hasSoundSystem = filters.hasSoundSystem;
    if (filters.isAccessible !== undefined) features.isAccessible = filters.isAccessible;
    if (filters.hasElevator !== undefined) features.hasElevator = filters.hasElevator;
    if (filters.allowsPets !== undefined) features.allowsPets = filters.allowsPets;
    
    // Search spaces
    const result = await searchSpaces({
      query: filters.query,
      category: filters.category,
      spaceType: filters.spaceType,
      city: filters.city,
      state: filters.state,
      neighborhood: filters.neighborhood,
      minCapacity: filters.minCapacity,
      maxCapacity: filters.maxCapacity,
      minSquareFeet: filters.minSquareFeet,
      maxSquareFeet: filters.maxSquareFeet,
      amenities: filters.amenities,
      features: Object.keys(features).length > 0 ? features : undefined,
      hourlyRateMin: filters.hourlyRateMin,
      hourlyRateMax: filters.hourlyRateMax,
      dailyRateMin: filters.dailyRateMin,
      dailyRateMax: filters.dailyRateMax,
      weeklyRateMin: filters.weeklyRateMin,
      weeklyRateMax: filters.weeklyRateMax,
      instantBooking: filters.instantBooking,
      featured: filters.featured,
      verified: filters.verified,
      providerId: filters.providerId,
      latitude: filters.latitude,
      longitude: filters.longitude,
      radiusMiles: filters.radiusMiles,
      availableFrom: filters.availableFrom,
      availableTo: filters.availableTo,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
      limit: filters.limit,
      offset: filters.offset,
    });
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(result.total / filters.limit);
    const currentPage = Math.floor(filters.offset / filters.limit) + 1;
    
    // Transform spaces for frontend
    const transformedSpaces = result.spaces.map(space => ({
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
      coordinates: space.coordinates,
      distance: space.distance,
      capacity: space.capacity,
      squareFeet: space.squareFeet,
      amenities: space.amenities,
      features: space.features,
      equipment: space.equipment,
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
      viewCount: space.viewCount,
      favoriteCount: space.favoriteCount,
      totalBookings: space.totalBookings,
      averageRating: space.averageRating,
      totalReviews: space.totalReviews,
      provider: space.provider,
      createdAt: space.createdAt,
    }));
    
    return createApiResponse({
      spaces: transformedSpaces,
      pagination: {
        total: result.total,
        limit: filters.limit,
        offset: filters.offset,
        page: currentPage,
        totalPages,
        hasMore: result.hasMore,
      },
      filters: {
        query: filters.query,
        category: filters.category,
        spaceType: filters.spaceType,
        city: filters.city,
        state: filters.state,
        neighborhood: filters.neighborhood,
        minCapacity: filters.minCapacity,
        maxCapacity: filters.maxCapacity,
        amenities: filters.amenities,
        hourlyRateMin: filters.hourlyRateMin,
        hourlyRateMax: filters.hourlyRateMax,
        dailyRateMin: filters.dailyRateMin,
        dailyRateMax: filters.dailyRateMax,
        instantBooking: filters.instantBooking,
        verified: filters.verified,
      },
    });
    
  } catch (error) {
    console.error("Error in spaces search API:", error);
    return createApiError("Failed to search spaces", { 
      status: 500,
      details: error instanceof Error ? error.message : undefined
    });
  }
}

/**
 * POST handler - Create a new space
 */
async function handleCreateSpace(req: NextRequest, context: any) {
  try {
    const { userId } = context;
    const body = getValidatedBody<z.infer<typeof createSpaceSchema>>(req);
    
    if (!body) {
      return createApiError("Invalid request body", { status: 400 });
    }
    
    // Check if user is a provider
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.userId, userId))
      .limit(1);
    
    if (!provider) {
      return createApiError("Only providers can create spaces", { 
        status: 403,
        code: "NOT_PROVIDER"
      });
    }
    
    if (!provider.isActive) {
      return createApiError("Provider account is not active", { 
        status: 403,
        code: "PROVIDER_INACTIVE"
      });
    }
    
    // Create the space
    const space = await createSpace({
      ...body,
      providerId: provider.id,
      isActive: true,
      isVerified: false,
    });
    
    return createApiResponse(
      { space },
      { 
        status: 201,
        message: "Space created successfully"
      }
    );
    
  } catch (error) {
    console.error("Error creating space:", error);
    return createApiError("Failed to create space", { 
      status: 500,
      details: error instanceof Error ? error.message : undefined
    });
  }
}

// GET: Public endpoint for searching spaces
export const GET = createSecureApiHandler(
  handleGetSpaces,
  {
    requireAuth: false,
    validateQuery: searchFiltersSchema,
    rateLimit: { requests: 100, window: '1m' },
    auditLog: false,
    allowedMethods: ['GET'],
  }
);

// POST: Protected endpoint for creating spaces (providers only)
export const POST = createSecureApiHandler(
  handleCreateSpace,
  {
    requireAuth: true,
    validateBody: createSpaceSchema,
    rateLimit: { requests: 10, window: '1m' },
    auditLog: true,
    allowedMethods: ['POST'],
  }
);

// Health check
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}