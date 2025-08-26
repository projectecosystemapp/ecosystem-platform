/**
 * Email Service
 * 
 * Handles all email communications using Resend
 * Provides templates for various transactional emails
 */

import { Resend } from 'resend';
import { format } from 'date-fns';

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

// Email configuration
const EMAIL_CONFIG = {
  from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
  replyTo: process.env.RESEND_REPLY_TO || 'customer-support@projectecosystemapp.com',
  appName: 'Ecosystem Marketplace',
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
};

// Email types
export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
  }>;
}

export interface BookingConfirmationData {
  customerName: string;
  customerEmail: string;
  providerName: string;
  serviceName: string;
  bookingDate: Date;
  startTime: string;
  endTime: string;
  totalAmount: number;
  bookingId: string;
  providerEmail?: string;
  location?: string;
}

export interface ProviderNotificationData {
  providerName: string;
  providerEmail: string;
  customerName: string;
  serviceName: string;
  bookingDate: Date;
  startTime: string;
  endTime: string;
  bookingId: string;
  customerEmail?: string;
  customerNotes?: string;
}

export interface PaymentReceiptData {
  customerName: string;
  customerEmail: string;
  amount: number;
  serviceName: string;
  providerName: string;
  paymentDate: Date;
  paymentIntentId: string;
  bookingId: string;
}

export interface PayoutNotificationData {
  providerName: string;
  providerEmail: string;
  amount: number;
  processingDate: Date;
  bookings: Array<{
    id: string;
    serviceName: string;
    amount: number;
  }>;
  payoutId: string;
}

/**
 * Send a generic email
 */
export async function sendEmail(options: EmailOptions) {
  try {
    const emailPayload: any = {
      from: EMAIL_CONFIG.from,
      to: options.to,
      subject: options.subject,
      replyTo: options.replyTo || EMAIL_CONFIG.replyTo,
    };

    if (options.html) emailPayload.html = options.html;
    if (options.text) emailPayload.text = options.text;
    if (options.cc) emailPayload.cc = options.cc;
    if (options.bcc) emailPayload.bcc = options.bcc;
    if (options.attachments) emailPayload.attachments = options.attachments;

    const { data, error } = await resend.emails.send(emailPayload);

    if (error) {
      console.error('Failed to send email:', error);
      throw new Error(`Email send failed: ${error.message}`);
    }

    console.log('Email sent successfully:', data?.id);
    return { success: true, id: data?.id };
  } catch (error) {
    console.error('Email service error:', error);
    throw error;
  }
}

/**
 * Send booking confirmation email to customer
 */
export async function sendBookingConfirmation(data: BookingConfirmationData) {
  const formattedDate = format(data.bookingDate, 'EEEE, MMMM d, yyyy');
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .booking-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
          .detail-row:last-child { border-bottom: none; }
          .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Booking Confirmed!</h1>
            <p>Your booking has been successfully confirmed</p>
          </div>
          <div class="content">
            <p>Hi ${data.customerName},</p>
            <p>Great news! Your booking with <strong>${data.providerName}</strong> has been confirmed.</p>
            
            <div class="booking-details">
              <h3>Booking Details</h3>
              <div class="detail-row">
                <span>Service:</span>
                <strong>${data.serviceName}</strong>
              </div>
              <div class="detail-row">
                <span>Date:</span>
                <strong>${formattedDate}</strong>
              </div>
              <div class="detail-row">
                <span>Time:</span>
                <strong>${data.startTime} - ${data.endTime}</strong>
              </div>
              ${data.location ? `
              <div class="detail-row">
                <span>Location:</span>
                <strong>${data.location}</strong>
              </div>
              ` : ''}
              <div class="detail-row">
                <span>Total Amount:</span>
                <strong>$${data.totalAmount.toFixed(2)}</strong>
              </div>
              <div class="detail-row">
                <span>Booking ID:</span>
                <strong>${data.bookingId}</strong>
              </div>
            </div>
            
            <center>
              <a href="${EMAIL_CONFIG.appUrl}/bookings/${data.bookingId}" class="button">View Booking</a>
            </center>
            
            <p><strong>What's Next?</strong></p>
            <ul>
              <li>You'll receive a reminder 24 hours before your appointment</li>
              <li>If you need to cancel or reschedule, please do so at least 24 hours in advance</li>
              <li>Contact your provider directly if you have any questions</li>
            </ul>
            
            <p>Thank you for choosing ${EMAIL_CONFIG.appName}!</p>
          </div>
          <div class="footer">
            <p>${EMAIL_CONFIG.appName} - Your trusted marketplace</p>
            <p>This is an automated email. Please do not reply directly to this message.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: data.customerEmail,
    subject: `Booking Confirmed - ${data.serviceName} on ${formattedDate}`,
    html,
    replyTo: data.providerEmail,
  });
}

