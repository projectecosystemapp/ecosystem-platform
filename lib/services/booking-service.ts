/**
 * Core Booking Service
 * 
 * Handles all booking operations including creation, updates, cancellation,
 * conflict prevention, and state management.
 */

import { db } from "@/db/db";
import { 
  bookingsTable, 
  servicesTable,
  providersTable,
  bookingStateTransitionsTable,
  payoutSchedulesTable,
  availabilityCacheTable,
  BookingStatus,
  VALID_STATUS_TRANSITIONS,
  type CreateBookingRequest,
  type BookingStatusType
} from "@/db/schema/enhanced-booking-schema";
import { bookingPerformanceLogTable } from "@/db/schema/enhanced-booking-schema";
import { eq, and, gte, lte, inArray, or } from "drizzle-orm";
import { calculatePlatformFee, getPlatformFeeRate } from "@/lib/platform-fee";
import { createPaymentIntentWithIdempotency } from "@/lib/stripe-enhanced";
import { cache, BookingCache } from "@/lib/cache";
import Stripe from "stripe";

export class BookingConflictError extends Error {
  constructor(
    message: string,
    public conflictingBooking?: any,
    public alternatives?: any[]
  ) {
    super(message);
    this.name = 'BookingConflictError';
  }
}

export class BookingValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public code: string
  ) {
    super(message);
    this.name = 'BookingValidationError';
  }
}

export class BookingService {
  /**
   * Create a new booking with full validation and conflict prevention
   */
  async createBooking(request: CreateBookingRequest): Promise<any> {
    const startTime = Date.now();
    
    try {
      // Validate the booking request
      await this.validateBookingRequest(request);
      
      // Create booking within transaction for atomicity
      const booking = await db.transaction(async (tx) => {
        // 1. Lock the time slot to prevent conflicts
        const slotLocked = await this.lockTimeSlot(
          request.providerId,
          request.bookingDate,
          request.startTime,
          request.endTime,
          request.customerId || request.guestSessionId || 'anonymous'
        );
        
        if (!slotLocked) {
          throw new BookingConflictError(
            'The selected time slot is no longer available',
            undefined,
            await this.findAlternativeSlots(request)
          );
        }
        
        // 2. Create the booking record
        const [newBooking] = await tx
          .insert(bookingsTable)
          .values({
            providerId: request.providerId,
            customerId: request.customerId,
            serviceId: request.serviceId,
            guestSessionId: request.guestSessionId,
            isGuestBooking: request.isGuestBooking,
            
            // Service details
            serviceName: request.serviceName,
            servicePrice: request.servicePrice,
            serviceDuration: request.serviceDuration,
            
            // Timing
            bookingDate: request.bookingDate,
            startTime: request.startTime,
            endTime: request.endTime,
            timezone: request.timezone,
            
            // Payment
            totalAmount: request.totalAmount,
            platformFee: request.platformFee,
            providerPayout: request.providerPayout,
            
            // Notes
            customerNotes: request.customerNotes,
            
            // Status
            status: BookingStatus.PENDING,
          })
          .returning();
          
        // 3. Create initial state transition
        await tx.insert(bookingStateTransitionsTable).values({
          bookingId: newBooking.id,
          fromStatus: null,
          toStatus: BookingStatus.PENDING,
          triggeredBy: request.customerId || 'guest',
          triggerReason: 'booking_created',
          metadata: {
            serviceId: request.serviceId,
            providerId: request.providerId,
            isGuestBooking: request.isGuestBooking,
          }
        });
        
        // 4. Update availability cache
        await tx
          .update(availabilityCacheTable)
          .set({ 
            isAvailable: false, 
            isBooked: true,
            bookingId: newBooking.id,
            lockedUntil: null,
            lockedBySession: null
          })
          .where(
            and(
              eq(availabilityCacheTable.providerId, request.providerId),
              eq(availabilityCacheTable.date, request.bookingDate),
              eq(availabilityCacheTable.startTime, request.startTime)
            )
          );
          
        return newBooking;
      });
      
      // 5. Invalidate relevant caches
      await this.invalidateBookingCaches(request.providerId, request.bookingDate);
      
      // 6. Log performance
      await this.logPerformance('create_booking', Date.now() - startTime, {
        bookingId: booking.id,
        providerId: request.providerId,
        serviceId: request.serviceId,
      });
      
      return booking;
      
    } catch (error) {
      // Log error performance
      await this.logPerformance('create_booking_error', Date.now() - startTime, {
        error: error instanceof Error ? error.message : 'Unknown error',
        providerId: request.providerId,
        serviceId: request.serviceId,
      });
      
      throw error;
    }
  }
  
