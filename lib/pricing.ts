/**
 * Pricing and Fee Calculation Utilities
 * 
 * This module provides centralized pricing logic for the marketplace
 * including dynamic pricing, platform fees, and surge pricing
 */

import { db } from "@/db/db";
import { 
  pricingRulesTable, 
  surgePricingEventsTable,
  demandMetricsTable 
} from "@/db/schema/pricing-schema";
import { servicesTable } from "@/db/schema/enhanced-booking-schema";
import { and, eq, gte, lte, or, sql } from "drizzle-orm";

// Platform fee constants
export const PLATFORM_FEE_PERCENT = 0.10; // 10% platform fee
export const GUEST_SURCHARGE_PERCENT = 0.10; // Additional 10% for guests
export const STRIPE_FEE_PERCENT = 0.029; // 2.9% + $0.30
export const STRIPE_FEE_FIXED_CENTS = 30;

export interface PricingBreakdown {
  basePrice: number;
  dynamicPrice: number;
  surgeMultiplier?: number;
  platformFee: number;
  guestSurcharge?: number;
  stripeFee: number;
  providerPayout: number;
  customerTotal: number;
  savingsAmount?: number;
  savingsPercent?: number;
}

export interface FeeCalculation {
  subtotal: number;
  platformFeeCents: number;
  guestSurchargeCents?: number;
  stripeFeeCents: number;
  totalCents: number;
  providerPayoutCents: number;
}

/**
 * Calculate all fees for a transaction
 * @param baseAmountCents - Base amount in cents
 * @param isGuest - Whether the customer is a guest
 * @returns Fee breakdown in cents
 */
export function calculateFees(baseAmountCents: number, isGuest: boolean = false): FeeCalculation {
  // Platform fee (10% of base amount)
  const platformFeeCents = Math.round(baseAmountCents * PLATFORM_FEE_PERCENT);
  
  // Guest surcharge (additional 10% for non-authenticated users)
  const guestSurchargeCents = isGuest 
    ? Math.round(baseAmountCents * GUEST_SURCHARGE_PERCENT)
    : 0;
  
  // Total amount customer pays
  const customerTotalCents = baseAmountCents + guestSurchargeCents;
  
  // Stripe processing fee (2.9% + $0.30 on the total customer payment)
  const stripeFeeCents = Math.round(customerTotalCents * STRIPE_FEE_PERCENT) + STRIPE_FEE_FIXED_CENTS;
  
  // Provider receives: base amount - platform fee - stripe fee
  const providerPayoutCents = baseAmountCents - platformFeeCents - stripeFeeCents;
  
  return {
    subtotal: baseAmountCents,
    platformFeeCents,
    guestSurchargeCents: isGuest ? guestSurchargeCents : undefined,
    stripeFeeCents,
    totalCents: customerTotalCents,
    providerPayoutCents,
  };
}

/**
 * Calculate dynamic price for a service
 * @param serviceId - Service ID
 * @param providerId - Provider ID
 * @param requestedDate - Date/time for the service
 * @param duration - Duration in minutes (for hourly pricing)
 * @param groupSize - Number of people
 * @returns Dynamic pricing calculation
 */
export async function calculateDynamicPrice(
  serviceId: string,
  providerId: string,
  requestedDate: Date = new Date(),
  duration?: number,
  groupSize: number = 1
): Promise<{ basePrice: number; finalPrice: number; surgeMultiplier?: number }> {
  // Get service base price
  const service = await db.select({
    basePrice: servicesTable.basePrice,
    priceType: servicesTable.priceType,
    minimumDuration: servicesTable.minimumDuration,
  })
  .from(servicesTable)
  .where(and(
    eq(servicesTable.id, serviceId),
    eq(servicesTable.providerId, providerId)
  ))
  .limit(1);
  
  if (!service.length) {
    throw new Error("Service not found");
  }
  
  let basePrice = parseFloat(service[0].basePrice);
  
  // Adjust for duration if hourly
  if (service[0].priceType === 'hourly' && duration) {
    const hours = duration / 60;
    basePrice = basePrice * hours;
  }
  
  // Adjust for group size
  basePrice = basePrice * groupSize;
  
  // Check for active surge pricing
  const surgePricing = await db.select()
    .from(surgePricingEventsTable)
    .where(and(
      eq(surgePricingEventsTable.providerId, providerId),
      eq(surgePricingEventsTable.isActive, true),
      lte(surgePricingEventsTable.startTime, requestedDate),
      gte(surgePricingEventsTable.endTime, requestedDate)
    ))
    .limit(1);
  
  let finalPrice = basePrice;
  let surgeMultiplier: number | undefined;
  
  if (surgePricing.length > 0) {
    const surge = surgePricing[0];
    const affectedServices = surge.affectedServices as string[] || [];
    
    // Apply surge if it affects this service or all services
    if (affectedServices.length === 0 || affectedServices.includes(serviceId)) {
      surgeMultiplier = parseFloat(surge.surgeMultiplier);
      finalPrice = basePrice * surgeMultiplier;
    }
  }
  
  // Round to 2 decimal places
  finalPrice = Math.round(finalPrice * 100) / 100;
  
  return {
    basePrice,
    finalPrice,
    surgeMultiplier,
  };
}

