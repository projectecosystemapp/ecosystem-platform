#!/usr/bin/env npx tsx
/**
 * Test script for SendGrid email service
 * Run with: npx tsx scripts/test-sendgrid.ts
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { sendEmail, sendBookingConfirmationEmail } from '../lib/sendgrid/email-service';

async function testSendGrid() {
  console.log('🚀 Testing SendGrid Email Service...\n');
  
  // Debug: Check if environment variables are loaded
  console.log('🔍 Environment Check:');
  console.log(`   SENDGRID_API_KEY: ${process.env.SENDGRID_API_KEY ? '✅ Set (hidden)' : '❌ Not set'}`);
  console.log(`   SENDGRID_FROM_EMAIL: ${process.env.SENDGRID_FROM_EMAIL || '❌ Not set'}`);
  console.log(`   SENDGRID_FROM_NAME: ${process.env.SENDGRID_FROM_NAME || '❌ Not set'}\n`);

  const testEmail = 'customer-support@projectecosystemapp.com';
  console.log(`📧 Sending test emails to: ${testEmail}\n`);

  try {
    // Test 1: Simple test email
    console.log('1️⃣ Sending simple test email...');
    const simpleResult = await sendEmail({
      to: testEmail,
      subject: '🎉 Ecosystem SendGrid Integration Test',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #0066FF 0%, #6B46C1 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-radius: 0 0 10px 10px; }
            .success-badge { background: #10B981; color: white; padding: 5px 10px; border-radius: 20px; display: inline-block; }
            .info-box { background: #F3F4F6; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">🎉 SendGrid Test Successful!</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Your email integration is working perfectly</p>
            </div>
            <div class="content">
              <p>Hi there! 👋</p>
              
              <p>This is a test email from your <strong>Ecosystem Marketplace</strong> application to verify that SendGrid integration is working correctly.</p>
              
              <div class="info-box">
                <h3 style="margin-top: 0;">✅ Integration Status</h3>
                <p><span class="success-badge">ACTIVE</span></p>
                <ul style="margin: 10px 0;">
                  <li>API Key: Configured ✓</li>
                  <li>From Email: ${process.env.SENDGRID_FROM_EMAIL || 'noreply@ecosystem.app'}</li>
                  <li>Environment: ${process.env.NODE_ENV || 'development'}</li>
                  <li>Timestamp: ${new Date().toLocaleString()}</li>
                </ul>
              </div>
              
              <h3>🚀 What's Working:</h3>
              <ul>
                <li>SendGrid API connection established</li>
                <li>Email templates rendering correctly</li>
                <li>HTML formatting preserved</li>
                <li>Delivery to your inbox confirmed (if you're reading this!)</li>
              </ul>
              
              <h3>📋 Next Steps:</h3>
              <ol>
                <li>Check that this email arrived in your inbox (not spam)</li>
                <li>Verify the booking confirmation template (coming next)</li>
                <li>Test the Twilio SMS integration</li>
                <li>Make a test booking to see the full notification flow</li>
              </ol>
              
              <div style="background: #EBF8FF; padding: 15px; border-left: 4px solid #0066FF; margin: 20px 0;">
                <strong>💡 Pro Tip:</strong> Your SendGrid and Twilio services are now integrated with your Stripe webhooks. When a real booking is made, both SMS and email notifications will be sent automatically!
              </div>
              
              <div class="footer">
                <p><strong>Ecosystem Marketplace</strong></p>
                <p>Two-sided marketplace connecting service providers with customers</p>
                <p style="color: #999;">
                  This is an automated test email • 
                  <a href="mailto:customer-support@projectecosystemapp.com" style="color: #0066FF;">Contact Support</a>
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
SendGrid Test Successful!

This is a test email from your Ecosystem Marketplace application.

Integration Status: ACTIVE ✓
- API Key: Configured
- From Email: ${process.env.SENDGRID_FROM_EMAIL || 'noreply@ecosystem.app'}
- Timestamp: ${new Date().toLocaleString()}

If you're reading this, your SendGrid integration is working perfectly!
      `,
      categories: ['test', 'integration-verification'],
    });

    if (simpleResult.success) {
      console.log('✅ Simple email sent successfully!');
      console.log(`   Message ID: ${simpleResult.messageId}\n`);
    } else {
      console.log('❌ Failed to send simple email:', simpleResult.error, '\n');
    }

    // Test 2: Booking confirmation template
    console.log('2️⃣ Sending booking confirmation template...');
    const bookingResult = await sendBookingConfirmationEmail({
      customerEmail: testEmail,
      customerName: 'Test Customer',
      providerName: 'Elite Cleaning Services',
      providerEmail: 'provider@test.com',
      serviceName: 'Deep House Cleaning',
      serviceDate: new Date(Date.now() + 86400000 * 3), // 3 days from now
      serviceTime: '2:00 PM - 5:00 PM',
      totalAmount: 299.99,
      bookingId: 'test-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
      location: '1234 Market Street, Suite 500, Denver, CO 80202',
      notes: 'Please use eco-friendly cleaning products. Dogs are friendly!',
      providerPhone: '(555) 123-4567',
    });

    if (bookingResult.success) {
      console.log('✅ Booking confirmation email sent successfully!');
      console.log(`   Message ID: ${bookingResult.messageId}\n`);
    } else {
      console.log('❌ Failed to send booking email:', bookingResult.error, '\n');
    }

    // Summary
    console.log('📊 Test Summary:');
    console.log('================');
    console.log(`Recipients: ${testEmail}`);
    console.log(`Simple Email: ${simpleResult.success ? '✅ Sent' : '❌ Failed'}`);
    console.log(`Booking Email: ${bookingResult.success ? '✅ Sent' : '❌ Failed'}`);
    console.log('\n✨ Check your inbox for the test emails!');
    console.log('📌 Note: Emails might take a few seconds to arrive.');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    console.error('\n🔍 Troubleshooting:');
    console.error('1. Check that SENDGRID_API_KEY is set in .env.local');
    console.error('2. Verify the API key is correct and active');
    console.error('3. Ensure the from email domain is verified in SendGrid');
  }
}

// Run the test
console.log('========================================');
console.log('   ECOSYSTEM MARKETPLACE EMAIL TEST');
console.log('========================================\n');

testSendGrid()
  .then(() => {
    console.log('\n✅ Test completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });