"use server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  setWeeklySchedule,
  blockTimeSlot,
  unblockTimeSlot,
  getAvailableSlots,
  checkSlotAvailability,
  getProviderAvailability,
  getProviderBlockedSlots,
  clearProviderBlockedSlots,
  copyProviderAvailability,
  weeklyScheduleSchema,
  timeSlotSchema,
  bulkBlockSchema,
} from "@/db/queries/availability-queries";
import { db } from "@/db/db";
import { providersTable, providerBlockedSlotsTable } from "@/db/schema/providers-schema";
import { eq, or } from "drizzle-orm";
import { parseISO, isValid, startOfDay, addDays } from "date-fns";

// Action response types
export type ActionResponse<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
  details?: any;
};

/**
 * Set or update provider's weekly recurring schedule
 */
export async function setWeeklyScheduleAction(
  providerId: string,
  schedule: z.infer<typeof weeklyScheduleSchema>[],
  revalidate: boolean = true
): Promise<ActionResponse> {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: "Unauthorized: Please sign in to continue",
      };
    }

    // Verify provider exists and user has permission
    const provider = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, providerId))
      .limit(1);

    if (provider.length === 0) {
      return {
        success: false,
        error: "Provider not found",
      };
    }

    if (provider[0].userId !== userId) {
      return {
        success: false,
        error: "Forbidden: You can only update your own availability",
      };
    }

    // Validate schedule
    try {
      const validatedSchedule = schedule.map(s => weeklyScheduleSchema.parse(s));

      // Additional validation
      for (const slot of validatedSchedule) {
        const [startHour, startMin] = slot.startTime.split(":").map(Number);
        const [endHour, endMin] = slot.endTime.split(":").map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;

        if (startMinutes === endMinutes) {
          return {
            success: false,
            error: `Invalid schedule for day ${slot.dayOfWeek}: Start and end time cannot be the same`,
          };
        }

        // Check for duplicate days
        const dayCount = validatedSchedule.filter(s => s.dayOfWeek === slot.dayOfWeek).length;
        if (dayCount > 1) {
          return {
            success: false,
            error: `Multiple schedules for day ${slot.dayOfWeek} are not allowed`,
          };
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: "Validation error",
          details: error.errors,
        };
      }
      throw error;
    }

    // Update the schedule
    const result = await setWeeklySchedule(providerId, schedule);

    // Revalidate relevant paths
    if (revalidate) {
      revalidatePath(`/providers/${providerId}`);
      revalidatePath(`/dashboard/provider/availability`);
    }

    return {
      success: true,
      data: {
        ...result,
        providerId,
        schedule,
      },
    };
  } catch (error) {
    console.error("Error in setWeeklyScheduleAction:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update weekly schedule",
    };
  }
}

/**
 * Block time slots for a provider
 */
export async function blockTimeSlotAction(
  providerId: string,
  blockData: z.infer<typeof timeSlotSchema> | z.infer<typeof bulkBlockSchema>,
  revalidate: boolean = true
): Promise<ActionResponse> {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: "Unauthorized: Please sign in to continue",
      };
    }

    // Verify provider exists and user has permission
    const provider = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, providerId))
      .limit(1);

    if (provider.length === 0) {
      return {
        success: false,
        error: "Provider not found",
      };
    }

    if (provider[0].userId !== userId) {
      return {
        success: false,
        error: "Forbidden: You can only manage your own availability",
      };
    }

    // Validate block data
    try {
      if ("startDate" in blockData && "endDate" in blockData) {
        // Bulk block validation
        const validated = bulkBlockSchema.parse(blockData);
        const startDate = parseISO(validated.startDate);
        const endDate = parseISO(validated.endDate);

        if (!isValid(startDate) || !isValid(endDate)) {
          return {
            success: false,
            error: "Invalid date format",
          };
        }

        if (endDate < startDate) {
          return {
            success: false,
            error: "End date must be after start date",
          };
        }

        // Limit bulk blocks to 365 days
        const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff > 365) {
          return {
            success: false,
            error: "Cannot block more than 365 days at once",
          };
        }
      } else {
        // Single slot validation
        const validated = timeSlotSchema.parse(blockData);
        const date = parseISO(validated.date);

        if (!isValid(date)) {
          return {
            success: false,
            error: "Invalid date format",
          };
        }

        // Don't allow blocking past dates
        if (startOfDay(date) < startOfDay(new Date())) {
          return {
            success: false,
            error: "Cannot block past dates",
          };
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: "Validation error",
          details: error.errors,
        };
      }
      throw error;
    }

    // Block the time slot(s)
    const result = await blockTimeSlot(providerId, blockData);

    // Revalidate relevant paths
    if (revalidate) {
      revalidatePath(`/providers/${providerId}`);
      revalidatePath(`/dashboard/provider/availability`);
    }

    return {
      success: true,
      data: {
        ...result,
        providerId,
      },
    };
  } catch (error) {
    console.error("Error in blockTimeSlotAction:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to block time slots",
    };
  }
}

