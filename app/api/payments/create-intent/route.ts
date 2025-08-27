/**
 * Direct Charge Payment Intent API
 * Creates payment intents on connected accounts with platform fees
 * 
 * This is the core monetization endpoint that:
 * 1. Processes payments directly on the provider's Stripe account
 * 2. Automatically collects platform fees (10% base + 10% guest surcharge)
 * 3. Handles both authenticated and guest checkouts
 * 
 * Money flow:
 * - Customer pays 100% (or 110% if guest)
 * - Provider receives 90% (after platform fee)
 * - Platform receives 10% (or 20% from guests)
 * - Stripe fees come from provider's portion
 */

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { stripe } from '@/lib/stripe';
import { db } from '@/db/db';
import { bookingsTable, providersTable, transactionsTable } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

// Request validation schema
const createPaymentIntentSchema = z.object({
  bookingId: z.string().uuid(),
  connectedAccountId: z.string().refine((val) => val.startsWith('acct_'), {
    message: 'Must be a valid Stripe account ID starting with acct_'
  }),
  amountCents: z.number().positive().int(),
  currency: z.string().default('usd'),
  isGuest: z.boolean().default(false),
  customerEmail: z.string().email().optional(),
  metadata: z.record(z.string()).optional(),
});

/**
 * Calculate platform fees based on base amount and guest status
 * Base fee: 10% for all transactions
 * Guest surcharge: Additional 10% for non-authenticated users
 */
function calculatePlatformFees(amountCents: number, isGuest: boolean) {
  const baseFee = Math.round(amountCents * 0.10); // 10% platform fee
  const guestSurcharge = isGuest ? Math.round(amountCents * 0.10) : 0; // 10% guest surcharge
  return {
    platformFee: baseFee,
    guestSurcharge,
    totalFee: baseFee + guestSurcharge,
    customerTotal: amountCents + guestSurcharge, // Customer pays extra if guest
    providerReceives: amountCents - baseFee, // Provider always gets 90%
  };
}

