/**
 * Webhook Idempotency Test Suite
 * 
 * Ensures webhook events are processed exactly once,
 * even when delivered multiple times by Stripe
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { processWebhookWithIdempotency } from '@/lib/webhook-idempotency';
import { db } from '@/db/db';
import { webhookEventsTable } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Mock database for testing
vi.mock('@/db/db', () => ({
  db: {
    transaction: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    select: vi.fn()
  }
}));

describe('Webhook Idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('First Event Delivery', () => {
    it('should process new events successfully', async () => {
      const mockEvent = {
        id: 'evt_new_123',
        type: 'payment_intent.succeeded',
        created: Date.now() / 1000,
        data: {
          object: {
            id: 'pi_test',
            amount: 10000,
            metadata: { bookingId: 'booking_123' }
          }
        }
      };

      // Mock database to return no existing event
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([])
      });

      // Mock transaction success
      (db.transaction as any).mockImplementation(async (callback: any) => {
        const mockTx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnThis(),
            returning: vi.fn().mockResolvedValue([{ id: 1 }])
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis()
          })
        };
        return callback(mockTx);
      });

      const handler = vi.fn().mockResolvedValue({ success: true });
      const result = await processWebhookWithIdempotency(mockEvent as any, handler);

      expect(result.success).toBe(true);
      expect(handler).toHaveBeenCalledOnce();
    });

    it('should store event details in database', async () => {
      const mockEvent = {
        id: 'evt_store_123',
        type: 'charge.succeeded',
        created: Date.now() / 1000,
        data: { object: { id: 'ch_test' } }
      };

      const insertMock = vi.fn();
      (db.transaction as any).mockImplementation(async (callback: any) => {
        const mockTx = {
          insert: vi.fn().mockReturnValue({
            values: insertMock.mockReturnThis(),
            returning: vi.fn().mockResolvedValue([{ id: 1 }])
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis()
          })
        };
        await callback(mockTx);
      });

      await processWebhookWithIdempotency(mockEvent as any, vi.fn());

      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          stripeEventId: 'evt_store_123',
          eventType: 'charge.succeeded',
          status: expect.stringMatching(/processing|completed/)
        })
      );
    });
  });

  describe('Duplicate Event Delivery', () => {
    it('should skip processing duplicate events', async () => {
      const mockEvent = {
        id: 'evt_duplicate_123',
        type: 'payment_intent.succeeded',
        created: Date.now() / 1000,
        data: { object: { id: 'pi_test' } }
      };

      // Mock database to return existing completed event
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{
          id: 1,
          stripeEventId: 'evt_duplicate_123',
          status: 'completed',
          processedAt: new Date()
        }])
      });

      const handler = vi.fn();
      const result = await processWebhookWithIdempotency(mockEvent as any, handler);

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle concurrent duplicate deliveries', async () => {
      const mockEvent = {
        id: 'evt_concurrent_123',
        type: 'payment_intent.succeeded',
        created: Date.now() / 1000,
        data: { object: { id: 'pi_test' } }
      };

      let firstCall = true;
      (db.select as any).mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockImplementation(() => {
          if (firstCall) {
            firstCall = false;
            return Promise.resolve([]);
          }
          // Second call finds the event already processing
          return Promise.resolve([{
            id: 1,
            stripeEventId: 'evt_concurrent_123',
            status: 'processing'
          }]);
        })
      }));

      // Simulate two concurrent calls
      const handler = vi.fn().mockResolvedValue({ success: true });
      const [result1, result2] = await Promise.all([
        processWebhookWithIdempotency(mockEvent as any, handler),
        processWebhookWithIdempotency(mockEvent as any, handler)
      ]);

      // Only one should process
      const processedCount = [result1, result2].filter(r => !r.skipped).length;
      expect(processedCount).toBeLessThanOrEqual(1);
    });
  });

  describe('Failed Event Processing', () => {
    it('should mark events as failed on handler error', async () => {
      const mockEvent = {
        id: 'evt_fail_123',
        type: 'payment_intent.succeeded',
        created: Date.now() / 1000,
        data: { object: { id: 'pi_test' } }
      };

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([])
      });

      const updateMock = vi.fn();
      (db.transaction as any).mockImplementation(async (callback: any) => {
        const mockTx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnThis(),
            returning: vi.fn().mockResolvedValue([{ id: 1 }])
          }),
          update: vi.fn().mockReturnValue({
            set: updateMock.mockReturnThis(),
            where: vi.fn().mockReturnThis()
          })
        };
        try {
          await callback(mockTx);
        } catch (e) {
          // Expected error
        }
      });

      const handler = vi.fn().mockRejectedValue(new Error('Processing failed'));
      const result = await processWebhookWithIdempotency(mockEvent as any, handler);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should allow retry of failed events', async () => {
      const mockEvent = {
        id: 'evt_retry_123',
        type: 'payment_intent.succeeded',
        created: Date.now() / 1000,
        data: { object: { id: 'pi_test' } }
      };

      // First call returns failed event
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{
          id: 1,
          stripeEventId: 'evt_retry_123',
          status: 'failed',
          attemptCount: 1
        }])
      });

      (db.transaction as any).mockImplementation(async (callback: any) => {
        const mockTx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis()
          })
        };
        return callback(mockTx);
      });

      const handler = vi.fn().mockResolvedValue({ success: true });
      const result = await processWebhookWithIdempotency(mockEvent as any, handler);

      expect(handler).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should respect max retry attempts', async () => {
      const mockEvent = {
        id: 'evt_maxretry_123',
        type: 'payment_intent.succeeded',
        created: Date.now() / 1000,
        data: { object: { id: 'pi_test' } }
      };

      // Return event that has exceeded max retries
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{
          id: 1,
          stripeEventId: 'evt_maxretry_123',
          status: 'failed',
          attemptCount: 5, // Max retries reached
          maxAttempts: 5
        }])
      });

      const handler = vi.fn();
      const result = await processWebhookWithIdempotency(mockEvent as any, handler);

      expect(handler).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error).toContain('max retries');
    });
  });

  describe('Event Expiration', () => {
    it('should reject events older than 7 days', async () => {
      const oldTimestamp = (Date.now() / 1000) - (8 * 24 * 60 * 60); // 8 days ago
      const mockEvent = {
        id: 'evt_old_123',
        type: 'payment_intent.succeeded',
        created: oldTimestamp,
        data: { object: { id: 'pi_test' } }
      };

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([])
      });

      const handler = vi.fn();
      const result = await processWebhookWithIdempotency(mockEvent as any, handler);

      expect(handler).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error).toContain('expired');
    });

    it('should process recent events', async () => {
      const recentTimestamp = (Date.now() / 1000) - (60 * 60); // 1 hour ago
      const mockEvent = {
        id: 'evt_recent_123',
        type: 'payment_intent.succeeded',
        created: recentTimestamp,
        data: { object: { id: 'pi_test' } }
      };

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([])
      });

      (db.transaction as any).mockImplementation(async (callback: any) => {
        const mockTx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnThis(),
            returning: vi.fn().mockResolvedValue([{ id: 1 }])
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis()
          })
        };
        return callback(mockTx);
      });

      const handler = vi.fn().mockResolvedValue({ success: true });
      const result = await processWebhookWithIdempotency(mockEvent as any, handler);

      expect(handler).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('Database Transaction Handling', () => {
    it('should rollback on partial failure', async () => {
      const mockEvent = {
        id: 'evt_rollback_123',
        type: 'payment_intent.succeeded',
        created: Date.now() / 1000,
        data: { object: { id: 'pi_test' } }
      };

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([])
      });

      let transactionRolledBack = false;
      (db.transaction as any).mockImplementation(async (callback: any) => {
        const mockTx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnThis(),
            returning: vi.fn().mockResolvedValue([{ id: 1 }])
          }),
          update: vi.fn().mockImplementation(() => {
            throw new Error('Update failed');
          }),
          rollback: () => {
            transactionRolledBack = true;
          }
        };
        
        try {
          return await callback(mockTx);
        } catch (error) {
          mockTx.rollback();
          throw error;
        }
      });

      const handler = vi.fn().mockResolvedValue({ success: true });
      const result = await processWebhookWithIdempotency(mockEvent as any, handler);

      expect(transactionRolledBack).toBe(true);
      expect(result.success).toBe(false);
    });

    it('should maintain consistency across related tables', async () => {
      const mockEvent = {
        id: 'evt_consistency_123',
        type: 'payment_intent.succeeded',
        created: Date.now() / 1000,
        data: {
          object: {
            id: 'pi_test',
            metadata: {
              bookingId: 'booking_123',
              type: 'booking_payment'
            }
          }
        }
      };

      const updates: string[] = [];
      (db.transaction as any).mockImplementation(async (callback: any) => {
        const mockTx = {
          insert: vi.fn().mockImplementation((table: any) => {
            updates.push('webhook_event_inserted');
            return {
              values: vi.fn().mockReturnThis(),
              returning: vi.fn().mockResolvedValue([{ id: 1 }])
            };
          }),
          update: vi.fn().mockImplementation((table: any) => {
            updates.push('booking_updated');
            updates.push('transaction_updated');
            return {
              set: vi.fn().mockReturnThis(),
              where: vi.fn().mockReturnThis()
            };
          })
        };
        return callback(mockTx);
      });

      const handler = vi.fn().mockImplementation(async (event: any, tx: any) => {
        // Simulate updating booking and transaction
        await tx.update('bookings').set({ status: 'confirmed' }).where('id', 'booking_123');
        await tx.update('transactions').set({ status: 'completed' }).where('bookingId', 'booking_123');
        return { success: true };
      });

      await processWebhookWithIdempotency(mockEvent as any, handler);

      // All updates should happen in the same transaction
      expect(updates).toContain('webhook_event_inserted');
      expect(updates).toContain('booking_updated');
      expect(updates).toContain('transaction_updated');
    });
  });

  describe('Event Type Filtering', () => {
    it('should only process relevant event types', async () => {
      const irrelevantEvent = {
        id: 'evt_irrelevant_123',
        type: 'customer.created', // Not a payment event
        created: Date.now() / 1000,
        data: { object: { id: 'cus_test' } }
      };

      const handler = vi.fn();
      const result = await processWebhookWithIdempotency(irrelevantEvent as any, handler);

      // Should skip processing for irrelevant events
      expect(result.skipped).toBe(true);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should process all payment-related events', async () => {
      const paymentEvents = [
        'payment_intent.succeeded',
        'payment_intent.payment_failed',
        'charge.succeeded',
        'charge.failed',
        'charge.dispute.created',
        'transfer.created',
        'transfer.paid',
        'refund.created'
      ];

      for (const eventType of paymentEvents) {
        const mockEvent = {
          id: `evt_${eventType}_123`,
          type: eventType,
          created: Date.now() / 1000,
          data: { object: { id: 'obj_test' } }
        };

        (db.select as any).mockReturnValue({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([])
        });

        (db.transaction as any).mockImplementation(async (callback: any) => {
          const mockTx = {
            insert: vi.fn().mockReturnValue({
              values: vi.fn().mockReturnThis(),
              returning: vi.fn().mockResolvedValue([{ id: 1 }])
            }),
            update: vi.fn().mockReturnValue({
              set: vi.fn().mockReturnThis(),
              where: vi.fn().mockReturnThis()
            })
          };
          return callback(mockTx);
        });

        const handler = vi.fn().mockResolvedValue({ success: true });
        const result = await processWebhookWithIdempotency(mockEvent as any, handler);

        expect(result.success).toBe(true);
        expect(handler).toHaveBeenCalled();
        
        vi.clearAllMocks();
      }
    });
  });
});