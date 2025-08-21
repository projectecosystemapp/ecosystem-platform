"use server";

import { db } from "@/db/db";
import {
  providerAvailabilityTable,
  providerBlockedSlotsTable,
  type ProviderAvailability,
  type NewProviderAvailability,
  type ProviderBlockedSlot,
  type NewProviderBlockedSlot,
  providersTable,
} from "@/db/schema/providers-schema";
import { bookingsTable, bookingStatus } from "@/db/schema/bookings-schema";
import { ActionResult } from "@/types/actions/actions-types";
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { eq, and, between, ne, or, gte, lte } from "drizzle-orm";
import { 
  format, 
  addDays, 
  startOfDay, 
  endOfDay, 
  startOfWeek, 
  endOfWeek,
  isSameDay,
  parseISO 
} from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

// Type for weekly schedule
export type WeeklySchedule = {
  [key: number]: { // day of week (0-6)
    startTime: string;
    endTime: string;
    isActive: boolean;
  };
};

// Type for calendar view
export type CalendarDay = {
  date: Date;
  hasBookings: boolean;
  bookingCount: number;
  isBlocked: boolean;
  isAvailable: boolean;
};

// Set or update provider's weekly schedule
export async function setWeeklyScheduleAction(
  schedule: WeeklySchedule
): Promise<ActionResult<ProviderAvailability[]>> {
  try {
    const { userId } = auth();
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" };
    }

    // Get provider ID from user ID
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.userId, userId));

    if (!provider) {
      return { isSuccess: false, message: "Provider profile not found" };
    }

    // Use transaction to update all days atomically
    const updatedAvailability = await db.transaction(async (tx) => {
      // Delete existing availability for this provider
      await tx
        .delete(providerAvailabilityTable)
        .where(eq(providerAvailabilityTable.providerId, provider.id));

      // Insert new availability schedule
      const availabilityRecords: NewProviderAvailability[] = [];
      
      for (const [dayOfWeek, daySchedule] of Object.entries(schedule)) {
        if (daySchedule.isActive) {
          availabilityRecords.push({
            providerId: provider.id,
            dayOfWeek: parseInt(dayOfWeek),
            startTime: daySchedule.startTime,
            endTime: daySchedule.endTime,
            isActive: true,
          });
        }
      }

      if (availabilityRecords.length > 0) {
        return await tx
          .insert(providerAvailabilityTable)
          .values(availabilityRecords)
          .returning();
      }

      return [];
    });

    revalidatePath("/dashboard/provider/availability");
    revalidatePath(`/providers/${provider.slug}`);

    return {
      isSuccess: true,
      message: "Weekly schedule updated successfully",
      data: updatedAvailability,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to update schedule";
    return { isSuccess: false, message: errorMessage };
  }
}

// Get provider's weekly schedule
export async function getWeeklyScheduleAction(): Promise<ActionResult<WeeklySchedule>> {
  try {
    const { userId } = auth();
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" };
    }

    // Get provider ID from user ID
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.userId, userId));

    if (!provider) {
      return { isSuccess: false, message: "Provider profile not found" };
    }

    // Get availability records
    const availability = await db
      .select()
      .from(providerAvailabilityTable)
      .where(eq(providerAvailabilityTable.providerId, provider.id));

    // Convert to WeeklySchedule format
    const schedule: WeeklySchedule = {};
    
    // Initialize all days as inactive
    for (let i = 0; i < 7; i++) {
      schedule[i] = {
        startTime: "09:00",
        endTime: "17:00",
        isActive: false,
      };
    }

    // Update with actual availability
    availability.forEach(record => {
      schedule[record.dayOfWeek] = {
        startTime: record.startTime,
        endTime: record.endTime,
        isActive: record.isActive,
      };
    });

    return {
      isSuccess: true,
      message: "Schedule retrieved successfully",
      data: schedule,
    };
  } catch (error) {
    return { isSuccess: false, message: "Failed to get schedule" };
  }
}

