// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/db/db";
import { 
  referralsTable, 
  loyaltyAccountsTable, 
  pointsTransactionsTable,
  type Referral,
  type NewReferral
} from "@/db/schema/loyalty-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { bookingsTable } from "@/db/schema/bookings-schema";
import { eq, and, or, gte, lte, desc, asc, isNull, count, sql } from "drizzle-orm";
import { withRateLimitRedis } from "@/lib/rate-limit-redis";
import * as crypto from "crypto";

// ==================== SCHEMAS ====================

// Schema for creating a referral
const createReferralSchema = z.object({
  referredEmail: z.string().email("Invalid email address"),
  campaignCode: z.string().optional(),
  source: z.enum(["email", "social", "app", "direct"]).default("direct"),
  customRewardPoints: z.object({
    referrer: z.number().min(0).optional(),
    referred: z.number().min(0).optional(),
  }).optional(),
  expirationDays: z.number().min(1).max(365).default(30),
});

// Schema for tracking referral click/signup
const trackReferralSchema = z.object({
  referralCode: z.string().min(6),
  action: z.enum(["click", "signup"]),
  userId: z.string().optional(), // Only required for signup
});

// Schema for processing referral completion
const processReferralCompletionSchema = z.object({
  referralId: z.string().uuid("Invalid referral ID"),
  bookingId: z.string().uuid("Invalid booking ID"),
});

