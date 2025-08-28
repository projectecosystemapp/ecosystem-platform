import { db } from "@/db/db";
import { 
  reviewsTable,
  type Review,
  type NewReview,
} from "@/db/schema/reviews-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq, and, desc, sql, count } from "drizzle-orm";

// Get reviews for a provider
export async function getProviderReviews(
  providerId: string,
  options?: {
    limit?: number;
    offset?: number;
    includeUnpublished?: boolean;
  }
): Promise<Review[]> {
  const conditions = [
    eq(reviewsTable.providerId, providerId),
  ];

  // By default, only show published reviews
  if (!options?.includeUnpublished) {
    conditions.push(eq(reviewsTable.isPublished, true));
    conditions.push(eq(reviewsTable.isFlagged, false));
  }

  return await db
    .select({
      id: reviewsTable.id,
      bookingId: reviewsTable.bookingId,
      providerId: reviewsTable.providerId,
      customerId: reviewsTable.customerId,
      rating: reviewsTable.rating,
      reviewText: reviewsTable.reviewText,
      providerResponse: reviewsTable.providerResponse,
      providerRespondedAt: reviewsTable.providerRespondedAt,
      isVerifiedBooking: reviewsTable.isVerifiedBooking,
      isPublished: reviewsTable.isPublished,
      isFlagged: reviewsTable.isFlagged,
      flagReason: reviewsTable.flagReason,
      createdAt: reviewsTable.createdAt,
      updatedAt: reviewsTable.updatedAt,
    })
    .from(reviewsTable)
    .where(and(...conditions))
    .orderBy(desc(reviewsTable.createdAt))
    .limit(options?.limit || 100)
    .offset(options?.offset || 0);
}

// Get reviews with customer info for display
export async function getProviderReviewsWithCustomerInfo(
  providerId: string,
  options?: {
    limit?: number;
    offset?: number;
  }
): Promise<Array<Review & { customerName: string; customerAvatar?: string | null }>> {
  const reviews = await db
    .select({
      id: reviewsTable.id,
      bookingId: reviewsTable.bookingId,
      providerId: reviewsTable.providerId,
      customerId: reviewsTable.customerId,
      rating: reviewsTable.rating,
      reviewText: reviewsTable.reviewText,
      providerResponse: reviewsTable.providerResponse,
      providerRespondedAt: reviewsTable.providerRespondedAt,
      isVerifiedBooking: reviewsTable.isVerifiedBooking,
      isPublished: reviewsTable.isPublished,
      isFlagged: reviewsTable.isFlagged,
      flagReason: reviewsTable.flagReason,
      createdAt: reviewsTable.createdAt,
      updatedAt: reviewsTable.updatedAt,
      customerName: sql<string>`COALESCE(${profilesTable.email}, 'Anonymous Customer')`,
      customerAvatar: sql<string | null>`NULL`,
    })
    .from(reviewsTable)
    .leftJoin(profilesTable, eq(reviewsTable.customerId, profilesTable.userId))
    .where(
      and(
        eq(reviewsTable.providerId, providerId),
        eq(reviewsTable.isPublished, true),
        eq(reviewsTable.isFlagged, false)
      )
    )
    .orderBy(desc(reviewsTable.createdAt))
    .limit(options?.limit || 100)
    .offset(options?.offset || 0);

  return reviews;
}

// Calculate provider rating statistics
export async function getProviderRatingStats(providerId: string): Promise<{
  averageRating: number;
  totalReviews: number;
  ratingDistribution: { rating: number; count: number }[];
}> {
  // Get average and total count
  const [stats] = await db
    .select({
      averageRating: sql<number>`ROUND(AVG(${reviewsTable.rating})::numeric, 1)`,
      totalReviews: count(),
    })
    .from(reviewsTable)
    .where(
      and(
        eq(reviewsTable.providerId, providerId),
        eq(reviewsTable.isPublished, true),
        eq(reviewsTable.isFlagged, false)
      )
    );

  // Get rating distribution
  const distribution = await db
    .select({
      rating: reviewsTable.rating,
      count: count(),
    })
    .from(reviewsTable)
    .where(
      and(
        eq(reviewsTable.providerId, providerId),
        eq(reviewsTable.isPublished, true),
        eq(reviewsTable.isFlagged, false)
      )
    )
    .groupBy(reviewsTable.rating)
    .orderBy(desc(reviewsTable.rating));

  // Fill in missing ratings with 0 count
  const ratingDistribution = [5, 4, 3, 2, 1].map(rating => ({
    rating,
    count: distribution.find(d => d.rating === rating)?.count || 0,
  }));

  return {
    averageRating: stats?.averageRating || 0,
    totalReviews: stats?.totalReviews || 0,
    ratingDistribution,
  };
}

// Create a new review
export async function createReview(data: NewReview): Promise<Review> {
  const [review] = await db
    .insert(reviewsTable)
    .values(data)
    .returning();
  
  return review;
}

// Update a review (for provider responses)
export async function updateReview(
  reviewId: string,
  data: Partial<{
    providerResponse: string;
    providerRespondedAt: Date;
    isPublished: boolean;
    isFlagged: boolean;
    flagReason: string;
  }>
): Promise<Review> {
  const [updatedReview] = await db
    .update(reviewsTable)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(reviewsTable.id, reviewId))
    .returning();
  
  return updatedReview;
}

// Get review by booking ID (to check if review exists)
export async function getReviewByBookingId(bookingId: string): Promise<Review | null> {
  const [review] = await db
    .select()
    .from(reviewsTable)
    .where(eq(reviewsTable.bookingId, bookingId));
  
  return review || null;
}

// Get recent reviews across all providers (for moderation)
export async function getRecentReviews(
  options?: {
    limit?: number;
    includeFlagged?: boolean;
  }
): Promise<Review[]> {
  const conditions = [];
  
  if (!options?.includeFlagged) {
    conditions.push(eq(reviewsTable.isFlagged, false));
  }

  const query = db
    .select()
    .from(reviewsTable)
    .orderBy(desc(reviewsTable.createdAt))
    .limit(options?.limit || 50);

  if (conditions.length > 0) {
    query.where(and(...conditions));
  }

  return await query;
}

// Flag a review for moderation
export async function flagReview(
  reviewId: string,
  reason: string
): Promise<Review> {
  return await updateReview(reviewId, {
    isFlagged: true,
    flagReason: reason,
  });
}

// Unflag a review
export async function unflagReview(reviewId: string): Promise<Review> {
  return await updateReview(reviewId, {
    isFlagged: false,
    flagReason: undefined,
  });
}