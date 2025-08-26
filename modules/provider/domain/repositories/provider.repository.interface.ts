/**
 * Provider Repository Interface (Stub)
 */

import { ProviderId } from '../value-objects/provider-id';
import { TimeSlot } from '@/modules/shared/domain/value-objects/time-slot';

export interface IProviderRepository {
  findById(id: ProviderId): Promise<any>;
  isAvailable(providerId: ProviderId, timeSlot: TimeSlot): Promise<boolean>;
  // Additional methods to be implemented
}