import { db } from "@/db";
import { 
  spacesTable, 
  spaceAvailabilityTable, 
  spaceFavoritesTable,
  spaceReviewsTable,
  type Space, 
  type NewSpace,
  type SpaceAvailability,
  type NewSpaceAvailability 
} from "@/db/schema/spaces-schema";
import { providersTable } from "@/db/schema/providers-schema";
import { bookingsTable } from "@/db/schema/bookings-schema";
import { eq, and, gte, lte, ilike, sql, desc, asc, or, between, gt, lt, inArray, not } from "drizzle-orm";
import { getGeocoding } from "@/lib/geocoding";

export interface SearchSpacesFilters {
  query?: string;
  category?: string;
  spaceType?: "office" | "studio" | "venue" | "meeting_room" | "classroom" | "gallery" | "workshop" | "coworking" | "other";
  city?: string;
  state?: string;
  neighborhood?: string;
  minCapacity?: number;
  maxCapacity?: number;
  minSquareFeet?: number;
  maxSquareFeet?: number;
  amenities?: string[];
  features?: {
    hasWifi?: boolean;
    hasParking?: boolean;
    hasKitchen?: boolean;
    hasAC?: boolean;
    hasProjector?: boolean;
    hasSoundSystem?: boolean;
    isAccessible?: boolean;
    hasElevator?: boolean;
    allowsPets?: boolean;
  };
  hourlyRateMin?: number;
  hourlyRateMax?: number;
  dailyRateMin?: number;
  dailyRateMax?: number;
  weeklyRateMin?: number;
  weeklyRateMax?: number;
  instantBooking?: boolean;
  featured?: boolean;
  verified?: boolean;
  providerId?: string;
  latitude?: number;
  longitude?: number;
  radiusMiles?: number;
  availableFrom?: Date;
  availableTo?: Date;
  sortBy?: "price_hourly" | "price_daily" | "capacity" | "rating" | "popularity" | "distance" | "created";
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface SpaceWithProvider extends Space {
  provider: {
    id: string;
    displayName: string;
    profileImageUrl: string | null;
    slug: string;
    isVerified: boolean;
  };
  averageRating?: number;
  totalReviews?: number;
  distance?: number;
}

/**
 * Search spaces with comprehensive filters
 */
export async function searchSpaces(filters: SearchSpacesFilters) {
  try {
    const {
      query,
      category,
      spaceType,
      city,
      state,
      neighborhood,
      minCapacity,
      maxCapacity,
      minSquareFeet,
      maxSquareFeet,
      amenities,
      features,
      hourlyRateMin,
      hourlyRateMax,
      dailyRateMin,
      dailyRateMax,
      weeklyRateMin,
      weeklyRateMax,
      instantBooking,
      featured,
      verified,
      providerId,
      latitude,
      longitude,
      radiusMiles = 25,
      availableFrom,
      availableTo,
      sortBy = "created",
      sortOrder = "desc",
      limit = 20,
      offset = 0,
    } = filters;

    // Build where conditions
    const conditions = [];
    
    // Only show active spaces
    conditions.push(eq(spacesTable.isActive, true));

    // Text search across name and description
    if (query) {
      conditions.push(
        or(
          ilike(spacesTable.name, `%${query}%`),
          ilike(spacesTable.description, `%${query}%`)
        )
      );
    }

    // Category filter
    if (category) {
      conditions.push(eq(spacesTable.category, category));
    }

    // Space type filter
    if (spaceType) {
      conditions.push(eq(spacesTable.spaceType, spaceType));
    }

    // Location filters
    if (city) {
      conditions.push(ilike(spacesTable.city, `%${city}%`));
    }
    if (state) {
      conditions.push(eq(spacesTable.state, state));
    }
    if (neighborhood) {
      conditions.push(ilike(spacesTable.neighborhood, `%${neighborhood}%`));
    }

    // Capacity filters
    if (minCapacity !== undefined) {
      conditions.push(gte(spacesTable.capacity, minCapacity));
    }
    if (maxCapacity !== undefined) {
      conditions.push(lte(spacesTable.capacity, maxCapacity));
    }

    // Square footage filters
    if (minSquareFeet !== undefined) {
      conditions.push(gte(spacesTable.squareFeet, minSquareFeet));
    }
    if (maxSquareFeet !== undefined) {
      conditions.push(lte(spacesTable.squareFeet, maxSquareFeet));
    }

    // Amenities filter (all specified amenities must be present)
    if (amenities && amenities.length > 0) {
      for (const amenity of amenities) {
        conditions.push(
          sql`${spacesTable.amenities}::jsonb @> ${JSON.stringify([amenity])}::jsonb`
        );
      }
    }

    // Features filter
    if (features) {
      for (const [key, value] of Object.entries(features)) {
        if (value !== undefined) {
          conditions.push(
            sql`${spacesTable.features}->>${key} = ${value.toString()}`
          );
        }
      }
    }

    // Price range filters
    if (hourlyRateMin !== undefined) {
      conditions.push(gte(spacesTable.hourlyRate, hourlyRateMin.toString()));
    }
    if (hourlyRateMax !== undefined) {
      conditions.push(lte(spacesTable.hourlyRate, hourlyRateMax.toString()));
    }
    if (dailyRateMin !== undefined) {
      conditions.push(gte(spacesTable.dailyRate, dailyRateMin.toString()));
    }
    if (dailyRateMax !== undefined) {
      conditions.push(lte(spacesTable.dailyRate, dailyRateMax.toString()));
    }
    if (weeklyRateMin !== undefined) {
      conditions.push(gte(spacesTable.weeklyRate, weeklyRateMin.toString()));
    }
    if (weeklyRateMax !== undefined) {
      conditions.push(lte(spacesTable.weeklyRate, weeklyRateMax.toString()));
    }

    // Booking options
    if (instantBooking !== undefined) {
      conditions.push(eq(spacesTable.instantBooking, instantBooking));
    }

    // Featured/verified filters
    if (featured) {
      // Spaces with high ratings and bookings
      conditions.push(
        sql`${spacesTable.totalBookings} > 10`
      );
    }
    if (verified !== undefined) {
      conditions.push(eq(spacesTable.isVerified, verified));
    }

    // Provider filter
    if (providerId) {
      conditions.push(eq(spacesTable.providerId, providerId));
    }

    // Distance-based search
    let distanceSelect = sql`NULL as distance`;
    if (latitude && longitude) {
      // Calculate distance using Haversine formula
      distanceSelect = sql`
        6371 * acos(
          cos(radians(${latitude})) * cos(radians(${spacesTable.latitude}::numeric)) *
          cos(radians(${spacesTable.longitude}::numeric) - radians(${longitude})) +
          sin(radians(${latitude})) * sin(radians(${spacesTable.latitude}::numeric))
        ) as distance
      `;
      
      // Convert miles to kilometers for the query
      const radiusKm = radiusMiles * 1.60934;
      conditions.push(
        sql`
          6371 * acos(
            cos(radians(${latitude})) * cos(radians(${spacesTable.latitude}::numeric)) *
            cos(radians(${spacesTable.longitude}::numeric) - radians(${longitude})) +
            sin(radians(${latitude})) * sin(radians(${spacesTable.latitude}::numeric))
          ) <= ${radiusKm}
        `
      );
    }

    // Check availability if date range provided
    if (availableFrom && availableTo) {
      // Exclude spaces that have blocked dates in the requested period
      const blockedSpaceIds = await db
        .selectDistinct({ spaceId: spaceAvailabilityTable.spaceId })
        .from(spaceAvailabilityTable)
        .where(
          and(
            eq(spaceAvailabilityTable.availabilityType, "blocked"),
            or(
              between(spaceAvailabilityTable.startDate, availableFrom, availableTo),
              between(spaceAvailabilityTable.endDate, availableFrom, availableTo),
              and(
                lte(spaceAvailabilityTable.startDate, availableFrom),
                gte(spaceAvailabilityTable.endDate, availableTo)
              )
            )
          )
        );
      
      if (blockedSpaceIds.length > 0) {
        conditions.push(
          not(inArray(spacesTable.id, blockedSpaceIds.map(b => b.spaceId)))
        );
      }
    }

    // Calculate average rating subquery
    const avgRatingSelect = sql`
      (SELECT AVG(rating) 
       FROM ${spaceReviewsTable} 
       WHERE ${spaceReviewsTable.spaceId} = ${spacesTable.id} 
       AND ${spaceReviewsTable.isHidden} = false) as average_rating
    `;
    
    const totalReviewsSelect = sql`
      (SELECT COUNT(*) 
       FROM ${spaceReviewsTable} 
       WHERE ${spaceReviewsTable.spaceId} = ${spacesTable.id} 
       AND ${spaceReviewsTable.isHidden} = false) as total_reviews
    `;

    // Build the main query
    const baseQuery = db
      .select({
        space: spacesTable,
        provider: {
          id: providersTable.id,
          displayName: providersTable.displayName,
          profileImageUrl: providersTable.profileImageUrl,
          slug: providersTable.slug,
          isVerified: providersTable.isVerified,
        },
        distance: distanceSelect,
        averageRating: avgRatingSelect,
        totalReviews: totalReviewsSelect,
      })
      .from(spacesTable)
      .innerJoin(providersTable, eq(spacesTable.providerId, providersTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    // Apply sorting
    let orderByClause;
    switch (sortBy) {
      case "price_hourly":
        orderByClause = sortOrder === "desc" 
          ? desc(spacesTable.hourlyRate) 
          : asc(spacesTable.hourlyRate);
        break;
      case "price_daily":
        orderByClause = sortOrder === "desc" 
          ? desc(spacesTable.dailyRate) 
          : asc(spacesTable.dailyRate);
        break;
      case "capacity":
        orderByClause = sortOrder === "desc" 
          ? desc(spacesTable.capacity) 
          : asc(spacesTable.capacity);
        break;
      case "rating":
        orderByClause = sql`average_rating DESC NULLS LAST`;
        break;
      case "popularity":
        orderByClause = desc(
          sql`${spacesTable.viewCount} + ${spacesTable.favoriteCount} * 2 + ${spacesTable.totalBookings} * 5`
        );
        break;
      case "distance":
        if (latitude && longitude) {
          orderByClause = sortOrder === "desc" 
            ? sql`distance DESC` 
            : sql`distance ASC`;
        } else {
          orderByClause = desc(spacesTable.createdAt);
        }
        break;
      case "created":
      default:
        orderByClause = sortOrder === "desc" 
          ? desc(spacesTable.createdAt) 
          : asc(spacesTable.createdAt);
        break;
    }

    // Execute the query with pagination
    const spaces = await baseQuery
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const countResult = await db
      .select({ count: sql`count(*)` })
      .from(spacesTable)
      .innerJoin(providersTable, eq(spacesTable.providerId, providersTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = Number(countResult[0].count);

    // Format results
    const spacesWithMetadata = spaces.map(({ space, provider, distance, averageRating, totalReviews }) => ({
      ...space,
      provider,
      distance: distance as number | null,
      averageRating: averageRating ? Number(averageRating) : null,
      totalReviews: Number(totalReviews) || 0,
    }));

    return {
      spaces: spacesWithMetadata,
      total,
      hasMore: offset + limit < total,
    };
  } catch (error) {
    console.error("Error searching spaces:", error);
    throw new Error("Failed to search spaces");
  }
}

/**
 * Get featured/popular spaces
 */
export async function getFeaturedSpaces(limit: number = 10) {
  try {
    const spaces = await db
      .select({
        space: spacesTable,
        provider: {
          id: providersTable.id,
          displayName: providersTable.displayName,
          profileImageUrl: providersTable.profileImageUrl,
          slug: providersTable.slug,
          isVerified: providersTable.isVerified,
        },
        averageRating: sql`
          (SELECT AVG(rating) 
           FROM ${spaceReviewsTable} 
           WHERE ${spaceReviewsTable.spaceId} = ${spacesTable.id} 
           AND ${spaceReviewsTable.isHidden} = false)
        `,
        totalReviews: sql`
          (SELECT COUNT(*) 
           FROM ${spaceReviewsTable} 
           WHERE ${spaceReviewsTable.spaceId} = ${spacesTable.id} 
           AND ${spaceReviewsTable.isHidden} = false)
        `,
      })
      .from(spacesTable)
      .innerJoin(providersTable, eq(spacesTable.providerId, providersTable.id))
      .where(
        and(
          eq(spacesTable.isActive, true),
          eq(spacesTable.isVerified, true),
          sql`${spacesTable.totalBookings} > 5`
        )
      )
      .orderBy(
        desc(sql`
          COALESCE((SELECT AVG(rating) FROM ${spaceReviewsTable} WHERE ${spaceReviewsTable.spaceId} = ${spacesTable.id}), 0) * 10 +
          ${spacesTable.totalBookings} * 2 +
          ${spacesTable.favoriteCount}
        `)
      )
      .limit(limit);

    return spaces.map(({ space, provider, averageRating, totalReviews }) => ({
      ...space,
      provider,
      averageRating: averageRating ? Number(averageRating) : null,
      totalReviews: Number(totalReviews) || 0,
    }));
  } catch (error) {
    console.error("Error fetching featured spaces:", error);
    throw new Error("Failed to fetch featured spaces");
  }
}

/**
 * Get a single space by ID
 */
export async function getSpaceById(id: string, incrementView = false) {
  try {
    // Increment view count if requested
    if (incrementView) {
      await db
        .update(spacesTable)
        .set({ 
          viewCount: sql`${spacesTable.viewCount} + 1`,
          updatedAt: new Date()
        })
        .where(eq(spacesTable.id, id));
    }

    const result = await db
      .select({
        space: spacesTable,
        provider: providersTable,
        averageRating: sql`
          (SELECT AVG(rating) 
           FROM ${spaceReviewsTable} 
           WHERE ${spaceReviewsTable.spaceId} = ${spacesTable.id} 
           AND ${spaceReviewsTable.isHidden} = false)
        `,
        totalReviews: sql`
          (SELECT COUNT(*) 
           FROM ${spaceReviewsTable} 
           WHERE ${spaceReviewsTable.spaceId} = ${spacesTable.id} 
           AND ${spaceReviewsTable.isHidden} = false)
        `,
      })
      .from(spacesTable)
      .innerJoin(providersTable, eq(spacesTable.providerId, providersTable.id))
      .where(eq(spacesTable.id, id))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const { space, provider, averageRating, totalReviews } = result[0];

    return {
      ...space,
      provider,
      averageRating: averageRating ? Number(averageRating) : null,
      totalReviews: Number(totalReviews) || 0,
    };
  } catch (error) {
    console.error("Error fetching space:", error);
    throw new Error("Failed to fetch space");
  }
}

/**
 * Create a new space
 */
export async function createSpace(data: NewSpace) {
  try {
    // Geocode the address if provided
    let geocodingData = {};
    const fullAddress = `${data.address}, ${data.city}, ${data.state} ${data.zipCode}`.trim();
    const geocoded = await getGeocoding(fullAddress);
    if (geocoded) {
      geocodingData = {
        latitude: geocoded.lat.toString(),
        longitude: geocoded.lng.toString(),
        geocodedAt: new Date(),
        coordinates: { lat: geocoded.lat, lng: geocoded.lng }
      };
    }

    const [space] = await db
      .insert(spacesTable)
      .values({
        ...data,
        ...geocodingData,
        slug: generateSlug(data.name),
        updatedAt: new Date(),
      })
      .returning();

    return space;
  } catch (error) {
    console.error("Error creating space:", error);
    throw new Error("Failed to create space");
  }
}

/**
 * Update a space
 */
export async function updateSpace(id: string, data: Partial<NewSpace>) {
  try {
    // Re-geocode if address changed
    let geocodingData = {};
    if (data.address || data.city || data.state || data.zipCode) {
      const current = await getSpaceById(id);
      if (current) {
        const fullAddress = `${data.address || current.address}, ${data.city || current.city}, ${data.state || current.state} ${data.zipCode || current.zipCode}`.trim();
        const geocoded = await getGeocoding(fullAddress);
        if (geocoded) {
          geocodingData = {
            latitude: geocoded.lat.toString(),
            longitude: geocoded.lng.toString(),
            geocodedAt: new Date(),
            coordinates: { lat: geocoded.lat, lng: geocoded.lng }
          };
        }
      }
    }

    const [space] = await db
      .update(spacesTable)
      .set({
        ...data,
        ...geocodingData,
        updatedAt: new Date(),
      })
      .where(eq(spacesTable.id, id))
      .returning();

    return space;
  } catch (error) {
    console.error("Error updating space:", error);
    throw new Error("Failed to update space");
  }
}

/**
 * Delete a space
 */
export async function deleteSpace(id: string) {
  try {
    // Check if there are any active bookings
    const activeBookings = await db
      .select({ count: sql`count(*)` })
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.serviceId, id),
          eq(bookingsTable.bookingType, "space"),
          inArray(bookingsTable.status, ["PENDING_PROVIDER", "ACCEPTED", "PAYMENT_PENDING", "PAYMENT_SUCCEEDED"])
        )
      );

    if (Number(activeBookings[0].count) > 0) {
      throw new Error("Cannot delete space with active bookings");
    }

    await db.delete(spacesTable).where(eq(spacesTable.id, id));
    return { success: true };
  } catch (error) {
    console.error("Error deleting space:", error);
    throw error;
  }
}

/**
 * Check space availability for a date range
 */
export async function checkSpaceAvailability(
  spaceId: string, 
  startDate: Date, 
  endDate: Date
) {
  try {
    const space = await getSpaceById(spaceId);
    if (!space) {
      return { available: false, reason: "Space not found" };
    }

    if (!space.isActive) {
      return { available: false, reason: "Space is not active" };
    }

    // Check for blocked dates
    const blockedDates = await db
      .select()
      .from(spaceAvailabilityTable)
      .where(
        and(
          eq(spaceAvailabilityTable.spaceId, spaceId),
          eq(spaceAvailabilityTable.availabilityType, "blocked"),
          or(
            between(spaceAvailabilityTable.startDate, startDate, endDate),
            between(spaceAvailabilityTable.endDate, startDate, endDate),
            and(
              lte(spaceAvailabilityTable.startDate, startDate),
              gte(spaceAvailabilityTable.endDate, endDate)
            )
          )
        )
      );

    if (blockedDates.length > 0) {
      return { 
        available: false, 
        reason: "Space is not available for the selected dates",
        blockedDates: blockedDates.map(d => ({
          start: d.startDate,
          end: d.endDate,
          reason: d.reason
        }))
      };
    }

    // Check for existing bookings
    const existingBookings = await db
      .select({ count: sql`count(*)` })
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.serviceId, spaceId),
          eq(bookingsTable.bookingType, "space"),
          inArray(bookingsTable.status, ["ACCEPTED", "PAYMENT_SUCCEEDED", "COMPLETED"]),
          or(
            between(bookingsTable.bookingStartDateTime, startDate, endDate),
            between(bookingsTable.bookingEndDateTime, startDate, endDate),
            and(
              lte(bookingsTable.bookingStartDateTime, startDate),
              gte(bookingsTable.bookingEndDateTime, endDate)
            )
          )
        )
      );

