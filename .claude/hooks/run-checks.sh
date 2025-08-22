#!/bin/bash
# .claude/hooks/run-checks.sh
# Post-response validation and reminders
# Runs after Claude responds to remind about necessary actions

cd "$CLAUDE_PROJECT_DIR"

# Track if we have any important messages
HAS_MESSAGES=false

echo ""
echo "────────────────────────────────────────────────────────"
echo "               📋 POST-RESPONSE CHECKS"
echo "────────────────────────────────────────────────────────"
echo ""

# Check if package.json was modified
if git diff --name-only 2>/dev/null | grep -q "package.json"; then
  echo "📦 REMINDER: package.json was modified"
  echo "   Run: npm install"
  echo ""
  HAS_MESSAGES=true
fi

# Check if package-lock.json is out of sync
if git diff --name-only 2>/dev/null | grep -q "package-lock.json"; then
  echo "🔒 package-lock.json has changes"
  echo "   This is normal after npm install"
  echo ""
  HAS_MESSAGES=true
fi

# Check for TypeScript errors
TSC_OUTPUT=$(npx tsc --noEmit 2>&1)
TSC_ERRORS=$(echo "$TSC_OUTPUT" | grep -c "error TS" || echo 0)
if [ $TSC_ERRORS -gt 0 ]; then
  echo "❌ TypeScript errors detected: $TSC_ERRORS"
  echo "   Run: npm run type-check"
  echo "   First few errors:"
  echo "$TSC_OUTPUT" | grep "error TS" | head -3 | sed 's/^/     /'
  echo ""
  HAS_MESSAGES=true
fi

# Check for new TODO comments
NEW_TODOS=$(git diff 2>/dev/null | grep "^+" | grep -c "TODO" || echo 0)
if [ $NEW_TODOS -gt 0 ]; then
  echo "📝 New TODO comments added: $NEW_TODOS"
  echo "   Review with: git diff | grep TODO"
  echo ""
  HAS_MESSAGES=true
fi

# Check for database migration files
if git diff --name-only 2>/dev/null | grep -q "db/migrations/.*\.sql"; then
  echo "🗄️  Database migration files modified"
  echo "   Run: npm run db:migrate"
  echo "   Warning: Be careful with production migrations!"
  echo ""
  HAS_MESSAGES=true
fi

# Check for uncommitted changes in critical files
CRITICAL_CHANGES=$(git diff --name-only 2>/dev/null | grep -E "(middleware\.ts|drizzle\.config\.ts|\.env)" || true)
if [ -n "$CRITICAL_CHANGES" ]; then
  echo "⚠️  Uncommitted changes in critical files:"
  echo "$CRITICAL_CHANGES" | sed 's/^/     /'
  echo "   Review carefully before committing"
  echo ""
  HAS_MESSAGES=true
fi

# Check if any test files were modified
if git diff --name-only 2>/dev/null | grep -q "\.test\.\(ts\|tsx\)\|\.spec\.\(ts\|tsx\)"; then
  echo "🧪 Test files modified"
  echo "   Run: npm test"
  echo ""
  HAS_MESSAGES=true
fi

# Check for console.log in staged files
if git diff --cached 2>/dev/null | grep "^+" | grep -q "console\.log"; then
  echo "⚠️  console.log found in staged changes"
  echo "   Remove before committing to production"
  echo ""
  HAS_MESSAGES=true
fi

# Check if Stripe webhook secret is missing but Stripe is configured
if grep -q "STRIPE_SECRET_KEY" .env.local .env 2>/dev/null; then
  if ! grep -q "STRIPE_WEBHOOK_SECRET" .env.local .env 2>/dev/null; then
    echo "💳 Stripe configured but webhook secret missing"
    echo "   Run: npm run stripe:listen"
    echo "   Copy the webhook secret to .env.local"
    echo ""
    HAS_MESSAGES=true
  fi
fi

# Check for services that should be running
NEXT_RUNNING=$(pgrep -f "next dev" > /dev/null 2>&1 && echo "yes" || echo "no")
if [ "$NEXT_RUNNING" = "no" ]; then
  # Check if any source files were just modified
  if git diff --name-only 2>/dev/null | grep -qE "\.(tsx?|jsx?|css)$"; then
    echo "💡 Source files modified but dev server not running"
    echo "   Start with: npm run dev"
    echo ""
    HAS_MESSAGES=true
  fi
fi

# Check for linting issues in modified files
MODIFIED_TS_FILES=$(git diff --name-only 2>/dev/null | grep -E "\.(ts|tsx)$" | head -5)
if [ -n "$MODIFIED_TS_FILES" ]; then
  LINT_ERRORS=0
  for FILE in $MODIFIED_TS_FILES; do
    if [ -f "$FILE" ]; then
      LINT_OUTPUT=$(npx eslint "$FILE" 2>&1 || true)
      if echo "$LINT_OUTPUT" | grep -q "error"; then
        LINT_ERRORS=$((LINT_ERRORS + 1))
      fi
    fi
  done
  
  if [ $LINT_ERRORS -gt 0 ]; then
    echo "🔍 ESLint issues in $LINT_ERRORS modified file(s)"
    echo "   Run: npm run lint"
    echo ""
    HAS_MESSAGES=true
  fi
fi

# Check for potential security issues
SENSITIVE_PATTERNS=$(git diff 2>/dev/null | grep "^+" | grep -E "(api_key|secret|password|token)" | grep -v "process\.env" | wc -l)
if [ $SENSITIVE_PATTERNS -gt 0 ]; then
  echo "🔐 Potential sensitive data in changes"
  echo "   Review for hardcoded secrets"
  echo "   Use environment variables instead"
  echo ""
  HAS_MESSAGES=true
fi

# Summary
if [ "$HAS_MESSAGES" = true ]; then
  echo "────────────────────────────────────────────────────────"
  echo "Review the above items before continuing development."
else
  echo "✅ All checks passed - no immediate actions needed"
fi
echo "────────────────────────────────────────────────────────"
echo ""

# Non-blocking - always exit 0
exit 0