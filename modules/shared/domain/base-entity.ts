/**
 * Base Entity Class
 * 
 * Provides fundamental entity behavior including identity, equality,
 * domain events, and audit tracking.
 */

import { DomainEvent } from './domain-event';

export abstract class Entity<TId, TProps> {
  protected readonly _id: TId;
  protected props: TProps;
  private _domainEvents: DomainEvent[] = [];
  private _version: number = 0;
  protected _createdAt: Date;
  protected _updatedAt: Date;

  constructor(props: TProps, id: TId) {
    this._id = id;
    this.props = props;
    this._createdAt = new Date();
    this._updatedAt = new Date();
  }

  get id(): TId {
    return this._id;
  }

  get version(): number {
    return this._version;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  protected incrementVersion(): void {
    this._version++;
    this._updatedAt = new Date();
  }

  equals(entity?: Entity<TId, TProps>): boolean {
    if (entity === null || entity === undefined) {
      return false;
    }

    if (this === entity) {
      return true;
    }

    if (!(entity instanceof Entity)) {
      return false;
    }

    return this._id === entity._id;
  }

  // Domain Events Management
  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  clearDomainEvents(): void {
    this._domainEvents = [];
  }

  getDomainEvents(): DomainEvent[] {
    return this._domainEvents;
  }

  hasDomainEvents(): boolean {
    return this._domainEvents.length > 0;
  }

  // Snapshot for event sourcing (optional)
  toSnapshot(): any {
    return {
      id: this._id,
      version: this._version,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
      props: { ...this.props }
    };
  }

  protected markAsUpdated(): void {
    this._updatedAt = new Date();
  }
}

/**
 * Aggregate Root
 * 
 * Aggregate roots are the only entities that can be directly accessed
 * from outside the aggregate boundary.
 */
export abstract class AggregateRoot<TId, TProps> extends Entity<TId, TProps> {
  private _transientEvents: DomainEvent[] = [];

  protected recordEvent(event: DomainEvent): void {
    this.addDomainEvent(event);
    this._transientEvents.push(event);
    this.incrementVersion();
  }

  getUncommittedEvents(): DomainEvent[] {
    return [...this._transientEvents];
  }

  markEventsAsCommitted(): void {
    this._transientEvents = [];
  }

  abstract validate(): void;
}

// Helper type for entity IDs
export type EntityId<T = string> = T & { readonly _brand: unique symbol };

export const EntityId = {
  create<T extends EntityId>(id: string): T {
    return id as T;
  },
  
  generate<T extends EntityId>(): T {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substr(2, 9);
    return `${timestamp}-${randomStr}` as T;
  },

  validate(id: string): boolean {
    return id && id.length > 0 && typeof id === 'string';
  }
};