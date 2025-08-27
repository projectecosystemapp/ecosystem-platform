import { NextRequest, NextResponse } from "next/server";
import { searchEvents } from "@/db/queries/events-queries";
import { z } from "zod";
import { createSecureApiHandler, createApiResponse, createApiError, getValidatedQuery } from "@/lib/security/api-handler";
import { getGeocoding } from "@/lib/geocoding";

/**
 * Event Search API with Advanced Filters
 * GET /api/events/search - Advanced search with location, date, and price filtering
 */

// Advanced search schema
const searchSchema = z.object({
  // Text search
  q: z.string().optional(), // Main search query
  
  // Location search
  location: z.string().optional(), // Free-form location (will be geocoded)
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().min(1).max(500).default(25), // Miles
  city: z.string().optional(),
  state: z.string().optional(),
  locationType: z.enum(["in_person", "virtual", "hybrid", "any"]).default("any"),
  
  // Date filters
  dateFrom: z.string().optional().transform(val => val ? new Date(val) : undefined),
  dateTo: z.string().optional().transform(val => val ? new Date(val) : undefined),
  timeOfDay: z.enum(["morning", "afternoon", "evening", "night", "any"]).optional(),
  dayOfWeek: z.array(z.coerce.number().min(0).max(6)).optional(), // 0=Sunday, 6=Saturday
  
  // Event attributes
  category: z.string().optional(),
  eventType: z.string().optional(),
  tags: z.array(z.string()).optional(),
  
  // Price filters
  priceMin: z.coerce.number().min(0).optional(),
  priceMax: z.coerce.number().optional(),
  freeOnly: z.coerce.boolean().optional(),
  hasEarlyBird: z.coerce.boolean().optional(),
  
  // Availability filters
  availableOnly: z.coerce.boolean().default(true),
  instantBooking: z.coerce.boolean().optional(),
  noApprovalRequired: z.coerce.boolean().optional(),
  
  // Provider filters
  providerId: z.string().uuid().optional(),
  verifiedProvidersOnly: z.coerce.boolean().optional(),
  
  // Sorting and pagination
  sort: z.enum(["relevance", "date", "price", "popularity", "distance"]).default("relevance"),
  order: z.enum(["asc", "desc"]).default("asc"),
  limit: z.coerce.number().min(1).max(100).default(20),
  page: z.coerce.number().min(1).default(1),
  
  // Response options
  includeStats: z.coerce.boolean().default(false),
  includeFacets: z.coerce.boolean().default(false),
});

/**
 * GET handler - Advanced event search
 */
