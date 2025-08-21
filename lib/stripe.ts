import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
  appInfo: {
    name: "Ecosystem Marketplace",
    version: "1.0.0",
    url: "https://ecosystem-platform.com"
  }
});

// Helper to create marketplace-specific payment intents
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
