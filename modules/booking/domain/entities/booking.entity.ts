/**
 * Booking Aggregate Root
 * 
 * Core business entity representing a service booking with its lifecycle,
 * rules, and state transitions.
 */

import { AggregateRoot, EntityId } from '@/modules/shared/domain/base-entity';
import { Result } from '@/modules/shared/domain/value-object';
import { Money } from '@/modules/shared/domain/value-objects/money';
import { TimeSlot } from '@/modules/shared/domain/value-objects/time-slot';
import { BookingStatus, BookingStatusTransition } from '../value-objects/booking-status';
import { CustomerId } from '@/modules/customer/domain/value-objects/customer-id';
import { ProviderId } from '@/modules/provider/domain/value-objects/provider-id';
import { ServiceDetails } from '../value-objects/service-details';
import { 
  BookingCreatedEvent,
  BookingConfirmedEvent,
  BookingCancelledEvent,
  BookingCompletedEvent,
  BookingPaymentProcessedEvent,
  BookingRejectedEvent
} from '../events/booking-events';

export type BookingId = EntityId<string>;

export interface BookingProps {
  customerId: CustomerId;
  providerId: ProviderId;
  serviceDetails: ServiceDetails;
  timeSlot: TimeSlot;
  totalAmount: Money;
  platformFee: Money;
  providerPayout: Money;
  status: BookingStatus;
  customerNotes?: string;
  providerNotes?: string;
  cancellationReason?: string;
  cancelledBy?: string;
  paymentIntentId?: string;
  confirmationCode?: string;
  metadata?: Record<string, any>;
}

export class Booking extends AggregateRoot<BookingId, BookingProps> {
  private constructor(props: BookingProps, id: BookingId) {
    super(props, id);
  }

  static create(
    params: {
      customerId: CustomerId;
      providerId: ProviderId;
      serviceDetails: ServiceDetails;
      timeSlot: TimeSlot;
      customerNotes?: string;
      metadata?: Record<string, any>;
    }
  ): Result<Booking> {
    const bookingId = EntityId.generate<BookingId>();

    // Calculate amounts
    const baseAmount = params.serviceDetails.price;
    const platformFeeResult = baseAmount.calculatePlatformFee(10); // 10% platform fee

    if (platformFeeResult.isFailure) {
      return Result.fail(platformFeeResult.getError());
    }

    const { fee: platformFee, remainder: providerPayout } = platformFeeResult.getValue();

    const booking = new Booking(
      {
        customerId: params.customerId,
        providerId: params.providerId,
        serviceDetails: params.serviceDetails,
        timeSlot: params.timeSlot,
        totalAmount: baseAmount,
        platformFee,
        providerPayout,
        status: BookingStatus.create('INITIATED'),
        customerNotes: params.customerNotes,
        metadata: params.metadata,
        confirmationCode: this.generateConfirmationCode()
      },
      bookingId
    );

    // Record creation event
    booking.recordEvent(new BookingCreatedEvent({
      bookingId: bookingId,
      customerId: params.customerId,
      providerId: params.providerId,
      serviceDetails: params.serviceDetails,
      timeSlot: params.timeSlot,
      totalAmount: baseAmount,
      status: 'INITIATED'
    }));

    return Result.ok(booking);
  }

  static reconstitute(props: BookingProps, id: BookingId): Booking {
    return new Booking(props, id);
  }

  // Business Logic Methods

  requestProviderApproval(): Result<void> {
    const transition = this.props.status.transitionTo('PENDING_PROVIDER');
    if (transition.isFailure) {
      return Result.fail(transition.getError());
    }

    this.props.status = transition.getValue();
    this.incrementVersion();
    return Result.ok();
  }

  acceptByProvider(providerNotes?: string): Result<void> {
    const transition = this.props.status.transitionTo('ACCEPTED');
    if (transition.isFailure) {
      return Result.fail(transition.getError());
    }

    this.props.status = transition.getValue();
    if (providerNotes) {
      this.props.providerNotes = providerNotes;
    }

    this.recordEvent(new BookingConfirmedEvent({
      bookingId: this.id,
      providerId: this.props.providerId,
      confirmedAt: new Date()
    }));

    this.incrementVersion();
    return Result.ok();
  }

  rejectByProvider(reason: string): Result<void> {
    const transition = this.props.status.transitionTo('REJECTED');
    if (transition.isFailure) {
      return Result.fail(transition.getError());
    }

    this.props.status = transition.getValue();
    this.props.cancellationReason = reason;
    this.props.cancelledBy = 'provider';

    this.recordEvent(new BookingRejectedEvent({
      bookingId: this.id,
      providerId: this.props.providerId,
      reason: reason,
      rejectedAt: new Date()
    }));

    this.incrementVersion();
    return Result.ok();
  }

  initiatePayment(paymentIntentId: string): Result<void> {
    const transition = this.props.status.transitionTo('PAYMENT_PENDING');
    if (transition.isFailure) {
      return Result.fail(transition.getError());
    }

    this.props.status = transition.getValue();
    this.props.paymentIntentId = paymentIntentId;
    this.incrementVersion();
    return Result.ok();
  }

