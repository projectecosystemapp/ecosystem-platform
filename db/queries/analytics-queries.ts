import { db } from "@/db/db";
import { bookingsTable, transactionsTable, providersTable, reviewsTable } from "@/db/schema";
import { and, eq, gte, lte, desc, count, avg, sum, sql } from "drizzle-orm";

/**
 * Analytics Queries for Provider Dashboard
 * 
 * Business Context:
 * - Platform fee is 10% base fee for authenticated users
 * - Guests pay additional 10% surcharge (total 20% platform fee)
 * - Providers always receive servicePrice - 10% base fee
 * - All monetary values stored as DECIMAL(10,2)
 * 
 * Time periods supported: 7d, 30d, 90d, 1yr, all
 */

export type TimePeriod = '7d' | '30d' | '90d' | '1yr' | 'all';

export interface AnalyticsPeriod {
  start: Date;
  end: Date;
}

export interface EarningsData {
  totalEarnings: number;
  totalBookings: number;
  averageBookingValue: number;
  platformFees: number;
  pendingPayouts: number;
  completedPayouts: number;
  periodComparison: {
    earningsChange: number;
    bookingsChange: number;
    averageValueChange: number;
  };
  dailyEarnings: Array<{
    date: string;
    earnings: number;
    bookings: number;
  }>;
  monthlyTrends: Array<{
    month: string;
    earnings: number;
    bookings: number;
  }>;
}

export interface BookingMetrics {
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  noShowBookings: number;
  completionRate: number;
  cancellationRate: number;
  averageBookingValue: number;
  bookingsByStatus: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  bookingTrends: Array<{
    date: string;
    pending: number;
    confirmed: number;
    completed: number;
    cancelled: number;
  }>;
  peakHours: Array<{
    hour: number;
    bookings: number;
  }>;
}

export interface CustomerMetrics {
  totalCustomers: number;
  returningCustomers: number;
  newCustomers: number;
  customerRetentionRate: number;
  averageBookingsPerCustomer: number;
  customerLifetimeValue: number;
  topCustomers: Array<{
    customerId: string;
    totalBookings: number;
    totalSpent: number;
    lastBookingDate: string;
  }>;
  customerAcquisition: Array<{
    date: string;
    newCustomers: number;
    returningCustomers: number;
  }>;
}

export interface PerformanceMetrics {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: Array<{
    rating: number;
    count: number;
    percentage: number;
  }>;
  responseTime: number; // Average time to confirm bookings
  onTimeRate: number;
  customerSatisfactionScore: number;
  recentReviews: Array<{
    rating: number;
    reviewText: string;
    customerName: string;
    createdAt: string;
    serviceName: string;
  }>;
  ratingTrends: Array<{
    month: string;
    averageRating: number;
    reviewCount: number;
  }>;
}

export interface RevenueBreakdown {
  byService: Array<{
    serviceName: string;
    bookings: number;
    revenue: number;
    averagePrice: number;
    percentage: number;
  }>;
  byMonth: Array<{
    month: string;
    revenue: number;
    bookings: number;
    averageValue: number;
  }>;
  byDayOfWeek: Array<{
    dayName: string;
    dayIndex: number;
    revenue: number;
    bookings: number;
  }>;
  byTimeOfDay: Array<{
    hour: number;
    revenue: number;
    bookings: number;
  }>;
}

export interface TopServices {
  mostBooked: Array<{
    serviceName: string;
    bookings: number;
    revenue: number;
    averageRating: number;
    averagePrice: number;
  }>;
  highestRevenue: Array<{
    serviceName: string;
    revenue: number;
    bookings: number;
    averagePrice: number;
    profitMargin: number;
  }>;
  bestRated: Array<{
    serviceName: string;
    averageRating: number;
    reviewCount: number;
    bookings: number;
    revenue: number;
  }>;
}

/**
 * Convert time period string to date range
 */
function getDateRange(period: TimePeriod): AnalyticsPeriod {
  const end = new Date();
  let start = new Date();

  switch (period) {
    case '7d':
      start.setDate(end.getDate() - 7);
      break;
    case '30d':
      start.setDate(end.getDate() - 30);
      break;
    case '90d':
      start.setDate(end.getDate() - 90);
      break;
    case '1yr':
      start.setFullYear(end.getFullYear() - 1);
      break;
    case 'all':
      start = new Date(2020, 0, 1); // Platform launch date
      break;
  }

  return { start, end };
}

