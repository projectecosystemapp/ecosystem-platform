// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getProviderById } from "@/db/queries/providers-queries";
import { getBookingMetrics, TimePeriod } from "@/db/queries/analytics-queries";
import { z } from "zod";

/**
 * Provider Booking Analytics API
 * GET /api/providers/[providerId]/analytics/bookings
 * 
 * Query Parameters:
 * - period: '7d' | '30d' | '90d' | '1yr' | 'all' (default: '30d')
 * 
 * Returns booking metrics including:
 * - Total bookings by status
 * - Completion and cancellation rates
 * - Booking trends over time
 * - Peak hours analysis
 */

const querySchema = z.object({
  period: z.enum(['7d', '30d', '90d', '1yr', 'all']).default('30d'),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { providerId: string } }
) {
  try {
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    
    const { providerId } = params;
    
    if (!providerId) {
      return NextResponse.json(
        { error: "Provider ID is required" },
        { status: 400 }
      );
    }
    
    // Verify provider exists and user has access
    const provider = await getProviderById(providerId);
    
    if (!provider) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 }
      );
    }
    
    // Verify the authenticated user owns this provider profile
    if (provider.userId !== userId) {
      return NextResponse.json(
        { error: "Unauthorized to access this provider's analytics" },
        { status: 403 }
      );
    }
    
    // Parse query parameters
    const url = new URL(req.url);
    const queryParams = {
      period: url.searchParams.get('period') || '30d',
    };
    
    const validatedQuery = querySchema.safeParse(queryParams);
    
    if (!validatedQuery.success) {
      return NextResponse.json(
        { 
          error: "Invalid query parameters",
          details: validatedQuery.error.flatten().fieldErrors 
        },
        { status: 400 }
      );
    }
    
    const { period } = validatedQuery.data;
    
    try {
      // Get booking metrics data
      const bookingData = await getBookingMetrics(providerId, period as TimePeriod);
      
      // Set cache headers for performance (5 minutes for analytics data)
      const headers = {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
        'Content-Type': 'application/json',
      };
      
      return NextResponse.json({
        success: true,
        data: bookingData,
        period,
        timestamp: new Date().toISOString(),
      }, { headers });
      
    } catch (analyticsError) {
      console.error("Analytics error fetching booking metrics:", analyticsError);
      return NextResponse.json(
        { error: "Failed to fetch booking metrics" },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error("Error in booking analytics API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}