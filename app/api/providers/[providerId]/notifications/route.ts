import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { bookingsTable } from "@/db/schema/bookings-schema";
import { notificationsTable } from "@/db/schema/notifications-schema";
import { providersTable } from "@/db/schema/providers-schema";
import { eq, and, desc, isNull } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: { providerId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify this provider belongs to the authenticated user
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(
        and(
          eq(providersTable.id, params.providerId),
          eq(providersTable.userId, userId)
        )
      )
      .limit(1);

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    // Get unread notifications count
    const notifications = await db
      .select()
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.userId, userId),
          isNull(notificationsTable.readAt)
        )
      );

    // Get pending bookings count (bookings awaiting provider action)
    const pendingBookings = await db
      .select()
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.providerId, params.providerId),
          eq(bookingsTable.status, "PENDING_PROVIDER")
        )
      );

    const unreadCount = notifications.length + pendingBookings.length;

    // Get recent notifications (last 10)
    const recentNotifications = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.userId, userId))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(10);

    return NextResponse.json({
      unreadCount,
      pendingBookings: pendingBookings.length,
      notifications: recentNotifications,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}