/**
 * Domain Event System
 * 
 * Events represent facts that have happened in the domain.
 * They are immutable and carry all necessary information about what occurred.
 */

import { EntityId } from './base-entity';

export interface DomainEventMetadata {
  occurredAt: Date;
  userId?: string;
  correlationId?: string;
  causationId?: string;
  version: number;
}

export abstract class DomainEvent {
  public readonly metadata: DomainEventMetadata;

  constructor(metadata?: Partial<DomainEventMetadata>) {
    this.metadata = {
      occurredAt: metadata?.occurredAt || new Date(),
      userId: metadata?.userId,
      correlationId: metadata?.correlationId || this.generateId(),
      causationId: metadata?.causationId,
      version: metadata?.version || 1
    };
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  abstract get aggregateId(): string;
  abstract get eventName(): string;
  abstract get eventVersion(): number;

  toJSON(): any {
    return {
      eventName: this.eventName,
      eventVersion: this.eventVersion,
      aggregateId: this.aggregateId,
      metadata: this.metadata,
      payload: this.getPayload()
    };
  }

  protected abstract getPayload(): any;
}

/**
 * Domain Event Handler Interface
 */
export interface IDomainEventHandler<T extends DomainEvent> {
  handle(event: T): Promise<void>;
  getEventName(): string;
}

/**
 * Domain Event Publisher Interface
 */
export interface IDomainEventPublisher {
  publish(event: DomainEvent): Promise<void>;
  publishMany(events: DomainEvent[]): Promise<void>;
  subscribe(eventName: string, handler: IDomainEventHandler<any>): void;
  unsubscribe(eventName: string, handler: IDomainEventHandler<any>): void;
}

/**
 * Integration Event for Cross-Boundary Communication
 */
export abstract class IntegrationEvent extends DomainEvent {
  abstract get boundedContext(): string;
  abstract get targetContext(): string;
  
  toIntegrationFormat(): any {
    return {
      ...this.toJSON(),
      boundedContext: this.boundedContext,
      targetContext: this.targetContext,
      timestamp: this.metadata.occurredAt.toISOString()
    };
  }
}