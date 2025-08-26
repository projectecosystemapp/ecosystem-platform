/**
 * Booking Domain Events
 * 
 * Events that represent significant occurrences in the booking lifecycle.
 */

import { DomainEvent, IntegrationEvent } from '@/modules/shared/domain/domain-event';
import { BookingId } from '../entities/booking.entity';
import { CustomerId } from '@/modules/customer/domain/value-objects/customer-id';
import { ProviderId } from '@/modules/provider/domain/value-objects/provider-id';
import { Money } from '@/modules/shared/domain/value-objects/money';
import { TimeSlot } from '@/modules/shared/domain/value-objects/time-slot';
import { ServiceDetails } from '../value-objects/service-details';

/**
 * Booking Created Event
 */
export class BookingCreatedEvent extends DomainEvent {
  constructor(
    public readonly payload: {
      bookingId: BookingId;
      customerId: CustomerId;
      providerId: ProviderId;
      serviceDetails: ServiceDetails;
      timeSlot: TimeSlot;
      totalAmount: Money;
      status: string;
    }
  ) {
    super();
  }

  get aggregateId(): string {
    return this.payload.bookingId;
  }

  get eventName(): string {
    return 'booking.created';
  }

  get eventVersion(): number {
    return 1;
  }

  protected getPayload(): any {
    return {
      bookingId: this.payload.bookingId,
      customerId: this.payload.customerId.value,
      providerId: this.payload.providerId.value,
      serviceName: this.payload.serviceDetails.name,
      serviceId: this.payload.serviceDetails.serviceId,
      startTime: this.payload.timeSlot.startTime.toISOString(),
      endTime: this.payload.timeSlot.endTime.toISOString(),
      totalAmount: this.payload.totalAmount.amount,
      currency: this.payload.totalAmount.currency,
      status: this.payload.status
    };
  }
}

/**
 * Booking Confirmed Event (Provider Accepted)
 */
export class BookingConfirmedEvent extends DomainEvent {
  constructor(
    public readonly payload: {
      bookingId: BookingId;
      providerId: ProviderId;
      confirmedAt: Date;
    }
  ) {
    super();
  }

  get aggregateId(): string {
    return this.payload.bookingId;
  }

  get eventName(): string {
    return 'booking.confirmed';
  }

  get eventVersion(): number {
    return 1;
  }

  protected getPayload(): any {
    return {
      bookingId: this.payload.bookingId,
      providerId: this.payload.providerId.value,
      confirmedAt: this.payload.confirmedAt.toISOString()
    };
  }
}

/**
 * Booking Rejected Event
 */
export class BookingRejectedEvent extends DomainEvent {
  constructor(
    public readonly payload: {
      bookingId: BookingId;
      providerId: ProviderId;
      reason: string;
      rejectedAt: Date;
    }
  ) {
    super();
  }

  get aggregateId(): string {
    return this.payload.bookingId;
  }

  get eventName(): string {
    return 'booking.rejected';
  }

  get eventVersion(): number {
    return 1;
  }

  protected getPayload(): any {
    return {
      bookingId: this.payload.bookingId,
      providerId: this.payload.providerId.value,
      reason: this.payload.reason,
      rejectedAt: this.payload.rejectedAt.toISOString()
    };
  }
}

/**
 * Booking Payment Processed Event
 */
export class BookingPaymentProcessedEvent extends IntegrationEvent {
  constructor(
    public readonly payload: {
      bookingId: BookingId;
      paymentIntentId: string;
      amount: Money;
      platformFee: Money;
      providerPayout: Money;
      processedAt: Date;
    }
  ) {
    super();
  }

  get aggregateId(): string {
    return this.payload.bookingId;
  }

  get eventName(): string {
    return 'booking.payment.processed';
  }

  get eventVersion(): number {
    return 1;
  }

  get boundedContext(): string {
    return 'booking';
  }

  get targetContext(): string {
    return 'payment';
  }

  protected getPayload(): any {
    return {
      bookingId: this.payload.bookingId,
      paymentIntentId: this.payload.paymentIntentId,
      amount: this.payload.amount.amount,
      currency: this.payload.amount.currency,
      platformFee: this.payload.platformFee.amount,
      providerPayout: this.payload.providerPayout.amount,
      processedAt: this.payload.processedAt.toISOString()
    };
  }
}

/**
 * Booking Cancelled Event
 */
export class BookingCancelledEvent extends DomainEvent {
  constructor(
    public readonly payload: {
      bookingId: BookingId;
      reason: string;
      cancelledBy: 'customer' | 'provider' | 'system';
      cancelledAt: Date;
      refundAmount?: Money;
    }
  ) {
    super();
  }

  get aggregateId(): string {
    return this.payload.bookingId;
  }

  get eventName(): string {
    return 'booking.cancelled';
  }

  get eventVersion(): number {
    return 1;
  }

  protected getPayload(): any {
    return {
      bookingId: this.payload.bookingId,
      reason: this.payload.reason,
      cancelledBy: this.payload.cancelledBy,
      cancelledAt: this.payload.cancelledAt.toISOString(),
      refundAmount: this.payload.refundAmount?.amount,
      refundCurrency: this.payload.refundAmount?.currency
    };
  }
}

/**
 * Booking Completed Event
 */
export class BookingCompletedEvent extends DomainEvent {
  constructor(
    public readonly payload: {
      bookingId: BookingId;
      completedAt: Date;
    }
  ) {
    super();
  }

  get aggregateId(): string {
    return this.payload.bookingId;
  }

  get eventName(): string {
    return 'booking.completed';
  }

  get eventVersion(): number {
    return 1;
  }

  protected getPayload(): any {
    return {
      bookingId: this.payload.bookingId,
      completedAt: this.payload.completedAt.toISOString()
    };
  }
}

/**
 * Booking Reminder Event
 */
export class BookingReminderEvent extends IntegrationEvent {
  constructor(
    public readonly payload: {
      bookingId: BookingId;
      customerId: CustomerId;
      providerId: ProviderId;
      reminderType: 'upcoming' | 'review_request' | 'no_show_warning';
      scheduledTime: Date;
    }
  ) {
    super();
  }

  get aggregateId(): string {
    return this.payload.bookingId;
  }

  get eventName(): string {
    return 'booking.reminder';
  }

  get eventVersion(): number {
    return 1;
  }

  get boundedContext(): string {
    return 'booking';
  }

  get targetContext(): string {
    return 'notification';
  }

  protected getPayload(): any {
    return {
      bookingId: this.payload.bookingId,
      customerId: this.payload.customerId.value,
      providerId: this.payload.providerId.value,
      reminderType: this.payload.reminderType,
      scheduledTime: this.payload.scheduledTime.toISOString()
    };
  }
}

/**
 * Booking Conflict Detected Event
 */
export class BookingConflictDetectedEvent extends DomainEvent {
  constructor(
    public readonly payload: {
      bookingId: BookingId;
      conflictingBookingId: BookingId;
      timeSlot: TimeSlot;
      detectedAt: Date;
    }
  ) {
    super();
  }

  get aggregateId(): string {
    return this.payload.bookingId;
  }

  get eventName(): string {
    return 'booking.conflict.detected';
  }

  get eventVersion(): number {
    return 1;
  }

  protected getPayload(): any {
    return {
      bookingId: this.payload.bookingId,
      conflictingBookingId: this.payload.conflictingBookingId,
      startTime: this.payload.timeSlot.startTime.toISOString(),
      endTime: this.payload.timeSlot.endTime.toISOString(),
      detectedAt: this.payload.detectedAt.toISOString()
    };
  }
}