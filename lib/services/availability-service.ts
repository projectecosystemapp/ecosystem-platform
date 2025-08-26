/**
 * Availability Service
 * 
 * Handles real-time availability checking, slot generation, conflict detection,
 * and availability caching for optimal performance.
 */

import { db } from "@/db/db";
import { 
  availabilityCacheTable,
  providerAvailabilityTable,
  providerBlockedSlotsTable,
  bookingsTable,
  servicesTable,
  providersTable,
  bookingPerformanceLogTable,
  type TimeSlot
} from "@/db/schema/enhanced-booking-schema";
import { eq, and, gte, lte, or, isNull, not, inArray } from "drizzle-orm";
import { cache, ProviderCache, CACHE_TTL } from "@/lib/cache";

export interface AvailabilityRequest {
  providerId: string;
  serviceId?: string;
  date: Date;
  timezone?: string;
  duration?: number; // minutes, defaults to service minimum
}

export interface AvailabilityResponse {
  date: Date;
  timezone: string;
  slots: TimeSlot[];
  provider: {
    id: string;
    name: string;
    timezone: string;
  };
  service?: {
    id: string;
    name: string;
    duration: number;
    bufferBefore: number;
    bufferAfter: number;
  };
}

export interface TimeSlotLock {
  id: string;
  providerId: string;
  date: Date;
  startTime: string;
  endTime: string;
  lockedUntil: Date;
  sessionId: string;
}

export class AvailabilityService {
  private readonly SLOT_DURATION_MINUTES = 15; // Minimum slot granularity
  private readonly DEFAULT_LOCK_DURATION_MINUTES = 10;
  private readonly MAX_CACHE_DAYS_AHEAD = 30;

  /**
   * Get real-time availability for a provider on a specific date
   */
  async getAvailability(request: AvailabilityRequest): Promise<AvailabilityResponse> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(request);

