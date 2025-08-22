#!/usr/bin/env node

/**
 * Rate Limiting Test Script
 * 
 * Tests the rate limiting infrastructure
 * Run with: npx tsx scripts/test-rate-limit.ts
 */

import { checkRateLimitHealth, getRateLimitAnalytics } from '../lib/rate-limit';

async function testRateLimiting() {
  console.log('🚀 Testing Rate Limiting Infrastructure\n');
  
  try {
    // Test 1: Check health
    console.log('1️⃣  Checking rate limit health...');
    const health = await checkRateLimitHealth();
    console.log('   Health Status:', health);
    
    if (health.healthy) {
      console.log('   ✅ Rate limiting is healthy');
      console.log(`   📊 Using ${health.usingRedis ? 'Redis' : 'In-Memory'} backend\n`);
    } else {
      console.log('   ⚠️  Rate limiting health check failed');
      if (health.error) {
        console.log('   Error:', health.error);
      }
    }
    
    // Test 2: Get analytics
    console.log('2️⃣  Getting rate limit analytics...');
    const analytics = await getRateLimitAnalytics();
    console.log('   Analytics:', JSON.stringify(analytics, null, 2));
    
    // Test 3: Check environment
    console.log('\n3️⃣  Checking environment configuration...');
    const hasRedisUrl = !!process.env.UPSTASH_REDIS_REST_URL;
    const hasRedisToken = !!process.env.UPSTASH_REDIS_REST_TOKEN;
    
    console.log('   UPSTASH_REDIS_REST_URL:', hasRedisUrl ? '✅ Set' : '❌ Not set');
    console.log('   UPSTASH_REDIS_REST_TOKEN:', hasRedisToken ? '✅ Set' : '❌ Not set');
    
    if (!hasRedisUrl || !hasRedisToken) {
      console.log('\n   ℹ️  To use Redis rate limiting:');
      console.log('   1. Sign up at https://console.upstash.com/');
      console.log('   2. Create a Redis database');
      console.log('   3. Add credentials to .env.local:');
      console.log('      UPSTASH_REDIS_REST_URL=your-url');
      console.log('      UPSTASH_REDIS_REST_TOKEN=your-token');
    }
    
    // Test 4: Test API endpoint
    console.log('\n4️⃣  Testing rate limited API endpoint...');
    if (process.env.NEXT_PUBLIC_APP_URL) {
      const apiUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/examples/rate-limited`;
      console.log('   Testing:', apiUrl);
      
      try {
        const response = await fetch(apiUrl);
        const data = await response.json();
        console.log('   Response:', data);
        
        // Check headers
        const headers: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          if (key.toLowerCase().startsWith('x-ratelimit')) {
            headers[key] = value;
          }
        });
        
        if (Object.keys(headers).length > 0) {
          console.log('   Rate Limit Headers:', headers);
        }
      } catch (error) {
        console.log('   ⚠️  API test failed - server may not be running');
      }
    } else {
      console.log('   ⚠️  NEXT_PUBLIC_APP_URL not set - skipping API test');
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 RATE LIMITING INFRASTRUCTURE STATUS');
    console.log('='.repeat(50));
    
    if (health.usingRedis) {
      console.log('✅ Redis-based rate limiting is active');
      console.log('   - Distributed across instances');
      console.log('   - Persistent rate limit tracking');
      console.log('   - Production-ready');
    } else {
      console.log('⚠️  Using in-memory rate limiting (development mode)');
      console.log('   - Single instance only');
      console.log('   - Resets on server restart');
      console.log('   - Not suitable for production');
    }
    
    console.log('\n💡 Rate Limit Configurations:');
    console.log('   • Auth: 5 requests per 15 minutes');
    console.log('   • Payment: 5 requests per minute');
    console.log('   • Booking: 10 requests per minute');
    console.log('   • Search: 100 requests per minute');
    console.log('   • API: 100 requests per minute');
    console.log('   • Server Actions: 30 requests per minute');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testRateLimiting()
  .then(() => {
    console.log('\n✅ Rate limiting test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Rate limiting test failed:', error);
    process.exit(1);
  });