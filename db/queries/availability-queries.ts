import { db } from "@/db/db";
import {
  providerAvailabilityTable,
  providerBlockedSlotsTable,
  ProviderAvailability,
  ProviderBlockedSlot,
  NewProviderAvailability,
  NewProviderBlockedSlot,
} from "@/db/schema/providers-schema";
import { bookingsTable } from "@/db/schema/bookings-schema";
import { eq, and, gte, lte, or, sql, between } from "drizzle-orm";
import { z } from "zod";
import { format, parse, addMinutes, startOfDay, endOfDay, isAfter, isBefore, parseISO, addDays } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

// Validation schemas
export const weeklyScheduleSchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  isActive: z.boolean().default(true),
});

export const timeSlotSchema = z.object({
  date: z.string().datetime(),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  reason: z.string().optional(),
});

export const bulkBlockSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  reason: z.string().optional(),
});

// Type definitions
export interface TimeSlot {
  startTime: string;
  endTime: string;
  available: boolean;
  reason?: string;
}

export interface DayAvailability {
  date: Date;
  dayOfWeek: number;
  slots: TimeSlot[];
  isBlocked: boolean;
  blockReason?: string;
}

export interface AvailabilitySettings {
  timezone: string;
  minimumNoticeHours: number;
  slotDurationMinutes: number;
  bufferMinutes?: number;
  maxAdvanceBookingDays?: number;
}

const DEFAULT_SETTINGS: AvailabilitySettings = {
  timezone: "America/New_York",
  minimumNoticeHours: 24,
  slotDurationMinutes: 60,
  bufferMinutes: 15,
  maxAdvanceBookingDays: 90,
};

/**
 * Get provider's complete availability including weekly schedule and blocked slots
 */
export async function getProviderAvailability(
  providerId: string,
  startDate?: Date,
  endDate?: Date,
  settings: Partial<AvailabilitySettings> = {}
) {
  const config = { ...DEFAULT_SETTINGS, ...settings };
  const start = startDate || new Date();
  const end = endDate || addDays(start, 30);

  try {
    // Get weekly recurring schedule
    const weeklySchedule = await db
      .select()
      .from(providerAvailabilityTable)
      .where(
        and(
          eq(providerAvailabilityTable.providerId, providerId),
          eq(providerAvailabilityTable.isActive, true)
        )
      );

    // Get blocked slots for the date range
    const blockedSlots = await db
      .select()
      .from(providerBlockedSlotsTable)
      .where(
        and(
          eq(providerBlockedSlotsTable.providerId, providerId),
          between(providerBlockedSlotsTable.blockedDate, start, end)
        )
      );

    // Get existing bookings for the date range
    const bookings = await db
      .select({
        bookingDate: bookingsTable.bookingDate,
        startTime: bookingsTable.startTime,
        endTime: bookingsTable.endTime,
        status: bookingsTable.status,
      })
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.providerId, providerId),
          between(bookingsTable.bookingDate, start, end),
          sql`${bookingsTable.status} NOT IN ('cancelled', 'no_show')`
        )
      );

    return {
      weeklySchedule,
      blockedSlots,
      bookings,
      settings: config,
    };
  } catch (error) {
    console.error("Error fetching provider availability:", error);
    throw new Error("Failed to fetch provider availability");
  }
}

/**
 * Set or update provider's weekly recurring schedule
 */
export async function setWeeklySchedule(
  providerId: string,
  schedule: z.infer<typeof weeklyScheduleSchema>[]
) {
  try {
    // Validate all schedule entries
    const validatedSchedule = schedule.map(s => weeklyScheduleSchema.parse(s));

    // Start transaction
    return await db.transaction(async (tx) => {
      // Deactivate existing schedule
      await tx
        .update(providerAvailabilityTable)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(providerAvailabilityTable.providerId, providerId));

      // Insert new schedule
      if (validatedSchedule.length > 0) {
        const newSchedule: NewProviderAvailability[] = validatedSchedule.map(s => ({
          providerId,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          isActive: s.isActive,
        }));

        await tx.insert(providerAvailabilityTable).values(newSchedule);
      }

      return { success: true, message: "Weekly schedule updated successfully" };
    });
  } catch (error) {
    console.error("Error setting weekly schedule:", error);
    if (error instanceof z.ZodError) {
      throw new Error(`Validation error: ${error.errors.map(e => e.message).join(", ")}`);
    }
    throw new Error("Failed to update weekly schedule");
  }
}

