/**
 * Booking State Machine
 * 
 * Implements the complete booking lifecycle with proper state transitions,
 * validation, and event emission according to the ecosystem marketplace requirements.
 * 
 * States: INITIATED → PENDING_PROVIDER → ACCEPTED → PAYMENT_PENDING → PAYMENT_SUCCEEDED → COMPLETED
 *                          ↓                           ↓
 *                      REJECTED              PAYMENT_FAILED
 */

import { EventEmitter } from 'events';
import { db } from '@/db/db';
import { 
  bookingsTable, 
  bookingStateTransitionsTable,
  payoutSchedulesTable,
  bookingRemindersTable,
  type BookingStatusType
} from '@/db/schema/enhanced-booking-schema';
import { eq, and } from 'drizzle-orm';
import { calculatePlatformFee } from '@/lib/platform-fee';
import { stripe } from '@/lib/stripe-enhanced';
import { notificationService } from '@/lib/notifications/notification-service';
import { cache } from '@/lib/cache';

// Extended booking states for the complete flow
export enum BookingState {
  // Initial states
  INITIATED = 'initiated',
  PENDING_PROVIDER = 'pending_provider',
  
  // Provider response states
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  
  // Payment states
  PAYMENT_PENDING = 'payment_pending',
  PAYMENT_SUCCEEDED = 'payment_succeeded',
  PAYMENT_FAILED = 'payment_failed',
  
  // Service states
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  
  // Cancellation states
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  NO_SHOW = 'no_show'
}

// Valid state transitions
const STATE_TRANSITIONS: Record<BookingState, BookingState[]> = {
  [BookingState.INITIATED]: [BookingState.PENDING_PROVIDER, BookingState.CANCELLED],
  [BookingState.PENDING_PROVIDER]: [BookingState.ACCEPTED, BookingState.REJECTED, BookingState.CANCELLED],
  [BookingState.ACCEPTED]: [BookingState.PAYMENT_PENDING, BookingState.CANCELLED],
  [BookingState.REJECTED]: [], // Terminal state
  [BookingState.PAYMENT_PENDING]: [BookingState.PAYMENT_SUCCEEDED, BookingState.PAYMENT_FAILED],
  [BookingState.PAYMENT_SUCCEEDED]: [BookingState.IN_PROGRESS, BookingState.CANCELLED],
  [BookingState.PAYMENT_FAILED]: [BookingState.PAYMENT_PENDING, BookingState.CANCELLED],
  [BookingState.IN_PROGRESS]: [BookingState.COMPLETED, BookingState.NO_SHOW, BookingState.CANCELLED],
  [BookingState.COMPLETED]: [BookingState.REFUNDED],
  [BookingState.CANCELLED]: [BookingState.REFUNDED],
  [BookingState.REFUNDED]: [], // Terminal state
  [BookingState.NO_SHOW]: [BookingState.REFUNDED] // Terminal state
};

