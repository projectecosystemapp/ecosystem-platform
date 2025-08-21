"use client";

import React, { Component, ReactNode, ErrorInfo } from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: Array<string | number>;
  resetOnPropsChange?: boolean;
  isolate?: boolean;
  level?: "page" | "section" | "component";
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
}

/**
 * Error Boundary Component
 * Catches JavaScript errors in child components and displays a fallback UI
 */
export class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: NodeJS.Timeout | null = null;
  private previousResetKeys: Array<string | number> = [];

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
    
    if (props.resetKeys) {
      this.previousResetKeys = props.resetKeys;
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError } = this.props;
    const { errorCount } = this.state;

    // Log error details for debugging
    console.error("Error Boundary Caught:", {
      error: error.toString(),
      componentStack: errorInfo.componentStack,
      errorBoundaryLevel: this.props.level || "component",
      errorCount: errorCount + 1,
    });

    // Call custom error handler if provided
    if (onError) {
      onError(error, errorInfo);
    }

    // Update state with error details
    this.setState({
      errorInfo,
      errorCount: errorCount + 1,
    });

    // Auto-reset after 3 errors to prevent infinite loops
    if (errorCount >= 2) {
      this.scheduleReset(10000); // Reset after 10 seconds
    }

    // Send error to monitoring service (in production)
    if (process.env.NODE_ENV === "production") {
      this.reportErrorToService(error, errorInfo);
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { resetKeys, resetOnPropsChange } = this.props;
    
    // Reset error boundary when resetKeys change
    if (resetKeys && this.previousResetKeys) {
      const hasResetKeyChanged = resetKeys.some(
        (key, index) => key !== this.previousResetKeys[index]
      );
      
      if (hasResetKeyChanged) {
        this.resetErrorBoundary();
        this.previousResetKeys = resetKeys;
      }
    }
    
    // Reset when any props change (if enabled)
    if (resetOnPropsChange && prevProps !== this.props) {
      this.resetErrorBoundary();
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  scheduleReset = (delay: number) => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
    
    this.resetTimeoutId = setTimeout(() => {
      this.resetErrorBoundary();
    }, delay);
  };

  resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }
    
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    });
  };

  reportErrorToService(error: Error, errorInfo: ErrorInfo) {
    // Implement error reporting to your monitoring service
    // Example: Sentry, LogRocket, or custom error tracking
    const errorReport = {
      message: error.toString(),
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      level: this.props.level,
      timestamp: new Date().toISOString(),
      url: typeof window !== "undefined" ? window.location.href : "unknown",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
    };
    
    // Send to monitoring service
    // fetch("/api/errors", {
    //   method: "POST",
    //   body: JSON.stringify(errorReport),
    // });
  }

  render() {
    const { hasError, error, errorCount } = this.state;
    const { children, fallback, isolate, level = "component" } = this.props;

    if (hasError && error) {
      // Custom fallback UI if provided
      if (fallback) {
        return <>{fallback}</>;
      }

      // Different error UIs based on error boundary level
      switch (level) {
        case "page":
          return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
              <div className="max-w-md w-full space-y-8 text-center">
                <div className="space-y-4">
                  <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100">
                    <AlertCircle className="h-10 w-10 text-red-600" />
                  </div>
                  <h1 className="text-3xl font-bold text-gray-900">
                    Something went wrong
                  </h1>
                  <p className="text-gray-600">
                    We&apos;re sorry, but something unexpected happened. Please try refreshing
                    the page or go back to the homepage.
                  </p>
                  {process.env.NODE_ENV === "development" && (
                    <Alert className="text-left mt-4">
                      <AlertTitle>Error Details (Development Only)</AlertTitle>
                      <AlertDescription className="mt-2 font-mono text-sm">
                        {error.toString()}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button onClick={this.resetErrorBoundary} variant="default">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Try Again
                  </Button>
                  <Button
                    onClick={() => window.location.href = "/"}
                    variant="outline"
                  >
                    <Home className="mr-2 h-4 w-4" />
                    Go Home
                  </Button>
                </div>
                {errorCount > 1 && (
                  <p className="text-sm text-gray-500">
                    Multiple errors detected. Auto-refreshing soon...
                  </p>
                )}
              </div>
            </div>
          );

        case "section":
          return (
            <div className="p-8 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
              <div className="text-center space-y-4">
                <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900">
                  This section couldn&apos;t load
                </h3>
                <p className="text-sm text-gray-600">
                  There was a problem loading this section. You can try refreshing or
                  continue with other parts of the page.
                </p>
                <Button
                  onClick={this.resetErrorBoundary}
                  variant="outline"
                  size="sm"
                >
                  <RefreshCw className="mr-2 h-3 w-3" />
                  Retry
                </Button>
              </div>
            </div>
          );

        case "component":
        default:
          if (isolate) {
            // Minimal error UI for isolated components
            return (
              <div className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-red-50 text-red-700 rounded-md">
                <AlertCircle className="h-4 w-4" />
                <span>Failed to load</span>
                <button
                  onClick={this.resetErrorBoundary}
                  className="underline hover:no-underline"
                >
                  Retry
                </button>
              </div>
            );
          }

          return (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Component Error</AlertTitle>
              <AlertDescription className="mt-2 space-y-2">
                <p>This component encountered an error and couldn&apos;t render.</p>
                <Button
                  onClick={this.resetErrorBoundary}
                  variant="outline"
                  size="sm"
                  className="mt-2"
                >
                  Try Again
                </Button>
              </AlertDescription>
            </Alert>
          );
      }
    }

    return children;
  }
}

/**
 * Higher-order component to wrap any component with an error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, "children">
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${
    Component.displayName || Component.name || "Component"
  })`;

  return WrappedComponent;
}

/**
 * Hook to trigger error boundary from child components
 */
export function useErrorHandler() {
  return (error: Error) => {
    throw error;
  };
}