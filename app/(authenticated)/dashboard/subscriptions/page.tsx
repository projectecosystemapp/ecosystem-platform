import { Suspense } from 'react';
import { ActiveSubscriptions } from '@/components/subscriptions/active-subscriptions';
import { SubscriptionPlans } from '@/components/subscriptions/subscription-plans';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

export default function SubscriptionsPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Subscriptions</h1>
        <p className="text-muted-foreground mt-2">
          Manage your subscriptions and discover new plans
        </p>
      </div>

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">My Subscriptions</TabsTrigger>
          <TabsTrigger value="browse">Browse Plans</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          <Suspense fallback={<SubscriptionsSkeleton />}>
            <ActiveSubscriptions />
          </Suspense>
        </TabsContent>

        <TabsContent value="browse" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Available Subscription Plans</CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<PlansSkeleton />}>
                <SubscriptionPlans />
              </Suspense>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SubscriptionsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2].map((i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-1/4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PlansSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-4">
          <Skeleton className="h-32 w-full" />
        </div>
      ))}
    </div>
  );
}