  confirmPayment(): Result<void> {
    if (!this.props.paymentIntentId) {
      return Result.fail('Payment intent ID is required');
    }

    const transition = this.props.status.transitionTo('PAYMENT_SUCCEEDED');
    if (transition.isFailure) {
      return Result.fail(transition.getError());
    }

    this.props.status = transition.getValue();

    this.recordEvent(new BookingPaymentProcessedEvent({
      bookingId: this.id,
      paymentIntentId: this.props.paymentIntentId,
      amount: this.props.totalAmount,
      platformFee: this.props.platformFee,
      providerPayout: this.props.providerPayout,
      processedAt: new Date()
    }));

    this.incrementVersion();
    return Result.ok();
  }

  handlePaymentFailure(): Result<void> {
    const transition = this.props.status.transitionTo('PAYMENT_FAILED');
    if (transition.isFailure) {
      return Result.fail(transition.getError());
    }

    this.props.status = transition.getValue();
    this.incrementVersion();
    return Result.ok();
  }

  complete(): Result<void> {
    const transition = this.props.status.transitionTo('COMPLETED');
    if (transition.isFailure) {
      return Result.fail(transition.getError());
    }

    this.props.status = transition.getValue();

    this.recordEvent(new BookingCompletedEvent({
      bookingId: this.id,
      completedAt: new Date()
    }));

    this.incrementVersion();
    return Result.ok();
  }

  cancel(reason: string, cancelledBy: 'customer' | 'provider' | 'system'): Result<void> {
    const transition = this.props.status.transitionTo('CANCELLED');
    if (transition.isFailure) {
      return Result.fail(transition.getError());
    }

    this.props.status = transition.getValue();
    this.props.cancellationReason = reason;
    this.props.cancelledBy = cancelledBy;

    this.recordEvent(new BookingCancelledEvent({
      bookingId: this.id,
      reason: reason,
      cancelledBy: cancelledBy,
      cancelledAt: new Date(),
      refundAmount: this.shouldRefund() ? this.props.totalAmount : undefined
    }));

    this.incrementVersion();
    return Result.ok();
  }

  // Business Rules

  canBeCancelled(): boolean {
    const cancellableStatuses = [
      'INITIATED', 
      'PENDING_PROVIDER', 
      'ACCEPTED', 
      'PAYMENT_PENDING',
      'PAYMENT_SUCCEEDED'
    ];
    return cancellableStatuses.includes(this.props.status.value);
  }

  shouldRefund(): boolean {
    // Refund if payment was made and booking is cancelled before completion
    return this.props.status.value === 'PAYMENT_SUCCEEDED' && 
           this.props.timeSlot.startTime > new Date();
  }

  isUpcoming(): boolean {
    return this.props.timeSlot.startTime > new Date() &&
           ['ACCEPTED', 'PAYMENT_SUCCEEDED'].includes(this.props.status.value);
  }

  isPastDue(): boolean {
    return this.props.timeSlot.endTime < new Date() &&
           this.props.status.value !== 'COMPLETED' &&
           this.props.status.value !== 'CANCELLED';
  }

  requiresPayment(): boolean {
    return this.props.status.value === 'ACCEPTED';
  }

  // Getters

  get customerId(): CustomerId {
    return this.props.customerId;
  }

  get providerId(): ProviderId {
    return this.props.providerId;
  }

  get serviceDetails(): ServiceDetails {
    return this.props.serviceDetails;
  }

  get timeSlot(): TimeSlot {
    return this.props.timeSlot;
  }

  get totalAmount(): Money {
    return this.props.totalAmount;
  }

  get platformFee(): Money {
    return this.props.platformFee;
  }

  get providerPayout(): Money {
    return this.props.providerPayout;
  }

  get status(): BookingStatus {
    return this.props.status;
  }

  get confirmationCode(): string | undefined {
    return this.props.confirmationCode;
  }

  get paymentIntentId(): string | undefined {
    return this.props.paymentIntentId;
  }

  // Validation

  validate(): void {
    const errors: string[] = [];

    if (!this.props.customerId) {
      errors.push('Customer ID is required');
    }

    if (!this.props.providerId) {
      errors.push('Provider ID is required');
    }

    if (!this.props.serviceDetails) {
      errors.push('Service details are required');
    }

    if (!this.props.timeSlot) {
      errors.push('Time slot is required');
    }

    if (!this.props.totalAmount || this.props.totalAmount.amount <= 0) {
      errors.push('Total amount must be positive');
    }

    if (errors.length > 0) {
      throw new Error(`Booking validation failed: ${errors.join(', ')}`);
    }
  }

  private static generateConfirmationCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Serialization

  toPrimitives(): any {
    return {
      id: this.id,
      customerId: this.props.customerId.value,
      providerId: this.props.providerId.value,
      serviceDetails: this.props.serviceDetails.toPrimitives(),
      timeSlot: {
        startTime: this.props.timeSlot.startTime.toISOString(),
        endTime: this.props.timeSlot.endTime.toISOString(),
        timeZone: this.props.timeSlot.timeZone
      },
      totalAmount: this.props.totalAmount.amount,
      platformFee: this.props.platformFee.amount,
      providerPayout: this.props.providerPayout.amount,
      status: this.props.status.value,
      customerNotes: this.props.customerNotes,
      providerNotes: this.props.providerNotes,
      cancellationReason: this.props.cancellationReason,
      cancelledBy: this.props.cancelledBy,
      paymentIntentId: this.props.paymentIntentId,
      confirmationCode: this.props.confirmationCode,
      metadata: this.props.metadata,
      version: this.version,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }
}