/**
 * Get previous period for comparison
 */
function getPreviousPeriod(period: TimePeriod): AnalyticsPeriod {
  const current = getDateRange(period);
  const duration = current.end.getTime() - current.start.getTime();
  
  return {
    start: new Date(current.start.getTime() - duration),
    end: current.start,
  };
}

/**
 * Get provider earnings data with period comparison
 */
export async function getProviderEarnings(
  providerId: string,
  period: TimePeriod = '30d'
): Promise<EarningsData> {
  const { start, end } = getDateRange(period);
  const previousPeriod = getPreviousPeriod(period);

  // Current period earnings
  const currentEarnings = await db
    .select({
      totalEarnings: sum(bookingsTable.providerPayout).mapWith(Number),
      totalBookings: count(),
      platformFees: sum(bookingsTable.platformFee).mapWith(Number),
    })
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.providerId, providerId),
        gte(bookingsTable.createdAt, start),
        lte(bookingsTable.createdAt, end),
        sql`${bookingsTable.status} IN ('completed', 'confirmed')`
      )
    );

  // Previous period for comparison
  const previousEarnings = await db
    .select({
      totalEarnings: sum(bookingsTable.providerPayout).mapWith(Number),
      totalBookings: count(),
    })
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.providerId, providerId),
        gte(bookingsTable.createdAt, previousPeriod.start),
        lte(bookingsTable.createdAt, previousPeriod.end),
        sql`${bookingsTable.status} IN ('completed', 'confirmed')`
      )
    );

  // Pending and completed payouts
  const payoutStatus = await db
    .select({
      pendingPayouts: sql<number>`COALESCE(SUM(CASE WHEN ${transactionsTable.status} = 'pending' THEN ${transactionsTable.providerPayout} END), 0)`.mapWith(Number),
      completedPayouts: sql<number>`COALESCE(SUM(CASE WHEN ${transactionsTable.status} = 'completed' THEN ${transactionsTable.providerPayout} END), 0)`.mapWith(Number),
    })
    .from(transactionsTable)
    .innerJoin(bookingsTable, eq(transactionsTable.bookingId, bookingsTable.id))
    .where(
      and(
        eq(bookingsTable.providerId, providerId),
        gte(bookingsTable.createdAt, start),
        lte(bookingsTable.createdAt, end)
      )
    );

  // Daily earnings trend
  const dailyEarnings = await db
    .select({
      date: sql<string>`DATE(${bookingsTable.createdAt})`,
      earnings: sum(bookingsTable.providerPayout).mapWith(Number),
      bookings: count(),
    })
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.providerId, providerId),
        gte(bookingsTable.createdAt, start),
        lte(bookingsTable.createdAt, end),
        sql`${bookingsTable.status} IN ('completed', 'confirmed')`
      )
    )
    .groupBy(sql`DATE(${bookingsTable.createdAt})`)
    .orderBy(sql`DATE(${bookingsTable.createdAt})`);

  // Monthly trends
  const monthlyTrends = await db
    .select({
      month: sql<string>`TO_CHAR(${bookingsTable.createdAt}, 'YYYY-MM')`,
      earnings: sum(bookingsTable.providerPayout).mapWith(Number),
      bookings: count(),
    })
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.providerId, providerId),
        gte(bookingsTable.createdAt, start),
        lte(bookingsTable.createdAt, end),
        sql`${bookingsTable.status} IN ('completed', 'confirmed')`
      )
    )
    .groupBy(sql`TO_CHAR(${bookingsTable.createdAt}, 'YYYY-MM')`)
    .orderBy(sql`TO_CHAR(${bookingsTable.createdAt}, 'YYYY-MM')`);

  const current = currentEarnings[0] || { totalEarnings: 0, totalBookings: 0, platformFees: 0 };
  const previous = previousEarnings[0] || { totalEarnings: 0, totalBookings: 0 };
  const payouts = payoutStatus[0] || { pendingPayouts: 0, completedPayouts: 0 };

  const averageBookingValue = current.totalBookings > 0 ? current.totalEarnings / current.totalBookings : 0;
  const previousAverageValue = previous.totalBookings > 0 ? previous.totalEarnings / previous.totalBookings : 0;

  return {
    totalEarnings: current.totalEarnings || 0,
    totalBookings: current.totalBookings || 0,
    averageBookingValue,
    platformFees: current.platformFees || 0,
    pendingPayouts: payouts.pendingPayouts || 0,
    completedPayouts: payouts.completedPayouts || 0,
    periodComparison: {
      earningsChange: previous.totalEarnings ? 
        ((current.totalEarnings - previous.totalEarnings) / previous.totalEarnings) * 100 : 0,
      bookingsChange: previous.totalBookings ? 
        ((current.totalBookings - previous.totalBookings) / previous.totalBookings) * 100 : 0,
      averageValueChange: previousAverageValue ? 
        ((averageBookingValue - previousAverageValue) / previousAverageValue) * 100 : 0,
    },
    dailyEarnings: dailyEarnings.map(d => ({
      date: d.date,
      earnings: d.earnings || 0,
      bookings: d.bookings || 0,
    })),
    monthlyTrends: monthlyTrends.map(m => ({
      month: m.month,
      earnings: m.earnings || 0,
      bookings: m.bookings || 0,
    })),
  };
}

