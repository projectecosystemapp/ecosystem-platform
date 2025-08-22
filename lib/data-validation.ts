/**
 * Comprehensive Data Validation and Consistency Checks
 * Ensures data integrity across the booking system
 */

import { db } from "@/db/db";
import { 
  bookingsTable, 
  transactionsTable,
  bookingStatus,
  type Booking,
  type NewBooking 
} from "@/db/schema/bookings-schema";
import { 
  providersTable,
  providerAvailabilityTable,
  providerBlockedSlotsTable,
  type Provider 
} from "@/db/schema/providers-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { reviewsTable } from "@/db/schema/reviews-schema";
import { eq, and, or, gte, lte, between, sql, ne, isNull } from "drizzle-orm";
import { z } from "zod";
import { isValid, parseISO, isFuture, isPast, isToday, format } from "date-fns";

// ===========================
// VALIDATION SCHEMAS
// ===========================

export const BookingValidationSchema = z.object({
  providerId: z.string().uuid("Invalid provider ID"),
  customerId: z.string().min(1, "Customer ID is required"),
  serviceName: z.string().min(1, "Service name is required"),
  servicePrice: z.number().positive("Service price must be positive"),
  serviceDuration: z.number().min(15, "Service duration must be at least 15 minutes"),
  bookingDate: z.date().refine(date => !isPast(date) || isToday(date), {
    message: "Booking date cannot be in the past"
  }),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
  totalAmount: z.number().positive("Total amount must be positive"),
  platformFee: z.number().min(0, "Platform fee cannot be negative"),
  providerPayout: z.number().positive("Provider payout must be positive"),
});

export const ProviderValidationSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  displayName: z.string().min(2, "Display name must be at least 2 characters"),
  slug: z.string().regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  hourlyRate: z.number().positive("Hourly rate must be positive").optional(),
  services: z.array(z.object({
    name: z.string().min(1, "Service name is required"),
    description: z.string().min(10, "Service description must be at least 10 characters"),
    duration: z.number().min(15, "Service duration must be at least 15 minutes"),
    price: z.number().positive("Service price must be positive")
  })).min(1, "At least one service is required"),
  locationCity: z.string().min(1, "City is required").optional(),
  locationState: z.string().min(1, "State is required").optional(),
});

export const AvailabilityValidationSchema = z.object({
  providerId: z.string().uuid("Invalid provider ID"),
  dayOfWeek: z.number().min(0).max(6, "Day of week must be 0-6"),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid start time format"),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid end time format"),
}).refine(data => data.startTime < data.endTime, {
  message: "End time must be after start time",
  path: ["endTime"]
});

