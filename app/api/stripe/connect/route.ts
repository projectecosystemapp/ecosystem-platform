// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/db/db";
import { providersTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

// Validation schemas
const createAccountSchema = z.object({
  providerId: z.string().uuid(),
  accountType: z.enum(["express", "standard"]).default("express"),
});

const accountLinkSchema = z.object({
  providerId: z.string().uuid(),
  refreshUrl: z.string().url().optional(),
  returnUrl: z.string().url().optional(),
});

const checkStatusSchema = z.object({
  providerId: z.string().uuid(),
});

/**
 * POST /api/stripe/connect
 * Create a new Stripe Connect account for a provider
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { providerId, accountType } = createAccountSchema.parse(body);

    // Verify the user owns this provider profile
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

    if (provider.userId !== userId) {
      return NextResponse.json(
        { error: "Unauthorized - You don't own this provider profile" },
        { status: 403 }
      );
    }

    // Check if account already exists
    if (provider.stripeConnectAccountId) {
      return NextResponse.json(
        { 
          error: "Stripe account already exists",
          accountId: provider.stripeConnectAccountId 
        },
        { status: 400 }
      );
    }

    // Create Stripe Connect account
    const account = await stripe.accounts.create({
      type: accountType,
      country: provider.locationCountry || "US",
      email: undefined, // Will be collected during onboarding
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: "individual", // Can be changed during onboarding
      metadata: {
        providerId: provider.id,
        userId: userId,
        platformName: "Ecosystem",
      },
      settings: {
        payouts: {
          schedule: {
            interval: "daily", // Daily payouts by default
            delay_days: 2, // 2-day delay for risk management
          },
        },
      },
    });

    // Update provider with Stripe account ID
    await db
      .update(providersTable)
      .set({
        stripeConnectAccountId: account.id,
        updatedAt: new Date(),
      })
      .where(eq(providersTable.id, providerId));

    return NextResponse.json({
      success: true,
      accountId: account.id,
      accountType: accountType,
    });
  } catch (error) {
    console.error("Error creating Stripe Connect account:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create Stripe Connect account" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/stripe/connect
 * Generate an account link for Stripe Connect onboarding
 */
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { providerId, refreshUrl, returnUrl } = accountLinkSchema.parse(body);

    // Get provider and verify ownership
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

    if (provider.userId !== userId) {
      return NextResponse.json(
        { error: "Unauthorized - You don't own this provider profile" },
        { status: 403 }
      );
    }

    if (!provider.stripeConnectAccountId) {
      return NextResponse.json(
        { error: "No Stripe account found. Please create one first." },
        { status: 400 }
      );
    }

    // Generate account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: provider.stripeConnectAccountId,
      refresh_url: refreshUrl || `${process.env.NEXT_PUBLIC_APP_URL}/providers/${providerId}/settings?refresh=true`,
      return_url: returnUrl || `${process.env.NEXT_PUBLIC_APP_URL}/providers/${providerId}/settings?success=true`,
      type: "account_onboarding",
    });

    return NextResponse.json({
      success: true,
      url: accountLink.url,
      expiresAt: accountLink.expires_at,
    });
  } catch (error) {
    console.error("Error generating account link:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate account link" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/stripe/connect?providerId=xxx
 * Check the status of a Stripe Connect account
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const providerId = searchParams.get("providerId");

    if (!providerId) {
      return NextResponse.json(
        { error: "Provider ID is required" },
        { status: 400 }
      );
    }

    const validatedParams = checkStatusSchema.parse({ providerId });

    // Get provider and verify ownership
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, validatedParams.providerId))
      .limit(1);

    if (!provider) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 }
      );
    }

    if (provider.userId !== userId) {
      return NextResponse.json(
        { error: "Unauthorized - You don't own this provider profile" },
        { status: 403 }
      );
    }

    if (!provider.stripeConnectAccountId) {
      return NextResponse.json({
        exists: false,
        onboardingComplete: false,
      });
    }

    // Get account details from Stripe
    const account = await stripe.accounts.retrieve(provider.stripeConnectAccountId);

    // Check if onboarding is complete
    const onboardingComplete = 
      account.charges_enabled && 
      account.payouts_enabled &&
      account.details_submitted;

    // Update database if onboarding status changed
    if (onboardingComplete !== provider.stripeOnboardingComplete) {
      await db
        .update(providersTable)
        .set({
          stripeOnboardingComplete: onboardingComplete,
          updatedAt: new Date(),
        })
        .where(eq(providersTable.id, validatedParams.providerId));
    }

    return NextResponse.json({
      exists: true,
      accountId: account.id,
      onboardingComplete,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      requirements: account.requirements,
      capabilities: account.capabilities,
      accountType: account.type,
      country: account.country,
      createdAt: account.created ? new Date(account.created * 1000).toISOString() : new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error checking account status:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to check account status" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/stripe/connect?providerId=xxx
 * Delete/disconnect a Stripe Connect account (for testing purposes)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const providerId = searchParams.get("providerId");

    if (!providerId) {
      return NextResponse.json(
        { error: "Provider ID is required" },
        { status: 400 }
      );
    }

    const validatedParams = checkStatusSchema.parse({ providerId });

    // Get provider and verify ownership
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, validatedParams.providerId))
      .limit(1);

    if (!provider) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 }
      );
    }

    if (provider.userId !== userId) {
      return NextResponse.json(
        { error: "Unauthorized - You don't own this provider profile" },
        { status: 403 }
      );
    }

    if (!provider.stripeConnectAccountId) {
      return NextResponse.json(
        { error: "No Stripe account to disconnect" },
        { status: 400 }
      );
    }

    // In production, we might want to keep the account but mark it as inactive
    // For now, we'll just remove the reference from our database
    await db
      .update(providersTable)
      .set({
        stripeConnectAccountId: null,
        stripeOnboardingComplete: false,
        updatedAt: new Date(),
      })
      .where(eq(providersTable.id, validatedParams.providerId));

    // Note: We're not actually deleting the Stripe account
    // as this requires special permissions and is generally not recommended

    return NextResponse.json({
      success: true,
      message: "Stripe account disconnected successfully",
    });
  } catch (error) {
    console.error("Error disconnecting account:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to disconnect account" },
      { status: 500 }
    );
  }
}