// State transition events
export interface StateTransitionEvent {
  bookingId: string;
  fromState: BookingState | null;
  toState: BookingState;
  triggeredBy: string;
  reason?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

// Booking context for state machine
export interface BookingContext {
  bookingId: string;
  currentState: BookingState;
  providerId: string;
  customerId?: string;
  guestEmail?: string;
  serviceId: string;
  amount: number;
  platformFee: number;
  providerPayout: number;
  stripePaymentIntentId?: string;
  stripeTransferId?: string;
  metadata?: Record<string, any>;
}

// State timeout configurations (in milliseconds)
const STATE_TIMEOUTS = {
  [BookingState.PENDING_PROVIDER]: 24 * 60 * 60 * 1000, // 24 hours for provider to accept
  [BookingState.PAYMENT_PENDING]: 30 * 60 * 1000, // 30 minutes to complete payment
  [BookingState.ACCEPTED]: 15 * 60 * 1000, // 15 minutes to proceed to payment
};

export class BookingStateMachine extends EventEmitter {
  private timeouts: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Transition booking to a new state
   */
  async transition(
    bookingId: string,
    toState: BookingState,
    triggeredBy: string,
    options?: {
      reason?: string;
      metadata?: Record<string, any>;
      skipValidation?: boolean;
    }
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      await db.transaction(async (tx) => {
        // Get current booking state
        const [booking] = await tx
          .select()
          .from(bookingsTable)
          .where(eq(bookingsTable.id, bookingId))
          .limit(1);
        
        if (!booking) {
          throw new Error(`Booking ${bookingId} not found`);
        }
        
        const fromState = (booking.status as BookingState) || BookingState.INITIATED;
        
        // Validate state transition unless explicitly skipped
        if (!options?.skipValidation) {
          const validTransitions = STATE_TRANSITIONS[fromState] || [];
          if (!validTransitions.includes(toState)) {
            throw new Error(
              `Invalid state transition from ${fromState} to ${toState}. ` +
              `Valid transitions: ${validTransitions.join(', ')}`
            );
          }
        }
        
        // Update booking status
        const updateData: any = {
          status: toState,
          updatedAt: new Date()
        };
        
        // Add state-specific fields
        switch (toState) {
          case BookingState.COMPLETED:
            updateData.completedAt = new Date();
            break;
          case BookingState.CANCELLED:
            updateData.cancelledAt = new Date();
            updateData.cancelledBy = triggeredBy;
            updateData.cancellationReason = options?.reason;
            break;
          case BookingState.REJECTED:
            updateData.cancelledAt = new Date();
            updateData.cancelledBy = triggeredBy;
            updateData.cancellationReason = `Provider rejected: ${options?.reason || 'No reason provided'}`;
            break;
        }
        
        await tx
          .update(bookingsTable)
          .set(updateData)
          .where(eq(bookingsTable.id, bookingId));
        
        // Record state transition
        await tx.insert(bookingStateTransitionsTable).values({
          bookingId,
          fromStatus: fromState,
          toStatus: toState,
          triggeredBy,
          triggerReason: options?.reason,
          metadata: options?.metadata || {}
        });
        
        // Handle state-specific side effects
        await this.handleStateSideEffects(
          tx,
          booking,
          toState,
          triggeredBy,
          options
        );
      });
      
      // Clear existing timeout for this booking
      this.clearTimeout(bookingId);
      
      // Set new timeout if applicable
      if (STATE_TIMEOUTS[toState]) {
        this.setTimeout(bookingId, toState, STATE_TIMEOUTS[toState]);
      }
      
      // Emit state transition event
      const event: StateTransitionEvent = {
        bookingId,
        fromState: fromState,
        toState,
        triggeredBy,
        reason: options?.reason,
        metadata: options?.metadata,
        timestamp: new Date()
      };
      
      this.emit('stateTransition', event);
      
      // Log performance
      console.log(`State transition completed in ${Date.now() - startTime}ms`, {
        bookingId,
        fromState: fromState,
        toState,
        duration: Date.now() - startTime
      });
      
    } catch (error) {
      console.error('State transition failed:', error);
      
      // Emit error event
      this.emit('transitionError', {
        bookingId,
        toState,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      });
      
      throw error;
    }
  }

  /**
   * Accept booking (provider action)
   */
  async acceptBooking(
    bookingId: string,
    providerId: string,
    notes?: string
  ): Promise<void> {
    await this.transition(bookingId, BookingState.ACCEPTED, providerId, {
      reason: 'Provider accepted booking',
      metadata: { notes }
    });
    
    // Schedule payment collection reminder
    await this.scheduleReminder(bookingId, 'payment_reminder', 10 * 60 * 1000);
  }

  /**
   * Reject booking (provider action)
   */
  async rejectBooking(
    bookingId: string,
    providerId: string,
    reason: string
  ): Promise<void> {
    await this.transition(bookingId, BookingState.REJECTED, providerId, {
      reason,
      metadata: { rejectedBy: 'provider' }
    });
  }

  /**
   * Mark payment as pending
   */
  async markPaymentPending(
    bookingId: string,
    paymentIntentId: string
  ): Promise<void> {
    await this.transition(bookingId, BookingState.PAYMENT_PENDING, 'system', {
      metadata: { paymentIntentId }
    });
  }

  /**
   * Mark payment as succeeded
   */
  async markPaymentSucceeded(
    bookingId: string,
    chargeId: string,
    paymentIntentId: string
  ): Promise<void> {
    await this.transition(bookingId, BookingState.PAYMENT_SUCCEEDED, 'system', {
      reason: 'Payment confirmed by Stripe',
      metadata: { chargeId, paymentIntentId }
    });
    
    // Schedule service reminder
    const booking = await this.getBooking(bookingId);
    if (booking) {
      const serviceDate = new Date(booking.bookingDate);
      const reminderTime = serviceDate.getTime() - 24 * 60 * 60 * 1000; // 24 hours before
      
      if (reminderTime > Date.now()) {
        await this.scheduleReminder(bookingId, 'service_reminder', reminderTime - Date.now());
      }
    }
  }

  /**
   * Mark payment as failed
   */
  async markPaymentFailed(
    bookingId: string,
    error: string,
    stripeErrorCode?: string
  ): Promise<void> {
    await this.transition(bookingId, BookingState.PAYMENT_FAILED, 'system', {
      reason: error,
      metadata: { stripeErrorCode }
    });
  }