// Block specific time slots
export async function blockTimeSlotsAction(
  slots: Array<{
    date: Date;
    startTime?: string;
    endTime?: string;
    reason?: string;
  }>
): Promise<ActionResult<ProviderBlockedSlot[]>> {
  try {
    const { userId } = auth();
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" };
    }

    // Get provider ID from user ID
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.userId, userId));

    if (!provider) {
      return { isSuccess: false, message: "Provider profile not found" };
    }

    // Check for existing bookings in the slots to be blocked
    for (const slot of slots) {
      const existingBookings = await db
        .select()
        .from(bookingsTable)
        .where(
          and(
            eq(bookingsTable.providerId, provider.id),
            eq(bookingsTable.bookingDate, slot.date),
            ne(bookingsTable.status, bookingStatus.CANCELLED),
            slot.startTime && slot.endTime
              ? or(
                  // Booking overlaps with blocked slot
                  and(
                    lte(bookingsTable.startTime, slot.startTime),
                    gte(bookingsTable.endTime, slot.startTime)
                  ),
                  and(
                    lte(bookingsTable.startTime, slot.endTime),
                    gte(bookingsTable.endTime, slot.endTime)
                  ),
                  and(
                    gte(bookingsTable.startTime, slot.startTime),
                    lte(bookingsTable.endTime, slot.endTime)
                  )
                )
              : eq(bookingsTable.bookingDate, slot.date) // Full day block
          )
        );

      if (existingBookings.length > 0) {
        return {
          isSuccess: false,
          message: `Cannot block ${format(slot.date, "yyyy-MM-dd")} - existing bookings conflict`,
        };
      }
    }

    // Create blocked slot records
    const blockedSlotRecords: NewProviderBlockedSlot[] = slots.map(slot => ({
      providerId: provider.id,
      blockedDate: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      reason: slot.reason,
    }));

    const blockedSlots = await db
      .insert(providerBlockedSlotsTable)
      .values(blockedSlotRecords)
      .returning();

    revalidatePath("/dashboard/provider/availability");
    revalidatePath(`/providers/${provider.slug}`);

    return {
      isSuccess: true,
      message: "Time slots blocked successfully",
      data: blockedSlots,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to block time slots";
    return { isSuccess: false, message: errorMessage };
  }
}

// Unblock time slots
export async function unblockTimeSlotsAction(
  slotIds: string[]
): Promise<ActionResult<void>> {
  try {
    const { userId } = auth();
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" };
    }

    // Get provider ID from user ID
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.userId, userId));

    if (!provider) {
      return { isSuccess: false, message: "Provider profile not found" };
    }

    // Delete blocked slots (with provider verification)
    await db
      .delete(providerBlockedSlotsTable)
      .where(
        and(
          eq(providerBlockedSlotsTable.providerId, provider.id),
          or(...slotIds.map(id => eq(providerBlockedSlotsTable.id, id)))
        )
      );

    revalidatePath("/dashboard/provider/availability");
    revalidatePath(`/providers/${provider.slug}`);

    return {
      isSuccess: true,
      message: "Time slots unblocked successfully",
    };
  } catch (error) {
    return { isSuccess: false, message: "Failed to unblock time slots" };
  }
}

// Get provider's blocked slots
export async function getBlockedSlotsAction(
  startDate?: Date,
  endDate?: Date
): Promise<ActionResult<ProviderBlockedSlot[]>> {
  try {
    const { userId } = auth();
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" };
    }

    // Get provider ID from user ID
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.userId, userId));

    if (!provider) {
      return { isSuccess: false, message: "Provider profile not found" };
    }

    let query = db
      .select()
      .from(providerBlockedSlotsTable)
      .where(eq(providerBlockedSlotsTable.providerId, provider.id))
      .$dynamic();

    if (startDate && endDate) {
      query = query.where(
        between(providerBlockedSlotsTable.blockedDate, startDate, endDate)
      );
    }

    const blockedSlots = await query;

    return {
      isSuccess: true,
      message: "Blocked slots retrieved successfully",
      data: blockedSlots,
    };
  } catch (error) {
    return { isSuccess: false, message: "Failed to get blocked slots" };
  }
}

