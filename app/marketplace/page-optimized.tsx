import { Suspense } from "react";
import { CategoryTabs, CategoryType } from "@/components/categories/CategoryTabs";
import { MarketplaceContent } from "@/components/marketplace/MarketplaceContent";
import { MarketplaceErrorBoundary } from "@/components/error-boundaries/marketplace-error-boundary";
import { PageLoader } from "@/components/shared/ui/LoadingStates";
import { Metadata } from "next";

// Metadata for SEO
export const metadata: Metadata = {
  title: "Marketplace | Ecosystem",
  description: "Discover services, spaces, products, events and more in the Ecosystem marketplace.",
  keywords: ["marketplace", "services", "spaces", "products", "events", "community"],
};

// Server Component - No client-side state needed here
export default function MarketplacePage({
  searchParams,
}: {
  searchParams: { category?: string; search?: string; page?: string };
}) {
  const category = (searchParams.category as CategoryType) || "services";
  const searchQuery = searchParams.search || "";
  const page = parseInt(searchParams.page || "1", 10);

  return (
    <MarketplaceErrorBoundary>
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <header className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Ecosystem Marketplace
            </h1>
            <p className="text-lg text-gray-600">
              Discover and book amazing services, spaces, products, and experiences
            </p>
          </header>

          {/* Category Tabs - Can be a server component */}
          <CategoryTabs defaultCategory={category} />

          {/* Main Content with Suspense for loading */}
          <Suspense
            fallback={
              <PageLoader 
                message="Loading marketplace..." 
                className="min-h-[600px]"
              />
            }
          >
            <MarketplaceContent
              category={category}
              searchQuery={searchQuery}
              page={page}
            />
          </Suspense>
        </div>
      </div>
    </MarketplaceErrorBoundary>
  );
}