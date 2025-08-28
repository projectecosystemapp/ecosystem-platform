/**
 * Booking Reminders Cron Job
 * 
 * Sends reminder emails for upcoming bookings:
 * - 24 hours before appointment
 * - 2 hours before appointment
 * 
 * This should be called by a cron service like Vercel Cron or similar
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/db';
import { bookingsTable, providersTable } from '@/db/schema';
import { eq, and, gte, lte, isNull, or } from 'drizzle-orm';
import { emailService } from '@/lib/services/email-service';
import { addHours, subHours, isBefore, isAfter } from 'date-fns';

// Security: Only allow requests with proper authorization
const CRON_SECRET = process.env.CRON_SECRET || 'development-secret';

export async function GET(request: NextRequest) {
  return handleReminders(request);
}

export async function POST(request: NextRequest) {
  return handleReminders(request);
}

async function handleReminders(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = request.headers.get('x-cron-secret');
    
    if (process.env.NODE_ENV === 'production') {
      if ((!authHeader || authHeader !== `Bearer ${CRON_SECRET}`) && 
          (!cronSecret || cronSecret !== CRON_SECRET)) {
        return NextResponse.json(
          { error: 'Unauthorized' }, 
          { status: 401 }
        );
      }
    }

    const now = new Date();
    const tomorrow = addHours(now, 24);
    const in2Hours = addHours(now, 2);
    
    console.log(`[CRON] Starting booking reminders check at ${now.toISOString()}`);
    
    // Find bookings that need 24-hour reminders
    const bookingsFor24HourReminder = await db
      .select({
        booking: bookingsTable,
        provider: providersTable
      })
      .from(bookingsTable)
      .leftJoin(providersTable, eq(bookingsTable.providerId, providersTable.id))
      .where(
        and(
          eq(bookingsTable.status, 'PAYMENT_SUCCEEDED'), // Only confirmed bookings
          gte(bookingsTable.bookingDate, subHours(tomorrow, 1)), // Within 1 hour of 24 hours ahead
          lte(bookingsTable.bookingDate, addHours(tomorrow, 1)),
          or(
            isNull(bookingsTable.reminder24hSent),
            eq(bookingsTable.reminder24hSent, false)
          )
        )
      );

    // Find bookings that need 2-hour reminders
    const bookingsFor2HourReminder = await db
      .select({
        booking: bookingsTable,
        provider: providersTable
      })
      .from(bookingsTable)
      .leftJoin(providersTable, eq(bookingsTable.providerId, providersTable.id))
      .where(
        and(
          eq(bookingsTable.status, 'PAYMENT_SUCCEEDED'), // Only confirmed bookings
          gte(bookingsTable.bookingDate, subHours(in2Hours, 0.5)), // Within 30 minutes of 2 hours ahead
          lte(bookingsTable.bookingDate, addHours(in2Hours, 0.5)),
          or(
            isNull(bookingsTable.reminder2hSent),
            eq(bookingsTable.reminder2hSent, false)
          )
        )
      );

    let sent24Hour = 0;
    let sent2Hour = 0;
    const errors: string[] = [];

    // Send 24-hour reminders
    for (const { booking, provider } of bookingsFor24HourReminder) {
      try {
        const customerEmail = booking.customerEmail || booking.guestEmail;
        if (customerEmail) {
          await emailService.sendAppointmentReminder(
            customerEmail,
            booking.customerName || 'Valued Customer',
            provider?.businessName || 'Provider',
            booking.serviceName,
            booking.bookingDate,
            booking.startTime,
            booking.endTime,
            booking.location,
            24 // hours until appointment
          );

          // Mark reminder as sent
          await db
            .update(bookingsTable)
            .set({ 
              reminder24hSent: true,
              reminder24hSentAt: now,
              updatedAt: now
            })
            .where(eq(bookingsTable.id, booking.id));

          sent24Hour++;
          console.log(`[CRON] Sent 24h reminder for booking ${booking.id}`);
        }
      } catch (error) {
        const errorMsg = `Failed to send 24h reminder for booking ${booking.id}: ${error}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Send 2-hour reminders
    for (const { booking, provider } of bookingsFor2HourReminder) {
      try {
        const customerEmail = booking.customerEmail || booking.guestEmail;
        if (customerEmail) {
          await emailService.sendAppointmentReminder(
            customerEmail,
            booking.customerName || 'Valued Customer',
            provider?.businessName || 'Provider',
            booking.serviceName,
            booking.bookingDate,
            booking.startTime,
            booking.endTime,
            booking.location,
            2 // hours until appointment
          );

          // Mark reminder as sent
          await db
            .update(bookingsTable)
            .set({ 
              reminder2hSent: true,
              reminder2hSentAt: now,
              updatedAt: now
            })
            .where(eq(bookingsTable.id, booking.id));

          sent2Hour++;
          console.log(`[CRON] Sent 2h reminder for booking ${booking.id}`);
        }
      } catch (error) {
        const errorMsg = `Failed to send 2h reminder for booking ${booking.id}: ${error}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    const summary = {
      success: true,
      timestamp: now.toISOString(),
      reminders: {
        twentyFourHour: {
          eligible: bookingsFor24HourReminder.length,
          sent: sent24Hour,
        },
        twoHour: {
          eligible: bookingsFor2HourReminder.length,
          sent: sent2Hour,
        }
      },
      totalSent: sent24Hour + sent2Hour,
      errors: errors.length,
      errorMessages: errors.slice(0, 5) // Limit error messages to prevent huge responses
    };

    console.log('[CRON] Booking reminders completed:', summary);

    return NextResponse.json(summary);

  } catch (error) {
    console.error('[CRON] Booking reminders failed:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to process booking reminders',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }, 
      { status: 500 }
    );
  }
}