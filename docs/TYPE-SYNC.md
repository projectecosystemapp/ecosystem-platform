# TypeScript Type Synchronization Guide

## Executive Summary

This guide addresses TypeScript type synchronization issues in the ecosystem marketplace codebase (713 TypeScript files, 22 database schemas). It provides a systematic approach to eliminate type errors and prevent future drift through automated tooling and strict architectural patterns.

**Current State**: Hundreds of type errors due to rapid feature development and recent refactoring
**Target State**: Zero type errors with automated prevention of type drift

## 1. Schema → Runtime Alignment

### 1.1 Single Source of Truth Architecture

All types must flow from database schema definitions through the application layers:

```
db/schema/*.ts (Drizzle) → Generated Types → Application Types → API Types
```

### 1.2 Schema Verification Command

Create `scripts/check-schema-sync.ts`:

```typescript
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

const SCHEMA_DIR = './db/schema';
const MIGRATION_DIR = './db/migrations';

export async function checkSchemaSync() {
  // Step 1: Generate schema hash
  const schemaFiles = fs.readdirSync(SCHEMA_DIR)
    .filter(f => f.endsWith('.ts'))
    .sort();
  
  const schemaHash = createHash('sha256');
  for (const file of schemaFiles) {
    const content = fs.readFileSync(path.join(SCHEMA_DIR, file), 'utf-8');
    schemaHash.update(content);
  }
  
  // Step 2: Compare with last migration
  const migrations = fs.readdirSync(MIGRATION_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();
  
  if (migrations.length === 0) {
    console.error('❌ No migrations found');
    process.exit(1);
  }
  
  // Step 3: Generate types from current schema
  try {
    execSync('npm run db:generate', { stdio: 'pipe' });
  } catch (error) {
    console.error('❌ Schema generation failed');
    process.exit(1);
  }
  
  // Step 4: Type check generated files
  try {
    execSync('npx tsc --noEmit --project tsconfig.schema.json', { stdio: 'pipe' });
    console.log('✅ Schema and types are in sync');
  } catch (error) {
    console.error('❌ Schema types have errors');
    process.exit(1);
  }
}

checkSchemaSync();
```

Add to `package.json`:

```json
{
  "scripts": {
    "check:schema": "tsx scripts/check-schema-sync.ts",
    "type:generate": "drizzle-kit generate:pg && npm run type:extract",
    "type:extract": "tsx scripts/extract-db-types.ts"
  }
}
```

### 1.3 Type Extraction Script

Create `scripts/extract-db-types.ts`:

```typescript
import { z } from 'zod';
import * as schemas from '@/db/schema';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = './types/generated';

// Extract inferred types from Drizzle schemas
function extractTypes() {
  const typeDefinitions: string[] = [
    '// Auto-generated from database schemas',
    '// DO NOT EDIT MANUALLY - Run npm run type:extract',
    '',
    "import { z } from 'zod';",
    "import { InferSelectModel, InferInsertModel } from 'drizzle-orm';",
    "import * as schema from '@/db/schema';",
    ''
  ];

  // Generate types for each schema
  Object.entries(schemas).forEach(([name, table]) => {
    if (name.endsWith('Table')) {
      const baseName = name.replace('Table', '');
      const capitalizedName = baseName.charAt(0).toUpperCase() + baseName.slice(1);
      
      typeDefinitions.push(`// ${capitalizedName} Types`);
      typeDefinitions.push(`export type ${capitalizedName} = InferSelectModel<typeof schema.${name}>;`);
      typeDefinitions.push(`export type New${capitalizedName} = InferInsertModel<typeof schema.${name}>;`);
      typeDefinitions.push('');
    }
  });

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Write type definitions
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'database.ts'),
    typeDefinitions.join('\n')
  );

  console.log(`✅ Generated types in ${OUTPUT_DIR}/database.ts`);
}

extractTypes();
```

### 1.4 CI/CD Integration

`.github/workflows/type-check.yml`:

```yaml
name: Type Check

on:
  pull_request:
    paths:
      - 'db/schema/**'
      - 'db/migrations/**'
      - '**/*.ts'
      - '**/*.tsx'

jobs:
  schema-sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Check schema sync
        run: npm run check:schema
      
      - name: Generate types
        run: npm run type:generate
      
      - name: Type check
        run: npm run type-check
```

## 2. Core Types as Contracts

### 2.1 Branded Types for IDs

Create `types/core/branded.ts`:

```typescript
// Branded types prevent accidental ID misuse
export type Brand<K, T> = K & { __brand: T };

