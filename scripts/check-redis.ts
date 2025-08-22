#!/usr/bin/env tsx
/**
 * Redis Configuration Check Script
 * 
 * Validates Redis configuration and tests connectivity
 */

import chalk from 'chalk';
import { config } from 'dotenv';
import { Redis } from '@upstash/redis';

// Load environment variables
config({ path: '.env.local' });

async function checkRedis() {
  console.log(chalk.blue.bold('\n🔍 Redis Configuration Check\n'));
  
  // Check environment variables
  console.log(chalk.yellow('1. Checking environment variables...'));
  
  const required = [
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
  ];
  
  const optional = [
    'REDIS_CACHE_URL',
    'REDIS_CACHE_TOKEN',
    'REDIS_SESSION_URL',
    'REDIS_SESSION_TOKEN',
  ];
  
  let hasErrors = false;
  
  // Check required variables
  for (const key of required) {
    if (process.env[key]) {
      console.log(chalk.green(`  ✅ ${key}: Configured`));
    } else {
      console.log(chalk.red(`  ❌ ${key}: Missing (REQUIRED)`));
      hasErrors = true;
    }
  }
  
  // Check optional variables
  console.log(chalk.yellow('\n2. Checking optional variables...'));
  for (const key of optional) {
    if (process.env[key]) {
      console.log(chalk.green(`  ✅ ${key}: Configured`));
    } else {
      console.log(chalk.gray(`  ⚪ ${key}: Not configured (optional)`));
    }
  }
  
  if (hasErrors) {
    console.log(chalk.red('\n❌ Required environment variables are missing!'));
    console.log(chalk.yellow('\nTo fix this:'));
    console.log('1. Sign up for Upstash at https://upstash.com');
    console.log('2. Create a Redis database');
    console.log('3. Copy the REST URL and Token');
    console.log('4. Add them to your .env.local file');
    process.exit(1);
  }
  
  // Test connection
  console.log(chalk.yellow('\n3. Testing Redis connection...'));
  
  try {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
    
    // Test ping
    const start = Date.now();
    await redis.ping();
    const latency = Date.now() - start;
    
    console.log(chalk.green(`  ✅ Connection successful (${latency}ms latency)`));
    
    // Test basic operations
    console.log(chalk.yellow('\n4. Testing basic operations...'));
    
    // Set
    const testKey = 'test:redis:check';
    const testValue = { test: true, timestamp: Date.now() };
    await redis.set(testKey, JSON.stringify(testValue));
    console.log(chalk.green('  ✅ SET operation successful'));
    
    // Get
    const retrieved = await redis.get(testKey);
    console.log(chalk.green('  ✅ GET operation successful'));
    
    // Delete
    await redis.del(testKey);
    console.log(chalk.green('  ✅ DEL operation successful'));
    
    // Test rate limiting
    console.log(chalk.yellow('\n5. Testing rate limiting...'));
    
    const { Ratelimit } = await import('@upstash/ratelimit');
    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      analytics: true,
      prefix: '@test/ratelimit',
    });
    
    const identifier = 'test-user';
    const { success, limit, remaining } = await ratelimit.limit(identifier);
    
    console.log(chalk.green(`  ✅ Rate limiting operational`));
    console.log(`     Limit: ${limit}, Remaining: ${remaining}`);
    
    // Get database info
    console.log(chalk.yellow('\n6. Database information...'));
    
    try {
      // Note: INFO command might not be available on all Upstash plans
      const dbSize = await redis.dbsize();
      console.log(`  📊 Database size: ${dbSize} keys`);
    } catch {
      console.log(chalk.gray('  ⚪ Database info not available (restricted by plan)'));
    }
    
    // Performance recommendations
    console.log(chalk.blue('\n📈 Performance Metrics:'));
    
    if (latency < 50) {
      console.log(chalk.green(`  ✅ Excellent latency (${latency}ms)`));
    } else if (latency < 100) {
      console.log(chalk.yellow(`  ⚠️  Good latency (${latency}ms)`));
    } else {
      console.log(chalk.red(`  ❌ High latency (${latency}ms) - Consider using a closer region`));
    }
    
    // Summary
    console.log(chalk.green.bold('\n✨ Redis is properly configured and operational!\n'));
    
    // Production readiness checklist
    console.log(chalk.blue('📋 Production Readiness Checklist:'));
    console.log(process.env.UPSTASH_REDIS_REST_URL?.includes('https') 
      ? chalk.green('  ✅ Using HTTPS connection')
      : chalk.red('  ❌ Not using HTTPS'));
    console.log(process.env.NODE_ENV === 'production'
      ? chalk.green('  ✅ Running in production mode')
      : chalk.yellow('  ⚠️  Not in production mode'));
    console.log(process.env.REDIS_CACHE_URL
      ? chalk.green('  ✅ Separate cache Redis configured')
      : chalk.yellow('  ⚠️  Using single Redis for all operations'));
    
  } catch (error) {
    console.log(chalk.red(`  ❌ Connection failed: ${(error as Error).message}`));
    console.log(chalk.yellow('\nTroubleshooting tips:'));
    console.log('1. Verify your Upstash credentials are correct');
    console.log('2. Check if your Redis database is active');
    console.log('3. Ensure your IP is not blocked (if IP filtering is enabled)');
    console.log('4. Try regenerating your token in Upstash console');
    process.exit(1);
  }
}

// Run the check
checkRedis().catch(console.error);