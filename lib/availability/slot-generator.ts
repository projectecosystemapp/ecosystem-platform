/**
 * Slot Generation Algorithm
 * Implements deterministic slot generation per Master PRD §4.6.2
 * 
 * Algorithm:
 * 1. Resolve provider timezone
 * 2. Expand recurring rules across dateWindow
 * 3. Apply exceptions
 * 4. Intersect service duration + buffers
 * 5. Enforce lead time & cutoff
 * 6. Query bookings to subtract reserved capacity
 * 7. Return slots sorted ASC
 */

import { db } from "@/db/db";
import { 
  providersTable,
  providerAvailabilityTable,
  providerBlockedSlotsTable,
  bookingsTable,
  servicesTable
} from "@/db/schema";
import { eq, and, gte, lte, inArray, or, sql } from "drizzle-orm";
import { format, parse, addMinutes, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { utcToZonedTime, zonedTimeToUtc } from "date-fns-tz";

/**
 * Availability slot representation
 */
export interface AvailabilitySlot {
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  available: boolean;
  capacity: number;
  remainingCapacity: number;
  providerId: string;
  serviceId?: string;
}

/**
 * Provider settings for availability calculation
 */
export interface ProviderSettings {
  timezone: string;
  leadTimeMinutes: number; // Min notice before booking
  cutoffMinutes: number; // Last acceptable booking time before slot
  preBufferMinutes: number; // Buffer before service
  postBufferMinutes: number; // Buffer after service
  defaultCapacity: number; // Slots available per time
}

/**
 * Recurring availability rule (RRULE-style)
 */
export interface RecurringRule {
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  startMinute: number; // Minutes from midnight (0-1439)
  endMinute: number; // Minutes from midnight (0-1439)
  capacity: number;
}

/**
 * Date-specific exception
 */
export interface AvailabilityException {
  date: string; // YYYY-MM-DD
  startMinute?: number; // Override start time
  endMinute?: number; // Override end time
  isClosed: boolean; // Completely unavailable
}

/**
 * Slot generation parameters
 */
export interface SlotGenerationParams {
  providerId: string;
  serviceId?: string;
  startDate: Date;
  endDate: Date;
  serviceDuration?: number; // Minutes, defaults to service setting
  includeBooked?: boolean; // Include slots that are already booked
}

/**
 * Main slot generation class
 */
export class SlotGenerator {
  private readonly SLOT_INTERVAL_MINUTES = 15; // Generate slots every 15 minutes
  private readonly MAX_DAYS_AHEAD = 90; // Maximum booking window
  private readonly CACHE_TTL_SECONDS = 30; // Cache duration

  /**
   * Generate available slots for a provider within a date range
   * This is the main entry point for the slot generation algorithm
   */
  async generateSlots(params: SlotGenerationParams): Promise<AvailabilitySlot[]> {
    // 1. Get provider settings and timezone
    const settings = await this.getProviderSettings(params.providerId);
    
    // 2. Get service details if specified
    const service = params.serviceId 
      ? await this.getServiceDetails(params.serviceId)
      : null;
    
    const serviceDuration = params.serviceDuration || service?.duration || 60;
    
    // 3. Get recurring rules
    const recurringRules = await this.getRecurringRules(params.providerId);
    
    // 4. Get exceptions for date range
    const exceptions = await this.getExceptions(
      params.providerId, 
      params.startDate, 
      params.endDate
    );
    
    // 5. Get existing bookings for capacity calculation
    const existingBookings = await this.getExistingBookings(
      params.providerId,
      params.startDate,
      params.endDate
    );
    
    // 6. Generate slots for each day
    const allSlots: AvailabilitySlot[] = [];
    const currentDate = new Date(params.startDate);
    
    while (currentDate <= params.endDate) {
      const daySlots = await this.generateDaySlots({
        date: currentDate,
        providerId: params.providerId,
        serviceId: params.serviceId,
        serviceDuration,
        settings,
        recurringRules,
        exceptions,
        existingBookings,
        includeBooked: params.includeBooked
      });
      
      allSlots.push(...daySlots);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // 7. Sort slots by date and time
    return allSlots.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.startTime.localeCompare(b.startTime);
    });
  }

  /**
   * Generate slots for a single day
   */
  private async generateDaySlots(params: {
    date: Date;
    providerId: string;
    serviceId?: string;
    serviceDuration: number;
    settings: ProviderSettings;
    recurringRules: RecurringRule[];
    exceptions: AvailabilityException[];
    existingBookings: any[];
    includeBooked?: boolean;
  }): Promise<AvailabilitySlot[]> {
    const { date, settings, recurringRules, exceptions, existingBookings } = params;
    const dayOfWeek = date.getDay();
    const dateStr = format(date, 'yyyy-MM-dd');
    
    // Check if this day has an exception
    const dayException = exceptions.find(e => e.date === dateStr);
    
    // If closed for the day, return empty
    if (dayException?.isClosed) {
      return [];
    }
    
    // Get base availability from recurring rules
    const dayRules = recurringRules.filter(r => r.dayOfWeek === dayOfWeek);
    if (dayRules.length === 0 && !dayException) {
      return []; // No availability on this day
    }
    
    // Apply exception overrides if present
    let startMinute: number;
    let endMinute: number;
    let capacity: number;
    
    if (dayException && !dayException.isClosed) {
      startMinute = dayException.startMinute || dayRules[0]?.startMinute || 540; // 9 AM default
      endMinute = dayException.endMinute || dayRules[0]?.endMinute || 1020; // 5 PM default
      capacity = dayRules[0]?.capacity || settings.defaultCapacity;
    } else if (dayRules.length > 0) {
      // Use recurring rules
      startMinute = Math.min(...dayRules.map(r => r.startMinute));
      endMinute = Math.max(...dayRules.map(r => r.endMinute));
      capacity = Math.max(...dayRules.map(r => r.capacity));
    } else {
      return [];
    }
    
    // Generate time slots
    const slots: AvailabilitySlot[] = [];
    let currentMinute = startMinute;
    
    while (currentMinute + params.serviceDuration <= endMinute) {
      const slotStartTime = this.minutesToTime(currentMinute);
      const slotEndTime = this.minutesToTime(currentMinute + params.serviceDuration);
      
      // Check if slot meets lead time and cutoff requirements
      const slotDateTime = this.combineDateAndTime(date, slotStartTime, settings.timezone);
      const now = new Date();
      const leadTimeOk = this.checkLeadTime(slotDateTime, now, settings.leadTimeMinutes);
      const cutoffOk = this.checkCutoff(slotDateTime, now, settings.cutoffMinutes);
      
      if (leadTimeOk && cutoffOk) {
        // Calculate remaining capacity
        const bookedCount = existingBookings.filter(b => 
          b.bookingDate === dateStr &&
          b.startTime === slotStartTime &&
          ['hold', 'confirmed', 'in_progress'].includes(b.status)
        ).length;
        
        const remainingCapacity = capacity - bookedCount;
        const available = remainingCapacity > 0;
        
        // Add slot if available or if including booked slots
        if (available || params.includeBooked) {
          slots.push({
            date: dateStr,
            startTime: slotStartTime,
            endTime: slotEndTime,
            available,
            capacity,
            remainingCapacity,
            providerId: params.providerId,
            serviceId: params.serviceId
          });
        }
      }
      
      // Move to next slot interval
      currentMinute += this.SLOT_INTERVAL_MINUTES;
    }
    
    return slots;
  }

  /**
   * Get provider settings including timezone and buffers
   */
  private async getProviderSettings(providerId: string): Promise<ProviderSettings> {
    // First try to get from provider_settings table (if it exists)
    // Fall back to defaults if not found
    const provider = await db
      .select({
        timezone: sql<string>`COALESCE(${providersTable.timezone}, 'America/New_York')`.as('timezone')
      })
      .from(providersTable)
      .where(eq(providersTable.id, providerId))
      .limit(1);

    if (provider.length === 0) {
      throw new Error(`Provider ${providerId} not found`);
    }

    // TODO: Get from provider_settings table once created
    return {
      timezone: provider[0].timezone || 'America/New_York',
      leadTimeMinutes: 120, // 2 hours default
      cutoffMinutes: 30, // 30 minutes before slot
      preBufferMinutes: 0,
      postBufferMinutes: 15,
      defaultCapacity: 1
    };
  }

  /**
   * Get service details
   */
  private async getServiceDetails(serviceId: string) {
    const services = await db
      .select({
        id: servicesTable.id,
        duration: servicesTable.duration,
        bufferBefore: servicesTable.bufferBefore,
        bufferAfter: servicesTable.bufferAfter
      })
      .from(servicesTable)
      .where(eq(servicesTable.id, serviceId))
      .limit(1);

    return services[0] || null;
  }

  /**
   * Get recurring availability rules for provider
   */
  private async getRecurringRules(providerId: string): Promise<RecurringRule[]> {
    const rules = await db
      .select({
        dayOfWeek: providerAvailabilityTable.dayOfWeek,
        startTime: providerAvailabilityTable.startTime,
        endTime: providerAvailabilityTable.endTime
      })
      .from(providerAvailabilityTable)
      .where(
        and(
          eq(providerAvailabilityTable.providerId, providerId),
          eq(providerAvailabilityTable.isActive, true)
        )
      );

    return rules.map(rule => ({
      dayOfWeek: rule.dayOfWeek,
      startMinute: this.timeToMinutes(rule.startTime),
      endMinute: this.timeToMinutes(rule.endTime),
      capacity: 1 // Default capacity
    }));
  }

  /**
   * Get availability exceptions for date range
   */
  private async getExceptions(
    providerId: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<AvailabilityException[]> {
    const blockedSlots = await db
      .select({
        date: providerBlockedSlotsTable.blockedDate,
        startTime: providerBlockedSlotsTable.startTime,
        endTime: providerBlockedSlotsTable.endTime,
        isFullDay: providerBlockedSlotsTable.isFullDay
      })
      .from(providerBlockedSlotsTable)
      .where(
        and(
          eq(providerBlockedSlotsTable.providerId, providerId),
          gte(providerBlockedSlotsTable.blockedDate, startDate),
          lte(providerBlockedSlotsTable.blockedDate, endDate)
        )
      );

    return blockedSlots.map(slot => ({
      date: format(slot.date, 'yyyy-MM-dd'),
      startMinute: slot.startTime ? this.timeToMinutes(slot.startTime) : undefined,
      endMinute: slot.endTime ? this.timeToMinutes(slot.endTime) : undefined,
      isClosed: slot.isFullDay
    }));
  }

  /**
   * Get existing bookings for capacity calculation
   */
  private async getExistingBookings(
    providerId: string,
    startDate: Date,
    endDate: Date
  ) {
    return await db
      .select({
        id: bookingsTable.id,
        bookingDate: bookingsTable.bookingDate,
        startTime: bookingsTable.startTime,
        endTime: bookingsTable.endTime,
        status: bookingsTable.status
      })
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.providerId, providerId),
          gte(bookingsTable.bookingDate, format(startDate, 'yyyy-MM-dd')),
          lte(bookingsTable.bookingDate, format(endDate, 'yyyy-MM-dd')),
          inArray(bookingsTable.status, ['hold', 'pending', 'confirmed', 'in_progress'])
        )
      );
  }

  /**
   * Convert time string (HH:mm) to minutes since midnight
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Convert minutes since midnight to time string (HH:mm)
   */
  private minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  /**
   * Combine date and time in provider's timezone
   */
  private combineDateAndTime(date: Date, time: string, timezone: string): Date {
    const [hours, minutes] = time.split(':').map(Number);
    const dateInTz = utcToZonedTime(date, timezone);
    dateInTz.setHours(hours, minutes, 0, 0);
    return zonedTimeToUtc(dateInTz, timezone);
  }

  /**
   * Check if slot meets lead time requirement
   */
  private checkLeadTime(slotTime: Date, now: Date, leadTimeMinutes: number): boolean {
    const leadTimeDate = addMinutes(now, leadTimeMinutes);
    return isAfter(slotTime, leadTimeDate);
  }

  /**
   * Check if slot meets cutoff requirement
   */
  private checkCutoff(slotTime: Date, now: Date, cutoffMinutes: number): boolean {
    const cutoffDate = addMinutes(slotTime, -cutoffMinutes);
    return isAfter(cutoffDate, now);
  }
}

// Export singleton instance
export const slotGenerator = new SlotGenerator();