/**
 * Block a specific time slot or date range
 */
export async function blockTimeSlot(
  providerId: string,
  blockData: z.infer<typeof timeSlotSchema> | z.infer<typeof bulkBlockSchema>
) {
  try {
    // Determine if it's a single slot or bulk block
    const isBulk = "startDate" in blockData && "endDate" in blockData;

    if (isBulk) {
      // Handle bulk blocking (e.g., vacation)
      const validated = bulkBlockSchema.parse(blockData);
      const startDate = parseISO(validated.startDate);
      const endDate = parseISO(validated.endDate);
      
      const blockedSlots: NewProviderBlockedSlot[] = [];
      let currentDate = startDate;

      while (currentDate <= endDate) {
        blockedSlots.push({
          providerId,
          blockedDate: currentDate,
          startTime: validated.startTime || null,
          endTime: validated.endTime || null,
          reason: validated.reason || "Blocked",
        });
        currentDate = addDays(currentDate, 1);
      }

      const result = await db.insert(providerBlockedSlotsTable).values(blockedSlots).returning();
      return { success: true, blockedCount: result.length, blockedSlots: result };
    } else {
      // Handle single slot blocking
      const validated = timeSlotSchema.parse(blockData);
      const blockedSlot: NewProviderBlockedSlot = {
        providerId,
        blockedDate: parseISO(validated.date),
        startTime: validated.startTime,
        endTime: validated.endTime,
        reason: validated.reason || "Blocked",
      };

      const result = await db.insert(providerBlockedSlotsTable).values(blockedSlot).returning();
      return { success: true, blockedSlot: result[0] };
    }
  } catch (error) {
    console.error("Error blocking time slot:", error);
    if (error instanceof z.ZodError) {
      throw new Error(`Validation error: ${error.errors.map(e => e.message).join(", ")}`);
    }
    throw new Error("Failed to block time slot");
  }
}

/**
 * Unblock a previously blocked time slot
 */
export async function unblockTimeSlot(blockId: string) {
  try {
    const result = await db
      .delete(providerBlockedSlotsTable)
      .where(eq(providerBlockedSlotsTable.id, blockId))
      .returning();

    if (result.length === 0) {
      throw new Error("Blocked slot not found");
    }

    return { success: true, unblocked: result[0] };
  } catch (error) {
    console.error("Error unblocking time slot:", error);
    throw new Error("Failed to unblock time slot");
  }
}

/**
 * Get available time slots for a specific date and service duration
 */