  /**
   * Update booking status with proper state machine validation
   */
  async updateBookingStatus(
    bookingId: string,
    newStatus: BookingStatusType,
    triggeredBy: string,
    reason?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await db.transaction(async (tx) => {
      // Get current booking
      const [booking] = await tx
        .select()
        .from(bookingsTable)
        .where(eq(bookingsTable.id, bookingId))
        .limit(1);
        
      if (!booking) {
        throw new Error('Booking not found');
      }
      
      // Validate state transition
      const validTransitions = VALID_STATUS_TRANSITIONS[booking.status as BookingStatusType];
      if (!validTransitions.includes(newStatus)) {
        throw new BookingValidationError(
          `Invalid status transition from ${booking.status} to ${newStatus}`,
          'status',
          'INVALID_TRANSITION'
        );
      }
      
      // Update booking status
      await tx
        .update(bookingsTable)
        .set({ 
          status: newStatus,
          updatedAt: new Date().toISOString(),
          ...(newStatus === BookingStatus.COMPLETED && { completedAt: new Date().toISOString() }),
          ...(newStatus === BookingStatus.CANCELLED && { 
            cancelledAt: new Date().toISOString(),
            cancelledBy: triggeredBy,
            cancellationReason: reason 
          })
        })
        .where(eq(bookingsTable.id, bookingId));
        
      // Create state transition record
      await tx.insert(bookingStateTransitionsTable).values({
        bookingId,
        fromStatus: booking.status,
        toStatus: newStatus,
        triggeredBy,
        triggerReason: reason,
        metadata: metadata || {}
      });
      
      // Handle side effects based on new status
      await this.handleStatusSideEffects(tx, booking, newStatus, triggeredBy);
    });
    
    // Invalidate caches
    await this.invalidateBookingCaches(booking.booking.providerId, booking.booking.bookingDate);
  }
  
  /**
   * Cancel a booking with refund processing
   */
  async cancelBooking(
    bookingId: string,
    reason: string,
    cancelledBy: string,
    refundAmount?: number
  ): Promise<void> {
    const booking = await this.getBookingById(bookingId);
    
    if (!booking) {
      throw new Error('Booking not found');
    }
    
    // Calculate refund amount based on cancellation policy
    const calculatedRefundAmount = refundAmount || 
      await this.calculateRefundAmount(booking, new Date());
    
    await this.updateBookingStatus(
      bookingId,
      BookingStatus.CANCELLED,
      cancelledBy,
      reason,
      { refundAmount: calculatedRefundAmount }
    );
    
    // Process refund if payment was made
    if (booking.stripePaymentIntentId && calculatedRefundAmount > 0) {
      await this.processRefund(booking, calculatedRefundAmount, reason);
    }
    
    // Release the time slot
    await this.releaseTimeSlot(booking);
  }
  
  /**
   * Get booking by ID with full details
   */
  async getBookingById(bookingId: string): Promise<any> {
    const [booking] = await db
      .select({
        booking: bookingsTable,
        provider: providersTable,
        service: servicesTable,
      })
      .from(bookingsTable)
      .leftJoin(providersTable, eq(bookingsTable.providerId, providersTable.id))
      .leftJoin(servicesTable, eq(bookingsTable.serviceId, servicesTable.id))
      .where(eq(bookingsTable.id, bookingId))
      .limit(1);
      
    return booking;
  }
  
  /**
   * Get bookings for a customer
   */
  async getCustomerBookings(
    customerId: string,
    status?: BookingStatusType[],
    limit: number = 10,
    offset: number = 0
  ): Promise<any[]> {
    const conditions = [eq(bookingsTable.customerId, customerId)];
    
    if (status && status.length > 0) {
      conditions.push(inArray(bookingsTable.status, status));
    }
    
    return await db
      .select({
        booking: bookingsTable,
        provider: providersTable,
        service: servicesTable,
      })
      .from(bookingsTable)
      .leftJoin(providersTable, eq(bookingsTable.providerId, providersTable.id))
      .leftJoin(servicesTable, eq(bookingsTable.serviceId, servicesTable.id))
      .where(and(...conditions))
      .orderBy(bookingsTable.createdAt)
      .limit(limit)
      .offset(offset);
  }
  
