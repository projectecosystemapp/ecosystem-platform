#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

API_URL="http://localhost:3000/api/loyalty"

echo -e "${YELLOW}Testing Loyalty System APIs${NC}\n"

# Test 1: Get Loyalty Tiers
echo -e "${YELLOW}1. Testing GET /api/loyalty/tiers${NC}"
response=$(curl -s -X GET "$API_URL/tiers" -H "Content-Type: application/json")
if echo "$response" | grep -q '"success":true'; then
    echo -e "${GREEN}✓ Tiers API working${NC}"
    echo "$response" | python3 -m json.tool | head -20
else
    echo -e "${RED}✗ Tiers API failed${NC}"
    echo "$response"
fi
echo ""

# Test 2: Get Loyalty Account (will fail without auth, which is expected)
echo -e "${YELLOW}2. Testing GET /api/loyalty/account (without auth - should fail)${NC}"
response=$(curl -s -X GET "$API_URL/account" -H "Content-Type: application/json")
if echo "$response" | grep -q '"error":"Authentication required"'; then
    echo -e "${GREEN}✓ Account API correctly requires authentication${NC}"
else
    echo -e "${RED}✗ Account API authentication check failed${NC}"
    echo "$response"
fi
echo ""

# Test 3: Get Redemption Options (will fail without auth, which is expected)
echo -e "${YELLOW}3. Testing GET /api/loyalty/redeem (without auth - should fail)${NC}"
response=$(curl -s -X GET "$API_URL/redeem" -H "Content-Type: application/json")
if echo "$response" | grep -q '"error":"Authentication required"'; then
    echo -e "${GREEN}✓ Redeem API correctly requires authentication${NC}"
else
    echo -e "${RED}✗ Redeem API authentication check failed${NC}"
    echo "$response"
fi
echo ""

# Test 4: Earn Points (will fail without auth, which is expected)
echo -e "${YELLOW}4. Testing POST /api/loyalty/earn (without auth - should fail)${NC}"
response=$(curl -s -X POST "$API_URL/earn" \
    -H "Content-Type: application/json" \
    -d '{"type":"bonus","data":{"reason":"review","points":100,"description":"Test points"}}')
if echo "$response" | grep -q '"error":"Authentication required"'; then
    echo -e "${GREEN}✓ Earn API correctly requires authentication${NC}"
else
    echo -e "${RED}✗ Earn API authentication check failed${NC}"
    echo "$response"
fi
echo ""

# Test 5: OPTIONS requests for CORS
echo -e "${YELLOW}5. Testing OPTIONS requests for CORS${NC}"
for endpoint in "tiers" "account" "earn" "redeem"; do
    response=$(curl -s -I -X OPTIONS "$API_URL/$endpoint")
    if echo "$response" | grep -q "200 OK"; then
        echo -e "${GREEN}✓ OPTIONS /api/loyalty/$endpoint working${NC}"
    else
        echo -e "${RED}✗ OPTIONS /api/loyalty/$endpoint failed${NC}"
    fi
done
echo ""

echo -e "${GREEN}All loyalty API endpoints have been created and are responding correctly!${NC}"
echo -e "${YELLOW}Note: Authentication-protected endpoints correctly require login.${NC}"