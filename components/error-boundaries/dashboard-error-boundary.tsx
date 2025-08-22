"use client";

import React from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { LayoutDashboard, AlertCircle, RefreshCw, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

interface DashboardErrorBoundaryProps {
  children: React.ReactNode;
  section?: string;
}

/**
 * Specialized error boundary for dashboard pages
 */
export function DashboardErrorBoundary({ 
  children, 
  section
}: DashboardErrorBoundaryProps) {
  const router = useRouter();
  const { signOut } = useAuth();

  const handleAuthError = async () => {
    try {
      await signOut();
      router.push("/login");
    } catch (error) {
      console.error("Failed to sign out:", error);
      window.location.href = "/login";
    }
  };

  const dashboardErrorFallback = (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-center space-y-6">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <LayoutDashboard className="h-8 w-8 text-red-600" />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-gray-900">
                  Dashboard Error
                </h2>
                <p className="text-gray-600">
                  {section ? 
                    `We encountered an error loading the ${section} section of your dashboard.` :
                    "We encountered an error loading your dashboard. This might be a temporary issue."}
                </p>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Quick Actions:</AlertTitle>
                <AlertDescription className="mt-2">
                  <div className="grid gap-2 mt-3">
                    <Button
                      onClick={() => window.location.reload()}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh the page
                    </Button>
                    <Button
                      onClick={() => {
                        // Clear any cached data
                        if (typeof window !== "undefined") {
                          sessionStorage.clear();
                          localStorage.removeItem("dashboard_state");
                        }
                        window.location.reload();
                      }}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                    >
                      Clear cache and reload
                    </Button>
                    <Button
                      onClick={handleAuthError}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign out and sign in again
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  onClick={() => window.location.reload()}
                  variant="default"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again
                </Button>
                <Button
                  onClick={() => router.push("/")}
                  variant="outline"
                >
                  Go to Homepage
                </Button>
              </div>

              {/* Dashboard Navigation Fallback */}
              <div className="border-t pt-6">
                <p className="text-sm text-gray-600 mb-3">
                  Or try navigating to a specific section:
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <Button
                    onClick={() => router.push("/dashboard")}
                    variant="ghost"
                    size="sm"
                  >
                    Overview
                  </Button>
                  <Button
                    onClick={() => router.push("/dashboard/provider")}
                    variant="ghost"
                    size="sm"
                  >
                    Provider Profile
                  </Button>
                  <Button
                    onClick={() => router.push("/dashboard/payouts")}
                    variant="ghost"
                    size="sm"
                  >
                    Payouts
                  </Button>
                  <Button
                    onClick={() => router.push("/dashboard/settings")}
                    variant="ghost"
                    size="sm"
                  >
                    Settings
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Help Section */}
          <div className="mt-6 bg-blue-50 rounded-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-2">
              Still having issues?
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              If the problem persists after trying the above solutions, please contact our support team.
            </p>
            <div className="space-y-2 text-sm">
              <p>
                Email: <a href="mailto:support@ecosystem-platform.com" className="text-blue-600 hover:underline">
                  support@ecosystem-platform.com
                </a>
              </p>
              <p className="text-gray-500">
                Error Code: DASH_{Date.now().toString(36).toUpperCase()}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <ErrorBoundary
      level="page"
      fallback={dashboardErrorFallback}
      resetKeys={[section || '']}
      enableAutoRetry={true}
      maxRetries={2}
      retryDelay={1500}
    >
      {children}
    </ErrorBoundary>
  );
}