/**
 * Customer Repository Interface (Stub)
 */

import { CustomerId } from '../value-objects/customer-id';

export interface ICustomerRepository {
  findById(id: CustomerId): Promise<any>;
  // Additional methods to be implemented
}