/**
 * Get booking metrics and status distribution
 */
export async function getBookingMetrics(
  providerId: string,
  period: TimePeriod = '30d'
): Promise<BookingMetrics> {
  const { start, end } = getDateRange(period);

  // Overall booking stats
  const bookingStats = await db
    .select({
      totalBookings: count(),
      completedBookings: sql<number>`SUM(CASE WHEN ${bookingsTable.status} = 'completed' THEN 1 ELSE 0 END)`.mapWith(Number),
      cancelledBookings: sql<number>`SUM(CASE WHEN ${bookingsTable.status} = 'cancelled' THEN 1 ELSE 0 END)`.mapWith(Number),
      noShowBookings: sql<number>`SUM(CASE WHEN ${bookingsTable.status} = 'no_show' THEN 1 ELSE 0 END)`.mapWith(Number),
      averageValue: avg(bookingsTable.providerPayout).mapWith(Number),
    })
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.providerId, providerId),
        gte(bookingsTable.createdAt, start),
        lte(bookingsTable.createdAt, end)
      )
    );

  // Booking status distribution
  const statusDistribution = await db
    .select({
      status: bookingsTable.status,
      count: count(),
    })
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.providerId, providerId),
        gte(bookingsTable.createdAt, start),
        lte(bookingsTable.createdAt, end)
      )
    )
    .groupBy(bookingsTable.status);

  // Daily booking trends by status
  const bookingTrends = await db
    .select({
      date: sql<string>`DATE(${bookingsTable.createdAt})`,
      pending: sql<number>`SUM(CASE WHEN ${bookingsTable.status} = 'pending' THEN 1 ELSE 0 END)`.mapWith(Number),
      confirmed: sql<number>`SUM(CASE WHEN ${bookingsTable.status} = 'confirmed' THEN 1 ELSE 0 END)`.mapWith(Number),
      completed: sql<number>`SUM(CASE WHEN ${bookingsTable.status} = 'completed' THEN 1 ELSE 0 END)`.mapWith(Number),
      cancelled: sql<number>`SUM(CASE WHEN ${bookingsTable.status} = 'cancelled' THEN 1 ELSE 0 END)`.mapWith(Number),
    })
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.providerId, providerId),
        gte(bookingsTable.createdAt, start),
        lte(bookingsTable.createdAt, end)
      )
    )
    .groupBy(sql`DATE(${bookingsTable.createdAt})`)
    .orderBy(sql`DATE(${bookingsTable.createdAt})`);

  // Peak hours analysis
  const peakHours = await db
    .select({
      hour: sql<number>`EXTRACT(HOUR FROM ${bookingsTable.bookingDate})`.mapWith(Number),
      bookings: count(),
    })
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.providerId, providerId),
        gte(bookingsTable.createdAt, start),
        lte(bookingsTable.createdAt, end)
      )
    )
    .groupBy(sql`EXTRACT(HOUR FROM ${bookingsTable.bookingDate})`)
    .orderBy(sql`EXTRACT(HOUR FROM ${bookingsTable.bookingDate})`);

  const stats = bookingStats[0] || { 
    totalBookings: 0, completedBookings: 0, cancelledBookings: 0, noShowBookings: 0, averageValue: 0 
  };

  const total = stats.totalBookings || 1;
  const bookingsByStatus = statusDistribution.map(s => ({
    status: s.status,
    count: s.count,
    percentage: (s.count / total) * 100,
  }));

  return {
    totalBookings: stats.totalBookings || 0,
    completedBookings: stats.completedBookings || 0,
    cancelledBookings: stats.cancelledBookings || 0,
    noShowBookings: stats.noShowBookings || 0,
    completionRate: total > 0 ? (stats.completedBookings / total) * 100 : 0,
    cancellationRate: total > 0 ? (stats.cancelledBookings / total) * 100 : 0,
    averageBookingValue: stats.averageValue || 0,
    bookingsByStatus,
    bookingTrends: bookingTrends.map(t => ({
      date: t.date,
      pending: t.pending || 0,
      confirmed: t.confirmed || 0,
      completed: t.completed || 0,
      cancelled: t.cancelled || 0,
    })),
    peakHours: peakHours.map(h => ({
      hour: h.hour,
      bookings: h.bookings,
    })),
  };
}

