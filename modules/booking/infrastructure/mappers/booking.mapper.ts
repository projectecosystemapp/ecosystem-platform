/**
 * Booking Mapper
 * 
 * Maps between domain entities and persistence models.
 */

import { Booking, BookingId } from '../../domain/entities/booking.entity';
import { BookingStatus } from '../../domain/value-objects/booking-status';
import { ServiceDetails } from '../../domain/value-objects/service-details';
import { CustomerId } from '@/modules/customer/domain/value-objects/customer-id';
import { ProviderId } from '@/modules/provider/domain/value-objects/provider-id';
import { Money } from '@/modules/shared/domain/value-objects/money';
import { TimeSlot } from '@/modules/shared/domain/value-objects/time-slot';
import { EntityId } from '@/modules/shared/domain/base-entity';
import { Result } from '@/modules/shared/domain/value-object';

export class BookingMapper {
  /**
   * Convert domain entity to persistence model
   */
  toPersistence(booking: Booking): any {
    const primitives = booking.toPrimitives();
    
    return {
      id: primitives.id,
      customerId: primitives.customerId,
      providerId: primitives.providerId,
      
      // Service details
      serviceId: primitives.serviceDetails.serviceId,
      serviceName: primitives.serviceDetails.name,
      serviceDescription: primitives.serviceDetails.description,
      servicePrice: primitives.serviceDetails.price,
      serviceDuration: primitives.serviceDetails.duration,
      serviceCategory: primitives.serviceDetails.category,
      
      // Time slot
      startTime: new Date(primitives.timeSlot.startTime),
      endTime: new Date(primitives.timeSlot.endTime),
      timeZone: primitives.timeSlot.timeZone,
      
      // Money
      totalAmount: primitives.totalAmount,
      platformFee: primitives.platformFee,
      providerPayout: primitives.providerPayout,
      currency: 'USD', // Get from money value object
      
      // Status
      status: primitives.status,
      
      // Additional fields
      customerNotes: primitives.customerNotes,
      providerNotes: primitives.providerNotes,
      cancellationReason: primitives.cancellationReason,
      cancelledBy: primitives.cancelledBy,
      stripePaymentIntentId: primitives.paymentIntentId,
      confirmationCode: primitives.confirmationCode,
      metadata: primitives.metadata ? JSON.stringify(primitives.metadata) : null,
      
      // Audit fields
      version: primitives.version,
      createdAt: new Date(primitives.createdAt),
      updatedAt: new Date(primitives.updatedAt)
    };
  }

  /**
   * Convert persistence model to domain entity
   */
  async toDomain(raw: any): Promise<Booking> {
    try {
      // Reconstruct value objects
      const customerId = CustomerId.create(raw.customerId);
      const providerId = ProviderId.create(raw.providerId);
      
      const priceResult = Money.create(
        parseFloat(raw.servicePrice),
        raw.currency || 'USD'
      );
      
      if (priceResult.isFailure) {
        throw new Error(`Failed to create price: ${priceResult.getError()}`);
      }

      const serviceDetailsResult = ServiceDetails.create({
        serviceId: raw.serviceId,
        name: raw.serviceName,
        description: raw.serviceDescription,
        price: priceResult.getValue(),
        duration: raw.serviceDuration,
        category: raw.serviceCategory,
        requirements: raw.serviceRequirements ? JSON.parse(raw.serviceRequirements) : undefined,
        includedItems: raw.serviceIncludedItems ? JSON.parse(raw.serviceIncludedItems) : undefined
      });

      if (serviceDetailsResult.isFailure) {
        throw new Error(`Failed to create service details: ${serviceDetailsResult.getError()}`);
      }

      const timeSlotResult = TimeSlot.create(
        new Date(raw.startTime),
        new Date(raw.endTime),
        raw.timeZone || 'UTC'
      );

      if (timeSlotResult.isFailure) {
        throw new Error(`Failed to create time slot: ${timeSlotResult.getError()}`);
      }

      const totalAmountResult = Money.create(
        parseFloat(raw.totalAmount),
        raw.currency || 'USD'
      );

      if (totalAmountResult.isFailure) {
        throw new Error(`Failed to create total amount: ${totalAmountResult.getError()}`);
      }

      const platformFeeResult = Money.create(
        parseFloat(raw.platformFee),
        raw.currency || 'USD'
      );

      if (platformFeeResult.isFailure) {
        throw new Error(`Failed to create platform fee: ${platformFeeResult.getError()}`);
      }

      const providerPayoutResult = Money.create(
        parseFloat(raw.providerPayout),
        raw.currency || 'USD'
      );

      if (providerPayoutResult.isFailure) {
        throw new Error(`Failed to create provider payout: ${providerPayoutResult.getError()}`);
      }

      const status = BookingStatus.create(raw.status);

      // Reconstitute the aggregate
      const booking = Booking.reconstitute(
        {
          customerId,
          providerId,
          serviceDetails: serviceDetailsResult.getValue(),
          timeSlot: timeSlotResult.getValue(),
          totalAmount: totalAmountResult.getValue(),
          platformFee: platformFeeResult.getValue(),
          providerPayout: providerPayoutResult.getValue(),
          status,
          customerNotes: raw.customerNotes,
          providerNotes: raw.providerNotes,
          cancellationReason: raw.cancellationReason,
          cancelledBy: raw.cancelledBy,
          paymentIntentId: raw.stripePaymentIntentId,
          confirmationCode: raw.confirmationCode,
          metadata: raw.metadata ? JSON.parse(raw.metadata) : undefined
        },
        EntityId.create<BookingId>(raw.id)
      );

      // Restore audit fields
      (booking as any)._version = raw.version || 0;
      (booking as any)._createdAt = new Date(raw.createdAt);
      (booking as any)._updatedAt = new Date(raw.updatedAt);

      return booking;
    } catch (error: any) {
      console.error('Error mapping booking from persistence:', error);
      throw new Error(`Failed to map booking: ${error.message}`);
    }
  }

  /**
   * Convert multiple persistence models to domain entities
   */
  async toDomainMany(raws: any[]): Promise<Booking[]> {
    return Promise.all(raws.map(raw => this.toDomain(raw)));
  }

  /**
   * Convert multiple domain entities to persistence models
   */
  toPersistenceMany(bookings: Booking[]): any[] {
    return bookings.map(booking => this.toPersistence(booking));
  }
}