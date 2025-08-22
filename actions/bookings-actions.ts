"use server";

import {
  createBooking,
  getProviderBookings,
  getCustomerBookings,
  getBookingById,
  updateBookingStatus,
  calculateAvailableSlots,
  getBookingStatistics,
  createTransaction,
  getBookingTransactions,
  updateTransactionStatus,
  markCompletedBookings,
  cancelBooking,
  completeBooking,
  getUpcomingBookings,
  getPastBookings,
} from "@/db/queries/bookings-queries";
import { 
  type Booking, 
  type NewBooking,
  type Transaction,
  type NewTransaction,
  bookingStatus 
} from "@/db/schema/bookings-schema";
import { providersTable } from "@/db/schema/providers-schema";
import { ActionResult } from "@/types/actions/actions-types";
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { eq } from "drizzle-orm";
import { addDays, startOfDay, endOfDay } from "date-fns";
import { 
  enforceRateLimit, 
  handleRateLimitError,
  withRateLimitAction 
} from "@/lib/server-action-rate-limit";

// Create a new booking (customer action) with rate limiting
export async function createBookingAction(data: {
  providerId: string;
  serviceName: string;
  servicePrice: number;
  serviceDuration: number;
  bookingDate: Date;
  startTime: string;
  endTime: string;
  customerNotes?: string;
}): Promise<ActionResult<Booking>> {
  try {
    // Apply rate limiting for booking creation
    await enforceRateLimit('booking');
    
    const { userId } = await auth();
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" };
    }

    // Get provider details to calculate fees
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, data.providerId));

    if (!provider) {
      return { isSuccess: false, message: "Provider not found" };
    }

    if (!provider.stripeConnectAccountId || !provider.stripeOnboardingComplete) {
      return { isSuccess: false, message: "Provider is not ready to accept bookings" };
    }

    // Calculate fees
    const totalAmount = data.servicePrice;
    const platformFee = totalAmount * parseFloat(provider.commissionRate.toString());
    const providerPayout = totalAmount - platformFee;

    const bookingData: NewBooking = {
      providerId: data.providerId,
      customerId: userId,
      serviceName: data.serviceName,
      servicePrice: data.servicePrice.toString(),
      serviceDuration: data.serviceDuration,
      bookingDate: data.bookingDate,
      startTime: data.startTime,
      endTime: data.endTime,
      status: bookingStatus.PENDING,
      totalAmount: totalAmount.toString(),
      platformFee: platformFee.toString(),
      providerPayout: providerPayout.toString(),
      customerNotes: data.customerNotes,
    };

    const newBooking = await createBooking(bookingData);
    
    // Audit log for security tracking
    console.log(`[AUDIT] User ${userId} created booking ${newBooking.id} for provider ${data.providerId} at ${new Date().toISOString()}`);
    
    revalidatePath("/dashboard");
    revalidatePath(`/providers/${provider.slug}`);
    
    return { 
      isSuccess: true, 
      message: "Booking created successfully", 
      data: newBooking 
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to create booking";
    return { isSuccess: false, message: errorMessage };
  }
}

// Get available slots for a provider
export async function getAvailableSlotsAction(
  providerId: string,
  startDate?: Date,
  endDate?: Date,
  slotDuration: number = 60,
  timezone: string = "UTC"
): Promise<ActionResult<any>> {
  try {
    const start = startDate || new Date();
    const end = endDate || addDays(new Date(), 30);

    const availableSlots = await calculateAvailableSlots(
      providerId,
      start,
      end,
      slotDuration,
      timezone
    );

    return {
      isSuccess: true,
      message: "Available slots retrieved successfully",
      data: availableSlots,
    };
  } catch (error) {
    return { isSuccess: false, message: "Failed to get available slots" };
  }
}

// Confirm a booking after payment (update status to confirmed)
export async function confirmBookingAction(
  bookingId: string,
  stripePaymentIntentId: string
): Promise<ActionResult<Booking>> {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" };
    }

    // Verify the booking exists and belongs to the user
    const booking = await getBookingById(bookingId);
    
    if (!booking) {
      return { isSuccess: false, message: "Booking not found" };
    }

    if (booking.customerId !== userId) {
      return { isSuccess: false, message: "Unauthorized" };
    }

    if (booking.status !== bookingStatus.PENDING) {
      return { isSuccess: false, message: "Booking is not in pending status" };
    }

    // Update booking status
    const updatedBooking = await updateBookingStatus(
      bookingId,
      bookingStatus.CONFIRMED,
      { stripePaymentIntentId }
    );

    // Create transaction record
    await createTransaction({
      bookingId,
      stripeChargeId: stripePaymentIntentId,
      amount: booking.totalAmount,
      platformFee: booking.platformFee,
      providerPayout: booking.providerPayout,
      status: "completed",
      processedAt: new Date(),
    });
    
    // Audit log for payment confirmation
    console.log(`[AUDIT] User ${userId} confirmed booking ${bookingId} with payment ${stripePaymentIntentId} at ${new Date().toISOString()}`);

    revalidatePath("/dashboard");
    
    return {
      isSuccess: true,
      message: "Booking confirmed successfully",
      data: updatedBooking,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to confirm booking";
    return { isSuccess: false, message: errorMessage };
  }
}

