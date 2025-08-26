/**
 * Booking Repository Implementation
 * 
 * Drizzle ORM implementation of the booking repository.
 */

import { db } from '@/db/db';
import { bookingsTable, BookingStatus } from '@/db/schema/enhanced-booking-schema';
import { eq, and, gte, lte, inArray, or, desc, asc } from 'drizzle-orm';
import { IBookingRepository } from '../../domain/repositories/booking.repository.interface';
import { Booking, BookingId } from '../../domain/entities/booking.entity';
import { CustomerId } from '@/modules/customer/domain/value-objects/customer-id';
import { ProviderId } from '@/modules/provider/domain/value-objects/provider-id';
import { TimeSlot } from '@/modules/shared/domain/value-objects/time-slot';
import { BookingStatusValue, BookingStatus as BookingStatusVO } from '../../domain/value-objects/booking-status';
import { BookingMapper } from '../mappers/booking.mapper';
import { EntityId } from '@/modules/shared/domain/base-entity';

export class DrizzleBookingRepository implements IBookingRepository {
  private mapper = new BookingMapper();

  async save(booking: Booking): Promise<void> {
    try {
      const data = this.mapper.toPersistence(booking);
      await db.insert(bookingsTable).values(data);
    } catch (error) {
      console.error('Error saving booking:', error);
      throw new Error('Failed to save booking');
    }
  }

  async findById(id: BookingId): Promise<Booking | null> {
    try {
      const result = await db
        .select()
        .from(bookingsTable)
        .where(eq(bookingsTable.id, id))
        .limit(1);

      if (!result || result.length === 0) {
        return null;
      }

      return this.mapper.toDomain(result[0]);
    } catch (error) {
      console.error('Error finding booking by ID:', error);
      throw new Error('Failed to find booking');
    }
  }

  async findByConfirmationCode(code: string): Promise<Booking | null> {
    try {
      const result = await db
        .select()
        .from(bookingsTable)
        .where(eq(bookingsTable.confirmationCode, code))
        .limit(1);

      if (!result || result.length === 0) {
        return null;
      }

      return this.mapper.toDomain(result[0]);
    } catch (error) {
      console.error('Error finding booking by confirmation code:', error);
      throw new Error('Failed to find booking');
    }
  }

  async update(booking: Booking): Promise<void> {
    try {
      const data = this.mapper.toPersistence(booking);
      const { id, ...updateData } = data;
      
      await db
        .update(bookingsTable)
        .set({
          ...updateData,
          updatedAt: new Date()
        })
        .where(eq(bookingsTable.id, id));
    } catch (error) {
      console.error('Error updating booking:', error);
      throw new Error('Failed to update booking');
    }
  }

  async delete(id: BookingId): Promise<void> {
    try {
      await db
        .delete(bookingsTable)
        .where(eq(bookingsTable.id, id));
    } catch (error) {
      console.error('Error deleting booking:', error);
      throw new Error('Failed to delete booking');
    }
  }

  async findByCustomerId(
    customerId: CustomerId,
    options?: {
      status?: BookingStatusValue[];
      limit?: number;
      offset?: number;
      orderBy?: 'createdAt' | 'startTime';
      orderDirection?: 'asc' | 'desc';
    }
  ): Promise<Booking[]> {
    try {
      let query = db
        .select()
        .from(bookingsTable)
        .where(eq(bookingsTable.customerId, customerId.value));

      if (options?.status && options.status.length > 0) {
        query = query.where(
          and(
            eq(bookingsTable.customerId, customerId.value),
            inArray(bookingsTable.status, options.status as any)
          )
        );
      }

      // Apply ordering
      const orderColumn = options?.orderBy === 'startTime' 
        ? bookingsTable.startTime 
        : bookingsTable.createdAt;
      
      query = options?.orderDirection === 'asc'
        ? query.orderBy(asc(orderColumn))
        : query.orderBy(desc(orderColumn));

      // Apply pagination
      if (options?.limit) {
        query = query.limit(options.limit);
      }
      if (options?.offset) {
        query = query.offset(options.offset);
      }

      const results = await query;
      return Promise.all(results.map(r => this.mapper.toDomain(r)));
    } catch (error) {
      console.error('Error finding bookings by customer ID:', error);
      throw new Error('Failed to find customer bookings');
    }
  }

  async findByProviderId(
    providerId: ProviderId,
    options?: {
      status?: BookingStatusValue[];
      limit?: number;
      offset?: number;
      orderBy?: 'createdAt' | 'startTime';
      orderDirection?: 'asc' | 'desc';
    }
  ): Promise<Booking[]> {
    try {
      let query = db
        .select()
        .from(bookingsTable)
        .where(eq(bookingsTable.providerId, providerId.value));

      if (options?.status && options.status.length > 0) {
        query = query.where(
          and(
            eq(bookingsTable.providerId, providerId.value),
            inArray(bookingsTable.status, options.status as any)
          )
        );
      }

      // Apply ordering
      const orderColumn = options?.orderBy === 'startTime' 
        ? bookingsTable.startTime 
        : bookingsTable.createdAt;
      
      query = options?.orderDirection === 'asc'
        ? query.orderBy(asc(orderColumn))
        : query.orderBy(desc(orderColumn));

      // Apply pagination
      if (options?.limit) {
        query = query.limit(options.limit);
      }
      if (options?.offset) {
        query = query.offset(options.offset);
      }

      const results = await query;
      return Promise.all(results.map(r => this.mapper.toDomain(r)));
    } catch (error) {
      console.error('Error finding bookings by provider ID:', error);
      throw new Error('Failed to find provider bookings');
    }
  }

