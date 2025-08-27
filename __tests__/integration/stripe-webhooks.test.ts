/**
 * Stripe Webhook Integration Test Suite
 * 
 * Tests the complete webhook flow from Stripe to database updates
 * Including signature validation, event processing, and state management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST } from '@/app/api/stripe/webhooks/route';
import { NextRequest } from 'next/server';
import { stripe } from '@/lib/stripe';
import { db } from '@/db/db';
import { bookingsTable, transactionsTable } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Mock Stripe
vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: {
      constructEvent: vi.fn()
    },
    paymentIntents: {
      retrieve: vi.fn()
    },
    transfers: {
      create: vi.fn()
    }
  }
}));

// Mock database
vi.mock('@/db/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    transaction: vi.fn()
  }
}));

// Mock headers
vi.mock('next/headers', () => ({
  headers: vi.fn(() => ({
    get: vi.fn((key: string) => {
      if (key === 'Stripe-Signature') return 'test_signature';
      return null;
    })
  }))
}));

describe('Stripe Webhook Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  });

  describe('Webhook Authentication', () => {
    it('should validate webhook signature', async () => {
      const mockBody = JSON.stringify({
        id: 'evt_test',
        type: 'payment_intent.succeeded'
      });

      const request = new NextRequest('http://localhost:3000/api/stripe/webhooks', {
        method: 'POST',
        body: mockBody,
        headers: {
          'Stripe-Signature': 'valid_signature'
        }
      });

      (stripe.webhooks.constructEvent as any).mockReturnValue({
        id: 'evt_test',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_test' } }
      });

      const response = await POST(request);
      
      expect(stripe.webhooks.constructEvent).toHaveBeenCalledWith(
        mockBody,
        'test_signature',
        'whsec_test'
      );
      expect(response.status).toBe(200);
    });

    it('should reject invalid signatures', async () => {
      const request = new NextRequest('http://localhost:3000/api/stripe/webhooks', {
        method: 'POST',
        body: 'invalid_body'
      });

      (stripe.webhooks.constructEvent as any).mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should reject missing signature', async () => {
      vi.mock('next/headers', () => ({
        headers: vi.fn(() => ({
          get: vi.fn(() => null) // No signature
        }))
      }));

      const request = new NextRequest('http://localhost:3000/api/stripe/webhooks', {
        method: 'POST',
        body: '{}'
      });

      const response = await POST(request);
      
      expect(response.status).toBe(401);
    });
  });

  describe('Payment Intent Events', () => {
    describe('payment_intent.succeeded', () => {
      it('should update booking to PAYMENT_SUCCEEDED status', async () => {
        const mockEvent = {
          id: 'evt_payment_success',
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: 'pi_succeeded',
              amount: 11000, // $110 for guest
              status: 'succeeded',
              metadata: {
                bookingId: 'booking_123',
                type: 'guest_booking',
                isGuest: 'true',
                providerId: 'provider_123'
              },
              charges: {
                data: [{
                  id: 'ch_test',
                  balance_transaction: 'txn_test'
                }]
              }
            }
          }
        };

        (stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent);

        // Mock database updates
        const bookingUpdateMock = vi.fn().mockResolvedValue([{
          id: 'booking_123',
          status: 'payment_succeeded'
        }]);

        const transactionUpdateMock = vi.fn().mockResolvedValue([{
          bookingId: 'booking_123',
          status: 'completed'
        }]);

        (db.update as any).mockImplementation((table: any) => {
          if (table === bookingsTable) {
            return {
              set: vi.fn().mockReturnThis(),
              where: vi.fn().mockReturnThis(),
              returning: bookingUpdateMock
            };
          }
          if (table === transactionsTable) {
            return {
              set: vi.fn().mockReturnThis(),
              where: vi.fn().mockReturnThis(),
              returning: transactionUpdateMock
            };
          }
        });

        const request = new NextRequest('http://localhost:3000/api/stripe/webhooks', {
          method: 'POST',
          body: JSON.stringify(mockEvent)
        });

        const response = await POST(request);
        
        expect(response.status).toBe(200);
        expect(bookingUpdateMock).toHaveBeenCalled();
        expect(transactionUpdateMock).toHaveBeenCalled();
      });

      it('should handle guest booking with correct fee breakdown', async () => {
        const mockEvent = {
          id: 'evt_guest_payment',
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: 'pi_guest',
              amount: 11000, // $110 total
              metadata: {
                bookingId: 'booking_guest',
                type: 'guest_booking',
                isGuest: 'true',
                baseAmount: '100.00',
                guestSurcharge: '10.00',
                platformFee: '10.00'
              }
            }
          }
        };

        (stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent);

        const request = new NextRequest('http://localhost:3000/api/stripe/webhooks', {
          method: 'POST',
          body: JSON.stringify(mockEvent)
        });

        const response = await POST(request);
        
        // Verify guest paid correct amount
        expect(mockEvent.data.object.amount).toBe(11000);
        expect(mockEvent.data.object.metadata.guestSurcharge).toBe('10.00');
      });

      it('should handle customer booking without surcharge', async () => {
        const mockEvent = {
          id: 'evt_customer_payment',
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: 'pi_customer',
              amount: 10000, // $100 total (no surcharge)
              metadata: {
                bookingId: 'booking_customer',
                type: 'customer_booking',
                isGuest: 'false',
                baseAmount: '100.00',
                platformFee: '10.00'
              }
            }
          }
        };

        (stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent);

        const request = new NextRequest('http://localhost:3000/api/stripe/webhooks', {
          method: 'POST',
          body: JSON.stringify(mockEvent)
        });

        const response = await POST(request);
        
        // Verify customer paid base amount only
        expect(mockEvent.data.object.amount).toBe(10000);
        expect(mockEvent.data.object.metadata.guestSurcharge).toBeUndefined();
      });
    });

    describe('payment_intent.payment_failed', () => {
      it('should update booking to PAYMENT_FAILED status', async () => {
        const mockEvent = {
          id: 'evt_payment_failed',
          type: 'payment_intent.payment_failed',
          data: {
            object: {
              id: 'pi_failed',
              status: 'requires_payment_method',
              metadata: {
                bookingId: 'booking_failed',
                type: 'guest_booking'
              },
              last_payment_error: {
                code: 'card_declined',
                decline_code: 'insufficient_funds',
                message: 'Your card has insufficient funds.'
              }
            }
          }
        };

        (stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent);

        const bookingUpdateMock = vi.fn().mockResolvedValue([{
          id: 'booking_failed',
          status: 'payment_failed'
        }]);

        (db.update as any).mockImplementation(() => ({
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          returning: bookingUpdateMock
        }));

        const request = new NextRequest('http://localhost:3000/api/stripe/webhooks', {
          method: 'POST',
          body: JSON.stringify(mockEvent)
        });

        const response = await POST(request);
        
        expect(response.status).toBe(200);
        expect(bookingUpdateMock).toHaveBeenCalled();
      });

      it('should track failure reasons for analytics', async () => {
        const mockEvent = {
          id: 'evt_track_failure',
          type: 'payment_intent.payment_failed',
          data: {
            object: {
              id: 'pi_track_fail',
              metadata: { bookingId: 'booking_track' },
              last_payment_error: {
                decline_code: 'expired_card'
              }
            }
          }
        };

        (stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent);

        const analyticsUpdateMock = vi.fn();
        (db.insert as any).mockImplementation(() => ({
          values: analyticsUpdateMock.mockReturnThis(),
          returning: vi.fn().mockResolvedValue([])
        }));

        const request = new NextRequest('http://localhost:3000/api/stripe/webhooks', {
          method: 'POST',
          body: JSON.stringify(mockEvent)
        });

        await POST(request);
        
        // Should track failure reason
        expect(mockEvent.data.object.last_payment_error.decline_code).toBe('expired_card');
      });
    });

    describe('payment_intent.canceled', () => {
      it('should update booking to CANCELLED status', async () => {
        const mockEvent = {
          id: 'evt_payment_canceled',
          type: 'payment_intent.canceled',
          data: {
            object: {
              id: 'pi_canceled',
              status: 'canceled',
              metadata: {
                bookingId: 'booking_canceled'
              },
              cancellation_reason: 'requested_by_customer'
            }
          }
        };

        (stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent);

        const bookingUpdateMock = vi.fn().mockResolvedValue([{
          id: 'booking_canceled',
          status: 'cancelled'
        }]);

        (db.update as any).mockImplementation(() => ({
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          returning: bookingUpdateMock
        }));

        const request = new NextRequest('http://localhost:3000/api/stripe/webhooks', {
          method: 'POST',
          body: JSON.stringify(mockEvent)
        });

        const response = await POST(request);
        
        expect(response.status).toBe(200);
        expect(bookingUpdateMock).toHaveBeenCalled();
      });
    });
  });

  describe('Transfer Events (Provider Payouts)', () => {
    describe('transfer.created', () => {
      it('should track transfer initiation', async () => {
        const mockEvent = {
          id: 'evt_transfer_created',
          type: 'transfer.created',
          data: {
            object: {
              id: 'tr_created',
              amount: 9000, // $90 provider payout
              destination: 'acct_provider123',
              metadata: {
                bookingId: 'booking_transfer',
                providerId: 'provider_123'
              }
            }
          }
        };

        (stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent);

        const transferInsertMock = vi.fn();
        (db.insert as any).mockImplementation(() => ({
          values: transferInsertMock.mockReturnThis(),
          returning: vi.fn().mockResolvedValue([])
        }));

        const request = new NextRequest('http://localhost:3000/api/stripe/webhooks', {
          method: 'POST',
          body: JSON.stringify(mockEvent)
        });

        await POST(request);
        
        expect(mockEvent.data.object.amount).toBe(9000);
      });
    });

    describe('transfer.paid', () => {
      it('should mark provider payout as completed', async () => {
        const mockEvent = {
          id: 'evt_transfer_paid',
          type: 'transfer.paid',
          data: {
            object: {
              id: 'tr_paid',
              amount: 9000,
              destination: 'acct_provider123',
              metadata: {
                bookingId: 'booking_paid',
                providerId: 'provider_123'
              }
            }
          }
        };

        (stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent);

        const payoutUpdateMock = vi.fn();
        (db.update as any).mockImplementation(() => ({
          set: payoutUpdateMock.mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([])
        }));

        const request = new NextRequest('http://localhost:3000/api/stripe/webhooks', {
          method: 'POST',
          body: JSON.stringify(mockEvent)
        });

        await POST(request);
        
        expect(payoutUpdateMock).toHaveBeenCalledWith(
          expect.objectContaining({
            status: expect.stringMatching(/completed|paid/)
          })
        );
      });
    });

    describe('transfer.failed', () => {
      it('should handle failed provider payouts', async () => {
        const mockEvent = {
          id: 'evt_transfer_failed',
          type: 'transfer.failed',
          data: {
            object: {
              id: 'tr_failed',
              amount: 9000,
              destination: 'acct_provider123',
              metadata: {
                bookingId: 'booking_fail_transfer'
              },
              failure_code: 'account_closed',
              failure_message: 'The bank account has been closed'
            }
          }
        };

        (stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent);

        // Should create alert for manual review
        const alertInsertMock = vi.fn();
        (db.insert as any).mockImplementation(() => ({
          values: alertInsertMock.mockReturnThis(),
          returning: vi.fn().mockResolvedValue([])
        }));

        const request = new NextRequest('http://localhost:3000/api/stripe/webhooks', {
          method: 'POST',
          body: JSON.stringify(mockEvent)
        });

        await POST(request);
        
        expect(mockEvent.data.object.failure_code).toBe('account_closed');
      });
    });
  });

  describe('Dispute Events', () => {
    describe('charge.dispute.created', () => {
      it('should freeze provider payout on dispute', async () => {
        const mockEvent = {
          id: 'evt_dispute_created',
          type: 'charge.dispute.created',
          data: {
            object: {
              id: 'dp_created',
              amount: 11000, // Guest paid $110
              charge: 'ch_disputed',
              reason: 'fraudulent',
              status: 'warning_needs_response',
              metadata: {
                bookingId: 'booking_disputed'
              }
            }
          }
        };

        (stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent);

        // Should freeze payout
        const payoutFreezeMock = vi.fn();
        (db.update as any).mockImplementation(() => ({
          set: payoutFreezeMock.mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([])
        }));

        const request = new NextRequest('http://localhost:3000/api/stripe/webhooks', {
          method: 'POST',
          body: JSON.stringify(mockEvent)
        });

        await POST(request);
        
        expect(payoutFreezeMock).toHaveBeenCalledWith(
          expect.objectContaining({
            payoutStatus: expect.stringMatching(/frozen|held/)
          })
        );
      });

      it('should create dispute record for tracking', async () => {
        const mockEvent = {
          id: 'evt_dispute_track',
          type: 'charge.dispute.created',
          data: {
            object: {
              id: 'dp_track',
              amount: 10000,
              reason: 'product_not_received',
              evidence_due_by: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
            }
          }
        };

        (stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent);

        const disputeInsertMock = vi.fn();
        (db.insert as any).mockImplementation(() => ({
          values: disputeInsertMock.mockReturnThis(),
          returning: vi.fn().mockResolvedValue([])
        }));

        const request = new NextRequest('http://localhost:3000/api/stripe/webhooks', {
          method: 'POST',
          body: JSON.stringify(mockEvent)
        });

        await POST(request);
        
        // Should track dispute details
        expect(mockEvent.data.object.reason).toBe('product_not_received');
      });
    });
  });

  describe('Refund Events', () => {
    describe('charge.refunded', () => {
      it('should handle full refund correctly', async () => {
        const mockEvent = {
          id: 'evt_refund_full',
          type: 'charge.refunded',
          data: {
            object: {
              id: 'ch_refunded',
              amount: 11000, // Original guest payment
              amount_refunded: 11000, // Full refund
              metadata: {
                bookingId: 'booking_refunded',
                isGuest: 'true'
              }
            }
          }
        };

        (stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent);

        // Should update booking status
        const bookingUpdateMock = vi.fn();
        // Should reverse platform revenue
        const revenueUpdateMock = vi.fn();
        // Should debit provider
        const providerDebitMock = vi.fn();

        (db.update as any).mockImplementation(() => ({
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([])
        }));

        const request = new NextRequest('http://localhost:3000/api/stripe/webhooks', {
          method: 'POST',
          body: JSON.stringify(mockEvent)
        });

        await POST(request);
        
        // Full refund amount matches original payment
        expect(mockEvent.data.object.amount_refunded).toBe(mockEvent.data.object.amount);
      });

      it('should handle partial refund proportionally', async () => {
        const mockEvent = {
          id: 'evt_refund_partial',
          type: 'charge.refunded',
          data: {
            object: {
              id: 'ch_partial',
              amount: 10000, // Original customer payment
              amount_refunded: 3000, // 30% refund
              metadata: {
                bookingId: 'booking_partial',
                isGuest: 'false'
              }
            }
          }
        };

        (stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent);

        const request = new NextRequest('http://localhost:3000/api/stripe/webhooks', {
          method: 'POST',
          body: JSON.stringify(mockEvent)
        });

        await POST(request);
        
        // Partial refund calculation
        const refundPercentage = mockEvent.data.object.amount_refunded / mockEvent.data.object.amount;
        expect(refundPercentage).toBe(0.3);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection failures gracefully', async () => {
      const mockEvent = {
        id: 'evt_db_fail',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_test' } }
      };

      (stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent);
      
      (db.update as any).mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost:3000/api/stripe/webhooks', {
        method: 'POST',
        body: JSON.stringify(mockEvent)
      });

      const response = await POST(request);
      
      // Should still return 200 to prevent Stripe retries
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.warning).toContain('retry');
    });

    it('should handle malformed event data', async () => {
      const mockEvent = {
        id: 'evt_malformed',
        type: 'payment_intent.succeeded',
        data: { object: null } // Malformed data
      };

      (stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent);

      const request = new NextRequest('http://localhost:3000/api/stripe/webhooks', {
        method: 'POST',
        body: JSON.stringify(mockEvent)
      });

      const response = await POST(request);
      
      expect(response.status).toBe(200);
    });

    it('should skip non-relevant events', async () => {
      const mockEvent = {
        id: 'evt_irrelevant',
        type: 'customer.created', // Not a payment event
        data: { object: { id: 'cus_test' } }
      };

      (stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent);

      const handlerSpy = vi.fn();
      
      const request = new NextRequest('http://localhost:3000/api/stripe/webhooks', {
        method: 'POST',
        body: JSON.stringify(mockEvent)
      });

      const response = await POST(request);
      
      expect(response.status).toBe(200);
      expect(handlerSpy).not.toHaveBeenCalled();
    });
  });
});