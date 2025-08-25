/**
 * Centralized Fee Calculator for Ecosystem Marketplace
 * 
 * Business Rules:
 * - Platform takes 10% base fee from all transactions
 * - Guest users pay additional 10% surcharge (20% total for platform)
 * - Providers receive 90% of base price regardless of guest status
 * - All amounts are calculated in cents to avoid floating point issues
 */

export interface FeeCalculationInput {
  baseAmountCents: number; // Base price in cents
  isGuest: boolean; // Whether this is a guest checkout
  providerCommissionRate?: number; // Optional custom commission rate (0-1, default 0.10)
}

export interface FeeCalculationResult {
  // Customer pays
  customerTotalCents: number; // Total amount customer pays (including any surcharges)
  guestSurchargeCents: number; // Additional amount guests pay (0 for authenticated users)
  
  // Platform receives
  platformFeeCents: number; // Platform's commission from the transaction
  platformTotalRevenueCents: number; // Total platform revenue (fee + guest surcharge)
  
  // Provider receives
  providerPayoutCents: number; // Amount provider receives after platform fee
  
  // Percentages for display
  effectiveCustomerRate: number; // Effective rate customer pays (1.0 for auth, 1.1 for guest)
  platformFeeRate: number; // Platform's commission rate
  providerPayoutRate: number; // Provider's payout rate (typically 0.9)
  
  // Human-readable amounts (for display)
  displayAmounts: {
    customerTotal: string; // Formatted for display (e.g., "$110.00")
    guestSurcharge: string; // Formatted for display (e.g., "$10.00")
    platformFee: string; // Formatted for display (e.g., "$10.00")
    platformTotalRevenue: string; // Formatted for display (e.g., "$20.00")
    providerPayout: string; // Formatted for display (e.g., "$90.00")
    baseAmount: string; // Formatted for display (e.g., "$100.00")
  };
}

// Constants
export const DEFAULT_PLATFORM_FEE_RATE = 0.10; // 10% platform fee
export const GUEST_SURCHARGE_RATE = 0.10; // 10% guest surcharge
export const MIN_TRANSACTION_CENTS = 50; // Minimum $0.50 transaction (Stripe minimum)
export const MAX_TRANSACTION_CENTS = 99999999; // Maximum ~$1M transaction

/**
 * Calculate all fees and amounts for a transaction
 */
export function calculateFees(input: FeeCalculationInput): FeeCalculationResult {
  // Validate input
  validateInput(input);
  
  const {
    baseAmountCents,
    isGuest,
    providerCommissionRate = DEFAULT_PLATFORM_FEE_RATE
  } = input;
  
  // Ensure commission rate is valid
  const platformFeeRate = Math.min(Math.max(providerCommissionRate, 0), 1);
  
  // Calculate platform fee (always 10% of base or custom rate)
  const platformFeeCents = Math.round(baseAmountCents * platformFeeRate);
  
  // Calculate guest surcharge (10% of base if guest, 0 otherwise)
  const guestSurchargeCents = isGuest 
    ? Math.round(baseAmountCents * GUEST_SURCHARGE_RATE)
    : 0;
  
  // Calculate customer total
  const customerTotalCents = baseAmountCents + guestSurchargeCents;
  
  // Calculate provider payout (base minus platform fee)
  const providerPayoutCents = baseAmountCents - platformFeeCents;
  
  // Calculate total platform revenue
  const platformTotalRevenueCents = platformFeeCents + guestSurchargeCents;
  
  // Calculate rates
  const effectiveCustomerRate = customerTotalCents / baseAmountCents;
  const providerPayoutRate = providerPayoutCents / baseAmountCents;
  
  return {
    // Customer amounts
    customerTotalCents,
    guestSurchargeCents,
    
    // Platform amounts
    platformFeeCents,
    platformTotalRevenueCents,
    
    // Provider amounts
    providerPayoutCents,
    
    // Rates
    effectiveCustomerRate,
    platformFeeRate,
    providerPayoutRate,
    
    // Display amounts
    displayAmounts: {
      customerTotal: formatCentsToDisplay(customerTotalCents),
      guestSurcharge: formatCentsToDisplay(guestSurchargeCents),
      platformFee: formatCentsToDisplay(platformFeeCents),
      platformTotalRevenue: formatCentsToDisplay(platformTotalRevenueCents),
      providerPayout: formatCentsToDisplay(providerPayoutCents),
      baseAmount: formatCentsToDisplay(baseAmountCents),
    }
  };
}

/**
 * Calculate fees from a dollar amount (converts to cents internally)
 */
export function calculateFeesFromDollars(
  baseAmountDollars: number,
  isGuest: boolean,
  providerCommissionRate?: number
): FeeCalculationResult {
  const baseAmountCents = dollarsToCents(baseAmountDollars);
  return calculateFees({
    baseAmountCents,
    isGuest,
    providerCommissionRate
  });
}

/**
 * Validate that guest will pay the expected surcharge
 */
export function validateGuestPricing(
  baseAmountCents: number,
  customerPaymentCents: number,
  isGuest: boolean
): { valid: boolean; expectedCents: number; difference: number } {
  const fees = calculateFees({ baseAmountCents, isGuest });
  const expectedCents = fees.customerTotalCents;
  const difference = customerPaymentCents - expectedCents;
  
  // Allow for small rounding differences (±1 cent)
  const valid = Math.abs(difference) <= 1;
  
  return {
    valid,
    expectedCents,
    difference
  };
}