// ===========================
// DATA INTEGRITY VALIDATORS
// ===========================

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class BookingValidator {
  /**
   * Comprehensive booking validation
   */
  static async validateBooking(bookingData: NewBooking): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Schema validation
      BookingValidationSchema.parse(bookingData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        errors.push(...error.errors.map(e => `${e.path.join('.')}: ${e.message}`));
      }
    }

    // Business logic validation
    await Promise.all([
      this.validateProviderExists(bookingData.providerId, errors),
      this.validateCustomerExists(bookingData.customerId, errors),
      this.validateBookingTimeLogic(bookingData, errors, warnings),
      this.validatePricingConsistency(bookingData, errors, warnings),
      this.validateProviderAvailability(bookingData, errors),
      this.validateNoConflicts(bookingData, errors),
    ]);

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private static async validateProviderExists(providerId: string, errors: string[]): Promise<void> {
    const provider = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, providerId))
      .limit(1);

    if (provider.length === 0) {
      errors.push("Provider not found");
      return;
    }

    if (!provider[0].isActive) {
      errors.push("Provider is not active");
    }

    if (!provider[0].stripeOnboardingComplete) {
      errors.push("Provider has not completed Stripe onboarding");
    }
  }

  private static async validateCustomerExists(customerId: string, errors: string[]): Promise<void> {
    const customer = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, customerId))
      .limit(1);

    if (customer.length === 0) {
      errors.push("Customer not found");
      return;
    }

    if (customer[0].status !== 'active') {
      errors.push("Customer account is not active");
    }
  }

  private static async validateBookingTimeLogic(
    bookingData: NewBooking, 
    errors: string[], 
    warnings: string[]
  ): Promise<void> {
    // Validate time format and logic
    const startMinutes = this.timeToMinutes(bookingData.startTime);
    const endMinutes = this.timeToMinutes(bookingData.endTime);
    const duration = endMinutes - startMinutes;

    if (duration <= 0) {
      errors.push("End time must be after start time");
    }

    if (duration !== bookingData.serviceDuration) {
      errors.push(`Service duration (${bookingData.serviceDuration} min) doesn't match time slot (${duration} min)`);
    }

    // Check for reasonable booking times
    if (startMinutes < 360 || startMinutes > 1320) { // 6 AM to 10 PM
      warnings.push("Booking is outside typical business hours");
    }

    // Validate booking is not too far in the future
    const daysInFuture = Math.ceil((bookingData.bookingDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysInFuture > 365) {
      warnings.push("Booking is more than a year in the future");
    }
  }

  private static async validatePricingConsistency(
    bookingData: NewBooking, 
    errors: string[], 
    warnings: string[]
  ): Promise<void> {
    // Validate pricing calculations
    const calculatedTotal = parseFloat(bookingData.servicePrice.toString()) + 
                           parseFloat(bookingData.platformFee.toString());
    const actualTotal = parseFloat(bookingData.totalAmount.toString());

    if (Math.abs(calculatedTotal - actualTotal) > 0.01) {
      errors.push(`Total amount mismatch: calculated ${calculatedTotal}, got ${actualTotal}`);
    }

    // Validate platform fee is reasonable (5-25%)
    const feePercentage = (parseFloat(bookingData.platformFee.toString()) / actualTotal) * 100;
    if (feePercentage < 5 || feePercentage > 25) {
      warnings.push(`Platform fee percentage (${feePercentage.toFixed(2)}%) is outside typical range (5-25%)`);
    }

    // Validate provider payout
    const expectedPayout = actualTotal - parseFloat(bookingData.platformFee.toString());
    const actualPayout = parseFloat(bookingData.providerPayout.toString());

    if (Math.abs(expectedPayout - actualPayout) > 0.01) {
      errors.push(`Provider payout mismatch: expected ${expectedPayout}, got ${actualPayout}`);
    }
  }

  private static async validateProviderAvailability(
    bookingData: NewBooking, 
    errors: string[]
  ): Promise<void> {
    const dayOfWeek = bookingData.bookingDate.getDay();
    
    const availability = await db
      .select()
      .from(providerAvailabilityTable)
      .where(
        and(
          eq(providerAvailabilityTable.providerId, bookingData.providerId),
          eq(providerAvailabilityTable.dayOfWeek, dayOfWeek),
          eq(providerAvailabilityTable.isActive, true)
        )
      );

    if (availability.length === 0) {
      errors.push("Provider is not available on this day of the week");
      return;
    }

    const providerAvail = availability[0];
    if (bookingData.startTime < providerAvail.startTime || bookingData.endTime > providerAvail.endTime) {
      errors.push(
        `Booking time (${bookingData.startTime}-${bookingData.endTime}) is outside provider's available hours (${providerAvail.startTime}-${providerAvail.endTime})`
      );
    }

    // Check for blocked slots
    const blockedSlots = await db
      .select()
      .from(providerBlockedSlotsTable)
      .where(
        and(
          eq(providerBlockedSlotsTable.providerId, bookingData.providerId),
          eq(providerBlockedSlotsTable.blockedDate, bookingData.bookingDate)
        )
      );

    for (const blocked of blockedSlots) {
      if (!blocked.startTime || !blocked.endTime) {
        errors.push("Provider has blocked this entire day");
        break;
      }

      // Check overlap
      if (
        (bookingData.startTime >= blocked.startTime && bookingData.startTime < blocked.endTime) ||
        (bookingData.endTime > blocked.startTime && bookingData.endTime <= blocked.endTime) ||
        (bookingData.startTime <= blocked.startTime && bookingData.endTime >= blocked.endTime)
      ) {
        errors.push(`Booking conflicts with provider's blocked time (${blocked.startTime}-${blocked.endTime})`);
        break;
      }
    }
  }

  private static async validateNoConflicts(bookingData: NewBooking, errors: string[]): Promise<void> {
    const conflicts = await db
      .select()
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.providerId, bookingData.providerId),
          eq(bookingsTable.bookingDate, bookingData.bookingDate),
          ne(bookingsTable.status, bookingStatus.CANCELLED),
          or(
            // New booking starts during existing booking
            and(
              sql`${bookingsTable.startTime} <= ${bookingData.startTime}`,
              sql`${bookingsTable.endTime} > ${bookingData.startTime}`
            ),
            // New booking ends during existing booking
            and(
              sql`${bookingsTable.startTime} < ${bookingData.endTime}`,
              sql`${bookingsTable.endTime} >= ${bookingData.endTime}`
            ),
            // New booking completely contains existing booking
            and(
              sql`${bookingsTable.startTime} >= ${bookingData.startTime}`,
              sql`${bookingsTable.endTime} <= ${bookingData.endTime}`
            )
          )
        )
      );

    if (conflicts.length > 0) {
      errors.push(`Time slot conflicts with existing booking (${conflicts[0].startTime}-${conflicts[0].endTime})`);
    }
  }

  private static timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }
}

