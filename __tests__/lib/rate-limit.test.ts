import { rateLimit, checkRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';

describe('Rate Limiting', () => {
  beforeEach(() => {
    // Clear rate limit store before each test
    jest.clearAllMocks();
  });

  describe('rateLimit middleware', () => {
    it('should allow requests within rate limit', async () => {
      const config = RATE_LIMIT_CONFIGS.api;
      const limiter = rateLimit(config);
      
      const mockRequest = new NextRequest('http://localhost:3000/api/test');
      const mockHandler = jest.fn().mockResolvedValue(NextResponse.json({ success: true }));
      
      const response = await limiter(mockRequest, mockHandler);
      
      expect(mockHandler).toHaveBeenCalled();
      expect(response.headers.get('X-RateLimit-Limit')).toBe(config.maxRequests.toString());
    });

    it('should block requests exceeding rate limit', async () => {
      const config = { windowMs: 1000, maxRequests: 2 };
      const limiter = rateLimit(config);
      
      const mockRequest = new NextRequest('http://localhost:3000/api/test');
      const mockHandler = jest.fn().mockResolvedValue(NextResponse.json({ success: true }));
      
      // First two requests should succeed
      await limiter(mockRequest, mockHandler);
      await limiter(mockRequest, mockHandler);
      
      // Third request should be blocked
      const response = await limiter(mockRequest, mockHandler);
      
      expect(mockHandler).toHaveBeenCalledTimes(2);
      expect(response.status).toBe(429);
    });
  });

  describe('checkRateLimit', () => {
    it('should correctly check if rate limit would be exceeded', () => {
      const config = RATE_LIMIT_CONFIGS.payment;
      const identifier = 'test-user-123';
      
      // Should return true for first check
      const firstCheck = checkRateLimit(identifier, config);
      expect(firstCheck).toBe(true);
    });
  });
});