/**
 * Unblock a previously blocked time slot
 */
export async function unblockTimeSlotAction(
  blockId: string,
  revalidate: boolean = true
): Promise<ActionResponse> {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: "Unauthorized: Please sign in to continue",
      };
    }

    // Get the block to verify ownership
    const block = await db
      .select()
      .from(providerBlockedSlotsTable)
      .where(eq(providerBlockedSlotsTable.id, blockId))
      .limit(1);

    if (block.length === 0) {
      return {
        success: false,
        error: "Blocked slot not found",
      };
    }

    // Verify provider ownership
    const provider = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, block[0].providerId))
      .limit(1);

    if (provider.length === 0) {
      return {
        success: false,
        error: "Provider not found",
      };
    }

    if (provider[0].userId !== userId) {
      return {
        success: false,
        error: "Forbidden: You can only manage your own availability",
      };
    }

    // Unblock the slot
    const result = await unblockTimeSlot(blockId);

    // Revalidate relevant paths
    if (revalidate) {
      revalidatePath(`/providers/${provider[0].id}`);
      revalidatePath(`/dashboard/provider/availability`);
    }

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("Error in unblockTimeSlotAction:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to unblock time slot",
    };
  }
}

/**
 * Get available time slots for a specific date and service
 */
export async function getAvailableSlotsAction(
  providerId: string,
  date: string,
  serviceDurationMinutes: number,
  settings?: {
    timezone?: string;
    minimumNoticeHours?: number;
    bufferMinutes?: number;
  }
): Promise<ActionResponse> {
  try {
    // Parse and validate date
    const parsedDate = parseISO(date);
    if (!isValid(parsedDate)) {
      return {
        success: false,
        error: "Invalid date format",
      };
    }

    // Validate date is not in the past
    const today = startOfDay(new Date());
    if (startOfDay(parsedDate) < today) {
      return {
        success: false,
        error: "Cannot get slots for past dates",
      };
    }

    // Validate date is not too far in the future
    const maxDate = addDays(today, 90);
    if (startOfDay(parsedDate) > maxDate) {
      return {
        success: false,
        error: "Cannot get slots more than 90 days in advance",
      };
    }

    // Validate service duration
    if (serviceDurationMinutes < 15 || serviceDurationMinutes > 480) {
      return {
        success: false,
        error: "Service duration must be between 15 and 480 minutes",
      };
    }

    // Verify provider exists and is active
    const provider = await db
      .select({
        id: providersTable.id,
        displayName: providersTable.displayName,
        isActive: providersTable.isActive,
      })
      .from(providersTable)
      .where(eq(providersTable.id, providerId))
      .limit(1);

    if (provider.length === 0) {
      return {
        success: false,
        error: "Provider not found",
      };
    }

    if (!provider[0].isActive) {
      return {
        success: false,
        error: "Provider is not currently accepting bookings",
      };
    }

    // Get available slots
    const availableSlots = await getAvailableSlots(
      providerId,
      parsedDate,
      serviceDurationMinutes,
      settings
    );

    return {
      success: true,
      data: {
        providerId,
        providerName: provider[0].displayName,
        date: parsedDate.toISOString(),
        serviceDuration: serviceDurationMinutes,
        slots: availableSlots,
        totalSlots: availableSlots.length,
      },
    };
  } catch (error) {
    console.error("Error in getAvailableSlotsAction:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get available slots",
    };
  }
}

/**
 * Check if a specific time slot is available
 */