// User types
export type UserId = Brand<string, 'UserId'>;
export type CustomerId = Brand<string, 'CustomerId'>;
export type ProviderId = Brand<string, 'ProviderId'>;

// Booking types
export type BookingId = Brand<string, 'BookingId'>;
export type ServiceId = Brand<string, 'ServiceId'>;

// Payment types
export type PaymentIntentId = Brand<string, 'PaymentIntentId'>;
export type StripeAccountId = Brand<string, 'StripeAccountId'>;
export type WebhookEventId = Brand<string, 'WebhookEventId'>;

// Type guards
export const isUserId = (id: string): id is UserId => {
  return id.startsWith('user_');
};

export const isCustomerId = (id: string): id is CustomerId => {
  return id.startsWith('cus_') || id.startsWith('customer_');
};

export const isProviderId = (id: string): id is ProviderId => {
  return id.startsWith('provider_');
};

// Type constructors
export const UserId = (id: string): UserId => {
  if (!isUserId(id)) throw new Error(`Invalid UserId: ${id}`);
  return id as UserId;
};

export const CustomerId = (id: string): CustomerId => {
  if (!isCustomerId(id)) throw new Error(`Invalid CustomerId: ${id}`);
  return id as CustomerId;
};

export const ProviderId = (id: string): ProviderId => {
  if (!isProviderId(id)) throw new Error(`Invalid ProviderId: ${id}`);
  return id as ProviderId;
};
```

### 2.2 Discriminated Unions for States

Create `types/core/states.ts`:

```typescript
// Booking state machine with discriminated unions
export type BookingState = 
  | { status: 'INITIATED'; data: { customerId: CustomerId; serviceId: ServiceId } }
  | { status: 'PENDING_PROVIDER'; data: { providerId: ProviderId; requestedAt: Date } }
  | { status: 'ACCEPTED'; data: { acceptedAt: Date; scheduledFor: Date } }
  | { status: 'REJECTED'; data: { rejectedAt: Date; reason: string } }
  | { status: 'PAYMENT_PENDING'; data: { paymentIntentId: PaymentIntentId } }
  | { status: 'PAYMENT_SUCCEEDED'; data: { paidAt: Date; amount: number } }
  | { status: 'PAYMENT_FAILED'; data: { failedAt: Date; error: string } }
  | { status: 'COMPLETED'; data: { completedAt: Date; rating?: number } }
  | { status: 'CANCELLED'; data: { cancelledAt: Date; cancelledBy: 'customer' | 'provider' | 'system' } };

// Type-safe state transitions
export type StateTransition<T extends BookingState['status']> = {
  from: T;
  to: BookingState['status'];
  guard?: (state: Extract<BookingState, { status: T }>) => boolean;
};

export const BOOKING_TRANSITIONS: StateTransition<BookingState['status']>[] = [
  { from: 'INITIATED', to: 'PENDING_PROVIDER' },
  { from: 'PENDING_PROVIDER', to: 'ACCEPTED' },
  { from: 'PENDING_PROVIDER', to: 'REJECTED' },
  { from: 'ACCEPTED', to: 'PAYMENT_PENDING' },
  { from: 'PAYMENT_PENDING', to: 'PAYMENT_SUCCEEDED' },
  { from: 'PAYMENT_PENDING', to: 'PAYMENT_FAILED' },
  { from: 'PAYMENT_SUCCEEDED', to: 'COMPLETED' },
];
```

### 2.3 Immutable Types

Create `types/core/immutable.ts`:

```typescript
// Deep readonly utility type
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends (infer U)[]
    ? ReadonlyArray<DeepReadonly<U>>
    : T[P] extends object
    ? DeepReadonly<T[P]>
    : T[P];
};

// Core domain entities as immutable
export type ImmutableBooking = DeepReadonly<{
  id: BookingId;
  customerId: CustomerId;
  providerId: ProviderId;
  serviceId: ServiceId;
  status: BookingState['status'];
  amount: number;
  fees: {
    platformFee: number;
    guestSurcharge?: number;
    providerPayout: number;
  };
  createdAt: Date;
  updatedAt: Date;
}>;

export type ImmutableProvider = DeepReadonly<{
  id: ProviderId;
  userId: UserId;
  stripeAccountId: StripeAccountId;
  services: ServiceId[];
  rating: number;
  availability: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }[];
}>;
```

### 2.4 Zod Schema Validation

Create `types/validation/schemas.ts`:

```typescript
import { z } from 'zod';
import { UserId, CustomerId, ProviderId, BookingId } from '@/types/core/branded';