/**
 * Get customer metrics and retention analysis
 */
export async function getCustomerMetrics(
  providerId: string,
  period: TimePeriod = '30d'
): Promise<CustomerMetrics> {
  const { start, end } = getDateRange(period);

  // Customer stats
  const customerStats = await db
    .select({
      totalCustomers: sql<number>`COUNT(DISTINCT ${bookingsTable.customerId})`.mapWith(Number),
      totalBookings: count(),
      totalSpent: sum(bookingsTable.providerPayout).mapWith(Number),
    })
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.providerId, providerId),
        gte(bookingsTable.createdAt, start),
        lte(bookingsTable.createdAt, end),
        sql`${bookingsTable.status} IN ('completed', 'confirmed')`
      )
    );

  // Customer retention analysis
  const customerRetention = await db
    .select({
      customerId: bookingsTable.customerId,
      bookingCount: count(),
      totalSpent: sum(bookingsTable.providerPayout).mapWith(Number),
      firstBooking: sql<Date>`MIN(${bookingsTable.createdAt})`,
      lastBooking: sql<Date>`MAX(${bookingsTable.createdAt})`,
    })
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.providerId, providerId),
        gte(bookingsTable.createdAt, start),
        lte(bookingsTable.createdAt, end),
        sql`${bookingsTable.status} IN ('completed', 'confirmed')`
      )
    )
    .groupBy(bookingsTable.customerId)
    .orderBy(desc(sql`SUM(${bookingsTable.providerPayout})`))
    .limit(10);

  // New vs returning customers by date
  const customerAcquisition = await db
    .select({
      date: sql<string>`DATE(${bookingsTable.createdAt})`,
      newCustomers: sql<number>`COUNT(DISTINCT CASE WHEN first_booking_date = DATE(${bookingsTable.createdAt}) THEN ${bookingsTable.customerId} END)`.mapWith(Number),
      returningCustomers: sql<number>`COUNT(DISTINCT CASE WHEN first_booking_date < DATE(${bookingsTable.createdAt}) THEN ${bookingsTable.customerId} END)`.mapWith(Number),
    })
    .from(sql`(
      SELECT 
        *,
        MIN(DATE(created_at)) OVER (PARTITION BY customer_id) as first_booking_date
      FROM ${bookingsTable}
      WHERE ${bookingsTable.providerId} = ${providerId}
        AND ${bookingsTable.createdAt} >= ${start}
        AND ${bookingsTable.createdAt} <= ${end}
        AND ${bookingsTable.status} IN ('completed', 'confirmed')
    ) as bookings_with_first_date`)
    .groupBy(sql`DATE(created_at)`)
    .orderBy(sql`DATE(created_at)`);

  const stats = customerStats[0] || { totalCustomers: 0, totalBookings: 0, totalSpent: 0 };
  const returningCustomers = customerRetention.filter(c => c.bookingCount > 1).length;
  const newCustomers = stats.totalCustomers - returningCustomers;

  return {
    totalCustomers: stats.totalCustomers || 0,
    returningCustomers,
    newCustomers,
    customerRetentionRate: stats.totalCustomers > 0 ? (returningCustomers / stats.totalCustomers) * 100 : 0,
    averageBookingsPerCustomer: stats.totalCustomers > 0 ? stats.totalBookings / stats.totalCustomers : 0,
    customerLifetimeValue: stats.totalCustomers > 0 ? stats.totalSpent / stats.totalCustomers : 0,
    topCustomers: customerRetention.map(c => ({
      customerId: c.customerId,
      totalBookings: c.bookingCount,
      totalSpent: c.totalSpent || 0,
      lastBookingDate: c.lastBooking.toISOString().split('T')[0],
    })),
    customerAcquisition: customerAcquisition.map(c => ({
      date: c.date,
      newCustomers: c.newCustomers || 0,
      returningCustomers: c.returningCustomers || 0,
    })),
  };
}

