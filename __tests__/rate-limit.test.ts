/**
 * Rate Limiting Test Suite
 * 
 * Tests the comprehensive rate limiting infrastructure for the Ecosystem marketplace.
 * Ensures proper enforcement of rate limits across different endpoint types.
 */

import { 
  checkRateLimitStatus, 
  rateLimitServerAction,
  checkRateLimitHealth,
  RATE_LIMIT_CONFIGS 
} from "@/lib/rate-limit";
import { 
  isRateLimited, 
  getRemainingRequests,
  ENHANCED_RATE_LIMITS 
} from "@/lib/middleware/rate-limit-middleware";

describe('Rate Limiting Infrastructure', () => {
  const testIdentifiers = {
    user: 'user:test-user-123',
    guest: 'ip:192.168.1.1-abc123',
    webhook: 'ip:stripe-webhook'
  };

  beforeEach(() => {
    // Clear any existing rate limit data for test identifiers
    // This would depend on your test setup
  });

  describe('Core Rate Limiting', () => {
    it('should enforce payment endpoint limits', async () => {
      const identifier = testIdentifiers.user;
      const type = 'payment' as const;
      const config = RATE_LIMIT_CONFIGS[type];
      
      // Make requests up to the limit
      for (let i = 0; i < config.maxRequests; i++) {
        const status = await checkRateLimitStatus(identifier, type);
        expect(status.allowed).toBe(true);
        expect(status.remaining).toBe(config.maxRequests - i);
      }
      
      // Next request should be blocked
      const blockedStatus = await checkRateLimitStatus(identifier, type);
      expect(blockedStatus.allowed).toBe(false);
      expect(blockedStatus.remaining).toBe(0);
    });

    it('should enforce stricter limits for guest endpoints', async () => {
      const identifier = testIdentifiers.guest;
      const guestLimit = ENHANCED_RATE_LIMITS.guestEndpoint.maxRequests;
      
      // Simulate guest requests
      let requestCount = 0;
      let allowed = true;
      
      while (allowed && requestCount < 10) {
        const result = await rateLimitServerAction(identifier, 'booking');
        allowed = result.success;
        requestCount++;
      }
      
      // Should be blocked after guest limit
      expect(requestCount - 1).toBe(guestLimit);
    });

    it('should reset limits after time window', async () => {
      const identifier = testIdentifiers.user;
      const type = 'api' as const;
      
      // Exhaust the limit
      for (let i = 0; i < RATE_LIMIT_CONFIGS[type].maxRequests + 1; i++) {
        await checkRateLimitStatus(identifier, type);
      }
      
      // Should be blocked
      let status = await checkRateLimitStatus(identifier, type);
      expect(status.allowed).toBe(false);
      
      // Wait for reset (in real tests, you'd mock time)
      // This is a simplified example
      const resetTime = status.resetAt.getTime() - Date.now();
      
      // After reset, should be allowed again
      // In real tests: jest.advanceTimersByTime(resetTime + 1000);
      // Then check status again
    });
  });

  describe('Webhook Rate Limiting', () => {
    it('should allow higher limits for webhook endpoints', async () => {
      const identifier = testIdentifiers.webhook;
      const webhookLimit = RATE_LIMIT_CONFIGS.webhook.maxRequests;
      
      // Webhooks should have much higher limits
      expect(webhookLimit).toBeGreaterThan(50);
      
      // Test rapid webhook requests
      const results = [];
      for (let i = 0; i < 10; i++) {
        const status = await checkRateLimitStatus(identifier, 'webhook');
        results.push(status.allowed);
      }
      
      // All should be allowed (well under limit)
      expect(results.every(r => r === true)).toBe(true);
    });
  });

  describe('Rate Limit Helpers', () => {
    it('should correctly check if user is rate limited', async () => {
      const identifier = testIdentifiers.user;
      
      // Initially not rate limited
      let limited = await isRateLimited(identifier, 'payment');
      expect(limited).toBe(false);
      
      // Exhaust the limit
      for (let i = 0; i < RATE_LIMIT_CONFIGS.payment.maxRequests + 1; i++) {
        await checkRateLimitStatus(identifier, 'payment');
      }
      
      // Now should be rate limited
      limited = await isRateLimited(identifier, 'payment');
      expect(limited).toBe(true);
    });

    it('should return correct remaining requests count', async () => {
      const identifier = testIdentifiers.user;
      const type = 'booking' as const;
      const maxRequests = RATE_LIMIT_CONFIGS[type].maxRequests;
      
      // Get initial remaining
      let { remaining } = await getRemainingRequests(identifier, type);
      expect(remaining).toBe(maxRequests);
      
      // Make a request
      await checkRateLimitStatus(identifier, type);
      
      // Check remaining decreased
      ({ remaining } = await getRemainingRequests(identifier, type));
      expect(remaining).toBe(maxRequests - 1);
    });
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const health = await checkRateLimitHealth();
      
      expect(health).toHaveProperty('healthy');
      expect(health).toHaveProperty('usingRedis');
      expect(typeof health.healthy).toBe('boolean');
      
      // If Redis is not configured, should fall back to in-memory
      if (!process.env.UPSTASH_REDIS_REST_URL) {
        expect(health.usingRedis).toBe(false);
        expect(health.healthy).toBe(true); // In-memory should always be healthy
      }
    });
  });

  describe('Server Action Rate Limiting', () => {
    it('should rate limit server actions', async () => {
      const userId = 'test-user-456';
      const results = [];
      
      // Make requests up to and beyond the limit
      for (let i = 0; i < RATE_LIMIT_CONFIGS.serverAction.maxRequests + 5; i++) {
        const result = await rateLimitServerAction(userId, 'serverAction');
        results.push(result.success);
      }
      
      // Should have some successes and then failures
      const successCount = results.filter(r => r === true).length;
      expect(successCount).toBe(RATE_LIMIT_CONFIGS.serverAction.maxRequests);
      
      // Last results should be failures
      const lastFive = results.slice(-5);
      expect(lastFive.every(r => r === false)).toBe(true);
    });
  });

  describe('Different Endpoint Types', () => {
    const endpointTests = [
      { type: 'auth' as const, expectedMax: 5 },
      { type: 'payment' as const, expectedMax: 5 },
      { type: 'booking' as const, expectedMax: 10 },
      { type: 'search' as const, expectedMax: 100 },
      { type: 'api' as const, expectedMax: 100 }
    ];

    endpointTests.forEach(({ type, expectedMax }) => {
      it(`should enforce correct limits for ${type} endpoints`, async () => {
        const config = RATE_LIMIT_CONFIGS[type];
        expect(config.maxRequests).toBe(expectedMax);
        
        // Verify configuration is properly loaded
        expect(config).toHaveProperty('windowMs');
        expect(config).toHaveProperty('message');
        expect(config.windowMs).toBeGreaterThan(0);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent requests correctly', async () => {
      const identifier = testIdentifiers.user;
      const type = 'payment' as const;
      
      // Simulate concurrent requests
      const promises = Array(10).fill(null).map(() => 
        checkRateLimitStatus(identifier, type)
      );
      
      const results = await Promise.all(promises);
      const allowedCount = results.filter(r => r.allowed).length;
      
      // Should not exceed the limit even with concurrent requests
      expect(allowedCount).toBeLessThanOrEqual(RATE_LIMIT_CONFIGS[type].maxRequests);
    });

    it('should handle invalid identifiers gracefully', async () => {
      const invalidIdentifiers = ['', null, undefined];
      
      for (const identifier of invalidIdentifiers) {
        // Should use a default identifier and not crash
        const status = await checkRateLimitStatus(identifier as any, 'api');
        expect(status).toHaveProperty('allowed');
        expect(status).toHaveProperty('remaining');
      }
    });

    it('should maintain separate limits for different identifiers', async () => {
      const user1 = 'user:alice';
      const user2 = 'user:bob';
      const type = 'booking' as const;
      
      // Exhaust limit for user1
      for (let i = 0; i <= RATE_LIMIT_CONFIGS[type].maxRequests; i++) {
        await checkRateLimitStatus(user1, type);
      }
      
      // user1 should be blocked
      const user1Status = await checkRateLimitStatus(user1, type);
      expect(user1Status.allowed).toBe(false);
      
      // user2 should still be allowed
      const user2Status = await checkRateLimitStatus(user2, type);
      expect(user2Status.allowed).toBe(true);
      expect(user2Status.remaining).toBe(RATE_LIMIT_CONFIGS[type].maxRequests - 1);
    });
  });
});