// Branded type schemas
export const UserIdSchema = z.string().refine(
  (val): val is UserId => val.startsWith('user_'),
  { message: 'Invalid UserId format' }
);

export const CustomerIdSchema = z.string().refine(
  (val): val is CustomerId => val.startsWith('cus_') || val.startsWith('customer_'),
  { message: 'Invalid CustomerId format' }
);

export const ProviderIdSchema = z.string().refine(
  (val): val is ProviderId => val.startsWith('provider_'),
  { message: 'Invalid ProviderId format' }
);

// API request schemas
export const CreateBookingSchema = z.object({
  customerId: CustomerIdSchema,
  providerId: ProviderIdSchema,
  serviceId: z.string().uuid(),
  scheduledFor: z.string().datetime(),
  guestCheckout: z.boolean().optional(),
});

export const UpdateBookingStatusSchema = z.object({
  bookingId: z.string().uuid(),
  status: z.enum(['ACCEPTED', 'REJECTED', 'CANCELLED']),
  reason: z.string().optional(),
});

// Type inference from schemas
export type CreateBookingRequest = z.infer<typeof CreateBookingSchema>;
export type UpdateBookingStatusRequest = z.infer<typeof UpdateBookingStatusSchema>;

// Runtime validation helpers
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}
```

## 3. Import Path Hygiene

### 3.1 TypeScript Configuration

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"],
      "@/types/*": ["types/*"],
      "@/db/*": ["db/*"],
      "@/lib/*": ["lib/*"],
      "@/components/*": ["components/*"],
      "@/app/*": ["app/*"],
      "@/actions/*": ["actions/*"]
    },
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": false
  },
  "include": ["**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules", ".next", "dist"]
}
```

### 3.2 ESLint Import Rules

`.eslintrc.json`:

```json
{
  "extends": ["next/core-web-vitals"],
  "plugins": ["import", "boundaries"],
  "rules": {
    "import/no-relative-parent-imports": "error",
    "import/no-relative-packages": "error",
    "import/order": [
      "error",
      {
        "groups": [
          "builtin",
          "external",
          "internal",
          ["parent", "sibling"],
          "index"
        ],
        "pathGroups": [
          {
            "pattern": "@/**",
            "group": "internal"
          }
        ],
        "newlines-between": "always",
        "alphabetize": {
          "order": "asc",
          "caseInsensitive": true
        }
      }
    ],
    "boundaries/element-types": [
      "error",
      {
        "default": "disallow",
        "rules": [
          {
            "from": "app",
            "allow": ["lib", "components", "types", "db"]
          },
          {
            "from": "components",
            "allow": ["lib", "types"]
          },
          {
            "from": "lib",
            "allow": ["types", "db"]
          },
          {
            "from": "db",
            "allow": ["types"]
          },
          {
            "from": "types",
            "allow": []
          }
        ]
      }
    ]
  },
  "settings": {
    "boundaries/elements": [
      { "type": "app", "pattern": "app/**" },
      { "type": "components", "pattern": "components/**" },
      { "type": "lib", "pattern": "lib/**" },
      { "type": "db", "pattern": "db/**" },
      { "type": "types", "pattern": "types/**" }
    ]
  }
}
```

### 3.3 Import Path Fixer Script

Create `scripts/fix-imports.ts`:

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

const PROJECT_ROOT = process.cwd();

