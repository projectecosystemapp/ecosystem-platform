/**
 * Guest Conversion Service
 * 
 * Handles guest user authentication with magic links, account claiming, and profile migration
 * Per Master PRD §4.8: Guest Checkout & Conversion
 */

import { SignJWT, jwtVerify } from 'jose';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/db/db';
import { bookingsTable, profilesTable } from '@/db/schema';
import { eq, and, or, desc } from 'drizzle-orm';
import { emailQueue, EmailTemplate } from './email-queue';
import { Redis } from '@upstash/redis';
import { clerkClient } from '@clerk/nextjs/server';

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});

// Configuration
const MAGIC_LINK_CONFIG = {
  JWT_SECRET: new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key'),
  TOKEN_EXPIRY: 86400, // 24 hours in seconds
  LINK_BASE_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  REDIS_PREFIX: 'magic_link:',
  MAX_ATTEMPTS: 5,
  RATE_LIMIT_WINDOW: 3600, // 1 hour in seconds
};

// Magic link data interface
export interface MagicLinkData {
  id: string;
  email: string;
  guestId?: string;
  bookingId?: string;
  createdAt: Date;
  expiresAt: Date;
  used: boolean;
  attempts: number;
  metadata?: {
    source?: string;
    campaign?: string;
    referrer?: string;
  };
}

// Guest profile interface
export interface GuestProfile {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  bookings: Array<{
    id: string;
    serviceName: string;
    providerName: string;
    bookingDate: Date;
    status: string;
  }>;
  createdAt: Date;
}

// Conversion result interface
export interface ConversionResult {
  success: boolean;
  userId?: string;
  merged?: boolean;
  bookingsMigrated?: number;
  error?: string;
}

class GuestConversionService {
  /**
   * Generate a magic link for guest authentication
   */
  async generateMagicLink(
    email: string,
    options: {
      bookingId?: string;
      guestId?: string;
      metadata?: Record<string, any>;
      sendEmail?: boolean;
    } = {}
  ): Promise<{ link: string; token: string; expiresAt: Date }> {
    // Rate limiting check
    const rateLimitKey = `${MAGIC_LINK_CONFIG.REDIS_PREFIX}rate:${email}`;
    const attempts = await redis.incr(rateLimitKey);
    
    if (attempts === 1) {
      await redis.expire(rateLimitKey, MAGIC_LINK_CONFIG.RATE_LIMIT_WINDOW);
    }
    
    if (attempts > MAGIC_LINK_CONFIG.MAX_ATTEMPTS) {
      throw new Error('Too many magic link requests. Please try again later.');
    }

    // Generate unique token
    const tokenId = uuidv4();
    const expiresAt = new Date(Date.now() + MAGIC_LINK_CONFIG.TOKEN_EXPIRY * 1000);

    // Create JWT token
    const token = await new SignJWT({
      id: tokenId,
      email,
      bookingId: options.bookingId,
      guestId: options.guestId,
      metadata: options.metadata,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(expiresAt)
      .setIssuedAt()
      .sign(MAGIC_LINK_CONFIG.JWT_SECRET);

    // Store token data in Redis
    const magicLinkData: MagicLinkData = {
      id: tokenId,
      email,
      guestId: options.guestId,
      bookingId: options.bookingId,
      createdAt: new Date(),
      expiresAt,
      used: false,
      attempts: 0,
      metadata: options.metadata,
    };

    await redis.setex(
      `${MAGIC_LINK_CONFIG.REDIS_PREFIX}${tokenId}`,
      MAGIC_LINK_CONFIG.TOKEN_EXPIRY,
      JSON.stringify(magicLinkData)
    );

    // Generate the magic link
    const magicLink = `${MAGIC_LINK_CONFIG.LINK_BASE_URL}/auth/magic-link?token=${token}`;

    // Send email if requested
    if (options.sendEmail !== false) {
      // Get booking details if bookingId provided
      let bookingDetails = undefined;
      if (options.bookingId) {
        const [booking] = await db
          .select()
          .from(bookingsTable)
          .where(eq(bookingsTable.id, options.bookingId))
          .limit(1);

        if (booking) {
          bookingDetails = {
            serviceName: booking.serviceName || 'Service',
            providerName: 'Provider', // TODO: Join with providers table to get actual name
            bookingDate: booking.bookingDate,
          };
        }
      }

      await emailQueue.enqueue(
        EmailTemplate.GUEST_MAGIC_LINK,
        email,
        {
          magicLink,
          bookingDetails,
        },
        {
          priority: 'high',
          idempotencyKey: `magic_link_${tokenId}`,
          metadata: {
            tokenId,
            bookingId: options.bookingId,
          },
        }
      );
    }

    return {
      link: magicLink,
      token,
      expiresAt,
    };
  }

  /**
   * Verify and consume a magic link token
   */
  async verifyMagicLink(token: string): Promise<{
    valid: boolean;
    data?: MagicLinkData;
    error?: string;
  }> {
    try {
      // Verify JWT token
      const { payload } = await jwtVerify(token, MAGIC_LINK_CONFIG.JWT_SECRET);
      
      if (!payload.id) {
        return { valid: false, error: 'Invalid token format' };
      }

      // Get token data from Redis
      const dataStr = await redis.get(`${MAGIC_LINK_CONFIG.REDIS_PREFIX}${payload.id}`);
      
      if (!dataStr) {
        return { valid: false, error: 'Token not found or expired' };
      }

      const data = JSON.parse(dataStr as string) as MagicLinkData;

      // Check if already used
      if (data.used) {
        return { valid: false, error: 'Token already used' };
      }

      // Check expiration
      if (new Date(data.expiresAt) < new Date()) {
        return { valid: false, error: 'Token expired' };
      }

      // Mark as used
      data.used = true;
      data.attempts++;
      
      await redis.setex(
        `${MAGIC_LINK_CONFIG.REDIS_PREFIX}${payload.id}`,
        300, // Keep for 5 minutes after use for debugging
        JSON.stringify(data)
      );

      return {
        valid: true,
        data,
      };
    } catch (error) {
      console.error('Magic link verification error:', error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid token',
      };
    }
  }

  /**
   * Get guest profile by email
   */
  async getGuestProfile(email: string): Promise<GuestProfile | null> {
    // Find guest bookings
    const bookings = await db
      .select()
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.guestEmail, email),
          eq(bookingsTable.isGuestBooking, true)
        )
      )
      .orderBy(desc(bookingsTable.createdAt));

