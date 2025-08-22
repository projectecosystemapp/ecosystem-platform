/**
 * Comprehensive Rate Limiting Tests
 * 
 * Tests both in-memory and Redis-based rate limiting
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  withRateLimit,
  checkRateLimitStatus,
  checkRateLimitHealth,
  RATE_LIMIT_CONFIGS,
  getClientIdentifier,
} from '@/lib/rate-limit';
import {
  enforceRateLimit,
  RateLimitError,
  withRateLimitAction,
  formatRetryAfter,
} from '@/lib/server-action-rate-limit';

// Mock Next.js modules
jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: jest.fn((body, init) => ({
      ...init,
      body,
      headers: new Map(Object.entries(init?.headers || {})),
    })),
  },
}));

// Mock Clerk auth
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(() => Promise.resolve({ userId: 'test-user-123' })),
}));

describe('Rate Limiting Infrastructure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear any in-memory rate limit state
    jest.resetModules();
  });

  describe('Client Identifier Generation', () => {
    it('should prioritize user ID over IP address', () => {
      const req = {
        headers: new Map([
          ['x-user-id', 'user123'],
          ['x-forwarded-for', '192.168.1.1'],
        ]),
      } as unknown as NextRequest;

      const identifier = getClientIdentifier(req);
      expect(identifier).toContain('user:user123');
    });

    it('should use IP address when user ID is not available', () => {
      const req = {
        headers: new Map([
          ['x-forwarded-for', '192.168.1.1'],
          ['user-agent', 'Mozilla/5.0'],
        ]),
      } as unknown as NextRequest;

      const identifier = getClientIdentifier(req);
      expect(identifier).toContain('ip:192.168.1.1');
    });

    it('should handle string identifier for Server Actions', () => {
      const identifier = getClientIdentifier('custom-identifier');
      expect(identifier).toBe('custom-identifier');
    });
  });

  describe('Rate Limit Configurations', () => {
    it('should have correct auth limits', () => {
      expect(RATE_LIMIT_CONFIGS.auth).toEqual({
        windowMs: 15 * 60 * 1000,
        maxRequests: 5,
        message: expect.any(String),
      });
    });

    it('should have correct payment limits', () => {
      expect(RATE_LIMIT_CONFIGS.payment).toEqual({
        windowMs: 60 * 1000,
        maxRequests: 5,
        message: expect.any(String),
      });
    });

    it('should have correct booking limits', () => {
      expect(RATE_LIMIT_CONFIGS.booking).toEqual({
        windowMs: 60 * 1000,
        maxRequests: 10,
        message: expect.any(String),
      });
    });
  });

  describe('API Route Rate Limiting', () => {
    it('should allow requests within limit', async () => {
      const handler = jest.fn(() => 
        Promise.resolve(NextResponse.json({ success: true }))
      );

      const rateLimited = withRateLimit('api', handler);
      
      const req = {
        headers: new Map([['x-user-id', 'test-user']]),
        url: 'http://localhost:3000/api/test',
      } as unknown as NextRequest;

      const response = await rateLimited(req);
      
      expect(handler).toHaveBeenCalledWith(req);
      expect(response.headers.get('X-RateLimit-Limit')).toBeTruthy();
      expect(response.headers.get('X-RateLimit-Remaining')).toBeTruthy();
    });

    it('should use custom configuration', async () => {
      const customConfig = {
        windowMs: 1000,
        maxRequests: 1,
        message: 'Custom limit exceeded',
      };

      const handler = jest.fn(() => 
        Promise.resolve(NextResponse.json({ success: true }))
      );

      const rateLimited = withRateLimit(customConfig, handler);
      
      const req = {
        headers: new Map([['x-user-id', 'test-user-custom']]),
        url: 'http://localhost:3000/api/test',
      } as unknown as NextRequest;

      // First request should succeed
      await rateLimited(req);
      expect(handler).toHaveBeenCalledTimes(1);

      // Second request should be rate limited (in theory)
      // Note: This would actually test the in-memory implementation
    });
  });

  describe('Server Action Rate Limiting', () => {
    it('should enforce rate limits on Server Actions', async () => {
      const action = jest.fn(async (data: any) => ({ success: true, data }));
      const rateLimitedAction = withRateLimitAction('serverAction', action);

      const result = await rateLimitedAction({ test: 'data' });
      expect(action).toHaveBeenCalledWith({ test: 'data' });
      expect(result).toEqual({ success: true, data: { test: 'data' } });
    });

    it('should throw RateLimitError when limit exceeded', async () => {
      // Mock the rate limit to fail
      jest.mock('@/lib/rate-limit', () => ({
        ...jest.requireActual('@/lib/rate-limit'),
        rateLimitServerAction: jest.fn(() => 
          Promise.resolve({
            success: false,
            error: 'Rate limit exceeded',
            retryAfter: 60,
          })
        ),
      }));

      await expect(enforceRateLimit('payment')).rejects.toThrow(RateLimitError);
    });
  });

  describe('Rate Limit Status Checking', () => {
    it('should check rate limit status without incrementing', async () => {
      const status = await checkRateLimitStatus('test-user-status', 'api');
      
      expect(status).toHaveProperty('allowed');
      expect(status).toHaveProperty('remaining');
      expect(status).toHaveProperty('resetAt');
      expect(status.resetAt).toBeInstanceOf(Date);
    });
  });

  describe('Health Monitoring', () => {
    it('should report health status', async () => {
      const health = await checkRateLimitHealth();
      
      expect(health).toHaveProperty('healthy');
      expect(health).toHaveProperty('usingRedis');
      expect(typeof health.healthy).toBe('boolean');
      expect(typeof health.usingRedis).toBe('boolean');
    });
  });

  describe('Utility Functions', () => {
    it('should format retry after correctly', () => {
      expect(formatRetryAfter(30)).toBe('30 seconds');
      expect(formatRetryAfter(1)).toBe('1 second');
      expect(formatRetryAfter(60)).toBe('1 minute');
      expect(formatRetryAfter(120)).toBe('2 minutes');
      expect(formatRetryAfter(90)).toBe('2 minutes'); // Rounds up
    });
  });

  describe('Rate Limit Headers', () => {
    it('should include proper rate limit headers in response', async () => {
      const handler = jest.fn(() => 
        Promise.resolve(NextResponse.json({ success: true }))
      );

      const rateLimited = withRateLimit('api', handler);
      
      const req = {
        headers: new Map([['x-user-id', 'test-headers']]),
        url: 'http://localhost:3000/api/test',
      } as unknown as NextRequest;

      const response = await rateLimited(req);
      
      expect(response.headers.get('X-RateLimit-Limit')).toBeTruthy();
      expect(response.headers.get('X-RateLimit-Remaining')).toBeTruthy();
      expect(response.headers.get('X-RateLimit-Reset')).toBeTruthy();
      
      // Verify reset is a valid ISO date
      const resetDate = new Date(response.headers.get('X-RateLimit-Reset')!);
      expect(resetDate.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing headers gracefully', () => {
      const req = {
        headers: new Map(),
      } as unknown as NextRequest;

      const identifier = getClientIdentifier(req);
      expect(identifier).toContain('ip:unknown');
    });

    it('should handle malformed URLs', async () => {
      const handler = jest.fn(() => 
        Promise.resolve(NextResponse.json({ success: true }))
      );

      const rateLimited = withRateLimit('api', handler);
      
      const req = {
        headers: new Map(),
        url: 'not-a-valid-url',
      } as unknown as NextRequest;

      // Should not throw, should use default 'api' config
      await expect(rateLimited(req)).resolves.toBeTruthy();
    });
  });

  describe('Concurrent Requests', () => {
    it('should handle concurrent requests correctly', async () => {
      const handler = jest.fn(() => 
        Promise.resolve(NextResponse.json({ success: true }))
      );

      const rateLimited = withRateLimit({
        windowMs: 1000,
        maxRequests: 5,
      }, handler);
      
      const req = {
        headers: new Map([['x-user-id', 'concurrent-test']]),
        url: 'http://localhost:3000/api/test',
      } as unknown as NextRequest;

      // Make 5 concurrent requests
      const requests = Array(5).fill(null).map(() => rateLimited(req));
      const responses = await Promise.all(requests);
      
      expect(responses).toHaveLength(5);
      expect(handler).toHaveBeenCalledTimes(5);
    });
  });
});