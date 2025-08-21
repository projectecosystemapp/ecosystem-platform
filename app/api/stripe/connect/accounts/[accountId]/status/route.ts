import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAccountStatus } from "@/lib/stripe";
import { db } from "@/db/db";
import { providersTable } from "@/db/schema/providers-schema";
import { eq } from "drizzle-orm";

/**
 * Retrieves the current status of a Stripe Connected Account
 * 
 * This endpoint fetches real-time status from Stripe's API to check:
 * - Whether the account has completed onboarding (details_submitted)
 * - If charges are enabled (can accept payments)
 * - If payouts are enabled (can receive funds)
 * - Any outstanding requirements that need to be addressed
 * 
 * GET /api/stripe/connect/accounts/[accountId]/status
 * 
 * The data is always fresh from Stripe's API (not cached) to ensure
 * accurate onboarding status for provider dashboard displays.
 */
export async function GET(
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

    // Verify that the account belongs to the authenticated user
    // This prevents users from checking status of accounts they don't own
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

    // Fetch fresh status from Stripe API
    // This gives us real-time onboarding progress
    const accountStatus = await getAccountStatus(accountId);

    // Return comprehensive status information
    // Frontend can use this to show onboarding progress, enable/disable features
    return NextResponse.json({
      success: true,
      account: {
        id: accountStatus.id,
        details_submitted: accountStatus.details_submitted,
        charges_enabled: accountStatus.charges_enabled,
        payouts_enabled: accountStatus.payouts_enabled,
        onboarding_complete: accountStatus.onboarding_complete,
        requirements: {
          currently_due: accountStatus.requirements?.currently_due || [],
          eventually_due: accountStatus.requirements?.eventually_due || [],
          past_due: accountStatus.requirements?.past_due || [],
          pending_verification: accountStatus.requirements?.pending_verification || []
        }
      },
      provider: {
        id: provider.id,
        displayName: provider.displayName,
        email: provider.userId // This would be better as actual email from Clerk
      }
    });

  } catch (error) {
    console.error("Error fetching account status:", error);
    
    // Handle Stripe-specific errors (account not found, API errors, etc.)
    if (error instanceof Error) {
      return NextResponse.json(
        { 
          error: "Failed to fetch account status",
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
 * GET /api/stripe/connect/accounts/acct_1234567890/status
 * 
 * Response:
 * {
 *   "success": true,
 *   "account": {
 *     "id": "acct_1234567890",
 *     "details_submitted": true,
 *     "charges_enabled": true,
 *     "payouts_enabled": true,
 *     "onboarding_complete": true,
 *     "requirements": {
 *       "currently_due": [],
 *       "eventually_due": [],
 *       "past_due": [],
 *       "pending_verification": []
 *     }
 *   },
 *   "provider": {
 *     "id": "prov_abc123",
 *     "displayName": "Professional Photographer",
 *     "email": "user_xyz789"
 *   }
 * }
 */