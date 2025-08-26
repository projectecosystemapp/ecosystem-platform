/**
 * Booking Application Service
 * 
 * Orchestrates booking operations and coordinates between use cases.
 */

import { Result } from '@/modules/shared/domain/value-object';
import { IBookingRepository } from '../../domain/repositories/booking.repository.interface';
import { Booking, BookingId } from '../../domain/entities/booking.entity';
import { IEventBus } from '@/modules/shared/infrastructure/event-bus/event-bus';
import { CreateBookingUseCase, CreateBookingRequest, CreateBookingResponse } from '../use-cases/create-booking.use-case';
import { IProviderRepository } from '@/modules/provider/domain/repositories/provider.repository.interface';
import { ICustomerRepository } from '@/modules/customer/domain/repositories/customer.repository.interface';
import { CustomerId } from '@/modules/customer/domain/value-objects/customer-id';
import { ProviderId } from '@/modules/provider/domain/value-objects/provider-id';
import { BookingStatusValue } from '../../domain/value-objects/booking-status';

export interface BookingServiceDependencies {
  bookingRepository: IBookingRepository;
  providerRepository: IProviderRepository;
  customerRepository: ICustomerRepository;
  eventBus: IEventBus;
}

export class BookingService {
  private readonly createBookingUseCase: CreateBookingUseCase;
  
  constructor(private readonly dependencies: BookingServiceDependencies) {
    this.createBookingUseCase = new CreateBookingUseCase(
      dependencies.bookingRepository,
      dependencies.providerRepository,
      dependencies.customerRepository,
      dependencies.eventBus
    );
  }

  // Create new booking
  async createBooking(request: CreateBookingRequest): Promise<Result<CreateBookingResponse>> {
    return this.createBookingUseCase.execute(request);
  }

  // Create booking with auto-approval
  async createBookingWithAutoApproval(
    request: CreateBookingRequest
  ): Promise<Result<CreateBookingResponse>> {
    return this.createBookingUseCase.executeWithAutoApproval(request);
  }

  // Get booking by ID
  async getBookingById(bookingId: string): Promise<Result<Booking>> {
    try {
      const booking = await this.dependencies.bookingRepository.findById(
        EntityId.create<BookingId>(bookingId)
      );
      
      if (!booking) {
        return Result.fail('Booking not found');
      }
      
      return Result.ok(booking);
    } catch (error: any) {
      return Result.fail(`Failed to retrieve booking: ${error.message}`);
    }
  }

  // Get booking by confirmation code
  async getBookingByConfirmationCode(code: string): Promise<Result<Booking>> {
    try {
      const booking = await this.dependencies.bookingRepository.findByConfirmationCode(code);
      
      if (!booking) {
        return Result.fail('Booking not found with this confirmation code');
      }
      
      return Result.ok(booking);
    } catch (error: any) {
      return Result.fail(`Failed to retrieve booking: ${error.message}`);
    }
  }

  // Accept booking (provider action)
  async acceptBooking(
    bookingId: string,
    providerId: string,
    notes?: string
  ): Promise<Result<void>> {
    try {
      const booking = await this.dependencies.bookingRepository.findById(
        EntityId.create<BookingId>(bookingId)
      );
      
      if (!booking) {
        return Result.fail('Booking not found');
      }

      // Verify provider owns this booking
      if (booking.providerId.value !== providerId) {
        return Result.fail('You are not authorized to accept this booking');
      }

      const result = booking.acceptByProvider(notes);
      if (result.isFailure) {
        return result;
      }

      await this.dependencies.bookingRepository.update(booking);
      
      // Publish events
      const events = booking.getUncommittedEvents();
      await this.dependencies.eventBus.publishBatch(events);
      booking.markEventsAsCommitted();

      return Result.ok();
    } catch (error: any) {
      return Result.fail(`Failed to accept booking: ${error.message}`);
    }
  }

