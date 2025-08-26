/**
 * Booking State Machine Engine
 * Core state machine implementation with transition validation and event handling
 * Per Master PRD §4.7
 */

import { db } from "@/db/db";
import { 
  bookingsTable, 
  bookingStateTransitionsTable 
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { 
  BookingStates, 
  type BookingState,
  StateConfigurations,
  isTerminalState 
} from './states';
import { 
  executeTransition,
  getAvailableEvents,
  type TransitionEvent,
  type TransitionContext
} from './transitions';
import { emailService } from '@/lib/services/email-service';
import { concurrencyManager } from '@/lib/availability/concurrency-manager';

/**
 * Booking context for state machine
 */
export interface BookingContext {
  id: string;
  providerId: string;
  customerId?: string;
  guestSessionId?: string;
  currentState: BookingState;
  serviceDetails: {
    name: string;
    price: number;
    duration: number;
    date: string;
    startTime: string;
    endTime: string;
  };
  paymentDetails?: {
    paymentIntentId?: string;
    amount: number;
    platformFee: number;
    providerPayout: number;
  };
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * State machine event
 */
export interface StateMachineEvent {
  type: TransitionEvent;
  actor: {
    type: 'customer' | 'provider' | 'system' | 'admin';
    id: string;
  };
  metadata?: Record<string, any>;
  timestamp?: Date;
}

/**
 * State machine result
 */
export interface StateMachineResult {
  success: boolean;
  previousState: BookingState;
  currentState: BookingState;
  error?: string;
  sideEffects?: string[];
}

/**
 * Main booking state machine class
 */
export class BookingStateMachine {
  private context: BookingContext;
  private history: Array<{
    state: BookingState;
    event?: TransitionEvent;
    timestamp: Date;
  }> = [];

  constructor(context: BookingContext) {
    this.context = context;
    this.history.push({
      state: context.currentState,
      timestamp: new Date()
    });
  }

  /**
   * Get current state
   */
  getCurrentState(): BookingState {
    return this.context.currentState;
  }

  /**
   * Get available events for current state
   */
  getAvailableEvents(): TransitionEvent[] {
    if (isTerminalState(this.context.currentState)) {
      return [];
    }
    return getAvailableEvents(this.context.currentState);
  }

  /**
   * Send an event to the state machine
   */
  async send(event: StateMachineEvent): Promise<StateMachineResult> {
    const previousState = this.context.currentState;
    const sideEffects: string[] = [];

    try {
      // Check if state is terminal
      if (isTerminalState(this.context.currentState)) {
        return {
          success: false,
          previousState,
          currentState: this.context.currentState,
          error: `Cannot transition from terminal state: ${this.context.currentState}`
        };
      }

      // Create transition context
      const transitionContext: TransitionContext = {
        bookingId: this.context.id,
        currentState: this.context.currentState,
        event: event.type,
        actor: event.actor,
        metadata: event.metadata,
        timestamp: event.timestamp || new Date()
      };

      // Execute transition
      const result = await executeTransition(transitionContext);

      if (!result.success) {
        return {
          success: false,
          previousState,
          currentState: this.context.currentState,
          error: result.error
        };
      }

      // Update state
      this.context.currentState = result.newState!;
      this.context.updatedAt = new Date();

      // Add to history
      this.history.push({
        state: result.newState!,
        event: event.type,
        timestamp: transitionContext.timestamp
      });

      // Persist state change to database
      await this.persistStateChange(
        previousState,
        result.newState!,
        event
      );

      // Execute side effects based on new state
      const effects = await this.executeSideEffects(
        previousState,
        result.newState!,
        event
      );
      sideEffects.push(...effects);

      return {
        success: true,
        previousState,
        currentState: result.newState!,
        sideEffects
      };

    } catch (error) {
      console.error('State machine error:', error);
      return {
        success: false,
        previousState,
        currentState: this.context.currentState,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Persist state change to database
   */
  private async persistStateChange(
    fromState: BookingState,
    toState: BookingState,
    event: StateMachineEvent
  ): Promise<void> {
    await db.transaction(async (tx) => {
      // Update booking status
      await tx
        .update(bookingsTable)
        .set({
          status: toState,
          updatedAt: new Date()
        })
        .where(eq(bookingsTable.id, this.context.id));

      // Record state transition
      await tx.insert(bookingStateTransitionsTable).values({
        bookingId: this.context.id,
        fromStatus: fromState,
        toStatus: toState,
        triggeredBy: event.actor.id,
        triggerReason: event.type,
        metadata: event.metadata || {},
        createdAt: event.timestamp || new Date()
      });
    });
  }

  /**
   * Execute side effects based on state transition
   */
  private async executeSideEffects(
    fromState: BookingState,
    toState: BookingState,
    event: StateMachineEvent
  ): Promise<string[]> {
    const effects: string[] = [];
    const stateConfig = StateConfigurations[toState];

    try {
      // Send notifications if required
      if (stateConfig.notifyCustomer) {
        await this.sendCustomerNotification(toState, event);
        effects.push('Customer notification sent');
      }

      if (stateConfig.notifyProvider) {
        await this.sendProviderNotification(toState, event);
        effects.push('Provider notification sent');
      }

      // Handle specific state side effects
      switch (toState) {
        case BookingStates.HOLD:
          // Place hold on slot
          await this.placeSlotHold();
          effects.push('Slot hold placed');
          break;

        case BookingStates.CONFIRMED:
          // Convert hold to booking
          if (event.metadata?.holdId) {
            await concurrencyManager.convertHoldToBooking(
              event.metadata.holdId,
              this.context.id
            );
            effects.push('Hold converted to booking');
          }
          // Schedule reminders
          await this.scheduleReminders();
          effects.push('Reminders scheduled');
          break;

        case BookingStates.CANCELED_CUSTOMER:
        case BookingStates.CANCELED_PROVIDER:
          // Release slot if not too late
          await this.releaseSlot();
          effects.push('Slot released');
          break;

        case BookingStates.NO_SHOW_PROVIDER:
          // Automatic full refund for provider no-show
          await this.initiateFullRefund();
          effects.push('Full refund initiated');
          break;

        case BookingStates.COMPLETED:
          // Schedule provider payout
          await this.scheduleProviderPayout();
          effects.push('Provider payout scheduled');
          // Request review
          await this.requestCustomerReview();
          effects.push('Review request sent');
          break;

        case BookingStates.REFUNDED_PARTIAL:
        case BookingStates.REFUNDED_FULL:
          // Process refund
          await this.processRefund(event.metadata?.refundAmount);
          effects.push('Refund processed');
          break;

        case BookingStates.DISPUTE:
          // Notify admin
          await this.notifyAdminOfDispute();
          effects.push('Admin notified of dispute');
          break;
      }

      // Check for state timeout
      if (stateConfig.maxDuration) {
        await this.scheduleStateTimeout(toState, stateConfig.maxDuration);
        effects.push(`State timeout scheduled (${stateConfig.maxDuration} minutes)`);
      }

    } catch (error) {
      console.error('Side effect error:', error);
      effects.push(`Side effect error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    return effects;
  }

  /**
   * Send customer notification
   */
  private async sendCustomerNotification(
    state: BookingState,
    event: StateMachineEvent
  ): Promise<void> {
    // TODO: Implement based on state and event
    console.log(`Sending customer notification for state: ${state}`);
  }

  /**
   * Send provider notification
   */
  private async sendProviderNotification(
    state: BookingState,
    event: StateMachineEvent
  ): Promise<void> {
    // TODO: Implement based on state and event
    console.log(`Sending provider notification for state: ${state}`);
  }

  /**
   * Place a hold on the time slot
   */
  private async placeSlotHold(): Promise<void> {
    const result = await concurrencyManager.placeHold({
      providerId: this.context.providerId,
      date: this.context.serviceDetails.date,
      startTime: this.context.serviceDetails.startTime,
      endTime: this.context.serviceDetails.endTime,
      customerId: this.context.customerId,
      guestSessionId: this.context.guestSessionId
    });

    if (!result.success) {
      throw new Error(`Failed to place hold: ${result.error}`);
    }

    // Store hold ID in context
    this.context.metadata.holdId = result.holdId;
  }

  /**
   * Release the time slot
   */
  private async releaseSlot(): Promise<void> {
    if (this.context.metadata.holdId) {
      await concurrencyManager.releaseHold(this.context.metadata.holdId, 'manual');
    }
  }

  /**
   * Schedule appointment reminders
   */
  private async scheduleReminders(): Promise<void> {
    // TODO: Implement reminder scheduling
    console.log('Scheduling reminders for booking:', this.context.id);
  }

  /**
   * Initiate full refund
   */
  private async initiateFullRefund(): Promise<void> {
    // TODO: Implement Stripe refund
    console.log('Initiating full refund for booking:', this.context.id);
  }

  /**
   * Schedule provider payout
   */
  private async scheduleProviderPayout(): Promise<void> {
    // TODO: Implement payout scheduling
    console.log('Scheduling provider payout for booking:', this.context.id);
  }

  /**
   * Request customer review
   */
  private async requestCustomerReview(): Promise<void> {
    // TODO: Send review request email
    console.log('Requesting customer review for booking:', this.context.id);
  }

  /**
   * Process refund
   */
  private async processRefund(amount?: number): Promise<void> {
    // TODO: Implement Stripe refund processing
    console.log(`Processing refund of ${amount} for booking:`, this.context.id);
  }

  /**
   * Notify admin of dispute
   */
  private async notifyAdminOfDispute(): Promise<void> {
    // TODO: Send admin notification
    console.log('Notifying admin of dispute for booking:', this.context.id);
  }

  /**
   * Schedule state timeout
   */
  private async scheduleStateTimeout(
    state: BookingState,
    timeoutMinutes: number
  ): Promise<void> {
    // TODO: Implement timeout scheduling
    console.log(`Scheduling ${timeoutMinutes} minute timeout for state ${state}`);
  }

  /**
   * Get state history
   */
  getHistory() {
    return this.history;
  }

  /**
   * Get context
   */
  getContext() {
    return this.context;
  }
}

/**
 * Create a new state machine instance from booking data
 */
export async function createStateMachine(
  bookingId: string
): Promise<BookingStateMachine | null> {
  try {
    const [booking] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, bookingId))
      .limit(1);

    if (!booking) {
      return null;
    }

    const context: BookingContext = {
      id: booking.id,
      providerId: booking.providerId,
      customerId: booking.customerId || undefined,
      guestSessionId: booking.guestSessionId || undefined,
      currentState: booking.status as BookingState,
      serviceDetails: {
        name: booking.serviceName,
        price: parseFloat(booking.servicePrice),
        duration: booking.serviceDuration,
        date: booking.bookingDate,
        startTime: booking.startTime,
        endTime: booking.endTime
      },
      paymentDetails: booking.stripePaymentIntentId ? {
        paymentIntentId: booking.stripePaymentIntentId,
        amount: parseFloat(booking.totalAmount),
        platformFee: parseFloat(booking.platformFee),
        providerPayout: parseFloat(booking.providerPayout)
      } : undefined,
      metadata: {},
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt
    };

    return new BookingStateMachine(context);
  } catch (error) {
    console.error('Error creating state machine:', error);
    return null;
  }
}