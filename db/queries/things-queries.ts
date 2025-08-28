import { db } from "@/db/db";
import { 
  thingsTable, 
  thingsFavoritesTable,
  thingsInquiriesTable,
  type Thing, 
  type NewThing,
  type ThingInquiry,
  type NewThingInquiry
} from "@/db/schema/things-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq, and, gte, lte, ilike, sql, desc, asc, or, between, gt, lt, inArray, isNull, not } from "drizzle-orm";
import { getGeocoding } from "@/lib/geocoding";

export interface SearchThingsFilters {
  query?: string;
  category?: string;
  subcategory?: string;
  condition?: string[];
  brand?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  minPrice?: number;
  maxPrice?: number;
  negotiable?: boolean;
  shippingAvailable?: boolean;
  localPickupOnly?: boolean;
  status?: string[];
  featured?: boolean;
  sellerId?: string;
  latitude?: number;
  longitude?: number;
  radiusMiles?: number;
  sortBy?: "price" | "created" | "views" | "distance" | "popularity";
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface ThingWithSeller extends Thing {
  seller: {
    userId: string;
    displayName: string;
    profileImageUrl: string | null;
    memberSince: Date;
    totalListings?: number;
    rating?: number;
  };
  distance?: number;
}

/**
 * Search things with comprehensive filters
 */
export async function searchThings(filters: SearchThingsFilters) {
  try {
    const {
      query,
      category,
      subcategory,
      condition,
      brand,
      city,
      state,
      zipCode,
      minPrice,
      maxPrice,
      negotiable,
      shippingAvailable,
      localPickupOnly,
      status = ["active"],
      featured,
      sellerId,
      latitude,
      longitude,
      radiusMiles = 25,
      sortBy = "created",
      sortOrder = "desc",
      limit = 20,
      offset = 0,
    } = filters;

    // Build where conditions
    const conditions = [];
    
    // Status filter (default to active only)
    if (status && status.length > 0) {
      conditions.push(inArray(thingsTable.status, status));
    }

    // Text search across title, description, brand, model, and keywords
    if (query) {
      conditions.push(
        or(
          ilike(thingsTable.title, `%${query}%`),
          ilike(thingsTable.description, `%${query}%`),
          ilike(thingsTable.brand, `%${query}%`),
          ilike(thingsTable.model, `%${query}%`),
          ilike(thingsTable.keywords, `%${query}%`)
        )
      );
    }

    // Category filters
    if (category) {
      conditions.push(eq(thingsTable.category, category));
    }
    if (subcategory) {
      conditions.push(eq(thingsTable.subcategory, subcategory));
    }

    // Condition filter (can be multiple)
    if (condition && condition.length > 0) {
      conditions.push(inArray(thingsTable.condition, condition));
    }

    // Brand filter
    if (brand) {
      conditions.push(ilike(thingsTable.brand, `%${brand}%`));
    }

    // Location filters
    if (city) {
      conditions.push(ilike(thingsTable.city, `%${city}%`));
    }
    if (state) {
      conditions.push(eq(thingsTable.state, state));
    }
    if (zipCode) {
      conditions.push(eq(thingsTable.zipCode, zipCode));
    }

    // Price range filter
    if (minPrice !== undefined && maxPrice !== undefined) {
      conditions.push(between(thingsTable.price, minPrice.toString(), maxPrice.toString()));
    } else if (minPrice !== undefined) {
      conditions.push(gte(thingsTable.price, minPrice.toString()));
    } else if (maxPrice !== undefined) {
      conditions.push(lte(thingsTable.price, maxPrice.toString()));
    }

    // Negotiable filter
    if (negotiable !== undefined) {
      conditions.push(eq(thingsTable.negotiable, negotiable));
    }

    // Shipping/pickup filters
    if (shippingAvailable !== undefined) {
      conditions.push(eq(thingsTable.shippingAvailable, shippingAvailable));
    }
    if (localPickupOnly !== undefined) {
      conditions.push(eq(thingsTable.localPickupOnly, localPickupOnly));
    }

    // Featured filter
    if (featured !== undefined) {
      conditions.push(eq(thingsTable.featured, featured));
    }

    // Seller filter
    if (sellerId) {
      conditions.push(eq(thingsTable.sellerId, sellerId));
    }

    // Build the query
    let baseQuery = db
      .select({
        // Thing fields
        id: thingsTable.id,
        title: thingsTable.title,
        description: thingsTable.description,
        category: thingsTable.category,
        subcategory: thingsTable.subcategory,
        condition: thingsTable.condition,
        brand: thingsTable.brand,
        model: thingsTable.model,
        price: thingsTable.price,
        originalPrice: thingsTable.originalPrice,
        negotiable: thingsTable.negotiable,
        currency: thingsTable.currency,
        images: thingsTable.images,
        thumbnailUrl: thingsTable.thumbnailUrl,
        videoUrl: thingsTable.videoUrl,
        location: thingsTable.location,
        city: thingsTable.city,
        state: thingsTable.state,
        zipCode: thingsTable.zipCode,
        latitude: thingsTable.latitude,
        longitude: thingsTable.longitude,
        status: thingsTable.status,
        quantity: thingsTable.quantity,
        availableFrom: thingsTable.availableFrom,
        availableUntil: thingsTable.availableUntil,
        shippingAvailable: thingsTable.shippingAvailable,
        shippingCost: thingsTable.shippingCost,
        localPickupOnly: thingsTable.localPickupOnly,
        deliveryRadius: thingsTable.deliveryRadius,
        sellerId: thingsTable.sellerId,
        contactPhone: thingsTable.contactPhone,
        contactEmail: thingsTable.contactEmail,
        preferredContact: thingsTable.preferredContact,
        specifications: thingsTable.specifications,
        tags: thingsTable.tags,
        yearManufactured: thingsTable.yearManufactured,
        dimensions: thingsTable.dimensions,
        viewCount: thingsTable.viewCount,
        favoriteCount: thingsTable.favoriteCount,
        inquiryCount: thingsTable.inquiryCount,
        slug: thingsTable.slug,
        keywords: thingsTable.keywords,
        featured: thingsTable.featured,
        boosted: thingsTable.boosted,
        boostedUntil: thingsTable.boostedUntil,
        createdAt: thingsTable.createdAt,
        updatedAt: thingsTable.updatedAt,
        publishedAt: thingsTable.publishedAt,
        soldAt: thingsTable.soldAt,
        lastBumpedAt: thingsTable.lastBumpedAt,
        // Seller info
        seller: {
          userId: profilesTable.userId,
          displayName: profilesTable.displayName,
          profileImageUrl: profilesTable.profileImageUrl,
          memberSince: profilesTable.createdAt,
        },
        // Distance calculation if coordinates provided
        distance: latitude && longitude && thingsTable.latitude && thingsTable.longitude
          ? sql<number>`
              ROUND(
                3959 * acos(
                  cos(radians(${latitude})) * cos(radians(${thingsTable.latitude})) *
                  cos(radians(${thingsTable.longitude}) - radians(${longitude})) +
                  sin(radians(${latitude})) * sin(radians(${thingsTable.latitude}))
                )::numeric, 2
              )
            `
          : sql<number>`NULL`,
      })
      .from(thingsTable)
      .leftJoin(profilesTable, eq(thingsTable.sellerId, profilesTable.userId));

    // Apply conditions
    if (conditions.length > 0) {
      baseQuery = baseQuery.where(and(...conditions));
    }

    // Apply distance filter if coordinates provided
    if (latitude && longitude && radiusMiles) {
      baseQuery = baseQuery.where(
        sql`
          3959 * acos(
            cos(radians(${latitude})) * cos(radians(${thingsTable.latitude})) *
            cos(radians(${thingsTable.longitude}) - radians(${longitude})) +
            sin(radians(${latitude})) * sin(radians(${thingsTable.latitude}))
          ) <= ${radiusMiles}
        `
      );
    }

    // Apply sorting
    let orderByClause;
    switch (sortBy) {
      case "price":
        orderByClause = sortOrder === "desc" ? desc(thingsTable.price) : asc(thingsTable.price);
        break;
      case "views":
        orderByClause = sortOrder === "desc" ? desc(thingsTable.viewCount) : asc(thingsTable.viewCount);
        break;
      case "popularity":
        orderByClause = sortOrder === "desc" 
          ? desc(sql`${thingsTable.viewCount} + ${thingsTable.favoriteCount} * 2 + ${thingsTable.inquiryCount} * 3`)
          : asc(sql`${thingsTable.viewCount} + ${thingsTable.favoriteCount} * 2 + ${thingsTable.inquiryCount} * 3`);
        break;
      case "distance":
        if (latitude && longitude) {
          orderByClause = sortOrder === "desc"
            ? desc(sql`distance`)
            : asc(sql`distance`);
        } else {
          orderByClause = desc(thingsTable.createdAt);
        }
        break;
      case "created":
      default:
        orderByClause = sortOrder === "desc" ? desc(thingsTable.createdAt) : asc(thingsTable.createdAt);
        break;
    }

    // Execute paginated query
    const things = await baseQuery
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    // Get total count
    const countQuery = await db
      .select({ count: sql<number>`count(*)` })
      .from(thingsTable)
      .leftJoin(profilesTable, eq(thingsTable.sellerId, profilesTable.userId))
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = Number(countQuery[0]?.count || 0);
    const hasMore = offset + limit < total;

    return {
      things,
      total,
      hasMore,
    };
  } catch (error) {
    console.error("Error searching things:", error);
    throw error;
  }
}

/**
 * Get a single thing by ID
 */
export async function getThingById(id: string, incrementView = false) {
  try {
    // Increment view count if requested
    if (incrementView) {
      await db
        .update(thingsTable)
        .set({ 
          viewCount: sql`${thingsTable.viewCount} + 1`,
          updatedAt: new Date()
        })
        .where(eq(thingsTable.id, id));
    }

    const [thing] = await db
      .select({
        // Thing fields
        id: thingsTable.id,
        title: thingsTable.title,
        description: thingsTable.description,
        category: thingsTable.category,
        subcategory: thingsTable.subcategory,
        condition: thingsTable.condition,
        brand: thingsTable.brand,
        model: thingsTable.model,
        price: thingsTable.price,
        originalPrice: thingsTable.originalPrice,
        negotiable: thingsTable.negotiable,
        currency: thingsTable.currency,
        images: thingsTable.images,
        thumbnailUrl: thingsTable.thumbnailUrl,
        videoUrl: thingsTable.videoUrl,
        location: thingsTable.location,
        city: thingsTable.city,
        state: thingsTable.state,
        zipCode: thingsTable.zipCode,
        latitude: thingsTable.latitude,
        longitude: thingsTable.longitude,
        status: thingsTable.status,
        quantity: thingsTable.quantity,
        availableFrom: thingsTable.availableFrom,
        availableUntil: thingsTable.availableUntil,
        shippingAvailable: thingsTable.shippingAvailable,
        shippingCost: thingsTable.shippingCost,
        localPickupOnly: thingsTable.localPickupOnly,
        deliveryRadius: thingsTable.deliveryRadius,
        sellerId: thingsTable.sellerId,
        contactPhone: thingsTable.contactPhone,
        contactEmail: thingsTable.contactEmail,
        preferredContact: thingsTable.preferredContact,
        specifications: thingsTable.specifications,
        tags: thingsTable.tags,
        yearManufactured: thingsTable.yearManufactured,
        dimensions: thingsTable.dimensions,
        viewCount: thingsTable.viewCount,
        favoriteCount: thingsTable.favoriteCount,
        inquiryCount: thingsTable.inquiryCount,
        slug: thingsTable.slug,
        keywords: thingsTable.keywords,
        featured: thingsTable.featured,
        boosted: thingsTable.boosted,
        boostedUntil: thingsTable.boostedUntil,
        createdAt: thingsTable.createdAt,
        updatedAt: thingsTable.updatedAt,
        publishedAt: thingsTable.publishedAt,
        soldAt: thingsTable.soldAt,
        lastBumpedAt: thingsTable.lastBumpedAt,
        // Seller info
        seller: {
          userId: profilesTable.userId,
          displayName: profilesTable.displayName,
          profileImageUrl: profilesTable.profileImageUrl,
          memberSince: profilesTable.createdAt,
        },
      })
      .from(thingsTable)
      .leftJoin(profilesTable, eq(thingsTable.sellerId, profilesTable.userId))
      .where(eq(thingsTable.id, id))
      .limit(1);

    return thing;
  } catch (error) {
    console.error("Error getting thing by ID:", error);
    throw error;
  }
}

/**
 * Create a new thing listing
 */
export async function createThing(data: Omit<NewThing, "id" | "createdAt" | "updatedAt">) {
  try {
    // Generate slug from title
    const slug = data.title.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      + '-' + Date.now();

    const [thing] = await db
      .insert(thingsTable)
      .values({
        ...data,
        slug,
        status: data.status || "active",
        publishedAt: data.status === "active" ? new Date() : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return thing;
  } catch (error) {
    console.error("Error creating thing:", error);
    throw error;
  }
}

/**
 * Update a thing listing
 */
export async function updateThing(id: string, data: Partial<Omit<Thing, "id" | "createdAt" | "sellerId">>) {
  try {
    // Handle status changes
    const updateData: any = {
      ...data,
      updatedAt: new Date(),
    };

    // Set publishedAt when activating
    if (data.status === "active" && !updateData.publishedAt) {
      updateData.publishedAt = new Date();
    }

    // Set soldAt when marking as sold
    if (data.status === "sold" && !updateData.soldAt) {
      updateData.soldAt = new Date();
    }

    const [updatedThing] = await db
      .update(thingsTable)
      .set(updateData)
      .where(eq(thingsTable.id, id))
      .returning();

    return updatedThing;
  } catch (error) {
    console.error("Error updating thing:", error);
    throw error;
  }
}

/**
 * Delete a thing listing (soft delete by changing status)
 */
export async function deleteThing(id: string) {
  try {
    const [deletedThing] = await db
      .update(thingsTable)
      .set({ 
        status: "deleted",
        updatedAt: new Date()
      })
      .where(eq(thingsTable.id, id))
      .returning();

    return deletedThing;
  } catch (error) {
    console.error("Error deleting thing:", error);
    throw error;
  }
}

/**
 * Get featured/trending things
 */
export async function getFeaturedThings(limit = 12) {
  try {
    const things = await db
      .select({
        // Thing fields
        id: thingsTable.id,
        title: thingsTable.title,
        description: thingsTable.description,
        category: thingsTable.category,
        condition: thingsTable.condition,
        brand: thingsTable.brand,
        price: thingsTable.price,
        originalPrice: thingsTable.originalPrice,
        negotiable: thingsTable.negotiable,
        images: thingsTable.images,
        thumbnailUrl: thingsTable.thumbnailUrl,
        city: thingsTable.city,
        state: thingsTable.state,
        shippingAvailable: thingsTable.shippingAvailable,
        localPickupOnly: thingsTable.localPickupOnly,
        viewCount: thingsTable.viewCount,
        favoriteCount: thingsTable.favoriteCount,
        inquiryCount: thingsTable.inquiryCount,
        featured: thingsTable.featured,
        boosted: thingsTable.boosted,
        createdAt: thingsTable.createdAt,
        // Seller info
        seller: {
          userId: profilesTable.userId,
          displayName: profilesTable.displayName,
          profileImageUrl: profilesTable.profileImageUrl,
        },
      })
      .from(thingsTable)
      .leftJoin(profilesTable, eq(thingsTable.sellerId, profilesTable.userId))
      .where(
        and(
          eq(thingsTable.status, "active"),
          or(
            eq(thingsTable.featured, true),
            and(
              eq(thingsTable.boosted, true),
              gt(thingsTable.boostedUntil, new Date())
            )
          )
        )
      )
      .orderBy(
        desc(thingsTable.featured),
        desc(thingsTable.boosted),
        desc(sql`${thingsTable.viewCount} + ${thingsTable.favoriteCount} * 2 + ${thingsTable.inquiryCount} * 3`)
      )
      .limit(limit);

    // If not enough featured items, get popular ones
    if (things.length < limit) {
      const popularThings = await db
        .select({
          id: thingsTable.id,
          title: thingsTable.title,
          description: thingsTable.description,
          category: thingsTable.category,
          condition: thingsTable.condition,
          brand: thingsTable.brand,
          price: thingsTable.price,
          originalPrice: thingsTable.originalPrice,
          negotiable: thingsTable.negotiable,
          images: thingsTable.images,
          thumbnailUrl: thingsTable.thumbnailUrl,
          city: thingsTable.city,
          state: thingsTable.state,
          shippingAvailable: thingsTable.shippingAvailable,
          localPickupOnly: thingsTable.localPickupOnly,
          viewCount: thingsTable.viewCount,
          favoriteCount: thingsTable.favoriteCount,
          inquiryCount: thingsTable.inquiryCount,
          featured: thingsTable.featured,
          createdAt: thingsTable.createdAt,
          seller: {
            userId: profilesTable.userId,
            displayName: profilesTable.displayName,
            profileImageUrl: profilesTable.profileImageUrl,
          },
        })
        .from(thingsTable)
        .leftJoin(profilesTable, eq(thingsTable.sellerId, profilesTable.userId))
        .where(
          and(
            eq(thingsTable.status, "active"),
            not(eq(thingsTable.featured, true))
          )
        )
        .orderBy(
          desc(sql`${thingsTable.viewCount} + ${thingsTable.favoriteCount} * 2 + ${thingsTable.inquiryCount} * 3`)
        )
        .limit(limit - things.length);

      things.push(...popularThings);
    }

    return things;
  } catch (error) {
    console.error("Error getting featured things:", error);
    throw error;
  }
}

/**
 * Get category counts
 */
export async function getCategoryCounts() {
  try {
    const counts = await db
      .select({
        category: thingsTable.category,
        count: sql<number>`count(*)`,
      })
      .from(thingsTable)
      .where(eq(thingsTable.status, "active"))
      .groupBy(thingsTable.category);

    return counts.reduce((acc, { category, count }) => {
      acc[category] = Number(count);
      return acc;
    }, {} as Record<string, number>);
  } catch (error) {
    console.error("Error getting category counts:", error);
    throw error;
  }
}

/**
 * Create an inquiry/offer for a thing
 */
export async function createInquiry(data: {
  thingId: string;
  fromUserId: string;
  message: string;
  offerAmount?: number;
}) {
  try {
    // Get the thing to find the seller
    const [thing] = await db
      .select({ sellerId: thingsTable.sellerId })
      .from(thingsTable)
      .where(eq(thingsTable.id, data.thingId))
      .limit(1);

    if (!thing) {
      throw new Error("Thing not found");
    }

    // Create the inquiry
    const [inquiry] = await db
      .insert(thingsInquiriesTable)
      .values({
        thingId: data.thingId,
        fromUserId: data.fromUserId,
        toUserId: thing.sellerId,
        message: data.message,
        offerAmount: data.offerAmount?.toString(),
        status: "pending",
        createdAt: new Date(),
      })
      .returning();

    // Increment inquiry count
    await db
      .update(thingsTable)
      .set({ 
        inquiryCount: sql`${thingsTable.inquiryCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(thingsTable.id, data.thingId));

    return inquiry;
  } catch (error) {
    console.error("Error creating inquiry:", error);
    throw error;
  }
}

/**
 * Mark a thing as sold
 */
export async function markThingAsSold(id: string, buyerId?: string) {
  try {
    const [soldThing] = await db
      .update(thingsTable)
      .set({
        status: "sold",
        soldAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(thingsTable.id, id))
      .returning();

    return soldThing;
  } catch (error) {
    console.error("Error marking thing as sold:", error);
    throw error;
  }
}

/**
 * Reserve a thing for a buyer
 */
export async function reserveThing(id: string) {
  try {
    const [reservedThing] = await db
      .update(thingsTable)
      .set({
        status: "reserved",
        updatedAt: new Date(),
      })
      .where(eq(thingsTable.id, id))
      .returning();

    return reservedThing;
  } catch (error) {
    console.error("Error reserving thing:", error);
    throw error;
  }
}

/**
 * Toggle favorite status for a thing
 */
export async function toggleThingFavorite(thingId: string, userId: string) {
  try {
    // Check if already favorited
    const [existing] = await db
      .select()
      .from(thingsFavoritesTable)
      .where(
        and(
          eq(thingsFavoritesTable.thingId, thingId),
          eq(thingsFavoritesTable.userId, userId)
        )
      )
      .limit(1);

    if (existing) {
      // Remove favorite
      await db
        .delete(thingsFavoritesTable)
        .where(eq(thingsFavoritesTable.id, existing.id));

      // Decrement favorite count
      await db
        .update(thingsTable)
        .set({ 
          favoriteCount: sql`GREATEST(0, ${thingsTable.favoriteCount} - 1)`,
          updatedAt: new Date()
        })
        .where(eq(thingsTable.id, thingId));

      return { favorited: false };
    } else {
      // Add favorite
      await db
        .insert(thingsFavoritesTable)
        .values({
          thingId,
          userId,
          createdAt: new Date(),
        });

      // Increment favorite count
      await db
        .update(thingsTable)
        .set({ 
          favoriteCount: sql`${thingsTable.favoriteCount} + 1`,
          updatedAt: new Date()
        })
        .where(eq(thingsTable.id, thingId));

      return { favorited: true };
    }
  } catch (error) {
    console.error("Error toggling thing favorite:", error);
    throw error;
  }
}