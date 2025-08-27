/**
 * Group Bookings API Endpoints
 * 
 * Handles creation and management of group bookings with flexible payment splitting
 * Supports various payment methods and participant management
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/db";
import { 
  groupBookingsTable, 
  groupParticipantsTable,
  groupActivitiesTable,
  NewGroupBooking,
  NewGroupParticipant,
  NewGroupActivity,
  paymentMethodEnum,
  groupBookingStatusEnum 
} from "@/db/schema/group-bookings-schema";
import { bookingsTable } from "@/db/schema/bookings-schema";
import { providersTable } from "@/db/schema/providers-schema";
import { withAuth, AuthContext } from "@/lib/auth/route-protection";
import { stripe } from "@/lib/stripe";
import { calculateFees } from "@/lib/payments/fee-calculator";
import { eq, and, gte, lte, or } from "drizzle-orm";
import { nanoid } from "nanoid";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Validation schemas
const createGroupBookingSchema = z.object({
  providerId: z.string().uuid(),
  serviceName: z.string().min(1),
  servicePrice: z.number().positive(),
  serviceDuration: z.number().positive(),
  bookingDate: z.string().datetime(),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  
  // Group details
  groupName: z.string().optional(),
  groupDescription: z.string().optional(),
  eventType: z.string().optional(),
  
  // Participants
  minParticipants: z.number().min(1).default(1),
  maxParticipants: z.number().positive(),
  
  // Payment
  paymentMethod: z.enum([
    "organizer_pays",
    "split_equal",
    "custom_split",
    "pay_own",
    "deposit_split",
    "corporate"
  ]),
  depositPercentage: z.number().min(0).max(100).optional(),
  
  // Deadlines
  registrationDeadline: z.string().datetime().optional(),
  paymentDeadline: z.string().datetime().optional(),
  
  // Options
  allowWaitlist: z.boolean().default(false),
  allowPartialPayment: z.boolean().default(false),
  requiresApproval: z.boolean().default(false),
  isPublic: z.boolean().default(false),
  
  // Communication
  welcomeMessage: z.string().optional(),
  instructions: z.string().optional(),
  
  // Custom fields
  customFields: z.record(z.any()).optional(),
  
  // Initial participants to invite
  initialParticipants: z.array(z.object({
    email: z.string().email(),
    name: z.string().optional(),
    customAmount: z.number().positive().optional() // For custom_split
  })).optional()
});

const updateGroupBookingSchema = z.object({
  groupName: z.string().optional(),
  groupDescription: z.string().optional(),
  registrationDeadline: z.string().datetime().optional(),
  paymentDeadline: z.string().datetime().optional(),
  welcomeMessage: z.string().optional(),
  instructions: z.string().optional(),
  allowWaitlist: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  minParticipants: z.number().min(1).optional(),
  maxParticipants: z.number().positive().optional(),
});

/**
 * POST /api/bookings/group - Create a new group booking
 */
