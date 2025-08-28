import { NextRequest, NextResponse } from "next/server";
import { getEventById, updateEvent, deleteEvent } from "@/db/queries/events-queries";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { createSecureApiHandler, createApiResponse, createApiError, getValidatedBody, ApiContext } from "@/lib/security/api-handler";
import { db } from "@/db/db";
import { providersTable } from "@/db/schema/providers-schema";
import { eq } from "drizzle-orm";

/**
 * Single Event API
 * GET /api/events/[id] - Get event details
 * PATCH /api/events/[id] - Update event (provider only)
 * DELETE /api/events/[id] - Delete event (provider only)
 */

// Update event schema (all fields optional)
const updateEventSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  eventType: z.string().min(1).max(50).optional(),
  category: z.string().min(1).max(50).optional(),
  tags: z.array(z.string()).optional(),
  
  // Timing
  startDateTime: z.string().transform(val => new Date(val)).optional(),
  endDateTime: z.string().transform(val => new Date(val)).optional(),
  timezone: z.string().optional(),
  recurringPattern: z.object({
    frequency: z.enum(["daily", "weekly", "monthly"]).optional(),
    interval: z.number().optional(),
    daysOfWeek: z.array(z.number()).optional(),
    endDate: z.string().optional(),
  }).optional().nullable(),
  
  // Location
  locationType: z.enum(["in_person", "virtual", "hybrid"]).optional(),
  virtualLink: z.string().url().optional().nullable(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
    country: z.string().optional(),
  }).optional().nullable(),
  
  // Capacity & Pricing
  maxAttendees: z.number().min(1).optional().nullable(),
  price: z.union([z.number(), z.string()]).transform(val => typeof val === 'number' ? val.toString() : val).optional(),
  earlyBirdPrice: z.union([z.number(), z.string()]).transform(val => typeof val === 'number' ? val.toString() : val).optional().nullable(),
  earlyBirdDeadline: z.string().transform(val => new Date(val)).optional().nullable(),
  
  // Media
  coverImageUrl: z.string().url().optional().nullable(),
  galleryImages: z.array(z.string().url()).optional(),
  
  // Status & Settings
  status: z.enum(["draft", "published", "cancelled", "completed"]).optional(),
  isFeatured: z.boolean().optional(),
  instantBooking: z.boolean().optional(),
  requiresApproval: z.boolean().optional(),
  cancellationPolicy: z.enum(["flexible", "moderate", "strict"]).optional(),
  refundPolicy: z.object({
    fullRefundHours: z.number().optional(),
    partialRefundHours: z.number().optional(),
    partialRefundPercent: z.number().optional(),
  }).optional(),
  
  // SEO
  metaTitle: z.string().optional().nullable(),
  metaDescription: z.string().optional().nullable(),
}).refine(data => {
  if (data.startDateTime && data.endDateTime && data.endDateTime <= data.startDateTime) {
    throw new Error("End time must be after start time");
  }
  if (data.earlyBirdPrice && data.price && data.earlyBirdPrice >= data.price) {
    throw new Error("Early bird price must be less than regular price");
  }
  return true;
});

/**
 * GET handler - Get event details
 */
async function handleGetEvent(req: NextRequest, context: ApiContext) {
  try {
    const { id } = context.params || {};
    
    if (!id || !z.string().uuid().safeParse(id).success) {
      return createApiError("Invalid event ID", { status: 400 });
    }
    
    // Get increment view parameter
    const { searchParams } = new URL(req.url);
    const incrementView = searchParams.get("incrementView") === "true";
    
    // Fetch event with optional view increment
    const event = await getEventById(id, incrementView);
    
    if (!event) {
      return createApiError("Event not found", { 
        status: 404,
        code: "EVENT_NOT_FOUND"
      });
    }
    
    // Transform event for frontend
    const transformedEvent = {
      id: event.id,
      title: event.title,
      description: event.description,
      eventType: event.eventType,
      category: event.category,
      tags: event.tags,
      startDateTime: event.startDateTime,
      endDateTime: event.endDateTime,
      timezone: event.timezone,
      recurringPattern: event.recurringPattern,
      locationType: event.locationType,
      virtualLink: event.locationType !== "in_person" ? event.virtualLink : undefined,
      address: event.locationType !== "virtual" ? event.address : undefined,
      latitude: event.latitude ? Number(event.latitude) : null,
      longitude: event.longitude ? Number(event.longitude) : null,
      price: Number(event.price),
      earlyBirdPrice: event.earlyBirdPrice ? Number(event.earlyBirdPrice) : null,
      earlyBirdDeadline: event.earlyBirdDeadline,
      maxAttendees: event.maxAttendees,
      currentAttendees: event.currentAttendees,
      availableSpots: event.availableSpots,
      coverImageUrl: event.coverImageUrl,
      galleryImages: event.galleryImages,
      status: event.status,
      isFeatured: event.isFeatured,
      instantBooking: event.instantBooking,
      requiresApproval: event.requiresApproval,
      cancellationPolicy: event.cancellationPolicy,
      refundPolicy: event.refundPolicy,
      viewCount: event.viewCount,
      favoriteCount: event.favoriteCount,
      slug: event.slug,
      metaTitle: event.metaTitle,
      metaDescription: event.metaDescription,
      provider: {
        id: event.provider.id,
        displayName: event.provider.displayName,
        profileImageUrl: event.provider.profileImageUrl,
        slug: event.provider.slug,
        isVerified: event.provider.isVerified,
        bio: event.provider.bio,
        locationCity: event.provider.locationCity,
        locationState: event.provider.locationState,
      },
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
      publishedAt: event.publishedAt,
    };
    
    return createApiResponse({ event: transformedEvent });
    
  } catch (error) {
    console.error("Error fetching event:", error);
    return createApiError("Failed to fetch event", { 
      status: 500,
      details: error instanceof Error ? error.message : undefined
    });
  }
}

