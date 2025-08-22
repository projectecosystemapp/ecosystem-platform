import { db } from "@/db/db";
import { 
  bookingsTable, 
  transactionsTable,
  bookingStatus 
} from "@/db/schema/bookings-schema";
import { 
  providersTable,
  providerAvailabilityTable 
} from "@/db/schema/providers-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { reviewsTable } from "@/db/schema/reviews-schema";
import { eq, and, gte, lte, between, sql, desc, asc, count, avg, sum } from "drizzle-orm";
import { subDays, startOfDay, endOfDay, format, subMonths, startOfMonth, endOfMonth } from "date-fns";

/**
 * Comprehensive Analytics Queries for Data Pipeline Management
 * Provides insights into booking patterns, provider performance, and platform metrics
 */

// ===========================
// PLATFORM-WIDE ANALYTICS
// ===========================

export interface PlatformMetrics {
  totalBookings: number;
  totalRevenue: number;
  totalPlatformFees: number;
  totalProviders: number;
  activeProviders: number;
  averageBookingValue: number;
  bookingSuccessRate: number;
  providerUtilizationRate: number;
}

export async function getPlatformMetrics(
  dateRange?: { start: Date; end: Date }
): Promise<PlatformMetrics> {
  const startDate = dateRange?.start || startOfMonth(subMonths(new Date(), 1));
  const endDate = dateRange?.end || endOfMonth(new Date());

  // Execute analytics queries in parallel for efficiency
  const [
    bookingStats,
    revenueStats,
    providerStats,
    utilizationStats
  ] = await Promise.all([
    // Booking statistics
    db
      .select({
        totalBookings: count(),
        successfulBookings: count(sql`CASE WHEN ${bookingsTable.status} = 'completed' THEN 1 END`),
        cancelledBookings: count(sql`CASE WHEN ${bookingsTable.status} = 'cancelled' THEN 1 END`),
      })
      .from(bookingsTable)
      .where(between(bookingsTable.bookingDate, startDate, endDate)),

    // Revenue statistics
    db
      .select({
        totalRevenue: sum(sql`CASE WHEN ${bookingsTable.status} = 'completed' THEN ${bookingsTable.totalAmount} ELSE 0 END`),
        totalPlatformFees: sum(sql`CASE WHEN ${bookingsTable.status} = 'completed' THEN ${bookingsTable.platformFee} ELSE 0 END`),
        avgBookingValue: avg(sql`CASE WHEN ${bookingsTable.status} = 'completed' THEN ${bookingsTable.totalAmount} END`),
      })
      .from(bookingsTable)
      .where(between(bookingsTable.bookingDate, startDate, endDate)),

    // Provider statistics
    db
      .select({
        totalProviders: count(),
        activeProviders: count(sql`CASE WHEN ${providersTable.isActive} = true THEN 1 END`),
        verifiedProviders: count(sql`CASE WHEN ${providersTable.isVerified} = true THEN 1 END`),
      })
      .from(providersTable),

    // Provider utilization (providers with bookings in period)
    db
      .select({
        providersWithBookings: count(sql`DISTINCT ${bookingsTable.providerId}`),
      })
      .from(bookingsTable)
      .where(
        and(
          between(bookingsTable.bookingDate, startDate, endDate),
          sql`${bookingsTable.status} IN ('confirmed', 'completed')`
        )
      )
  ]);

  const totalBookings = bookingStats[0]?.totalBookings || 0;
  const successfulBookings = bookingStats[0]?.successfulBookings || 0;
  const totalRevenue = parseFloat(revenueStats[0]?.totalRevenue?.toString() || '0');
  const totalPlatformFees = parseFloat(revenueStats[0]?.totalPlatformFees?.toString() || '0');
  const averageBookingValue = parseFloat(revenueStats[0]?.avgBookingValue?.toString() || '0');
  const totalProviders = providerStats[0]?.totalProviders || 0;
  const activeProviders = providerStats[0]?.activeProviders || 0;
  const providersWithBookings = utilizationStats[0]?.providersWithBookings || 0;

  return {
    totalBookings,
    totalRevenue,
    totalPlatformFees,
    totalProviders,
    activeProviders,
    averageBookingValue,
    bookingSuccessRate: totalBookings > 0 ? (successfulBookings / totalBookings) * 100 : 0,
    providerUtilizationRate: activeProviders > 0 ? (providersWithBookings / activeProviders) * 100 : 0,
  };
}

