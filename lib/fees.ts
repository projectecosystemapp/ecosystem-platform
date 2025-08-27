/**
 * Fee Calculation Service
 * 
 * Centralized fee calculation for the marketplace
 * Platform takes 10% commission on all transactions
 * Guests pay additional 10% surcharge
 */

export interface FeeBreakdown {
  baseAmount: number;          // Original service price
  platformFee: number;          // 10% platform commission
  guestSurcharge: number;       // 10% guest surcharge (0 for authenticated users)
  totalAmount: number;          // Total amount customer pays
  providerPayout: number;       // Amount provider receives (always 90% of base)
  currency: string;
}

export const PLATFORM_FEE_PERCENTAGE = 0.10;    // 10% platform fee
export const GUEST_SURCHARGE_PERCENTAGE = 0.10; // 10% guest surcharge

/**
 * Calculate fees for a booking
 * 
 * Business Rules:
 * - Platform always takes 10% commission
 * - Guests pay additional 10% surcharge (110% total)
 * - Authenticated customers pay 100% (no surcharge)
 * - Providers always receive 90% of base amount
 */
export function calculateFees(
  baseAmount: number,
  isGuest: boolean = false,
  currency: string = 'usd'
): FeeBreakdown {
  // Validate input
  if (baseAmount < 0) {
    throw new Error('Base amount cannot be negative');
  }

  // Calculate platform fee (always 10%)
  const platformFee = Math.round(baseAmount * PLATFORM_FEE_PERCENTAGE * 100) / 100;
  
  // Calculate guest surcharge (10% for guests, 0% for authenticated users)
  const guestSurcharge = isGuest 
    ? Math.round(baseAmount * GUEST_SURCHARGE_PERCENTAGE * 100) / 100
    : 0;

  // Calculate provider payout (always 90% of base amount)
  const providerPayout = Math.round((baseAmount - platformFee) * 100) / 100;

  // Calculate total amount customer pays
  const totalAmount = Math.round((baseAmount + guestSurcharge) * 100) / 100;

  return {
    baseAmount,
    platformFee,
    guestSurcharge,
    totalAmount,
    providerPayout,
    currency,
  };
}

/**
 * Convert amount to Stripe's smallest currency unit (cents for USD)
 */
export function toStripeCents(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Convert from Stripe's smallest currency unit to dollars
 */
export function fromStripeCents(cents: number): number {
  return Math.round(cents) / 100;
}

/**
 * Format amount as currency string
 */
export function formatCurrency(
  amount: number,
  currency: string = 'usd',
  locale: string = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Calculate refund amounts
 * 
 * Business Rules:
 * - Full refund: Return everything to customer, reverse platform fee
 * - Partial refund: Proportional fee reversal
 */
export function calculateRefund(
  originalFees: FeeBreakdown,
  refundAmount: number,
  isPartial: boolean = false
): {
  customerRefund: number;
  platformFeeReversal: number;
  providerDebit: number;
} {
  if (isPartial) {
    // Partial refund: Calculate proportional amounts
    const refundPercentage = refundAmount / originalFees.totalAmount;
    
    return {
      customerRefund: refundAmount,
      platformFeeReversal: Math.round(originalFees.platformFee * refundPercentage * 100) / 100,
      providerDebit: Math.round(originalFees.providerPayout * refundPercentage * 100) / 100,
    };
  } else {
    // Full refund: Return everything
    return {
      customerRefund: originalFees.totalAmount,
      platformFeeReversal: originalFees.platformFee,
      providerDebit: originalFees.providerPayout,
    };
  }
}

/**
 * Validate fee calculation for consistency
 */
export function validateFees(fees: FeeBreakdown): boolean {
  const expectedTotal = fees.baseAmount + fees.guestSurcharge;
  const expectedPayout = fees.baseAmount - fees.platformFee;
  
  const totalDiff = Math.abs(fees.totalAmount - expectedTotal);
  const payoutDiff = Math.abs(fees.providerPayout - expectedPayout);
  
  // Allow for small rounding differences (< 1 cent)
  return totalDiff < 0.01 && payoutDiff < 0.01;
}

/**
 * Calculate platform revenue for a period
 */
export function calculatePlatformRevenue(bookings: FeeBreakdown[]): {
  totalRevenue: number;
  platformFees: number;
  guestSurcharges: number;
  bookingCount: number;
  averageBookingValue: number;
} {
  const totalRevenue = bookings.reduce((sum, b) => sum + b.platformFee + b.guestSurcharge, 0);
  const platformFees = bookings.reduce((sum, b) => sum + b.platformFee, 0);
  const guestSurcharges = bookings.reduce((sum, b) => sum + b.guestSurcharge, 0);
  const bookingCount = bookings.length;
  const averageBookingValue = bookingCount > 0 
    ? bookings.reduce((sum, b) => sum + b.baseAmount, 0) / bookingCount
    : 0;

  return {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    platformFees: Math.round(platformFees * 100) / 100,
    guestSurcharges: Math.round(guestSurcharges * 100) / 100,
    bookingCount,
    averageBookingValue: Math.round(averageBookingValue * 100) / 100,
  };
}