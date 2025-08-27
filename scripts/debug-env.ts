#!/usr/bin/env tsx

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Try loading .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
console.log('Loading from:', envPath);
console.log('File exists:', fs.existsSync(envPath));

const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('Error loading .env.local:', result.error);
} else {
  console.log('Successfully loaded .env.local');
  console.log('\nRedis environment variables:');
  console.log('UPSTASH_REDIS_REST_URL:', process.env.UPSTASH_REDIS_REST_URL);
  console.log('UPSTASH_REDIS_REST_TOKEN:', process.env.UPSTASH_REDIS_REST_TOKEN?.substring(0, 20) + '...');
  
  // Check if there are any other Redis-related vars
  console.log('\nAll env vars containing REDIS:');
  Object.keys(process.env)
    .filter(key => key.includes('REDIS'))
    .forEach(key => {
      const value = process.env[key];
      if (key.includes('TOKEN')) {
        console.log(`${key}: ${value?.substring(0, 20)}...`);
      } else {
        console.log(`${key}: ${value}`);
      }
    });
}