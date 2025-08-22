"use client";

import React from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { User, AlertCircle, ArrowLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface ProviderErrorBoundaryProps {
  children: React.ReactNode;
  providerId?: string;
  providerName?: string;
}

/**
 * Specialized error boundary for provider profile pages
 */
export function ProviderErrorBoundary({ 
  children, 
  providerId,
  providerName
}: ProviderErrorBoundaryProps) {
  const router = useRouter();

  const providerErrorFallback = (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="container max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center space-y-6">
            <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
              <User className="h-10 w-10 text-red-600" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-gray-900">
                Provider Profile Unavailable
              </h2>
              <p className="text-lg text-gray-600 max-w-md mx-auto">
                {providerName ? 
                  `We couldn&apos;t load ${providerName}&apos;s profile. This might be temporary.` :
                  "We couldn&apos;t load this provider&apos;s profile. They might be updating their information or temporarily unavailable."}
              </p>
            </div>

            <Alert className="max-w-md mx-auto text-left">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Possible reasons:</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                  <li>The provider is updating their profile</li>
                  <li>The provider is temporarily offline</li>
                  <li>There&apos;s a connection issue</li>
                  <li>The profile link may be incorrect</li>
                </ul>
              </AlertDescription>
            </Alert>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={() => window.location.reload()}
                variant="default"
              >
                Try Again
              </Button>
              <Button
                onClick={() => router.back()}
                variant="outline"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go Back
              </Button>
              <Link href="/marketplace">
                <Button variant="outline">
                  <Search className="mr-2 h-4 w-4" />
                  Browse Providers
                </Button>
              </Link>
            </div>

            {providerId && (
              <div className="text-sm text-gray-500">
                Provider ID: <code className="bg-gray-100 px-2 py-1 rounded">{providerId}</code>
              </div>
            )}
          </div>
        </div>

        {/* Suggestions */}
        <div className="mt-8 bg-blue-50 rounded-lg p-6">
          <h3 className="font-semibold text-gray-900 mb-3">
            Looking for similar services?
          </h3>
          <p className="text-gray-600 mb-4">
            Browse our marketplace to find other qualified providers in your area.
          </p>
          <Link href="/marketplace">
            <Button variant="default">
              Explore Marketplace
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <ErrorBoundary
      level="page"
      fallback={providerErrorFallback}
      resetKeys={[providerId || '']}
      enableAutoRetry={true}
      maxRetries={2}
      retryDelay={1000}
    >
      {children}
    </ErrorBoundary>
  );
}