import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkSlotAvailability } from "@/db/queries/availability-queries";
import { db } from "@/db/db";
import { providersTable } from "@/db/schema/providers-schema";
import { eq } from "drizzle-orm";
import { parseISO, isValid, startOfDay, addDays } from "date-fns";

// Request validation schema
const checkAvailabilitySchema = z.object({
  date: z.string().datetime(),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  timezone: z.string().default("America/New_York"),
  minimumNoticeHours: z.number().min(0).max(168).optional(),
});

/**
 * GET /api/providers/[providerId]/availability/check
 * Check if a specific time slot is available
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { providerId: string } }
) {
  try {
    const providerId = params.providerId;
    if (!providerId) {
      return NextResponse.json(
        { error: "Provider ID is required" },
        { status: 400 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const dateParam = searchParams.get("date");
    const startTime = searchParams.get("startTime");
    const endTime = searchParams.get("endTime");
    const timezone = searchParams.get("timezone") || "America/New_York";
    const minimumNoticeHours = searchParams.get("minimumNoticeHours");

    // Validate required parameters
    if (!dateParam || !startTime || !endTime) {
      return NextResponse.json(
        { error: "Date, startTime, and endTime are required" },
        { status: 400 }
      );
    }

    // Validate time format
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return NextResponse.json(
        { error: "Invalid time format. Use HH:MM (24-hour format)" },
        { status: 400 }
      );
    }

    // Parse and validate date
    const date = parseISO(dateParam);
    if (!isValid(date)) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      );
    }

    // Validate date is not in the past
    const today = startOfDay(new Date());
    if (startOfDay(date) < today) {
      return NextResponse.json(
        {
          available: false,
          reason: "Cannot check availability for past dates",
          providerId,
          date: date.toISOString(),
          startTime,
          endTime,
        },
        { status: 200 }
      );
    }

    // Validate date is not too far in the future (90 days max)
    const maxDate = addDays(today, 90);
    if (startOfDay(date) > maxDate) {
      return NextResponse.json(
        {
          available: false,
          reason: "Cannot check availability more than 90 days in advance",
          providerId,
          date: date.toISOString(),
          startTime,
          endTime,
        },
        { status: 200 }
      );
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
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 }
      );
    }

    if (!provider[0].isActive) {
      return NextResponse.json(
        {
          available: false,
          reason: "Provider is not currently accepting bookings",
          providerId,
          providerName: provider[0].displayName,
          date: date.toISOString(),
          startTime,
          endTime,
        },
        { status: 200 }
      );
    }

    // Build settings object
    const settings = {
      timezone,
      minimumNoticeHours: minimumNoticeHours ? parseInt(minimumNoticeHours, 10) : 24,
    };

    // Check availability
    const availability = await checkSlotAvailability(
      providerId,
      date,
      startTime,
      endTime,
      settings
    );

    // Calculate duration in minutes
    const [startHour, startMin] = startTime.split(":").map(Number);
    const [endHour, endMin] = endTime.split(":").map(Number);
    let durationMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    
    // Handle overnight bookings
    if (durationMinutes < 0) {
      durationMinutes += 24 * 60;
    }

    return NextResponse.json({
      ...availability,
      providerId,
      providerName: provider[0].displayName,
      date: date.toISOString(),
      dayOfWeek: date.getDay(),
      startTime,
      endTime,
      durationMinutes,
      timezone,
      settings,
    });
  } catch (error) {
    console.error("Error checking slot availability:", error);
    return NextResponse.json(
      { error: "Failed to check slot availability" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/providers/[providerId]/availability/check
 * Check multiple time slots availability (batch request)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { providerId: string } }
) {
  try {
    const providerId = params.providerId;
    if (!providerId) {
      return NextResponse.json(
        { error: "Provider ID is required" },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    
    // Validate request
    const batchSchema = z.object({
      slots: z.array(z.object({
        date: z.string().datetime(),
        startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
        endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      })).min(1).max(50), // Max 50 slots at once
      timezone: z.string().default("America/New_York"),
      minimumNoticeHours: z.number().min(0).max(168).optional(),
    });

    const validatedData = batchSchema.parse(body);

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
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 }
      );
    }

    if (!provider[0].isActive) {
      return NextResponse.json(
        {
          providerId,
          providerName: provider[0].displayName,
          allAvailable: false,
          reason: "Provider is not currently accepting bookings",
          results: validatedData.slots.map(slot => ({
            ...slot,
            available: false,
            reason: "Provider inactive",
          })),
        },
        { status: 200 }
      );
    }

    // Build settings object
    const settings = {
      timezone: validatedData.timezone,
      minimumNoticeHours: validatedData.minimumNoticeHours || 24,
    };

    // Check each slot
    const results = await Promise.all(
      validatedData.slots.map(async (slot) => {
        const date = parseISO(slot.date);
        
        // Skip invalid dates
        if (!isValid(date)) {
          return {
            ...slot,
            available: false,
            reason: "Invalid date",
          };
        }

        // Skip past dates
        if (startOfDay(date) < startOfDay(new Date())) {
          return {
            ...slot,
            available: false,
            reason: "Date is in the past",
          };
        }

        try {
          const availability = await checkSlotAvailability(
            providerId,
            date,
            slot.startTime,
            slot.endTime,
            settings
          );

          return {
            ...slot,
            ...availability,
          };
        } catch (error) {
          console.error(`Error checking slot ${slot.date} ${slot.startTime}:`, error);
          return {
            ...slot,
            available: false,
            reason: "Error checking availability",
          };
        }
      })
    );

    // Calculate summary
    const availableCount = results.filter(r => r.available).length;
    const allAvailable = availableCount === results.length;

    return NextResponse.json({
      providerId,
      providerName: provider[0].displayName,
      timezone: validatedData.timezone,
      summary: {
        totalSlots: results.length,
        availableSlots: availableCount,
        unavailableSlots: results.length - availableCount,
        allAvailable,
      },
      results,
      settings,
    });
  } catch (error) {
    console.error("Error checking batch slot availability:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to check slot availability" },
      { status: 500 }
    );
  }
}