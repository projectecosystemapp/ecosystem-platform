import { db } from "@/db/db";
import { 
  bookingsTable, 
  transactionsTable, 
  type Booking, 
  type NewBooking,
  type Transaction,
  type NewTransaction,
  bookingStatus 
} from "@/db/schema/bookings-schema";
import { 
  providersTable, 
  providerAvailabilityTable, 
  providerBlockedSlotsTable 
} from "@/db/schema/providers-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq, and, gte, lte, or, desc, asc, between, sql, ne } from "drizzle-orm";
import { format, addDays, addMinutes, startOfDay, endOfDay, parseISO, isSameDay } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

// Types for available slots
export type TimeSlot = {
  date: Date;
  startTime: string;
  endTime: string;
  available: boolean;
};

export type AvailableSlot = {
  date: string;
  slots: TimeSlot[];
};

// Generate a unique confirmation code
function generateConfirmationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Create a new booking with conflict detection
export async function createBooking(data: NewBooking): Promise<Booking> {
  // Use a transaction to ensure atomicity and prevent double-booking
  return await db.transaction(async (tx) => {
    // Check for existing bookings that would conflict
    const conflictingBookings = await tx
      .select()
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.providerId, data.providerId),
          eq(bookingsTable.bookingDate, data.bookingDate),
          ne(bookingsTable.status, bookingStatus.CANCELLED),
          or(
            // New booking starts during existing booking
            and(
              lte(bookingsTable.startTime, data.startTime),
              gte(bookingsTable.endTime, data.startTime)
            ),
            // New booking ends during existing booking
            and(
              lte(bookingsTable.startTime, data.endTime),
              gte(bookingsTable.endTime, data.endTime)
            ),
            // New booking completely contains existing booking
            and(
              gte(bookingsTable.startTime, data.startTime),
              lte(bookingsTable.endTime, data.endTime)
            )
          )
        )
      );

    if (conflictingBookings.length > 0) {
      throw new Error("This time slot is already booked");
    }

    // Check if the slot is within provider's availability
    const bookingDay = data.bookingDate.getDay();
    const providerAvailability = await tx
      .select()
      .from(providerAvailabilityTable)
      .where(
        and(
          eq(providerAvailabilityTable.providerId, data.providerId),
          eq(providerAvailabilityTable.dayOfWeek, bookingDay),
          eq(providerAvailabilityTable.isActive, true)
        )
      );

    if (providerAvailability.length === 0) {
      throw new Error("Provider is not available on this day");
    }

    const availability = providerAvailability[0];
    if (data.startTime < availability.startTime || data.endTime > availability.endTime) {
      throw new Error("Booking time is outside provider's available hours");
    }

    // Check for blocked slots
    const blockedSlots = await tx
      .select()
      .from(providerBlockedSlotsTable)
      .where(
        and(
          eq(providerBlockedSlotsTable.providerId, data.providerId),
          eq(providerBlockedSlotsTable.blockedDate, data.bookingDate)
        )
      );

    for (const blocked of blockedSlots) {
      if (!blocked.startTime || !blocked.endTime) {
        // Full day is blocked
        throw new Error("Provider is not available on this date");
      }
      
      // Check if booking overlaps with blocked time
      if (
        (data.startTime >= blocked.startTime && data.startTime < blocked.endTime) ||
        (data.endTime > blocked.startTime && data.endTime <= blocked.endTime) ||
        (data.startTime <= blocked.startTime && data.endTime >= blocked.endTime)
      ) {
        throw new Error("This time slot is blocked by the provider");
      }
    }

    // Generate confirmation code if not provided
    const confirmationCode = data.confirmationCode || generateConfirmationCode();

    // Create the booking with confirmation code
    const bookingData = {
      ...data,
      confirmationCode,
      isGuestBooking: data.isGuestBooking || false,
    };

    // Create the booking
    const [newBooking] = await tx
      .insert(bookingsTable)
      .values(bookingData)
      .returning();

    return newBooking;
  });
}