/**
 * Calculate provider earnings for a period
 */
export function calculateProviderEarnings(
  transactions: Array<{
    baseAmountCents: number;
    isGuest: boolean;
    providerCommissionRate?: number;
  }>
): {
  totalPayoutCents: number;
  totalTransactions: number;
  averageTransactionCents: number;
  displayAmounts: {
    totalPayout: string;
    averageTransaction: string;
  };
} {
  if (transactions.length === 0) {
    return {
      totalPayoutCents: 0,
      totalTransactions: 0,
      averageTransactionCents: 0,
      displayAmounts: {
        totalPayout: "$0.00",
        averageTransaction: "$0.00"
      }
    };
  }
  
  const totalPayoutCents = transactions.reduce((sum, transaction) => {
    const fees = calculateFees(transaction);
    return sum + fees.providerPayoutCents;
  }, 0);
  
  const averageTransactionCents = Math.round(totalPayoutCents / transactions.length);
  
  return {
    totalPayoutCents,
    totalTransactions: transactions.length,
    averageTransactionCents,
    displayAmounts: {
      totalPayout: formatCentsToDisplay(totalPayoutCents),
      averageTransaction: formatCentsToDisplay(averageTransactionCents)
    }
  };
}

/**
 * Calculate platform revenue for a period
 */
export function calculatePlatformRevenue(
  transactions: Array<{
    baseAmountCents: number;
    isGuest: boolean;
    providerCommissionRate?: number;
  }>
): {
  totalRevenueCents: number;
  totalFeeCents: number;
  totalSurchargeCents: number;
  guestTransactionCount: number;
  authenticatedTransactionCount: number;
  displayAmounts: {
    totalRevenue: string;
    totalFees: string;
    totalSurcharges: string;
  };
} {
  let totalFeeCents = 0;
  let totalSurchargeCents = 0;
  let guestTransactionCount = 0;
  let authenticatedTransactionCount = 0;
  
  transactions.forEach(transaction => {
    const fees = calculateFees(transaction);
    totalFeeCents += fees.platformFeeCents;
    totalSurchargeCents += fees.guestSurchargeCents;
    
    if (transaction.isGuest) {
      guestTransactionCount++;
    } else {
      authenticatedTransactionCount++;
    }
  });
  
  const totalRevenueCents = totalFeeCents + totalSurchargeCents;
  
  return {
    totalRevenueCents,
    totalFeeCents,
    totalSurchargeCents,
    guestTransactionCount,
    authenticatedTransactionCount,
    displayAmounts: {
      totalRevenue: formatCentsToDisplay(totalRevenueCents),
      totalFees: formatCentsToDisplay(totalFeeCents),
      totalSurcharges: formatCentsToDisplay(totalSurchargeCents)
    }
  };
}

// Utility functions

/**
 * Convert dollars to cents (handling floating point precision)
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * Convert cents to dollars
 */
export function centsToDollars(cents: number): number {
  return cents / 100;
}

/**
 * Format cents to display string (e.g., 10000 -> "$100.00")
 */
export function formatCentsToDisplay(cents: number, currency = "USD"): string {
  const dollars = centsToDollars(cents);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(dollars);
}

/**
 * Parse display string to cents (e.g., "$100.00" -> 10000)
 */
export function parseDisplayToCents(display: string): number {
  // Remove currency symbols and commas
  const cleaned = display.replace(/[^0-9.-]/g, '');
  const dollars = parseFloat(cleaned);
  
  if (isNaN(dollars)) {
    throw new Error(`Invalid amount format: ${display}`);
  }
  
  return dollarsToCents(dollars);
}

/**
 * Validate input amounts
 */
function validateInput(input: FeeCalculationInput): void {
  const { baseAmountCents } = input;
  
  if (!Number.isInteger(baseAmountCents)) {
    throw new Error('Amount must be an integer (in cents)');
  }
  
  if (baseAmountCents < MIN_TRANSACTION_CENTS) {
    throw new Error(`Minimum transaction amount is ${formatCentsToDisplay(MIN_TRANSACTION_CENTS)}`);
  }
  
  if (baseAmountCents > MAX_TRANSACTION_CENTS) {
    throw new Error(`Maximum transaction amount is ${formatCentsToDisplay(MAX_TRANSACTION_CENTS)}`);
  }
}

/**
 * Create a fee breakdown for display
 */
export function createFeeBreakdown(fees: FeeCalculationResult): Array<{
  label: string;
  amount: string;
  type: 'charge' | 'fee' | 'surcharge' | 'payout';
}> {
  const breakdown = [
    {
      label: 'Service Amount',
      amount: fees.displayAmounts.baseAmount,
      type: 'charge' as const
    }
  ];
  
  if (fees.guestSurchargeCents > 0) {
    breakdown.push({
      label: 'Guest Service Fee',
      amount: fees.displayAmounts.guestSurcharge,
      type: 'surcharge' as 'surcharge'
    });
  }
  
  breakdown.push(
    {
      label: 'Total Charge',
      amount: fees.displayAmounts.customerTotal,
      type: 'charge' as const
    },
    {
      label: 'Platform Fee',
      amount: fees.displayAmounts.platformFee,
      type: 'fee' as 'fee'
    },
    {
      label: 'Provider Payout',
      amount: fees.displayAmounts.providerPayout,
      type: 'payout' as const
    }
  );
  
  return breakdown;
}