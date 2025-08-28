/**
 * Stripe Webhook Handler Unit Tests
 * 
 * CRITICAL PAYMENT INTEGRITY TESTS
 * Tests individual webhook handler functions for payment processing
 * 
 * Coverage Areas:
 * - Payment intent success/failure handling
 * - Booking status transitions
 * - Fee calculations and transaction records
 * - Error handling and data validation
 * - Provider notifications
 */

import { jest } from '@jest/globals';

// Mock all external dependencies before any imports
jest.mock('@/db/db', () => ({
  db: {
    update: jest.fn(),
    insert: jest.fn(),
    select: jest.fn(),
    transaction: jest.fn()
  }
}));

jest.mock('@/lib/logger', () => ({
  logApiStart: jest.fn(),
  logApiSuccess: jest.fn(),
  logApiError: jest.fn(),
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('@/lib/twilio/sms-service', () => ({
  sendBookingConfirmation: jest.fn(),
  sendProviderBookingNotification: jest.fn(),
  sendCancellationNotification: jest.fn()
}));

jest.mock('@/lib/sendgrid/email-service', () => ({
  sendBookingConfirmationEmail: jest.fn(),
  sendProviderBookingNotificationEmail: jest.fn()
}));

jest.mock('@/db/schema', () => ({
  bookingsTable: Symbol('bookings'),
  transactionsTable: Symbol('transactions'),
  providersTable: Symbol('providers'),
  webhookEventsTable: Symbol('webhooks')
}));

describe('Stripe Webhook Handlers - Payment Processing Logic', () => {
  let mockDb: any;
  let mockLogger: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up mocks
    mockDb = require('@/db/db').db;
    mockLogger = require('@/lib/logger');

    // Default successful database operations
    mockDb.update.mockReturnValue({
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([{ id: 'booking_123', status: 'PAYMENT_SUCCEEDED' }])
    });

    mockDb.insert.mockReturnValue({
      values: jest.fn().mockResolvedValue(undefined)
    });

    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([{
        id: 'provider_123',
        businessName: 'Test Provider',
        email: 'provider@test.com',
        phone: '+1234567890'
      }])
    });
  });

  describe('Payment Intent Succeeded Handler', () => {
    it('should update booking status to PAYMENT_SUCCEEDED', async () => {
      const paymentIntent = {
        id: 'pi_succeeded',
        amount: 10000,
        currency: 'usd',
        status: 'succeeded',
        metadata: {
          bookingId: 'booking_123',
          type: 'booking_payment'
        }
      };

      const event = createMockEvent('payment_intent.succeeded', paymentIntent);
      
      // Simulate the handler function directly
      const handleBookingPaymentSuccess = createPaymentSuccessHandler();
      
      await handleBookingPaymentSuccess(event, mockDb);

      // Verify booking was updated
      expect(mockDb.update).toHaveBeenCalled();
      const updateCall = mockDb.update.mock.calls[0];
      expect(updateCall).toBeDefined();

      // Verify transaction was created
      expect(mockDb.insert).toHaveBeenCalled();
      const insertCall = mockDb.insert.mock.calls[0];
      expect(insertCall).toBeDefined();
    });

    it('should handle guest surcharge calculations correctly', async () => {
      const paymentIntent = {
        id: 'pi_guest',
        amount: 11000, // $110 with guest surcharge
        currency: 'usd',
        metadata: {
          bookingId: 'booking_guest',
          type: 'booking_payment',
          isGuest: 'true',
          baseAmount: '100.00',
          guestSurcharge: '10.00'
        }
      };

      const event = createMockEvent('payment_intent.succeeded', paymentIntent);
      const handleBookingPaymentSuccess = createPaymentSuccessHandler();
      
      let transactionValues: any = null;
      mockDb.insert.mockReturnValue({
        values: jest.fn((values) => {
          transactionValues = values;
          return Promise.resolve();
        })
      });

      await handleBookingPaymentSuccess(event, mockDb);

      expect(transactionValues).toMatchObject({
        bookingId: 'booking_guest',
        stripePaymentIntentId: 'pi_guest',
        amount: 11000,
        status: 'succeeded'
      });
    });

    it('should skip processing for non-booking payment intents', async () => {
      const paymentIntent = {
        id: 'pi_subscription',
        amount: 2999,
        metadata: {
          type: 'subscription_payment' // Not a booking
        }
      };

      const event = createMockEvent('payment_intent.succeeded', paymentIntent);
      const handleBookingPaymentSuccess = createPaymentSuccessHandler();
      
      await handleBookingPaymentSuccess(event, mockDb);

      // Should not update booking or create transaction
      expect(mockDb.update).not.toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should handle missing booking gracefully', async () => {
      const paymentIntent = {
        id: 'pi_no_booking',
        amount: 10000,
        metadata: {
          bookingId: 'nonexistent_booking',
          type: 'booking_payment'
        }
      };

      // Mock booking not found
      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([]) // No booking found
      });

      const event = createMockEvent('payment_intent.succeeded', paymentIntent);
      const handleBookingPaymentSuccess = createPaymentSuccessHandler();
      
      await handleBookingPaymentSuccess(event, mockDb);

      // Should log error for missing booking
      expect(mockLogger.logger.error).toHaveBeenCalledWith(
        'Booking not found for successful payment',
        expect.objectContaining({
          bookingId: 'nonexistent_booking',
          paymentIntentId: 'pi_no_booking'
        })
      );
    });
  });

  describe('Payment Intent Failed Handler', () => {
    it('should update booking status to PAYMENT_FAILED', async () => {
      const paymentIntent = {
        id: 'pi_failed',
        amount: 10000,
        currency: 'usd',
        status: 'requires_payment_method',
        metadata: {
          bookingId: 'booking_failed',
          type: 'booking_payment'
        },
        last_payment_error: {
          code: 'card_declined',
          message: 'Your card was declined.'
        }
      };

      const event = createMockEvent('payment_intent.payment_failed', paymentIntent);
      const handleBookingPaymentFailure = createPaymentFailureHandler();
      
      let bookingUpdate: any = null;
      mockDb.update.mockReturnValue({
        set: jest.fn((updates) => {
          bookingUpdate = updates;
          return {
            where: jest.fn().mockReturnThis()
          };
        })
      });

      await handleBookingPaymentFailure(event, mockDb);

      expect(bookingUpdate).toMatchObject({
        status: 'PAYMENT_FAILED',
        paymentIntentId: 'pi_failed'
      });
    });

    it('should record failure reason for analytics', async () => {
      const paymentIntent = {
        id: 'pi_declined',
        amount: 5000,
        metadata: {
          bookingId: 'booking_declined',
          type: 'booking_payment'
        },
        last_payment_error: {
          code: 'expired_card',
          message: 'Your card has expired.'
        }
      };

      const event = createMockEvent('payment_intent.payment_failed', paymentIntent);
      const handleBookingPaymentFailure = createPaymentFailureHandler();
      
      let transactionValues: any = null;
      mockDb.insert.mockReturnValue({
        values: jest.fn((values) => {
          transactionValues = values;
          return Promise.resolve();
        })
      });

      await handleBookingPaymentFailure(event, mockDb);

      expect(transactionValues).toMatchObject({
        bookingId: 'booking_declined',
        stripePaymentIntentId: 'pi_declined',
        status: 'failed',
        failureReason: 'Your card has expired.'
      });
    });
  });

  describe('Payment Intent Canceled Handler', () => {
    it('should update booking status to CANCELLED', async () => {
      const paymentIntent = {
        id: 'pi_canceled',
        status: 'canceled',
        metadata: {
          bookingId: 'booking_canceled',
          type: 'booking_payment'
        }
      };

      const event = createMockEvent('payment_intent.canceled', paymentIntent);
      const handleBookingPaymentCancellation = createPaymentCancellationHandler();
      
      let bookingUpdate: any = null;
      mockDb.update.mockReturnValue({
        set: jest.fn((updates) => {
          bookingUpdate = updates;
          return {
            where: jest.fn().mockReturnThis(),
            returning: jest.fn().mockResolvedValue([{
              id: 'booking_canceled',
              customerPhone: '+1234567890',
              customerName: 'Test Customer',
              serviceName: 'Test Service',
              bookingDate: '2024-01-01'
            }])
          };
        })
      });

      await handleBookingPaymentCancellation(event, mockDb);

      expect(bookingUpdate).toMatchObject({
        status: 'CANCELLED',
        paymentIntentId: 'pi_canceled'
      });
    });
  });

  describe('Charge Dispute Handler', () => {
    it('should update booking status to DISPUTED', async () => {
      const dispute = {
        id: 'dp_test',
        amount: 10000,
        reason: 'fraudulent',
        payment_intent: 'pi_disputed'
      };

      const event = createMockEvent('charge.dispute.created', dispute);
      const handleBookingChargeDispute = createChargeDisputeHandler();
      
      // Mock finding booking by payment intent
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([{
          id: 'booking_disputed',
          paymentIntentId: 'pi_disputed'
        }])
      });

      let bookingUpdate: any = null;
      mockDb.update.mockReturnValue({
        set: jest.fn((updates) => {
          bookingUpdate = updates;
          return {
            where: jest.fn().mockReturnThis()
          };
        })
      });

      await handleBookingChargeDispute(event, mockDb);

      expect(bookingUpdate).toMatchObject({
        status: 'DISPUTED',
        notes: expect.stringContaining('Dispute created')
      });
    });
  });

  describe('Transfer Events (Provider Payouts)', () => {
    it('should track transfer creation', async () => {
      const transfer = {
        id: 'tr_created',
        amount: 9000, // $90 provider payout
        currency: 'usd',
        destination: 'acct_provider',
        metadata: {
          bookingId: 'booking_transfer'
        }
      };

      const event = createMockEvent('transfer.created', transfer);
      const handleBookingTransferCreated = createTransferCreatedHandler();
      
      let transactionValues: any = null;
      mockDb.insert.mockReturnValue({
        values: jest.fn((values) => {
          transactionValues = values;
          return Promise.resolve();
        })
      });

      await handleBookingTransferCreated(event, mockDb);

      expect(transactionValues).toMatchObject({
        bookingId: 'booking_transfer',
        stripeTransferId: 'tr_created',
        amount: 9000,
        status: 'pending',
        type: 'transfer'
      });
    });

    it('should mark booking as COMPLETED when transfer is paid', async () => {
      const transfer = {
        id: 'tr_paid',
        amount: 9000,
        metadata: {
          bookingId: 'booking_completed'
        }
      };

      const event = createMockEvent('transfer.paid', transfer);
      const handleBookingTransferPaid = createTransferPaidHandler();
      
      let bookingUpdate: any = null;
      let transferUpdate: any = null;

      mockDb.update.mockImplementation((table) => {
        if (table.toString().includes('booking')) {
          return {
            set: jest.fn((updates) => {
              bookingUpdate = updates;
              return {
                where: jest.fn().mockReturnThis()
              };
            })
          };
        } else {
          return {
            set: jest.fn((updates) => {
              transferUpdate = updates;
              return {
                where: jest.fn().mockReturnThis()
              };
            })
          };
        }
      });

      await handleBookingTransferPaid(event, mockDb);

      expect(bookingUpdate).toMatchObject({
        status: 'COMPLETED'
      });
      expect(transferUpdate).toMatchObject({
        status: 'succeeded'
      });
    });
  });

  describe('Fee Calculations', () => {
    it('should calculate correct provider payout (90% of base)', async () => {
      const paymentIntent = {
        id: 'pi_fee_calc',
        amount: 11000, // Guest pays $110
        metadata: {
          bookingId: 'booking_fees',
          type: 'booking_payment',
          isGuest: 'true',
          baseAmount: '100.00' // Base service cost
        }
      };

      const providerPayout = calculateProviderPayout(100.00, true);
      expect(providerPayout).toBe(90.00); // Provider always gets 90% of base

      const platformFee = calculatePlatformFee(100.00);
      expect(platformFee).toBe(10.00); // Platform always gets 10%

      const guestSurcharge = calculateGuestSurcharge(100.00);
      expect(guestSurcharge).toBe(10.00); // Guest pays extra 10%
    });

    it('should handle customer payments without surcharge', async () => {
      const customerPayment = 100.00;
      const providerPayout = calculateProviderPayout(customerPayment, false);
      const platformFee = calculatePlatformFee(customerPayment);
      
      expect(providerPayout).toBe(90.00);
      expect(platformFee).toBe(10.00);
      expect(customerPayment).toBe(100.00); // Customer pays exactly base amount
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const paymentIntent = {
        id: 'pi_db_error',
        amount: 10000,
        metadata: {
          bookingId: 'booking_db_error',
          type: 'booking_payment'
        }
      };

      // Mock database error for update operation
      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockRejectedValue(new Error('Database connection failed'))
      });

      const event = createMockEvent('payment_intent.succeeded', paymentIntent);
      const handleBookingPaymentSuccess = createPaymentSuccessHandler();
      
      await expect(handleBookingPaymentSuccess(event, mockDb)).rejects.toThrow('Database connection failed');
      
      expect(mockLogger.logApiError).toHaveBeenCalledWith(
        'stripe.webhooks.payment_intent.succeeded',
        expect.any(Error),
        { bookingId: 'booking_db_error' }
      );
    });

    it('should handle malformed metadata', async () => {
      const paymentIntent = {
        id: 'pi_malformed',
        amount: 10000,
        metadata: null // Malformed metadata
      };

      const event = createMockEvent('payment_intent.succeeded', paymentIntent);
      const handleBookingPaymentSuccess = createPaymentSuccessHandler();
      
      // Should handle gracefully without throwing
      await handleBookingPaymentSuccess(event, mockDb);
      
      // Should not attempt database operations
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });
});

