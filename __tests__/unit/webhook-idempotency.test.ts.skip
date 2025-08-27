import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { processWebhookWithIdempotency } from '@/lib/webhook-idempotency';
import { db } from '@/db/db';
import { webhookEventsTable } from '@/db/schema';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';

// Mock dependencies
jest.mock('@/db/db', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    transaction: jest.fn(),
  },
}));

jest.mock('stripe', () => {
  const actualStripe = jest.requireActual('stripe');
  return {
    __esModule: true,
    default: jest.fn(() => ({
      webhooks: {
        constructEvent: jest.fn(),
      },
    })),
    Stripe: actualStripe.Stripe,
  };
});

const mockDb = db as jest.Mocked<typeof db>;
const mockStripe = new Stripe('sk_test_mock') as jest.Mocked<Stripe>;

describe('Webhook Idempotency (lib/webhook-idempotency.ts)', () => {
  const testEventId = 'evt_test_idempotency_123';
  const testPaymentIntentId = 'pi_test_idempotency_123';
  const testBookingId = 'booking_test_idempotency_123';

  const mockWebhookPayload: Stripe.Event = {
    id: testEventId,
    object: 'event',
    api_version: '2020-08-27',
    created: 1678886400,
    livemode: false,
    pending_webhooks: 1,
    request: { id: 'req_test', idempotency_key: null },
    type: 'payment_intent.succeeded',
    data: {
      object: {
        id: testPaymentIntentId,
        object: 'payment_intent',
        metadata: {
          bookingId: testBookingId,
          type: 'booking_payment',
        },
      } as Stripe.PaymentIntent,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock for constructEvent to succeed
    (mockStripe.webhooks.constructEvent as jest.Mock).mockReturnValue(mockWebhookPayload);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('processWebhookWithIdempotency', () => {
    it('should process webhook only once even if received multiple times', async () => {
      // Mock db.select to return no existing event for the first call
      mockDb.select.mockImplementationOnce(() => ({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]), // No existing event
      }));

      // Mock db.transaction for the first call
      mockDb.transaction.mockImplementationOnce(async (callback) => {
        const txMock = {
          insert: jest.fn().mockResolvedValue({}),
          update: jest.fn().mockResolvedValue({}),
          select: jest.fn().mockResolvedValue([]), // No existing event within transaction
        };
        return callback(txMock);
      });

      // First call
      const handler = jest.fn().mockResolvedValue('processed');
      const result1 = await processWebhookWithIdempotency(mockWebhookPayload, handler);

      expect(result1.success).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(mockDb.insert).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ eventId: testEventId, status: 'processing' })
      ]));
      expect(mockDb.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }));

      // Mock db.select to return an existing event for the second call
      mockDb.select.mockImplementationOnce(() => ({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([{ eventId: testEventId, status: 'completed' }]), // Event exists
      }));

      // Second call (duplicate)
      const result2 = await processWebhookWithIdempotency(mockWebhookPayload, handler);

      expect(result2.success).toBe(true); // Still success, as it's idempotent
      expect(handler).toHaveBeenCalledTimes(1); // Handler should NOT be called again
      expect(mockDb.insert).toHaveBeenCalledTimes(1); // No new insert
      expect(mockDb.update).toHaveBeenCalledTimes(1); // No new update
    });

    it('should handle concurrent webhook deliveries safely', async () => {
      // Both calls check and find no existing event initially
      mockDb.select.mockImplementation(() => ({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]), // No existing event
      }));

      // Mock db.transaction to simulate unique constraint violation on second concurrent call
      let firstCall = true;
      mockDb.transaction.mockImplementation(async (callback) => {
        if (firstCall) {
          firstCall = false;
          const txMock = {
            insert: jest.fn().mockResolvedValue({}),
            update: jest.fn().mockResolvedValue({}),
            select: jest.fn().mockResolvedValue([]), // No existing event within transaction
          };
          return callback(txMock);
        } else {
          // Simulate unique constraint violation on insert for the second call
          const error = new Error('duplicate key value violates unique constraint "webhook_events_eventId_unique"');
          (error as any).code = '23505'; // PostgreSQL unique violation error code
          throw error;
        }
      });

      const handler = jest.fn().mockResolvedValue('processed');

      // Create two concurrent promises
      const promise1 = processWebhookWithIdempotency(mockWebhookPayload, handler);
      const promise2 = processWebhookWithIdempotency(mockWebhookPayload, handler);

      // Execute concurrently
      const [result1, result2] = await Promise.allSettled([promise1, promise2]);

      // One should succeed, one should fail due to constraint
      expect(result1.status).toBe('fulfilled');
      expect(result2.status).toBe('rejected'); // Or fulfilled with success: false, depending on how the error is caught and returned
      
      // Verify handler was called only once (or at least not twice successfully)
      expect(handler).toHaveBeenCalledTimes(1); 
    });

    it('should mark webhook as failed if handler throws an error', async () => {
      // Mock db.select to return no existing event
      mockDb.select.mockResolvedValue([]);

      // Mock db.transaction to simulate handler throwing an error
      mockDb.transaction.mockImplementationOnce(async (callback) => {
        const txMock = {
          insert: jest.fn().mockResolvedValue({}),
          update: jest.fn().mockResolvedValue({}),
          select: jest.fn().mockResolvedValue([]),
        };
        await callback(txMock); // Call the handler
        throw new Error('Handler processing failed'); // Simulate handler error
      });

      const handler = jest.fn().mockRejectedValue(new Error('Handler processing failed'));
      const result = await processWebhookWithIdempotency(mockWebhookPayload, handler);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Handler processing failed');
      expect(handler).toHaveBeenCalledTimes(1);
      // Verify that webhookEventsTable was updated to 'failed' status
      expect(mockDb.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed', errorMessage: 'Handler processing failed' })
      );
    });

    it('should retry failed webhooks up to the limit', async () => {
      // Simulate initial failure
      mockDb.select.mockResolvedValueOnce([]); // No existing event
      mockDb.transaction.mockImplementationOnce(async (callback) => {
        const txMock = {
          insert: jest.fn().mockResolvedValue({}),
          update: jest.fn().mockResolvedValue({}),
          select: jest.fn().mockResolvedValue([]),
        };
        await callback(txMock);
        throw new Error('Initial handler failure');
      });
      const handler1 = jest.fn().mockRejectedValue(new Error('Initial handler failure'));
      await processWebhookWithIdempotency(mockWebhookPayload, handler1);
      expect(mockDb.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', retryCount: 0 }));

      // Simulate retry 1 (event exists as failed, retryCount 0)
      mockDb.select.mockResolvedValueOnce([{ eventId: testEventId, status: 'failed', retryCount: 0 }]);
      mockDb.transaction.mockImplementationOnce(async (callback) => {
        const txMock = {
          insert: jest.fn().mockResolvedValue({}),
          update: jest.fn().mockResolvedValue({}),
          select: jest.fn().mockResolvedValue([{ eventId: testEventId, status: 'failed', retryCount: 0 }]),
        };
        await callback(txMock);
        throw new Error('Retry 1 handler failure');
      });
      const handler2 = jest.fn().mockRejectedValue(new Error('Retry 1 handler failure'));
      await processWebhookWithIdempotency(mockWebhookPayload, handler2);
      expect(mockDb.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', retryCount: 1 }));

      // Simulate retry 2 (event exists as failed, retryCount 1)
      mockDb.select.mockResolvedValueOnce([{ eventId: testEventId, status: 'failed', retryCount: 1 }]);
      mockDb.transaction.mockImplementationOnce(async (callback) => {
        const txMock = {
          insert: jest.fn().mockResolvedValue({}),
          update: jest.fn().mockResolvedValue({}),
          select: jest.fn().mockResolvedValue([{ eventId: testEventId, status: 'failed', retryCount: 1 }]),
        };
        await callback(txMock);
        throw new Error('Retry 2 handler failure');
      });
      const handler3 = jest.fn().mockRejectedValue(new Error('Retry 2 handler failure'));
      await processWebhookWithIdempotency(mockWebhookPayload, handler3);
      expect(mockDb.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', retryCount: 2 }));

      // Simulate retry 3 (event exists as failed, retryCount 2) - should not retry handler
      mockDb.select.mockResolvedValueOnce([{ eventId: testEventId, status: 'failed', retryCount: 2 }]);
      const handler4 = jest.fn().mockResolvedValue('processed'); // This handler should not be called
      const result = await processWebhookWithIdempotency(mockWebhookPayload, handler4);
      expect(result.success).toBe(true); // It returns success because it's already processed and exceeded retry limit
      expect(handler4).not.toHaveBeenCalled(); // Handler should NOT be called
    });
  });
});

