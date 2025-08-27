// @ts-nocheck
/**
 * Example API Route with Rate Limiting
 * 
 * Demonstrates how to use the rate limiting infrastructure
 * for different types of operations
 */

import { NextRequest, NextResponse } from "next/server";
import { withRateLimit, checkRateLimitStatus } from "@/lib/rate-limit";

/**
 * GET endpoint with rate limit status check
 * Returns current rate limit status without incrementing counter
 */
export async function GET(req: NextRequest) {
  try {
    // Get identifier from request
    const userId = req.headers.get('x-user-id');
    const identifier = userId ? `user:${userId}` : `ip:${req.ip || 'unknown'}`;
    
    // Check rate limit status for different types
    const [apiStatus, bookingStatus, paymentStatus] = await Promise.all([
      checkRateLimitStatus(identifier, 'api'),
      checkRateLimitStatus(identifier, 'booking'),
      checkRateLimitStatus(identifier, 'payment'),
    ]);
    
    return NextResponse.json({
      status: 'ok',
      rateLimits: {
        api: {
          allowed: apiStatus.allowed,
          remaining: apiStatus.remaining,
          resetAt: apiStatus.resetAt.toISOString(),
        },
        booking: {
          allowed: bookingStatus.allowed,
          remaining: bookingStatus.remaining,
          resetAt: bookingStatus.resetAt.toISOString(),
        },
        payment: {
          allowed: paymentStatus.allowed,
          remaining: paymentStatus.remaining,
          resetAt: paymentStatus.resetAt.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error('Error checking rate limit status:', error);
    return NextResponse.json(
      { error: 'Failed to check rate limit status' },
      { status: 500 }
    );
  }
}

/**
 * POST endpoint with standard API rate limiting
 */
export const POST = withRateLimit(
  'api',
  async (req: NextRequest) => {
    try {
      const data = await req.json();
      
      // Simulate API operation
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return NextResponse.json({
        success: true,
        message: 'API request processed successfully',
        data,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return NextResponse.json(
        { error: 'Failed to process request' },
        { status: 500 }
      );
    }
  }
);

/**
 * PUT endpoint with strict rate limiting (payment-like)
 */
export const PUT = withRateLimit(
  'payment',
  async (req: NextRequest) => {
    try {
      const data = await req.json();
      
      // Simulate payment-like operation
      await new Promise(resolve => setTimeout(resolve, 200));
      
      return NextResponse.json({
        success: true,
        message: 'Payment operation processed successfully',
        transactionId: `txn_${Date.now()}`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return NextResponse.json(
        { error: 'Failed to process payment operation' },
        { status: 500 }
      );
    }
  }
);

/**
 * DELETE endpoint with moderate rate limiting (booking-like)
 */
export const DELETE = withRateLimit(
  'booking',
  async (req: NextRequest) => {
    try {
      // Simulate booking cancellation
      await new Promise(resolve => setTimeout(resolve, 150));
      
      return NextResponse.json({
        success: true,
        message: 'Booking cancelled successfully',
        refundStatus: 'pending',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return NextResponse.json(
        { error: 'Failed to cancel booking' },
        { status: 500 }
      );
    }
  }
);