// Query params schema for GET request
const getReferralsQuerySchema = z.object({
  status: z.enum(["pending", "clicked", "signed_up", "completed", "expired", "cancelled"]).optional(),
  includeExpired: z.boolean().optional().default(false),
  limit: z.number().min(1).max(100).optional().default(10),
  offset: z.number().min(0).optional().default(0),
  sortBy: z.enum(["created", "completed", "expires"]).optional().default("created"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Generate a unique referral code
 */
function generateReferralCode(userId: string): string {
  const timestamp = Date.now().toString(36);
  const randomStr = crypto.randomBytes(3).toString("hex");
  const userHash = crypto.createHash("md5").update(userId).digest("hex").slice(0, 4);
  return `${userHash}${timestamp}${randomStr}`.toUpperCase();
}

/**
 * Check if a user can create a referral for an email
 */
async function canCreateReferral(referrerId: string, referredEmail: string): Promise<{ allowed: boolean; reason?: string }> {
  // Check if referrer has a profile
  const [referrerProfile] = await db
    .select({ email: profilesTable.email })
    .from(profilesTable)
    .where(eq(profilesTable.userId, referrerId))
    .limit(1);

  if (!referrerProfile) {
    return { allowed: false, reason: "Referrer profile not found" };
  }

  // Prevent self-referral
  if (referrerProfile.email.toLowerCase() === referredEmail.toLowerCase()) {
    return { allowed: false, reason: "Cannot refer yourself" };
  }

  // Check if user already exists
  const [existingUser] = await db
    .select({ userId: profilesTable.userId })
    .from(profilesTable)
    .where(eq(profilesTable.email, referredEmail))
    .limit(1);

  if (existingUser) {
    return { allowed: false, reason: "User already exists on the platform" };
  }

  // Check for existing pending/active referrals for this email from this referrer
  const [existingReferral] = await db
    .select({ id: referralsTable.id })
    .from(referralsTable)
    .where(
      and(
        eq(referralsTable.referrerId, referrerId),
        eq(referralsTable.referredEmail, referredEmail),
        or(
          eq(referralsTable.status, "pending"),
          eq(referralsTable.status, "clicked"),
          eq(referralsTable.status, "signed_up")
        )
      )
    )
    .limit(1);

  if (existingReferral) {
    return { allowed: false, reason: "Active referral already exists for this email" };
  }

  return { allowed: true };
}

/**
 * Get or create loyalty account for a user
 */
async function ensureLoyaltyAccount(userId: string): Promise<string> {
  const [existing] = await db
    .select({ id: loyaltyAccountsTable.id })
    .from(loyaltyAccountsTable)
    .where(eq(loyaltyAccountsTable.customerId, userId))
    .limit(1);

  if (existing) {
    return existing.id;
  }

  // Create new loyalty account
  const [newAccount] = await db
    .insert(loyaltyAccountsTable)
    .values({
      customerId: userId,
      pointsBalance: 0,
      tier: "bronze",
      isActive: true,
    })
    .returning({ id: loyaltyAccountsTable.id });

  return newAccount.id;
}

/**
 * Award points for referral
 */
async function awardReferralPoints(
  accountId: string,
  points: number,
  referralId: string,
  description: string
): Promise<void> {
  // Get current balance
  const [account] = await db
    .select({ 
      pointsBalance: loyaltyAccountsTable.pointsBalance,
      lifetimePointsEarned: loyaltyAccountsTable.lifetimePointsEarned
    })
    .from(loyaltyAccountsTable)
    .where(eq(loyaltyAccountsTable.id, accountId))
    .limit(1);

  if (!account) {
    throw new Error("Loyalty account not found");
  }

  const newBalance = account.pointsBalance + points;
  const newLifetimeEarned = account.lifetimePointsEarned + points;

  // Start transaction
  await db.transaction(async (tx) => {
    // Update account balance
    await tx
      .update(loyaltyAccountsTable)
      .set({
        pointsBalance: newBalance,
        lifetimePointsEarned: newLifetimeEarned,
        lastActivityAt: new Date(),
        lastEarnedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(loyaltyAccountsTable.id, accountId));

    // Create transaction record
    await tx.insert(pointsTransactionsTable).values({
      accountId,
      type: "earned_referral",
      points,
      balanceBefore: account.pointsBalance,
      balanceAfter: newBalance,
      referralId,
      description,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Points expire in 1 year
    });
  });
}

// ==================== POST: CREATE REFERRAL ====================

export const POST = withRateLimitRedis(
  { type: "api" },
  async (req: NextRequest): Promise<NextResponse> => {
    try {
      const { userId } = await auth();
      
      if (!userId) {
        return NextResponse.json(
          { success: false, error: "Authentication required" },
          { status: 401 }
        );
      }

      const body = await req.json();
      const validationResult = createReferralSchema.safeParse(body);
      
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

      // Check if referral can be created
      const canCreate = await canCreateReferral(userId, data.referredEmail);
      if (!canCreate.allowed) {
        return NextResponse.json(
          { success: false, error: canCreate.reason },
          { status: 400 }
        );
      }

      // Generate unique referral code
      const referralCode = generateReferralCode(userId);
      
      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + data.expirationDays);

      // Build referral link
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const referralLink = `${baseUrl}/signup?ref=${referralCode}`;

      // Determine reward points
      const referrerRewardPoints = data.customRewardPoints?.referrer ?? 500;
      const referredRewardPoints = data.customRewardPoints?.referred ?? 250;

      // Create referral
      const [newReferral] = await db
        .insert(referralsTable)
        .values({
          referrerId: userId,
          referredEmail: data.referredEmail.toLowerCase(),
          referralCode,
          referralLink,
          status: "pending",
          referrerRewardPoints,
          referredRewardPoints,
          campaignCode: data.campaignCode,
          source: data.source,
          expiresAt,
          metadata: {
            createdVia: "api",
            userAgent: req.headers.get("user-agent") || "unknown",
          },
        })
        .returning();

      // Log referral creation
      console.log("Referral created:", {
        referralId: newReferral.id,
        referrerId: userId,
        referredEmail: data.referredEmail,
        code: referralCode,
      });

      return NextResponse.json(
        {
          success: true,
          referral: {
            id: newReferral.id,
            referralCode: newReferral.referralCode,
            referralLink: newReferral.referralLink,
            referredEmail: newReferral.referredEmail,
            status: newReferral.status,
            expiresAt: newReferral.expiresAt,
            rewards: {
              referrer: referrerRewardPoints,
              referred: referredRewardPoints,
            },
          },
        },
        { status: 201 }
      );

    } catch (error) {
      console.error("Create referral error:", error);
      return NextResponse.json(
        { success: false, error: "Failed to create referral" },
        { status: 500 }
      );
    }
  }
);

// ==================== GET: TRACK REFERRAL STATUS ====================

export const GET = withRateLimitRedis(
  { type: "api" },
  async (req: NextRequest): Promise<NextResponse> => {
    try {
      const { userId } = await auth();
      
      if (!userId) {
        return NextResponse.json(
          { success: false, error: "Authentication required" },
          { status: 401 }
        );
      }

      const searchParams = req.nextUrl.searchParams;
      const params = Object.fromEntries(searchParams.entries());
      
      const validationResult = getReferralsQuerySchema.safeParse({
        ...params,
        limit: params.limit ? parseInt(params.limit) : undefined,
        offset: params.offset ? parseInt(params.offset) : undefined,
        includeExpired: params.includeExpired === "true",
      });

      if (!validationResult.success) {
        return NextResponse.json(
          { 
            success: false, 
            error: validationResult.error.errors[0]?.message || "Invalid query parameters" 
          },
          { status: 400 }
        );
      }

      const query = validationResult.data;

      // Build query conditions
      const conditions = [eq(referralsTable.referrerId, userId)];
      
      if (query.status) {
        conditions.push(eq(referralsTable.status, query.status));
      }

      if (!query.includeExpired) {
        conditions.push(
          or(
            isNull(referralsTable.expiresAt),
            gte(referralsTable.expiresAt, new Date())
          )!
        );
      }

      // Determine sort column
      let orderByColumn;
      switch (query.sortBy) {
        case "completed":
          orderByColumn = referralsTable.completedAt;
          break;
        case "expires":
          orderByColumn = referralsTable.expiresAt;
          break;
        default:
          orderByColumn = referralsTable.createdAt;
      }

      // Fetch referrals with referred user info if available
      const referrals = await db
        .select({
          id: referralsTable.id,
          referralCode: referralsTable.referralCode,
          referralLink: referralsTable.referralLink,
          referredEmail: referralsTable.referredEmail,
          referredUserId: referralsTable.referredUserId,
          status: referralsTable.status,
          referrerRewardPoints: referralsTable.referrerRewardPoints,
          referrerRewardIssued: referralsTable.referrerRewardIssued,
          referredRewardPoints: referralsTable.referredRewardPoints,
          referredRewardIssued: referralsTable.referredRewardIssued,
          clickedAt: referralsTable.clickedAt,
          signedUpAt: referralsTable.signedUpAt,
          firstBookingAt: referralsTable.firstBookingAt,
          completedAt: referralsTable.completedAt,
          expiresAt: referralsTable.expiresAt,
          campaignCode: referralsTable.campaignCode,
          source: referralsTable.source,
          createdAt: referralsTable.createdAt,
          // Join with referred user profile if exists
          referredUserName: profilesTable.firstName,
        })
        .from(referralsTable)
        .leftJoin(profilesTable, eq(referralsTable.referredUserId, profilesTable.userId))
        .where(and(...conditions))
        .orderBy(query.sortOrder === "desc" ? desc(orderByColumn) : asc(orderByColumn))
        .limit(query.limit)
        .offset(query.offset);

      // Get total count for pagination
      const [{ totalCount }] = await db
        .select({ totalCount: count() })
        .from(referralsTable)
        .where(and(...conditions));

      // Calculate statistics
      const stats = await db
        .select({
          totalReferrals: count(),
          completedReferrals: count(sql`CASE WHEN ${referralsTable.status} = 'completed' THEN 1 END`),
          pendingReferrals: count(sql`CASE WHEN ${referralsTable.status} = 'pending' THEN 1 END`),
          totalPointsEarned: sql<number>`COALESCE(SUM(CASE WHEN ${referralsTable.referrerRewardIssued} = true THEN ${referralsTable.referrerRewardPoints} ELSE 0 END), 0)`,
        })
        .from(referralsTable)
        .where(eq(referralsTable.referrerId, userId))
        .then(rows => rows[0]);

      // Calculate conversion rate
      const conversionRate = stats.totalReferrals > 0 
        ? ((stats.completedReferrals / stats.totalReferrals) * 100).toFixed(2)
        : "0.00";

      return NextResponse.json(
        {
          success: true,
          referrals,
          pagination: {
            total: totalCount,
            limit: query.limit,
            offset: query.offset,
            hasMore: query.offset + query.limit < totalCount,
          },
          statistics: {
            total: stats.totalReferrals,
            completed: stats.completedReferrals,
            pending: stats.pendingReferrals,
            conversionRate: `${conversionRate}%`,
            totalPointsEarned: stats.totalPointsEarned,
          },
        },
        { status: 200 }
      );

    } catch (error) {
      console.error("Get referrals error:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch referrals" },
        { status: 500 }
      );
    }
  }
);

// ==================== PUT: PROCESS REFERRAL ACTIONS ====================

export const PUT = withRateLimitRedis(
  { type: "api" },
  async (req: NextRequest): Promise<NextResponse> => {
    try {
      const body = await req.json();

      // Check if this is a tracking request or completion request
      if ("action" in body) {
        // Track referral click or signup
        const validationResult = trackReferralSchema.safeParse(body);
        
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
          .select()
          .from(referralsTable)
          .where(eq(referralsTable.referralCode, data.referralCode))
          .limit(1);

        if (!referral) {
          return NextResponse.json(
            { success: false, error: "Invalid referral code" },
            { status: 404 }
          );
        }

        // Check if referral is expired
        if (referral.expiresAt && referral.expiresAt < new Date()) {
          await db
            .update(referralsTable)
            .set({ status: "expired" })
            .where(eq(referralsTable.id, referral.id));

          return NextResponse.json(
            { success: false, error: "Referral link has expired" },
            { status: 400 }
          );
        }

        // Handle different actions
        if (data.action === "click") {
          // Track click if not already clicked
          if (referral.status === "pending") {
            await db
              .update(referralsTable)
              .set({
                status: "clicked",
                clickedAt: new Date(),
              })
              .where(eq(referralsTable.id, referral.id));
          }

          return NextResponse.json(
            { 
              success: true, 
              message: "Referral click tracked",
              referralCode: data.referralCode,
            },
            { status: 200 }
          );

        } else if (data.action === "signup") {
          // Require userId for signup tracking
          if (!data.userId) {
            return NextResponse.json(
              { success: false, error: "User ID required for signup tracking" },
              { status: 400 }
            );
          }

          // Check if user email matches referred email
          const [userProfile] = await db
            .select({ email: profilesTable.email })
            .from(profilesTable)
            .where(eq(profilesTable.userId, data.userId))
            .limit(1);

          if (!userProfile || userProfile.email.toLowerCase() !== referral.referredEmail.toLowerCase()) {
            return NextResponse.json(
              { success: false, error: "Email mismatch for referral" },
              { status: 400 }
            );
          }

          // Update referral with signup info
          await db
            .update(referralsTable)
            .set({
              status: "signed_up",
              referredUserId: data.userId,
              signedUpAt: new Date(),
            })
            .where(eq(referralsTable.id, referral.id));

          // Award signup bonus points to referred user
          const referredAccountId = await ensureLoyaltyAccount(data.userId);
          await awardReferralPoints(
            referredAccountId,
            referral.referredRewardPoints,
            referral.id,
            `Welcome bonus from referral by ${referral.referrerId}`
          );

          // Mark referred reward as issued
          await db
            .update(referralsTable)
            .set({ referredRewardIssued: true })
            .where(eq(referralsTable.id, referral.id));

          return NextResponse.json(
            { 
              success: true, 
              message: "Referral signup tracked and bonus awarded",
              pointsAwarded: referral.referredRewardPoints,
            },
            { status: 200 }
          );
        }

      } else if ("referralId" in body) {
        // Process referral completion
        const { userId } = await auth();
        
        if (!userId) {
          return NextResponse.json(
            { success: false, error: "Authentication required" },
            { status: 401 }
          );
        }

        const validationResult = processReferralCompletionSchema.safeParse(body);
        
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

        // Fetch referral
        const [referral] = await db
          .select()
          .from(referralsTable)
          .where(eq(referralsTable.id, data.referralId))
          .limit(1);

        if (!referral) {
          return NextResponse.json(
            { success: false, error: "Referral not found" },
            { status: 404 }
          );
        }

        // Check if referral is in correct state
        if (referral.status !== "signed_up") {
          return NextResponse.json(
            { success: false, error: "Referral not eligible for completion" },
            { status: 400 }
          );
        }

        // Verify booking belongs to referred user
        const [booking] = await db
          .select({ 
            customerId: bookingsTable.customerId,
            status: bookingsTable.status,
          })
          .from(bookingsTable)
          .where(eq(bookingsTable.id, data.bookingId))
          .limit(1);

        if (!booking || booking.customerId !== referral.referredUserId) {
          return NextResponse.json(
            { success: false, error: "Invalid booking for referral" },
            { status: 400 }
          );
        }

        // Check if booking is completed
        if (booking.status !== "completed") {
          return NextResponse.json(
            { success: false, error: "Booking must be completed first" },
            { status: 400 }
          );
        }

        // Complete referral and award points to referrer
        await db.transaction(async (tx) => {
          // Update referral status
          await tx
            .update(referralsTable)
            .set({
              status: "completed",
              firstBookingAt: new Date(),
              completedAt: new Date(),
            })
            .where(eq(referralsTable.id, referral.id));

          // Award points to referrer
          const referrerAccountId = await ensureLoyaltyAccount(referral.referrerId);
          await awardReferralPoints(
            referrerAccountId,
            referral.referrerRewardPoints,
            referral.id,
            `Referral completed for ${referral.referredEmail}`
          );

          // Mark referrer reward as issued
          await tx
            .update(referralsTable)
            .set({ referrerRewardIssued: true })
            .where(eq(referralsTable.id, referral.id));
        });

        return NextResponse.json(
          { 
            success: true, 
            message: "Referral completed successfully",
            pointsAwarded: {
              referrer: referral.referrerRewardPoints,
              referred: referral.referredRewardPoints,
            },
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { success: false, error: "Invalid request" },
        { status: 400 }
      );

    } catch (error) {
      console.error("Process referral error:", error);
      return NextResponse.json(
        { success: false, error: "Failed to process referral" },
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
      "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_APP_URL || "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}