describe('Rate Limit Integration Tests', () => {
  // These would be actual integration tests hitting your API endpoints
  
  it('should return 429 status when rate limit exceeded', async () => {
    // Mock or actual API call
    const responses = [];
    
    for (let i = 0; i < 10; i++) {
      // const response = await fetch('/api/stripe/payment', { method: 'POST', ... });
      // responses.push(response.status);
    }
    
    // Expect some 429 responses after limit
    // expect(responses).toContain(429);
  });

  it('should include proper rate limit headers', async () => {
    // Mock or actual API call
    // const response = await fetch('/api/bookings/create', { method: 'POST', ... });
    
    // expect(response.headers.get('X-RateLimit-Limit')).toBeDefined();
    // expect(response.headers.get('X-RateLimit-Remaining')).toBeDefined();
    // expect(response.headers.get('X-RateLimit-Reset')).toBeDefined();
  });

  it('should include Retry-After header on 429 responses', async () => {
    // Exhaust rate limit then make another request
    // const response = await fetch('/api/stripe/payment', { method: 'POST', ... });
    
    // if (response.status === 429) {
    //   expect(response.headers.get('Retry-After')).toBeDefined();
    //   const retryAfter = parseInt(response.headers.get('Retry-After')!);
    //   expect(retryAfter).toBeGreaterThan(0);
    // }
  });
});

// Performance tests
describe('Rate Limit Performance', () => {
  it('should handle high load efficiently', async () => {
    const startTime = Date.now();
    const identifier = 'perf-test-user';
    
    // Simulate high load
    const promises = Array(100).fill(null).map((_, i) => 
      checkRateLimitStatus(`${identifier}-${i}`, 'api')
    );
    
    await Promise.all(promises);
    const duration = Date.now() - startTime;
    
    // Should complete within reasonable time (adjust based on your requirements)
    expect(duration).toBeLessThan(1000); // Less than 1 second for 100 checks
  });

  it('should not leak memory', async () => {
    // This is a conceptual test - in practice you'd use memory profiling tools
    const iterations = 1000;
    
    for (let i = 0; i < iterations; i++) {
      await checkRateLimitStatus(`temp-user-${i}`, 'api');
    }
    
    // In a real test, you'd check memory usage hasn't grown significantly
    // This requires memory profiling tools or heap snapshots
  });
});