/**
 * Lazy-loaded components for improved performance
 * This file provides optimized lazy loading wrappers for heavy components
 */

import { lazy, Suspense, ComponentType, ReactElement } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Card } from '@/components/ui/card';

// Loading fallback components
const ComponentSkeleton = () => (
  <div className="space-y-4 p-4">
    <Skeleton className="h-4 w-3/4" />
    <Skeleton className="h-4 w-1/2" />
    <Skeleton className="h-32 w-full" />
  </div>
);

const CardSkeleton = () => (
  <Card className="p-4 space-y-4">
    <Skeleton className="h-6 w-full" />
    <Skeleton className="h-4 w-3/4" />
    <Skeleton className="h-20 w-full" />
  </Card>
);

const ListSkeleton = () => (
  <div className="space-y-2">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="flex items-center space-x-4 p-2">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    ))}
  </div>
);

// Marketplace Components (Heavy)
export const LazyMarketplaceContent = lazy(() => 
  import('@/components/marketplace/unified/MarketplaceContent').then(module => ({
    default: module.MarketplaceContent
  }))
);

export const LazyUniversalListingCard = lazy(() =>
  import('@/components/marketplace/cards/UniversalListingCard').then(module => ({
    default: module.UniversalListingCard
  }))
);

export const LazyMarketplaceLayout = lazy(() =>
  import('@/components/marketplace/unified/MarketplaceLayout').then(module => ({
    default: module.MarketplaceLayout
  }))
);

// Provider Components (Heavy)
export const LazyProviderDashboard = lazy(() =>
  import('@/components/provider/dashboard/ProviderDashboard')
);

export const LazyProviderAnalyticsDashboard = lazy(() =>
  import('@/components/provider/analytics/ProviderAnalyticsDashboard')
);

export const LazyProviderOnboardingWizard = lazy(() =>
  import('@/components/provider/onboarding/OnboardingWizard')
);

export const LazyBookingCalendar = lazy(() =>
  import('@/components/booking/BookingCalendar')
);

export const LazyTimeSlotPickerOptimized = lazy(() =>
  import('@/components/booking/TimeSlotPickerOptimized')
);

// Customer Components (Heavy)
export const LazyBookingHistory = lazy(() =>
  import('@/components/customer/dashboard/BookingHistory')
);

export const LazyBookingDetails = lazy(() =>
  import('@/components/customer/dashboard/BookingDetails')
);

// Analytics Components (Heavy)
export const LazyEarningsChart = lazy(() =>
  import('@/components/provider/analytics/EarningsChart')
);

export const LazyCustomerAnalytics = lazy(() =>
  import('@/components/provider/analytics/CustomerAnalytics')
);

export const LazyServicePerformance = lazy(() =>
  import('@/components/provider/analytics/ServicePerformance')
);

// Messaging Components (Heavy)
export const LazyMessageCenter = lazy(() =>
  import('@/components/messaging/message-center')
);

export const LazyConversationView = lazy(() =>
  import('@/components/messaging/conversation-view')
);

// Payment Components (Heavy)
export const LazyStripePaymentForm = lazy(() =>
  import('@/components/payment/StripePaymentForm')
);

export const LazyPaymentStatusAlert = lazy(() =>
  import('@/components/payment/payment-status-alert')
);

// Maps Components (Heavy)
export const LazyLocationMap = lazy(() =>
  import('@/components/maps/LocationMap')
);

export const LazyBaseMap = lazy(() =>
  import('@/components/maps/BaseMap')
);

// Utility function to create lazy components with custom fallbacks
export function createLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  fallback: ReactElement = <ComponentSkeleton />
) {
  const LazyComponent = lazy(importFn);
  
  return function WrappedLazyComponent(props: Parameters<T>[0]) {
    return (
      <Suspense fallback={fallback}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

// Pre-configured lazy components with appropriate skeletons
export const MarketplaceContentLazy = createLazyComponent(
  () => import('@/components/marketplace/unified/MarketplaceContent'),
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {[...Array(6)].map((_, i) => (
      <CardSkeleton key={i} />
    ))}
  </div>
);

export const ProviderDashboardLazy = createLazyComponent(
  () => import('@/components/provider/dashboard/ProviderDashboard'),
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {[...Array(3)].map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
    <CardSkeleton />
  </div>
);

export const BookingHistoryLazy = createLazyComponent(
  () => import('@/components/customer/dashboard/BookingHistory'),
  <ListSkeleton />
);

export const EarningsChartLazy = createLazyComponent(
  () => import('@/components/provider/analytics/EarningsChart'),
  <Card className="p-6">
    <Skeleton className="h-8 w-48 mb-4" />
    <Skeleton className="h-64 w-full" />
  </Card>
);

export const MessageCenterLazy = createLazyComponent(
  () => import('@/components/messaging/message-center'),
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-96">
    <div className="lg:col-span-1">
      <ListSkeleton />
    </div>
    <div className="lg:col-span-2">
      <ComponentSkeleton />
    </div>
  </div>
);

export const LocationMapLazy = createLazyComponent(
  () => import('@/components/maps/LocationMap'),
  <div className="w-full h-64 bg-gray-200 animate-pulse rounded-lg flex items-center justify-center">
    <Spinner />
  </div>
);

// HOC for lazy loading with intersection observer
export function withIntersectionObserver<T extends ComponentType<any>>(
  LazyComponent: T,
  options: IntersectionObserverInit = {}
) {
  return function IntersectionObservedComponent(props: Parameters<T>[0]) {
    const [isIntersecting, setIsIntersecting] = useState(false);
    const elementRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setIsIntersecting(true);
            observer.disconnect();
          }
        },
        {
          threshold: 0.1,
          rootMargin: '50px',
          ...options,
        }
      );

      if (elementRef.current) {
        observer.observe(elementRef.current);
      }

      return () => observer.disconnect();
    }, []);

    return (
      <div ref={elementRef}>
        {isIntersecting ? (
          <LazyComponent {...props} />
        ) : (
          <ComponentSkeleton />
        )}
      </div>
    );
  };
}

// Preload utility for critical components
export const preloadComponents = {
  marketplace: () => import('@/components/marketplace/unified/MarketplaceContent'),
  providerDashboard: () => import('@/components/provider/dashboard/ProviderDashboard'),
  bookingCalendar: () => import('@/components/booking/BookingCalendar'),
  paymentForm: () => import('@/components/payment/StripePaymentForm'),
};

// Preload function to be called on route prefetch
export function preloadCriticalComponents(route: string) {
  switch (true) {
    case route.includes('/marketplace'):
      preloadComponents.marketplace();
      break;
    case route.includes('/dashboard'):
      preloadComponents.providerDashboard();
      break;
    case route.includes('/booking'):
      preloadComponents.bookingCalendar();
      break;
    case route.includes('/checkout'):
      preloadComponents.paymentForm();
      break;
  }
}

// React imports (should be at the top in real implementation)
import { useState, useEffect, useRef } from 'react';