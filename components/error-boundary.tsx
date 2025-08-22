"use client";

import React, { Component, ReactNode, ErrorInfo } from "react";
import { AlertCircle, RefreshCw, Home, WifiOff, ServerCrash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import * as Sentry from "@sentry/nextjs";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: Array<string | number>;
  resetOnPropsChange?: boolean;
  isolate?: boolean;
  level?: "page" | "section" | "component";
  showDetails?: boolean;
  enableAutoRetry?: boolean;
  retryDelay?: number;
  maxRetries?: number;
  fallbackComponent?: React.ComponentType<ErrorFallbackProps>;
}

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
  errorCount: number;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
  retryCount: number;
  isRetrying: boolean;
  errorType: "network" | "chunk" | "runtime" | "unknown";
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
      retryCount: 0,
      isRetrying: false,
      errorType: "unknown",
    };
    
    if (props.resetKeys) {
      this.previousResetKeys = props.resetKeys;
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Determine error type
    let errorType: State["errorType"] = "unknown";
    
    if (error.message?.includes("NetworkError") || 
        error.message?.includes("fetch")) {
      errorType = "network";
    } else if (error.message?.includes("Loading chunk") || 
               error.message?.includes("Failed to import")) {
      errorType = "chunk";
    } else if (error.name === "RuntimeError" || 
               error.name === "TypeError") {
      errorType = "runtime";
    }
    
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorType,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError, enableAutoRetry, maxRetries = 3 } = this.props;
    const { errorCount, retryCount, errorType } = this.state;

    // Log error details for debugging
    console.error("Error Boundary Caught:", {
      error: error.toString(),
      componentStack: errorInfo.componentStack,
      errorBoundaryLevel: this.props.level || "component",
      errorCount: errorCount + 1,
      errorType,
    });

    // Report to Sentry with context
    Sentry.withScope((scope) => {
      scope.setContext("errorBoundary", {
        level: this.props.level || "component",
        errorType,
        errorCount: errorCount + 1,
        retryCount,
      });
      scope.setLevel("error");
      Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
      });
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

    // Auto-retry for transient errors
    if (enableAutoRetry && retryCount < maxRetries) {
      if (errorType === "network" || errorType === "chunk") {
        this.scheduleRetry();
      }
    }

    // Auto-reset after too many errors to prevent infinite loops
    if (errorCount >= maxRetries + 1) {
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

  scheduleRetry = () => {
    const { retryDelay = 1000 } = this.props;
    const { retryCount } = this.state;
    
    // Exponential backoff
    const delay = Math.min(retryDelay * Math.pow(2, retryCount), 10000);
    
    this.setState({ isRetrying: true });
    
    setTimeout(() => {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: retryCount + 1,
        isRetrying: false,
      });
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
      retryCount: 0,
      isRetrying: false,
      errorType: "unknown",
    });
  };

  reportErrorToService(error: Error, errorInfo: ErrorInfo) {
    const { errorType } = this.state;
    const errorReport = {
      message: error.toString(),
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      level: this.props.level,
      errorType,
      timestamp: new Date().toISOString(),
      url: typeof window !== "undefined" ? window.location.href : "unknown",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
    };
    
    // Log to console in development
    if (process.env.NODE_ENV === "development") {
      console.group("🚨 Error Report");
      console.error(errorReport);
      console.groupEnd();
    }
    
    // Send custom error tracking if needed
    if (typeof window !== "undefined" && 'fetch' in window) {
      fetch("/api/errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(errorReport),
      }).catch(() => {
        // Silently fail if error reporting fails
      });
    }
  }

  render() {
    const { hasError, error, errorCount, isRetrying, errorType, retryCount } = this.state;
    const { children, fallback, isolate, level = "component", fallbackComponent: FallbackComponent, showDetails } = this.props;

    if (hasError && error) {
      // Use custom fallback component if provided
      if (FallbackComponent) {
        return (
          <FallbackComponent 
            error={error}
            resetErrorBoundary={this.resetErrorBoundary}
            errorCount={errorCount}
          />
        );
      }
      
      // Custom fallback UI if provided
      if (fallback) {
        return <>{fallback}</>;
      }
      
      // Show retry state
      if (isRetrying) {
        return (
          <div className="flex items-center justify-center p-8">
            <div className="text-center space-y-4">
              <RefreshCw className="mx-auto h-8 w-8 text-blue-600 animate-spin" />
              <p className="text-gray-600">Retrying... (Attempt {retryCount + 1})</p>
            </div>
          </div>
        );
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
                    {errorType === "network" ? "Connection Problem" :
                     errorType === "chunk" ? "Loading Error" :
                     "Something went wrong"}
                  </h1>
                  <p className="text-gray-600">
                    {errorType === "network" ? 
                      "We're having trouble connecting. Please check your internet connection and try again." :
                     errorType === "chunk" ?
                      "Some resources failed to load. This might be due to a slow connection or browser issue." :
                      "We're sorry, but something unexpected happened. Please try refreshing the page or go back to the homepage."}
                  </p>
                  {(showDetails || process.env.NODE_ENV === "development") && (
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
                    {retryCount > 0 ? 
                      `Retry attempt ${retryCount} failed. ` : 
                      "Multiple errors detected. "}
                    {errorCount > 2 ? "Auto-refreshing soon..." : "Please try again."}
                  </p>
                )}
                {errorType === "network" && (
                  <div className="flex items-center justify-center gap-2 text-sm text-amber-600">
                    <WifiOff className="h-4 w-4" />
                    <span>Check your internet connection</span>
                  </div>
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