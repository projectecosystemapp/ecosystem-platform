/**
 * Booking State Definitions
 * Per Master PRD §4.7.1 - All 13 booking states
 * 
 * States:
 * draft → hold → pending_provider → confirmed → in_progress → completed
 * → canceled_customer → canceled_provider → no_show_customer → no_show_provider
 * → refunded_partial → refunded_full → dispute
 */

/**
 * All possible booking states
 */
export const BookingStates = {
  // Initial states
  DRAFT: 'draft',                           // Booking being created, not yet paid
  HOLD: 'hold',                             // Slot held for 10 minutes during payment
  
  // Payment & confirmation states  
  PENDING_PROVIDER: 'pending_provider',     // Payment authorized, awaiting provider acceptance
  CONFIRMED: 'confirmed',                   // Provider accepted, payment captured
  
  // Service states
  IN_PROGRESS: 'in_progress',              // Service currently being delivered
  COMPLETED: 'completed',                   // Service successfully completed
  
  // Cancellation states
  CANCELED_CUSTOMER: 'canceled_customer',   // Customer initiated cancellation
  CANCELED_PROVIDER: 'canceled_provider',   // Provider initiated cancellation
  
  // No-show states
  NO_SHOW_CUSTOMER: 'no_show_customer',    // Customer didn't show up
  NO_SHOW_PROVIDER: 'no_show_provider',    // Provider didn't show up
  
  // Refund states
  REFUNDED_PARTIAL: 'refunded_partial',    // Partial refund issued
  REFUNDED_FULL: 'refunded_full',          // Full refund issued
  
  // Dispute state
  DISPUTE: 'dispute'                       // Payment disputed/chargeback
} as const;

export type BookingState = typeof BookingStates[keyof typeof BookingStates];

/**
 * State metadata and properties
 */
export interface StateMetadata {
  name: BookingState;
  displayName: string;
  description: string;
  isTerminal: boolean;          // No transitions allowed from this state
  requiresPayment: boolean;      // Payment must be completed
  requiresProvider: boolean;     // Provider action required
  requiresCustomer: boolean;     // Customer action required
  allowsRefund: boolean;        // Refunds can be issued
  allowsDispute: boolean;       // Disputes can be raised
  notifyCustomer: boolean;      // Send customer notification
  notifyProvider: boolean;      // Send provider notification
  maxDuration?: number;          // Max time in state (minutes)
}

/**
 * Complete state configuration
 */
