/**
 * Concurrency Manager
 * Handles slot holds with TTL and capacity enforcement
 * Per Master PRD §4.6.3 and §4.7.5
 * 
 * Features:
 * - 10-minute hold TTL for payment flow
 * - Capacity enforcement per slot
 * - Redis-based distributed locking
 * - Automatic hold expiration
 */

import { Redis } from "@upstash/redis";
import { db } from "@/db/db";
import { bookingsTable, availabilityCacheTable } from "@/db/schema";
import { eq, and, or } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

/**
 * Hold information
 */
export interface SlotHold {
  id: string;
  providerId: string;
  serviceId?: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  customerId?: string;
  guestSessionId?: string;
  createdAt: Date;
  expiresAt: Date;
  status: 'active' | 'expired' | 'converted' | 'released';
}

/**
 * Hold result
 */
export interface HoldResult {
  success: boolean;
  holdId?: string;
  expiresAt?: Date;
  error?: string;
  alternativeSlots?: Array<{
    date: string;
    startTime: string;
    endTime: string;
  }>;
}

/**
 * Concurrency manager configuration
 */
export interface ConcurrencyConfig {
  holdTTLMinutes: number;
  maxHoldsPerCustomer: number;
  maxHoldsPerSession: number;
  enableStrictCapacity: boolean;
}

/**
 * Main concurrency manager class
 */
export class ConcurrencyManager {
  private redis: Redis;
  private readonly DEFAULT_HOLD_TTL_MINUTES = 10;
  private readonly MAX_HOLDS_PER_CUSTOMER = 3;
  private readonly MAX_HOLDS_PER_SESSION = 1;
  
  constructor() {
    // Initialize Redis client
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }

  /**
   * Place a hold on a time slot
   * Enforces capacity and prevents double-booking
   */
  async placeHold(params: {
    providerId: string;
    serviceId?: string;
    date: string;
    startTime: string;
    endTime: string;
    customerId?: string;
    guestSessionId?: string;
    capacity?: number;
  }): Promise<HoldResult> {
    const holdId = uuidv4();
    const holdKey = this.generateHoldKey(params);
    const customerKey = this.generateCustomerKey(params.customerId || params.guestSessionId);
    
    try {
      // 1. Check if customer/session already has maximum holds
      const existingHolds = await this.getCustomerHolds(customerKey);
      const maxHolds = params.customerId 
        ? this.MAX_HOLDS_PER_CUSTOMER 
        : this.MAX_HOLDS_PER_SESSION;
      
      if (existingHolds.length >= maxHolds) {
        return {
          success: false,
          error: `Maximum ${maxHolds} concurrent holds allowed`,
        };
      }
      
      // 2. Check slot capacity using Redis atomic operations
      const capacityKey = this.generateCapacityKey(params);
      const maxCapacity = params.capacity || 1;
      
      // Use Redis INCR with expiry for atomic capacity check
      const pipeline = this.redis.pipeline();
      pipeline.incr(capacityKey);
      pipeline.expire(capacityKey, this.DEFAULT_HOLD_TTL_MINUTES * 60);
      
      const results = await pipeline.exec();
      const currentHolds = results[0] as number;
      
      if (currentHolds > maxCapacity) {
        // Capacity exceeded, rollback
        await this.redis.decr(capacityKey);
        
        // Find alternative slots
        const alternatives = await this.findAlternativeSlots(params);
        
        return {
          success: false,
          error: 'Slot capacity exceeded',
          alternativeSlots: alternatives,
        };
      }
      
      // 3. Create hold record in Redis
      const expiresAt = new Date(Date.now() + this.DEFAULT_HOLD_TTL_MINUTES * 60 * 1000);
      const holdData: SlotHold = {
        id: holdId,
        providerId: params.providerId,
        serviceId: params.serviceId,
        date: params.date,
        startTime: params.startTime,
        endTime: params.endTime,
        customerId: params.customerId,
        guestSessionId: params.guestSessionId,
        createdAt: new Date(),
        expiresAt,
        status: 'active',
      };
      
      // Store hold data with TTL
      await this.redis.setex(
        holdKey,
        this.DEFAULT_HOLD_TTL_MINUTES * 60,
        JSON.stringify(holdData)
      );
      
      // 4. Add to customer's hold list
      await this.redis.sadd(customerKey, holdId);
      await this.redis.expire(customerKey, this.DEFAULT_HOLD_TTL_MINUTES * 60);
      
      // 5. Update availability cache in database (mark as temporarily unavailable)
      await this.updateAvailabilityCache({
        providerId: params.providerId,
        date: params.date,
        startTime: params.startTime,
        locked: true,
        holdId,
        expiresAt,
      });
      
      // 6. Schedule hold expiration check
      await this.scheduleHoldExpiration(holdId, expiresAt);
      
      return {
        success: true,
        holdId,
        expiresAt,
      };
      
    } catch (error) {
      console.error('Error placing hold:', error);
      
      // Cleanup on error
      await this.releaseHold(holdId);
      
      return {
        success: false,
        error: 'Failed to place hold',
      };
    }
  }