// Get bookings for a provider with optional filters
export async function getProviderBookings(
  providerId: string,
  filters?: {
    status?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }
): Promise<{ bookings: Booking[]; total: number }> {
  let query = db
    .select({
      booking: bookingsTable,
      customerEmail: profilesTable.email,
    })
    .from(bookingsTable)
    .leftJoin(profilesTable, eq(bookingsTable.customerId, profilesTable.userId))
    .where(eq(bookingsTable.providerId, providerId))
    .$dynamic();

  // Apply filters
  const conditions = [eq(bookingsTable.providerId, providerId)];
  
  if (filters?.status) {
    conditions.push(eq(bookingsTable.status, filters.status));
  }
  
  if (filters?.startDate && filters?.endDate) {
    conditions.push(
      between(bookingsTable.bookingDate, filters.startDate, filters.endDate)
    );
  }

  const [bookingsResult, countResult] = await Promise.all([
    db
      .select({
        booking: bookingsTable,
        customerEmail: profilesTable.email,
      })
      .from(bookingsTable)
      .leftJoin(profilesTable, eq(bookingsTable.customerId, profilesTable.userId))
      .where(and(...conditions))
      .orderBy(desc(bookingsTable.bookingDate), desc(bookingsTable.startTime))
      .limit(filters?.limit || 50)
      .offset(filters?.offset || 0),
    db
      .select({ count: sql<number>`count(*)` })
      .from(bookingsTable)
      .where(and(...conditions))
  ]);

  const bookings = bookingsResult.map(r => ({
    ...r.booking,
    customerEmail: r.customerEmail,
  }));

  return {
    bookings: bookings as any,
    total: countResult[0].count,
  };
}

// Get bookings for a customer
export async function getCustomerBookings(
  customerId: string,
  filters?: {
    status?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }
): Promise<{ bookings: Booking[]; total: number }> {
  const conditions = [eq(bookingsTable.customerId, customerId)];
  
  if (filters?.status) {
    conditions.push(eq(bookingsTable.status, filters.status));
  }
  
  if (filters?.startDate && filters?.endDate) {
    conditions.push(
      between(bookingsTable.bookingDate, filters.startDate, filters.endDate)
    );
  }

  const [bookingsResult, countResult] = await Promise.all([
    db
      .select({
        booking: bookingsTable,
        provider: providersTable,
      })
      .from(bookingsTable)
      .leftJoin(providersTable, eq(bookingsTable.providerId, providersTable.id))
      .where(and(...conditions))
      .orderBy(desc(bookingsTable.bookingDate), desc(bookingsTable.startTime))
      .limit(filters?.limit || 50)
      .offset(filters?.offset || 0),
    db
      .select({ count: sql<number>`count(*)` })
      .from(bookingsTable)
      .where(and(...conditions))
  ]);

  const bookings = bookingsResult.map(r => ({
    ...r.booking,
    providerName: r.provider?.displayName,
    providerSlug: r.provider?.slug,
    providerImage: r.provider?.profileImageUrl,
  }));

  return {
    bookings: bookings as any,
    total: countResult[0].count,
  };
}

// Get a single booking by ID
export async function getBookingById(bookingId: string): Promise<Booking | null> {
  const [booking] = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.id, bookingId));

  return booking || null;
}