// Get provider calendar with bookings and availability
export async function getProviderCalendarAction(
  month: number,
  year: number
): Promise<ActionResult<CalendarDay[]>> {
  try {
    const { userId } = auth();
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" };
    }

    // Get provider ID from user ID
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.userId, userId));

    if (!provider) {
      return { isSuccess: false, message: "Provider profile not found" };
    }

    // Calculate date range for the month
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);

    // Get provider's weekly availability
    const availability = await db
      .select()
      .from(providerAvailabilityTable)
      .where(
        and(
          eq(providerAvailabilityTable.providerId, provider.id),
          eq(providerAvailabilityTable.isActive, true)
        )
      );

    // Get blocked slots for the month
    const blockedSlots = await db
      .select()
      .from(providerBlockedSlotsTable)
      .where(
        and(
          eq(providerBlockedSlotsTable.providerId, provider.id),
          between(providerBlockedSlotsTable.blockedDate, startDate, endDate)
        )
      );

    // Get bookings for the month
    const bookings = await db
      .select()
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.providerId, provider.id),
          between(bookingsTable.bookingDate, startDate, endDate),
          ne(bookingsTable.status, bookingStatus.CANCELLED)
        )
      );

    // Build calendar days
    const calendarDays: CalendarDay[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      const dayAvailability = availability.find(a => a.dayOfWeek === dayOfWeek);
      
      // Check if day is blocked
      const dayBlocked = blockedSlots.some(slot => 
        isSameDay(slot.blockedDate, currentDate) && 
        (!slot.startTime || !slot.endTime) // Full day block
      );

      // Count bookings for this day
      const dayBookings = bookings.filter(booking => 
        isSameDay(booking.bookingDate, currentDate)
      );

      calendarDays.push({
        date: new Date(currentDate),
        hasBookings: dayBookings.length > 0,
        bookingCount: dayBookings.length,
        isBlocked: dayBlocked,
        isAvailable: !!dayAvailability && !dayBlocked,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return {
      isSuccess: true,
      message: "Calendar retrieved successfully",
      data: calendarDays,
    };
  } catch (error) {
    return { isSuccess: false, message: "Failed to get calendar" };
  }
}

// Calculate available slots for booking (public-facing)
export async function calculateAvailableSlotsAction(
  providerId: string,
  startDate: Date,
  endDate: Date,
  slotDuration: number = 60,
  timezone: string = "UTC"
): Promise<ActionResult<any>> {
  try {
    // Get provider's availability schedule
    const availability = await db
      .select()
      .from(providerAvailabilityTable)
      .where(
        and(
          eq(providerAvailabilityTable.providerId, providerId),
          eq(providerAvailabilityTable.isActive, true)
        )
      );

    if (availability.length === 0) {
      return {
        isSuccess: false,
        message: "Provider has not set availability",
      };
    }

    // Get blocked slots for the date range
    const blockedSlots = await db
      .select()
      .from(providerBlockedSlotsTable)
      .where(
        and(
          eq(providerBlockedSlotsTable.providerId, providerId),
          between(providerBlockedSlotsTable.blockedDate, startDate, endDate)
        )
      );

    // Get existing bookings for the date range
    const existingBookings = await db
      .select()
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.providerId, providerId),
          between(bookingsTable.bookingDate, startDate, endDate),
          ne(bookingsTable.status, bookingStatus.CANCELLED)
        )
      );

    // Calculate available slots
    const availableSlots: Array<{
      date: string;
      slots: Array<{
        startTime: string;
        endTime: string;
        available: boolean;
      }>;
    }> = [];

    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      const dayAvailability = availability.find(a => a.dayOfWeek === dayOfWeek);

      if (dayAvailability) {
        const daySlots: Array<{
          startTime: string;
          endTime: string;
          available: boolean;
        }> = [];

        // Generate time slots for the day
        const startMinutes = timeToMinutes(dayAvailability.startTime);
        const endMinutes = timeToMinutes(dayAvailability.endTime);
        
        for (let minutes = startMinutes; minutes < endMinutes; minutes += slotDuration) {
          const slotStart = minutesToTime(minutes);
          const slotEnd = minutesToTime(Math.min(minutes + slotDuration, endMinutes));

          // Check if slot is blocked
          const isBlocked = blockedSlots.some(blocked => {
            if (!isSameDay(blocked.blockedDate, currentDate)) return false;
            if (!blocked.startTime || !blocked.endTime) return true; // Full day block
            
            return (
              (slotStart >= blocked.startTime && slotStart < blocked.endTime) ||
              (slotEnd > blocked.startTime && slotEnd <= blocked.endTime)
            );
          });

          // Check if slot has an existing booking
          const hasBooking = existingBookings.some(booking => {
            if (!isSameDay(booking.bookingDate, currentDate)) return false;
            
            return (
              (slotStart >= booking.startTime && slotStart < booking.endTime) ||
              (slotEnd > booking.startTime && slotEnd <= booking.endTime)
            );
          });

          // Don't show slots in the past
          const slotDateTime = new Date(currentDate);
          const [hours, mins] = slotStart.split(":").map(Number);
          slotDateTime.setHours(hours, mins, 0, 0);
          const isPast = slotDateTime < new Date();

          daySlots.push({
            startTime: slotStart,
            endTime: slotEnd,
            available: !isBlocked && !hasBooking && !isPast,
          });
        }

        if (daySlots.length > 0) {
          availableSlots.push({
            date: format(currentDate, "yyyy-MM-dd"),
            slots: daySlots,
          });
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return {
      isSuccess: true,
      message: "Available slots calculated successfully",
      data: availableSlots,
    };
  } catch (error) {
    return { isSuccess: false, message: "Failed to calculate available slots" };
  }
}