// ===========================
// DATA CONSISTENCY CHECKERS
// ===========================

export class DataConsistencyChecker {
  /**
   * Check booking data consistency
   */
  static async checkBookingConsistency(): Promise<{
    issues: Array<{ type: string; description: string; count: number }>;
    totalIssues: number;
  }> {
    const issues = [];

    // Check for bookings without matching transactions
    const bookingsWithoutTransactions = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM ${bookingsTable} b
      LEFT JOIN ${transactionsTable} t ON b.id = t.booking_id
      WHERE b.status = 'completed' AND t.id IS NULL
    `);

    if (parseInt(bookingsWithoutTransactions.rows[0]?.count || '0') > 0) {
      issues.push({
        type: 'missing_transactions',
        description: 'Completed bookings without transaction records',
        count: parseInt(bookingsWithoutTransactions.rows[0].count)
      });
    }

    // Check for pricing inconsistencies
    const pricingInconsistencies = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM ${bookingsTable}
      WHERE ABS((service_price + platform_fee) - total_amount) > 0.01
    `);

    if (parseInt(pricingInconsistencies.rows[0]?.count || '0') > 0) {
      issues.push({
        type: 'pricing_inconsistency',
        description: 'Bookings with incorrect total amount calculations',
        count: parseInt(pricingInconsistencies.rows[0].count)
      });
    }

