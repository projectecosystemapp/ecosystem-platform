import { db } from "@/db/db";
import { 
  providersTable,
  bookingsTable,
  reviewsTable,
  messagesTable,
  eventsTable,
  spacesTable,
  thingsTable,
  loyaltyAccountsTable,
  paymentsTable,
  notificationsTable,
  profilesTable,
} from "@/db/schema";
import { eq, and, or, desc, asc, sql, inArray, between, gte, lte } from "drizzle-orm";

/**
 * Optimized database queries with proper SELECT statements and performance considerations
 * This file replaces inefficient SELECT * queries with targeted column selection
 */

// Optimized provider search with selective column retrieval
export async function getProvidersOptimized(filters: {
  location?: { city?: string; state?: string };
  priceRange?: { min?: number; max?: number };
  rating?: number;
  services?: string[];
  limit?: number;
  offset?: number;
}) {
  const conditions = [eq(providersTable.isActive, true)];
  
  if (filters.location?.city) {
    conditions.push(eq(providersTable.locationCity, filters.location.city));
  }
  
  if (filters.location?.state) {
    conditions.push(eq(providersTable.locationState, filters.location.state));
  }
  
  if (filters.priceRange?.min) {
    conditions.push(gte(sql`CAST(${providersTable.hourlyRate} AS DECIMAL)`, filters.priceRange.min));
  }
  
  if (filters.priceRange?.max) {
    conditions.push(lte(sql`CAST(${providersTable.hourlyRate} AS DECIMAL)`, filters.priceRange.max));
  }
  
  if (filters.rating) {
    conditions.push(gte(sql`CAST(${providersTable.averageRating} AS DECIMAL)`, filters.rating));
  }

  // Optimized query with selective columns and proper indexing
  return await db
    .select({
      id: providersTable.id,
      displayName: providersTable.displayName,
      tagline: providersTable.tagline,
      profileImage: providersTable.profileImage,
      locationCity: providersTable.locationCity,
      locationState: providersTable.locationState,
      hourlyRate: providersTable.hourlyRate,
      averageRating: providersTable.averageRating,
      totalReviews: providersTable.totalReviews,
      isVerified: providersTable.isVerified,
      slug: providersTable.slug,
      services: providersTable.services,
    })
    .from(providersTable)
    .where(and(...conditions))
    .orderBy(
      desc(providersTable.isVerified),
      desc(sql`CAST(${providersTable.averageRating} AS DECIMAL)`),
      desc(providersTable.totalReviews)
    )
    .limit(filters.limit || 20)
    .offset(filters.offset || 0);
}

// Optimized customer booking history
export async function getCustomerBookingsOptimized(
  customerId: string,
  status?: string[],
  limit: number = 20,
  offset: number = 0
) {
  const conditions = [eq(bookingsTable.customerId, customerId)];
  
  if (status && status.length > 0) {
    conditions.push(inArray(bookingsTable.status, status));
  }

  return await db
    .select({
      id: bookingsTable.id,
      providerId: bookingsTable.providerId,
      serviceType: bookingsTable.serviceType,
      bookingDate: bookingsTable.bookingDate,
      startTime: bookingsTable.startTime,
      endTime: bookingsTable.endTime,
      status: bookingsTable.status,
      totalAmount: bookingsTable.totalAmount,
      createdAt: bookingsTable.createdAt,
      // Include provider info through join
      providerName: providersTable.displayName,
      providerImage: providersTable.profileImage,
    })
    .from(bookingsTable)
    .innerJoin(providersTable, eq(bookingsTable.providerId, providersTable.id))
    .where(and(...conditions))
    .orderBy(desc(bookingsTable.createdAt))
    .limit(limit)
    .offset(offset);
}

// Optimized provider dashboard data
export async function getProviderDashboardData(providerId: string) {
  // Get provider basic info
  const providerInfo = await db
    .select({
      id: providersTable.id,
      displayName: providersTable.displayName,
      averageRating: providersTable.averageRating,
      totalReviews: providersTable.totalReviews,
      completedBookings: providersTable.completedBookings,
      isVerified: providersTable.isVerified,
    })
    .from(providersTable)
    .where(eq(providersTable.id, providerId))
    .limit(1);

  // Get recent bookings with customer info
  const recentBookings = await db
    .select({
      id: bookingsTable.id,
      bookingDate: bookingsTable.bookingDate,
      startTime: bookingsTable.startTime,
      status: bookingsTable.status,
      totalAmount: bookingsTable.totalAmount,
      customerName: profilesTable.firstName,
      customerImage: profilesTable.profileImageUrl,
    })
    .from(bookingsTable)
    .leftJoin(profilesTable, eq(bookingsTable.customerId, profilesTable.userId))
    .where(eq(bookingsTable.providerId, providerId))
    .orderBy(desc(bookingsTable.createdAt))
    .limit(10);

  // Get earnings summary for current month
  const currentMonth = new Date();
  currentMonth.setDate(1); // First day of month
  
  const earnings = await db
    .select({
      totalEarnings: sql<number>`COALESCE(SUM(CAST(${bookingsTable.providerEarnings} AS DECIMAL)), 0)`,
      completedBookings: sql<number>`COUNT(*)`,
    })
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.providerId, providerId),
        eq(bookingsTable.status, 'completed'),
        gte(bookingsTable.createdAt, currentMonth)
      )
    );

  return {
    provider: providerInfo[0] || null,
    recentBookings,
    monthlyEarnings: earnings[0] || { totalEarnings: 0, completedBookings: 0 },
  };
}