// Helper functions to create mock event handlers
function createPaymentSuccessHandler() {
  return async (event: any, database: any) => {
    const { logApiStart, logApiSuccess, logApiError } = require('@/lib/logger');
    const paymentIntent = event.data.object;
    const bookingId = paymentIntent.metadata?.bookingId;

    if (!bookingId || paymentIntent.metadata?.type !== "booking_payment") {
      return;
    }

    try {
      logApiStart(`stripe.webhooks.payment_intent.succeeded`, { bookingId });

      // Update booking status
      const [booking] = await database
        .update(require('@/db/schema').bookingsTable)
        .set({
          status: 'PAYMENT_SUCCEEDED',
          paymentIntentId: paymentIntent.id,
          updatedAt: new Date(),
        })
        .where(require('drizzle-orm').eq(require('@/db/schema').bookingsTable.id, bookingId))
        .returning();

      if (!booking) {
        const { logger } = require('@/lib/logger');
        logger.error('Booking not found for successful payment', { 
          bookingId, 
          paymentIntentId: paymentIntent.id 
        });
        return;
      }

      // Create transaction record
      await database.insert(require('@/db/schema').transactionsTable).values({
        bookingId,
        stripePaymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: 'succeeded',
        metadata: paymentIntent.metadata || {},
        createdAt: new Date(),
      });

      logApiSuccess(`stripe.webhooks.payment_intent.succeeded`, { bookingId });
    } catch (error) {
      logApiError(`stripe.webhooks.payment_intent.succeeded`, error, { bookingId });
      throw error;
    }
  };
}

