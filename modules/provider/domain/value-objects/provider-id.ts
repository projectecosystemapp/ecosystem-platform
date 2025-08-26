/**
 * Provider ID Value Object
 */

import { ValueObject } from '@/modules/shared/domain/value-object';

export class ProviderId extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  static create(id: string): ProviderId {
    if (!id || id.trim().length === 0) {
      throw new Error('Provider ID cannot be empty');
    }
    return new ProviderId(id);
  }

  get value(): string {
    return this.props.value;
  }

  toString(): string {
    return this.props.value;
  }
}