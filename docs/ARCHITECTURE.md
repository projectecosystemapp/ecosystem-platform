# Architecture & Code Standards

## TypeScript Standards

### Null vs Undefined
**Principle**: Use `undefined` as the default for non-existence.

```typescript
// ✅ Correct
type User = {
  name: string;
  email?: string; // undefined when not provided
}

// ❌ Avoid
type User = {
  name: string;
  email: string | null | undefined; // Ambiguous
}
```

**Exception**: Use `null` for React refs and library requirements:
```typescript
// React refs require null initialization
const elementRef = useRef<HTMLDivElement>(null); // ✅ Correct
```

### Naming Conventions

| Pattern | Example | Use Case |
|---------|---------|----------|
| camelCase | `userName`, `calculatePrice` | Variables, functions |
| PascalCase | `UserProfile`, `AppContainer` | Components, types, classes |
| SCREAMING_SNAKE | `MAX_RETRIES`, `API_KEY` | Constants |
| Prefixes | `isActive`, `hasPermission` | Booleans |
| Plurals | `users`, `products` | Arrays |

**NO Hungarian Notation**: Don't use `IUser` or `TUser` prefixes.

## State Management: Zustand + Immer

### Problem: Nested State Updates
```typescript
// ❌ Verbose and error-prone
set((state) => ({
  ...state,
  user: {
    ...state.user,
    profile: {
      ...state.user.profile,
      address: {
        ...state.user.profile.address,
        city: 'New York'
      }
    }
  }
}))
```

### Solution: Immer Integration
```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

const useStore = create(
  immer((set) => ({
    user: { profile: { address: { city: '' } } },
    updateCity: (city: string) =>
      set((state) => {
        state.user.profile.address.city = city; // ✅ Clean mutation
      }),
  }))
);
```

## Database: Drizzle ORM

### Dual-Layer Data Integrity
```typescript
// 1. Database-level constraints (FOREIGN KEY)
export const bookings = pgTable('bookings', {
  id: uuid('id').primaryKey(),
  providerId: uuid('provider_id')
    .references(() => providers.id) // ✅ Creates FK constraint
    .notNull(),
});

// 2. Application-level relations (for query builder)
export const bookingsRelations = relations(bookings, ({ one }) => ({
  provider: one(providers, {
    fields: [bookings.providerId],
    references: [providers.id],
  }),
}));
```

### Query Optimization
```typescript
// ❌ Fetches all columns (SELECT *)
const users = await db.select().from(usersTable);

// ✅ Partial select (only needed columns)
const users = await db.select({
  id: usersTable.id,
  name: usersTable.name,
}).from(usersTable);

// ✅ Prepared statement for repeated queries
const getUserById = db
  .select({ id: usersTable.id, name: usersTable.name })
  .from(usersTable)
  .where(eq(usersTable.id, sql.placeholder('id')))
  .prepare();

// Use it multiple times efficiently
const user1 = await getUserById.execute({ id: 'uuid-1' });
const user2 = await getUserById.execute({ id: 'uuid-2' });
```

### Relational Queries (Avoid N+1)
```typescript
// ❌ N+1 problem
const providers = await db.select().from(providersTable);
for (const provider of providers) {
  const services = await db.select()
    .from(servicesTable)
    .where(eq(servicesTable.providerId, provider.id));
}

// ✅ Single query with relations
const providers = await db.query.providers.findMany({
  with: {
    services: true,
    reviews: true,
  },
});
```

## Next.js Patterns

### Server Actions vs Route Handlers

| Feature | Server Actions | Route Handlers |
|---------|---------------|----------------|
| Use Case | Internal mutations (forms) | Public APIs, webhooks |
| Methods | POST only | All HTTP methods |
| Security | Built-in CSRF protection | Manual security needed |
| Caching | Auto-revalidation | Manual cache control |

```typescript
// Server Action (app/actions.ts)
'use server';
export async function updateProfile(data: FormData) {
  const session = await auth();
  if (!session) throw new Error('Unauthorized');
  // Direct database update
  await db.update(users).set({...});
  revalidatePath('/profile');
}

// Route Handler (app/api/users/route.ts)
export async function GET(request: Request) {
  // Public API endpoint
  return Response.json({ users: [...] });
}
```

## Image Optimization Pipeline

### Full-Stack Implementation
```typescript
// 1. Configure Next.js image loader (next.config.js)
module.exports = {
  images: {
    loader: 'custom',
    loaderFile: './lib/supabase-loader.ts',
  },
};

// 2. Custom loader (lib/supabase-loader.ts)
export default function supabaseLoader({ src, width, quality }) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/render/image/public/${src}?width=${width}&quality=${quality || 75}`;
}

// 3. Usage in components
import Image from 'next/image';

<Image
  src={provider.avatar}
  alt={provider.name}
  width={200}
  height={200}
  priority={isAboveFold}
  placeholder="blur"
  blurDataURL={provider.avatarBlur}
/>
```

## Security Patterns

### Zero-Trust Authorization
```typescript
// ❌ Client-side check only
export default function AdminPage() {
  const { isAdmin } = useAuth(); // Easily bypassed
  if (!isAdmin) return <div>Not authorized</div>;
  return <AdminPanel />;
}

// ✅ Server-side verification
export default async function AdminPage() {
  const session = await auth();
  
  // Server-side check (cannot be bypassed)
  if (!session?.user?.isAdmin) {
    redirect('/unauthorized');
  }
  
  return <AdminPanel />;
}
```

### API Security Layers
```typescript
// Rate limiting with Upstash
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'),
});

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const { success } = await ratelimit.limit(ip);
  
  if (!success) {
    return new Response('Too Many Requests', { status: 429 });
  }
  
  // Process request...
}
```

## Performance Optimization

### Database Connection Pooling
```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Use read replicas for queries
const readPool = new Pool({
  connectionString: process.env.DATABASE_READ_REPLICA_URL,
  max: 30,
});
```

### Caching Strategy
```typescript
import { unstable_cache } from 'next/cache';

// Cache expensive operations
export const getCachedProvider = unstable_cache(
  async (providerId: string) => {
    return await db.query.providers.findFirst({
      where: eq(providers.id, providerId),
      with: { services: true },
    });
  },
  ['provider'],
  {
    revalidate: 60, // Cache for 60 seconds
    tags: [`provider-${providerId}`],
  }
);

// Invalidate on update
export async function updateProvider(id: string, data: any) {
  await db.update(providers).set(data).where(eq(providers.id, id));
  revalidateTag(`provider-${id}`);
}
```

## Error Handling

### Graceful Degradation
```typescript
// Use error boundaries for UI components
export function ProviderErrorBoundary({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="error-container">
      <h2>Something went wrong loading this provider</h2>
      <button onClick={reset}>Try again</button>
    </div>
  );
}

// Wrap components
<ErrorBoundary fallback={ProviderErrorBoundary}>
  <ProviderProfile />
</ErrorBoundary>
```

### Structured Logging
```typescript
interface LogContext {
  userId?: string;
  bookingId?: string;
  correlationId: string;
  [key: string]: any;
}

function log(level: 'info' | 'warn' | 'error', message: string, context: LogContext) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  }));
}

// Usage
log('info', 'Booking created', {
  userId: session.user.id,
  bookingId: booking.id,
  correlationId: crypto.randomUUID(),
});
```