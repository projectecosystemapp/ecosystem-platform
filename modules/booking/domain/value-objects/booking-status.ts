/**
 * Booking Status Value Object
 * 
 * Encapsulates booking status with valid transitions and business rules.
 */

import { ValueObject, Result } from '@/modules/shared/domain/value-object';

export type BookingStatusValue = 
  | 'INITIATED'
  | 'PENDING_PROVIDER'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_SUCCEEDED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

interface BookingStatusProps {
  value: BookingStatusValue;
  updatedAt: Date;
}

export class BookingStatus extends ValueObject<BookingStatusProps> {
  private static readonly VALID_TRANSITIONS: Record<BookingStatusValue, BookingStatusValue[]> = {
    'INITIATED': ['PENDING_PROVIDER', 'CANCELLED'],
    'PENDING_PROVIDER': ['ACCEPTED', 'REJECTED', 'CANCELLED'],
    'ACCEPTED': ['PAYMENT_PENDING', 'CANCELLED'],
    'REJECTED': [],
    'PAYMENT_PENDING': ['PAYMENT_SUCCEEDED', 'PAYMENT_FAILED', 'CANCELLED'],
    'PAYMENT_FAILED': ['PAYMENT_PENDING', 'CANCELLED'],
    'PAYMENT_SUCCEEDED': ['COMPLETED', 'CANCELLED'],
    'COMPLETED': [],
    'CANCELLED': [],
    'NO_SHOW': []
  };

  private static readonly TERMINAL_STATUSES: BookingStatusValue[] = [
    'REJECTED',
    'COMPLETED',
    'CANCELLED',
    'NO_SHOW'
  ];

  private constructor(props: BookingStatusProps) {
    super(props);
  }

  static create(value: BookingStatusValue): BookingStatus {
    return new BookingStatus({
      value,
      updatedAt: new Date()
    });
  }

  get value(): BookingStatusValue {
    return this.props.value;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  canTransitionTo(newStatus: BookingStatusValue): boolean {
    const validTransitions = BookingStatus.VALID_TRANSITIONS[this.props.value];
    return validTransitions.includes(newStatus);
  }

  transitionTo(newStatus: BookingStatusValue): Result<BookingStatus> {
    if (!this.canTransitionTo(newStatus)) {
      return Result.fail(
        `Invalid status transition from ${this.props.value} to ${newStatus}`
      );
    }

    return Result.ok(BookingStatus.create(newStatus));
  }

  isTerminal(): boolean {
    return BookingStatus.TERMINAL_STATUSES.includes(this.props.value);
  }

  isActive(): boolean {
    return !this.isTerminal();
  }

  isPending(): boolean {
    return ['INITIATED', 'PENDING_PROVIDER', 'PAYMENT_PENDING'].includes(this.props.value);
  }

  isConfirmed(): boolean {
    return ['ACCEPTED', 'PAYMENT_SUCCEEDED', 'COMPLETED'].includes(this.props.value);
  }

  requiresProviderAction(): boolean {
    return this.props.value === 'PENDING_PROVIDER';
  }

  requiresCustomerAction(): boolean {
    return this.props.value === 'ACCEPTED'; // Needs payment
  }

  requiresPayment(): boolean {
    return this.props.value === 'ACCEPTED';
  }

  hasPaymentProcessed(): boolean {
    return ['PAYMENT_SUCCEEDED', 'COMPLETED'].includes(this.props.value);
  }

  toString(): string {
    return this.props.value.toLowerCase().replace(/_/g, ' ');
  }

  getDisplayName(): string {
    const displayNames: Record<BookingStatusValue, string> = {
      'INITIATED': 'Initiated',
      'PENDING_PROVIDER': 'Awaiting Provider Approval',
      'ACCEPTED': 'Accepted - Payment Required',
      'REJECTED': 'Rejected by Provider',
      'PAYMENT_PENDING': 'Processing Payment',
      'PAYMENT_FAILED': 'Payment Failed',
      'PAYMENT_SUCCEEDED': 'Payment Confirmed',
      'COMPLETED': 'Completed',
      'CANCELLED': 'Cancelled',
      'NO_SHOW': 'No Show'
    };

    return displayNames[this.props.value];
  }

  getStatusColor(): string {
    const colors: Record<BookingStatusValue, string> = {
      'INITIATED': 'gray',
      'PENDING_PROVIDER': 'yellow',
      'ACCEPTED': 'blue',
      'REJECTED': 'red',
      'PAYMENT_PENDING': 'yellow',
      'PAYMENT_FAILED': 'red',
      'PAYMENT_SUCCEEDED': 'green',
      'COMPLETED': 'green',
      'CANCELLED': 'gray',
      'NO_SHOW': 'red'
    };

    return colors[this.props.value];
  }
}

/**
 * Booking Status Transition Record
 */
export class BookingStatusTransition {
  constructor(
    public readonly from: BookingStatusValue,
    public readonly to: BookingStatusValue,
    public readonly transitionedAt: Date,
    public readonly reason?: string,
    public readonly performedBy?: string
  ) {}

  isValid(): boolean {
    const validTransitions = BookingStatus.VALID_TRANSITIONS[this.from];
    return validTransitions.includes(this.to);
  }

  getDuration(until?: Date): number {
    const endTime = until || new Date();
    return endTime.getTime() - this.transitionedAt.getTime();
  }

  toString(): string {
    return `${this.from} -> ${this.to} at ${this.transitionedAt.toISOString()}`;
  }
}