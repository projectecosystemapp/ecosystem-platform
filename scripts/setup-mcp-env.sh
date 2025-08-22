#!/bin/bash

# Script to set up MCP environment variables
# Run this script with: source scripts/setup-mcp-env.sh

echo "🔧 Setting up MCP environment variables..."

# Load DATABASE_URL from .env.production
if [ -f ".env.production" ]; then
    export DATABASE_URL=$(grep "^DATABASE_URL=" .env.production | cut -d '=' -f2-)
    echo "✅ DATABASE_URL loaded from .env.production"
else
    echo "❌ .env.production not found"
fi

# Load NOTION_API_KEY from .env.notion
if [ -f ".env.notion" ]; then
    export NOTION_API_KEY=$(grep "^NOTION_API_KEY=" .env.notion | cut -d '=' -f2-)
    echo "✅ NOTION_API_KEY loaded from .env.notion"
else
    echo "❌ .env.notion not found"
fi

# Verify the variables are set
if [ -n "$DATABASE_URL" ]; then
    echo "✅ DATABASE_URL is set (PostgreSQL connection)"
else
    echo "⚠️  DATABASE_URL is not set"
fi

if [ -n "$NOTION_API_KEY" ]; then
    echo "✅ NOTION_API_KEY is set"
else
    echo "⚠️  NOTION_API_KEY is not set"
fi

echo ""
echo "📝 To make these permanent, add these lines to your shell profile (~/.zshrc or ~/.bash_profile):"
echo ""
echo "# MCP Server Environment Variables"
echo "export DATABASE_URL=\"$DATABASE_URL\""
echo "export NOTION_API_KEY=\"$NOTION_API_KEY\""
echo ""
echo "Then reload your shell with: source ~/.zshrc"