export async function checkSlotAvailabilityAction(
  providerId: string,
  date: string,
  startTime: string,
  endTime: string,
  settings?: {
    timezone?: string;
    minimumNoticeHours?: number;
  }
): Promise<ActionResponse> {
  try {
    // Parse and validate date
    const parsedDate = parseISO(date);
    if (!isValid(parsedDate)) {
      return {
        success: false,
        error: "Invalid date format",
      };
    }

    // Validate time format
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return {
        success: false,
        error: "Invalid time format. Use HH:MM (24-hour format)",
      };
    }

    // Verify provider exists
    const provider = await db
      .select({
        id: providersTable.id,
        displayName: providersTable.displayName,
        isActive: providersTable.isActive,
      })
      .from(providersTable)
      .where(eq(providersTable.id, providerId))
      .limit(1);

    if (provider.length === 0) {
      return {
        success: false,
        error: "Provider not found",
      };
    }

    if (!provider[0].isActive) {
      return {
        success: true,
        data: {
          available: false,
          reason: "Provider is not currently accepting bookings",
          providerId,
          providerName: provider[0].displayName,
        },
      };
    }

    // Check availability
    const availability = await checkSlotAvailability(
      providerId,
      parsedDate,
      startTime,
      endTime,
      settings
    );

    return {
      success: true,
      data: {
        ...availability,
        providerId,
        providerName: provider[0].displayName,
        date: parsedDate.toISOString(),
        startTime,
        endTime,
      },
    };
  } catch (error) {
    console.error("Error in checkSlotAvailabilityAction:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to check slot availability",
    };
  }
}

/**
 * Clear blocked slots for a provider
 */
export async function clearBlockedSlotsAction(
  providerId: string,
  startDate?: string,
  endDate?: string,
  revalidate: boolean = true
): Promise<ActionResponse> {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: "Unauthorized: Please sign in to continue",
      };
    }

    // Verify provider exists and user has permission
    const provider = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, providerId))
      .limit(1);

    if (provider.length === 0) {
      return {
        success: false,
        error: "Provider not found",
      };
    }

    if (provider[0].userId !== userId) {
      return {
        success: false,
        error: "Forbidden: You can only manage your own availability",
      };
    }

    // Parse dates if provided
    let parsedStartDate: Date | undefined;
    let parsedEndDate: Date | undefined;

    if (startDate) {
      parsedStartDate = parseISO(startDate);
      if (!isValid(parsedStartDate)) {
        return {
          success: false,
          error: "Invalid start date format",
        };
      }
    }

    if (endDate) {
      parsedEndDate = parseISO(endDate);
      if (!isValid(parsedEndDate)) {
        return {
          success: false,
          error: "Invalid end date format",
        };
      }
    }

    // Clear blocked slots
    const result = await clearProviderBlockedSlots(providerId, parsedStartDate, parsedEndDate);

    // Revalidate relevant paths
    if (revalidate) {
      revalidatePath(`/providers/${providerId}`);
      revalidatePath(`/dashboard/provider/availability`);
    }

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("Error in clearBlockedSlotsAction:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to clear blocked slots",
    };
  }
}

/**
 * Copy availability settings from one provider to another
 */
export async function copyAvailabilityAction(
  sourceProviderId: string,
  targetProviderId: string,
  revalidate: boolean = true
): Promise<ActionResponse> {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: "Unauthorized: Please sign in to continue",
      };
    }

    // Verify both providers exist and user has permission for target
    const providers = await db
      .select()
      .from(providersTable)
      .where(or(
        eq(providersTable.id, sourceProviderId),
        eq(providersTable.id, targetProviderId)
      ));

    const sourceProvider = providers.find(p => p.id === sourceProviderId);
    const targetProvider = providers.find(p => p.id === targetProviderId);

    if (!sourceProvider || !targetProvider) {
      return {
        success: false,
        error: "One or both providers not found",
      };
    }

    // User must own the target provider
    if (targetProvider.userId !== userId) {
      return {
        success: false,
        error: "Forbidden: You can only update your own availability",
      };
    }

    // Copy availability
    const result = await copyProviderAvailability(sourceProviderId, targetProviderId);

    // Revalidate relevant paths
    if (revalidate) {
      revalidatePath(`/providers/${targetProviderId}`);
      revalidatePath(`/dashboard/provider/availability`);
    }

    return {
      success: true,
      data: {
        ...result,
        sourceProviderId,
        targetProviderId,
      },
    };
  } catch (error) {
    console.error("Error in copyAvailabilityAction:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to copy availability",
    };
  }
}