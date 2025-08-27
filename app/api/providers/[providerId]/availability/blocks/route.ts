// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { 
  blockTimeSlot,
  unblockTimeSlot,
  getProviderBlockedSlots,
  clearProviderBlockedSlots,
  timeSlotSchema,
  bulkBlockSchema
} from "@/db/queries/availability-queries";
import { db } from "@/db/db";
import { providersTable } from "@/db/schema/providers-schema";
import { eq } from "drizzle-orm";
import { parseISO, isValid } from "date-fns";

// Request validation schemas
const blockSlotRequestSchema = z.union([
  timeSlotSchema,
  bulkBlockSchema
]);

const unblockSlotRequestSchema = z.object({
  blockId: z.string().uuid(),
});

const clearBlocksRequestSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

/**
 * GET /api/providers/[providerId]/availability/blocks
 * Get provider's blocked time slots
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
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    // Validate dates
    let startDate = new Date();
    let endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 3); // Default to 3 months

    if (startDateParam) {
      const parsed = parseISO(startDateParam);
      if (!isValid(parsed)) {
        return NextResponse.json(
          { error: "Invalid start date format" },
          { status: 400 }
        );
      }
      startDate = parsed;
    }

    if (endDateParam) {
      const parsed = parseISO(endDateParam);
      if (!isValid(parsed)) {
        return NextResponse.json(
          { error: "Invalid end date format" },
          { status: 400 }
        );
      }
      endDate = parsed;
    }

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

    // Get blocked slots
    const blockedSlots = await getProviderBlockedSlots(providerId, startDate, endDate);

    // Format response
    const formattedSlots = blockedSlots.map(slot => ({
      id: slot.id,
      date: slot.blockedDate,
      startTime: slot.startTime,
      endTime: slot.endTime,
      reason: slot.reason,
      isFullDay: !slot.startTime && !slot.endTime,
      createdAt: slot.createdAt,
    }));

    return NextResponse.json({
      providerId,
      blockedSlots: formattedSlots,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totalBlocked: formattedSlots.length,
    });
  } catch (error) {
    console.error("Error fetching blocked slots:", error);
    return NextResponse.json(
      { error: "Failed to fetch blocked slots" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/providers/[providerId]/availability/blocks
 * Block time slots for a provider
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
    const validatedData = blockSlotRequestSchema.parse(body);

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
        { error: "Forbidden: You can only manage your own availability" },
        { status: 403 }
      );
    }

    // Additional validation for bulk blocks
    if ("startDate" in validatedData && "endDate" in validatedData) {
      const startDate = parseISO(validatedData.startDate);
      const endDate = parseISO(validatedData.endDate);

      if (endDate < startDate) {
        return NextResponse.json(
          { error: "End date must be after start date" },
          { status: 400 }
        );
      }

      // Limit bulk blocks to 365 days
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > 365) {
        return NextResponse.json(
          { error: "Cannot block more than 365 days at once" },
          { status: 400 }
        );
      }
    }

    // Block the time slot(s)
    const result = await blockTimeSlot(providerId, validatedData);

    return NextResponse.json({
      ...result,
      success: true,
      providerId,
    });
  } catch (error) {
    console.error("Error blocking time slots:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to block time slots" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/providers/[providerId]/availability/blocks
 * Unblock a specific time slot or clear all blocks
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
        { error: "Forbidden: You can only manage your own availability" },
        { status: 403 }
      );
    }

    // Check if this is a specific unblock or clear all
    const searchParams = request.nextUrl.searchParams;
    const blockId = searchParams.get("blockId");
    const clearAll = searchParams.get("clearAll") === "true";

    if (blockId) {
      // Unblock specific slot
      const result = await unblockTimeSlot(blockId);
      return NextResponse.json({
        ...result,
        success: true,
        providerId,
      });
    } else if (clearAll) {
      // Parse date range for clearing
      const startDateParam = searchParams.get("startDate");
      const endDateParam = searchParams.get("endDate");

      let startDate: Date | undefined;
      let endDate: Date | undefined;

      if (startDateParam) {
        startDate = parseISO(startDateParam);
        if (!isValid(startDate)) {
          return NextResponse.json(
            { error: "Invalid start date format" },
            { status: 400 }
          );
        }
      }

      if (endDateParam) {
        endDate = parseISO(endDateParam);
        if (!isValid(endDate)) {
          return NextResponse.json(
            { error: "Invalid end date format" },
            { status: 400 }
          );
        }
      }

      // Clear blocks
      const result = await clearProviderBlockedSlots(providerId, startDate, endDate);
      return NextResponse.json({
        ...result,
        success: true,
        providerId,
      });
    } else {
      return NextResponse.json(
        { error: "Must specify either blockId or clearAll=true" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error unblocking time slots:", error);
    return NextResponse.json(
      { error: "Failed to unblock time slots" },
      { status: 500 }
    );
  }
}