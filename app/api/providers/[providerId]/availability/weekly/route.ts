// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { 
  getProviderAvailability, 
  setWeeklySchedule,
  weeklyScheduleSchema 
} from "@/db/queries/availability-queries";
import { db } from "@/db/db";
import { providersTable } from "@/db/schema/providers-schema";
import { eq } from "drizzle-orm";

// Request validation schemas
const getWeeklyScheduleSchema = z.object({
  timezone: z.string().optional(),
});

const setWeeklyScheduleRequestSchema = z.object({
  schedule: z.array(weeklyScheduleSchema),
  timezone: z.string().optional(),
});

/**
 * GET /api/providers/[providerId]/availability/weekly
 * Get provider's weekly recurring schedule
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { providerId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const providerId = params.providerId;
    if (!providerId) {
      return NextResponse.json(
        { error: "Provider ID is required" },
        { status: 400 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const timezone = searchParams.get("timezone") || "America/New_York";

    // Verify provider exists
    const provider = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, providerId))
      .limit(1);

    if (provider.length === 0) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 }
      );
    }

    // Get availability data
    const availability = await getProviderAvailability(
      providerId,
      undefined,
      undefined,
      { timezone }
    );

    // Format weekly schedule for response
    const weeklySchedule = availability.weeklySchedule
      .filter(s => s.isActive)
      .map(s => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        isActive: s.isActive,
      }))
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek);

    return NextResponse.json({
      providerId,
      weeklySchedule,
      timezone,
      settings: availability.settings,
    });
  } catch (error) {
    console.error("Error fetching weekly schedule:", error);
    return NextResponse.json(
      { error: "Failed to fetch weekly schedule" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/providers/[providerId]/availability/weekly
 * Set or update provider's weekly recurring schedule
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { providerId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const providerId = params.providerId;
    if (!providerId) {
      return NextResponse.json(
        { error: "Provider ID is required" },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = setWeeklyScheduleRequestSchema.parse(body);

    // Verify provider exists and user has permission
    const provider = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, providerId))
      .limit(1);

    if (provider.length === 0) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 }
      );
    }

    // Check if user owns this provider profile
    if (provider[0].userId !== userId) {
      return NextResponse.json(
        { error: "Forbidden: You can only update your own availability" },
        { status: 403 }
      );
    }

    // Validate schedule logic
    for (const slot of validatedData.schedule) {
      // Ensure end time is after start time
      const [startHour, startMin] = slot.startTime.split(":").map(Number);
      const [endHour, endMin] = slot.endTime.split(":").map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      // Allow overnight schedules (e.g., 22:00 to 02:00)
      if (startMinutes === endMinutes) {
        return NextResponse.json(
          { error: "Start time and end time cannot be the same" },
          { status: 400 }
        );
      }

      // Check for duplicate days
      const dayCount = validatedData.schedule.filter(s => s.dayOfWeek === slot.dayOfWeek).length;
      if (dayCount > 1) {
        return NextResponse.json(
          { error: `Multiple schedules for day ${slot.dayOfWeek} are not allowed` },
          { status: 400 }
        );
      }
    }

    // Update the schedule
    const result = await setWeeklySchedule(providerId, validatedData.schedule);

    return NextResponse.json({
      ...result,
      providerId,
      schedule: validatedData.schedule,
      timezone: validatedData.timezone,
    });
  } catch (error) {
    console.error("Error setting weekly schedule:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update weekly schedule" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/providers/[providerId]/availability/weekly
 * Clear provider's weekly schedule
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { providerId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const providerId = params.providerId;
    if (!providerId) {
      return NextResponse.json(
        { error: "Provider ID is required" },
        { status: 400 }
      );
    }

    // Verify provider exists and user has permission
    const provider = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, providerId))
      .limit(1);

    if (provider.length === 0) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 }
      );
    }

    // Check if user owns this provider profile
    if (provider[0].userId !== userId) {
      return NextResponse.json(
        { error: "Forbidden: You can only update your own availability" },
        { status: 403 }
      );
    }

    // Clear the schedule by setting an empty array
    const result = await setWeeklySchedule(providerId, []);

    return NextResponse.json({
      success: true,
      message: "Weekly schedule cleared successfully",
      providerId,
    });
  } catch (error) {
    console.error("Error clearing weekly schedule:", error);
    return NextResponse.json(
      { error: "Failed to clear weekly schedule" },
      { status: 500 }
    );
  }
}