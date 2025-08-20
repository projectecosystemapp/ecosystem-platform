# Deployment Guide

## Required Environment Variables for Production

When deploying to Vercel or any production environment, ensure all the following environment variables are properly configured:

### Authentication (Clerk) - REQUIRED
These are essential for the application to run:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Your Clerk publishable key
- `CLERK_SECRET_KEY` - Your Clerk secret key
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard`

### Database - REQUIRED
- `DATABASE_URL` - PostgreSQL connection string from Supabase

### Supabase - REQUIRED
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

### Stripe Payments - REQUIRED if using payments
- `STRIPE_SECRET_KEY` - Your Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Webhook endpoint secret from Stripe Dashboard
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Your Stripe publishable key

### Stripe Connect - OPTIONAL (for marketplace features)
- `STRIPE_CONNECT_CLIENT_ID` - OAuth client ID for Stripe Connect

### Payment Links - OPTIONAL
- `NEXT_PUBLIC_STRIPE_PAYMENT_LINK_MONTHLY` - Stripe payment link for monthly plan
- `NEXT_PUBLIC_STRIPE_PAYMENT_LINK_YEARLY` - Stripe payment link for yearly plan
- `NEXT_PUBLIC_STRIPE_PORTAL_LINK` - Customer portal link

### Platform Configuration
- `ACTIVE_PAYMENT_PROVIDER=stripe`
- `NEXT_PUBLIC_PLATFORM_FEE_PERCENT=15` - Commission percentage
- `NEXT_PUBLIC_APP_URL` - Your production URL (e.g., https://yourdomain.com)

### Email Service - OPTIONAL
- `RESEND_API_KEY` - For transactional emails (if using Resend)

## Vercel Deployment Steps

1. **Import Project**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "Add New Project"
   - Import your GitHub repository

2. **Configure Environment Variables**
   - In the project settings, go to "Environment Variables"
   - Add all required variables listed above
   - Use production values (not test/local values)

3. **Verify Clerk Configuration**
   - Ensure Clerk API keys are from your production instance
   - Add your production domain to Clerk's allowed origins

4. **Verify Supabase Configuration**
   - Use production Supabase project credentials
   - Ensure database migrations are applied to production

5. **Configure Stripe Webhooks**
   - Add webhook endpoint: `https://yourdomain.com/api/stripe/webhooks`
   - Configure webhook to listen for relevant events
   - Copy the webhook secret to `STRIPE_WEBHOOK_SECRET`

6. **Deploy**
   - Click "Deploy" in Vercel
   - Monitor build logs for any errors
   - Test authentication flow after deployment

## Common Issues

### Middleware Errors (500: MIDDLEWARE_INVOCATION_FAILED)
- Ensure `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` are set
- Verify the middleware.ts file uses correct async/await syntax
- Check that all Clerk environment variables are properly configured

### Database Connection Errors
- Verify `DATABASE_URL` is correct and includes proper SSL parameters
- Ensure Supabase project is active and accessible

### Authentication Redirect Issues
- Confirm all `NEXT_PUBLIC_CLERK_*_URL` variables are set correctly
- Add your production domain to Clerk's allowed redirect URLs

### Payment Processing Errors
- Verify Stripe API keys are for the correct environment (test vs live)
- Ensure webhook secret matches the one in Stripe Dashboard
- Check that webhook endpoint is accessible from Stripe's servers