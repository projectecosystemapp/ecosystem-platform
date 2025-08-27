// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getAvailableSlots } from "@/db/queries/availability-queries";
import { db } from "@/db/db";
import { providersTable } from "@/db/schema/providers-schema";
import { eq } from "drizzle-orm";
import { parseISO, isValid, addDays, startOfDay, endOfDay } from "date-fns";

// Request validation schema
const getSlotsSchema = z.object({
  date: z.string().datetime(),
  serviceDuration: z.number().min(15).max(480), // 15 minutes to 8 hours
  timezone: z.string().default("America/New_York"),
  minimumNoticeHours: z.number().min(0).max(168).optional(), // Up to 1 week
  bufferMinutes: z.number().min(0).max(60).optional(),
});

/**
 * GET /api/providers/[providerId]/availability/slots
 * Get available time slots for a specific date and service duration
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
    const serviceDurationParam = searchParams.get("serviceDuration");
    const timezone = searchParams.get("timezone") || "America/New_York";
    const minimumNoticeHours = searchParams.get("minimumNoticeHours");
    const bufferMinutes = searchParams.get("bufferMinutes");

    // Validate required parameters
    if (!dateParam) {
      return NextResponse.json(
        { error: "Date is required" },
        { status: 400 }
      );
    }

    if (!serviceDurationParam) {
      return NextResponse.json(
        { error: "Service duration is required" },
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
        { error: "Cannot get slots for past dates" },
        { status: 400 }
      );
    }

    // Validate date is not too far in the future (90 days max)
    const maxDate = addDays(today, 90);
    if (startOfDay(date) > maxDate) {
      return NextResponse.json(
        { error: "Cannot get slots more than 90 days in advance" },
        { status: 400 }
      );
    }

    // Parse service duration
    const serviceDuration = parseInt(serviceDurationParam, 10);
    if (isNaN(serviceDuration) || serviceDuration < 15 || serviceDuration > 480) {
      return NextResponse.json(
        { error: "Service duration must be between 15 and 480 minutes" },
        { status: 400 }
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
        { error: "Provider is not currently accepting bookings" },
        { status: 400 }
      );
    }

    // Build settings object
    const settings = {
      timezone,
      minimumNoticeHours: minimumNoticeHours ? parseInt(minimumNoticeHours, 10) : 24,
      slotDurationMinutes: serviceDuration,
      bufferMinutes: bufferMinutes ? parseInt(bufferMinutes, 10) : 15,
    };

    // Get available slots
    const availableSlots = await getAvailableSlots(
      providerId,
      date,
      serviceDuration,
      settings
    );

    // Group slots by time periods for better UX
    const morning = availableSlots.filter(slot => {
      const hour = parseInt(slot.startTime.split(":")[0], 10);
      return hour >= 6 && hour < 12;
    });

    const afternoon = availableSlots.filter(slot => {
      const hour = parseInt(slot.startTime.split(":")[0], 10);
      return hour >= 12 && hour < 17;
    });

    const evening = availableSlots.filter(slot => {
      const hour = parseInt(slot.startTime.split(":")[0], 10);
      return hour >= 17 && hour < 21;
    });

    const night = availableSlots.filter(slot => {
      const hour = parseInt(slot.startTime.split(":")[0], 10);
      return hour >= 21 || hour < 6;
    });

    return NextResponse.json({
      providerId,
      providerName: provider[0].displayName,
      date: date.toISOString(),
      serviceDuration,
      timezone,
      totalSlots: availableSlots.length,
      slots: {
        all: availableSlots,
        morning,
        afternoon,
        evening,
        night,
      },
      settings,
    });
  } catch (error) {
    console.error("Error fetching available slots:", error);
    return NextResponse.json(
      { error: "Failed to fetch available slots" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/providers/[providerId]/availability/slots
 * Get available slots for multiple dates (batch request)
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
      dates: z.array(z.string().datetime()).min(1).max(30), // Max 30 days at once
      serviceDuration: z.number().min(15).max(480),
      timezone: z.string().default("America/New_York"),
      minimumNoticeHours: z.number().min(0).max(168).optional(),
      bufferMinutes: z.number().min(0).max(60).optional(),
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
        { error: "Provider is not currently accepting bookings" },
        { status: 400 }
      );
    }

    // Build settings object
    const settings = {
      timezone: validatedData.timezone,
      minimumNoticeHours: validatedData.minimumNoticeHours || 24,
      slotDurationMinutes: validatedData.serviceDuration,
      bufferMinutes: validatedData.bufferMinutes || 15,
    };

    // Get slots for each date
    const results = await Promise.all(
      validatedData.dates.map(async (dateStr) => {
        const date = parseISO(dateStr);
        
        // Skip invalid or past dates
        if (!isValid(date) || startOfDay(date) < startOfDay(new Date())) {
          return {
            date: dateStr,
            error: "Invalid or past date",
            slots: [],
          };
        }

        try {
          const slots = await getAvailableSlots(
            providerId,
            date,
            validatedData.serviceDuration,
            settings
          );

          return {
            date: dateStr,
            dayOfWeek: date.getDay(),
            totalSlots: slots.length,
            slots,
          };
        } catch (error) {
          console.error(`Error getting slots for ${dateStr}:`, error);
          return {
            date: dateStr,
            error: "Failed to get slots",
            slots: [],
          };
        }
      })
    );

    // Calculate summary statistics
    const totalAvailableDays = results.filter(r => r.totalSlots && r.totalSlots > 0).length;
    const totalSlots = results.reduce((sum, r) => sum + (r.totalSlots || 0), 0);

    return NextResponse.json({
      providerId,
      providerName: provider[0].displayName,
      serviceDuration: validatedData.serviceDuration,
      timezone: validatedData.timezone,
      summary: {
        datesRequested: validatedData.dates.length,
        datesWithAvailability: totalAvailableDays,
        totalAvailableSlots: totalSlots,
      },
      results,
      settings,
    });
  } catch (error) {
    console.error("Error fetching batch available slots:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch available slots" },
      { status: 500 }
    );
  }
}