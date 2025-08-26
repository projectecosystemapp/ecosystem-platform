/**
 * Platform Fee Configuration
 * Centralized fee management per Master PRD §1.3 Business Model Constitution
 * 
 * IMMUTABLE RULES:
 * - Base platform commission: 10% (non-negotiable)
 * - Guest surcharge: 10% (non-negotiable)
 * - Provider always receives 90% of base service price
 * - Guest surcharge never affects provider payout
 */

import { z } from 'zod';

/**
 * Fee configuration schema with validation
 */
const FeeConfigSchema = z.object({
  basePlatformFeePercent: z.number().min(0).max(100),
  guestSurchargePercent: z.number().min(0).max(100),
  providerPayoutPercent: z.number().min(0).max(100),
});

/**
 * Platform fee configuration - IMMUTABLE per Master PRD
 * These values MUST NOT be changed without updating the Master PRD
 */
export const PLATFORM_FEE_CONFIG = {
  /**
   * Base platform commission rate
   * Applied to all transactions (authenticated and guest)
   * Master PRD §1.3: "10% commission is mandatory, non-negotiable"
   */
  BASE_PLATFORM_FEE_PERCENT: 10,

  /**
   * Additional surcharge for guest (non-authenticated) users
   * Applied on top of base service price
   * Master PRD §1.3: "Non-authenticated users pay additional +10% fee"
   */
  GUEST_SURCHARGE_PERCENT: 10,

  /**
   * Provider payout percentage of base service price
   * Master PRD §1.3: "Providers always receive 90% of base service price"
   */
  PROVIDER_PAYOUT_PERCENT: 90,

  /**
   * Currency for all transactions
   * Currently only USD supported
   */
  DEFAULT_CURRENCY: 'usd' as const,

  /**
   * Escrow period in days before provider payout
   * Master PRD §4.9.2: Funds held during escrow period
   */
  ESCROW_DAYS: 7,

  /**
   * Minimum service price in cents ($1.00)
   * Prevents micro-transactions that lose money on processing fees
   */
  MIN_SERVICE_PRICE_CENTS: 100,

  /**
   * Maximum service price in cents ($10,000.00)
   * Risk management limit for new providers
   */
  MAX_SERVICE_PRICE_CENTS: 1000000,
} as const;

/**
 * Type-safe fee configuration
 */
export type PlatformFeeConfig = typeof PLATFORM_FEE_CONFIG;

/**
 * Fee calculation result structure
 */
export interface FeeCalculation {
  // Original service price
  baseServicePrice: number;
  
  // What the customer pays
  customerTotal: number;
  
  // What the provider receives
  providerPayout: number;
  
  // Platform's base commission (10% of service price)
  platformCommission: number;
  
  // Additional guest surcharge (10% of service price if guest)
  guestSurcharge: number;
  
  // Total platform revenue (commission + surcharge)
  totalPlatformRevenue: number;
  
  // Whether this is a guest transaction
  isGuest: boolean;
  
  // Currency
  currency: string;
}

/**
 * Calculate fees for a booking transaction
 * 
 * @param servicePrice - Base service price in cents
 * @param isGuest - Whether the customer is a guest (non-authenticated)
 * @returns Detailed fee breakdown
 * 
 * @example
 * // Authenticated user books $100 service
 * calculatePlatformFees(10000, false)
 * // Returns: customer pays $100, provider gets $90, platform gets $10
 * 
 * @example
 * // Guest books $100 service
 * calculatePlatformFees(10000, true)
 * // Returns: customer pays $110, provider gets $90, platform gets $20
 */
