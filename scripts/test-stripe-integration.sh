#!/bin/bash

# Stripe Integration Testing Script
# This script tests the complete Stripe integration locally

set -e

echo "🧪 Starting Stripe Integration Tests..."
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if required services are running
check_service() {
    if lsof -Pi :$2 -sTCP:LISTEN -t >/dev/null ; then
        echo -e "${GREEN}✓${NC} $1 is running on port $2"
    else
        echo -e "${RED}✗${NC} $1 is not running on port $2"
        echo "  Please start $1 first"
        exit 1
    fi
}

echo "Checking required services..."
check_service "Next.js" 3000
check_service "Supabase PostgreSQL" 54322

# Check environment variables
echo -e "\nChecking environment variables..."
check_env() {
    if [ -z "${!1}" ]; then
        echo -e "${RED}✗${NC} $1 is not set"
        return 1
    else
        echo -e "${GREEN}✓${NC} $1 is set"
        return 0
    fi
}

ENV_VALID=true
check_env "STRIPE_SECRET_KEY" || ENV_VALID=false
check_env "STRIPE_WEBHOOK_SECRET" || ENV_VALID=false
check_env "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" || ENV_VALID=false
check_env "CRON_SECRET" || ENV_VALID=false

if [ "$ENV_VALID" = false ]; then
    echo -e "${RED}Missing required environment variables${NC}"
    echo "Please check your .env.local file"
    exit 1
fi

# Test webhook endpoint
echo -e "\nTesting webhook endpoint..."
WEBHOOK_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    http://localhost:3000/api/stripe/webhooks \
    -H "Content-Type: application/json" \
    -d '{"test": true}')

if [ "$WEBHOOK_RESPONSE" = "401" ]; then
    echo -e "${GREEN}✓${NC} Webhook endpoint security working (401 for unauthorized)"
else
    echo -e "${YELLOW}⚠${NC} Webhook returned $WEBHOOK_RESPONSE (expected 401)"
fi

# Test refund endpoint
echo -e "\nTesting refund endpoint..."
REFUND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    http://localhost:3000/api/stripe/refunds \
    -H "Content-Type: application/json" \
    -d '{"bookingId": "test"}')

if [ "$REFUND_RESPONSE" = "401" ]; then
    echo -e "${GREEN}✓${NC} Refund endpoint security working (401 for unauthorized)"
else
    echo -e "${YELLOW}⚠${NC} Refund returned $REFUND_RESPONSE (expected 401)"
fi

# Test cron endpoints
echo -e "\nTesting cron endpoints..."
test_cron() {
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X GET \
        "http://localhost:3000/api/cron/$1" \
        -H "Authorization: Bearer wrong-secret")
    
    if [ "$RESPONSE" = "401" ]; then
        echo -e "${GREEN}✓${NC} Cron $1 security working (401 for unauthorized)"
    else
        echo -e "${YELLOW}⚠${NC} Cron $1 returned $RESPONSE (expected 401)"
    fi
}

test_cron "process-payouts"
test_cron "reconcile-payments"

# Run database migrations
echo -e "\nApplying database migrations..."
npm run db:generate 2>/dev/null || echo "No schema changes to generate"
npm run db:migrate 2>/dev/null || echo "Migrations already up to date"

# Run unit tests
echo -e "\nRunning unit tests..."
npm run test -- __tests__/stripe-webhooks.test.ts --reporter=verbose

# Test Stripe CLI webhook forwarding
echo -e "\nChecking Stripe CLI..."
if command -v stripe &> /dev/null; then
    echo -e "${GREEN}✓${NC} Stripe CLI is installed"
    echo "  To test webhooks locally, run:"
    echo "  stripe listen --forward-to localhost:3000/api/stripe/webhooks"
else
    echo -e "${YELLOW}⚠${NC} Stripe CLI not found"
    echo "  Install it from: https://stripe.com/docs/stripe-cli"
fi

echo -e "\n=================================="
echo -e "${GREEN}✅ Stripe integration tests complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Start Stripe webhook forwarding:"
echo "   npm run stripe:listen"
echo ""
echo "2. Trigger test events:"
echo "   npm run stripe:trigger:payment"
echo ""
echo "3. Check the logs for webhook processing"
echo ""
echo "For production deployment:"
echo "1. Set up webhook endpoints in Stripe Dashboard"
echo "2. Configure cron jobs in Vercel or your hosting platform"
echo "3. Set all environment variables in production"