async function createGroupBooking(req: NextRequest, authContext: AuthContext) {
  try {
    const body = await req.json();
    const validatedData = createGroupBookingSchema.parse(body);

    // Verify provider exists and is active
    const provider = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, validatedData.providerId))
      .limit(1);

    if (!provider.length) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 }
      );
    }

    if (!provider[0].isActive) {
      return NextResponse.json(
        { error: "Provider is not active" },
        { status: 400 }
      );
    }

    // Calculate pricing
    const baseAmountCents = Math.round(validatedData.servicePrice * 100);
    const feeCalculation = calculateFees({
      baseAmountCents,
      isGuest: false // Group bookings require authentication
    });

    // Calculate per-person amounts based on payment method
    let perPersonAmountCents = 0;
    let depositAmountCents = 0;

    if (validatedData.paymentMethod === "split_equal") {
      perPersonAmountCents = Math.ceil(feeCalculation.customerTotalCents / validatedData.maxParticipants);
    } else if (validatedData.paymentMethod === "pay_own") {
      perPersonAmountCents = feeCalculation.customerTotalCents;
    } else if (validatedData.paymentMethod === "deposit_split" && validatedData.depositPercentage) {
      depositAmountCents = Math.round(feeCalculation.customerTotalCents * (validatedData.depositPercentage / 100));
      perPersonAmountCents = Math.ceil(depositAmountCents / validatedData.maxParticipants);
    }

    // Start transaction
    const result = await db.transaction(async (tx) => {
      // Create base booking entry
      const booking = await tx
        .insert(bookingsTable)
        .values({
          providerId: validatedData.providerId,
          customerId: authContext.userId!,
          serviceName: validatedData.serviceName,
          servicePrice: validatedData.servicePrice.toString(),
          serviceDuration: validatedData.serviceDuration,
          bookingDate: new Date(validatedData.bookingDate),
          startTime: validatedData.startTime,
          endTime: validatedData.endTime,
          status: "pending",
          totalAmount: (feeCalculation.customerTotalCents / 100).toString(),
          platformFee: (feeCalculation.platformFeeCents / 100).toString(),
          providerPayout: (feeCalculation.providerPayoutCents / 100).toString(),
          isGroupBooking: true
        })
        .returning();

      // Create group booking entry
      const groupBooking = await tx
        .insert(groupBookingsTable)
        .values({
          bookingId: booking[0].id,
          organizerId: authContext.userId!,
          organizerEmail: body.organizerEmail || authContext.email,
          organizerName: body.organizerName,
          organizerPhone: body.organizerPhone,
          groupName: validatedData.groupName,
          groupDescription: validatedData.groupDescription,
          eventType: validatedData.eventType,
          minParticipants: validatedData.minParticipants,
          maxParticipants: validatedData.maxParticipants,
          paymentMethod: validatedData.paymentMethod,
          totalAmountCents: feeCalculation.customerTotalCents,
          perPersonAmountCents,
          depositAmountCents,
          registrationDeadline: validatedData.registrationDeadline ? new Date(validatedData.registrationDeadline) : null,
          paymentDeadline: validatedData.paymentDeadline ? new Date(validatedData.paymentDeadline) : null,
          allowWaitlist: validatedData.allowWaitlist,
          allowPartialPayment: validatedData.allowPartialPayment,
          requiresApproval: validatedData.requiresApproval,
          isPublic: validatedData.isPublic,
          welcomeMessage: validatedData.welcomeMessage,
          instructions: validatedData.instructions,
          customFields: validatedData.customFields || {},
          status: "collecting",
          currentParticipants: 1, // Organizer is first participant
          confirmedParticipants: validatedData.paymentMethod === "organizer_pays" ? 1 : 0
        })
        .returning();

      // Add organizer as first participant
      const organizerAmount = validatedData.paymentMethod === "organizer_pays" 
        ? feeCalculation.customerTotalCents 
        : validatedData.paymentMethod === "split_equal" 
          ? perPersonAmountCents 
          : 0;

      await tx.insert(groupParticipantsTable).values({
        groupBookingId: groupBooking[0].id,
        email: body.organizerEmail || authContext.email,
        name: body.organizerName || authContext.name,
        phone: body.organizerPhone,
        userId: authContext.userId!,
        amountCents: organizerAmount,
        status: "accepted",
        respondedAt: new Date()
      });

      // Add initial participants if provided
      if (validatedData.initialParticipants?.length) {
        const participantValues = validatedData.initialParticipants.map(p => ({
          groupBookingId: groupBooking[0].id,
          email: p.email,
          name: p.name,
          amountCents: p.customAmount 
            ? Math.round(p.customAmount * 100) 
            : perPersonAmountCents,
          status: "invited" as const,
          invitationToken: nanoid(32),
          invitationSentAt: new Date()
        }));

        await tx.insert(groupParticipantsTable).values(participantValues);

        // Send invitation emails
        for (const participant of participantValues) {
          await sendInvitationEmail(groupBooking[0], participant);
        }

        // Update participant count
        await tx
          .update(groupBookingsTable)
          .set({ 
            currentParticipants: 1 + validatedData.initialParticipants.length 
          })
          .where(eq(groupBookingsTable.id, groupBooking[0].id));
      }

      // Log activity
      await tx.insert(groupActivitiesTable).values({
        groupBookingId: groupBooking[0].id,
        activityType: "group_created",
        actorId: authContext.userId!,
        actorType: "organizer",
        description: `Group booking created by ${body.organizerName || authContext.name}`,
        details: {
          serviceName: validatedData.serviceName,
          maxParticipants: validatedData.maxParticipants,
          paymentMethod: validatedData.paymentMethod
        }
      });

      return { booking: booking[0], groupBooking: groupBooking[0] };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error creating group booking:", error);
    return NextResponse.json(
      { error: "Failed to create group booking" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/bookings/group - Get group bookings
 */
async function getGroupBookings(req: NextRequest, authContext: AuthContext) {
  try {
    const { searchParams } = new URL(req.url);
    const groupBookingId = searchParams.get("id");
    const organizerId = searchParams.get("organizerId");
    const status = searchParams.get("status");
    const includeParticipants = searchParams.get("includeParticipants") === "true";

    // Get specific group booking
    if (groupBookingId) {
      const groupBooking = await db
        .select()
        .from(groupBookingsTable)
        .where(eq(groupBookingsTable.id, groupBookingId))
        .limit(1);

      if (!groupBooking.length) {
        return NextResponse.json(
          { error: "Group booking not found" },
          { status: 404 }
        );
      }

      // Check access permissions
      if (authContext.role !== "admin" && 
          groupBooking[0].organizerId !== authContext.userId &&
          !groupBooking[0].isPublic) {
        
        // Check if user is a participant
        const participant = await db
          .select()
          .from(groupParticipantsTable)
          .where(and(
            eq(groupParticipantsTable.groupBookingId, groupBookingId),
            eq(groupParticipantsTable.userId, authContext.userId!)
          ))
          .limit(1);

        if (!participant.length) {
          return NextResponse.json(
            { error: "Access denied" },
            { status: 403 }
          );
        }
      }

      let participants = [];
      if (includeParticipants) {
        participants = await db
          .select()
          .from(groupParticipantsTable)
          .where(eq(groupParticipantsTable.groupBookingId, groupBookingId));
      }

      return NextResponse.json({
        groupBooking: groupBooking[0],
        participants
      });
    }

    // List group bookings with filters
    let query = db.select().from(groupBookingsTable);
    const conditions = [];

    if (organizerId) {
      conditions.push(eq(groupBookingsTable.organizerId, organizerId));
    }

    if (status) {
      conditions.push(eq(groupBookingsTable.status, status as any));
    }

    // Non-admins can only see their own bookings or public ones
    if (authContext.role !== "admin") {
      conditions.push(
        or(
          eq(groupBookingsTable.organizerId, authContext.userId!),
          eq(groupBookingsTable.isPublic, true)
        )
      );
    }

    if (conditions.length) {
      query = query.where(and(...conditions));
    }

    const groupBookings = await query;

    return NextResponse.json({ groupBookings });
  } catch (error) {
    console.error("Error fetching group bookings:", error);
    return NextResponse.json(
      { error: "Failed to fetch group bookings" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/bookings/group - Update a group booking
 */
async function updateGroupBooking(req: NextRequest, authContext: AuthContext) {
  try {
    const body = await req.json();
    const { groupBookingId, ...updateData } = body;
    
    if (!groupBookingId) {
      return NextResponse.json(
        { error: "Group booking ID is required" },
        { status: 400 }
      );
    }

    const validatedData = updateGroupBookingSchema.parse(updateData);

    // Check if user owns the group booking
    const groupBooking = await db
      .select()
      .from(groupBookingsTable)
      .where(eq(groupBookingsTable.id, groupBookingId))
      .limit(1);

    if (!groupBooking.length) {
      return NextResponse.json(
        { error: "Group booking not found" },
        { status: 404 }
      );
    }

    if (authContext.role !== "admin" && groupBooking[0].organizerId !== authContext.userId) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Update group booking
    const updated = await db
      .update(groupBookingsTable)
      .set({
        ...validatedData,
        updatedAt: new Date()
      })
      .where(eq(groupBookingsTable.id, groupBookingId))
      .returning();

    // Log activity
    await db.insert(groupActivitiesTable).values({
      groupBookingId,
      activityType: "group_updated",
      actorId: authContext.userId!,
      actorType: authContext.role === "admin" ? "system" : "organizer",
      description: "Group booking details updated",
      details: validatedData
    });

    return NextResponse.json(updated[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid update data", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error updating group booking:", error);
    return NextResponse.json(
      { error: "Failed to update group booking" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/bookings/group - Cancel a group booking
 */
async function cancelGroupBooking(req: NextRequest, authContext: AuthContext) {
  try {
    const { searchParams } = new URL(req.url);
    const groupBookingId = searchParams.get("id");
    const reason = searchParams.get("reason");

    if (!groupBookingId) {
      return NextResponse.json(
        { error: "Group booking ID is required" },
        { status: 400 }
      );
    }

    // Check ownership
    const groupBooking = await db
      .select()
      .from(groupBookingsTable)
      .where(eq(groupBookingsTable.id, groupBookingId))
      .limit(1);

    if (!groupBooking.length) {
      return NextResponse.json(
        { error: "Group booking not found" },
        { status: 404 }
      );
    }

    if (authContext.role !== "admin" && groupBooking[0].organizerId !== authContext.userId) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Process refunds if payments were collected
    if (groupBooking[0].collectedAmountCents > 0) {
      const participants = await db
        .select()
        .from(groupParticipantsTable)
        .where(and(
          eq(groupParticipantsTable.groupBookingId, groupBookingId),
          gte(groupParticipantsTable.paidAmountCents, 1)
        ));

      for (const participant of participants) {
        if (participant.stripePaymentIntentId) {
          try {
            const refund = await stripe.refunds.create({
              payment_intent: participant.stripePaymentIntentId,
              amount: participant.paidAmountCents
            });

            await db
              .update(groupParticipantsTable)
              .set({
                refundedAmountCents: participant.paidAmountCents,
                stripeRefundId: refund.id,
                status: "refunded",
                updatedAt: new Date()
              })
              .where(eq(groupParticipantsTable.id, participant.id));
          } catch (refundError) {
            console.error(`Failed to refund participant ${participant.id}:`, refundError);
          }
        }
      }
    }

    // Update group booking status
    await db
      .update(groupBookingsTable)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(groupBookingsTable.id, groupBookingId));

    // Update base booking status
    if (groupBooking[0].bookingId) {
      await db
        .update(bookingsTable)
        .set({
          status: "cancelled",
          cancellationReason: reason || "Group booking cancelled",
          cancelledBy: authContext.userId!,
          cancelledAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(bookingsTable.id, groupBooking[0].bookingId));
    }

    // Log activity
    await db.insert(groupActivitiesTable).values({
      groupBookingId,
      activityType: "group_cancelled",
      actorId: authContext.userId!,
      actorType: authContext.role === "admin" ? "system" : "organizer",
      description: `Group booking cancelled: ${reason || "No reason provided"}`,
      details: { reason }
    });

    // Notify participants
    await notifyParticipantsOfCancellation(groupBookingId, reason);

    return NextResponse.json({ 
      message: "Group booking cancelled successfully",
      refundsProcessed: groupBooking[0].collectedAmountCents > 0
    });
  } catch (error) {
    console.error("Error cancelling group booking:", error);
    return NextResponse.json(
      { error: "Failed to cancel group booking" },
      { status: 500 }
    );
  }
}

// Helper functions

async function sendInvitationEmail(groupBooking: any, participant: any) {
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/group-booking/invite/${participant.invitationToken}`;
  
  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: participant.email,
      subject: `You're invited to ${groupBooking.groupName || "a group booking"}`,
      html: `
        <h2>You're Invited!</h2>
        <p>${groupBooking.organizerName} has invited you to join a group booking.</p>
        ${groupBooking.welcomeMessage ? `<p>${groupBooking.welcomeMessage}</p>` : ""}
        <p><strong>Event Details:</strong></p>
        <ul>
          <li>Date: ${new Date(groupBooking.bookingDate).toLocaleDateString()}</li>
          <li>Time: ${groupBooking.startTime} - ${groupBooking.endTime}</li>
          <li>Your share: $${(participant.amountCents / 100).toFixed(2)}</li>
        </ul>
        ${groupBooking.instructions ? `<p><strong>Instructions:</strong> ${groupBooking.instructions}</p>` : ""}
        <p>
          <a href="${inviteUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">
            View Invitation
          </a>
        </p>
        ${groupBooking.registrationDeadline ? `<p><small>Please respond by ${new Date(groupBooking.registrationDeadline).toLocaleDateString()}</small></p>` : ""}
      `
    });
  } catch (error) {
    console.error(`Failed to send invitation email to ${participant.email}:`, error);
  }
}

async function notifyParticipantsOfCancellation(groupBookingId: string, reason?: string) {
  const participants = await db
    .select()
    .from(groupParticipantsTable)
    .where(eq(groupParticipantsTable.groupBookingId, groupBookingId));

  for (const participant of participants) {
    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL!,
        to: participant.email,
        subject: "Group Booking Cancelled",
        html: `
          <h2>Group Booking Cancelled</h2>
          <p>We regret to inform you that the group booking you were part of has been cancelled.</p>
          ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
          ${participant.paidAmountCents > 0 ? `
            <p>A full refund of $${(participant.paidAmountCents / 100).toFixed(2)} has been processed and should appear in your account within 5-7 business days.</p>
          ` : ""}
          <p>If you have any questions, please contact the organizer.</p>
        `
      });
    } catch (error) {
      console.error(`Failed to notify participant ${participant.email}:`, error);
    }
  }
}

// Route handlers with authentication
export const POST = withAuth(createGroupBooking, { requireAuth: true });
export const GET = withAuth(getGroupBookings, { allowGuest: true });
export const PATCH = withAuth(updateGroupBooking, { requireAuth: true });
export const DELETE = withAuth(cancelGroupBooking, { requireAuth: true });