  /**
   * Get bookings for a provider
   */
  async getProviderBookings(
    providerId: string,
    status?: BookingStatusType[],
    dateRange?: { start: Date; end: Date },
    limit: number = 10,
    offset: number = 0
  ): Promise<any[]> {
    const conditions = [eq(bookingsTable.providerId, providerId)];
    
    if (status && status.length > 0) {
      conditions.push(inArray(bookingsTable.status, status));
    }
    
    if (dateRange) {
      conditions.push(
        and(
          gte(bookingsTable.bookingDate, dateRange.start),
          lte(bookingsTable.bookingDate, dateRange.end)
        )
      );
    }
    
    return await db
      .select({
        booking: bookingsTable,
        service: servicesTable,
      })
      .from(bookingsTable)
      .leftJoin(servicesTable, eq(bookingsTable.serviceId, servicesTable.id))
      .where(and(...conditions))
      .orderBy(bookingsTable.bookingDate)
      .limit(limit)
      .offset(offset);
  }
  
  /**
   * Private helper methods
   */
  
  private async validateBookingRequest(request: CreateBookingRequest): Promise<void> {
    // Validate provider exists and is active
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(
        and(
          eq(providersTable.id, request.providerId),
          eq(providersTable.isActive, true)
        )
      )
      .limit(1);
      
    if (!provider) {
      throw new BookingValidationError(
        'Provider not found or inactive',
        'providerId',
        'PROVIDER_NOT_FOUND'
      );
    }
    
    // Validate service exists and is active
    const [service] = await db
      .select()
      .from(servicesTable)
      .where(
        and(
          eq(servicesTable.id, request.serviceId),
          eq(servicesTable.isActive, true)
        )
      )
      .limit(1);
      
    if (!service) {
      throw new BookingValidationError(
        'Service not found or inactive',
        'serviceId',
        'SERVICE_NOT_FOUND'
      );
    }
    
    // Validate booking time is in the future
    const bookingDateTime = new Date(request.bookingDate);
    const now = new Date();
    
    if (bookingDateTime < now) {
      throw new BookingValidationError(
        'Booking time must be in the future',
        'bookingDate',
        'PAST_DATE'
      );
    }
    
    // Validate advance booking requirements
    const hoursUntilBooking = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (service.advanceBookingHours && hoursUntilBooking < service.advanceBookingHours) {
      throw new BookingValidationError(
        `Booking must be made at least ${service.advanceBookingHours} hours in advance`,
        'bookingDate',
        'INSUFFICIENT_ADVANCE_NOTICE'
      );
    }
    
    // Validate duration
    if (request.serviceDuration < service.minimumDuration) {
      throw new BookingValidationError(
        `Service duration must be at least ${service.minimumDuration} minutes`,
        'serviceDuration',
        'DURATION_TOO_SHORT'
      );
    }
    
    if (service.maximumDuration && request.serviceDuration > service.maximumDuration) {
      throw new BookingValidationError(
        `Service duration cannot exceed ${service.maximumDuration} minutes`,
        'serviceDuration',
        'DURATION_TOO_LONG'
      );
    }
  }
  
  private async lockTimeSlot(
    providerId: string,
    date: Date,
    startTime: string,
    endTime: string,
    sessionId: string,
    lockDurationMinutes: number = 10
  ): Promise<boolean> {
    const lockUntil = new Date(Date.now() + lockDurationMinutes * 60 * 1000);
    
    try {
      const result = await db
        .update(availabilityCacheTable)
        .set({
          lockedUntil: lockUntil,
          lockedBySession: sessionId
        })
        .where(
          and(
            eq(availabilityCacheTable.providerId, providerId),
            eq(availabilityCacheTable.date, date),
            eq(availabilityCacheTable.startTime, startTime),
            eq(availabilityCacheTable.isAvailable, true),
            or(
              eq(availabilityCacheTable.lockedUntil, null),
              lte(availabilityCacheTable.lockedUntil, new Date().toISOString())
            )
          )
        )
        .returning();
        
      return result.length > 0;
    } catch (error) {
      console.error('Error locking time slot:', error);
      return false;
    }
  }
  
