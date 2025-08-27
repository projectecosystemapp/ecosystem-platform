import { NextRequest, NextResponse } from "next/server";
import { searchThings, createThing } from "@/db/queries/things-queries";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { createSecureApiHandler, createApiResponse, createApiError, getValidatedBody, getValidatedQuery } from "@/lib/security/api-handler";
import { db } from "@/db";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq } from "drizzle-orm";

/**
 * Things/Marketplace API
 * GET /api/things - Search and list things with filters
 * POST /api/things - Create a new thing listing (authenticated users only)
 */

// Search filters schema
const searchFiltersSchema = z.object({
  query: z.string().optional(),
  category: z.enum([
    "electronics",
    "furniture",
    "clothing",
    "tools",
    "sports",
    "books",
    "toys",
    "appliances",
    "automotive",
    "garden",
    "music",
    "art",
    "collectibles",
    "other",
  ]).optional(),
  subcategory: z.string().optional(),
  condition: z.string().optional().transform(val => val ? val.split(',').map(c => c.trim()) : undefined),
  brand: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  negotiable: z.coerce.boolean().optional(),
  shippingAvailable: z.coerce.boolean().optional(),
  localPickupOnly: z.coerce.boolean().optional(),
  status: z.string().optional().transform(val => val ? val.split(',').map(s => s.trim()) : undefined),
  featured: z.coerce.boolean().optional(),
  sellerId: z.string().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  radiusMiles: z.coerce.number().min(1).max(100).optional(),
  sortBy: z.enum(["price", "created", "views", "distance", "popularity"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  page: z.coerce.number().min(1).optional(),
});

// Create thing schema
const createThingSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(10).max(5000),
  category: z.enum([
    "electronics",
    "furniture",
    "clothing",
    "tools",
    "sports",
    "books",
    "toys",
    "appliances",
    "automotive",
    "garden",
    "music",
    "art",
    "collectibles",
    "other",
  ]),
  subcategory: z.string().optional(),
  condition: z.enum([
    "new",
    "like_new",
    "excellent",
    "good",
    "fair",
    "for_parts",
  ]),
  brand: z.string().optional(),
  model: z.string().optional(),
  
  // Pricing
  price: z.number().min(0),
  originalPrice: z.number().min(0).optional(),
  negotiable: z.boolean().default(false),
  currency: z.string().default("USD"),
  
  // Media
  images: z.array(z.string().url()).min(1).max(10),
  thumbnailUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
  
  // Location
  location: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(2).max(2),
  zipCode: z.string().min(5).max(10),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  
  // Availability
  quantity: z.number().min(1).default(1),
  availableFrom: z.string().optional().transform(val => val ? new Date(val) : undefined),
  availableUntil: z.string().optional().transform(val => val ? new Date(val) : undefined),
  
  // Delivery options
  shippingAvailable: z.boolean().default(false),
  shippingCost: z.number().min(0).optional(),
  localPickupOnly: z.boolean().default(true),
  deliveryRadius: z.number().min(1).max(100).optional(),
  
  // Contact preferences
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional(),
  preferredContact: z.enum(["app", "email", "phone", "text"]).default("app"),
  
  // Additional details
  specifications: z.record(z.string(), z.any()).optional(),
  tags: z.array(z.string()).max(10).optional(),
  yearManufactured: z.number().min(1900).max(new Date().getFullYear() + 1).optional(),
  dimensions: z.object({
    length: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    weight: z.number().optional(),
    unit: z.string().optional(),
  }).optional(),
  
  // SEO
  keywords: z.string().optional(),
}).refine(data => {
  // Validate shipping settings
  if (data.shippingAvailable && !data.shippingCost) {
    throw new Error("Shipping cost is required when shipping is available");
  }
  if (!data.shippingAvailable && !data.localPickupOnly) {
    throw new Error("Either shipping or local pickup must be available");
  }
  if (data.originalPrice && data.originalPrice <= data.price) {
    throw new Error("Original price must be higher than current price");
  }
  return true;
});

/**
 * GET handler - Search and list things
 */
