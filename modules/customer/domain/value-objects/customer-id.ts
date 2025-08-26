/**
 * Customer ID Value Object
 */

import { ValueObject } from '@/modules/shared/domain/value-object';

export class CustomerId extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  static create(id: string): CustomerId {
    if (!id || id.trim().length === 0) {
      throw new Error('Customer ID cannot be empty');
    }
    return new CustomerId(id);
  }

  static createGuest(sessionId: string): CustomerId {
    return new CustomerId(`guest_${sessionId}`);
  }

  get value(): string {
    return this.props.value;
  }

  isGuest(): boolean {
    return this.props.value.startsWith('guest_');
  }

  toString(): string {
    return this.props.value;
  }
}