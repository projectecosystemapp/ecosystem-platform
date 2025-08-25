"use client";

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

/**
 * Comprehensive error boundary specifically designed for marketplace components.
 * Provides user-friendly error messages and recovery options.
 */
class MarketplaceErrorBoundary extends Component<Props, State> {
  private retryCount = 0;
  private readonly maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Generate a unique error ID for tracking
    const errorId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    
    return {
      hasError: true,
      error,
      errorInfo: null,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log error to monitoring service
    this.logError(error, errorInfo);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private logError = (error: Error, errorInfo: ErrorInfo) => {
    // In a real app, this would send to a logging service like Sentry
    console.group('🚨 Marketplace Error Boundary');
    console.error('Error:', error);
    console.error('Error Info:', errorInfo);
    console.error('Component Stack:', errorInfo.componentStack);
    console.error('Error ID:', this.state.errorId);
    console.groupEnd();

    // Example: Send to monitoring service
    // import * as Sentry from '@sentry/nextjs';
    // Sentry.captureException(error, {
    //   contexts: {
    //     react: {
    //       componentStack: errorInfo.componentStack,
    //     },
    //   },
    //   tags: {
    //     errorId: this.state.errorId,
    //     component: 'MarketplaceErrorBoundary',
    //   },
    // });
  };

  private handleRetry = () => {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: null,
      });
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  private getErrorType = (error: Error): 'network' | 'data' | 'rendering' | 'unknown' => {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch')) {
      return 'network';
    }
    if (message.includes('cannot read') || message.includes('undefined')) {
      return 'data';
    }
    if (message.includes('render') || message.includes('element')) {
      return 'rendering';
    }
    return 'unknown';
  };

  private getErrorMessage = (type: string): { title: string; message: string; suggestion: string } => {
    switch (type) {
      case 'network':
        return {
          title: 'Connection Problem',
          message: 'Unable to load marketplace data. This might be due to a network issue.',
          suggestion: 'Check your internet connection and try again.',
        };
      case 'data':
        return {
          title: 'Data Loading Error',
          message: 'There was a problem processing the marketplace information.',
          suggestion: 'This is likely a temporary issue. Please try refreshing the page.',
        };
      case 'rendering':
        return {
          title: 'Display Error',
          message: 'There was a problem displaying the marketplace content.',
          suggestion: 'Try switching to a different view or refreshing the page.',
        };
      default:
        return {
          title: 'Unexpected Error',
          message: 'Something went wrong in the marketplace.',
          suggestion: 'Please try again or contact support if the problem persists.',
        };
    }
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorType = this.getErrorType(this.state.error);
      const { title, message, suggestion } = this.getErrorMessage(errorType);
      const canRetry = this.retryCount < this.maxRetries;

      return (
        <div className="min-h-[400px] flex items-center justify-center p-4">
          <Card className="max-w-lg w-full">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <CardTitle className="text-xl text-red-900">{title}</CardTitle>
              <CardDescription className="text-red-700">{message}</CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>What you can do:</AlertTitle>
                <AlertDescription className="mt-2">
                  {suggestion}
                </AlertDescription>
              </Alert>

              {process.env.NODE_ENV === 'development' && (
                <details className="bg-gray-50 p-3 rounded text-sm">
                  <summary className="cursor-pointer font-medium text-gray-700 mb-2">
                    <Bug className="inline w-4 h-4 mr-1" />
                    Developer Info
                  </summary>
                  <div className="space-y-2 text-gray-600">
                    <p><strong>Error:</strong> {this.state.error.message}</p>
                    <p><strong>Error ID:</strong> {this.state.errorId}</p>
                    {this.state.errorInfo && (
                      <details>
                        <summary className="cursor-pointer">Component Stack</summary>
                        <pre className="mt-1 text-xs overflow-x-auto bg-gray-100 p-2 rounded">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </details>
                    )}
                  </div>
                </details>
              )}
            </CardContent>

            <CardFooter className="flex gap-2 justify-center">
              {canRetry && (
                <Button onClick={this.handleRetry} variant="outline" className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Try Again ({this.maxRetries - this.retryCount} left)
                </Button>
              )}
              <Button onClick={this.handleReload} className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                Reload Page
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default MarketplaceErrorBoundary;

// Convenience wrapper for common marketplace error scenarios
export const MarketplaceErrorWrapper: React.FC<{ 
  children: ReactNode; 
  context?: string;
}> = ({ children, context = 'marketplace' }) => {
  const handleError = (error: Error, errorInfo: ErrorInfo) => {
    // Custom error handling based on context
    console.log(`Error in ${context}:`, error);
  };

  return (
    <MarketplaceErrorBoundary onError={handleError}>
      {children}
    </MarketplaceErrorBoundary>
  );
};