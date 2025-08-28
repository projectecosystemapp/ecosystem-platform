import { NextRequest, NextResponse } from "next/server";
import { getThingById, markThingAsSold, reserveThing } from "@/db/queries/things-queries";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { createSecureApiHandler, createApiResponse, createApiError, getValidatedBody } from "@/lib/security/api-handler";
import { db } from "@/db/db";
import { profilesTable } from "@/db/schema/profiles-schema";
import { bookingsTable } from "@/db/schema/bookings-schema";
import { paymentsTable } from "@/db/schema/payments-schema";
import { thingsTable } from "@/db/schema/things-schema";
import { eq } from "drizzle-orm";
import { stripe } from "@/lib/stripe";
import { calculateFees } from "@/lib/fees";
import { sendEmail } from "@/lib/sendgrid/email-service";

/**
 * Thing Purchase API
 * POST /api/things/[id]/purchase - Direct purchase (buy now)
 */

// Purchase schema
const purchaseSchema = z.object({
  shippingAddress: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(2).max(2),
    zipCode: z.string().min(5).max(10),
    country: z.string().default("US"),
  }).optional(),
  deliveryMethod: z.enum(["shipping", "pickup"]),
  pickupSchedule: z.object({
    date: z.string(),
    time: z.string(),
    notes: z.string().optional(),
  }).optional(),
  buyerNotes: z.string().max(500).optional(),
}).refine(data => {
  // If delivery method is shipping, address is required
  if (data.deliveryMethod === "shipping" && !data.shippingAddress) {
    throw new Error("Shipping address is required for shipping");
  }
  // If delivery method is pickup, schedule is required
  if (data.deliveryMethod === "pickup" && !data.pickupSchedule) {
    throw new Error("Pickup schedule is required for local pickup");
  }
  return true;
});

/**
 * POST handler - Direct purchase of a thing
 */