// Toggle day availability (quick enable/disable)
export async function toggleDayAvailabilityAction(
  dayOfWeek: number,
  isActive: boolean
): Promise<ActionResult<ProviderAvailability | null>> {
  try {
    const { userId } = auth();
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" };
    }

    // Get provider ID from user ID
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.userId, userId));

    if (!provider) {
      return { isSuccess: false, message: "Provider profile not found" };
    }

    // Update or create availability for the day
    const existingAvailability = await db
      .select()
      .from(providerAvailabilityTable)
      .where(
        and(
          eq(providerAvailabilityTable.providerId, provider.id),
          eq(providerAvailabilityTable.dayOfWeek, dayOfWeek)
        )
      );

    let result;
    if (existingAvailability.length > 0) {
      // Update existing
      [result] = await db
        .update(providerAvailabilityTable)
        .set({ isActive, updatedAt: new Date() })
        .where(
          and(
            eq(providerAvailabilityTable.providerId, provider.id),
            eq(providerAvailabilityTable.dayOfWeek, dayOfWeek)
          )
        )
        .returning();
    } else if (isActive) {
      // Create new (only if enabling)
      [result] = await db
        .insert(providerAvailabilityTable)
        .values({
          providerId: provider.id,
          dayOfWeek,
          startTime: "09:00",
          endTime: "17:00",
          isActive: true,
        })
        .returning();
    } else {
      result = null;
    }

    revalidatePath("/dashboard/provider/availability");
    revalidatePath(`/providers/${provider.slug}`);

    return {
      isSuccess: true,
      message: `${dayOfWeek} ${isActive ? "enabled" : "disabled"} successfully`,
      data: result,
    };
  } catch (error) {
    return { isSuccess: false, message: "Failed to toggle day availability" };
  }
}

// Helper functions
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

// Copy schedule to another week
export async function copyScheduleToWeekAction(
  targetWeekStart: Date
): Promise<ActionResult<void>> {
  try {
    const { userId } = auth();
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" };
    }

    // Get provider ID from user ID
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.userId, userId));

    if (!provider) {
      return { isSuccess: false, message: "Provider profile not found" };
    }

    // Get current weekly availability
    const availability = await db
      .select()
      .from(providerAvailabilityTable)
      .where(eq(providerAvailabilityTable.providerId, provider.id));

    // Apply the schedule to the target week by creating blocked/unblocked slots
    const targetWeekEnd = endOfWeek(targetWeekStart);
    const currentDate = new Date(targetWeekStart);
    
    while (currentDate <= targetWeekEnd) {
      const dayOfWeek = currentDate.getDay();
      const dayAvailability = availability.find(a => a.dayOfWeek === dayOfWeek);
      
      if (!dayAvailability || !dayAvailability.isActive) {
        // Block the entire day if not available
        await db
          .insert(providerBlockedSlotsTable)
          .values({
            providerId: provider.id,
            blockedDate: new Date(currentDate),
            reason: "Day off",
          })
          .onConflictDoNothing();
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }

    revalidatePath("/dashboard/provider/availability");

    return {
      isSuccess: true,
      message: "Schedule copied successfully",
    };
  } catch (error) {
    return { isSuccess: false, message: "Failed to copy schedule" };
  }
}