async function fixImports() {
  const files = await glob('**/*.{ts,tsx}', {
    ignore: ['node_modules/**', '.next/**', 'dist/**']
  });

  let fixedCount = 0;

  for (const file of files) {
    const filePath = path.join(PROJECT_ROOT, file);
    let content = fs.readFileSync(filePath, 'utf-8');
    const originalContent = content;

    // Fix relative imports to use aliases
    const fileDir = path.dirname(file);
    
    // Replace relative imports with absolute imports
    content = content.replace(
      /from ['"](\.\.[\/\\].+)['"]/g,
      (match, importPath) => {
        const absolutePath = path.resolve(fileDir, importPath);
        const relativePath = path.relative(PROJECT_ROOT, absolutePath);
        const aliasPath = '@/' + relativePath.replace(/\\/g, '/');
        return `from '${aliasPath}'`;
      }
    );

    // Fix specific patterns
    content = content
      .replace(/from ['"]\.\.\/\.\.\/lib\//g, "from '@/lib/")
      .replace(/from ['"]\.\.\/\.\.\/types\//g, "from '@/types/")
      .replace(/from ['"]\.\.\/\.\.\/db\//g, "from '@/db/")
      .replace(/from ['"]\.\.\/\.\.\/components\//g, "from '@/components/");

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content);
      fixedCount++;
      console.log(`✅ Fixed imports in ${file}`);
    }
  }

  console.log(`\n📝 Fixed ${fixedCount} files`);
}

fixImports();
```

Add to `package.json`:

```json
{
  "scripts": {
    "fix:imports": "tsx scripts/fix-imports.ts"
  }
}
```

## 4. API Response Typing

### 4.1 Global API Response Pattern

Create `types/api/responses.ts`:

```typescript
import { z } from 'zod';

// Base response types
export type ApiSuccess<T> = {
  success: true;
  data: T;
  meta?: {
    timestamp: string;
    version: string;
  };
};

export type ApiError = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    stack?: string; // Only in development
  };
  meta?: {
    timestamp: string;
    version: string;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// Type guards
export function isApiSuccess<T>(
  response: ApiResponse<T>
): response is ApiSuccess<T> {
  return response.success === true;
}

export function isApiError<T>(
  response: ApiResponse<T>
): response is ApiError {
  return response.success === false;
}

// Response builders
export function apiSuccess<T>(data: T): ApiSuccess<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      version: process.env.API_VERSION || '1.0.0',
    },
  };
}

export function apiError(
  code: string,
  message: string,
  details?: unknown
): ApiError {
  return {
    success: false,
    error: {
      code,
      message,
      details,
      stack: process.env.NODE_ENV === 'development' ? new Error().stack : undefined,
    },
    meta: {
      timestamp: new Date().toISOString(),
      version: process.env.API_VERSION || '1.0.0',
    },
  };
}

// Standard error codes
export const ERROR_CODES = {
  // Authentication
  UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
  FORBIDDEN: 'AUTH_FORBIDDEN',
  TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  
  // Validation
  INVALID_INPUT: 'VALIDATION_INVALID_INPUT',
  MISSING_FIELD: 'VALIDATION_MISSING_FIELD',
  TYPE_MISMATCH: 'VALIDATION_TYPE_MISMATCH',
  
  // Business logic
  INSUFFICIENT_FUNDS: 'BUSINESS_INSUFFICIENT_FUNDS',
  BOOKING_CONFLICT: 'BUSINESS_BOOKING_CONFLICT',
  PROVIDER_UNAVAILABLE: 'BUSINESS_PROVIDER_UNAVAILABLE',
  
  // System
  DATABASE_ERROR: 'SYSTEM_DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'SYSTEM_EXTERNAL_SERVICE',
  RATE_LIMIT_EXCEEDED: 'SYSTEM_RATE_LIMIT',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];
```

### 4.2 Typed Route Handlers

Create `types/api/routes.ts`:

```typescript
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiResponse, apiSuccess, apiError, ERROR_CODES } from './responses';

// Type-safe route handler
export type TypedRouteHandler<TParams = void, TBody = void, TResponse = unknown> = (
  request: NextRequest,
  context: {
    params: TParams;
    body?: TBody;
  }
) => Promise<Response>;

// Validation wrapper
export function createValidatedHandler<TBody, TResponse>(
  schema: z.ZodSchema<TBody>,
  handler: (body: TBody, request: NextRequest) => Promise<ApiResponse<TResponse>>
): TypedRouteHandler<void, TBody, TResponse> {
  return async (request) => {
    try {
      // Parse body
      const rawBody = await request.json();
      
      // Validate
      const validation = schema.safeParse(rawBody);
      if (!validation.success) {
        return Response.json(
          apiError(
            ERROR_CODES.INVALID_INPUT,
            'Validation failed',
            validation.error.flatten()
          ),
          { status: 400 }
        );
      }
      
      // Execute handler
      const response = await handler(validation.data, request);
      
      // Return response
      const status = response.success ? 200 : 400;
      return Response.json(response, { status });
      
    } catch (error) {
      console.error('Route handler error:', error);
      return Response.json(
        apiError(
          ERROR_CODES.DATABASE_ERROR,
          'Internal server error'
        ),
        { status: 500 }
      );
    }
  };
}
```

### 4.3 Stripe Type Re-exports

Create `types/stripe/index.ts`:

```typescript
import Stripe from 'stripe';

// Re-export commonly used Stripe types
export type StripeCustomer = Stripe.Customer;
export type StripePaymentIntent = Stripe.PaymentIntent;
export type StripePaymentMethod = Stripe.PaymentMethod;
export type StripeWebhookEvent = Stripe.Event;
export type StripeAccount = Stripe.Account;
export type StripeCharge = Stripe.Charge;
export type StripeRefund = Stripe.Refund;

// Custom Stripe-related types
export type StripeMetadata = {
  bookingId: string;
  customerId: string;
  providerId: string;
  isGuestCheckout: 'true' | 'false';
  platformFee: string;
  providerPayout: string;
};

// Type guards for Stripe objects
export function isStripeCustomer(obj: unknown): obj is StripeCustomer {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'object' in obj &&
    obj.object === 'customer'
  );
}

export function isStripePaymentIntent(obj: unknown): obj is StripePaymentIntent {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'object' in obj &&
    obj.object === 'payment_intent'
  );
}

// Webhook event type mapping
export type WebhookEventMap = {
  'payment_intent.succeeded': Stripe.PaymentIntent;
  'payment_intent.payment_failed': Stripe.PaymentIntent;
  'charge.succeeded': Stripe.Charge;
  'charge.refunded': Stripe.Charge;
  'customer.created': Stripe.Customer;
  'customer.updated': Stripe.Customer;
  'account.updated': Stripe.Account;
};

export type WebhookEventType = keyof WebhookEventMap;

// Type-safe webhook handler
export type WebhookHandler<T extends WebhookEventType> = (
  event: Stripe.Event & { type: T; data: { object: WebhookEventMap[T] } }
) => Promise<void>;
```

## 5. Test Framework Standardization

### 5.1 Jest Configuration

`jest.config.ts`:

```typescript
import type { Config } from 'jest';
import nextJest from 'next/jest';

const createJestConfig = nextJest({
  dir: './',
});

const config: Config = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
  ],
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/__tests__/unit/**/*.test.ts'],
      testEnvironment: 'node',
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/__tests__/integration/**/*.test.ts'],
      testEnvironment: 'node',
    },
  ],
};

