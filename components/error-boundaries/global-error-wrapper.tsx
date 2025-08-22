"use client";

import React from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { useRouter, usePathname } from "next/navigation";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GlobalErrorWrapperProps {
  children: React.ReactNode;
}

/**
 * Global error wrapper that catches all unhandled errors
 * Should be placed at the root level of the application
 */
export function GlobalErrorWrapper({ children }: GlobalErrorWrapperProps) {
  const router = useRouter();
  const pathname = usePathname();

  const globalErrorFallback = (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-lg w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-gray-900">
              Unexpected Error
            </h1>
            <p className="text-gray-600">
              Something went wrong with the application. Our team has been notified.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={() => window.location.reload()}
              variant="default"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reload Page
            </Button>
            <Button
              onClick={() => router.push("/")}
              variant="outline"
            >
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Button>
          </div>

          <div className="text-sm text-gray-500">
            Page: {pathname}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <ErrorBoundary
      level="page"
      fallback={globalErrorFallback}
      resetKeys={[pathname]}
      enableAutoRetry={false} // Don't auto-retry at the global level
      showDetails={false}
    >
      {children}
    </ErrorBoundary>
  );
}