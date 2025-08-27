import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AccountLayout } from "@/components/account/AccountLayout";
import { db } from "@/db/db";
import { profilesTable } from "@/db/schema/profiles-schema";
import { loyaltyAccountsTable } from "@/db/schema/loyalty-schema";
import { eq } from "drizzle-orm";

export default async function CustomerAccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  
  if (!userId) {
    redirect("/login");
  }

  // Get user profile
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);

  if (!profile) {
    // Create profile if it doesn't exist
    redirect("/onboarding");
  }

  // Get loyalty account if exists
  const [loyaltyAccount] = await db
    .select({
      pointsBalance: loyaltyAccountsTable.pointsBalance,
      tier: loyaltyAccountsTable.tier,
    })
    .from(loyaltyAccountsTable)
    .where(eq(loyaltyAccountsTable.customerId, userId))
    .limit(1);

  return (
    <AccountLayout 
      userId={userId}
      userEmail={profile.email || ""}
      loyaltyData={loyaltyAccount}
    >
      {children}
    </AccountLayout>
  );
}