import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/db/db";
import { 
  loyaltyAccountsTable, 
  pointsTransactionsTable,
  loyaltyTiersTable,
  type LoyaltyAccount,
  type PointsTransaction
} from "@/db/schema/loyalty-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { withRateLimitRedis } from "@/lib/rate-limit-redis";
import { logApiStart, logApiSuccess, logApiError } from "@/lib/logger";

// Query parameter schemas
const accountQuerySchema = z.object({
  includeTransactions: z.enum(["true", "false"]).optional(),
  transactionLimit: z.string().regex(/^\d+$/).optional(),
});

const updatePreferencesSchema = z.object({
  emailNotifications: z.boolean().optional(),
  autoRedeem: z.boolean().optional(),
  preferredRedemptionTypes: z.array(z.string()).optional(),
});

// Response types
interface AccountDetailsResponse {
  success: boolean;
  data?: {
    account: {
      id: string;
      customerId: string;
      customerName?: string;
      customerEmail?: string;
      pointsBalance: number;
      lifetimePointsEarned: number;
      lifetimePointsRedeemed: number;
      tier: string;
      tierProgressAmount: number;
      nextTierThreshold: number | null;
      tierExpiresAt: Date | null;
      benefitsUnlocked: any[];
      specialOffers: any[];
      lastActivityAt: Date | null;
      isActive: boolean;
      isSuspended: boolean;
      preferences: any;
      createdAt: Date;
    };
    tierInfo?: {
      currentTier: any;
      nextTier: any;
      progressPercentage: number;
    };
    recentTransactions?: PointsTransaction[];
    statistics?: {
      pointsExpiringSoon: number;
      averageEarnRate: number;
      totalBookings: number;
      referralCount: number;
    };
  };
  error?: string;
}

// Helper function to calculate points expiring soon (within 30 days)
async function calculateExpiringPoints(accountId: string): Promise<number> {
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const result = await db
    .select({
      total: sql<number>`COALESCE(SUM(${pointsTransactionsTable.points}), 0)`,
    })
    .from(pointsTransactionsTable)
    .where(
      and(
        eq(pointsTransactionsTable.accountId, accountId),
        gte(pointsTransactionsTable.points, 0), // Only earned points
        lte(pointsTransactionsTable.expiresAt, thirtyDaysFromNow),
        gte(pointsTransactionsTable.expiresAt, new Date())
      )
    );

  return result[0]?.total || 0;
}