// Update booking status with validation
export async function updateBookingStatus(
  bookingId: string,
  status: string,
  additionalData?: {
    stripePaymentIntentId?: string;
    cancellationReason?: string;
    cancelledBy?: string;
    providerNotes?: string;
  }
): Promise<Booking> {
  // Validate status transitions
  const [currentBooking] = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.id, bookingId));

  if (!currentBooking) {
    throw new Error("Booking not found");
  }

  // Define valid status transitions
  const validTransitions: Record<string, string[]> = {
    [bookingStatus.PENDING]: [bookingStatus.CONFIRMED, bookingStatus.CANCELLED],
    [bookingStatus.CONFIRMED]: [bookingStatus.COMPLETED, bookingStatus.CANCELLED, bookingStatus.NO_SHOW],
    [bookingStatus.COMPLETED]: [], // Terminal state
    [bookingStatus.CANCELLED]: [], // Terminal state
    [bookingStatus.NO_SHOW]: [], // Terminal state
  };

  if (!validTransitions[currentBooking.status]?.includes(status)) {
    throw new Error(`Invalid status transition from ${currentBooking.status} to ${status}`);
  }

  const updateData: Partial<Booking> = {
    status,
    updatedAt: new Date(),
  };

  if (status === bookingStatus.CANCELLED) {
    updateData.cancelledAt = new Date();
    if (additionalData?.cancellationReason) {
      updateData.cancellationReason = additionalData.cancellationReason;
    }
    if (additionalData?.cancelledBy) {
      updateData.cancelledBy = additionalData.cancelledBy;
    }
  }

  if (status === bookingStatus.COMPLETED) {
    updateData.completedAt = new Date();
  }

  if (additionalData?.stripePaymentIntentId) {
    updateData.stripePaymentIntentId = additionalData.stripePaymentIntentId;
  }

  if (additionalData?.providerNotes) {
    updateData.providerNotes = additionalData.providerNotes;
  }

  const [updatedBooking] = await db
    .update(bookingsTable)
    .set(updateData)
    .where(eq(bookingsTable.id, bookingId))
    .returning();

  return updatedBooking;
}

