#!/bin/bash

# Environment Variable Validation Script
# This script validates that all required environment variables are set
# and contain valid values (not placeholders or TODOs)

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Validating Environment Variables..."
echo "======================================"

ERRORS=0
WARNINGS=0

# Function to check if variable exists and is not empty
check_required() {
    local var_name=$1
    local var_value="${!var_name}"
    
    if [ -z "$var_value" ]; then
        echo -e "${RED}❌ $var_name is not set${NC}"
        ((ERRORS++))
        return 1
    elif [[ "$var_value" == *"TODO"* ]] || [[ "$var_value" == *"REPLACE"* ]] || [[ "$var_value" == *"YOUR"* ]]; then
        echo -e "${RED}❌ $var_name contains placeholder value: $var_value${NC}"
        ((ERRORS++))
        return 1
    else
        echo -e "${GREEN}✅ $var_name is set${NC}"
        return 0
    fi
}

# Function to check optional variables
check_optional() {
    local var_name=$1
    local var_value="${!var_name}"
    
    if [ -z "$var_value" ]; then
        echo -e "${YELLOW}⚠️  $var_name is not set (optional)${NC}"
        ((WARNINGS++))
    else
        echo -e "${GREEN}✅ $var_name is set${NC}"
    fi
}

# Function to validate URL format
validate_url() {
    local var_name=$1
    local url="${!var_name}"
    
    if [[ "$url" =~ ^https?:// ]]; then
        echo -e "${GREEN}✅ $var_name has valid URL format${NC}"
        return 0
    else
        echo -e "${RED}❌ $var_name has invalid URL format: $url${NC}"
        ((ERRORS++))
        return 1
    fi
}

# Function to check if Stripe key is live or test
check_stripe_key() {
    local var_name=$1
    local key="${!var_name}"
    
    if [[ "$key" == sk_live_* ]] || [[ "$key" == pk_live_* ]]; then
        echo -e "${GREEN}✅ $var_name is a LIVE key${NC}"
    elif [[ "$key" == sk_test_* ]] || [[ "$key" == pk_test_* ]]; then
        echo -e "${YELLOW}⚠️  $var_name is a TEST key (not for production!)${NC}"
        ((WARNINGS++))
    else
        echo -e "${RED}❌ $var_name has invalid format: $key${NC}"
        ((ERRORS++))
    fi
}

# Load environment variables
if [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
    echo "Loaded .env.local"
elif [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
    echo "Loaded .env.production"
elif [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
    echo "Loaded .env"
else
    echo -e "${RED}❌ No environment file found!${NC}"
    exit 1
fi

echo ""
echo "🗄️  Database Configuration"
echo "--------------------------"
check_required "DATABASE_URL"
if [ ! -z "$DATABASE_URL" ]; then
    if [[ "$DATABASE_URL" == *"localhost"* ]] || [[ "$DATABASE_URL" == *"127.0.0.1"* ]]; then
        echo -e "${YELLOW}⚠️  DATABASE_URL points to localhost (not for production!)${NC}"
        ((WARNINGS++))
    fi
fi

echo ""
echo "🔐 Supabase Configuration"
echo "-------------------------"
check_required "NEXT_PUBLIC_SUPABASE_URL"
check_required "NEXT_PUBLIC_SUPABASE_ANON_KEY"
check_required "SUPABASE_SERVICE_ROLE_KEY"
validate_url "NEXT_PUBLIC_SUPABASE_URL"

echo ""
echo "👤 Clerk Authentication"
echo "-----------------------"
check_required "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
check_required "CLERK_SECRET_KEY"
check_required "NEXT_PUBLIC_CLERK_SIGN_IN_URL"
check_required "NEXT_PUBLIC_CLERK_SIGN_UP_URL"
check_required "NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL"
check_required "NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL"

echo ""
echo "💳 Stripe Configuration"
echo "------------------------"
check_required "STRIPE_SECRET_KEY"
check_required "STRIPE_WEBHOOK_SECRET"
check_required "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"
check_stripe_key "STRIPE_SECRET_KEY"
check_stripe_key "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"

# Stripe Connect
echo ""
echo "🔗 Stripe Connect"
echo "-----------------"
check_optional "STRIPE_CONNECT_CLIENT_ID"
if [ ! -z "$STRIPE_CONNECT_CLIENT_ID" ]; then
    if [[ "$STRIPE_CONNECT_CLIENT_ID" == ca_* ]]; then
        echo -e "${GREEN}✅ STRIPE_CONNECT_CLIENT_ID has valid format${NC}"
    else
        echo -e "${RED}❌ STRIPE_CONNECT_CLIENT_ID has invalid format${NC}"
        ((ERRORS++))
    fi
fi

# Payment Links
check_optional "NEXT_PUBLIC_STRIPE_PAYMENT_LINK_MONTHLY"
check_optional "NEXT_PUBLIC_STRIPE_PAYMENT_LINK_YEARLY"
check_optional "NEXT_PUBLIC_STRIPE_PORTAL_LINK"

echo ""
echo "⚙️  Platform Configuration"
echo "--------------------------"
check_required "ACTIVE_PAYMENT_PROVIDER"
check_required "NEXT_PUBLIC_PLATFORM_FEE_PERCENT"
check_required "NEXT_PUBLIC_APP_URL"
validate_url "NEXT_PUBLIC_APP_URL"

echo ""
echo "📧 Email Service (Optional)"
echo "---------------------------"
check_optional "RESEND_API_KEY"

echo ""
echo "🍪 Clerk Session Config (Development)"
echo "--------------------------------------"
check_optional "CLERK_COOKIE_DOMAIN"
check_optional "CLERK_SESSION_TOKEN_LEEWAY"
check_optional "CLERK_ROTATE_SESSION_INTERVAL"

echo ""
echo "🔄 Redis/Upstash (For Production)"
echo "----------------------------------"
check_optional "UPSTASH_REDIS_REST_URL"
check_optional "UPSTASH_REDIS_REST_TOKEN"
if [ -z "$UPSTASH_REDIS_REST_URL" ] || [ -z "$UPSTASH_REDIS_REST_TOKEN" ]; then
    echo -e "${YELLOW}⚠️  Redis not configured - using in-memory rate limiting (NOT for production!)${NC}"
    ((WARNINGS++))
fi

echo ""
echo "📊 Monitoring (For Production)"
echo "-------------------------------"
check_optional "SENTRY_DSN"
check_optional "NEXT_PUBLIC_SENTRY_DSN"
if [ -z "$SENTRY_DSN" ]; then
    echo -e "${YELLOW}⚠️  Sentry not configured - no error tracking in production${NC}"
    ((WARNINGS++))
fi

echo ""
echo "======================================"
echo "📋 Validation Summary"
echo "======================================"

if [ $ERRORS -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}✅ All environment variables are properly configured!${NC}"
        exit 0
    else
        echo -e "${YELLOW}⚠️  Configuration complete with $WARNINGS warnings${NC}"
        echo "Review warnings above before deploying to production."
        exit 0
    fi
else
    echo -e "${RED}❌ Found $ERRORS errors and $WARNINGS warnings${NC}"
    echo "Fix the errors above before proceeding."
    exit 1
fi