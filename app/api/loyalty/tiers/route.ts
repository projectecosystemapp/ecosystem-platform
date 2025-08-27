// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/db/db";
import { 
  loyaltyTiersTable,
  loyaltyAccountsTable,
  loyaltyCampaignsTable,
  type LoyaltyTier
} from "@/db/schema/loyalty-schema";
import { eq, and, gte, lte, or, isNull, desc, asc } from "drizzle-orm";
import { withRateLimitRedis } from "@/lib/rate-limit-redis";

// Input validation schemas
const createTierSchema = z.object({
  tier: z.enum(["bronze", "silver", "gold", "platinum", "diamond"]),
  minSpend: z.number().int().min(0),
  minBookings: z.number().int().min(0).optional(),
  minPoints: z.number().int().min(0).optional(),
  pointsMultiplier: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  discountPercent: z.number().int().min(0).max(100).optional(),
  benefits: z.array(z.string()).optional(),
  prioritySupport: z.boolean().optional(),
  freeDelivery: z.boolean().optional(),
  exclusiveAccess: z.boolean().optional(),
  birthdayBonusPoints: z.number().int().min(0).optional(),
  displayName: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  iconUrl: z.string().url().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
});

const updateTierSchema = createTierSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// Response types
interface TierDetailsResponse {
  success: boolean;
  data?: {
    tiers: Array<{
      tier: string;
      displayName: string;
      description: string | null;
      requirements: {
        minSpend: number;
        minBookings: number;
        minPoints: number;
      };
      benefits: {
        pointsMultiplier: string;
        discountPercent: number;
        benefitsList: any[];
        prioritySupport: boolean;
        freeDelivery: boolean;
        exclusiveAccess: boolean;
        birthdayBonus: number;
      };
      visual: {
        iconUrl: string | null;
        color: string | null;
      };
      isActive: boolean;
    }>;
    userTier?: {
      current: string;
      progress: {
        currentSpend: number;
        currentPoints: number;
        percentageToNext: number;
      };
      nextTier?: {
        name: string;
        pointsNeeded: number;
        spendNeeded: number;
      };
    };
    campaigns?: Array<{
      id: string;
      name: string;
      description: string | null;
      type: string;
      pointsMultiplier: string;
      bonusPoints: number;
      targetTiers: any[];
      startDate: Date;
      endDate: Date;
      isActive: boolean;
    }>;
  };
  error?: string;
}

// Default tier configurations
const DEFAULT_TIERS = [
  {
    tier: "bronze" as const,
    minSpend: 0,
    minBookings: 0,
    minPoints: 0,
    pointsMultiplier: "1.00",
    discountPercent: 0,
    benefits: ["Start earning points", "Access to basic rewards"],
    displayName: "Bronze",
    description: "Welcome to our loyalty program! Start earning points on every purchase.",
    color: "#CD7F32",
    birthdayBonusPoints: 100,
  },
  {
    tier: "silver" as const,
    minSpend: 100000, // $1,000 in cents
    minBookings: 3,
    minPoints: 1000,
    pointsMultiplier: "1.20",
    discountPercent: 5,
    benefits: ["1.2x points on all purchases", "5% discount", "Birthday bonus"],
    displayName: "Silver",
    description: "Enhanced rewards and exclusive perks for our valued customers.",
    color: "#C0C0C0",
    birthdayBonusPoints: 250,
  },
  {
    tier: "gold" as const,
    minSpend: 500000, // $5,000 in cents
    minBookings: 10,
    minPoints: 5000,
    pointsMultiplier: "1.50",
    discountPercent: 10,
    benefits: ["1.5x points on all purchases", "10% discount", "Priority support", "Free delivery"],
    displayName: "Gold",
    description: "Premium benefits and VIP treatment for our loyal customers.",
    color: "#FFD700",
    birthdayBonusPoints: 500,
    prioritySupport: true,
    freeDelivery: true,
  },
  {
    tier: "platinum" as const,
    minSpend: 1000000, // $10,000 in cents
    minBookings: 20,
    minPoints: 10000,
    pointsMultiplier: "2.00",
    discountPercent: 15,
    benefits: ["2x points on all purchases", "15% discount", "Exclusive access", "Personal account manager"],
    displayName: "Platinum",
    description: "Elite status with maximum rewards and exclusive privileges.",
    color: "#E5E4E2",
    birthdayBonusPoints: 1000,
    prioritySupport: true,
    freeDelivery: true,
    exclusiveAccess: true,
  },
  {
    tier: "diamond" as const,
    minSpend: 2500000, // $25,000 in cents
    minBookings: 50,
    minPoints: 25000,
    pointsMultiplier: "3.00",
    discountPercent: 20,
    benefits: ["3x points on all purchases", "20% discount", "White glove service", "Custom rewards"],
    displayName: "Diamond",
    description: "The pinnacle of our loyalty program with unmatched benefits.",
    color: "#B9F2FF",
    birthdayBonusPoints: 2500,
    prioritySupport: true,
    freeDelivery: true,
    exclusiveAccess: true,
  },
];

