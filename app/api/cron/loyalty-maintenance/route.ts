// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db/db";
import { 
  loyaltyAccountsTable,
  pointsTransactionsTable,
  loyaltyTiersTable,
  loyaltyCampaignsTable,
  referralsTable,
  type LoyaltyAccount,
  type NewPointsTransaction
} from "@/db/schema/loyalty-schema";
import { bookingsTable } from "@/db/schema/bookings-schema";
import { paymentsTable } from "@/db/schema/payments-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq, and, lte, gte, lt, gt, sql, inArray, isNull } from "drizzle-orm";

/**
 * Cron job endpoint for loyalty system maintenance
 * Handles point expiration, tier updates, benefit processing, and notifications
 * 
 * Schedule recommendation: Run daily at 3 AM
 * Cron expression: 0 3 * * *
 */
export async function GET(req: NextRequest) {
  try {
    // Verify the request is from an authorized source
    const authHeader = headers().get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error("CRON_SECRET not configured");
      return NextResponse.json(
        { error: "Cron job not configured" },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const startTime = new Date();
    console.log(`[CRON] Starting loyalty maintenance at ${startTime.toISOString()}`);
    
    // Expire old points (12 months)
    const expirationResults = await expireOldPoints();
    
    // Update tier statuses based on spending and activity
    const tierUpdateResults = await updateTierStatuses();
    
    // Process tier benefits (birthday bonuses, monthly credits, etc.)
    const benefitResults = await processTierBenefits();
    
    // Send tier upgrade/downgrade notifications
    const notificationResults = await sendTierNotifications();
    
    // Process expired referrals
    const referralResults = await processExpiredReferrals();
    
    // Clean up expired campaigns
    const campaignResults = await cleanupExpiredCampaigns();
    
    // Calculate and store tier progress
    const progressResults = await calculateTierProgress();
    
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    // Compile results
    const result = {
      success: true,
      timestamp: startTime.toISOString(),
      duration: `${duration}ms`,
      pointsExpired: expirationResults,
      tiersUpdated: tierUpdateResults,
      benefitsProcessed: benefitResults,
      notifications: notificationResults,
      referralsProcessed: referralResults,
      campaignsCleaned: campaignResults,
      progressCalculated: progressResults,
      nextRun: getNextRunTime(),
    };
    
    console.log(`[CRON] Loyalty maintenance completed:`, result);

    // Log metrics for monitoring
    await logLoyaltyMetrics(result);

    return NextResponse.json(result);

  } catch (error: any) {
    console.error("Loyalty maintenance cron job error:", error);
    
    // Send alert to admin
    await notifyAdminOfCronFailure("loyalty-maintenance", error);
    
    return NextResponse.json(
      { 
        error: "Loyalty maintenance cron job failed",
        details: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Expire points older than 12 months
async function expireOldPoints() {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  
  let totalExpired = 0;
  let accountsAffected = 0;
  
  try {
    // Find points transactions that should expire
    const expirableTransactions = await db
      .select({
        transaction: pointsTransactionsTable,
        account: loyaltyAccountsTable
      })
      .from(pointsTransactionsTable)
      .innerJoin(loyaltyAccountsTable, eq(pointsTransactionsTable.accountId, loyaltyAccountsTable.id))
      .where(
        and(
          gt(pointsTransactionsTable.points, 0), // Only positive (earned) points
          lte(pointsTransactionsTable.createdAt, twelveMonthsAgo),
          eq(pointsTransactionsTable.expiredPoints, 0) // Not already expired
        )
      );
    
    const accountsToUpdate = new Map<string, number>();
    
    for (const { transaction, account } of expirableTransactions) {
      const currentExpired = accountsToUpdate.get(account.id) || 0;
      accountsToUpdate.set(account.id, currentExpired + transaction.points);
      totalExpired += transaction.points;
      
      // Mark points as expired
      await db.update(pointsTransactionsTable)
        .set({
          expiredPoints: transaction.points,
          expiresAt: new Date()
        })
        .where(eq(pointsTransactionsTable.id, transaction.id));
    }
    
    // Update account balances and create expiration transactions
    for (const [accountId, expiredPoints] of accountsToUpdate) {
      accountsAffected++;
      
      // Get current account
      const [account] = await db
        .select()
        .from(loyaltyAccountsTable)
        .where(eq(loyaltyAccountsTable.id, accountId));
      
      if (account) {
        const newBalance = Math.max(0, account.pointsBalance - expiredPoints);
        
        // Update account balance
        await db.update(loyaltyAccountsTable)
          .set({
            pointsBalance: newBalance,
            updatedAt: new Date()
          })
          .where(eq(loyaltyAccountsTable.id, accountId));
        
        // Create expiration transaction
        const expirationTransaction: NewPointsTransaction = {
          accountId,
          type: "expired",
          points: -expiredPoints,
          balanceBefore: account.pointsBalance,
          balanceAfter: newBalance,
          description: "Points expired after 12 months",
          metadata: {
            expirationDate: new Date().toISOString(),
            originalEarnedDate: twelveMonthsAgo.toISOString()
          }
        };
        
        await db.insert(pointsTransactionsTable).values(expirationTransaction);
        
        // Send notification if significant points expired
        if (expiredPoints >= 100) {
          await sendPointsExpirationNotification(account.customerId, expiredPoints);
        }
      }
    }
    
  } catch (error) {
    console.error("Error expiring points:", error);
  }
  
  return { totalExpired, accountsAffected };
}

// Update tier statuses based on annual spending
async function updateTierStatuses() {
  let upgraded = 0;
  let downgraded = 0;
  let maintained = 0;
  
  try {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    // Get all tier configurations
    const tiers = await db
      .select()
      .from(loyaltyTiersTable)
      .where(eq(loyaltyTiersTable.isActive, true));
    
    // Sort tiers by minimum spend (ascending)
    tiers.sort((a, b) => a.minSpend - b.minSpend);
    
    // Get all active loyalty accounts
    const accounts = await db
      .select()
      .from(loyaltyAccountsTable)
      .where(eq(loyaltyAccountsTable.isActive, true));
    
    for (const account of accounts) {
      // Calculate annual spending
      const spending = await db
        .select({
          total: sql<number>`COALESCE(SUM(${paymentsTable.amountCents}), 0)`
        })
        .from(paymentsTable)
        .innerJoin(bookingsTable, eq(paymentsTable.bookingId, bookingsTable.id))
        .where(
          and(
            eq(paymentsTable.userId, account.customerId),
            eq(paymentsTable.status, "succeeded"),
            gte(paymentsTable.createdAt, oneYearAgo)
          )
        );
      
      const annualSpend = spending[0]?.total || 0;
      
      // Calculate annual bookings
      const bookingCount = await db
        .select({
          count: sql<number>`COUNT(*)`
        })
        .from(bookingsTable)
        .where(
          and(
            eq(bookingsTable.customerId, account.customerId),
            eq(bookingsTable.status, "COMPLETED"),
            gte(bookingsTable.createdAt, oneYearAgo)
          )
        );
      
      const annualBookings = bookingCount[0]?.count || 0;
      
      // Determine appropriate tier
      let newTier = tiers[0]; // Default to lowest tier
      
      for (const tier of tiers) {
        if (annualSpend >= tier.minSpend && 
            annualBookings >= (tier.minBookings || 0) &&
            account.lifetimePointsEarned >= (tier.minPoints || 0)) {
          newTier = tier;
        }
      }
      
      // Update tier if changed
      if (account.tier !== newTier.tier) {
        const oldTier = account.tier;
        
        await db.update(loyaltyAccountsTable)
          .set({
            tier: newTier.tier,
            tierProgressAmount: annualSpend,
            tierExpiresAt: calculateTierExpiration(),
            nextTierThreshold: getNextTierThreshold(newTier, tiers),
            updatedAt: new Date()
          })
          .where(eq(loyaltyAccountsTable.id, account.id));
        
        // Track changes
        if (getTierRank(newTier.tier) > getTierRank(oldTier)) {
          upgraded++;
          await sendTierUpgradeNotification(account.customerId, oldTier, newTier.tier);
        } else {
          downgraded++;
          await sendTierDowngradeNotification(account.customerId, oldTier, newTier.tier);
        }
      } else {
        maintained++;
        
        // Update progress even if tier unchanged
        await db.update(loyaltyAccountsTable)
          .set({
            tierProgressAmount: annualSpend,
            tierExpiresAt: calculateTierExpiration(),
            nextTierThreshold: getNextTierThreshold(newTier, tiers),
            updatedAt: new Date()
          })
          .where(eq(loyaltyAccountsTable.id, account.id));
      }
    }
    
  } catch (error) {
    console.error("Error updating tier statuses:", error);
  }
  
  return { upgraded, downgraded, maintained };
}

// Process tier benefits (birthday bonuses, monthly perks, etc.)
async function processTierBenefits() {
  let birthdayBonuses = 0;
  let monthlyCredits = 0;
  let specialOffers = 0;
  
  try {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentDay = today.getDate();
    
    // Get tier configurations with benefits
    const tiers = await db
      .select()
      .from(loyaltyTiersTable)
      .where(
        and(
          eq(loyaltyTiersTable.isActive, true),
          gt(loyaltyTiersTable.birthdayBonusPoints, 0)
        )
      );
    
    const tierMap = new Map(tiers.map(t => [t.tier, t]));
    
    // Process birthday bonuses
    const birthdayAccounts = await db
      .select({
        account: loyaltyAccountsTable,
        profile: profilesTable
      })
      .from(loyaltyAccountsTable)
      .innerJoin(profilesTable, eq(loyaltyAccountsTable.customerId, profilesTable.userId))
      .where(eq(loyaltyAccountsTable.isActive, true));
    
    for (const { account, profile } of birthdayAccounts) {
      // Check if today is the user's birthday
      if (profile.metadata && (profile.metadata as any).birthdate) {
        const birthdate = new Date((profile.metadata as any).birthdate);
        if (birthdate.getMonth() === currentMonth && birthdate.getDate() === currentDay) {
          const tier = tierMap.get(account.tier);
          
          if (tier && tier.birthdayBonusPoints > 0) {
            // Check if birthday bonus already given this year
            const bonusKey = `birthday_bonus_${today.getFullYear()}`;
            const metadata = account.metadata as any;
            
            if (!metadata?.[bonusKey]) {
              // Award birthday bonus points
              const newBalance = account.pointsBalance + tier.birthdayBonusPoints;
              
              await db.update(loyaltyAccountsTable)
                .set({
                  pointsBalance: newBalance,
                  lifetimePointsEarned: account.lifetimePointsEarned + tier.birthdayBonusPoints,
                  metadata: { ...metadata, [bonusKey]: true },
                  updatedAt: new Date()
                })
                .where(eq(loyaltyAccountsTable.id, account.id));
              
              // Create transaction record
              const bonusTransaction: NewPointsTransaction = {
                accountId: account.id,
                type: "earned_bonus",
                points: tier.birthdayBonusPoints,
                balanceBefore: account.pointsBalance,
                balanceAfter: newBalance,
                description: `Birthday bonus for ${tier.displayName} tier`,
                metadata: {
                  bonusType: "birthday",
                  tier: tier.tier
                }
              };
              
              await db.insert(pointsTransactionsTable).values(bonusTransaction);
              
              birthdayBonuses++;
              
              // Send birthday notification
              await sendBirthdayBonusNotification(account.customerId, tier.birthdayBonusPoints);
            }
          }
        }
      }
    }
    
    // Process monthly tier benefits
    const firstOfMonth = today.getDate() === 1;
    
    if (firstOfMonth) {
      // Award monthly credits for premium tiers
      const premiumAccounts = await db
        .select()
        .from(loyaltyAccountsTable)
        .where(
          and(
            eq(loyaltyAccountsTable.isActive, true),
            inArray(loyaltyAccountsTable.tier, ["gold", "platinum", "diamond"])
          )
        );
      
      for (const account of premiumAccounts) {
        const tier = tierMap.get(account.tier);
        
        if (tier && (tier.benefits as any)?.monthlyCredits) {
          const credits = (tier.benefits as any).monthlyCredits;
          const newBalance = account.pointsBalance + credits;
          
          await db.update(loyaltyAccountsTable)
            .set({
              pointsBalance: newBalance,
              lifetimePointsEarned: account.lifetimePointsEarned + credits,
              updatedAt: new Date()
            })
            .where(eq(loyaltyAccountsTable.id, account.id));
          
          // Create transaction record
          const creditTransaction: NewPointsTransaction = {
            accountId: account.id,
            type: "earned_bonus",
            points: credits,
            balanceBefore: account.pointsBalance,
            balanceAfter: newBalance,
            description: `Monthly tier benefit for ${tier.displayName}`,
            metadata: {
              bonusType: "monthly_credit",
              tier: tier.tier,
              month: today.toISOString().substring(0, 7)
            }
          };
          
          await db.insert(pointsTransactionsTable).values(creditTransaction);
          
          monthlyCredits++;
        }
      }
    }
    
    // Generate personalized special offers based on tier and behavior
    const eligibleAccounts = await db
      .select()
      .from(loyaltyAccountsTable)
      .where(
        and(
          eq(loyaltyAccountsTable.isActive, true),
          gte(loyaltyAccountsTable.lastActivityAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) // Active in last 30 days
        )
      );
    
    for (const account of eligibleAccounts) {
      // Check if due for special offer (once per quarter)
      const lastOfferDate = (account.metadata as any)?.lastSpecialOffer;
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      
      if (!lastOfferDate || new Date(lastOfferDate) < threeMonthsAgo) {
        // Generate offer based on tier
        const offer = generateSpecialOffer(account);
        
        if (offer) {
          await db.update(loyaltyAccountsTable)
            .set({
              specialOffers: [...(account.specialOffers as any[] || []), offer],
              metadata: { ...(account.metadata as any), lastSpecialOffer: new Date() },
              updatedAt: new Date()
            })
            .where(eq(loyaltyAccountsTable.id, account.id));
          
          specialOffers++;
          
          await sendSpecialOfferNotification(account.customerId, offer);
        }
      }
    }
    
  } catch (error) {
    console.error("Error processing tier benefits:", error);
  }
  
  return { birthdayBonuses, monthlyCredits, specialOffers };
}

// Send tier change notifications
async function sendTierNotifications() {
  let sent = 0;
  
  try {
    // Notifications are sent immediately during tier updates
    // This function would handle batch notifications if needed
    
    // Send tier expiration warnings (30 days before expiration)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    const expiringAccounts = await db
      .select()
      .from(loyaltyAccountsTable)
      .where(
        and(
          eq(loyaltyAccountsTable.isActive, true),
          lte(loyaltyAccountsTable.tierExpiresAt, thirtyDaysFromNow),
          gte(loyaltyAccountsTable.tierExpiresAt, new Date())
        )
      );
    
    for (const account of expiringAccounts) {
      // Check if warning already sent
      const warningKey = `tier_expiry_warning_${account.tierExpiresAt?.toISOString().split('T')[0]}`;
      const metadata = account.metadata as any;
      
      if (!metadata?.[warningKey]) {
        await sendTierExpirationWarning(account.customerId, account.tier, account.tierExpiresAt!);
        
        await db.update(loyaltyAccountsTable)
          .set({
            metadata: { ...metadata, [warningKey]: true }
          })
          .where(eq(loyaltyAccountsTable.id, account.id));
        
        sent++;
      }
    }
    
  } catch (error) {
    console.error("Error sending tier notifications:", error);
  }
  
  return { sent };
}

// Process expired referrals
async function processExpiredReferrals() {
  let expired = 0;
  
  try {
    const now = new Date();
    
    const expiredReferrals = await db
      .update(referralsTable)
      .set({
        status: "expired",
        metadata: sql`jsonb_set(metadata, '{expired_at}', to_jsonb(now()), true)`
      })
      .where(
        and(
          eq(referralsTable.status, "pending"),
          lte(referralsTable.expiresAt, now)
        )
      )
      .returning();
    
    expired = expiredReferrals.length;
    
  } catch (error) {
    console.error("Error processing expired referrals:", error);
  }
  
  return { expired };
}

// Clean up expired campaigns
async function cleanupExpiredCampaigns() {
  let deactivated = 0;
  
  try {
    const now = new Date();
    
    const expiredCampaigns = await db
      .update(loyaltyCampaignsTable)
      .set({
        isActive: false,
        metadata: sql`jsonb_set(metadata, '{deactivated_at}', to_jsonb(now()), true)`
      })
      .where(
        and(
          eq(loyaltyCampaignsTable.isActive, true),
          lte(loyaltyCampaignsTable.endDate, now)
        )
      )
      .returning();
    
    deactivated = expiredCampaigns.length;
    
  } catch (error) {
    console.error("Error cleaning up campaigns:", error);
  }
  
  return { deactivated };
}

// Calculate tier progress for all accounts
async function calculateTierProgress() {
  let calculated = 0;
  
  try {
    const accounts = await db
      .select()
      .from(loyaltyAccountsTable)
      .where(eq(loyaltyAccountsTable.isActive, true));
    
    const tiers = await db
      .select()
      .from(loyaltyTiersTable)
      .where(eq(loyaltyTiersTable.isActive, true));
    
    tiers.sort((a, b) => a.minSpend - b.minSpend);
    
    for (const account of accounts) {
      const currentTierIndex = tiers.findIndex(t => t.tier === account.tier);
      const nextTier = tiers[currentTierIndex + 1];
      
      if (nextTier) {
        const progressPercent = Math.min(100, 
          Math.round((account.tierProgressAmount / nextTier.minSpend) * 100)
        );
        
        await db.update(loyaltyAccountsTable)
          .set({
            metadata: {
              ...(account.metadata as any),
              tierProgressPercent: progressPercent,
              nextTierName: nextTier.displayName
            }
          })
          .where(eq(loyaltyAccountsTable.id, account.id));
        
        calculated++;
      }
    }
    
  } catch (error) {
    console.error("Error calculating tier progress:", error);
  }
  
  return { calculated };
}

// Helper functions
function getTierRank(tier: string): number {
  const ranks = { bronze: 1, silver: 2, gold: 3, platinum: 4, diamond: 5 };
  return ranks[tier as keyof typeof ranks] || 0;
}

function calculateTierExpiration(): Date {
  const expiration = new Date();
  expiration.setFullYear(expiration.getFullYear() + 1);
  return expiration;
}

function getNextTierThreshold(currentTier: any, allTiers: any[]): number | null {
  const currentIndex = allTiers.findIndex(t => t.tier === currentTier.tier);
  const nextTier = allTiers[currentIndex + 1];
  return nextTier ? nextTier.minSpend : null;
}

function generateSpecialOffer(account: LoyaltyAccount): any {
  const tierMultipliers = {
    bronze: 1,
    silver: 1.2,
    gold: 1.5,
    platinum: 2,
    diamond: 3
  };
  
  const multiplier = tierMultipliers[account.tier as keyof typeof tierMultipliers] || 1;
  const basePoints = 100;
  
  return {
    id: `offer_${Date.now()}`,
    type: "bonus_points",
    description: `Exclusive ${account.tier} tier offer`,
    bonusPoints: Math.round(basePoints * multiplier),
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    conditions: {
      minBookingAmount: 5000, // $50
      categories: ["premium"]
    }
  };
}

function getNextRunTime(): string {
  const next = new Date();
  next.setDate(next.getDate() + 1); // Runs daily
  next.setHours(3, 0, 0, 0); // At 3 AM
  return next.toISOString();
}

// Notification functions (integrate with your notification service)
async function sendPointsExpirationNotification(customerId: string, points: number) {
  console.log(`Sending points expiration notification to ${customerId}: ${points} points expired`);
}

async function sendTierUpgradeNotification(customerId: string, oldTier: string, newTier: string) {
  console.log(`Sending tier upgrade notification to ${customerId}: ${oldTier} -> ${newTier}`);
}

async function sendTierDowngradeNotification(customerId: string, oldTier: string, newTier: string) {
  console.log(`Sending tier downgrade notification to ${customerId}: ${oldTier} -> ${newTier}`);
}

async function sendBirthdayBonusNotification(customerId: string, points: number) {
  console.log(`Sending birthday bonus notification to ${customerId}: ${points} points`);
}

async function sendSpecialOfferNotification(customerId: string, offer: any) {
  console.log(`Sending special offer notification to ${customerId}:`, offer);
}

async function sendTierExpirationWarning(customerId: string, tier: string, expirationDate: Date) {
  console.log(`Sending tier expiration warning to ${customerId}: ${tier} expires on ${expirationDate}`);
}

async function logLoyaltyMetrics(result: any) {
  console.log("[METRICS] Loyalty maintenance metrics:", result);
  
  // Send to analytics service if configured
  if (process.env.ANALYTICS_ENDPOINT) {
    try {
      await fetch(process.env.ANALYTICS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "loyalty_maintenance_completed",
          properties: result
        })
      });
    } catch (error) {
      console.error("Failed to log metrics:", error);
    }
  }
}

async function notifyAdminOfCronFailure(job: string, error: any) {
  console.error(`CRON JOB FAILURE - Admin notification needed:`, {
    job,
    error: error.message,
    timestamp: new Date().toISOString(),
  });
  
  // Send alert to Slack webhook if configured
  if (process.env.SLACK_WEBHOOK_URL) {
    try {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `🚨 ${job} Cron Job Failed`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Job:* ${job}\n*Error:* ${error.message}\n*Time:* ${new Date().toISOString()}`,
              },
            },
          ],
        }),
      });
    } catch (e) {
      console.error("Failed to send Slack alert:", e);
    }
  }
}

// Health check endpoint for monitoring
export async function HEAD(req: NextRequest) {
  return new NextResponse(null, { status: 200 });
}