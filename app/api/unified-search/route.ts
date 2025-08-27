import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db/db";
import { servicesTable } from "@/db/schema/enhanced-booking-schema";
import { eventsTable } from "@/db/schema/events-schema";
import { spacesTable } from "@/db/schema/spaces-schema";
import { thingsTable } from "@/db/schema/things-schema";
import { providersTable } from "@/db/schema/providers-schema";
import { categoriesTable } from "@/db/schema/categories-schema";
import { eq, and, or, ilike, sql, gte, lte, between, inArray } from "drizzle-orm";
import { ApiResponse, getPaginationParams, withErrorHandler } from "@/lib/api-response";

// Unified search schema
const unifiedSearchSchema = z.object({
  query: z.string().optional(),
  verticals: z.array(z.enum(["services", "events", "spaces", "things"])).optional(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  location: z.object({
    lat: z.coerce.number(),
    lng: z.coerce.number(),
    radius: z.coerce.number().default(10), // miles
  }).optional(),
  // Service-specific filters
  serviceFilters: z.object({
    priceType: z.enum(["fixed", "hourly", "custom"]).optional(),
    instantBooking: z.coerce.boolean().optional(),
    providerVerified: z.coerce.boolean().optional(),
    minRating: z.coerce.number().min(0).max(5).optional(),
    availability: z.enum(["available", "busy", "offline"]).optional(),
  }).optional(),
  // Event-specific filters
  eventFilters: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    eventType: z.string().optional(),
    isOnline: z.coerce.boolean().optional(),
    hasSpots: z.coerce.boolean().optional(),
  }).optional(),
  // Space-specific filters
  spaceFilters: z.object({
    spaceType: z.string().optional(),
    minCapacity: z.coerce.number().optional(),
    maxCapacity: z.coerce.number().optional(),
    amenities: z.array(z.string()).optional(),
    minSize: z.coerce.number().optional(),
    maxSize: z.coerce.number().optional(),
    priceUnit: z.enum(["hour", "day", "week", "month"]).optional(),
  }).optional(),
  // Thing-specific filters
  thingFilters: z.object({
    condition: z.enum(["new", "like_new", "good", "fair", "for_parts"]).optional(),
    brand: z.string().optional(),
    negotiable: z.coerce.boolean().optional(),
    localPickupOnly: z.coerce.boolean().optional(),
    shippingAvailable: z.coerce.boolean().optional(),
  }).optional(),
  // Pagination and sorting
  sortBy: z.enum(["relevance", "price_low", "price_high", "distance", "rating", "newest"]).default("relevance"),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
});

/**
 * GET /api/unified-search - Search across all marketplace verticals
 */