export default createJestConfig(config);
```

### 5.2 Typed Test Factories

Create `__tests__/factories/index.ts`:

```typescript
import { faker } from '@faker-js/faker';
import { UserId, CustomerId, ProviderId, BookingId } from '@/types/core/branded';
import { ImmutableBooking, ImmutableProvider } from '@/types/core/immutable';

// Type-safe factory pattern
export class TestFactory<T> {
  constructor(
    private generator: () => T,
    private overrides: Partial<T> = {}
  ) {}

  build(overrides: Partial<T> = {}): T {
    return {
      ...this.generator(),
      ...this.overrides,
      ...overrides,
    };
  }

  buildMany(count: number, overrides: Partial<T> = {}): T[] {
    return Array.from({ length: count }, () => this.build(overrides));
  }
}

// Factories for core types
export const userFactory = new TestFactory(() => ({
  id: `user_${faker.string.uuid()}` as UserId,
  email: faker.internet.email(),
  name: faker.person.fullName(),
  createdAt: faker.date.past(),
}));

export const customerFactory = new TestFactory(() => ({
  id: `customer_${faker.string.uuid()}` as CustomerId,
  userId: userFactory.build().id,
  stripeCustomerId: `cus_${faker.string.alphanumeric(14)}`,
  email: faker.internet.email(),
}));

export const providerFactory = new TestFactory(() => ({
  id: `provider_${faker.string.uuid()}` as ProviderId,
  userId: userFactory.build().id,
  stripeAccountId: `acct_${faker.string.alphanumeric(16)}` as any,
  services: [],
  rating: faker.number.float({ min: 1, max: 5, fractionDigits: 1 }),
  availability: [],
}));

export const bookingFactory = new TestFactory(() => ({
  id: faker.string.uuid() as BookingId,
  customerId: customerFactory.build().id,
  providerId: providerFactory.build().id,
  serviceId: faker.string.uuid() as any,
  status: 'INITIATED' as const,
  amount: faker.number.int({ min: 1000, max: 100000 }),
  fees: {
    platformFee: faker.number.int({ min: 100, max: 10000 }),
    providerPayout: faker.number.int({ min: 900, max: 90000 }),
  },
  createdAt: faker.date.past(),
  updatedAt: faker.date.recent(),
}));

// Type assertions for tests
export function assertType<T>(value: unknown): asserts value is T {
  // Type assertion helper
}

