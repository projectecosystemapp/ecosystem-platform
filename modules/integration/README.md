# Modular Architecture Integration Guide

## Overview

This guide demonstrates how to integrate the new modular architecture with existing Next.js routes and components.

## Architecture Components

### 1. Domain Layer
- **Entities**: Core business objects (Booking, Provider, Customer)
- **Value Objects**: Immutable domain concepts (Money, TimeSlot, BookingStatus)
- **Domain Events**: Facts about what happened (BookingCreated, PaymentProcessed)
- **Repository Interfaces**: Contracts for data access

### 2. Application Layer
- **Use Cases**: Business operations (CreateBooking, ProcessPayment)
- **Services**: Orchestration logic (BookingService, PaymentService)
- **DTOs**: Data transfer objects for API communication

### 3. Infrastructure Layer
- **Repositories**: Database implementations using Drizzle ORM
- **Event Bus**: Domain event publishing and handling
- **Mappers**: Convert between domain and persistence models

### 4. Shared Components
- **Container**: Dependency injection management
- **API Gateway**: Unified API entry point
- **Event Bus**: Cross-module communication

## Integration Examples

### Example 1: Creating a Booking via API Route

```typescript
// app/api/bookings/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getContainer, ServiceIdentifiers } from '@/modules/shared/infrastructure/container';
import { BookingService } from '@/modules/booking/application/services/booking.service';

export async function POST(request: NextRequest) {
  try {
    // Get service from DI container
    const container = await getContainer();
    const bookingService = await container.resolve<BookingService>(
      ServiceIdentifiers.BookingService
    );

    // Parse request
    const body = await request.json();
    
    // Call service method
    const result = await bookingService.createBooking({
      customerId: body.customerId,
      providerId: body.providerId,
      serviceId: body.serviceId,
      serviceName: body.serviceName,
      serviceDescription: body.serviceDescription,
      servicePrice: body.servicePrice,
      serviceDuration: body.serviceDuration,
      serviceCategory: body.serviceCategory,
      startTime: new Date(body.startTime),
      endTime: new Date(body.endTime),
      customerNotes: body.customerNotes,
      timeZone: body.timeZone
    });

    if (result.isFailure) {
      return NextResponse.json(
        { error: result.getError() },
        { status: 400 }
      );
    }

    return NextResponse.json(result.getValue());
  } catch (error) {
    console.error('Error creating booking:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Example 2: Using the API Gateway

```typescript
// app/api/v2/[...path]/route.ts
import { NextRequest } from 'next/server';
import { getApiGateway } from '@/modules/api-gateway/gateway';
import { bookingRoutes } from '@/modules/booking/presentation/routes';
import { paymentRoutes } from '@/modules/payment/presentation/routes';

// Configure gateway with routes
const gateway = getApiGateway();
gateway.registerRoutes(bookingRoutes);
gateway.registerRoutes(paymentRoutes);

export async function GET(request: NextRequest) {
  return gateway.processRequest(request);
}

export async function POST(request: NextRequest) {
  return gateway.processRequest(request);
}

export async function PUT(request: NextRequest) {
  return gateway.processRequest(request);
}

export async function DELETE(request: NextRequest) {
  return gateway.processRequest(request);
}
```

### Example 3: Server Action with Domain Logic

```typescript
// app/actions/booking-actions.ts
'use server';

import { getContainer, ServiceIdentifiers } from '@/modules/shared/infrastructure/container';
import { BookingService } from '@/modules/booking/application/services/booking.service';
import { auth } from '@clerk/nextjs';

export async function acceptBooking(bookingId: string, notes?: string) {
  const { userId } = auth();
  
  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  const container = await getContainer();
  const bookingService = await container.resolve<BookingService>(
    ServiceIdentifiers.BookingService
  );

  const result = await bookingService.acceptBooking(
    bookingId,
    userId,
    notes
  );

  if (result.isFailure) {
    return { success: false, error: result.getError() };
  }

  return { success: true };
}
```

### Example 4: Event Handler for Cross-Module Communication

```typescript
// modules/notification/application/handlers/booking-events.handler.ts
import { IDomainEventHandler } from '@/modules/shared/domain/domain-event';
import { BookingConfirmedEvent } from '@/modules/booking/domain/events/booking-events';
import { NotificationService } from '../services/notification.service';