export async function getAvailableSlots(
  providerId: string,
  date: Date,
  serviceDurationMinutes: number,
  settings: Partial<AvailabilitySettings> = {}
): Promise<TimeSlot[]> {
  const config = { ...DEFAULT_SETTINGS, ...settings };
  
  try {
    // Get provider's availability data
    const availability = await getProviderAvailability(
      providerId,
      startOfDay(date),
      endOfDay(date),
      settings
    );

    const dayOfWeek = date.getDay();
    const availableSlots: TimeSlot[] = [];

    // Find the weekly schedule for this day
    const daySchedule = availability.weeklySchedule.find(s => s.dayOfWeek === dayOfWeek);
    
    if (!daySchedule || !daySchedule.isActive) {
      return []; // Provider not available on this day
    }

    // Check if the entire day is blocked
    const dayBlocked = availability.blockedSlots.find(
      b => b.blockedDate && 
      startOfDay(b.blockedDate).getTime() === startOfDay(date).getTime() &&
      !b.startTime && !b.endTime
    );

    if (dayBlocked) {
      return []; // Entire day is blocked
    }

    // Generate time slots based on the schedule
    const scheduleStart = parse(daySchedule.startTime, "HH:mm", date);
    const scheduleEnd = parse(daySchedule.endTime, "HH:mm", date);
    
    // Handle overnight services (e.g., 22:00 to 02:00)
    const actualEnd = isBefore(scheduleEnd, scheduleStart) 
      ? addDays(scheduleEnd, 1) 
      : scheduleEnd;

    let currentSlotStart = scheduleStart;
    const now = new Date();
    const minimumBookingTime = addMinutes(now, config.minimumNoticeHours * 60);

    while (currentSlotStart < actualEnd) {
      const currentSlotEnd = addMinutes(currentSlotStart, serviceDurationMinutes);
      
      if (currentSlotEnd > actualEnd) {
        break; // Not enough time for this slot
      }

      // Check if slot meets minimum notice requirement
      if (isBefore(currentSlotStart, minimumBookingTime)) {
        currentSlotStart = addMinutes(currentSlotStart, config.slotDurationMinutes);
        continue;
      }

      // Check if slot is blocked
      const isBlocked = availability.blockedSlots.some(b => {
        if (!b.startTime || !b.endTime) return false;
        const blockStart = parse(b.startTime, "HH:mm", date);
        const blockEnd = parse(b.endTime, "HH:mm", date);
        return (
          (currentSlotStart >= blockStart && currentSlotStart < blockEnd) ||
          (currentSlotEnd > blockStart && currentSlotEnd <= blockEnd)
        );
      });

      // Check if slot conflicts with existing bookings
      const hasBooking = availability.bookings.some(b => {
        const bookingStart = parse(b.startTime, "HH:mm", b.bookingDate!);
        const bookingEnd = parse(b.endTime, "HH:mm", b.bookingDate!);
        return (
          (currentSlotStart >= bookingStart && currentSlotStart < bookingEnd) ||
          (currentSlotEnd > bookingStart && currentSlotEnd <= bookingEnd)
        );
      });

      availableSlots.push({
        startTime: format(currentSlotStart, "HH:mm"),
        endTime: format(currentSlotEnd, "HH:mm"),
        available: !isBlocked && !hasBooking,
        reason: isBlocked ? "Blocked by provider" : hasBooking ? "Already booked" : undefined,
      });

      // Move to next slot with buffer time
      currentSlotStart = addMinutes(currentSlotStart, config.slotDurationMinutes);
      if (config.bufferMinutes && config.bufferMinutes > 0) {
        currentSlotStart = addMinutes(currentSlotStart, config.bufferMinutes);
      }
    }

    return availableSlots.filter(slot => slot.available);
  } catch (error) {
    console.error("Error getting available slots:", error);
    throw new Error("Failed to get available slots");
  }
}

/**
 * Check if a specific time slot is available
 */
export async function checkSlotAvailability(
  providerId: string,
  date: Date,
  startTime: string,
  endTime: string,
  settings: Partial<AvailabilitySettings> = {}
): Promise<{ available: boolean; reason?: string }> {
  const config = { ...DEFAULT_SETTINGS, ...settings };
  
  try {
    // Get provider's availability data
    const availability = await getProviderAvailability(
      providerId,
      startOfDay(date),
      endOfDay(date),
      settings
    );

    const dayOfWeek = date.getDay();
    
    // Check weekly schedule
    const daySchedule = availability.weeklySchedule.find(s => s.dayOfWeek === dayOfWeek);
    if (!daySchedule || !daySchedule.isActive) {
      return { available: false, reason: "Provider not available on this day" };
    }

    // Parse times
    const requestedStart = parse(startTime, "HH:mm", date);
    const requestedEnd = parse(endTime, "HH:mm", date);
    const scheduleStart = parse(daySchedule.startTime, "HH:mm", date);
    const scheduleEnd = parse(daySchedule.endTime, "HH:mm", date);

    // Check if requested slot is within provider's schedule
    if (requestedStart < scheduleStart || requestedEnd > scheduleEnd) {
      return { available: false, reason: "Outside of provider's working hours" };
    }

    // Check minimum notice
    const now = new Date();
    const minimumBookingTime = addMinutes(now, config.minimumNoticeHours * 60);
    if (isBefore(requestedStart, minimumBookingTime)) {
      return { 
        available: false, 
        reason: `Requires at least ${config.minimumNoticeHours} hours advance notice` 
      };
    }

    // Check if day is blocked
    const dayBlocked = availability.blockedSlots.find(
      b => b.blockedDate && 
      startOfDay(b.blockedDate).getTime() === startOfDay(date).getTime() &&
      !b.startTime && !b.endTime
    );

    if (dayBlocked) {
      return { available: false, reason: dayBlocked.reason || "Day is blocked" };
    }

    // Check specific time blocks
    const timeBlocked = availability.blockedSlots.find(b => {
      if (!b.startTime || !b.endTime) return false;
      const blockStart = parse(b.startTime, "HH:mm", date);
      const blockEnd = parse(b.endTime, "HH:mm", date);
      return (
        (requestedStart >= blockStart && requestedStart < blockEnd) ||
        (requestedEnd > blockStart && requestedEnd <= blockEnd) ||
        (requestedStart <= blockStart && requestedEnd >= blockEnd)
      );
    });

    if (timeBlocked) {
      return { available: false, reason: timeBlocked.reason || "Time slot is blocked" };
    }

    // Check existing bookings
    const hasConflict = availability.bookings.find(b => {
      const bookingStart = parse(b.startTime, "HH:mm", b.bookingDate!);
      const bookingEnd = parse(b.endTime, "HH:mm", b.bookingDate!);
      return (
        (requestedStart >= bookingStart && requestedStart < bookingEnd) ||
        (requestedEnd > bookingStart && requestedEnd <= bookingEnd) ||
        (requestedStart <= bookingStart && requestedEnd >= bookingEnd)
      );
    });

    if (hasConflict) {
      return { available: false, reason: "Time slot already booked" };
    }

    return { available: true };
  } catch (error) {
    console.error("Error checking slot availability:", error);
    throw new Error("Failed to check slot availability");
  }
}