export async function GET(req: NextRequest) {
  return withErrorHandler(async () => {
    const { searchParams } = new URL(req.url);
    const { page, pageSize, offset } = getPaginationParams(searchParams);
    
    // Parse filters
    const filters = unifiedSearchSchema.parse({
      ...Object.fromEntries(searchParams.entries()),
      verticals: searchParams.getAll("verticals[]"),
      amenities: searchParams.getAll("amenities[]"),
    });
    
    // Determine which verticals to search
    const verticalsToSearch = filters.verticals || ["services", "events", "spaces", "things"];
    
    // Build queries for each vertical
    const searchPromises = [];
    
    // Helper function to calculate distance using PostGIS or approximation
    const getDistanceSQL = (latColumn: any, lngColumn: any) => {
      if (filters.location) {
        // Using Haversine formula for distance calculation
        return sql`
          (
            3959 * acos(
              cos(radians(${filters.location.lat})) * 
              cos(radians(${latColumn})) * 
              cos(radians(${lngColumn}) - radians(${filters.location.lng})) + 
              sin(radians(${filters.location.lat})) * 
              sin(radians(${latColumn}))
            )
          ) as distance
        `;
      }
      return sql`0 as distance`;
    };
    
    // Search Services
    if (verticalsToSearch.includes("services")) {
      const serviceConditions = [];
      
      if (filters.query) {
        serviceConditions.push(
          or(
            ilike(servicesTable.name, `%${filters.query}%`),
            ilike(servicesTable.description, `%${filters.query}%`)
          )
        );
      }
      
      if (filters.category) {
        serviceConditions.push(eq(servicesTable.category, filters.category));
      }
      
      if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
        const priceConditions = [];
        if (filters.minPrice !== undefined) {
          priceConditions.push(gte(servicesTable.basePrice, filters.minPrice.toString()));
        }
        if (filters.maxPrice !== undefined) {
          priceConditions.push(lte(servicesTable.basePrice, filters.maxPrice.toString()));
        }
        serviceConditions.push(and(...priceConditions));
      }
      
      if (filters.serviceFilters?.priceType) {
        serviceConditions.push(eq(servicesTable.priceType, filters.serviceFilters.priceType));
      }
      
      if (filters.serviceFilters?.instantBooking !== undefined) {
        serviceConditions.push(eq(servicesTable.requiresApproval, !filters.serviceFilters.instantBooking));
      }
      
      const servicesQuery = db
        .select({
          id: servicesTable.id,
          type: sql<string>`'service'`,
          title: servicesTable.name,
          description: servicesTable.description,
          price: sql<number>`${servicesTable.basePrice}::numeric`,
          category: servicesTable.category,
          subcategory: servicesTable.subcategory,
          tags: servicesTable.tags,
          thumbnailUrl: sql<string>`null`,
          provider: {
            id: providersTable.id,
            name: providersTable.displayName,
            avatar: providersTable.profileImageUrl,
            verified: providersTable.isVerified,
            rating: providersTable.averageRating,
            reviewCount: providersTable.totalReviews,
          },
          location: sql<any>`json_build_object(
            'lat', ${providersTable.latitude},
            'lng', ${providersTable.longitude},
            'address', ${providersTable.address},
            'city', ${providersTable.city},
            'state', ${providersTable.state}
          )`,
          distance: getDistanceSQL(providersTable.latitude, providersTable.longitude),
          metadata: sql<any>`json_build_object(
            'priceType', ${servicesTable.priceType},
            'duration', ${servicesTable.minimumDuration},
            'instantBooking', NOT ${servicesTable.requiresApproval}
          )`,
          createdAt: servicesTable.createdAt,
        })
        .from(servicesTable)
        .leftJoin(providersTable, eq(servicesTable.providerId, providersTable.id))
        .where(
          and(
            eq(servicesTable.isActive, true),
            serviceConditions.length > 0 ? and(...serviceConditions) : undefined
          )
        );
      
      searchPromises.push(servicesQuery);
    }
    
    // Search Events
    if (verticalsToSearch.includes("events")) {
      const eventConditions = [];
      
      if (filters.query) {
        eventConditions.push(
          or(
            ilike(eventsTable.title, `%${filters.query}%`),
            ilike(eventsTable.description, `%${filters.query}%`)
          )
        );
      }
      
      if (filters.category) {
        eventConditions.push(eq(eventsTable.category, filters.category));
      }
      
      if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
        const priceConditions = [];
        if (filters.minPrice !== undefined) {
          priceConditions.push(gte(eventsTable.price, filters.minPrice.toString()));
        }
        if (filters.maxPrice !== undefined) {
          priceConditions.push(lte(eventsTable.price, filters.maxPrice.toString()));
        }
        eventConditions.push(and(...priceConditions));
      }
      
      if (filters.eventFilters?.startDate) {
        eventConditions.push(gte(eventsTable.startDate, new Date(filters.eventFilters.startDate)));
      }
      
      if (filters.eventFilters?.endDate) {
        eventConditions.push(lte(eventsTable.startDate, new Date(filters.eventFilters.endDate)));
      }
      
      if (filters.eventFilters?.isOnline !== undefined) {
        eventConditions.push(eq(eventsTable.isVirtual, filters.eventFilters.isOnline));
      }
      
      const eventsQuery = db
        .select({
          id: eventsTable.id,
          type: sql<string>`'event'`,
          title: eventsTable.title,
          description: eventsTable.description,
          price: sql<number>`${eventsTable.price}::numeric`,
          category: eventsTable.category,
          subcategory: sql<string>`null`,
          tags: eventsTable.tags,
          thumbnailUrl: eventsTable.thumbnailUrl,
          provider: {
            id: providersTable.id,
            name: providersTable.displayName,
            avatar: providersTable.profileImageUrl,
            verified: providersTable.isVerified,
            rating: providersTable.averageRating,
            reviewCount: providersTable.totalReviews,
          },
          location: sql<any>`json_build_object(
            'lat', ${eventsTable.latitude},
            'lng', ${eventsTable.longitude},
            'address', ${eventsTable.venueName},
            'city', ${eventsTable.city},
            'state', ${eventsTable.state}
          )`,
          distance: getDistanceSQL(eventsTable.latitude, eventsTable.longitude),
          metadata: sql<any>`json_build_object(
            'startDate', ${eventsTable.startDate},
            'endDate', ${eventsTable.endDate},
            'capacity', ${eventsTable.capacity},
            'attendees', ${eventsTable.currentAttendees},
            'isOnline', ${eventsTable.isVirtual}
          )`,
          createdAt: eventsTable.createdAt,
        })
        .from(eventsTable)
        .leftJoin(providersTable, eq(eventsTable.organizerId, providersTable.id))
        .where(
          and(
            eq(eventsTable.status, "published"),
            eventConditions.length > 0 ? and(...eventConditions) : undefined
          )
        );
      
      searchPromises.push(eventsQuery);
    }
    
    // Search Spaces
    if (verticalsToSearch.includes("spaces")) {
      const spaceConditions = [];
      
      if (filters.query) {
        spaceConditions.push(
          or(
            ilike(spacesTable.name, `%${filters.query}%`),
            ilike(spacesTable.description, `%${filters.query}%`)
          )
        );
      }
      
      if (filters.category) {
        spaceConditions.push(eq(spacesTable.category, filters.category));
      }
      
      if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
        const priceConditions = [];
        if (filters.minPrice !== undefined) {
          priceConditions.push(gte(spacesTable.pricePerHour, filters.minPrice.toString()));
        }
        if (filters.maxPrice !== undefined) {
          priceConditions.push(lte(spacesTable.pricePerHour, filters.maxPrice.toString()));
        }
        spaceConditions.push(and(...priceConditions));
      }
      
      if (filters.spaceFilters?.spaceType) {
        spaceConditions.push(eq(spacesTable.spaceType, filters.spaceFilters.spaceType));
      }
      
      if (filters.spaceFilters?.minCapacity !== undefined) {
        spaceConditions.push(gte(spacesTable.capacity, filters.spaceFilters.minCapacity));
      }
      
      if (filters.spaceFilters?.maxCapacity !== undefined) {
        spaceConditions.push(lte(spacesTable.capacity, filters.spaceFilters.maxCapacity));
      }
      
      const spacesQuery = db
        .select({
          id: spacesTable.id,
          type: sql<string>`'space'`,
          title: spacesTable.name,
          description: spacesTable.description,
          price: sql<number>`${spacesTable.pricePerHour}::numeric`,
          category: spacesTable.category,
          subcategory: sql<string>`null`,
          tags: sql<string[]>`ARRAY[]::text[]`,
          thumbnailUrl: spacesTable.thumbnailUrl,
          provider: {
            id: providersTable.id,
            name: providersTable.displayName,
            avatar: providersTable.profileImageUrl,
            verified: providersTable.isVerified,
            rating: providersTable.averageRating,
            reviewCount: providersTable.totalReviews,
          },
          location: sql<any>`json_build_object(
            'lat', ${spacesTable.latitude},
            'lng', ${spacesTable.longitude},
            'address', ${spacesTable.address},
            'city', ${spacesTable.city},
            'state', ${spacesTable.state}
          )`,
          distance: getDistanceSQL(spacesTable.latitude, spacesTable.longitude),
          metadata: sql<any>`json_build_object(
            'spaceType', ${spacesTable.spaceType},
            'capacity', ${spacesTable.capacity},
            'size', ${spacesTable.squareFeet},
            'amenities', ${spacesTable.amenities}
          )`,
          createdAt: spacesTable.createdAt,
        })
        .from(spacesTable)
        .leftJoin(providersTable, eq(spacesTable.providerId, providersTable.id))
        .where(
          and(
            eq(spacesTable.isActive, true),
            spaceConditions.length > 0 ? and(...spaceConditions) : undefined
          )
        );
      
      searchPromises.push(spacesQuery);
    }
    
    // Search Things
    if (verticalsToSearch.includes("things")) {
      const thingConditions = [];
      
      if (filters.query) {
        thingConditions.push(
          or(
            ilike(thingsTable.title, `%${filters.query}%`),
            ilike(thingsTable.description, `%${filters.query}%`)
          )
        );
      }
      
      if (filters.category) {
        thingConditions.push(eq(thingsTable.category, filters.category));
      }
      
      if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
        const priceConditions = [];
        if (filters.minPrice !== undefined) {
          priceConditions.push(gte(thingsTable.price, filters.minPrice.toString()));
        }
        if (filters.maxPrice !== undefined) {
          priceConditions.push(lte(thingsTable.price, filters.maxPrice.toString()));
        }
        thingConditions.push(and(...priceConditions));
      }
      
      if (filters.thingFilters?.condition) {
        thingConditions.push(eq(thingsTable.condition, filters.thingFilters.condition));
      }
      
      if (filters.thingFilters?.brand) {
        thingConditions.push(ilike(thingsTable.brand, `%${filters.thingFilters.brand}%`));
      }
      
      if (filters.thingFilters?.negotiable !== undefined) {
        thingConditions.push(eq(thingsTable.isNegotiable, filters.thingFilters.negotiable));
      }
      
      const thingsQuery = db
        .select({
          id: thingsTable.id,
          type: sql<string>`'thing'`,
          title: thingsTable.title,
          description: thingsTable.description,
          price: sql<number>`${thingsTable.price}::numeric`,
          category: thingsTable.category,
          subcategory: thingsTable.subcategory,
          tags: thingsTable.tags,
          thumbnailUrl: thingsTable.thumbnailUrl,
          provider: {
            id: providersTable.id,
            name: providersTable.displayName,
            avatar: providersTable.profileImageUrl,
            verified: providersTable.isVerified,
            rating: providersTable.averageRating,
            reviewCount: providersTable.totalReviews,
          },
          location: sql<any>`json_build_object(
            'lat', ${thingsTable.latitude},
            'lng', ${thingsTable.longitude},
            'address', ${thingsTable.location},
            'city', ${thingsTable.city},
            'state', ${thingsTable.state}
          )`,
          distance: getDistanceSQL(thingsTable.latitude, thingsTable.longitude),
          metadata: sql<any>`json_build_object(
            'condition', ${thingsTable.condition},
            'brand', ${thingsTable.brand},
            'negotiable', ${thingsTable.isNegotiable},
            'shippingAvailable', ${thingsTable.shippingAvailable}
          )`,
          createdAt: thingsTable.createdAt,
        })
        .from(thingsTable)
        .leftJoin(providersTable, eq(thingsTable.sellerId, providersTable.id))
        .where(
          and(
            eq(thingsTable.status, "available"),
            thingConditions.length > 0 ? and(...thingConditions) : undefined
          )
        );
      
      searchPromises.push(thingsQuery);
    }
    
    // Execute all queries in parallel
    const results = await Promise.all(searchPromises);
    
    // Combine and flatten results
    let combinedResults = results.flat();
    
    // Apply distance filter if location provided
    if (filters.location) {
      combinedResults = combinedResults.filter(
        (item: any) => item.distance <= filters.location!.radius
      );
    }
    
    // Sort results based on sortBy parameter
    combinedResults.sort((a: any, b: any) => {
      switch (filters.sortBy) {
        case "price_low":
          return a.price - b.price;
        case "price_high":
          return b.price - a.price;
        case "distance":
          return (a.distance || 0) - (b.distance || 0);
        case "rating":
          return (b.provider?.rating || 0) - (a.provider?.rating || 0);
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "relevance":
        default:
          // Simple relevance scoring based on query match
          if (filters.query) {
            const queryLower = filters.query.toLowerCase();
            const aScore = (a.title?.toLowerCase().includes(queryLower) ? 10 : 0) +
                          (a.description?.toLowerCase().includes(queryLower) ? 5 : 0);
            const bScore = (b.title?.toLowerCase().includes(queryLower) ? 10 : 0) +
                          (b.description?.toLowerCase().includes(queryLower) ? 5 : 0);
            return bScore - aScore;
          }
          return 0;
      }
    });
    
    // Apply pagination
    const total = combinedResults.length;
    const paginatedResults = combinedResults.slice(offset, offset + pageSize);
    
    // Get available categories for filters
    const categories = await db
      .select({
        id: categoriesTable.id,
        name: categoriesTable.name,
        slug: categoriesTable.slug,
        icon: categoriesTable.icon,
        color: categoriesTable.color,
        parentId: categoriesTable.parentId,
      })
      .from(categoriesTable)
      .where(eq(categoriesTable.isActive, true))
      .orderBy(categoriesTable.sortOrder);
    
    return ApiResponse.success({
      results: paginatedResults,
      categories,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      filters: {
        applied: filters,
        available: {
          verticals: ["services", "events", "spaces", "things"],
          sortOptions: ["relevance", "price_low", "price_high", "distance", "rating", "newest"],
        },
      },
    });
  });
}

