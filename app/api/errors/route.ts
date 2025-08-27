// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { headers } from "next/headers";

interface ErrorReport {
  message: string;
  stack?: string;
  componentStack?: string;
  level?: string;
  errorType?: string;
  timestamp: string;
  url: string;
  userAgent: string;
  userId?: string;
  sessionId?: string;
  breadcrumbs?: Array<{
    message: string;
    category: string;
    timestamp: string;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const errorReport: ErrorReport = await request.json();
    const headersList = headers();
    
    // Enhanced error context
    const context = {
      url: errorReport.url,
      userAgent: errorReport.userAgent,
      timestamp: errorReport.timestamp,
      referer: headersList.get("referer"),
      ipAddress: headersList.get("x-forwarded-for") || 
                 headersList.get("x-real-ip") || 
                 "unknown",
      errorLevel: errorReport.level || "error",
      errorType: errorReport.errorType || "client-error",
    };

    // Rate limiting - simple in-memory store (use Redis in production)
    const rateLimitKey = `error-${context.ipAddress}`;
    const rateLimitWindow = 60 * 1000; // 1 minute
    const maxErrorsPerWindow = 10;

    // In production, you'd use a proper rate limiting solution
    if (process.env.NODE_ENV === "production") {
      // Simple rate limiting logic here
      // This should be replaced with Redis or similar
    }

    // Log to Sentry with enhanced context
    Sentry.withScope((scope) => {
      scope.setLevel(errorReport.level as any || "error");
      scope.setContext("clientError", context);
      scope.setContext("errorBoundary", {
        componentStack: errorReport.componentStack,
        errorType: errorReport.errorType,
      });
      
      if (errorReport.userId) {
        scope.setUser({ id: errorReport.userId });
      }
      
      if (errorReport.breadcrumbs) {
        errorReport.breadcrumbs.forEach(crumb => {
          scope.addBreadcrumb({
            message: crumb.message,
            category: crumb.category,
            timestamp: new Date(crumb.timestamp).getTime() / 1000,
          });
        });
      }

      Sentry.captureException(new Error(errorReport.message), {
        extra: {
          stack: errorReport.stack,
          originalUrl: errorReport.url,
        },
      });
    });

    // Log to console in development
    if (process.env.NODE_ENV === "development") {
      console.group("🚨 Client Error Report");
      console.error("Message:", errorReport.message);
      console.error("Stack:", errorReport.stack);
      console.error("Component Stack:", errorReport.componentStack);
      console.error("Context:", context);
      console.groupEnd();
    }

    // Store in database if needed (for analytics)
    if (process.env.DATABASE_URL) {
      try {
        // You could store error reports in a database table here
        // await db.insert(errorReports).values({
        //   message: errorReport.message,
        //   stack: errorReport.stack,
        //   url: errorReport.url,
        //   userAgent: errorReport.userAgent,
        //   timestamp: new Date(errorReport.timestamp),
        //   userId: errorReport.userId,
        //   level: errorReport.level,
        //   errorType: errorReport.errorType,
        // });
      } catch (dbError) {
        console.error("Failed to store error in database:", dbError);
        // Don't fail the request if database storage fails
      }
    }

    return NextResponse.json(
      { 
        success: true, 
        message: "Error reported successfully",
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("Failed to process error report:", error);
    
    // Report this meta-error to Sentry
    Sentry.captureException(error, {
      tags: { source: "error-reporting-api" },
    });

    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to process error report" 
      },
      { status: 500 }
    );
  }
}

// Health check endpoint for error boundary network tests
export async function HEAD() {
  return new Response(null, { 
    status: 200,
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}

export async function GET() {
  return NextResponse.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "error-reporting",
  });
}