export async function POST(req: NextRequest) {
  try {
    // Check if user is authenticated (optional for guest checkout)
    const { userId } = auth();
    
    // Parse and validate request body
    const body = await req.json();
    const parseResult = createPaymentIntentSchema.safeParse(body);
    
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: parseResult.error.issues },
        { status: 400 }
      );
    }
    
    const {
      bookingId,
      connectedAccountId,
      amountCents,
      currency,
      isGuest,
      customerEmail,
      metadata = {},
    } = parseResult.data;
    
    // Verify the booking exists and is in correct state
    const [booking] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, bookingId))
      .limit(1);
    
    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }
    
    if (booking.status !== 'accepted' && booking.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot process payment for booking in ${booking.status} status` },
        { status: 400 }
      );
    }
    
    // Verify the provider account matches
    const [provider] = await db
      .select({
        id: providersTable.id,
        stripeAccountId: providersTable.stripeConnectAccountId,
        displayName: providersTable.displayName,
      })
      .from(providersTable)
      .where(eq(providersTable.id, booking.providerId))
      .limit(1);
    
    if (!provider || provider.stripeAccountId !== connectedAccountId) {
      return NextResponse.json(
        { error: 'Invalid provider account' },
        { status: 400 }
      );
    }
    
    // Calculate fees
    const fees = calculatePlatformFees(amountCents, isGuest);
    
    // Create metadata for the payment
    const paymentMetadata = {
      ...metadata,
      bookingId,
      providerId: provider.id,
      providerName: provider.displayName,
      customerId: booking.customerId,
      isGuest: String(isGuest),
      platformFee: String(fees.platformFee),
      guestSurcharge: String(fees.guestSurcharge),
      totalFee: String(fees.totalFee),
      type: 'booking_payment',
      platform: 'ecosystem_marketplace',
    };
    
    // Create payment intent with Direct Charge on connected account
    const paymentIntent = await stripe.paymentIntents.create({
      amount: fees.customerTotal, // Customer pays this amount
      currency,
      automatic_payment_methods: { enabled: true },
      // This is the key: application_fee_amount makes this a Direct Charge
      application_fee_amount: fees.totalFee, // Platform receives this
      metadata: paymentMetadata,
      description: `Booking #${booking.id.slice(0, 8)} - ${provider.displayName}`,
      receipt_email: customerEmail,
      statement_descriptor_suffix: 'ECOSYS', // Shows on bank statement
    }, {
      stripeAccount: connectedAccountId, // Process on connected account
    });
    
    // Create transaction record in database
    await db.insert(transactionsTable).values({
      bookingId: booking.id,
      stripePaymentIntentId: paymentIntent.id,
      amount: String(amountCents / 100), // Store in dollars
      platformFee: String(fees.platformFee / 100),
      providerPayout: String(fees.providerReceives / 100),
      currency,
      status: 'pending',
      type: 'booking_payment',
      metadata: paymentMetadata,
    });
    
    // Update booking status to payment_pending
    await db
      .update(bookingsTable)
      .set({
        status: 'payment_pending',
        updatedAt: new Date(),
      })
      .where(eq(bookingsTable.id, bookingId));
    
    console.log(`Created payment intent for booking ${bookingId}:`, {
      paymentIntentId: paymentIntent.id,
      customerPays: fees.customerTotal,
      platformReceives: fees.totalFee,
      providerReceives: fees.providerReceives,
      isGuest,
    });
    
    // Return client secret for frontend to complete payment
    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      fees: {
        customerTotal: fees.customerTotal,
        platformFee: fees.platformFee,
        guestSurcharge: fees.guestSurcharge,
        providerReceives: fees.providerReceives,
      },
      currency,
    });
    
  } catch (error) {
    console.error('Error creating payment intent:', error);
    
    // Handle Stripe-specific errors
    if (error instanceof Error && error.message.includes('Stripe')) {
      return NextResponse.json(
        { error: 'Payment processing error', details: error.message },
        { status: 502 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create payment intent' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to retrieve payment intent status
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const paymentIntentId = searchParams.get('id');
    const bookingId = searchParams.get('bookingId');
    
    if (!paymentIntentId || !bookingId) {
      return NextResponse.json(
        { error: 'Payment intent ID and booking ID required' },
        { status: 400 }
      );
    }
    
    // Verify the booking exists and get provider account
    const [booking] = await db
      .select({
        providerId: bookingsTable.providerId,
      })
      .from(bookingsTable)
      .where(eq(bookingsTable.id, bookingId))
      .limit(1);
    
    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }
    
    // Get provider's Stripe account
    const [provider] = await db
      .select({
        stripeAccountId: providersTable.stripeConnectAccountId,
      })
      .from(providersTable)
      .where(eq(providersTable.id, booking.providerId))
      .limit(1);
    
    if (!provider?.stripeAccountId) {
      return NextResponse.json(
        { error: 'Provider account not found' },
        { status: 404 }
      );
    }
    
    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(
      paymentIntentId,
      {},
      { stripeAccount: provider.stripeAccountId }
    );
    
    // Map Stripe status to our booking status
    let bookingStatus: string;
    switch (paymentIntent.status) {
      case 'succeeded':
        bookingStatus = 'confirmed';
        break;
      case 'processing':
        bookingStatus = 'payment_pending';
        break;
      case 'requires_payment_method':
      case 'requires_confirmation':
      case 'requires_action':
        bookingStatus = 'payment_pending';
        break;
      case 'canceled':
        bookingStatus = 'cancelled';
        break;
      default:
        bookingStatus = 'payment_failed';
    }
    
    return NextResponse.json({
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      bookingStatus,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      metadata: paymentIntent.metadata,
    });
    
  } catch (error) {
    console.error('Error retrieving payment intent:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve payment status' },
      { status: 500 }
    );
  }
}