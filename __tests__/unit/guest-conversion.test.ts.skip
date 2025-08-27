/**
 * Guest Conversion Service Test Suite
 * Tests magic link generation, token verification, guest profile retrieval,
 * account claiming, and booking migration
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { 
  guestConversionService,
  generateGuestMagicLink,
  convertGuestAfterSignup,
  type GuestProfile,
  type ConversionResult,
} from '@/lib/services/guest-conversion-service';
import { SignJWT, jwtVerify } from 'jose';
import { db } from '@/db/db';
import { emailQueue, EmailTemplate } from '@/lib/services/email-queue';
import { Redis } from '@upstash/redis';

// Mock dependencies
jest.mock('jose');
jest.mock('@/db/db');
jest.mock('@/lib/services/email-queue');
jest.mock('@upstash/redis');
jest.mock('@clerk/nextjs/server');

const mockSignJWT = SignJWT as jest.MockedClass<typeof SignJWT>;
const mockJwtVerify = jwtVerify as jest.MockedFunction<typeof jwtVerify>;
const mockDb = db as jest.Mocked<typeof db>;
const mockEmailQueue = emailQueue as jest.Mocked<typeof emailQueue>;
const MockRedis = Redis as jest.MockedClass<typeof Redis>;

describe('GuestConversionService', () => {
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    // Setup environment variables
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    process.env.UPSTASH_REDIS_URL = 'redis://test';
    process.env.UPSTASH_REDIS_TOKEN = 'test-token';

    // Create mocked Redis instance
    mockRedis = {
      incr: jest.fn(),
      expire: jest.fn(),
      setex: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
    } as any;

    MockRedis.mockImplementation(() => mockRedis);

    // Setup common mocks
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue(1);
    mockRedis.setex.mockResolvedValue('OK');
    mockRedis.get.mockResolvedValue(null);

    // Mock SignJWT
    const mockJWTInstance = {
      setProtectedHeader: jest.fn().mockReturnThis(),
      setExpirationTime: jest.fn().mockReturnThis(),
      setIssuedAt: jest.fn().mockReturnThis(),
      sign: jest.fn().mockResolvedValue('test-jwt-token'),
    };
    mockSignJWT.mockImplementation(() => mockJWTInstance as any);

    // Mock database
    mockDb.select = jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([]),
          }),
          orderBy: jest.fn().mockResolvedValue([]),
        }),
      }),
    });

    mockDb.transaction = jest.fn().mockImplementation((callback) => callback(mockDb));
    mockDb.update = jest.fn().mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      }),
    });
    mockDb.insert = jest.fn().mockReturnValue({
      values: jest.fn().mockResolvedValue(undefined),
    });

    // Mock email queue
    mockEmailQueue.enqueue = jest.fn().mockResolvedValue(undefined);

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Magic Link Generation', () => {
    it('should generate magic link successfully', async () => {
      const result = await guestConversionService.generateMagicLink(
        'guest@example.com',
        { sendEmail: false }
      );

      expect(result.link).toContain('http://localhost:3000/auth/magic-link?token=');
      expect(result.token).toBe('test-jwt-token');
      expect(result.expiresAt).toBeInstanceOf(Date);

      // Should store in Redis
      expect(mockRedis.setex).toHaveBeenCalled();
      
      // Should not send email when disabled
      expect(mockEmailQueue.enqueue).not.toHaveBeenCalled();
    });

    it('should include booking information in magic link', async () => {
      const mockBooking = {
        id: 'booking-123',
        serviceName: 'Yoga Class',
        providerId: 'provider-123',
        bookingDate: '2024-03-01',
      };

      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockBooking]),
          }),
        }),
      });

      const result = await guestConversionService.generateMagicLink(
        'guest@example.com',
        { bookingId: 'booking-123', sendEmail: true }
      );

      expect(result.link).toBeDefined();
      
      // Should send email with booking details
      expect(mockEmailQueue.enqueue).toHaveBeenCalledWith(
        EmailTemplate.GUEST_MAGIC_LINK,
        'guest@example.com',
        expect.objectContaining({
          magicLink: result.link,
          bookingDetails: expect.objectContaining({
            serviceName: 'Yoga Class',
          }),
        }),
        expect.any(Object)
      );
    });

    it('should enforce rate limiting', async () => {
      // Simulate too many requests
      mockRedis.incr.mockResolvedValue(6); // Over the limit of 5

      await expect(guestConversionService.generateMagicLink('guest@example.com'))
        .rejects.toThrow('Too many magic link requests');
    });

    it('should set rate limit expiration on first request', async () => {
      mockRedis.incr.mockResolvedValue(1);

      await guestConversionService.generateMagicLink(
        'guest@example.com',
        { sendEmail: false }
      );

      expect(mockRedis.expire).toHaveBeenCalledWith(
        'magic_link:rate:guest@example.com',
        3600
      );
    });

    it('should handle metadata in magic link', async () => {
      const metadata = {
        source: 'booking_completion',
        campaign: 'welcome_series',
        referrer: 'google',
      };

      await guestConversionService.generateMagicLink(
        'guest@example.com',
        { metadata, sendEmail: false }
      );

      // JWT should include metadata
      expect(mockSignJWT).toHaveBeenCalled();
      const jwtCall = (mockSignJWT as jest.Mock).mock.calls[0][0];
      expect(jwtCall.metadata).toEqual(metadata);
    });
  });

  describe('Magic Link Verification', () => {
    const mockTokenData = {
      id: 'token-123',
      email: 'guest@example.com',
      bookingId: 'booking-123',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      used: false,
      attempts: 0,
    };

    beforeEach(() => {
      mockJwtVerify.mockResolvedValue({
        payload: { id: 'token-123' },
        protectedHeader: {},
      } as any);

      mockRedis.get.mockResolvedValue(JSON.stringify(mockTokenData));
    });

    it('should verify valid token successfully', async () => {
      const result = await guestConversionService.verifyMagicLink('valid-token');

      expect(result.valid).toBe(true);
      expect(result.data?.id).toBe('token-123');
      expect(result.data?.email).toBe('guest@example.com');

      // Should mark token as used
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'magic_link:token-123',
        300,
        expect.stringContaining('"used":true')
      );
    });

    it('should reject invalid JWT token', async () => {
      mockJwtVerify.mockRejectedValue(new Error('Invalid token'));

      const result = await guestConversionService.verifyMagicLink('invalid-token');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid token');
    });

    it('should reject token not found in Redis', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await guestConversionService.verifyMagicLink('valid-token');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token not found or expired');
    });

    it('should reject already used token', async () => {
      const usedTokenData = { ...mockTokenData, used: true };
      mockRedis.get.mockResolvedValue(JSON.stringify(usedTokenData));

      const result = await guestConversionService.verifyMagicLink('used-token');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token already used');
    });

    it('should reject expired token', async () => {
      const expiredTokenData = {
        ...mockTokenData,
        expiresAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(expiredTokenData));

      const result = await guestConversionService.verifyMagicLink('expired-token');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token expired');
    });

    it('should increment attempt counter', async () => {
      await guestConversionService.verifyMagicLink('valid-token');

      const setexCall = (mockRedis.setex as jest.Mock).mock.calls.find(
        call => call[0] === 'magic_link:token-123'
      );
      const storedData = JSON.parse(setexCall[2]);
      expect(storedData.attempts).toBe(1);
    });
  });

  describe('Guest Profile Retrieval', () => {
    const mockGuestBookings = [
      {
        id: 'booking-1',
        guestEmail: 'guest@example.com',
        isGuestBooking: true,
        serviceName: 'Yoga Class',
        status: 'completed',
        bookingDate: new Date('2024-03-01'),
        createdAt: new Date('2024-02-28'),
      },
      {
        id: 'booking-2',
        guestEmail: 'guest@example.com',
        isGuestBooking: true,
        serviceName: 'Massage Therapy',
        status: 'confirmed',
        bookingDate: new Date('2024-03-15'),
        createdAt: new Date('2024-03-10'),
      },
    ];

    it('should retrieve guest profile with bookings', async () => {
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue(mockGuestBookings),
          }),
        }),
      });

      const profile = await guestConversionService.getGuestProfile('guest@example.com');

      expect(profile).toBeDefined();
      expect(profile!.email).toBe('guest@example.com');
      expect(profile!.bookings).toHaveLength(2);
      expect(profile!.bookings[0].serviceName).toBe('Yoga Class');
      expect(profile!.createdAt).toEqual(mockGuestBookings[0].createdAt);
    });

    it('should return null for non-existent guest', async () => {
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([]), // No bookings
          }),
        }),
      });

      const profile = await guestConversionService.getGuestProfile('nonexistent@example.com');

      expect(profile).toBeNull();
    });

    it('should use email prefix as fallback name', async () => {
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([mockGuestBookings[0]]),
          }),
        }),
      });

      const profile = await guestConversionService.getGuestProfile('john.doe@example.com');

      expect(profile!.name).toBe('john.doe');
    });
  });

  describe('Guest to User Conversion', () => {
    const mockGuestBookings = [
      {
        id: 'booking-1',
        guestEmail: 'guest@example.com',
        isGuestBooking: true,
        customerId: null,
      },
      {
        id: 'booking-2',
        guestEmail: 'guest@example.com',
        isGuestBooking: true,
        customerId: null,
      },
    ];

    beforeEach(() => {
      // Mock transaction to find guest bookings
      mockDb.transaction = jest.fn().mockImplementation(async (callback) => {
        const mockTx = {
          select: jest.fn().mockReturnValue({
            from: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnValue(mockGuestBookings),
            }),
          }),
          update: jest.fn().mockReturnValue({
            set: jest.fn().mockReturnValue({
              where: jest.fn().mockResolvedValue(undefined),
            }),
          }),
          insert: jest.fn().mockReturnValue({
            values: jest.fn().mockResolvedValue(undefined),
          }),
        };

        return callback(mockTx);
      });
    });

    it('should convert guest bookings to user account', async () => {
      const result = await guestConversionService.convertGuestToUser(
        'guest@example.com',
        'user-123',
        { mergeExisting: false, createProfile: true }
      );

      expect(result.success).toBe(true);
      expect(result.userId).toBe('user-123');
      expect(result.bookingsMigrated).toBe(2);
      expect(result.merged).toBe(false);
    });

    it('should handle no guest bookings gracefully', async () => {
      mockDb.transaction = jest.fn().mockImplementation(async (callback) => {
        const mockTx = {
          select: jest.fn().mockReturnValue({
            from: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnValue([]), // No bookings
            }),
          }),
        };

        return callback(mockTx);
      });

      const result = await guestConversionService.convertGuestToUser(
        'guest@example.com',
        'user-123'
      );

      expect(result.success).toBe(true);
      expect(result.bookingsMigrated).toBe(0);
    });

    it('should merge with existing user account', async () => {
      const existingUserBookings = [
        { id: 'existing-1', customerId: 'user-123', isGuestBooking: false },
      ];

      mockDb.transaction = jest.fn().mockImplementation(async (callback) => {
        const mockTx = {
          select: jest.fn()
            .mockReturnValueOnce({
              from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue(mockGuestBookings),
              }),
            })
            .mockReturnValueOnce({
              from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue(existingUserBookings),
              }),
            })
            .mockReturnValueOnce({
              from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue([{
                    userId: 'user-123',
                    email: 'existing@example.com',
                  }]),
                }),
              }),
            }),
          update: jest.fn().mockReturnValue({
            set: jest.fn().mockReturnValue({
              where: jest.fn().mockResolvedValue(undefined),
            }),
          }),
        };

        return callback(mockTx);
      });

      const result = await guestConversionService.convertGuestToUser(
        'guest@example.com',
        'user-123',
        { mergeExisting: true, createProfile: true }
      );

      expect(result.success).toBe(true);
      expect(result.merged).toBe(true);
    });

    it('should create new user profile when requested', async () => {
      mockDb.transaction = jest.fn().mockImplementation(async (callback) => {
        const mockTx = {
          select: jest.fn()
            .mockReturnValueOnce({
              from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue(mockGuestBookings),
              }),
            })
            .mockReturnValueOnce({
              from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue([]), // No existing bookings
              }),
            })
            .mockReturnValueOnce({
              from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue([]), // No existing profile
                }),
              }),
            }),
          update: jest.fn().mockReturnValue({
            set: jest.fn().mockReturnValue({
              where: jest.fn().mockResolvedValue(undefined),
            }),
          }),
          insert: jest.fn().mockReturnValue({
            values: jest.fn().mockResolvedValue(undefined),
          }),
        };

        return callback(mockTx);
      });

      const result = await guestConversionService.convertGuestToUser(
        'guest@example.com',
        'user-123',
        { createProfile: true }
      );

      expect(result.success).toBe(true);
    });

    it('should handle conversion errors gracefully', async () => {
      mockDb.transaction = jest.fn().mockRejectedValue(new Error('Database error'));

      const result = await guestConversionService.convertGuestToUser(
        'guest@example.com',
        'user-123'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('Guest Session Management', () => {
    it('should create guest session', async () => {
      const bookingData = {
        bookingId: 'booking-123',
        serviceName: 'Yoga Class',
        providerName: 'Downtown Studio',
      };

      const session = await guestConversionService.createGuestSession(
        'guest@example.com',
        bookingData
      );

      expect(session.sessionId).toBeDefined();
      expect(session.expiresAt).toBeInstanceOf(Date);

      // Should store in Redis
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `guest_session:${session.sessionId}`,
        3600,
        expect.stringContaining('guest@example.com')
      );
    });

    it('should validate active guest session', async () => {
      const sessionData = {
        email: 'guest@example.com',
        bookingData: { bookingId: 'booking-123' },
        expiresAt: new Date(Date.now() + 1800000).toISOString(), // 30 minutes from now
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(sessionData));

      const result = await guestConversionService.validateGuestSession('session-123');

      expect(result.valid).toBe(true);
      expect(result.email).toBe('guest@example.com');
      expect(result.bookingData?.bookingId).toBe('booking-123');
    });

    it('should reject expired guest session', async () => {
      const expiredSessionData = {
        email: 'guest@example.com',
        bookingData: { bookingId: 'booking-123' },
        expiresAt: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(expiredSessionData));

      const result = await guestConversionService.validateGuestSession('session-123');

      expect(result.valid).toBe(false);

      // Should clean up expired session
      expect(mockRedis.del).toHaveBeenCalledWith('guest_session:session-123');
    });

    it('should reject non-existent session', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await guestConversionService.validateGuestSession('nonexistent-session');

      expect(result.valid).toBe(false);
    });
  });

  describe('Account Claim Invitation', () => {
    const mockBookings = [
      {
        id: 'booking-1',
        guestEmail: 'guest@example.com',
        serviceName: 'Yoga Class',
      },
      {
        id: 'booking-2',
        guestEmail: 'guest@example.com',
        serviceName: 'Massage',
      },
    ];

    beforeEach(() => {
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockBookings),
        }),
      });
    });

    it('should send account claim invitation', async () => {
      await guestConversionService.sendAccountClaimInvitation(
        'guest@example.com',
        ['booking-1', 'booking-2']
      );

      // Should generate magic link
      expect(mockRedis.setex).toHaveBeenCalled();

      // Should send invitation email
      expect(mockEmailQueue.enqueue).toHaveBeenCalledWith(
        EmailTemplate.GUEST_MAGIC_LINK,
        'guest@example.com',
        expect.objectContaining({
          magicLink: expect.any(String),
          bookingDetails: expect.objectContaining({
            serviceName: '2 bookings',
          }),
        }),
        expect.objectContaining({
          priority: 'normal',
          metadata: expect.objectContaining({
            action: 'account_claim',
            bookingCount: 2,
          }),
        })
      );
    });

    it('should handle no bookings found error', async () => {
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]), // No bookings
        }),
      });

      await expect(guestConversionService.sendAccountClaimInvitation(
        'guest@example.com',
        ['booking-1']
      )).rejects.toThrow('No bookings found for account claim');
    });
  });

  describe('Guest Booking Detection', () => {
    it('should detect existing guest bookings', async () => {
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([{ id: 'booking-123' }]),
          }),
        }),
      });

      const hasBookings = await guestConversionService.hasGuestBookings('guest@example.com');

      expect(hasBookings).toBe(true);
    });

    it('should return false for no guest bookings', async () => {
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]), // No bookings
          }),
        }),
      });

      const hasBookings = await guestConversionService.hasGuestBookings('guest@example.com');

      expect(hasBookings).toBe(false);
    });
  });

  describe('Guest Statistics', () => {
    const mockStatsBookings = [
      {
        id: 'booking-1',
        status: 'completed',
        bookingDate: new Date('2024-04-01'),
        totalAmount: '50.00',
        createdAt: new Date('2024-03-25'),
      },
      {
        id: 'booking-2',
        status: 'confirmed',
        bookingDate: new Date('2024-04-15'),
        totalAmount: '75.00',
        createdAt: new Date('2024-04-10'),
      },
      {
        id: 'booking-3',
        status: 'canceled_customer',
        bookingDate: new Date('2024-03-20'),
        totalAmount: '30.00',
        createdAt: new Date('2024-03-15'),
      },
    ];

    it('should calculate guest statistics correctly', async () => {
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue(mockStatsBookings),
          }),
        }),
      });

      const stats = await guestConversionService.getGuestStats('guest@example.com');

      expect(stats.totalBookings).toBe(3);
      expect(stats.completedBookings).toBe(1);
      expect(stats.upcomingBookings).toBe(1); // confirmed booking in future
      expect(stats.totalSpent).toBe(155); // 50 + 75 + 30
      expect(stats.firstBookingDate).toEqual(mockStatsBookings[0].createdAt);
      expect(stats.lastBookingDate).toEqual(mockStatsBookings[2].createdAt);
    });

    it('should handle empty booking history', async () => {
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      const stats = await guestConversionService.getGuestStats('guest@example.com');

      expect(stats.totalBookings).toBe(0);
      expect(stats.completedBookings).toBe(0);
      expect(stats.upcomingBookings).toBe(0);
      expect(stats.totalSpent).toBe(0);
      expect(stats.firstBookingDate).toBeUndefined();
      expect(stats.lastBookingDate).toBeUndefined();
    });
  });

  describe('Cleanup Operations', () => {
    it('should clean up expired magic links', async () => {
      const expiredLinkData = {
        id: 'expired-link',
        expiresAt: new Date(Date.now() - 3600000).toISOString(), // Expired
      };

      const validLinkData = {
        id: 'valid-link',
        expiresAt: new Date(Date.now() + 3600000).toISOString(), // Valid
      };

      mockRedis.keys.mockResolvedValue([
        'magic_link:expired-key',
        'magic_link:valid-key',
      ]);

      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify(expiredLinkData))
        .mockResolvedValueOnce(JSON.stringify(validLinkData));

      const cleaned = await guestConversionService.cleanupExpiredLinks();

      expect(cleaned).toBe(1);
      expect(mockRedis.del).toHaveBeenCalledWith('magic_link:expired-key');
      expect(mockRedis.del).not.toHaveBeenCalledWith('magic_link:valid-key');
    });

    it('should handle cleanup errors gracefully', async () => {
      mockRedis.keys.mockResolvedValue(['magic_link:test-key']);
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      const cleaned = await guestConversionService.cleanupExpiredLinks();

      expect(cleaned).toBe(0); // Should not crash
    });
  });

  describe('Convenience Functions', () => {
    it('should generate guest magic link with convenience function', async () => {
      const link = await generateGuestMagicLink(
        'guest@example.com',
        'booking-123'
      );

      expect(link).toContain('http://localhost:3000/auth/magic-link?token=');
      expect(mockEmailQueue.enqueue).toHaveBeenCalled(); // Should send email by default
    });

    it('should convert guest after signup with convenience function', async () => {
      mockDb.transaction = jest.fn().mockImplementation(async (callback) => {
        const mockTx = {
          select: jest.fn().mockReturnValue({
            from: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnValue([]),
            }),
          }),
        };

        return callback(mockTx);
      });

      const result = await convertGuestAfterSignup(
        'guest@example.com',
        'user-123'
      );

      expect(result.success).toBe(true);
      expect(result.userId).toBe('user-123');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle Redis connection failures', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Redis connection failed'));

      await expect(guestConversionService.generateMagicLink(
        'guest@example.com',
        { sendEmail: false }
      )).rejects.toThrow('Redis connection failed');
    });

    it('should handle malformed token data', async () => {
      mockRedis.get.mockResolvedValue('invalid-json');

      const result = await guestConversionService.verifyMagicLink('token');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid token');
    });

    it('should handle missing JWT payload ID', async () => {
      mockJwtVerify.mockResolvedValue({
        payload: {}, // Missing ID
        protectedHeader: {},
      } as any);

      const result = await guestConversionService.verifyMagicLink('token');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid token format');
    });

    it('should handle email sending failures gracefully', async () => {
      mockEmailQueue.enqueue.mockRejectedValue(new Error('Email service down'));

      // Should still return the magic link even if email fails
      const result = await guestConversionService.generateMagicLink(
        'guest@example.com',
        { sendEmail: true }
      );

      expect(result.link).toBeDefined();
      expect(result.token).toBeDefined();
    });

    it('should handle extremely long email addresses', async () => {
      const longEmail = 'a'.repeat(100) + '@' + 'b'.repeat(100) + '.com';

      const result = await guestConversionService.generateMagicLink(
        longEmail,
        { sendEmail: false }
      );

      expect(result.link).toBeDefined();
    });

    it('should handle conversion with invalid user ID', async () => {
      mockDb.transaction = jest.fn().mockRejectedValue(new Error('Invalid user ID'));

      const result = await guestConversionService.convertGuestToUser(
        'guest@example.com',
        '' // Empty user ID
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid user ID');
    });
  });

  describe('Security Considerations', () => {
    it('should use secure JWT settings', async () => {
      await guestConversionService.generateMagicLink(
        'guest@example.com',
        { sendEmail: false }
      );

      const mockJWTInstance = (mockSignJWT as jest.Mock).mock.results[0].value;
      expect(mockJWTInstance.setProtectedHeader).toHaveBeenCalledWith({ alg: 'HS256' });
      expect(mockJWTInstance.setExpirationTime).toHaveBeenCalled();
      expect(mockJWTInstance.setIssuedAt).toHaveBeenCalled();
    });

    it('should generate unique token IDs', async () => {
      const result1 = await guestConversionService.generateMagicLink(
        'guest1@example.com',
        { sendEmail: false }
      );
      
      const result2 = await guestConversionService.generateMagicLink(
        'guest2@example.com',
        { sendEmail: false }
      );

      expect(result1.token).not.toBe(result2.token);
    });

    it('should sanitize email inputs', async () => {
      const maliciousEmail = 'test+<script>alert("xss")</script>@example.com';

      // Should not throw error and handle gracefully
      const result = await guestConversionService.generateMagicLink(
        maliciousEmail,
        { sendEmail: false }
      );

      expect(result.link).toBeDefined();
    });

    it('should validate session data structure', async () => {
      const malformedSessionData = 'not-json';
      mockRedis.get.mockResolvedValue(malformedSessionData);

      const result = await guestConversionService.validateGuestSession('session-123');

      expect(result.valid).toBe(false);
    });
  });
});