/**
 * Get performance metrics including ratings and response times
 */
export async function getPerformanceMetrics(
  providerId: string,
  period: TimePeriod = '30d'
): Promise<PerformanceMetrics> {
  const { start, end } = getDateRange(period);

  // Rating stats
  const ratingStats = await db
    .select({
      averageRating: avg(reviewsTable.rating).mapWith(Number),
      totalReviews: count(),
    })
    .from(reviewsTable)
    .innerJoin(bookingsTable, eq(reviewsTable.bookingId, bookingsTable.id))
    .where(
      and(
        eq(reviewsTable.providerId, providerId),
        eq(reviewsTable.isPublished, true),
        gte(bookingsTable.createdAt, start),
        lte(bookingsTable.createdAt, end)
      )
    );

  // Rating distribution
  const ratingDistribution = await db
    .select({
      rating: reviewsTable.rating,
      count: count(),
    })
    .from(reviewsTable)
    .innerJoin(bookingsTable, eq(reviewsTable.bookingId, bookingsTable.id))
    .where(
      and(
        eq(reviewsTable.providerId, providerId),
        eq(reviewsTable.isPublished, true),
        gte(bookingsTable.createdAt, start),
        lte(bookingsTable.createdAt, end)
      )
    )
    .groupBy(reviewsTable.rating)
    .orderBy(reviewsTable.rating);

  // Recent reviews
  const recentReviews = await db
    .select({
      rating: reviewsTable.rating,
      reviewText: reviewsTable.reviewText,
      customerId: reviewsTable.customerId,
      createdAt: reviewsTable.createdAt,
      serviceName: bookingsTable.serviceName,
    })
    .from(reviewsTable)
    .innerJoin(bookingsTable, eq(reviewsTable.bookingId, bookingsTable.id))
    .where(
      and(
        eq(reviewsTable.providerId, providerId),
        eq(reviewsTable.isPublished, true),
        gte(bookingsTable.createdAt, start),
        lte(bookingsTable.createdAt, end)
      )
    )
    .orderBy(desc(reviewsTable.createdAt))
    .limit(10);

  // Rating trends by month
  const ratingTrends = await db
    .select({
      month: sql<string>`TO_CHAR(${bookingsTable.createdAt}, 'YYYY-MM')`,
      averageRating: avg(reviewsTable.rating).mapWith(Number),
      reviewCount: count(),
    })
    .from(reviewsTable)
    .innerJoin(bookingsTable, eq(reviewsTable.bookingId, bookingsTable.id))
    .where(
      and(
        eq(reviewsTable.providerId, providerId),
        eq(reviewsTable.isPublished, true),
        gte(bookingsTable.createdAt, start),
        lte(bookingsTable.createdAt, end)
      )
    )
    .groupBy(sql`TO_CHAR(${bookingsTable.createdAt}, 'YYYY-MM')`)
    .orderBy(sql`TO_CHAR(${bookingsTable.createdAt}, 'YYYY-MM')`);

  // Response time analysis (time from booking creation to confirmation)
  const responseTimeData = await db
    .select({
      avgResponseTime: sql<number>`AVG(EXTRACT(EPOCH FROM (${bookingsTable.updatedAt} - ${bookingsTable.createdAt})) / 3600)`.mapWith(Number),
    })
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.providerId, providerId),
        eq(bookingsTable.status, 'confirmed'),
        gte(bookingsTable.createdAt, start),
        lte(bookingsTable.createdAt, end)
      )
    );

  const stats = ratingStats[0] || { averageRating: 0, totalReviews: 0 };
  const totalReviews = stats.totalReviews || 1;
  
  return {
    averageRating: stats.averageRating || 0,
    totalReviews: stats.totalReviews || 0,
    ratingDistribution: ratingDistribution.map(r => ({
      rating: r.rating,
      count: r.count,
      percentage: (r.count / totalReviews) * 100,
    })),
    responseTime: responseTimeData[0]?.avgResponseTime || 0,
    onTimeRate: 95, // TODO: Calculate based on booking times vs actual completion
    customerSatisfactionScore: stats.averageRating ? (stats.averageRating / 5) * 100 : 0,
    recentReviews: recentReviews.map(r => ({
      rating: r.rating,
      reviewText: r.reviewText || '',
      customerName: r.customerId, // TODO: Join with customer name when available
      createdAt: r.createdAt.toISOString().split('T')[0],
      serviceName: r.serviceName,
    })),
    ratingTrends: ratingTrends.map(t => ({
      month: t.month,
      averageRating: t.averageRating || 0,
      reviewCount: t.reviewCount || 0,
    })),
  };
}

