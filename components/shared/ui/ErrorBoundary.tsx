"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Update state with error info
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      // Default error UI
      return (
        <div 
          className="flex items-center justify-center min-h-[400px] p-4"
          role="alert"
          aria-live="assertive"
        >
          <Card className="max-w-md w-full p-6">
            <div className="flex flex-col items-center text-center">
              <div className="rounded-full bg-red-100 p-3 mb-4">
                <AlertTriangle className="h-8 w-8 text-red-600" aria-hidden="true" />
              </div>
              
              <h2 className="text-xl font-semibold mb-2">Oops! Something went wrong</h2>
              
              <p className="text-gray-600 mb-6">
                We encountered an unexpected error. The issue has been logged and we'll look into it.
              </p>

              {/* Error details in development mode */}
              {this.props.showDetails && this.state.error && process.env.NODE_ENV === "development" && (
                <details className="w-full mb-6 text-left">
                  <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                    Error details
                  </summary>
                  <div className="mt-2 p-3 bg-gray-50 rounded text-xs font-mono overflow-auto">
                    <p className="font-semibold text-red-600">{this.state.error.toString()}</p>
                    {this.state.errorInfo && (
                      <pre className="mt-2 text-gray-600 whitespace-pre-wrap">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    )}
                  </div>
                </details>
              )}

              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <Button
                  onClick={this.handleReset}
                  variant="outline"
                  className="flex-1"
                  aria-label="Try again"
                >
                  <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
                  Try again
                </Button>
                <Button
                  onClick={this.handleGoHome}
                  variant="default"
                  className="flex-1"
                  aria-label="Go to homepage"
                >
                  <Home className="h-4 w-4 mr-2" aria-hidden="true" />
                  Go home
                </Button>
              </div>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Functional component wrapper for easier use
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, "children">
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

// Hook for error handling (requires React 18+)
export function useErrorHandler() {
  return (error: Error) => {
    throw error; // This will be caught by the nearest error boundary
  };
}