import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCsrfTokenForUser } from "@/lib/csrf";

/**
 * CSRF Token API
 * GET /api/csrf - Get a CSRF token for the authenticated user
 */

export async function GET(req: NextRequest) {
  try {
    const { userId } = auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    try {
      const csrfData = await getCsrfTokenForUser(userId);
      
      return NextResponse.json({
        csrfToken: csrfData.token,
        expiresAt: csrfData.expiresAt,
      });
      
    } catch (error) {
      console.error("Error generating CSRF token:", error);
      return NextResponse.json(
        { error: "Failed to generate CSRF token" },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error("Error in CSRF token API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Health check for CSRF API
 */
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}