// ===========================
// BOOKING ANALYTICS
// ===========================

export interface BookingTrends {
  dailyBookings: Array<{ date: string; bookings: number; revenue: number }>;
  hourlyDistribution: Array<{ hour: number; bookings: number }>;
  dayOfWeekDistribution: Array<{ dayOfWeek: number; bookings: number }>;
  statusDistribution: Array<{ status: string; count: number; percentage: number }>;
  servicePopularity: Array<{ serviceName: string; bookings: number; revenue: number }>;
}

export async function getBookingTrends(
  dateRange?: { start: Date; end: Date }
): Promise<BookingTrends> {
  const startDate = dateRange?.start || subDays(new Date(), 30);
  const endDate = dateRange?.end || new Date();

  const [
    dailyStats,
    hourlyStats,
    dayOfWeekStats,
    statusStats,
    serviceStats
  ] = await Promise.all([
    // Daily booking trends
    db.execute(sql`
      SELECT 
        DATE(booking_date) as date,
        COUNT(*) as bookings,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END), 0) as revenue
      FROM ${bookingsTable}
      WHERE booking_date BETWEEN ${startDate} AND ${endDate}
      GROUP BY DATE(booking_date)
      ORDER BY date
    `),

    // Hourly distribution
    db.execute(sql`
      SELECT 
        EXTRACT(HOUR FROM (start_time::TIME)) as hour,
        COUNT(*) as bookings
      FROM ${bookingsTable}
      WHERE booking_date BETWEEN ${startDate} AND ${endDate}
      GROUP BY EXTRACT(HOUR FROM (start_time::TIME))
      ORDER BY hour
    `),

    // Day of week distribution
    db.execute(sql`
      SELECT 
        EXTRACT(DOW FROM booking_date) as day_of_week,
        COUNT(*) as bookings
      FROM ${bookingsTable}
      WHERE booking_date BETWEEN ${startDate} AND ${endDate}
      GROUP BY EXTRACT(DOW FROM booking_date)
      ORDER BY day_of_week
    `),

    // Status distribution
    db.execute(sql`
      SELECT 
        status,
        COUNT(*) as count,
        ROUND((COUNT(*) * 100.0 / SUM(COUNT(*)) OVER ()), 2) as percentage
      FROM ${bookingsTable}
      WHERE booking_date BETWEEN ${startDate} AND ${endDate}
      GROUP BY status
      ORDER BY count DESC
    `),

    // Service popularity
    db.execute(sql`
      SELECT 
        service_name,
        COUNT(*) as bookings,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END), 0) as revenue
      FROM ${bookingsTable}
      WHERE booking_date BETWEEN ${startDate} AND ${endDate}
      GROUP BY service_name
      ORDER BY bookings DESC
      LIMIT 10
    `)
  ]);

  return {
    dailyBookings: dailyStats.rows.map((row: any) => ({
      date: row.date,
      bookings: parseInt(row.bookings),
      revenue: parseFloat(row.revenue)
    })),
    hourlyDistribution: hourlyStats.rows.map((row: any) => ({
      hour: parseInt(row.hour),
      bookings: parseInt(row.bookings)
    })),
    dayOfWeekDistribution: dayOfWeekStats.rows.map((row: any) => ({
      dayOfWeek: parseInt(row.day_of_week),
      bookings: parseInt(row.bookings)
    })),
    statusDistribution: statusStats.rows.map((row: any) => ({
      status: row.status,
      count: parseInt(row.count),
      percentage: parseFloat(row.percentage)
    })),
    servicePopularity: serviceStats.rows.map((row: any) => ({
      serviceName: row.service_name,
      bookings: parseInt(row.bookings),
      revenue: parseFloat(row.revenue)
    }))
  };
}

// ===========================
// PROVIDER PERFORMANCE ANALYTICS
// ===========================

export interface ProviderPerformance {
  providerId: string;
  providerName: string;
  totalBookings: number;
  completedBookings: number;
  completionRate: number;
  totalRevenue: number;
  averageBookingValue: number;
  averageRating: number;
  totalReviews: number;
  utilizationRate: number;
  responseTime: number; // avg time to confirm bookings
}