    if (Number(existingBookings[0].count) > 0) {
      return { 
        available: false, 
        reason: "Space is already booked for the selected dates" 
      };
    }

    // Calculate pricing based on duration
    const hours = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60));
    const days = Math.ceil(hours / 24);
    const weeks = Math.floor(days / 7);

    let price = 0;
    let priceType = "";

    if (weeks > 0 && space.weeklyRate) {
      price = Number(space.weeklyRate) * weeks;
      priceType = "weekly";
      const remainingDays = days % 7;
      if (remainingDays > 0 && space.dailyRate) {
        price += Number(space.dailyRate) * remainingDays;
      }
    } else if (days > 1 && space.dailyRate) {
      price = Number(space.dailyRate) * days;
      priceType = "daily";
    } else if (space.hourlyRate) {
      price = Number(space.hourlyRate) * hours;
      priceType = "hourly";
    }

    return {
      available: true,
      price,
      priceType,
      cleaningFee: space.cleaningFee ? Number(space.cleaningFee) : 0,
      securityDeposit: space.securityDeposit ? Number(space.securityDeposit) : 0,
      totalPrice: price + (space.cleaningFee ? Number(space.cleaningFee) : 0),
      instantBooking: space.instantBooking,
      requiresApproval: space.requiresApproval,
      cancellationPolicy: space.cancellationPolicy,
    };
  } catch (error) {
    console.error("Error checking space availability:", error);
    throw new Error("Failed to check space availability");
  }
}