  /**
   * Release a hold (manual release or expiration)
   */
  async releaseHold(holdId: string, reason: 'manual' | 'expired' | 'converted' = 'manual'): Promise<boolean> {
    try {
      // 1. Get hold data
      const holdData = await this.getHold(holdId);
      if (!holdData) {
        return false; // Hold doesn't exist or already released
      }
      
      // 2. Release capacity
      const capacityKey = this.generateCapacityKey(holdData);
      await this.redis.decr(capacityKey);
      
      // 3. Remove from customer's hold list
      const customerKey = this.generateCustomerKey(holdData.customerId || holdData.guestSessionId);
      await this.redis.srem(customerKey, holdId);
      
      // 4. Delete hold record
      const holdKey = this.generateHoldKey(holdData);
      await this.redis.del(holdKey);
      
      // 5. Update availability cache (mark as available again if not converted)
      if (reason !== 'converted') {
        await this.updateAvailabilityCache({
          providerId: holdData.providerId,
          date: holdData.date,
          startTime: holdData.startTime,
          locked: false,
          holdId: null,
          expiresAt: null,
        });
      }
      
      // 6. Log hold release
      console.log(`Hold ${holdId} released: ${reason}`);
      
      return true;
    } catch (error) {
      console.error(`Error releasing hold ${holdId}:`, error);
      return false;
    }
  }

  /**
   * Convert a hold to a booking
   */
  async convertHoldToBooking(holdId: string, bookingId: string): Promise<boolean> {
    try {
      const holdData = await this.getHold(holdId);
      if (!holdData) {
        throw new Error('Hold not found or expired');
      }
      
      // Mark hold as converted
      holdData.status = 'converted';
      const holdKey = this.generateHoldKey(holdData);
      await this.redis.set(holdKey, JSON.stringify(holdData));
      
      // Release the hold but keep the slot locked
      await this.releaseHold(holdId, 'converted');
      
      // Update availability cache with booking ID
      await this.updateAvailabilityCache({
        providerId: holdData.providerId,
        date: holdData.date,
        startTime: holdData.startTime,
        locked: true,
        bookingId,
        holdId: null,
        expiresAt: null,
      });
      
      return true;
    } catch (error) {
      console.error(`Error converting hold ${holdId} to booking:`, error);
      return false;
    }
  }

  /**
   * Check if a hold is still valid
   */
  async isHoldValid(holdId: string): Promise<boolean> {
    const holdData = await this.getHold(holdId);
    if (!holdData) return false;
    
    return holdData.status === 'active' && holdData.expiresAt > new Date();
  }