export async function getTopPerformingProviders(
  limit: number = 20,
  dateRange?: { start: Date; end: Date }
): Promise<ProviderPerformance[]> {
  const startDate = dateRange?.start || subDays(new Date(), 30);
  const endDate = dateRange?.end || new Date();

  const results = await db.execute(sql`
    WITH provider_stats AS (
      SELECT 
        p.id as provider_id,
        p.display_name as provider_name,
        COUNT(b.id) as total_bookings,
        COUNT(CASE WHEN b.status = 'completed' THEN 1 END) as completed_bookings,
        ROUND(
          CASE 
            WHEN COUNT(b.id) > 0 
            THEN (COUNT(CASE WHEN b.status = 'completed' THEN 1 END) * 100.0 / COUNT(b.id))
            ELSE 0 
          END, 2
        ) as completion_rate,
        COALESCE(SUM(CASE WHEN b.status = 'completed' THEN b.provider_payout ELSE 0 END), 0) as total_revenue,
        COALESCE(AVG(CASE WHEN b.status = 'completed' THEN b.total_amount END), 0) as avg_booking_value,
        p.average_rating,
        p.total_reviews,
        COALESCE(AVG(
          CASE WHEN b.status = 'confirmed' AND b.updated_at != b.created_at 
          THEN EXTRACT(EPOCH FROM (b.updated_at - b.created_at)) / 3600 
          END
        ), 0) as avg_response_time_hours
      FROM providers p
      LEFT JOIN bookings b ON p.id = b.provider_id 
        AND b.booking_date BETWEEN ${startDate} AND ${endDate}
      WHERE p.is_active = true
      GROUP BY p.id, p.display_name, p.average_rating, p.total_reviews
    ),
    availability_stats AS (
      SELECT 
        p.id as provider_id,
        COUNT(DISTINCT pa.id) * 8 as total_available_hours_per_week -- assuming 8-hour slots
      FROM providers p
      LEFT JOIN provider_availability pa ON p.id = pa.provider_id AND pa.is_active = true
      GROUP BY p.id
    )
    SELECT 
      ps.*,
      ROUND(
        CASE 
          WHEN av.total_available_hours_per_week > 0 
          THEN (ps.total_bookings * 1.0 / av.total_available_hours_per_week) * 100
          ELSE 0 
        END, 2
      ) as utilization_rate
    FROM provider_stats ps
    LEFT JOIN availability_stats av ON ps.provider_id = av.provider_id
    ORDER BY ps.total_revenue DESC, ps.completion_rate DESC
    LIMIT ${limit}
  `);

  return results.rows.map((row: any) => ({
    providerId: row.provider_id,
    providerName: row.provider_name,
    totalBookings: parseInt(row.total_bookings),
    completedBookings: parseInt(row.completed_bookings),
    completionRate: parseFloat(row.completion_rate),
    totalRevenue: parseFloat(row.total_revenue),
    averageBookingValue: parseFloat(row.avg_booking_value),
    averageRating: parseFloat(row.average_rating),
    totalReviews: parseInt(row.total_reviews),
    utilizationRate: parseFloat(row.utilization_rate),
    responseTime: parseFloat(row.avg_response_time_hours)
  }));
}

// ===========================
// REVENUE ANALYTICS
// ===========================

export interface RevenueBreakdown {
  totalGrossRevenue: number;
  totalPlatformFees: number;
  totalProviderPayouts: number;
  averageFeePercentage: number;
  monthlyRevenueTrend: Array<{ month: string; revenue: number; fees: number }>;
  revenueByService: Array<{ serviceName: string; revenue: number; bookings: number }>;
}