// Calculate available time slots for a provider
export async function calculateAvailableSlots(
  providerId: string,
  startDate: Date,
  endDate: Date,
  slotDuration: number, // in minutes
  timezone: string = "UTC"
): Promise<AvailableSlot[]> {
  // Get provider's availability schedule
  const availability = await db
    .select()
    .from(providerAvailabilityTable)
    .where(
      and(
        eq(providerAvailabilityTable.providerId, providerId),
        eq(providerAvailabilityTable.isActive, true)
      )
    );

  // Get blocked slots for the date range
  const blockedSlots = await db
    .select()
    .from(providerBlockedSlotsTable)
    .where(
      and(
        eq(providerBlockedSlotsTable.providerId, providerId),
        between(providerBlockedSlotsTable.blockedDate, startDate, endDate)
      )
    );

  // Get existing bookings for the date range
  const existingBookings = await db
    .select()
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.providerId, providerId),
        between(bookingsTable.bookingDate, startDate, endDate),
        ne(bookingsTable.status, bookingStatus.CANCELLED)
      )
    );

  const availableSlots: AvailableSlot[] = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    const dayAvailability = availability.find(a => a.dayOfWeek === dayOfWeek);

    if (dayAvailability) {
      const slots: TimeSlot[] = [];
      const dayStart = dayAvailability.startTime;
      const dayEnd = dayAvailability.endTime;

      // Generate all possible slots for the day
      let currentSlotStart = dayStart;
      while (currentSlotStart < dayEnd) {
        const startMinutes = timeToMinutes(currentSlotStart);
        const endMinutes = Math.min(startMinutes + slotDuration, timeToMinutes(dayEnd));
        const currentSlotEnd = minutesToTime(endMinutes);

        // Check if slot is blocked
        const isBlocked = blockedSlots.some(blocked => {
          if (!isSameDay(blocked.blockedDate, currentDate)) return false;
          if (!blocked.startTime || !blocked.endTime) return true; // Full day block
          
          return (
            (currentSlotStart >= blocked.startTime && currentSlotStart < blocked.endTime) ||
            (currentSlotEnd > blocked.startTime && currentSlotEnd <= blocked.endTime)
          );
        });

        // Check if slot has an existing booking
        const hasBooking = existingBookings.some(booking => {
          if (!isSameDay(booking.bookingDate, currentDate)) return false;
          
          return (
            (currentSlotStart >= booking.startTime && currentSlotStart < booking.endTime) ||
            (currentSlotEnd > booking.startTime && currentSlotEnd <= booking.endTime)
          );
        });

        slots.push({
          date: new Date(currentDate),
          startTime: currentSlotStart,
          endTime: currentSlotEnd,
          available: !isBlocked && !hasBooking,
        });

        currentSlotStart = currentSlotEnd;
      }

      if (slots.length > 0) {
        availableSlots.push({
          date: format(currentDate, "yyyy-MM-dd"),
          slots,
        });
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return availableSlots;
}

// Get booking statistics for dashboards
export async function getBookingStatistics(
  userId: string,
  userType: "provider" | "customer",
  dateRange?: { start: Date; end: Date }
): Promise<{
  totalBookings: number;
  completedBookings: number;
  upcomingBookings: number;
  cancelledBookings: number;
  totalRevenue?: number;
  averageBookingValue?: number;
  topServices?: Array<{ name: string; count: number }>;
}> {
  const conditions = [
    userType === "provider" 
      ? eq(bookingsTable.providerId, userId)
      : eq(bookingsTable.customerId, userId)
  ];

  if (dateRange) {
    conditions.push(
      between(bookingsTable.bookingDate, dateRange.start, dateRange.end)
    );
  }

  const bookings = await db
    .select()
    .from(bookingsTable)
    .where(and(...conditions));

  const now = new Date();
  const stats = {
    totalBookings: bookings.length,
    completedBookings: bookings.filter(b => b.status === bookingStatus.COMPLETED).length,
    upcomingBookings: bookings.filter(
      b => b.status === bookingStatus.CONFIRMED && b.bookingDate > now
    ).length,
    cancelledBookings: bookings.filter(b => b.status === bookingStatus.CANCELLED).length,
  };

  if (userType === "provider") {
    const completedBookings = bookings.filter(b => b.status === bookingStatus.COMPLETED);
    const totalRevenue = completedBookings.reduce(
      (sum, b) => sum + parseFloat(b.providerPayout.toString()),
      0
    );

    // Count services
    const serviceCounts = bookings.reduce((acc, booking) => {
      acc[booking.serviceName] = (acc[booking.serviceName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topServices = Object.entries(serviceCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    return {
      ...stats,
      totalRevenue,
      averageBookingValue: completedBookings.length > 0 
        ? totalRevenue / completedBookings.length 
        : 0,
      topServices,
    };
  }

  return stats;
}

// Create a transaction record
export async function createTransaction(data: NewTransaction): Promise<Transaction> {
  const [transaction] = await db
    .insert(transactionsTable)
    .values(data)
    .returning();

  return transaction;
}

// Get transactions for a booking
export async function getBookingTransactions(bookingId: string): Promise<Transaction[]> {
  return await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.bookingId, bookingId))
    .orderBy(desc(transactionsTable.createdAt));
}

// Update transaction status
export async function updateTransactionStatus(
  transactionId: string,
  status: "pending" | "completed" | "refunded" | "failed",
  additionalData?: {
    stripeTransferId?: string;
    stripeRefundId?: string;
    processedAt?: Date;
  }
): Promise<Transaction> {
  const updateData: Partial<Transaction> = {
    status,
    ...additionalData,
  };

  const [updatedTransaction] = await db
    .update(transactionsTable)
    .set(updateData)
    .where(eq(transactionsTable.id, transactionId))
    .returning();

  return updatedTransaction;
}

// Helper functions
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

// Get upcoming bookings for reminders
export async function getUpcomingBookingsForReminders(
  hoursAhead: number
): Promise<Booking[]> {
  const now = new Date();
  const reminderTime = addDays(now, hoursAhead / 24);
  
  return await db
    .select()
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.status, bookingStatus.CONFIRMED),
        between(
          bookingsTable.bookingDate,
          startOfDay(reminderTime),
          endOfDay(reminderTime)
        )
      )
    );
}

// Cancel a booking with proper validation and reason tracking
export async function cancelBooking(
  bookingId: string,
  reason: string,
  cancelledBy: string
): Promise<Booking> {
  return await db.transaction(async (tx) => {
    const [booking] = await tx
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, bookingId));

    if (!booking) {
      throw new Error("Booking not found");
    }

    // Check if booking can be cancelled
    if (booking.status === bookingStatus.COMPLETED || 
        booking.status === bookingStatus.CANCELLED) {
      throw new Error(`Cannot cancel booking with status: ${booking.status}`);
    }

    // Check cancellation policy (24 hours notice by default)
    const hoursUntilBooking = Math.floor(
      (booking.bookingDate.getTime() - Date.now()) / (1000 * 60 * 60)
    );

    let cancellationFee = 0;
    if (hoursUntilBooking < 24 && booking.status === bookingStatus.CONFIRMED) {
      // Late cancellation - may incur fees
      cancellationFee = parseFloat(booking.totalAmount.toString()) * 0.25; // 25% fee
    }

    const [updatedBooking] = await tx
      .update(bookingsTable)
      .set({
        status: bookingStatus.CANCELLED,
        cancellationReason: reason,
        cancelledBy,
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(bookingsTable.id, bookingId))
      .returning();

    // If there's a cancellation fee, create a transaction record
    if (cancellationFee > 0 && booking.stripePaymentIntentId) {
      await tx.insert(transactionsTable).values({
        bookingId,
        amount: cancellationFee.toString(),
        platformFee: (cancellationFee * 0.1).toString(), // 10% platform fee on cancellation fee
        providerPayout: (cancellationFee * 0.9).toString(),
        status: "completed",
        processedAt: new Date(),
      });
    }

    return updatedBooking;
  });
}

