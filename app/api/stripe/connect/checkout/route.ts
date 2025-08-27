// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createConnectedAccountCheckout, stripe } from "@/lib/stripe";
import { db } from "@/db/db";
import { providersTable } from "@/db/schema/providers-schema";
import { eq } from "drizzle-orm";
import { withRateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { createCheckoutSchema, validateRequest, ValidationError } from "@/lib/validations/api-schemas";

/**
 * Storefront Checkout with Application Fees
 * 
 * This endpoint creates checkout sessions for marketplace payments using
 * the Direct Charges pattern with application fees. This is the recommended
 * approach for marketplaces using Stripe Connect.
 * 
 * Key concepts:
 * - Customer pays the full amount to the connected account (provider)
 * - Platform collects an application fee from each transaction
 * - Stripe's hosted checkout handles the payment flow
 * - Provider receives the amount minus the application fee
 * 
 * POST /api/stripe/connect/checkout
 * Body: {
 *   accountId: string,
 *   lineItems: Array<{ price: string, quantity: number }>,
 *   applicationFeePercent?: number,
 *   successUrl?: string,
 *   cancelUrl?: string,
 *   metadata?: Record<string, string>
 * }
 */
// Apply rate limiting to protect against abuse
export const POST = withRateLimit(
  RATE_LIMIT_CONFIGS.payment,
  async (req: NextRequest) => {
  try {
    // Authentication is optional for checkout creation
    // This allows guest checkout, but we'll track the user if authenticated
    const { userId } = auth();

    // Parse and validate request body using Zod schema
    let validatedData;
    try {
      const body = await req.json();
      validatedData = validateRequest(createCheckoutSchema, body);
    } catch (error) {
      if (error instanceof ValidationError) {
        return NextResponse.json(
          { 
            error: "Invalid request data",
            details: error.errors 
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Invalid request format" },
        { status: 400 }
      );
    }

    const {
      accountId,
      lineItems,
      applicationFeePercent,
      successUrl,
      cancelUrl,
      metadata = {}
    } = validatedData;

    // Verify the connected account exists and get provider info
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.stripeConnectAccountId, accountId))
      .limit(1);

    if (!provider) {
      return NextResponse.json(
        { error: "Provider not found for the specified account" },
        { status: 404 }
      );
    }

    // Calculate application fee based on actual prices
    // This is where the marketplace makes money from each transaction
    // Base fee: 10% for logged-in users, 20% for guests
    const baseFeePercent = parseFloat(process.env.NEXT_PUBLIC_PLATFORM_FEE_PERCENT || "10");
    const guestFeePercent = parseFloat(process.env.NEXT_PUBLIC_GUEST_FEE_PERCENT || "20");
    
    // Apply higher fee for non-authenticated users
    const defaultFeePercent = userId ? baseFeePercent : guestFeePercent;
    const feePercent = applicationFeePercent || defaultFeePercent;

    // Fetch actual prices from Stripe to calculate accurate fees
    let totalAmount = 0;
    try {
      // Fetch price details for each line item from the connected account
      for (const item of lineItems) {
        const price = await stripe.prices.retrieve(
          item.price,
          { stripeAccount: accountId }
        );
        
        if (!price.unit_amount) {
          return NextResponse.json(
            { error: `Price ${item.price} does not have a fixed amount` },
            { status: 400 }
          );
        }
        
        totalAmount += price.unit_amount * item.quantity;
      }
    } catch (error) {
      console.error("Error fetching price details:", error);
      return NextResponse.json(
        { error: "Failed to fetch price information" },
        { status: 500 }
      );
    }

    // Calculate the platform's application fee
    const applicationFeeAmount = Math.round(totalAmount * (feePercent / 100));

    // Set up redirect URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || "http://localhost:3000";
    const defaultSuccessUrl = `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
    const defaultCancelUrl = `${baseUrl}/checkout/canceled`;

    // Add tracking metadata
    const sessionMetadata = {
      ...metadata,
      provider_id: provider.id,
      marketplace: "ecosystem",
      fee_percent: feePercent.toString(),
      ...(userId && { customer_user_id: userId })
    };

    // Create the checkout session using our helper function
    // This creates a Direct Charge with application fee
    const session = await createConnectedAccountCheckout({
      accountId,
      lineItems,
      applicationFeeAmount,
      successUrl: successUrl || defaultSuccessUrl,
      cancelUrl: cancelUrl || defaultCancelUrl,
      metadata: sessionMetadata
    });

    // Return the checkout session details
    // Frontend should redirect user to session.url
    return NextResponse.json({
      success: true,
      checkout: {
        id: session.id,
        url: session.url,
        expires_at: session.expires_at
      },
      payment: {
        account_id: accountId,
        application_fee_amount: applicationFeeAmount,
        fee_percent: feePercent,
        total_amount: totalAmount
      },
      provider: {
        id: provider.id,
        name: provider.displayName
      },
      message: "Checkout session created successfully"
    });

  } catch (error) {
    console.error("Error creating checkout session:", error);
    
    if (error instanceof Error) {
      // Handle specific Stripe errors
      if (error.message.includes("No such account")) {
        return NextResponse.json(
          { error: "Connected account not found or not activated" },
          { status: 404 }
        );
      }
      
      if (error.message.includes("not activated")) {
        return NextResponse.json(
          { 
            error: "Provider must complete onboarding before accepting payments",
            details: "The provider account is not fully activated"
          },
          { status: 409 }
        );
      }
      
      if (error.message.includes("No such price")) {
        return NextResponse.json(
          { error: "One or more price IDs are invalid" },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { 
          error: "Failed to create checkout session",
          details: error.message
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});

/**
 * Usage Examples:
 * 
 * POST /api/stripe/connect/checkout
 * {
 *   "accountId": "acct_1234567890",
 *   "lineItems": [
 *     {
 *       "price": "price_photography_session",
 *       "quantity": 1
 *     }
 *   ],
 *   "applicationFeePercent": 10,
 *   "successUrl": "https://myapp.com/booking/success",
 *   "cancelUrl": "https://myapp.com/booking/canceled",
 *   "metadata": {
 *     "booking_id": "booking_abc123",
 *     "session_date": "2024-01-15"
 *   }
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "checkout": {
 *     "id": "cs_live_abc123def456",
 *     "url": "https://checkout.stripe.com/c/pay/cs_live_abc123def456",
 *     "expires_at": 1640999999
 *   },
 *   "payment": {
 *     "account_id": "acct_1234567890",
 *     "application_fee_amount": 750,
 *     "fee_percent": 10,
 *     "estimated_total": 5000
 *   },
 *   "provider": {
 *     "id": "prov_abc123",
 *     "name": "Professional Photographer"
 *   },
 *   "message": "Checkout session created successfully"
 * }
 * 
 * Key Implementation Notes:
 * 
 * 1. Application Fee Structure:
 *    - Customer pays $50.00 to provider
 *    - Platform takes $5.00 (10%) as application fee for logged-in users
 *    - Platform takes $10.00 (20%) as application fee for guests
 *    - Provider receives $42.50 net
 * 
 * 2. Direct Charges vs. Destination Charges:
 *    - We use Direct Charges (recommended for marketplaces)
 *    - Payment goes directly to connected account
 *    - Platform collects fee automatically
 *    - Better for dispute handling and provider dashboard access
 * 
 * 3. Security Considerations:
 *    - Validate account ownership before creating sessions
 *    - Set reasonable fee limits (e.g., max 30%)
 *    - Include metadata for tracking and reconciliation
 *    - Use HTTPS URLs for redirects
 * 
 * 4. Error Handling:
 *    - Account not found or not activated
 *    - Invalid price IDs in line items
 *    - Network/API failures
 *    - Authentication issues (optional for checkout)
 */