  /**
   * Get hold information
   */
  private async getHold(holdId: string): Promise<SlotHold | null> {
    // Search for hold by scanning keys (not optimal, consider using a hold index)
    const pattern = `hold:*:${holdId}`;
    const keys = await this.redis.keys(pattern);
    
    if (keys.length === 0) return null;
    
    const data = await this.redis.get(keys[0]);
    return data ? JSON.parse(data as string) : null;
  }

  /**
   * Get all holds for a customer/session
   */
  private async getCustomerHolds(customerKey: string): Promise<string[]> {
    const holds = await this.redis.smembers(customerKey);
    return holds as string[];
  }

  /**
   * Find alternative available slots
   */
  private async findAlternativeSlots(params: {
    providerId: string;
    date: string;
    startTime: string;
    endTime: string;
  }): Promise<Array<{ date: string; startTime: string; endTime: string }>> {
    // TODO: Implement logic to find nearby available slots
    // For now, return empty array
    return [];
  }

  /**
   * Update availability cache in database
   */
  private async updateAvailabilityCache(params: {
    providerId: string;
    date: string;
    startTime: string;
    locked: boolean;
    holdId?: string | null;
    bookingId?: string;
    expiresAt?: Date | null;
  }): Promise<void> {
    try {
      await db
        .update(availabilityCacheTable)
        .set({
          isAvailable: !params.locked,
          lockedBySession: params.holdId,
          lockedUntil: params.expiresAt,
          bookingId: params.bookingId,
        })
        .where(
          and(
            eq(availabilityCacheTable.providerId, params.providerId),
            eq(availabilityCacheTable.date, params.date),
            eq(availabilityCacheTable.startTime, params.startTime)
          )
        );
    } catch (error) {
      console.error('Error updating availability cache:', error);
    }
  }

  /**
   * Schedule automatic hold expiration
   */
  private async scheduleHoldExpiration(holdId: string, expiresAt: Date): Promise<void> {
    // Calculate delay until expiration
    const delay = expiresAt.getTime() - Date.now();
    
    if (delay <= 0) {
      // Already expired
      await this.releaseHold(holdId, 'expired');
      return;
    }
    
    // Schedule expiration
    setTimeout(async () => {
      const stillValid = await this.isHoldValid(holdId);
      if (stillValid) {
        await this.releaseHold(holdId, 'expired');
        console.log(`Hold ${holdId} expired automatically`);
      }
    }, delay);
  }

  /**
   * Generate Redis key for hold
   */
  private generateHoldKey(params: {
    providerId: string;
    date: string;
    startTime: string;
  }): string {
    return `hold:${params.providerId}:${params.date}:${params.startTime}:${uuidv4()}`;
  }

  /**
   * Generate Redis key for capacity tracking
   */
  private generateCapacityKey(params: {
    providerId: string;
    date: string;
    startTime: string;
  }): string {
    return `capacity:${params.providerId}:${params.date}:${params.startTime}`;
  }

  /**
   * Generate Redis key for customer holds
   */
  private generateCustomerKey(identifier?: string): string {
    return `customer_holds:${identifier || 'anonymous'}`;
  }

  /**
   * Clean up expired holds (background job)
   * Should be run periodically via cron
   */
  async cleanupExpiredHolds(): Promise<number> {
    let cleanedCount = 0;
    
    try {
      // Find all hold keys
      const holdKeys = await this.redis.keys('hold:*');
      
      for (const key of holdKeys) {
        const data = await this.redis.get(key);
        if (data) {
          const hold = JSON.parse(data as string) as SlotHold;
          
          // Check if expired
          if (hold.status === 'active' && hold.expiresAt < new Date()) {
            await this.releaseHold(hold.id, 'expired');
            cleanedCount++;
          }
        }
      }
      
      console.log(`Cleaned up ${cleanedCount} expired holds`);
    } catch (error) {
      console.error('Error cleaning up expired holds:', error);
    }
    
    return cleanedCount;
  }
}

// Export singleton instance
export const concurrencyManager = new ConcurrencyManager();