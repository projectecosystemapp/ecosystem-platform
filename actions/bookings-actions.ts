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
import { profilesTable } from "@/db/schema/profiles-schema";
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
import { awardBookingPoints } from "@/services/loyalty-service";
import { emailService } from "@/lib/services/email-service";

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

    // Check for subscription benefits
    // Fixed fee calculation per constitution
    const finalPrice = data.servicePrice;
    const totalAmount = finalPrice;
    const platformFee = totalAmount * 0.10; // Fixed 10% platform fee per constitution
    const providerPayout = totalAmount - platformFee;

    const bookingData: NewBooking = {
      providerId: data.providerId,
      customerId: userId,
      serviceName: data.serviceName,
      servicePrice: finalPrice.toString(),
      serviceDuration: data.serviceDuration,
      bookingDate: data.bookingDate,
      startTime: data.startTime,
      endTime: data.endTime,
      status: bookingStatus.PENDING,
      totalAmount: totalAmount.toString(),
      platformFee: platformFee.toString(),
      providerPayout: providerPayout.toString(),
      customerNotes: data.customerNotes,
      metadata: {} as any,
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

    // Get provider info for email
    const [providerInfo] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, booking.providerId));

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

    // Send review request email to customer after 24 hours
    // We'll need to get customer email from their profile
    const customerProfile = await db.select({
      email: profilesTable.email
    }).from(profilesTable)
    .where(eq(profilesTable.userId, booking.customerId))
    .limit(1);
    
    const customerEmail = customerProfile[0]?.email || booking.guestEmail;
    if (customerEmail) {
      // Schedule review request email for 24 hours after completion
      // For now, we'll just log it - in production this would use a job queue
      console.log(`[EMAIL] Scheduling review request email for customer ${booking.customerId} in 24 hours for booking ${bookingId}`);
      
      // Send immediate completion notification
      try {
        const reviewLink = `${process.env.NEXT_PUBLIC_APP_URL}/bookings/${bookingId}/review`;
        await emailService.send({
          to: customerEmail,
          subject: `Service Completed - How was your experience?`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: #28a745; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1>Service Completed! ✅</h1>
                <p>Thank you for choosing our marketplace</p>
              </div>
              <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                <p>Hi Valued Customer,</p>
                <p>Your service with <strong>${provider?.displayName || 'the provider'}</strong> has been marked as completed.</p>
                
                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3>Completed Service Details</h3>
                  <p><strong>Service:</strong> ${booking.serviceName}</p>
                  <p><strong>Provider:</strong> ${provider?.displayName || 'Provider'}</p>
                  <p><strong>Date:</strong> ${booking.bookingDate.toLocaleDateString()}</p>
                  ${notes ? `<p><strong>Provider Notes:</strong> ${notes}</p>` : ''}
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${reviewLink}" style="display: inline-block; padding: 15px 30px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; font-size: 16px;">Leave a Review</a>
                </div>
                
                <p>We'd love to hear about your experience! Your feedback helps us maintain quality and helps other customers make informed decisions.</p>
                
                <p>If you have any questions or concerns, please don't hesitate to contact us.</p>
                
                <p>Thank you for your business!</p>
              </div>
            </div>
          `
        });
      } catch (emailError) {
        console.error(`[EMAIL] Failed to send completion email for booking ${bookingId}:`, emailError);
      }
    }
    
    // Award loyalty points to customer after booking completion
    if (booking.customerId && booking.totalAmount) {
      try {
        const amountInCents = Math.floor(parseFloat(booking.totalAmount) * 100);
        
        // Use the loyalty service to award points
        const loyaltyResult = await awardBookingPoints(
          bookingId,
          booking.customerId,
          amountInCents
        );
        
        if (loyaltyResult.success) {
          console.log(`[LOYALTY] Awarded ${loyaltyResult.pointsEarned || 0} points to customer ${booking.customerId} for booking ${bookingId}`);
        } else {
          console.error(`[LOYALTY] Failed to award points for booking ${bookingId}:`, loyaltyResult.error);
        }
      } catch (loyaltyError) {
        // Don't fail the booking completion if loyalty points fail
        console.error(`[LOYALTY] Failed to award points for booking ${bookingId}:`, loyaltyError);
      }
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