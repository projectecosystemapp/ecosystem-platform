"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home, Mail, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import * as Sentry from "@sentry/nextjs";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to Sentry
    Sentry.captureException(error);
  }, [error]);

  const errorCode = error.digest || `ERR_${Date.now().toString(36).toUpperCase()}`;
  
  // Determine error type and provide specific guidance
  const getErrorDetails = () => {
    if (error.message?.includes("ECONNREFUSED") || error.message?.includes("fetch")) {
      return {
        title: "Connection Error",
        description: "We're having trouble connecting to our servers. This might be a temporary issue.",
        icon: "network",
        suggestions: [
          "Check your internet connection",
          "Try refreshing the page",
          "Clear your browser cache",
        ],
      };
    }
    
    if (error.message?.includes("403") || error.message?.includes("401")) {
      return {
        title: "Authentication Error",
        description: "You don't have permission to access this resource or your session has expired.",
        icon: "auth",
        suggestions: [
          "Try logging in again",
          "Check if your account has the necessary permissions",
          "Contact support if you believe this is an error",
        ],
      };
    }
    
    if (error.message?.includes("payment") || error.message?.includes("stripe")) {
      return {
        title: "Payment System Error",
        description: "There was an issue with the payment system. No charges have been made.",
        icon: "payment",
        suggestions: [
          "Try again in a few moments",
          "Use a different payment method",
          "Contact support if the issue persists",
        ],
      };
    }
    
    return {
      title: "Something went wrong",
      description: "An unexpected error occurred. Our team has been notified and is working on a fix.",
      icon: "general",
      suggestions: [
        "Try refreshing the page",
        "Go back to the homepage",
        "Contact support if you need immediate assistance",
      ],
    };
  };

  const errorDetails = getErrorDetails();

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 to-white flex items-center justify-center px-4">
      <div className="max-w-2xl w-full space-y-8">
        {/* Error Icon */}
        <div className="flex justify-center">
          <div className="bg-red-100 rounded-full p-6">
            <AlertTriangle className="h-16 w-16 text-red-600" />
          </div>
        </div>

        {/* Error Message */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-gray-900">
            {errorDetails.title}
          </h1>
          <p className="text-lg text-gray-600 max-w-md mx-auto">
            {errorDetails.description}
          </p>
        </div>

        {/* Error Details Alert */}
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-900">What you can try:</AlertTitle>
          <AlertDescription className="mt-2 text-red-800">
            <ul className="list-disc list-inside space-y-1">
              {errorDetails.suggestions.map((suggestion, index) => (
                <li key={index}>{suggestion}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={reset}
            variant="default"
            size="lg"
            className="bg-red-600 hover:bg-red-700"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          <Button
            onClick={() => window.location.href = "/"}
            variant="outline"
            size="lg"
          >
            <Home className="mr-2 h-4 w-4" />
            Go to Homepage
          </Button>
        </div>

        {/* Support Information */}
        <div className="bg-gray-50 rounded-lg p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Need help?</h3>
          <div className="space-y-3">
            <a
              href="mailto:support@ecosystem-platform.com"
              className="flex items-center gap-3 text-gray-700 hover:text-blue-600 transition-colors"
            >
              <Mail className="h-5 w-5" />
              <span>support@ecosystem-platform.com</span>
            </a>
            <a
              href="/help"
              className="flex items-center gap-3 text-gray-700 hover:text-blue-600 transition-colors"
            >
              <FileText className="h-5 w-5" />
              <span>Visit our help center</span>
            </a>
          </div>
          <div className="pt-3 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Error Reference: <code className="bg-gray-100 px-2 py-1 rounded">{errorCode}</code>
            </p>
            {process.env.NODE_ENV === "development" && (
              <details className="mt-3">
                <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                  Technical Details (Development Only)
                </summary>
                <pre className="mt-2 text-xs bg-gray-100 p-3 rounded overflow-x-auto">
                  {error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}