import sgMail from '@sendgrid/mail';
import { format } from 'date-fns';

// Initialize SendGrid with API key (will be set on first use)
let isInitialized = false;

function initializeSendGrid() {
  if (isInitialized) return true;
  
  const apiKey = process.env.SENDGRID_API_KEY;
  if (apiKey) {
    sgMail.setApiKey(apiKey);
    
    // Set EU data residency if configured
    if (process.env.SENDGRID_DATA_RESIDENCY_EU === 'true') {
      sgMail.setDataResidency('eu');
    }
    
    isInitialized = true;
    console.log('✅ SendGrid initialized successfully');
    return true;
  }
  
  console.warn('⚠️ SendGrid API key not found in environment variables');
  return false;
}

// Email configuration (will be read when needed)
function getEmailConfig() {
  return {
    FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL || 'noreply@ecosystem.app',
    FROM_NAME: process.env.SENDGRID_FROM_NAME || 'Ecosystem Marketplace',
    REPLY_TO: process.env.SENDGRID_REPLY_TO || 'support@ecosystem.app',
  };
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  templateId?: string;
  dynamicTemplateData?: Record<string, any>;
  attachments?: Array<{
    content: string;
    filename: string;
    type?: string;
    disposition?: string;
  }>;
  categories?: string[];
  sendAt?: Date;
}

export interface BookingEmailData {
  customerEmail: string;
  customerName: string;
  providerName: string;
  providerEmail?: string;
  serviceName: string;
  serviceDate: Date;
  serviceTime: string;
  totalAmount: number;
  bookingId: string;
  location?: string;
  notes?: string;
  providerPhone?: string;
}

/**
 * Send an email using SendGrid
 */
export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Initialize SendGrid if not already done
    if (!initializeSendGrid()) {
      console.warn('⚠️ SendGrid API key not configured. Email not sent.');
      return { success: false, error: 'Email service not configured' };
    }

    const config = getEmailConfig();
    const msg = {
      to: options.to,
      from: {
        email: config.FROM_EMAIL,
        name: config.FROM_NAME,
      },
      replyTo: config.REPLY_TO,
      subject: options.subject,
      ...(options.html && { html: options.html }),
      ...(options.text && { text: options.text }),
      ...(options.templateId && { templateId: options.templateId }),
      ...(options.dynamicTemplateData && { dynamicTemplateData: options.dynamicTemplateData }),
      ...(options.attachments && { attachments: options.attachments }),
      ...(options.categories && { categories: options.categories }),
      ...(options.sendAt && { sendAt: Math.floor(options.sendAt.getTime() / 1000) }),
    };

    const [response] = await sgMail.send(msg);
    
    console.log('✅ Email sent successfully:', {
      statusCode: response.statusCode,
      messageId: response.headers['x-message-id'],
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
    });

    return {
      success: true,
      messageId: response.headers['x-message-id'] as string,
    };
  } catch (error: any) {
    console.error('❌ Failed to send email:', error);
    
    // Handle SendGrid specific errors
    if (error.response) {
      console.error('SendGrid Error Response:', error.response.body);
      return {
        success: false,
        error: error.response.body?.errors?.[0]?.message || 'Failed to send email',
      };
    }
    
    return {
      success: false,
      error: error.message || 'Failed to send email',
    };
  }
}

/**
 * Send booking confirmation email to customer
 */