/**
 * Send new booking notification to provider
 */
export async function sendProviderBookingNotification(data: ProviderNotificationData) {
  const formattedDate = format(data.bookingDate, 'EEEE, MMMM d, yyyy');
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #43a047 0%, #66bb6a 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .booking-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
          .detail-row:last-child { border-bottom: none; }
          .button { display: inline-block; padding: 12px 30px; background: #43a047; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .notes { background: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #ffc107; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Booking!</h1>
            <p>You have a new booking request</p>
          </div>
          <div class="content">
            <p>Hi ${data.providerName},</p>
            <p>Great news! You have a new booking from <strong>${data.customerName}</strong>.</p>
            
            <div class="booking-details">
              <h3>Booking Details</h3>
              <div class="detail-row">
                <span>Customer:</span>
                <strong>${data.customerName}</strong>
              </div>
              <div class="detail-row">
                <span>Service:</span>
                <strong>${data.serviceName}</strong>
              </div>
              <div class="detail-row">
                <span>Date:</span>
                <strong>${formattedDate}</strong>
              </div>
              <div class="detail-row">
                <span>Time:</span>
                <strong>${data.startTime} - ${data.endTime}</strong>
              </div>
              <div class="detail-row">
                <span>Booking ID:</span>
                <strong>${data.bookingId}</strong>
              </div>
            </div>
            
            ${data.customerNotes ? `
            <div class="notes">
              <strong>Customer Notes:</strong>
              <p>${data.customerNotes}</p>
            </div>
            ` : ''}
            
            <center>
              <a href="${EMAIL_CONFIG.appUrl}/provider/bookings/${data.bookingId}" class="button">View Booking</a>
            </center>
            
            <p><strong>Important Reminders:</strong></p>
            <ul>
              <li>Please confirm your availability as soon as possible</li>
              <li>Contact the customer if you need any clarification</li>
              <li>Mark the booking as complete after the service is provided</li>
            </ul>
          </div>
          <div class="footer">
            <p>${EMAIL_CONFIG.appName} - Your trusted marketplace</p>
            <p>This is an automated email. Please do not reply directly to this message.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: data.providerEmail,
    subject: `New Booking: ${data.serviceName} on ${formattedDate}`,
    html,
    replyTo: data.customerEmail,
  });
}

/**
 * Send payment receipt to customer
 */
