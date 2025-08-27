// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/db/db";
import { 
  loyaltyAccountsTable, 
  pointsTransactionsTable,
  redemptionOptionsTable,
  type RedemptionOption
} from "@/db/schema/loyalty-schema";
import { eq, and, gte, lte, or, isNull, sql } from "drizzle-orm";
import { withRateLimitRedis } from "@/lib/rate-limit-redis";
import { logApiStart, logApiSuccess, logApiError } from "@/lib/logger";
import crypto from "crypto";

// Input validation schemas
const redeemPointsSchema = z.object({
  redemptionOptionId: z.string().uuid("Invalid redemption option ID"),
  quantity: z.number().int().positive().default(1),
  bookingId: z.string().uuid().optional(), // For discount redemptions
  metadata: z.record(z.any()).optional(),
});

const createRedemptionOptionSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  type: z.enum(["discount", "free_service", "gift_card", "donation"]),
  pointsCost: z.number().int().positive(),
  discountPercent: z.number().int().min(0).max(100).optional(),
  discountAmountCents: z.number().int().positive().optional(),
  serviceId: z.string().uuid().optional(),
  minBookingAmount: z.number().int().positive().optional(),
  validCategories: z.array(z.string()).optional(),
  validProviders: z.array(z.string().uuid()).optional(),
  stockLimit: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional(),
  imageUrl: z.string().url().optional(),
  terms: z.string().max(2000).optional(),
});

// Response types
interface RedemptionResponse {
  success: boolean;
  data?: {
    transactionId: string;
    pointsRedeemed: number;
    newBalance: number;
    redemptionCode?: string;
    discountAmount?: number;
    expiresAt?: string;
    details: any;
  };
  error?: string;
}

// Helper function to generate redemption code
function generateRedemptionCode(): string {
  const prefix = "RDM";
  const randomPart = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `${prefix}-${randomPart}`;
}

// Helper function to calculate actual discount amount
function calculateDiscountAmount(option: RedemptionOption, bookingAmountCents?: number): number {
  if (option.discountPercent && bookingAmountCents) {
    return Math.floor((bookingAmountCents * option.discountPercent) / 100);
  }
  return option.discountAmountCents || 0;
}

