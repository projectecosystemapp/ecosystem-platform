import { NextRequest, NextResponse } from "next/server";
import { getFeaturedEvents, searchEvents } from "@/db/queries/events-queries";
import { z } from "zod";
import { createSecureApiHandler, createApiResponse, createApiError, getValidatedQuery } from "@/lib/security/api-handler";
import { db } from "@/db/db";
import { eventsTable } from "@/db/schema/events-schema";
import { sql, desc, and, eq, gte } from "drizzle-orm";

/**
 * Featured Events API
 * GET /api/events/featured - Get featured and trending events
 */

// Query parameters schema
const featuredQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(50).default(10),
  type: z.enum(["featured", "trending", "upcoming", "popular"]).default("featured"),
  category: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
});

/**
 * GET handler - Get featured/trending events
 */
async function handleGetFeaturedEvents(req: NextRequest) {
  try {
    const params = getValidatedQuery<z.infer<typeof featuredQuerySchema>>(req);
    
    if (!params) {
      return createApiError("Invalid query parameters", { status: 400 });
    }
    
    const { limit, type, category, city, state } = params;
    
    let events;
    
    switch (type) {
      case "featured":
        // Get manually featured events
        events = await getFeaturedEvents(limit);
        break;
        
      case "trending":
        // Get events trending in the last 7 days based on views
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        events = await searchEvents({
          featured: false,
          category,
          city,
          state,
          startDateFrom: sevenDaysAgo,
          sortBy: "popularity",
          sortOrder: "desc",
          limit,
        }).then(result => result.events);
        break;
        
      case "upcoming":
        // Get upcoming events in the next 30 days
        const thirtyDaysLater = new Date();
        thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
        
        events = await searchEvents({
          category,
          city,
          state,
          startDateFrom: new Date(),
          startDateTo: thirtyDaysLater,
          sortBy: "date",
          sortOrder: "asc",
          limit,
        }).then(result => result.events);
        break;
        
      case "popular":
        // Get most popular events by combined metrics
        events = await searchEvents({
          category,
          city,
          state,
          sortBy: "popularity",
          sortOrder: "desc",
          limit,
        }).then(result => result.events);
        break;
        
      default:
        events = await getFeaturedEvents(limit);
    }
    
    // Transform events for response
    const transformedEvents = events.map(event => ({
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
      price: Number(event.price),
      earlyBirdPrice: event.earlyBirdPrice ? Number(event.earlyBirdPrice) : null,
      earlyBirdDeadline: event.earlyBirdDeadline,
      maxAttendees: event.maxAttendees,
      currentAttendees: event.currentAttendees,
      availableSpots: event.availableSpots,
      coverImageUrl: event.coverImageUrl,
      galleryImages: event.galleryImages,
      isFeatured: event.isFeatured,
      instantBooking: event.instantBooking,
      viewCount: event.viewCount,
      favoriteCount: event.favoriteCount,
      slug: event.slug,
      provider: event.provider,
      distance: (event as any).distance ?? null,
    }));
    
    // Get category statistics if no specific category is selected
    let categoryStats = null;
    if (!category) {
      const stats = await db
        .select({
          category: eventsTable.category,
          count: sql`count(*)`,
        })
        .from(eventsTable)
        .where(
          and(
            eq(eventsTable.status, "published"),
            gte(eventsTable.endDateTime, new Date())
          )
        )
        .groupBy(eventsTable.category)
        .orderBy(desc(sql`count(*)`))
        .limit(10);
      
      categoryStats = stats.map(stat => ({
        category: stat.category,
        count: Number(stat.count),
      }));
    }
    
    return createApiResponse({
      type,
      events: transformedEvents,
      total: events.length,
      categoryStats,
      filters: {
        category,
        city,
        state,
      },
    });
    
  } catch (error) {
    console.error("Error fetching featured events:", error);
    return createApiError("Failed to fetch featured events", { 
      status: 500,
      details: error instanceof Error ? error.message : undefined
    });
  }
}

// GET: Public endpoint for featured events
export const GET = createSecureApiHandler(
  handleGetFeaturedEvents,
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