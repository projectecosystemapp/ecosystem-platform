import { db } from "@/db";
import { 
  eventsTable, 
  eventAttendeesTable, 
  eventFavoritesTable, 
  type Event, 
  type NewEvent,
  type EventAttendee,
  type NewEventAttendee 
} from "@/db/schema/events-schema";
import { providersTable } from "@/db/schema/providers-schema";
import { bookingsTable } from "@/db/schema/bookings-schema";
import { eq, and, gte, lte, ilike, sql, desc, asc, or, between, gt, lt } from "drizzle-orm";
import { getGeocoding } from "@/lib/geocoding";

export interface SearchEventsFilters {
  query?: string;
  category?: string;
  eventType?: string;
  city?: string;
  state?: string;
  startDateFrom?: Date;
  startDateTo?: Date;
  minPrice?: number;
  maxPrice?: number;
  locationType?: "in_person" | "virtual" | "hybrid";
  hasAvailability?: boolean;
  featured?: boolean;
  providerId?: string;
  latitude?: number;
  longitude?: number;
  radiusMiles?: number;
  sortBy?: "date" | "price" | "popularity" | "distance";
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface EventWithProvider extends Event {
  provider: {
    id: string;
    displayName: string;
    profileImageUrl: string | null;
    slug: string;
    isVerified: boolean;
  };
  availableSpots?: number;
}

/**
 * Search events with comprehensive filters
 */
export async function searchEvents(filters: SearchEventsFilters) {
  try {
    const {
      query,
      category,
      eventType,
      city,
      state,
      startDateFrom,
      startDateTo,
      minPrice,
      maxPrice,
      locationType,
      hasAvailability,
      featured,
      providerId,
      latitude,
      longitude,
      radiusMiles = 25,
      sortBy = "date",
      sortOrder = "asc",
      limit = 20,
      offset = 0,
    } = filters;

    // Build where conditions
    const conditions = [];
    
    // Only show published events
    conditions.push(eq(eventsTable.status, "published"));
    
    // Only show future or ongoing events
    conditions.push(gte(eventsTable.endDateTime, new Date()));

    // Text search across title and description
    if (query) {
      conditions.push(
        or(
          ilike(eventsTable.title, `%${query}%`),
          ilike(eventsTable.description, `%${query}%`)
        )
      );
    }

    // Category filter
    if (category) {
      conditions.push(eq(eventsTable.category, category));
    }

    // Event type filter
    if (eventType) {
      conditions.push(eq(eventsTable.eventType, eventType));
    }

    // Location type filter
    if (locationType) {
      conditions.push(eq(eventsTable.locationType, locationType));
    }

    // Date range filter
    if (startDateFrom && startDateTo) {
      conditions.push(
        between(eventsTable.startDateTime, startDateFrom, startDateTo)
      );
    } else if (startDateFrom) {
      conditions.push(gte(eventsTable.startDateTime, startDateFrom));
    } else if (startDateTo) {
      conditions.push(lte(eventsTable.startDateTime, startDateTo));
    }

    // Price range filter
    if (minPrice !== undefined) {
      conditions.push(gte(eventsTable.price, minPrice.toString()));
    }
    if (maxPrice !== undefined) {
      conditions.push(lte(eventsTable.price, maxPrice.toString()));
    }

    // Featured filter
    if (featured) {
      conditions.push(eq(eventsTable.isFeatured, true));
    }

    // Provider filter
    if (providerId) {
      conditions.push(eq(eventsTable.providerId, providerId));
    }

    // Availability filter
    if (hasAvailability) {
      conditions.push(
        sql`${eventsTable.maxAttendees} IS NULL OR ${eventsTable.currentAttendees} < ${eventsTable.maxAttendees}`
      );
    }

    // Location-based search
    if (city || state) {
      const locationConditions = [];
      if (city) {
        locationConditions.push(
          sql`${eventsTable.address}->>'city' ILIKE ${`%${city}%`}`
        );
      }
      if (state) {
        locationConditions.push(
          sql`${eventsTable.address}->>'state' ILIKE ${`%${state}%`}`
        );
      }
      if (locationConditions.length > 0) {
        conditions.push(or(...locationConditions));
      }
    }

    // Distance-based search
    let distanceSelect = sql`NULL as distance`;
    if (latitude && longitude) {
      // Calculate distance using Haversine formula
      distanceSelect = sql`
        6371 * acos(
          cos(radians(${latitude})) * cos(radians(${eventsTable.latitude}::numeric)) *
          cos(radians(${eventsTable.longitude}::numeric) - radians(${longitude})) +
          sin(radians(${latitude})) * sin(radians(${eventsTable.latitude}::numeric))
        ) as distance
      `;
      
      // Convert miles to kilometers for the query
      const radiusKm = radiusMiles * 1.60934;
      conditions.push(
        sql`
          6371 * acos(
            cos(radians(${latitude})) * cos(radians(${eventsTable.latitude}::numeric)) *
            cos(radians(${eventsTable.longitude}::numeric) - radians(${longitude})) +
            sin(radians(${latitude})) * sin(radians(${eventsTable.latitude}::numeric))
          ) <= ${radiusKm}
        `
      );
    }

    // Build the main query
    const baseQuery = db
      .select({
        event: eventsTable,
        provider: {
          id: providersTable.id,
          displayName: providersTable.displayName,
          profileImageUrl: providersTable.profileImageUrl,
          slug: providersTable.slug,
          isVerified: providersTable.isVerified,
        },
        distance: distanceSelect,
      })
      .from(eventsTable)
      .innerJoin(providersTable, eq(eventsTable.providerId, providersTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    // Apply sorting
    let orderByClause;
    switch (sortBy) {
      case "price":
        orderByClause = sortOrder === "desc" 
          ? desc(eventsTable.price) 
          : asc(eventsTable.price);
        break;
      case "popularity":
        orderByClause = desc(
          sql`${eventsTable.viewCount} + ${eventsTable.favoriteCount} * 2`
        );
        break;
      case "distance":
        if (latitude && longitude) {
          orderByClause = sortOrder === "desc" 
            ? sql`distance DESC` 
            : sql`distance ASC`;
        } else {
          orderByClause = asc(eventsTable.startDateTime);
        }
        break;
      case "date":
      default:
        orderByClause = sortOrder === "desc" 
          ? desc(eventsTable.startDateTime) 
          : asc(eventsTable.startDateTime);
        break;
    }

    // Execute the query with pagination
    const events = await baseQuery
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const countResult = await db
      .select({ count: sql`count(*)` })
      .from(eventsTable)
      .innerJoin(providersTable, eq(eventsTable.providerId, providersTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = Number(countResult[0].count);

    // Calculate available spots for each event
    const eventsWithAvailability = events.map(({ event, provider, distance }) => ({
      ...event,
      provider,
      distance: distance as number | null,
      availableSpots: event.maxAttendees 
        ? Math.max(0, event.maxAttendees - event.currentAttendees) 
        : null,
    }));

    return {
      events: eventsWithAvailability,
      total,
      hasMore: offset + limit < total,
    };
  } catch (error) {
    console.error("Error searching events:", error);
    throw new Error("Failed to search events");
  }
}

/**
 * Get featured events
 */
export async function getFeaturedEvents(limit: number = 10) {
  try {
    const events = await db
      .select({
        event: eventsTable,
        provider: {
          id: providersTable.id,
          displayName: providersTable.displayName,
          profileImageUrl: providersTable.profileImageUrl,
          slug: providersTable.slug,
          isVerified: providersTable.isVerified,
        },
      })
      .from(eventsTable)
      .innerJoin(providersTable, eq(eventsTable.providerId, providersTable.id))
      .where(
        and(
          eq(eventsTable.status, "published"),
          eq(eventsTable.isFeatured, true),
          gte(eventsTable.endDateTime, new Date())
        )
      )
      .orderBy(
        desc(sql`${eventsTable.viewCount} + ${eventsTable.favoriteCount} * 2`),
        asc(eventsTable.startDateTime)
      )
      .limit(limit);

    return events.map(({ event, provider }) => ({
      ...event,
      provider,
      availableSpots: event.maxAttendees 
        ? Math.max(0, event.maxAttendees - event.currentAttendees) 
        : null,
    }));
  } catch (error) {
    console.error("Error fetching featured events:", error);
    throw new Error("Failed to fetch featured events");
  }
}

/**
 * Get a single event by ID
 */
export async function getEventById(id: string, incrementView = false) {
  try {
    // Increment view count if requested
    if (incrementView) {
      await db
        .update(eventsTable)
        .set({ 
          viewCount: sql`${eventsTable.viewCount} + 1`,
          updatedAt: new Date()
        })
        .where(eq(eventsTable.id, id));
    }

    const result = await db
      .select({
        event: eventsTable,
        provider: providersTable,
      })
      .from(eventsTable)
      .innerJoin(providersTable, eq(eventsTable.providerId, providersTable.id))
      .where(eq(eventsTable.id, id))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const { event, provider } = result[0];

    // Get attendees count
    const attendeesResult = await db
      .select({ 
        count: sql`COALESCE(SUM(${eventAttendeesTable.numberOfGuests}), 0)` 
      })
      .from(eventAttendeesTable)
      .where(
        and(
          eq(eventAttendeesTable.eventId, id),
          eq(eventAttendeesTable.status, "confirmed")
        )
      );

    const confirmedAttendees = Number(attendeesResult[0].count);

    return {
      ...event,
      provider,
      currentAttendees: confirmedAttendees,
      availableSpots: event.maxAttendees 
        ? Math.max(0, event.maxAttendees - confirmedAttendees) 
        : null,
    };
  } catch (error) {
    console.error("Error fetching event:", error);
    throw new Error("Failed to fetch event");
  }
}

/**
 * Create a new event
 */
export async function createEvent(data: NewEvent) {
  try {
    // Geocode the address if provided
    let geocodingData = {};
    if (data.locationType === "in_person" && data.address) {
      const address = data.address as any;
      if (address.street && address.city && address.state) {
        const fullAddress = `${address.street}, ${address.city}, ${address.state} ${address.zipCode || ''}`.trim();
        const geocoded = await getGeocoding(fullAddress);
        if (geocoded) {
          geocodingData = {
            latitude: geocoded.lat.toString(),
            longitude: geocoded.lng.toString(),
            geocodedAt: new Date(),
            address: {
              ...address,
              coordinates: { lat: geocoded.lat, lng: geocoded.lng }
            }
          };
        }
      }
    }

    const [event] = await db
      .insert(eventsTable)
      .values({
        ...data,
        ...geocodingData,
        slug: generateSlug(data.title),
        updatedAt: new Date(),
      })
      .returning();

    return event;
  } catch (error) {
    console.error("Error creating event:", error);
    throw new Error("Failed to create event");
  }
}

/**
 * Update an event
 */
export async function updateEvent(id: string, data: Partial<NewEvent>) {
  try {
    // Re-geocode if address changed
    let geocodingData = {};
    if (data.locationType === "in_person" && data.address) {
      const address = data.address as any;
      if (address.street && address.city && address.state) {
        const fullAddress = `${address.street}, ${address.city}, ${address.state} ${address.zipCode || ''}`.trim();
        const geocoded = await getGeocoding(fullAddress);
        if (geocoded) {
          geocodingData = {
            latitude: geocoded.lat.toString(),
            longitude: geocoded.lng.toString(),
            geocodedAt: new Date(),
            address: {
              ...address,
              coordinates: { lat: geocoded.lat, lng: geocoded.lng }
            }
          };
        }
      }
    }

    const [event] = await db
      .update(eventsTable)
      .set({
        ...data,
        ...geocodingData,
        updatedAt: new Date(),
      })
      .where(eq(eventsTable.id, id))
      .returning();

    return event;
  } catch (error) {
    console.error("Error updating event:", error);
    throw new Error("Failed to update event");
  }
}

/**
 * Delete an event
 */
export async function deleteEvent(id: string) {
  try {
    // Check if there are any confirmed attendees
    const attendees = await db
      .select({ count: sql`count(*)` })
      .from(eventAttendeesTable)
      .where(
        and(
          eq(eventAttendeesTable.eventId, id),
          eq(eventAttendeesTable.status, "confirmed")
        )
      );

    if (Number(attendees[0].count) > 0) {
      throw new Error("Cannot delete event with confirmed attendees");
    }

    await db.delete(eventsTable).where(eq(eventsTable.id, id));
    return { success: true };
  } catch (error) {
    console.error("Error deleting event:", error);
    throw error;
  }
}

/**
 * Register attendance for an event
 */
export async function registerEventAttendance(
  eventId: string,
  bookingId: string,
  attendeeData: Omit<NewEventAttendee, "eventId" | "bookingId">
) {
  try {
    // Check event capacity
    const event = await getEventById(eventId);
    if (!event) {
      throw new Error("Event not found");
    }

    if (event.maxAttendees && event.currentAttendees >= event.maxAttendees) {
      throw new Error("Event is full");
    }

    // Register attendee
    const [attendee] = await db
      .insert(eventAttendeesTable)
      .values({
        eventId,
        bookingId,
        ...attendeeData,
      })
      .returning();

    // Update event attendee count
    await db
      .update(eventsTable)
      .set({ 
        currentAttendees: sql`${eventsTable.currentAttendees} + ${attendeeData.numberOfGuests || 1}`,
        updatedAt: new Date()
      })
      .where(eq(eventsTable.id, eventId));

    return attendee;
  } catch (error) {
    console.error("Error registering event attendance:", error);
    throw error;
  }
}

/**
 * Check event availability
 */
export async function checkEventAvailability(eventId: string) {
  try {
    const event = await getEventById(eventId);
    if (!event) {
      return { available: false, reason: "Event not found" };
    }

    if (event.status !== "published") {
      return { available: false, reason: "Event is not published" };
    }

    if (new Date(event.startDateTime) < new Date()) {
      return { available: false, reason: "Event has already started" };
    }

    if (event.maxAttendees && event.currentAttendees >= event.maxAttendees) {
      return { 
        available: false, 
        reason: "Event is full",
        waitlistAvailable: true 
      };
    }

    const availableSpots = event.maxAttendees 
      ? event.maxAttendees - event.currentAttendees 
      : null;

    return {
      available: true,
      availableSpots,
      price: Number(event.price),
      earlyBirdPrice: event.earlyBirdDeadline && new Date(event.earlyBirdDeadline) > new Date() 
        ? Number(event.earlyBirdPrice) 
        : null,
      instantBooking: event.instantBooking,
      requiresApproval: event.requiresApproval,
    };
  } catch (error) {
    console.error("Error checking event availability:", error);
    throw new Error("Failed to check event availability");
  }
}

/**
 * Get events by provider
 */
export async function getEventsByProvider(providerId: string, limit = 20, offset = 0) {
  try {
    const events = await db
      .select()
      .from(eventsTable)
      .where(
        and(
          eq(eventsTable.providerId, providerId),
          eq(eventsTable.status, "published")
        )
      )
      .orderBy(asc(eventsTable.startDateTime))
      .limit(limit)
      .offset(offset);

    return events;
  } catch (error) {
    console.error("Error fetching provider events:", error);
    throw new Error("Failed to fetch provider events");
  }
}

/**
 * Generate a URL-friendly slug from title
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim()
    + '-' + Date.now().toString(36);
}