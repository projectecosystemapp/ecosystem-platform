/**
 * Service Details Value Object
 * 
 * Represents the details of a service being booked.
 */

import { ValueObject, Result } from '@/modules/shared/domain/value-object';
import { Money } from '@/modules/shared/domain/value-objects/money';

interface ServiceDetailsProps {
  serviceId: string;
  name: string;
  description?: string;
  price: Money;
  duration: number; // in minutes
  category: string;
  requirements?: string[];
  includedItems?: string[];
}

export class ServiceDetails extends ValueObject<ServiceDetailsProps> {
  private static readonly MIN_DURATION = 15;
  private static readonly MAX_DURATION = 480; // 8 hours
  private static readonly MAX_NAME_LENGTH = 100;
  private static readonly MAX_DESCRIPTION_LENGTH = 500;

  private constructor(props: ServiceDetailsProps) {
    super(props);
  }

  static create(params: {
    serviceId: string;
    name: string;
    description?: string;
    price: Money;
    duration: number;
    category: string;
    requirements?: string[];
    includedItems?: string[];
  }): Result<ServiceDetails> {
    // Validation
    if (!params.serviceId || params.serviceId.trim().length === 0) {
      return Result.fail('Service ID is required');
    }

    if (!params.name || params.name.trim().length === 0) {
      return Result.fail('Service name is required');
    }

    if (params.name.length > this.MAX_NAME_LENGTH) {
      return Result.fail(`Service name cannot exceed ${this.MAX_NAME_LENGTH} characters`);
    }

    if (params.description && params.description.length > this.MAX_DESCRIPTION_LENGTH) {
      return Result.fail(`Description cannot exceed ${this.MAX_DESCRIPTION_LENGTH} characters`);
    }

    if (params.duration < this.MIN_DURATION) {
      return Result.fail(`Duration must be at least ${this.MIN_DURATION} minutes`);
    }

    if (params.duration > this.MAX_DURATION) {
      return Result.fail(`Duration cannot exceed ${this.MAX_DURATION} minutes`);
    }

    if (!params.category || params.category.trim().length === 0) {
      return Result.fail('Category is required');
    }

    if (params.price.amount <= 0) {
      return Result.fail('Service price must be positive');
    }

    return Result.ok(new ServiceDetails({
      serviceId: params.serviceId.trim(),
      name: params.name.trim(),
      description: params.description?.trim(),
      price: params.price,
      duration: params.duration,
      category: params.category.trim(),
      requirements: params.requirements?.map(r => r.trim()).filter(r => r.length > 0),
      includedItems: params.includedItems?.map(i => i.trim()).filter(i => i.length > 0)
    }));
  }

  get serviceId(): string {
    return this.props.serviceId;
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string | undefined {
    return this.props.description;
  }

  get price(): Money {
    return this.props.price;
  }

  get duration(): number {
    return this.props.duration;
  }

  get durationHours(): number {
    return this.props.duration / 60;
  }

  get category(): string {
    return this.props.category;
  }

  get requirements(): string[] {
    return this.props.requirements || [];
  }

  get includedItems(): string[] {
    return this.props.includedItems || [];
  }

  hasRequirements(): boolean {
    return this.props.requirements !== undefined && this.props.requirements.length > 0;
  }

  hasIncludedItems(): boolean {
    return this.props.includedItems !== undefined && this.props.includedItems.length > 0;
  }

  formatDuration(): string {
    const hours = Math.floor(this.props.duration / 60);
    const minutes = this.props.duration % 60;

    if (hours === 0) {
      return `${minutes} min`;
    } else if (minutes === 0) {
      return `${hours} hr${hours > 1 ? 's' : ''}`;
    } else {
      return `${hours} hr${hours > 1 ? 's' : ''} ${minutes} min`;
    }
  }

  calculateEndTime(startTime: Date): Date {
    return new Date(startTime.getTime() + this.props.duration * 60 * 1000);
  }

  toPrimitives(): any {
    return {
      serviceId: this.props.serviceId,
      name: this.props.name,
      description: this.props.description,
      price: this.props.price.amount,
      currency: this.props.price.currency,
      duration: this.props.duration,
      category: this.props.category,
      requirements: this.props.requirements,
      includedItems: this.props.includedItems
    };
  }

  toString(): string {
    return `${this.props.name} (${this.formatDuration()}) - ${this.props.price.format()}`;
  }
}