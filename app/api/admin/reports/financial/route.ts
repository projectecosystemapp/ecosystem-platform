/**
 * Financial Reports API
 * 
 * Provides financial metrics and reports for platform administration
 * Includes revenue, transaction volumes, refunds, and provider payouts
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/db/db";
import { 
  bookingsTable, 
  transactionsTable, 
  profilesTable 
} from "@/db/schema/enhanced-booking-schema";
import { eq, gte, lte, and, sql, desc, count, sum } from "drizzle-orm";
import { withRateLimitRedis } from "@/lib/rate-limit-redis";
import { 
  calculatePlatformRevenue, 
  calculateProviderEarnings,
  formatCentsToDisplay 
} from "@/lib/payments/fee-calculator";

// Query parameters schema
const financialReportSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  period: z.enum(['today', 'week', 'month', 'quarter', 'year', 'custom']).default('month'),
  includeRefunds: z.boolean().default(true),
  includeProjections: z.boolean().default(false),
  groupBy: z.enum(['day', 'week', 'month']).default('day'),
});

interface FinancialMetrics {
  // Revenue Metrics
  totalRevenue: number;
  platformCommissions: number;
  guestSurcharges: number;
  
  // Transaction Metrics
  totalTransactions: number;
  averageTransactionValue: number;
  guestTransactions: number;
  authenticatedTransactions: number;
  
  // Provider Metrics
  totalProviderPayouts: number;
  activeProviders: number;
  
  // Refund Metrics
  totalRefunds: number;
  refundAmount: number;
  refundRate: number;
  
  // Growth Metrics
  revenueGrowth: number;
  transactionGrowth: number;
}

interface PeriodBreakdown {
  period: string;
  revenue: number;
  transactions: number;
  refunds: number;
  providerPayouts: number;
}

export const GET = withRateLimitRedis(
  { type: "api" },
  async (req: NextRequest) => {
    try {
      const { userId } = await auth();
      
      if (!userId) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        );
      }

      // Check if user has admin privileges (you'll need to implement admin role check)
      const [userProfile] = await db
        .select({ role: profilesTable.role })
        .from(profilesTable)
        .where(eq(profilesTable.userId, userId))
        .limit(1);

      if (!userProfile || userProfile.role !== 'admin') {
        return NextResponse.json(
          { error: "Admin privileges required" },
          { status: 403 }
        );
      }

      // Parse query parameters
      const url = new URL(req.url);
      const queryParams = {
        startDate: url.searchParams.get('startDate'),
        endDate: url.searchParams.get('endDate'),
        period: url.searchParams.get('period') || 'month',
        includeRefunds: url.searchParams.get('includeRefunds') === 'true',
        includeProjections: url.searchParams.get('includeProjections') === 'true',
        groupBy: url.searchParams.get('groupBy') || 'day',
      };

      const validatedParams = financialReportSchema.parse(queryParams);

      // Calculate date range based on period
      let startDate: Date;
      let endDate: Date = new Date();

      switch (validatedParams.period) {
        case 'today':
          startDate = new Date();
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate = new Date();
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'quarter':
          startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 3);
          break;
        case 'year':
          startDate = new Date();
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        case 'custom':
          startDate = validatedParams.startDate ? new Date(validatedParams.startDate) : new Date();
          endDate = validatedParams.endDate ? new Date(validatedParams.endDate) : new Date();
          break;
        default:
          startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 1);
      }

      // Fetch booking data for the period
      const bookings = await db
        .select({
          id: bookingsTable.id,
          status: bookingsTable.status,
          totalAmount: bookingsTable.totalAmount,
          platformFee: bookingsTable.platformFee,
          providerPayout: bookingsTable.providerPayout,
          isGuestBooking: bookingsTable.isGuestBooking,
          createdAt: bookingsTable.createdAt,
          bookingDate: bookingsTable.bookingDate,
          servicePrice: bookingsTable.servicePrice,
        })
        .from(bookingsTable)
        .where(
          and(
            gte(bookingsTable.createdAt, startDate),
            lte(bookingsTable.createdAt, endDate),
            sql`${bookingsTable.status} IN ('completed', 'confirmed', 'pending')`
          )
        )
        .orderBy(desc(bookingsTable.createdAt));

      // Fetch transaction data
      const transactions = await db
        .select({
          id: transactionsTable.id,
          bookingId: transactionsTable.bookingId,
          amount: transactionsTable.amount,
          platformFee: transactionsTable.platformFee,
          providerPayout: transactionsTable.providerPayout,
          status: transactionsTable.status,
          refundAmount: transactionsTable.refundAmount,
          createdAt: transactionsTable.createdAt,
        })
        .from(transactionsTable)
        .where(
          and(
            gte(transactionsTable.createdAt, startDate),
            lte(transactionsTable.createdAt, endDate)
          )
        );

      // Calculate financial metrics
      const completedBookings = bookings.filter(b => 
        ['completed', 'confirmed'].includes(b.status)
      );

      // Transform to fee calculator format
      const transactionData = completedBookings.map(booking => ({
        baseAmountCents: Math.round(parseFloat(booking.servicePrice) * 100),
        isGuest: booking.isGuestBooking,
        providerCommissionRate: 0.10, // Default 10%
      }));

      // Calculate platform revenue
      const platformRevenue = calculatePlatformRevenue(transactionData);
      
      // Calculate provider earnings
      const providerEarnings = calculateProviderEarnings(transactionData);

      // Calculate refund metrics
      const refundedTransactions = transactions.filter(t => t.refundAmount && parseFloat(t.refundAmount) > 0);
      const totalRefundAmount = refundedTransactions.reduce(
        (sum, t) => sum + parseFloat(t.refundAmount || '0'), 
        0
      );

      // Build metrics object
      const metrics: FinancialMetrics = {
        totalRevenue: platformRevenue.totalRevenueCents / 100,
        platformCommissions: platformRevenue.totalFeeCents / 100,
        guestSurcharges: platformRevenue.totalSurchargeCents / 100,
        
        totalTransactions: completedBookings.length,
        averageTransactionValue: completedBookings.length > 0 
          ? completedBookings.reduce((sum, b) => sum + parseFloat(b.totalAmount), 0) / completedBookings.length 
          : 0,
        guestTransactions: platformRevenue.guestTransactionCount,
        authenticatedTransactions: platformRevenue.authenticatedTransactionCount,
        
        totalProviderPayouts: providerEarnings.totalPayoutCents / 100,
        activeProviders: new Set(completedBookings.map(b => b.id)).size, // Approximate
        
        totalRefunds: refundedTransactions.length,
        refundAmount: totalRefundAmount,
        refundRate: completedBookings.length > 0 ? (refundedTransactions.length / completedBookings.length) * 100 : 0,
        
        revenueGrowth: 0, // Would need previous period data
        transactionGrowth: 0, // Would need previous period data
      };

      // Create period breakdown
      const periodBreakdown: PeriodBreakdown[] = [];
      
      // Group by day/week/month based on groupBy parameter
      const groupedData = new Map<string, {
        revenue: number;
        transactions: number;
        refunds: number;
        providerPayouts: number;
      }>();

      completedBookings.forEach(booking => {
        const date = new Date(booking.createdAt);
        let key: string;

        switch (validatedParams.groupBy) {
          case 'day':
            key = date.toISOString().split('T')[0];
            break;
          case 'week':
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            key = weekStart.toISOString().split('T')[0];
            break;
          case 'month':
            key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            break;
          default:
            key = date.toISOString().split('T')[0];
        }

        const existing = groupedData.get(key) || {
          revenue: 0,
          transactions: 0,
          refunds: 0,
          providerPayouts: 0,
        };

        existing.revenue += parseFloat(booking.platformFee);
        existing.transactions += 1;
        existing.providerPayouts += parseFloat(booking.providerPayout);

        // Check if this booking was refunded
        const refund = refundedTransactions.find(r => r.bookingId === booking.id);
        if (refund) {
          existing.refunds += parseFloat(refund.refundAmount || '0');
        }

        groupedData.set(key, existing);
      });

      // Convert to array and sort
      for (const [period, data] of Array.from(groupedData.entries()).sort()) {
        periodBreakdown.push({
          period,
          ...data,
        });
      }

      return NextResponse.json({
        success: true,
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          type: validatedParams.period,
        },
        metrics,
        breakdown: periodBreakdown,
        summary: {
          totalBookings: bookings.length,
          completedBookings: completedBookings.length,
          pendingBookings: bookings.filter(b => b.status === 'pending').length,
          cancelledBookings: bookings.filter(b => b.status === 'cancelled').length,
          averageOrderValue: metrics.averageTransactionValue,
          guestVsAuthRatio: metrics.totalTransactions > 0 
            ? (metrics.guestTransactions / metrics.totalTransactions) * 100 
            : 0,
        },
        displayAmounts: {
          totalRevenue: formatCentsToDisplay(platformRevenue.totalRevenueCents),
          platformCommissions: formatCentsToDisplay(platformRevenue.totalFeeCents),
          guestSurcharges: formatCentsToDisplay(platformRevenue.totalSurchargeCents),
          totalProviderPayouts: formatCentsToDisplay(providerEarnings.totalPayoutCents),
          totalRefunds: formatCentsToDisplay(Math.round(totalRefundAmount * 100)),
        },
      });

    } catch (error) {
      console.error("Error generating financial report:", error);
      
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Invalid query parameters", details: error.errors },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: "Failed to generate financial report" },
        { status: 500 }
      );
    }
  }
);

// OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}