#!/bin/bash

# Load Testing Script
# Runs k6 load tests against the application

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "🚀 Load Testing Suite"
echo "====================="
echo ""

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    echo -e "${YELLOW}⚠️  k6 is not installed${NC}"
    echo ""
    echo "Install k6:"
    echo "  macOS:   brew install k6"
    echo "  Linux:   sudo snap install k6"
    echo "  Windows: choco install k6"
    echo ""
    echo "Or download from: https://k6.io/docs/getting-started/installation/"
    exit 1
fi

# Default to localhost
BASE_URL=${1:-http://localhost:3000}

echo -e "${BLUE}Testing against: $BASE_URL${NC}"
echo ""

# Check if server is running
echo -n "Checking if server is reachable... "
if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL" | grep -q "200\|301\|302"; then
    echo -e "${GREEN}✅ Server is running${NC}"
else
    echo -e "${RED}❌ Server is not reachable${NC}"
    echo "Start the server with: npm run dev"
    exit 1
fi

echo ""

# Menu for test selection
echo "Select test type:"
echo "1) Performance Test (100-200 users, 15 min)"
echo "2) Stress Test (up to 800 users, 30 min)"
echo "3) Spike Test (instant 1000 users)"
echo "4) Soak Test (100 users, 2 hours)"
echo "5) Custom Test"
echo ""
read -p "Enter choice [1-5]: " choice

case $choice in
    1)
        echo ""
        echo -e "${BLUE}Running Performance Test...${NC}"
        echo "Expected duration: 15 minutes"
        echo ""
        k6 run -e BASE_URL="$BASE_URL" k6/load-test.js
        ;;
    2)
        echo ""
        echo -e "${YELLOW}Running Stress Test...${NC}"
        echo "Expected duration: 30 minutes"
        echo "WARNING: This will put significant load on the server!"
        echo ""
        read -p "Continue? (y/n): " confirm
        if [ "$confirm" = "y" ]; then
            k6 run -e BASE_URL="$BASE_URL" k6/stress-test.js
        fi
        ;;
    3)
        echo ""
        echo -e "${RED}Running Spike Test...${NC}"
        echo "WARNING: This will send 1000 concurrent requests immediately!"
        echo ""
        read -p "Continue? (y/n): " confirm
        if [ "$confirm" = "y" ]; then
            k6 run -e BASE_URL="$BASE_URL" --vus 1000 --duration 30s k6/load-test.js
        fi
        ;;
    4)
        echo ""
        echo -e "${BLUE}Running Soak Test...${NC}"
        echo "Expected duration: 2 hours"
        echo ""
        k6 run -e BASE_URL="$BASE_URL" --vus 100 --duration 2h k6/load-test.js
        ;;
    5)
        echo ""
        echo "Custom Test Configuration"
        read -p "Number of virtual users: " vus
        read -p "Test duration (e.g., 30s, 5m, 1h): " duration
        echo ""
        echo -e "${BLUE}Running custom test with $vus users for $duration${NC}"
        k6 run -e BASE_URL="$BASE_URL" --vus "$vus" --duration "$duration" k6/load-test.js
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}✅ Load test completed!${NC}"
echo ""
echo "Review the results above for:"
echo "- Response time percentiles (p95, p99)"
echo "- Error rates"
echo "- Requests per second"
echo "- Failed requests"
echo ""
echo "HTML report available at: ./k6-report.html (if generated)"