/**
 * Get complete pricing breakdown for a booking
 * @param serviceId - Service ID
 * @param providerId - Provider ID
 * @param isGuest - Whether customer is a guest
 * @param requestedDate - Service date/time
 * @param duration - Duration in minutes
 * @param groupSize - Number of people
 * @returns Complete pricing breakdown
 */
export async function getPricingBreakdown(
  serviceId: string,
  providerId: string,
  isGuest: boolean,
  requestedDate?: Date,
  duration?: number,
  groupSize: number = 1
): Promise<PricingBreakdown> {
  // Calculate dynamic price
  const { basePrice, finalPrice, surgeMultiplier } = await calculateDynamicPrice(
    serviceId,
    providerId,
    requestedDate,
    duration,
    groupSize
  );
  
  // Convert to cents for fee calculation
  const finalPriceCents = Math.round(finalPrice * 100);
  
  // Calculate fees
  const fees = calculateFees(finalPriceCents, isGuest);
  
  // Calculate savings if applicable
  let savingsAmount: number | undefined;
  let savingsPercent: number | undefined;
  
  if (finalPrice < basePrice) {
    savingsAmount = basePrice - finalPrice;
    savingsPercent = (savingsAmount / basePrice) * 100;
  }
  
  return {
    basePrice,
    dynamicPrice: finalPrice,
    surgeMultiplier,
    platformFee: fees.platformFeeCents / 100,
    guestSurcharge: fees.guestSurchargeCents ? fees.guestSurchargeCents / 100 : undefined,
    stripeFee: fees.stripeFeeCents / 100,
    providerPayout: fees.providerPayoutCents / 100,
    customerTotal: fees.totalCents / 100,
    savingsAmount,
    savingsPercent,
  };
}

/**
 * Format price for display
 * @param cents - Amount in cents
 * @param currency - Currency code (default USD)
 * @returns Formatted price string
 */
export function formatPrice(cents: number, currency: string = 'USD'): string {
  const amount = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Calculate provider's net earnings after all fees
 * @param grossAmountCents - Gross booking amount in cents
 * @returns Net amount provider receives
 */
export function calculateProviderEarnings(grossAmountCents: number): number {
  const platformFeeCents = Math.round(grossAmountCents * PLATFORM_FEE_PERCENT);
  const stripeFeeCents = Math.round(grossAmountCents * STRIPE_FEE_PERCENT) + STRIPE_FEE_FIXED_CENTS;
  return grossAmountCents - platformFeeCents - stripeFeeCents;
}

/**
 * Validate that a price is within acceptable bounds
 * @param priceCents - Price in cents
 * @param minCents - Minimum price in cents
 * @param maxCents - Maximum price in cents
 * @returns Validated price
 */
export function validatePrice(
  priceCents: number,
  minCents: number = 100, // $1 minimum
  maxCents: number = 100000000 // $1M maximum
): number {
  if (priceCents < minCents) {
    return minCents;
  }
  if (priceCents > maxCents) {
    return maxCents;
  }
  return priceCents;
}

/**
 * Get demand level based on score
 * @param score - Demand score (0-10)
 * @returns Demand level string
 */
export function getDemandLevel(score: number): string {
  if (score < 2) return 'Very Low';
  if (score < 4) return 'Low';
  if (score < 6) return 'Normal';
  if (score < 7.5) return 'High';
  if (score < 9) return 'Very High';
  return 'Extreme';
}

/**
 * Calculate surge multiplier based on demand
 * @param demandScore - Current demand score (0-10)
 * @param maxMultiplier - Maximum surge multiplier
 * @returns Suggested surge multiplier
 */
export function calculateSurgeMultiplier(
  demandScore: number,
  maxMultiplier: number = 2.0
): number {
  // Linear scaling from 1.0 to maxMultiplier based on demand score
  if (demandScore <= 5) return 1.0; // No surge for normal demand
  
  const normalizedScore = (demandScore - 5) / 5; // Normalize 5-10 to 0-1
  const multiplier = 1.0 + (normalizedScore * (maxMultiplier - 1.0));
  
  return Math.round(multiplier * 100) / 100; // Round to 2 decimal places
}