// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { emailService } from '@/lib/services/email-service';
import { z } from 'zod';
import { rateLimitServerAction, getClientIdentifier } from '@/lib/rate-limit';

// Validation schema for email request
const sendEmailSchema = z.object({
  type: z.enum([
    'booking_confirmation',
    'provider_notification',
    'payment_receipt',
    'payout_notification',
    'booking_cancellation',
    'welcome',
    'custom'
  ]),
  to: z.string().email().or(z.array(z.string().email())),
  data: z.record(z.any()).optional(),
  subject: z.string().optional(),
  html: z.string().optional(),
  text: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Apply rate limiting
    const identifier = getClientIdentifier(req);
    const rateLimitResult = await rateLimitServerAction(identifier, 'api');
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.error },
        { 
          status: 429,
          headers: rateLimitResult.retryAfter ? {
            'Retry-After': rateLimitResult.retryAfter.toString()
          } : {}
        }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const validation = sendEmailSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { type, to, data, subject, html, text } = validation.data;

    // Handle different email types
    let result;
    switch (type) {
      case 'booking_confirmation':
        if (!data) {
          return NextResponse.json(
            { error: 'Booking data required' },
            { status: 400 }
          );
        }
        result = await emailService.sendBookingConfirmation({
          customerName: typeof to === 'string' ? to : to[0],
          ...data as any,
        });
        break;

      case 'provider_notification':
        if (!data) {
          return NextResponse.json(
            { error: 'Provider notification data required' },
            { status: 400 }
          );
        }
        result = await emailService.sendProviderBookingNotification({
          providerName: typeof to === 'string' ? to : to[0],
          ...data as any,
        });
        break;

      case 'payment_receipt':
        if (!data) {
          return NextResponse.json(
            { error: 'Payment data required' },
            { status: 400 }
          );
        }
        result = await emailService.sendPaymentReceipt({
          customerName: typeof to === 'string' ? to : to[0],
          ...data as any,
        });
        break;

      case 'payout_notification':
        if (!data) {
          return NextResponse.json(
            { error: 'Payout data required' },
            { status: 400 }
          );
        }
        result = await emailService.sendPayoutNotification({
          providerName: typeof to === 'string' ? to : to[0],
          ...data as any,
        });
        break;

      case 'booking_cancellation':
        if (!data) {
          return NextResponse.json(
            { error: 'Cancellation data required' },
            { status: 400 }
          );
        }
        result = await emailService.sendBookingCancellation(
          typeof to === 'string' ? to : to[0],
          data.customerName as string,
          data.providerName as string,
          data.serviceName as string,
          new Date(data.bookingDate as string),
          data.refundAmount as number | undefined
        );
        break;

      case 'welcome':
        if (!data?.name) {
          return NextResponse.json(
            { error: 'User name required' },
            { status: 400 }
          );
        }
        result = await emailService.sendWelcomeEmail(
          typeof to === 'string' ? to : to[0],
          data.name as string,
          data.isProvider as boolean
        );
        break;

      case 'custom':
        if (!subject || (!html && !text)) {
          return NextResponse.json(
            { error: 'Custom emails require subject and content' },
            { status: 400 }
          );
        }
        result = await emailService.send({
          to,
          subject,
          html,
          text,
        });
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid email type' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      message: 'Email sent successfully',
      id: result.id,
    });

  } catch (error) {
    console.error('Email API error:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}