/**
 * Get provider's blocked slots for a date range
 */
export async function getProviderBlockedSlots(
  providerId: string,
  startDate: Date,
  endDate: Date
): Promise<ProviderBlockedSlot[]> {
  try {
    return await db
      .select()
      .from(providerBlockedSlotsTable)
      .where(
        and(
          eq(providerBlockedSlotsTable.providerId, providerId),
          between(providerBlockedSlotsTable.blockedDate, startDate, endDate)
        )
      )
      .orderBy(providerBlockedSlotsTable.blockedDate);
  } catch (error) {
    console.error("Error fetching blocked slots:", error);
    throw new Error("Failed to fetch blocked slots");
  }
}

/**
 * Clear all blocked slots for a provider (useful for reset)
 */
export async function clearProviderBlockedSlots(
  providerId: string,
  startDate?: Date,
  endDate?: Date
) {
  try {
    const conditions = [eq(providerBlockedSlotsTable.providerId, providerId)];
    
    if (startDate && endDate) {
      conditions.push(between(providerBlockedSlotsTable.blockedDate, startDate, endDate));
    }

    const result = await db
      .delete(providerBlockedSlotsTable)
      .where(and(...conditions))
      .returning();

    return { success: true, clearedCount: result.length };
  } catch (error) {
    console.error("Error clearing blocked slots:", error);
    throw new Error("Failed to clear blocked slots");
  }
}

/**
 * Copy availability from one provider to another (useful for templates)
 */
export async function copyProviderAvailability(
  sourceProviderId: string,
  targetProviderId: string
) {
  try {
    return await db.transaction(async (tx) => {
      // Get source provider's schedule
      const sourceSchedule = await tx
        .select()
        .from(providerAvailabilityTable)
        .where(
          and(
            eq(providerAvailabilityTable.providerId, sourceProviderId),
            eq(providerAvailabilityTable.isActive, true)
          )
        );

      if (sourceSchedule.length === 0) {
        throw new Error("Source provider has no active schedule");
      }

      // Clear target provider's existing schedule
      await tx
        .update(providerAvailabilityTable)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(providerAvailabilityTable.providerId, targetProviderId));

      // Copy schedule to target provider
      const newSchedule: NewProviderAvailability[] = sourceSchedule.map(s => ({
        providerId: targetProviderId,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        isActive: true,
      }));

      await tx.insert(providerAvailabilityTable).values(newSchedule);

      return { success: true, copiedSlots: newSchedule.length };
    });
  } catch (error) {
    console.error("Error copying provider availability:", error);
    throw new Error("Failed to copy provider availability");
  }
}