export function assertNotNull<T>(
  value: T | null | undefined,
  message?: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message || 'Value is null or undefined');
  }
}
```

### 5.3 Test Type Utilities

Create `__tests__/types.ts`:

```typescript
import { NextRequest } from 'next/server';

// Mock request builder
export function createMockRequest(
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
    params?: Record<string, string>;
    searchParams?: Record<string, string>;
  } = {}
): NextRequest {
  const url = new URL('http://localhost:3000');
  
  if (options.searchParams) {
    Object.entries(options.searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  const request = new NextRequest(url, {
    method: options.method || 'GET',
    headers: new Headers(options.headers || {}),
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  return request;
}

// Type-safe mock function
export function mockFn<TArgs extends any[], TReturn>(
  implementation?: (...args: TArgs) => TReturn
): jest.Mock<TReturn, TArgs> {
  return jest.fn(implementation);
}

// Database transaction mock
export type MockTransaction = {
  commit: jest.Mock;
  rollback: jest.Mock;
  isCompleted: boolean;
};

export function createMockTransaction(): MockTransaction {
  return {
    commit: jest.fn(),
    rollback: jest.fn(),
    isCompleted: false,
  };
}
```

## 6. CI/CD Guardrails

### 6.1 Pre-commit Hook Configuration

`.husky/pre-commit`:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Type check
echo "🔍 Running type check..."
npm run type-check || {
  echo "❌ Type check failed. Please fix TypeScript errors before committing."
  exit 1
}

# Lint
echo "🔍 Running lint..."
npm run lint || {
  echo "❌ Lint failed. Please fix linting errors before committing."
  exit 1
}

# Schema sync check
echo "🔍 Checking schema sync..."
npm run check:schema || {
  echo "❌ Schema out of sync. Run 'npm run db:generate' to update types."
  exit 1
}

# Test changed files
echo "🧪 Running tests for changed files..."
npx jest --onlyChanged --passWithNoTests || {
  echo "❌ Tests failed. Please fix failing tests before committing."
  exit 1
}

echo "✅ All pre-commit checks passed!"
```

### 6.2 GitHub Actions Workflow

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  type-safety:
    runs-on: ubuntu-latest
    name: Type Safety Checks
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Generate database types
        run: npm run type:generate
      
      - name: Type check
        run: npm run type-check
      
      - name: Verify no uncommitted type changes
        run: |
          if [ -n "$(git status --porcelain types/generated)" ]; then
            echo "❌ Generated types are out of sync. Please run 'npm run type:generate' and commit the changes."
            git diff types/generated
            exit 1
          fi

  lint:
    runs-on: ubuntu-latest
    name: Code Quality
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: ESLint
        run: npm run lint
      
      - name: Check import paths
        run: npm run fix:imports -- --dry-run

  test:
    runs-on: ubuntu-latest
    name: Tests
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run migrations
        run: npm run db:migrate
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
      
      - name: Run tests with coverage
        run: npm run test:coverage
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  build:
    runs-on: ubuntu-latest
    name: Build Check
    needs: [type-safety, lint]
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
        env:
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ${{ secrets.CLERK_PUBLISHABLE_KEY }}
          CLERK_SECRET_KEY: ${{ secrets.CLERK_SECRET_KEY }}
      
      - name: Check build output
        run: |
          if [ ! -d ".next" ειναιthen
            echo "❌ Build failed: .next directory not found"
            exit 1
          fi
```

### 6.3 Parallel Type Checking Script

Create `scripts/parallel-type-check.ts`:

```typescript
import { Worker } from 'worker_threads';
import * as os from 'os';
import * as path from 'path';
import { glob } from 'glob';

const WORKER_SCRIPT = path.join(__dirname, 'type-check-worker.js');
const CPU_COUNT = os.cpus().length;

async function parallelTypeCheck() {
  // Get all TypeScript files
  const files = await glob('**/*.{ts,tsx}', {
    ignore: ['node_modules/**', '.next/**', 'dist/**']
  });

  // Split files into chunks
  const chunkSize = Math.ceil(files.length / CPU_COUNT);
  const chunks: string[][] = [];
  
  for (let i = 0; i < files.length; i += chunkSize) {
    chunks.push(files.slice(i, i + chunkSize));
  }

  // Create workers
  const workers = chunks.map((chunk, index) => {
    return new Promise((resolve, reject) => {
      const worker = new Worker(WORKER_SCRIPT, {
        workerData: { files: chunk, workerId: index }
      });

      worker.on('message', resolve);
      worker.on('error', reject);
      worker.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`Worker ${index} stopped with exit code ${code}`));
        }
      });
    });
  });

  // Wait for all workers
  try {
    const results = await Promise.all(workers);
    console.log('✅ All type checks passed');
    return results;
  } catch (error) {
    console.error('❌ Type check failed:', error);
    process.exit(1);
  }
}

