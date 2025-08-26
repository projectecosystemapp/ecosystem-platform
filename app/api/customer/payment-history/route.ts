/**
 * Customer Payment History API
 * 
 * Provides payment history and transaction details for authenticated customers
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
import { eq, desc, and } from "drizzle-orm";
import { withRateLimitRedis } from "@/lib/rate-limit-redis";

// Query parameters schema
const paymentHistorySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  status: z.enum(['all', 'completed', 'pending', 'refunded', 'failed']).default('all'),
});

interface PaymentRecord {
  id: string;
  bookingId: string;
  serviceName: string;
  providerName: string;
  amount: string;
  platformFee: string;
  status: string;
  paymentDate: Date;
  refundAmount?: string;
  refundDate?: Date;
  stripeChargeId: string;
  confirmationCode: string;
  isGuestBooking: boolean;
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

      // Get customer profile
      const [customer] = await db
        .select({ id: profilesTable.id, role: profilesTable.role })
        .from(profilesTable)
        .where(eq(profilesTable.userId, userId))
        .limit(1);

      if (!customer) {
        return NextResponse.json(
          { error: "Customer profile not found" },
          { status: 404 }
        );
      }

      // Parse query parameters
      const url = new URL(req.url);
      const queryParams = {
        limit: url.searchParams.get('limit'),
        offset: url.searchParams.get('offset'),
        status: url.searchParams.get('status') || 'all',
      };

      const validatedParams = paymentHistorySchema.parse(queryParams);

      // Build status filter
      let statusFilter;
      if (validatedParams.status !== 'all') {
        statusFilter = eq(transactionsTable.status, validatedParams.status);
      }

      // Fetch payment history with booking details
      const paymentHistory = await db
        .select({
          transaction: {
            id: transactionsTable.id,
            bookingId: transactionsTable.bookingId,
            amount: transactionsTable.amount,
            platformFee: transactionsTable.platformFee,
            status: transactionsTable.status,
            stripeChargeId: transactionsTable.stripeChargeId,
            refundAmount: transactionsTable.refundAmount,
            refundedAt: transactionsTable.refundedAt,
            createdAt: transactionsTable.createdAt,
          },
          booking: {
            id: bookingsTable.id,
            serviceName: bookingsTable.serviceName,
            confirmationCode: bookingsTable.confirmationCode,
            isGuestBooking: bookingsTable.isGuestBooking,
            bookingDate: bookingsTable.bookingDate,
            startTime: bookingsTable.startTime,
            metadata: bookingsTable.metadata,
          }
        })
        .from(transactionsTable)
        .leftJoin(bookingsTable, eq(transactionsTable.bookingId, bookingsTable.id))
        .where(
          and(
            eq(bookingsTable.customerId, customer.id),
            statusFilter
          )
        )
        .orderBy(desc(transactionsTable.createdAt))
        .limit(validatedParams.limit)
        .offset(validatedParams.offset);

      // Transform to payment records
      const paymentRecords: PaymentRecord[] = paymentHistory.map(record => ({
        id: record.transaction.id,
        bookingId: record.transaction.bookingId,
        serviceName: record.booking?.serviceName || 'Service',
        providerName: record.booking?.metadata?.providerBusinessName || 
                      record.booking?.metadata?.providerName || 
                      'Provider',
        amount: record.transaction.amount,
        platformFee: record.transaction.platformFee,
        status: record.transaction.status,
        paymentDate: record.transaction.createdAt,
        refundAmount: record.transaction.refundAmount || undefined,
        refundDate: record.transaction.refundedAt || undefined,
        stripeChargeId: record.transaction.stripeChargeId,
        confirmationCode: record.booking?.confirmationCode || '',
        isGuestBooking: record.booking?.isGuestBooking || false,
      }));

      // Calculate summary statistics
      const totalPaid = paymentRecords
        .filter(p => p.status === 'completed' || p.status === 'confirmed')
        .reduce((sum, p) => sum + parseFloat(p.amount), 0);

      const totalRefunded = paymentRecords
        .filter(p => p.refundAmount)
        .reduce((sum, p) => sum + parseFloat(p.refundAmount || '0'), 0);

      const platformFeesPaid = paymentRecords
        .filter(p => p.status === 'completed' || p.status === 'confirmed')
        .reduce((sum, p) => sum + parseFloat(p.platformFee), 0);

      // Count by status
      const statusCounts = paymentRecords.reduce((counts, record) => {
        counts[record.status] = (counts[record.status] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);

      return NextResponse.json({
        success: true,
        payments: paymentRecords,
        pagination: {
          limit: validatedParams.limit,
          offset: validatedParams.offset,
          total: paymentRecords.length,
          hasMore: paymentRecords.length === validatedParams.limit,
        },
        summary: {
          totalTransactions: paymentRecords.length,
          totalPaid: totalPaid.toFixed(2),
          totalRefunded: totalRefunded.toFixed(2),
          platformFeesPaid: platformFeesPaid.toFixed(2),
          netSpent: (totalPaid - totalRefunded).toFixed(2),
          statusBreakdown: statusCounts,
        },
      });

    } catch (error) {
      console.error("Error fetching payment history:", error);
      
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Invalid query parameters", details: error.errors },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: "Failed to fetch payment history" },
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