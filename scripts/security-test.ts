#!/usr/bin/env tsx
/**
 * Security Testing Script
 * Validates security controls and identifies vulnerabilities
 * 
 * Run: npx tsx scripts/security-test.ts
 */

import fetch from 'node-fetch';
import * as crypto from 'crypto';

// Test configuration
const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const API_URL = `${BASE_URL}/api`;

// Colors for output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Test results tracking
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures: string[] = [];

async function runTest(name: string, test: () => Promise<boolean>) {
  totalTests++;
  process.stdout.write(`Testing ${name}... `);
  
  try {
    const passed = await test();
    if (passed) {
      passedTests++;
      log('✅ PASSED', 'green');
    } else {
      failedTests++;
      failures.push(name);
      log('❌ FAILED', 'red');
    }
  } catch (error) {
    failedTests++;
    failures.push(name);
    log('❌ ERROR', 'red');
    console.error(`  Error: ${error}`);
  }
}

// ============================================================================
// CSRF Protection Tests
// ============================================================================
async function testCSRFProtection() {
  log('\n🔒 Testing CSRF Protection...', 'blue');
  
  // Test 1: Request without CSRF token should fail
  await runTest('CSRF token required for POST', async () => {
    const response = await fetch(`${API_URL}/bookings/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: 'data' })
    });
    return response.status === 403;
  });

  // Test 2: Invalid CSRF token should fail
  await runTest('Invalid CSRF token rejected', async () => {
    const response = await fetch(`${API_URL}/bookings/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': 'invalid-token'
      },
      body: JSON.stringify({ test: 'data' })
    });
    return response.status === 403;
  });
}

// ============================================================================
// Rate Limiting Tests
// ============================================================================
async function testRateLimiting() {
  log('\n⏱️ Testing Rate Limiting...', 'blue');
  
  // Test rapid requests
  await runTest('Rate limiting enforced', async () => {
    const requests = [];
    
    // Send 20 rapid requests (should exceed limit)
    for (let i = 0; i < 20; i++) {
      requests.push(
        fetch(`${API_URL}/providers`, {
          method: 'GET'
        })
      );
    }
    
    const responses = await Promise.all(requests);
    const rateLimited = responses.some(r => r.status === 429);
    
    // Should have at least one 429 response
    return rateLimited;
  });

  // Test rate limit headers
  await runTest('Rate limit headers present', async () => {
    const response = await fetch(`${API_URL}/health`);
    
    return !!(
      response.headers.get('x-ratelimit-limit') &&
      response.headers.get('x-ratelimit-remaining') &&
      response.headers.get('x-ratelimit-reset')
    );
  });
}

// ============================================================================
// Security Headers Tests
// ============================================================================
async function testSecurityHeaders() {
  log('\n🛡️ Testing Security Headers...', 'blue');
  
  const response = await fetch(BASE_URL);
  const headers = response.headers;
  
  // Test essential security headers
  await runTest('Content-Security-Policy present', async () => {
    return !!headers.get('content-security-policy');
  });

  await runTest('Strict-Transport-Security present', async () => {
    const hsts = headers.get('strict-transport-security');
    return !!(hsts && hsts.includes('max-age='));
  });

  await runTest('X-Content-Type-Options set to nosniff', async () => {
    return headers.get('x-content-type-options') === 'nosniff';
  });

  await runTest('X-Frame-Options set', async () => {
    const xfo = headers.get('x-frame-options');
    return xfo === 'DENY' || xfo === 'SAMEORIGIN';
  });

  await runTest('Referrer-Policy set', async () => {
    return !!headers.get('referrer-policy');
  });

  await runTest('Permissions-Policy set', async () => {
    return !!headers.get('permissions-policy');
  });
}

// ============================================================================
// Input Validation Tests
// ============================================================================
async function testInputValidation() {
  log('\n🔍 Testing Input Validation...', 'blue');
  
  // SQL Injection attempt
  await runTest('SQL injection prevented', async () => {
    const response = await fetch(`${API_URL}/providers/search?q=' OR '1'='1`, {
      method: 'GET'
    });
    
    // Should not return all results or error
    const data = await response.json();
    return response.status === 400 || (Array.isArray(data) && data.length === 0);
  });

  // XSS attempt
  await runTest('XSS prevention', async () => {
    const response = await fetch(`${API_URL}/bookings/guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guestName: '<script>alert("XSS")</script>',
        guestEmail: 'test@test.com'
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      // Check if script tags were escaped
      return !data.guestName?.includes('<script>');
    }
    return true; // Failed validation is also good
  });

  // Invalid UUID
  await runTest('UUID validation', async () => {
    const response = await fetch(`${API_URL}/providers/not-a-uuid`, {
      method: 'GET'
    });
    return response.status === 400 || response.status === 404;
  });

  // Negative amount attack
  await runTest('Negative amount rejected', async () => {
    const response = await fetch(`${API_URL}/checkout/guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: -100,
        providerId: crypto.randomUUID(),
        serviceId: crypto.randomUUID()
      })
    });
    return response.status === 400;
  });
}