// Cancel a booking
export async function cancelBookingAction(
  bookingId: string,
  reason?: string
): Promise<ActionResult<Booking>> {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" };
    }

    // Get the booking
    const booking = await getBookingById(bookingId);
    
    if (!booking) {
      return { isSuccess: false, message: "Booking not found" };
    }

    // Check if user is authorized (either customer or provider)
    const isCustomer = booking.customerId === userId;
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, booking.providerId));
    const isProvider = provider?.userId === userId;

    if (!isCustomer && !isProvider) {
      return { isSuccess: false, message: "Unauthorized" };
    }

    // Check if booking can be cancelled
    if (booking.status === bookingStatus.COMPLETED || booking.status === bookingStatus.CANCELLED) {
      return { isSuccess: false, message: "Booking cannot be cancelled" };
    }

    // Update booking status
    const updatedBooking = await updateBookingStatus(
      bookingId,
      bookingStatus.CANCELLED,
      {
        cancellationReason: reason,
        cancelledBy: userId,
      }
    );

    // If payment was made, create refund transaction
    if (booking.stripePaymentIntentId && booking.status === bookingStatus.CONFIRMED) {
      await createTransaction({
        bookingId,
        amount: booking.totalAmount,
        platformFee: booking.platformFee,
        providerPayout: booking.providerPayout,
        status: "refunded",
        processedAt: new Date(),
      });
      
      // Audit log for refund
      console.log(`[AUDIT] User ${userId} cancelled booking ${bookingId} with refund at ${new Date().toISOString()}. Reason: ${reason || 'Not specified'}`);
    } else {
      // Audit log for cancellation without refund
      console.log(`[AUDIT] User ${userId} cancelled booking ${bookingId} without refund at ${new Date().toISOString()}. Reason: ${reason || 'Not specified'}`);
    }

    revalidatePath("/dashboard");
    
    return {
      isSuccess: true,
      message: "Booking cancelled successfully",
      data: updatedBooking,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to cancel booking";
    return { isSuccess: false, message: errorMessage };
  }
}

// Get upcoming bookings for dashboard
export async function getUpcomingBookingsAction(
  userType: "provider" | "customer"
): Promise<ActionResult<Booking[]>> {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" };
    }

    let bookings;
    const now = new Date();

    if (userType === "customer") {
      const result = await getCustomerBookings(userId, {
        status: bookingStatus.CONFIRMED,
        startDate: now,
        endDate: addDays(now, 90),
        limit: 10,
      });
      bookings = result.bookings;
    } else {
      // Get provider ID from user ID
      const [provider] = await db
        .select()
        .from(providersTable)
        .where(eq(providersTable.userId, userId));

      if (!provider) {
        return { isSuccess: false, message: "Provider profile not found" };
      }

      const result = await getProviderBookings(provider.id, {
        status: bookingStatus.CONFIRMED,
        startDate: now,
        endDate: addDays(now, 90),
        limit: 10,
      });
      bookings = result.bookings;
    }

    return {
      isSuccess: true,
      message: "Upcoming bookings retrieved successfully",
      data: bookings,
    };
  } catch (error) {
    return { isSuccess: false, message: "Failed to get upcoming bookings" };
  }
}

// Get booking history for customer
export async function getBookingHistoryAction(
  page: number = 1,
  pageSize: number = 10
): Promise<ActionResult<{ bookings: Booking[]; total: number }>> {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" };
    }

    const offset = (page - 1) * pageSize;
    const result = await getCustomerBookings(userId, {
      limit: pageSize,
      offset,
    });

    return {
      isSuccess: true,
      message: "Booking history retrieved successfully",
      data: result,
    };
  } catch (error) {
    return { isSuccess: false, message: "Failed to get booking history" };
  }
}

// Get provider's bookings
export async function getProviderBookingsAction(
  filters?: {
    status?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    pageSize?: number;
  }
): Promise<ActionResult<{ bookings: Booking[]; total: number }>> {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" };
    }

    // Get provider ID from user ID
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.userId, userId));

    if (!provider) {
      return { isSuccess: false, message: "Provider profile not found" };
    }

    const page = filters?.page || 1;
    const pageSize = filters?.pageSize || 10;
    const offset = (page - 1) * pageSize;

    const result = await getProviderBookings(provider.id, {
      status: filters?.status,
      startDate: filters?.startDate,
      endDate: filters?.endDate,
      limit: pageSize,
      offset,
    });

    return {
      isSuccess: true,
      message: "Provider bookings retrieved successfully",
      data: result,
    };
  } catch (error) {
    return { isSuccess: false, message: "Failed to get provider bookings" };
  }
}