export async function sendPaymentReceipt(data: PaymentReceiptData) {
  const formattedDate = format(data.paymentDate, 'MMMM d, yyyy h:mm a');
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; border-bottom: 3px solid #28a745; }
          .content { background: white; padding: 30px; border: 1px solid #dee2e6; border-radius: 0 0 10px 10px; }
          .receipt-details { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #dee2e6; }
          .detail-row:last-child { border-bottom: none; }
          .amount { font-size: 24px; color: #28a745; font-weight: bold; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Payment Receipt</h1>
            <p>Thank you for your payment</p>
          </div>
          <div class="content">
            <p>Hi ${data.customerName},</p>
            <p>This email confirms that we have received your payment.</p>
            
            <div class="receipt-details">
              <h3>Receipt Details</h3>
              <div class="detail-row">
                <span>Payment Date:</span>
                <strong>${formattedDate}</strong>
              </div>
              <div class="detail-row">
                <span>Service:</span>
                <strong>${data.serviceName}</strong>
              </div>
              <div class="detail-row">
                <span>Provider:</span>
                <strong>${data.providerName}</strong>
              </div>
              <div class="detail-row">
                <span>Transaction ID:</span>
                <strong>${data.paymentIntentId}</strong>
              </div>
              <div class="detail-row">
                <span>Booking Reference:</span>
                <strong>${data.bookingId}</strong>
              </div>
              <div class="detail-row">
                <span>Amount Paid:</span>
                <span class="amount">$${data.amount.toFixed(2)}</span>
              </div>
            </div>
            
            <p>Please keep this receipt for your records.</p>
            
            <p>If you have any questions about this payment, please contact us at ${EMAIL_CONFIG.replyTo}</p>
          </div>
          <div class="footer">
            <p>${EMAIL_CONFIG.appName} - Your trusted marketplace</p>
            <p>This is an official receipt for your payment.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: data.customerEmail,
    subject: `Payment Receipt - $${data.amount.toFixed(2)} for ${data.serviceName}`,
    html,
  });
}

/**
 * Send payout notification to provider
 */
export async function sendPayoutNotification(data: PayoutNotificationData) {
  const formattedDate = format(data.processingDate, 'MMMM d, yyyy');
  
  const bookingsList = data.bookings
    .map(b => `<li>${b.serviceName} - $${b.amount.toFixed(2)} (Booking #${b.id})</li>`)
    .join('');
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .payout-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .amount { font-size: 32px; color: #28a745; font-weight: bold; text-align: center; margin: 20px 0; }
          .bookings-list { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Payout Processed!</h1>
            <p>Your earnings have been sent to your bank account</p>
          </div>
          <div class="content">
            <p>Hi ${data.providerName},</p>
            <p>Great news! Your payout has been processed and the funds are on their way to your bank account.</p>
            
            <div class="amount">
              $${data.amount.toFixed(2)}
            </div>
            
            <div class="payout-details">
              <h3>Payout Details</h3>
              <p><strong>Processing Date:</strong> ${formattedDate}</p>
              <p><strong>Payout ID:</strong> ${data.payoutId}</p>
              <p><strong>Expected Arrival:</strong> 2-5 business days</p>
            </div>
            
            <div class="bookings-list">
              <h4>Included Bookings:</h4>
              <ul>
                ${bookingsList}
              </ul>
            </div>
            
            <p>The funds should appear in your connected bank account within 2-5 business days, depending on your bank's processing time.</p>
            
            <p>You can view your complete payout history in your provider dashboard.</p>
          </div>
          <div class="footer">
            <p>${EMAIL_CONFIG.appName} - Your trusted marketplace</p>
            <p>This is an automated notification about your payout.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: data.providerEmail,
    subject: `Payout Processed: $${data.amount.toFixed(2)}`,
    html,
  });
}

/**
 * Send booking cancellation email
 */
export async function sendBookingCancellation(
  customerEmail: string,
  customerName: string,
  providerName: string,
  serviceName: string,
  bookingDate: Date,
  refundAmount?: number
) {
  const formattedDate = format(bookingDate, 'EEEE, MMMM d, yyyy');
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc3545; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Booking Cancelled</h1>
          </div>
          <div class="content">
            <p>Hi ${customerName},</p>
            <p>Your booking has been cancelled as requested.</p>
            
            <div class="info-box">
              <h3>Cancelled Booking Details</h3>
              <p><strong>Service:</strong> ${serviceName}</p>
              <p><strong>Provider:</strong> ${providerName}</p>
              <p><strong>Original Date:</strong> ${formattedDate}</p>
              ${refundAmount ? `<p><strong>Refund Amount:</strong> $${refundAmount.toFixed(2)}</p>` : ''}
            </div>
            
            ${refundAmount ? `
            <p>Your refund of <strong>$${refundAmount.toFixed(2)}</strong> will be processed within 5-10 business days and will appear on your original payment method.</p>
            ` : ''}
            
            <p>We're sorry to see this booking cancelled. If you'd like to reschedule or book a different service, please visit our marketplace.</p>
            
            <p>If you have any questions, please don't hesitate to contact us.</p>
          </div>
          <div class="footer">
            <p>${EMAIL_CONFIG.appName} - Your trusted marketplace</p>
            <p>This is an automated email confirmation of your cancellation.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: customerEmail,
    subject: `Booking Cancelled - ${serviceName}`,
    html,
  });
}

