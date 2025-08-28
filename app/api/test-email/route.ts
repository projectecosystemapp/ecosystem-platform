/**
 * Test Email Endpoint
 * 
 * For testing email notifications during development
 */

import { NextRequest, NextResponse } from 'next/server';
import { emailService } from '@/lib/services/email-service';
import { addDays } from 'date-fns';

export async function POST(request: NextRequest) {
  try {
    const { type, email } = await request.json();
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email address required' },
        { status: 400 }
      );
    }

    const testData = {
      customerName: 'Test Customer',
      customerEmail: email,
      providerName: 'Test Provider',
      serviceName: 'Test Service',
      bookingDate: addDays(new Date(), 1),
      startTime: '10:00 AM',
      endTime: '11:00 AM',
      totalAmount: 100,
      bookingId: 'test-booking-123',
      location: '123 Test Street, Test City',
    };

    switch (type) {
      case 'booking-confirmation':
        await emailService.sendBookingConfirmation(testData);
        break;
        
      case 'provider-notification':
        await emailService.sendProviderBookingNotification({
          providerName: 'Test Provider',
          providerEmail: email,
          customerName: 'Test Customer',
          serviceName: 'Test Service',
          bookingDate: testData.bookingDate,
          startTime: '10:00 AM',
          endTime: '11:00 AM',
          bookingId: 'test-booking-123',
          customerEmail: 'customer@example.com',
          customerNotes: 'This is a test booking notification',
        });
        break;
        
      case 'payment-receipt':
        await emailService.sendPaymentReceipt({
          customerName: 'Test Customer',
          customerEmail: email,
          amount: 100,
          serviceName: 'Test Service',
          providerName: 'Test Provider',
          paymentDate: new Date(),
          paymentIntentId: 'pi_test_123456',
          bookingId: 'test-booking-123',
        });
        break;
        
      case 'appointment-reminder':
        await emailService.sendAppointmentReminder(
          email,
          'Test Customer',
          'Test Provider',
          'Test Service',
          testData.bookingDate,
          '10:00 AM',
          '11:00 AM',
          '123 Test Street, Test City',
          24
        );
        break;
        
      case 'welcome':
        await emailService.sendWelcomeEmail(email, 'Test User', false);
        break;
        
      default:
        return NextResponse.json(
          { error: 'Invalid email type' },
          { status: 400 }
        );
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `${type} email sent to ${email}` 
    });
    
  } catch (error) {
    console.error('Test email error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to send test email',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const types = [
    'booking-confirmation',
    'provider-notification', 
    'payment-receipt',
    'appointment-reminder',
    'welcome'
  ];
  
  return NextResponse.json({
    message: 'Email testing endpoint',
    usage: 'POST with { "type": "email-type", "email": "test@example.com" }',
    availableTypes: types
  });
}