export async function sendBookingConfirmationEmail(data: BookingEmailData) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #0066FF; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 8px 8px; }
        .booking-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
        .detail-row:last-child { border-bottom: none; }
        .label { font-weight: bold; color: #666; }
        .value { color: #333; }
        .cta-button { display: inline-block; background: #0066FF; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Booking Confirmed! 🎉</h1>
        </div>
        <div class="content">
          <p>Hi ${data.customerName},</p>
          <p>Great news! Your booking has been confirmed. Here are your booking details:</p>
          
          <div class="booking-details">
            <div class="detail-row">
              <span class="label">Booking ID:</span>
              <span class="value">${data.bookingId.substring(0, 8).toUpperCase()}</span>
            </div>
            <div class="detail-row">
              <span class="label">Service:</span>
              <span class="value">${data.serviceName}</span>
            </div>
            <div class="detail-row">
              <span class="label">Provider:</span>
              <span class="value">${data.providerName}</span>
            </div>
            <div class="detail-row">
              <span class="label">Date:</span>
              <span class="value">${format(data.serviceDate, 'MMMM dd, yyyy')}</span>
            </div>
            <div class="detail-row">
              <span class="label">Time:</span>
              <span class="value">${data.serviceTime}</span>
            </div>
            ${data.location ? `
            <div class="detail-row">
              <span class="label">Location:</span>
              <span class="value">${data.location}</span>
            </div>
            ` : ''}
            <div class="detail-row">
              <span class="label">Total Amount:</span>
              <span class="value" style="font-size: 18px; color: #0066FF;">$${data.totalAmount.toFixed(2)}</span>
            </div>
          </div>

          ${data.notes ? `
          <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <strong>Notes:</strong> ${data.notes}
          </div>
          ` : ''}

          ${data.providerPhone ? `
          <p><strong>Provider Contact:</strong> ${data.providerPhone}</p>
          ` : ''}

          <center>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/bookings/${data.bookingId}" class="cta-button">View Booking Details</a>
          </center>

          <h3>What's Next?</h3>
          <ul>
            <li>You'll receive a reminder 24 hours before your appointment</li>
            <li>If you need to cancel or reschedule, please do so at least 24 hours in advance</li>
            <li>Have questions? Reply to this email or call us</li>
          </ul>

          <div class="footer">
            <p>Thank you for choosing Ecosystem Marketplace!</p>
            <p>Need help? Contact us at ${getEmailConfig().REPLY_TO}</p>
            <p>© ${new Date().getFullYear()} Ecosystem Marketplace. All rights reserved.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Booking Confirmed!

Hi ${data.customerName},

Your booking has been confirmed. Here are your details:

Booking ID: ${data.bookingId.substring(0, 8).toUpperCase()}
Service: ${data.serviceName}
Provider: ${data.providerName}
Date: ${format(data.serviceDate, 'MMMM dd, yyyy')}
Time: ${data.serviceTime}
${data.location ? `Location: ${data.location}` : ''}
Total Amount: $${data.totalAmount.toFixed(2)}

${data.notes ? `Notes: ${data.notes}` : ''}
${data.providerPhone ? `Provider Contact: ${data.providerPhone}` : ''}

View your booking: ${process.env.NEXT_PUBLIC_APP_URL}/bookings/${data.bookingId}

Thank you for choosing Ecosystem Marketplace!
  `;

  return sendEmail({
    to: data.customerEmail,
    subject: `Booking Confirmed - ${data.serviceName} on ${format(data.serviceDate, 'MMM dd')}`,
    html,
    text,
    categories: ['booking-confirmation', 'transactional'],
  });
}

/**
 * Send new booking notification to provider
 */
export async function sendProviderBookingNotificationEmail(data: BookingEmailData) {
  if (!data.providerEmail) {
    console.warn('Provider email not provided, skipping email notification');
    return { success: false, error: 'Provider email not provided' };
  }

  const providerEarnings = data.totalAmount * 0.9; // Provider gets 90%

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #10B981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 8px 8px; }
        .earnings-box { background: #10B981; color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
        .cta-button { display: inline-block; background: #10B981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>New Booking Received! 💼</h1>
        </div>
        <div class="content">
          <p>Great news! You have a new booking.</p>
          
          <div class="earnings-box">
            <h2 style="margin: 0;">You'll earn</h2>
            <div style="font-size: 36px; font-weight: bold;">$${providerEarnings.toFixed(2)}</div>
            <small>(after platform fees)</small>
          </div>

          <h3>Booking Details:</h3>
          <ul>
            <li><strong>Customer:</strong> ${data.customerName}</li>
            <li><strong>Service:</strong> ${data.serviceName}</li>
            <li><strong>Date:</strong> ${format(data.serviceDate, 'MMMM dd, yyyy')}</li>
            <li><strong>Time:</strong> ${data.serviceTime}</li>
            ${data.location ? `<li><strong>Location:</strong> ${data.location}</li>` : ''}
            <li><strong>Booking ID:</strong> ${data.bookingId.substring(0, 8).toUpperCase()}</li>
          </ul>

          ${data.notes ? `
          <div style="background: #fff3cd; padding: 15px; border-radius: 5px;">
            <strong>Customer Notes:</strong> ${data.notes}
          </div>
          ` : ''}

          <center>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/provider/bookings/${data.bookingId}" class="cta-button">Manage Booking</a>
          </center>

          <p style="margin-top: 30px; color: #666; font-size: 14px;">
            Remember to confirm with the customer 24 hours before the appointment.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: data.providerEmail,
    subject: `New Booking: ${data.customerName} - ${format(data.serviceDate, 'MMM dd')}`,
    html,
    text: `New booking from ${data.customerName} for ${data.serviceName} on ${format(data.serviceDate, 'MMM dd')} at ${data.serviceTime}. You'll earn $${providerEarnings.toFixed(2)}.`,
    categories: ['provider-notification', 'new-booking'],
  });
}