async function handleGetThings(req: NextRequest) {
  try {
    const filters = getValidatedQuery<z.infer<typeof searchFiltersSchema>>(req);
    
    if (!filters) {
      return createApiError("Invalid query parameters", { status: 400 });
    }
    
    // Convert page to offset if provided
    if (filters.page) {
      filters.offset = (filters.page - 1) * filters.limit;
    }
    
    // Search things
    const result = await searchThings({
      query: filters.query,
      category: filters.category,
      subcategory: filters.subcategory,
      condition: filters.condition,
      brand: filters.brand,
      city: filters.city,
      state: filters.state,
      zipCode: filters.zipCode,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      negotiable: filters.negotiable,
      shippingAvailable: filters.shippingAvailable,
      localPickupOnly: filters.localPickupOnly,
      status: filters.status,
      featured: filters.featured,
      sellerId: filters.sellerId,
      latitude: filters.latitude,
      longitude: filters.longitude,
      radiusMiles: filters.radiusMiles,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
      limit: filters.limit,
      offset: filters.offset,
    });
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(result.total / filters.limit);
    const currentPage = Math.floor(filters.offset / filters.limit) + 1;
    
    // Transform things for frontend
    const transformedThings = result.things.map(thing => ({
      id: thing.id,
      title: thing.title,
      description: thing.description,
      category: thing.category,
      subcategory: thing.subcategory,
      condition: thing.condition,
      brand: thing.brand,
      model: thing.model,
      price: Number(thing.price),
      originalPrice: thing.originalPrice ? Number(thing.originalPrice) : null,
      negotiable: thing.negotiable,
      currency: thing.currency,
      images: thing.images,
      thumbnailUrl: thing.thumbnailUrl,
      videoUrl: thing.videoUrl,
      location: thing.location,
      city: thing.city,
      state: thing.state,
      zipCode: thing.zipCode,
      distance: thing.distance,
      status: thing.status,
      quantity: thing.quantity,
      shippingAvailable: thing.shippingAvailable,
      shippingCost: thing.shippingCost ? Number(thing.shippingCost) : null,
      localPickupOnly: thing.localPickupOnly,
      deliveryRadius: thing.deliveryRadius,
      specifications: thing.specifications,
      tags: thing.tags,
      yearManufactured: thing.yearManufactured,
      dimensions: thing.dimensions,
      viewCount: thing.viewCount,
      favoriteCount: thing.favoriteCount,
      inquiryCount: thing.inquiryCount,
      featured: thing.featured,
      boosted: thing.boosted,
      createdAt: thing.createdAt,
      seller: thing.seller,
    }));
    
    return createApiResponse({
      things: transformedThings,
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
        subcategory: filters.subcategory,
        condition: filters.condition,
        brand: filters.brand,
        city: filters.city,
        state: filters.state,
        zipCode: filters.zipCode,
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        negotiable: filters.negotiable,
        shippingAvailable: filters.shippingAvailable,
        localPickupOnly: filters.localPickupOnly,
        featured: filters.featured,
      },
    });
    
  } catch (error) {
    console.error("Error in things search API:", error);
    return createApiError("Failed to search things", { 
      status: 500,
      details: error instanceof Error ? error.message : undefined
    });
  }
}

/**
 * POST handler - Create a new thing listing
 */
async function handleCreateThing(req: NextRequest, context: any) {
  try {
    const { userId } = context;
    const body = getValidatedBody<z.infer<typeof createThingSchema>>(req);
    
    if (!body) {
      return createApiError("Invalid request body", { status: 400 });
    }
    
    // Check if user has a profile
    const [profile] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, userId))
      .limit(1);
    
    if (!profile) {
      return createApiError("User profile not found. Please complete your profile first.", { 
        status: 403,
        code: "PROFILE_REQUIRED"
      });
    }
    
    // Create the thing listing
    const thing = await createThing({
      ...body,
      sellerId: userId,
      status: "active",
      price: body.price.toString(),
      originalPrice: body.originalPrice?.toString(),
      shippingCost: body.shippingCost?.toString(),
      latitude: body.latitude?.toString(),
      longitude: body.longitude?.toString(),
      viewCount: 0,
      favoriteCount: 0,
      inquiryCount: 0,
      featured: false,
      boosted: false,
    });
    
    return createApiResponse(
      { thing },
      { 
        status: 201,
        message: "Listing created successfully"
      }
    );
    
  } catch (error) {
    console.error("Error creating thing:", error);
    return createApiError("Failed to create listing", { 
      status: 500,
      details: error instanceof Error ? error.message : undefined
    });
  }
}

// GET: Public endpoint for searching things
export const GET = createSecureApiHandler(
  handleGetThings,
  {
    requireAuth: false,
    validateQuery: searchFiltersSchema,
    rateLimit: { requests: 100, window: '1m' },
    auditLog: false,
    allowedMethods: ['GET'],
  }
);

// POST: Protected endpoint for creating things (authenticated users only)
export const POST = createSecureApiHandler(
  handleCreateThing,
  {
    requireAuth: true,
    validateBody: createThingSchema,
    rateLimit: { requests: 10, window: '1m' },
    auditLog: true,
    allowedMethods: ['POST'],
  }
);

// Health check
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}