#!/bin/bash

echo "🚀 Pushing database schema to production Supabase..."
echo ""
echo "⚠️  WARNING: This will modify your PRODUCTION database!"
echo "Press Ctrl+C to cancel, or Enter to continue..."
read

# Set production DATABASE_URL
export DATABASE_URL="postgresql://postgres:ECOSYSTEMPROJECTAPPPASSWORD2025@db.mhyqvbeiqwkgfyqdfnlu.supabase.co:5432/postgres"

echo "📦 Generating migrations if needed..."
npm run db:generate

echo ""
echo "🔄 Pushing schema to production Supabase..."
npx drizzle-kit push

echo ""
echo "✅ Schema push complete!"
echo ""
echo "📝 Next steps:"
echo "1. Go to https://supabase.com/dashboard/project/mhyqvbeiqwkgfyqdfnlu/editor"
echo "2. Check the 'Table Editor' to verify your tables were created"
echo "3. Add the environment variables to Vercel (see VERCEL_ENV_VARS.md)"
echo ""
echo "🔒 Your production database is now ready!"