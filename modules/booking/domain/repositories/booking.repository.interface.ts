/**
 * Booking Repository Interface
 * 
 * Defines the contract for persisting and retrieving booking aggregates.
 */

import { Booking, BookingId } from '../entities/booking.entity';
import { CustomerId } from '@/modules/customer/domain/value-objects/customer-id';
import { ProviderId } from '@/modules/provider/domain/value-objects/provider-id';
import { TimeSlot } from '@/modules/shared/domain/value-objects/time-slot';
import { BookingStatusValue } from '../value-objects/booking-status';

export interface IBookingRepository {
  // Core CRUD operations
  save(booking: Booking): Promise<void>;
  findById(id: BookingId): Promise<Booking | null>;
  findByConfirmationCode(code: string): Promise<Booking | null>;
  update(booking: Booking): Promise<void>;
  delete(id: BookingId): Promise<void>;

  // Query operations
  findByCustomerId(
    customerId: CustomerId,
    options?: {
      status?: BookingStatusValue[];
      limit?: number;
      offset?: number;
      orderBy?: 'createdAt' | 'startTime';
      orderDirection?: 'asc' | 'desc';
    }
  ): Promise<Booking[]>;

  findByProviderId(
    providerId: ProviderId,
    options?: {
      status?: BookingStatusValue[];
      limit?: number;
      offset?: number;
      orderBy?: 'createdAt' | 'startTime';
      orderDirection?: 'asc' | 'desc';
    }
  ): Promise<Booking[]>;

  findByTimeSlot(
    providerId: ProviderId,
    timeSlot: TimeSlot
  ): Promise<Booking[]>;

  // Conflict detection
  hasConflict(
    providerId: ProviderId,
    timeSlot: TimeSlot,
    excludeBookingId?: BookingId
  ): Promise<boolean>;

  findConflicts(
    providerId: ProviderId,
    timeSlot: TimeSlot,
    excludeBookingId?: BookingId
  ): Promise<Booking[]>;

  // Status-based queries
  findByStatus(
    status: BookingStatusValue,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<Booking[]>;

  findUpcoming(
    options?: {
      customerId?: CustomerId;
      providerId?: ProviderId;
      limit?: number;
      offset?: number;
    }
  ): Promise<Booking[]>;

  findPastDue(): Promise<Booking[]>;

  // Analytics queries
  countByStatus(
    status: BookingStatusValue,
    filters?: {
      customerId?: CustomerId;
      providerId?: ProviderId;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<number>;

  getProviderStats(
    providerId: ProviderId,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    totalRevenue: number;
    averageRating?: number;
  }>;

  // Batch operations
  saveMany(bookings: Booking[]): Promise<void>;
  
  findByIds(ids: BookingId[]): Promise<Booking[]>;

  // Payment-related queries
  findByPaymentIntentId(paymentIntentId: string): Promise<Booking | null>;
  
  findUnpaidBookings(
    cutoffTime: Date
  ): Promise<Booking[]>;

  // Availability queries
  getProviderAvailability(
    providerId: ProviderId,
    date: Date
  ): Promise<{
    bookedSlots: TimeSlot[];
    availableSlots: TimeSlot[];
  }>;
}

/**
 * Booking Query Service Interface
 * 
 * For complex queries that don't fit the repository pattern.
 */
export interface IBookingQueryService {
  searchBookings(criteria: {
    searchTerm?: string;
    customerId?: CustomerId;
    providerId?: ProviderId;
    status?: BookingStatusValue[];
    startDate?: Date;
    endDate?: Date;
    minAmount?: number;
    maxAmount?: number;
    serviceCategory?: string;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  }): Promise<{
    bookings: Booking[];
    totalCount: number;
    hasMore: boolean;
  }>;

  getBookingTimeline(
    bookingId: BookingId
  ): Promise<{
    booking: Booking;
    events: Array<{
      type: string;
      occurredAt: Date;
      details: any;
    }>;
  }>;

  getProviderCalendar(
    providerId: ProviderId,
    startDate: Date,
    endDate: Date
  ): Promise<{
    bookings: Booking[];
    availability: Array<{
      date: Date;
      slots: TimeSlot[];
    }>;
  }>;
}