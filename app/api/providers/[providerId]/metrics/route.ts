import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { bookingsTable, transactionsTable } from "@/db/schema/bookings-schema";
import { providersTable } from "@/db/schema/providers-schema";
import { eq, and, gte, sql, desc } from "drizzle-orm";
import { z } from "zod";

/**
 * Provider Dashboard Metrics API
 * GET /api/providers/[providerId]/metrics - Fetch dashboard metrics for a provider
 * 
 * Business Context:
 * - Providers receive service price minus 10% platform fee
 * - Real-time metrics for earnings, bookings, and ratings
 * - Monthly and all-time aggregations
 * 
 * Technical Decisions:
 * - Caching metrics for 60 seconds to reduce database load
 * - Using aggregated queries for performance
 * - Returns comprehensive metrics in a single request
 */

// Metrics query parameters schema
const metricsQuerySchema = z.object({
  period: z.enum(["today", "week", "month", "year", "all"]).default("month"),
  includeCharts: z.coerce.boolean().default(false),
});

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

    // Verify provider ownership or admin access
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
        { error: "Forbidden: You can only view your own metrics" },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const rawParams = Object.fromEntries(searchParams.entries());
    const { period, includeCharts } = metricsQuerySchema.parse(rawParams);

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case "today":
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case "week":
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case "month":
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case "year":
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default:
        startDate = new Date(0); // All time
    }

    // Fetch current month's earnings
    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);

    const monthlyEarningsResult = await db
      .select({
        total: sql<number>`COALESCE(SUM(${bookingsTable.providerPayout}), 0)`,
      })
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.providerId, providerId),
          eq(bookingsTable.status, "completed"),
          gte(bookingsTable.completedAt, currentMonthStart)
        )
      );

    // Fetch all-time earnings
    const totalEarningsResult = await db
      .select({
        total: sql<number>`COALESCE(SUM(${bookingsTable.providerPayout}), 0)`,
      })
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.providerId, providerId),
          eq(bookingsTable.status, "completed")
        )
      );

    // Fetch upcoming bookings count
    const upcomingBookingsResult = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.providerId, providerId),
          eq(bookingsTable.status, "confirmed"),
          gte(bookingsTable.bookingDate, new Date())
        )
      );

    // Fetch pending payouts
    const pendingPayoutsResult = await db
      .select({
        total: sql<number>`COALESCE(SUM(${transactionsTable.providerPayout}), 0)`,
      })
      .from(transactionsTable)
      .innerJoin(bookingsTable, eq(transactionsTable.bookingId, bookingsTable.id))
      .where(
        and(
          eq(bookingsTable.providerId, providerId),
          eq(transactionsTable.status, "completed"),
          sql`${transactionsTable.processedAt} IS NULL`
        )
      );

    // Calculate performance metrics for the period
    const periodMetricsResult = await db
      .select({
        completedCount: sql<number>`COUNT(CASE WHEN ${bookingsTable.status} = 'completed' THEN 1 END)`,
        cancelledCount: sql<number>`COUNT(CASE WHEN ${bookingsTable.status} = 'cancelled' THEN 1 END)`,
        totalRevenue: sql<number>`COALESCE(SUM(CASE WHEN ${bookingsTable.status} = 'completed' THEN ${bookingsTable.providerPayout} END), 0)`,
        avgBookingValue: sql<number>`COALESCE(AVG(CASE WHEN ${bookingsTable.status} = 'completed' THEN ${bookingsTable.providerPayout} END), 0)`,
      })
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.providerId, providerId),
          gte(bookingsTable.createdAt, startDate)
        )
      );

    // Fetch chart data if requested
    let chartData = null;
    if (includeCharts) {
      // Get daily earnings for the period
      const earningsChartResult = await db
        .select({
          date: sql<string>`DATE(${bookingsTable.completedAt})`,
          earnings: sql<number>`COALESCE(SUM(${bookingsTable.providerPayout}), 0)`,
          bookings: sql<number>`COUNT(*)`,
        })
        .from(bookingsTable)
        .where(
          and(
            eq(bookingsTable.providerId, providerId),
            eq(bookingsTable.status, "completed"),
            gte(bookingsTable.completedAt, startDate)
          )
        )
        .groupBy(sql`DATE(${bookingsTable.completedAt})`)
        .orderBy(sql`DATE(${bookingsTable.completedAt})`);

      chartData = {
        earnings: earningsChartResult,
      };
    }

    // Calculate comparison with previous period
    const prevPeriodStart = new Date(startDate);
    const periodDuration = now.getTime() - startDate.getTime();
    prevPeriodStart.setTime(prevPeriodStart.getTime() - periodDuration);

    const prevPeriodEarningsResult = await db
      .select({
        total: sql<number>`COALESCE(SUM(${bookingsTable.providerPayout}), 0)`,
      })
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.providerId, providerId),
          eq(bookingsTable.status, "completed"),
          gte(bookingsTable.completedAt, prevPeriodStart),
          sql`${bookingsTable.completedAt} < ${startDate}`
        )
      );

    const currentPeriodEarnings = periodMetricsResult[0]?.totalRevenue || 0;
    const previousPeriodEarnings = prevPeriodEarningsResult[0]?.total || 0;
    const earningsGrowth = previousPeriodEarnings > 0
      ? ((currentPeriodEarnings - previousPeriodEarnings) / previousPeriodEarnings) * 100
      : currentPeriodEarnings > 0 ? 100 : 0;

    // Prepare response
    const metrics = {
      overview: {
        monthlyEarnings: Number(monthlyEarningsResult[0]?.total || 0),
        totalEarnings: Number(totalEarningsResult[0]?.total || 0),
        completedBookings: provider[0].completedBookings,
        upcomingBookings: Number(upcomingBookingsResult[0]?.count || 0),
        averageRating: Number(provider[0].averageRating || 0),
        totalReviews: provider[0].totalReviews,
        pendingPayouts: Number(pendingPayoutsResult[0]?.total || 0),
      },
      period: {
        name: period,
        startDate: startDate.toISOString(),
        completedBookings: Number(periodMetricsResult[0]?.completedCount || 0),
        cancelledBookings: Number(periodMetricsResult[0]?.cancelledCount || 0),
        totalRevenue: Number(periodMetricsResult[0]?.totalRevenue || 0),
        averageBookingValue: Number(periodMetricsResult[0]?.avgBookingValue || 0),
        earningsGrowth: Number(earningsGrowth.toFixed(2)),
      },
      chartData,
      provider: {
        id: provider[0].id,
        displayName: provider[0].displayName,
        isVerified: provider[0].isVerified,
        stripeOnboardingComplete: provider[0].stripeOnboardingComplete,
      },
    };

    // Set cache headers for 60 seconds
    return NextResponse.json(metrics, {
      headers: {
        "Cache-Control": "private, max-age=60, stale-while-revalidate=30",
      },
    });
  } catch (error) {
    console.error("Error fetching provider metrics:", error);
    
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