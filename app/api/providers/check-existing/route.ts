// @ts-nocheck
/**
 * API Route: Check Existing Provider Profile
 * 
 * Checks if the authenticated user already has a provider profile
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getProviderByUserId } from "@/db/queries/providers-queries";

export async function GET() {
  try {
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const existingProvider = await getProviderByUserId(userId);
    
    return NextResponse.json({
      hasProfile: !!existingProvider,
      providerId: existingProvider?.id || null,
    });
  } catch (error) {
    console.error("Error checking existing provider:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}