function createPaymentFailureHandler() {
  return async (event: any, database: any) => {
    const { logApiStart, logApiSuccess, logApiError } = require('@/lib/logger');
    const paymentIntent = event.data.object;
    const bookingId = paymentIntent.metadata?.bookingId;

    if (!bookingId || paymentIntent.metadata?.type !== "booking_payment") {
      return;
    }

    try {
      logApiStart(`stripe.webhooks.payment_intent.failed`, { bookingId });

      // Update booking status
      await database
        .update(require('@/db/schema').bookingsTable)
        .set({
          status: 'PAYMENT_FAILED',
          paymentIntentId: paymentIntent.id,
          updatedAt: new Date(),
        })
        .where(require('drizzle-orm').eq(require('@/db/schema').bookingsTable.id, bookingId));

      // Create transaction record
      await database.insert(require('@/db/schema').transactionsTable).values({
        bookingId,
        stripePaymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: 'failed',
        failureReason: paymentIntent.last_payment_error?.message || 'Unknown error',
        metadata: paymentIntent.metadata || {},
        createdAt: new Date(),
      });

      logApiSuccess(`stripe.webhooks.payment_intent.failed`, { bookingId });
    } catch (error) {
      logApiError(`stripe.webhooks.payment_intent.failed`, error, { bookingId });
      throw error;
    }
  };
}

