import { Suspense } from 'react';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getProviderByUserId } from '@/db/queries/providers-queries';
import ProviderAnalyticsDashboard from '@/components/provider/analytics/ProviderAnalyticsDashboard';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Provider Analytics Dashboard Page
 * 
 * Features:
 * - Comprehensive earnings and revenue analytics
 * - Booking metrics and performance tracking
 * - Customer insights and retention analysis
 * - Service performance and top revenue generators
 * - Exportable reports (PDF/CSV)
 * - Real-time data with period comparisons
 */

function AnalyticsLoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      
      {/* Time period selector */}
      <Skeleton className="h-10 w-80" />
      
      {/* Key metrics cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Charts grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-48" />
                </div>
                <Skeleton className="h-[300px] w-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default async function AnalyticsPage() {
  // Get authenticated user
  const { userId } = auth();
  
  if (!userId) {
    redirect('/sign-in');
  }
  
  // Get provider profile for the authenticated user
  const provider = await getProviderByUserId(userId);
  
  if (!provider) {
    redirect('/become-a-provider');
  }
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Analytics Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Track your business performance, earnings, and customer insights.
        </p>
      </div>
      
      {/* Analytics Dashboard with Loading State */}
      <Suspense fallback={<AnalyticsLoadingSkeleton />}>
        <ProviderAnalyticsDashboard providerId={provider.id} />
      </Suspense>
    </div>
  );
}