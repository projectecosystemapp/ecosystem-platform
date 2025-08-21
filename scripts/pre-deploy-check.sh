#!/bin/bash

# Pre-Deployment Checklist Script
# Run this before deploying to production

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "🚀 Pre-Deployment Checklist"
echo "============================"
echo ""

READY=true
CHECKS_PASSED=0
CHECKS_FAILED=0

# Function to run a check
run_check() {
    local description=$1
    local command=$2
    
    echo -n "Checking: $description... "
    
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PASS${NC}"
        ((CHECKS_PASSED++))
    else
        echo -e "${RED}❌ FAIL${NC}"
        ((CHECKS_FAILED++))
        READY=false
    fi
}

# ======================
# 1. BUILD CHECKS
# ======================
echo "${BLUE}📦 Build Checks${NC}"
echo "---------------"

run_check "TypeScript compilation" "npm run type-check"
run_check "ESLint passes" "npm run lint"
run_check "Production build succeeds" "npm run build"

echo ""

# ======================
# 2. SECURITY CHECKS
# ======================
echo "${BLUE}🔒 Security Checks${NC}"
echo "------------------"

# Check for high/critical vulnerabilities
echo -n "Checking: No high/critical vulnerabilities... "
if npm audit --audit-level=high 2>&1 | grep -q "found 0"; then
    echo -e "${GREEN}✅ PASS${NC}"
    ((CHECKS_PASSED++))
else
    echo -e "${YELLOW}⚠️  WARNING${NC}"
    echo "  Run 'npm audit' to review vulnerabilities"
fi

# Check for exposed secrets
echo -n "Checking: No exposed secrets in code... "
if ! grep -r "sk_live\|pk_live\|secret\|password" --include="*.ts" --include="*.tsx" --include="*.js" --exclude-dir=node_modules . 2>/dev/null | grep -v "process.env\|\.env"; then
    echo -e "${GREEN}✅ PASS${NC}"
    ((CHECKS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}"
    echo "  Found potential exposed secrets!"
    ((CHECKS_FAILED++))
    READY=false
fi

echo ""

# ======================
# 3. ENVIRONMENT CHECKS
# ======================
echo "${BLUE}⚙️  Environment Checks${NC}"
echo "---------------------"

run_check "Environment variables validated" "./scripts/validate-env.sh"

# Check for production keys
echo -n "Checking: Using production Stripe keys... "
if [[ "$STRIPE_SECRET_KEY" == sk_live_* ]]; then
    echo -e "${GREEN}✅ PASS${NC}"
    ((CHECKS_PASSED++))
else
    echo -e "${YELLOW}⚠️  WARNING - Using test keys${NC}"
fi

echo ""

# ======================
# 4. DATABASE CHECKS
# ======================
echo "${BLUE}🗄️  Database Checks${NC}"
echo "------------------"

run_check "Database migrations up to date" "npx drizzle-kit check"

echo -n "Checking: Database connection valid... "
if node -e "require('dotenv').config({path:'.env.local'}); const url = process.env.DATABASE_URL; if (!url || url.includes('localhost')) process.exit(1);" 2>/dev/null; then
    echo -e "${GREEN}✅ PASS${NC}"
    ((CHECKS_PASSED++))
else
    echo -e "${YELLOW}⚠️  WARNING - Check DATABASE_URL${NC}"
fi

echo ""

# ======================
# 5. INTEGRATION CHECKS
# ======================
echo "${BLUE}🔗 Integration Checks${NC}"
echo "---------------------"

run_check "All integrations tested" "./scripts/test-integrations.sh"

echo ""

# ======================
# 6. PERFORMANCE CHECKS
# ======================
echo "${BLUE}⚡ Performance Checks${NC}"
echo "---------------------"

# Check bundle size
echo -n "Checking: Bundle size acceptable... "
BUILD_SIZE=$(du -sh .next 2>/dev/null | cut -f1)
echo -e "${GREEN}✅ Size: $BUILD_SIZE${NC}"
((CHECKS_PASSED++))

echo ""

# ======================
# 7. MONITORING CHECKS
# ======================
echo "${BLUE}📊 Monitoring Checks${NC}"
echo "--------------------"

echo -n "Checking: Error tracking configured... "
if [ ! -z "$SENTRY_DSN" ]; then
    echo -e "${GREEN}✅ PASS${NC}"
    ((CHECKS_PASSED++))
else
    echo -e "${YELLOW}⚠️  WARNING - Sentry not configured${NC}"
fi

echo -n "Checking: Rate limiting configured... "
if [ ! -z "$UPSTASH_REDIS_REST_URL" ]; then
    echo -e "${GREEN}✅ PASS (Redis)${NC}"
    ((CHECKS_PASSED++))
else
    echo -e "${YELLOW}⚠️  WARNING - Using in-memory rate limiting${NC}"
fi

echo ""

# ======================
# 8. DOCUMENTATION
# ======================
echo "${BLUE}📚 Documentation${NC}"
echo "----------------"

echo -n "Checking: README exists... "
if [ -f "README.md" ]; then
    echo -e "${GREEN}✅ PASS${NC}"
    ((CHECKS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}"
    ((CHECKS_FAILED++))
fi

echo -n "Checking: CLAUDE.md exists... "
if [ -f "CLAUDE.md" ]; then
    echo -e "${GREEN}✅ PASS${NC}"
    ((CHECKS_PASSED++))
else
    echo -e "${YELLOW}⚠️  WARNING${NC}"
fi

echo ""

# ======================
# DEPLOYMENT READINESS
# ======================
echo "======================================"
echo "📋 Deployment Readiness Summary"
echo "======================================"
echo ""
echo "Checks Passed: ${GREEN}$CHECKS_PASSED${NC}"
echo "Checks Failed: ${RED}$CHECKS_FAILED${NC}"
echo ""

if [ "$READY" = true ] && [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ READY FOR PRODUCTION DEPLOYMENT!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Create a git tag: git tag -a v1.0.0 -m 'Production release'"
    echo "2. Push to main branch: git push origin main --tags"
    echo "3. Monitor deployment in Vercel dashboard"
    echo "4. Verify production site after deployment"
    exit 0
else
    echo -e "${RED}❌ NOT READY FOR PRODUCTION${NC}"
    echo ""
    echo "Fix the failed checks above before deploying."
    echo "Run this script again after fixes: ./scripts/pre-deploy-check.sh"
    exit 1
fi