/**
 * Send welcome email to new users
 */
export async function sendWelcomeEmail(email: string, name: string, isProvider: boolean = false) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 15px 40px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .features { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to ${EMAIL_CONFIG.appName}!</h1>
            <p>We're thrilled to have you join our community</p>
          </div>
          <div class="content">
            <p>Hi ${name},</p>
            <p>Welcome aboard! Your account has been successfully created, and you're now part of our growing marketplace community.</p>
            
            <div class="features">
              <h3>What you can do now:</h3>
              ${isProvider ? `
              <ul>
                <li>Complete your provider profile</li>
                <li>List your services</li>
                <li>Set your availability</li>
                <li>Start accepting bookings</li>
                <li>Track your earnings</li>
              </ul>
              ` : `
              <ul>
                <li>Browse available services</li>
                <li>Book appointments online</li>
                <li>Manage your bookings</li>
                <li>Leave reviews</li>
                <li>Save your favorite providers</li>
              </ul>
              `}
            </div>
            
            <center>
              <a href="${EMAIL_CONFIG.appUrl}/dashboard" class="button">Go to Dashboard</a>
            </center>
            
            <p>If you have any questions or need help getting started, our support team is here to help at ${EMAIL_CONFIG.replyTo}</p>
            
            <p>Best regards,<br>The ${EMAIL_CONFIG.appName} Team</p>
          </div>
          <div class="footer">
            <p>${EMAIL_CONFIG.appName} - Your trusted marketplace</p>
            <p>You're receiving this email because you recently created an account.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `Welcome to ${EMAIL_CONFIG.appName}!`,
    html,
  });
}

/**
 * Send hold expiration warning (5 minutes before expiry)
 */
export async function sendHoldExpirationWarning(
  customerEmail: string,
  customerName: string,
  serviceName: string,
  providerName: string,
  expiresAt: Date
) {
  const minutesRemaining = Math.round((expiresAt.getTime() - Date.now()) / 60000);
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #ffc107; color: #333; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .warning-box { background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107; }
          .button { display: inline-block; padding: 12px 30px; background: #28a745; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .timer { font-size: 24px; color: #dc3545; font-weight: bold; text-align: center; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ Your Booking Hold is Expiring Soon!</h1>
          </div>
          <div class="content">
            <p>Hi ${customerName},</p>
            
            <div class="timer">
              ${minutesRemaining} minutes remaining
            </div>
            
            <div class="warning-box">
              <h3>Your held slot is about to expire!</h3>
              <p><strong>Service:</strong> ${serviceName}</p>
              <p><strong>Provider:</strong> ${providerName}</p>
              <p>Complete your booking now to secure this time slot. Once expired, it will become available to other customers.</p>
            </div>
            
            <center>
              <a href="${EMAIL_CONFIG.appUrl}/checkout" class="button">Complete Booking Now</a>
            </center>
            
            <p>Don't lose your spot! Complete your booking in the next ${minutesRemaining} minutes.</p>
          </div>
          <div class="footer">
            <p>${EMAIL_CONFIG.appName} - Your trusted marketplace</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: customerEmail,
    subject: `⏰ ${minutesRemaining} minutes left to complete your booking`,
    html,
  });
}

/**
 * Send appointment reminder (24h or 2h before)
 */
