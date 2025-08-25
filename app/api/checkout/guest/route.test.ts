// Jest test file
import { NextRequest } from 'next/server';
import { POST } from './route';

// Mock dependencies
jest.mock('@/db/db', () => ({
  db: {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn(),
  }
}));

jest.mock('@/lib/stripe-enhanced', () => ({
  createPaymentIntentWithIdempotency: jest.fn(),
}));

jest.mock('@/lib/rate-limit-redis', () => ({
  withRateLimitRedis: (config: any, handler: any) => handler,
}));

describe('Guest Checkout API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/checkout/guest', () => {
    it('should reject invalid email', async () => {
      const request = new NextRequest('http://localhost:3000/api/checkout/guest', {
        method: 'POST',
        body: JSON.stringify({
          guestEmail: 'invalid-email',
          guestName: 'John Doe',
          providerId: '123e4567-e89b-12d3-a456-426614174000',
          serviceId: '123e4567-e89b-12d3-a456-426614174001',
          bookingDate: new Date().toISOString(),
          startTime: '14:00',
          endTime: '15:00',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid email');
    });

    it('should reject invalid time format', async () => {
      const request = new NextRequest('http://localhost:3000/api/checkout/guest', {
        method: 'POST',
        body: JSON.stringify({
          guestEmail: 'guest@example.com',
          guestName: 'John Doe',
          providerId: '123e4567-e89b-12d3-a456-426614174000',
          serviceId: '123e4567-e89b-12d3-a456-426614174001',
          bookingDate: new Date().toISOString(),
          startTime: '25:00', // Invalid hour
          endTime: '15:00',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid time format');
    });

    it('should reject when end time is before start time', async () => {
      const request = new NextRequest('http://localhost:3000/api/checkout/guest', {
        method: 'POST',
        body: JSON.stringify({
          guestEmail: 'guest@example.com',
          guestName: 'John Doe',
          providerId: '123e4567-e89b-12d3-a456-426614174000',
          serviceId: '123e4567-e89b-12d3-a456-426614174001',
          bookingDate: new Date().toISOString(),
          startTime: '15:00',
          endTime: '14:00', // Before start time
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('End time must be after start time');
    });

    it('should validate UUID formats', async () => {
      const request = new NextRequest('http://localhost:3000/api/checkout/guest', {
        method: 'POST',
        body: JSON.stringify({
          guestEmail: 'guest@example.com',
          guestName: 'John Doe',
          providerId: 'not-a-uuid',
          serviceId: '123e4567-e89b-12d3-a456-426614174001',
          bookingDate: new Date().toISOString(),
          startTime: '14:00',
          endTime: '15:00',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid provider ID');
    });

    it('should validate name length', async () => {
      const request = new NextRequest('http://localhost:3000/api/checkout/guest', {
        method: 'POST',
        body: JSON.stringify({
          guestEmail: 'guest@example.com',
          guestName: 'J', // Too short
          providerId: '123e4567-e89b-12d3-a456-426614174000',
          serviceId: '123e4567-e89b-12d3-a456-426614174001',
          bookingDate: new Date().toISOString(),
          startTime: '14:00',
          endTime: '15:00',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Name must be at least 2 characters');
    });

    it('should handle OPTIONS request for CORS', async () => {
      const { OPTIONS } = await import('./route');
      const request = new NextRequest('http://localhost:3000/api/checkout/guest', {
        method: 'OPTIONS',
      });

      const response = await OPTIONS(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
    });
  });
});

describe('Guest Checkout Fee Calculations', () => {
  it('should calculate correct fees for guest users', () => {
    const { calculateFees } = require('@/lib/payments/fee-calculator');
    
    const result = calculateFees({
      baseAmountCents: 10000, // $100
      isGuest: true,
    });

    // Guest pays 110% total
    expect(result.customerTotalCents).toBe(11000);
    // Guest surcharge is 10%
    expect(result.guestSurchargeCents).toBe(1000);
    // Platform gets base fee + surcharge (20% total)
    expect(result.platformTotalRevenueCents).toBe(2000);
    // Provider still gets 90% of base
    expect(result.providerPayoutCents).toBe(9000);
  });

  it('should ensure provider payout is not affected by guest status', () => {
    const { calculateFees } = require('@/lib/payments/fee-calculator');
    
    const guestResult = calculateFees({
      baseAmountCents: 10000,
      isGuest: true,
    });

    const authResult = calculateFees({
      baseAmountCents: 10000,
      isGuest: false,
    });

    // Provider gets same amount regardless of guest status
    expect(guestResult.providerPayoutCents).toBe(authResult.providerPayoutCents);
    expect(guestResult.providerPayoutCents).toBe(9000);
  });

  it('should validate minimum transaction amounts', () => {
    const { calculateFees, MIN_TRANSACTION_CENTS } = require('@/lib/payments/fee-calculator');
    
    expect(() => {
      calculateFees({
        baseAmountCents: MIN_TRANSACTION_CENTS - 1,
        isGuest: true,
      });
    }).toThrow('Minimum transaction amount');
  });
});