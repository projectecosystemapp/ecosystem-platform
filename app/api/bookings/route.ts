import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { bookingsTable, transactionsTable, providersTable } from "@/db/schema";
import { eq, and, or, gte, lte, desc, asc, ilike, inArray, sql } from "drizzle-orm";
import { 
  bookingFiltersSchema, 
  createBookingSchema, 
  validateBookingRequest,
  formatValidationErrors,
  calculateBookingAmounts
} from "@/lib/validations/booking-schemas";
import { withRateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { createMarketplacePaymentIntent } from "@/lib/stripe";

/**
 * GET /api/bookings - List bookings for the authenticated user with filtering
 */
export const GET = withRateLimit(
  RATE_LIMIT_CONFIGS.api,
  async (req: NextRequest) => {
    try {
      const { userId } = auth();

      if (!userId) {
        return NextResponse.json(
          { error: "Authentication required" }, 
          { status: 401 }
        );
      }

      // Parse and validate query parameters
      const url = new URL(req.url);
      const queryParams = Object.fromEntries(url.searchParams.entries());
      
      // Handle array parameters (status can be multiple values)
      if (queryParams.status && queryParams.status.includes(',')) {
        queryParams.status = queryParams.status.split(',');
      }

      const validation = validateBookingRequest(bookingFiltersSchema, queryParams);
      if (!validation.success) {
        return NextResponse.json(
          formatValidationErrors(validation.errors),
          { status: 400 }
        );
      }

      const filters = validation.data;

      // Build query conditions
      const conditions = [eq(bookingsTable.customerId, userId)];

      // Status filtering
      if (filters.status) {
        if (Array.isArray(filters.status)) {
          conditions.push(inArray(bookingsTable.status, filters.status));
        } else {
          conditions.push(eq(bookingsTable.status, filters.status));
        }
      }

      // Date range filtering
      if (filters.startDate) {
        conditions.push(gte(bookingsTable.bookingDate, new Date(filters.startDate)));
      }
      if (filters.endDate) {
        conditions.push(lte(bookingsTable.bookingDate, new Date(filters.endDate)));
      }

      // Provider filtering
      if (filters.providerId) {
        conditions.push(eq(bookingsTable.providerId, filters.providerId));
      }

      // Search across service name and notes
      if (filters.search) {
        conditions.push(
          or(
            ilike(bookingsTable.serviceName, `%${filters.search}%`),
            ilike(bookingsTable.customerNotes, `%${filters.search}%`)
          )
        );
      }

      // Calculate offset for pagination
      const offset = (filters.page - 1) * filters.limit;

      // Determine sort order
      const sortColumn = bookingsTable[filters.sortBy];
      const orderBy = filters.sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

      // Execute query with join to get provider information
      const bookingsQuery = db
        .select({
          // Booking fields
          id: bookingsTable.id,
          providerId: bookingsTable.providerId,
          customerId: bookingsTable.customerId,
          serviceName: bookingsTable.serviceName,
          servicePrice: bookingsTable.servicePrice,
          serviceDuration: bookingsTable.serviceDuration,
          bookingDate: bookingsTable.bookingDate,
          startTime: bookingsTable.startTime,
          endTime: bookingsTable.endTime,
          status: bookingsTable.status,
          stripePaymentIntentId: bookingsTable.stripePaymentIntentId,
          totalAmount: bookingsTable.totalAmount,
          platformFee: bookingsTable.platformFee,
          providerPayout: bookingsTable.providerPayout,
          customerNotes: bookingsTable.customerNotes,
          providerNotes: bookingsTable.providerNotes,
          cancellationReason: bookingsTable.cancellationReason,
          cancelledBy: bookingsTable.cancelledBy,
          cancelledAt: bookingsTable.cancelledAt,
          createdAt: bookingsTable.createdAt,
          updatedAt: bookingsTable.updatedAt,
          completedAt: bookingsTable.completedAt,
          
          // Provider info
          providerName: providersTable.displayName,
          providerSlug: providersTable.slug,
          providerImage: providersTable.profileImageUrl
        })
        .from(bookingsTable)
        .leftJoin(providersTable, eq(bookingsTable.providerId, providersTable.id))
        .where(and(...conditions))
        .orderBy(orderBy)
        .limit(filters.limit)
        .offset(offset);

      const bookings = await bookingsQuery;

      // Get total count for pagination
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(bookingsTable)
        .where(and(...conditions));

      const totalCount = countResult[0]?.count || 0;

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalCount / filters.limit);
      const hasNextPage = filters.page < totalPages;
      const hasPreviousPage = filters.page > 1;

      return NextResponse.json({
        bookings,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          totalCount,
          totalPages,
          hasNextPage,
          hasPreviousPage
        },
        filters: {
          status: filters.status,
          startDate: filters.startDate,
          endDate: filters.endDate,
          providerId: filters.providerId,
          search: filters.search,
          sortBy: filters.sortBy,
          sortOrder: filters.sortOrder
        }
      });

    } catch (error) {
      console.error("Error fetching bookings:", error);
      
      // Return appropriate error response
      if (error instanceof Error) {
        return NextResponse.json(
          { error: "Failed to fetch bookings", details: error.message },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  }
);

/**
 * POST /api/bookings - Create a new booking with payment processing
 */
export const POST = withRateLimit(
  RATE_LIMIT_CONFIGS.payment,
  async (req: NextRequest) => {
    try {
      const { userId } = auth();

      if (!userId) {
        return NextResponse.json(
          { error: "Authentication required" }, 
          { status: 401 }
        );
      }

      // Parse and validate request body
      const body = await req.json();
      const validation = validateBookingRequest(createBookingSchema, body);
      
      if (!validation.success) {
        return NextResponse.json(
          formatValidationErrors(validation.errors),
          { status: 400 }
        );
      }

      const bookingData = validation.data;

      // Verify provider exists and get Stripe Connect account
      const provider = await db
        .select({
          id: providersTable.id,
          displayName: providersTable.displayName,
          stripeConnectAccountId: providersTable.stripeConnectAccountId,
          stripeOnboardingComplete: providersTable.stripeOnboardingComplete,
          isActive: providersTable.isActive
        })
        .from(providersTable)
        .where(eq(providersTable.id, bookingData.providerId))
        .limit(1);

      if (provider.length === 0) {
        return NextResponse.json(
          { error: "Provider not found" },
          { status: 404 }
        );
      }

      const providerInfo = provider[0];

      // Validate provider is active and has completed Stripe onboarding
      if (!providerInfo.isActive) {
        return NextResponse.json(
          { error: "Provider is not currently accepting bookings" },
          { status: 400 }
        );
      }

      if (!providerInfo.stripeOnboardingComplete || !providerInfo.stripeConnectAccountId) {
        return NextResponse.json(
          { error: "Provider has not completed payment setup" },
          { status: 400 }
        );
      }

      // Check for booking conflicts
      const conflictingBookings = await db
        .select({
          id: bookingsTable.id,
          bookingDate: bookingsTable.bookingDate,
          startTime: bookingsTable.startTime,
          endTime: bookingsTable.endTime,
          status: bookingsTable.status
        })
        .from(bookingsTable)
        .where(
          and(
            eq(bookingsTable.providerId, bookingData.providerId),
            eq(bookingsTable.bookingDate, new Date(bookingData.bookingDate)),
            inArray(bookingsTable.status, ["pending", "confirmed", "in_progress"])
          )
        );

      // Validate no time conflicts
      const hasConflict = conflictingBookings.some(booking => {
        const bookingStart = timeToMinutes(booking.startTime);
        const bookingEnd = timeToMinutes(booking.endTime);
        const requestedStart = timeToMinutes(bookingData.startTime);
        const requestedEnd = timeToMinutes(bookingData.endTime);

        return requestedStart < bookingEnd && requestedEnd > bookingStart;
      });

      if (hasConflict) {
        return NextResponse.json(
          { error: "Time slot is already booked" },
          { status: 409 }
        );
      }

      // Calculate booking amounts
      const isAuthenticated = true; // User is authenticated if we reach this point
      const amounts = calculateBookingAmounts(bookingData.servicePrice, isAuthenticated);

      // Create booking record
      const [newBooking] = await db
        .insert(bookingsTable)
        .values({
          providerId: bookingData.providerId,
          customerId: userId,
          serviceName: bookingData.serviceName,
          servicePrice: bookingData.servicePrice.toString(),
          serviceDuration: bookingData.serviceDuration,
          bookingDate: new Date(bookingData.bookingDate),
          startTime: bookingData.startTime,
          endTime: bookingData.endTime,
          status: "pending",
          totalAmount: amounts.totalAmount.toString(),
          platformFee: amounts.platformFee.toString(),
          providerPayout: amounts.providerPayout.toString(),
          customerNotes: bookingData.customerNotes
        })
        .returning();

      // Create Stripe payment intent
      try {
        const paymentIntent = await createMarketplacePaymentIntent({
          amount: amounts.totalAmount,
          currency: "usd",
          customerId: userId,
          stripeConnectAccountId: providerInfo.stripeConnectAccountId,
          platformFeeAmount: amounts.platformFee,
          metadata: {
            bookingId: newBooking.id,
            providerId: bookingData.providerId,
            customerId: userId,
            type: "booking_payment"
          }
        });

        // Update booking with payment intent ID
        await db
          .update(bookingsTable)
          .set({
            stripePaymentIntentId: paymentIntent.id,
            updatedAt: new Date()
          })
          .where(eq(bookingsTable.id, newBooking.id));

        // Create transaction record
        await db
          .insert(transactionsTable)
          .values({
            bookingId: newBooking.id,
            amount: amounts.totalAmount.toString(),
            platformFee: amounts.platformFee.toString(),
            providerPayout: amounts.providerPayout.toString(),
            status: "pending"
          });

        return NextResponse.json({
          booking: {
            ...newBooking,
            provider: {
              id: providerInfo.id,
              name: providerInfo.displayName
            }
          },
          paymentIntent: {
            id: paymentIntent.id,
            clientSecret: paymentIntent.client_secret,
            amount: amounts.totalAmount,
            platformFee: amounts.platformFee
          }
        }, { status: 201 });

      } catch (paymentError) {
        console.error("Payment intent creation failed:", paymentError);
        
        // Rollback booking if payment setup fails
        await db
          .delete(bookingsTable)
          .where(eq(bookingsTable.id, newBooking.id));

        return NextResponse.json(
          { error: "Failed to process payment setup" },
          { status: 500 }
        );
      }

    } catch (error) {
      console.error("Error creating booking:", error);
      
      if (error instanceof Error) {
        return NextResponse.json(
          { error: "Failed to create booking", details: error.message },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  }
);

/**
 * Helper function to convert time string (HH:MM) to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}