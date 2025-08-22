"use client";

import React, { useState, useEffect } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { ShoppingBag, AlertCircle, RefreshCw, Filter, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface MarketplaceErrorBoundaryProps {
  children: React.ReactNode;
  filters?: {
    category?: string;
    location?: string;
    service?: string;
  };
}

/**
 * Specialized error boundary for marketplace pages
 */
export function MarketplaceErrorBoundary({ 
  children, 
  filters
}: MarketplaceErrorBoundaryProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // Check if we're offline
    setIsOffline(!navigator.onLine);
    
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const clearFiltersAndRetry = () => {
    // Clear all filters and go to base marketplace
    router.push("/marketplace");
  };

  const marketplaceErrorFallback = (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="container max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center space-y-6">
            <div className="mx-auto w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center">
              <ShoppingBag className="h-10 w-10 text-amber-600" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-gray-900">
                {isOffline ? "You&apos;re Offline" : "Marketplace Loading Error"}
              </h2>
              <p className="text-lg text-gray-600 max-w-md mx-auto">
                {isOffline ? 
                  "The marketplace requires an internet connection. Please check your connection and try again." :
                  "We&apos;re having trouble loading the marketplace. This is usually temporary."}
              </p>
            </div>

            {!isOffline && (
              <Alert className="max-w-md mx-auto text-left">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Troubleshooting tips:</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                    <li>Try refreshing the page</li>
                    <li>Clear your browser cache</li>
                    <li>Check if filters are too restrictive</li>
                    <li>Try a different browser</li>
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {filters && Object.keys(filters).length > 0 && (
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-gray-700 mb-2">Current filters applied:</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {filters.category && (
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                      Category: {filters.category}
                    </span>
                  )}
                  {filters.location && (
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                      <MapPin className="inline h-3 w-3 mr-1" />
                      {filters.location}
                    </span>
                  )}
                  {filters.service && (
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                      Service: {filters.service}
                    </span>
                  )}
                </div>
                <Button
                  onClick={clearFiltersAndRetry}
                  variant="link"
                  size="sm"
                  className="mt-2"
                >
                  <Filter className="mr-2 h-3 w-3" />
                  Clear all filters
                </Button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={() => window.location.reload()}
                variant="default"
                disabled={isOffline}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
              <Button
                onClick={clearFiltersAndRetry}
                variant="outline"
              >
                Browse All Providers
              </Button>
              <Link href="/">
                <Button variant="outline">
                  Go to Homepage
                </Button>
              </Link>
            </div>

            {isOffline && (
              <Alert className="max-w-md mx-auto">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  We&apos;ll automatically reload the marketplace once your connection is restored.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        {/* Popular Categories Fallback */}
        {!isOffline && (
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-4">
              Browse Popular Categories
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {["Plumbing", "Electrical", "Cleaning", "Landscaping", "HVAC", "Painting", "Moving", "Handyman"].map((category) => (
                <Link
                  key={category}
                  href={`/marketplace?category=${category.toLowerCase()}`}
                >
                  <Button variant="outline" className="w-full">
                    {category}
                  </Button>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Support Information */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>
            Error Reference: MKT_{Date.now().toString(36).toUpperCase()}
          </p>
          <p className="mt-1">
            Need help? Contact{" "}
            <a href="mailto:support@ecosystem-platform.com" className="text-blue-600 hover:underline">
              support@ecosystem-platform.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );

  // Auto-reload when coming back online
  useEffect(() => {
    if (!isOffline) {
      const timer = setTimeout(() => {
        window.location.reload();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isOffline]);

  return (
    <ErrorBoundary
      level="page"
      fallback={marketplaceErrorFallback}
      resetKeys={[filters?.category || '', filters?.location || '']}
      enableAutoRetry={true}
      maxRetries={2}
      retryDelay={2000}
    >
      {children}
    </ErrorBoundary>
  );
}