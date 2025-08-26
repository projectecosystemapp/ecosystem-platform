/**
 * Environment Variable Validation
 * Ensures all required environment variables are configured
 */

import { z } from 'zod';

// Define environment variable schema
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url().describe('PostgreSQL connection string'),
  
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().describe('Supabase project URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).describe('Supabase anonymous key'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).describe('Supabase service role key'),
  
  // Clerk Authentication
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1).describe('Clerk publishable key'),
  CLERK_SECRET_KEY: z.string().min(1).describe('Clerk secret key'),
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().default('/login'),
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: z.string().default('/signup'),
  NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: z.string().default('/dashboard'),
  NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: z.string().default('/dashboard'),
  
  // Stripe Payments
  STRIPE_SECRET_KEY: z.string().min(1).describe('Stripe secret key'),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).describe('Stripe webhook signing secret'),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1).describe('Stripe publishable key'),
  
  // Stripe Connect (Optional for marketplace)
  STRIPE_CONNECT_CLIENT_ID: z.string().optional(),
  STRIPE_CONNECT_WEBHOOK_SECRET: z.string().optional(),
  
  // Platform Configuration
  ACTIVE_PAYMENT_PROVIDER: z.enum(['stripe']).default('stripe'),
  NEXT_PUBLIC_PLATFORM_FEE_PERCENT: z.coerce.number().min(0).max(100).default(10),
  NEXT_PUBLIC_GUEST_SURCHARGE_PERCENT: z.coerce.number().min(0).max(100).default(10),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  
  // Email Service (Optional)
  RESEND_API_KEY: z.string().optional(),
  
  // Rate Limiting (Optional but recommended)
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  
  // Monitoring (Optional but recommended)
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  
  // Mapbox (Optional)
  NEXT_PUBLIC_MAPBOX_TOKEN: z.string().optional(),
  MAPBOX_SECRET_TOKEN: z.string().optional(),
  
  // Node Environment
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  
  // Security
  CSRF_SECRET: z.string().min(32).optional(),
});

// Define required environment variables for production
const productionRequiredVars = [
  'DATABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_APP_URL',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'NEXT_PUBLIC_SENTRY_DSN',
];

// Export parsed environment variables
export type Env = z.infer<typeof envSchema>;

/**
 * Validate environment variables
 */
export function validateEnv(): {
  success: boolean;
  data?: Env;
  errors?: z.ZodError;
  warnings?: string[];
} {
  try {
    const data = envSchema.parse(process.env);
    const warnings: string[] = [];
    
    // Check for production requirements
    if (process.env.NODE_ENV === 'production') {
      const missingProdVars = productionRequiredVars.filter(
        key => !process.env[key]
      );
      
      if (missingProdVars.length > 0) {
        warnings.push(
          `Missing recommended production variables: ${missingProdVars.join(', ')}`
        );
      }
      
      // Additional production checks
      if (!process.env.UPSTASH_REDIS_REST_URL) {
        warnings.push('Redis not configured - rate limiting will use in-memory fallback (not recommended for production)');
      }
      
      if (!process.env.NEXT_PUBLIC_SENTRY_DSN && !process.env.SENTRY_DSN) {
        warnings.push('Sentry not configured - error monitoring disabled');
      }
      
      if (!process.env.RESEND_API_KEY) {
        warnings.push('Email service not configured - email notifications disabled');
      }
    }
    
    return {
      success: true,
      data,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error,
      };
    }
    throw error;
  }
}

/**
 * Get environment variable with fallback
 */
export function getEnv<K extends keyof Env>(
  key: K,
  fallback?: Env[K]
): Env[K] {
  const value = process.env[key];
  
  if (value === undefined) {
    if (fallback !== undefined) {
      return fallback;
    }
    throw new Error(`Environment variable ${key} is not defined`);
  }
  
  // Parse based on expected type
  const schema = envSchema.shape[key];
  try {
    return schema.parse(value) as Env[K];
  } catch {
    return value as Env[K];
  }
}

/**
 * Check if all required environment variables are set
 */
export function checkRequiredEnvVars(): {
  valid: boolean;
  missing: string[];
} {
  const requiredVars = process.env.NODE_ENV === 'production'
    ? productionRequiredVars
    : [
        'DATABASE_URL',
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
        'CLERK_SECRET_KEY',
      ];
  
  const missing = requiredVars.filter(key => !process.env[key]);
  
  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Log environment configuration status
 */
export function logEnvStatus() {
  const validation = validateEnv();
  
  console.log('🔧 Environment Configuration Status:');
  console.log('=====================================');
  
  if (validation.success) {
    console.log('✅ Environment variables validated successfully');
    
    if (validation.warnings && validation.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      validation.warnings.forEach(warning => {
        console.log(`  - ${warning}`);
      });
    }
  } else {
    console.error('❌ Environment validation failed:');
    validation.errors?.errors.forEach(err => {
      console.error(`  - ${err.path.join('.')}: ${err.message}`);
    });
  }
  
  // Log feature status
  console.log('\n📊 Feature Status:');
  console.log(`  - Database: ${process.env.DATABASE_URL ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`  - Authentication: ${process.env.CLERK_SECRET_KEY ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`  - Payments: ${process.env.STRIPE_SECRET_KEY ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`  - Redis/Caching: ${process.env.UPSTASH_REDIS_REST_URL ? '✅ Configured' : '⚠️  Using in-memory fallback'}`);
  console.log(`  - Error Monitoring: ${process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN ? '✅ Configured' : '⚠️  Disabled'}`);
  console.log(`  - Email Service: ${process.env.RESEND_API_KEY ? '✅ Configured' : '⚠️  Disabled'}`);
  
  console.log('=====================================\n');
}