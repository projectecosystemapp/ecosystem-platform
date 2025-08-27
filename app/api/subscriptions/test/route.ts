// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/subscriptions/test
 * Test endpoint to verify subscription API is working
 */
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      message: "Subscription API is working",
      endpoints: {
        plans: {
          GET: "/api/subscriptions/plans - Get available subscription plans",
          POST: "/api/subscriptions/plans - Create new plan (admin only)",
          PUT: "/api/subscriptions/plans - Update plan (admin only)",
          DELETE: "/api/subscriptions/plans - Delete plan (admin only)"
        },
        subscribe: {
          POST: "/api/subscriptions/subscribe - Subscribe to a plan",
          PUT: "/api/subscriptions/subscribe - Update subscription",
          DELETE: "/api/subscriptions/subscribe - Cancel subscription"
        },
        usage: {
          GET: "/api/subscriptions/usage - Get current usage statistics",
          POST: "/api/subscriptions/usage - Record service usage"
        },
        bookings: {
          GET: "/api/subscriptions/bookings - Get subscription-linked bookings",
          POST: "/api/subscriptions/bookings - Create booking with subscription benefits"
        }
      },
      features: [
        "Subscription plan management",
        "Usage-based billing",
        "Automatic benefit application",
        "Booking integration",
        "Real-time usage tracking"
      ],
      version: "1.0.0",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error in subscription test endpoint:", error);
    return NextResponse.json(
      { error: "Test endpoint failed" },
      { status: 500 }
    );
  }
}