  // Reject booking (provider action)
  async rejectBooking(
    bookingId: string,
    providerId: string,
    reason: string
  ): Promise<Result<void>> {
    try {
      const booking = await this.dependencies.bookingRepository.findById(
        EntityId.create<BookingId>(bookingId)
      );
      
      if (!booking) {
        return Result.fail('Booking not found');
      }

      // Verify provider owns this booking
      if (booking.providerId.value !== providerId) {
        return Result.fail('You are not authorized to reject this booking');
      }

      const result = booking.rejectByProvider(reason);
      if (result.isFailure) {
        return result;
      }

      await this.dependencies.bookingRepository.update(booking);
      
      // Publish events
      const events = booking.getUncommittedEvents();
      await this.dependencies.eventBus.publishBatch(events);
      booking.markEventsAsCommitted();

      return Result.ok();
    } catch (error: any) {
      return Result.fail(`Failed to reject booking: ${error.message}`);
    }
  }

  // Cancel booking
  async cancelBooking(
    bookingId: string,
    userId: string,
    reason: string
  ): Promise<Result<{ refundRequired: boolean; refundAmount?: number }>> {
    try {
      const booking = await this.dependencies.bookingRepository.findById(
        EntityId.create<BookingId>(bookingId)
      );
      
      if (!booking) {
        return Result.fail('Booking not found');
      }

      // Determine who is cancelling
      let cancelledBy: 'customer' | 'provider' | 'system';
      if (booking.customerId.value === userId) {
        cancelledBy = 'customer';
      } else if (booking.providerId.value === userId) {
        cancelledBy = 'provider';
      } else {
        return Result.fail('You are not authorized to cancel this booking');
      }

      if (!booking.canBeCancelled()) {
        return Result.fail('This booking cannot be cancelled in its current status');
      }

      const shouldRefund = booking.shouldRefund();
      const refundAmount = shouldRefund ? booking.totalAmount.amount : undefined;

      const result = booking.cancel(reason, cancelledBy);
      if (result.isFailure) {
        return result;
      }

      await this.dependencies.bookingRepository.update(booking);
      
      // Publish events
      const events = booking.getUncommittedEvents();
      await this.dependencies.eventBus.publishBatch(events);
      booking.markEventsAsCommitted();

      return Result.ok({
        refundRequired: shouldRefund,
        refundAmount
      });
    } catch (error: any) {
      return Result.fail(`Failed to cancel booking: ${error.message}`);
    }
  }

  // Process payment
  async processPayment(
    bookingId: string,
    paymentIntentId: string
  ): Promise<Result<void>> {
    try {
      const booking = await this.dependencies.bookingRepository.findById(
        EntityId.create<BookingId>(bookingId)
      );
      
      if (!booking) {
        return Result.fail('Booking not found');
      }

      const initiateResult = booking.initiatePayment(paymentIntentId);
      if (initiateResult.isFailure) {
        return initiateResult;
      }

      await this.dependencies.bookingRepository.update(booking);

      return Result.ok();
    } catch (error: any) {
      return Result.fail(`Failed to process payment: ${error.message}`);
    }
  }

  // Confirm payment success
  async confirmPayment(bookingId: string): Promise<Result<void>> {
    try {
      const booking = await this.dependencies.bookingRepository.findById(
        EntityId.create<BookingId>(bookingId)
      );
      
      if (!booking) {
        return Result.fail('Booking not found');
      }

      const result = booking.confirmPayment();
      if (result.isFailure) {
        return result;
      }

      await this.dependencies.bookingRepository.update(booking);
      
      // Publish events
      const events = booking.getUncommittedEvents();
      await this.dependencies.eventBus.publishBatch(events);
      booking.markEventsAsCommitted();

      return Result.ok();
    } catch (error: any) {
      return Result.fail(`Failed to confirm payment: ${error.message}`);
    }
  }