  async findByTimeSlot(
    providerId: ProviderId,
    timeSlot: TimeSlot
  ): Promise<Booking[]> {
    try {
      const results = await db
        .select()
        .from(bookingsTable)
        .where(
          and(
            eq(bookingsTable.providerId, providerId.value),
            lte(bookingsTable.startTime, timeSlot.endTime),
            gte(bookingsTable.endTime, timeSlot.startTime)
          )
        );

      return Promise.all(results.map(r => this.mapper.toDomain(r)));
    } catch (error) {
      console.error('Error finding bookings by time slot:', error);
      throw new Error('Failed to find bookings');
    }
  }

  async hasConflict(
    providerId: ProviderId,
    timeSlot: TimeSlot,
    excludeBookingId?: BookingId
  ): Promise<boolean> {
    try {
      let query = db
        .select()
        .from(bookingsTable)
        .where(
          and(
            eq(bookingsTable.providerId, providerId.value),
            lte(bookingsTable.startTime, timeSlot.endTime),
            gte(bookingsTable.endTime, timeSlot.startTime),
            inArray(bookingsTable.status, [
              BookingStatus.ACCEPTED,
              BookingStatus.PAYMENT_PENDING,
              BookingStatus.PAYMENT_SUCCEEDED,
              BookingStatus.COMPLETED
            ] as any)
          )
        )
        .limit(1);

      if (excludeBookingId) {
        query = query.where(
          and(
            eq(bookingsTable.providerId, providerId.value),
            lte(bookingsTable.startTime, timeSlot.endTime),
            gte(bookingsTable.endTime, timeSlot.startTime),
            inArray(bookingsTable.status, [
              BookingStatus.ACCEPTED,
              BookingStatus.PAYMENT_PENDING,
              BookingStatus.PAYMENT_SUCCEEDED,
              BookingStatus.COMPLETED
            ] as any),
            eq(bookingsTable.id, excludeBookingId).not()
          )
        );
      }

      const result = await query;
      return result.length > 0;
    } catch (error) {
      console.error('Error checking for conflicts:', error);
      throw new Error('Failed to check conflicts');
    }
  }

  async findConflicts(
    providerId: ProviderId,
    timeSlot: TimeSlot,
    excludeBookingId?: BookingId
  ): Promise<Booking[]> {
    try {
      let conditions = and(
        eq(bookingsTable.providerId, providerId.value),
        lte(bookingsTable.startTime, timeSlot.endTime),
        gte(bookingsTable.endTime, timeSlot.startTime),
        inArray(bookingsTable.status, [
          BookingStatus.ACCEPTED,
          BookingStatus.PAYMENT_PENDING,
          BookingStatus.PAYMENT_SUCCEEDED,
          BookingStatus.COMPLETED
        ] as any)
      );

      if (excludeBookingId) {
        conditions = and(
          conditions,
          eq(bookingsTable.id, excludeBookingId).not()
        );
      }

      const results = await db
        .select()
        .from(bookingsTable)
        .where(conditions);

      return Promise.all(results.map(r => this.mapper.toDomain(r)));
    } catch (error) {
      console.error('Error finding conflicts:', error);
      throw new Error('Failed to find conflicts');
    }
  }

