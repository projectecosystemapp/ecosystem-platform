import twilio from 'twilio';
import { format } from 'date-fns';

// Initialize Twilio client based on environment
const accountSid = process.env.TWILIO_ENV === 'live' 
  ? process.env.TWILIO_ACCOUNT_SID 
  : process.env.TWILIO_TEST_ACCOUNT_SID;

const authToken = process.env.TWILIO_ENV === 'live'
  ? process.env.TWILIO_AUTH_TOKEN
  : process.env.TWILIO_TEST_AUTH_TOKEN;

const fromNumber = process.env.TWILIO_PHONE_NUMBER;

// Only initialize if we have credentials
const twilioClient = accountSid && authToken ? twilio(accountSid, authToken) : null;

export interface SMSOptions {
  to: string;
  body: string;
  mediaUrl?: string[];
}

export interface BookingConfirmationData {
  customerPhone: string;
  customerName: string;
  providerName: string;
  serviceName: string;
  serviceDate: Date;
  serviceTime: string;
  totalAmount: number;
  bookingId: string;
  location?: string;
}

export interface ProviderNotificationData {
  providerPhone: string;
  customerName: string;
  serviceName: string;
  serviceDate: Date;
  serviceTime: string;
  bookingId: string;
  amount: number;
}

/**
 * Send an SMS message using Twilio
 */
export async function sendSMS(options: SMSOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    if (!twilioClient) {
      console.warn('⚠️ Twilio client not initialized. Check your environment variables.');
      return { success: false, error: 'SMS service not configured' };
    }

    if (!fromNumber) {
      console.warn('⚠️ TWILIO_PHONE_NUMBER not set in environment variables.');
      return { success: false, error: 'SMS phone number not configured' };
    }

    // Send the SMS
    const message = await twilioClient.messages.create({
      body: options.body,
      from: fromNumber,
      to: options.to,
      ...(options.mediaUrl && { mediaUrl: options.mediaUrl }),
    });

    console.log('✅ SMS sent successfully:', {
      sid: message.sid,
      to: options.to,
      status: message.status,
    });

    return {
      success: true,
      messageId: message.sid,
    };
  } catch (error) {
    console.error('❌ Failed to send SMS:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send SMS',
    };
  }
}

/**
 * Send booking confirmation SMS to customer
 */
export async function sendBookingConfirmation(data: BookingConfirmationData) {
  const message = `Hi ${data.customerName}! Your booking is confirmed:\n\n` +
    `📅 ${format(data.serviceDate, 'MMM dd, yyyy')} at ${data.serviceTime}\n` +
    `🛠 ${data.serviceName}\n` +
    `👤 Provider: ${data.providerName}\n` +
    `💰 Total: $${data.totalAmount.toFixed(2)}\n` +
    `${data.location ? `📍 ${data.location}\n` : ''}` +
    `\nBooking ID: ${data.bookingId.substring(0, 8)}\n` +
    `\nReply STATUS ${data.bookingId} for updates or CANCEL ${data.bookingId} to cancel.`;

  return sendSMS({
    to: data.customerPhone,
    body: message,
  });
}

/**
 * Send new booking notification to provider
 */
export async function sendProviderBookingNotification(data: ProviderNotificationData) {
  const message = `🎉 New booking received!\n\n` +
    `Customer: ${data.customerName}\n` +
    `Service: ${data.serviceName}\n` +
    `Date: ${format(data.serviceDate, 'MMM dd, yyyy')} at ${data.serviceTime}\n` +
    `Earnings: $${(data.amount * 0.9).toFixed(2)} (after fees)\n` +
    `\nBooking ID: ${data.bookingId.substring(0, 8)}\n` +
    `\nLog into your dashboard to manage this booking.`;

  return sendSMS({
    to: data.providerPhone,
    body: message,
  });
}

/**
 * Send booking reminder SMS
 */
export async function sendBookingReminder(
  customerPhone: string,
  providerName: string,
  serviceName: string,
  serviceDate: Date,
  serviceTime: string,
  bookingId: string
) {
  const message = `⏰ Reminder: Your ${serviceName} with ${providerName} is tomorrow!\n\n` +
    `📅 ${format(serviceDate, 'MMM dd, yyyy')} at ${serviceTime}\n` +
    `\nBooking ID: ${bookingId.substring(0, 8)}\n` +
    `\nReply CANCEL ${bookingId} if you need to cancel.`;

  return sendSMS({
    to: customerPhone,
    body: message,
  });
}

/**
 * Send cancellation notification
 */
export async function sendCancellationNotification(
  phone: string,
  isProvider: boolean,
  serviceName: string,
  serviceDate: Date,
  bookingId: string,
  refundAmount?: number
) {
  const message = isProvider
    ? `Booking cancelled:\n${serviceName} on ${format(serviceDate, 'MMM dd')}\nID: ${bookingId.substring(0, 8)}`
    : `Your ${serviceName} booking has been cancelled.\n` +
      `${refundAmount ? `Refund of $${refundAmount.toFixed(2)} will be processed in 3-5 days.\n` : ''}` +
      `Booking ID: ${bookingId.substring(0, 8)}`;

  return sendSMS({
    to: phone,
    body: message,
  });
}

/**
 * Send payment confirmation SMS
 */
export async function sendPaymentConfirmation(
  customerPhone: string,
  amount: number,
  last4: string,
  bookingId: string
) {
  const message = `✅ Payment confirmed!\n\n` +
    `Amount: $${amount.toFixed(2)}\n` +
    `Card: ****${last4}\n` +
    `Booking: ${bookingId.substring(0, 8)}\n` +
    `\nThank you for using Ecosystem!`;

  return sendSMS({
    to: customerPhone,
    body: message,
  });
}

/**
 * Send service completion notification
 */
export async function sendServiceCompletionNotification(
  customerPhone: string,
  providerName: string,
  serviceName: string,
  bookingId: string
) {
  const message = `🎉 Service completed!\n\n` +
    `Thank you for booking ${serviceName} with ${providerName}.\n` +
    `\nPlease take a moment to rate your experience:\n` +
    `ecosystem.app/review/${bookingId}\n` +
    `\nYour feedback helps our providers improve!`;

  return sendSMS({
    to: customerPhone,
    body: message,
  });
}

/**
 * Send marketing/promotional SMS (with opt-in check)
 */
export async function sendPromoSMS(
  phone: string,
  promoMessage: string,
  hasOptedIn: boolean = true
) {
  if (!hasOptedIn) {
    console.log('User has not opted in to marketing messages');
    return { success: false, error: 'User not opted in' };
  }

  const message = `${promoMessage}\n\nReply STOP to unsubscribe.`;

  return sendSMS({
    to: phone,
    body: message,
  });
}

/**
 * Validate phone number format
 */
export function validatePhoneNumber(phone: string): boolean {
  // Basic validation for US phone numbers
  const phoneRegex = /^\+?1?\d{10,14}$/;
  return phoneRegex.test(phone.replace(/\D/g, ''));
}

/**
 * Format phone number to E.164 format
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  
  // Add country code if not present (assuming US)
  if (digits.length === 10) {
    return `+1${digits}`;
  } else if (digits.length === 11 && digits[0] === '1') {
    return `+${digits}`;
  }
  
  return phone; // Return as-is if format is unclear
}