// Complete a booking
export async function completeBooking(
  bookingId: string,
  completedBy: string,
  notes?: string
): Promise<Booking> {
  const [booking] = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.id, bookingId));

  if (!booking) {
    throw new Error("Booking not found");
  }

  if (booking.status !== bookingStatus.CONFIRMED) {
    throw new Error(`Cannot complete booking with status: ${booking.status}`);
  }

  const [updatedBooking] = await db
    .update(bookingsTable)
    .set({
      status: bookingStatus.COMPLETED,
      completedAt: new Date(),
      providerNotes: notes,
      updatedAt: new Date(),
    })
    .where(eq(bookingsTable.id, bookingId))
    .returning();

  return updatedBooking;
}

// Get upcoming bookings for a provider
export async function getUpcomingBookings(
  providerId: string,
  limit: number = 10
): Promise<Booking[]> {
  const now = new Date();
  
  return await db
    .select()
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.providerId, providerId),
        gte(bookingsTable.bookingDate, now),
        or(
          eq(bookingsTable.status, bookingStatus.PENDING),
          eq(bookingsTable.status, bookingStatus.CONFIRMED)
        )
      )
    )
    .orderBy(asc(bookingsTable.bookingDate), asc(bookingsTable.startTime))
    .limit(limit);
}

// Get past bookings for a provider
export async function getPastBookings(
  providerId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ bookings: Booking[]; total: number }> {
  const now = new Date();
  
  const conditions = and(
    eq(bookingsTable.providerId, providerId),
    or(
      lte(bookingsTable.bookingDate, now),
      eq(bookingsTable.status, bookingStatus.COMPLETED),
      eq(bookingsTable.status, bookingStatus.CANCELLED),
      eq(bookingsTable.status, bookingStatus.NO_SHOW)
    )
  );

  const [bookings, countResult] = await Promise.all([
    db
      .select()
      .from(bookingsTable)
      .where(conditions)
      .orderBy(desc(bookingsTable.bookingDate), desc(bookingsTable.startTime))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(bookingsTable)
      .where(conditions)
  ]);

  return {
    bookings,
    total: countResult[0].count,
  };
}

// Automatically mark completed bookings
export async function markCompletedBookings(): Promise<number> {
  const oneDayAgo = addDays(new Date(), -1);
  
  const bookingsToComplete = await db
    .select()
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.status, bookingStatus.CONFIRMED),
        lte(bookingsTable.bookingDate, oneDayAgo)
      )
    );

  let completedCount = 0;
  for (const booking of bookingsToComplete) {
    try {
      await updateBookingStatus(booking.id, bookingStatus.COMPLETED);
      completedCount++;
    } catch (error) {
      console.error(`Failed to mark booking ${booking.id} as completed:`, error);
    }
  }

  return completedCount;
}