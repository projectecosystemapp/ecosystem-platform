/**
 * Booking State Transitions
 * Per Master PRD §4.7.2 - Valid state transitions and guards
 * 
 * Only permitted transitions are allowed; illegal transitions must throw
 */

import { BookingStates, type BookingState } from './states';

/**
 * Transition event types
 */
export const TransitionEvents = {
  // Initial flow
  CREATE: 'create',
  PLACE_HOLD: 'place_hold',
  
  // Payment events
  PAYMENT_AUTHORIZED: 'payment_authorized',
  PAYMENT_FAILED: 'payment_failed',
  PAYMENT_CAPTURED: 'payment_captured',
  
  // Provider actions
  PROVIDER_ACCEPTS: 'provider_accepts',
  PROVIDER_REJECTS: 'provider_rejects',
  PROVIDER_CANCELS: 'provider_cancels',
  PROVIDER_REPORTS_NO_SHOW: 'provider_reports_no_show',
  
  // Customer actions
  CUSTOMER_CANCELS: 'customer_cancels',
  CUSTOMER_REPORTS_NO_SHOW: 'customer_reports_no_show',
  
  // Service flow
  SERVICE_START: 'service_start',
  SERVICE_END: 'service_end',
  
  // Refund events
  REFUND_PARTIAL: 'refund_partial',
  REFUND_FULL: 'refund_full',
  
  // Dispute events
  DISPUTE_RAISED: 'dispute_raised',
  
  // System events
  HOLD_EXPIRED: 'hold_expired',
  PROVIDER_TIMEOUT: 'provider_timeout'
} as const;

export type TransitionEvent = typeof TransitionEvents[keyof typeof TransitionEvents];

/**
 * Transition definition
 */
export interface StateTransition {
  from: BookingState;
  to: BookingState;
  event: TransitionEvent;
  guard?: (context: TransitionContext) => boolean | Promise<boolean>;
  action?: (context: TransitionContext) => void | Promise<void>;
}

/**
 * Context for transition guards and actions
 */
export interface TransitionContext {
  bookingId: string;
  currentState: BookingState;
  event: TransitionEvent;
  actor: {
    type: 'customer' | 'provider' | 'system' | 'admin';
    id: string;
  };
  metadata?: {
    paymentIntentId?: string;
    refundAmount?: number;
    cancellationReason?: string;
    disputeReason?: string;
    notes?: string;
    [key: string]: any;
  };
  timestamp: Date;
}

/**
 * Valid state transitions map
 * Defines all legal transitions per Master PRD
 */
