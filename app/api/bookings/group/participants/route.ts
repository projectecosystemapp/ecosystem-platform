// @ts-nocheck
/**
 * Group Booking Participants API
 * 
 * Manages participants in group bookings including:
 * - Adding/removing participants
 * - RSVP management
 * - Waitlist handling
 * - Participant communications
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/db";
import {
  groupBookingsTable,
  groupParticipantsTable,
  groupActivitiesTable,
  groupMessagesTable,
  NewGroupParticipant,
  participantStatusEnum
} from "@/db/schema/group-bookings-schema";
import { withAuth, AuthContext } from "@/lib/auth/route-protection";
import { eq, and, or, gt, lt } from "drizzle-orm";
import { nanoid } from "nanoid";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Validation schemas
const addParticipantsSchema = z.object({
  groupBookingId: z.string().uuid(),
  participants: z.array(z.object({
    email: z.string().email(),
    name: z.string().optional(),
    phone: z.string().optional(),
    amountCents: z.number().positive().optional(),
    dietaryRestrictions: z.string().optional(),
    specialRequests: z.string().optional(),
    emergencyContact: z.object({
      name: z.string(),
      phone: z.string(),
      relationship: z.string()
    }).optional(),
    customResponses: z.record(z.any()).optional()
  })),
  sendInvitations: z.boolean().default(true),
  customMessage: z.string().optional()
});

const updateParticipantSchema = z.object({
  participantId: z.string().uuid(),
  status: z.enum([
    "invited",
    "accepted",
    "declined",
    "pending_payment",
    "paid",
    "cancelled",
    "refunded",
    "waitlisted"
  ]).optional(),
  amountCents: z.number().positive().optional(),
  name: z.string().optional(),
  phone: z.string().optional(),
  dietaryRestrictions: z.string().optional(),
  specialRequests: z.string().optional(),
  emergencyContact: z.object({
    name: z.string(),
    phone: z.string(),
    relationship: z.string()
  }).optional(),
  customResponses: z.record(z.any()).optional()
});

const rsvpSchema = z.object({
  invitationToken: z.string(),
  response: z.enum(["accept", "decline"]),
  declineReason: z.string().optional(),
  name: z.string().optional(),
  phone: z.string().optional(),
  dietaryRestrictions: z.string().optional(),
  specialRequests: z.string().optional(),
  emergencyContact: z.object({
    name: z.string(),
    phone: z.string(),
    relationship: z.string()
  }).optional(),
  customResponses: z.record(z.any()).optional()
});

/**
 * POST /api/bookings/group/participants - Add participants to a group booking
 */