async function handleSearchEvents(req: NextRequest) {
  try {
    const params = getValidatedQuery<z.infer<typeof searchSchema>>(req);
    
    if (!params) {
      return createApiError("Invalid search parameters", { status: 400 });
    }
    
    // Handle location geocoding if provided
    let coordinates = null;
    if (params.location && !params.lat && !params.lng) {
      try {
        const geocoded = await getGeocoding(params.location);
        if (geocoded) {
          coordinates = { lat: geocoded.lat, lng: geocoded.lng };
        }
      } catch (geoError) {
        console.error("Geocoding error:", geoError);
        // Continue without coordinates
      }
    } else if (params.lat && params.lng) {
      coordinates = { lat: params.lat, lng: params.lng };
    }
    
    // Handle time of day filtering
    let startDateFrom = params.dateFrom;
    let startDateTo = params.dateTo;
    
    if (params.timeOfDay && params.timeOfDay !== "any") {
      // Adjust date filters based on time of day
      const timeRanges = {
        morning: { start: 6, end: 12 },
        afternoon: { start: 12, end: 17 },
        evening: { start: 17, end: 21 },
        night: { start: 21, end: 24 },
      };
      
      const range = timeRanges[params.timeOfDay];
      if (range && startDateFrom) {
        const fromDate = new Date(startDateFrom);
        fromDate.setHours(range.start, 0, 0, 0);
        startDateFrom = fromDate;
      }
      if (range && startDateTo) {
        const toDate = new Date(startDateTo);
        toDate.setHours(range.end, 0, 0, 0);
        startDateTo = toDate;
      }
    }
    
    // Calculate offset from page
    const offset = (params.page - 1) * params.limit;
    
    // Build search filters
    const searchFilters: any = {
      query: params.q,
      category: params.category,
      eventType: params.eventType,
      city: params.city || undefined,
      state: params.state || undefined,
      startDateFrom,
      startDateTo,
      minPrice: params.freeOnly ? 0 : params.priceMin,
      maxPrice: params.freeOnly ? 0 : params.priceMax,
      locationType: params.locationType !== "any" ? params.locationType : undefined,
      hasAvailability: params.availableOnly,
      providerId: params.providerId,
      latitude: coordinates?.lat,
      longitude: coordinates?.lng,
      radiusMiles: params.radius,
      sortBy: params.sort === "relevance" ? "popularity" : params.sort,
      sortOrder: params.order,
      limit: params.limit,
      offset,
    };
    
    // Execute search
    const result = await searchEvents(searchFilters);
    
    // Filter by additional criteria if needed
    let filteredEvents = result.events;
    
    // Filter by day of week if specified
    if (params.dayOfWeek && params.dayOfWeek.length > 0) {
      filteredEvents = filteredEvents.filter(event => {
        const eventDay = new Date(event.startDateTime).getDay();
        return params.dayOfWeek!.includes(eventDay);
      });
    }
    
    // Filter by instant booking
    if (params.instantBooking !== undefined) {
      filteredEvents = filteredEvents.filter(event => 
        event.instantBooking === params.instantBooking
      );
    }
    
    // Filter by approval requirement
    if (params.noApprovalRequired) {
      filteredEvents = filteredEvents.filter(event => 
        !event.requiresApproval
      );
    }
    
    // Filter by early bird availability
    if (params.hasEarlyBird) {
      filteredEvents = filteredEvents.filter(event => 
        event.earlyBirdPrice && 
        event.earlyBirdDeadline && 
        new Date(event.earlyBirdDeadline) > new Date()
      );
    }
    
    // Filter by verified providers
    if (params.verifiedProvidersOnly) {
      filteredEvents = filteredEvents.filter(event => 
        event.provider.isVerified
      );
    }
    
    // Calculate statistics if requested
    let stats = null;
    if (params.includeStats) {
      const prices = filteredEvents.map(e => Number(e.price));
      stats = {
        totalResults: filteredEvents.length,
        priceRange: {
          min: Math.min(...prices),
          max: Math.max(...prices),
          avg: prices.reduce((a, b) => a + b, 0) / prices.length || 0,
        },
        locationTypes: {
          inPerson: filteredEvents.filter(e => e.locationType === "in_person").length,
          virtual: filteredEvents.filter(e => e.locationType === "virtual").length,
          hybrid: filteredEvents.filter(e => e.locationType === "hybrid").length,
        },
        availability: {
          withSpots: filteredEvents.filter(e => e.availableSpots === null || e.availableSpots > 0).length,
          soldOut: filteredEvents.filter(e => e.availableSpots === 0).length,
        },
      };
    }
    
    // Calculate facets if requested
    let facets = null;
    if (params.includeFacets) {
      const categories = new Map<string, number>();
      const eventTypes = new Map<string, number>();
      const cities = new Map<string, number>();
      
      filteredEvents.forEach(event => {
        categories.set(event.category, (categories.get(event.category) || 0) + 1);
        eventTypes.set(event.eventType, (eventTypes.get(event.eventType) || 0) + 1);
        
        if (event.address && (event.address as any).city) {
          const city = (event.address as any).city;
          cities.set(city, (cities.get(city) || 0) + 1);
        }
      });
      
      facets = {
        categories: Array.from(categories.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
        eventTypes: Array.from(eventTypes.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
        cities: Array.from(cities.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
      };
    }
    
    // Transform events for response
    const transformedEvents = filteredEvents.map(event => ({
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
      isFeatured: event.isFeatured,
      instantBooking: event.instantBooking,
      requiresApproval: event.requiresApproval,
      viewCount: event.viewCount,
      favoriteCount: event.favoriteCount,
      slug: event.slug,
      provider: event.provider,
    }));
    
    // Calculate pagination
    const totalPages = Math.ceil(result.total / params.limit);
    
    return createApiResponse({
      results: transformedEvents,
      pagination: {
        total: result.total,
        page: params.page,
        limit: params.limit,
        totalPages,
        hasMore: params.page < totalPages,
        nextPage: params.page < totalPages ? params.page + 1 : null,
        prevPage: params.page > 1 ? params.page - 1 : null,
      },
      search: {
        query: params.q,
        location: params.location,
        coordinates,
        radius: params.radius,
        filters: {
          category: params.category,
          eventType: params.eventType,
          dateRange: {
            from: params.dateFrom,
            to: params.dateTo,
          },
          priceRange: {
            min: params.priceMin,
            max: params.priceMax,
          },
          locationType: params.locationType !== "any" ? params.locationType : null,
        },
      },
      stats,
      facets,
    });
    
  } catch (error) {
    console.error("Error in event search:", error);
    return createApiError("Failed to search events", { 
      status: 500,
      details: error instanceof Error ? error.message : undefined
    });
  }
}

// GET: Public endpoint for event search
export const GET = createSecureApiHandler(
  handleSearchEvents,
  {
    requireAuth: false,
    validateQuery: searchSchema,
    rateLimit: { requests: 100, window: '1m' },
    auditLog: false,
    allowedMethods: ['GET'],
  }
);

// Health check
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}