export const StateConfigurations: Record<BookingState, StateMetadata> = {
  [BookingStates.DRAFT]: {
    name: BookingStates.DRAFT,
    displayName: 'Draft',
    description: 'Booking is being created',
    isTerminal: false,
    requiresPayment: false,
    requiresProvider: false,
    requiresCustomer: true,
    allowsRefund: false,
    allowsDispute: false,
    notifyCustomer: false,
    notifyProvider: false,
    maxDuration: 30 // 30 minutes to complete
  },
  
  [BookingStates.HOLD]: {
    name: BookingStates.HOLD,
    displayName: 'Hold',
    description: 'Time slot is held during payment',
    isTerminal: false,
    requiresPayment: true,
    requiresProvider: false,
    requiresCustomer: true,
    allowsRefund: false,
    allowsDispute: false,
    notifyCustomer: false,
    notifyProvider: false,
    maxDuration: 10 // 10 minutes TTL per Master PRD
  },
  
  [BookingStates.PENDING_PROVIDER]: {
    name: BookingStates.PENDING_PROVIDER,
    displayName: 'Pending Provider',
    description: 'Awaiting provider acceptance',
    isTerminal: false,
    requiresPayment: true,
    requiresProvider: true,
    requiresCustomer: false,
    allowsRefund: true,
    allowsDispute: false,
    notifyCustomer: true,
    notifyProvider: true,
    maxDuration: 1440 // 24 hours per Master PRD
  },
  
  [BookingStates.CONFIRMED]: {
    name: BookingStates.CONFIRMED,
    displayName: 'Confirmed',
    description: 'Booking is confirmed and scheduled',
    isTerminal: false,
    requiresPayment: true,
    requiresProvider: false,
    requiresCustomer: false,
    allowsRefund: true,
    allowsDispute: false,
    notifyCustomer: true,
    notifyProvider: true,
    maxDuration: undefined // Until service date
  },
  
  [BookingStates.IN_PROGRESS]: {
    name: BookingStates.IN_PROGRESS,
    displayName: 'In Progress',
    description: 'Service is being delivered',
    isTerminal: false,
    requiresPayment: true,
    requiresProvider: true,
    requiresCustomer: true,
    allowsRefund: false,
    allowsDispute: true,
    notifyCustomer: false,
    notifyProvider: false,
    maxDuration: undefined // Based on service duration
  },
  
  [BookingStates.COMPLETED]: {
    name: BookingStates.COMPLETED,
    displayName: 'Completed',
    description: 'Service successfully completed',
    isTerminal: false, // Can still transition to refund/dispute
    requiresPayment: true,
    requiresProvider: false,
    requiresCustomer: false,
    allowsRefund: true,
    allowsDispute: true,
    notifyCustomer: true,
    notifyProvider: true,
    maxDuration: undefined
  },
  
  [BookingStates.CANCELED_CUSTOMER]: {
    name: BookingStates.CANCELED_CUSTOMER,
    displayName: 'Canceled by Customer',
    description: 'Customer canceled the booking',
    isTerminal: false, // Can transition to refund
    requiresPayment: false,
    requiresProvider: false,
    requiresCustomer: false,
    allowsRefund: true,
    allowsDispute: false,
    notifyCustomer: true,
    notifyProvider: true,
    maxDuration: undefined
  },
  
  [BookingStates.CANCELED_PROVIDER]: {
    name: BookingStates.CANCELED_PROVIDER,
    displayName: 'Canceled by Provider',
    description: 'Provider canceled the booking',
    isTerminal: false, // Can transition to refund
    requiresPayment: false,
    requiresProvider: false,
    requiresCustomer: false,
    allowsRefund: true,
    allowsDispute: false,
    notifyCustomer: true,
    notifyProvider: true,
    maxDuration: undefined
  },
  
  [BookingStates.NO_SHOW_CUSTOMER]: {
    name: BookingStates.NO_SHOW_CUSTOMER,
    displayName: 'Customer No-Show',
    description: 'Customer did not show up',
    isTerminal: false, // Can transition to refund
    requiresPayment: false,
    requiresProvider: false,
    requiresCustomer: false,
    allowsRefund: true, // Provider may choose to refund
    allowsDispute: true,
    notifyCustomer: true,
    notifyProvider: true,
    maxDuration: undefined
  },
  
  [BookingStates.NO_SHOW_PROVIDER]: {
    name: BookingStates.NO_SHOW_PROVIDER,
    displayName: 'Provider No-Show',
    description: 'Provider did not show up',
    isTerminal: false, // Will transition to full refund
    requiresPayment: false,
    requiresProvider: false,
    requiresCustomer: false,
    allowsRefund: true, // Automatic full refund
    allowsDispute: false,
    notifyCustomer: true,
    notifyProvider: true,
    maxDuration: undefined
  },
  
  [BookingStates.REFUNDED_PARTIAL]: {
    name: BookingStates.REFUNDED_PARTIAL,
    displayName: 'Partially Refunded',
    description: 'Partial refund has been issued',
    isTerminal: true,
    requiresPayment: false,
    requiresProvider: false,
    requiresCustomer: false,
    allowsRefund: false,
    allowsDispute: true,
    notifyCustomer: true,
    notifyProvider: true,
    maxDuration: undefined
  },
  
  [BookingStates.REFUNDED_FULL]: {
    name: BookingStates.REFUNDED_FULL,
    displayName: 'Fully Refunded',
    description: 'Full refund has been issued',
    isTerminal: true,
    requiresPayment: false,
    requiresProvider: false,
    requiresCustomer: false,
    allowsRefund: false,
    allowsDispute: false,
    notifyCustomer: true,
    notifyProvider: true,
    maxDuration: undefined
  },
  
  [BookingStates.DISPUTE]: {
    name: BookingStates.DISPUTE,
    displayName: 'Disputed',
    description: 'Payment is disputed or chargeback initiated',
    isTerminal: true, // Requires manual resolution
    requiresPayment: false,
    requiresProvider: false,
    requiresCustomer: false,
    allowsRefund: false,
    allowsDispute: false,
    notifyCustomer: true,
    notifyProvider: true,
    maxDuration: undefined
  }
};

/**
 * State categories for grouping and UI display
 */
export const StateCategories = {
  ACTIVE: [
    BookingStates.DRAFT,
    BookingStates.HOLD,
    BookingStates.PENDING_PROVIDER,
    BookingStates.CONFIRMED,
    BookingStates.IN_PROGRESS
  ],
  COMPLETED: [
    BookingStates.COMPLETED
  ],
  CANCELED: [
    BookingStates.CANCELED_CUSTOMER,
    BookingStates.CANCELED_PROVIDER,
    BookingStates.NO_SHOW_CUSTOMER,
    BookingStates.NO_SHOW_PROVIDER
  ],
  REFUNDED: [
    BookingStates.REFUNDED_PARTIAL,
    BookingStates.REFUNDED_FULL
  ],
  DISPUTED: [
    BookingStates.DISPUTE
  ]
} as const;

/**
 * Get state category
 */
export function getStateCategory(state: BookingState): keyof typeof StateCategories | null {
  for (const [category, states] of Object.entries(StateCategories)) {
    if (states.includes(state as any)) {
      return category as keyof typeof StateCategories;
    }
  }
  return null;
}

/**
 * Check if state is terminal (no further transitions allowed)
 */
export function isTerminalState(state: BookingState): boolean {
  return StateConfigurations[state].isTerminal;
}

/**
 * Check if state allows refunds
 */
export function allowsRefund(state: BookingState): boolean {
  return StateConfigurations[state].allowsRefund;
}

/**
 * Check if state allows disputes
 */
export function allowsDispute(state: BookingState): boolean {
  return StateConfigurations[state].allowsDispute;
}

/**
 * Get states that require provider action
 */
export function getProviderActionStates(): BookingState[] {
  return Object.values(BookingStates).filter(
    state => StateConfigurations[state].requiresProvider
  );
}

/**
 * Get states that require customer action
 */
export function getCustomerActionStates(): BookingState[] {
  return Object.values(BookingStates).filter(
    state => StateConfigurations[state].requiresCustomer
  );
}