// ============================================================================
// Authentication Tests
// ============================================================================
async function testAuthentication() {
  log('\n🔐 Testing Authentication...', 'blue');
  
  // Test protected endpoints
  await runTest('Protected endpoints require auth', async () => {
    const response = await fetch(`${API_URL}/user/status`, {
      method: 'GET'
    });
    return response.status === 401 || response.status === 403;
  });

  // Test admin endpoints
  await runTest('Admin endpoints require admin role', async () => {
    const response = await fetch(`${API_URL}/admin/users`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer fake-token'
      }
    });
    return response.status === 403 || response.status === 401;
  });
}

// ============================================================================
// Webhook Security Tests
// ============================================================================
async function testWebhookSecurity() {
  log('\n🪝 Testing Webhook Security...', 'blue');
  
  // Test unsigned webhook
  await runTest('Webhook signature required', async () => {
    const response = await fetch(`${API_URL}/stripe/webhooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'payment_intent.succeeded',
        data: { object: {} }
      })
    });
    return response.status === 400 || response.status === 401;
  });

  // Test invalid signature
  await runTest('Invalid webhook signature rejected', async () => {
    const response = await fetch(`${API_URL}/stripe/webhooks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': 'invalid-signature'
      },
      body: JSON.stringify({
        type: 'payment_intent.succeeded',
        data: { object: {} }
      })
    });
    return response.status === 400;
  });
}

// ============================================================================
// CORS Tests
// ============================================================================
async function testCORS() {
  log('\n🌐 Testing CORS Configuration...', 'blue');
  
  // Test CORS headers
  await runTest('CORS headers for API', async () => {
    const response = await fetch(`${API_URL}/health`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://evil.com',
        'Access-Control-Request-Method': 'POST'
      }
    });
    
    const allowedOrigin = response.headers.get('access-control-allow-origin');
    // Should not allow evil.com
    return allowedOrigin !== 'https://evil.com' && allowedOrigin !== '*';
  });
}

// ============================================================================
// Sensitive Data Tests
// ============================================================================
async function testSensitiveData() {
  log('\n🔒 Testing Sensitive Data Protection...', 'blue');
  
  // Test error messages don't leak info
  await runTest('Error messages sanitized', async () => {
    const response = await fetch(`${API_URL}/this-endpoint-does-not-exist`);
    
    if (!response.ok) {
      const text = await response.text();
      // Should not contain stack traces or internal paths
      return !text.includes('at ') && !text.includes('/Users/') && !text.includes('\\Users\\');
    }
    return false;
  });

  // Test API doesn't expose sensitive fields
  await runTest('Sensitive fields not exposed', async () => {
    const response = await fetch(`${API_URL}/providers`);
    
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        const provider = data[0];
        // Should not contain sensitive fields
        return !(
          'stripeConnectAccountId' in provider ||
          'password' in provider ||
          'email' in provider ||
          'ssn' in provider
        );
      }
    }
    return true;
  });
}

// ============================================================================
// Performance Security Tests
// ============================================================================
async function testPerformanceSecurity() {
  log('\n⚡ Testing Performance Security...', 'blue');
  
  // Test large payload rejection
  await runTest('Large payload rejected', async () => {
    const largePayload = 'x'.repeat(10 * 1024 * 1024); // 10MB
    
    const response = await fetch(`${API_URL}/bookings/guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: largePayload })
    });
    
    return response.status === 413 || response.status === 400;
  });
}

// ============================================================================
// Main execution
// ============================================================================
async function main() {
  log('========================================', 'blue');
  log('   SECURITY TEST SUITE', 'blue');
  log('========================================', 'blue');
  log(`\nTesting against: ${BASE_URL}\n`, 'yellow');

  // Run all test suites
  await testCSRFProtection();
  await testRateLimiting();
  await testSecurityHeaders();
  await testInputValidation();
  await testAuthentication();
  await testWebhookSecurity();
  await testCORS();
  await testSensitiveData();
  await testPerformanceSecurity();

  // Print results
  log('\n========================================', 'blue');
  log('   TEST RESULTS', 'blue');
  log('========================================', 'blue');
  
  log(`\nTotal Tests: ${totalTests}`, 'blue');
  log(`Passed: ${passedTests}`, 'green');
  log(`Failed: ${failedTests}`, failedTests > 0 ? 'red' : 'green');
  
  if (failures.length > 0) {
    log('\n❌ Failed Tests:', 'red');
    failures.forEach(test => {
      log(`  - ${test}`, 'red');
    });
    
    log('\n⚠️  SECURITY VULNERABILITIES DETECTED!', 'red');
    log('Please review and fix the failed tests immediately.', 'yellow');
    process.exit(1);
  } else {
    log('\n✅ All security tests passed!', 'green');
    log('Your application has passed basic security checks.', 'green');
    log('\n📝 Note: This is not a comprehensive penetration test.', 'yellow');
    log('Consider hiring security professionals for thorough testing.', 'yellow');
  }
}

// Run the tests
main().catch(error => {
  log('\n❌ Test suite failed:', 'red');
  console.error(error);
  process.exit(1);
});