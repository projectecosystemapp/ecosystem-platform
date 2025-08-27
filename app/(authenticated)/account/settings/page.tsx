import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db/db";
import { profilesTable } from "@/db/schema/profiles-schema";
import { notificationsTable } from "@/db/schema/notifications-schema";
import { eq, and, desc } from "drizzle-orm";
import { ProfileSettingsClient } from "./ProfileSettingsClient";

export default async function ProfileSettingsPage() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect("/login");
  }

  // Fetch user profile and notification preferences
  const [profile, recentNotifications] = await Promise.all([
    db.select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, userId))
      .limit(1),
      
    db.select({
      id: notificationsTable.id,
      type: notificationsTable.type,
      channel: notificationsTable.channel,
    })
      .from(notificationsTable)
      .where(eq(notificationsTable.userId, userId))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(10),
  ]);

  if (!profile[0]) {
    redirect("/onboarding");
  }

  // Calculate notification preferences based on recent notifications
  const notificationPreferences = {
    email: {
      bookingConfirmations: true,
      bookingReminders: true,
      loyaltyUpdates: true,
      promotions: true,
      newsletter: false,
    },
    sms: {
      bookingConfirmations: false,
      bookingReminders: true,
      urgentUpdates: true,
    },
    push: {
      all: true,
    },
  };

  // Mock payment methods (in production, fetch from Stripe)
  const paymentMethods = [
    {
      id: "pm_1",
      type: "card",
      brand: "visa",
      last4: "4242",
      expMonth: 12,
      expYear: 2025,
      isDefault: true,
    },
  ];

  // Mock addresses (in production, store in database)
  const addresses = [
    {
      id: "addr_1",
      name: "Home",
      line1: "123 Main Street",
      line2: "Apt 4B",
      city: "San Francisco",
      state: "CA",
      postalCode: "94105",
      country: "US",
      isDefault: true,
    },
  ];

  return (
    <ProfileSettingsClient
      profile={profile[0]}
      notificationPreferences={notificationPreferences}
      paymentMethods={paymentMethods}
      addresses={addresses}
    />
  );
}