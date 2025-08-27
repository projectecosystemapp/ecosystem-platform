// @ts-nocheck
/**
 * Dashboard page for ECOSYSTEM Marketplace
 * Routes users to their appropriate dashboard based on role
 */
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db/db";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq } from "drizzle-orm";

async function getUserRole(userId: string) {
  try {
    const [profile] = await db
      .select({ role: profilesTable.role })
      .from(profilesTable)
      .where(eq(profilesTable.userId, userId))
      .limit(1);
    
    return profile?.role;
  } catch (error) {
    console.error('Error fetching user role:', error);
    return null;
  }
}

export default async function DashboardPage() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect("/sign-in");
  }

  // Get user role from database
  const userRole = await getUserRole(userId);

  // Route based on role
  if (userRole === 'provider') {
    redirect('/dashboard/provider');
  } else if (userRole === 'customer') {
    redirect('/dashboard/customer');
  } else {
    // If no role found, redirect to profile setup
    redirect('/onboarding');
  }
}