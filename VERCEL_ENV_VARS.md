# Vercel Environment Variables - EXACT VALUES TO USE

Copy and paste these EXACT values into your Vercel project's environment variables.

## Database Connection String (VERIFIED WORKING)

Your production database is in **Canada (ca-central-1)** region.

Use this exact connection string for Vercel:
```
postgresql://postgres.mhyqvbeiqwkgfyqdfnlu:ECOSYSTEMPROJECTAPPPASSWORD2025@aws-1-ca-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

## Environment Variables for Vercel

Add these in Vercel Dashboard → Settings → Environment Variables:

```env
# === SUPABASE (YOUR PRODUCTION VALUES) ===
DATABASE_URL=postgresql://postgres.mhyqvbeiqwkgfyqdfnlu:ECOSYSTEMPROJECTAPPPASSWORD2025@aws-1-ca-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true
NEXT_PUBLIC_SUPABASE_URL=https://mhyqvbeiqwkgfyqdfnlu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_LwlRcXhiwjVcOTbI0AxAIw_nsGSTMYo
SUPABASE_SERVICE_ROLE_KEY=sb_secret_ikdSwj_-wY3I8IglYSz-FA_YVM7ALrp

# === CLERK AUTHENTICATION ===
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_dW5pdGVkLWJsdWViaXJkLTg3LmNsZXJrLmFjY291bnRzLmRldiQ
CLERK_SECRET_KEY=sk_test_KpbYpiQJrqRyGjNNeI6QKadWLVhDlwCD4D8TrLp12x
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard

# === PLATFORM CONFIG ===
ACTIVE_PAYMENT_PROVIDER=stripe
NEXT_PUBLIC_PLATFORM_FEE_PERCENT=15
NEXT_PUBLIC_APP_URL=https://ecosystem-platform.vercel.app

# === STRIPE (Add when you have them) ===
# STRIPE_SECRET_KEY=[Your Stripe secret key]
# STRIPE_WEBHOOK_SECRET=[Your webhook secret]
# NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=[Your Stripe publishable key]
```

## To Push Your Database Schema

Once you have the correct connection string from Supabase:

1. **Run this command** (replace CONNECTION_STRING with the actual string):
```bash
DATABASE_URL="CONNECTION_STRING" npx drizzle-kit push
```

Example:
```bash
DATABASE_URL="postgresql://postgres.mhyqvbeiqwkgfyqdfnlu:ECOSYSTEMPROJECTAPPPASSWORD2025@aws-0-us-east-1.pooler.supabase.com:6543/postgres" npx drizzle-kit push
```

2. **Verify tables were created**:
   - Go to https://supabase.com/dashboard/project/mhyqvbeiqwkgfyqdfnlu/editor
   - Click on "Table Editor" in the sidebar
   - You should see: profiles, providers, bookings, reviews, etc.

## Troubleshooting

### If connection fails:
1. Try both ports: 5432 (session mode) and 6543 (transaction mode)
2. Try with and without `?pgbouncer=true`
3. Check if password needs URL encoding (special characters)
4. Try the direct connection format if pooler doesn't work

### Alternative connection formats to try:
```bash
# Direct connection
postgresql://postgres:ECOSYSTEMPROJECTAPPPASSWORD2025@db.mhyqvbeiqwkgfyqdfnlu.supabase.co:5432/postgres

# Pooler with different regions
postgresql://postgres.mhyqvbeiqwkgfyqdfnlu:ECOSYSTEMPROJECTAPPPASSWORD2025@aws-0-us-east-1.pooler.supabase.com:6543/postgres
postgresql://postgres.mhyqvbeiqwkgfyqdfnlu:ECOSYSTEMPROJECTAPPPASSWORD2025@aws-0-us-west-1.pooler.supabase.com:6543/postgres
postgresql://postgres.mhyqvbeiqwkgfyqdfnlu:ECOSYSTEMPROJECTAPPPASSWORD2025@aws-0-eu-west-1.pooler.supabase.com:6543/postgres
```

## After Deployment

1. Test your app at your Vercel URL
2. Check Vercel Functions logs if you see errors
3. Ensure Clerk is configured to allow your production domain
4. Add Stripe webhook endpoint when ready: `https://your-app.vercel.app/api/stripe/webhooks`