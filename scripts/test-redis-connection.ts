#!/usr/bin/env tsx

import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

console.log('Testing Upstash Redis Connection...\n');
console.log('URL:', UPSTASH_REDIS_REST_URL);
console.log('Token:', UPSTASH_REDIS_REST_TOKEN?.substring(0, 20) + '...\n');

if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
  console.error('❌ Missing environment variables!');
  process.exit(1);
}

async function testConnection() {
  try {
    const redis = new Redis({
      url: UPSTASH_REDIS_REST_URL!,
      token: UPSTASH_REDIS_REST_TOKEN!,
    });

    console.log('1. Testing PING...');
    const pingResult = await redis.ping();
    console.log('✅ PING successful:', pingResult);

    console.log('\n2. Testing SET...');
    const setResult = await redis.set('test:key', 'Hello from test script!');
    console.log('✅ SET successful:', setResult);

    console.log('\n3. Testing GET...');
    const getResult = await redis.get('test:key');
    console.log('✅ GET successful:', getResult);

    console.log('\n4. Testing DELETE...');
    const delResult = await redis.del('test:key');
    console.log('✅ DELETE successful:', delResult);

    console.log('\n✨ All tests passed! Redis is working correctly.');
    
  } catch (error: any) {
    console.error('\n❌ Connection failed!');
    console.error('Error:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    
    console.error('\nPossible issues:');
    console.error('1. Invalid credentials - Check your Upstash console');
    console.error('2. Redis instance is paused or deleted');
    console.error('3. Network connectivity issues');
    console.error('\nThe app will fall back to in-memory rate limiting.');
    
    process.exit(1);
  }
}

testConnection();