import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { bookingsTable, providersTable } from "@/db/schema";
import { eq, and, gte, lte, desc, asc, inArray, sql } from "drizzle-orm";
import { 
  bookingFiltersSchema, 
  validateBookingRequest,
  formatValidationErrors
} from "@/lib/validations/booking-schemas";
import { withRateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";

/**
 * GET /api/providers/[providerId]/bookings - Get bookings for a specific provider
 * Only accessible by the provider themselves
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { providerId: string } }
) {
  // Apply rate limiting
  const rateLimiter = withRateLimit(
    RATE_LIMIT_CONFIGS.api,
    async (request: NextRequest) => {
    try {
      const { userId } = auth();

      if (!userId) {
        return NextResponse.json(
          { error: "Authentication required" }, 
          { status: 401 }
        );
      }

      const providerId = params.providerId;

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(providerId)) {
        return NextResponse.json(
          { error: "Invalid provider ID format" },
          { status: 400 }
        );
      }

      // Verify provider ownership
      const provider = await db
        .select({ 
          id: providersTable.id,
          userId: providersTable.userId,
          displayName: providersTable.displayName
        })
        .from(providersTable)
        .where(eq(providersTable.id, providerId))
        .limit(1);

      if (provider.length === 0) {
        return NextResponse.json(
          { error: "Provider not found" },
          { status: 404 }
        );
      }

      if (provider[0].userId !== userId) {
        return NextResponse.json(
          { error: "Access denied - you can only view your own bookings" },
          { status: 403 }
        );
      }

      // Parse and validate query parameters
      const url = new URL(req.url);
      const queryParams: any = Object.fromEntries(url.searchParams.entries());
      
      // Handle array parameters
      if (queryParams.status && queryParams.status.includes(',')) {
        queryParams.status = queryParams.status.split(',');
      }

      // Set default sorting for provider view (upcoming bookings first)
      if (!queryParams.sortBy) {
        queryParams.sortBy = "bookingDate";
        queryParams.sortOrder = "asc";
      }

      const validation = validateBookingRequest(bookingFiltersSchema, queryParams);
      if (!validation.success) {
        return NextResponse.json(
          formatValidationErrors(validation.errors),
          { status: 400 }
        );
      }

      const filters = validation.data;

      // Build query conditions for provider bookings
      const conditions = [eq(bookingsTable.providerId, providerId)];

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

      // Calculate offset for pagination
      const page = filters.page || 1;
      const limit = filters.limit || 10;
      const offset = (page - 1) * limit;

      // Determine sort order
      const sortBy = filters.sortBy || 'bookingDate';
      const sortColumn = bookingsTable[sortBy];
      const orderBy = filters.sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

      // Execute query to get bookings
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
          completedAt: bookingsTable.completedAt
        })
        .from(bookingsTable)
        .where(and(...conditions))
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset);

      const bookings = await bookingsQuery;

      // Get total count for pagination
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(bookingsTable)
        .where(and(...conditions));

      const totalCount = countResult[0]?.count || 0;

      // Get booking statistics for the provider
      const statsQuery = await db
        .select({
          status: bookingsTable.status,
          count: sql<number>`count(*)`,
          totalRevenue: sql<number>`sum(${bookingsTable.providerPayout})`
        })
        .from(bookingsTable)
        .where(eq(bookingsTable.providerId, providerId))
        .groupBy(bookingsTable.status);

      const stats = {
        total: totalCount,
        pending: 0,
        confirmed: 0,
        in_progress: 0,
        completed: 0,
        cancelled: 0,
        no_show: 0,
        totalRevenue: 0
      };

      statsQuery.forEach(stat => {
        stats[stat.status as keyof typeof stats] = stat.count;
        if (stat.status === 'completed') {
          stats.totalRevenue = parseFloat(stat.totalRevenue?.toString() || '0');
        }
      });

      // Get upcoming bookings (next 7 days) for quick overview
      const upcomingDate = new Date();
      upcomingDate.setDate(upcomingDate.getDate() + 7);

      const upcomingBookings = await db
        .select({
          id: bookingsTable.id,
          serviceName: bookingsTable.serviceName,
          bookingDate: bookingsTable.bookingDate,
          startTime: bookingsTable.startTime,
          endTime: bookingsTable.endTime,
          status: bookingsTable.status,
          customerNotes: bookingsTable.customerNotes
        })
        .from(bookingsTable)
        .where(
          and(
            eq(bookingsTable.providerId, providerId),
            gte(bookingsTable.bookingDate, new Date()),
            lte(bookingsTable.bookingDate, upcomingDate),
            inArray(bookingsTable.status, ["confirmed", "in_progress"])
          )
        )
        .orderBy(asc(bookingsTable.bookingDate), asc(bookingsTable.startTime))
        .limit(10);

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalCount / limit);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      return NextResponse.json({
        provider: {
          id: provider[0].id,
          name: provider[0].displayName
        },
        bookings,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNextPage,
          hasPreviousPage
        },
        stats,
        upcomingBookings,
        filters: {
          status: filters.status,
          startDate: filters.startDate,
          endDate: filters.endDate,
          sortBy: filters.sortBy,
          sortOrder: filters.sortOrder
        }
      });

    } catch (error) {
      console.error("Error fetching provider bookings:", error);
      
      if (error instanceof Error) {
        return NextResponse.json(
          { error: "Failed to fetch provider bookings", details: error.message },
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
  
  return rateLimiter(req);
}