  private async releaseTimeSlot(booking: any): Promise<void> {
    await db
      .update(availabilityCacheTable)
      .set({
        isAvailable: true,
        isBooked: undefined,
        bookingId: undefined,
        lockedUntil: null,
        lockedBySession: null
      })
      .where(eq(availabilityCacheTable.bookingId, booking.id));
  }
  
  private async findAlternativeSlots(request: CreateBookingRequest): Promise<any[]> {
    // Find alternative slots within the same day or next few days
    const alternatives = await db
      .select()
      .from(availabilityCacheTable)
      .where(
        and(
          eq(availabilityCacheTable.providerId, request.providerId),
          gte(availabilityCacheTable.date, request.bookingDate),
          lte(availabilityCacheTable.date, new Date(request.bookingDate.getTime() + 7 * 24 * 60 * 60 * 1000)),
          eq(availabilityCacheTable.isAvailable, true)
        )
      )
      .orderBy(availabilityCacheTable.date, availabilityCacheTable.startTime)
      .limit(5);
      
    return alternatives;
  }
  
  private async handleStatusSideEffects(
    tx: any,
    booking: any,
    newStatus: BookingStatusType,
    triggeredBy: string
  ): Promise<void> {
    switch (newStatus) {
      case BookingStatus.COMPLETED:
        // Schedule payout
        await this.scheduleProviderPayout(tx, booking);
        break;
        
      case BookingStatus.CANCELLED:
      case BookingStatus.NO_SHOW:
        // Release the time slot
        await tx
          .update(availabilityCacheTable)
          .set({
            isAvailable: true,
            isBooked: undefined,
            bookingId: undefined
          })
          .where(eq(availabilityCacheTable.bookingId, booking.id));
        break;
    }
  }
  
  private async scheduleProviderPayout(tx: any, booking: any, escrowDays: number = 7): Promise<void> {
    const payoutDate = new Date();
    payoutDate.setDate(payoutDate.getDate() + escrowDays);
    
    await tx.insert(payoutSchedulesTable).values({
      bookingId: booking.id,
      providerId: booking.providerId,
      amount: booking.totalAmount,
      platformFee: booking.platformFee,
      netPayout: booking.providerPayout,
      scheduledAt: payoutDate,
      status: 'scheduled'
    });
  }
  
  private async calculateRefundAmount(booking: any, cancellationDate: Date): Promise<number> {
    // Implement cancellation policy logic
    const bookingDate = new Date(booking.bookingDate);
    const hoursUntilBooking = (bookingDate.getTime() - cancellationDate.getTime()) / (1000 * 60 * 60);
    
    // Get service cancellation policy
    const [service] = await db
      .select()
      .from(servicesTable)
      .where(eq(servicesTable.id, booking.serviceId))
      .limit(1);
      
    if (!service) {
      return 0;
    }
    
    // Default policy: full refund if cancelled 24+ hours before
    if (service.cancellationHours && hoursUntilBooking >= service.cancellationHours) {
      return booking.totalAmount;
    }
    
    // 50% refund if cancelled 2-24 hours before
    if (hoursUntilBooking >= 2) {
      return Math.floor(booking.totalAmount * 0.5);
    }
    
    // No refund if cancelled less than 2 hours before
    return 0;
  }
  
  private async processRefund(booking: any, amount: number, reason: string): Promise<void> {
    // Implementation would use Stripe refund API
    // This is handled in the enhanced Stripe service
  }
  
  private async invalidateBookingCaches(providerId: string, date: Date): Promise<void> {
    await BookingCache.invalidateBookingCache(providerId, date.toISOString().split('T')[0]);
  }
  
  private async logPerformance(
    operation: string,
    duration: number,
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      await db.insert(bookingPerformanceLogTable).values({
        operation,
        durationMs: duration,
        metadata
      });
    } catch (error) {
      // Don't throw on logging errors
      console.error('Failed to log performance:', error);
    }
  }
}

// Singleton instance
export const bookingService = new BookingService();