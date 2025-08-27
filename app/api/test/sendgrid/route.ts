import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, sendBookingConfirmationEmail } from '@/lib/sendgrid/email-service';

/**
 * Test endpoint for SendGrid email sending
 * GET /api/test/sendgrid?email=your-email@example.com
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const testEmail = searchParams.get('email');
    
    if (!testEmail) {
      return NextResponse.json(
        { error: 'Please provide an email parameter: /api/test/sendgrid?email=your@email.com' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(testEmail)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    console.log(`🧪 Testing SendGrid email to: ${testEmail}`);

    // Test 1: Simple text email
    const simpleResult = await sendEmail({
      to: testEmail,
      subject: 'Test Email from Ecosystem Marketplace',
      text: 'This is a test email to verify SendGrid integration is working correctly.',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>🎉 SendGrid Test Successful!</h2>
          <p>This is a test email from your Ecosystem Marketplace application.</p>
          <p>If you're receiving this, your SendGrid integration is working correctly!</p>
          <hr />
          <p style="color: #666; font-size: 12px;">
            Sent from: ${process.env.SENDGRID_FROM_EMAIL}<br/>
            API Key: ${process.env.SENDGRID_API_KEY ? '✅ Configured' : '❌ Not configured'}<br/>
            Environment: ${process.env.NODE_ENV || 'development'}<br/>
            Timestamp: ${new Date().toISOString()}
          </p>
        </div>
      `,
      categories: ['test', 'verification'],
    });

    // Test 2: Booking confirmation template
    const bookingResult = await sendBookingConfirmationEmail({
      customerEmail: testEmail,
      customerName: 'Test Customer',
      providerName: 'John Doe Services',
      serviceName: 'Premium House Cleaning',
      serviceDate: new Date(Date.now() + 86400000), // Tomorrow
      serviceTime: '2:00 PM',
      totalAmount: 150.00,
      bookingId: 'test-' + Math.random().toString(36).substring(7),
      location: '123 Test Street, Denver, CO 80202',
      notes: 'This is a test booking email',
      providerPhone: '(555) 123-4567',
    });

    // Return results
    return NextResponse.json({
      success: true,
      message: 'SendGrid test emails sent successfully!',
      results: {
        simpleEmail: simpleResult,
        bookingEmail: bookingResult,
      },
      configuration: {
        apiKeyConfigured: !!process.env.SENDGRID_API_KEY,
        fromEmail: process.env.SENDGRID_FROM_EMAIL,
        fromName: process.env.SENDGRID_FROM_NAME,
        replyTo: process.env.SENDGRID_REPLY_TO,
        dataResidency: process.env.SENDGRID_DATA_RESIDENCY_EU === 'true' ? 'EU' : 'US',
      },
      sentTo: testEmail,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('❌ SendGrid test failed:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send test email',
        details: error instanceof Error ? error.stack : undefined,
        configuration: {
          apiKeyConfigured: !!process.env.SENDGRID_API_KEY,
          fromEmail: process.env.SENDGRID_FROM_EMAIL,
        },
      },
      { status: 500 }
    );
  }
}

/**
 * POST endpoint for testing with custom data
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, subject, html, text } = body;

    if (!to || !subject || (!html && !text)) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, and either html or text' },
        { status: 400 }
      );
    }

    const result = await sendEmail({
      to,
      subject,
      html,
      text,
      categories: ['test', 'custom'],
    });

    return NextResponse.json({
      success: true,
      result,
      message: `Email sent to ${to}`,
    });

  } catch (error) {
    console.error('❌ SendGrid test POST failed:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send custom email',
      },
      { status: 500 }
    );
  }
}