// Get booking statistics for dashboard
export async function getBookingStatisticsAction(
  userType: "provider" | "customer",
  dateRange?: { start: Date; end: Date }
): Promise<ActionResult<any>> {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" };
    }

    let statsUserId = userId;

    if (userType === "provider") {
      // Get provider ID from user ID
      const [provider] = await db
        .select()
        .from(providersTable)
        .where(eq(providersTable.userId, userId));

      if (!provider) {
        return { isSuccess: false, message: "Provider profile not found" };
      }

      statsUserId = provider.id;
    }

    const statistics = await getBookingStatistics(statsUserId, userType, dateRange);

    return {
      isSuccess: true,
      message: "Statistics retrieved successfully",
      data: statistics,
    };
  } catch (error) {
    return { isSuccess: false, message: "Failed to get statistics" };
  }
}

// Complete a booking (provider action)
export async function completeBookingAction(
  bookingId: string,
  notes?: string
): Promise<ActionResult<Booking>> {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" };
    }

    // Get the booking
    const booking = await getBookingById(bookingId);
    
    if (!booking) {
      return { isSuccess: false, message: "Booking not found" };
    }

    // Verify provider owns this booking
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, booking.providerId));

    if (provider?.userId !== userId) {
      return { isSuccess: false, message: "Unauthorized" };
    }

    // Complete the booking using the new function
    const updatedBooking = await completeBooking(bookingId, userId, notes);

    // Trigger payout to provider (this would integrate with Stripe Connect)
    // For now, just update the transaction status
    const transactions = await getBookingTransactions(bookingId);
    if (transactions.length > 0 && transactions[0].status === "completed") {
      await updateTransactionStatus(
        transactions[0].id,
        "completed",
        { processedAt: new Date() }
      );
    }
    
    // Audit log for booking completion
    console.log(`[AUDIT] Provider ${userId} marked booking ${bookingId} as completed at ${new Date().toISOString()}. Notes: ${notes || 'None'}`);

    revalidatePath("/dashboard");
    revalidatePath("/provider/bookings");
    
    return {
      isSuccess: true,
      message: "Booking marked as completed",
      data: updatedBooking,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to complete booking";
    return { isSuccess: false, message: errorMessage };
  }
}

// Mark a booking as completed (alias for backward compatibility)
export const markBookingCompleteAction = completeBookingAction;

// Mark a booking as no-show (provider action)
export async function markBookingNoShowAction(
  bookingId: string,
  notes?: string
): Promise<ActionResult<Booking>> {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" };
    }

    // Get the booking
    const booking = await getBookingById(bookingId);
    
    if (!booking) {
      return { isSuccess: false, message: "Booking not found" };
    }

    // Verify provider owns this booking
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, booking.providerId));

    if (provider?.userId !== userId) {
      return { isSuccess: false, message: "Unauthorized" };
    }

    // Update booking status
    const updatedBooking = await updateBookingStatus(
      bookingId,
      bookingStatus.NO_SHOW,
      { providerNotes: notes }
    );
    
    // Audit log for no-show marking
    console.log(`[AUDIT] Provider ${userId} marked booking ${bookingId} as no-show at ${new Date().toISOString()}. Notes: ${notes || 'None'}`);

    revalidatePath("/dashboard");
    
    return {
      isSuccess: true,
      message: "Booking marked as no-show",
      data: updatedBooking,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to mark as no-show";
    return { isSuccess: false, message: errorMessage };
  }
}

// Get booking details with full information
export async function getBookingDetailsAction(
  bookingId: string
): Promise<ActionResult<any>> {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" };
    }

    const booking = await getBookingById(bookingId);
    
    if (!booking) {
      return { isSuccess: false, message: "Booking not found" };
    }

    // Check authorization
    const isCustomer = booking.customerId === userId;
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, booking.providerId));
    const isProvider = provider?.userId === userId;

    if (!isCustomer && !isProvider) {
      return { isSuccess: false, message: "Unauthorized" };
    }

    // Get transactions for this booking
    const transactions = await getBookingTransactions(bookingId);

    const bookingDetails = {
      ...booking,
      provider: isCustomer ? provider : undefined,
      transactions: transactions,
    };

    return {
      isSuccess: true,
      message: "Booking details retrieved successfully",
      data: bookingDetails,
    };
  } catch (error) {
    return { isSuccess: false, message: "Failed to get booking details" };
  }
}

// Automatically mark old bookings as completed (scheduled job)
export async function processCompletedBookingsAction(): Promise<ActionResult<number>> {
  try {
    // This is a system-level action that should only be called by scheduled jobs
    // Verify it's being called from an authorized context (e.g., cron job with API key)
    const { userId } = await auth();
    
    // Only allow admin users or system processes to run this
    if (!userId) {
      console.error('[SECURITY] Unauthorized attempt to process completed bookings');
      return { isSuccess: false, message: "Unauthorized: Admin access required" };
    }
    
    // TODO: Add additional check for admin role when role system is implemented
    // For now, log the action for audit purposes
    console.log(`[AUDIT] User ${userId} initiated processCompletedBookings at ${new Date().toISOString()}`);
    
    const completedCount = await markCompletedBookings();
    
    return {
      isSuccess: true,
      message: `${completedCount} bookings marked as completed`,
      data: completedCount,
    };
  } catch (error) {
    return { isSuccess: false, message: "Failed to process completed bookings" };
  }
}