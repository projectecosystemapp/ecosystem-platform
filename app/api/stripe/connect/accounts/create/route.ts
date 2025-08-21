import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createConnectedAccount } from "@/lib/stripe";
import { db } from "@/db/db";
import { providersTable } from "@/db/schema/providers-schema";
import { eq } from "drizzle-orm";

/**
 * Creates a new Stripe Connected Account using the controller-based approach
 * 
 * This endpoint demonstrates the new controller pattern where:
 * - The platform (our marketplace) maintains control over fees and dashboard access
 * - Connected accounts (providers) pay their own Stripe fees
 * - Full dashboard access is granted to providers for transparency
 * 
 * POST /api/stripe/connect/accounts/create
 * Body: { providerId: string, email?: string, country?: string, businessType?: 'individual' | 'company' }
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate the user making the request
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const { providerId, email, country = "US", businessType = "individual" } = body;

    if (!providerId) {
      return NextResponse.json(
        { error: "Provider ID is required" },
        { status: 400 }
      );
    }

    // Verify the provider exists and belongs to the authenticated user
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, providerId))
      .limit(1);

    if (!provider) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 }
      );
    }

    // Security check: Ensure the provider belongs to the authenticated user
    if (provider.userId !== userId) {
      return NextResponse.json(
        { error: "Unauthorized: Provider does not belong to authenticated user" },
        { status: 403 }
      );
    }

    // Check if provider already has a connected account
    if (provider.stripeConnectAccountId) {
      return NextResponse.json(
        { 
          error: "Provider already has a connected account",
          accountId: provider.stripeConnectAccountId
        },
        { status: 409 }
      );
    }

    // Create the connected account using our helper function
    // This uses the new controller-based approach instead of the legacy 'type' parameter
    const account = await createConnectedAccount({
      email: email || undefined,
      country,
      businessType
    });

    // Save the Stripe account ID to our database
    // This links the provider to their Stripe Connected Account
    await db
      .update(providersTable)
      .set({
        stripeConnectAccountId: account.id,
        updatedAt: new Date()
      })
      .where(eq(providersTable.id, providerId));

    // Return the account details
    // The frontend can use this to redirect to onboarding or show status
    return NextResponse.json({
      success: true,
      account: {
        id: account.id,
        country: account.country,
        business_type: account.business_type,
        details_submitted: account.details_submitted,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled
      },
      message: "Connected account created successfully"
    });

  } catch (error) {
    console.error("Error creating connected account:", error);
    
    // Handle Stripe-specific errors with more detail
    if (error instanceof Error) {
      return NextResponse.json(
        { 
          error: "Failed to create connected account",
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
}

/**
 * Usage Example:
 * 
 * POST /api/stripe/connect/accounts/create
 * {
 *   "providerId": "prov_abc123",
 *   "email": "provider@example.com",
 *   "country": "US",
 *   "businessType": "individual"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "account": {
 *     "id": "acct_1234567890",
 *     "country": "US",
 *     "business_type": "individual",
 *     "details_submitted": false,
 *     "charges_enabled": false,
 *     "payouts_enabled": false
 *   },
 *   "message": "Connected account created successfully"
 * }
 */