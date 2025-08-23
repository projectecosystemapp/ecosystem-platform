# Webhook Idempotency Implementation

## Overview

This document describes the idempotency implementation for Stripe webhooks to prevent duplicate payment processing and maintain financial data integrity.

## Implementation Details

### Database Schema

The `webhook_events` table tracks all incoming webhook events:

```sql
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,  -- Stripe event ID for duplicate checking
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,  -- received, processing, completed, failed
  payload JSONB,  -- Full event data for audit
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP
);
```

### Processing Flow

1. **Receive Webhook**: Stripe sends webhook to `/api/stripe/webhooks`
2. **Verify Signature**: Validate webhook authenticity using Stripe signature
3. **Check Idempotency**: Query database for existing `event_id`
4. **Early Return**: If event exists, return success immediately (idempotent)
5. **Process Event**: If new event, process in database transaction:
   - Insert webhook event record with status "processing"
   - Execute business logic (update bookings, transactions, etc.)
   - Update webhook event status to "completed" or "failed"
6. **Return Response**: Always return success to Stripe for processed events

### Key Features

#### Idempotency Check
```typescript
const existingEvent = await db
  .select()
  .from(webhookEventsTable)
  .where(eq(webhookEventsTable.eventId, event.id))
  .limit(1);

if (existingEvent.length > 0) {
  console.log(`Webhook event ${event.id} already processed, skipping`);
  return Response.json({ received: true });
}
```

#### Transaction Wrapper
All webhook processing occurs within a database transaction to ensure atomicity:

```typescript
await db.transaction(async (tx) => {
  // Insert webhook event
  await tx.insert(webhookEventsTable).values({
    eventId: event.id,
    eventType: event.type,
    status: "processing",
    payload: event,
  });

  // Process business logic
  // ...

  // Update status
  await tx.update(webhookEventsTable)
    .set({ status: "completed", processedAt: new Date() })
    .where(eq(webhookEventsTable.eventId, event.id));
});
```

### Supported Event Types

The system handles these critical payment events idempotently:

- **Subscription Events**
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `checkout.session.completed`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`

- **Booking Payment Events**
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
  - `payment_intent.canceled`
  - `charge.dispute.created`
  - `transfer.created`

### Testing

#### Manual Testing

1. Start the development server:
   ```bash
   npm run dev
   ```

2. In another terminal, run the test script:
   ```bash
   npm run test:webhook-idempotency
   ```

This will:
- Send the same webhook event twice
- Verify only one processing occurs
- Test that new events are still processed

#### Using Stripe CLI

1. Forward webhooks to local server:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhooks
   ```

2. Trigger test events:
   ```bash
   stripe trigger payment_intent.succeeded
   ```

3. Manually resend the same event to test idempotency.

### Monitoring

Monitor webhook processing through:

1. **Database Queries**
   ```sql
   -- Check for duplicate events
   SELECT event_id, COUNT(*) 
   FROM webhook_events 
   GROUP BY event_id 
   HAVING COUNT(*) > 1;

   -- View failed events
   SELECT * FROM webhook_events 
   WHERE status = 'failed' 
   ORDER BY created_at DESC;

   -- Check processing times
   SELECT 
     event_type,
     AVG(EXTRACT(EPOCH FROM (processed_at - created_at))) as avg_seconds
   FROM webhook_events 
   WHERE status = 'completed'
   GROUP BY event_type;
   ```

2. **Application Logs**
   - Duplicate events logged: "Webhook event {id} already processed, skipping"
   - Processing errors logged with full stack traces

### Error Handling

- **Duplicate Check Failures**: Continue processing to avoid losing events
- **Transaction Rollback**: Failed processing rolls back all database changes
- **Status Tracking**: Failed events marked with error messages for debugging
- **Stripe Retry Logic**: Return 4xx status only for unrecoverable errors

### Security Considerations

1. **Signature Verification**: All webhooks verified using Stripe signature
2. **Event Storage**: Full event payload stored for audit trail
3. **Unique Constraint**: Database enforces uniqueness on event_id
4. **Transaction Isolation**: Prevents race conditions during concurrent webhook delivery

### Best Practices

1. **Always Return Success**: For processed events (even duplicates) to prevent Stripe retries
2. **Log Everything**: Comprehensive logging for debugging and audit
3. **Monitor Processing Time**: Track webhook processing duration
4. **Regular Cleanup**: Archive old webhook events after retention period
5. **Test Idempotency**: Regular testing with duplicate events

### Troubleshooting

#### Event Not Processing
1. Check webhook signature configuration
2. Verify database connectivity
3. Check for event_id uniqueness violations

#### Duplicate Processing
1. Verify unique index on event_id column
2. Check transaction isolation level
3. Review concurrent request handling

#### Performance Issues
1. Add indexes on frequently queried columns
2. Archive old webhook events
3. Consider async processing for heavy operations

## Related Documentation

- [Stripe Webhook Best Practices](https://stripe.com/docs/webhooks/best-practices)
- [Database Transaction Management](./DATABASE.md)
- [Payment Processing Flow](./BOOKING-PAYMENTS.md)