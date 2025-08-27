#!/bin/bash

# =================================================================
# Payment Flow Testing Script for Ecosystem Marketplace
# =================================================================
# This script tests the payment flows with actual API calls
# Make sure the development server is running: npm run dev
# Make sure Stripe webhook forwarding is active: npm run stripe:listen
# =================================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# API Base URL
BASE_URL="${BASE_URL:-http://localhost:3000}"

# Test data (you'll need to update these with actual IDs from your database)
PROVIDER_ID="${PROVIDER_ID:-550e8400-e29b-41d4-a716-446655440000}"
SERVICE_ID="${SERVICE_ID:-550e8400-e29b-41d4-a716-446655440001}"
BOOKING_DATE=$(date -u +"%Y-%m-%dT10:00:00Z")

echo -e "${BLUE}==================================================================${NC}"
echo -e "${BLUE}       Ecosystem Marketplace - Payment Flow Testing${NC}"
echo -e "${BLUE}==================================================================${NC}"
echo ""

# Function to test guest checkout
test_guest_checkout() {
    echo -e "${YELLOW}Testing Guest Checkout (110% - includes 10% surcharge)...${NC}"
    
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/checkout/guest" \
        -H "Content-Type: application/json" \
        -d '{
            "guestEmail": "test.guest@example.com",
            "guestName": "Test Guest",
            "guestPhone": "+1234567890",
            "providerId": "'$PROVIDER_ID'",
            "serviceId": "'$SERVICE_ID'",
            "bookingDate": "'$BOOKING_DATE'",
            "startTime": "10:00",
            "endTime": "11:00",
            "customerNotes": "Test booking from script",
            "referrer": "test_script",
            "utmSource": "manual_test"
        }')
    
    if echo "$RESPONSE" | grep -q "clientSecret"; then
        echo -e "${GREEN}✅ Guest checkout initiated successfully${NC}"
        echo "$RESPONSE" | python3 -m json.tool | head -20
        
        # Extract values for validation
        CLIENT_SECRET=$(echo "$RESPONSE" | grep -o '"clientSecret":"[^"]*' | cut -d'"' -f4)
        BOOKING_ID=$(echo "$RESPONSE" | grep -o '"bookingId":"[^"]*' | cut -d'"' -f4)
        
        echo -e "${GREEN}Booking ID: $BOOKING_ID${NC}"
        echo -e "${GREEN}Payment Intent Secret: ${CLIENT_SECRET:0:30}...${NC}"
        
        # Check fee breakdown
        if echo "$RESPONSE" | grep -q '"guestSurcharge"'; then
            echo -e "${GREEN}✅ Guest surcharge correctly applied${NC}"
        else
            echo -e "${RED}❌ Guest surcharge missing${NC}"
        fi
    else
        echo -e "${RED}❌ Guest checkout failed${NC}"
        echo "$RESPONSE" | python3 -m json.tool
    fi
    echo ""
}

# Function to test customer checkout
test_customer_checkout() {
    echo -e "${YELLOW}Testing Customer Checkout (100% - no surcharge)...${NC}"
    echo -e "${YELLOW}Note: This requires authentication. Using mock auth for testing.${NC}"
    
    # This would need a valid auth token in production
    # For testing, you might need to modify this based on your auth setup
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/checkout/customer" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer test_token" \
        -d '{
            "providerId": "'$PROVIDER_ID'",
            "serviceId": "'$SERVICE_ID'",
            "bookingDate": "'$BOOKING_DATE'",
            "startTime": "14:00",
            "endTime": "15:00",
            "customerNotes": "Test customer booking",
            "referrer": "test_script"
        }')
    
    if echo "$RESPONSE" | grep -q "Authentication required"; then
        echo -e "${YELLOW}⚠️  Customer checkout requires valid authentication${NC}"
        echo "To test customer checkout:"
        echo "1. Log in to the application"
        echo "2. Use the browser developer tools to get your auth token"
        echo "3. Replace 'test_token' with your actual token"
    elif echo "$RESPONSE" | grep -q "clientSecret"; then
        echo -e "${GREEN}✅ Customer checkout initiated successfully${NC}"
        echo "$RESPONSE" | python3 -m json.tool | head -20
        
        # Check that there's no guest surcharge
        if echo "$RESPONSE" | grep -q '"guestSurcharge"'; then
            echo -e "${RED}❌ Unexpected guest surcharge for authenticated customer${NC}"
        else
            echo -e "${GREEN}✅ No guest surcharge (correct for customer)${NC}"
        fi
    else
        echo -e "${RED}❌ Customer checkout failed${NC}"
        echo "$RESPONSE" | python3 -m json.tool
    fi
    echo ""
}

