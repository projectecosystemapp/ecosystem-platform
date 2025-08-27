#!/usr/bin/env tsx

/**
 * Test Redis Cloud connection and performance
 */

import { redis, cache, checkRedisHealth } from '../lib/redis-cloud';
import { rateLimiters } from '../lib/rate-limiter-redis-cloud';

async function runTests() {
  console.log('🔍 Testing Redis Cloud Connection...\n');

  try {
    // 1. Test basic connection
    console.log('1️⃣ Testing basic connection...');
    const healthCheck = await checkRedisHealth();
    console.log('   ✅ Connected:', healthCheck.connected);
    console.log('   ⏱️ Latency:', healthCheck.latency + 'ms');
    if (healthCheck.info) {
      console.log('   📊 Redis version:', healthCheck.info.version);
    }

    // 2. Test cache operations
    console.log('\n2️⃣ Testing cache operations...');
    const testKey = 'test:cache:' + Date.now();
    const testValue = { message: 'Hello Redis Cloud!', timestamp: Date.now() };
    
    const setStart = Date.now();
    await cache.set(testKey, testValue, 10);
    const setLatency = Date.now() - setStart;
    console.log('   ✅ Set operation:', setLatency + 'ms');

    const getStart = Date.now();
    const retrieved = await cache.get(testKey);
    const getLatency = Date.now() - getStart;
    console.log('   ✅ Get operation:', getLatency + 'ms');
    console.log('   📦 Retrieved value matches:', JSON.stringify(retrieved) === JSON.stringify(testValue));

    await cache.delete(testKey);
    console.log('   ✅ Delete operation completed');

    // 3. Test rate limiting
    console.log('\n3️⃣ Testing rate limiting...');
    const testIdentifier = 'test:ratelimit:' + Date.now();
    
    const rateLimitStart = Date.now();
    const result = await rateLimiters.api.limit(testIdentifier);
    const rateLimitLatency = Date.now() - rateLimitStart;
    
    console.log('   ✅ Rate limit check:', rateLimitLatency + 'ms');
    console.log('   📊 Limit:', result.limit);
    console.log('   📊 Remaining:', result.remaining);
    console.log('   📊 Success:', result.success);

    // Clean up
    await rateLimiters.api.reset(testIdentifier);

    // 4. Performance benchmark
    console.log('\n4️⃣ Running performance benchmark...');
    const iterations = 100;
    const benchmarkStart = Date.now();
    
    for (let i = 0; i < iterations; i++) {
      await redis.ping();
    }
    
    const totalTime = Date.now() - benchmarkStart;
    const avgLatency = totalTime / iterations;
    
    console.log('   📊 Total operations:', iterations);
    console.log('   ⏱️ Total time:', totalTime + 'ms');
    console.log('   ⚡ Average latency:', avgLatency.toFixed(2) + 'ms');
    
    // 5. Check memory usage
    console.log('\n5️⃣ Checking Redis memory usage...');
    const info = await redis.info('memory');
    const memoryLines = info.split('\r\n');
    for (const line of memoryLines) {
      if (line.startsWith('used_memory_human:')) {
        console.log('   💾 Memory used:', line.split(':')[1]);
      }
      if (line.startsWith('used_memory_peak_human:')) {
        console.log('   📈 Peak memory:', line.split(':')[1]);
      }
    }

    console.log('\n✅ All tests passed successfully!');
    console.log('\n📊 Performance Summary:');
    console.log('   - Connection latency: <', healthCheck.latency, 'ms');
    console.log('   - Cache operations: <', Math.max(setLatency, getLatency), 'ms');
    console.log('   - Rate limiting: <', rateLimitLatency, 'ms');
    console.log('   - Average operation: <', avgLatency.toFixed(2), 'ms');
    
    if (avgLatency < 1) {
      console.log('\n🎉 Excellent! Sub-millisecond average latency achieved!');
    } else if (avgLatency < 5) {
      console.log('\n✨ Great performance! Operations completing in under 5ms.');
    } else {
      console.log('\n⚠️ Consider checking network latency to Redis Cloud instance.');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    // Close connection
    await redis.quit();
    process.exit(0);
  }
}

// Run tests
runTests();