export async function sendAppointmentReminder(
  customerEmail: string,
  customerName: string,
  providerName: string,
  serviceName: string,
  bookingDate: Date,
  startTime: string,
  endTime: string,
  location?: string,
  hoursUntil: number = 24
) {
  const formattedDate = format(bookingDate, 'EEEE, MMMM d, yyyy');
  const reminderType = hoursUntil === 24 ? 'Tomorrow' : `In ${hoursUntil} hours`;
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .appointment-card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #667eea; }
          .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
          .detail-row:last-child { border-bottom: none; }
          .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
          .button-secondary { background: #6c757d; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Appointment Reminder</h1>
            <p>${reminderType}: ${serviceName}</p>
          </div>
          <div class="content">
            <p>Hi ${customerName},</p>
            <p>This is a friendly reminder about your upcoming appointment.</p>
            
            <div class="appointment-card">
              <h3>📅 Appointment Details</h3>
              <div class="detail-row">
                <span>Service:</span>
                <strong>${serviceName}</strong>
              </div>
              <div class="detail-row">
                <span>Provider:</span>
                <strong>${providerName}</strong>
              </div>
              <div class="detail-row">
                <span>Date:</span>
                <strong>${formattedDate}</strong>
              </div>
              <div class="detail-row">
                <span>Time:</span>
                <strong>${startTime} - ${endTime}</strong>
              </div>
              ${location ? `
              <div class="detail-row">
                <span>Location:</span>
                <strong>${location}</strong>
              </div>
              ` : ''}
            </div>
            
            <center>
              <a href="${EMAIL_CONFIG.appUrl}/bookings" class="button">View Booking</a>
              <a href="${EMAIL_CONFIG.appUrl}/bookings/reschedule" class="button button-secondary">Reschedule</a>
            </center>
            
            <p><strong>Important:</strong></p>
            <ul>
              <li>Please arrive 5 minutes early</li>
              <li>Contact your provider if you need to cancel or reschedule</li>
              <li>Cancellations must be made at least 24 hours in advance for a full refund</li>
            </ul>
          </div>
          <div class="footer">
            <p>${EMAIL_CONFIG.appName} - Your trusted marketplace</p>
            <p>This is an automated reminder. Please do not reply directly to this message.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: customerEmail,
    subject: `Reminder: ${serviceName} ${reminderType}`,
    html,
  });
}

/**
 * Send refund confirmation email
 */
export async function sendRefundConfirmation(
  customerEmail: string,
  customerName: string,
  refundAmount: number,
  refundType: 'full' | 'partial',
  serviceName: string,
  providerName: string,
  reason: string,
  refundId: string
) {
  const refundTypeText = refundType === 'full' ? 'Full Refund' : 'Partial Refund';
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #28a745; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .refund-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745; }
          .amount { font-size: 32px; color: #28a745; font-weight: bold; text-align: center; margin: 20px 0; }
          .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
          .detail-row:last-child { border-bottom: none; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Refund Processed</h1>
            <p>${refundTypeText}</p>
          </div>
          <div class="content">
            <p>Hi ${customerName},</p>
            <p>Your refund has been successfully processed.</p>
            
            <div class="amount">
              $${refundAmount.toFixed(2)}
            </div>
            
            <div class="refund-details">
              <h3>Refund Details</h3>
              <div class="detail-row">
                <span>Refund Type:</span>
                <strong>${refundTypeText}</strong>
              </div>
              <div class="detail-row">
                <span>Service:</span>
                <strong>${serviceName}</strong>
              </div>
              <div class="detail-row">
                <span>Provider:</span>
                <strong>${providerName}</strong>
              </div>
              <div class="detail-row">
                <span>Reason:</span>
                <strong>${reason}</strong>
              </div>
              <div class="detail-row">
                <span>Refund ID:</span>
                <strong>${refundId}</strong>
              </div>
            </div>
            
            <p>The refund of <strong>$${refundAmount.toFixed(2)}</strong> will appear on your original payment method within 5-10 business days, depending on your bank's processing time.</p>
            
            <p>If you have any questions about this refund, please contact our support team at ${EMAIL_CONFIG.replyTo}</p>
          </div>
          <div class="footer">
            <p>${EMAIL_CONFIG.appName} - Your trusted marketplace</p>
            <p>This is an official refund confirmation.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: customerEmail,
    subject: `${refundTypeText} Processed: $${refundAmount.toFixed(2)}`,
    html,
  });
}