# Function to test fee calculations
test_fee_calculations() {
    echo -e "${YELLOW}Testing Fee Calculations...${NC}"
    
    # Test different amounts
    AMOUNTS=(50 100 150 257.50 999.99)
    
    for AMOUNT in "${AMOUNTS[@]}"; do
        echo -e "${BLUE}Base Amount: \$$AMOUNT${NC}"
        
        # Calculate expected values
        GUEST_TOTAL=$(echo "scale=2; $AMOUNT * 1.10" | bc)
        GUEST_SURCHARGE=$(echo "scale=2; $AMOUNT * 0.10" | bc)
        PLATFORM_FEE=$(echo "scale=2; $AMOUNT * 0.10" | bc)
        PROVIDER_PAYOUT=$(echo "scale=2; $AMOUNT * 0.90" | bc)
        
        echo "  Guest Total: \$$GUEST_TOTAL (includes \$$GUEST_SURCHARGE surcharge)"
        echo "  Customer Total: \$$AMOUNT (no surcharge)"
        echo "  Platform Fee: \$$PLATFORM_FEE"
        echo "  Provider Payout: \$$PROVIDER_PAYOUT"
        echo ""
    done
}

# Function to test webhook endpoint
test_webhook_endpoint() {
    echo -e "${YELLOW}Testing Webhook Endpoint Security...${NC}"
    
    # Test without signature (should fail)
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/stripe/webhooks" \
        -H "Content-Type: application/json" \
        -d '{"id": "evt_test", "type": "payment_intent.succeeded"}')
    
    if echo "$RESPONSE" | grep -q "Unauthorized"; then
        echo -e "${GREEN}✅ Webhook correctly rejects unsigned requests${NC}"
    else
        echo -e "${RED}❌ Webhook security issue - accepted unsigned request${NC}"
    fi
    
    # Test with invalid signature (should fail)
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/stripe/webhooks" \
        -H "Content-Type: application/json" \
        -H "Stripe-Signature: invalid_signature" \
        -d '{"id": "evt_test", "type": "payment_intent.succeeded"}')
    
    if echo "$RESPONSE" | grep -q "Unauthorized"; then
        echo -e "${GREEN}✅ Webhook correctly rejects invalid signatures${NC}"
    else
        echo -e "${RED}❌ Webhook security issue - accepted invalid signature${NC}"
    fi
    echo ""
}

# Function to test minimum transaction amount
test_minimum_amount() {
    echo -e "${YELLOW}Testing Minimum Transaction Amount...${NC}"
    
    # Test below minimum ($0.49)
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/checkout/guest" \
        -H "Content-Type: application/json" \
        -d '{
            "guestEmail": "test@example.com",
            "guestName": "Test User",
            "providerId": "'$PROVIDER_ID'",
            "serviceId": "'$SERVICE_ID'",
            "bookingDate": "'$BOOKING_DATE'",
            "startTime": "10:00",
            "endTime": "11:00",
            "baseAmount": 0.49
        }')
    
    if echo "$RESPONSE" | grep -q "Minimum transaction"; then
        echo -e "${GREEN}✅ Correctly rejects transactions below \$0.50${NC}"
    else
        echo -e "${RED}❌ Failed to enforce minimum transaction amount${NC}"
    fi
    echo ""
}

# Function to check health endpoints
test_health_check() {
    echo -e "${YELLOW}Testing Health Endpoints...${NC}"
    
    # API Health
    RESPONSE=$(curl -s "$BASE_URL/api/health")
    if echo "$RESPONSE" | grep -q "ok"; then
        echo -e "${GREEN}✅ API health check passed${NC}"
    else
        echo -e "${RED}❌ API health check failed${NC}"
    fi
    
    # Webhook Health
    RESPONSE=$(curl -s "$BASE_URL/api/webhooks/health")
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Webhook endpoint accessible${NC}"
    else
        echo -e "${RED}❌ Webhook endpoint not accessible${NC}"
    fi
    echo ""
}

# Main execution
main() {
    echo -e "${BLUE}Starting Payment Flow Tests...${NC}"
    echo -e "${BLUE}Server: $BASE_URL${NC}"
    echo -e "${BLUE}Date: $(date)${NC}"
    echo ""
    
    # Run all tests
    test_health_check
    test_fee_calculations
    test_guest_checkout
    test_customer_checkout
    test_webhook_endpoint
    test_minimum_amount
    
    echo -e "${BLUE}==================================================================${NC}"
    echo -e "${GREEN}Testing Complete!${NC}"
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "1. Check Stripe Dashboard for payment intents"
    echo "2. Verify webhook events in Stripe CLI"
    echo "3. Check database for booking records"
    echo "4. Review application logs for any errors"
    echo ""
    echo -e "${YELLOW}Test with Stripe Cards:${NC}"
    echo "  Success: 4242 4242 4242 4242"
    echo "  Decline: 4000 0000 0000 0002"
    echo "  3D Secure: 4000 0025 0000 3155"
    echo -e "${BLUE}==================================================================${NC}"
}

# Check if required tools are installed
command -v curl >/dev/null 2>&1 || { echo -e "${RED}curl is required but not installed. Aborting.${NC}" >&2; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo -e "${YELLOW}python3 not found, JSON formatting will be limited.${NC}" >&2; }
command -v bc >/dev/null 2>&1 || { echo -e "${RED}bc is required for calculations. Please install it.${NC}" >&2; exit 1; }

# Run main function
main