export async function getRevenueAnalytics(
  dateRange?: { start: Date; end: Date }
): Promise<RevenueBreakdown> {
  const startDate = dateRange?.start || subMonths(new Date(), 12);
  const endDate = dateRange?.end || new Date();

  const [summaryStats, monthlyTrend, serviceRevenue] = await Promise.all([
    // Overall revenue summary
    db.execute(sql`
      SELECT 
        COALESCE(SUM(total_amount), 0) as total_gross_revenue,
        COALESCE(SUM(platform_fee), 0) as total_platform_fees,
        COALESCE(SUM(provider_payout), 0) as total_provider_payouts,
        ROUND(AVG(platform_fee * 100.0 / NULLIF(total_amount, 0)), 2) as avg_fee_percentage
      FROM ${bookingsTable}
      WHERE status = 'completed' 
        AND booking_date BETWEEN ${startDate} AND ${endDate}
    `),

    // Monthly revenue trend
    db.execute(sql`
      SELECT 
        TO_CHAR(booking_date, 'YYYY-MM') as month,
        COALESCE(SUM(total_amount), 0) as revenue,
        COALESCE(SUM(platform_fee), 0) as fees
      FROM ${bookingsTable}
      WHERE status = 'completed' 
        AND booking_date BETWEEN ${startDate} AND ${endDate}
      GROUP BY TO_CHAR(booking_date, 'YYYY-MM')
      ORDER BY month
    `),

    // Revenue by service
    db.execute(sql`
      SELECT 
        service_name,
        COALESCE(SUM(total_amount), 0) as revenue,
        COUNT(*) as bookings
      FROM ${bookingsTable}
      WHERE status = 'completed' 
        AND booking_date BETWEEN ${startDate} AND ${endDate}
      GROUP BY service_name
      ORDER BY revenue DESC
      LIMIT 15
    `)
  ]);

  const summary = summaryStats.rows[0] || {};
  
  return {
    totalGrossRevenue: parseFloat(summary.total_gross_revenue || '0'),
    totalPlatformFees: parseFloat(summary.total_platform_fees || '0'),
    totalProviderPayouts: parseFloat(summary.total_provider_payouts || '0'),
    averageFeePercentage: parseFloat(summary.avg_fee_percentage || '0'),
    monthlyRevenueTrend: monthlyTrend.rows.map((row: any) => ({
      month: row.month,
      revenue: parseFloat(row.revenue),
      fees: parseFloat(row.fees)
    })),
    revenueByService: serviceRevenue.rows.map((row: any) => ({
      serviceName: row.service_name,
      revenue: parseFloat(row.revenue),
      bookings: parseInt(row.bookings)
    }))
  };
}

// ===========================
// AVAILABILITY ANALYTICS
// ===========================

export interface AvailabilityInsights {
  averageAvailabilityPerProvider: number;
  peakBookingHours: Array<{ hour: number; utilization: number }>;
  utilizationByDayOfWeek: Array<{ dayOfWeek: number; utilization: number }>;
  providersWithLowUtilization: Array<{ providerId: string; providerName: string; utilizationRate: number }>;
}

export async function getAvailabilityInsights(
  dateRange?: { start: Date; end: Date }
): Promise<AvailabilityInsights> {
  const startDate = dateRange?.start || subDays(new Date(), 30);
  const endDate = dateRange?.end || new Date();

  const [
    availabilityStats,
    hourlyUtilization,
    weeklyUtilization,
    lowUtilizationProviders
  ] = await Promise.all([
    // Average availability per provider
    db.execute(sql`
      SELECT 
        AVG(hours_per_week) as avg_availability
      FROM (
        SELECT 
          provider_id,
          COUNT(*) * 8 as hours_per_week  -- assuming 8-hour days
        FROM provider_availability 
        WHERE is_active = true
        GROUP BY provider_id
      ) availability_summary
    `),

    // Peak booking hours
    db.execute(sql`
      WITH hourly_slots AS (
        SELECT 
          EXTRACT(HOUR FROM start_time::TIME) as hour,
          COUNT(*) as bookings,
          COUNT(DISTINCT provider_id) * 30 as total_possible_slots -- rough estimate
        FROM ${bookingsTable}
        WHERE booking_date BETWEEN ${startDate} AND ${endDate}
          AND status IN ('confirmed', 'completed')
        GROUP BY EXTRACT(HOUR FROM start_time::TIME)
      )
      SELECT 
        hour,
        ROUND((bookings * 100.0 / NULLIF(total_possible_slots, 0)), 2) as utilization
      FROM hourly_slots
      ORDER BY hour
    `),

    // Weekly utilization
    db.execute(sql`
      SELECT 
        EXTRACT(DOW FROM booking_date) as day_of_week,
        COUNT(*) as bookings,
        COUNT(DISTINCT provider_id) * 4 as estimated_slots -- rough estimate
      FROM ${bookingsTable}
      WHERE booking_date BETWEEN ${startDate} AND ${endDate}
        AND status IN ('confirmed', 'completed')
      GROUP BY EXTRACT(DOW FROM booking_date)
      ORDER BY day_of_week
    `),

    // Providers with low utilization
    db.execute(sql`
      WITH provider_utilization AS (
        SELECT 
          p.id as provider_id,
          p.display_name as provider_name,
          COUNT(b.id) as total_bookings,
          COUNT(pa.id) * 30 as estimated_available_slots -- rough estimate
        FROM providers p
        LEFT JOIN bookings b ON p.id = b.provider_id 
          AND b.booking_date BETWEEN ${startDate} AND ${endDate}
          AND b.status IN ('confirmed', 'completed')
        LEFT JOIN provider_availability pa ON p.id = pa.provider_id AND pa.is_active = true
        WHERE p.is_active = true
        GROUP BY p.id, p.display_name
      )
      SELECT 
        provider_id,
        provider_name,
        ROUND((total_bookings * 100.0 / NULLIF(estimated_available_slots, 0)), 2) as utilization_rate
      FROM provider_utilization
      WHERE estimated_available_slots > 0
      ORDER BY utilization_rate ASC
      LIMIT 10
    `)
  ]);

  return {
    averageAvailabilityPerProvider: parseFloat(availabilityStats.rows[0]?.avg_availability || '0'),
    peakBookingHours: hourlyUtilization.rows.map((row: any) => ({
      hour: parseInt(row.hour),
      utilization: parseFloat(row.utilization)
    })),
    utilizationByDayOfWeek: weeklyUtilization.rows.map((row: any) => ({
      dayOfWeek: parseInt(row.day_of_week),
      utilization: parseFloat((row.bookings * 100 / row.estimated_slots).toFixed(2))
    })),
    providersWithLowUtilization: lowUtilizationProviders.rows.map((row: any) => ({
      providerId: row.provider_id,
      providerName: row.provider_name,
      utilizationRate: parseFloat(row.utilization_rate)
    }))
  };
}

