import { NextRequest, NextResponse } from 'next/server';
import { emailService } from '@/lib/services/email-service';

// Test endpoint for email functionality
// This should be removed or secured in production

export async function GET(req: NextRequest) {
  try {
    // Send a test email
    const result = await emailService.send({
      to: 'customer-support@projectecosystemapp.com',
      subject: 'Test Email from Ecosystem Marketplace',
      html: `
        <h1>Test Email</h1>
        <p>This is a test email from your Ecosystem Marketplace application.</p>
        <p>If you're receiving this, your Resend integration is working correctly!</p>
        <p>Timestamp: ${new Date().toISOString()}</p>
      `,
      text: 'This is a test email from your Ecosystem Marketplace application.',
    });

    return NextResponse.json({
      success: true,
      message: 'Test email sent successfully',
      id: result.id,
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