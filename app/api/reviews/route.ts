import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/db/db";
import { reviewsTable } from "@/db/schema/reviews-schema";
import { bookingsTable } from "@/db/schema/bookings-schema";
import { providersTable } from "@/db/schema/providers-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq, and, sql, desc, gte } from "drizzle-orm";
import { ApiResponse, getPaginationParams, withErrorHandler } from "@/lib/api-response";

// Review creation schema
const createReviewSchema = z.object({
  bookingId: z.string().uuid(),
  rating: z.number().min(1).max(5),
  comment: z.string().min(10).max(1000),
  wouldRecommend: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

// Review update schema
const updateReviewSchema = z.object({
  rating: z.number().min(1).max(5).optional(),
  comment: z.string().min(10).max(1000).optional(),
  wouldRecommend: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

// Search filters schema
const searchFiltersSchema = z.object({
  providerId: z.string().uuid().optional(),
  customerId: z.string().optional(),
  minRating: z.coerce.number().min(1).max(5).optional(),
  isPublished: z.coerce.boolean().optional(),
  wouldRecommend: z.coerce.boolean().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
});

/**
 * GET /api/reviews - List and filter reviews
 */
export async function GET(req: NextRequest) {
  return withErrorHandler(async () => {
    const { searchParams } = new URL(req.url);
    const { page, pageSize, offset } = getPaginationParams(searchParams);
    
    // Parse filters
    const filters = searchFiltersSchema.parse(
      Object.fromEntries(searchParams.entries())
    );
    
    // Build query conditions
    const conditions = [];
    
    if (filters.providerId) {
      conditions.push(eq(reviewsTable.providerId, filters.providerId));
    }
    
    if (filters.customerId) {
      conditions.push(eq(reviewsTable.customerId, filters.customerId));
    }
    
    if (filters.minRating !== undefined) {
      conditions.push(gte(reviewsTable.rating, filters.minRating));
    }
    
    if (filters.isPublished !== undefined) {
      conditions.push(eq(reviewsTable.isPublished, filters.isPublished));
    }
    
    if (filters.wouldRecommend !== undefined) {
      conditions.push(eq(reviewsTable.wouldRecommend, filters.wouldRecommend));
    }
    
    // Execute query with joins
    const [reviews, [{ total }]] = await Promise.all([
      db
        .select({
          review: reviewsTable,
          provider: {
            id: providersTable.id,
            displayName: providersTable.displayName,
            profileImageUrl: providersTable.profileImageUrl,
          },
          customer: {
            userId: profilesTable.userId,
            displayName: profilesTable.displayName,
            avatarUrl: profilesTable.avatarUrl,
          },
          booking: {
            serviceName: bookingsTable.serviceName,
            bookingDate: bookingsTable.bookingDate,
          }
        })
        .from(reviewsTable)
        .leftJoin(providersTable, eq(reviewsTable.providerId, providersTable.id))
        .leftJoin(profilesTable, eq(reviewsTable.customerId, profilesTable.userId))
        .leftJoin(bookingsTable, eq(reviewsTable.bookingId, bookingsTable.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .limit(pageSize)
        .offset(offset)
        .orderBy(desc(reviewsTable.createdAt)),
      
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(reviewsTable)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
    ]);
    
    return ApiResponse.paginated(reviews, total, page, pageSize);
  });
}

/**
 * POST /api/reviews - Create a new review
 */
export async function POST(req: NextRequest) {
  return withErrorHandler(async () => {
    const { userId } = await auth();
    if (!userId) {
      return ApiResponse.unauthorized();
    }
    
    const body = await req.json();
    const validatedData = createReviewSchema.parse(body);
    
    // Verify the booking exists and belongs to the user
    const [booking] = await db
      .select({
        id: bookingsTable.id,
        customerId: bookingsTable.customerId,
        providerId: bookingsTable.providerId,
        status: bookingsTable.status,
      })
      .from(bookingsTable)
      .where(eq(bookingsTable.id, validatedData.bookingId));
    
    if (!booking) {
      return ApiResponse.notFound("Booking");
    }
    
    if (booking.customerId !== userId) {
      return ApiResponse.forbidden("You can only review your own bookings");
    }
    
    if (booking.status !== "completed") {
      return ApiResponse.validationError({ 
        booking: "You can only review completed bookings" 
      });
    }
    
    // Check if review already exists for this booking
    const [existingReview] = await db
      .select({ id: reviewsTable.id })
      .from(reviewsTable)
      .where(eq(reviewsTable.bookingId, validatedData.bookingId));
    
    if (existingReview) {
      return ApiResponse.conflict("Review already exists for this booking");
    }
    
    // Create the review
    const [review] = await db
      .insert(reviewsTable)
      .values({
        bookingId: validatedData.bookingId,
        providerId: booking.providerId,
        customerId: userId,
        rating: validatedData.rating,
        comment: validatedData.comment,
        wouldRecommend: validatedData.wouldRecommend ?? true,
        tags: validatedData.tags ?? [],
        isPublished: true, // Auto-publish reviews
      })
      .returning();
    
    // Update provider's average rating
    await updateProviderRating(booking.providerId);
    
    return ApiResponse.created(review, "Review created successfully");
  });
}

/**
 * PATCH /api/reviews - Update a review
 */
export async function PATCH(req: NextRequest) {
  return withErrorHandler(async () => {
    const { userId } = await auth();
    if (!userId) {
      return ApiResponse.unauthorized();
    }
    
    const { searchParams } = new URL(req.url);
    const reviewId = searchParams.get("id");
    
    if (!reviewId) {
      return ApiResponse.validationError({ id: "Review ID is required" });
    }
    
    const body = await req.json();
    const validatedData = updateReviewSchema.parse(body);
    
    // Get the existing review
    const [existingReview] = await db
      .select()
      .from(reviewsTable)
      .where(eq(reviewsTable.id, reviewId));
    
    if (!existingReview) {
      return ApiResponse.notFound("Review");
    }
    
    if (existingReview.customerId !== userId) {
      return ApiResponse.forbidden("You can only update your own reviews");
    }
    
    // Update the review
    const [updatedReview] = await db
      .update(reviewsTable)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(eq(reviewsTable.id, reviewId))
      .returning();
    
    // Update provider's average rating if rating changed
    if (validatedData.rating !== undefined) {
      await updateProviderRating(existingReview.providerId);
    }
    
    return ApiResponse.success(updatedReview, "Review updated successfully");
  });
}

/**
 * DELETE /api/reviews - Delete a review
 */
export async function DELETE(req: NextRequest) {
  return withErrorHandler(async () => {
    const { userId } = await auth();
    if (!userId) {
      return ApiResponse.unauthorized();
    }
    
    const { searchParams } = new URL(req.url);
    const reviewId = searchParams.get("id");
    
    if (!reviewId) {
      return ApiResponse.validationError({ id: "Review ID is required" });
    }
    
    // Get the existing review
    const [existingReview] = await db
      .select()
      .from(reviewsTable)
      .where(eq(reviewsTable.id, reviewId));
    
    if (!existingReview) {
      return ApiResponse.notFound("Review");
    }
    
    if (existingReview.customerId !== userId) {
      return ApiResponse.forbidden("You can only delete your own reviews");
    }
    
    // Delete the review
    await db
      .delete(reviewsTable)
      .where(eq(reviewsTable.id, reviewId));
    
    // Update provider's average rating
    await updateProviderRating(existingReview.providerId);
    
    return ApiResponse.noContent();
  });
}

// Helper function to update provider rating
async function updateProviderRating(providerId: string) {
  const [stats] = await db
    .select({
      avgRating: sql<number>`AVG(rating)::numeric(3,2)`,
      totalReviews: sql<number>`COUNT(*)::int`,
    })
    .from(reviewsTable)
    .where(
      and(
        eq(reviewsTable.providerId, providerId),
        eq(reviewsTable.isPublished, true)
      )
    );
  
  await db
    .update(providersTable)
    .set({
      averageRating: stats.avgRating?.toString() ?? "0",
      totalReviews: stats.totalReviews ?? 0,
      updatedAt: new Date(),
    })
    .where(eq(providersTable.id, providerId));
}