// GET - Get loyalty account details
export const GET = withRateLimitRedis(
  { type: "api" },
  async (req: NextRequest): Promise<NextResponse<AccountDetailsResponse>> => {
    try {
      // Authenticate user
      const { userId } = await auth();
      
      if (!userId) {
        return NextResponse.json(
          { 
            success: false,
            error: "Authentication required" 
          },
          { status: 401 }
        );
      }

      // Parse query parameters
      const { searchParams } = new URL(req.url);
      const queryParams = {
        includeTransactions: searchParams.get("includeTransactions") || "false",
        transactionLimit: searchParams.get("transactionLimit") || "10",
      };

      const validationResult = accountQuerySchema.safeParse(queryParams);
      if (!validationResult.success) {
        return NextResponse.json(
          { 
            success: false,
            error: "Invalid query parameters" 
          },
          { status: 400 }
        );
      }

      const { includeTransactions, transactionLimit } = validationResult.data;
      const txLimit = parseInt(transactionLimit || "10");

      // Get loyalty account
      const [loyaltyAccount] = await db
        .select()
        .from(loyaltyAccountsTable)
        .where(eq(loyaltyAccountsTable.customerId, userId))
        .limit(1);

      if (!loyaltyAccount) {
        // Return a default account structure for new users
        return NextResponse.json(
          {
            success: true,
            data: {
              account: {
                id: "",
                customerId: userId,
                pointsBalance: 0,
                lifetimePointsEarned: 0,
                lifetimePointsRedeemed: 0,
                tier: "bronze",
                tierProgressAmount: 0,
                nextTierThreshold: 1000, // Silver threshold
                tierExpiresAt: null,
                benefitsUnlocked: [],
                specialOffers: [],
                lastActivityAt: null,
                isActive: true,
                isSuspended: false,
                preferences: {
                  emailNotifications: true,
                  autoRedeem: false,
                },
                createdAt: new Date(),
              },
              tierInfo: {
                currentTier: {
                  name: "Bronze",
                  benefits: ["Start earning points on every purchase"],
                },
                nextTier: {
                  name: "Silver",
                  threshold: 1000,
                  benefits: ["1.2x points multiplier", "Birthday bonus"],
                },
                progressPercentage: 0,
              },
            },
          },
          { status: 200 }
        );
      }

      // Get customer profile details
      const [profile] = await db
        .select({
          firstName: profilesTable.firstName,
          lastName: profilesTable.lastName,
          email: profilesTable.email,
        })
        .from(profilesTable)
        .where(eq(profilesTable.userId, userId))
        .limit(1);

      // Get current tier info
      const [currentTierInfo] = await db
        .select()
        .from(loyaltyTiersTable)
        .where(eq(loyaltyTiersTable.tier, loyaltyAccount.tier))
        .limit(1);

      // Get next tier info (if not at max tier)
      let nextTierInfo = null;
      let progressPercentage = 100; // Default for max tier

      const tierOrder = ["bronze", "silver", "gold", "platinum", "diamond"];
      const currentTierIndex = tierOrder.indexOf(loyaltyAccount.tier);
      
      if (currentTierIndex < tierOrder.length - 1) {
        const nextTierName = tierOrder[currentTierIndex + 1];
        [nextTierInfo] = await db
          .select()
          .from(loyaltyTiersTable)
          .where(eq(loyaltyTiersTable.tier, nextTierName as any))
          .limit(1);

        if (nextTierInfo && loyaltyAccount.nextTierThreshold) {
          progressPercentage = Math.min(
            100,
            Math.floor((loyaltyAccount.tierProgressAmount / loyaltyAccount.nextTierThreshold) * 100)
          );
        }
      }

      // Get recent transactions if requested
      let recentTransactions: PointsTransaction[] = [];
      if (includeTransactions === "true") {
        recentTransactions = await db
          .select()
          .from(pointsTransactionsTable)
          .where(eq(pointsTransactionsTable.accountId, loyaltyAccount.id))
          .orderBy(desc(pointsTransactionsTable.createdAt))
          .limit(txLimit);
      }

      // Calculate statistics
      const expiringPoints = await calculateExpiringPoints(loyaltyAccount.id);
      
      // Calculate average earn rate (points per month over last 3 months)
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      
      const earnedPointsResult = await db
        .select({
          total: sql<number>`COALESCE(SUM(${pointsTransactionsTable.points}), 0)`,
          count: sql<number>`COUNT(*)`,
        })
        .from(pointsTransactionsTable)
        .where(
          and(
            eq(pointsTransactionsTable.accountId, loyaltyAccount.id),
            gte(pointsTransactionsTable.points, 0),
            gte(pointsTransactionsTable.createdAt, threeMonthsAgo)
          )
        );

      const averageEarnRate = Math.floor(earnedPointsResult[0]?.total / 3) || 0;

      // Count bookings and referrals
      const transactionStats = await db
        .select({
          bookingCount: sql<number>`COUNT(DISTINCT ${pointsTransactionsTable.bookingId})`,
          referralCount: sql<number>`COUNT(DISTINCT ${pointsTransactionsTable.referralId})`,
        })
        .from(pointsTransactionsTable)
        .where(eq(pointsTransactionsTable.accountId, loyaltyAccount.id));

      const stats = {
        pointsExpiringSoon: expiringPoints,
        averageEarnRate,
        totalBookings: transactionStats[0]?.bookingCount || 0,
        referralCount: transactionStats[0]?.referralCount || 0,
      };

      // Format response
      const responseData: AccountDetailsResponse["data"] = {
        account: {
          id: loyaltyAccount.id,
          customerId: loyaltyAccount.customerId,
          customerName: profile ? `${profile.firstName} ${profile.lastName}` : undefined,
          customerEmail: profile?.email,
          pointsBalance: loyaltyAccount.pointsBalance,
          lifetimePointsEarned: loyaltyAccount.lifetimePointsEarned,
          lifetimePointsRedeemed: loyaltyAccount.lifetimePointsRedeemed,
          tier: loyaltyAccount.tier,
          tierProgressAmount: loyaltyAccount.tierProgressAmount || 0,
          nextTierThreshold: loyaltyAccount.nextTierThreshold,
          tierExpiresAt: loyaltyAccount.tierExpiresAt,
          benefitsUnlocked: loyaltyAccount.benefitsUnlocked as any[] || [],
          specialOffers: loyaltyAccount.specialOffers as any[] || [],
          lastActivityAt: loyaltyAccount.lastActivityAt,
          isActive: loyaltyAccount.isActive,
          isSuspended: loyaltyAccount.isSuspended,
          preferences: loyaltyAccount.preferences || {},
          createdAt: loyaltyAccount.createdAt,
        },
        tierInfo: {
          currentTier: currentTierInfo ? {
            name: currentTierInfo.displayName,
            description: currentTierInfo.description,
            benefits: currentTierInfo.benefits,
            pointsMultiplier: currentTierInfo.pointsMultiplier,
            discountPercent: currentTierInfo.discountPercent,
            color: currentTierInfo.color,
          } : null,
          nextTier: nextTierInfo ? {
            name: nextTierInfo.displayName,
            description: nextTierInfo.description,
            benefits: nextTierInfo.benefits,
            threshold: nextTierInfo.minPoints,
            pointsNeeded: (nextTierInfo.minPoints || 0) - (loyaltyAccount.tierProgressAmount || 0),
          } : null,
          progressPercentage,
        },
        statistics: stats,
      };

      if (includeTransactions === "true") {
        responseData.recentTransactions = recentTransactions;
      }

      return NextResponse.json(
        {
          success: true,
          data: responseData,
        },
        { status: 200 }
      );

    } catch (error) {
      const logger = logApiStart("/api/loyalty/account", "GET", userId || "anonymous");
      logApiError(logger, "Failed to get loyalty account", error as Error);
      
      return NextResponse.json(
        { 
          success: false,
          error: "Failed to fetch loyalty account details" 
        },
        { status: 500 }
      );
    }
  }
);

