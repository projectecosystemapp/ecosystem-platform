import { Metadata } from "next";
import { Suspense } from "react";
import { searchProvidersAction } from "@/actions/providers-actions";
import ProvidersSearchClient from "./providers-search-client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Find Service Providers | Ecosystem Marketplace",
  description: "Browse and book trusted service providers in your area. Find photographers, personal trainers, consultants, tutors, and more on Ecosystem.",
  openGraph: {
    title: "Find Service Providers | Ecosystem",
    description: "Browse and book trusted service providers in your area",
    type: "website",
  },
};

interface ProvidersPageProps {
  searchParams: {
    query?: string;
    city?: string;
    state?: string;
    minPrice?: string;
    maxPrice?: string;
    minRating?: string;
    category?: string;
    sort?: string;
    page?: string;
  };
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <div className="p-6">
            <div className="flex items-start gap-4">
              <Skeleton className="w-16 h-16 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-5 w-32 mb-2" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
            <div className="mt-4 flex items-center justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-24" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

export default async function ProvidersPage({ searchParams }: ProvidersPageProps) {
  // Parse search params
  const filters = {
    query: searchParams.query,
    city: searchParams.city,
    state: searchParams.state,
    minPrice: searchParams.minPrice ? parseFloat(searchParams.minPrice) : undefined,
    maxPrice: searchParams.maxPrice ? parseFloat(searchParams.maxPrice) : undefined,
    minRating: searchParams.minRating ? parseFloat(searchParams.minRating) : undefined,
    sortBy: (searchParams.sort as any) || 'relevance',
    page: searchParams.page ? parseInt(searchParams.page) : 1,
    pageSize: 12,
  };

  // Fetch initial providers data
  const result = await searchProvidersAction(filters);
  
  const initialProviders = result.isSuccess && result.data ? result.data.providers : [];
  const totalCount = result.isSuccess && result.data ? result.data.total : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Page Header */}
      <div className="bg-gradient-to-b from-primary/10 to-background py-12 px-4">
        <div className="container mx-auto max-w-7xl">
          <h1 className="text-4xl font-bold mb-4">Find Service Providers</h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Browse trusted professionals in your area. From photographers to personal trainers, 
            find the perfect provider for your needs.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <Suspense fallback={<LoadingSkeleton />}>
          <ProvidersSearchClient 
            initialProviders={initialProviders}
            totalCount={totalCount}
            initialFilters={filters}
          />
        </Suspense>
      </div>
    </div>
  );
}