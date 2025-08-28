import { NextRequest, NextResponse } from "next/server";
import { checkEventAvailability, getEventById } from "@/db/queries/events-queries";
import { z } from "zod";
import { createSecureApiHandler, createApiResponse, createApiError, ApiContext } from "@/lib/security/api-handler";
import { calculateFees } from "@/lib/fees";

/**
 * Event Availability API
 * GET /api/events/[id]/availability - Check event availability and pricing
 */

/**
 * GET handler - Check event availability
 */
async function handleCheckAvailability(req: NextRequest, context: ApiContext) {
  try {
    const { id: eventId } = context.params || {};
    
    if (!eventId || !z.string().uuid().safeParse(eventId).success) {
      return createApiError("Invalid event ID", { status: 400 });
    }
    
    // Get query parameters
    const { searchParams } = new URL(req.url);
    const numberOfGuests = parseInt(searchParams.get("guests") || "1");
    const isGuest = searchParams.get("isGuest") === "true";
    
    if (numberOfGuests < 1 || numberOfGuests > 100) {
      return createApiError("Invalid number of guests", { 
        status: 400,
        details: { min: 1, max: 100 }
      });
    }
    
    // Check event availability
    const availability = await checkEventAvailability(eventId);
    
    if (!availability.available) {
      return createApiResponse({
        available: false,
        reason: availability.reason,
        waitlistAvailable: availability.waitlistAvailable || false,
      });
    }
    
    // Get event details for additional information
    const event = await getEventById(eventId);
    
    if (!event) {
      return createApiError("Event not found", { status: 404 });
    }
    
    // Check if requested guests exceed available spots
    let canAccommodate = true;
    let partialAvailable = 0;
    
    if (availability.availableSpots !== null && availability.availableSpots !== undefined) {
      canAccommodate = numberOfGuests <= availability.availableSpots;
      partialAvailable = Math.min(numberOfGuests, availability.availableSpots);
    }
    
    // Calculate pricing
    const regularPrice = availability.price || 0;
    const earlyBirdPrice = availability.earlyBirdPrice;
    const currentPrice = earlyBirdPrice !== null && earlyBirdPrice !== undefined ? earlyBirdPrice : regularPrice;
    
    // Calculate total with fees
    const subtotal = currentPrice * numberOfGuests;
    const fees = calculateFees(subtotal, isGuest);
    
    // Prepare detailed availability response
    const response = {
      available: availability.available && canAccommodate,
      event: {
        id: event.id,
        title: event.title,
        startDateTime: event.startDateTime,
        endDateTime: event.endDateTime,
        timezone: event.timezone,
        locationType: event.locationType,
        status: event.status,
      },
      capacity: {
        maxAttendees: event.maxAttendees,
        currentAttendees: event.currentAttendees,
        availableSpots: availability.availableSpots,
        canAccommodateRequest: canAccommodate,
        partialAvailable: !canAccommodate ? partialAvailable : null,
      },
      pricing: {
        unitPrice: currentPrice,
        regularPrice: regularPrice,
        earlyBirdPrice: earlyBirdPrice,
        earlyBirdActive: earlyBirdPrice !== null && earlyBirdPrice !== undefined,
        earlyBirdDeadline: availability.earlyBirdPrice ? event.earlyBirdDeadline : null,
        numberOfGuests: numberOfGuests,
        subtotal: subtotal,
        fees: {
          platformFee: fees.platformFee,
          guestSurcharge: isGuest ? fees.totalAmount - subtotal : 0,
        },
        total: fees.totalAmount,
        currency: "usd",
      },
      booking: {
        instantBooking: availability.instantBooking,
        requiresApproval: availability.requiresApproval,
        waitlistAvailable: !canAccommodate && availability.waitlistAvailable,
      },
      policies: {
        cancellationPolicy: event.cancellationPolicy,
        refundPolicy: event.refundPolicy,
      },
      provider: {
        id: event.provider.id,
        displayName: event.provider.displayName,
        profileImageUrl: event.provider.profileImageUrl,
        isVerified: event.provider.isVerified,
      },
    };
    
    // Add location details based on type
    if (event.locationType === "virtual") {
      response.event = {
        ...response.event,
        ...{ virtualDetails: "Link will be provided after booking confirmation" }
      };
    } else if (event.locationType === "in_person" && event.address) {
      response.event = {
        ...response.event,
        ...{ 
          address: {
            city: (event.address as any).city,
            state: (event.address as any).state,
            // Don't expose full address until booking is confirmed
            fullAddress: "Full address will be provided after booking confirmation"
          }
        }
      };
    }
    
    return createApiResponse(response);
    
  } catch (error) {
    console.error("Error checking event availability:", error);
    return createApiError("Failed to check availability", { 
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
    rateLimit: { requests: 100, window: '1m' },
    auditLog: false,
    allowedMethods: ['GET'],
  }
);

// Health check
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}