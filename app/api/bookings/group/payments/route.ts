/**
 * Group Booking Split Payments API
 * 
 * Handles split payment processing for group bookings including:
 * - Individual payment collection
 * - Payment tracking and reconciliation
 * - Stripe Connect integration for split transfers
 * - Refund processing
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/db";
import {
  groupBookingsTable,
  groupParticipantsTable,
  splitPaymentSessionsTable,
  groupActivitiesTable,
  NewSplitPaymentSession
} from "@/db/schema/group-bookings-schema";
import { bookingsTable } from "@/db/schema/bookings-schema";
import { providersTable } from "@/db/schema/providers-schema";
import { paymentsTable } from "@/db/schema/payments-schema";
import { withAuth, AuthContext } from "@/lib/auth/route-protection";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";
import { calculateFees } from "@/lib/payments/fee-calculator";
import { eq, and, gte } from "drizzle-orm";
import { nanoid } from "nanoid";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Validation schemas
const createPaymentSessionSchema = z.object({
  groupBookingId: z.string().uuid(),
  participantIds: z.array(z.string().uuid()).optional(), // If not provided, create for all unpaid
  expiresInHours: z.number().min(1).max(168).default(48), // Default 48 hours, max 1 week
});

const processPaymentSchema = z.object({
  sessionToken: z.string().optional(),
  participantId: z.string().uuid().optional(),
  invitationToken: z.string().optional(),
  paymentMethodId: z.string(), // Stripe payment method ID
  savePaymentMethod: z.boolean().default(false),
});

const refundPaymentSchema = z.object({
  participantId: z.string().uuid(),
  amount: z.number().positive().optional(), // Partial refund amount in cents
  reason: z.string().optional(),
});

/**
 * POST /api/bookings/group/payments/session - Create a payment session for split payments
 */
