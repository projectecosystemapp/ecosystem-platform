// @ts-nocheck
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db/db";
import { providersTable } from "@/db/schema/providers-schema";
import { eq } from "drizzle-orm";
import PayoutsClient from "./payouts-client";

export default async function PayoutsPage() {
  const { userId } = auth();

  if (!userId) {
    redirect("/login");
  }

  // Fetch provider profile for current user
  const [provider] = await db
    .select()
    .from(providersTable)
    .where(eq(providersTable.userId, userId))
    .limit(1);

  if (!provider) {
    // User is not a provider, redirect to dashboard
    redirect("/dashboard");
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Payout Settings</h1>
        <p className="text-gray-600">
          Manage your payout account and view your earnings
        </p>
      </div>

      <PayoutsClient 
        provider={provider}
      />
    </div>
  );
}