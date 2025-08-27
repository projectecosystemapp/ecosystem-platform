// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAccountOnboardingLink } from "@/lib/stripe";
import { db } from "@/db/db";
import { providersTable } from "@/db/schema/providers-schema";
import { eq } from "drizzle-orm";

/**
 * Creates an onboarding link for a Stripe Connected Account
 * 
 * This endpoint generates a secure, temporary URL that redirects providers
 * to Stripe's hosted onboarding flow. The flow handles:
 * - Identity verification
 * - Bank account setup
 * - Business information collection
 * - Tax form completion (if required)
 * 
 * POST /api/stripe/connect/accounts/[accountId]/onboard
 * Body: { refreshUrl?: string, returnUrl?: string }
 * 
 * The onboarding links expire after a short time for security.
 * If the user needs to refresh, they'll be redirected to refreshUrl.
 * After completion, they'll be redirected to returnUrl.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { accountId: string } }
) {
  try {
    // Authenticate the user making the request
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { accountId } = params;

    if (!accountId) {
      return NextResponse.json(
        { error: "Account ID is required" },
        { status: 400 }
      );
    }

    // Parse request body for custom URLs
    const body = await req.json().catch(() => ({}));
    const { 
      refreshUrl, 
      returnUrl 
    } = body;

    // Set default URLs if not provided
    // These URLs are where users will be redirected during/after onboarding
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || "http://localhost:3000";
    const defaultRefreshUrl = `${baseUrl}/dashboard/provider/payouts?refresh=1`;
    const defaultReturnUrl = `${baseUrl}/dashboard/provider/payouts?completed=1`;

    // Verify that the account belongs to the authenticated user
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.stripeConnectAccountId, accountId))
      .limit(1);

    if (!provider) {
      return NextResponse.json(
        { error: "Account not found or not associated with any provider" },
        { status: 404 }
      );
    }

    // Security check: Ensure the provider belongs to the authenticated user
    if (provider.userId !== userId) {
      return NextResponse.json(
        { error: "Unauthorized: Account does not belong to authenticated user" },
        { status: 403 }
      );
    }

    // Create the onboarding link using our helper function
    // This generates a secure, temporary URL for Stripe's hosted onboarding
    const accountLink = await createAccountOnboardingLink({
      accountId,
      refreshUrl: refreshUrl || defaultRefreshUrl,
      returnUrl: returnUrl || defaultReturnUrl
    });

    // Return the onboarding URL
    // Frontend should redirect user to this URL immediately
    return NextResponse.json({
      success: true,
      onboarding: {
        url: accountLink.url,
        expires_at: accountLink.expires_at,
        account_id: accountId
      },
      urls: {
        refresh_url: refreshUrl || defaultRefreshUrl,
        return_url: returnUrl || defaultReturnUrl
      },
      message: "Onboarding link created successfully"
    });

  } catch (error) {
    console.error("Error creating onboarding link:", error);
    
    // Handle Stripe-specific errors
    if (error instanceof Error) {
      // Common error: Account already onboarded
      if (error.message.includes("already been onboarded")) {
        return NextResponse.json(
          { 
            error: "Account onboarding already completed",
            details: "This account has already completed the onboarding process"
          },
          { status: 409 }
        );
      }
      
      return NextResponse.json(
        { 
          error: "Failed to create onboarding link",
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
 * POST /api/stripe/connect/accounts/acct_1234567890/onboard
 * {
 *   "refreshUrl": "https://myapp.com/dashboard/provider/setup",
 *   "returnUrl": "https://myapp.com/dashboard/provider/payouts"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "onboarding": {
 *     "url": "https://connect.stripe.com/setup/s/acct_1234567890/abc123def456",
 *     "expires_at": 1640995200,
 *     "account_id": "acct_1234567890"
 *   },
 *   "urls": {
 *     "refresh_url": "https://myapp.com/dashboard/provider/setup",
 *     "return_url": "https://myapp.com/dashboard/provider/payouts"
 *   },
 *   "message": "Onboarding link created successfully"
 * }
 */