// POST - Redeem points
export const POST = withRateLimitRedis(
  { type: "api" },
  async (req: NextRequest): Promise<NextResponse<RedemptionResponse>> => {
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
      const validationResult = redeemPointsSchema.safeParse(body);
      
      if (!validationResult.success) {
        return NextResponse.json(
          { 
            success: false,
            error: validationResult.error.errors[0]?.message || "Invalid input" 
          },
          { status: 400 }
        );
      }

      const { redemptionOptionId, quantity, bookingId, metadata } = validationResult.data;

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
            error: "Loyalty account not found. Start earning points to create an account." 
          },
          { status: 404 }
        );
      }

      // Check if account is active
      if (!loyaltyAccount.isActive || loyaltyAccount.isSuspended) {
        return NextResponse.json(
          { 
            success: false,
            error: "Loyalty account is not active",
            reason: loyaltyAccount.suspensionReason 
          } as any,
          { status: 403 }
        );
      }

      // Get redemption option
      const [redemptionOption] = await db
        .select()
        .from(redemptionOptionsTable)
        .where(
          and(
            eq(redemptionOptionsTable.id, redemptionOptionId),
            eq(redemptionOptionsTable.isActive, true)
          )
        )
        .limit(1);

      if (!redemptionOption) {
        return NextResponse.json(
          { 
            success: false,
            error: "Redemption option not found or no longer available" 
          },
          { status: 404 }
        );
      }

      // Check if option has expired
      if (redemptionOption.expiresAt && new Date(redemptionOption.expiresAt) < new Date()) {
        return NextResponse.json(
          { 
            success: false,
            error: "This redemption option has expired" 
          },
          { status: 400 }
        );
      }

      // Check stock availability
      if (redemptionOption.stockLimit !== null && redemptionOption.stockRemaining !== null) {
        if (redemptionOption.stockRemaining < quantity) {
          return NextResponse.json(
            { 
              success: false,
              error: `Only ${redemptionOption.stockRemaining} items remaining` 
            },
            { status: 400 }
          );
        }
      }

      // Calculate total points cost
      const totalPointsCost = redemptionOption.pointsCost * quantity;

      // Check if user has enough points
      if (loyaltyAccount.pointsBalance < totalPointsCost) {
        return NextResponse.json(
          { 
            success: false,
            error: `Insufficient points. You need ${totalPointsCost} points but only have ${loyaltyAccount.pointsBalance}` 
          },
          { status: 400 }
        );
      }

      // Generate redemption code
      const redemptionCode = generateRedemptionCode();
      const expirationDate = new Date();
      expirationDate.setMonth(expirationDate.getMonth() + 3); // 3 month expiration

      // Process redemption in transaction
      const result = await db.transaction(async (tx) => {
        // Update loyalty account balance
        const newBalance = loyaltyAccount.pointsBalance - totalPointsCost;
        const newLifetimeRedeemed = loyaltyAccount.lifetimePointsRedeemed + totalPointsCost;

        await tx
          .update(loyaltyAccountsTable)
          .set({
            pointsBalance: newBalance,
            lifetimePointsRedeemed: newLifetimeRedeemed,
            lastActivityAt: new Date(),
            lastRedeemedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(loyaltyAccountsTable.id, loyaltyAccount.id));

        // Create redemption transaction
        const [transaction] = await tx
          .insert(pointsTransactionsTable)
          .values({
            accountId: loyaltyAccount.id,
            type: redemptionOption.type === "discount" ? "redeemed_discount" : "redeemed_service",
            points: -totalPointsCost, // Negative for redemptions
            balanceBefore: loyaltyAccount.pointsBalance,
            balanceAfter: newBalance,
            bookingId,
            description: `Redeemed ${quantity}x ${redemptionOption.name}`,
            metadata: {
              redemptionOptionId,
              redemptionCode,
              quantity,
              optionType: redemptionOption.type,
              optionName: redemptionOption.name,
              expiresAt: expirationDate.toISOString(),
              ...metadata,
            },
          })
          .returning();

        // Update stock if applicable
        if (redemptionOption.stockLimit !== null && redemptionOption.stockRemaining !== null) {
          await tx
            .update(redemptionOptionsTable)
            .set({
              stockRemaining: redemptionOption.stockRemaining - quantity,
            })
            .where(eq(redemptionOptionsTable.id, redemptionOptionId));
        }

        return {
          transaction,
          newBalance,
        };
      });

      // Calculate discount amount if applicable
      let discountAmount: number | undefined;
      if (redemptionOption.type === "discount") {
        // For now, return the maximum possible discount
        // In real use, this would be applied at checkout
        if (redemptionOption.discountPercent) {
          discountAmount = redemptionOption.discountPercent;
        } else if (redemptionOption.discountAmountCents) {
          discountAmount = redemptionOption.discountAmountCents / 100;
        }
      }

      // Log redemption
      const logger = logApiStart("/api/loyalty/redeem", "POST", userId);
      logApiSuccess(logger, "Points redeemed successfully", {
        redemptionOptionId,
        pointsRedeemed: totalPointsCost,
        newBalance: result.newBalance
      });

      // Return success response
      return NextResponse.json(
        {
          success: true,
          data: {
            transactionId: result.transaction.id,
            pointsRedeemed: totalPointsCost,
            newBalance: result.newBalance,
            redemptionCode,
            discountAmount,
            expiresAt: expirationDate.toISOString(),
            details: {
              type: redemptionOption.type,
              name: redemptionOption.name,
              description: redemptionOption.description,
              quantity,
              terms: redemptionOption.terms,
            },
          },
        },
        { status: 200 }
      );

    } catch (error) {
      const logger = logApiStart("/api/loyalty/redeem", "POST", userId || "anonymous");
      logApiError(logger, "Failed to redeem points", error as Error);
      
      return NextResponse.json(
        { 
          success: false,
          error: "Failed to redeem points. Please try again." 
        },
        { status: 500 }
      );
    }
  }
);

