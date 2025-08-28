import { NextRequest, NextResponse } from "next/server";
import { getSpaceById, updateSpace, deleteSpace } from "@/db/queries/spaces-queries";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { createSecureApiHandler, createApiResponse, createApiError, getValidatedBody } from "@/lib/security/api-handler";
import { db } from "@/db/db";
import { providersTable, spacesTable } from "@/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Single Space API
 * GET /api/spaces/[id] - Get single space details
 * PATCH /api/spaces/[id] - Update space (owner only)
 * DELETE /api/spaces/[id] - Delete space (owner only)
 */

// Update space schema
const updateSpaceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  spaceType: z.enum(["office", "studio", "venue", "meeting_room", "classroom", "gallery", "workshop", "coworking", "other"]).optional(),
  category: z.string().min(1).max(50).optional(),
  
  // Location updates
  address: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  state: z.string().min(2).max(2).optional(),
  zipCode: z.string().min(5).max(10).optional(),
  neighborhood: z.string().optional(),
  
  // Specifications
  capacity: z.number().min(1).optional(),
  squareFeet: z.number().min(1).optional(),
  ceilingHeight: z.number().min(1).optional(),
  floorNumber: z.number().optional(),
  
  // Features & Amenities
  amenities: z.array(z.string()).optional(),
  features: z.object({
    hasWifi: z.boolean().optional(),
    hasParking: z.boolean().optional(),
    hasKitchen: z.boolean().optional(),
    hasAC: z.boolean().optional(),
    hasHeating: z.boolean().optional(),
    hasProjector: z.boolean().optional(),
    hasSoundSystem: z.boolean().optional(),
    hasWhiteboard: z.boolean().optional(),
    isAccessible: z.boolean().optional(),
    hasElevator: z.boolean().optional(),
    hasOutdoorSpace: z.boolean().optional(),
    allowsPets: z.boolean().optional(),
    allowsSmoking: z.boolean().optional(),
    allowsAlcohol: z.boolean().optional(),
    allowsFood: z.boolean().optional(),
  }).optional(),
  equipment: z.array(z.string()).optional(),
  
  // Rules & Restrictions
  rules: z.array(z.string()).optional(),
  noiseLevel: z.enum(["quiet", "moderate", "loud"]).optional(),
  
  // Pricing
  hourlyRate: z.number().min(0).optional(),
  halfDayRate: z.number().min(0).optional(),
  dailyRate: z.number().min(0).optional(),
  weeklyRate: z.number().min(0).optional(),
  monthlyRate: z.number().min(0).optional(),
  cleaningFee: z.number().min(0).optional(),
  securityDeposit: z.number().min(0).optional(),
  
  // Availability
  operatingHours: z.record(z.string(),
    z.object({
      open: z.string(),
      close: z.string(),
    })
  ).optional(),
  minimumBookingDuration: z.number().min(30).optional(),
  maximumBookingDuration: z.number().min(60).optional(),
  advanceNoticeHours: z.number().min(0).optional(),
  bufferTimeBetweenBookings: z.number().min(0).optional(),
  
  // Media
  coverImageUrl: z.string().url().optional(),
  galleryImages: z.array(z.string().url()).optional(),
  virtualTourUrl: z.string().url().optional(),
  floorPlanUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
  
  // Settings
  isActive: z.boolean().optional(),
  instantBooking: z.boolean().optional(),
  requiresApproval: z.boolean().optional(),
  cancellationPolicy: z.enum(["flexible", "moderate", "strict", "super_strict"]).optional(),
  cancellationPolicyDetails: z.object({
    fullRefundHours: z.number().optional(),
    partialRefundHours: z.number().optional(),
    partialRefundPercent: z.number().optional(),
  }).optional(),
  
  // SEO
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
});

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * GET handler - Get single space
 */
async function handleGetSpace(req: NextRequest, context: { userId?: string | null; params?: Record<string, string>; searchParams?: URLSearchParams }) {
  try {
    const { params } = context;
    const id = params?.id;
    
    if (!id) {
      return createApiError("Space ID is required", { status: 400 });
    }
    
    // Increment view count (could be conditional based on user/session)
    const incrementView = true;
    
    const space = await getSpaceById(id, incrementView);
    
    if (!space) {
      return createApiError("Space not found", { 
        status: 404,
        code: "SPACE_NOT_FOUND"
      });
    }
    
    // Transform for frontend
    const transformedSpace = {
      id: space.id,
      name: space.name,
      slug: space.slug,
      description: space.description,
      spaceType: space.spaceType,
      category: space.category,
      address: space.address,
      city: space.city,
      state: space.state,
      zipCode: space.zipCode,
      country: space.country,
      neighborhood: space.neighborhood,
      coordinates: space.coordinates,
      latitude: space.latitude ? Number(space.latitude) : null,
      longitude: space.longitude ? Number(space.longitude) : null,
      capacity: space.capacity,
      squareFeet: space.squareFeet,
      ceilingHeight: space.ceilingHeight,
      floorNumber: space.floorNumber,
      amenities: space.amenities,
      features: space.features,
      equipment: space.equipment,
      rules: space.rules,
      noiseLevel: space.noiseLevel,
      hourlyRate: space.hourlyRate ? Number(space.hourlyRate) : null,
      halfDayRate: space.halfDayRate ? Number(space.halfDayRate) : null,
      dailyRate: space.dailyRate ? Number(space.dailyRate) : null,
      weeklyRate: space.weeklyRate ? Number(space.weeklyRate) : null,
      monthlyRate: space.monthlyRate ? Number(space.monthlyRate) : null,
      cleaningFee: space.cleaningFee ? Number(space.cleaningFee) : null,
      securityDeposit: space.securityDeposit ? Number(space.securityDeposit) : null,
      operatingHours: space.operatingHours,
      minimumBookingDuration: space.minimumBookingDuration,
      maximumBookingDuration: space.maximumBookingDuration,
      advanceNoticeHours: space.advanceNoticeHours,
      bufferTimeBetweenBookings: space.bufferTimeBetweenBookings,
      coverImageUrl: space.coverImageUrl,
      galleryImages: space.galleryImages,
      virtualTourUrl: space.virtualTourUrl,
      floorPlanUrl: space.floorPlanUrl,
      videoUrl: space.videoUrl,
      isActive: space.isActive,
      isVerified: space.isVerified,
      instantBooking: space.instantBooking,
      requiresApproval: space.requiresApproval,
      cancellationPolicy: space.cancellationPolicy,
      cancellationPolicyDetails: space.cancellationPolicyDetails,
      viewCount: space.viewCount,
      favoriteCount: space.favoriteCount,
      totalBookings: space.totalBookings,
      averageRating: space.averageRating,
      totalReviews: space.totalReviews,
      provider: space.provider,
      createdAt: space.createdAt,
      updatedAt: space.updatedAt,
    };
    
    return createApiResponse({ space: transformedSpace });
    
  } catch (error) {
    console.error("Error fetching space:", error);
    return createApiError("Failed to fetch space", { 
      status: 500,
      details: error instanceof Error ? error.message : undefined
    });
  }
}