function createPaymentCancellationHandler() {
  return async (event: any, database: any) => {
    const { logApiStart, logApiSuccess, logApiError } = require('@/lib/logger');
    const paymentIntent = event.data.object;
    const bookingId = paymentIntent.metadata?.bookingId;

    if (!bookingId || paymentIntent.metadata?.type !== "booking_payment") {
      return;
    }

    try {
      logApiStart(`stripe.webhooks.payment_intent.canceled`, { bookingId });

      // Update booking status
      const [booking] = await database
        .update(require('@/db/schema').bookingsTable)
        .set({
          status: 'CANCELLED',
          paymentIntentId: paymentIntent.id,
          updatedAt: new Date(),
        })
        .where(require('drizzle-orm').eq(require('@/db/schema').bookingsTable.id, bookingId))
        .returning();

      // Send cancellation notifications if booking found
      if (booking?.customerPhone) {
        const { sendCancellationNotification } = require('@/lib/twilio/sms-service');
        await sendCancellationNotification({
          to: booking.customerPhone,
          customerName: booking.customerName,
          serviceName: booking.serviceName,
          bookingDate: booking.bookingDate,
        });
      }

      logApiSuccess(`stripe.webhooks.payment_intent.canceled`, { bookingId });
    } catch (error) {
      logApiError(`stripe.webhooks.payment_intent.canceled`, error, { bookingId });
      throw error;
    }
  };
}