/**
 * Send booking reminder email
 */
export async function sendBookingReminderEmail(
  customerEmail: string,
  customerName: string,
  providerName: string,
  serviceName: string,
  serviceDate: Date,
  serviceTime: string,
  location: string | undefined,
  bookingId: string
) {
  const html = `
    <h2>Reminder: Your appointment is tomorrow!</h2>
    <p>Hi ${customerName},</p>
    <p>This is a friendly reminder about your upcoming appointment:</p>
    <ul>
      <li><strong>${serviceName}</strong> with ${providerName}</li>
      <li>📅 ${format(serviceDate, 'MMMM dd, yyyy')} at ${serviceTime}</li>
      ${location ? `<li>📍 ${location}</li>` : ''}
    </ul>
    <p>Booking ID: ${bookingId.substring(0, 8).toUpperCase()}</p>
    <p>If you need to cancel or reschedule, please do so as soon as possible.</p>
  `;

  return sendEmail({
    to: customerEmail,
    subject: `Reminder: ${serviceName} tomorrow at ${serviceTime}`,
    html,
    categories: ['reminder', 'transactional'],
  });
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email: string, resetToken: string) {
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}`;
  
  return sendEmail({
    to: email,
    subject: 'Reset Your Password - Ecosystem Marketplace',
    html: `
      <h2>Password Reset Request</h2>
      <p>You requested to reset your password. Click the link below to create a new password:</p>
      <p><a href="${resetUrl}" style="background: #0066FF; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a></p>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `,
    text: `Reset your password: ${resetUrl}`,
    categories: ['auth', 'password-reset'],
  });
}

/**
 * Send welcome email to new users
 */
export async function sendWelcomeEmail(email: string, name: string, isProvider: boolean = false) {
  return sendEmail({
    to: email,
    subject: 'Welcome to Ecosystem Marketplace!',
    html: `
      <h1>Welcome to Ecosystem, ${name}!</h1>
      <p>We're excited to have you join our marketplace community.</p>
      ${isProvider ? `
        <h3>As a service provider, you can:</h3>
        <ul>
          <li>List your services and set your own prices</li>
          <li>Manage your availability and bookings</li>
          <li>Build your reputation with customer reviews</li>
          <li>Get paid securely through our platform</li>
        </ul>
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/provider/onboarding">Complete Your Profile</a></p>
      ` : `
        <h3>Start exploring:</h3>
        <ul>
          <li>Browse hundreds of local services</li>
          <li>Book appointments instantly</li>
          <li>Pay securely online</li>
          <li>Track all your bookings in one place</li>
        </ul>
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/marketplace">Browse Services</a></p>
      `}
    `,
    categories: ['welcome', 'onboarding'],
  });
}

/**
 * Batch send emails (useful for marketing campaigns)
 */
export async function sendBatchEmails(
  recipients: Array<{ email: string; name?: string }>,
  subject: string,
  templateId: string,
  baseTemplateData: Record<string, any> = {}
) {
  const config = getEmailConfig();
  const messages = recipients.map(recipient => ({
    to: recipient.email,
    from: {
      email: config.FROM_EMAIL,
      name: config.FROM_NAME,
    },
    replyTo: config.REPLY_TO,
    subject,
    templateId,
    dynamicTemplateData: {
      ...baseTemplateData,
      name: recipient.name || 'Valued Customer',
      email: recipient.email,
    },
  }));

  try {
    const responses = await sgMail.send(messages);
    console.log(`✅ Batch emails sent: ${responses.length} messages`);
    return { success: true, count: responses.length };
  } catch (error) {
    console.error('❌ Batch email failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to send batch emails' };
  }
}