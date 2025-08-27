import { NextRequest, NextResponse } from "next/server";
import { searchEvents, createEvent } from "@/db/queries/events-queries";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { createSecureApiHandler, createApiResponse, createApiError, getValidatedBody, getValidatedQuery } from "@/lib/security/api-handler";
import { db } from "@/db";
import { providersTable } from "@/db/schema/providers-schema";
import { eq } from "drizzle-orm";

/**
 * Events API
 * GET /api/events - Search and list events with filters
 * POST /api/events - Create a new event (providers only)
 */

// Search filters schema
const searchFiltersSchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  eventType: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  startDateFrom: z.string().optional().transform(val => val ? new Date(val) : undefined),
  startDateTo: z.string().optional().transform(val => val ? new Date(val) : undefined),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  locationType: z.enum(["in_person", "virtual", "hybrid"]).optional(),
  hasAvailability: z.coerce.boolean().optional(),
  featured: z.coerce.boolean().optional(),
  providerId: z.string().uuid().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  radiusMiles: z.coerce.number().min(1).max(100).optional(),
  sortBy: z.enum(["date", "price", "popularity", "distance"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  page: z.coerce.number().min(1).optional(),
});

// Create event schema
const createEventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  eventType: z.string().min(1).max(50),
  category: z.string().min(1).max(50),
  tags: z.array(z.string()).optional(),
  
  // Timing
  startDateTime: z.string().transform(val => new Date(val)),
  endDateTime: z.string().transform(val => new Date(val)),
  timezone: z.string().default("America/Los_Angeles"),
  recurringPattern: z.object({
    frequency: z.enum(["daily", "weekly", "monthly"]).optional(),
    interval: z.number().optional(),
    daysOfWeek: z.array(z.number()).optional(),
    endDate: z.string().optional(),
  }).optional(),
  
  // Location
  locationType: z.enum(["in_person", "virtual", "hybrid"]),
  virtualLink: z.string().url().optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  
  // Capacity & Pricing
  maxAttendees: z.number().min(1).optional(),
  price: z.number().min(0),
  earlyBirdPrice: z.number().min(0).optional(),
  earlyBirdDeadline: z.string().optional().transform(val => val ? new Date(val) : undefined),
  
  // Media
  coverImageUrl: z.string().url().optional(),
  galleryImages: z.array(z.string().url()).optional(),
  
  // Settings
  instantBooking: z.boolean().default(true),
  requiresApproval: z.boolean().default(false),
  cancellationPolicy: z.enum(["flexible", "moderate", "strict"]).default("flexible"),
  refundPolicy: z.object({
    fullRefundHours: z.number().optional(),
    partialRefundHours: z.number().optional(),
    partialRefundPercent: z.number().optional(),
  }).optional(),
  
  // SEO
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
}).refine(data => {
  if (data.endDateTime <= data.startDateTime) {
    throw new Error("End time must be after start time");
  }
  if (data.earlyBirdPrice && data.earlyBirdPrice >= data.price) {
    throw new Error("Early bird price must be less than regular price");
  }
  if (data.locationType === "in_person" && !data.address) {
    throw new Error("Address is required for in-person events");
  }
  if (data.locationType === "virtual" && !data.virtualLink) {
    throw new Error("Virtual link is required for virtual events");
  }
  return true;
});

/**
 * GET handler - Search and list events
 */
async function handleGetEvents(req: NextRequest) {
  try {
    const filters = getValidatedQuery<z.infer<typeof searchFiltersSchema>>(req);
    
    if (!filters) {
      return createApiError("Invalid query parameters", { status: 400 });
    }
    
    // Convert page to offset if provided
    if (filters.page) {
      filters.offset = (filters.page - 1) * filters.limit;
    }
    
    // Search events
    const result = await searchEvents({
      query: filters.query,
      category: filters.category,
      eventType: filters.eventType,
      city: filters.city,
      state: filters.state,
      startDateFrom: filters.startDateFrom,
      startDateTo: filters.startDateTo,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      locationType: filters.locationType,
      hasAvailability: filters.hasAvailability,
      featured: filters.featured,
      providerId: filters.providerId,
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
    
    // Transform events for frontend
    const transformedEvents = result.events.map(event => ({
      id: event.id,
      title: event.title,
      description: event.description,
      eventType: event.eventType,
      category: event.category,
      tags: event.tags,
      startDateTime: event.startDateTime,
      endDateTime: event.endDateTime,
      timezone: event.timezone,
      locationType: event.locationType,
      virtualLink: event.locationType !== "in_person" ? event.virtualLink : undefined,
      address: event.locationType !== "virtual" ? event.address : undefined,
      distance: event.distance,
      price: Number(event.price),
      earlyBirdPrice: event.earlyBirdPrice ? Number(event.earlyBirdPrice) : null,
      earlyBirdDeadline: event.earlyBirdDeadline,
      maxAttendees: event.maxAttendees,
      currentAttendees: event.currentAttendees,
      availableSpots: event.availableSpots,
      coverImageUrl: event.coverImageUrl,
      galleryImages: event.galleryImages,
      instantBooking: event.instantBooking,
      requiresApproval: event.requiresApproval,
      isFeatured: event.isFeatured,
      viewCount: event.viewCount,
      favoriteCount: event.favoriteCount,
      slug: event.slug,
      provider: event.provider,
      createdAt: event.createdAt,
    }));
    
    return createApiResponse({
      events: transformedEvents,
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
        eventType: filters.eventType,
        city: filters.city,
        state: filters.state,
        startDateFrom: filters.startDateFrom,
        startDateTo: filters.startDateTo,
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        locationType: filters.locationType,
        hasAvailability: filters.hasAvailability,
        featured: filters.featured,
      },
    });
    
  } catch (error) {
    console.error("Error in events search API:", error);
    return createApiError("Failed to search events", { 
      status: 500,
      details: error instanceof Error ? error.message : undefined
    });
  }
}

/**
 * POST handler - Create a new event
 */
async function handleCreateEvent(req: NextRequest, context: any) {
  try {
    const { userId } = context;
    const body = getValidatedBody<z.infer<typeof createEventSchema>>(req);
    
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
      return createApiError("Only providers can create events", { 
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
    
    // Create the event
    const event = await createEvent({
      ...body,
      providerId: provider.id,
      status: "published", // Auto-publish for now, can add draft mode later
      publishedAt: new Date(),
    });
    
    return createApiResponse(
      { event },
      { 
        status: 201,
        message: "Event created successfully"
      }
    );
    
  } catch (error) {
    console.error("Error creating event:", error);
    return createApiError("Failed to create event", { 
      status: 500,
      details: error instanceof Error ? error.message : undefined
    });
  }
}

// GET: Public endpoint for searching events
export const GET = createSecureApiHandler(
  handleGetEvents,
  {
    requireAuth: false,
    validateQuery: searchFiltersSchema,
    rateLimit: { requests: 100, window: '1m' },
    auditLog: false,
    allowedMethods: ['GET'],
  }
);

// POST: Protected endpoint for creating events (providers only)
export const POST = createSecureApiHandler(
  handleCreateEvent,
  {
    requireAuth: true,
    validateBody: createEventSchema,
    rateLimit: { requests: 10, window: '1m' },
    auditLog: true,
    allowedMethods: ['POST'],
  }
);

// Health check
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}