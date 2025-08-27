// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/db";
import { referralsTable } from "@/db/schema/loyalty-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq } from "drizzle-orm";
import { withRateLimitRedis } from "@/lib/rate-limit-redis";

// Schema for public referral tracking
const publicTrackReferralSchema = z.object({
  referralCode: z.string().min(6),
  action: z.enum(["validate", "click"]),
});

// ==================== POST: PUBLIC REFERRAL TRACKING ====================

/**
 * Public endpoint for tracking referral link clicks and validation
 * No authentication required
 */
export const POST = withRateLimitRedis(
  { type: "api" },
  async (req: NextRequest): Promise<NextResponse> => {
    try {
      const body = await req.json();
      const validationResult = publicTrackReferralSchema.safeParse(body);
      
      if (!validationResult.success) {
        return NextResponse.json(
          { 
            success: false, 
            error: validationResult.error.errors[0]?.message || "Invalid input" 
          },
          { status: 400 }
        );
      }

      const data = validationResult.data;

      // Find referral by code
      const [referral] = await db
        .select({
          id: referralsTable.id,
          referralCode: referralsTable.referralCode,
          referredEmail: referralsTable.referredEmail,
          referrerId: referralsTable.referrerId,
          status: referralsTable.status,
          expiresAt: referralsTable.expiresAt,
          clickedAt: referralsTable.clickedAt,
          referrerRewardPoints: referralsTable.referrerRewardPoints,
          referredRewardPoints: referralsTable.referredRewardPoints,
        })
        .from(referralsTable)
        .where(eq(referralsTable.referralCode, data.referralCode))
        .limit(1);

      if (!referral) {
        return NextResponse.json(
          { 
            success: false, 
            error: "Invalid referral code",
            valid: false,
          },
          { status: 404 }
        );
      }

      // Check if referral is expired
      const isExpired = referral.expiresAt && referral.expiresAt < new Date();
      
      if (isExpired) {
        // Update status if not already marked as expired
        if (referral.status !== "expired") {
          await db
            .update(referralsTable)
            .set({ status: "expired" })
            .where(eq(referralsTable.id, referral.id));
        }

        return NextResponse.json(
          { 
            success: false, 
            error: "This referral link has expired",
            valid: false,
            expired: true,
          },
          { status: 400 }
        );
      }

      // Check if referral is already completed
      if (referral.status === "completed") {
        return NextResponse.json(
          { 
            success: false, 
            error: "This referral has already been completed",
            valid: false,
            completed: true,
          },
          { status: 400 }
        );
      }

      // Check if referral is cancelled
      if (referral.status === "cancelled") {
        return NextResponse.json(
          { 
            success: false, 
            error: "This referral has been cancelled",
            valid: false,
            cancelled: true,
          },
          { status: 400 }
        );
      }

      // Get referrer information
      const [referrer] = await db
        .select({
          firstName: profilesTable.firstName,
          lastName: profilesTable.lastName,
        })
        .from(profilesTable)
        .where(eq(profilesTable.userId, referral.referrerId))
        .limit(1);

      // Handle validation request
      if (data.action === "validate") {
        return NextResponse.json(
          {
            success: true,
            valid: true,
            referral: {
              code: referral.referralCode,
              referrerName: referrer ? `${referrer.firstName} ${referrer.lastName}` : "A friend",
              referredEmail: referral.referredEmail,
              rewards: {
                signupBonus: referral.referredRewardPoints,
                referrerBonus: referral.referrerRewardPoints,
              },
              expiresAt: referral.expiresAt,
              status: referral.status,
            },
          },
          { status: 200 }
        );
      }

      // Handle click tracking
      if (data.action === "click") {
        // Only update if this is the first click
        if (referral.status === "pending" && !referral.clickedAt) {
          await db
            .update(referralsTable)
            .set({
              status: "clicked",
              clickedAt: new Date(),
            })
            .where(eq(referralsTable.id, referral.id));

          console.log("Referral click tracked:", {
            referralId: referral.id,
            referralCode: referral.referralCode,
            timestamp: new Date().toISOString(),
          });
        }

        return NextResponse.json(
          {
            success: true,
            tracked: true,
            referral: {
              code: referral.referralCode,
              referrerName: referrer ? `${referrer.firstName} ${referrer.lastName}` : "A friend",
              referredEmail: referral.referredEmail,
              rewards: {
                signupBonus: referral.referredRewardPoints,
                referrerBonus: referral.referrerRewardPoints,
              },
            },
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { success: false, error: "Invalid action" },
        { status: 400 }
      );

    } catch (error) {
      console.error("Track referral error:", error);
      return NextResponse.json(
        { success: false, error: "Failed to track referral" },
        { status: 500 }
      );
    }
  }
);

// ==================== GET: PUBLIC REFERRAL INFO ====================

/**
 * Get public referral information by code
 * No authentication required
 */
export const GET = withRateLimitRedis(
  { type: "api" },
  async (req: NextRequest): Promise<NextResponse> => {
    try {
      const searchParams = req.nextUrl.searchParams;
      const referralCode = searchParams.get("code");

      if (!referralCode || referralCode.length < 6) {
        return NextResponse.json(
          { 
            success: false, 
            error: "Invalid or missing referral code" 
          },
          { status: 400 }
        );
      }

      // Find referral by code
      const [referral] = await db
        .select({
          referralCode: referralsTable.referralCode,
          referredEmail: referralsTable.referredEmail,
          referrerId: referralsTable.referrerId,
          status: referralsTable.status,
          expiresAt: referralsTable.expiresAt,
          referrerRewardPoints: referralsTable.referrerRewardPoints,
          referredRewardPoints: referralsTable.referredRewardPoints,
          source: referralsTable.source,
        })
        .from(referralsTable)
        .where(eq(referralsTable.referralCode, referralCode))
        .limit(1);

      if (!referral) {
        return NextResponse.json(
          { 
            success: false, 
            error: "Referral code not found",
            valid: false,
          },
          { status: 404 }
        );
      }

      // Check if expired
      const isExpired = referral.expiresAt && referral.expiresAt < new Date();
      const isValid = !isExpired && 
                      referral.status !== "completed" && 
                      referral.status !== "cancelled";

      // Get referrer info
      const [referrer] = await db
        .select({
          firstName: profilesTable.firstName,
          lastName: profilesTable.lastName,
        })
        .from(profilesTable)
        .where(eq(profilesTable.userId, referral.referrerId))
        .limit(1);

      return NextResponse.json(
        {
          success: true,
          valid: isValid,
          expired: isExpired,
          referral: {
            code: referral.referralCode,
            referrerName: referrer ? `${referrer.firstName} ${referrer.lastName}` : "A friend",
            status: referral.status,
            rewards: {
              signupBonus: referral.referredRewardPoints,
              referrerBonus: referral.referrerRewardPoints,
            },
            expiresAt: referral.expiresAt,
            source: referral.source,
          },
        },
        { status: 200 }
      );

    } catch (error) {
      console.error("Get referral info error:", error);
      return NextResponse.json(
        { success: false, error: "Failed to get referral information" },
        { status: 500 }
      );
    }
  }
);

// ==================== OPTIONS: CORS PREFLIGHT ====================

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*", // Allow all origins for public endpoint
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}