// GET - Get all loyalty tiers
export const GET = withRateLimitRedis(
  { type: "api" },
  async (req: NextRequest): Promise<NextResponse<TierDetailsResponse>> => {
    try {
      // Optional authentication for personalized data
      const { userId } = await auth();
      
      // Get all active tiers
      let tiers = await db
        .select()
        .from(loyaltyTiersTable)
        .where(eq(loyaltyTiersTable.isActive, true))
        .orderBy(asc(loyaltyTiersTable.minPoints));

      // If no tiers exist, initialize with defaults
      if (tiers.length === 0) {
        console.log("Initializing default loyalty tiers...");
        
        for (const defaultTier of DEFAULT_TIERS) {
          const [newTier] = await db
            .insert(loyaltyTiersTable)
            .values({
              ...defaultTier,
              isActive: true,
            })
            .returning();
          tiers.push(newTier);
        }
        
        console.log("Default loyalty tiers initialized");
      }

      // Format tier data
      const formattedTiers = tiers.map(tier => ({
        tier: tier.tier,
        displayName: tier.displayName,
        description: tier.description,
        requirements: {
          minSpend: tier.minSpend,
          minBookings: tier.minBookings || 0,
          minPoints: tier.minPoints || 0,
        },
        benefits: {
          pointsMultiplier: tier.pointsMultiplier || "1.00",
          discountPercent: tier.discountPercent || 0,
          benefitsList: (tier.benefits as any[]) || [],
          prioritySupport: tier.prioritySupport,
          freeDelivery: tier.freeDelivery,
          exclusiveAccess: tier.exclusiveAccess,
          birthdayBonus: tier.birthdayBonusPoints || 0,
        },
        visual: {
          iconUrl: tier.iconUrl,
          color: tier.color,
        },
        isActive: tier.isActive,
      }));

      // Get user-specific tier data if authenticated
      let userTierData = undefined;
      if (userId) {
        const [userAccount] = await db
          .select()
          .from(loyaltyAccountsTable)
          .where(eq(loyaltyAccountsTable.customerId, userId))
          .limit(1);

        if (userAccount) {
          const currentTier = tiers.find(t => t.tier === userAccount.tier);
          const tierOrder = ["bronze", "silver", "gold", "platinum", "diamond"];
          const currentTierIndex = tierOrder.indexOf(userAccount.tier);
          
          let nextTierInfo = undefined;
          let percentageToNext = 100;
          
          if (currentTierIndex < tierOrder.length - 1) {
            const nextTierName = tierOrder[currentTierIndex + 1];
            const nextTier = tiers.find(t => t.tier === nextTierName);
            
            if (nextTier) {
              const pointsNeeded = (nextTier.minPoints || 0) - userAccount.lifetimePointsEarned;
              const spendNeeded = nextTier.minSpend - (userAccount.tierProgressAmount || 0);
              
              percentageToNext = Math.min(
                100,
                Math.floor(
                  (userAccount.lifetimePointsEarned / (nextTier.minPoints || 1)) * 100
                )
              );
              
              nextTierInfo = {
                name: nextTier.displayName,
                pointsNeeded: Math.max(0, pointsNeeded),
                spendNeeded: Math.max(0, spendNeeded),
              };
            }
          }

          userTierData = {
            current: userAccount.tier,
            progress: {
              currentSpend: userAccount.tierProgressAmount || 0,
              currentPoints: userAccount.lifetimePointsEarned,
              percentageToNext,
            },
            nextTier: nextTierInfo,
          };
        }
      }

      // Get active campaigns
      const now = new Date();
      const campaigns = await db
        .select()
        .from(loyaltyCampaignsTable)
        .where(
          and(
            eq(loyaltyCampaignsTable.isActive, true),
            lte(loyaltyCampaignsTable.startDate, now),
            gte(loyaltyCampaignsTable.endDate, now)
          )
        );

      const formattedCampaigns = campaigns.map(campaign => ({
        id: campaign.id,
        name: campaign.name,
        description: campaign.description,
        type: campaign.type,
        pointsMultiplier: campaign.pointsMultiplier || "1.00",
        bonusPoints: campaign.bonusPoints || 0,
        targetTiers: (campaign.targetTiers as any[]) || [],
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        isActive: campaign.isActive,
      }));

      return NextResponse.json(
        {
          success: true,
          data: {
            tiers: formattedTiers,
            userTier: userTierData,
            campaigns: formattedCampaigns,
          },
        },
        { status: 200 }
      );

    } catch (error) {
      console.error("Get loyalty tiers error:", error);
      
      return NextResponse.json(
        { 
          success: false,
          error: "Failed to fetch loyalty tiers" 
        },
        { status: 500 }
      );
    }
  }
);

