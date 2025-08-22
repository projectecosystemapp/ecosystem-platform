/**
 * Payout Service
 * 
 * Handles automated payout scheduling, escrow management, and provider payment processing
 * with proper error handling and retry logic.
 */

import { db } from "@/db/db";
import { 
  payoutSchedulesTable,
  bookingsTable,
  providersTable,
  bookingStateTransitionsTable,
  BookingStatus,
  type PayoutSchedule,
  type NewPayoutSchedule
} from "@/db/schema/enhanced-booking-schema";
import { eq, and, lte, gte, inArray, or, isNull } from "drizzle-orm";
import { createTransferWithIdempotency } from "@/lib/stripe-enhanced";
import Stripe from "stripe";

export interface PayoutRequest {
  bookingId: string;
  providerId: string;
  amount: number;
  platformFee: number;
  netPayout: number;
  escrowDays?: number;
  currency?: string;
}

export interface PayoutProcessingResult {
  success: boolean;
  payoutId: string;
  stripeTransferId?: string;
  error?: string;
  retryable?: boolean;
}

export interface PayoutStats {
  totalScheduled: number;
  totalProcessing: number;
  totalCompleted: number;
  totalFailed: number;
  totalValue: number;
  avgProcessingTime?: number;
}

export class PayoutService {
  private readonly DEFAULT_ESCROW_DAYS = 7;
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_BACKOFF_HOURS = [1, 6, 24]; // Hours to wait between retries