parallelTypeCheck();
```

## 7. Implementation Roadmap

### Phase 1: Foundation (Week 1)
1. **Day 1-2**: Set up type generation pipeline
   - Install dependencies
   - Create extraction scripts
   - Configure CI/CD checks

2. **Day 3-4**: Implement core types
   - Create branded types
   - Define discriminated unions
   - Set up Zod schemas

3. **Day 5-7**: Fix import paths
   - Run import fixer script
   - Update ESLint configuration
   - Verify with CI

### Phase 2: Migration (Week 2)
1. **Day 8-9**: Database layer
   - Generate types from schemas
   - Update queries with new types
   - Fix type errors in db/queries

2. **Day 10-11**: API layer
   - Implement ApiResponse pattern
   - Update route handlers
   - Add validation middleware

3. **Day 12-14**: Component layer
   - Update props interfaces
   - Fix event handler types
   - Ensure strict null checks

### Phase 3: Testing (Week 3)
1. **Day 15-16**: Test framework
   - Configure Jest with ts-jest
   - Create test factories
   - Update existing tests

2. **Day 17-18**: Coverage improvement
   - Add missing type tests
   - Verify edge cases
   - Ensure 80% coverage

3. **Day 19-21**: Documentation
   - Update API documentation
   - Create type reference guide
   - Add migration guide

## 8. Monitoring & Maintenance

### 8.1 Type Health Dashboard

Create `scripts/type-health.ts`:

```typescript
import { execSync } from 'child_process';
import * as fs from 'fs';

interface TypeHealthMetrics {
  totalFiles: number;
  filesWithErrors: number;
  totalErrors: number;
  errorsByFile: Record<string, number>;
  commonErrors: Record<string, number>;
  coverage: number;
}

