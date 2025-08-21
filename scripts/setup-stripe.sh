#!/bin/bash

# Stripe CLI Setup Script for Ecosystem Marketplace
# This script helps set up Stripe CLI for local development

echo "🚀 Setting up Stripe CLI for Ecosystem Marketplace..."

# Check if Stripe CLI is installed
if ! command -v stripe &> /dev/null; then
    echo "❌ Stripe CLI is not installed. Please install it first:"
    echo "   brew install stripe/stripe-cli/stripe"
    exit 1
fi

echo "✅ Stripe CLI found: $(stripe --version)"

# Login to Stripe (if not already logged in)
echo "🔐 Checking Stripe authentication..."
if ! stripe config --list &> /dev/null; then
    echo "Please log in to Stripe:"
    stripe login
else
    echo "✅ Already authenticated with Stripe"
fi

# Get webhook endpoint secret for local development
echo "🎣 Setting up webhook forwarding..."
echo "This will forward Stripe webhooks to your local Next.js app"
echo "Keep this terminal open while developing!"
echo ""
echo "In another terminal, run: npm run dev"
echo "Then run this command to start webhook forwarding:"
echo ""
echo "stripe listen --forward-to localhost:3000/api/stripe/webhooks"
echo ""
echo "Copy the webhook signing secret (whsec_...) to your .env.local file as STRIPE_WEBHOOK_SECRET"
echo ""
echo "For marketplace webhooks, also run:"
echo "stripe listen --forward-to localhost:3000/api/stripe/connect/webhooks --events account.updated,payment_intent.succeeded,payment_intent.payment_failed"

# Create sample data (optional)
read -p "Would you like to create sample test data? (y/n): " -n 1 -r
echo
if [[ $REVERT =~ ^[Yy]$ ]]; then
    echo "Creating sample customers and products..."
    
    # Create a test customer
    CUSTOMER_ID=$(stripe customers create \
        --email="test@ecosystem.com" \
        --name="Test Customer" \
        --description="Test customer for marketplace" \
        --output=json | jq -r '.id')
    echo "✅ Created test customer: $CUSTOMER_ID"
    
    # Create a test Connect account
    echo "📝 Note: You'll need to create Connect accounts through your app's onboarding flow"
fi

echo ""
echo "🎉 Stripe CLI setup complete!"
echo ""
echo "Next steps:"
echo "1. Update your .env.local with actual Stripe keys from https://dashboard.stripe.com/test/apikeys"
echo "2. Set up webhook forwarding in a separate terminal"
echo "3. Test the payment flow in your app"
echo ""
echo "Useful Stripe CLI commands:"
echo "  stripe listen --forward-to localhost:3000/api/stripe/webhooks"
echo "  stripe trigger payment_intent.succeeded"
echo "  stripe logs tail"
echo "  stripe products list"
echo "  stripe customers list"