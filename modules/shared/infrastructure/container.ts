/**
 * Dependency Injection Container
 * 
 * Manages module dependencies and service instantiation.
 */

type Factory<T> = () => T | Promise<T>;
type ServiceIdentifier = string | symbol;

interface ServiceDescriptor<T> {
  factory: Factory<T>;
  singleton: boolean;
  instance?: T;
}

/**
 * IoC Container for Dependency Injection
 */
export class Container {
  private services = new Map<ServiceIdentifier, ServiceDescriptor<any>>();

  /**
   * Register a singleton service
   */
  registerSingleton<T>(
    identifier: ServiceIdentifier,
    factory: Factory<T>
  ): void {
    this.services.set(identifier, {
      factory,
      singleton: true
    });
  }

  /**
   * Register a transient service (new instance each time)
   */
  registerTransient<T>(
    identifier: ServiceIdentifier,
    factory: Factory<T>
  ): void {
    this.services.set(identifier, {
      factory,
      singleton: false
    });
  }

  /**
   * Register an existing instance as singleton
   */
  registerInstance<T>(
    identifier: ServiceIdentifier,
    instance: T
  ): void {
    this.services.set(identifier, {
      factory: () => instance,
      singleton: true,
      instance
    });
  }

  /**
   * Resolve a service
   */
  async resolve<T>(identifier: ServiceIdentifier): Promise<T> {
    const descriptor = this.services.get(identifier);
    
    if (!descriptor) {
      throw new Error(`Service ${String(identifier)} not registered`);
    }

    if (descriptor.singleton) {
      if (!descriptor.instance) {
        descriptor.instance = await descriptor.factory();
      }
      return descriptor.instance;
    }

    return descriptor.factory();
  }

  /**
   * Resolve multiple services
   */
  async resolveMany<T>(identifiers: ServiceIdentifier[]): Promise<T[]> {
    return Promise.all(identifiers.map(id => this.resolve<T>(id)));
  }

  /**
   * Check if service is registered
   */
  has(identifier: ServiceIdentifier): boolean {
    return this.services.has(identifier);
  }

  /**
   * Clear all registrations
   */
  clear(): void {
    this.services.clear();
  }

  /**
   * Create a child container
   */
  createChild(): Container {
    const child = new Container();
    // Copy service descriptors to child
    this.services.forEach((descriptor, identifier) => {
      child.services.set(identifier, { ...descriptor });
    });
    return child;
  }
}

/**
 * Service Identifiers
 */
export const ServiceIdentifiers = {
  // Repositories
  BookingRepository: Symbol('BookingRepository'),
  ProviderRepository: Symbol('ProviderRepository'),
  CustomerRepository: Symbol('CustomerRepository'),
  PaymentRepository: Symbol('PaymentRepository'),
  
  // Services
  BookingService: Symbol('BookingService'),
  PaymentService: Symbol('PaymentService'),
  NotificationService: Symbol('NotificationService'),
  EmailService: Symbol('EmailService'),
  
  // Infrastructure
  EventBus: Symbol('EventBus'),
  Cache: Symbol('Cache'),
  Database: Symbol('Database'),
  Logger: Symbol('Logger'),
  
  // Use Cases
  CreateBookingUseCase: Symbol('CreateBookingUseCase'),
  ProcessPaymentUseCase: Symbol('ProcessPaymentUseCase'),
  SendNotificationUseCase: Symbol('SendNotificationUseCase')
} as const;

/**
 * Container Configuration
 */
import { InMemoryEventBus } from '../event-bus/event-bus';
import { DrizzleBookingRepository } from '@/modules/booking/infrastructure/repositories/booking.repository';
import { BookingService } from '@/modules/booking/application/services/booking.service';

export async function configureContainer(): Promise<Container> {
  const container = new Container();

  // Register Event Bus
  container.registerSingleton(
    ServiceIdentifiers.EventBus,
    () => new InMemoryEventBus()
  );

  // Register Repositories
  container.registerSingleton(
    ServiceIdentifiers.BookingRepository,
    () => new DrizzleBookingRepository()
  );

  // Stub repositories for now
  container.registerSingleton(
    ServiceIdentifiers.ProviderRepository,
    () => ({
      findById: async () => ({ isActive: () => true, hasAutoApproval: () => false }),
      isAvailable: async () => true
    })
  );

  container.registerSingleton(
    ServiceIdentifiers.CustomerRepository,
    () => ({
      findById: async () => ({ id: 'customer-id' })
    })
  );

  // Register Application Services
  container.registerSingleton(
    ServiceIdentifiers.BookingService,
    async () => {
      const bookingRepo = await container.resolve(ServiceIdentifiers.BookingRepository);
      const providerRepo = await container.resolve(ServiceIdentifiers.ProviderRepository);
      const customerRepo = await container.resolve(ServiceIdentifiers.CustomerRepository);
      const eventBus = await container.resolve(ServiceIdentifiers.EventBus);

      return new BookingService({
        bookingRepository: bookingRepo,
        providerRepository: providerRepo,
        customerRepository: customerRepo,
        eventBus
      });
    }
  );

  return container;
}

// Global container instance
let globalContainer: Container | null = null;

export async function getContainer(): Promise<Container> {
  if (!globalContainer) {
    globalContainer = await configureContainer();
  }
  return globalContainer;
}

export function resetContainer(): void {
  if (globalContainer) {
    globalContainer.clear();
    globalContainer = null;
  }
}

/**
 * Decorator for dependency injection (TypeScript experimental)
 */
export function Inject(identifier: ServiceIdentifier) {
  return function (target: any, propertyName: string) {
    Object.defineProperty(target, propertyName, {
      get() {
        return getContainer().then(c => c.resolve(identifier));
      }
    });
  };
}

/**
 * Service Locator Pattern (anti-pattern but sometimes useful)
 */
export class ServiceLocator {
  private static container: Container;

  static async initialize(container: Container): Promise<void> {
    ServiceLocator.container = container;
  }

  static async get<T>(identifier: ServiceIdentifier): Promise<T> {
    if (!ServiceLocator.container) {
      ServiceLocator.container = await getContainer();
    }
    return ServiceLocator.container.resolve<T>(identifier);
  }

  static async getMany<T>(identifiers: ServiceIdentifier[]): Promise<T[]> {
    if (!ServiceLocator.container) {
      ServiceLocator.container = await getContainer();
    }
    return ServiceLocator.container.resolveMany<T>(identifiers);
  }
}