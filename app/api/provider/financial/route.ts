import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db/db';
import { 
  transactionsTable, 
  bookingsTable, 
  providersTable,
  payoutSchedulesTable 
} from '@/db/schema';
import { eq, and, gte, lte, desc, sql, sum, count } from 'drizzle-orm';
import { z } from 'zod';

// Request validation schemas
const dashboardQuerySchema = z.object({
  providerId: z.string().uuid().optional(),
  period: z.enum(['today', 'week', 'month', 'quarter', 'year', 'custom']).default('month'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  currency: z.string().default('USD'),
});

const payoutHistoryQuerySchema = z.object({
  providerId: z.string().uuid(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  status: z.enum(['all', 'pending', 'completed', 'failed']).optional(),
});

/**
 * GET /api/provider/financial
 * Get financial dashboard data for a provider
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const params = dashboardQuerySchema.parse({
      providerId: searchParams.get('providerId') || undefined,
      period: searchParams.get('period') || 'month',
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      currency: searchParams.get('currency') || 'USD',
    });

    // Get provider ID if not provided
    let providerId = params.providerId;
    if (!providerId) {
      const [provider] = await db
        .select({ id: providersTable.id })
        .from(providersTable)
        .where(eq(providersTable.userId, userId))
        .limit(1);
      
      if (!provider) {
        return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
      }
      providerId = provider.id;
    }

    // Calculate date range based on period
    const { startDate, endDate } = calculateDateRange(params.period, params.startDate, params.endDate);

    // Fetch financial metrics
    const [metrics] = await db
      .select({
        totalRevenue: sum(transactionsTable.providerPayout),
        totalFees: sum(transactionsTable.platformFee),
        totalRefunds: sum(transactionsTable.refundAmount),
        transactionCount: count(transactionsTable.id),
      })
      .from(transactionsTable)
      .leftJoin(bookingsTable, eq(transactionsTable.bookingId, bookingsTable.id))
      .where(
        and(
          eq(bookingsTable.providerId, providerId),
          eq(transactionsTable.status, 'completed'),
          gte(transactionsTable.createdAt, startDate),
          lte(transactionsTable.createdAt, endDate),
          eq(sql`COALESCE(${transactionsTable.currency}, 'USD')`, params.currency)
        )
      );

    // Fetch recent transactions
    const recentTransactions = await db
      .select({
        id: transactionsTable.id,
        bookingId: transactionsTable.bookingId,
        amount: transactionsTable.amount,
        platformFee: transactionsTable.platformFee,
        providerPayout: transactionsTable.providerPayout,
        refundAmount: transactionsTable.refundAmount,
        currency: sql<string>`COALESCE(${transactionsTable.currency}, 'USD')`,
        status: transactionsTable.status,
        createdAt: transactionsTable.createdAt,
        booking: {
          serviceName: bookingsTable.serviceName,
          bookingDate: bookingsTable.bookingDate,
          customerNotes: bookingsTable.customerNotes,
        },
      })
      .from(transactionsTable)
      .leftJoin(bookingsTable, eq(transactionsTable.bookingId, bookingsTable.id))
      .where(
        and(
          eq(bookingsTable.providerId, providerId),
          gte(transactionsTable.createdAt, startDate),
          lte(transactionsTable.createdAt, endDate)
        )
      )
      .orderBy(desc(transactionsTable.createdAt))
      .limit(10);

    // Fetch pending payouts
    const pendingPayouts = await db
      .select({
        id: payoutSchedulesTable.id,
        amount: payoutSchedulesTable.netPayout,
        currency: payoutSchedulesTable.currency,
        scheduledAt: payoutSchedulesTable.scheduledAt,
        status: payoutSchedulesTable.status,
      })
      .from(payoutSchedulesTable)
      .where(
        and(
          eq(payoutSchedulesTable.providerId, providerId),
          eq(payoutSchedulesTable.status, 'scheduled')
        )
      )
      .orderBy(payoutSchedulesTable.scheduledAt);

    // Calculate daily revenue for chart
    const dailyRevenue = await db
      .select({
        date: sql<string>`DATE(${transactionsTable.createdAt})`,
        revenue: sum(transactionsTable.providerPayout),
        fees: sum(transactionsTable.platformFee),
        count: count(transactionsTable.id),
      })
      .from(transactionsTable)
      .leftJoin(bookingsTable, eq(transactionsTable.bookingId, bookingsTable.id))
      .where(
        and(
          eq(bookingsTable.providerId, providerId),
          eq(transactionsTable.status, 'completed'),
          gte(transactionsTable.createdAt, startDate),
          lte(transactionsTable.createdAt, endDate)
        )
      )
      .groupBy(sql`DATE(${transactionsTable.createdAt})`)
      .orderBy(sql`DATE(${transactionsTable.createdAt})`);

    // Fetch tax information if applicable
    const taxInfo = await getTaxInfo(providerId, startDate, endDate);

    // Calculate key performance indicators
    const kpis = calculateKPIs(metrics, recentTransactions);

    return NextResponse.json({
      providerId,
      period: params.period,
      dateRange: { startDate, endDate },
      metrics: {
        totalRevenue: parseFloat(metrics.totalRevenue || '0'),
        totalFees: parseFloat(metrics.totalFees || '0'),
        netEarnings: parseFloat(metrics.totalRevenue || '0') - parseFloat(metrics.totalFees || '0'),
        totalRefunds: parseFloat(metrics.totalRefunds || '0'),
        transactionCount: parseInt(metrics.transactionCount || '0'),
        currency: params.currency,
      },
      kpis,
      recentTransactions,
      pendingPayouts,
      dailyRevenue,
      taxInfo,
    });

  } catch (error) {
    console.error('Error fetching provider financial data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch financial data' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/provider/financial/payouts
 * Get payout history for a provider
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const params = payoutHistoryQuerySchema.parse(body);

    // Verify provider ownership
    const [provider] = await db
      .select({ id: providersTable.id })
      .from(providersTable)
      .where(
        and(
          eq(providersTable.id, params.providerId),
          eq(providersTable.userId, userId)
        )
      )
      .limit(1);
    
    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }

    // Build query conditions
    const conditions = [eq(payoutSchedulesTable.providerId, params.providerId)];
    if (params.status && params.status !== 'all') {
      conditions.push(eq(payoutSchedulesTable.status, params.status));
    }

    // Fetch payout history
    const payouts = await db
      .select({
        id: payoutSchedulesTable.id,
        bookingId: payoutSchedulesTable.bookingId,
        amount: payoutSchedulesTable.amount,
        platformFee: payoutSchedulesTable.platformFee,
        netPayout: payoutSchedulesTable.netPayout,
        currency: payoutSchedulesTable.currency,
        status: payoutSchedulesTable.status,
        scheduledAt: payoutSchedulesTable.scheduledAt,
        processedAt: payoutSchedulesTable.processedAt,
        stripePayoutId: payoutSchedulesTable.stripePayoutId,
        failureReason: payoutSchedulesTable.failureReason,
        createdAt: payoutSchedulesTable.createdAt,
      })
      .from(payoutSchedulesTable)
      .where(and(...conditions))
      .orderBy(desc(payoutSchedulesTable.scheduledAt))
      .limit(params.limit)
      .offset(params.offset);

    // Get total count for pagination
    const [{ totalCount }] = await db
      .select({ totalCount: count(payoutSchedulesTable.id) })
      .from(payoutSchedulesTable)
      .where(and(...conditions));

    // Calculate summary statistics
    const [stats] = await db
      .select({
        totalPaid: sum(sql`CASE WHEN status = 'completed' THEN net_payout ELSE 0 END`),
        totalPending: sum(sql`CASE WHEN status = 'scheduled' THEN net_payout ELSE 0 END`),
        totalFailed: sum(sql`CASE WHEN status = 'failed' THEN net_payout ELSE 0 END`),
      })
      .from(payoutSchedulesTable)
      .where(eq(payoutSchedulesTable.providerId, params.providerId));

    return NextResponse.json({
      payouts,
      pagination: {
        total: parseInt(totalCount || '0'),
        limit: params.limit,
        offset: params.offset,
        hasMore: params.offset + params.limit < parseInt(totalCount || '0'),
      },
      summary: {
        totalPaid: parseFloat(stats.totalPaid || '0'),
        totalPending: parseFloat(stats.totalPending || '0'),
        totalFailed: parseFloat(stats.totalFailed || '0'),
      },
    });

  } catch (error) {
    console.error('Error fetching payout history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payout history' },
      { status: 500 }
    );
  }
}

// Helper functions

function calculateDateRange(period: string, customStart?: string, customEnd?: string) {
  const now = new Date();
  let startDate: Date;
  let endDate: Date = new Date();

  switch (period) {
    case 'today':
      startDate = new Date(now.setHours(0, 0, 0, 0));
      break;
    case 'week':
      startDate = new Date(now.setDate(now.getDate() - 7));
      break;
    case 'month':
      startDate = new Date(now.setMonth(now.getMonth() - 1));
      break;
    case 'quarter':
      startDate = new Date(now.setMonth(now.getMonth() - 3));
      break;
    case 'year':
      startDate = new Date(now.setFullYear(now.getFullYear() - 1));
      break;
    case 'custom':
      startDate = customStart ? new Date(customStart) : new Date(now.setMonth(now.getMonth() - 1));
      endDate = customEnd ? new Date(customEnd) : new Date();
      break;
    default:
      startDate = new Date(now.setMonth(now.getMonth() - 1));
  }

  return { startDate, endDate };
}

function calculateKPIs(metrics: any, transactions: any[]) {
  const revenue = parseFloat(metrics.totalRevenue || '0');
  const fees = parseFloat(metrics.totalFees || '0');
  const count = parseInt(metrics.transactionCount || '0');

  return {
    averageTransactionValue: count > 0 ? revenue / count : 0,
    platformFeeRate: revenue > 0 ? (fees / revenue) * 100 : 0,
    netMargin: revenue > 0 ? ((revenue - fees) / revenue) * 100 : 0,
    completionRate: calculateCompletionRate(transactions),
  };
}

function calculateCompletionRate(transactions: any[]) {
  if (transactions.length === 0) return 100;
  const completed = transactions.filter(t => t.status === 'completed').length;
  return (completed / transactions.length) * 100;
}

async function getTaxInfo(providerId: string, startDate: Date, endDate: Date) {
  // Query tax calculations for the period
  const taxData = await db
    .select({
      totalTax: sum(sql`tax_amount`),
      taxCount: count(sql`id`),
    })
    .from(sql`tax_calculations`)
    .leftJoin(bookingsTable, eq(sql`tax_calculations.booking_id`, bookingsTable.id))
    .where(
      and(
        eq(bookingsTable.providerId, providerId),
        gte(sql`tax_calculations.created_at`, startDate),
        lte(sql`tax_calculations.created_at`, endDate)
      )
    );

  return {
    totalTaxCollected: parseFloat(taxData[0]?.totalTax || '0'),
    taxTransactions: parseInt(taxData[0]?.taxCount || '0'),
  };
}