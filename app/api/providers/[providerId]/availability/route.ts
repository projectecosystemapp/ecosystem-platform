// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { 
  providersTable, 
  providerAvailabilityTable, 
  providerBlockedSlotsTable,
  bookingsTable 
} from "@/db/schema";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import { 
  checkAvailabilitySchema, 
  updateAvailabilitySchema,
  validateBookingRequest,
  formatValidationErrors,
  validateTimeSlot
} from "@/lib/validations/booking-schemas";
import { withRateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";

/**
 * GET /api/providers/[providerId]/availability - Check provider availability
 * Can be called by anyone to check availability for booking
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { providerId: string } }
) {
  // Apply rate limiting
  const rateLimiter = withRateLimit(
    RATE_LIMIT_CONFIGS.api,
    async (request: NextRequest) => {
    try {
      const providerId = params.providerId;

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(providerId)) {
        return NextResponse.json(
          { error: "Invalid provider ID format" },
          { status: 400 }
        );
      }

      // Verify provider exists
      const provider = await db
        .select({ 
          id: providersTable.id,
          displayName: providersTable.displayName,
          isActive: providersTable.isActive
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

      // Parse query parameters
      const url = new URL(req.url);
      const queryParams = Object.fromEntries(url.searchParams.entries());

      // If specific date/time is requested, validate that slot
      if (queryParams.date) {
        const validation = validateBookingRequest(checkAvailabilitySchema, queryParams);
        if (!validation.success) {
          return NextResponse.json(
            formatValidationErrors(validation.errors),
            { status: 400 }
          );
        }

        const checkData = validation.data;
        const requestedDate = new Date(checkData.date);
        const dayOfWeek = requestedDate.getDay();

        // Get weekly availability for the requested day
        const weeklyAvailability = await db
          .select()
          .from(providerAvailabilityTable)
          .where(
            and(
              eq(providerAvailabilityTable.providerId, providerId),
              eq(providerAvailabilityTable.dayOfWeek, dayOfWeek),
              eq(providerAvailabilityTable.isActive, true)
            )
          );

        // Get blocked slots for the specific date
        const blockedSlots = await db
          .select()
          .from(providerBlockedSlotsTable)
          .where(
            and(
              eq(providerBlockedSlotsTable.providerId, providerId),
              eq(providerBlockedSlotsTable.blockedDate, requestedDate)
            )
          );

        // Get existing bookings for the date
        const existingBookings = await db
          .select({
            bookingDate: bookingsTable.bookingDate,
            startTime: bookingsTable.startTime,
            endTime: bookingsTable.endTime,
            status: bookingsTable.status
          })
          .from(bookingsTable)
          .where(
            and(
              eq(bookingsTable.providerId, providerId),
              eq(bookingsTable.bookingDate, requestedDate),
              inArray(bookingsTable.status, ["pending", "confirmed", "in_progress"])
            )
          );

        // Check if specific time slot is available
        if (checkData.startTime && checkData.endTime) {
          const isAvailable = validateTimeSlot(
            checkData.date,
            checkData.startTime,
            checkData.endTime,
            existingBookings
          );

          return NextResponse.json({
            date: checkData.date,
            startTime: checkData.startTime,
            endTime: checkData.endTime,
            available: isAvailable,
            provider: {
              id: provider[0].id,
              name: provider[0].displayName
            }
          });
        }

        // Return available time slots for the day
        const availableSlots = generateAvailableSlots(
          weeklyAvailability,
          blockedSlots,
          existingBookings,
          checkData.duration || 60 // Default 1 hour
        );

        return NextResponse.json({
          date: checkData.date,
          dayOfWeek,
          availableSlots,
          weeklyAvailability,
          blockedSlots: blockedSlots.map(slot => ({
            startTime: slot.startTime,
            endTime: slot.endTime,
            reason: slot.reason
          })),
          provider: {
            id: provider[0].id,
            name: provider[0].displayName
          }
        });
      }

      // Return general availability information (next 30 days)
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      // Get all weekly availability
      const weeklyAvailability = await db
        .select()
        .from(providerAvailabilityTable)
        .where(
          and(
            eq(providerAvailabilityTable.providerId, providerId),
            eq(providerAvailabilityTable.isActive, true)
          )
        );

      // Get blocked slots for the period
      const blockedSlots = await db
        .select()
        .from(providerBlockedSlotsTable)
        .where(
          and(
            eq(providerBlockedSlotsTable.providerId, providerId),
            gte(providerBlockedSlotsTable.blockedDate, startDate),
            lte(providerBlockedSlotsTable.blockedDate, endDate)
          )
        );

      // Get existing bookings for the period
      const existingBookings = await db
        .select({
          bookingDate: bookingsTable.bookingDate,
          startTime: bookingsTable.startTime,
          endTime: bookingsTable.endTime,
          status: bookingsTable.status
        })
        .from(bookingsTable)
        .where(
          and(
            eq(bookingsTable.providerId, providerId),
            gte(bookingsTable.bookingDate, startDate),
            lte(bookingsTable.bookingDate, endDate),
            inArray(bookingsTable.status, ["pending", "confirmed", "in_progress"])
          )
        );

      // Generate availability calendar for the next 30 days
      const availabilityCalendar = generateAvailabilityCalendar(
        startDate,
        endDate,
        weeklyAvailability,
        blockedSlots,
        existingBookings
      );

      return NextResponse.json({
        provider: {
          id: provider[0].id,
          name: provider[0].displayName
        },
        weeklyAvailability,
        availabilityCalendar,
        blockedDates: blockedSlots.map(slot => ({
          date: slot.blockedDate,
          startTime: slot.startTime,
          endTime: slot.endTime,
          reason: slot.reason
        }))
      });

    } catch (error) {
      console.error("Error checking availability:", error);
      
      if (error instanceof Error) {
        return NextResponse.json(
          { error: "Failed to check availability", details: error.message },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
    }
  );
  
  return rateLimiter(req);
}

/**
 * POST /api/providers/[providerId]/availability - Update provider availability
 * Only accessible by the provider themselves
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { providerId: string } }
) {
  // Apply rate limiting
  const rateLimiter = withRateLimit(
    RATE_LIMIT_CONFIGS.api,
    async (request: NextRequest) => {
    try {
      const { userId } = auth();

      if (!userId) {
        return NextResponse.json(
          { error: "Authentication required" }, 
          { status: 401 }
        );
      }

      const providerId = params.providerId;

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(providerId)) {
        return NextResponse.json(
          { error: "Invalid provider ID format" },
          { status: 400 }
        );
      }

      // Verify provider ownership
      const provider = await db
        .select({ 
          id: providersTable.id,
          userId: providersTable.userId,
          displayName: providersTable.displayName
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

      if (provider[0].userId !== userId) {
        return NextResponse.json(
          { error: "Access denied - you can only update your own availability" },
          { status: 403 }
        );
      }

      // Parse and validate request body
      const body = await req.json();
      const validation = validateBookingRequest(updateAvailabilitySchema, body);
      
      if (!validation.success) {
        return NextResponse.json(
          formatValidationErrors(validation.errors),
          { status: 400 }
        );
      }

      const updateData = validation.data;

      // Update weekly availability if provided
      if (updateData.availability) {
        // Delete existing availability
        await db
          .delete(providerAvailabilityTable)
          .where(eq(providerAvailabilityTable.providerId, providerId));

        // Insert new availability slots
        if (updateData.availability.length > 0) {
          await db
            .insert(providerAvailabilityTable)
            .values(
              updateData.availability.map(slot => ({
                providerId,
                dayOfWeek: slot.dayOfWeek,
                startTime: slot.startTime,
                endTime: slot.endTime,
                isActive: slot.isActive
              }))
            );
        }
      }

      // Add blocked slots if provided
      if (updateData.blockedSlots && updateData.blockedSlots.length > 0) {
        await db
          .insert(providerBlockedSlotsTable)
          .values(
            updateData.blockedSlots.map(slot => ({
              providerId,
              blockedDate: new Date(slot.blockedDate),
              startTime: slot.startTime || null,
              endTime: slot.endTime || null,
              reason: slot.reason || null
            }))
          );
      }

      // Fetch updated availability to return
      const updatedAvailability = await db
        .select()
        .from(providerAvailabilityTable)
        .where(eq(providerAvailabilityTable.providerId, providerId));

      const updatedBlockedSlots = await db
        .select()
        .from(providerBlockedSlotsTable)
        .where(eq(providerBlockedSlotsTable.providerId, providerId));

      return NextResponse.json({
        provider: {
          id: provider[0].id,
          name: provider[0].displayName
        },
        weeklyAvailability: updatedAvailability,
        blockedSlots: updatedBlockedSlots,
        message: "Availability updated successfully"
      });

    } catch (error) {
      console.error("Error updating availability:", error);
      
      if (error instanceof Error) {
        return NextResponse.json(
          { error: "Failed to update availability", details: error.message },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
    }
  );
  
  return rateLimiter(req);
}

/**
 * Generate available time slots for a specific day
 */
function generateAvailableSlots(
  weeklyAvailability: any[],
  blockedSlots: any[],
  existingBookings: any[],
  duration: number
): Array<{ startTime: string; endTime: string }> {
  const slots: Array<{ startTime: string; endTime: string }> = [];

  // For each availability window
  for (const availability of weeklyAvailability) {
    const startMinutes = timeToMinutes(availability.startTime);
    const endMinutes = timeToMinutes(availability.endTime);

    // Generate slots with the specified duration
    for (let current = startMinutes; current + duration <= endMinutes; current += 15) {
      const slotStart = minutesToTime(current);
      const slotEnd = minutesToTime(current + duration);

      // Check if this slot conflicts with blocked slots or existing bookings
      const isBlocked = blockedSlots.some(blocked => {
        if (!blocked.startTime || !blocked.endTime) return true; // Full day block
        const blockedStart = timeToMinutes(blocked.startTime);
        const blockedEnd = timeToMinutes(blocked.endTime);
        return current < blockedEnd && (current + duration) > blockedStart;
      });

      const isBooked = existingBookings.some(booking => {
        const bookingStart = timeToMinutes(booking.startTime);
        const bookingEnd = timeToMinutes(booking.endTime);
        return current < bookingEnd && (current + duration) > bookingStart;
      });

      if (!isBlocked && !isBooked) {
        slots.push({ startTime: slotStart, endTime: slotEnd });
      }
    }
  }

  return slots;
}

/**
 * Generate availability calendar for a date range
 */
function generateAvailabilityCalendar(
  startDate: Date,
  endDate: Date,
  weeklyAvailability: any[],
  blockedSlots: any[],
  existingBookings: any[]
): Array<{ date: string; dayOfWeek: number; available: boolean; slots?: number }> {
  const calendar: Array<{ date: string; dayOfWeek: number; available: boolean; slots?: number }> = [];
  
  const current = new Date(startDate);
  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    const dateString = current.toISOString().split('T')[0];
    
    // Check if provider has availability on this day of week
    const dayAvailability = weeklyAvailability.filter(av => av.dayOfWeek === dayOfWeek);
    
    // Check if day is fully blocked
    const isFullyBlocked = blockedSlots.some(blocked => 
      blocked.blockedDate.toISOString().split('T')[0] === dateString &&
      !blocked.startTime && !blocked.endTime
    );

    let available = dayAvailability.length > 0 && !isFullyBlocked;
    let availableSlots = 0;

    if (available) {
      // Count available slots for the day
      const dayBookings = existingBookings.filter(
        booking => booking.bookingDate.toISOString().split('T')[0] === dateString
      );
      const dayBlocked = blockedSlots.filter(
        blocked => blocked.blockedDate.toISOString().split('T')[0] === dateString
      );

      const slots = generateAvailableSlots(dayAvailability, dayBlocked, dayBookings, 60);
      availableSlots = slots.length;
      available = availableSlots > 0;
    }

    calendar.push({
      date: dateString,
      dayOfWeek,
      available,
      slots: availableSlots
    });

    current.setDate(current.getDate() + 1);
  }

  return calendar;
}

/**
 * Convert time string (HH:MM) to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes since midnight to time string (HH:MM)
 */
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}