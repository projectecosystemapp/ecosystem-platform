/**
 * Availability Module
 * Centralized exports for availability system
 * Per Master PRD §4.6
 */

export { 
  slotGenerator,
  type AvailabilitySlot,
  type SlotGenerationParams,
  type ProviderSettings,
  type RecurringRule,
  type AvailabilityException
} from './slot-generator';

export {
  concurrencyManager,
  type SlotHold,
  type HoldResult,
  type ConcurrencyConfig
} from './concurrency-manager';

// Re-export convenience functions
export const generateSlots = (params: import('./slot-generator').SlotGenerationParams) => 
  import('./slot-generator').slotGenerator.generateSlots(params);

export const placeHold = (params: Parameters<typeof import('./concurrency-manager').concurrencyManager.placeHold>[0]) =>
  import('./concurrency-manager').concurrencyManager.placeHold(params);

export const releaseHold = (holdId: string, reason?: 'manual' | 'expired' | 'converted') =>
  import('./concurrency-manager').concurrencyManager.releaseHold(holdId, reason);

export const convertHoldToBooking = (holdId: string, bookingId: string) =>
  import('./concurrency-manager').concurrencyManager.convertHoldToBooking(holdId, bookingId);