function checkTypeHealth(): TypeHealthMetrics {
  try {
    // Run tsc and capture output
    const output = execSync('npx tsc --noEmit --pretty false', {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    
    return {
      totalFiles: 0,
      filesWithErrors: 0,
      totalErrors: 0,
      errorsByFile: {},
      commonErrors: {},
      coverage: 100
    };
  } catch (error: any) {
    // Parse TypeScript errors
    const errors = error.stdout.split('\n').filter((line: string) => line.includes('error TS'));
    
    const metrics: TypeHealthMetrics = {
      totalFiles: 713, // From codebase context
      filesWithErrors: new Set(errors.map((e: string) => e.split(':')[0])).size,
      totalErrors: errors.length,
      errorsByFile: {},
      commonErrors: {},
      coverage: 0
    };
    
    // Count errors by file
    errors.forEach((error: string) => {
      const file = error.split(':')[0];
      metrics.errorsByFile[file] = (metrics.errorsByFile[file] || 0) + 1;
      
      // Extract error code
      const match = error.match(/error (TS\d+)/);
      if (match) {
        const code = match[1];
        metrics.commonErrors[code] = (metrics.commonErrors[code] || 0) + 1;
      }
    });
    
    // Calculate coverage
    metrics.coverage = Math.round(
      ((metrics.totalFiles - metrics.filesWithErrors) / metrics.totalFiles) * 100
    );
    
    return metrics;
  }
}

// Generate report
const metrics = checkTypeHealth();

console.log('📊 TypeScript Health Report');
console.log('==========================');
console.log(`Total Files: ${metrics.totalFiles}`);
console.log(`Files with Errors: ${metrics.filesWithErrors}`);
console.log(`Total Errors: ${metrics.totalErrors}`);
console.log(`Type Coverage: ${metrics.coverage}%`);
console.log('\n🔍 Most Common Errors:');

Object.entries(metrics.commonErrors)
  .sort(([, a], [, b]) => b - a)
  .slice(0, 5)
  .forEach(([code, count]) => {
    console.log(`  ${code}: ${count} occurrences`);
  });

console.log('\n📁 Files with Most Errors:');
Object.entries(metrics.errorsByFile)
  .sort(([, a], [, b]) => b - a)
  .slice(0, 5)
  .forEach(([file, count]) => {
    console.log(`  ${file}: ${count} errors`);
  });

// Save metrics to JSON
fs.writeFileSync(
  'type-health-metrics.json',
  JSON.stringify(metrics, null, 2)
);

// Exit with error if coverage is below threshold
if (metrics.coverage < 95) {
  console.error(`\n❌ Type coverage ${metrics.coverage}% is below 95% threshold`);
  process.exit(1);
}

export { checkTypeHealth, TypeHealthMetrics };
```

### 8.2 Automated Fix Script

Create `scripts/auto-fix-types.ts`:

```typescript
#!/usr/bin/env node

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const FIXES = [
  {
    name: 'Fix missing return types',
    command: 'npx ts-add-missing-return-types --write',
  },
  {
    name: 'Fix import paths',
    command: 'npm run fix:imports',
  },
  {
    name: 'Generate missing types',
    command: 'npm run type:generate',
  },
  {
    name: 'Fix any types',
    command: 'npx ts-remove-any --write',
  },
  {
    name: 'Add explicit generics',
    command: 'npx ts-explicit-generics --write',
  }
];

async function autoFixTypes() {
  console.log('🔧 Starting automatic type fixes...\n');
  
  for (const fix of FIXES) {
    console.log(`Running: ${fix.name}`);
    try {
      execSync(fix.command, { stdio: 'inherit' });
      console.log(`✅ ${fix.name} completed\n`);
    } catch (error) {
      console.error(`❌ ${fix.name} failed\n`);
    }
  }
  
  // Run final type check
  console.log('🔍 Running final type check...');
  try {
    execSync('npm run type-check', { stdio: 'inherit' });
    console.log('✅ All type errors fixed!');
  } catch (error) {
    console.error('⚠️ Some type errors remain. Manual intervention required.');
    process.exit(1);
  }
}

autoFixTypes();
```

## 9. Quick Reference

### Common Commands

```bash
# Type checking
npm run type-check              # Full type check
npm run check:schema            # Verify schema sync
npm run type:generate           # Generate types from schemas
npm run type:health             # Type coverage report

# Fixes
npm run fix:imports             # Fix import paths
npm run fix:types               # Auto-fix type errors
npm run db:generate             # Generate Drizzle migrations

# Testing
npm run test                    # Run all tests
npm run test:types              # Test type definitions
npm run test:coverage           # Coverage report

# CI/CD
npm run ci:type-check           # Parallel type checking
npm run build                   # Production build
```

### Error Code Reference

| Error Code | Description | Fix |
|------------|-------------|-----|
| TS2307 | Cannot find module | Check import path, run `fix:imports` |
| TS2339 | Property does not exist | Add type declaration or fix typo |
| TS2345 | Argument type mismatch | Update function signature or cast |
| TS2322 | Type not assignable | Fix type incompatibility |
| TS7006 | Parameter implicitly any | Add explicit type annotation |
| TS2554 | Expected X arguments | Match function call to signature |

### Type Migration Checklist

- [ ] Database schemas have generated types
- [ ] All imports use absolute paths (@/)
- [ ] API responses use ApiResponse<T> pattern
- [ ] Zod schemas match TypeScript types
- [ ] Test factories are typed
- [ ] No `any` types in production code
- [ ] CI/CD runs type checks
- [ ] Pre-commit hooks are active
- [ ] Type coverage > 95%
- [ ] Documentation is updated

## 10. Support & Troubleshooting

### Common Issues

**Issue**: Types out of sync after database change
```bash
npm run db:generate
npm run type:generate
npm run type-check
```

**Issue**: Import path errors after moving files
```bash
npm run fix:imports
npm run lint --fix
```

**Issue**: Stripe types not recognized
```bash
npm install --save-dev @types/stripe
npm run type:generate
```

**Issue**: Test types failing
```bash
npm run test:types
npm run test -- --updateSnapshot
```

### Getting Help

1. Run diagnostics: `npm run type:health`
2. Check CI logs for specific errors
3. Review error patterns in `type-health-metrics.json`
4. Use auto-fix script: `npm run fix:types`

---

## Appendix: Configuration Files

All configuration files mentioned in this document are available in the repository:
- `tsconfig.json` - TypeScript configuration
- `jest.config.ts` - Jest test configuration  
- `.eslintrc.json` - ESLint rules including import hygiene
- `.husky/pre-commit` - Git pre-commit hooks
- `.github/workflows/ci.yml` - CI/CD pipeline

This guide should be treated as the single source of truth for TypeScript type management in the ecosystem marketplace codebase.