export class BookingConfirmedNotificationHandler 
  implements IDomainEventHandler<BookingConfirmedEvent> {
  
  constructor(private notificationService: NotificationService) {}

  async handle(event: BookingConfirmedEvent): Promise<void> {
    await this.notificationService.sendBookingConfirmation({
      bookingId: event.payload.bookingId,
      providerId: event.payload.providerId,
      confirmedAt: event.payload.confirmedAt
    });
  }

  getEventName(): string {
    return 'booking.confirmed';
  }
}

// Register handler
import { getContainer, ServiceIdentifiers } from '@/modules/shared/infrastructure/container';

const container = await getContainer();
const eventBus = await container.resolve(ServiceIdentifiers.EventBus);
const notificationService = await container.resolve(ServiceIdentifiers.NotificationService);

eventBus.subscribe(
  'booking.confirmed',
  new BookingConfirmedNotificationHandler(notificationService)
);
```

### Example 5: Using Domain Logic in React Components

```typescript
// components/booking/create-booking-form.tsx
'use client';

import { useState } from 'react';
import { createBooking } from '@/app/actions/booking-actions';
import { Money } from '@/modules/shared/domain/value-objects/money';
import { TimeSlot } from '@/modules/shared/domain/value-objects/time-slot';

export function CreateBookingForm({ providerId, serviceDetails }) {
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    
    try {
      // Use domain value objects for validation
      const priceResult = Money.create(
        parseFloat(formData.get('price') as string),
        'USD'
      );
      
      if (priceResult.isFailure) {
        alert(priceResult.getError());
        return;
      }
      
      const timeSlotResult = TimeSlot.create(
        new Date(formData.get('startTime') as string),
        new Date(formData.get('endTime') as string)
      );
      
      if (timeSlotResult.isFailure) {
        alert(timeSlotResult.getError());
        return;
      }
      
      const result = await createBooking({
        providerId,
        serviceId: serviceDetails.id,
        serviceName: serviceDetails.name,
        servicePrice: priceResult.getValue().amount,
        serviceDuration: timeSlotResult.getValue().durationMinutes,
        serviceCategory: serviceDetails.category,
        startTime: timeSlotResult.getValue().startTime,
        endTime: timeSlotResult.getValue().endTime,
        customerNotes: formData.get('notes') as string
      });
      
      if (!result.success) {
        alert(result.error);
      } else {
        alert('Booking created successfully!');
      }
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <form action={handleSubmit}>
      {/* Form fields */}
    </form>
  );
}
```

## Migration Strategy

### Phase 1: Set Up Infrastructure
1. ✅ Create module structure
2. ✅ Implement domain entities and value objects
3. ✅ Set up event bus and DI container
4. ✅ Create repository interfaces and implementations

### Phase 2: Migrate Business Logic
1. Extract logic from existing services into use cases
2. Replace direct database calls with repository pattern
3. Implement domain events for state changes
4. Add proper error handling with Result type

### Phase 3: API Integration
1. Set up API Gateway for new endpoints
2. Migrate existing routes to use new services
3. Add middleware for cross-cutting concerns
4. Implement proper API versioning

### Phase 4: Testing & Documentation
1. Add unit tests for domain logic
2. Integration tests for use cases
3. E2E tests for critical workflows
4. Generate API documentation

## Benefits of This Architecture

1. **Separation of Concerns**: Business logic is isolated from infrastructure
2. **Testability**: Domain logic can be tested without database/API dependencies
3. **Maintainability**: Changes to business rules don't affect infrastructure
4. **Scalability**: Modules can be deployed independently if needed
5. **Type Safety**: Strong typing throughout with TypeScript
6. **Event-Driven**: Loose coupling between modules via events
7. **Flexibility**: Easy to swap implementations (e.g., different databases)

## Next Steps

1. Complete remaining module implementations (Payment, Provider, Customer, Notification)
2. Add comprehensive error handling and logging
3. Implement caching strategies
4. Add monitoring and metrics collection
5. Create development and deployment documentation
6. Set up automated testing pipelines