/**
 * Block space availability
 */
export async function blockSpaceAvailability(
  spaceId: string,
  startDate: Date,
  endDate: Date,
  reason?: string
) {
  try {
    const [availability] = await db
      .insert(spaceAvailabilityTable)
      .values({
        spaceId,
        availabilityType: "blocked",
        startDate,
        endDate,
        reason,
      })
      .returning();

    return availability;
  } catch (error) {
    console.error("Error blocking space availability:", error);
    throw new Error("Failed to block space availability");
  }
}

/**
 * Get spaces by provider
 */
export async function getSpacesByProvider(providerId: string, limit = 20, offset = 0) {
  try {
    const spaces = await db
      .select({
        space: spacesTable,
        averageRating: sql`
          (SELECT AVG(rating) 
           FROM ${spaceReviewsTable} 
           WHERE ${spaceReviewsTable.spaceId} = ${spacesTable.id} 
           AND ${spaceReviewsTable.isHidden} = false)
        `,
        totalReviews: sql`
          (SELECT COUNT(*) 
           FROM ${spaceReviewsTable} 
           WHERE ${spaceReviewsTable.spaceId} = ${spacesTable.id} 
           AND ${spaceReviewsTable.isHidden} = false)
        `,
      })
      .from(spacesTable)
      .where(
        and(
          eq(spacesTable.providerId, providerId),
          eq(spacesTable.isActive, true)
        )
      )
      .orderBy(desc(spacesTable.createdAt))
      .limit(limit)
      .offset(offset);

    return spaces.map(({ space, averageRating, totalReviews }) => ({
      ...space,
      averageRating: averageRating ? Number(averageRating) : null,
      totalReviews: Number(totalReviews) || 0,
    }));
  } catch (error) {
    console.error("Error fetching provider spaces:", error);
    throw new Error("Failed to fetch provider spaces");
  }
}

/**
 * Search spaces by amenities
 */
export async function searchSpacesByAmenities(amenities: string[], limit = 20) {
  try {
    const conditions = [
      eq(spacesTable.isActive, true),
      ...amenities.map(amenity => 
        sql`${spacesTable.amenities}::jsonb @> ${JSON.stringify([amenity])}::jsonb`
      )
    ];

    const spaces = await db
      .select({
        space: spacesTable,
        provider: {
          id: providersTable.id,
          displayName: providersTable.displayName,
          profileImageUrl: providersTable.profileImageUrl,
          slug: providersTable.slug,
          isVerified: providersTable.isVerified,
        },
      })
      .from(spacesTable)
      .innerJoin(providersTable, eq(spacesTable.providerId, providersTable.id))
      .where(and(...conditions))
      .limit(limit);

    return spaces.map(({ space, provider }) => ({
      ...space,
      provider,
    }));
  } catch (error) {
    console.error("Error searching spaces by amenities:", error);
    throw new Error("Failed to search spaces by amenities");
  }
}

/**
 * Generate a URL-friendly slug from name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim()
    + '-' + Date.now().toString(36);
}