  // Handle payment failure
  async handlePaymentFailure(bookingId: string): Promise<Result<void>> {
    try {
      const booking = await this.dependencies.bookingRepository.findById(
        EntityId.create<BookingId>(bookingId)
      );
      
      if (!booking) {
        return Result.fail('Booking not found');
      }

      const result = booking.handlePaymentFailure();
      if (result.isFailure) {
        return result;
      }

      await this.dependencies.bookingRepository.update(booking);

      return Result.ok();
    } catch (error: any) {
      return Result.fail(`Failed to handle payment failure: ${error.message}`);
    }
  }

  // Complete booking
  async completeBooking(bookingId: string): Promise<Result<void>> {
    try {
      const booking = await this.dependencies.bookingRepository.findById(
        EntityId.create<BookingId>(bookingId)
      );
      
      if (!booking) {
        return Result.fail('Booking not found');
      }

      const result = booking.complete();
      if (result.isFailure) {
        return result;
      }

      await this.dependencies.bookingRepository.update(booking);
      
      // Publish events
      const events = booking.getUncommittedEvents();
      await this.dependencies.eventBus.publishBatch(events);
      booking.markEventsAsCommitted();

      return Result.ok();
    } catch (error: any) {
      return Result.fail(`Failed to complete booking: ${error.message}`);
    }
  }

  // Get customer bookings
  async getCustomerBookings(
    customerId: string,
    options?: {
      status?: BookingStatusValue[];
      limit?: number;
      offset?: number;
    }
  ): Promise<Result<Booking[]>> {
    try {
      const bookings = await this.dependencies.bookingRepository.findByCustomerId(
        CustomerId.create(customerId),
        options
      );
      
      return Result.ok(bookings);
    } catch (error: any) {
      return Result.fail(`Failed to retrieve customer bookings: ${error.message}`);
    }
  }

  // Get provider bookings
  async getProviderBookings(
    providerId: string,
    options?: {
      status?: BookingStatusValue[];
      limit?: number;
      offset?: number;
    }
  ): Promise<Result<Booking[]>> {
    try {
      const bookings = await this.dependencies.bookingRepository.findByProviderId(
        ProviderId.create(providerId),
        options
      );
      
      return Result.ok(bookings);
    } catch (error: any) {
      return Result.fail(`Failed to retrieve provider bookings: ${error.message}`);
    }
  }

  // Get upcoming bookings
  async getUpcomingBookings(
    userId: string,
    userType: 'customer' | 'provider',
    limit: number = 10
  ): Promise<Result<Booking[]>> {
    try {
      const options = userType === 'customer' 
        ? { customerId: CustomerId.create(userId) }
        : { providerId: ProviderId.create(userId) };

      const bookings = await this.dependencies.bookingRepository.findUpcoming({
        ...options,
        limit
      });
      
      return Result.ok(bookings);
    } catch (error: any) {
      return Result.fail(`Failed to retrieve upcoming bookings: ${error.message}`);
    }
  }

  // Check for conflicts
  async checkAvailability(
    providerId: string,
    startTime: Date,
    endTime: Date,
    timeZone: string = 'UTC'
  ): Promise<Result<{ available: boolean; conflicts?: any[] }>> {
    try {
      const timeSlotResult = TimeSlot.create(startTime, endTime, timeZone);
      if (timeSlotResult.isFailure) {
        return Result.fail(timeSlotResult.getError());
      }

      const providerIdObj = ProviderId.create(providerId);
      const hasConflict = await this.dependencies.bookingRepository.hasConflict(
        providerIdObj,
        timeSlotResult.getValue()
      );

      if (hasConflict) {
        const conflicts = await this.dependencies.bookingRepository.findConflicts(
          providerIdObj,
          timeSlotResult.getValue()
        );
        
        return Result.ok({
          available: false,
          conflicts: conflicts.map(b => b.toPrimitives())
        });
      }

      return Result.ok({ available: true });
    } catch (error: any) {
      return Result.fail(`Failed to check availability: ${error.message}`);
    }
  }
}

// Import necessary modules
import { EntityId } from '@/modules/shared/domain/base-entity';
import { TimeSlot } from '@/modules/shared/domain/value-objects/time-slot';