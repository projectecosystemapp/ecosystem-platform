# Ecosystem Marketplace - Environment Variables

## Overview

This document defines all required environment variables for the Ecosystem Marketplace. Variables are categorized by service and environment (development vs production).

---

## 🔧 Core Application

### Next.js Configuration
```env
# Application URL (required for redirects, webhooks)
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Node environment
NODE_ENV=production
```

---

## 🔐 Authentication (Clerk)

### Required Variables
```env
# Clerk authentication (required)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Clerk webhook endpoint secret (for user sync)
CLERK_WEBHOOK_SECRET=whsec_...
```

### Optional Variables
```env
# Custom sign-in/sign-up URLs (optional)
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

---

## 🗄️ Database (Supabase)

### Required Variables
```env
# Supabase connection (required)
DATABASE_URL=postgresql://postgres:[password]@[host]:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://[project-id].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Connection Pool Settings
```env
# Database connection limits (optional)
DATABASE_MAX_CONNECTIONS=20
DATABASE_IDLE_TIMEOUT=30000
DATABASE_CONNECTION_TIMEOUT=2000
```

---

## 💳 Payments (Stripe)

### Required Variables
```env
# Stripe API keys (required)
STRIPE_SECRET_KEY=sk_test_... # or sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_... # or pk_live_...

# Stripe webhook secrets (required for payment processing)
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CONNECT_WEBHOOK_SECRET=whsec_...
STRIPE_MARKETPLACE_WEBHOOK_SECRET=whsec_...
```

### Optional Variables
```env
# Stripe Connect settings (optional)
STRIPE_CONNECT_CLIENT_ID=ca_...
```

---

## 🗺️ Maps (Mapbox)

### Required Variables
```env
# Mapbox integration (required for location features)
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ...
MAPBOX_SECRET_TOKEN=sk.eyJ...
```

---

## 🚀 Caching & Rate Limiting (Redis)

### Required Variables
```env
# Upstash Redis (required for rate limiting and caching)
UPSTASH_REDIS_REST_URL=https://[region]-[id].upstash.io
UPSTASH_REDIS_REST_TOKEN=...
```

### Fallback Configuration
```env
# Redis connection string (alternative format)
REDIS_URL=redis://default:[password]@[host]:6379
```

---

## 📧 Email Services

### SendGrid (Primary)
```env
# SendGrid API (required for notifications)
SENDGRID_API_KEY=SG....
SENDGRID_FROM_EMAIL=noreply@your-domain.com
SENDGRID_FROM_NAME=Ecosystem Marketplace
```

### Resend (Alternative)
```env
# Resend API (alternative email service)
RESEND_API_KEY=re_...
```

---

## 📊 Monitoring & Analytics

### Sentry (Error Tracking)
```env
# Sentry error tracking (required for production)
NEXT_PUBLIC_SENTRY_DSN=https://[key]@[org].ingest.sentry.io/[project]
SENTRY_ORG=your-org
SENTRY_PROJECT=ecosystem-marketplace
SENTRY_AUTH_TOKEN=...
```

### Analytics (Optional)
```env
# Google Analytics (optional)
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-...

# PostHog (optional)
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

---

## 🔒 Security & Secrets

### CSRF Protection
```env
# CSRF secret (auto-generated if not provided)
CSRF_SECRET=your-32-character-secret-key
```

### Webhook Security
```env
# Webhook retry and health check secrets
WEBHOOK_RETRY_SECRET=your-webhook-retry-secret
WEBHOOK_HEALTH_SECRET=your-webhook-health-secret
```

### Session Security
```env
# Session encryption (auto-generated if not provided)
SESSION_SECRET=your-session-encryption-key
```

---

## 🤖 AI & Integrations

### Notion (Optional)
```env
# Notion integration (optional)
NOTION_API_KEY=secret_...
NOTION_DATABASE_ID=...
```

### OpenAI (Optional)
```env
# OpenAI API (optional for AI features)
OPENAI_API_KEY=sk-...
```

---

## 📱 SMS & Communications

### Twilio (Optional)
```env
# Twilio SMS (optional)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...
```

---

## 🌍 Environment-Specific Settings

### Development Environment
```env
# Development-specific settings
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Local Supabase (if using local development)
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... # Local anon key
SUPABASE_SERVICE_ROLE_KEY=eyJ... # Local service role key

# Stripe test keys
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Production Environment
```env
# Production-specific settings
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-production-domain.com

# Production Supabase
DATABASE_URL=postgresql://postgres:[password]@[host]:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://[project-id].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... # Production anon key
SUPABASE_SERVICE_ROLE_KEY=eyJ... # Production service role key

# Stripe live keys
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

---

## ✅ Environment Validation

### Required for Development
- `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

### Required for Production
All development variables plus:
- `NEXT_PUBLIC_APP_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `NEXT_PUBLIC_SENTRY_DSN`
- `SENDGRID_API_KEY`
- `NEXT_PUBLIC_MAPBOX_TOKEN`

---

## 🔧 Setup Instructions

### 1. Copy Environment Template
```bash
cp .env.example .env.local
```

### 2. Fill Required Variables
Update `.env.local` with your actual values for required variables.

### 3. Validate Environment
```bash
npm run validate:env
```

### 4. Test Configuration
```bash
npm run dev
```

---

## 🚨 Security Notes

### Never Commit Secrets
- Add `.env.local` to `.gitignore`
- Use environment variables in production
- Rotate secrets regularly (every 90 days)

### Variable Naming Convention
- `NEXT_PUBLIC_*`: Safe for client-side (publicly visible)
- `*_SECRET_KEY`: Server-only secrets
- `*_API_KEY`: Service API keys
- `*_URL`: Service endpoints

### Production Deployment
- Use your platform's environment variable management
- Verify all required variables are set
- Test in staging environment first

---

## 📋 Troubleshooting

### Common Issues
1. **Database Connection Failed**: Check `DATABASE_URL` format
2. **Clerk Auth Not Working**: Verify publishable and secret keys match
3. **Stripe Webhooks Failing**: Ensure webhook secrets are correct
4. **Maps Not Loading**: Check Mapbox token permissions
5. **Rate Limiting Not Working**: Verify Redis connection

### Validation Commands
```bash
# Check environment variables
npm run env:check

# Test database connection
npm run db:test

# Validate Stripe configuration
npm run stripe:test

# Test Redis connection
npm run redis:check
```

---

*Environment Configuration Guide*  
*Last Updated: 2025-01-27*  
*For support: Check troubleshooting section or contact team*
