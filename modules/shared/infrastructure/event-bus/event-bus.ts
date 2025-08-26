/**
 * Event Bus Implementation
 * 
 * Provides publish/subscribe mechanism for domain events
 * with support for both synchronous and asynchronous handlers.
 */

import { DomainEvent, IDomainEventHandler, IDomainEventPublisher } from '../../domain/domain-event';

export interface IEventBus extends IDomainEventPublisher {
  subscribeAsync(eventName: string, handler: IDomainEventHandler<any>): void;
  publishAndWait(event: DomainEvent): Promise<void>;
  publishBatch(events: DomainEvent[]): Promise<void>;
  clear(): void;
}

/**
 * In-Memory Event Bus Implementation
 */
export class InMemoryEventBus implements IEventBus {
  private handlers: Map<string, Set<IDomainEventHandler<any>>> = new Map();
  private asyncHandlers: Map<string, Set<IDomainEventHandler<any>>> = new Map();
  private eventHistory: DomainEvent[] = [];
  private readonly maxHistorySize = 1000;

  async publish(event: DomainEvent): Promise<void> {
    this.recordEvent(event);

    // Execute synchronous handlers
    const syncHandlers = this.handlers.get(event.eventName) || new Set();
    for (const handler of syncHandlers) {
      try {
        await handler.handle(event);
      } catch (error) {
        console.error(`Error handling event ${event.eventName}:`, error);
        // Continue processing other handlers
      }
    }

    // Execute asynchronous handlers without waiting
    const asyncHandlers = this.asyncHandlers.get(event.eventName) || new Set();
    for (const handler of asyncHandlers) {
      handler.handle(event).catch(error => {
        console.error(`Error in async handler for ${event.eventName}:`, error);
      });
    }
  }

  async publishMany(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  async publishAndWait(event: DomainEvent): Promise<void> {
    this.recordEvent(event);

    const allHandlers = [
      ...(this.handlers.get(event.eventName) || []),
      ...(this.asyncHandlers.get(event.eventName) || [])
    ];

    await Promise.all(
      allHandlers.map(handler => 
        handler.handle(event).catch(error => {
          console.error(`Error handling event ${event.eventName}:`, error);
          throw error; // Re-throw for publishAndWait
        })
      )
    );
  }

  async publishBatch(events: DomainEvent[]): Promise<void> {
    // Publish all events in parallel
    await Promise.all(events.map(event => this.publish(event)));
  }

  subscribe(eventName: string, handler: IDomainEventHandler<any>): void {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, new Set());
    }
    this.handlers.get(eventName)!.add(handler);
  }

  subscribeAsync(eventName: string, handler: IDomainEventHandler<any>): void {
    if (!this.asyncHandlers.has(eventName)) {
      this.asyncHandlers.set(eventName, new Set());
    }
    this.asyncHandlers.get(eventName)!.add(handler);
  }

  unsubscribe(eventName: string, handler: IDomainEventHandler<any>): void {
    this.handlers.get(eventName)?.delete(handler);
    this.asyncHandlers.get(eventName)?.delete(handler);
  }

  clear(): void {
    this.handlers.clear();
    this.asyncHandlers.clear();
    this.eventHistory = [];
  }

  private recordEvent(event: DomainEvent): void {
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  getEventHistory(): DomainEvent[] {
    return [...this.eventHistory];
  }
}

/**
 * Event Bus with Redis Support for Distributed Systems
 */
export class RedisEventBus implements IEventBus {
  private localBus: InMemoryEventBus;
  private redisPublisher: any; // Redis client type
  private redisSubscriber: any;
  private channelPrefix = 'domain-events:';

  constructor(redisPublisher: any, redisSubscriber: any) {
    this.localBus = new InMemoryEventBus();
    this.redisPublisher = redisPublisher;
    this.redisSubscriber = redisSubscriber;
    this.setupRedisSubscription();
  }

  private setupRedisSubscription(): void {
    this.redisSubscriber.on('message', async (channel: string, message: string) => {
      try {
        const event = JSON.parse(message);
        // Reconstruct the domain event
        await this.localBus.publish(event);
      } catch (error) {
        console.error('Error processing Redis event:', error);
      }
    });
  }

  async publish(event: DomainEvent): Promise<void> {
    // Publish locally
    await this.localBus.publish(event);

    // Publish to Redis for other instances
    const channel = `${this.channelPrefix}${event.eventName}`;
    await this.redisPublisher.publish(channel, JSON.stringify(event.toJSON()));
  }

  async publishMany(events: DomainEvent[]): Promise<void> {
    await Promise.all(events.map(event => this.publish(event)));
  }

  async publishAndWait(event: DomainEvent): Promise<void> {
    await this.localBus.publishAndWait(event);
    
    const channel = `${this.channelPrefix}${event.eventName}`;
    await this.redisPublisher.publish(channel, JSON.stringify(event.toJSON()));
  }

  async publishBatch(events: DomainEvent[]): Promise<void> {
    await this.localBus.publishBatch(events);
    
    // Publish to Redis in batch
    const pipeline = this.redisPublisher.pipeline();
    for (const event of events) {
      const channel = `${this.channelPrefix}${event.eventName}`;
      pipeline.publish(channel, JSON.stringify(event.toJSON()));
    }
    await pipeline.exec();
  }

  subscribe(eventName: string, handler: IDomainEventHandler<any>): void {
    this.localBus.subscribe(eventName, handler);
    
    // Subscribe to Redis channel
    const channel = `${this.channelPrefix}${eventName}`;
    this.redisSubscriber.subscribe(channel);
  }

  subscribeAsync(eventName: string, handler: IDomainEventHandler<any>): void {
    this.localBus.subscribeAsync(eventName, handler);
    
    // Subscribe to Redis channel
    const channel = `${this.channelPrefix}${eventName}`;
    this.redisSubscriber.subscribe(channel);
  }

  unsubscribe(eventName: string, handler: IDomainEventHandler<any>): void {
    this.localBus.unsubscribe(eventName, handler);
    
    // Check if we should unsubscribe from Redis
    // (only if no more handlers for this event)
    // Implementation depends on tracking handler counts
  }

  clear(): void {
    this.localBus.clear();
  }
}

// Singleton instance
let eventBusInstance: IEventBus | null = null;

export function getEventBus(): IEventBus {
  if (!eventBusInstance) {
    eventBusInstance = new InMemoryEventBus();
  }
  return eventBusInstance;
}

export function initializeEventBus(bus: IEventBus): void {
  eventBusInstance = bus;
}