async function handlePurchaseThing(req: NextRequest, context: { userId?: string | null; params?: Record<string, string>; searchParams?: URLSearchParams }) {
  try {
    const { userId, params } = context;
    const thingId = params?.id;

    if (!userId) {
      return createApiError("Authentication required", { status: 401 });
    }

    if (!thingId) {
      return createApiError("Thing ID is required", { status: 400 });
    }

    const body = getValidatedBody<z.infer<typeof purchaseSchema>>(req);
    
    if (!body) {
      return createApiError("Invalid request body", { status: 400 });
    }
    
    // Get the thing
    const thing = await getThingById(thingId);
    
    if (!thing) {
      return createApiError("Thing not found", { status: 404 });
    }
    
    if (thing.status !== "active") {
      return createApiError("This item is no longer available for purchase", { 
        status: 400,
        code: "ITEM_NOT_AVAILABLE"
      });
    }
    
    if (thing.quantity < 1) {
      return createApiError("This item is out of stock", { 
        status: 400,
        code: "OUT_OF_STOCK"
      });
    }
    
    // Can't buy your own item
    if (thing.sellerId === userId) {
      return createApiError("You cannot purchase your own listing", { 
        status: 400,
        code: "OWN_LISTING"
      });
    }
    
    // Validate delivery method
    if (body.deliveryMethod === "shipping" && !thing.shippingAvailable) {
      return createApiError("Shipping is not available for this item", { 
        status: 400,
        code: "SHIPPING_NOT_AVAILABLE"
      });
    }
    
    if (body.deliveryMethod === "pickup" && !thing.localPickupOnly && !thing.shippingAvailable) {
      return createApiError("Local pickup is not available for this item", { 
        status: 400,
        code: "PICKUP_NOT_AVAILABLE"
      });
    }
    
    // Get buyer's profile
    const [buyerProfile] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, userId))
      .limit(1);
    
    if (!buyerProfile) {
      return createApiError("Please complete your profile before making purchases", { 
        status: 403,
        code: "PROFILE_REQUIRED"
      });
    }
    
    // Calculate total amount (item price + shipping if applicable)
    const itemPrice = Number(thing.price);
    const shippingCost = body.deliveryMethod === "shipping" && thing.shippingCost 
      ? Number(thing.shippingCost) 
      : 0;
    const subtotal = itemPrice + shippingCost;
    
    // Calculate platform fees (10% commission)
    const fees = calculateFees(subtotal, false); // Not a guest purchase
    
    // Reserve the item immediately
    await reserveThing(thingId);
    
    try {
      // Create Stripe payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(fees.totalAmount * 100), // Convert to cents
        currency: thing.currency || 'usd',
        metadata: {
          type: 'thing_purchase',
          thingId: thingId,
          buyerId: userId,
          sellerId: thing.sellerId,
          itemPrice: itemPrice.toString(),
          shippingCost: shippingCost.toString(),
          platformFee: fees.platformFee.toString(),
          providerPayout: fees.providerPayout.toString(),
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });
      
      // Create booking record for the purchase
      const now = new Date();
      const [booking] = await db
        .insert(bookingsTable)
        .values({
          customerId: userId,
          providerId: thing.sellerId,
          bookingType: 'service', // Using 'service' for marketplace purchases
          status: 'PAYMENT_PENDING',
          
          // Required booking fields
          serviceName: thing.title,
          servicePrice: fees.providerPayout.toString(), // Base price provider receives
          serviceDuration: 0, // Instant purchase, no duration
          bookingDate: now,
          startTime: now.toTimeString().slice(0, 5), // Format: "HH:MM"
          endTime: now.toTimeString().slice(0, 5), // Same as start for instant purchase
          
          // Payment fields
          stripePaymentIntentId: paymentIntent.id,
          totalAmount: fees.totalAmount.toString(),
          platformFee: fees.platformFee.toString(),
          providerPayout: fees.providerPayout.toString(),
          
          // Additional info
          isGuestBooking: false,
          
          // Metadata with all thing purchase details
          metadata: {
            thingId: thingId,
            thingTitle: thing.title,
            deliveryMethod: body.deliveryMethod,
            shippingAddress: body.shippingAddress,
            pickupSchedule: body.pickupSchedule,
            buyerNotes: body.buyerNotes,
            itemPrice: itemPrice,
            shippingCost: shippingCost,
            purchaseType: 'marketplace_thing',
          },
        })
        .returning();
      
      // Create payment record
      await db
        .insert(paymentsTable)
        .values({
          bookingId: booking.id,
          userId: userId,
          amountCents: Math.round(fees.totalAmount * 100),
          currency: thing.currency || 'usd',
          platformFeeCents: Math.round(fees.platformFee * 100),
          providerPayoutCents: Math.round(fees.providerPayout * 100),
          status: 'pending',
          stripePaymentIntentId: paymentIntent.id,
        });
      
      // Send notification email to seller
      if (thing.contactEmail) {
        const emailSubject = `Item "${thing.title}" has been sold!`;
        const emailBody = `
          <h2>Congratulations! Your item has been sold.</h2>
          <p><strong>Item:</strong> ${thing.title}</p>
          <p><strong>Price:</strong> $${itemPrice}</p>
          ${shippingCost > 0 ? `<p><strong>Shipping:</strong> $${shippingCost}</p>` : ''}
          <p><strong>Total:</strong> $${subtotal}</p>
          <p><strong>Your Payout:</strong> $${fees.providerPayout.toFixed(2)} (after platform fee)</p>
          <hr>
          <p><strong>Buyer:</strong> ${buyerProfile.email || 'Anonymous User'}</p>
          <p><strong>Delivery Method:</strong> ${body.deliveryMethod}</p>
          ${body.deliveryMethod === 'shipping' && body.shippingAddress ? `
            <p><strong>Ship to:</strong><br>
            ${body.shippingAddress.street}<br>
            ${body.shippingAddress.city}, ${body.shippingAddress.state} ${body.shippingAddress.zipCode}
            </p>
          ` : ''}
          ${body.deliveryMethod === 'pickup' && body.pickupSchedule ? `
            <p><strong>Pickup Schedule:</strong><br>
            Date: ${body.pickupSchedule.date}<br>
            Time: ${body.pickupSchedule.time}
            ${body.pickupSchedule.notes ? `<br>Notes: ${body.pickupSchedule.notes}` : ''}
            </p>
          ` : ''}
          ${body.buyerNotes ? `<p><strong>Buyer Notes:</strong> ${body.buyerNotes}</p>` : ''}
          <hr>
          <p>The payment is being processed. You'll receive your payout once the transaction is complete.</p>
        `;
        
        try {
          await sendEmail({
            to: thing.contactEmail,
            subject: emailSubject,
            html: emailBody,
          });
        } catch (emailError) {
          console.error("Failed to send sale notification email:", emailError);
          // Don't fail the purchase if email fails
        }
      }
      
      return createApiResponse(
        { 
          booking: {
            id: booking.id,
            status: booking.status,
            totalAmount: fees.totalAmount,
            paymentIntentId: paymentIntent.id,
            clientSecret: paymentIntent.client_secret,
          },
          purchase: {
            thingId: thingId,
            thingTitle: thing.title,
            itemPrice: itemPrice,
            shippingCost: shippingCost,
            subtotal: subtotal,
            platformFee: fees.platformFee,
            total: fees.totalAmount,
            deliveryMethod: body.deliveryMethod,
            shippingAddress: body.shippingAddress,
            pickupSchedule: body.pickupSchedule,
          }
        },
        { 
          status: 201,
          message: "Purchase initiated. Please complete payment to confirm."
        }
      );
      
    } catch (error) {
      // If payment setup fails, unreserve the item
      await db
        .update(thingsTable)
        .set({ 
          status: "active",
          updatedAt: new Date()
        })
        .where(eq(thingsTable.id, thingId));
      
      throw error;
    }
    
  } catch (error) {
    console.error("Error processing purchase:", error);
    return createApiError("Failed to process purchase", { 
      status: 500,
      details: error instanceof Error ? error.message : undefined
    });
  }
}

// POST: Protected endpoint for purchasing things
export const POST = createSecureApiHandler(
  handlePurchaseThing,
  {
    requireAuth: true,
    validateBody: purchaseSchema,
    rateLimit: { requests: 5, window: '1m' },
    auditLog: true,
    allowedMethods: ['POST'],
  }
);