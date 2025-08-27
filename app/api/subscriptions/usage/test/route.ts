import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/subscriptions/usage/test
 * Test endpoint to verify subscription usage API is working
 */
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      message: "Subscription usage API is working",
      endpoints: {
        usage: {
          GET: "/api/subscriptions/usage - Get current usage statistics",
          POST: "/api/subscriptions/usage - Record service usage",
          PUT: "/api/subscriptions/usage - Admin usage adjustment",
          DELETE: "/api/subscriptions/usage - Reset usage counter (admin only)"
        },
        bookings: {
          GET: "/api/subscriptions/bookings - Get subscription-linked bookings",
          POST: "/api/subscriptions/bookings - Create booking with subscription benefits",
          PUT: "/api/subscriptions/bookings - Link existing booking to subscription",
          DELETE: "/api/subscriptions/bookings - Unlink booking from subscription"
        }
      },
      features: [
        "Real-time usage tracking",
        "Automatic subscription benefit application",
        "Overage handling and billing",
        "Usage history and analytics",
        "Admin usage management tools",
        "Booking-subscription integration"
      ],
      version: "1.0.0",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error in subscription usage test endpoint:", error);
    return NextResponse.json(
      { error: "Test endpoint failed" },
      { status: 500 }
    );
  }
}