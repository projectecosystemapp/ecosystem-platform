import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db/db";
import { 
  loyaltyAccountsTable, 
  pointsTransactionsTable,
  loyaltyTiersTable,
  redemptionOptionsTable,
  loyaltyCampaignsTable
} from "@/db/schema/loyalty-schema";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { LoyaltyPointsClient } from "./LoyaltyPointsClient";

export default async function LoyaltyPointsPage() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect("/login");
  }

  // Fetch all loyalty data in parallel
  const [
    loyaltyAccount,
    transactions,
    tiers,
    redemptionOptions,
    activeCampaigns,
  ] = await Promise.all([
    // Get or create loyalty account
    db.select()
      .from(loyaltyAccountsTable)
      .where(eq(loyaltyAccountsTable.customerId, userId))
      .limit(1)
      .then(async (accounts) => {
        if (accounts.length === 0) {
          // Create a new loyalty account if doesn't exist
          const [newAccount] = await db.insert(loyaltyAccountsTable)
            .values({
              customerId: userId,
              pointsBalance: 0,
              lifetimePointsEarned: 0,
              lifetimePointsRedeemed: 0,
              tier: "bronze",
              tierProgressAmount: 0,
              isActive: true,
            })
            .returning();
          return newAccount;
        }
        return accounts[0];
      }),

    // Get recent transactions
    db.select({
      id: pointsTransactionsTable.id,
      type: pointsTransactionsTable.type,
      points: pointsTransactionsTable.points,
      balanceBefore: pointsTransactionsTable.balanceBefore,
      balanceAfter: pointsTransactionsTable.balanceAfter,
      description: pointsTransactionsTable.description,
      createdAt: pointsTransactionsTable.createdAt,
      expiresAt: pointsTransactionsTable.expiresAt,
    })
      .from(pointsTransactionsTable)
      .leftJoin(loyaltyAccountsTable, eq(pointsTransactionsTable.accountId, loyaltyAccountsTable.id))
      .where(eq(loyaltyAccountsTable.customerId, userId))
      .orderBy(desc(pointsTransactionsTable.createdAt))
      .limit(50),

    // Get all tiers
    db.select()
      .from(loyaltyTiersTable)
      .where(eq(loyaltyTiersTable.isActive, true))
      .orderBy(loyaltyTiersTable.minSpend),

    // Get available redemption options
    db.select()
      .from(redemptionOptionsTable)
      .where(
        and(
          eq(redemptionOptionsTable.isActive, true),
          sql`${redemptionOptionsTable.expiresAt} IS NULL OR ${redemptionOptionsTable.expiresAt} > NOW()`
        )
      )
      .orderBy(redemptionOptionsTable.pointsCost),

    // Get active campaigns
    db.select()
      .from(loyaltyCampaignsTable)
      .where(
        and(
          eq(loyaltyCampaignsTable.isActive, true),
          gte(loyaltyCampaignsTable.endDate, new Date())
        )
      )
      .orderBy(loyaltyCampaignsTable.endDate),
  ]);

  // Calculate points expiring soon (within 30 days)
  const expiringPoints = transactions
    .filter((t) => {
      if (!t.expiresAt || t.points <= 0) return false;
      const daysUntilExpiry = Math.floor(
        (new Date(t.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
    })
    .reduce((sum, t) => sum + t.points, 0);

  // Get current tier details and next tier
  const currentTier = tiers.find((t) => t.tier === loyaltyAccount.tier);
  const currentTierIndex = tiers.findIndex((t) => t.tier === loyaltyAccount.tier);
  const nextTier = currentTierIndex < tiers.length - 1 ? tiers[currentTierIndex + 1] : null;

  // Calculate progress to next tier
  const progressPercentage = nextTier && loyaltyAccount.tierProgressAmount
    ? Math.min((loyaltyAccount.tierProgressAmount / nextTier.minSpend) * 100, 100)
    : 100;

  return (
    <LoyaltyPointsClient
      account={loyaltyAccount}
      transactions={transactions}
      tiers={tiers}
      currentTier={currentTier}
      nextTier={nextTier}
      progressPercentage={progressPercentage}
      redemptionOptions={redemptionOptions}
      activeCampaigns={activeCampaigns}
      expiringPoints={expiringPoints}
    />
  );
}