export const ValidTransitions: StateTransition[] = [
  // Draft transitions
  {
    from: BookingStates.DRAFT,
    to: BookingStates.HOLD,
    event: TransitionEvents.PLACE_HOLD,
    guard: async (ctx) => {
      // Verify slot is available
      // Verify customer details are complete
      return true;
    }
  },
  
  // Hold transitions
  {
    from: BookingStates.HOLD,
    to: BookingStates.PENDING_PROVIDER,
    event: TransitionEvents.PAYMENT_AUTHORIZED,
    guard: async (ctx) => {
      // Verify payment intent exists
      // Verify amount is correct
      return !!ctx.metadata?.paymentIntentId;
    }
  },
  {
    from: BookingStates.HOLD,
    to: BookingStates.DRAFT,
    event: TransitionEvents.PAYMENT_FAILED
  },
  {
    from: BookingStates.HOLD,
    to: BookingStates.DRAFT,
    event: TransitionEvents.HOLD_EXPIRED
  },
  
  // Pending provider transitions
  {
    from: BookingStates.PENDING_PROVIDER,
    to: BookingStates.CONFIRMED,
    event: TransitionEvents.PROVIDER_ACCEPTS,
    guard: async (ctx) => {
      // Verify provider is the owner
      return ctx.actor.type === 'provider';
    }
  },
  {
    from: BookingStates.PENDING_PROVIDER,
    to: BookingStates.CANCELED_PROVIDER,
    event: TransitionEvents.PROVIDER_REJECTS,
    guard: async (ctx) => {
      return ctx.actor.type === 'provider';
    }
  },
  {
    from: BookingStates.PENDING_PROVIDER,
    to: BookingStates.CANCELED_CUSTOMER,
    event: TransitionEvents.CUSTOMER_CANCELS,
    guard: async (ctx) => {
      // Customer can cancel while awaiting provider acceptance
      return ctx.actor.type === 'customer';
    }
  },
  {
    from: BookingStates.PENDING_PROVIDER,
    to: BookingStates.CANCELED_PROVIDER,
    event: TransitionEvents.PROVIDER_TIMEOUT,
    guard: async (ctx) => {
      // Auto-expire after 24 hours
      return ctx.actor.type === 'system';
    }
  },
  
  // Confirmed transitions
  {
    from: BookingStates.CONFIRMED,
    to: BookingStates.IN_PROGRESS,
    event: TransitionEvents.SERVICE_START,
    guard: async (ctx) => {
      // Verify current time is near booking time
      return true;
    }
  },
  {
    from: BookingStates.CONFIRMED,
    to: BookingStates.CANCELED_CUSTOMER,
    event: TransitionEvents.CUSTOMER_CANCELS,
    guard: async (ctx) => {
      // Check cancellation policy
      // Verify customer is the owner
      return ctx.actor.type === 'customer';
    }
  },
  {
    from: BookingStates.CONFIRMED,
    to: BookingStates.CANCELED_PROVIDER,
    event: TransitionEvents.PROVIDER_CANCELS,
    guard: async (ctx) => {
      // Verify provider is the owner
      return ctx.actor.type === 'provider';
    }
  },
  {
    from: BookingStates.CONFIRMED,
    to: BookingStates.NO_SHOW_CUSTOMER,
    event: TransitionEvents.PROVIDER_REPORTS_NO_SHOW,
    guard: async (ctx) => {
      // Verify time has passed
      // Verify provider is the owner
      return ctx.actor.type === 'provider';
    }
  },
  {
    from: BookingStates.CONFIRMED,
    to: BookingStates.NO_SHOW_PROVIDER,
    event: TransitionEvents.CUSTOMER_REPORTS_NO_SHOW,
    guard: async (ctx) => {
      // Verify time has passed
      // Verify customer is the owner
      return ctx.actor.type === 'customer';
    }
  },
  
  // In progress transitions
  {
    from: BookingStates.IN_PROGRESS,
    to: BookingStates.COMPLETED,
    event: TransitionEvents.SERVICE_END
  },
  {
    from: BookingStates.IN_PROGRESS,
    to: BookingStates.CANCELED_CUSTOMER,
    event: TransitionEvents.CUSTOMER_CANCELS,
    guard: async (ctx) => {
      // Mid-service cancellation (rare)
      return ctx.actor.type === 'customer';
    }
  },
  {
    from: BookingStates.IN_PROGRESS,
    to: BookingStates.CANCELED_PROVIDER,
    event: TransitionEvents.PROVIDER_CANCELS,
    guard: async (ctx) => {
      // Mid-service cancellation (rare)
      return ctx.actor.type === 'provider';
    }
  },
  
  // Cancellation to refund transitions
  {
    from: BookingStates.CANCELED_CUSTOMER,
    to: BookingStates.REFUNDED_PARTIAL,
    event: TransitionEvents.REFUND_PARTIAL,
    guard: async (ctx) => {
      // Policy allows partial refund
      return !!ctx.metadata?.refundAmount && ctx.metadata.refundAmount > 0;
    }
  },
  {
    from: BookingStates.CANCELED_CUSTOMER,
    to: BookingStates.REFUNDED_FULL,
    event: TransitionEvents.REFUND_FULL
  },
  {
    from: BookingStates.CANCELED_PROVIDER,
    to: BookingStates.REFUNDED_FULL,
    event: TransitionEvents.REFUND_FULL
  },
  {
    from: BookingStates.NO_SHOW_CUSTOMER,
    to: BookingStates.REFUNDED_PARTIAL,
    event: TransitionEvents.REFUND_PARTIAL,
    guard: async (ctx) => {
      // Provider chooses to issue partial refund
      return ctx.actor.type === 'provider' && !!ctx.metadata?.refundAmount;
    }
  },
  {
    from: BookingStates.NO_SHOW_PROVIDER,
    to: BookingStates.REFUNDED_FULL,
    event: TransitionEvents.REFUND_FULL
  },
  
  // Completed to refund/dispute transitions
  {
    from: BookingStates.COMPLETED,
    to: BookingStates.REFUNDED_PARTIAL,
    event: TransitionEvents.REFUND_PARTIAL,
    guard: async (ctx) => {
      // Within refund window
      return !!ctx.metadata?.refundAmount;
    }
  },
  {
    from: BookingStates.COMPLETED,
    to: BookingStates.REFUNDED_FULL,
    event: TransitionEvents.REFUND_FULL,
    guard: async (ctx) => {
      // Exceptional circumstance
      return ctx.actor.type === 'admin';
    }
  },
  {
    from: BookingStates.COMPLETED,
    to: BookingStates.DISPUTE,
    event: TransitionEvents.DISPUTE_RAISED
  },
  
  // Note: Disputes can only be raised from completed bookings per PRD
];