  /**
   * Schedule a payout for a completed booking
   */
  async schedulePayoutForBooking(request: PayoutRequest): Promise<PayoutSchedule> {
    const escrowDays = request.escrowDays || this.DEFAULT_ESCROW_DAYS;
    const scheduledAt = new Date();
    scheduledAt.setDate(scheduledAt.getDate() + escrowDays);

    // Verify the booking exists and is in a payable state
    const [booking] = await db
      .select()
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.id, request.bookingId),
          eq(bookingsTable.providerId, request.providerId),
          eq(bookingsTable.status, BookingStatus.COMPLETED)
        )
      )
      .limit(1);

    if (!booking) {
      throw new Error('Booking not found or not in payable state');
    }

    // Check if payout already scheduled
    const [existingPayout] = await db
      .select()
      .from(payoutSchedulesTable)
      .where(eq(payoutSchedulesTable.bookingId, request.bookingId))
      .limit(1);

    if (existingPayout) {
      throw new Error('Payout already scheduled for this booking');
    }

    // Create payout schedule
    const [payout] = await db
      .insert(payoutSchedulesTable)
      .values({
        bookingId: request.bookingId,
        providerId: request.providerId,
        amount: request.amount,
        currency: request.currency || 'usd',
        platformFee: request.platformFee,
        netPayout: request.netPayout,
        scheduledAt,
        status: 'scheduled'
      })
      .returning();

    // Log the scheduling
    await this.logPayoutEvent(payout.id, 'payout_scheduled', {
      bookingId: request.bookingId,
      providerId: request.providerId,
      scheduledAt: scheduledAt.toISOString(),
      escrowDays
    });

    return payout;
  }

  /**
   * Process all due payouts (typically called by a cron job)
   */
  async processDuePayouts(batchSize: number = 50): Promise<PayoutProcessingResult[]> {
    const duePayouts = await db
      .select({
        payout: payoutSchedulesTable,
        provider: providersTable,
        booking: bookingsTable
      })
      .from(payoutSchedulesTable)
      .leftJoin(providersTable, eq(payoutSchedulesTable.providerId, providersTable.id))
      .leftJoin(bookingsTable, eq(payoutSchedulesTable.bookingId, bookingsTable.id))
      .where(
        and(
          eq(payoutSchedulesTable.status, 'scheduled'),
          lte(payoutSchedulesTable.scheduledAt, new Date())
        )
      )
      .limit(batchSize);

    const results: PayoutProcessingResult[] = [];

    for (const { payout, provider, booking } of duePayouts) {
      if (!provider || !booking) {
        console.error(`Missing provider or booking data for payout ${payout.id}`);
        continue;
      }

      try {
        const result = await this.processSinglePayout(payout, provider, booking);
        results.push(result);
      } catch (error) {
        console.error(`Error processing payout ${payout.id}:`, error);
        results.push({
          success: false,
          payoutId: payout.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          retryable: this.isRetryableError(error)
        });
      }
    }

    return results;
  }

  /**
   * Process failed payouts that are ready for retry
   */
  async processFailedPayouts(): Promise<PayoutProcessingResult[]> {
    const retryablePayouts = await db
      .select({
        payout: payoutSchedulesTable,
        provider: providersTable,
        booking: bookingsTable
      })
      .from(payoutSchedulesTable)
      .leftJoin(providersTable, eq(payoutSchedulesTable.providerId, providersTable.id))
      .leftJoin(bookingsTable, eq(payoutSchedulesTable.bookingId, bookingsTable.id))
      .where(
        and(
          eq(payoutSchedulesTable.status, 'failed'),
          lte(payoutSchedulesTable.retryCount, this.MAX_RETRY_ATTEMPTS - 1),
          // Calculate next retry time based on retry count
          lte(
            payoutSchedulesTable.scheduledAt,
            new Date(Date.now() - this.getRetryDelayMs(0))
          )
        )
      )
      .limit(25);

    const results: PayoutProcessingResult[] = [];

    for (const { payout, provider, booking } of retryablePayouts) {
      if (!provider || !booking) continue;

      // Check if enough time has passed for retry
      const retryDelay = this.getRetryDelayMs(payout.retryCount);
      const lastAttempt = payout.updatedAt || payout.createdAt;
      const nextRetryTime = new Date(lastAttempt.getTime() + retryDelay);

      if (new Date() < nextRetryTime) {
        continue; // Not ready for retry yet
      }

      try {
        const result = await this.processSinglePayout(payout, provider, booking, true);
        results.push(result);
      } catch (error) {
        console.error(`Error retrying payout ${payout.id}:`, error);
        await this.handlePayoutFailure(payout, error, true);
      }
    }

    return results;
  }

  /**
   * Get payout statistics for a provider
   */
  async getProviderPayoutStats(
    providerId: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<PayoutStats> {
    let conditions = [eq(payoutSchedulesTable.providerId, providerId)];

    if (dateRange) {
      conditions.push(
        and(
          gte(payoutSchedulesTable.createdAt, dateRange.start),
          lte(payoutSchedulesTable.createdAt, dateRange.end)
        )
      );
    }

    const payouts = await db
      .select()
      .from(payoutSchedulesTable)
      .where(and(...conditions));

    const stats = payouts.reduce(
      (acc, payout) => {
        switch (payout.status) {
          case 'scheduled':
            acc.totalScheduled++;
            break;
          case 'processing':
            acc.totalProcessing++;
            break;
          case 'completed':
            acc.totalCompleted++;
            acc.totalValue += Number(payout.netPayout);
            break;
          case 'failed':
            acc.totalFailed++;
            break;
        }
        return acc;
      },
      {
        totalScheduled: 0,
        totalProcessing: 0,
        totalCompleted: 0,
        totalFailed: 0,
        totalValue: 0
      }
    );

    return stats;
  }

  /**
   * Get detailed payout history for a provider
   */
  async getProviderPayouts(
    providerId: string,
    status?: ('scheduled' | 'processing' | 'completed' | 'failed' | 'cancelled')[],
    limit: number = 20,
    offset: number = 0
  ): Promise<any[]> {
    let conditions = [eq(payoutSchedulesTable.providerId, providerId)];

    if (status && status.length > 0) {
      conditions.push(inArray(payoutSchedulesTable.status, status));
    }

    return await db
      .select({
        payout: payoutSchedulesTable,
        booking: bookingsTable
      })
      .from(payoutSchedulesTable)
      .leftJoin(bookingsTable, eq(payoutSchedulesTable.bookingId, bookingsTable.id))
      .where(and(...conditions))
      .orderBy(payoutSchedulesTable.createdAt)
      .limit(limit)
      .offset(offset);
  }

  /**
   * Cancel a scheduled payout (before processing)
   */
  async cancelPayout(
    payoutId: string,
    reason: string,
    cancelledBy: string
  ): Promise<void> {
    const [payout] = await db
      .select()
      .from(payoutSchedulesTable)
      .where(eq(payoutSchedulesTable.id, payoutId))
      .limit(1);

    if (!payout) {
      throw new Error('Payout not found');
    }

    if (payout.status !== 'scheduled') {
      throw new Error(`Cannot cancel payout with status: ${payout.status}`);
    }

    await db
      .update(payoutSchedulesTable)
      .set({
        status: 'cancelled',
        failureReason: reason
      })
      .where(eq(payoutSchedulesTable.id, payoutId));

    await this.logPayoutEvent(payoutId, 'payout_cancelled', {
      reason,
      cancelledBy
    });
  }

  /**
   * Private helper methods
   */

  private async processSinglePayout(
    payout: PayoutSchedule,
    provider: any,
    booking: any,
    isRetry: boolean = false
  ): Promise<PayoutProcessingResult> {
    // Update status to processing
    await db
      .update(payoutSchedulesTable)
      .set({ 
        status: 'processing',
        ...(isRetry && { retryCount: payout.retryCount + 1 })
      })
      .where(eq(payoutSchedulesTable.id, payout.id));

    try {
      // Verify provider has Stripe Connect account
      if (!provider.stripeConnectAccountId) {
        throw new Error('Provider does not have a Stripe Connect account');
      }

      // Create Stripe transfer
      const transfer = await createTransferWithIdempotency({
        amount: Math.round(Number(payout.netPayout) * 100), // Convert to cents
        currency: payout.currency,
        destination: provider.stripeConnectAccountId,
        description: `Payout for booking ${payout.bookingId}`,
        metadata: {
          payoutId: payout.id,
          bookingId: payout.bookingId,
          providerId: payout.providerId
        },
        bookingId: payout.bookingId
      });

      // Update payout record with success
      await db
        .update(payoutSchedulesTable)
        .set({
          status: 'completed',
          processedAt: new Date(),
          stripeTransferId: transfer.id
        })
        .where(eq(payoutSchedulesTable.id, payout.id));

      // Log success
      await this.logPayoutEvent(payout.id, 'payout_completed', {
        stripeTransferId: transfer.id,
        amount: payout.netPayout,
        isRetry
      });

      return {
        success: true,
        payoutId: payout.id,
        stripeTransferId: transfer.id
      };

    } catch (error) {
      await this.handlePayoutFailure(payout, error, isRetry);
      throw error;
    }
  }

  private async handlePayoutFailure(
    payout: PayoutSchedule,
    error: any,
    isRetry: boolean = false
  ): Promise<void> {
    const isRetryable = this.isRetryableError(error);
    const hasRetriesLeft = payout.retryCount < this.MAX_RETRY_ATTEMPTS - 1;
    
    const newStatus = (isRetryable && hasRetriesLeft) ? 'failed' : 'cancelled';
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await db
      .update(payoutSchedulesTable)
      .set({
        status: newStatus,
        failureReason: errorMessage,
        ...(isRetry && { retryCount: payout.retryCount + 1 })
      })
      .where(eq(payoutSchedulesTable.id, payout.id));

    // Log failure
    await this.logPayoutEvent(payout.id, 'payout_failed', {
      error: errorMessage,
      isRetryable,
      retryCount: isRetry ? payout.retryCount + 1 : payout.retryCount,
      finalFailure: !isRetryable || !hasRetriesLeft
    });
  }

  private isRetryableError(error: any): boolean {
    if (error instanceof Error) {
      // Stripe-specific retryable errors
      if (error.message.includes('rate_limit')) return true;
      if (error.message.includes('processing_error')) return true;
      if (error.message.includes('temporarily_unavailable')) return true;
      
      // Network errors
      if (error.message.includes('ECONNRESET')) return true;
      if (error.message.includes('ETIMEDOUT')) return true;
    }

    // Stripe error object
    if (error.type === 'StripeConnectionError') return true;
    if (error.type === 'StripeAPIError' && error.code === 'rate_limit') return true;

    return false;
  }

  private getRetryDelayMs(retryCount: number): number {
    if (retryCount >= this.RETRY_BACKOFF_HOURS.length) {
      return this.RETRY_BACKOFF_HOURS[this.RETRY_BACKOFF_HOURS.length - 1] * 60 * 60 * 1000;
    }
    return this.RETRY_BACKOFF_HOURS[retryCount] * 60 * 60 * 1000;
  }

  private async logPayoutEvent(
    payoutId: string,
    event: string,
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      await db.insert(bookingStateTransitionsTable).values({
        bookingId: metadata.bookingId || payoutId, // Use payoutId as fallback
        fromStatus: null,
        toStatus: event,
        triggeredBy: 'system',
        triggerReason: 'payout_processing',
        metadata: {
          payoutId,
          event,
          ...metadata
        }
      });
    } catch (error) {
      console.error('Failed to log payout event:', error);
    }
  }

  /**
   * Emergency methods for manual intervention
   */

  /**
   * Manually mark a payout as completed (for external processing)
   */
  async manuallyCompletePayout(
    payoutId: string,
    externalTransactionId: string,
    completedBy: string,
    notes?: string
  ): Promise<void> {
    const [payout] = await db
      .select()
      .from(payoutSchedulesTable)
      .where(eq(payoutSchedulesTable.id, payoutId))
      .limit(1);

    if (!payout) {
      throw new Error('Payout not found');
    }

    if (payout.status === 'completed') {
      throw new Error('Payout already completed');
    }

    await db
      .update(payoutSchedulesTable)
      .set({
        status: 'completed',
        processedAt: new Date(),
        stripeTransferId: externalTransactionId,
        failureReason: notes ? `Manual completion: ${notes}` : 'Manual completion'
      })
      .where(eq(payoutSchedulesTable.id, payoutId));

    await this.logPayoutEvent(payoutId, 'payout_manual_completion', {
      externalTransactionId,
      completedBy,
      notes
    });
  }

  /**
   * Get system-wide payout health metrics
   */
  async getSystemPayoutHealth(): Promise<{
    pendingCount: number;
    failedCount: number;
    processingCount: number;
    oldestPending?: Date;
    failureRate: number;
  }> {
    const payouts = await db
      .select()
      .from(payoutSchedulesTable)
      .where(
        gte(payoutSchedulesTable.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      );

    const stats = payouts.reduce(
      (acc, payout) => {
        switch (payout.status) {
          case 'scheduled':
            acc.pendingCount++;
            if (!acc.oldestPending || payout.scheduledAt < acc.oldestPending) {
              acc.oldestPending = payout.scheduledAt;
            }
            break;
          case 'processing':
            acc.processingCount++;
            break;
          case 'failed':
            acc.failedCount++;
            break;
          case 'completed':
            acc.completedCount++;
            break;
        }
        return acc;
      },
      {
        pendingCount: 0,
        failedCount: 0,
        processingCount: 0,
        completedCount: 0,
        oldestPending: undefined as Date | undefined
      }
    );

    const totalProcessed = stats.completedCount + stats.failedCount;
    const failureRate = totalProcessed > 0 ? stats.failedCount / totalProcessed : 0;

    return {
      pendingCount: stats.pendingCount,
      failedCount: stats.failedCount,
      processingCount: stats.processingCount,
      oldestPending: stats.oldestPending,
      failureRate
    };
  }
}

// Singleton instance
export const payoutService = new PayoutService();