  /**
   * Start service
   */
  async startService(
    bookingId: string,
    providerId: string
  ): Promise<void> {
    await this.transition(bookingId, BookingState.IN_PROGRESS, providerId, {
      reason: 'Service started'
    });
  }

  /**
   * Complete booking
   */
  async completeBooking(
    bookingId: string,
    triggeredBy: string,
    notes?: string
  ): Promise<void> {
    await this.transition(bookingId, BookingState.COMPLETED, triggeredBy, {
      reason: 'Service completed successfully',
      metadata: { completionNotes: notes }
    });
    
    // Schedule provider payout
    await this.scheduleProviderPayout(bookingId);
    
    // Schedule review reminder for customer
    await this.scheduleReminder(bookingId, 'review_reminder', 24 * 60 * 60 * 1000);
  }

  /**
   * Cancel booking
   */
  async cancelBooking(
    bookingId: string,
    cancelledBy: string,
    reason: string,
    refundAmount?: number
  ): Promise<void> {
    const booking = await this.getBooking(bookingId);
    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`);
    }
    
    // Calculate refund based on cancellation policy if not provided
    const calculatedRefundAmount = refundAmount ?? 
      await this.calculateRefundAmount(booking);
    
    await this.transition(bookingId, BookingState.CANCELLED, cancelledBy, {
      reason,
      metadata: { 
        refundAmount: calculatedRefundAmount,
        cancelledByType: booking.customerId === cancelledBy ? 'customer' : 'provider'
      }
    });
    
    // Process refund if payment was made
    if (booking.stripePaymentIntentId && calculatedRefundAmount > 0) {
      await this.processRefund(bookingId, calculatedRefundAmount, reason);
    }
  }

  /**
   * Mark as no-show
   */
  async markNoShow(
    bookingId: string,
    providerId: string,
    notes?: string
  ): Promise<void> {
    await this.transition(bookingId, BookingState.NO_SHOW, providerId, {
      reason: 'Customer did not show up',
      metadata: { notes }
    });
    
    // Provider still gets partial payment for no-shows (50%)
    await this.scheduleProviderPayout(bookingId, 0.5);
  }

  /**
   * Process refund
   */
  async processRefund(
    bookingId: string,
    amount: number,
    reason: string
  ): Promise<void> {
    const booking = await this.getBooking(bookingId);
    if (!booking || !booking.stripePaymentIntentId) {
      throw new Error('Cannot process refund: payment information not found');
    }
    
    try {
      const refund = await stripe.refunds.create({
        payment_intent: booking.stripePaymentIntentId,
        amount: Math.round(amount * 100), // Convert to cents
        reason: 'requested_by_customer',
        metadata: {
          bookingId,
          refundReason: reason
        }
      });
      
      await this.transition(bookingId, BookingState.REFUNDED, 'system', {
        reason: `Refund processed: ${reason}`,
        metadata: {
          refundId: refund.id,
          refundAmount: amount,
          refundStatus: refund.status
        }
      });
      
    } catch (error) {
      console.error('Refund processing failed:', error);
      throw new Error(`Failed to process refund: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Private helper methods
   */
  
  private async handleStateSideEffects(
    tx: any,
    booking: any,
    newState: BookingState,
    triggeredBy: string,
    options?: any
  ): Promise<void> {
    switch (newState) {
      case BookingState.ACCEPTED:
        // Send notification to customer
        await this.queueNotification(tx, booking.id, 'booking_accepted', {
          recipientType: 'customer',
          priority: 'high'
        });
        break;
        
      case BookingState.REJECTED:
        // Send rejection notification and process refund if paid
        await this.queueNotification(tx, booking.id, 'booking_rejected', {
          recipientType: 'customer',
          priority: 'high',
          reason: options?.reason
        });
        break;
        
      case BookingState.PAYMENT_SUCCEEDED:
        // Send confirmation to both parties
        await this.queueNotification(tx, booking.id, 'payment_confirmed', {
          recipientType: 'both',
          priority: 'high'
        });
        break;
        
      case BookingState.COMPLETED:
        // Schedule payout and request review
        await this.queueNotification(tx, booking.id, 'service_completed', {
          recipientType: 'both',
          priority: 'normal'
        });
        break;
        
      case BookingState.CANCELLED:
      case BookingState.REFUNDED:
        // Send cancellation/refund notifications
        await this.queueNotification(tx, booking.id, 'booking_cancelled', {
          recipientType: 'both',
          priority: 'high',
          reason: options?.reason,
          refundAmount: options?.metadata?.refundAmount
        });
        break;
    }
  }
  
  private async scheduleProviderPayout(
    bookingId: string,
    payoutPercentage: number = 1.0
  ): Promise<void> {
    const booking = await this.getBooking(bookingId);
    if (!booking) return;
    
    const payoutDate = new Date();
    payoutDate.setDate(payoutDate.getDate() + 7); // 7-day escrow period
    
    const netPayout = booking.providerPayout * payoutPercentage;
    
    await db.insert(payoutSchedulesTable).values({
      bookingId,
      providerId: booking.providerId,
      amount: booking.totalAmount,
      platformFee: booking.platformFee,
      netPayout,
      scheduledAt: payoutDate,
      status: 'scheduled'
    });
  }
  
  private async scheduleReminder(
    bookingId: string,
    reminderType: string,
    delayMs: number
  ): Promise<void> {
    const scheduledAt = new Date(Date.now() + delayMs);
    
    await db.insert(bookingRemindersTable).values({
      bookingId,
      reminderType: reminderType as any,
      scheduledAt,
      deliveryMethod: 'email',
      recipientType: reminderType.includes('provider') ? 'provider' : 'customer',
      status: 'scheduled'
    });
  }
  
  private async queueNotification(
    tx: any,
    bookingId: string,
    type: string,
    metadata: any
  ): Promise<void> {
    // Queue notification for async processing
    // This would integrate with your notification service
    await notificationService.queue({
      bookingId,
      type,
      metadata,
      createdAt: new Date()
    });
  }
  
  private async getBooking(bookingId: string): Promise<any> {
    const [booking] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, bookingId))
      .limit(1);
    
