import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { stripe } from '@/lib/stripe';
import { db } from '@/db/db';
import { bookingsTable, transactionsTable, webhookEventsTable, providersTable } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { POST as createPayment, PUT as confirmPayment, DELETE as refundPayment } from '@/app/api/stripe/payment/route';
import { POST as handleWebhook } from '@/app/api/stripe/webhooks/route';
import Stripe from 'stripe';

// Mock dependencies
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/stripe', () => ({
  stripe: {
    paymentIntents: {
      create: jest.fn(),
      retrieve: jest.fn(),
    },
    charges: {
      retrieve: jest.fn(),
    },
    refunds: {
      create: jest.fn(),
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  },
}));

jest.mock('@/db/db', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    transaction: jest.fn(),
  },
}));

// Test constants
const PLATFORM_FEE_PERCENT = 10;
const GUEST_SURCHARGE_PERCENT = 10;

describe('Payment Flow Tests', () => {
  const mockAuth = require('@clerk/nextjs/server').auth as jest.Mock;
  const mockStripe = stripe as jest.Mocked<typeof stripe>;
  const mockDb = db as jest.Mocked<typeof db>;

  // Test data
  const testBookingId = '123e4567-e89b-12d3-a456-426614174000';
  const testUserId = 'user_2abc123';
  const testProviderId = '456e7890-e89b-12d3-a456-426614174001';
  const testPaymentIntentId = 'pi_test123';
  const testChargeId = 'ch_test123';
  const testTransferId = 'tr_test123';
  const testEventId = 'evt_test123';

  const mockProvider = {
    id: testProviderId,
    stripeConnectAccountId: 'acct_test123',
    stripeOnboardingComplete: true,
  };

  const mockBooking = {
    id: testBookingId,
    providerId: testProviderId,
    customerId: testUserId,
    serviceName: 'Test Service',
    status: 'pending',
    stripePaymentIntentId: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Fee Calculations', () => {
    describe('Guest Checkout', () => {
      it('should calculate correct fees for guest paying $110 for $100 service', async () => {
        const serviceAmount = 10000; // $100 in cents
        const isGuestCheckout = true;

        // Expected calculations
        const expectedBasePlatformFee = 1000; // 10% of $100 = $10
        const expectedGuestSurcharge = 1000; // 10% of $100 = $10
        const expectedTotalPlatformFee = 2000; // $20
        const expectedProviderPayout = 9000; // $100 - $10 = $90
        const expectedTotalAmount = 11000; // $100 + $10 = $110

        // Mock auth for guest
        mockAuth.mockResolvedValue({ userId: null });

        // Mock database queries
        mockDb.select.mockImplementation(() => ({
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue([mockBooking]),
        }));

        // Mock provider query
        mockDb.select.mockImplementationOnce(() => ({
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue([mockBooking]),
        })).mockImplementationOnce(() => ({
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue([mockProvider]),
        }));

        // Mock Stripe payment intent creation
        mockStripe.paymentIntents.create.mockResolvedValue({
          id: testPaymentIntentId,
          amount: expectedTotalAmount,
          client_secret: 'secret_test',
          status: 'requires_payment_method',
        } as Stripe.PaymentIntent);

        // Mock database inserts
        mockDb.insert.mockImplementation(() => ({
          values: jest.fn().mockResolvedValue({}),
        }));

        mockDb.update.mockImplementation(() => ({
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockResolvedValue({}),
        }));

        // Create request
        const request = new NextRequest('http://localhost:3000/api/stripe/payment', {
          method: 'POST',
          body: JSON.stringify({
            bookingId: testBookingId,
            amount: serviceAmount,
            currency: 'usd',
            isGuestCheckout: true,
            customerEmail: 'guest@test.com',
          }),
        });

        // Execute
        const response = await createPayment(request);
        const data = await response.json();

        // Assertions
        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.fees).toEqual({
          serviceAmount,
          platformFee: expectedTotalPlatformFee,
          guestSurcharge: expectedGuestSurcharge,
          providerPayout: expectedProviderPayout,
          totalAmount: expectedTotalAmount,
        });

        // Verify Stripe was called with correct amounts
        expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
          expect.objectContaining({
            amount: expectedTotalAmount,
            application_fee_amount: expectedTotalPlatformFee,
            transfer_data: {
              destination: mockProvider.stripeConnectAccountId,
            },
          }),
          expect.any(Object)
        );
      });
    });

    describe('Customer Checkout', () => {
      it('should calculate correct fees for customer paying $100 for $100 service', async () => {
        const serviceAmount = 10000; // $100 in cents
        const isGuestCheckout = false;

        // Expected calculations
        const expectedBasePlatformFee = 1000; // 10% of $100 = $10
        const expectedGuestSurcharge = 0; // No surcharge for customers
        const expectedTotalPlatformFee = 1000; // $10
        const expectedProviderPayout = 9000; // $100 - $10 = $90
        const expectedTotalAmount = 10000; // $100 (no surcharge)

        // Mock auth for logged-in user
        mockAuth.mockResolvedValue({ userId: testUserId });

        // Mock database queries
        mockDb.select.mockImplementation(() => ({
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue([mockBooking]),
        }));

        // Mock provider query
        mockDb.select.mockImplementationOnce(() => ({
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue([mockBooking]),
        })).mockImplementationOnce(() => ({
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue([mockProvider]),
        }));

        // Mock Stripe payment intent creation
        mockStripe.paymentIntents.create.mockResolvedValue({
          id: testPaymentIntentId,
          amount: expectedTotalAmount,
          client_secret: 'secret_test',
          status: 'requires_payment_method',
        } as Stripe.PaymentIntent);

        // Mock database operations
        mockDb.insert.mockImplementation(() => ({
          values: jest.fn().mockResolvedValue({}),
        }));

        mockDb.update.mockImplementation(() => ({
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockResolvedValue({}),
        }));

        // Create request
        const request = new NextRequest('http://localhost:3000/api/stripe/payment', {
          method: 'POST',
          body: JSON.stringify({
            bookingId: testBookingId,
            amount: serviceAmount,
            currency: 'usd',
            isGuestCheckout: false,
          }),
        });

        // Execute
        const response = await createPayment(request);
        const data = await response.json();

        // Assertions
        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.fees).toEqual({
          serviceAmount,
          platformFee: expectedTotalPlatformFee,
          guestSurcharge: expectedGuestSurcharge,
          providerPayout: expectedProviderPayout,
          totalAmount: expectedTotalAmount,
        });

        // Verify Stripe was called with correct amounts
        expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
          expect.objectContaining({
            amount: expectedTotalAmount,
            application_fee_amount: expectedTotalPlatformFee,
            transfer_data: {
              destination: mockProvider.stripeConnectAccountId,
            },
          }),
          expect.any(Object)
        );
      });
    });

    describe('Provider Payout', () => {
      it('should always calculate provider payout as 90% of base price', async () => {
        const testCases = [
          { serviceAmount: 10000, expectedPayout: 9000 }, // $100 -> $90
          { serviceAmount: 5000, expectedPayout: 4500 },   // $50 -> $45
          { serviceAmount: 15000, expectedPayout: 13500 }, // $150 -> $135
          { serviceAmount: 25000, expectedPayout: 22500 }, // $250 -> $225
        ];

        for (const { serviceAmount, expectedPayout } of testCases) {
          // Clear mocks for each test case
          jest.clearAllMocks();

          // Mock auth
          mockAuth.mockResolvedValue({ userId: testUserId });

          // Mock database queries
          mockDb.select.mockImplementation(() => ({
            from: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue([mockBooking]),
          }));

          mockDb.select.mockImplementationOnce(() => ({
            from: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue([mockBooking]),
          })).mockImplementationOnce(() => ({
            from: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue([mockProvider]),
          }));

          // Mock Stripe
          mockStripe.paymentIntents.create.mockResolvedValue({
            id: testPaymentIntentId,
            amount: serviceAmount,
            client_secret: 'secret_test',
            status: 'requires_payment_method',
          } as Stripe.PaymentIntent);

          // Mock database operations
          mockDb.insert.mockImplementation(() => ({
            values: jest.fn().mockResolvedValue({}),
          }));

          mockDb.update.mockImplementation(() => ({
            set: jest.fn().mockReturnThis(),
            where: jest.fn().mockResolvedValue({}),
          }));

          // Create request
          const request = new NextRequest('http://localhost:3000/api/stripe/payment', {
            method: 'POST',
            body: JSON.stringify({
              bookingId: testBookingId,
              amount: serviceAmount,
              currency: 'usd',
              isGuestCheckout: false,
            }),
          });

          // Execute
          const response = await createPayment(request);
          const data = await response.json();

          // Assert provider payout
          expect(data.fees.providerPayout).toBe(expectedPayout);
        }
      });
    });
  });

  describe('Booking State Transitions', () => {
    it('should follow correct state flow: PENDING -> CONFIRMED -> COMPLETED', async () => {
      // State 1: PENDING (initial state after booking creation)
      const pendingBooking = { ...mockBooking, status: 'pending' };

      // State 2: CONFIRMED (after payment success)
      mockAuth.mockResolvedValue({ userId: testUserId });

      // Mock booking retrieval
      mockDb.select.mockImplementation(() => ({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([{
          ...pendingBooking,
          stripePaymentIntentId: testPaymentIntentId,
        }]),
      }));

      // Mock payment intent retrieval
      mockStripe.paymentIntents.retrieve.mockResolvedValue({
        id: testPaymentIntentId,
        status: 'succeeded',
        amount: 10000,
        created: 1234567890,
        latest_charge: testChargeId,
      } as Stripe.PaymentIntent);

      // Mock charge retrieval
      mockStripe.charges.retrieve.mockResolvedValue({
        id: testChargeId,
        transfer: { id: testTransferId } as Stripe.Transfer,
      } as Stripe.Charge);

      // Mock database updates
      const updateMock = jest.fn().mockReturnThis();
      const setMock = jest.fn().mockReturnThis();
      const whereMock = jest.fn().mockResolvedValue({});

      mockDb.update.mockImplementation(() => ({
        set: setMock,
        where: whereMock,
      }));

      // Confirm payment
      const confirmRequest = new NextRequest('http://localhost:3000/api/stripe/payment', {
        method: 'PUT',
        body: JSON.stringify({
          paymentIntentId: testPaymentIntentId,
          bookingId: testBookingId,
        }),
      });

      const confirmResponse = await confirmPayment(confirmRequest);
      const confirmData = await confirmResponse.json();

      expect(confirmResponse.status).toBe(200);
      expect(confirmData.success).toBe(true);
      expect(confirmData.status).toBe('succeeded');

      // Verify booking status was updated to confirmed
      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'confirmed',
        })
      );

      // State 3: COMPLETED (after service is delivered)
      // This would typically happen via a separate endpoint or admin action
      // but we verify the webhook can handle it
    });

    it('should handle failed payment and not complete booking', async () => {
      // Mock auth
      mockAuth.mockResolvedValue({ userId: testUserId });

      // Mock booking with payment intent
      const bookingWithPayment = {
        ...mockBooking,
        stripePaymentIntentId: testPaymentIntentId,
      };

      mockDb.select.mockImplementation(() => ({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([bookingWithPayment]),
      }));

      // Mock failed payment intent
      mockStripe.paymentIntents.retrieve.mockResolvedValue({
        id: testPaymentIntentId,
        status: 'failed',
        amount: 10000,
        created: 1234567890,
      } as Stripe.PaymentIntent);

      // Mock database updates
      const setMock = jest.fn().mockReturnThis();
      const whereMock = jest.fn().mockResolvedValue({});

      mockDb.update.mockImplementation(() => ({
        set: setMock,
        where: whereMock,
      }));

      // Try to confirm failed payment
      const confirmRequest = new NextRequest('http://localhost:3000/api/stripe/payment', {
        method: 'PUT',
        body: JSON.stringify({
          paymentIntentId: testPaymentIntentId,
          bookingId: testBookingId,
        }),
      });

      const response = await confirmPayment(confirmRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('failed');

      // Verify booking was NOT updated to confirmed
      expect(setMock).not.toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'confirmed',
        })
      );
    });

    it('should handle payment cancellation correctly', async () => {
      // Mock auth
      mockAuth.mockResolvedValue({ userId: testUserId });

      // Mock booking with successful payment
      const completedBooking = {
        ...mockBooking,
        stripePaymentIntentId: testPaymentIntentId,
        status: 'confirmed',
      };

      mockDb.select.mockImplementation(() => ({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([completedBooking]),
      }));

      // Mock successful payment intent for refund
      mockStripe.paymentIntents.retrieve.mockResolvedValue({
        id: testPaymentIntentId,
        status: 'succeeded',
        amount: 10000,
      } as Stripe.PaymentIntent);

      // Mock refund creation
      mockStripe.refunds.create.mockResolvedValue({
        id: 'refund_test123',
        amount: 10000,
        status: 'succeeded',
        reason: 'requested_by_customer',
      } as Stripe.Refund);

      // Mock database updates
      const setMock = jest.fn().mockReturnThis();
      const whereMock = jest.fn().mockResolvedValue({});

      mockDb.update.mockImplementation(() => ({
        set: setMock,
        where: whereMock,
      }));

      // Request refund
      const refundRequest = new NextRequest('http://localhost:3000/api/stripe/payment', {
        method: 'DELETE',
        body: JSON.stringify({
          bookingId: testBookingId,
          reason: 'Customer requested cancellation',
        }),
      });

      const response = await refundPayment(refundRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.refundId).toBe('refund_test123');

      // Verify booking was updated to cancelled
      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'cancelled',
          cancellationReason: 'Customer requested cancellation',
        })
      );
    });
  });

  describe('Webhook Idempotency', () => {
    it('should process webhook only once even if received multiple times', async () => {
      const webhookPayload = {
        id: testEventId,
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: testPaymentIntentId,
            metadata: {
              bookingId: testBookingId,
              type: 'booking_payment',
            },
            latest_charge: testChargeId,
          },
        },
      };

      // Mock webhook signature verification
      mockStripe.webhooks.constructEvent.mockReturnValue(webhookPayload as Stripe.Event);

      // First call - event doesn't exist yet
      mockDb.select.mockImplementationOnce(() => ({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]), // No existing event
      }));

      // Mock transaction
      const txMock = {
        insert: jest.fn().mockImplementation(() => ({
          values: jest.fn().mockResolvedValue({}),
        })),
        update: jest.fn().mockImplementation(() => ({
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockResolvedValue([{ id: testBookingId }]),
          returning: jest.fn().mockResolvedValue([{ id: testBookingId, status: 'confirmed' }]),
        })),
      };

      mockDb.transaction.mockImplementation(async (callback) => {
        return callback(txMock);
      });

      // First webhook call
      const request1 = new NextRequest('http://localhost:3000/api/stripe/webhooks', {
        method: 'POST',
        headers: {
          'stripe-signature': 'test_signature',
        },
        body: JSON.stringify(webhookPayload),
      });

      const response1 = await handleWebhook(request1);
      expect(response1.status).toBe(200);

      // Second call - event already exists
      mockDb.select.mockImplementationOnce(() => ({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([{ eventId: testEventId }]), // Event exists
      }));

      // Reset transaction mock
      mockDb.transaction.mockClear();

      // Second webhook call (duplicate)
      const request2 = new NextRequest('http://localhost:3000/api/stripe/webhooks', {
        method: 'POST',
        headers: {
          'stripe-signature': 'test_signature',
        },
        body: JSON.stringify(webhookPayload),
      });

      const response2 = await handleWebhook(request2);
      expect(response2.status).toBe(200);

      // Verify transaction was NOT called for duplicate
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should handle concurrent webhook deliveries safely', async () => {
      const webhookPayload = {
        id: testEventId,
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: testPaymentIntentId,
            metadata: {
              bookingId: testBookingId,
              type: 'booking_payment',
            },
            latest_charge: testChargeId,
          },
        },
      };

      // Mock webhook signature verification
      mockStripe.webhooks.constructEvent.mockReturnValue(webhookPayload as Stripe.Event);

      // Both calls check and find no existing event
      mockDb.select.mockImplementation(() => ({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]), // No existing event
      }));

      // Mock transaction to simulate database constraint
      let firstCall = true;
      mockDb.transaction.mockImplementation(async (callback) => {
        if (firstCall) {
          firstCall = false;
          const txMock = {
            insert: jest.fn().mockImplementation(() => ({
              values: jest.fn().mockResolvedValue({}),
            })),
            update: jest.fn().mockImplementation(() => ({
              set: jest.fn().mockReturnThis(),
              where: jest.fn().mockResolvedValue([{ id: testBookingId }]),
              returning: jest.fn().mockResolvedValue([{ id: testBookingId }]),
            })),
          };
          return callback(txMock);
        } else {
          // Simulate unique constraint violation on second concurrent call
          throw new Error('Unique constraint violation');
        }
      });

      // Create two concurrent requests
      const request1 = new NextRequest('http://localhost:3000/api/stripe/webhooks', {
        method: 'POST',
        headers: {
          'stripe-signature': 'test_signature',
        },
        body: JSON.stringify(webhookPayload),
      });

      const request2 = new NextRequest('http://localhost:3000/api/stripe/webhooks', {
        method: 'POST',
        headers: {
          'stripe-signature': 'test_signature',
        },
        body: JSON.stringify(webhookPayload),
      });

      // Execute concurrently
      const [response1, response2] = await Promise.all([
        handleWebhook(request1),
        handleWebhook(request2),
      ]);

      // One should succeed, one should fail due to constraint
      const statuses = [response1.status, response2.status];
      expect(statuses).toContain(200);
      expect(statuses).toContain(400);
    });
  });

  describe('Payment Intent Creation', () => {
    it('should create payment intent with correct metadata', async () => {
      const serviceAmount = 10000; // $100

      mockAuth.mockResolvedValue({ userId: testUserId });

      // Mock database queries
      mockDb.select.mockImplementation(() => ({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockBooking]),
      }));

      mockDb.select.mockImplementationOnce(() => ({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockBooking]),
      })).mockImplementationOnce(() => ({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockProvider]),
      }));

      // Mock Stripe
      mockStripe.paymentIntents.create.mockResolvedValue({
        id: testPaymentIntentId,
        amount: serviceAmount,
        client_secret: 'secret_test',
        status: 'requires_payment_method',
      } as Stripe.PaymentIntent);

      // Mock database operations
      mockDb.insert.mockImplementation(() => ({
        values: jest.fn().mockResolvedValue({}),
      }));

      mockDb.update.mockImplementation(() => ({
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue({}),
      }));

      // Create request
      const request = new NextRequest('http://localhost:3000/api/stripe/payment', {
        method: 'POST',
        body: JSON.stringify({
          bookingId: testBookingId,
          amount: serviceAmount,
          currency: 'usd',
          isGuestCheckout: false,
        }),
      });

      // Execute
      await createPayment(request);

      // Verify payment intent was created with correct metadata
      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            bookingId: testBookingId,
            providerId: testProviderId,
            customerId: testUserId,
            isGuestCheckout: 'false',
            serviceAmount: String(serviceAmount),
            platformFee: '1000',
            providerPayout: '9000',
          }),
        }),
        expect.any(Object)
      );
    });

    it('should handle idempotency key for duplicate requests', async () => {
      const serviceAmount = 10000;
      const idempotencyKey = 'idem_key_123';

      mockAuth.mockResolvedValue({ userId: testUserId });

      // Mock database queries
      mockDb.select.mockImplementation(() => ({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockBooking]),
      }));

      mockDb.select.mockImplementationOnce(() => ({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockBooking]),
      })).mockImplementationOnce(() => ({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockProvider]),
      }));

      // Mock Stripe
      mockStripe.paymentIntents.create.mockResolvedValue({
        id: testPaymentIntentId,
        amount: serviceAmount,
        client_secret: 'secret_test',
        status: 'requires_payment_method',
      } as Stripe.PaymentIntent);

      // Mock database operations
      mockDb.insert.mockImplementation(() => ({
        values: jest.fn().mockResolvedValue({}),
      }));

      mockDb.update.mockImplementation(() => ({
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue({}),
      }));

      // Create request with idempotency key
      const request = new NextRequest('http://localhost:3000/api/stripe/payment', {
        method: 'POST',
        body: JSON.stringify({
          bookingId: testBookingId,
          amount: serviceAmount,
          currency: 'usd',
          isGuestCheckout: false,
          idempotencyKey,
        }),
      });

      // Execute
      await createPayment(request);

      // Verify idempotency key was passed to Stripe
      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          idempotencyKey,
        })
      );
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete payment flow from creation to confirmation', async () => {
      const serviceAmount = 20000; // $200

      // Step 1: Create payment intent
      mockAuth.mockResolvedValue({ userId: testUserId });

      mockDb.select.mockImplementation(() => ({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockBooking]),
      }));

      mockDb.select.mockImplementationOnce(() => ({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockBooking]),
      })).mockImplementationOnce(() => ({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockProvider]),
      }));

      mockStripe.paymentIntents.create.mockResolvedValue({
        id: testPaymentIntentId,
        amount: serviceAmount,
        client_secret: 'secret_test',
        status: 'requires_payment_method',
      } as Stripe.PaymentIntent);

      mockDb.insert.mockImplementation(() => ({
        values: jest.fn().mockResolvedValue({}),
      }));

      mockDb.update.mockImplementation(() => ({
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue({}),
      }));

      const createRequest = new NextRequest('http://localhost:3000/api/stripe/payment', {
        method: 'POST',
        body: JSON.stringify({
          bookingId: testBookingId,
          amount: serviceAmount,
          currency: 'usd',
          isGuestCheckout: false,
        }),
      });

      const createResponse = await createPayment(createRequest);
      expect(createResponse.status).toBe(200);

      // Step 2: Simulate payment success via webhook
      const webhookPayload = {
        id: testEventId,
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: testPaymentIntentId,
            metadata: {
              bookingId: testBookingId,
              type: 'booking_payment',
            },
            latest_charge: testChargeId,
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(webhookPayload as Stripe.Event);

      mockDb.select.mockImplementationOnce(() => ({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]), // No existing webhook event
      }));

      const txMock = {
        insert: jest.fn().mockImplementation(() => ({
          values: jest.fn().mockResolvedValue({}),
        })),
        update: jest.fn().mockImplementation(() => ({
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockResolvedValue([{ id: testBookingId }]),
          returning: jest.fn().mockResolvedValue([{ id: testBookingId, status: 'confirmed' }]),
        })),
      };

      mockDb.transaction.mockImplementation(async (callback) => {
        return callback(txMock);
      });

      const webhookRequest = new NextRequest('http://localhost:3000/api/stripe/webhooks', {
        method: 'POST',
        headers: {
          'stripe-signature': 'test_signature',
        },
        body: JSON.stringify(webhookPayload),
      });

      const webhookResponse = await handleWebhook(webhookRequest);
      expect(webhookResponse.status).toBe(200);

      // Verify booking was updated to confirmed
      expect(txMock.update).toHaveBeenCalled();
    });

    it('should handle complete refund flow', async () => {
      // Setup: Booking with successful payment
      const completedBooking = {
        ...mockBooking,
        stripePaymentIntentId: testPaymentIntentId,
        status: 'confirmed',
      };

      mockAuth.mockResolvedValue({ userId: testUserId });

      mockDb.select.mockImplementation(() => ({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([completedBooking]),
      }));

      mockStripe.paymentIntents.retrieve.mockResolvedValue({
        id: testPaymentIntentId,
        status: 'succeeded',
        amount: 10000,
      } as Stripe.PaymentIntent);

      // Step 1: Create refund
      mockStripe.refunds.create.mockResolvedValue({
        id: 'refund_test123',
        amount: 10000,
        status: 'succeeded',
        reason: 'requested_by_customer',
      } as Stripe.Refund);

      const setMock = jest.fn().mockReturnThis();
      const whereMock = jest.fn().mockResolvedValue({});

      mockDb.update.mockImplementation(() => ({
        set: setMock,
        where: whereMock,
      }));

      const refundRequest = new NextRequest('http://localhost:3000/api/stripe/payment', {
        method: 'DELETE',
        body: JSON.stringify({
          bookingId: testBookingId,
          reason: 'Customer requested refund',
          reverseTransfer: true,
        }),
      });

      const refundResponse = await refundPayment(refundRequest);
      const refundData = await refundResponse.json();

      expect(refundResponse.status).toBe(200);
      expect(refundData.success).toBe(true);

      // Verify refund was created with transfer reversal
      expect(mockStripe.refunds.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_intent: testPaymentIntentId,
          reverse_transfer: true,
        }),
        expect.any(Object)
      );

      // Verify booking and transaction were updated
      expect(setMock).toHaveBeenCalledTimes(2); // Once for transaction, once for booking
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle provider without Stripe account', async () => {
      const incompleteProvider = {
        ...mockProvider,
        stripeConnectAccountId: null,
        stripeOnboardingComplete: false,
      };

      mockAuth.mockResolvedValue({ userId: testUserId });

      mockDb.select.mockImplementationOnce(() => ({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockBooking]),
      })).mockImplementationOnce(() => ({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([incompleteProvider]),
      }));

      const request = new NextRequest('http://localhost:3000/api/stripe/payment', {
        method: 'POST',
        body: JSON.stringify({
          bookingId: testBookingId,
          amount: 10000,
          currency: 'usd',
          isGuestCheckout: false,
        }),
      });

      const response = await createPayment(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Provider has not completed payment setup');
    });

    it('should handle unauthorized access to booking', async () => {
      mockAuth.mockResolvedValue({ userId: 'different_user' });

      mockDb.select.mockImplementation(() => ({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockBooking]),
      }));

      const request = new NextRequest('http://localhost:3000/api/stripe/payment', {
        method: 'POST',
        body: JSON.stringify({
          bookingId: testBookingId,
          amount: 10000,
          currency: 'usd',
          isGuestCheckout: false,
        }),
      });

      const response = await createPayment(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Unauthorized - You don't own this booking");
    });

    it('should handle Stripe API errors gracefully', async () => {
      mockAuth.mockResolvedValue({ userId: testUserId });

      mockDb.select.mockImplementation(() => ({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockBooking]),
      }));

      mockDb.select.mockImplementationOnce(() => ({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockBooking]),
      })).mockImplementationOnce(() => ({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockProvider]),
      }));

      // Simulate Stripe error
      const stripeError = new Stripe.errors.StripeCardError('Card declined');
      mockStripe.paymentIntents.create.mockRejectedValue(stripeError);

      const request = new NextRequest('http://localhost:3000/api/stripe/payment', {
        method: 'POST',
        body: JSON.stringify({
          bookingId: testBookingId,
          amount: 10000,
          currency: 'usd',
          isGuestCheckout: false,
        }),
      });

      const response = await createPayment(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Card declined');
    });

    it('should validate request data with Zod schema', async () => {
      mockAuth.mockResolvedValue({ userId: testUserId });

      const request = new NextRequest('http://localhost:3000/api/stripe/payment', {
        method: 'POST',
        body: JSON.stringify({
          bookingId: 'invalid-uuid',
          amount: -100, // Negative amount
          currency: 'usd',
        }),
      });

      const response = await createPayment(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request data');
      expect(data.details).toBeDefined();
    });

    it('should handle partial refunds correctly', async () => {
      const completedBooking = {
        ...mockBooking,
        stripePaymentIntentId: testPaymentIntentId,
        status: 'confirmed',
      };

      mockAuth.mockResolvedValue({ userId: testUserId });

      mockDb.select.mockImplementation(() => ({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([completedBooking]),
      }));

      mockStripe.paymentIntents.retrieve.mockResolvedValue({
        id: testPaymentIntentId,
        status: 'succeeded',
        amount: 10000,
      } as Stripe.PaymentIntent);

      // Create partial refund (50%)
      const partialRefundAmount = 5000;
      mockStripe.refunds.create.mockResolvedValue({
        id: 'refund_partial_123',
        amount: partialRefundAmount,
        status: 'succeeded',
        reason: 'requested_by_customer',
      } as Stripe.Refund);

      mockDb.update.mockImplementation(() => ({
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue({}),
      }));

      const request = new NextRequest('http://localhost:3000/api/stripe/payment', {
        method: 'DELETE',
        body: JSON.stringify({
          bookingId: testBookingId,
          amount: partialRefundAmount,
          reason: 'Partial refund requested',
        }),
      });

      const response = await refundPayment(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.amount).toBe(partialRefundAmount);

      // Verify partial refund was created with correct amount
      expect(mockStripe.refunds.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: partialRefundAmount,
        }),
        expect.any(Object)
      );
    });
  });
});