    try {
      // Try cache first
      const cached = await ProviderCache.getCachedAvailability(
        request.providerId,
        request.date.toISOString().split('T')[0]
      );

      if (cached) {
        return cached;
      }

      // Generate fresh availability
      const availability = await this.generateAvailability(request);

      // Cache the result
      await ProviderCache.cacheAvailability(
        request.providerId,
        request.date.toISOString().split('T')[0],
        availability
      );

      // Log performance
      await this.logPerformance('get_availability', Date.now() - startTime, {
        providerId: request.providerId,
        serviceId: request.serviceId,
        cached: false
      });

      return availability;

    } catch (error) {
      await this.logPerformance('get_availability_error', Date.now() - startTime, {
        providerId: request.providerId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Lock a time slot for booking (prevents concurrent bookings)
   */
  async lockTimeSlot(
    providerId: string,
    date: Date,
    startTime: string,
    endTime: string,
    sessionId: string,
    durationMinutes: number = this.DEFAULT_LOCK_DURATION_MINUTES
  ): Promise<TimeSlotLock | null> {
    const lockUntil = new Date(Date.now() + durationMinutes * 60 * 1000);

    try {
      const [lockedSlot] = await db
        .update(availabilityCacheTable)
        .set({
          lockedUntil: lockUntil,
          lockedBySession: sessionId
        })
        .where(
          and(
            eq(availabilityCacheTable.providerId, providerId),
            eq(availabilityCacheTable.date, date.toISOString().split('T')[0]),
            eq(availabilityCacheTable.startTime, startTime),
            eq(availabilityCacheTable.endTime, endTime),
            eq(availabilityCacheTable.isAvailable, true),
            or(
              isNull(availabilityCacheTable.lockedUntil),
              lte(availabilityCacheTable.lockedUntil, new Date())
            )
          )
        )
        .returning();

      if (!lockedSlot) {
        return null;
      }

      // Invalidate cache
      await this.invalidateAvailabilityCache(providerId, date);

      return {
        id: lockedSlot.id,
        providerId,
        date,
        startTime,
        endTime,
        lockedUntil: lockUntil,
        sessionId
      };

    } catch (error) {
      console.error('Error locking time slot:', error);
      return null;
    }
  }

  /**
   * Release a locked time slot
   */
  async releaseTimeSlot(lockId: string): Promise<boolean> {
    try {
      const [releasedSlot] = await db
        .update(availabilityCacheTable)
        .set({
          lockedUntil: null,
          lockedBySession: null
        })
        .where(eq(availabilityCacheTable.id, lockId))
        .returning();

      if (releasedSlot) {
        await this.invalidateAvailabilityCache(
          releasedSlot.providerId, 
          new Date(releasedSlot.date)
        );
        return true;
      }

      return false;

    } catch (error) {
      console.error('Error releasing time slot:', error);
      return false;
    }
  }

  /**
   * Check if a specific time slot is available
   */
  async isSlotAvailable(
    providerId: string,
    date: Date,
    startTime: string,
    endTime: string
  ): Promise<boolean> {
    const [slot] = await db
      .select()
      .from(availabilityCacheTable)
      .where(
        and(
          eq(availabilityCacheTable.providerId, providerId),
          eq(availabilityCacheTable.date, date.toISOString().split('T')[0]),
          eq(availabilityCacheTable.startTime, startTime),
          eq(availabilityCacheTable.endTime, endTime),
          eq(availabilityCacheTable.isAvailable, true),
          or(
            isNull(availabilityCacheTable.lockedUntil),
            lte(availabilityCacheTable.lockedUntil, new Date())
          )
        )
      )
      .limit(1);

    return !!slot;
  }

  /**
   * Pre-compute availability cache for a provider
   */
  async precomputeAvailability(
    providerId: string,
    dateRange: { start: Date; end: Date }
  ): Promise<void> {
    const dates = this.generateDateRange(dateRange.start, dateRange.end);
    
    for (const date of dates) {
      try {
        const slots = await this.generateTimeSlots(providerId, date);
        await this.upsertAvailabilityCache(providerId, date, slots);
      } catch (error) {
        console.error(`Error precomputing availability for ${providerId} on ${date}:`, error);
      }
    }
  }

  /**
   * Find alternative time slots when requested slot is unavailable
   */
  async findAlternativeSlots(
    providerId: string,
    requestedDate: Date,
    duration: number,
    timezone: string = 'UTC',
    maxAlternatives: number = 5
  ): Promise<TimeSlot[]> {
    // Search within the same day first
    let alternatives = await this.findSlotsOnDate(providerId, requestedDate, duration);
    
    if (alternatives.length >= maxAlternatives) {
      return alternatives.slice(0, maxAlternatives);
    }

    // Search next 7 days
    for (let i = 1; i <= 7 && alternatives.length < maxAlternatives; i++) {
      const nextDate = new Date(requestedDate);
      nextDate.setDate(nextDate.getDate() + i);
      
      const nextDaySlots = await this.findSlotsOnDate(providerId, nextDate, duration);
      alternatives = [...alternatives, ...nextDaySlots];
    }

    return alternatives.slice(0, maxAlternatives);
  }

  /**
   * Clean up expired locks and cache entries
   */
  async cleanupExpiredData(): Promise<{ locks: number; cache: number }> {
    const now = new Date().toISOString();

    // Release expired locks
    const releasedLocks = await db
      .update(availabilityCacheTable)
      .set({
        lockedUntil: null,
        lockedBySession: null
      })
      .where(
        and(
          not(isNull(availabilityCacheTable.lockedUntil)),
          lte(availabilityCacheTable.lockedUntil, new Date(now))
        )
      )
      .returning();

    // Delete expired cache entries
    const deletedCache = await db
      .delete(availabilityCacheTable)
      .where(lte(availabilityCacheTable.expiresAt, new Date(now)))
      .returning();

    return {
      locks: releasedLocks.length,
      cache: deletedCache.length
    };
  }

  /**
   * Private helper methods
   */

  private async generateAvailability(request: AvailabilityRequest): Promise<AvailabilityResponse> {
    // Get provider details
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, request.providerId))
      .limit(1);

    if (!provider) {
      throw new Error('Provider not found');
    }

    // Get service details if provided
    let service = null;
    if (request.serviceId) {
      [service] = await db
        .select()
        .from(servicesTable)
        .where(
          and(
            eq(servicesTable.id, request.serviceId),
            eq(servicesTable.providerId, request.providerId)
          )
        )
        .limit(1);
    }

    // Generate time slots
    const slots = await this.generateTimeSlots(
      request.providerId,
      request.date,
      service,
      request.duration
    );

    return {
      date: request.date,
      timezone: request.timezone || 'UTC',
      slots,
      provider: {
        id: provider.id,
        name: provider.displayName,
        timezone: 'UTC'
      },
      service: service ? {
        id: service.id,
        name: service.name,
        duration: service.minimumDuration,
        bufferBefore: service.bufferTimeBefore || 0,
        bufferAfter: service.bufferTimeAfter || 0
      } : undefined
    };
  }

  private async generateTimeSlots(
    providerId: string,
    date: Date,
    service?: any,
    requestedDuration?: number
  ): Promise<TimeSlot[]> {
    // Get provider's weekly availability
    const availability = await db
      .select()
      .from(providerAvailabilityTable)
      .where(
        and(
          eq(providerAvailabilityTable.providerId, providerId),
          eq(providerAvailabilityTable.isActive, true)
        )
      );

    // Get blocked slots for the date
    const blockedSlots = await db
      .select()
      .from(providerBlockedSlotsTable)
      .where(
        and(
          eq(providerBlockedSlotsTable.providerId, providerId),
          eq(providerBlockedSlotsTable.blockedDate, date.toISOString().split('T')[0])
        )
      );

    // Get existing bookings for the date
    const bookings = await db
      .select()
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.providerId, providerId),
          eq(bookingsTable.bookingDate, date.toISOString().split('T')[0]),
          not(inArray(bookingsTable.status, ['cancelled', 'no_show']))
        )
      );

    // Get day of week (0 = Sunday, 6 = Saturday)
    const dayOfWeek = date.getDay();
    
    // Find availability for this day of week
    const dayAvailability = availability.filter(a => a.dayOfWeek === dayOfWeek);
    
    if (dayAvailability.length === 0) {
      return []; // Provider not available on this day
    }

    const slots: TimeSlot[] = [];
    const duration = requestedDuration || service?.minimumDuration || 60;
    const bufferBefore = service?.bufferTimeBefore || 0;
    const bufferAfter = service?.bufferTimeAfter || 0;

    for (const daySlot of dayAvailability) {
      const startHour = parseInt(daySlot.startTime.split(':')[0]);
      const startMinute = parseInt(daySlot.startTime.split(':')[1]);
      const endHour = parseInt(daySlot.endTime.split(':')[0]);
      const endMinute = parseInt(daySlot.endTime.split(':')[1]);

      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;

      // Generate slots in 15-minute intervals
      for (let minutes = startMinutes; minutes < endMinutes; minutes += this.SLOT_DURATION_MINUTES) {
        const slotEndMinutes = minutes + duration;
        
        if (slotEndMinutes > endMinutes) {
          break; // Slot would extend beyond availability
        }

        const slotStartTime = this.minutesToTimeString(minutes);
        const slotEndTime = this.minutesToTimeString(slotEndMinutes);

        // Check if slot conflicts with bookings
        const hasBookingConflict = bookings.some(booking => 
          this.timeRangesOverlap(
            slotStartTime, 
            slotEndTime,
            booking.startTime,
            booking.endTime
          )
        );

        // Check if slot conflicts with blocked periods
        const hasBlockedConflict = blockedSlots.some(blocked => {
          if (!blocked.startTime || !blocked.endTime) {
            return true; // Full day blocked
          }
          return this.timeRangesOverlap(
            slotStartTime,
            slotEndTime,
            blocked.startTime,
            blocked.endTime
          );
        });

        const isAvailable = !hasBookingConflict && !hasBlockedConflict;

        slots.push({
          startTime: slotStartTime,
          endTime: slotEndTime,
          isAvailable,
          isBooked: hasBookingConflict
        });
      }
    }

    return slots;
  }

  private async upsertAvailabilityCache(
    providerId: string,
    date: Date,
    slots: TimeSlot[]
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    for (const slot of slots) {
      await db
        .insert(availabilityCacheTable)
        .values({
          providerId,
          date: date.toISOString().split('T')[0],
          startTime: slot.startTime,
          endTime: slot.endTime,
          isAvailable: slot.isAvailable,
          isBooked: slot.isBooked ?? undefined,
          expiresAt
        })
        .onConflictDoUpdate({
          target: [
            availabilityCacheTable.providerId,
            availabilityCacheTable.date,
            availabilityCacheTable.startTime,
            availabilityCacheTable.endTime
          ],
          set: {
            isAvailable: slot.isAvailable,
            isBooked: slot.isBooked ?? undefined,
            computedAt: new Date(),
            expiresAt
          }
        });
    }
  }

  private async findSlotsOnDate(
    providerId: string,
    date: Date,
    duration: number
  ): Promise<TimeSlot[]> {
    const slots = await db
      .select()
      .from(availabilityCacheTable)
      .where(
        and(
          eq(availabilityCacheTable.providerId, providerId),
          eq(availabilityCacheTable.date, date.toISOString().split('T')[0]),
          eq(availabilityCacheTable.isAvailable, true),
          or(
            isNull(availabilityCacheTable.lockedUntil),
            lte(availabilityCacheTable.lockedUntil, new Date())
          )
        )
      )
      .orderBy(availabilityCacheTable.startTime)
      .limit(10);
    
    return slots.map(slot => ({
      startTime: slot.startTime,
      endTime: slot.endTime,
      isAvailable: slot.isAvailable,
      isBooked: slot.isBooked
    }));
  }

  private generateDateRange(start: Date, end: Date): Date[] {
    const dates: Date[] = [];
    const current = new Date(start);
    
    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return dates;
  }

  private minutesToTimeString(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  private timeRangesOverlap(
    start1: string,
    end1: string,
    start2: string,
    end2: string
  ): boolean {
    return start1 < end2 && start2 < end1;
  }

  private generateCacheKey(request: AvailabilityRequest): string {
    return `availability:${request.providerId}:${request.date.toISOString().split('T')[0]}:${request.serviceId || 'all'}`;
  }

  private async invalidateAvailabilityCache(providerId: string, date: Date): Promise<void> {
    const dateStr = date.toISOString().split('T')[0];
    await ProviderCache.invalidateProviderCache(providerId);
    await cache.deletePattern(`availability:${providerId}:${dateStr}*`);
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
      console.error('Failed to log performance:', error);
    }
  }
}

// Singleton instance
export const availabilityService = new AvailabilityService();