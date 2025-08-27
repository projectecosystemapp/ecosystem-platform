import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db/db";
import { bookingsTable } from "@/db/schema/bookings-schema";
import { providersTable } from "@/db/schema/providers-schema";
import { eq, desc, and, or, gte, lt, like, sql } from "drizzle-orm";
import { BookingHistoryClient } from "./BookingHistoryClient";

interface SearchParams {
  filter?: string;
  type?: string;
  status?: string;
  search?: string;
  sort?: string;
  page?: string;
}

export default async function BookingHistoryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { userId } = await auth();
  
  if (!userId) {
    redirect("/login");
  }

  const page = parseInt(searchParams.page || "1");
  const limit = 10;
  const offset = (page - 1) * limit;

  // Build query conditions
  const conditions = [eq(bookingsTable.customerId, userId)];
  
  // Filter by time period
  if (searchParams.filter === "past") {
    conditions.push(lt(bookingsTable.bookingDate, new Date()));
  } else if (searchParams.filter === "upcoming") {
    conditions.push(gte(bookingsTable.bookingDate, new Date()));
  }
  
  // Filter by booking type
  if (searchParams.type && searchParams.type !== "all") {
    conditions.push(eq(bookingsTable.bookingType, searchParams.type as any));
  }
  
  // Filter by status
  if (searchParams.status && searchParams.status !== "all") {
    conditions.push(eq(bookingsTable.status, searchParams.status));
  }
  
  // Search by service name
  if (searchParams.search) {
    conditions.push(like(bookingsTable.serviceName, `%${searchParams.search}%`));
  }

  // Get bookings with provider info
  const bookingsQuery = db
    .select({
      id: bookingsTable.id,
      serviceName: bookingsTable.serviceName,
      servicePrice: bookingsTable.servicePrice,
      serviceDuration: bookingsTable.serviceDuration,
      bookingDate: bookingsTable.bookingDate,
      startTime: bookingsTable.startTime,
      endTime: bookingsTable.endTime,
      status: bookingsTable.status,
      bookingType: bookingsTable.bookingType,
      customerNotes: bookingsTable.customerNotes,
      totalAmount: bookingsTable.totalAmount,
      confirmationCode: bookingsTable.confirmationCode,
      createdAt: bookingsTable.createdAt,
      completedAt: bookingsTable.completedAt,
      providerId: bookingsTable.providerId,
      providerName: providersTable.displayName,
      providerImage: providersTable.profileImageUrl,
    })
    .from(bookingsTable)
    .leftJoin(providersTable, eq(bookingsTable.providerId, providersTable.id))
    .where(and(...conditions));

  // Apply sorting
  if (searchParams.sort === "date-asc") {
    bookingsQuery.orderBy(bookingsTable.bookingDate);
  } else if (searchParams.sort === "price-desc") {
    bookingsQuery.orderBy(desc(bookingsTable.totalAmount));
  } else if (searchParams.sort === "price-asc") {
    bookingsQuery.orderBy(bookingsTable.totalAmount);
  } else {
    // Default sort: newest first
    bookingsQuery.orderBy(desc(bookingsTable.bookingDate));
  }

  // Execute queries in parallel
  const [bookings, totalCountResult] = await Promise.all([
    bookingsQuery.limit(limit).offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(bookingsTable)
      .where(and(...conditions))
  ]);

  const totalCount = Number(totalCountResult[0]?.count || 0);
  const totalPages = Math.ceil(totalCount / limit);

  // Get statistics
  const stats = await db
    .select({
      totalBookings: sql<number>`count(*)`,
      completedBookings: sql<number>`count(*) filter (where ${bookingsTable.status} = 'completed')`,
      upcomingBookings: sql<number>`count(*) filter (where ${bookingsTable.status} in ('confirmed', 'pending') and ${bookingsTable.bookingDate} >= current_date)`,
      totalSpent: sql<number>`sum(${bookingsTable.totalAmount})`,
    })
    .from(bookingsTable)
    .where(eq(bookingsTable.customerId, userId));

  return (
    <BookingHistoryClient
      bookings={bookings}
      stats={stats[0]}
      pagination={{
        currentPage: page,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      }}
      searchParams={searchParams}
    />
  );
}