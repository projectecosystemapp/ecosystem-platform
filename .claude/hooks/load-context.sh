#!/bin/bash
# .claude/hooks/load-context.sh
# Load project context at session startup
# Provides immediate visibility into marketplace status

cd "$CLAUDE_PROJECT_DIR"

echo "═══════════════════════════════════════════════════════════════"
echo "       🚀 ECOSYSTEM MARKETPLACE - PROJECT STATUS"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Check Node.js and npm versions
echo "## Development Environment"
NODE_VERSION=$(node --version 2>/dev/null || echo "Not installed")
NPM_VERSION=$(npm --version 2>/dev/null || echo "Not installed")
echo "   Node.js: $NODE_VERSION"
echo "   npm:     v$NPM_VERSION"
echo ""

# Check database connection
echo "## Database Status"
if [ -f ".env.local" ] || [ -f ".env" ]; then
  # Try to connect to database using the connection test
  DB_TEST=$(npx tsx -e "
    import { db } from './db/db';
    import { providers } from './db/schema/providers-schema';
    db.select().from(providers).limit(1).then(() => console.log('CONNECTED')).catch(() => console.log('FAILED'));
  " 2>/dev/null)
  
  if [[ "$DB_TEST" == *"CONNECTED"* ]]; then
    echo "   ✅ Database connected"
    
    # Get provider count
    PROVIDER_COUNT=$(npx tsx -e "
      import { db } from './db/db';
      import { providers } from './db/schema/providers-schema';
      db.select().from(providers).then(r => console.log(r.length)).catch(() => console.log('0'));
    " 2>/dev/null | tail -1)
    echo "   📊 Providers in database: ${PROVIDER_COUNT:-0}"
    
    # Get bookings count
    BOOKING_COUNT=$(npx tsx -e "
      import { db } from './db/db';
      import { bookings } from './db/schema/bookings-schema';
      db.select().from(bookings).then(r => console.log(r.length)).catch(() => console.log('0'));
    " 2>/dev/null | tail -1)
    echo "   📅 Total bookings: ${BOOKING_COUNT:-0}"
  else
    echo "   ❌ Database connection failed"
    echo "   Run: npm run db:migrate"
  fi
else
  echo "   ⚠️  No environment file found"
  echo "   Create .env.local with your database credentials"
fi
echo ""

# Check for pending migrations
echo "## Database Migrations"
if [ -d "db/migrations" ]; then
  MIGRATION_COUNT=$(ls -1 db/migrations/*.sql 2>/dev/null | wc -l)
  LATEST_MIGRATION=$(ls -1t db/migrations/*.sql 2>/dev/null | head -1 | xargs basename 2>/dev/null || echo "None")
  echo "   Total migrations: $MIGRATION_COUNT"
  echo "   Latest: $LATEST_MIGRATION"
else
  echo "   ⚠️  No migrations directory found"
fi
echo ""

# Check Stripe configuration
echo "## Payment System (Stripe)"
if [ -f ".env.local" ] || [ -f ".env" ]; then
  if grep -q "STRIPE_SECRET_KEY" .env.local .env 2>/dev/null; then
    echo "   ✅ Stripe keys configured"
    if grep -q "STRIPE_WEBHOOK_SECRET" .env.local .env 2>/dev/null; then
      echo "   ✅ Webhook secret configured"
    else
      echo "   ⚠️  Webhook secret missing - run: npm run stripe:listen"
    fi
  else
    echo "   ❌ Stripe not configured"
    echo "   Run: npm run stripe:setup"
  fi
else
  echo "   ❌ No environment configuration"
fi
echo ""

# Check authentication (Clerk)
echo "## Authentication (Clerk)"
if [ -f ".env.local" ] || [ -f ".env" ]; then
  if grep -q "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" .env.local .env 2>/dev/null; then
    echo "   ✅ Clerk configured"
  else
    echo "   ❌ Clerk not configured"
    echo "   Add Clerk keys to .env.local"
  fi
else
  echo "   ❌ No environment configuration"
fi
echo ""

# Git repository status
echo "## Version Control"
if [ -d ".git" ]; then
  CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
  UNCOMMITTED=$(git status --porcelain 2>/dev/null | wc -l)
  LAST_COMMIT=$(git log -1 --pretty=format:"%h - %s (%ar)" 2>/dev/null || echo "No commits")
  
  echo "   Branch: $CURRENT_BRANCH"
  echo "   Uncommitted changes: $UNCOMMITTED files"
  echo "   Last commit: $LAST_COMMIT"
  
  # Show recent commits
  echo ""
  echo "   Recent commits:"
  git log --oneline -5 2>/dev/null | sed 's/^/     /'
else
  echo "   ❌ Not a git repository"
fi
echo ""

# Check for running services
echo "## Running Services"
SERVICES_RUNNING=false

if pgrep -f "next dev" > /dev/null 2>&1; then
  echo "   ✅ Next.js dev server running"
  SERVICES_RUNNING=true
else
  echo "   ⭕ Next.js dev server not running (npm run dev)"
fi

if pgrep -f "stripe listen" > /dev/null 2>&1; then
  echo "   ✅ Stripe webhook listener running"
  SERVICES_RUNNING=true
else
  echo "   ⭕ Stripe webhooks not listening (npm run stripe:listen)"
fi

if pgrep -f "supabase" > /dev/null 2>&1; then
  echo "   ✅ Supabase running"
  SERVICES_RUNNING=true
else
  echo "   ⭕ Supabase not running (npm run supabase:start)"
fi

if [ "$SERVICES_RUNNING" = false ]; then
  echo ""
  echo "   💡 Start development with: npm run dev"
fi
echo ""

# Check for TODO items in code
echo "## Code Quality Metrics"
TODO_COUNT=$(grep -r "TODO" --include="*.ts" --include="*.tsx" . 2>/dev/null | wc -l)
FIXME_COUNT=$(grep -r "FIXME" --include="*.ts" --include="*.tsx" . 2>/dev/null | wc -l)
CONSOLE_LOG_COUNT=$(grep -r "console.log" --include="*.ts" --include="*.tsx" app/ components/ lib/ 2>/dev/null | grep -v "//" | wc -l)

echo "   📝 TODO comments: $TODO_COUNT"
echo "   🔧 FIXME comments: $FIXME_COUNT"
if [ $CONSOLE_LOG_COUNT -gt 0 ]; then
  echo "   ⚠️  console.log statements: $CONSOLE_LOG_COUNT (should be removed)"
fi

# Quick TypeScript check
TSC_ERRORS=$(npx tsc --noEmit 2>&1 | grep -c "error TS" || echo 0)
if [ $TSC_ERRORS -gt 0 ]; then
  echo "   ❌ TypeScript errors: $TSC_ERRORS"
else
  echo "   ✅ No TypeScript errors"
fi
echo ""

# Show important files to remember
echo "## Key Project Files"
echo "   📄 CLAUDE.md         - AI development standards"
echo "   📊 ERD.mmd           - Database schema diagram"
echo "   🔧 drizzle.config.ts - Database configuration"
echo "   🎯 package.json      - Available npm scripts"
echo "   🚀 middleware.ts     - Auth & routing rules"
echo ""

# Platform configuration reminder
echo "## Platform Configuration"
echo "   💰 Platform fee: 7%"
echo "   ⏰ Escrow release: After service completion"
echo "   🌍 Marketplace type: Two-sided (Providers ↔ Customers)"
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "Ready to build! Use 'npm run dev' to start the development server."
echo "═══════════════════════════════════════════════════════════════"