/**
 * Send guest magic link for authentication
 */
export async function sendGuestMagicLink(
  guestEmail: string,
  magicLink: string,
  bookingDetails?: {
    serviceName: string;
    providerName: string;
    bookingDate: Date;
  }
) {
  const bookingInfo = bookingDetails ? `
    <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <h4 style="margin: 0 0 10px 0;">Your Recent Booking:</h4>
      <p style="margin: 5px 0;">Service: <strong>${bookingDetails.serviceName}</strong></p>
      <p style="margin: 5px 0;">Provider: <strong>${bookingDetails.providerName}</strong></p>
      <p style="margin: 5px 0;">Date: <strong>${format(bookingDetails.bookingDate, 'MMMM d, yyyy')}</strong></p>
    </div>
  ` : '';
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 15px 40px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-size: 16px; }
          .security-note { background: #fff; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #667eea; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Access Your Account</h1>
            <p>Sign in to ${EMAIL_CONFIG.appName}</p>
          </div>
          <div class="content">
            <p>Hi there!</p>
            <p>Click the button below to securely access your account and manage your bookings.</p>
            
            ${bookingInfo}
            
            <center>
              <a href="${magicLink}" class="button">Sign In to Your Account</a>
            </center>
            
            <div class="security-note">
              <strong>🔒 Security Information:</strong>
              <ul style="margin: 10px 0;">
                <li>This link expires in 24 hours</li>
                <li>It can only be used once</li>
                <li>Never share this link with anyone</li>
              </ul>
            </div>
            
            <p>If you didn't request this email, you can safely ignore it.</p>
            
            <p style="color: #666; font-size: 12px; margin-top: 30px;">
              Or copy and paste this link into your browser:<br>
              <code style="background: #f0f0f0; padding: 5px; display: block; margin: 10px 0; word-break: break-all;">${magicLink}</code>
            </p>
          </div>
          <div class="footer">
            <p>${EMAIL_CONFIG.appName} - Your trusted marketplace</p>
            <p>This link was requested from IP address and will expire in 24 hours.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: guestEmail,
    subject: `Sign in to ${EMAIL_CONFIG.appName}`,
    html,
  });
}

/**
 * Send provider acceptance notification
 */
export async function sendProviderAcceptanceNotification(
  customerEmail: string,
  customerName: string,
  providerName: string,
  serviceName: string,
  bookingDate: Date,
  startTime: string,
  bookingId: string
) {
  const formattedDate = format(bookingDate, 'EEEE, MMMM d, yyyy');
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #28a745; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .success-box { background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745; }
          .button { display: inline-block; padding: 12px 30px; background: #28a745; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Booking Accepted!</h1>
            <p>Your provider has confirmed your booking</p>
          </div>
          <div class="content">
            <p>Hi ${customerName},</p>
            <p>Great news! <strong>${providerName}</strong> has accepted your booking request.</p>
            
            <div class="success-box">
              <h3>Confirmed Booking Details</h3>
              <p><strong>Service:</strong> ${serviceName}</p>
              <p><strong>Date:</strong> ${formattedDate}</p>
              <p><strong>Time:</strong> ${startTime}</p>
              <p><strong>Booking ID:</strong> ${bookingId}</p>
            </div>
            
            <center>
              <a href="${EMAIL_CONFIG.appUrl}/bookings/${bookingId}" class="button">View Booking Details</a>
            </center>
            
            <p>Your payment has been processed and your appointment is confirmed. We'll send you a reminder 24 hours before your appointment.</p>
          </div>
          <div class="footer">
            <p>${EMAIL_CONFIG.appName} - Your trusted marketplace</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: customerEmail,
    subject: `✅ Booking Confirmed: ${serviceName} on ${formattedDate}`,
    html,
  });
}

/**
 * Send no-show notification
 */
