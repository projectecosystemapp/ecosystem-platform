/**
 * Create Booking Use Case
 * 
 * Orchestrates the booking creation process including validation,
 * conflict checking, and event publishing.
 */

import { Result } from '@/modules/shared/domain/value-object';
import { IBookingRepository } from '../../domain/repositories/booking.repository.interface';
import { Booking, BookingId } from '../../domain/entities/booking.entity';
import { CustomerId } from '@/modules/customer/domain/value-objects/customer-id';
import { ProviderId } from '@/modules/provider/domain/value-objects/provider-id';
import { ServiceDetails } from '../../domain/value-objects/service-details';
import { TimeSlot } from '@/modules/shared/domain/value-objects/time-slot';
import { Money } from '@/modules/shared/domain/value-objects/money';
import { IEventBus } from '@/modules/shared/infrastructure/event-bus/event-bus';
import { IProviderRepository } from '@/modules/provider/domain/repositories/provider.repository.interface';
import { ICustomerRepository } from '@/modules/customer/domain/repositories/customer.repository.interface';

export interface CreateBookingRequest {
  customerId: string;
  providerId: string;
  serviceId: string;
  serviceName: string;
  serviceDescription?: string;
  servicePrice: number;
  serviceDuration: number;
  serviceCategory: string;
  startTime: Date;
  endTime: Date;
  customerNotes?: string;
  timeZone?: string;
}

export interface CreateBookingResponse {
  bookingId: string;
  confirmationCode: string;
  status: string;
  totalAmount: number;
  platformFee: number;
  providerPayout: number;
}

export class CreateBookingUseCase {
  constructor(
    private readonly bookingRepository: IBookingRepository,
    private readonly providerRepository: IProviderRepository,
    private readonly customerRepository: ICustomerRepository,
    private readonly eventBus: IEventBus
  ) {}

  async execute(request: CreateBookingRequest): Promise<Result<CreateBookingResponse>> {
    try {
      // 1. Validate customer exists
      const customerId = CustomerId.create(request.customerId);
      const customer = await this.customerRepository.findById(customerId);
      if (!customer) {
        return Result.fail('Customer not found');
      }

      // 2. Validate provider exists and is active
      const providerId = ProviderId.create(request.providerId);
      const provider = await this.providerRepository.findById(providerId);
      if (!provider) {
        return Result.fail('Provider not found');
      }
      if (!provider.isActive()) {
        return Result.fail('Provider is not currently accepting bookings');
      }

      // 3. Create value objects
      const priceResult = Money.create(request.servicePrice, 'USD');
      if (priceResult.isFailure) {
        return Result.fail(priceResult.getError());
      }

      const serviceDetailsResult = ServiceDetails.create({
        serviceId: request.serviceId,
        name: request.serviceName,
        description: request.serviceDescription,
        price: priceResult.getValue(),
        duration: request.serviceDuration,
        category: request.serviceCategory
      });

      if (serviceDetailsResult.isFailure) {
        return Result.fail(serviceDetailsResult.getError());
      }

      const timeSlotResult = TimeSlot.create(
        request.startTime,
        request.endTime,
        request.timeZone || 'UTC'
      );

      if (timeSlotResult.isFailure) {
        return Result.fail(timeSlotResult.getError());
      }

      const timeSlot = timeSlotResult.getValue();

      // 4. Check for conflicts
      const hasConflict = await this.bookingRepository.hasConflict(
        providerId,
        timeSlot
      );

      if (hasConflict) {
        const conflicts = await this.bookingRepository.findConflicts(
          providerId,
          timeSlot
        );
        
        return Result.fail(
          `Time slot is not available. ${conflicts.length} conflicting booking(s) found.`
        );
      }

      // 5. Check provider availability
      const isAvailable = await this.providerRepository.isAvailable(
        providerId,
        timeSlot
      );

      if (!isAvailable) {
        return Result.fail('Provider is not available during the selected time');
      }

      // 6. Create booking aggregate
      const bookingResult = Booking.create({
        customerId,
        providerId,
        serviceDetails: serviceDetailsResult.getValue(),
        timeSlot,
        customerNotes: request.customerNotes
      });

      if (bookingResult.isFailure) {
        return Result.fail(bookingResult.getError());
      }

      const booking = bookingResult.getValue();

      // 7. Request provider approval
      const approvalResult = booking.requestProviderApproval();
      if (approvalResult.isFailure) {
        return Result.fail(approvalResult.getError());
      }

      // 8. Validate the aggregate
      try {
        booking.validate();
      } catch (error: any) {
        return Result.fail(error.message);
      }

      // 9. Save to repository
      await this.bookingRepository.save(booking);

      // 10. Publish domain events
      const events = booking.getUncommittedEvents();
      await this.eventBus.publishBatch(events);
      booking.markEventsAsCommitted();

      // 11. Return response
      return Result.ok({
        bookingId: booking.id,
        confirmationCode: booking.confirmationCode || '',
        status: booking.status.value,
        totalAmount: booking.totalAmount.amount,
        platformFee: booking.platformFee.amount,
        providerPayout: booking.providerPayout.amount
      });

    } catch (error: any) {
      console.error('Error creating booking:', error);
      return Result.fail(`Failed to create booking: ${error.message}`);
    }
  }

  async executeWithAutoApproval(
    request: CreateBookingRequest
  ): Promise<Result<CreateBookingResponse>> {
    const bookingResult = await this.execute(request);
    
    if (bookingResult.isFailure) {
      return bookingResult;
    }

    const bookingData = bookingResult.getValue();
    
    // Auto-approve if provider has auto-approval enabled
    const providerId = ProviderId.create(request.providerId);
    const provider = await this.providerRepository.findById(providerId);
    
    if (provider?.hasAutoApproval()) {
      const approvalResult = await this.approveBooking(
        bookingData.bookingId,
        'Auto-approved by provider settings'
      );
      
      if (approvalResult.isSuccess) {
        return Result.ok({
          ...bookingData,
          status: 'ACCEPTED'
        });
      }
    }

    return bookingResult;
  }

  private async approveBooking(
    bookingId: string,
    notes: string
  ): Promise<Result<void>> {
    const booking = await this.bookingRepository.findById(bookingId as BookingId);
    
    if (!booking) {
      return Result.fail('Booking not found');
    }

    const acceptResult = booking.acceptByProvider(notes);
    if (acceptResult.isFailure) {
      return acceptResult;
    }

    await this.bookingRepository.update(booking);
    
    const events = booking.getUncommittedEvents();
    await this.eventBus.publishBatch(events);
    booking.markEventsAsCommitted();

    return Result.ok();
  }
}