export function calculatePlatformFees(
  servicePrice: number,
  isGuest: boolean = false
): FeeCalculation {
  // Validate input
  if (servicePrice < PLATFORM_FEE_CONFIG.MIN_SERVICE_PRICE_CENTS) {
    throw new Error(
      `Service price must be at least ${PLATFORM_FEE_CONFIG.MIN_SERVICE_PRICE_CENTS} cents`
    );
  }

  if (servicePrice > PLATFORM_FEE_CONFIG.MAX_SERVICE_PRICE_CENTS) {
    throw new Error(
      `Service price cannot exceed ${PLATFORM_FEE_CONFIG.MAX_SERVICE_PRICE_CENTS} cents`
    );
  }

  // Calculate base platform commission (10%)
  const platformCommission = Math.round(
    servicePrice * (PLATFORM_FEE_CONFIG.BASE_PLATFORM_FEE_PERCENT / 100)
  );

  // Calculate provider payout (90% of base price)
  const providerPayout = Math.round(
    servicePrice * (PLATFORM_FEE_CONFIG.PROVIDER_PAYOUT_PERCENT / 100)
  );

  // Calculate guest surcharge if applicable (10% of base price)
  const guestSurcharge = isGuest
    ? Math.round(servicePrice * (PLATFORM_FEE_CONFIG.GUEST_SURCHARGE_PERCENT / 100))
    : 0;

  // Calculate customer total
  const customerTotal = servicePrice + guestSurcharge;

  // Calculate total platform revenue
  const totalPlatformRevenue = platformCommission + guestSurcharge;

  // Validate calculations
  if (providerPayout + platformCommission !== servicePrice) {
    console.error('Fee calculation mismatch:', {
      servicePrice,
      providerPayout,
      platformCommission,
      sum: providerPayout + platformCommission,
    });
  }

  return {
    baseServicePrice: servicePrice,
    customerTotal,
    providerPayout,
    platformCommission,
    guestSurcharge,
    totalPlatformRevenue,
    isGuest,
    currency: PLATFORM_FEE_CONFIG.DEFAULT_CURRENCY,
  };
}

/**
 * Format fee calculation for display
 * 
 * @param calculation - Fee calculation result
 * @returns Human-readable fee breakdown
 */
export function formatFeeBreakdown(calculation: FeeCalculation): string[] {
  const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const breakdown = [
    `Service Price: ${formatCents(calculation.baseServicePrice)}`,
    `Platform Fee (10%): ${formatCents(calculation.platformCommission)}`,
  ];

  if (calculation.isGuest) {
    breakdown.push(`Guest Surcharge (10%): ${formatCents(calculation.guestSurcharge)}`);
  }

  breakdown.push(
    `---`,
    `Customer Total: ${formatCents(calculation.customerTotal)}`,
    `Provider Receives: ${formatCents(calculation.providerPayout)}`,
    `Platform Revenue: ${formatCents(calculation.totalPlatformRevenue)}`
  );

  return breakdown;
}

/**
 * Validate that environment variables match Master PRD requirements
 * Should be called during application startup
 */
export function validateFeeConfiguration(): void {
  const envBaseFee = process.env.NEXT_PUBLIC_PLATFORM_FEE_PERCENT
    ? parseFloat(process.env.NEXT_PUBLIC_PLATFORM_FEE_PERCENT)
    : null;

  const envGuestFee = process.env.NEXT_PUBLIC_GUEST_FEE_PERCENT
    ? parseFloat(process.env.NEXT_PUBLIC_GUEST_FEE_PERCENT)
    : null;

  // Check if environment variables are set and match requirements
  if (envBaseFee !== null && envBaseFee !== PLATFORM_FEE_CONFIG.BASE_PLATFORM_FEE_PERCENT) {
    console.warn(
      `⚠️ DEVIATION: Environment variable NEXT_PUBLIC_PLATFORM_FEE_PERCENT (${envBaseFee}%) ` +
      `does not match Master PRD requirement (${PLATFORM_FEE_CONFIG.BASE_PLATFORM_FEE_PERCENT}%). ` +
      `Using Master PRD value.`
    );
  }

  if (envGuestFee !== null && envGuestFee !== PLATFORM_FEE_CONFIG.GUEST_SURCHARGE_PERCENT) {
    console.warn(
      `⚠️ DEVIATION: Environment variable NEXT_PUBLIC_GUEST_FEE_PERCENT (${envGuestFee}%) ` +
      `does not match Master PRD requirement (${PLATFORM_FEE_CONFIG.GUEST_SURCHARGE_PERCENT}%). ` +
      `Using Master PRD value.`
    );
  }
}

/**
 * Get fee configuration for API responses
 * Returns configuration that can be safely exposed to clients
 */
export function getPublicFeeConfig() {
  return {
    basePlatformFeePercent: PLATFORM_FEE_CONFIG.BASE_PLATFORM_FEE_PERCENT,
    guestSurchargePercent: PLATFORM_FEE_CONFIG.GUEST_SURCHARGE_PERCENT,
    currency: PLATFORM_FEE_CONFIG.DEFAULT_CURRENCY,
    minServicePrice: PLATFORM_FEE_CONFIG.MIN_SERVICE_PRICE_CENTS,
    maxServicePrice: PLATFORM_FEE_CONFIG.MAX_SERVICE_PRICE_CENTS,
  };
}

// Export for testing
export const _testing = {
  FeeConfigSchema,
};