    return booking;
  }
  
  private async calculateRefundAmount(booking: any): Promise<number> {
    const now = new Date();
    const bookingDate = new Date(booking.bookingDate);
    const hoursUntilBooking = (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    // Refund policy:
    // - 100% refund if cancelled 48+ hours before
    // - 75% refund if cancelled 24-48 hours before
    // - 50% refund if cancelled 12-24 hours before
    // - 25% refund if cancelled 6-12 hours before
    // - No refund if cancelled less than 6 hours before
    
    if (hoursUntilBooking >= 48) return booking.totalAmount;
    if (hoursUntilBooking >= 24) return booking.totalAmount * 0.75;
    if (hoursUntilBooking >= 12) return booking.totalAmount * 0.50;
    if (hoursUntilBooking >= 6) return booking.totalAmount * 0.25;
    
    return 0;
  }
  
  private setTimeout(bookingId: string, state: BookingState, timeoutMs: number): void {
    const timeout = setTimeout(async () => {
      try {
        await this.handleTimeout(bookingId, state);
      } catch (error) {
        console.error(`Timeout handler failed for booking ${bookingId}:`, error);
      }
    }, timeoutMs);
    
    this.timeouts.set(bookingId, timeout);
  }
  
  private clearTimeout(bookingId: string): void {
    const timeout = this.timeouts.get(bookingId);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(bookingId);
    }
  }
  
  private async handleTimeout(bookingId: string, state: BookingState): Promise<void> {
    console.log(`Handling timeout for booking ${bookingId} in state ${state}`);
    
    switch (state) {
      case BookingState.PENDING_PROVIDER:
        // Auto-reject if provider doesn't respond
        await this.transition(bookingId, BookingState.REJECTED, 'system', {
          reason: 'Provider did not respond within 24 hours'
        });
        break;
        
      case BookingState.PAYMENT_PENDING:
        // Cancel if payment not completed
        await this.transition(bookingId, BookingState.CANCELLED, 'system', {
          reason: 'Payment timeout - booking expired'
        });
        break;
        
      case BookingState.ACCEPTED:
        // Cancel if customer doesn't proceed to payment
        await this.transition(bookingId, BookingState.CANCELLED, 'system', {
          reason: 'Customer did not proceed to payment'
        });
        break;
    }
  }
  
  /**
   * Get valid transitions for current state
   */
  getValidTransitions(currentState: BookingState): BookingState[] {
    return STATE_TRANSITIONS[currentState] || [];
  }
  
  /**
   * Check if a transition is valid
   */
  isValidTransition(fromState: BookingState, toState: BookingState): boolean {
    const validTransitions = this.getValidTransitions(fromState);
    return validTransitions.includes(toState);
  }
  
  /**
   * Cleanup resources
   */
  destroy(): void {
    // Clear all timeouts
    this.timeouts.forEach(timeout => clearTimeout(timeout));
    this.timeouts.clear();
    
    // Remove all event listeners
    this.removeAllListeners();
  }
}

// Export singleton instance
export const bookingStateMachine = new BookingStateMachine();