/**
 * GET /api/subscriptions/plans
 * List available subscription plans
 * 
 * Query params:
 * - providerId: Filter by provider
 * - publicOnly: Show only public plans
 */

import { NextRequest, NextResponse } from "next/server";
import { getAvailablePlans } from "@/lib/services/subscription-service";
import { auth } from "@clerk/nextjs/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get("providerId") || undefined;
    const publicOnly = searchParams.get("publicOnly") === "true";
    
    // For authenticated users, show all plans. For guests, only public plans.
    const session = await auth();
    const isPublic = !session?.userId ? true : publicOnly ? true : undefined;

    const plans = await getAvailablePlans({
      providerId,
      isPublic,
      includeInactive: false
    });

    // Sort plans by price
    plans.sort((a, b) => a.basePriceCents - b.basePriceCents);

    return NextResponse.json({
      success: true,
      plans,
      count: plans.length
    });
  } catch (error) {
    console.error("Error fetching subscription plans:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to fetch subscription plans" 
      },
      { status: 500 }
    );
  }
}