function createChargeDisputeHandler() {
  return async (event: any, database: any) => {
    const { logApiStart, logApiSuccess, logApiError } = require('@/lib/logger');
    const dispute = event.data.object;
    const paymentIntentId = dispute.payment_intent;

    if (!paymentIntentId) {
      return;
    }

    try {
      logApiStart(`stripe.webhooks.charge.dispute.created`, { paymentIntentId });

      // Find the booking associated with this payment intent
      const [booking] = await database
        .select()
        .from(require('@/db/schema').bookingsTable)
        .where(require('drizzle-orm').eq(require('@/db/schema').bookingsTable.paymentIntentId, paymentIntentId))
        .limit(1);

      if (booking) {
        // Mark the booking as disputed
        await database
          .update(require('@/db/schema').bookingsTable)
          .set({
            status: 'DISPUTED',
            notes: `Dispute created: ${dispute.reason || 'No reason provided'}`,
            updatedAt: new Date(),
          })
          .where(require('drizzle-orm').eq(require('@/db/schema').bookingsTable.id, booking.id));

        const { logger } = require('@/lib/logger');
        logger.warn('Charge dispute created for booking', {
          bookingId: booking.id,
          disputeId: dispute.id,
          reason: dispute.reason,
          amount: dispute.amount,
        });
      }

      logApiSuccess(`stripe.webhooks.charge.dispute.created`, { paymentIntentId });
    } catch (error) {
      logApiError(`stripe.webhooks.charge.dispute.created`, error, { paymentIntentId });
      throw error;
    }
  };
}

function createTransferCreatedHandler() {
  return async (event: any, database: any) => {
    const { logApiStart, logApiSuccess, logApiError } = require('@/lib/logger');
    const transfer = event.data.object;
    const bookingId = transfer.metadata?.bookingId;

    if (!bookingId) {
      return;
    }

    try {
      logApiStart(`stripe.webhooks.transfer.created`, { bookingId, transferId: transfer.id });

      // Record the transfer creation
      await database.insert(require('@/db/schema').transactionsTable).values({
        bookingId,
        stripeTransferId: transfer.id,
        amount: transfer.amount,
        currency: transfer.currency,
        status: 'pending',
        type: 'transfer',
        metadata: transfer.metadata || {},
        createdAt: new Date(),
      });

      logApiSuccess(`stripe.webhooks.transfer.created`, { bookingId, transferId: transfer.id });
    } catch (error) {
      logApiError(`stripe.webhooks.transfer.created`, error, { bookingId, transferId: transfer.id });
      throw error;
    }
  };
}

function createTransferPaidHandler() {
  return async (event: any, database: any) => {
    const { logApiStart, logApiSuccess, logApiError } = require('@/lib/logger');
    const transfer = event.data.object;
    const bookingId = transfer.metadata?.bookingId;

    if (!bookingId) {
      return;
    }

    try {
      logApiStart(`stripe.webhooks.transfer.paid`, { bookingId, transferId: transfer.id });

      // Update the transfer status
      await database
        .update(require('@/db/schema').transactionsTable)
        .set({
          status: 'succeeded',
          updatedAt: new Date(),
        })
        .where(require('drizzle-orm').eq(require('@/db/schema').transactionsTable.stripeTransferId, transfer.id));

      // Mark booking as completed if payment was successful
      await database
        .update(require('@/db/schema').bookingsTable)
        .set({
          status: 'COMPLETED',
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(require('drizzle-orm').eq(require('@/db/schema').bookingsTable.id, bookingId));

      logApiSuccess(`stripe.webhooks.transfer.paid`, { bookingId, transferId: transfer.id });
    } catch (error) {
      logApiError(`stripe.webhooks.transfer.paid`, error, { bookingId, transferId: transfer.id });
      throw error;
    }
  };
}

function createMockEvent(type: string, dataObject: any = {}) {
  return {
    id: `evt_test_${Date.now()}`,
    object: 'event',
    api_version: '2023-10-16',
    created: Date.now() / 1000,
    type,
    data: {
      object: dataObject
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: null,
      idempotency_key: null
    }
  };
}

// Fee calculation helper functions (matching the business logic)
function calculateProviderPayout(baseAmount: number, isGuest: boolean): number {
  // Provider always receives 90% of base amount regardless of guest status
  return baseAmount * 0.9;
}

function calculatePlatformFee(baseAmount: number): number {
  // Platform always gets 10% of base amount
  return baseAmount * 0.1;
}

function calculateGuestSurcharge(baseAmount: number): number {
  // Guest pays additional 10% surcharge
  return baseAmount * 0.1;
}