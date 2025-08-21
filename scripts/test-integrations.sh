#!/bin/bash

# Integration Testing Script
# Tests all external service integrations

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "🧪 Integration Testing Suite"
echo "============================="
echo ""

ERRORS=0
WARNINGS=0

# Load environment variables
if [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
elif [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# ====================
# 1. TEST SUPABASE
# ====================
echo "📊 Testing Supabase Connection..."
echo "---------------------------------"

test_supabase() {
    # Test database connection
    echo -n "Testing database connection... "
    if npx drizzle-kit check 2>/dev/null; then
        echo -e "${GREEN}✅ Connected${NC}"
    else
        echo -e "${RED}❌ Failed${NC}"
        ((ERRORS++))
    fi
    
    # Test Supabase client connection
    echo -n "Testing Supabase client... "
    node -e "
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        );
        supabase.from('profiles').select('count').single()
            .then(() => console.log('SUCCESS'))
            .catch((err) => {
                console.error('FAILED:', err.message);
                process.exit(1);
            });
    " 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Connected${NC}"
    else
        echo -e "${RED}❌ Failed${NC}"
        ((ERRORS++))
    fi
}

test_supabase

# ====================
# 2. TEST STRIPE
# ====================
echo ""
echo "💳 Testing Stripe Integration..."
echo "--------------------------------"

test_stripe() {
    # Check if using test keys
    if [[ "$STRIPE_SECRET_KEY" == sk_test_* ]]; then
        echo -e "${YELLOW}⚠️  Using TEST keys (switch to LIVE for production)${NC}"
        ((WARNINGS++))
    fi
    
    # Test Stripe connection
    echo -n "Testing Stripe API connection... "
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        -u "$STRIPE_SECRET_KEY:" \
        https://api.stripe.com/v1/charges?limit=1)
    
    if [ "$response" -eq 200 ]; then
        echo -e "${GREEN}✅ Connected${NC}"
    else
        echo -e "${RED}❌ Failed (HTTP $response)${NC}"
        ((ERRORS++))
    fi
    
    # Test webhook endpoint
    if [ ! -z "$STRIPE_WEBHOOK_SECRET" ]; then
        echo -e "${GREEN}✅ Webhook secret configured${NC}"
    else
        echo -e "${RED}❌ Webhook secret missing${NC}"
        ((ERRORS++))
    fi
}

test_stripe

# ====================
# 3. TEST CLERK AUTH
# ====================
echo ""
echo "🔐 Testing Clerk Authentication..."
echo "----------------------------------"

test_clerk() {
    echo -n "Testing Clerk API connection... "
    
    # Test Clerk backend API
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer $CLERK_SECRET_KEY" \
        https://api.clerk.com/v1/users?limit=1)
    
    if [ "$response" -eq 200 ]; then
        echo -e "${GREEN}✅ Connected${NC}"
    elif [ "$response" -eq 401 ]; then
        echo -e "${RED}❌ Invalid API key${NC}"
        ((ERRORS++))
    else
        echo -e "${RED}❌ Failed (HTTP $response)${NC}"
        ((ERRORS++))
    fi
}

test_clerk

# ====================
# 4. TEST REDIS (if configured)
# ====================
echo ""
echo "🔄 Testing Redis/Upstash..."
echo "---------------------------"

test_redis() {
    if [ -z "$UPSTASH_REDIS_REST_URL" ] || [ -z "$UPSTASH_REDIS_REST_TOKEN" ]; then
        echo -e "${YELLOW}⚠️  Redis not configured (using in-memory rate limiting)${NC}"
        ((WARNINGS++))
    else
        echo -n "Testing Redis connection... "
        
        # Test Redis ping
        response=$(curl -s -o /dev/null -w "%{http_code}" \
            -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN" \
            "$UPSTASH_REDIS_REST_URL/ping")
        
        if [ "$response" -eq 200 ]; then
            echo -e "${GREEN}✅ Connected${NC}"
        else
            echo -e "${RED}❌ Failed (HTTP $response)${NC}"
            ((ERRORS++))
        fi
    fi
}

test_redis

# ====================
# 5. TEST API ENDPOINTS
# ====================
echo ""
echo "🌐 Testing API Endpoints..."
echo "---------------------------"

# Start dev server in background if not running
SERVER_PID=""
if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "Starting development server..."
    npm run dev > /dev/null 2>&1 &
    SERVER_PID=$!
    sleep 10 # Wait for server to start
fi

test_api_endpoints() {
    # Test health check endpoint
    echo -n "Testing /api/user/status... "
    response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/user/status)
    
    if [ "$response" -eq 200 ] || [ "$response" -eq 401 ]; then
        echo -e "${GREEN}✅ Responding${NC}"
    else
        echo -e "${RED}❌ Failed (HTTP $response)${NC}"
        ((ERRORS++))
    fi
}

test_api_endpoints

# Clean up dev server if we started it
if [ ! -z "$SERVER_PID" ]; then
    kill $SERVER_PID 2>/dev/null || true
fi

# ====================
# 6. TEST WEBHOOKS
# ====================
echo ""
echo "🔗 Testing Webhook Configuration..."
echo "------------------------------------"

test_webhooks() {
    # Check if Stripe CLI is installed
    if command -v stripe &> /dev/null; then
        echo -e "${GREEN}✅ Stripe CLI installed${NC}"
        
        # Test webhook forwarding (requires Stripe CLI logged in)
        echo "To test webhooks locally, run:"
        echo -e "${BLUE}  stripe listen --forward-to localhost:3000/api/stripe/webhooks${NC}"
    else
        echo -e "${YELLOW}⚠️  Stripe CLI not installed (needed for webhook testing)${NC}"
        echo "Install with: brew install stripe/stripe-cli/stripe"
        ((WARNINGS++))
    fi
}

test_webhooks

# ====================
# SUMMARY
# ====================
echo ""
echo "======================================"
echo "📋 Integration Test Summary"
echo "======================================"

if [ $ERRORS -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}✅ All integrations working perfectly!${NC}"
        exit 0
    else
        echo -e "${YELLOW}⚠️  All critical integrations working with $WARNINGS warnings${NC}"
        echo "Review warnings above before deploying to production."
        exit 0
    fi
else
    echo -e "${RED}❌ Found $ERRORS critical errors and $WARNINGS warnings${NC}"
    echo "Fix the errors above before deploying."
    exit 1
fi