  async findByStatus(
    status: BookingStatusValue,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<Booking[]> {
    try {
      let query = db
        .select()
        .from(bookingsTable)
        .where(eq(bookingsTable.status, status as any))
        .orderBy(desc(bookingsTable.createdAt));

      if (options?.limit) {
        query = query.limit(options.limit);
      }
      if (options?.offset) {
        query = query.offset(options.offset);
      }

      const results = await query;
      return Promise.all(results.map(r => this.mapper.toDomain(r)));
    } catch (error) {
      console.error('Error finding bookings by status:', error);
      throw new Error('Failed to find bookings');
    }
  }

  async findUpcoming(
    options?: {
      customerId?: CustomerId;
      providerId?: ProviderId;
      limit?: number;
      offset?: number;
    }
  ): Promise<Booking[]> {
    try {
      const now = new Date();
      let conditions = and(
        gte(bookingsTable.startTime, now),
        inArray(bookingsTable.status, [
          BookingStatus.ACCEPTED,
          BookingStatus.PAYMENT_SUCCEEDED
        ] as any)
      );

      if (options?.customerId) {
        conditions = and(
          conditions,
          eq(bookingsTable.customerId, options.customerId.value)
        );
      }

      if (options?.providerId) {
        conditions = and(
          conditions,
          eq(bookingsTable.providerId, options.providerId.value)
        );
      }

      let query = db
        .select()
        .from(bookingsTable)
        .where(conditions)
        .orderBy(asc(bookingsTable.startTime));

      if (options?.limit) {
        query = query.limit(options.limit);
      }
      if (options?.offset) {
        query = query.offset(options.offset);
      }

      const results = await query;
      return Promise.all(results.map(r => this.mapper.toDomain(r)));
    } catch (error) {
      console.error('Error finding upcoming bookings:', error);
      throw new Error('Failed to find upcoming bookings');
    }
  }

  async findPastDue(): Promise<Booking[]> {
    try {
      const now = new Date();
      const results = await db
        .select()
        .from(bookingsTable)
        .where(
          and(
            lte(bookingsTable.endTime, now),
            inArray(bookingsTable.status, [
              BookingStatus.ACCEPTED,
              BookingStatus.PAYMENT_SUCCEEDED
            ] as any)
          )
        )
        .orderBy(desc(bookingsTable.endTime));

      return Promise.all(results.map(r => this.mapper.toDomain(r)));
    } catch (error) {
      console.error('Error finding past due bookings:', error);
      throw new Error('Failed to find past due bookings');
    }
  }

  async countByStatus(
    status: BookingStatusValue,
    filters?: {
      customerId?: CustomerId;
      providerId?: ProviderId;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<number> {
    try {
      let conditions = eq(bookingsTable.status, status as any);

      if (filters?.customerId) {
        conditions = and(
          conditions,
          eq(bookingsTable.customerId, filters.customerId.value)
        );
      }

      if (filters?.providerId) {
        conditions = and(
          conditions,
          eq(bookingsTable.providerId, filters.providerId.value)
        );
      }

      if (filters?.startDate) {
        conditions = and(
          conditions,
          gte(bookingsTable.createdAt, filters.startDate)
        );
      }

      if (filters?.endDate) {
        conditions = and(
          conditions,
          lte(bookingsTable.createdAt, filters.endDate)
        );
      }

      const result = await db
        .select({ count: bookingsTable.id })
        .from(bookingsTable)
        .where(conditions);

      return result.length;
    } catch (error) {
      console.error('Error counting bookings by status:', error);
      throw new Error('Failed to count bookings');
    }
  }

  async getProviderStats(
    providerId: ProviderId,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    totalRevenue: number;
    averageRating?: number;
  }> {
    // Implementation would involve complex queries
    // Simplified for now
    return {
      totalBookings: 0,
      completedBookings: 0,
      cancelledBookings: 0,
      totalRevenue: 0,
      averageRating: undefined
    };
  }

  async saveMany(bookings: Booking[]): Promise<void> {
    try {
      const data = bookings.map(b => this.mapper.toPersistence(b));
      await db.insert(bookingsTable).values(data);
    } catch (error) {
      console.error('Error saving multiple bookings:', error);
      throw new Error('Failed to save bookings');
    }
  }

  async findByIds(ids: BookingId[]): Promise<Booking[]> {
    try {
      const results = await db
        .select()
        .from(bookingsTable)
        .where(inArray(bookingsTable.id, ids));

      return Promise.all(results.map(r => this.mapper.toDomain(r)));
    } catch (error) {
      console.error('Error finding bookings by IDs:', error);
      throw new Error('Failed to find bookings');
    }
  }

  async findByPaymentIntentId(paymentIntentId: string): Promise<Booking | null> {
    try {
      const result = await db
        .select()
        .from(bookingsTable)
        .where(eq(bookingsTable.stripePaymentIntentId, paymentIntentId))
        .limit(1);

      if (!result || result.length === 0) {
        return null;
      }

      return this.mapper.toDomain(result[0]);
    } catch (error) {
      console.error('Error finding booking by payment intent ID:', error);
      throw new Error('Failed to find booking');
    }
  }

  async findUnpaidBookings(cutoffTime: Date): Promise<Booking[]> {
    try {
      const results = await db
        .select()
        .from(bookingsTable)
        .where(
          and(
            eq(bookingsTable.status, BookingStatus.ACCEPTED as any),
            lte(bookingsTable.createdAt, cutoffTime)
          )
        )
        .orderBy(asc(bookingsTable.createdAt));

      return Promise.all(results.map(r => this.mapper.toDomain(r)));
    } catch (error) {
      console.error('Error finding unpaid bookings:', error);
      throw new Error('Failed to find unpaid bookings');
    }
  }

  async getProviderAvailability(
    providerId: ProviderId,
    date: Date
  ): Promise<{
    bookedSlots: TimeSlot[];
    availableSlots: TimeSlot[];
  }> {
    // Implementation would involve complex availability calculation
    // Simplified for now
    return {
      bookedSlots: [],
      availableSlots: []
    };
  }
}