describe('Stripe Webhook Signature Validation', () => {
  const mockBody = JSON.stringify({ id: 'evt_test', type: 'test.event' });
  const mockSignature = 't=123456,v1=mock_signature';
  const mockSecret = 'whsec_test_secret';

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the mock for constructEvent for these tests
    (mockStripe.webhooks.constructEvent as jest.Mock).mockReset();
  });

  it('should throw an error if signature is missing', async () => {
    // Mock the NextRequest headers to simulate missing signature
    const req = { headers: { get: jest.fn((name) => (name === 'Stripe-Signature' ? null : '')) }, text: () => Promise.resolve(mockBody) } as any;
    process.env.STRIPE_WEBHOOK_SECRET = mockSecret;

    // We need to import handleWebhook from the actual route file to test its error handling
    const { POST: handleWebhook } = await import('@/app/api/stripe/webhooks/route');

    const response = await handleWebhook(req);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
    expect(mockStripe.webhooks.constructEvent).not.toHaveBeenCalled();
  });

  it('should throw an error if webhook secret is missing', async () => {
    const req = { headers: { get: jest.fn((name) => (name === 'Stripe-Signature' ? mockSignature : '')) }, text: () => Promise.resolve(mockBody) } as any;
    process.env.STRIPE_WEBHOOK_SECRET = undefined; // Simulate missing secret

    const { POST: handleWebhook } = await import('@/app/api/stripe/webhooks/route');

    const response = await handleWebhook(req);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
    expect(mockStripe.webhooks.constructEvent).not.toHaveBeenCalled();
  });

  it('should throw an error if signature is invalid', async () => {
    (mockStripe.webhooks.constructEvent as jest.Mock).mockImplementation(() => {
      throw new Stripe.errors.StripeSignatureVerificationError('Invalid signature', 'sig_test', 'body_test');
    });

    const req = { headers: { get: jest.fn((name) => (name === 'Stripe-Signature' ? mockSignature : '')) }, text: () => Promise.resolve(mockBody) } as any;
    process.env.STRIPE_WEBHOOK_SECRET = mockSecret;

    const { POST: handleWebhook } = await import('@/app/api/stripe/webhooks/route');

    const response = await handleWebhook(req);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
    expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(mockBody, mockSignature, mockSecret);
  });

  it('should process the webhook if signature is valid', async () => {
    (mockStripe.webhooks.constructEvent as jest.Mock).mockReturnValue(mockWebhookPayload);

    const req = { headers: { get: jest.fn((name) => (name === 'Stripe-Signature' ? mockSignature : '')) }, text: () => Promise.resolve(mockBody) } as any;
    process.env.STRIPE_WEBHOOK_SECRET = mockSecret;

    // Mock db.select and db.transaction for processWebhookWithIdempotency
    mockDb.select.mockResolvedValue([]);
    mockDb.transaction.mockImplementation(async (callback) => {
      const txMock = {
        insert: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        select: jest.fn().mockResolvedValue([]),
      };
      return callback(txMock);
    });

    const { POST: handleWebhook } = await import('@/app/api/stripe/webhooks/route');

    const response = await handleWebhook(req);
    expect(response.status).toBe(200);
    expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(mockBody, mockSignature, mockSecret);
    // Verify that processWebhookWithIdempotency was called
    expect(mockDb.transaction).toHaveBeenCalled();
  });
});
