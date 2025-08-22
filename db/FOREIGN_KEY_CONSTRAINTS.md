# Foreign Key Constraints Documentation

## Overview
This document outlines all foreign key constraints implemented in the Drizzle ORM schema for ensuring referential integrity at the database level.

## Foreign Key Constraints by Table

### 1. **providers** table
- `userId` → `profiles.userId` (ON DELETE CASCADE)
  - Deletes provider when associated profile is deleted

### 2. **provider_testimonials** table  
- `providerId` → `providers.id` (ON DELETE CASCADE)
  - Deletes testimonials when provider is deleted

### 3. **provider_availability** table
- `providerId` → `providers.id` (ON DELETE CASCADE)
  - Deletes availability records when provider is deleted

### 4. **provider_blocked_slots** table
- `providerId` → `providers.id` (ON DELETE CASCADE)
  - Deletes blocked slots when provider is deleted

### 5. **bookings** table
- `providerId` → `providers.id` (ON DELETE RESTRICT)
  - Prevents deletion of provider with existing bookings
- `customerId` → `profiles.userId` (ON DELETE RESTRICT)
  - Prevents deletion of customer with existing bookings
- `cancelledBy` → `profiles.userId` (ON DELETE SET NULL)
  - Sets to NULL if cancelling user is deleted

### 6. **transactions** table
- `bookingId` → `bookings.id` (ON DELETE CASCADE)
  - Deletes transactions when booking is deleted

### 7. **reviews** table
- `bookingId` → `bookings.id` (ON DELETE CASCADE)
  - Deletes review when booking is deleted
- `providerId` → `providers.id` (ON DELETE CASCADE)
  - Deletes reviews when provider is deleted
- `customerId` → `profiles.userId` (ON DELETE CASCADE)
  - Deletes reviews when customer is deleted

### 8. **services** table
- `providerId` → `providers.id` (ON DELETE CASCADE)
  - Deletes services when provider is deleted

### 9. **booking_state_transitions** table
- `bookingId` → `bookings.id` (ON DELETE CASCADE)
  - Deletes state transitions when booking is deleted

### 10. **payout_schedules** table
- `bookingId` → `bookings.id` (ON DELETE CASCADE)
  - Deletes payout schedule when booking is deleted
- `providerId` → `providers.id` (ON DELETE CASCADE)
  - Deletes payout schedules when provider is deleted

### 11. **availability_cache** table
- `providerId` → `providers.id` (ON DELETE CASCADE)
  - Deletes cache entries when provider is deleted
- `serviceId` → `services.id` (ON DELETE CASCADE)
  - Deletes cache entries when service is deleted
- `bookingId` → `bookings.id` (ON DELETE SET NULL)
  - Clears booking reference when booking is deleted

### 12. **booking_reminders** table
- `bookingId` → `bookings.id` (ON DELETE CASCADE)
  - Deletes reminders when booking is deleted

## ON DELETE Behaviors Explained

### CASCADE
Used when dependent records should be automatically deleted:
- Testimonials, availability, services are meaningless without their provider
- Transactions, reviews, reminders are tied to specific bookings
- State transitions track booking history

### RESTRICT  
Used to maintain data integrity for financial/historical records:
- Prevents deleting providers with bookings (preserve transaction history)
- Prevents deleting customers with bookings (preserve purchase history)

### SET NULL
Used for optional references:
- `cancelledBy` can be NULL if the cancelling user is deleted
- `bookingId` in availability cache can be NULL when booking is deleted

## Implementation Details

### Drizzle ORM Syntax
```typescript
// Example: CASCADE deletion
providerId: uuid("provider_id")
  .notNull()
  .references(() => providersTable.id, { onDelete: "cascade" })

// Example: RESTRICT deletion  
customerId: text("customer_id")
  .notNull()
  .references(() => profilesTable.userId, { onDelete: "restrict" })

// Example: SET NULL on deletion
cancelledBy: text("cancelled_by")
  .references(() => profilesTable.userId, { onDelete: "set null" })
```

### Benefits
1. **Data Integrity**: Prevents orphaned records
2. **Automatic Cleanup**: CASCADE deletes remove dependent data automatically
3. **Business Logic Enforcement**: RESTRICT prevents accidental data loss
4. **Database-Level Guarantees**: Constraints enforced even with direct SQL access

### Migration Considerations
- Foreign keys are defined in schema files for new installations
- Existing databases may have constraints added via SQL migrations
- Always test CASCADE operations in development before production deployment

## Performance Implications
- Foreign key checks add minimal overhead on INSERT/UPDATE/DELETE operations
- Proper indexing on foreign key columns is essential (automatically created by PostgreSQL)
- CASCADE operations can trigger multiple deletes - use with caution on large datasets

## Related Files
- `/db/schema/profiles-schema.ts` - User profiles
- `/db/schema/providers-schema.ts` - Provider profiles and availability
- `/db/schema/bookings-schema.ts` - Bookings and transactions
- `/db/schema/reviews-schema.ts` - Customer reviews
- `/db/schema/enhanced-booking-schema.ts` - Enhanced booking system tables