/**
 * POST /api/unified-search/suggestions - Get search suggestions
 */
export async function POST(req: NextRequest) {
  return withErrorHandler(async () => {
    const body = await req.json();
    const { query, limit = 10 } = body;
    
    if (!query || query.length < 2) {
      return ApiResponse.success({ suggestions: [] });
    }
    
    // Get suggestions from each vertical
    const suggestions: any[] = [];
    
    // Service suggestions
    const services = await db
      .select({
        type: sql<string>`'service'`,
        text: servicesTable.name,
        category: servicesTable.category,
      })
      .from(servicesTable)
      .where(
        and(
          ilike(servicesTable.name, `%${query}%`),
          eq(servicesTable.isActive, true)
        )
      )
      .limit(limit);
    
    suggestions.push(...services);
    
    // Event suggestions
    const events = await db
      .select({
        type: sql<string>`'event'`,
        text: eventsTable.title,
        category: eventsTable.category,
      })
      .from(eventsTable)
      .where(
        and(
          ilike(eventsTable.title, `%${query}%`),
          eq(eventsTable.status, "published")
        )
      )
      .limit(limit);
    
    suggestions.push(...events);
    
    // Category suggestions
    const categories = await db
      .select({
        type: sql<string>`'category'`,
        text: categoriesTable.name,
        category: sql<string>`null`,
      })
      .from(categoriesTable)
      .where(
        and(
          ilike(categoriesTable.name, `%${query}%`),
          eq(categoriesTable.isActive, true)
        )
      )
      .limit(limit);
    
    suggestions.push(...categories);
    
    return ApiResponse.success({
      suggestions: suggestions.slice(0, limit),
    });
  });
}