    if (bookings.length === 0) {
      return null;
    }

    // Create guest profile
    const profile: GuestProfile = {
      id: `guest_${email}`,
      email,
      name: email.split('@')[0], // Use email prefix as fallback name
      phone: undefined, // Phone not stored in current schema
      bookings: bookings.map(b => ({
        id: b.id,
        serviceName: b.serviceName || 'Service',
        providerName: 'Provider', // TODO: Join with providers table to get actual name
        bookingDate: b.bookingDate,
        status: b.status,
      })),
      createdAt: bookings[0].createdAt,
    };

    return profile;
  }

  /**
   * Convert guest to authenticated user
   */
  async convertGuestToUser(
    email: string,
    userId: string,
    options: {
      mergeExisting?: boolean;
      createProfile?: boolean;
    } = {}
  ): Promise<ConversionResult> {
    try {
      // Start transaction
      const result = await db.transaction(async (tx) => {
        // Find all guest bookings
        const guestBookings = await tx
          .select()
          .from(bookingsTable)
          .where(
            and(
              eq(bookingsTable.guestEmail, email),
              eq(bookingsTable.isGuestBooking, true)
            )
          );

        if (guestBookings.length === 0) {
          return {
            success: true,
            userId,
            merged: false,
            bookingsMigrated: 0,
          };
        }

        // Check if user already has bookings (for merge scenario)
        const existingBookings = await tx
          .select()
          .from(bookingsTable)
          .where(
            and(
              eq(bookingsTable.customerId, userId),
              eq(bookingsTable.isGuestBooking, false)
            )
          );

        const shouldMerge = options.mergeExisting && existingBookings.length > 0;

        // Update guest bookings to link with user
        for (const booking of guestBookings) {
          await tx
            .update(bookingsTable)
            .set({
              customerId: userId,
              isGuestBooking: false,
              updatedAt: new Date(),
            })
            .where(eq(bookingsTable.id, booking.id));
        }

        // Create or update user profile if requested
        if (options.createProfile) {
          const [existingProfile] = await tx
            .select()
            .from(profilesTable)
            .where(eq(profilesTable.userId, userId))
            .limit(1);

          if (!existingProfile) {
            // Create new profile
            await tx.insert(profilesTable).values({
              userId: userId,
              email,
              membership: 'free', // Default membership
            });
          } else if (shouldMerge) {
            // Update existing profile with any missing info
            const updates: any = {};
            
            // Update email if it's missing
            if (!existingProfile.email) {
              updates.email = email;
            }
            
            if (Object.keys(updates).length > 0) {
              await tx
                .update(profilesTable)
                .set({
                  ...updates,
                  updatedAt: new Date(),
                })
                .where(eq(profilesTable.userId, userId));
            }
          }
        }

        return {
          success: true,
          userId,
          merged: shouldMerge,
          bookingsMigrated: guestBookings.length,
        };
      });

      // Log the conversion
      console.log('Guest conversion successful:', {
        email,
        userId,
        bookingsMigrated: result.bookingsMigrated,
        merged: result.merged,
      });

      return result;
    } catch (error) {
      console.error('Guest conversion error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Conversion failed',
      };
    }
  }

  /**
   * Create a guest checkout session
   */
  async createGuestSession(
    email: string,
    bookingData: {
      bookingId: string;
      serviceName: string;
      providerName: string;
    }
  ): Promise<{
    sessionId: string;
    expiresAt: Date;
  }> {
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    // Store session in Redis
    await redis.setex(
      `guest_session:${sessionId}`,
      3600,
      JSON.stringify({
        email,
        bookingData,
        createdAt: new Date(),
        expiresAt,
      })
    );

    return {
      sessionId,
      expiresAt,
    };
  }

  /**
   * Validate guest session
   */
  async validateGuestSession(sessionId: string): Promise<{
    valid: boolean;
    email?: string;
    bookingData?: any;
  }> {
    const sessionStr = await redis.get(`guest_session:${sessionId}`);
    
    if (!sessionStr) {
      return { valid: false };
    }

    const session = JSON.parse(sessionStr as string);
    
    if (new Date(session.expiresAt) < new Date()) {
      await redis.del(`guest_session:${sessionId}`);
      return { valid: false };
    }

    return {
      valid: true,
      email: session.email,
      bookingData: session.bookingData,
    };
  }

  /**
   * Send account claim invitation
   */
  async sendAccountClaimInvitation(
    email: string,
    bookingIds: string[]
  ): Promise<void> {
    // Generate magic link
    const { link } = await this.generateMagicLink(email, {
      metadata: {
        action: 'claim_account',
        bookingIds,
      },
      sendEmail: false, // We'll send a custom email
    });

    // Get booking details
    const bookings = await db
      .select()
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.guestEmail, email),
          or(...bookingIds.map(id => eq(bookingsTable.id, id)))
        )
      );

    if (bookings.length === 0) {
      throw new Error('No bookings found for account claim');
    }

    // Send custom invitation email
    await emailQueue.enqueue(
      EmailTemplate.GUEST_MAGIC_LINK,
      email,
      {
        magicLink: link,
        bookingDetails: {
          serviceName: `${bookings.length} bookings`,
          providerName: 'Multiple providers',
          bookingDate: new Date(),
        },
      },
      {
        priority: 'normal',
        metadata: {
          action: 'account_claim',
          bookingCount: bookings.length,
        },
      }
    );
  }

  /**
   * Check if email has guest bookings
   */
  async hasGuestBookings(email: string): Promise<boolean> {
    const [booking] = await db
      .select({ id: bookingsTable.id })
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.guestEmail, email),
          eq(bookingsTable.isGuestBooking, true)
        )
      )
      .limit(1);

    return !!booking;
  }

  /**
   * Get guest booking statistics
   */
  async getGuestStats(email: string): Promise<{
    totalBookings: number;
    completedBookings: number;
    upcomingBookings: number;
    totalSpent: number;
    firstBookingDate?: Date;
    lastBookingDate?: Date;
  }> {
    const bookings = await db
      .select()
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.guestEmail, email),
          eq(bookingsTable.isGuestBooking, true)
        )
      )
      .orderBy(bookingsTable.createdAt);

    const now = new Date();
    const stats = {
      totalBookings: bookings.length,
      completedBookings: bookings.filter(b => b.status === 'completed').length,
      upcomingBookings: bookings.filter(
        b => b.bookingDate > now && ['confirmed', 'pending_provider'].includes(b.status)
      ).length,
      totalSpent: bookings.reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0),
      firstBookingDate: bookings[0]?.createdAt,
      lastBookingDate: bookings[bookings.length - 1]?.createdAt,
    };

    return stats;
  }

  /**
   * Clean up expired magic links
   */
  async cleanupExpiredLinks(): Promise<number> {
    // This would be called by a cron job
    // Redis automatically expires keys, but we can track cleanup stats
    const pattern = `${MAGIC_LINK_CONFIG.REDIS_PREFIX}*`;
    const keys = await redis.keys(pattern);
    
    let cleaned = 0;
    for (const key of keys) {
      const dataStr = await redis.get(key);
      if (dataStr) {
        const data = JSON.parse(dataStr as string) as MagicLinkData;
        if (new Date(data.expiresAt) < new Date()) {
          await redis.del(key);
          cleaned++;
        }
      }
    }

    return cleaned;
  }
}

// Singleton instance
export const guestConversionService = new GuestConversionService();

// Export convenience functions
export async function generateGuestMagicLink(
  email: string,
  bookingId?: string
): Promise<string> {
  const { link } = await guestConversionService.generateMagicLink(email, {
    bookingId,
    sendEmail: true,
  });
  return link;
}

export async function convertGuestAfterSignup(
  email: string,
  userId: string
): Promise<ConversionResult> {
  return guestConversionService.convertGuestToUser(email, userId, {
    mergeExisting: true,
    createProfile: true,
  });
}