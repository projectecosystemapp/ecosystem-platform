import { Metadata } from "next";
import { Suspense } from "react";
import { searchProvidersAction } from "@/actions/providers-actions";
import ProvidersSearchClient from "./providers-search-client";
import { ProviderCardSkeleton } from "@/components/provider/search/ProviderCard";
import { PopularSearches } from "@/components/provider/search/PopularSearches";

export const metadata: Metadata = {
  title: "Find Service Providers | Ecosystem Marketplace",
  description: "Browse and book trusted service providers in your area. Find photographers, personal trainers, consultants, tutors, and more. Verified professionals with instant booking available.",
  keywords: "service providers, book services, local professionals, photographers, personal trainers, consultants, tutors, home services, verified providers",
  openGraph: {
    title: "Find Trusted Service Providers Near You | Ecosystem",
    description: "Browse verified professionals in your area. Compare prices, read reviews, and book instantly. 100% satisfaction guaranteed.",
    type: "website",
    images: [
      {
        url: "/og-providers.png",
        width: 1200,
        height: 630,
        alt: "Ecosystem - Find Service Providers",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Find Service Providers | Ecosystem",
    description: "Browse and book trusted service providers in your area",
  },
};

interface ProvidersPageProps {
  searchParams: {
    q?: string;
    city?: string;
    state?: string;
    zip?: string;
    radius?: string;
    minPrice?: string;
    maxPrice?: string;
    minRating?: string;
    services?: string;
    verified?: string;
    insurance?: string;
    instant?: string;
    sort?: string;
    page?: string;
    view?: string;
  };
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Search bar skeleton */}
      <div className="h-12 bg-muted/50 rounded-lg animate-pulse" />
      
      {/* Filters and results skeleton */}
      <div className="flex gap-8">
        {/* Filter sidebar skeleton */}
        <div className="hidden lg:block w-80 space-y-4">
          <div className="h-96 bg-muted/50 rounded-lg animate-pulse" />
        </div>
        
        {/* Results grid skeleton */}
        <div className="flex-1">
          <div className="flex justify-between items-center mb-6">
            <div className="h-4 w-48 bg-muted/50 rounded animate-pulse" />
            <div className="h-10 w-40 bg-muted/50 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <ProviderCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function ProvidersPage({ searchParams }: ProvidersPageProps) {
  // Parse and validate search params
  const filters = {
    query: searchParams.q,
    city: searchParams.city,
    state: searchParams.state,
    zipCode: searchParams.zip,
    radius: searchParams.radius ? parseInt(searchParams.radius) : undefined,
    minPrice: searchParams.minPrice ? parseFloat(searchParams.minPrice) : undefined,
    maxPrice: searchParams.maxPrice ? parseFloat(searchParams.maxPrice) : undefined,
    minRating: searchParams.minRating ? parseFloat(searchParams.minRating) : undefined,
    services: searchParams.services?.split(",").filter(Boolean),
    verifiedOnly: searchParams.verified === "true",
    hasInsurance: searchParams.insurance === "true",
    instantBooking: searchParams.instant === "true",
    sortBy: (searchParams.sort || "relevance") as any,
    page: searchParams.page ? parseInt(searchParams.page) : 1,
    pageSize: 12,
  };

  // Fetch initial providers data with error handling
  let initialProviders: any[] = [];
  let totalCount = 0;
  let featuredProviders: any[] = [];
  
  try {
    const [searchResult, featuredResult] = await Promise.all([
      searchProvidersAction(filters),
      searchProvidersAction({ 
        minRating: 4.5, 
        verifiedOnly: true,
        pageSize: 3 
      } as any),
    ]);
    
    if (searchResult.isSuccess && searchResult.data) {
      initialProviders = searchResult.data.providers;
      totalCount = searchResult.data.total;
    }
    
    if (featuredResult.isSuccess && featuredResult.data) {
      featuredProviders = featuredResult.data.providers;
    }
  } catch (error) {
    console.error("Failed to fetch providers:", error);
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Page Header with enhanced design */}
      <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-background">
        <div className="absolute inset-0 bg-grid-black/[0.02] -z-10" />
        <div className="container mx-auto max-w-7xl px-4 py-16">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              Find Service Providers
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-2">
              Browse trusted professionals in your area. From photographers to personal trainers, 
              find the perfect provider for your needs.
            </p>
            <PopularSearches />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <Suspense fallback={<LoadingSkeleton />}>
          <ProvidersSearchClient 
            initialProviders={initialProviders}
            totalCount={totalCount}
            featuredProviders={featuredProviders}
            initialFilters={filters}
          />
        </Suspense>
      </div>
    </div>
  );
}