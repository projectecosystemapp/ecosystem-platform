#!/bin/bash
# .claude/hooks/check-critical-files.sh
# Pre-modification protection for critical marketplace files
# Prevents accidental modification of production configs and migrations

# Parse the file path from the hook input
FILE_PATH=$(echo "$1" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null)

# If we couldn't parse the file path, exit gracefully
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Extract filename for cleaner messages
FILENAME=$(basename "$FILE_PATH")
DIRNAME=$(dirname "$FILE_PATH")

# Define protected file patterns
PROTECTED_PATTERNS=(
  ".env.production"
  ".env.local"
  "drizzle.config.ts"
  "middleware.ts"
  "lib/stripe.ts"
  "lib/supabase/service.ts"
  "db/db.ts"
)

# Check if file is in protected migrations directory
if [[ "$DIRNAME" == *"db/migrations"* ]]; then
  # Check if the file starts with the allow-modify comment
  if [ -f "$FILE_PATH" ]; then
    FIRST_LINE=$(head -n 1 "$FILE_PATH" 2>/dev/null)
    if [[ "$FIRST_LINE" == *"@allow-modify"* ]]; then
      echo "✅ Migration modification explicitly allowed for $FILENAME"
      exit 0
    fi
  fi
  
  echo "⚠️  PROTECTED: Database migration file"
  echo "   File: $FILENAME"
  echo ""
  echo "   Migrations should not be modified after creation."
  echo "   If you must modify, add '-- @allow-modify' as the first line."
  echo "   Consider creating a new migration instead."
  exit 2  # Block the modification
fi

# Check protected file patterns
for PATTERN in "${PROTECTED_PATTERNS[@]}"; do
  if [[ "$FILE_PATH" == *"$PATTERN" ]]; then
    # Special handling for different file types
    case "$PATTERN" in
      ".env.production")
        echo "🔒 PROTECTED: Production environment file"
        echo "   Modifying production secrets can break the live application."
        echo "   Use .env.local for local development instead."
        ;;
      "drizzle.config.ts")
        echo "🔒 PROTECTED: Database configuration"
        echo "   Changes here affect database migrations and schema."
        echo "   Ensure migrations are properly tested first."
        ;;
      "middleware.ts")
        echo "🔒 PROTECTED: Authentication middleware"
        echo "   This file controls access to all protected routes."
        echo "   Incorrect changes can lock users out."
        ;;
      "lib/stripe.ts")
        echo "🔒 PROTECTED: Payment configuration"
        echo "   Stripe configuration affects all payment processing."
        echo "   Test thoroughly in development first."
        ;;
      *)
        echo "🔒 PROTECTED: Critical system file"
        echo "   File: $FILENAME"
        ;;
    esac
    
    echo ""
    echo "   To modify, add '// @allow-modify' as the first line."
    echo "   Or use a different approach that doesn't require changing this file."
    
    # Check if the file has the allow-modify comment
    if [ -f "$FILE_PATH" ]; then
      FIRST_LINE=$(head -n 1 "$FILE_PATH" 2>/dev/null)
      if [[ "$FIRST_LINE" == *"@allow-modify"* ]]; then
        echo ""
        echo "✅ Modification explicitly allowed - proceeding"
        exit 0
      fi
    fi
    
    exit 2  # Block the modification
  fi
done

# Check for sensitive file patterns
SENSITIVE_PATTERNS=(
  "*.key"
  "*.pem"
  "*.cert"
  "*.crt"
  "*secret*"
  "*private*"
)

for PATTERN in "${SENSITIVE_PATTERNS[@]}"; do
  if [[ "$FILENAME" == $PATTERN ]]; then
    echo "⚠️  Sensitive file detected: $FILENAME"
    echo "   Ensure no secrets are exposed in version control."
    # Don't block, just warn
  fi
done

# Check if modifying test files during test runs
if [[ "$FILE_PATH" == *".test.ts"* ]] || [[ "$FILE_PATH" == *".test.tsx"* ]] || [[ "$FILE_PATH" == *".spec.ts"* ]]; then
  # Check if tests are currently running
  if pgrep -f "jest|playwright|vitest" > /dev/null 2>&1; then
    echo "⚠️  Tests appear to be running"
    echo "   Modifying test files during test execution may cause issues."
    echo "   Consider waiting for tests to complete."
    # Don't block, just warn
  fi
fi

# Warn about modifying running server files
if [[ "$FILE_PATH" == *"app/"* ]] || [[ "$FILE_PATH" == *"components/"* ]] || [[ "$FILE_PATH" == *"lib/"* ]]; then
  # Check if Next.js dev server is running
  if pgrep -f "next dev" > /dev/null 2>&1; then
    echo "ℹ️  Development server is running"
    echo "   Hot reload will apply changes automatically."
  fi
fi

# Check for accidental node_modules modifications
if [[ "$FILE_PATH" == *"node_modules/"* ]]; then
  echo "❌ BLOCKED: Attempting to modify node_modules"
  echo "   Dependencies should be managed via package.json"
  echo "   Use 'npm install' or 'npm update' instead."
  exit 2  # Block the modification
fi

# All checks passed
exit 0