/**
 * PATCH handler - Update space
 */
async function handleUpdateSpace(req: NextRequest, context: { userId?: string | null; params?: Record<string, string>; searchParams?: URLSearchParams }) {
  try {
    const { userId, params } = context;
    const id = params?.id;
    
    if (!id) {
      return createApiError("Space ID is required", { status: 400 });
    }
    
    const body = getValidatedBody<z.infer<typeof updateSpaceSchema>>(req);
    
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
      return createApiError("You don't have permission to update this space", { 
        status: 403,
        code: "FORBIDDEN"
      });
    }
    
    // Transform numeric fields to strings for database storage
    const transformedBody: any = {
      ...body,
      ...(body.hourlyRate !== undefined && { hourlyRate: body.hourlyRate.toString() }),
      ...(body.halfDayRate !== undefined && { halfDayRate: body.halfDayRate.toString() }),
      ...(body.dailyRate !== undefined && { dailyRate: body.dailyRate.toString() }),
      ...(body.weeklyRate !== undefined && { weeklyRate: body.weeklyRate.toString() }),
      ...(body.monthlyRate !== undefined && { monthlyRate: body.monthlyRate.toString() }),
      ...(body.cleaningFee !== undefined && { cleaningFee: body.cleaningFee.toString() }),
      ...(body.securityDeposit !== undefined && { securityDeposit: body.securityDeposit.toString() }),
    };
    
    // Update the space
    const updatedSpace = await updateSpace(id, transformedBody as Parameters<typeof updateSpace>[1]);
    
    return createApiResponse(
      { space: updatedSpace },
      { message: "Space updated successfully" }
    );
    
  } catch (error) {
    console.error("Error updating space:", error);
    return createApiError("Failed to update space", { 
      status: 500,
      details: error instanceof Error ? error.message : undefined
    });
  }
}

/**
 * DELETE handler - Delete space
 */
async function handleDeleteSpace(req: NextRequest, context: { userId?: string | null; params?: Record<string, string>; searchParams?: URLSearchParams }) {
  try {
    const { userId, params } = context;
    const id = params?.id;
    
    if (!id) {
      return createApiError("Space ID is required", { status: 400 });
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
      return createApiError("You don't have permission to delete this space", { 
        status: 403,
        code: "FORBIDDEN"
      });
    }
    
    // Delete the space
    await deleteSpace(id);
    
    return createApiResponse(
      { success: true },
      { message: "Space deleted successfully" }
    );
    
  } catch (error) {
    console.error("Error deleting space:", error);
    
    // Check for specific error messages
    if (error instanceof Error && error.message.includes("active bookings")) {
      return createApiError("Cannot delete space with active bookings", { 
        status: 400,
        code: "HAS_ACTIVE_BOOKINGS"
      });
    }
    
    return createApiError("Failed to delete space", { 
      status: 500,
      details: error instanceof Error ? error.message : undefined
    });
  }
}

// GET: Public endpoint for fetching single space
export const GET = createSecureApiHandler(
  handleGetSpace,
  {
    requireAuth: false,
    rateLimit: { requests: 100, window: '1m' },
    auditLog: false,
    allowedMethods: ['GET'],
  }
);

// PATCH: Protected endpoint for updating space (owner only)
export const PATCH = createSecureApiHandler(
  handleUpdateSpace,
  {
    requireAuth: true,
    validateBody: updateSpaceSchema,
    rateLimit: { requests: 20, window: '1m' },
    auditLog: true,
    allowedMethods: ['PATCH'],
  }
);

// DELETE: Protected endpoint for deleting space (owner only)
export const DELETE = createSecureApiHandler(
  handleDeleteSpace,
  {
    requireAuth: true,
    rateLimit: { requests: 10, window: '1m' },
    auditLog: true,
    allowedMethods: ['DELETE'],
  }
);

// Health check
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}