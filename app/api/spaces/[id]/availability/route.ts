import { NextRequest, NextResponse } from "next/server";
import { checkSpaceAvailability, blockSpaceAvailability } from "@/db/queries/spaces-queries";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { createSecureApiHandler, createApiResponse, createApiError, getValidatedQuery, getValidatedBody } from "@/lib/security/api-handler";
import { db } from "@/db";
import { providersTable, spacesTable } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Space Availability API
 * GET /api/spaces/[id]/availability - Check space availability
 * POST /api/spaces/[id]/availability - Block space availability (owner only)
 */

// Availability check schema
const availabilityCheckSchema = z.object({
  startDate: z.string().transform(val => new Date(val)),
  endDate: z.string().transform(val => new Date(val)),
  numberOfGuests: z.coerce.number().min(1).optional(),
}).refine(data => {
  if (data.endDate <= data.startDate) {
    throw new Error("End date must be after start date");
  }
  const maxDuration = 365 * 24 * 60 * 60 * 1000; // 365 days in milliseconds
  if (data.endDate.getTime() - data.startDate.getTime() > maxDuration) {
    throw new Error("Booking duration cannot exceed 365 days");
  }
  return true;
});

// Block availability schema
const blockAvailabilitySchema = z.object({
  startDate: z.string().transform(val => new Date(val)),
  endDate: z.string().transform(val => new Date(val)),
  reason: z.string().optional(),
  availabilityType: z.enum(["blocked", "holiday", "maintenance"]).default("blocked"),
}).refine(data => {
  if (data.endDate <= data.startDate) {
    throw new Error("End date must be after start date");
  }
  return true;
});

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * GET handler - Check space availability
 */
async function handleCheckAvailability(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;
    
    if (!id) {
      return createApiError("Space ID is required", { status: 400 });
    }
    
    const query = getValidatedQuery<z.infer<typeof availabilityCheckSchema>>(req);
    
    if (!query) {
      return createApiError("Invalid query parameters", { status: 400 });
    }
    
    // Check space exists
    const [space] = await db
      .select()
      .from(spacesTable)
      .where(eq(spacesTable.id, id))
      .limit(1);
    
    if (!space) {
      return createApiError("Space not found", { 
        status: 404,
        code: "SPACE_NOT_FOUND"
      });
    }
    
    // Check capacity if numberOfGuests provided
    if (query.numberOfGuests && query.numberOfGuests > space.capacity) {
      return createApiResponse({
        available: false,
        reason: `Space capacity is ${space.capacity}, but you need space for ${query.numberOfGuests} guests`,
        maxCapacity: space.capacity,
      });
    }
    
    // Check availability
    const availability = await checkSpaceAvailability(
      id,
      query.startDate,
      query.endDate
    );
    
    // Add minimum booking duration check
    if (availability.available && space.minimumBookingDuration) {
      const durationHours = Math.ceil((query.endDate.getTime() - query.startDate.getTime()) / (1000 * 60 * 60));
      const minimumHours = space.minimumBookingDuration / 60;
      
      if (durationHours < minimumHours) {
        return createApiResponse({
          available: false,
          reason: `Minimum booking duration is ${minimumHours} hours`,
          minimumDuration: space.minimumBookingDuration,
        });
      }
    }
    
    // Add maximum booking duration check
    if (availability.available && space.maximumBookingDuration) {
      const durationMinutes = Math.ceil((query.endDate.getTime() - query.startDate.getTime()) / (1000 * 60));
      
      if (durationMinutes > space.maximumBookingDuration) {
        return createApiResponse({
          available: false,
          reason: `Maximum booking duration is ${space.maximumBookingDuration / 60} hours`,
          maximumDuration: space.maximumBookingDuration,
        });
      }
    }
    
    // Add advance notice check
    if (availability.available && space.advanceNoticeHours) {
      const hoursUntilStart = Math.ceil((query.startDate.getTime() - Date.now()) / (1000 * 60 * 60));
      
      if (hoursUntilStart < space.advanceNoticeHours) {
        return createApiResponse({
          available: false,
          reason: `This space requires ${space.advanceNoticeHours} hours advance notice`,
          advanceNoticeHours: space.advanceNoticeHours,
        });
      }
    }
    
    return createApiResponse({
      ...availability,
      space: {
        id: space.id,
        name: space.name,
        capacity: space.capacity,
        instantBooking: space.instantBooking,
        requiresApproval: space.requiresApproval,
      },
      requestedDates: {
        startDate: query.startDate,
        endDate: query.endDate,
      },
    });
    
  } catch (error) {
    console.error("Error checking space availability:", error);
    return createApiError("Failed to check space availability", { 
      status: 500,
      details: error instanceof Error ? error.message : undefined
    });
  }
}

/**
 * POST handler - Block space availability (owner only)
 */
async function handleBlockAvailability(req: NextRequest, context: any, { params }: RouteParams) {
  try {
    const { userId } = context;
    const { id } = params;
    
    if (!id) {
      return createApiError("Space ID is required", { status: 400 });
    }
    
    const body = getValidatedBody<z.infer<typeof blockAvailabilitySchema>>(req);
    
    if (!body) {
      return createApiError("Invalid request body", { status: 400 });
    }
    
    // Check if user owns this space
    const [space] = await db
      .select({
        space: spacesTable,
        provider: providersTable,
      })
      .from(spacesTable)
      .innerJoin(providersTable, eq(spacesTable.providerId, providersTable.id))
      .where(eq(spacesTable.id, id))
      .limit(1);
    
    if (!space) {
      return createApiError("Space not found", { 
        status: 404,
        code: "SPACE_NOT_FOUND"
      });
    }
    
    if (space.provider.userId !== userId) {
      return createApiError("You don't have permission to manage this space's availability", { 
        status: 403,
        code: "FORBIDDEN"
      });
    }
    
    // Block the availability
    const availability = await blockSpaceAvailability(
      id,
      body.startDate,
      body.endDate,
      body.reason
    );
    
    return createApiResponse(
      { 
        availability,
        message: "Space availability blocked successfully"
      },
      { status: 201 }
    );
    
  } catch (error) {
    console.error("Error blocking space availability:", error);
    return createApiError("Failed to block space availability", { 
      status: 500,
      details: error instanceof Error ? error.message : undefined
    });
  }
}

// GET: Public endpoint for checking availability
export const GET = createSecureApiHandler(
  handleCheckAvailability,
  {
    requireAuth: false,
    validateQuery: availabilityCheckSchema,
    rateLimit: { requests: 60, window: '1m' },
    auditLog: false,
    allowedMethods: ['GET'],
  }
);

// POST: Protected endpoint for blocking availability (owner only)
export const POST = createSecureApiHandler(
  handleBlockAvailability,
  {
    requireAuth: true,
    validateBody: blockAvailabilitySchema,
    rateLimit: { requests: 20, window: '1m' },
    auditLog: true,
    allowedMethods: ['POST'],
  }
);

// Health check
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}