# Stripe Integration Setup Guide

This guide will help you set up Stripe payments and Stripe Connect for the Ecosystem marketplace.

## Prerequisites

- Stripe account ([Create one here](https://dashboard.stripe.com/register))
- Stripe CLI installed (`brew install stripe/stripe-cli/stripe`)
- Node.js development environment running

## Step 1: Get Your Stripe API Keys

1. **Log in to your Stripe Dashboard**: https://dashboard.stripe.com
2. **Navigate to API Keys**: Go to "Developers" → "API Keys"
3. **Copy your keys**:
   - **Publishable key** (starts with `pk_test_`)
   - **Secret key** (starts with `sk_test_`)

## Step 2: Set Up Stripe Connect

1. **Enable Connect**: Go to "Connect" → "Settings" in your Stripe dashboard
2. **Get Client ID**: Copy your Connect Client ID (starts with `ca_`)
3. **Configure OAuth**: Set your redirect URI to match your app URL

## Step 3: Update Environment Variables

Update your `.env.local` file with your actual Stripe keys:

```bash
# Replace with your actual Stripe keys
STRIPE_SECRET_KEY=sk_test_YOUR_ACTUAL_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_ACTUAL_PUBLISHABLE_KEY
STRIPE_CONNECT_CLIENT_ID=ca_YOUR_ACTUAL_CLIENT_ID

# Webhook secret will be generated in Step 4
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET
```

## Step 4: Set Up Local Webhook Testing

1. **Run the setup script**:
   ```bash
   npm run stripe:setup
   ```

2. **Start your Next.js app** in one terminal:
   ```bash
   npm run dev
   ```

3. **Start webhook forwarding** in another terminal:
   ```bash
   npm run stripe:listen
   ```

4. **Copy the webhook secret**: The CLI will output a webhook signing secret (starts with `whsec_`). Add this to your `.env.local`:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_YOUR_GENERATED_SECRET
   ```

## Step 5: Test the Integration

### Test Provider Onboarding
1. Visit `/become-a-provider` in your app
2. Complete the provider onboarding flow
3. In the provider dashboard, click "Complete Setup" to start Stripe Connect onboarding

### Test Booking & Payment
1. Visit a provider profile page
2. Create a booking through the booking flow
3. Complete payment with Stripe test card: `4242 4242 4242 4242`

### Test Webhooks
1. **Trigger test events**:
   ```bash
   npm run stripe:trigger:payment
   ```

2. **Monitor webhook events**:
   ```bash
   npm run stripe:logs
   ```

## Stripe Test Cards

Use these test card numbers during development:

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Authentication required**: `4000 0025 0000 3155`

**Expiry**: Any future date  
**CVC**: Any 3 digits  
**ZIP**: Any 5 digits

## Production Deployment

### Environment Variables for Production

```bash
# Production Stripe keys (pk_live_ and sk_live_)
STRIPE_SECRET_KEY=sk_live_YOUR_LIVE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_LIVE_PUBLISHABLE_KEY
STRIPE_CONNECT_CLIENT_ID=ca_YOUR_LIVE_CLIENT_ID

# Production webhook endpoint
STRIPE_WEBHOOK_SECRET=whsec_YOUR_PRODUCTION_WEBHOOK_SECRET
```

### Webhook Endpoints for Production

Set up these webhook endpoints in your Stripe dashboard:

1. **Main webhooks** (`/api/stripe/webhooks`):
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

2. **Connect webhooks** (`/api/stripe/connect/webhooks`):
   - `account.updated`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `transfer.created`
   - `payout.created`

## Troubleshooting

### Common Issues

1. **"No such customer" error**: Make sure customer records exist in your database
2. **Webhook signature verification failed**: Check that `STRIPE_WEBHOOK_SECRET` is correct
3. **Connect account not found**: Ensure provider completed Stripe onboarding

### Useful Commands

```bash
# View Stripe CLI version
stripe --version

# List webhook events
stripe events list

# Test specific webhook
stripe trigger payment_intent.succeeded

# View account information
stripe config --list

# Listen to all events (debugging)
stripe listen --print-json
```

### Getting Help

- [Stripe Documentation](https://stripe.com/docs)
- [Stripe Connect Guide](https://stripe.com/docs/connect)
- [Stripe CLI Reference](https://stripe.com/docs/cli)

## Security Notes

- **Never commit real API keys** to version control
- **Use test keys** for development and staging
- **Validate webhook signatures** to ensure events come from Stripe
- **Use HTTPS** in production for webhook endpoints