/**
 * Get revenue breakdown by various dimensions
 */
export async function getRevenueBreakdown(
  providerId: string,
  period: TimePeriod = '30d'
): Promise<RevenueBreakdown> {
  const { start, end } = getDateRange(period);

  // Revenue by service
  const byService = await db
    .select({
      serviceName: bookingsTable.serviceName,
      bookings: count(),
      revenue: sum(bookingsTable.providerPayout).mapWith(Number),
      averagePrice: avg(bookingsTable.providerPayout).mapWith(Number),
    })
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.providerId, providerId),
        gte(bookingsTable.createdAt, start),
        lte(bookingsTable.createdAt, end),
        sql`${bookingsTable.status} IN ('completed', 'confirmed')`
      )
    )
    .groupBy(bookingsTable.serviceName)
    .orderBy(desc(sql`SUM(${bookingsTable.providerPayout})`));

  // Revenue by month
  const byMonth = await db
    .select({
      month: sql<string>`TO_CHAR(${bookingsTable.createdAt}, 'YYYY-MM')`,
      revenue: sum(bookingsTable.providerPayout).mapWith(Number),
      bookings: count(),
      averageValue: avg(bookingsTable.providerPayout).mapWith(Number),
    })
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.providerId, providerId),
        gte(bookingsTable.createdAt, start),
        lte(bookingsTable.createdAt, end),
        sql`${bookingsTable.status} IN ('completed', 'confirmed')`
      )
    )
    .groupBy(sql`TO_CHAR(${bookingsTable.createdAt}, 'YYYY-MM')`)
    .orderBy(sql`TO_CHAR(${bookingsTable.createdAt}, 'YYYY-MM')`);

  // Revenue by day of week
  const byDayOfWeek = await db
    .select({
      dayIndex: sql<number>`EXTRACT(DOW FROM ${bookingsTable.bookingDate})`.mapWith(Number),
      revenue: sum(bookingsTable.providerPayout).mapWith(Number),
      bookings: count(),
    })
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.providerId, providerId),
        gte(bookingsTable.createdAt, start),
        lte(bookingsTable.createdAt, end),
        sql`${bookingsTable.status} IN ('completed', 'confirmed')`
      )
    )
    .groupBy(sql`EXTRACT(DOW FROM ${bookingsTable.bookingDate})`)
    .orderBy(sql`EXTRACT(DOW FROM ${bookingsTable.bookingDate})`);

  // Revenue by time of day
  const byTimeOfDay = await db
    .select({
      hour: sql<number>`EXTRACT(HOUR FROM ${bookingsTable.bookingDate})`.mapWith(Number),
      revenue: sum(bookingsTable.providerPayout).mapWith(Number),
      bookings: count(),
    })
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.providerId, providerId),
        gte(bookingsTable.createdAt, start),
        lte(bookingsTable.createdAt, end),
        sql`${bookingsTable.status} IN ('completed', 'confirmed')`
      )
    )
    .groupBy(sql`EXTRACT(HOUR FROM ${bookingsTable.bookingDate})`)
    .orderBy(sql`EXTRACT(HOUR FROM ${bookingsTable.bookingDate})`);

  const totalRevenue = byService.reduce((sum, service) => sum + (service.revenue || 0), 0) || 1;

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return {
    byService: byService.map(s => ({
      serviceName: s.serviceName,
      bookings: s.bookings,
      revenue: s.revenue || 0,
      averagePrice: s.averagePrice || 0,
      percentage: ((s.revenue || 0) / totalRevenue) * 100,
    })),
    byMonth: byMonth.map(m => ({
      month: m.month,
      revenue: m.revenue || 0,
      bookings: m.bookings,
      averageValue: m.averageValue || 0,
    })),
    byDayOfWeek: byDayOfWeek.map(d => ({
      dayName: dayNames[d.dayIndex] || 'Unknown',
      dayIndex: d.dayIndex,
      revenue: d.revenue || 0,
      bookings: d.bookings,
    })),
    byTimeOfDay: byTimeOfDay.map(t => ({
      hour: t.hour,
      revenue: t.revenue || 0,
      bookings: t.bookings,
    })),
  };
}

