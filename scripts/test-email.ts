#!/usr/bin/env npx tsx

import { Resend } from 'resend';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testEmail() {
  console.log('Testing Resend email integration...\n');
  
  const apiKey = process.env.RESEND_API_KEY;
  
  if (!apiKey) {
    console.error('❌ RESEND_API_KEY not found in environment variables');
    process.exit(1);
  }
  
  console.log('✓ API Key found:', apiKey.substring(0, 15) + '...');
  
  try {
    const resend = new Resend(apiKey);
    
    console.log('\nSending test email...');
    
    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'customer-support@projectecosystemapp.com',
      subject: 'Test Email from Ecosystem Marketplace',
      html: `
        <h1>Test Email Successful!</h1>
        <p>This is a test email from your Ecosystem Marketplace application.</p>
        <p>If you're receiving this, your Resend integration is working correctly!</p>
        <p>Timestamp: ${new Date().toISOString()}</p>
      `,
    });
    
    if (error) {
      console.error('❌ Failed to send email:', error);
      process.exit(1);
    }
    
    console.log('✅ Email sent successfully!');
    console.log('Email ID:', data?.id);
    console.log('\nResend integration is working correctly!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testEmail();