    // Check for orphaned records
    const orphanedBookings = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM ${bookingsTable} b
      LEFT JOIN ${providersTable} p ON b.provider_id = p.id
      WHERE p.id IS NULL
    `);

    if (parseInt(orphanedBookings.rows[0]?.count || '0') > 0) {
      issues.push({
        type: 'orphaned_bookings',
        description: 'Bookings referencing non-existent providers',
        count: parseInt(orphanedBookings.rows[0].count)
      });
    }

    // Check for invalid time ranges
    const invalidTimeRanges = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM ${bookingsTable}
      WHERE start_time >= end_time
    `);

    if (parseInt(invalidTimeRanges.rows[0]?.count || '0') > 0) {
      issues.push({
        type: 'invalid_time_ranges',
        description: 'Bookings with invalid time ranges (start >= end)',
        count: parseInt(invalidTimeRanges.rows[0].count)
      });
    }

    return {
      issues,
      totalIssues: issues.reduce((sum, issue) => sum + issue.count, 0)
    };
  }

  /**
   * Check provider data consistency
   */
  static async checkProviderConsistency(): Promise<{
    issues: Array<{ type: string; description: string; count: number }>;
    totalIssues: number;
  }> {
    const issues = [];

    // Check for providers without availability
    const providersWithoutAvailability = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM ${providersTable} p
      LEFT JOIN ${providerAvailabilityTable} pa ON p.id = pa.provider_id AND pa.is_active = true
      WHERE p.is_active = true AND pa.id IS NULL
    `);

    if (parseInt(providersWithoutAvailability.rows[0]?.count || '0') > 0) {
      issues.push({
        type: 'no_availability',
        description: 'Active providers without availability schedules',
        count: parseInt(providersWithoutAvailability.rows[0].count)
      });
    }

    // Check for providers with incomplete Stripe setup
    const incompleteStripeSetup = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM ${providersTable}
      WHERE is_active = true 
        AND (stripe_connect_account_id IS NULL OR stripe_onboarding_complete = false)
    `);

    if (parseInt(incompleteStripeSetup.rows[0]?.count || '0') > 0) {
      issues.push({
        type: 'incomplete_stripe',
        description: 'Active providers with incomplete Stripe setup',
        count: parseInt(incompleteStripeSetup.rows[0].count)
      });
    }

    // Check for rating/review inconsistencies
    const ratingInconsistencies = await db.execute(sql`
      WITH actual_ratings AS (
        SELECT 
          provider_id,
          COUNT(*) as review_count,
          AVG(rating::numeric) as calculated_avg_rating
        FROM ${reviewsTable}
        WHERE is_published = true
        GROUP BY provider_id
      )
      SELECT COUNT(*) as count
      FROM ${providersTable} p
      JOIN actual_ratings ar ON p.id = ar.provider_id
      WHERE ABS(p.average_rating::numeric - ar.calculated_avg_rating) > 0.1
        OR p.total_reviews != ar.review_count
    `);

    if (parseInt(ratingInconsistencies.rows[0]?.count || '0') > 0) {
      issues.push({
        type: 'rating_inconsistency',
        description: 'Providers with incorrect rating/review calculations',
        count: parseInt(ratingInconsistencies.rows[0].count)
      });
    }

    return {
      issues,
      totalIssues: issues.reduce((sum, issue) => sum + issue.count, 0)
    };
  }

  /**
   * Auto-fix common data inconsistencies
   */
  static async autoFixConsistencyIssues(): Promise<{
    fixed: Array<{ type: string; count: number }>;
    errors: string[];
  }> {
    const fixed = [];
    const errors = [];

    try {
      // Fix rating calculations
      const ratingFixes = await db.execute(sql`
        WITH rating_calculations AS (
          SELECT 
            r.provider_id,
            COUNT(*) as total_reviews,
            AVG(r.rating::numeric) as average_rating
          FROM ${reviewsTable} r
          WHERE r.is_published = true
          GROUP BY r.provider_id
        )
        UPDATE ${providersTable} p
        SET 
          total_reviews = rc.total_reviews,
          average_rating = ROUND(rc.average_rating, 1)
        FROM rating_calculations rc
        WHERE p.id = rc.provider_id
          AND (p.total_reviews != rc.total_reviews 
               OR ABS(p.average_rating::numeric - rc.average_rating) > 0.1)
      `);

      fixed.push({
        type: 'rating_calculations',
        count: ratingFixes.rowCount || 0
      });

      // Fix booking counts
      const bookingCountFixes = await db.execute(sql`
        WITH booking_counts AS (
          SELECT 
            provider_id,
            COUNT(*) as completed_bookings
          FROM ${bookingsTable}
          WHERE status = 'completed'
          GROUP BY provider_id
        )
        UPDATE ${providersTable} p
        SET completed_bookings = COALESCE(bc.completed_bookings, 0)
        FROM booking_counts bc
        WHERE p.id = bc.provider_id
          AND p.completed_bookings != bc.completed_bookings
      `);

      fixed.push({
        type: 'booking_counts',
        count: bookingCountFixes.rowCount || 0
      });

    } catch (error) {
      errors.push(`Auto-fix failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return { fixed, errors };
  }
}

// ===========================
// AVAILABILITY CALCULATIONS
// ===========================

export class AvailabilityCalculator {
  /**
   * Verify availability calculation accuracy
   */
  static async verifyAvailabilityAccuracy(
    providerId: string,
    date: Date
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Get provider's availability for the day
      const dayOfWeek = date.getDay();
      const availability = await db
        .select()
        .from(providerAvailabilityTable)
        .where(
          and(
            eq(providerAvailabilityTable.providerId, providerId),
            eq(providerAvailabilityTable.dayOfWeek, dayOfWeek),
            eq(providerAvailabilityTable.isActive, true)
          )
        );

      if (availability.length === 0) {
        errors.push("No availability schedule found for this day");
        return { isValid: false, errors, warnings };
      }

      // Check for overlapping availability windows
      if (availability.length > 1) {
        for (let i = 0; i < availability.length - 1; i++) {
          for (let j = i + 1; j < availability.length; j++) {
            const a1 = availability[i];
            const a2 = availability[j];
            
            if (this.timeRangesOverlap(a1.startTime, a1.endTime, a2.startTime, a2.endTime)) {
              errors.push(`Overlapping availability windows: ${a1.startTime}-${a1.endTime} and ${a2.startTime}-${a2.endTime}`);
            }
          }
        }
      }

      // Validate blocked slots don't extend beyond availability
      const blockedSlots = await db
        .select()
        .from(providerBlockedSlotsTable)
        .where(
          and(
            eq(providerBlockedSlotsTable.providerId, providerId),
            eq(providerBlockedSlotsTable.blockedDate, date)
          )
        );

      for (const blocked of blockedSlots) {
        if (blocked.startTime && blocked.endTime) {
          let validBlock = false;
          for (const avail of availability) {
            if (blocked.startTime >= avail.startTime && blocked.endTime <= avail.endTime) {
              validBlock = true;
              break;
            }
          }
          
          if (!validBlock) {
            warnings.push(`Blocked slot ${blocked.startTime}-${blocked.endTime} extends beyond availability windows`);
          }
        }
      }

      // Check for booking conflicts with availability
      const bookings = await db
        .select()
        .from(bookingsTable)
        .where(
          and(
            eq(bookingsTable.providerId, providerId),
            eq(bookingsTable.bookingDate, date),
            ne(bookingsTable.status, bookingStatus.CANCELLED)
          )
        );

      for (const booking of bookings) {
        let validBooking = false;
        for (const avail of availability) {
          if (booking.startTime >= avail.startTime && booking.endTime <= avail.endTime) {
            validBooking = true;
            break;
          }
        }
        
        if (!validBooking) {
          errors.push(`Booking ${booking.id} (${booking.startTime}-${booking.endTime}) is outside availability windows`);
        }
      }

    } catch (error) {
      errors.push(`Availability verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private static timeRangesOverlap(
    start1: string, 
    end1: string, 
    start2: string, 
    end2: string
  ): boolean {
    return start1 < end2 && start2 < end1;
  }
}

// ===========================
// PAYMENT RECONCILIATION
// ===========================

export class PaymentReconciliation {
  /**
   * Reconcile booking payments with transaction records
   */
  static async reconcilePayments(dateRange?: { start: Date; end: Date }): Promise<{
    reconciled: number;
    discrepancies: Array<{
      bookingId: string;
      issue: string;
      expectedAmount: number;
      actualAmount: number;
    }>;
  }> {
    const startDate = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const endDate = dateRange?.end || new Date();

    const discrepancies = [];
    let reconciled = 0;

    // Get completed bookings with their transactions
    const bookingsWithTransactions = await db.execute(sql`
      SELECT 
        b.id as booking_id,
        b.total_amount as booking_amount,
        b.platform_fee as booking_platform_fee,
        b.provider_payout as booking_provider_payout,
        t.amount as transaction_amount,
        t.platform_fee as transaction_platform_fee,
        t.provider_payout as transaction_provider_payout,
        t.status as transaction_status
      FROM ${bookingsTable} b
      LEFT JOIN ${transactionsTable} t ON b.id = t.booking_id
      WHERE b.status = 'completed'
        AND b.booking_date BETWEEN ${startDate} AND ${endDate}
    `);

    for (const row of bookingsWithTransactions.rows) {
      const record = row as any;
      
      if (!record.transaction_amount) {
        discrepancies.push({
          bookingId: record.booking_id,
          issue: 'Missing transaction record',
          expectedAmount: parseFloat(record.booking_amount),
          actualAmount: 0
        });
        continue;
      }

      // Check amount consistency
      const bookingAmount = parseFloat(record.booking_amount);
      const transactionAmount = parseFloat(record.transaction_amount);
      
      if (Math.abs(bookingAmount - transactionAmount) > 0.01) {
        discrepancies.push({
          bookingId: record.booking_id,
          issue: 'Amount mismatch between booking and transaction',
          expectedAmount: bookingAmount,
          actualAmount: transactionAmount
        });
        continue;
      }

      // Check platform fee consistency
      const bookingFee = parseFloat(record.booking_platform_fee);
      const transactionFee = parseFloat(record.transaction_platform_fee);
      
      if (Math.abs(bookingFee - transactionFee) > 0.01) {
        discrepancies.push({
          bookingId: record.booking_id,
          issue: 'Platform fee mismatch',
          expectedAmount: bookingFee,
          actualAmount: transactionFee
        });
        continue;
      }

      // Check provider payout consistency
      const bookingPayout = parseFloat(record.booking_provider_payout);
      const transactionPayout = parseFloat(record.transaction_provider_payout);
      
      if (Math.abs(bookingPayout - transactionPayout) > 0.01) {
        discrepancies.push({
          bookingId: record.booking_id,
          issue: 'Provider payout mismatch',
          expectedAmount: bookingPayout,
          actualAmount: transactionPayout
        });
        continue;
      }

      reconciled++;
    }

    return {
      reconciled,
      discrepancies
    };
  }
}

// ===========================
// PROVIDER RATING AGGREGATION
// ===========================

export class RatingAggregation {
  /**
   * Update provider ratings and review counts
   */
  static async updateProviderRatings(providerId?: string): Promise<{
    updated: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let updated = 0;

    try {
      const updateQuery = providerId 
        ? sql`
          WITH rating_stats AS (
            SELECT 
              provider_id,
              COUNT(*) as total_reviews,
              AVG(rating::numeric) as average_rating
            FROM ${reviewsTable}
            WHERE is_published = true AND provider_id = ${providerId}
            GROUP BY provider_id
          )
          UPDATE ${providersTable} p
          SET 
            total_reviews = COALESCE(rs.total_reviews, 0),
            average_rating = COALESCE(ROUND(rs.average_rating, 1), 0.0),
            updated_at = NOW()
          FROM rating_stats rs
          WHERE p.id = rs.provider_id OR (p.id = ${providerId} AND rs.provider_id IS NULL)
        `
        : sql`
          WITH rating_stats AS (
            SELECT 
              provider_id,
              COUNT(*) as total_reviews,
              AVG(rating::numeric) as average_rating
            FROM ${reviewsTable}
            WHERE is_published = true
            GROUP BY provider_id
          )
          UPDATE ${providersTable} p
          SET 
            total_reviews = COALESCE(rs.total_reviews, 0),
            average_rating = COALESCE(ROUND(rs.average_rating, 1), 0.0),
            updated_at = NOW()
          FROM rating_stats rs
          WHERE p.id = rs.provider_id
        `;

      const result = await db.execute(updateQuery);
      updated = result.rowCount || 0;

    } catch (error) {
      errors.push(`Rating update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return { updated, errors };
  }
}

// Export all validation utilities
export {
  BookingValidationSchema,
  ProviderValidationSchema,
  AvailabilityValidationSchema
};