// ===========================
// BOOKING SUCCESS RATE ANALYSIS
// ===========================

export interface BookingSuccessMetrics {
  overallSuccessRate: number;
  successRateByService: Array<{ serviceName: string; successRate: number; totalBookings: number }>;
  cancellationReasons: Array<{ reason: string; count: number; percentage: number }>;
  conversionFunnel: {
    totalAttempts: number;
    successfulBookings: number;
    pendingBookings: number;
    cancelledBookings: number;
    noShowBookings: number;
  };
}

export async function getBookingSuccessMetrics(
  dateRange?: { start: Date; end: Date }
): Promise<BookingSuccessMetrics> {
  const startDate = dateRange?.start || subDays(new Date(), 30);
  const endDate = dateRange?.end || new Date();

  const [
    overallStats,
    serviceSuccessRates,
    cancellationReasons,
    funnelStats
  ] = await Promise.all([
    // Overall success rate
    db.execute(sql`
      SELECT 
        COUNT(*) as total_bookings,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_bookings,
        ROUND((COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*)), 2) as success_rate
      FROM ${bookingsTable}
      WHERE booking_date BETWEEN ${startDate} AND ${endDate}
    `),

    // Success rate by service
    db.execute(sql`
      SELECT 
        service_name,
        COUNT(*) as total_bookings,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_bookings,
        ROUND((COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*)), 2) as success_rate
      FROM ${bookingsTable}
      WHERE booking_date BETWEEN ${startDate} AND ${endDate}
      GROUP BY service_name
      HAVING COUNT(*) >= 5  -- Only services with meaningful data
      ORDER BY success_rate DESC
    `),

    // Cancellation reasons
    db.execute(sql`
      SELECT 
        COALESCE(cancellation_reason, 'No reason provided') as reason,
        COUNT(*) as count,
        ROUND((COUNT(*) * 100.0 / SUM(COUNT(*)) OVER ()), 2) as percentage
      FROM ${bookingsTable}
      WHERE status = 'cancelled' 
        AND booking_date BETWEEN ${startDate} AND ${endDate}
      GROUP BY cancellation_reason
      ORDER BY count DESC
    `),

    // Conversion funnel
    db.execute(sql`
      SELECT 
        COUNT(*) as total_attempts,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_bookings,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_bookings,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_bookings,
        COUNT(CASE WHEN status = 'no_show' THEN 1 END) as no_show_bookings
      FROM ${bookingsTable}
      WHERE booking_date BETWEEN ${startDate} AND ${endDate}
    `)
  ]);

  const overall = overallStats.rows[0] || {};
  const funnel = funnelStats.rows[0] || {};

  return {
    overallSuccessRate: parseFloat(overall.success_rate || '0'),
    successRateByService: serviceSuccessRates.rows.map((row: any) => ({
      serviceName: row.service_name,
      successRate: parseFloat(row.success_rate),
      totalBookings: parseInt(row.total_bookings)
    })),
    cancellationReasons: cancellationReasons.rows.map((row: any) => ({
      reason: row.reason,
      count: parseInt(row.count),
      percentage: parseFloat(row.percentage)
    })),
    conversionFunnel: {
      totalAttempts: parseInt(funnel.total_attempts || '0'),
      successfulBookings: parseInt(funnel.successful_bookings || '0'),
      pendingBookings: parseInt(funnel.pending_bookings || '0'),
      cancelledBookings: parseInt(funnel.cancelled_bookings || '0'),
      noShowBookings: parseInt(funnel.no_show_bookings || '0')
    }
  };
}

