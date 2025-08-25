/**
 * Provider Payout Service
 * 
 * Handles automated provider payouts after service completion.
 * Manages escrow periods, payout scheduling, and Stripe Connect transfers.
 */

import { db } from '@/db/db';
import { 
  payoutSchedulesTable, 
  bookingsTable,
  providersTable,
  bookingStateTransitionsTable
} from '@/db/schema/enhanced-booking-schema';
import { eq, and, lte, inArray } from 'drizzle-orm';
import { stripe } from '@/lib/stripe-enhanced';
import Stripe from 'stripe';
import { notificationService } from '@/lib/notifications/notification-service';
import { cache } from '@/lib/cache';

// Payout configuration
const PAYOUT_CONFIG = {
  ESCROW_DAYS: 7, // Days to hold funds before payout
  MIN_PAYOUT_AMOUNT: 1.00, // Minimum amount for payout in USD
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY_HOURS: [1, 4, 24], // Retry delays for failed payouts
  BATCH_SIZE: 50, // Number of payouts to process in one batch
};

// Payout status types
export enum PayoutStatus {
  SCHEDULED = 'scheduled',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

// Payout request interface
export interface PayoutRequest {
  bookingId: string;
  providerId: string;
  amount: number;
  platformFee: number;
  escrowDays?: number;
}

// Payout result interface
export interface PayoutResult {
  payoutId: string;
  status: PayoutStatus;
  scheduledAt: Date;
  amount: number;
  netPayout: number;
  stripeTransferId?: string;
  error?: string;
}

export class PayoutService {
  /**
   * Schedule a provider payout after service completion
   */
  async scheduleProviderPayout(request: PayoutRequest): Promise<PayoutResult> {
    try {
      // Validate minimum payout amount
      const netPayout = request.amount - request.platformFee;
      
      if (netPayout < PAYOUT_CONFIG.MIN_PAYOUT_AMOUNT) {
        throw new Error(
          `Net payout amount ${netPayout} is below minimum of ${PAYOUT_CONFIG.MIN_PAYOUT_AMOUNT}`
        );
      }
      
      // Calculate payout date (after escrow period)
      const escrowDays = request.escrowDays ?? PAYOUT_CONFIG.ESCROW_DAYS;
      const scheduledAt = new Date();
      scheduledAt.setDate(scheduledAt.getDate() + escrowDays);
      
      // Create payout schedule record
      const [payout] = await db
        .insert(payoutSchedulesTable)
        .values({
          bookingId: request.bookingId,
          providerId: request.providerId,
          amount: request.amount,
          platformFee: request.platformFee,
          netPayout,
          scheduledAt,
          status: PayoutStatus.SCHEDULED,
          currency: 'usd'
        })
        .returning();
      
      // Log the scheduled payout
      console.log('Payout scheduled:', {
        payoutId: payout.id,
        bookingId: request.bookingId,
        providerId: request.providerId,
        netPayout,
        scheduledAt
      });
      
      return {
        payoutId: payout.id,
        status: PayoutStatus.SCHEDULED,
        scheduledAt,
        amount: request.amount,
        netPayout,
      };
      
    } catch (error) {
      console.error('Error scheduling payout:', error);
      throw new Error(`Failed to schedule payout: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Process scheduled payouts that are due
   */
  async processScheduledPayouts(): Promise<number> {
    const now = new Date();
    let processedCount = 0;
    
    try {
      // Get payouts that are due for processing
      const duePayouts = await db
        .select({
          payout: payoutSchedulesTable,
          booking: bookingsTable,
          provider: providersTable
        })
        .from(payoutSchedulesTable)
        .leftJoin(bookingsTable, eq(payoutSchedulesTable.bookingId, bookingsTable.id))
        .leftJoin(providersTable, eq(payoutSchedulesTable.providerId, providersTable.id))
        .where(
          and(
            eq(payoutSchedulesTable.status, PayoutStatus.SCHEDULED),
            lte(payoutSchedulesTable.scheduledAt, now)
          )
        )
        .limit(PAYOUT_CONFIG.BATCH_SIZE);
      
      console.log(`Processing ${duePayouts.length} scheduled payouts`);
      
      // Process each payout
      for (const { payout, booking, provider } of duePayouts) {
        try {
          await this.processSinglePayout(payout, booking, provider);
          processedCount++;
        } catch (error) {
          console.error(`Failed to process payout ${payout.id}:`, error);
          await this.handlePayoutFailure(payout, error);
        }
      }
      
      return processedCount;
      
    } catch (error) {
      console.error('Error processing scheduled payouts:', error);
      throw error;
    }
  }
  
  /**
   * Process a single payout
   */
  private async processSinglePayout(
    payout: any,
    booking: any,
    provider: any
  ): Promise<void> {
    // Update status to processing
    await db
      .update(payoutSchedulesTable)
      .set({ 
        status: PayoutStatus.PROCESSING,
        processedAt: new Date()
      })
      .where(eq(payoutSchedulesTable.id, payout.id));
    
    try {
      // Validate provider has Stripe Connect account
      if (!provider?.stripeConnectAccountId) {
        throw new Error('Provider does not have a connected Stripe account');
      }
      
      // Create Stripe transfer to provider's connected account
      const transfer = await stripe.transfers.create({
        amount: Math.round(payout.netPayout * 100), // Convert to cents
        currency: payout.currency || 'usd',
        destination: provider.stripeConnectAccountId,
        transfer_group: `booking_${booking.id}`,
        description: `Payout for booking ${booking.id}`,
        metadata: {
          bookingId: booking.id,
          payoutId: payout.id,
          providerId: provider.id,
          serviceName: booking.serviceName,
          bookingDate: booking.bookingDate.toISOString()
        }
      });
      
      // Create payout to provider's bank account (optional - Stripe handles this automatically)
      let stripePayoutId = null;
      if (provider.enableInstantPayouts) {
        try {
          const stripePayout = await stripe.payouts.create(
            {
              amount: Math.round(payout.netPayout * 100),
              currency: payout.currency || 'usd',
              method: 'instant', // or 'standard'
              metadata: {
                bookingId: booking.id,
                payoutId: payout.id
              }
            },
            {
              stripeAccount: provider.stripeConnectAccountId
            }
          );
          stripePayoutId = stripePayout.id;
        } catch (error) {
          // Instant payout failed, will use standard payout
          console.warn('Instant payout failed, using standard payout:', error);
        }
      }
      
      // Update payout record with success
      await db
        .update(payoutSchedulesTable)
        .set({
          status: PayoutStatus.COMPLETED,
          stripeTransferId: transfer.id,
          stripePayoutId: stripePayoutId,
          processedAt: new Date()
        })
        .where(eq(payoutSchedulesTable.id, payout.id));
      
      // Record state transition for booking
      await db.insert(bookingStateTransitionsTable).values({
        bookingId: booking.id,
        fromStatus: booking.status,
        toStatus: booking.status, // Status doesn't change, just noting payout
        triggeredBy: 'system',
        triggerReason: 'Provider payout completed',
        metadata: {
          payoutId: payout.id,
          transferId: transfer.id,
          amount: payout.netPayout,
          processedAt: new Date().toISOString()
        }
      });
      
      // Send notification to provider
      await notificationService.sendPayoutCompletedNotification({
        providerId: provider.id,
        providerEmail: provider.email,
        amount: payout.netPayout,
        bookingId: booking.id,
        serviceName: booking.serviceName,
        transferId: transfer.id,
        arrivalEstimate: stripePayoutId ? '1-2 hours' : '2-5 business days'
      });
      
      console.log('Payout completed successfully:', {
        payoutId: payout.id,
        transferId: transfer.id,
        amount: payout.netPayout
      });
      
    } catch (error) {
      // Update payout record with failure
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await db
        .update(payoutSchedulesTable)
        .set({
          status: PayoutStatus.FAILED,
          failureReason: errorMessage,
          retryCount: (payout.retryCount || 0) + 1
        })
        .where(eq(payoutSchedulesTable.id, payout.id));
      
      throw error;
    }
  }
  
  /**
   * Handle payout failure and schedule retry if applicable
   */
  private async handlePayoutFailure(payout: any, error: any): Promise<void> {
    const retryCount = payout.retryCount || 0;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error(`Payout ${payout.id} failed (attempt ${retryCount + 1}):`, errorMessage);
    
    // Check if we should retry
    if (retryCount < PAYOUT_CONFIG.MAX_RETRY_ATTEMPTS) {
      // Calculate next retry time
      const retryDelayHours = PAYOUT_CONFIG.RETRY_DELAY_HOURS[retryCount] || 24;
      const nextRetryAt = new Date();
      nextRetryAt.setHours(nextRetryAt.getHours() + retryDelayHours);
      
      // Schedule retry
      await db
        .update(payoutSchedulesTable)
        .set({
          status: PayoutStatus.SCHEDULED,
          scheduledAt: nextRetryAt,
          failureReason: errorMessage,
          retryCount: retryCount + 1
        })
        .where(eq(payoutSchedulesTable.id, payout.id));
      
      console.log(`Payout ${payout.id} scheduled for retry at ${nextRetryAt}`);
      
    } else {
      // Max retries exceeded, mark as permanently failed
      await db
        .update(payoutSchedulesTable)
        .set({
          status: PayoutStatus.FAILED,
          failureReason: `${errorMessage} (max retries exceeded)`,
          retryCount: retryCount + 1
        })
        .where(eq(payoutSchedulesTable.id, payout.id));
      
      // Notify provider of payout failure
      await notificationService.sendPayoutFailedNotification({
        payoutId: payout.id,
        providerId: payout.providerId,
        amount: payout.netPayout,
        reason: errorMessage,
        supportUrl: '/support/payout-issues'
      });
    }
  }
  
  /**
   * Cancel a scheduled payout
   */
  async cancelPayout(payoutId: string, reason: string): Promise<void> {
    const [payout] = await db
      .select()
      .from(payoutSchedulesTable)
      .where(eq(payoutSchedulesTable.id, payoutId))
      .limit(1);
    
    if (!payout) {
      throw new Error('Payout not found');
    }
    
    if (payout.status !== PayoutStatus.SCHEDULED) {
      throw new Error(`Cannot cancel payout in ${payout.status} status`);
    }
    
    await db
      .update(payoutSchedulesTable)
      .set({
        status: PayoutStatus.CANCELLED,
        failureReason: reason,
        processedAt: new Date()
      })
      .where(eq(payoutSchedulesTable.id, payoutId));
    
    console.log(`Payout ${payoutId} cancelled: ${reason}`);
  }
  
  /**
   * Get payout status for a booking
   */
  async getBookingPayoutStatus(bookingId: string): Promise<any> {
    const payouts = await db
      .select()
      .from(payoutSchedulesTable)
      .where(eq(payoutSchedulesTable.bookingId, bookingId))
      .orderBy(payoutSchedulesTable.createdAt);
    
    return payouts;
  }
  
  /**
   * Get provider payout history
   */
  async getProviderPayoutHistory(
    providerId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<any[]> {
    const payouts = await db
      .select({
        payout: payoutSchedulesTable,
        booking: bookingsTable
      })
      .from(payoutSchedulesTable)
      .leftJoin(bookingsTable, eq(payoutSchedulesTable.bookingId, bookingsTable.id))
      .where(eq(payoutSchedulesTable.providerId, providerId))
      .orderBy(payoutSchedulesTable.createdAt)
      .limit(limit)
      .offset(offset);
    
    return payouts;
  }
  
  /**
   * Get payout statistics for a provider
   */
  async getProviderPayoutStats(providerId: string): Promise<{
    totalPaid: number;
    pendingPayouts: number;
    completedPayouts: number;
    failedPayouts: number;
    nextPayout: Date | null;
  }> {
    const payouts = await db
      .select()
      .from(payoutSchedulesTable)
      .where(eq(payoutSchedulesTable.providerId, providerId));
    
    const stats = {
      totalPaid: 0,
      pendingPayouts: 0,
      completedPayouts: 0,
      failedPayouts: 0,
      nextPayout: null as Date | null
    };
    
    let earliestScheduled: Date | null = null;
    
    for (const payout of payouts) {
      switch (payout.status) {
        case PayoutStatus.COMPLETED:
          stats.totalPaid += payout.netPayout;
          stats.completedPayouts++;
          break;
        case PayoutStatus.SCHEDULED:
        case PayoutStatus.PROCESSING:
          stats.pendingPayouts++;
          if (!earliestScheduled || payout.scheduledAt < earliestScheduled) {
            earliestScheduled = payout.scheduledAt;
          }
          break;
        case PayoutStatus.FAILED:
          stats.failedPayouts++;
          break;
      }
    }
    
    stats.nextPayout = earliestScheduled;
    
    return stats;
  }
  
  /**
   * Retry failed payouts
   */
  async retryFailedPayouts(): Promise<number> {
    const failedPayouts = await db
      .select()
      .from(payoutSchedulesTable)
      .where(
        and(
          eq(payoutSchedulesTable.status, PayoutStatus.FAILED),
          lte(payoutSchedulesTable.retryCount, PAYOUT_CONFIG.MAX_RETRY_ATTEMPTS)
        )
      )
      .limit(PAYOUT_CONFIG.BATCH_SIZE);
    
    let retriedCount = 0;
    
    for (const payout of failedPayouts) {
      try {
        // Reset to scheduled status for retry
        await db
          .update(payoutSchedulesTable)
          .set({
            status: PayoutStatus.SCHEDULED,
            scheduledAt: new Date() // Process immediately
          })
          .where(eq(payoutSchedulesTable.id, payout.id));
        
        retriedCount++;
      } catch (error) {
        console.error(`Failed to retry payout ${payout.id}:`, error);
      }
    }
    
    return retriedCount;
  }
}

// Export singleton instance
export const payoutService = new PayoutService();

// Export types
export type { PayoutRequest, PayoutResult };