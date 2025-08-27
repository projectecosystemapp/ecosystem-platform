import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { db } from '@/db/db';
import { bookingsTable } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Initialize Twilio client
const accountSid = process.env.TWILIO_ENV === 'live' 
  ? process.env.TWILIO_ACCOUNT_SID 
  : process.env.TWILIO_TEST_ACCOUNT_SID;
const authToken = process.env.TWILIO_ENV === 'live'
  ? process.env.TWILIO_AUTH_TOKEN
  : process.env.TWILIO_TEST_AUTH_TOKEN;

// Webhook signature validation (optional but recommended)
const validateRequest = (request: Request, authToken: string): boolean => {
  // For now, we'll skip validation in test mode
  if (process.env.TWILIO_ENV === 'test') return true;
  
  // TODO: Implement Twilio webhook signature validation
  return true;
};

export async function POST(request: NextRequest) {
  try {
    // Parse the incoming SMS data
    const formData = await request.formData();
    const Body = formData.get('Body') as string;
    const From = formData.get('From') as string;
    const To = formData.get('To') as string;
    const MessageSid = formData.get('MessageSid') as string;
    
    console.log('📱 Incoming SMS:', {
      from: From,
      to: To,
      body: Body,
      sid: MessageSid,
      timestamp: new Date().toISOString()
    });

    // Create TwiML response
    const twiml = new twilio.twiml.MessagingResponse();
    
    // Parse message body for commands
    const messageBody = Body.toLowerCase().trim();
    
    // Handle different message types
    if (messageBody.includes('stop') || messageBody.includes('unsubscribe')) {
      // Handle opt-out
      twiml.message('You have been unsubscribed from Ecosystem notifications. Reply START to re-subscribe.');
      
      // TODO: Update user preferences in database
      
    } else if (messageBody.includes('help') || messageBody === '?') {
      // Send help message
      twiml.message(
        'Ecosystem Help:\n' +
        '• Reply STATUS + booking ID for booking status\n' +
        '• Reply CONFIRM + booking ID to confirm\n' +
        '• Reply CANCEL + booking ID to cancel\n' +
        '• Reply STOP to unsubscribe\n' +
        '• Reply HELP for this message'
      );
      
    } else if (messageBody.startsWith('status')) {
      // Check booking status
      const bookingId = messageBody.replace('status', '').trim();
      
      if (bookingId) {
        const booking = await db
          .select()
          .from(bookingsTable)
          .where(eq(bookingsTable.id, bookingId))
          .limit(1);
        
        if (booking.length > 0) {
          const status = booking[0].status;
          const date = booking[0].startTime; // Using startTime instead of serviceDate
          twiml.message(
            `Booking ${bookingId.substring(0, 8)}...:\n` +
            `Status: ${status}\n` +
            `Date: ${date}\n` +
            `Reply CANCEL ${bookingId} to cancel this booking.`
          );
        } else {
          twiml.message('Booking not found. Please check the booking ID and try again.');
        }
      } else {
        twiml.message('Please include your booking ID. Example: STATUS abc123');
      }
      
    } else if (messageBody.startsWith('confirm')) {
      // Confirm a booking
      const bookingId = messageBody.replace('confirm', '').trim();
      
      if (bookingId) {
        // TODO: Implement booking confirmation logic
        twiml.message(`Booking ${bookingId.substring(0, 8)}... has been confirmed! You'll receive a confirmation email shortly.`);
      } else {
        twiml.message('Please include your booking ID. Example: CONFIRM abc123');
      }
      
    } else if (messageBody.startsWith('cancel')) {
      // Cancel a booking
      const bookingId = messageBody.replace('cancel', '').trim();
      
      if (bookingId) {
        // TODO: Implement booking cancellation logic
        twiml.message(
          `Booking ${bookingId.substring(0, 8)}... cancellation request received.\n` +
          `We'll process this and send you a confirmation.`
        );
      } else {
        twiml.message('Please include your booking ID. Example: CANCEL abc123');
      }
      
    } else if (messageBody.includes('booking') || messageBody.includes('appointment')) {
      // General booking inquiry
      twiml.message(
        'Thanks for your booking inquiry! ' +
        'Visit ecosystem.app to browse and book services. ' +
        'For existing bookings, reply STATUS followed by your booking ID.'
      );
      
    } else {
      // Default response
      twiml.message(
        'Thanks for contacting Ecosystem! ' +
        'A team member will respond during business hours. ' +
        'Reply HELP for self-service options.'
      );
    }

    // Log the interaction for analytics
    console.log('📤 SMS Response sent:', twiml.toString());

    // Return TwiML response
    return new NextResponse(twiml.toString(), {
      status: 200,
      headers: { 
        'Content-Type': 'text/xml',
      },
    });
    
  } catch (error) {
    console.error('❌ Twilio webhook error:', error);
    
    // Return empty TwiML response on error (prevents Twilio from retrying)
    const twiml = new twilio.twiml.MessagingResponse();
    return new NextResponse(twiml.toString(), {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}