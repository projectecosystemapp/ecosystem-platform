# Error Boundaries System

This directory contains comprehensive error boundaries for handling different types of errors across the marketplace application. Each error boundary is specialized for specific use cases and provides appropriate fallback UI and recovery mechanisms.

## Architecture Overview

Our error boundary system follows a hierarchical approach:

```
Global Error Boundary (app-wide)
├── Page-specific Error Boundaries
│   ├── MarketplaceErrorBoundary (marketplace pages)
│   ├── ProviderErrorBoundary (provider profiles)
│   ├── DashboardErrorBoundary (dashboard pages)
│   └── CheckoutErrorBoundary (payment flow)
├── Section-specific Error Boundaries
│   ├── BookingErrorBoundary (booking components)
│   └── PaymentErrorBoundary (payment components)
└── Component-specific Error Boundaries
    └── StripeElementsErrorBoundary (Stripe elements)
```

## Available Error Boundaries

### 1. Enhanced Core Error Boundary (`ErrorBoundary`)

The base error boundary component with advanced features:

```tsx
import { ErrorBoundary } from "@/components/error-boundary";

<ErrorBoundary
  level="page" // "page" | "section" | "component"
  enableAutoRetry={true}
  maxRetries={3}
  retryDelay={1000}
  resetKeys={["userId", "dataId"]}
  showDetails={false}
  onError={(error, errorInfo) => {
    // Custom error handling
  }}
>
  <YourComponent />
</ErrorBoundary>
```

**Features:**
- 🔄 Automatic retry for transient errors (network, chunk loading)
- 📊 Error type detection (network, chunk, runtime, unknown)
- 🎯 Sentry integration with context
- 💾 Recovery state management
- 🎨 Different UI levels (page/section/component)

### 2. Marketplace Error Boundary (`MarketplaceErrorBoundary`)

Specialized for marketplace pages with category and filter context:

```tsx
import { MarketplaceErrorBoundary } from "@/components/error-boundaries";

<MarketplaceErrorBoundary
  filters={{
    category: "plumbing",
    location: "Edmonton",
    service: "repair"
  }}
>
  <MarketplacePage />
</MarketplaceErrorBoundary>
```

**Features:**
- 🌐 Offline detection and auto-recovery
- 🔍 Filter context preservation
- 📱 Popular category fallbacks
- 🔄 Auto-retry when coming back online

### 3. Provider Error Boundary (`ProviderErrorBoundary`)

For provider profile pages:

```tsx
import { ProviderErrorBoundary } from "@/components/error-boundaries";

<ProviderErrorBoundary
  providerId="provider-123"
  providerName="John's Plumbing"
>
  <ProviderProfile />
</ProviderErrorBoundary>
```

**Features:**
- 👤 Provider context awareness
- 🔗 Alternative provider suggestions
- 📧 Support contact with provider context

### 4. Dashboard Error Boundary (`DashboardErrorBoundary`)

For dashboard pages with authentication awareness:

```tsx
import { DashboardErrorBoundary } from "@/components/error-boundaries";

<DashboardErrorBoundary section="analytics">
  <DashboardAnalytics />
</DashboardErrorBoundary>
```

**Features:**
- 🔐 Authentication error handling
- 🗄️ Cache clearing options
- 🔄 Session refresh capability
- 📊 Section-specific messaging

### 5. Booking Error Boundary (`BookingErrorBoundary`)

For booking flow components:

```tsx
import { BookingErrorBoundary } from "@/components/error-boundaries";

<BookingErrorBoundary
  bookingData={{
    providerId: "provider-123",
    serviceId: "service-456",
    date: "2024-01-15",
    time: "10:00"
  }}
  onError={(error) => {
    // Track booking errors
  }}
>
  <BookingFlow />
</BookingErrorBoundary>
```

**Features:**
- 💾 Booking state preservation
- 🔄 Recovery from saved state
- 📞 Support contact with booking context
- 📊 Sentry integration with booking data

### 6. Payment Error Boundaries

Multiple payment-specific error boundaries:

```tsx
import { 
  PaymentErrorBoundary,
  StripeElementsErrorBoundary,
  CheckoutErrorBoundary 
} from "@/components/error-boundaries";

// General payment errors
<PaymentErrorBoundary onPaymentError={handleError}>
  <PaymentForm />
</PaymentErrorBoundary>

// Stripe-specific errors
<StripeElementsErrorBoundary>
  <CardElement />
</StripeElementsErrorBoundary>

// Full checkout flow
<CheckoutErrorBoundary bookingId="booking-123">
  <CheckoutFlow />
</CheckoutErrorBoundary>
```

## Error Recovery Hooks

### `useErrorRecovery`

Advanced error recovery with retry logic:

```tsx
import { useErrorRecovery } from "@/hooks/use-error-recovery";

function DataComponent() {
  const {
    data,
    isLoading,
    isError,
    error,
    retryCount,
    execute,
    retry,
    reset
  } = useErrorRecovery(
    async () => fetchData(),
    {
      maxRetries: 3,
      retryDelay: 1000,
      exponentialBackoff: true,
      fallbackData: [],
      cacheKey: "data-cache"
    }
  );

  if (isError) {
    return <ErrorFallback onRetry={retry} error={error} />;
  }

  return <DataDisplay data={data} />;
}
```

