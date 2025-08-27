/**
 * Booking State Machine Test Suite
 * Tests all 13 state transitions, guard validations, invalid transition prevention,
 * state persistence, and side effects triggering
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { BookingStateMachine, createStateMachine, type BookingContext } from '@/lib/booking-state-machine/machine';
import { BookingStates } from '@/lib/booking-state-machine/states';
import { db } from '@/db/db';
import { emailService } from '@/lib/services/email-service';
import { concurrencyManager } from '@/lib/availability/concurrency-manager';

// Mock dependencies
jest.mock('@/db/db');
jest.mock('@/lib/services/email-service');
jest.mock('@/lib/availability/concurrency-manager');

const mockDb = db as jest.Mocked<typeof db>;
const mockEmailService = emailService as jest.Mocked<typeof emailService>;
const mockConcurrencyManager = concurrencyManager as jest.Mocked<typeof concurrencyManager>;

describe('BookingStateMachine', () => {
  let stateMachine: BookingStateMachine;
  let mockContext: BookingContext;

  beforeEach(() => {
    mockContext = {
      id: 'booking-123',
      providerId: 'provider-123',
      customerId: 'customer-123',
      currentState: BookingStates.INITIATED,
      serviceDetails: {
        name: 'Test Service',
        price: 100,
        duration: 60,
        date: '2024-01-01',
        startTime: '10:00',
        endTime: '11:00',
      },
      paymentDetails: {
        amount: 110,
        platformFee: 10,
        providerPayout: 100,
      },
      metadata: {},
      createdAt: new Date('2024-01-01T09:00:00Z'),
      updatedAt: new Date('2024-01-01T09:00:00Z'),
    };

    stateMachine = new BookingStateMachine(mockContext);
    jest.clearAllMocks();

    // Setup common database mocks
    mockDb.transaction = jest.fn().mockImplementation((callback) => callback(mockDb));
    mockDb.update = jest.fn().mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      }),
    });
    mockDb.insert = jest.fn().mockReturnValue({
      values: jest.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('State Machine Initialization', () => {
    it('should initialize with correct state', () => {
      expect(stateMachine.getCurrentState()).toBe(BookingStates.INITIATED);
    });

    it('should record initial state in history', () => {
      const history = stateMachine.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].state).toBe(BookingStates.INITIATED);
    });

    it('should create state machine from database booking', async () => {
      const mockBooking = {
        id: 'booking-456',
        providerId: 'provider-456',
        customerId: 'customer-456',
        status: 'confirmed',
        serviceName: 'Database Service',
        servicePrice: '150.00',
        serviceDuration: 90,
        bookingDate: '2024-01-02',
        startTime: '14:00',
        endTime: '15:30',
        totalAmount: '165.00',
        platformFee: '15.00',
        providerPayout: '150.00',
        stripePaymentIntentId: 'pi_123',
        createdAt: new Date('2024-01-02T08:00:00Z'),
        updatedAt: new Date('2024-01-02T08:00:00Z'),
      };

      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockBooking]),
          }),
        }),
      });

      const machine = await createStateMachine('booking-456');

      expect(machine).not.toBeNull();
      expect(machine!.getCurrentState()).toBe('confirmed');
      expect(machine!.getContext().serviceDetails.name).toBe('Database Service');
    });
  });

  describe('Valid State Transitions', () => {
    it('should transition from INITIATED to HOLD', async () => {
      mockConcurrencyManager.placeHold = jest.fn().mockResolvedValue({
        success: true,
        holdId: 'hold-123',
      });

      const result = await stateMachine.send({
        type: 'PLACE_HOLD',
        actor: { type: 'customer', id: 'customer-123' },
      });

      expect(result.success).toBe(true);
      expect(result.currentState).toBe(BookingStates.HOLD);
      expect(result.previousState).toBe(BookingStates.INITIATED);
      expect(result.sideEffects).toContain('Slot hold placed');
    });

    it('should transition from HOLD to PENDING_PAYMENT', async () => {
      stateMachine.getContext().currentState = BookingStates.HOLD;

      const result = await stateMachine.send({
        type: 'PROCEED_TO_PAYMENT',
        actor: { type: 'customer', id: 'customer-123' },
      });

      expect(result.success).toBe(true);
      expect(result.currentState).toBe(BookingStates.PENDING_PAYMENT);
    });

    it('should transition from PENDING_PAYMENT to PENDING_PROVIDER', async () => {
      stateMachine.getContext().currentState = BookingStates.PENDING_PAYMENT;

      const result = await stateMachine.send({
        type: 'PAYMENT_SUCCEEDED',
        actor: { type: 'system', id: 'stripe' },
        metadata: { paymentIntentId: 'pi_123' },
      });

      expect(result.success).toBe(true);
      expect(result.currentState).toBe(BookingStates.PENDING_PROVIDER);
    });

    it('should transition from PENDING_PROVIDER to CONFIRMED', async () => {
      stateMachine.getContext().currentState = BookingStates.PENDING_PROVIDER;
      mockConcurrencyManager.convertHoldToBooking = jest.fn().mockResolvedValue(undefined);

      const result = await stateMachine.send({
        type: 'PROVIDER_ACCEPT',
        actor: { type: 'provider', id: 'provider-123' },
        metadata: { holdId: 'hold-123' },
      });

      expect(result.success).toBe(true);
      expect(result.currentState).toBe(BookingStates.CONFIRMED);
      expect(result.sideEffects).toContain('Hold converted to booking');
      expect(result.sideEffects).toContain('Reminders scheduled');
    });

    it('should transition from PENDING_PROVIDER to REJECTED', async () => {
      stateMachine.getContext().currentState = BookingStates.PENDING_PROVIDER;

      const result = await stateMachine.send({
        type: 'PROVIDER_REJECT',
        actor: { type: 'provider', id: 'provider-123' },
        metadata: { reason: 'Not available' },
      });

      expect(result.success).toBe(true);
      expect(result.currentState).toBe(BookingStates.REJECTED);
    });

    it('should transition from CONFIRMED to COMPLETED', async () => {
      stateMachine.getContext().currentState = BookingStates.CONFIRMED;

      const result = await stateMachine.send({
        type: 'MARK_COMPLETE',
        actor: { type: 'provider', id: 'provider-123' },
      });

      expect(result.success).toBe(true);
      expect(result.currentState).toBe(BookingStates.COMPLETED);
      expect(result.sideEffects).toContain('Provider payout scheduled');
      expect(result.sideEffects).toContain('Review request sent');
    });

    it('should transition from CONFIRMED to CANCELED_CUSTOMER', async () => {
      stateMachine.getContext().currentState = BookingStates.CONFIRMED;

      const result = await stateMachine.send({
        type: 'CUSTOMER_CANCEL',
        actor: { type: 'customer', id: 'customer-123' },
        metadata: { reason: 'Schedule conflict' },
      });

      expect(result.success).toBe(true);
      expect(result.currentState).toBe(BookingStates.CANCELED_CUSTOMER);
      expect(result.sideEffects).toContain('Slot released');
    });

    it('should transition from CONFIRMED to CANCELED_PROVIDER', async () => {
      stateMachine.getContext().currentState = BookingStates.CONFIRMED;

      const result = await stateMachine.send({
        type: 'PROVIDER_CANCEL',
        actor: { type: 'provider', id: 'provider-123' },
        metadata: { reason: 'Emergency' },
      });

      expect(result.success).toBe(true);
      expect(result.currentState).toBe(BookingStates.CANCELED_PROVIDER);
      expect(result.sideEffects).toContain('Slot released');
    });

    it('should transition from CONFIRMED to NO_SHOW_CUSTOMER', async () => {
      stateMachine.getContext().currentState = BookingStates.CONFIRMED;

      const result = await stateMachine.send({
        type: 'MARK_NO_SHOW',
        actor: { type: 'provider', id: 'provider-123' },
        metadata: { party: 'customer' },
      });

      expect(result.success).toBe(true);
      expect(result.currentState).toBe(BookingStates.NO_SHOW_CUSTOMER);
    });

    it('should transition from CONFIRMED to NO_SHOW_PROVIDER', async () => {
      stateMachine.getContext().currentState = BookingStates.CONFIRMED;

      const result = await stateMachine.send({
        type: 'MARK_NO_SHOW',
        actor: { type: 'customer', id: 'customer-123' },
        metadata: { party: 'provider' },
      });

      expect(result.success).toBe(true);
      expect(result.currentState).toBe(BookingStates.NO_SHOW_PROVIDER);
      expect(result.sideEffects).toContain('Full refund initiated');
    });

    it('should transition to REFUNDED_PARTIAL', async () => {
      stateMachine.getContext().currentState = BookingStates.CANCELED_CUSTOMER;

      const result = await stateMachine.send({
        type: 'PROCESS_REFUND',
        actor: { type: 'system', id: 'admin' },
        metadata: { refundAmount: 50, refundType: 'partial' },
      });

      expect(result.success).toBe(true);
      expect(result.currentState).toBe(BookingStates.REFUNDED_PARTIAL);
      expect(result.sideEffects).toContain('Refund processed');
    });

    it('should transition to REFUNDED_FULL', async () => {
      stateMachine.getContext().currentState = BookingStates.CANCELED_PROVIDER;

      const result = await stateMachine.send({
        type: 'PROCESS_REFUND',
        actor: { type: 'system', id: 'admin' },
        metadata: { refundAmount: 110, refundType: 'full' },
      });

      expect(result.success).toBe(true);
      expect(result.currentState).toBe(BookingStates.REFUNDED_FULL);
    });

    it('should transition to DISPUTE', async () => {
      stateMachine.getContext().currentState = BookingStates.COMPLETED;

      const result = await stateMachine.send({
        type: 'INITIATE_DISPUTE',
        actor: { type: 'customer', id: 'customer-123' },
        metadata: { reason: 'Service not provided as described' },
      });

      expect(result.success).toBe(true);
      expect(result.currentState).toBe(BookingStates.DISPUTE);
      expect(result.sideEffects).toContain('Admin notified of dispute');
    });
  });

  describe('Invalid Transitions', () => {
    it('should reject invalid transitions', async () => {
      // Try to go directly from INITIATED to COMPLETED
      const result = await stateMachine.send({
        type: 'MARK_COMPLETE',
        actor: { type: 'provider', id: 'provider-123' },
      });

      expect(result.success).toBe(false);
      expect(result.currentState).toBe(BookingStates.INITIATED);
      expect(result.error).toContain('Invalid transition');
    });

    it('should reject transitions from terminal states', async () => {
      stateMachine.getContext().currentState = BookingStates.COMPLETED;

      const result = await stateMachine.send({
        type: 'CUSTOMER_CANCEL',
        actor: { type: 'customer', id: 'customer-123' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('terminal state');
    });

    it('should handle payment failures correctly', async () => {
      stateMachine.getContext().currentState = BookingStates.PENDING_PAYMENT;

      const result = await stateMachine.send({
        type: 'PAYMENT_FAILED',
        actor: { type: 'system', id: 'stripe' },
        metadata: { error: 'Card declined' },
      });

      expect(result.success).toBe(true);
      expect(result.currentState).toBe(BookingStates.PAYMENT_FAILED);
    });
  });

  describe('Guard Validations', () => {
    it('should validate actor permissions', async () => {
      stateMachine.getContext().currentState = BookingStates.CONFIRMED;

      // Customer trying to mark complete (should fail)
      const result = await stateMachine.send({
        type: 'MARK_COMPLETE',
        actor: { type: 'customer', id: 'customer-123' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized');
    });

    it('should validate hold placement requirements', async () => {
      mockConcurrencyManager.placeHold = jest.fn().mockResolvedValue({
        success: false,
        error: 'Slot no longer available',
      });

      const result = await stateMachine.send({
        type: 'PLACE_HOLD',
        actor: { type: 'customer', id: 'customer-123' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to place hold');
    });
  });

  describe('State Persistence', () => {
    it('should persist state changes to database', async () => {
      const result = await stateMachine.send({
        type: 'PLACE_HOLD',
        actor: { type: 'customer', id: 'customer-123' },
      });

      expect(result.success).toBe(true);

      // Verify database calls
      expect(mockDb.transaction).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should record state transition history', async () => {
      await stateMachine.send({
        type: 'PLACE_HOLD',
        actor: { type: 'customer', id: 'customer-123' },
      });

      const history = stateMachine.getHistory();
      expect(history).toHaveLength(2);
      expect(history[1].state).toBe(BookingStates.HOLD);
      expect(history[1].event).toBe('PLACE_HOLD');
    });

    it('should handle database transaction failures', async () => {
      mockDb.transaction = jest.fn().mockRejectedValue(new Error('Transaction failed'));

      const result = await stateMachine.send({
        type: 'PLACE_HOLD',
        actor: { type: 'customer', id: 'customer-123' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Transaction failed');
    });
  });

  describe('Side Effects', () => {
    it('should send customer notifications when required', async () => {
      stateMachine.getContext().currentState = BookingStates.PENDING_PROVIDER;

      const result = await stateMachine.send({
        type: 'PROVIDER_ACCEPT',
        actor: { type: 'provider', id: 'provider-123' },
      });

      expect(result.success).toBe(true);
      expect(result.sideEffects).toContain('Customer notification sent');
    });

    it('should send provider notifications when required', async () => {
      stateMachine.getContext().currentState = BookingStates.PENDING_PAYMENT;

      const result = await stateMachine.send({
        type: 'PAYMENT_SUCCEEDED',
        actor: { type: 'system', id: 'stripe' },
      });

      expect(result.success).toBe(true);
      expect(result.sideEffects).toContain('Provider notification sent');
    });

    it('should schedule timeouts for states with duration limits', async () => {
      const result = await stateMachine.send({
        type: 'PLACE_HOLD',
        actor: { type: 'customer', id: 'customer-123' },
      });

      expect(result.success).toBe(true);
      expect(result.sideEffects).toContain('State timeout scheduled');
    });

    it('should handle side effect failures gracefully', async () => {
      mockConcurrencyManager.placeHold = jest.fn().mockRejectedValue(new Error('Hold service down'));

      const result = await stateMachine.send({
        type: 'PLACE_HOLD',
        actor: { type: 'customer', id: 'customer-123' },
      });

      expect(result.success).toBe(false);
      expect(result.sideEffects).toContain('Side effect error');
    });
  });

  describe('Available Events', () => {
    it('should return correct available events for each state', () => {
      // INITIATED state
      const events = stateMachine.getAvailableEvents();
      expect(events).toContain('PLACE_HOLD');
      expect(events).toContain('PROCEED_TO_PAYMENT');
    });

    it('should return empty array for terminal states', () => {
      stateMachine.getContext().currentState = BookingStates.COMPLETED;
      const events = stateMachine.getAvailableEvents();
      expect(events).toEqual([]);
    });
  });

  describe('Context and Metadata', () => {
    it('should maintain booking context correctly', () => {
      const context = stateMachine.getContext();
      expect(context.id).toBe('booking-123');
      expect(context.providerId).toBe('provider-123');
      expect(context.customerId).toBe('customer-123');
    });

    it('should update metadata during transitions', async () => {
      const result = await stateMachine.send({
        type: 'PLACE_HOLD',
        actor: { type: 'customer', id: 'customer-123' },
        metadata: { urgency: 'high' },
      });

      expect(result.success).toBe(true);
      
      // Check that hold ID was stored in metadata
      const context = stateMachine.getContext();
      expect(context.metadata.holdId).toBeDefined();
    });
  });

  describe('Guest Booking Support', () => {
    beforeEach(() => {
      // Modify context for guest booking
      stateMachine.getContext().customerId = undefined;
      stateMachine.getContext().guestSessionId = 'guest-session-123';
    });

    it('should handle guest booking state transitions', async () => {
      const result = await stateMachine.send({
        type: 'PLACE_HOLD',
        actor: { type: 'customer', id: 'guest-session-123' },
      });

      expect(result.success).toBe(true);
      expect(result.currentState).toBe(BookingStates.HOLD);
    });

    it('should place holds for guest bookings', async () => {
      mockConcurrencyManager.placeHold = jest.fn().mockResolvedValue({
        success: true,
        holdId: 'guest-hold-123',
      });

      await stateMachine.send({
        type: 'PLACE_HOLD',
        actor: { type: 'customer', id: 'guest-session-123' },
      });

      expect(mockConcurrencyManager.placeHold).toHaveBeenCalledWith(
        expect.objectContaining({
          guestSessionId: 'guest-session-123',
        })
      );
    });
  });

  describe('Timeout Handling', () => {
    it('should handle hold expiration', async () => {
      stateMachine.getContext().currentState = BookingStates.HOLD;

      const result = await stateMachine.send({
        type: 'TIMEOUT_EXPIRED',
        actor: { type: 'system', id: 'scheduler' },
        metadata: { timeoutType: 'hold_expiry' },
      });

      expect(result.success).toBe(true);
      expect(result.currentState).toBe(BookingStates.EXPIRED);
    });

    it('should handle payment timeout', async () => {
      stateMachine.getContext().currentState = BookingStates.PENDING_PAYMENT;

      const result = await stateMachine.send({
        type: 'TIMEOUT_EXPIRED',
        actor: { type: 'system', id: 'scheduler' },
        metadata: { timeoutType: 'payment_timeout' },
      });

      expect(result.success).toBe(true);
      expect(result.currentState).toBe(BookingStates.PAYMENT_FAILED);
    });
  });

  describe('Refund Processing', () => {
    it('should handle different refund scenarios', async () => {
      const testCases = [
        {
          fromState: BookingStates.CANCELED_CUSTOMER,
          refundType: 'partial',
          expectedState: BookingStates.REFUNDED_PARTIAL,
        },
        {
          fromState: BookingStates.CANCELED_PROVIDER,
          refundType: 'full',
          expectedState: BookingStates.REFUNDED_FULL,
        },
        {
          fromState: BookingStates.NO_SHOW_PROVIDER,
          refundType: 'full',
          expectedState: BookingStates.REFUNDED_FULL,
        },
      ];

      for (const testCase of testCases) {
        stateMachine.getContext().currentState = testCase.fromState;

        const result = await stateMachine.send({
          type: 'PROCESS_REFUND',
          actor: { type: 'system', id: 'admin' },
          metadata: {
            refundType: testCase.refundType,
            refundAmount: testCase.refundType === 'full' ? 110 : 50,
          },
        });

        expect(result.success).toBe(true);
        expect(result.currentState).toBe(testCase.expectedState);
      }
    });
  });

  describe('Error Recovery', () => {
    it('should maintain state consistency during errors', async () => {
      const originalState = stateMachine.getCurrentState();

      // Mock a side effect failure
      mockConcurrencyManager.placeHold = jest.fn().mockRejectedValue(new Error('Service unavailable'));

      const result = await stateMachine.send({
        type: 'PLACE_HOLD',
        actor: { type: 'customer', id: 'customer-123' },
      });

      expect(result.success).toBe(false);
      expect(stateMachine.getCurrentState()).toBe(originalState); // State should not change
    });

    it('should provide detailed error information', async () => {
      mockDb.transaction = jest.fn().mockRejectedValue(new Error('Database connection lost'));

      const result = await stateMachine.send({
        type: 'PLACE_HOLD',
        actor: { type: 'customer', id: 'customer-123' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection lost');
    });
  });
});