// Optimized message threads
export async function getConversationMessagesOptimized(
  conversationId: string,
  limit: number = 50,
  offset: number = 0
) {
  return await db
    .select({
      id: messagesTable.id,
      senderId: messagesTable.senderId,
      recipientId: messagesTable.recipientId,
      content: messagesTable.content,
      messageType: messagesTable.messageType,
      createdAt: messagesTable.createdAt,
      isRead: messagesTable.isRead,
      // Include sender profile info
      senderName: profilesTable.firstName,
      senderImage: profilesTable.profileImageUrl,
    })
    .from(messagesTable)
    .leftJoin(profilesTable, eq(messagesTable.senderId, profilesTable.userId))
    .where(eq(messagesTable.conversationId, conversationId))
    .orderBy(asc(messagesTable.createdAt))
    .limit(limit)
    .offset(offset);
}

// Optimized reviews with pagination
export async function getProviderReviewsOptimized(
  providerId: string,
  limit: number = 20,
  offset: number = 0
) {
  return await db
    .select({
      id: reviewsTable.id,
      rating: reviewsTable.rating,
      reviewText: reviewsTable.reviewText,
      createdAt: reviewsTable.createdAt,
      providerResponse: reviewsTable.providerResponse,
      isVerifiedBooking: reviewsTable.isVerifiedBooking,
      // Include customer info
      customerName: profilesTable.firstName,
      customerImage: profilesTable.profileImageUrl,
    })
    .from(reviewsTable)
    .leftJoin(profilesTable, eq(reviewsTable.customerId, profilesTable.userId))
    .where(
      and(
        eq(reviewsTable.providerId, providerId),
        eq(reviewsTable.isPublished, true)
      )
    )
    .orderBy(desc(reviewsTable.createdAt))
    .limit(limit)
    .offset(offset);
}

// Optimized events listing with attendance info
export async function getEventsOptimized(
  filters: {
    category?: string;
    dateRange?: { start: Date; end: Date };
    location?: { city?: string; state?: string };
    priceRange?: { min?: number; max?: number };
  } = {},
  limit: number = 20,
  offset: number = 0
) {
  const conditions = [eq(eventsTable.isActive, true)];
  
  if (filters.category) {
    conditions.push(eq(eventsTable.category, filters.category));
  }
  
  if (filters.dateRange) {
    conditions.push(
      between(eventsTable.eventDate, filters.dateRange.start, filters.dateRange.end)
    );
  }
  
  if (filters.location?.city) {
    conditions.push(eq(eventsTable.locationCity, filters.location.city));
  }
  
  if (filters.priceRange?.min) {
    conditions.push(gte(sql`CAST(${eventsTable.ticketPrice} AS DECIMAL)`, filters.priceRange.min));
  }

  return await db
    .select({
      id: eventsTable.id,
      title: eventsTable.title,
      description: eventsTable.description,
      eventDate: eventsTable.eventDate,
      startTime: eventsTable.startTime,
      endTime: eventsTable.endTime,
      ticketPrice: eventsTable.ticketPrice,
      maxAttendees: eventsTable.maxAttendees,
      currentAttendees: eventsTable.currentAttendees,
      category: eventsTable.category,
      locationName: eventsTable.locationName,
      locationCity: eventsTable.locationCity,
      locationState: eventsTable.locationState,
      featuredImage: eventsTable.featuredImage,
      // Include organizer info
      organizerName: providersTable.displayName,
      organizerImage: providersTable.profileImage,
      organizerVerified: providersTable.isVerified,
    })
    .from(eventsTable)
    .leftJoin(providersTable, eq(eventsTable.organizerId, providersTable.id))
    .where(and(...conditions))
    .orderBy(asc(eventsTable.eventDate))
    .limit(limit)
    .offset(offset);
}

// Optimized loyalty account with transaction history
export async function getLoyaltyAccountOptimized(userId: string) {
  const account = await db
    .select({
      id: loyaltyAccountsTable.id,
      currentPoints: loyaltyAccountsTable.currentPoints,
      totalEarned: loyaltyAccountsTable.totalEarned,
      totalRedeemed: loyaltyAccountsTable.totalRedeemed,
      tier: loyaltyAccountsTable.tier,
      createdAt: loyaltyAccountsTable.createdAt,
    })
    .from(loyaltyAccountsTable)
    .where(
      and(
        eq(loyaltyAccountsTable.userId, userId),
        eq(loyaltyAccountsTable.isActive, true)
      )
    )
    .limit(1);

  return account[0] || null;
}