/**
 * PATCH handler - Update event
 */
async function handleUpdateEvent(req: NextRequest, context: ApiContext) {
  try {
    const { id } = context.params || {};
    const { userId } = context;
    const body = getValidatedBody<z.infer<typeof updateEventSchema>>(req);
    
    if (!id || !z.string().uuid().safeParse(id).success) {
      return createApiError("Invalid event ID", { status: 400 });
    }
    
    if (!body) {
      return createApiError("Invalid request body", { status: 400 });
    }
    
    // Fetch event to verify ownership
    const existingEvent = await getEventById(id);
    
    if (!existingEvent) {
      return createApiError("Event not found", { 
        status: 404,
        code: "EVENT_NOT_FOUND"
      });
    }
    
    // Check if user owns the event - userId is guaranteed to exist due to requireAuth
    if (!userId) {
      return createApiError("Authentication required", { 
        status: 401,
        code: "UNAUTHORIZED"
      });
    }
    
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.userId, userId))
      .limit(1);
    
    if (!provider || provider.id !== existingEvent.providerId) {
      return createApiError("You don't have permission to update this event", { 
        status: 403,
        code: "PERMISSION_DENIED"
      });
    }
    
    // Check if event can be modified
    if (existingEvent.status === "completed") {
      return createApiError("Cannot modify completed events", { 
        status: 400,
        code: "EVENT_COMPLETED"
      });
    }
    
    // Check if event has started and critical fields are being changed
    const hasStarted = new Date(existingEvent.startDateTime) < new Date();
    if (hasStarted) {
      const criticalFields = ['startDateTime', 'price', 'locationType', 'virtualLink', 'address'];
      const changedCriticalFields = Object.keys(body).filter(key => 
        criticalFields.includes(key) && body[key as keyof typeof body] !== undefined
      );
      
      if (changedCriticalFields.length > 0) {
        return createApiError("Cannot modify critical fields after event has started", { 
          status: 400,
          code: "EVENT_STARTED",
          details: { fields: changedCriticalFields }
        });
      }
    }
    
    // Update the event
    const updatedEvent = await updateEvent(id, body);
    
    return createApiResponse(
      { event: updatedEvent },
      { message: "Event updated successfully" }
    );
    
  } catch (error) {
    console.error("Error updating event:", error);
    return createApiError("Failed to update event", { 
      status: 500,
      details: error instanceof Error ? error.message : undefined
    });
  }
}

/**
 * DELETE handler - Delete event
 */
async function handleDeleteEvent(req: NextRequest, context: ApiContext) {
  try {
    const { id } = context.params || {};
    const { userId } = context;
    
    if (!id || !z.string().uuid().safeParse(id).success) {
      return createApiError("Invalid event ID", { status: 400 });
    }
    
    // Fetch event to verify ownership
    const existingEvent = await getEventById(id);
    
    if (!existingEvent) {
      return createApiError("Event not found", { 
        status: 404,
        code: "EVENT_NOT_FOUND"
      });
    }
    
    // Check if user owns the event - userId is guaranteed to exist due to requireAuth
    if (!userId) {
      return createApiError("Authentication required", { 
        status: 401,
        code: "UNAUTHORIZED"
      });
    }
    
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.userId, userId))
      .limit(1);
    
    if (!provider || provider.id !== existingEvent.providerId) {
      return createApiError("You don't have permission to delete this event", { 
        status: 403,
        code: "PERMISSION_DENIED"
      });
    }
    
    // Check if event can be deleted
    if (existingEvent.status === "completed") {
      return createApiError("Cannot delete completed events", { 
        status: 400,
        code: "EVENT_COMPLETED"
      });
    }
    
    if (new Date(existingEvent.startDateTime) < new Date()) {
      return createApiError("Cannot delete events that have already started", { 
        status: 400,
        code: "EVENT_STARTED"
      });
    }
    
    try {
      await deleteEvent(id);
      
      return createApiResponse(
        { success: true },
        { 
          status: 200,
          message: "Event deleted successfully"
        }
      );
    } catch (deleteError: any) {
      if (deleteError.message.includes("confirmed attendees")) {
        return createApiError("Cannot delete event with confirmed attendees. Please cancel the event instead.", { 
          status: 400,
          code: "HAS_ATTENDEES"
        });
      }
      throw deleteError;
    }
    
  } catch (error) {
    console.error("Error deleting event:", error);
    return createApiError("Failed to delete event", { 
      status: 500,
      details: error instanceof Error ? error.message : undefined
    });
  }
}

// GET: Public endpoint for fetching event details
export const GET = createSecureApiHandler(
  handleGetEvent,
  {
    requireAuth: false,
    rateLimit: { requests: 100, window: '1m' },
    auditLog: false,
    allowedMethods: ['GET'],
  }
);

// PATCH: Protected endpoint for updating events (provider only)
export const PATCH = createSecureApiHandler(
  handleUpdateEvent,
  {
    requireAuth: true,
    validateBody: updateEventSchema,
    rateLimit: { requests: 20, window: '1m' },
    auditLog: true,
    allowedMethods: ['PATCH'],
  }
);

// DELETE: Protected endpoint for deleting events (provider only)
export const DELETE = createSecureApiHandler(
  handleDeleteEvent,
  {
    requireAuth: true,
    rateLimit: { requests: 10, window: '1m' },
    auditLog: true,
    allowedMethods: ['DELETE'],
  }
);