// ===========================
// UTILITY FUNCTIONS
// ===========================

/**
 * Get real-time platform health metrics
 */
export async function getPlatformHealthMetrics(): Promise<{
  activeBookingsToday: number;
  pendingBookingsCount: number;
  systemLoad: number;
  averageResponseTime: number;
}> {
  const today = new Date();
  const startOfToday = startOfDay(today);
  const endOfToday = endOfDay(today);

  const [
    todayBookings,
    pendingBookings
  ] = await Promise.all([
    db
      .select({ count: count() })
      .from(bookingsTable)
      .where(
        and(
          between(bookingsTable.bookingDate, startOfToday, endOfToday),
          sql`${bookingsTable.status} IN ('confirmed', 'completed')`
        )
      ),

    db
      .select({ count: count() })
      .from(bookingsTable)
      .where(eq(bookingsTable.status, 'pending'))
  ]);

  return {
    activeBookingsToday: todayBookings[0]?.count || 0,
    pendingBookingsCount: pendingBookings[0]?.count || 0,
    systemLoad: 0, // Would integrate with system monitoring
    averageResponseTime: 0 // Would integrate with APM tools
  };
}

/**
 * Generate data quality report
 */
export async function getDataQualityReport(): Promise<{
  missingProviderData: number;
  incompleteBookings: number;
  orphanedRecords: number;
  dataIntegrityIssues: string[];
}> {
  const [
    providerDataIssues,
    bookingDataIssues,
    orphanedBookings,
    orphanedTransactions
  ] = await Promise.all([
    // Providers missing critical data
    db
      .select({ count: count() })
      .from(providersTable)
      .where(
        and(
          eq(providersTable.isActive, true),
          sql`(${providersTable.stripeConnectAccountId} IS NULL OR ${providersTable.hourlyRate} IS NULL)`
        )
      ),

    // Bookings with missing payment info
    db
      .select({ count: count() })
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.status, 'completed'),
          sql`${bookingsTable.stripePaymentIntentId} IS NULL`
        )
      ),

    // Orphaned bookings (provider doesn't exist)
    db.execute(sql`
      SELECT COUNT(*) as count
      FROM ${bookingsTable} b
      LEFT JOIN ${providersTable} p ON b.provider_id = p.id
      WHERE p.id IS NULL
    `),

    // Orphaned transactions (booking doesn't exist)
    db.execute(sql`
      SELECT COUNT(*) as count
      FROM ${transactionsTable} t
      LEFT JOIN ${bookingsTable} b ON t.booking_id = b.id
      WHERE b.id IS NULL
    `)
  ]);

  const issues: string[] = [];
  const missingProviderData = providerDataIssues[0]?.count || 0;
  const incompleteBookings = bookingDataIssues[0]?.count || 0;
  const orphanedBookingsCount = parseInt(orphanedBookings.rows[0]?.count || '0');
  const orphanedTransactionsCount = parseInt(orphanedTransactions.rows[0]?.count || '0');

  if (missingProviderData > 0) {
    issues.push(`${missingProviderData} active providers missing Stripe or pricing data`);
  }
  if (incompleteBookings > 0) {
    issues.push(`${incompleteBookings} completed bookings missing payment information`);
  }
  if (orphanedBookingsCount > 0) {
    issues.push(`${orphanedBookingsCount} bookings reference non-existent providers`);
  }
  if (orphanedTransactionsCount > 0) {
    issues.push(`${orphanedTransactionsCount} transactions reference non-existent bookings`);
  }

  return {
    missingProviderData,
    incompleteBookings,
    orphanedRecords: orphanedBookingsCount + orphanedTransactionsCount,
    dataIntegrityIssues: issues
  };
}