// Optimized payment history
export async function getPaymentHistoryOptimized(
  userId: string,
  limit: number = 20,
  offset: number = 0
) {
  return await db
    .select({
      id: paymentsTable.id,
      bookingId: paymentsTable.bookingId,
      amount: paymentsTable.amount,
      currency: paymentsTable.currency,
      status: paymentsTable.status,
      createdAt: paymentsTable.createdAt,
      paymentMethod: paymentsTable.paymentMethodType,
      // Include booking details
      serviceType: bookingsTable.serviceType,
      bookingDate: bookingsTable.bookingDate,
      providerName: providersTable.displayName,
    })
    .from(paymentsTable)
    .leftJoin(bookingsTable, eq(paymentsTable.bookingId, bookingsTable.id))
    .leftJoin(providersTable, eq(bookingsTable.providerId, providersTable.id))
    .where(eq(paymentsTable.userId, userId))
    .orderBy(desc(paymentsTable.createdAt))
    .limit(limit)
    .offset(offset);
}

// Optimized notification feed
export async function getNotificationsOptimized(
  userId: string,
  unreadOnly: boolean = false,
  limit: number = 20,
  offset: number = 0
) {
  const conditions = [eq(notificationsTable.userId, userId)];
  
  if (unreadOnly) {
    conditions.push(eq(notificationsTable.isRead, false));
  }

  return await db
    .select({
      id: notificationsTable.id,
      title: notificationsTable.title,
      message: notificationsTable.message,
      type: notificationsTable.type,
      isRead: notificationsTable.isRead,
      createdAt: notificationsTable.createdAt,
      metadata: notificationsTable.metadata,
    })
    .from(notificationsTable)
    .where(and(...conditions))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(limit)
    .offset(offset);
}

// Optimized spaces search
export async function getSpacesOptimized(
  filters: {
    location?: { city?: string; state?: string };
    priceRange?: { min?: number; max?: number };
    capacity?: number;
    amenities?: string[];
  } = {},
  limit: number = 20,
  offset: number = 0
) {
  const conditions = [eq(spacesTable.isActive, true)];
  
  if (filters.location?.city) {
    conditions.push(eq(spacesTable.locationCity, filters.location.city));
  }
  
  if (filters.priceRange?.min) {
    conditions.push(gte(sql`CAST(${spacesTable.hourlyRate} AS DECIMAL)`, filters.priceRange.min));
  }
  
  if (filters.capacity) {
    conditions.push(gte(spacesTable.capacity, filters.capacity));
  }

  return await db
    .select({
      id: spacesTable.id,
      title: spacesTable.title,
      description: spacesTable.description,
      hourlyRate: spacesTable.hourlyRate,
      capacity: spacesTable.capacity,
      locationName: spacesTable.locationName,
      locationCity: spacesTable.locationCity,
      locationState: spacesTable.locationState,
      featuredImage: spacesTable.featuredImage,
      amenities: spacesTable.amenities,
      averageRating: spacesTable.averageRating,
      totalReviews: spacesTable.totalReviews,
      // Include owner info
      ownerName: providersTable.displayName,
      ownerImage: providersTable.profileImage,
      ownerVerified: providersTable.isVerified,
    })
    .from(spacesTable)
    .leftJoin(providersTable, eq(spacesTable.ownerId, providersTable.id))
    .where(and(...conditions))
    .orderBy(desc(spacesTable.averageRating), desc(spacesTable.totalReviews))
    .limit(limit)
    .offset(offset);
}

// Cache utilities for expensive computations
export const queryCache = new Map<string, { data: any; timestamp: number; ttl: number }>();

export function getCachedQuery<T>(key: string, ttl: number = 300000): T | null {
  const cached = queryCache.get(key);
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.data;
  }
  return null;
}

export function setCachedQuery<T>(key: string, data: T, ttl: number = 300000): void {
  queryCache.set(key, { data, timestamp: Date.now(), ttl });
}

// Prepared statements for frequently used queries
export const preparedStatements = {
  getProviderById: db
    .select({
      id: providersTable.id,
      displayName: providersTable.displayName,
      tagline: providersTable.tagline,
      bio: providersTable.bio,
      profileImage: providersTable.profileImage,
      locationCity: providersTable.locationCity,
      locationState: providersTable.locationState,
      hourlyRate: providersTable.hourlyRate,
      averageRating: providersTable.averageRating,
      totalReviews: providersTable.totalReviews,
      isVerified: providersTable.isVerified,
      isActive: providersTable.isActive,
      services: providersTable.services,
    })
    .from(providersTable)
    .where(eq(providersTable.id, sql.placeholder('providerId')))
    .prepare(),

  getBookingById: db
    .select({
      id: bookingsTable.id,
      providerId: bookingsTable.providerId,
      customerId: bookingsTable.customerId,
      serviceType: bookingsTable.serviceType,
      bookingDate: bookingsTable.bookingDate,
      startTime: bookingsTable.startTime,
      endTime: bookingsTable.endTime,
      status: bookingsTable.status,
      totalAmount: bookingsTable.totalAmount,
      providerEarnings: bookingsTable.providerEarnings,
    })
    .from(bookingsTable)
    .where(eq(bookingsTable.id, sql.placeholder('bookingId')))
    .prepare(),
};