/**
 * Get top performing services analysis
 */
export async function getTopServices(
  providerId: string,
  period: TimePeriod = '30d'
): Promise<TopServices> {
  const { start, end } = getDateRange(period);

  // Services with booking count, revenue, and ratings
  const serviceStats = await db
    .select({
      serviceName: bookingsTable.serviceName,
      bookings: count(),
      revenue: sum(bookingsTable.providerPayout).mapWith(Number),
      averagePrice: avg(bookingsTable.providerPayout).mapWith(Number),
      averageRating: avg(reviewsTable.rating).mapWith(Number),
      reviewCount: sql<number>`COUNT(${reviewsTable.rating})`.mapWith(Number),
    })
    .from(bookingsTable)
    .leftJoin(reviewsTable, and(
      eq(reviewsTable.bookingId, bookingsTable.id),
      eq(reviewsTable.isPublished, true)
    ))
    .where(
      and(
        eq(bookingsTable.providerId, providerId),
        gte(bookingsTable.createdAt, start),
        lte(bookingsTable.createdAt, end),
        sql`${bookingsTable.status} IN ('completed', 'confirmed')`
      )
    )
    .groupBy(bookingsTable.serviceName)
    .orderBy(desc(count()));

  const mostBooked = [...serviceStats]
    .sort((a, b) => b.bookings - a.bookings)
    .slice(0, 10)
    .map(s => ({
      serviceName: s.serviceName,
      bookings: s.bookings,
      revenue: s.revenue || 0,
      averageRating: s.averageRating || 0,
      averagePrice: s.averagePrice || 0,
    }));

  const highestRevenue = [...serviceStats]
    .sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
    .slice(0, 10)
    .map(s => ({
      serviceName: s.serviceName,
      revenue: s.revenue || 0,
      bookings: s.bookings,
      averagePrice: s.averagePrice || 0,
      profitMargin: 90, // 90% after 10% platform fee
    }));

  const bestRated = [...serviceStats]
    .filter(s => (s.reviewCount || 0) >= 3) // Minimum 3 reviews for reliability
    .sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0))
    .slice(0, 10)
    .map(s => ({
      serviceName: s.serviceName,
      averageRating: s.averageRating || 0,
      reviewCount: s.reviewCount || 0,
      bookings: s.bookings,
      revenue: s.revenue || 0,
    }));

  return {
    mostBooked,
    highestRevenue,
    bestRated,
  };
}