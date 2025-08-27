/**
 * Availability System Test Suite
 * Tests slot generation, holds, concurrency, timezone handling, and buffer calculations
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AvailabilityService } from '@/lib/services/availability-service';
import { db } from '@/db/db';
import { cache, ProviderCache } from '@/lib/cache';

// Mock dependencies
jest.mock('@/db/db');
jest.mock('@/lib/cache');

const mockDb = db as jest.Mocked<typeof db>;
const mockCache = cache as jest.Mocked<typeof cache>;
const mockProviderCache = ProviderCache as jest.Mocked<typeof ProviderCache>;

describe('AvailabilityService', () => {
  let availabilityService: AvailabilityService;

  beforeEach(() => {
    availabilityService = new AvailabilityService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Slot Generation', () => {
    const mockProvider = {
      id: 'provider-123',
      displayName: 'Test Provider',
      timezone: 'UTC',
    };

    const mockAvailability = [
      {
        dayOfWeek: 1, // Monday
        startTime: '09:00',
        endTime: '17:00',
        isActive: true,
      },
    ];

    beforeEach(() => {
      // Mock database calls for slot generation
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockProvider]),
          }),
        }),
      });

      mockDb.select = jest.fn()
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([mockProvider]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue(mockAvailability),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue([]), // No blocked slots
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue([]), // No existing bookings
          }),
        });

      mockProviderCache.getCachedAvailability = jest.fn().mockResolvedValue(null);
      mockProviderCache.cacheAvailability = jest.fn().mockResolvedValue(undefined);
    });

    it('should generate 15-minute time slots correctly', async () => {
      const request = {
        providerId: 'provider-123',
        date: new Date('2024-01-01'), // Monday
        timezone: 'UTC',
        duration: 60, // 1 hour
      };

      const result = await availabilityService.getAvailability(request);

      expect(result.slots).toBeDefined();
      expect(result.slots.length).toBeGreaterThan(0);
      
      // Check that slots are in 15-minute intervals
      const firstSlot = result.slots[0];
      expect(firstSlot.startTime).toMatch(/^\d{2}:(00|15|30|45)$/);
      
      // Verify provider and timezone info
      expect(result.provider.id).toBe('provider-123');
      expect(result.provider.name).toBe('Test Provider');
      expect(result.timezone).toBe('UTC');
    });

    it('should handle different service durations', async () => {
      const request = {
        providerId: 'provider-123',
        date: new Date('2024-01-01'),
        duration: 30, // 30 minutes
      };

      const result = await availabilityService.getAvailability(request);

      // Should generate slots that can accommodate 30-minute duration
      expect(result.slots).toBeDefined();
      
      // Verify slots have proper time differences
      if (result.slots.length > 0) {
        const slot = result.slots[0];
        const startMinutes = parseInt(slot.startTime.split(':')[0]) * 60 + parseInt(slot.startTime.split(':')[1]);
        const endMinutes = parseInt(slot.endTime.split(':')[0]) * 60 + parseInt(slot.endTime.split(':')[1]);
        expect(endMinutes - startMinutes).toBe(30);
      }
    });

    it('should respect provider availability windows', async () => {
      const request = {
        providerId: 'provider-123',
        date: new Date('2024-01-01'), // Monday
      };

      const result = await availabilityService.getAvailability(request);

      // All slots should be within 09:00-17:00 window
      result.slots.forEach(slot => {
        const startHour = parseInt(slot.startTime.split(':')[0]);
        const endHour = parseInt(slot.endTime.split(':')[0]);
        
        expect(startHour).toBeGreaterThanOrEqual(9);
        expect(endHour).toBeLessThanOrEqual(17);
      });
    });

    it('should handle unavailable days', async () => {
      // Mock Sunday (day 0) with no availability
      const request = {
        providerId: 'provider-123',
        date: new Date('2024-01-07'), // Sunday
      };

      // Mock empty availability for Sunday
      mockDb.select = jest.fn()
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([mockProvider]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue([]), // No availability on Sunday
          }),
        });

      const result = await availabilityService.getAvailability(request);

      expect(result.slots).toEqual([]);
    });

    it('should exclude blocked time slots', async () => {
      const blockedSlots = [
        {
          providerId: 'provider-123',
          blockedDate: '2024-01-01',
          startTime: '10:00',
          endTime: '11:00',
        },
      ];

      // Mock blocked slots
      mockDb.select = jest.fn()
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([mockProvider]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue([]),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue(mockAvailability),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue(blockedSlots),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue([]),
          }),
        });

      const request = {
        providerId: 'provider-123',
        date: new Date('2024-01-01'),
      };

      const result = await availabilityService.getAvailability(request);

      // Check that blocked slots are marked as unavailable
      const blockedSlots10To11 = result.slots.filter(slot => 
        slot.startTime >= '10:00' && slot.endTime <= '11:00'
      );
      
      blockedSlots10To11.forEach(slot => {
        expect(slot.isAvailable).toBe(false);
      });
    });

    it('should exclude existing booked slots', async () => {
      const existingBookings = [
        {
          providerId: 'provider-123',
          bookingDate: '2024-01-01',
          startTime: '14:00',
          endTime: '15:00',
          status: 'confirmed',
        },
      ];

      // Mock existing bookings
      mockDb.select = jest.fn()
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([mockProvider]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue([]),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue(mockAvailability),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue([]), // No blocked slots
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue(existingBookings),
          }),
        });

      const request = {
        providerId: 'provider-123',
        date: new Date('2024-01-01'),
      };

      const result = await availabilityService.getAvailability(request);

      // Check that booked slots are marked as unavailable and booked
      const bookedSlots14To15 = result.slots.filter(slot => 
        slot.startTime >= '14:00' && slot.endTime <= '15:00'
      );
      
      bookedSlots14To15.forEach(slot => {
        expect(slot.isAvailable).toBe(false);
        expect(slot.isBooked).toBe(true);
      });
    });
  });

  describe('Time Slot Locking and Holds', () => {
    beforeEach(() => {
      mockDb.update = jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([{
              id: 'slot-123',
              providerId: 'provider-123',
              date: '2024-01-01',
              startTime: '10:00',
              endTime: '11:00',
            }]),
          }),
        }),
      });
    });

    it('should successfully lock an available time slot', async () => {
      const result = await availabilityService.lockTimeSlot(
        'provider-123',
        new Date('2024-01-01'),
        '10:00',
        '11:00',
        'session-123'
      );

      expect(result).not.toBeNull();
      expect(result!.providerId).toBe('provider-123');
      expect(result!.sessionId).toBe('session-123');
      expect(result!.lockedUntil).toBeInstanceOf(Date);
      
      // Should expire in 10 minutes (default)
      const timeDiff = result!.lockedUntil.getTime() - Date.now();
      expect(timeDiff).toBeGreaterThan(590000); // 9:50
      expect(timeDiff).toBeLessThan(610000); // 10:10
    });

    it('should handle custom lock duration', async () => {
      const customDuration = 5; // 5 minutes
      
      const result = await availabilityService.lockTimeSlot(
        'provider-123',
        new Date('2024-01-01'),
        '10:00',
        '11:00',
        'session-123',
        customDuration
      );

      expect(result).not.toBeNull();
      
      const timeDiff = result!.lockedUntil.getTime() - Date.now();
      expect(timeDiff).toBeGreaterThan(290000); // 4:50
      expect(timeDiff).toBeLessThan(310000); // 5:10
    });

    it('should fail to lock already locked slot', async () => {
      // Mock no rows returned (slot already locked)
      mockDb.update = jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([]), // No rows updated
          }),
        }),
      });

      const result = await availabilityService.lockTimeSlot(
        'provider-123',
        new Date('2024-01-01'),
        '10:00',
        '11:00',
        'session-123'
      );

      expect(result).toBeNull();
    });

    it('should release locked time slot', async () => {
      const result = await availabilityService.releaseTimeSlot('slot-123');

      expect(result).toBe(true);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should check slot availability correctly', async () => {
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([{
              id: 'slot-123',
              isAvailable: true,
              lockedUntil: null,
            }]),
          }),
        }),
      });

      const isAvailable = await availabilityService.isSlotAvailable(
        'provider-123',
        new Date('2024-01-01'),
        '10:00',
        '11:00'
      );

      expect(isAvailable).toBe(true);
    });

    it('should detect unavailable slots', async () => {
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]), // No available slots
          }),
        }),
      });

      const isAvailable = await availabilityService.isSlotAvailable(
        'provider-123',
        new Date('2024-01-01'),
        '10:00',
        '11:00'
      );

      expect(isAvailable).toBe(false);
    });
  });

  describe('Concurrency and Race Conditions', () => {
    it('should prevent concurrent booking of same slot', async () => {
      let lockAttempts = 0;
      
      // First call succeeds, second fails
      mockDb.update = jest.fn().mockImplementation(() => ({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue(
              lockAttempts++ === 0 ? [{
                id: 'slot-123',
                providerId: 'provider-123',
                date: '2024-01-01',
                startTime: '10:00',
                endTime: '11:00',
              }] : []
            ),
          }),
        }),
      }));

      // Simulate two concurrent lock attempts
      const [result1, result2] = await Promise.all([
        availabilityService.lockTimeSlot(
          'provider-123',
          new Date('2024-01-01'),
          '10:00',
          '11:00',
          'session-1'
        ),
        availabilityService.lockTimeSlot(
          'provider-123',
          new Date('2024-01-01'),
          '10:00',
          '11:00',
          'session-2'
        ),
      ]);

      // Only one should succeed
      expect(result1).not.toBeNull();
      expect(result2).toBeNull();
    });
  });

  describe('Timezone Handling', () => {
    it('should handle different timezone requests', async () => {
      const request = {
        providerId: 'provider-123',
        date: new Date('2024-01-01'),
        timezone: 'America/New_York',
      };

      // Mock provider with different timezone
      const providerEastern = {
        ...mockProvider,
        timezone: 'America/New_York',
      };

      mockDb.select = jest.fn()
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([providerEastern]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue([]),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue([{
              dayOfWeek: 1,
              startTime: '09:00',
              endTime: '17:00',
              isActive: true,
            }]),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue([]),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue([]),
          }),
        });

      mockProviderCache.getCachedAvailability = jest.fn().mockResolvedValue(null);
      mockProviderCache.cacheAvailability = jest.fn().mockResolvedValue(undefined);

      const result = await availabilityService.getAvailability(request);

      expect(result.timezone).toBe('America/New_York');
    });
  });

  describe('Buffer Time Calculations', () => {
    it('should apply buffer times to service slots', async () => {
      const serviceWithBuffer = {
        id: 'service-123',
        name: 'Test Service',
        minimumDuration: 60,
        bufferTimeBefore: 15,
        bufferTimeAfter: 15,
      };

      mockDb.select = jest.fn()
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([mockProvider]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([serviceWithBuffer]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue(mockAvailability),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue([]),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue([]),
          }),
        });

      const request = {
        providerId: 'provider-123',
        serviceId: 'service-123',
        date: new Date('2024-01-01'),
      };

      const result = await availabilityService.getAvailability(request);

      expect(result.service?.bufferBefore).toBe(15);
      expect(result.service?.bufferAfter).toBe(15);
    });
  });

  describe('Alternative Slot Finding', () => {
    beforeEach(() => {
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([
                {
                  startTime: '10:00',
                  endTime: '11:00',
                  isAvailable: true,
                  isBooked: false,
                },
                {
                  startTime: '14:00',
                  endTime: '15:00',
                  isAvailable: true,
                  isBooked: false,
                },
              ]),
            }),
          }),
        }),
      });
    });

    it('should find alternative slots when requested slot unavailable', async () => {
      const alternatives = await availabilityService.findAlternativeSlots(
        'provider-123',
        new Date('2024-01-01'),
        60, // 1 hour duration
        'UTC',
        3 // max alternatives
      );

      expect(alternatives).toHaveLength(2);
      expect(alternatives[0].startTime).toBe('10:00');
      expect(alternatives[1].startTime).toBe('14:00');
    });

    it('should limit alternatives to maxAlternatives parameter', async () => {
      const alternatives = await availabilityService.findAlternativeSlots(
        'provider-123',
        new Date('2024-01-01'),
        60,
        'UTC',
        1 // limit to 1
      );

      expect(alternatives).toHaveLength(1);
    });
  });

  describe('Cache Operations', () => {
    it('should use cached availability when available', async () => {
      const cachedResult = {
        date: new Date('2024-01-01'),
        timezone: 'UTC',
        slots: [{
          startTime: '10:00',
          endTime: '11:00',
          isAvailable: true,
          isBooked: false,
        }],
        provider: mockProvider,
      };

      mockProviderCache.getCachedAvailability = jest.fn().mockResolvedValue(cachedResult);

      const request = {
        providerId: 'provider-123',
        date: new Date('2024-01-01'),
      };

      const result = await availabilityService.getAvailability(request);

      expect(result).toEqual(cachedResult);
      expect(mockProviderCache.getCachedAvailability).toHaveBeenCalledWith(
        'provider-123',
        '2024-01-01'
      );
      // Should not hit database
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('should cache fresh availability results', async () => {
      mockProviderCache.getCachedAvailability = jest.fn().mockResolvedValue(null);
      
      const request = {
        providerId: 'provider-123',
        date: new Date('2024-01-01'),
      };

      await availabilityService.getAvailability(request);

      expect(mockProviderCache.cacheAvailability).toHaveBeenCalled();
    });
  });

  describe('Cleanup Operations', () => {
    it('should clean up expired locks and cache entries', async () => {
      mockDb.update = jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([
              { id: 'expired-lock-1' },
              { id: 'expired-lock-2' },
            ]),
          }),
        }),
      });

      mockDb.delete = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([
            { id: 'expired-cache-1' },
            { id: 'expired-cache-2' },
            { id: 'expired-cache-3' },
          ]),
        }),
      });

      const result = await availabilityService.cleanupExpiredData();

      expect(result.locks).toBe(2);
      expect(result.cache).toBe(3);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockDb.select = jest.fn().mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const request = {
        providerId: 'provider-123',
        date: new Date('2024-01-01'),
      };

      await expect(availabilityService.getAvailability(request))
        .rejects.toThrow('Database connection failed');
    });

    it('should handle provider not found', async () => {
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]), // No provider found
          }),
        }),
      });

      const request = {
        providerId: 'nonexistent-provider',
        date: new Date('2024-01-01'),
      };

      await expect(availabilityService.getAvailability(request))
        .rejects.toThrow('Provider not found');
    });
  });

  describe('Performance and Logging', () => {
    beforeEach(() => {
      mockDb.insert = jest.fn().mockReturnValue({
        values: jest.fn().mockResolvedValue(undefined),
      });
    });

    it('should log performance metrics', async () => {
      mockProviderCache.getCachedAvailability = jest.fn().mockResolvedValue(null);
      
      const request = {
        providerId: 'provider-123',
        date: new Date('2024-01-01'),
      };

      await availabilityService.getAvailability(request);

      // Should log performance data
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should handle logging errors gracefully', async () => {
      mockDb.insert = jest.fn().mockImplementation(() => {
        throw new Error('Logging failed');
      });

      const request = {
        providerId: 'provider-123',
        date: new Date('2024-01-01'),
      };

      // Should not throw error even if logging fails
      await expect(availabilityService.getAvailability(request))
        .resolves.toBeDefined();
    });
  });
});