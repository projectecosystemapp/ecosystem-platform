/**
 * Stripe Connect Account Session API
 * Creates sessions for embedded onboarding and account management
 * 
 * This endpoint is crucial for the marketplace as it enables:
 * 1. Provider onboarding via Stripe's embedded components
 * 2. Account management for existing providers
 * 3. Secure, PCI-compliant payment setup
 */

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { stripe } from '@/lib/stripe';
import { db } from '@/db/db';
import { providersTable } from '@/db/schema';
import { eq } from 'drizzle-orm';

async function getProviderStripeAccountId(userId: string): Promise<string | null> {
  try {
    const [provider] = await db
      .select({
        stripeAccountId: providersTable.stripeConnectAccountId,
      })
      .from(providersTable)
      .where(eq(providersTable.userId, userId))
      .limit(1);

    return provider?.stripeAccountId || null;
  } catch (error) {
    console.error('Error fetching provider Stripe account:', error);
    return null;
  }
}

async function createConnectedAccount(userId: string): Promise<string> {
  try {
    // Fetch user details from database for prefilling
    const [provider] = await db
      .select({
        displayName: providersTable.displayName,
        email: providersTable.userId, // We'll need to fetch email from profiles
      })
      .from(providersTable)
      .where(eq(providersTable.userId, userId))
      .limit(1);

    // Create a new Stripe Connect account with Express type for embedded components
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US', // Default to US, can be made dynamic
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: 'individual', // Can be 'company' for businesses
      metadata: {
        platform_user_id: userId,
        platform: 'ecosystem_marketplace',
      },
    });

    // Store the Stripe account ID in the database
    await db
      .update(providersTable)
      .set({
        stripeConnectAccountId: account.id,
        updatedAt: new Date(),
      })
      .where(eq(providersTable.userId, userId));

    console.log(`Created Stripe Connect account ${account.id} for user ${userId}`);
    return account.id;
  } catch (error) {
    console.error('Error creating connected account:', error);
    throw new Error('Failed to create payment account');
  }
}

export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { mode = 'onboarding' } = body; // 'onboarding' or 'management'

    // Get or create Stripe Connect account
    let accountId = await getProviderStripeAccountId(userId);
    
    if (!accountId) {
      if (mode === 'management') {
        return NextResponse.json(
          { error: 'No payment account found. Please complete onboarding first.' },
          { status: 404 }
        );
      }
      // Create new account for onboarding
      accountId = await createConnectedAccount(userId);
    }

    // Create account session based on mode
    const sessionConfig: any = {
      account: accountId,
      components: {},
    };

    if (mode === 'onboarding') {
      // Enable onboarding components
      sessionConfig.components = {
        account_onboarding: {
          enabled: true,
          features: {
            external_account_collection: true, // Bank account setup
          },
        },
        // Also enable management for post-onboarding
        account_management: {
          enabled: true,
          features: {
            external_account_collection: true,
          },
        },
      };
    } else if (mode === 'management') {
      // Enable management components only
      sessionConfig.components = {
        account_management: {
          enabled: true,
          features: {
            external_account_collection: true,
          },
        },
        balances: {
          enabled: true,
          features: {
            instant_payouts: true,
            standard_payouts: true,
          },
        },
        payouts: {
          enabled: true,
          features: {
            instant_payouts: true,
            standard_payouts: true,
          },
        },
        payment_details: {
          enabled: true,
          features: {
            refund_management: true,
            dispute_management: true,
          },
        },
      };
    }

    // Create the account session
    const accountSession = await stripe.accountSessions.create(sessionConfig);

    // Return the client secret for the frontend
    return NextResponse.json({
      client_secret: accountSession.client_secret,
      accountId: accountId,
      expiresAt: accountSession.expires_at,
    });
    
  } catch (error) {
    console.error('Error creating account session:', error);
    
    // Determine appropriate error message
    const errorMessage = error instanceof Error ? error.message : 'Failed to create session';
    const statusCode = error instanceof Error && error.message.includes('authentication') ? 401 : 500;
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

/**
 * GET endpoint to check onboarding status
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const accountId = await getProviderStripeAccountId(userId);
    
    if (!accountId) {
      return NextResponse.json({
        hasAccount: false,
        onboardingComplete: false,
        requiresAction: true,
        message: 'No payment account found',
      });
    }

    // Fetch account details from Stripe
    const account = await stripe.accounts.retrieve(accountId);
    
    // Determine onboarding status
    const onboardingComplete = 
      account.details_submitted && 
      account.charges_enabled && 
      account.payouts_enabled;

    // Check for any requirements
    const requiresAction = 
      (account.requirements?.currently_due?.length || 0) > 0 ||
      (account.requirements?.eventually_due?.length || 0) > 0;

    return NextResponse.json({
      hasAccount: true,
      accountId: accountId,
      onboardingComplete,
      requiresAction,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      requirements: {
        currentlyDue: account.requirements?.currently_due || [],
        eventuallyDue: account.requirements?.eventually_due || [],
        pastDue: account.requirements?.past_due || [],
        errors: account.requirements?.errors || [],
      },
      capabilities: {
        cardPayments: account.capabilities?.card_payments,
        transfers: account.capabilities?.transfers,
      },
    });
    
  } catch (error) {
    console.error('Error checking account status:', error);
    return NextResponse.json(
      { error: 'Failed to check account status' },
      { status: 500 }
    );
  }
}