async function addParticipants(req: NextRequest, authContext: AuthContext) {
  try {
    const body = await req.json();
    const validatedData = addParticipantsSchema.parse(body);

    // Verify group booking exists and user has permission
    const groupBooking = await db
      .select()
      .from(groupBookingsTable)
      .where(eq(groupBookingsTable.id, validatedData.groupBookingId))
      .limit(1);

    if (!groupBooking.length) {
      return NextResponse.json(
        { error: "Group booking not found" },
        { status: 404 }
      );
    }

    // Check permissions
    if (authContext.role !== "admin" && groupBooking[0].organizerId !== authContext.userId) {
      return NextResponse.json(
        { error: "Only the organizer can add participants" },
        { status: 403 }
      );
    }

    // Check if booking is still accepting participants
    if (groupBooking[0].status !== "collecting" && groupBooking[0].status !== "pending_confirmation") {
      return NextResponse.json(
        { error: "Group booking is not accepting new participants" },
        { status: 400 }
      );
    }

    // Check capacity
    const availableSpots = groupBooking[0].maxParticipants - groupBooking[0].currentParticipants;
    const waitlistEnabled = groupBooking[0].allowWaitlist;

    if (validatedData.participants.length > availableSpots && !waitlistEnabled) {
      return NextResponse.json(
        { error: `Only ${availableSpots} spots available` },
        { status: 400 }
      );
    }

    // Check registration deadline
    if (groupBooking[0].registrationDeadline && new Date() > groupBooking[0].registrationDeadline) {
      return NextResponse.json(
        { error: "Registration deadline has passed" },
        { status: 400 }
      );
    }

    // Calculate amount per participant if not specified
    const defaultAmountCents = groupBooking[0].paymentMethod === "split_equal"
      ? groupBooking[0].perPersonAmountCents
      : groupBooking[0].paymentMethod === "organizer_pays"
      ? 0
      : groupBooking[0].perPersonAmountCents;

    const result = await db.transaction(async (tx) => {
      const addedParticipants = [];
      const waitlistedParticipants = [];
      let participantsAdded = 0;

      for (const participantData of validatedData.participants) {
        // Check if participant already exists
        const existing = await tx
          .select()
          .from(groupParticipantsTable)
          .where(and(
            eq(groupParticipantsTable.groupBookingId, validatedData.groupBookingId),
            eq(groupParticipantsTable.email, participantData.email)
          ))
          .limit(1);

        if (existing.length > 0) {
          continue; // Skip if already added
        }

        const isWaitlisted = participantsAdded >= availableSpots;
        const status = isWaitlisted ? "waitlisted" : "invited";

        const participant = await tx
          .insert(groupParticipantsTable)
          .values({
            groupBookingId: validatedData.groupBookingId,
            email: participantData.email,
            name: participantData.name,
            phone: participantData.phone,
            amountCents: participantData.amountCents || defaultAmountCents || 0,
            status,
            invitationToken: nanoid(32),
            invitationSentAt: validatedData.sendInvitations ? new Date() : null,
            paymentDueDate: groupBooking[0].paymentDeadline,
            dietaryRestrictions: participantData.dietaryRestrictions,
            specialRequests: participantData.specialRequests,
            emergencyContact: participantData.emergencyContact || {},
            customResponses: participantData.customResponses || {}
          })
          .returning();

        if (isWaitlisted) {
          waitlistedParticipants.push(participant[0]);
        } else {
          addedParticipants.push(participant[0]);
          participantsAdded++;
        }
      }

      // Update participant count
      if (addedParticipants.length > 0) {
        await tx
          .update(groupBookingsTable)
          .set({
            currentParticipants: groupBooking[0].currentParticipants + addedParticipants.length,
            updatedAt: new Date()
          })
          .where(eq(groupBookingsTable.id, validatedData.groupBookingId));
      }

      // Log activity
      await tx.insert(groupActivitiesTable).values({
        groupBookingId: validatedData.groupBookingId,
        activityType: "participants_added",
        actorId: authContext.userId!,
        actorType: "organizer",
        description: `Added ${addedParticipants.length} participants${waitlistedParticipants.length > 0 ? ` and ${waitlistedParticipants.length} to waitlist` : ""}`,
        details: {
          added: addedParticipants.map(p => p.email),
          waitlisted: waitlistedParticipants.map(p => p.email)
        }
      });

      // Send invitations
      if (validatedData.sendInvitations) {
        for (const participant of [...addedParticipants, ...waitlistedParticipants]) {
          await sendParticipantInvitation(
            groupBooking[0],
            participant,
            validatedData.customMessage
          );
        }
      }

      return {
        added: addedParticipants,
        waitlisted: waitlistedParticipants,
        totalParticipants: groupBooking[0].currentParticipants + addedParticipants.length
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid participant data", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error adding participants:", error);
    return NextResponse.json(
      { error: "Failed to add participants" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/bookings/group/participants - Get participants for a group booking
 */
async function getParticipants(req: NextRequest, authContext: AuthContext) {
  try {
    const { searchParams } = new URL(req.url);
    const groupBookingId = searchParams.get("groupBookingId");
    const participantId = searchParams.get("participantId");
    const invitationToken = searchParams.get("invitationToken");
    const status = searchParams.get("status");

    // Get participant by invitation token (public access for RSVP)
    if (invitationToken) {
      const participant = await db
        .select({
          participant: groupParticipantsTable,
          groupBooking: groupBookingsTable
        })
        .from(groupParticipantsTable)
        .innerJoin(
          groupBookingsTable,
          eq(groupParticipantsTable.groupBookingId, groupBookingsTable.id)
        )
        .where(eq(groupParticipantsTable.invitationToken, invitationToken))
        .limit(1);

      if (!participant.length) {
        return NextResponse.json(
          { error: "Invalid invitation" },
          { status: 404 }
        );
      }

      // Mark invitation as viewed
      if (!participant[0].participant.invitationViewedAt) {
        await db
          .update(groupParticipantsTable)
          .set({ 
            invitationViewedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(groupParticipantsTable.invitationToken, invitationToken));
      }

      return NextResponse.json({
        participant: participant[0].participant,
        groupBooking: {
          id: participant[0].groupBooking.id,
          groupName: participant[0].groupBooking.groupName,
          groupDescription: participant[0].groupBooking.groupDescription,
          welcomeMessage: participant[0].groupBooking.welcomeMessage,
          instructions: participant[0].groupBooking.instructions,
          registrationDeadline: participant[0].groupBooking.registrationDeadline,
          paymentDeadline: participant[0].groupBooking.paymentDeadline,
          customFields: participant[0].groupBooking.customFields
        }
      });
    }

    // Get specific participant
    if (participantId) {
      const participant = await db
        .select()
        .from(groupParticipantsTable)
        .where(eq(groupParticipantsTable.id, participantId))
        .limit(1);

      if (!participant.length) {
        return NextResponse.json(
          { error: "Participant not found" },
          { status: 404 }
        );
      }

      // Verify access
      const groupBooking = await db
        .select()
        .from(groupBookingsTable)
        .where(eq(groupBookingsTable.id, participant[0].groupBookingId))
        .limit(1);

      if (authContext.role !== "admin" && 
          groupBooking[0].organizerId !== authContext.userId &&
          participant[0].userId !== authContext.userId) {
        return NextResponse.json(
          { error: "Access denied" },
          { status: 403 }
        );
      }

      return NextResponse.json(participant[0]);
    }

    // List participants for a group booking
    if (!groupBookingId) {
      return NextResponse.json(
        { error: "Group booking ID is required" },
        { status: 400 }
      );
    }

    // Verify access to group booking
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

    // Check permissions
    const isOrganizer = groupBooking[0].organizerId === authContext.userId;
    const isAdmin = authContext.role === "admin";
    
    if (!isOrganizer && !isAdmin) {
      // Regular users can only see themselves in the participant list
      const participant = await db
        .select()
        .from(groupParticipantsTable)
        .where(and(
          eq(groupParticipantsTable.groupBookingId, groupBookingId),
          authContext.userId 
            ? eq(groupParticipantsTable.userId, authContext.userId)
            : eq(groupParticipantsTable.email, authContext.email || "")
        ))
        .limit(1);

      return NextResponse.json({ participants: participant });
    }

    // Build query
    const conditions = [eq(groupParticipantsTable.groupBookingId, groupBookingId)];
    
    if (status) {
      conditions.push(eq(groupParticipantsTable.status, status as any));
    }

    const participants = await db
      .select()
      .from(groupParticipantsTable)
      .where(and(...conditions))
      .orderBy(groupParticipantsTable.createdAt);

    // Calculate statistics
    const stats = {
      total: participants.length,
      invited: participants.filter(p => p.status === "invited").length,
      accepted: participants.filter(p => p.status === "accepted").length,
      declined: participants.filter(p => p.status === "declined").length,
      paid: participants.filter(p => p.status === "paid").length,
      waitlisted: participants.filter(p => p.status === "waitlisted").length,
      totalPaid: participants.reduce((sum, p) => sum + p.paidAmountCents, 0) / 100,
      totalOwed: participants.reduce((sum, p) => sum + (p.amountCents - p.paidAmountCents), 0) / 100
    };

    return NextResponse.json({ participants, stats });
  } catch (error) {
    console.error("Error fetching participants:", error);
    return NextResponse.json(
      { error: "Failed to fetch participants" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/bookings/group/participants - Update participant details
 */
async function updateParticipant(req: NextRequest, authContext: AuthContext) {
  try {
    const body = await req.json();
    const validatedData = updateParticipantSchema.parse(body);

    // Get participant
    const participant = await db
      .select()
      .from(groupParticipantsTable)
      .where(eq(groupParticipantsTable.id, validatedData.participantId))
      .limit(1);

    if (!participant.length) {
      return NextResponse.json(
        { error: "Participant not found" },
        { status: 404 }
      );
    }

    // Check permissions
    const groupBooking = await db
      .select()
      .from(groupBookingsTable)
      .where(eq(groupBookingsTable.id, participant[0].groupBookingId))
      .limit(1);

    const isOrganizer = groupBooking[0].organizerId === authContext.userId;
    const isParticipant = participant[0].userId === authContext.userId;
    const isAdmin = authContext.role === "admin";

    if (!isOrganizer && !isParticipant && !isAdmin) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Handle status transitions
    if (validatedData.status && validatedData.status !== participant[0].status) {
      // Validate status transition
      if (validatedData.status === "accepted" && participant[0].status !== "invited") {
        return NextResponse.json(
          { error: "Can only accept from invited status" },
          { status: 400 }
        );
      }

      // Handle waitlist promotion
      if (validatedData.status === "accepted" && participant[0].status === "waitlisted") {
        // Check if there's space
        if (groupBooking[0].currentParticipants >= groupBooking[0].maxParticipants) {
          return NextResponse.json(
            { error: "No space available" },
            { status: 400 }
          );
        }
      }

      // Update confirmed participants count
      if (validatedData.status === "accepted" && participant[0].status !== "accepted") {
        await db
          .update(groupBookingsTable)
          .set({
            confirmedParticipants: groupBooking[0].confirmedParticipants + 1,
            updatedAt: new Date()
          })
          .where(eq(groupBookingsTable.id, participant[0].groupBookingId));
      } else if (participant[0].status === "accepted" && validatedData.status !== "accepted") {
        await db
          .update(groupBookingsTable)
          .set({
            confirmedParticipants: Math.max(0, groupBooking[0].confirmedParticipants - 1),
            updatedAt: new Date()
          })
          .where(eq(groupBookingsTable.id, participant[0].groupBookingId));
      }
    }

    // Update participant
    const updated = await db
      .update(groupParticipantsTable)
      .set({
        ...validatedData,
        respondedAt: validatedData.status ? new Date() : participant[0].respondedAt,
        updatedAt: new Date()
      })
      .where(eq(groupParticipantsTable.id, validatedData.participantId))
      .returning();

    // Log activity
    await db.insert(groupActivitiesTable).values({
      groupBookingId: participant[0].groupBookingId,
      activityType: "participant_updated",
      actorId: authContext.userId!,
      actorType: isOrganizer ? "organizer" : "participant",
      participantId: validatedData.participantId,
      description: `Participant ${updated[0].email} updated`,
      details: validatedData
    });

    // Check if waitlist should be processed
    if (validatedData.status === "declined" || validatedData.status === "cancelled") {
      await processWaitlist(participant[0].groupBookingId);
    }

    return NextResponse.json(updated[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid update data", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error updating participant:", error);
    return NextResponse.json(
      { error: "Failed to update participant" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/bookings/group/participants - Remove a participant
 */
async function removeParticipant(req: NextRequest, authContext: AuthContext) {
  try {
    const { searchParams } = new URL(req.url);
    const participantId = searchParams.get("participantId");

    if (!participantId) {
      return NextResponse.json(
        { error: "Participant ID is required" },
        { status: 400 }
      );
    }

    // Get participant
    const participant = await db
      .select()
      .from(groupParticipantsTable)
      .where(eq(groupParticipantsTable.id, participantId))
      .limit(1);

    if (!participant.length) {
      return NextResponse.json(
        { error: "Participant not found" },
        { status: 404 }
      );
    }

    // Check permissions
    const groupBooking = await db
      .select()
      .from(groupBookingsTable)
      .where(eq(groupBookingsTable.id, participant[0].groupBookingId))
      .limit(1);

    if (authContext.role !== "admin" && groupBooking[0].organizerId !== authContext.userId) {
      return NextResponse.json(
        { error: "Only organizers can remove participants" },
        { status: 403 }
      );
    }

    // Process refund if participant has paid
    if (participant[0].paidAmountCents > 0 && participant[0].stripePaymentIntentId) {
      try {
        const refund = await stripe.refunds.create({
          payment_intent: participant[0].stripePaymentIntentId,
          amount: participant[0].paidAmountCents
        });

        await db
          .update(groupParticipantsTable)
          .set({
            refundedAmountCents: participant[0].paidAmountCents,
            stripeRefundId: refund.id,
            status: "refunded",
            updatedAt: new Date()
          })
          .where(eq(groupParticipantsTable.id, participantId));
      } catch (refundError) {
        console.error("Failed to process refund:", refundError);
      }
    }

    // Remove participant
    await db
      .delete(groupParticipantsTable)
      .where(eq(groupParticipantsTable.id, participantId));

    // Update counts
    const wasConfirmed = participant[0].status === "accepted" || participant[0].status === "paid";
    await db
      .update(groupBookingsTable)
      .set({
        currentParticipants: Math.max(0, groupBooking[0].currentParticipants - 1),
        confirmedParticipants: wasConfirmed 
          ? Math.max(0, groupBooking[0].confirmedParticipants - 1)
          : groupBooking[0].confirmedParticipants,
        updatedAt: new Date()
      })
      .where(eq(groupBookingsTable.id, participant[0].groupBookingId));

    // Log activity
    await db.insert(groupActivitiesTable).values({
      groupBookingId: participant[0].groupBookingId,
      activityType: "participant_removed",
      actorId: authContext.userId!,
      actorType: "organizer",
      description: `Removed participant ${participant[0].email}`,
      details: {
        email: participant[0].email,
        refunded: participant[0].paidAmountCents > 0
      }
    });

    // Process waitlist
    await processWaitlist(participant[0].groupBookingId);

    return NextResponse.json({
      message: "Participant removed successfully",
      refunded: participant[0].paidAmountCents > 0
    });
  } catch (error) {
    console.error("Error removing participant:", error);
    return NextResponse.json(
      { error: "Failed to remove participant" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bookings/group/participants/rsvp - Handle RSVP responses
 */
async function handleRSVP(req: NextRequest) {
  try {
    const body = await req.json();
    const validatedData = rsvpSchema.parse(body);

    // Find participant by invitation token
    const participant = await db
      .select()
      .from(groupParticipantsTable)
      .where(eq(groupParticipantsTable.invitationToken, validatedData.invitationToken))
      .limit(1);

    if (!participant.length) {
      return NextResponse.json(
        { error: "Invalid invitation" },
        { status: 404 }
      );
    }

    // Check if already responded
    if (participant[0].status !== "invited" && participant[0].status !== "waitlisted") {
      return NextResponse.json(
        { error: "Already responded to invitation" },
        { status: 400 }
      );
    }

    // Get group booking
    const groupBooking = await db
      .select()
      .from(groupBookingsTable)
      .where(eq(groupBookingsTable.id, participant[0].groupBookingId))
      .limit(1);

    // Check deadline
    if (groupBooking[0].registrationDeadline && new Date() > groupBooking[0].registrationDeadline) {
      return NextResponse.json(
        { error: "Registration deadline has passed" },
        { status: 400 }
      );
    }

    const newStatus = validatedData.response === "accept" 
      ? (participant[0].status === "waitlisted" ? "waitlisted" : "accepted")
      : "declined";

    // Update participant
    const updated = await db
      .update(groupParticipantsTable)
      .set({
        status: newStatus,
        respondedAt: new Date(),
        declineReason: validatedData.declineReason,
        name: validatedData.name || participant[0].name,
        phone: validatedData.phone || participant[0].phone,
        dietaryRestrictions: validatedData.dietaryRestrictions,
        specialRequests: validatedData.specialRequests,
        emergencyContact: validatedData.emergencyContact || participant[0].emergencyContact,
        customResponses: validatedData.customResponses || participant[0].customResponses,
        updatedAt: new Date()
      })
      .where(eq(groupParticipantsTable.id, participant[0].id))
      .returning();

    // Update confirmed count if accepted
    if (newStatus === "accepted") {
      await db
        .update(groupBookingsTable)
        .set({
          confirmedParticipants: groupBooking[0].confirmedParticipants + 1,
          updatedAt: new Date()
        })
        .where(eq(groupBookingsTable.id, participant[0].groupBookingId));
    }

    // Log activity
    await db.insert(groupActivitiesTable).values({
      groupBookingId: participant[0].groupBookingId,
      activityType: validatedData.response === "accept" ? "participant_accepted" : "participant_declined",
      participantId: participant[0].id,
      actorType: "participant",
      description: `${participant[0].email} ${validatedData.response}ed the invitation`,
      details: {
        response: validatedData.response,
        declineReason: validatedData.declineReason
      }
    });

    // Send confirmation email
    await sendRSVPConfirmation(groupBooking[0], updated[0], validatedData.response);

    // Process waitlist if declined
    if (newStatus === "declined") {
      await processWaitlist(participant[0].groupBookingId);
    }

    return NextResponse.json({
      message: `Successfully ${validatedData.response}ed invitation`,
      participant: updated[0],
      nextStep: newStatus === "accepted" ? "payment" : null
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid RSVP data", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error processing RSVP:", error);
    return NextResponse.json(
      { error: "Failed to process RSVP" },
      { status: 500 }
    );
  }
}

// Helper functions

async function sendParticipantInvitation(
  groupBooking: any,
  participant: any,
  customMessage?: string
) {
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/group-booking/invite/${participant.invitationToken}`;
  
  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: participant.email,
      subject: `Invitation: ${groupBooking.groupName || "Group Booking"}`,
      html: `
        <h2>You're Invited!</h2>
        <p>${groupBooking.organizerName} has invited you to join:</p>
        <h3>${groupBooking.groupName || "Group Booking"}</h3>
        ${groupBooking.groupDescription ? `<p>${groupBooking.groupDescription}</p>` : ""}
        ${customMessage ? `<p><strong>Message from organizer:</strong> ${customMessage}</p>` : ""}
        ${groupBooking.welcomeMessage ? `<p>${groupBooking.welcomeMessage}</p>` : ""}
        
        <p><strong>Details:</strong></p>
        <ul>
          <li>Your share: $${(participant.amountCents / 100).toFixed(2)}</li>
          ${participant.status === "waitlisted" ? "<li><strong>You are currently on the waitlist</strong></li>" : ""}
        </ul>
        
        ${groupBooking.instructions ? `<p><strong>Instructions:</strong> ${groupBooking.instructions}</p>` : ""}
        
        <p>
          <a href="${inviteUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">
            Respond to Invitation
          </a>
        </p>
        
        ${groupBooking.registrationDeadline ? `<p><small>Please respond by ${new Date(groupBooking.registrationDeadline).toLocaleDateString()}</small></p>` : ""}
      `
    });
  } catch (error) {
    console.error(`Failed to send invitation to ${participant.email}:`, error);
  }
}

async function sendRSVPConfirmation(groupBooking: any, participant: any, response: string) {
  try {
    if (response === "accept") {
      const paymentUrl = `${process.env.NEXT_PUBLIC_APP_URL}/group-booking/${groupBooking.id}/payment?token=${participant.invitationToken}`;
      
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL!,
        to: participant.email,
        subject: `Confirmation: ${groupBooking.groupName || "Group Booking"}`,
        html: `
          <h2>Thank You for Accepting!</h2>
          <p>You have successfully accepted the invitation to ${groupBooking.groupName || "the group booking"}.</p>
          
          ${participant.amountCents > 0 ? `
            <h3>Next Step: Payment</h3>
            <p>Your share is $${(participant.amountCents / 100).toFixed(2)}</p>
            ${groupBooking.paymentDeadline ? `<p>Payment deadline: ${new Date(groupBooking.paymentDeadline).toLocaleDateString()}</p>` : ""}
            <p>
              <a href="${paymentUrl}" style="display: inline-block; padding: 12px 24px; background-color: #28a745; color: white; text-decoration: none; border-radius: 4px;">
                Make Payment
              </a>
            </p>
          ` : "<p>No payment required for this booking.</p>"}
          
          ${participant.status === "waitlisted" ? `
            <p><strong>Note:</strong> You are currently on the waitlist. We'll notify you if a spot becomes available.</p>
          ` : ""}
        `
      });
    } else {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL!,
        to: participant.email,
        subject: `Declined: ${groupBooking.groupName || "Group Booking"}`,
        html: `
          <h2>Invitation Declined</h2>
          <p>You have declined the invitation to ${groupBooking.groupName || "the group booking"}.</p>
          <p>If you change your mind, please contact the organizer.</p>
        `
      });
    }
  } catch (error) {
    console.error(`Failed to send RSVP confirmation to ${participant.email}:`, error);
  }
}

async function processWaitlist(groupBookingId: string) {
  const groupBooking = await db
    .select()
    .from(groupBookingsTable)
    .where(eq(groupBookingsTable.id, groupBookingId))
    .limit(1);

  if (!groupBooking.length || !groupBooking[0].allowWaitlist) {
    return;
  }

  // Check if there's space
  if (groupBooking[0].currentParticipants >= groupBooking[0].maxParticipants) {
    return;
  }

  // Get next waitlisted participant
  const waitlisted = await db
    .select()
    .from(groupParticipantsTable)
    .where(and(
      eq(groupParticipantsTable.groupBookingId, groupBookingId),
      eq(groupParticipantsTable.status, "waitlisted")
    ))
    .orderBy(groupParticipantsTable.createdAt)
    .limit(1);

  if (!waitlisted.length) {
    return;
  }

  // Promote from waitlist
  await db
    .update(groupParticipantsTable)
    .set({
      status: "invited",
      updatedAt: new Date()
    })
    .where(eq(groupParticipantsTable.id, waitlisted[0].id));

  // Send notification
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: waitlisted[0].email,
    subject: `A spot is available! - ${groupBooking[0].groupName || "Group Booking"}`,
    html: `
      <h2>Good News!</h2>
      <p>A spot has become available for ${groupBooking[0].groupName || "the group booking"}.</p>
      <p>Please confirm your participation as soon as possible to secure your spot.</p>
      <p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/group-booking/invite/${waitlisted[0].invitationToken}" 
           style="display: inline-block; padding: 12px 24px; background-color: #28a745; color: white; text-decoration: none; border-radius: 4px;">
          Confirm Your Spot
        </a>
      </p>
    `
  });

  // Log activity
  await db.insert(groupActivitiesTable).values({
    groupBookingId,
    activityType: "waitlist_promoted",
    participantId: waitlisted[0].id,
    actorType: "system",
    description: `${waitlisted[0].email} promoted from waitlist`,
    details: {}
  });
}

// Route handlers
export const POST = withAuth(
  async (req: NextRequest, authContext: AuthContext) => {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    if (action === "rsvp") {
      return handleRSVP(req);
    }
    
    return addParticipants(req, authContext);
  },
  { allowGuest: true } // Allow guest for RSVP
);
export const GET = withAuth(getParticipants, { allowGuest: true });
export const PATCH = withAuth(updateParticipant, { requireAuth: true });
export const DELETE = withAuth(removeParticipant, { requireAuth: true });