/**
 * Get valid transitions from a state
 */
export function getValidTransitionsFrom(state: BookingState): StateTransition[] {
  return ValidTransitions.filter(t => t.from === state);
}

/**
 * Check if a transition is valid
 */
export function isTransitionValid(
  from: BookingState,
  to: BookingState,
  event: TransitionEvent
): boolean {
  return ValidTransitions.some(
    t => t.from === from && t.to === to && t.event === event
  );
}

/**
 * Get the target state for an event from current state
 */
export function getTargetState(
  currentState: BookingState,
  event: TransitionEvent
): BookingState | null {
  const transition = ValidTransitions.find(
    t => t.from === currentState && t.event === event
  );
  return transition?.to || null;
}

/**
 * Execute a transition with guards
 */
export async function executeTransition(
  context: TransitionContext
): Promise<{ success: boolean; newState?: BookingState; error?: string }> {
  const transition = ValidTransitions.find(
    t => t.from === context.currentState && t.event === context.event
  );

  if (!transition) {
    return {
      success: false,
      error: `Invalid transition: ${context.currentState} -> ${context.event}`
    };
  }

  // Check guard if present
  if (transition.guard) {
    try {
      const guardPassed = await transition.guard(context);
      if (!guardPassed) {
        return {
          success: false,
          error: `Guard failed for transition: ${context.currentState} -> ${transition.to}`
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Guard error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Execute action if present
  if (transition.action) {
    try {
      await transition.action(context);
    } catch (error) {
      console.error('Transition action error:', error);
      // Actions are side effects, don't block transition
    }
  }

  return {
    success: true,
    newState: transition.to
  };
}

/**
 * Get all possible events for current state
 */
export function getAvailableEvents(state: BookingState): TransitionEvent[] {
  return getValidTransitionsFrom(state).map(t => t.event);
}

/**
 * Validate transition chain (for testing)
 */
export function validateTransitionChain(states: BookingState[]): boolean {
  if (states.length < 2) return true;

  for (let i = 0; i < states.length - 1; i++) {
    const from = states[i];
    const to = states[i + 1];
    
    const hasValidTransition = ValidTransitions.some(
      t => t.from === from && t.to === to
    );
    
    if (!hasValidTransition) {
      return false;
    }
  }
  
  return true;
}