async function createPaymentSession(req: NextRequest, authContext: AuthContext) {
  try {
    const body = await req.json();
    const validatedData = createPaymentSessionSchema.parse(body);

    // Get group booking
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
        { error: "Only organizers can create payment sessions" },
        { status: 403 }
      );
    }

    // Check if booking is in correct state
    if (groupBooking[0].status === "cancelled" || groupBooking[0].status === "completed") {
      return NextResponse.json(
        { error: "Cannot create payment session for cancelled or completed bookings" },
        { status: 400 }
      );
    }

    // Get participants who need to pay
    let participants;
    if (validatedData.participantIds?.length) {
      participants = await db
        .select()
        .from(groupParticipantsTable)
        .where(and(
          eq(groupParticipantsTable.groupBookingId, validatedData.groupBookingId),
          groupParticipantsTable.id.in(validatedData.participantIds)
        ));
    } else {
      // Get all unpaid participants
      participants = await db
        .select()
        .from(groupParticipantsTable)
        .where(and(
          eq(groupParticipantsTable.groupBookingId, validatedData.groupBookingId),
          eq(groupParticipantsTable.status, "accepted"),
          gte(groupParticipantsTable.amountCents, 1)
        ));
    }

    const unpaidParticipants = participants.filter(
      p => p.amountCents > p.paidAmountCents
    );

    if (!unpaidParticipants.length) {
      return NextResponse.json(
        { error: "No unpaid participants found" },
        { status: 400 }
      );
    }

    // Calculate total amounts
    const totalAmountCents = unpaidParticipants.reduce(
      (sum, p) => sum + (p.amountCents - p.paidAmountCents), 
      0
    );

    // Create payment session
    const sessionToken = nanoid(32);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + validatedData.expiresInHours);

    const paymentSession = await db
      .insert(splitPaymentSessionsTable)
      .values({
        groupBookingId: validatedData.groupBookingId,
        sessionToken,
        totalAmountCents,
        collectedAmountCents: 0,
        remainingAmountCents: totalAmountCents,
        totalParticipants: unpaidParticipants.length,
        paidParticipants: 0,
        status: "active",
        expiresAt,
        paymentSplits: unpaidParticipants.map(p => ({
          participantId: p.id,
          email: p.email,
          name: p.name,
          amountCents: p.amountCents - p.paidAmountCents,
          paid: false
        }))
      })
      .returning();

    // Send payment reminders to participants
    for (const participant of unpaidParticipants) {
      await sendPaymentReminder(groupBooking[0], participant, sessionToken);
      
      // Update reminder count
      await db
        .update(groupParticipantsTable)
        .set({
          paymentRemindersSent: participant.paymentRemindersSent + 1,
          lastReminderAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(groupParticipantsTable.id, participant.id));
    }

    // Log activity
    await db.insert(groupActivitiesTable).values({
      groupBookingId: validatedData.groupBookingId,
      activityType: "payment_session_created",
      actorId: authContext.userId!,
      actorType: "organizer",
      description: `Payment session created for ${unpaidParticipants.length} participants`,
      details: {
        totalAmount: totalAmountCents / 100,
        participants: unpaidParticipants.length,
        expiresAt
      }
    });

    return NextResponse.json({
      session: paymentSession[0],
      paymentUrl: `${process.env.NEXT_PUBLIC_APP_URL}/group-booking/payment/${sessionToken}`,
      participants: unpaidParticipants.length,
      totalAmount: totalAmountCents / 100
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid session data", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error creating payment session:", error);
    return NextResponse.json(
      { error: "Failed to create payment session" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bookings/group/payments/process - Process a payment for a participant
 */
async function processPayment(req: NextRequest, authContext: AuthContext) {
  try {
    const body = await req.json();
    const validatedData = processPaymentSchema.parse(body);

    // Find participant
    let participant;
    if (validatedData.participantId) {
      participant = await db
        .select()
        .from(groupParticipantsTable)
        .where(eq(groupParticipantsTable.id, validatedData.participantId))
        .limit(1);
    } else if (validatedData.invitationToken) {
      participant = await db
        .select()
        .from(groupParticipantsTable)
        .where(eq(groupParticipantsTable.invitationToken, validatedData.invitationToken))
        .limit(1);
    } else {
      return NextResponse.json(
        { error: "Participant ID or invitation token required" },
        { status: 400 }
      );
    }

    if (!participant.length) {
      return NextResponse.json(
        { error: "Participant not found" },
        { status: 404 }
      );
    }

    // Check if already paid
    if (participant[0].paidAmountCents >= participant[0].amountCents) {
      return NextResponse.json(
        { error: "Payment already completed" },
        { status: 400 }
      );
    }

    // Get group booking and provider
    const groupBooking = await db
      .select({
        groupBooking: groupBookingsTable,
        booking: bookingsTable,
        provider: providersTable
      })
      .from(groupBookingsTable)
      .innerJoin(bookingsTable, eq(groupBookingsTable.bookingId, bookingsTable.id))
      .innerJoin(providersTable, eq(bookingsTable.providerId, providersTable.id))
      .where(eq(groupBookingsTable.id, participant[0].groupBookingId))
      .limit(1);

    if (!groupBooking.length) {
      return NextResponse.json(
        { error: "Group booking not found" },
        { status: 404 }
      );
    }

    const amountToPayCents = participant[0].amountCents - participant[0].paidAmountCents;

    // Calculate fees for this participant's payment
    const feeCalculation = calculateFees({
      baseAmountCents: amountToPayCents,
      isGuest: false // Group bookings require authentication
    });

    // Create Stripe payment intent
    let paymentIntent;
    if (groupBooking[0].provider.stripeAccountId) {
      // Use Stripe Connect for provider payments
      paymentIntent = await stripe.paymentIntents.create({
        amount: amountToPayCents,
        currency: "usd",
        payment_method: validatedData.paymentMethodId,
        confirm: true,
        application_fee_amount: feeCalculation.platformFeeCents,
        transfer_data: {
          destination: groupBooking[0].provider.stripeAccountId,
        },
        metadata: {
          type: "group_booking_payment",
          groupBookingId: participant[0].groupBookingId,
          participantId: participant[0].id,
          participantEmail: participant[0].email,
        },
      });
    } else {
      // Standard payment without Connect
      paymentIntent = await stripe.paymentIntents.create({
        amount: amountToPayCents,
        currency: "usd",
        payment_method: validatedData.paymentMethodId,
        confirm: true,
        metadata: {
          type: "group_booking_payment",
          groupBookingId: participant[0].groupBookingId,
          participantId: participant[0].id,
          participantEmail: participant[0].email,
        },
      });
    }

    // Start transaction to update payment records
    const result = await db.transaction(async (tx) => {
      // Update participant payment status
      const updatedParticipant = await tx
        .update(groupParticipantsTable)
        .set({
          paidAmountCents: participant[0].paidAmountCents + amountToPayCents,
          stripePaymentIntentId: paymentIntent.id,
          status: "paid",
          paidAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(groupParticipantsTable.id, participant[0].id))
        .returning();

      // Update group booking totals
      await tx
        .update(groupBookingsTable)
        .set({
          collectedAmountCents: groupBooking[0].groupBooking.collectedAmountCents + amountToPayCents,
          updatedAt: new Date()
        })
        .where(eq(groupBookingsTable.id, participant[0].groupBookingId));

      // Create payment record
      await tx.insert(paymentsTable).values({
        bookingId: groupBooking[0].booking.id,
        userId: participant[0].userId || authContext.userId,
        stripePaymentIntentId: paymentIntent.id,
        amountCents: amountToPayCents,
        currency: "usd",
        status: "succeeded",
        platformFeeCents: feeCalculation.platformFeeCents,
        providerPayoutCents: feeCalculation.providerPayoutCents,
        metadata: {
          groupBookingId: participant[0].groupBookingId,
          participantId: participant[0].id,
          participantEmail: participant[0].email
        }
      });

      // Update payment session if exists
      if (validatedData.sessionToken) {
        const session = await tx
          .select()
          .from(splitPaymentSessionsTable)
          .where(eq(splitPaymentSessionsTable.sessionToken, validatedData.sessionToken))
          .limit(1);

        if (session.length) {
          const updatedSplits = session[0].paymentSplits.map((split: any) => {
            if (split.participantId === participant[0].id) {
              return { ...split, paid: true };
            }
            return split;
          });

          await tx
            .update(splitPaymentSessionsTable)
            .set({
              collectedAmountCents: session[0].collectedAmountCents + amountToPayCents,
              remainingAmountCents: session[0].remainingAmountCents - amountToPayCents,
              paidParticipants: session[0].paidParticipants + 1,
              paymentSplits: updatedSplits,
              status: session[0].remainingAmountCents - amountToPayCents <= 0 ? "completed" : "active",
              completedAt: session[0].remainingAmountCents - amountToPayCents <= 0 ? new Date() : null,
              updatedAt: new Date()
            })
            .where(eq(splitPaymentSessionsTable.sessionToken, validatedData.sessionToken));
        }
      }

      // Log activity
      await tx.insert(groupActivitiesTable).values({
        groupBookingId: participant[0].groupBookingId,
        activityType: "payment_received",
        participantId: participant[0].id,
        actorId: authContext.userId,
        actorType: "participant",
        description: `Payment received from ${participant[0].email}`,
        details: {
          amount: amountToPayCents / 100,
          paymentIntentId: paymentIntent.id
        }
      });

      return updatedParticipant[0];
    });

    // Send payment confirmation
    await sendPaymentConfirmation(groupBooking[0].groupBooking, result, amountToPayCents);

    // Check if all payments collected
    const allParticipants = await db
      .select()
      .from(groupParticipantsTable)
      .where(eq(groupParticipantsTable.groupBookingId, participant[0].groupBookingId));

    const totalOwed = allParticipants.reduce((sum, p) => sum + p.amountCents, 0);
    const totalPaid = allParticipants.reduce((sum, p) => sum + p.paidAmountCents, 0) + amountToPayCents;

    if (totalPaid >= totalOwed) {
      // All payments collected, update booking status
      await db
        .update(groupBookingsTable)
        .set({
          status: "confirmed",
          confirmedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(groupBookingsTable.id, participant[0].groupBookingId));

      await db
        .update(bookingsTable)
        .set({
          status: "confirmed",
          updatedAt: new Date()
        })
        .where(eq(bookingsTable.id, groupBooking[0].booking.id));

      // Notify organizer
      await notifyOrganizerOfFullPayment(groupBooking[0].groupBooking);
    }

    return NextResponse.json({
      success: true,
      participant: result,
      paymentIntent: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100
      },
      allPaymentsCollected: totalPaid >= totalOwed
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid payment data", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error processing payment:", error);
    return NextResponse.json(
      { error: "Failed to process payment" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bookings/group/payments/refund - Process a refund
 */
async function processRefund(req: NextRequest, authContext: AuthContext) {
  try {
    const body = await req.json();
    const validatedData = refundPaymentSchema.parse(body);

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

    if (authContext.role !== "admin" && groupBooking[0].organizerId !== authContext.userId) {
      return NextResponse.json(
        { error: "Only organizers can process refunds" },
        { status: 403 }
      );
    }

    // Check if participant has paid
    if (participant[0].paidAmountCents === 0) {
      return NextResponse.json(
        { error: "No payment to refund" },
        { status: 400 }
      );
    }

    // Calculate refund amount
    const refundAmountCents = validatedData.amount || 
      (participant[0].paidAmountCents - participant[0].refundedAmountCents);

    if (refundAmountCents > (participant[0].paidAmountCents - participant[0].refundedAmountCents)) {
      return NextResponse.json(
        { error: "Refund amount exceeds paid amount" },
        { status: 400 }
      );
    }

    // Process Stripe refund
    let refund;
    if (participant[0].stripePaymentIntentId) {
      refund = await stripe.refunds.create({
        payment_intent: participant[0].stripePaymentIntentId,
        amount: refundAmountCents,
        reason: "requested_by_customer",
        metadata: {
          participantId: participant[0].id,
          reason: validatedData.reason
        }
      });
    } else {
      return NextResponse.json(
        { error: "No payment intent found for refund" },
        { status: 400 }
      );
    }

    // Update records
    const result = await db.transaction(async (tx) => {
      // Update participant
      const isFullRefund = refundAmountCents === participant[0].paidAmountCents;
      const updatedParticipant = await tx
        .update(groupParticipantsTable)
        .set({
          refundedAmountCents: participant[0].refundedAmountCents + refundAmountCents,
          stripeRefundId: refund.id,
          status: isFullRefund ? "refunded" : participant[0].status,
          updatedAt: new Date()
        })
        .where(eq(groupParticipantsTable.id, participant[0].id))
        .returning();

      // Update group booking totals
      await tx
        .update(groupBookingsTable)
        .set({
          refundedAmountCents: groupBooking[0].refundedAmountCents + refundAmountCents,
          collectedAmountCents: Math.max(0, groupBooking[0].collectedAmountCents - refundAmountCents),
          updatedAt: new Date()
        })
        .where(eq(groupBookingsTable.id, participant[0].groupBookingId));

      // Log activity
      await tx.insert(groupActivitiesTable).values({
        groupBookingId: participant[0].groupBookingId,
        activityType: "refund_processed",
        participantId: participant[0].id,
        actorId: authContext.userId!,
        actorType: "organizer",
        description: `Refund processed for ${participant[0].email}`,
        details: {
          amount: refundAmountCents / 100,
          reason: validatedData.reason,
          refundId: refund.id
        }
      });

      return updatedParticipant[0];
    });

    // Send refund confirmation
    await sendRefundConfirmation(groupBooking[0], result, refundAmountCents, validatedData.reason);

    return NextResponse.json({
      success: true,
      participant: result,
      refund: {
        id: refund.id,
        amount: refund.amount / 100,
        status: refund.status
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid refund data", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error processing refund:", error);
    return NextResponse.json(
      { error: "Failed to process refund" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/bookings/group/payments - Get payment status and history
 */
async function getPaymentStatus(req: NextRequest, authContext: AuthContext) {
  try {
    const { searchParams } = new URL(req.url);
    const groupBookingId = searchParams.get("groupBookingId");
    const sessionToken = searchParams.get("sessionToken");
    const participantId = searchParams.get("participantId");

    // Get payment session by token
    if (sessionToken) {
      const session = await db
        .select()
        .from(splitPaymentSessionsTable)
        .where(eq(splitPaymentSessionsTable.sessionToken, sessionToken))
        .limit(1);

      if (!session.length) {
        return NextResponse.json(
          { error: "Payment session not found" },
          { status: 404 }
        );
      }

      // Check if session is expired
      if (new Date() > session[0].expiresAt) {
        await db
          .update(splitPaymentSessionsTable)
          .set({ status: "expired" })
          .where(eq(splitPaymentSessionsTable.sessionToken, sessionToken));

        return NextResponse.json(
          { error: "Payment session expired" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        session: session[0],
        isExpired: false,
        timeRemaining: Math.floor((session[0].expiresAt.getTime() - Date.now()) / 1000)
      });
    }

    // Get payment status for specific participant
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

      return NextResponse.json({
        participant: participant[0],
        paymentStatus: {
          isPaid: participant[0].paidAmountCents >= participant[0].amountCents,
          amountOwed: participant[0].amountCents - participant[0].paidAmountCents,
          amountPaid: participant[0].paidAmountCents,
          amountRefunded: participant[0].refundedAmountCents
        }
      });
    }

    // Get overall payment status for group booking
    if (!groupBookingId) {
      return NextResponse.json(
        { error: "Group booking ID required" },
        { status: 400 }
      );
    }

    // Verify access
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
      // Check if user is a participant
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

      if (!participant.length) {
        return NextResponse.json(
          { error: "Access denied" },
          { status: 403 }
        );
      }

      // Return limited info for participants
      return NextResponse.json({
        groupBooking: {
          totalAmountCents: groupBooking[0].totalAmountCents,
          collectedAmountCents: groupBooking[0].collectedAmountCents,
          paymentMethod: groupBooking[0].paymentMethod
        },
        myPayment: {
          amountOwed: participant[0].amountCents,
          amountPaid: participant[0].paidAmountCents,
          status: participant[0].status
        }
      });
    }

    // Get all participants for organizer/admin
    const participants = await db
      .select()
      .from(groupParticipantsTable)
      .where(eq(groupParticipantsTable.groupBookingId, groupBookingId));

    // Get active payment sessions
    const sessions = await db
      .select()
      .from(splitPaymentSessionsTable)
      .where(and(
        eq(splitPaymentSessionsTable.groupBookingId, groupBookingId),
        eq(splitPaymentSessionsTable.status, "active")
      ));

    // Calculate totals
    const totalOwed = participants.reduce((sum, p) => sum + p.amountCents, 0);
    const totalPaid = participants.reduce((sum, p) => sum + p.paidAmountCents, 0);
    const totalRefunded = participants.reduce((sum, p) => sum + p.refundedAmountCents, 0);

    const paymentBreakdown = {
      byStatus: {
        invited: participants.filter(p => p.status === "invited").length,
        accepted: participants.filter(p => p.status === "accepted").length,
        paid: participants.filter(p => p.status === "paid").length,
        refunded: participants.filter(p => p.status === "refunded").length,
      },
      byAmount: {
        totalOwed: totalOwed / 100,
        totalPaid: totalPaid / 100,
        totalRefunded: totalRefunded / 100,
        totalRemaining: (totalOwed - totalPaid) / 100
      },
      participants: participants.map(p => ({
        id: p.id,
        email: p.email,
        name: p.name,
        status: p.status,
        amountOwed: p.amountCents / 100,
        amountPaid: p.paidAmountCents / 100,
        amountRefunded: p.refundedAmountCents / 100,
        paidAt: p.paidAt,
        paymentIntentId: p.stripePaymentIntentId
      }))
    };

    return NextResponse.json({
      groupBooking: groupBooking[0],
      paymentBreakdown,
      activeSessions: sessions
    });
  } catch (error) {
    console.error("Error fetching payment status:", error);
    return NextResponse.json(
      { error: "Failed to fetch payment status" },
      { status: 500 }
    );
  }
}

// Helper functions

async function sendPaymentReminder(groupBooking: any, participant: any, sessionToken: string) {
  const paymentUrl = `${process.env.NEXT_PUBLIC_APP_URL}/group-booking/payment/${sessionToken}?participant=${participant.id}`;
  
  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: participant.email,
      subject: `Payment Reminder: ${groupBooking.groupName || "Group Booking"}`,
      html: `
        <h2>Payment Reminder</h2>
        <p>This is a reminder that your payment for ${groupBooking.groupName || "the group booking"} is due.</p>
        
        <p><strong>Amount Due:</strong> $${((participant.amountCents - participant.paidAmountCents) / 100).toFixed(2)}</p>
        ${groupBooking.paymentDeadline ? `<p><strong>Payment Deadline:</strong> ${new Date(groupBooking.paymentDeadline).toLocaleDateString()}</p>` : ""}
        
        <p>
          <a href="${paymentUrl}" style="display: inline-block; padding: 12px 24px; background-color: #28a745; color: white; text-decoration: none; border-radius: 4px;">
            Make Payment
          </a>
        </p>
        
        <p><small>If you have already paid, please disregard this message.</small></p>
      `
    });
  } catch (error) {
    console.error(`Failed to send payment reminder to ${participant.email}:`, error);
  }
}

async function sendPaymentConfirmation(groupBooking: any, participant: any, amountCents: number) {
  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: participant.email,
      subject: `Payment Confirmed: ${groupBooking.groupName || "Group Booking"}`,
      html: `
        <h2>Payment Confirmed</h2>
        <p>Thank you! Your payment for ${groupBooking.groupName || "the group booking"} has been received.</p>
        
        <p><strong>Amount Paid:</strong> $${(amountCents / 100).toFixed(2)}</p>
        <p><strong>Payment Date:</strong> ${new Date().toLocaleDateString()}</p>
        
        <p>You're all set! We look forward to seeing you.</p>
        
        <p><small>Payment ID: ${participant.stripePaymentIntentId}</small></p>
      `
    });
  } catch (error) {
    console.error(`Failed to send payment confirmation to ${participant.email}:`, error);
  }
}

async function sendRefundConfirmation(groupBooking: any, participant: any, amountCents: number, reason?: string) {
  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: participant.email,
      subject: `Refund Processed: ${groupBooking.groupName || "Group Booking"}`,
      html: `
        <h2>Refund Processed</h2>
        <p>A refund has been processed for ${groupBooking.groupName || "the group booking"}.</p>
        
        <p><strong>Refund Amount:</strong> $${(amountCents / 100).toFixed(2)}</p>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
        
        <p>The refund should appear in your account within 5-7 business days.</p>
        
        <p><small>Refund ID: ${participant.stripeRefundId}</small></p>
      `
    });
  } catch (error) {
    console.error(`Failed to send refund confirmation to ${participant.email}:`, error);
  }
}

async function notifyOrganizerOfFullPayment(groupBooking: any) {
  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: groupBooking.organizerEmail,
      subject: `All Payments Collected: ${groupBooking.groupName || "Group Booking"}`,
      html: `
        <h2>All Payments Collected!</h2>
        <p>Great news! All payments have been collected for ${groupBooking.groupName || "your group booking"}.</p>
        
        <p><strong>Total Collected:</strong> $${(groupBooking.totalAmountCents / 100).toFixed(2)}</p>
        <p><strong>Participants Paid:</strong> ${groupBooking.confirmedParticipants}</p>
        
        <p>The booking is now confirmed and ready to proceed.</p>
        
        <p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/bookings/${groupBooking.id}" 
             style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">
            View Booking Details
          </a>
        </p>
      `
    });
  } catch (error) {
    console.error(`Failed to notify organizer at ${groupBooking.organizerEmail}:`, error);
  }
}

// Route handlers
export const POST = withAuth(
  async (req: NextRequest, authContext: AuthContext) => {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    switch (action) {
      case "session":
        return createPaymentSession(req, authContext);
      case "process":
        return processPayment(req, authContext);
      case "refund":
        return processRefund(req, authContext);
      default:
        return NextResponse.json(
          { error: "Invalid action. Use ?action=session|process|refund" },
          { status: 400 }
        );
    }
  },
  { requireAuth: true }
);

export const GET = withAuth(getPaymentStatus, { allowGuest: true });