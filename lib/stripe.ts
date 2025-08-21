import Stripe from "stripe";

// Validate required environment variables with helpful error messages
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error(
    "STRIPE_SECRET_KEY is required. Please add it to your .env.local file.\n" +
    "Get your key from: https://dashboard.stripe.com/test/apikeys"
  );
}

// Initialize Stripe with the latest API version
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20" as any, // Using latest stable API version
  appInfo: {
    name: "Ecosystem Marketplace",
    version: "1.0.0",
    url: "https://ecosystem-platform.com"
  }
});

/**
 * Creates a Connected Account using the new controller-based approach
 * This gives the platform control over fees while allowing full dashboard access
 */
export const createConnectedAccount = async (params: {
  email?: string;
  country?: string;
  businessType?: 'individual' | 'company';
}) => {
  try {
    // Create connected account with controller properties (no top-level type)
    const account = await stripe.accounts.create({
      controller: {
        // Platform controls fee collection - connected account pays fees
        fees: {
          payer: 'account' as const
        },
        // Stripe handles payment disputes and losses
        losses: {
          payments: 'stripe' as const
        },
        // Connected account gets full access to Stripe dashboard
        stripe_dashboard: {
          type: 'full' as const
        }
      },
      country: params.country || 'US',
      email: params.email,
      business_type: params.businessType || 'individual',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    return account;
  } catch (error) {
    console.error('Error creating connected account:', error);
    throw error;
  }
};

/**
 * Gets the current onboarding status of a connected account
 * Always fetches fresh data from Stripe API (no database caching)
 */
export const getAccountStatus = async (accountId: string) => {
  try {
    const account = await stripe.accounts.retrieve(accountId);
    
    return {
      id: account.id,
      details_submitted: account.details_submitted,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      requirements: account.requirements,
      // Determine if onboarding is complete
      onboarding_complete: account.details_submitted && 
                          account.charges_enabled && 
                          account.payouts_enabled
    };
  } catch (error) {
    console.error('Error retrieving account status:', error);
    throw error;
  }
};

/**
 * Creates an onboarding link for a connected account
 */
export const createAccountOnboardingLink = async (params: {
  accountId: string;
  refreshUrl: string;
  returnUrl: string;
}) => {
  try {
    const accountLink = await stripe.accountLinks.create({
      account: params.accountId,
      refresh_url: params.refreshUrl,
      return_url: params.returnUrl,
      type: 'account_onboarding',
    });

    return accountLink;
  } catch (error) {
    console.error('Error creating onboarding link:', error);
    throw error;
  }
};

/**
 * Creates a product on a connected account using the Stripe-Account header
 */
export const createConnectedAccountProduct = async (params: {
  accountId: string;
  name: string;
  description?: string;
  priceInCents: number;
  currency?: string;
  images?: string[];
}) => {
  try {
    const product = await stripe.products.create({
      name: params.name,
      description: params.description,
      images: params.images,
      default_price_data: {
        unit_amount: params.priceInCents,
        currency: params.currency || 'usd',
      },
    }, {
      stripeAccount: params.accountId, // This sets the Stripe-Account header
    });

    return product;
  } catch (error) {
    console.error('Error creating product on connected account:', error);
    throw error;
  }
};

/**
 * Lists products for a connected account
 */
export const listConnectedAccountProducts = async (accountId: string, limit: number = 20) => {
  try {
    const products = await stripe.products.list(
      { limit, active: true },
      { stripeAccount: accountId } // Stripe-Account header for connected account
    );

    return products;
  } catch (error) {
    console.error('Error listing products for connected account:', error);
    throw error;
  }
};

/**
 * Creates a checkout session with Direct Charge and application fee
 * This is the preferred method for marketplace payments
 */
export const createConnectedAccountCheckout = async (params: {
  accountId: string;
  lineItems: Array<{
    price: string;
    quantity: number;
  }>;
  applicationFeeAmount: number; // Platform fee in cents
  successUrl: string;
  cancelUrl?: string;
  metadata?: Record<string, string>;
}) => {
  try {
    const session = await stripe.checkout.sessions.create({
      line_items: params.lineItems,
      payment_intent_data: {
        // Application fee - this is how the platform monetizes
        application_fee_amount: params.applicationFeeAmount,
        metadata: params.metadata,
      },
      mode: 'payment',
      success_url: params.successUrl,
      cancel_url: params.cancelUrl || params.successUrl,
    }, {
      stripeAccount: params.accountId, // Process on connected account
    });

    return session;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
};

/**
 * Legacy helper for marketplace payment intents (keep for backward compatibility)
 */
export const createMarketplacePaymentIntent = async (params: {
  amount: number; // in cents
  currency: string;
  customerId?: string;
  stripeConnectAccountId: string;
  platformFeeAmount: number; // in cents
  metadata?: Record<string, string>;
}) => {
  return await stripe.paymentIntents.create({
    amount: params.amount,
    currency: params.currency,
    customer: params.customerId,
    application_fee_amount: params.platformFeeAmount,
    transfer_data: {
      destination: params.stripeConnectAccountId,
    },
    metadata: {
      type: "marketplace_booking",
      ...params.metadata,
    },
  });
};
