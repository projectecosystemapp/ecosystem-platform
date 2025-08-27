// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getProviderById } from "@/db/queries/providers-queries";
import { 
  getProviderEarnings,
  getBookingMetrics,
  getCustomerMetrics,
  getPerformanceMetrics,
  getRevenueBreakdown,
  getTopServices,
  TimePeriod 
} from "@/db/queries/analytics-queries";
import { z } from "zod";

/**
 * Provider Analytics Overview API
 * GET /api/providers/[providerId]/analytics/overview
 * 
 * Query Parameters:
 * - period: '7d' | '30d' | '90d' | '1yr' | 'all' (default: '30d')
 * 
 * Returns comprehensive dashboard data including:
 * - Earnings and revenue breakdown
 * - Booking metrics and trends
 * - Customer analytics and retention
 * - Performance metrics and ratings
 * - Top services analysis
 */

const querySchema = z.object({
  period: z.enum(['7d', '30d', '90d', '1yr', 'all']).default('30d'),
});

export interface AnalyticsOverview {
  earnings: any;
  bookings: any;
  customers: any;
  performance: any;
  revenue: any;
  topServices: any;
  summary: {
    totalEarnings: number;
    totalBookings: number;
    averageRating: number;
    completionRate: number;
    customerRetentionRate: number;
    periodComparison: {
      earningsChange: number;
      bookingsChange: number;
      ratingChange: number;
    };
  };
}

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
      // Fetch all analytics data in parallel for better performance
      const [
        earningsData,
        bookingData,
        customerData,
        performanceData,
        revenueData,
        topServicesData,
      ] = await Promise.all([
        getProviderEarnings(providerId, period as TimePeriod),
        getBookingMetrics(providerId, period as TimePeriod),
        getCustomerMetrics(providerId, period as TimePeriod),
        getPerformanceMetrics(providerId, period as TimePeriod),
        getRevenueBreakdown(providerId, period as TimePeriod),
        getTopServices(providerId, period as TimePeriod),
      ]);
      
      // Create summary metrics for dashboard overview
      const summary = {
        totalEarnings: earningsData.totalEarnings,
        totalBookings: bookingData.totalBookings,
        averageRating: performanceData.averageRating,
        completionRate: bookingData.completionRate,
        customerRetentionRate: customerData.customerRetentionRate,
        periodComparison: {
          earningsChange: earningsData.periodComparison.earningsChange,
          bookingsChange: earningsData.periodComparison.bookingsChange,
          ratingChange: 0, // TODO: Add rating comparison from performance metrics
        },
      };
      
      const overview: AnalyticsOverview = {
        earnings: earningsData,
        bookings: bookingData,
        customers: customerData,
        performance: performanceData,
        revenue: revenueData,
        topServices: topServicesData,
        summary,
      };
      
      // Set cache headers for performance (5 minutes for overview data)
      const headers = {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
        'Content-Type': 'application/json',
      };
      
      return NextResponse.json({
        success: true,
        data: overview,
        period,
        timestamp: new Date().toISOString(),
      }, { headers });
      
    } catch (analyticsError) {
      console.error("Analytics error fetching overview data:", analyticsError);
      return NextResponse.json(
        { error: "Failed to fetch analytics overview" },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error("Error in analytics overview API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}