// POST - Create or update a tier (admin only)
export const POST = withRateLimitRedis(
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
      const validationResult = createTierSchema.safeParse(body);
      
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

      // Check if tier already exists
      const [existingTier] = await db
        .select()
        .from(loyaltyTiersTable)
        .where(eq(loyaltyTiersTable.tier, data.tier))
        .limit(1);

      let tier: LoyaltyTier;
      
      if (existingTier) {
        // Update existing tier
        [tier] = await db
          .update(loyaltyTiersTable)
          .set({
            minSpend: data.minSpend,
            minBookings: data.minBookings || 0,
            minPoints: data.minPoints || 0,
            pointsMultiplier: data.pointsMultiplier || "1.00",
            discountPercent: data.discountPercent || 0,
            benefits: data.benefits || [],
            prioritySupport: data.prioritySupport || false,
            freeDelivery: data.freeDelivery || false,
            exclusiveAccess: data.exclusiveAccess || false,
            birthdayBonusPoints: data.birthdayBonusPoints || 0,
            displayName: data.displayName,
            description: data.description,
            iconUrl: data.iconUrl,
            color: data.color,
            updatedAt: new Date(),
          })
          .where(eq(loyaltyTiersTable.id, existingTier.id))
          .returning();
          
        console.log("Loyalty tier updated:", {
          tierId: tier.id,
          tier: tier.tier,
          updatedBy: userId,
          timestamp: new Date().toISOString(),
        });
      } else {
        // Create new tier
        [tier] = await db
          .insert(loyaltyTiersTable)
          .values({
            tier: data.tier,
            minSpend: data.minSpend,
            minBookings: data.minBookings || 0,
            minPoints: data.minPoints || 0,
            pointsMultiplier: data.pointsMultiplier || "1.00",
            discountPercent: data.discountPercent || 0,
            benefits: data.benefits || [],
            prioritySupport: data.prioritySupport || false,
            freeDelivery: data.freeDelivery || false,
            exclusiveAccess: data.exclusiveAccess || false,
            birthdayBonusPoints: data.birthdayBonusPoints || 0,
            displayName: data.displayName,
            description: data.description,
            iconUrl: data.iconUrl,
            color: data.color,
            isActive: true,
          })
          .returning();
          
        console.log("Loyalty tier created:", {
          tierId: tier.id,
          tier: tier.tier,
          createdBy: userId,
          timestamp: new Date().toISOString(),
        });
      }

      return NextResponse.json(
        {
          success: true,
          data: tier,
        },
        { status: existingTier ? 200 : 201 }
      );

    } catch (error) {
      console.error("Create/update tier error:", error);
      
      return NextResponse.json(
        { 
          success: false,
          error: "Failed to create or update tier" 
        },
        { status: 500 }
      );
    }
  }
);

// PATCH - Update tier configuration (admin only)
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

      // TODO: Add admin role check here

      // Parse request body
      const body = await req.json();
      const { tierId, ...updates } = body;

      if (!tierId) {
        return NextResponse.json(
          { 
            success: false,
            error: "Tier ID is required" 
          },
          { status: 400 }
        );
      }

      const validationResult = updateTierSchema.safeParse(updates);
      
      if (!validationResult.success) {
        return NextResponse.json(
          { 
            success: false,
            error: validationResult.error.errors[0]?.message || "Invalid input" 
          },
          { status: 400 }
        );
      }

      // Check if tier exists
      const [existingTier] = await db
        .select()
        .from(loyaltyTiersTable)
        .where(eq(loyaltyTiersTable.id, tierId))
        .limit(1);

      if (!existingTier) {
        return NextResponse.json(
          { 
            success: false,
            error: "Tier not found" 
          },
          { status: 404 }
        );
      }

      // Update tier
      const [updatedTier] = await db
        .update(loyaltyTiersTable)
        .set({
          ...validationResult.data,
          updatedAt: new Date(),
        })
        .where(eq(loyaltyTiersTable.id, tierId))
        .returning();

      console.log("Loyalty tier configuration updated:", {
        tierId: updatedTier.id,
        tier: updatedTier.tier,
        updates: Object.keys(validationResult.data),
        updatedBy: userId,
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json(
        {
          success: true,
          data: updatedTier,
        },
        { status: 200 }
      );

    } catch (error) {
      console.error("Update tier configuration error:", error);
      
      return NextResponse.json(
        { 
          success: false,
          error: "Failed to update tier configuration" 
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
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}