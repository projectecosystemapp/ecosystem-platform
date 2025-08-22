#!/bin/bash
# .claude/hooks/validate-changes.sh
# Post-modification validation for marketplace development
# Runs after Write/Edit operations to catch issues immediately

cd "$CLAUDE_PROJECT_DIR"

# Get the file path from the hook input
FILE_PATH=$(echo "$1" | jq -r '.tool_input.file_path // .tool_input.path // .tool_response.filePath // ""' 2>/dev/null)

# Extract just the filename for logging
FILENAME=$(basename "$FILE_PATH" 2>/dev/null)

# Only run checks if TypeScript/TSX files were modified
if [[ "$FILE_PATH" == *".ts"* ]] || [[ "$FILE_PATH" == *".tsx"* ]]; then
  echo "🔍 Validating TypeScript changes in $FILENAME..."
  
  # Quick incremental type check (faster than full build)
  TSC_OUTPUT=$(npx tsc --noEmit --incremental 2>&1)
  TSC_EXIT_CODE=$?
  
  if [ $TSC_EXIT_CODE -ne 0 ]; then
    echo "⚠️  TypeScript errors detected:"
    echo "$TSC_OUTPUT" | grep -E "error TS" | head -10
    ERROR_COUNT=$(echo "$TSC_OUTPUT" | grep -c "error TS")
    if [ $ERROR_COUNT -gt 10 ]; then
      echo "... and $((ERROR_COUNT - 10)) more errors"
    fi
  fi
  
  # Check for console.log statements (excluding comments)
  if grep -n "console\.log" "$FILE_PATH" 2>/dev/null | grep -v "^[[:space:]]*//" | grep -v "^[[:space:]]*\*" > /dev/null; then
    echo "⚠️  console.log found in $FILENAME"
    grep -n "console\.log" "$FILE_PATH" | grep -v "^[[:space:]]*//" | head -3
  fi
  
  # Critical: Check for exposed Stripe keys
  if grep -E "(sk_live_|sk_test_[A-Za-z0-9]{24,})" "$FILE_PATH" 2>/dev/null > /dev/null; then
    echo "🚨 CRITICAL: Stripe secret key potentially exposed in $FILENAME!"
    echo "Remove immediately and use environment variables instead."
    exit 2  # Block the change
  fi
  
  # Check for hardcoded database URLs
  if grep -E "(postgres://|postgresql://|mysql://)" "$FILE_PATH" 2>/dev/null | grep -v "process.env" > /dev/null; then
    echo "⚠️  Hardcoded database URL found in $FILENAME"
    echo "Use environment variables instead."
  fi
  
  # Check for TODO comments
  TODO_COUNT=$(grep -c "TODO" "$FILE_PATH" 2>/dev/null || echo 0)
  if [ $TODO_COUNT -gt 0 ]; then
    echo "📝 $TODO_COUNT TODO comment(s) in $FILENAME"
  fi
fi

# Check if this is a component file that should have tests
if [[ "$FILE_PATH" == *"components/"* ]] && [[ "$FILE_PATH" == *".tsx" ]] && [[ "$FILE_PATH" != *".test.tsx" ]]; then
  # Extract component name
  COMPONENT_NAME=$(basename "$FILE_PATH" .tsx)
  TEST_FILE="${FILE_PATH%.tsx}.test.tsx"
  
  if [ ! -f "$TEST_FILE" ]; then
    echo "📋 Missing test file for component: $COMPONENT_NAME"
    echo "   Consider creating: $TEST_FILE"
  fi
fi

# Check for migration files - ensure they're reversible
if [[ "$FILE_PATH" == *"db/migrations/"* ]] && [[ "$FILE_PATH" == *".sql" ]]; then
  if ! grep -i "down migration\|rollback\|undo" "$FILE_PATH" > /dev/null 2>&1; then
    echo "⚠️  Migration file may not be reversible"
    echo "   Consider adding rollback/down migration comments"
  fi
fi

# Check package.json changes
if [[ "$FILE_PATH" == *"package.json" ]]; then
  echo "📦 package.json modified - remember to run: npm install"
fi

# Check for proper error handling in API routes
if [[ "$FILE_PATH" == *"app/api/"* ]] && [[ "$FILE_PATH" == *".ts" ]]; then
  if ! grep -E "try\s*{|\.catch\(|NextResponse\.json\([^)]*,\s*{\s*status:\s*[45]" "$FILE_PATH" > /dev/null 2>&1; then
    echo "⚠️  API route may lack proper error handling"
  fi
fi

# Success message if no critical issues
if [ $TSC_EXIT_CODE -eq 0 ] && ! grep -E "(sk_live_|sk_test_)" "$FILE_PATH" 2>/dev/null > /dev/null; then
  echo "✅ Validation passed for $FILENAME"
fi