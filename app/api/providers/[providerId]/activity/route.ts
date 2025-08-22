import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { bookingsTable, transactionsTable } from "@/db/schema/bookings-schema";
import { providersTable } from "@/db/schema/providers-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq, and, desc, sql, or, inArray } from "drizzle-orm";
import { z } from "zod";

/**
 * Provider Activity Feed API
 * GET /api/providers/[providerId]/activity - Fetch recent activity for a provider
 * 
 * Business Context:
 * - Shows recent bookings, payments, reviews, and other events
 * - Helps providers stay informed about their business activity
 * - Real-time updates for better engagement
 */

// Activity query parameters schema
const activityQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(50).default(10),
  offset: z.coerce.number().min(0).default(0),
  type: z.enum(["all", "bookings", "payments", "reviews"]).default("all"),
});

// Activity type enum
const ActivityType = {
  BOOKING_CREATED: "booking_created",
  BOOKING_CONFIRMED: "booking_confirmed",
  BOOKING_COMPLETED: "booking_completed",
  BOOKING_CANCELLED: "booking_cancelled",
  PAYMENT_RECEIVED: "payment_received",
  PAYOUT_PROCESSED: "payout_processed",
  REVIEW_RECEIVED: "review_received",
} as const;

export async function GET(
  req: NextRequest,
  { params }: { params: { providerId: string } }
) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const providerId = params.providerId;

    // Verify provider ownership
    const provider = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, providerId))
      .limit(1);

    if (!provider.length) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 }
      );
    }

    if (provider[0].userId !== userId) {
      return NextResponse.json(
        { error: "Forbidden: You can only view your own activity" },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const rawParams = Object.fromEntries(searchParams.entries());
    const { limit, offset, type } = activityQuerySchema.parse(rawParams);

    // Build activity feed from multiple sources
    const activities: any[] = [];

    // Fetch recent bookings
    if (type === "all" || type === "bookings") {
      const recentBookings = await db
        .select({
          id: bookingsTable.id,
          type: sql<string>`
            CASE 
              WHEN ${bookingsTable.status} = 'pending' THEN 'booking_created'
              WHEN ${bookingsTable.status} = 'confirmed' THEN 'booking_confirmed'
              WHEN ${bookingsTable.status} = 'completed' THEN 'booking_completed'
              WHEN ${bookingsTable.status} = 'cancelled' THEN 'booking_cancelled'
              ELSE 'booking_updated'
            END
          `,
          title: sql<string>`
            CASE 
              WHEN ${bookingsTable.status} = 'pending' THEN 'New booking request'
              WHEN ${bookingsTable.status} = 'confirmed' THEN 'Booking confirmed'
              WHEN ${bookingsTable.status} = 'completed' THEN 'Booking completed'
              WHEN ${bookingsTable.status} = 'cancelled' THEN 'Booking cancelled'
              ELSE 'Booking updated'
            END
          `,
          description: sql<string>`${bookingsTable.serviceName}`,
          amount: bookingsTable.providerPayout,
          status: bookingsTable.status,
          customerId: bookingsTable.customerId,
          bookingDate: bookingsTable.bookingDate,
          startTime: bookingsTable.startTime,
          timestamp: sql<Date>`
            CASE 
              WHEN ${bookingsTable.status} = 'completed' THEN ${bookingsTable.completedAt}
              WHEN ${bookingsTable.status} = 'cancelled' THEN ${bookingsTable.cancelledAt}
              ELSE ${bookingsTable.updatedAt}
            END
          `,
        })
        .from(bookingsTable)
        .where(eq(bookingsTable.providerId, providerId))
        .orderBy(desc(bookingsTable.updatedAt))
        .limit(20);

      // Fetch customer emails for bookings
      const customerIds = [...new Set(recentBookings.map(b => b.customerId))];
      const customers = customerIds.length > 0 ? await db
        .select({
          id: profilesTable.userId,
          email: profilesTable.email,
        })
        .from(profilesTable)
        .where(inArray(profilesTable.userId, customerIds)) : [];

      const customerMap = new Map(customers.map(c => [c.id, c.email?.split('@')[0] || 'User']));

      activities.push(...recentBookings.map(booking => ({
        id: booking.id,
        type: booking.type,
        title: booking.title,
        description: `${booking.description} with ${customerMap.get(booking.customerId) || 'Guest'}`,
        metadata: {
          amount: Number(booking.amount),
          status: booking.status,
          bookingDate: booking.bookingDate,
          startTime: booking.startTime,
          customerName: customerMap.get(booking.customerId) || 'Guest',
        },
        timestamp: booking.timestamp,
      })));
    }

    // Fetch recent transactions/payments
    if (type === "all" || type === "payments") {
      const recentTransactions = await db
        .select({
          id: transactionsTable.id,
          type: sql<string>`
            CASE 
              WHEN ${transactionsTable.status} = 'completed' THEN 'payment_received'
              WHEN ${transactionsTable.status} = 'refunded' THEN 'payment_refunded'
              ELSE 'payment_pending'
            END
          `,
          title: sql<string>`
            CASE 
              WHEN ${transactionsTable.status} = 'completed' THEN 'Payment received'
              WHEN ${transactionsTable.status} = 'refunded' THEN 'Payment refunded'
              ELSE 'Payment pending'
            END
          `,
          amount: transactionsTable.providerPayout,
          status: transactionsTable.status,
          timestamp: transactionsTable.processedAt,
          bookingId: transactionsTable.bookingId,
        })
        .from(transactionsTable)
        .innerJoin(bookingsTable, eq(transactionsTable.bookingId, bookingsTable.id))
        .where(
          and(
            eq(bookingsTable.providerId, providerId),
            sql`${transactionsTable.processedAt} IS NOT NULL`
          )
        )
        .orderBy(desc(transactionsTable.processedAt))
        .limit(10);

      activities.push(...recentTransactions.map(transaction => ({
        id: transaction.id,
        type: transaction.type,
        title: transaction.title,
        description: `Transaction processed`,
        metadata: {
          amount: Number(transaction.amount),
          status: transaction.status,
          bookingId: transaction.bookingId,
        },
        timestamp: transaction.timestamp,
      })));
    }

    // Sort all activities by timestamp
    activities.sort((a, b) => {
      const dateA = new Date(a.timestamp || 0).getTime();
      const dateB = new Date(b.timestamp || 0).getTime();
      return dateB - dateA;
    });

    // Apply pagination
    const paginatedActivities = activities.slice(offset, offset + limit);

    // Format activities for response
    const formattedActivities = paginatedActivities.map(activity => ({
      id: activity.id,
      type: activity.type,
      title: activity.title,
      description: activity.description,
      metadata: activity.metadata,
      timestamp: activity.timestamp,
      timeAgo: getTimeAgo(activity.timestamp),
    }));

    // Get upcoming bookings for quick view
    const upcomingBookings = await db
      .select({
        id: bookingsTable.id,
        serviceName: bookingsTable.serviceName,
        bookingDate: bookingsTable.bookingDate,
        startTime: bookingsTable.startTime,
        endTime: bookingsTable.endTime,
        customerId: bookingsTable.customerId,
        amount: bookingsTable.providerPayout,
      })
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.providerId, providerId),
          eq(bookingsTable.status, "confirmed"),
          sql`${bookingsTable.bookingDate} >= CURRENT_DATE`
        )
      )
      .orderBy(bookingsTable.bookingDate, bookingsTable.startTime)
      .limit(5);

    // Fetch customer info for upcoming bookings
    const upcomingCustomerIds = [...new Set(upcomingBookings.map(b => b.customerId))];
    const upcomingCustomers = upcomingCustomerIds.length > 0 ? await db
      .select({
        id: profilesTable.userId,
        email: profilesTable.email,
      })
      .from(profilesTable)
      .where(inArray(profilesTable.userId, upcomingCustomerIds)) : [];

    const upcomingCustomerMap = new Map(upcomingCustomers.map(c => [
      c.id, 
      { name: c.email?.split('@')[0] || 'Guest', email: c.email }
    ]));

    const formattedUpcomingBookings = upcomingBookings.map(booking => ({
      id: booking.id,
      serviceName: booking.serviceName,
      bookingDate: booking.bookingDate,
      startTime: booking.startTime,
      endTime: booking.endTime,
      customer: upcomingCustomerMap.get(booking.customerId) || { name: 'Guest', email: null },
      amount: Number(booking.amount),
    }));

    const response = {
      activities: formattedActivities,
      upcomingBookings: formattedUpcomingBookings,
      pagination: {
        limit,
        offset,
        hasMore: activities.length > offset + limit,
        total: activities.length,
      },
    };

    // Set cache headers for 30 seconds
    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=15",
      },
    });
  } catch (error) {
    console.error("Error fetching provider activity:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper function to calculate time ago
function getTimeAgo(timestamp: Date | null): string {
  if (!timestamp) return "Unknown";
  
  const now = new Date();
  const diff = now.getTime() - new Date(timestamp).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 7) {
    return new Date(timestamp).toLocaleDateString();
  } else if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else {
    return "Just now";
  }
}