// GET - Get available redemption options
export const GET = withRateLimitRedis(
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

      // Get user's loyalty account to check balance
      const [loyaltyAccount] = await db
        .select({
          pointsBalance: loyaltyAccountsTable.pointsBalance,
          tier: loyaltyAccountsTable.tier,
        })
        .from(loyaltyAccountsTable)
        .where(eq(loyaltyAccountsTable.customerId, userId))
        .limit(1);

      // Get all active redemption options
      const redemptionOptions = await db
        .select()
        .from(redemptionOptionsTable)
        .where(
          and(
            eq(redemptionOptionsTable.isActive, true),
            or(
              isNull(redemptionOptionsTable.expiresAt),
              gte(redemptionOptionsTable.expiresAt, new Date())
            )
          )
        );

      // Filter and enhance options based on user's points balance
      const availableOptions = redemptionOptions.map(option => ({
        id: option.id,
        name: option.name,
        description: option.description,
        type: option.type,
        pointsCost: option.pointsCost,
        canAfford: loyaltyAccount ? loyaltyAccount.pointsBalance >= option.pointsCost : false,
        discountPercent: option.discountPercent,
        discountAmountCents: option.discountAmountCents,
        minBookingAmount: option.minBookingAmount,
        validCategories: option.validCategories,
        validProviders: option.validProviders,
        stockRemaining: option.stockRemaining,
        expiresAt: option.expiresAt,
        imageUrl: option.imageUrl,
        terms: option.terms,
      }));

      // Sort by points cost (affordable ones first)
      availableOptions.sort((a, b) => {
        if (a.canAfford && !b.canAfford) return -1;
        if (!a.canAfford && b.canAfford) return 1;
        return a.pointsCost - b.pointsCost;
      });

      return NextResponse.json(
        {
          success: true,
          data: {
            userBalance: loyaltyAccount?.pointsBalance || 0,
            userTier: loyaltyAccount?.tier || "bronze",
            options: availableOptions,
          },
        },
        { status: 200 }
      );

    } catch (error) {
      const logger = logApiStart("/api/loyalty/redeem", "GET", userId || "anonymous");
      logApiError(logger, "Failed to get redemption options", error as Error);
      
      return NextResponse.json(
        { 
          success: false,
          error: "Failed to fetch redemption options" 
        },
        { status: 500 }
      );
    }
  }
);

// PUT - Create or update redemption option (admin only)
export const PUT = withRateLimitRedis(
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

      // TODO: Add admin role check here
      // For now, we'll restrict this endpoint

      // Parse and validate request body
      const body = await req.json();
      const validationResult = createRedemptionOptionSchema.safeParse(body);
      
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

      // Create redemption option
      const [newOption] = await db
        .insert(redemptionOptionsTable)
        .values({
          name: data.name,
          description: data.description || "",
          type: data.type,
          pointsCost: data.pointsCost,
          discountPercent: data.discountPercent,
          discountAmountCents: data.discountAmountCents,
          serviceId: data.serviceId,
          minBookingAmount: data.minBookingAmount,
          validCategories: data.validCategories || [],
          validProviders: data.validProviders || [],
          isActive: true,
          stockLimit: data.stockLimit,
          stockRemaining: data.stockLimit, // Initial stock equals limit
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
          imageUrl: data.imageUrl,
          terms: data.terms,
          metadata: {},
        })
        .returning();

      // Log creation
      const logger = logApiStart("/api/loyalty/redeem", "PUT", userId);
      logApiSuccess(logger, "Redemption option created", {
        optionId: newOption.id,
        name: newOption.name,
        type: newOption.type
      });

      return NextResponse.json(
        {
          success: true,
          data: newOption,
        },
        { status: 201 }
      );

    } catch (error) {
      const logger = logApiStart("/api/loyalty/redeem", "PUT", userId || "anonymous");
      logApiError(logger, "Failed to create redemption option", error as Error);
      
      return NextResponse.json(
        { 
          success: false,
          error: "Failed to create redemption option" 
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
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}