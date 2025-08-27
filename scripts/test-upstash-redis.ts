#!/usr/bin/env tsx

/**
 * Test script for Upstash Redis connectivity and rate limiting
 * 
 * Usage: npm run redis:test
 */

// Load environment variables from .env.local
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local file
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { 
  getUpstashClient, 
  checkUpstashHealth,
  createUpstashRateLimiter,
  isUpstashConfigured
} from '../lib/security/upstash-redis';

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function success(message: string) {
  log(`✅ ${message}`, colors.green);
}

function error(message: string) {
  log(`❌ ${message}`, colors.red);
}

function warning(message: string) {
  log(`⚠️  ${message}`, colors.yellow);
}

function info(message: string) {
  log(`ℹ️  ${message}`, colors.cyan);
}

async function testRedisConnection() {
  log('\n🔍 Testing Upstash Redis Configuration...', colors.bright);
  
  // Check if configured
  if (!isUpstashConfigured()) {
    error('Upstash Redis is not configured!');
    info('Please set the following environment variables in .env.local:');
    console.log('  - UPSTASH_REDIS_REST_URL');
    console.log('  - UPSTASH_REDIS_REST_TOKEN');
    info('\nYou can get these from: https://console.upstash.com/');
    return false;
  }
  
  success('Environment variables configured');
  
  // Test health check
  log('\n🏥 Running health check...', colors.bright);
  const health = await checkUpstashHealth();
  
  if (!health.connected) {
    error(`Health check failed: ${health.error}`);
    return false;
  }
  
  success(`Redis connected! Latency: ${health.latency}ms`);
  
  // Test basic operations
  log('\n🔧 Testing basic operations...', colors.bright);
  const client = getUpstashClient();
  
  if (!client) {
    error('Failed to get Redis client');
    return false;
  }
  
  try {
    // Test SET
    const testKey = `test:${Date.now()}`;
    const testValue = 'Hello from Upstash!';
    await client.set(testKey, testValue);
    success(`SET operation successful: ${testKey}`);
    
    // Test GET
    const retrieved = await client.get(testKey);
    if (retrieved === testValue) {
      success(`GET operation successful: ${retrieved}`);
    } else {
      error(`GET operation failed: expected "${testValue}", got "${retrieved}"`);
      return false;
    }
    
    // Test DELETE
    await client.del(testKey);
    success('DELETE operation successful');
    
    // Test TTL operations
    const ttlKey = `ttl:${Date.now()}`;
    await client.setex(ttlKey, 5, 'expires in 5 seconds');
    const ttl = await client.ttl(ttlKey);
    success(`TTL operation successful: key expires in ${ttl} seconds`);
    
    // Clean up
    await client.del(ttlKey);
    
  } catch (err) {
    error(`Basic operations failed: ${err}`);
    return false;
  }
  
  return true;
}

async function testRateLimiting() {
  log('\n🚦 Testing Rate Limiting...', colors.bright);
  
  if (!isUpstashConfigured()) {
    warning('Skipping rate limit tests - Redis not configured');
    return false;
  }
  
  // Create a rate limiter: 5 requests per 10 seconds
  const limiter = createUpstashRateLimiter({
    tokensPerInterval: 5,
    intervalMs: 10000, // 10 seconds
    namespace: 'test',
  });
  
  const testIdentifier = `test-user-${Date.now()}`;
  
  // Test allowing requests
  log('\nTesting request allowance...', colors.cyan);
  for (let i = 1; i <= 5; i++) {
    const result = await limiter.limit(testIdentifier);
    if (result.success) {
      success(`Request ${i}/5 allowed. Remaining: ${result.remaining}`);
    } else {
      error(`Request ${i}/5 blocked unexpectedly`);
      return false;
    }
  }
  
  // Test blocking after limit
  log('\nTesting rate limit enforcement...', colors.cyan);
  const blockedResult = await limiter.limit(testIdentifier);
  if (!blockedResult.success) {
    success(`Request 6 blocked as expected. Reset in ${Math.ceil((blockedResult.reset - Date.now()) / 1000)} seconds`);
  } else {
    error('Request 6 should have been blocked but was allowed');
    return false;
  }
  
  // Test reset
  log('\nTesting rate limit reset...', colors.cyan);
  await limiter.reset(testIdentifier);
  const afterResetResult = await limiter.limit(testIdentifier);
  if (afterResetResult.success) {
    success(`Request allowed after reset. Remaining: ${afterResetResult.remaining}`);
  } else {
    error('Request should be allowed after reset');
    return false;
  }
  
  // Clean up
  await limiter.reset(testIdentifier);
  
  return true;
}

async function testConcurrentRequests() {
  log('\n⚡ Testing Concurrent Rate Limiting...', colors.bright);
  
  if (!isUpstashConfigured()) {
    warning('Skipping concurrent tests - Redis not configured');
    return false;
  }
  
  const limiter = createUpstashRateLimiter({
    tokensPerInterval: 10,
    intervalMs: 5000, // 5 seconds
    namespace: 'concurrent',
  });
  
  const testIdentifier = `concurrent-test-${Date.now()}`;
  
  // Send 15 concurrent requests (10 should pass, 5 should fail)
  const promises = Array.from({ length: 15 }, (_, i) => 
    limiter.limit(testIdentifier).then(result => ({
      index: i + 1,
      ...result,
    }))
  );
  
  const results = await Promise.all(promises);
  
  const allowed = results.filter(r => r.success);
  const blocked = results.filter(r => !r.success);
  
  if (allowed.length === 10 && blocked.length === 5) {
    success(`Concurrent limiting working correctly: ${allowed.length} allowed, ${blocked.length} blocked`);
  } else {
    error(`Concurrent limiting failed: ${allowed.length} allowed (expected 10), ${blocked.length} blocked (expected 5)`);
    return false;
  }
  
  // Clean up
  await limiter.reset(testIdentifier);
  
  return true;
}

async function main() {
  console.clear();
  log('🚀 Upstash Redis Test Suite', colors.bright + colors.blue);
  log('================================\n', colors.blue);
  
  let allTestsPassed = true;
  
  // Test Redis connection
  const connectionOk = await testRedisConnection();
  allTestsPassed = allTestsPassed && connectionOk;
  
  if (connectionOk) {
    // Test rate limiting
    const rateLimitOk = await testRateLimiting();
    allTestsPassed = allTestsPassed && rateLimitOk;
    
    // Test concurrent requests
    const concurrentOk = await testConcurrentRequests();
    allTestsPassed = allTestsPassed && concurrentOk;
  }
  
  // Summary
  log('\n================================', colors.blue);
  if (allTestsPassed) {
    success('All tests passed! 🎉');
    info('\nRedis is properly configured and working.');
    info('Rate limiting will use Upstash Redis in production.');
  } else if (isUpstashConfigured()) {
    error('Some tests failed!');
    warning('\nPlease check your Upstash Redis configuration.');
    warning('The app will fall back to in-memory rate limiting.');
  } else {
    warning('Redis not configured!');
    info('\nTo enable distributed rate limiting:');
    info('1. Create an Upstash Redis database at https://console.upstash.com/');
    info('2. Add credentials to .env.local');
    info('3. Run this test again: npm run redis:test');
  }
  
  process.exit(allTestsPassed ? 0 : 1);
}

// Run tests
main().catch((err) => {
  error(`Test suite failed: ${err}`);
  process.exit(1);
});