export async function sendNoShowNotification(
  email: string,
  name: string,
  isProvider: boolean,
  serviceName: string,
  bookingDate: Date,
  otherPartyName: string
) {
  const formattedDate = format(bookingDate, 'EEEE, MMMM d, yyyy');
  const partyType = isProvider ? 'customer' : 'provider';
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc3545; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .warning-box { background: #f8d7da; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>No-Show Recorded</h1>
          </div>
          <div class="content">
            <p>Hi ${name},</p>
            
            <div class="warning-box">
              <h3>A no-show has been recorded for your booking</h3>
              <p><strong>Service:</strong> ${serviceName}</p>
              <p><strong>Date:</strong> ${formattedDate}</p>
              <p><strong>${isProvider ? 'Customer' : 'Provider'}:</strong> ${otherPartyName}</p>
              <p>The ${partyType} did not ${isProvider ? 'arrive for' : 'provide'} the scheduled service.</p>
            </div>
            
            ${isProvider ? `
            <p>As the customer did not show up, you will receive compensation according to our no-show policy.</p>
            ` : `
            <p>As you did not attend the scheduled appointment, charges may apply according to our no-show policy.</p>
            `}
            
            <p>If you believe this was recorded in error, please contact our support team immediately at ${EMAIL_CONFIG.replyTo}</p>
          </div>
          <div class="footer">
            <p>${EMAIL_CONFIG.appName} - Your trusted marketplace</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `No-Show Recorded: ${serviceName}`,
    html,
  });
}

/**
 * Send dispute initiated notification
 */
export async function sendDisputeNotification(
  email: string,
  name: string,
  disputeInitiator: string,
  serviceName: string,
  bookingDate: Date,
  disputeReason: string,
  disputeId: string
) {
  const formattedDate = format(bookingDate, 'MMMM d, yyyy');
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #ffc107; color: #333; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .dispute-box { background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107; }
          .button { display: inline-block; padding: 12px 30px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .timeline { background: white; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Dispute Initiated</h1>
            <p>Action Required</p>
          </div>
          <div class="content">
            <p>Hi ${name},</p>
            <p>A dispute has been initiated regarding your booking.</p>
            
            <div class="dispute-box">
              <h3>Dispute Details</h3>
              <p><strong>Initiated by:</strong> ${disputeInitiator}</p>
              <p><strong>Service:</strong> ${serviceName}</p>
              <p><strong>Booking Date:</strong> ${formattedDate}</p>
              <p><strong>Reason:</strong> ${disputeReason}</p>
              <p><strong>Dispute ID:</strong> ${disputeId}</p>
            </div>
            
            <div class="timeline">
              <h4>What happens next?</h4>
              <ol>
                <li>Our team will review the dispute within 24-48 hours</li>
                <li>We may contact you for additional information</li>
                <li>A resolution will be provided within 5-7 business days</li>
                <li>Both parties will be notified of the outcome</li>
              </ol>
            </div>
            
            <center>
              <a href="${EMAIL_CONFIG.appUrl}/disputes/${disputeId}" class="button">View Dispute Details</a>
            </center>
            
            <p>Please provide any relevant documentation or evidence to support your case through the dispute portal.</p>
            
            <p>If you have questions, contact our dispute resolution team at ${EMAIL_CONFIG.replyTo}</p>
          </div>
          <div class="footer">
            <p>${EMAIL_CONFIG.appName} - Your trusted marketplace</p>
            <p>Dispute Reference: ${disputeId}</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `⚠️ Dispute Initiated: ${serviceName} - Action Required`,
    html,
  });
}

// Export the service instance for direct use
export const emailService = {
  send: sendEmail,
  sendBookingConfirmation,
  sendProviderBookingNotification,
  sendPaymentReceipt,
  sendPayoutNotification,
  sendBookingCancellation,
  sendWelcomeEmail,
  sendHoldExpirationWarning,
  sendAppointmentReminder,
  sendRefundConfirmation,
  sendGuestMagicLink,
  sendProviderAcceptanceNotification,
  sendNoShowNotification,
  sendDisputeNotification,
};