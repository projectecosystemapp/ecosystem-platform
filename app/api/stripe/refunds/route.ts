import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/db/db";
import { bookingsTable, transactionsTable } from "@/db/schema/bookings-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq, and } from "drizzle-orm";
import { withRateLimitRedis } from "@/lib/rate-limit-redis";
import crypto from "crypto";

interface RefundRequest {
  bookingId: string;
  amount?: number; // Optional for partial refunds (in dollars)
  reason?: string;
}

// Generate idempotency key for refund operation
const generateIdempotencyKey = (bookingId: string, amount?: number) => {
  const timestamp = Date.now();
  const data = `refund-${bookingId}-${amount || 'full'}-${timestamp}`;
  return crypto.createHash('sha256').update(data).digest('hex');
};

export const POST = withRateLimitRedis(
  { type: "payment" },
  async (req: NextRequest) => {
    try {
      const { userId } = auth();
      
      if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const body: RefundRequest = await req.json();
      const { bookingId, amount, reason } = body;

      if (!bookingId) {
        return NextResponse.json({ error: "Booking ID required" }, { status: 400 });
      }

      // Start database transaction
      const result = await db.transaction(async (tx) => {
        // Fetch booking with transaction details
        const [bookingData] = await tx
          .select({
            booking: bookingsTable,
            transaction: transactionsTable,
            customer: profilesTable,
          })
          .from(bookingsTable)
          .leftJoin(transactionsTable, eq(bookingsTable.id, transactionsTable.bookingId))
          .leftJoin(profilesTable, eq(bookingsTable.customerId, profilesTable.userId))
          .where(eq(bookingsTable.id, bookingId))
          .limit(1);

        if (!bookingData || !bookingData.booking) {
          throw new Error("Booking not found");
        }

        const { booking, transaction, customer } = bookingData;

        // Verify authorization - allow customer or admin/support roles
        const isCustomer = booking.customerId === userId;
        const isAdmin = await checkAdminRole(userId); // Implement based on your RBAC
        
        if (!isCustomer && !isAdmin) {
          throw new Error("Not authorized to refund this booking");
        }

        // Validate booking status
        if (!["confirmed", "completed"].includes(booking.status)) {
          throw new Error(`Cannot refund booking with status: ${booking.status}`);
        }

        // Check if already refunded
        if (transaction?.status === "refunded") {
          throw new Error("Booking has already been refunded");
        }

        if (!booking.stripePaymentIntentId) {
          throw new Error("No payment found for this booking");
        }

        // Calculate refund amount
        const totalAmountCents = Math.round(parseFloat(booking.totalAmount) * 100);
        const refundAmountCents = amount 
          ? Math.round(amount * 100) 
          : totalAmountCents;

        // Validate refund amount
        if (refundAmountCents > totalAmountCents) {
          throw new Error("Refund amount cannot exceed original payment");
        }

        if (refundAmountCents <= 0) {
          throw new Error("Invalid refund amount");
        }

        // Calculate platform fee reversal
        const platformFeeRate = customer?.stripeCustomerId ? 0.10 : 0.20; // 10% for logged-in, 20% for guests
        const platformFeeReversalCents = Math.round(refundAmountCents * platformFeeRate);
        const providerRefundCents = refundAmountCents - platformFeeReversalCents;

        // Generate idempotency key
        const idempotencyKey = generateIdempotencyKey(bookingId, amount);

        // Process refund through Stripe
        const refund = await stripe.refunds.create({
          payment_intent: booking.stripePaymentIntentId,
          amount: refundAmountCents,
          reason: mapRefundReason(reason),
          metadata: {
            bookingId: booking.id,
            customerId: booking.customerId,
            providerId: booking.providerId,
            platformFeeReversal: platformFeeReversalCents.toString(),
            providerRefund: providerRefundCents.toString(),
            refundReason: reason || "customer_requested",
          },
          // Reverse the application fee proportionally
          refund_application_fee: true,
        }, {
          idempotencyKey: idempotencyKey,
        });

        // Update booking status
        const isFullRefund = refundAmountCents === totalAmountCents;
        await tx
          .update(bookingsTable)
          .set({
            status: isFullRefund ? "cancelled" : booking.status,
            cancellationReason: reason || "Customer requested refund",
            cancelledBy: userId,
            cancelledAt: isFullRefund ? new Date() : booking.cancelledAt,
            updatedAt: new Date(),
          })
          .where(eq(bookingsTable.id, bookingId));

        // Create or update transaction record
        if (transaction) {
          await tx
            .update(transactionsTable)
            .set({
              stripeRefundId: refund.id,
              status: isFullRefund ? "refunded" : "completed",
              processedAt: new Date(),
            })
            .where(eq(transactionsTable.id, transaction.id));
        } else {
          // Create new transaction record if it doesn't exist
          await tx.insert(transactionsTable).values({
            bookingId: booking.id,
            stripeChargeId: refund.charge as string,
            stripeRefundId: refund.id,
            amount: (refundAmountCents / 100).toFixed(2),
            platformFee: (platformFeeReversalCents / 100).toFixed(2),
            providerPayout: (providerRefundCents / 100).toFixed(2),
            status: "refunded",
            processedAt: new Date(),
          });
        }

        // Send notifications (implement based on your notification system)
        await sendRefundNotifications({
          booking,
          refundAmount: refundAmountCents / 100,
          isFullRefund,
          reason: reason || "Customer requested refund",
        });

        return {
          refundId: refund.id,
          amount: refundAmountCents / 100,
          status: refund.status,
          isFullRefund,
          platformFeeReversed: platformFeeReversalCents / 100,
          providerRefund: providerRefundCents / 100,
        };
      });

      return NextResponse.json({
        success: true,
        refund: result,
      });

    } catch (error: any) {
      console.error("Error processing refund:", error);
      
      // Handle specific Stripe errors
      if (error.type === 'StripeCardError') {
        return NextResponse.json(
          { error: "Card error during refund", details: error.message },
          { status: 400 }
        );
      }
      
      if (error.type === 'StripeInvalidRequestError') {
        return NextResponse.json(
          { error: "Invalid refund request", details: error.message },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: error.message || "Failed to process refund" },
        { status: error.message?.includes("not found") ? 404 : 
                  error.message?.includes("Not authorized") ? 403 : 500 }
      );
    }
  }
);

// Helper function to map refund reasons to Stripe's accepted values
function mapRefundReason(reason?: string): "duplicate" | "fraudulent" | "requested_by_customer" | undefined {
  if (!reason) return "requested_by_customer";
  
  const lowerReason = reason.toLowerCase();
  if (lowerReason.includes("fraud")) return "fraudulent";
  if (lowerReason.includes("duplicate")) return "duplicate";
  return "requested_by_customer";
}

// Helper function to check admin role (implement based on your RBAC system)
async function checkAdminRole(userId: string): Promise<boolean> {
  // TODO: Implement based on your RBAC system
  // For now, return false - only customers can refund their own bookings
  return false;
}

// Helper function to send refund notifications
async function sendRefundNotifications(params: {
  booking: any;
  refundAmount: number;
  isFullRefund: boolean;
  reason: string;
}) {
  // TODO: Implement your notification system
  // This could be email, SMS, in-app notifications, etc.
  console.log("Sending refund notifications:", params);
  
  // Example structure:
  // - Send email to customer confirming refund
  // - Send email to provider notifying them of the refund
  // - Create in-app notification for both parties
  // - Log the refund event for audit purposes
}