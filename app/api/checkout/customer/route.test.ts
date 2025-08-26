/**
 * Tests for Customer Checkout API
 * 
 * Verifies that authenticated customers can complete purchases
 * without guest surcharge fees.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { POST } from './route';

// Mock dependencies
jest.mock('@clerk/nextjs/server');
jest.mock('@/db/db');
jest.mock('@/lib/rate-limit-redis');
jest.mock('@/lib/stripe-enhanced');
jest.mock('@/lib/payments/fee-calculator');

const mockAuth = jest.requireMock('@clerk/nextjs/server');
const mockDb = jest.requireMock('@/db/db');
const mockRateLimit = jest.requireMock('@/lib/rate-limit-redis');
const mockStripe = jest.requireMock('@/lib/stripe-enhanced');
const mockFeeCalculator = jest.requireMock('@/lib/payments/fee-calculator');

describe('/api/checkout/customer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock rate limiter to pass through
    mockRateLimit.withRateLimitRedis.mockImplementation(
      (config: any, handler: any) => handler
    );
    
    // Mock fee calculator
    mockFeeCalculator.calculateFees.mockReturnValue({
      customerTotalCents: 10000, // $100.00 - no guest surcharge
      guestSurchargeCents: 0, // No surcharge for authenticated users
      platformFeeCents: 1000, // $10.00 platform fee
      platformTotalRevenueCents: 1000, // Only platform fee
      providerPayoutCents: 9000, // $90.00 provider payout
      displayAmounts: {
        customerTotal: '$100.00',
        guestSurcharge: '$0.00',
        platformFee: '$10.00',
        platformTotalRevenue: '$10.00',
        providerPayout: '$90.00',
        baseAmount: '$100.00'
      }
    });
    
    mockFeeCalculator.dollarsToCents.mockReturnValue(10000);
    mockFeeCalculator.MIN_TRANSACTION_CENTS = 50;
  });

  it('should successfully process authenticated customer checkout', async () => {
    // Mock authentication
    mockAuth.auth.mockResolvedValue({ userId: 'user_123' });
    
    // Mock database queries
    mockDb.db.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([
            {
              id: 'customer_123',
              userId: 'user_123',
              firstName: 'John',
              lastName: 'Doe',
              email: 'john@example.com',
              role: 'customer'
            }
          ])
        })
      })
    });
    
    // Mock provider query (second call)
    mockDb.db.select
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([
              {
                id: 'customer_123',
                userId: 'user_123',
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
                role: 'customer'
              }
            ])
          })
        })
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([
              {
                id: 'provider_123',
                businessName: 'Test Provider',
                stripeConnectAccountId: 'acct_123',
                stripeOnboardingComplete: true,
                commissionRate: '0.10',
                isActive: true
              }
            ])
          })
        })
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([
              {
                id: 'service_123',
                name: 'Test Service',
                price: '100.00',
                duration: 60,
                isActive: true
              }
            ])
          })
        })
      });
    
    // Mock booking creation
    mockDb.db.insert.mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([
          {
            id: 'booking_123',
            providerId: 'provider_123',
            customerId: 'customer_123',
            status: 'pending'
          }
        ])
      })
    });
    
    // Mock transaction creation
    mockDb.db.insert.mockReturnValueOnce({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([{ id: 'booking_123' }])
      })
    }).mockReturnValueOnce({
      values: jest.fn().mockResolvedValue(undefined)
    });
    
    // Mock Stripe payment intent
    mockStripe.createPaymentIntentWithIdempotency.mockResolvedValue({
      id: 'pi_123',
      client_secret: 'pi_123_secret_456'
    });
    
    // Create test request
    const request = new NextRequest('http://localhost:3000/api/checkout/customer', {
      method: 'POST',
      body: JSON.stringify({
        providerId: 'provider_123',
        serviceId: 'service_123',
        bookingDate: '2024-12-01T10:00:00Z',
        startTime: '10:00',
        endTime: '11:00',
        customerNotes: 'Test booking'
      })
    });
    
    const response = await POST(request);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.clientSecret).toBe('pi_123_secret_456');
    expect(data.paymentIntentId).toBe('pi_123');
    expect(data.bookingId).toBeDefined();
    expect(data.confirmationCode).toBeDefined();
    
    // Verify no guest surcharge for authenticated users
    expect(data.fees.totalAmount).toBe('$100.00'); // Same as base amount
    expect(data.fees.baseAmount).toBe('$100.00');
    expect(data.fees.platformFee).toBe('$10.00');
    expect(data.fees.providerPayout).toBe('$90.00');
    
    // Verify customer info is returned
    expect(data.customerInfo).toEqual({
      customerId: 'customer_123',
      customerName: 'John Doe',
      customerEmail: 'john@example.com'
    });
    
    // Verify Stripe payment intent was created with correct metadata
    expect(mockStripe.createPaymentIntentWithIdempotency).toHaveBeenCalledWith({
      amount: 10000, // $100.00 - no guest surcharge
      currency: 'usd',
      stripeConnectAccountId: 'acct_123',
      platformFeeAmount: 1000, // Only platform fee, no surcharge
      bookingId: expect.any(String),
      metadata: expect.objectContaining({
        type: 'customer_booking',
        isGuest: 'false',
        customerId: 'customer_123',
        customerEmail: 'john@example.com',
        customerName: 'John Doe'
      })
    });
  });

  it('should reject unauthenticated requests', async () => {
    // Mock no authentication
    mockAuth.auth.mockResolvedValue({ userId: null });
    
    const request = new NextRequest('http://localhost:3000/api/checkout/customer', {
      method: 'POST',
      body: JSON.stringify({
        providerId: 'provider_123',
        serviceId: 'service_123',
        bookingDate: '2024-12-01T10:00:00Z',
        startTime: '10:00',
        endTime: '11:00'
      })
    });
    
    const response = await POST(request);
    const data = await response.json();
    
    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Authentication required');
  });

  it('should validate time slots correctly', async () => {
    mockAuth.auth.mockResolvedValue({ userId: 'user_123' });
    
    const request = new NextRequest('http://localhost:3000/api/checkout/customer', {
      method: 'POST',
      body: JSON.stringify({
        providerId: 'provider_123',
        serviceId: 'service_123',
        bookingDate: '2024-12-01T10:00:00Z',
        startTime: '11:00', // End time before start time
        endTime: '10:00',
        customerNotes: 'Invalid time slot'
      })
    });
    
    const response = await POST(request);
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('End time must be after start time');
  });

  it('should handle missing customer profile', async () => {
    mockAuth.auth.mockResolvedValue({ userId: 'user_123' });
    
    // Mock empty customer profile query
    mockDb.db.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([]) // No customer profile found
        })
      })
    });
    
    const request = new NextRequest('http://localhost:3000/api/checkout/customer', {
      method: 'POST',
      body: JSON.stringify({
        providerId: 'provider_123',
        serviceId: 'service_123',
        bookingDate: '2024-12-01T10:00:00Z',
        startTime: '10:00',
        endTime: '11:00'
      })
    });
    
    const response = await POST(request);
    const data = await response.json();
    
    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Customer profile not found');
  });

  it('should handle inactive providers', async () => {
    mockAuth.auth.mockResolvedValue({ userId: 'user_123' });
    
    // Mock customer profile (first query)
    mockDb.db.select
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([
              {
                id: 'customer_123',
                userId: 'user_123',
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
                role: 'customer'
              }
            ])
          })
        })
      })
      // Mock inactive provider (second query)
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([
              {
                id: 'provider_123',
                businessName: 'Test Provider',
                stripeConnectAccountId: 'acct_123',
                stripeOnboardingComplete: true,
                commissionRate: '0.10',
                isActive: false // Inactive provider
              }
            ])
          })
        })
      });
    
    const request = new NextRequest('http://localhost:3000/api/checkout/customer', {
      method: 'POST',
      body: JSON.stringify({
        providerId: 'provider_123',
        serviceId: 'service_123',
        bookingDate: '2024-12-01T10:00:00Z',
        startTime: '10:00',
        endTime: '11:00'
      })
    });
    
    const response = await POST(request);
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Provider is not currently accepting bookings');
  });

  it('should verify fee calculations for authenticated users (no guest surcharge)', async () => {
    mockAuth.auth.mockResolvedValue({ userId: 'user_123' });
    
    // Mock all required database queries
    mockDb.db.select
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([
              {
                id: 'customer_123',
                userId: 'user_123',
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
                role: 'customer'
              }
            ])
          })
        })
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([
              {
                id: 'provider_123',
                businessName: 'Test Provider',
                stripeConnectAccountId: 'acct_123',
                stripeOnboardingComplete: true,
                commissionRate: '0.10',
                isActive: true
              }
            ])
          })
        })
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([
              {
                id: 'service_123',
                name: 'Test Service',
                price: '100.00',
                duration: 60,
                isActive: true
              }
            ])
          })
        })
      });
    
    mockDb.db.insert.mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([{ id: 'booking_123' }])
      })
    });
    
    mockStripe.createPaymentIntentWithIdempotency.mockResolvedValue({
      id: 'pi_123',
      client_secret: 'pi_123_secret_456'
    });
    
    const request = new NextRequest('http://localhost:3000/api/checkout/customer', {
      method: 'POST',
      body: JSON.stringify({
        providerId: 'provider_123',
        serviceId: 'service_123',
        bookingDate: '2024-12-01T10:00:00Z',
        startTime: '10:00',
        endTime: '11:00'
      })
    });
    
    await POST(request);
    
    // Verify fee calculation called with isGuest: false
    expect(mockFeeCalculator.calculateFees).toHaveBeenCalledWith({
      baseAmountCents: 10000,
      isGuest: false, // Key verification: no guest surcharge for authenticated users
      providerCommissionRate: 0.10
    });
  });
});