// PATCH - Update account preferences
export const PATCH = withRateLimitRedis(
  { type: "api" },
  async (req: NextRequest): Promise<NextResponse> => {
    try {
      // Authenticate user
      const { userId } = await auth();
      
      if (!userId) {
        return NextResponse.json(
          { 
            success: false,
            error: "Authentication required" 
          },
          { status: 401 }
        );
      }

      // Parse and validate request body
      const body = await req.json();
      const validationResult = updatePreferencesSchema.safeParse(body);
      
      if (!validationResult.success) {
        return NextResponse.json(
          { 
            success: false,
            error: validationResult.error.errors[0]?.message || "Invalid input" 
          },
          { status: 400 }
        );
      }

      const updates = validationResult.data;

      // Get loyalty account
      const [loyaltyAccount] = await db
        .select()
        .from(loyaltyAccountsTable)
        .where(eq(loyaltyAccountsTable.customerId, userId))
        .limit(1);

      if (!loyaltyAccount) {
        return NextResponse.json(
          { 
            success: false,
            error: "Loyalty account not found" 
          },
          { status: 404 }
        );
      }

      // Update preferences
      const currentPreferences = (loyaltyAccount.preferences as any) || {};
      const updatedPreferences = {
        ...currentPreferences,
        ...(updates.emailNotifications !== undefined && { emailNotifications: updates.emailNotifications }),
        ...(updates.autoRedeem !== undefined && { autoRedeem: updates.autoRedeem }),
        ...(updates.preferredRedemptionTypes && { preferredRedemptionTypes: updates.preferredRedemptionTypes }),
      };

      const [updatedAccount] = await db
        .update(loyaltyAccountsTable)
        .set({
          preferences: updatedPreferences,
          updatedAt: new Date(),
        })
        .where(eq(loyaltyAccountsTable.id, loyaltyAccount.id))
        .returning();

      // Log update
      const logger = logApiStart("/api/loyalty/account", "PATCH", userId);
      logApiSuccess(logger, "Loyalty account preferences updated", {
        accountId: loyaltyAccount.id
      });

      return NextResponse.json(
        {
          success: true,
          data: {
            preferences: updatedAccount.preferences,
          },
        },
        { status: 200 }
      );

    } catch (error) {
      const logger = logApiStart("/api/loyalty/account", "PATCH", userId || "anonymous");
      logApiError(logger, "Failed to update loyalty account", error as Error);
      
      return NextResponse.json(
        { 
          success: false,
          error: "Failed to update account preferences" 
        },
        { status: 500 }
      );
    }
  }
);

// DELETE - Deactivate loyalty account (soft delete)
export const DELETE = withRateLimitRedis(
  { type: "api" },
  async (req: NextRequest): Promise<NextResponse> => {
    try {
      // Authenticate user
      const { userId } = await auth();
      
      if (!userId) {
        return NextResponse.json(
          { 
            success: false,
            error: "Authentication required" 
          },
          { status: 401 }
        );
      }

      // Get loyalty account
      const [loyaltyAccount] = await db
        .select()
        .from(loyaltyAccountsTable)
        .where(eq(loyaltyAccountsTable.customerId, userId))
        .limit(1);

      if (!loyaltyAccount) {
        return NextResponse.json(
          { 
            success: false,
            error: "Loyalty account not found" 
          },
          { status: 404 }
        );
      }

      // Check if there are unredeemed points
      if (loyaltyAccount.pointsBalance > 0) {
        return NextResponse.json(
          { 
            success: false,
            error: `You have ${loyaltyAccount.pointsBalance} unredeemed points. Please redeem them before deactivating your account.` 
          },
          { status: 400 }
        );
      }

      // Soft delete - deactivate the account
      await db
        .update(loyaltyAccountsTable)
        .set({
          isActive: false,
          metadata: {
            ...(loyaltyAccount.metadata as any || {}),
            deactivatedAt: new Date().toISOString(),
            deactivatedBy: userId,
          },
          updatedAt: new Date(),
        })
        .where(eq(loyaltyAccountsTable.id, loyaltyAccount.id));

      // Log deactivation
      const logger = logApiStart("/api/loyalty/account", "DELETE", userId);
      logApiSuccess(logger, "Loyalty account deactivated", {
        accountId: loyaltyAccount.id
      });

      return NextResponse.json(
        {
          success: true,
          message: "Loyalty account has been deactivated",
        },
        { status: 200 }
      );

    } catch (error) {
      const logger = logApiStart("/api/loyalty/account", "DELETE", userId || "anonymous");
      logApiError(logger, "Failed to deactivate loyalty account", error as Error);
      
      return NextResponse.json(
        { 
          success: false,
          error: "Failed to deactivate loyalty account" 
        },
        { status: 500 }
      );
    }
  }
);

// OPTIONS request for CORS preflight
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_APP_URL || '*',
      'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}