### `useNetworkErrorRecovery`

Network-aware error handling:

```tsx
import { useNetworkErrorRecovery } from "@/hooks/use-error-recovery";

function NetworkAwareComponent() {
  const { isOnline, networkError, checkConnection } = useNetworkErrorRecovery();

  if (!isOnline) {
    return <OfflineMessage onRetry={checkConnection} />;
  }

  return <OnlineContent />;
}
```

### `useGracefulDegradation`

Graceful degradation with cached data:

```tsx
import { useGracefulDegradation } from "@/hooks/use-error-recovery";

function DataComponent() {
  const { data, isStale, error } = useGracefulDegradation(
    "provider-data",
    () => fetchProviderData(),
    {
      staleTime: 60000, // 1 minute
      fallbackData: []
    }
  );

  return (
    <div>
      {isStale && <StaleDataWarning />}
      <DataDisplay data={data} />
    </div>
  );
}
```

## Custom Error Pages

### 404 Not Found (`/app/not-found.tsx`)

Features:
- 🔍 Search suggestions
- 🏷️ Popular category links
- 🏠 Navigation options
- 📧 Support contact

### 500 Server Error (`/app/error.tsx`)

Features:
- 🎯 Error type detection
- 💡 Contextual suggestions
- 🔄 Retry mechanisms
- 📋 Error reporting

### Global Critical Error (`/app/global-error.tsx`)

Features:
- 🚨 Critical error handling
- 🔄 Application restart
- 📧 Support escalation
- 🏠 Safe navigation

### Maintenance Page (`/app/maintenance/page.tsx`)

Features:
- ⏱️ Maintenance window display
- 🔄 Auto-refresh when complete
- 📊 Progress indicators
- 📞 Emergency contacts

## Error Reporting

All errors are automatically reported to:

1. **Sentry** (with context and breadcrumbs)
2. **Custom API** (`/api/errors`) for analytics
3. **Console** (in development)

### Error Report Structure

```typescript
{
  message: string;
  stack?: string;
  componentStack?: string;
  level: "error" | "warning" | "info";
  errorType: "network" | "chunk" | "runtime" | "unknown";
  timestamp: string;
  url: string;
  userAgent: string;
  userId?: string;
  context: {
    // Page/component specific context
  };
}
```

## Best Practices

### 1. Choose the Right Error Boundary

```tsx
// ✅ Use specific error boundaries for their use cases
<ProviderErrorBoundary> // For provider pages
<BookingErrorBoundary>  // For booking flows
<PaymentErrorBoundary>  // For payment components

// ❌ Don't use generic ErrorBoundary everywhere
<ErrorBoundary> // Only for custom cases
```

### 2. Provide Context

```tsx
// ✅ Pass relevant context
<BookingErrorBoundary
  bookingData={bookingData}
  onError={trackBookingError}
>

// ❌ Don't ignore context
<BookingErrorBoundary>
```

### 3. Handle Recovery

```tsx
// ✅ Provide recovery mechanisms
const { retry, reset } = useErrorRecovery(fetchData);

// ❌ Don't leave users stranded
// No retry or recovery options
```

### 4. Test Error States

```tsx
// Test error boundaries in development
if (process.env.NODE_ENV === "development") {
  // Throw test errors
  throw new Error("Test error boundary");
}
```

## Integration with Next.js App Router

The error boundaries integrate seamlessly with Next.js 14:

```tsx
// app/providers/[slug]/page.tsx
export default function ProviderPage({ params }) {
  return (
    <ProviderErrorBoundary
      providerId={params.slug}
    >
      <ProviderContent />
    </ProviderErrorBoundary>
  );
}

// app/marketplace/page.tsx
export default function MarketplacePage() {
  return (
    <MarketplaceErrorBoundary>
      <MarketplaceContent />
    </MarketplaceErrorBoundary>
  );
}
```

## Monitoring and Analytics

Error boundaries automatically:

- 📊 Track error rates by component
- 🎯 Identify problematic areas
- 📈 Monitor recovery success rates
- 🔍 Provide debugging context
- 📱 Track user impact

## Development Tools

In development mode:

- 🐛 Enhanced error details
- 📋 Stack traces
- 🎯 Component hierarchy
- 🔍 Error context inspection
- ⚡ Quick recovery options

## Production Optimizations

In production:

- 🔒 Sanitized error messages
- 📊 Comprehensive error reporting
- 🎯 User-friendly fallbacks
- 🔄 Automatic recovery attempts
- 📞 Support escalation paths

---

## Quick Start

1. **Wrap your pages** with appropriate error boundaries
2. **Add context** relevant to your component
3. **Test error states** in development
4. **Monitor errors** in production
5. **Iterate and improve** based on real user data

For questions or issues, contact the engineering team or check the main documentation.