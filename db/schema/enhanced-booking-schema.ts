import { 
  pgTable, 
  text, 
  uuid, 
  timestamp, 
  numeric, 
  integer, 
  boolean, 
  jsonb, 
  date, 
  time, 
  unique 
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { providersTable } from "./providers-schema";
import { bookingsTable } from "./bookings-schema";

// ===== SERVICES TABLE =====
export const servicesTable = pgTable("services", {
  id: uuid("id").primaryKey().defaultRandom(),
  providerId: uuid("provider_id")
    .notNull()
    .references(() => providersTable.id, { onDelete: "cascade" }), // CASCADE: Delete services when provider is deleted
  
  // Service details
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  subcategory: text("subcategory"),
  
  // Pricing configuration
  basePrice: numeric("base_price", { precision: 10, scale: 2 }).notNull(),
  priceType: text("price_type", { 
    enum: ["fixed", "hourly", "custom"] 
  }).default("fixed").notNull(),
  minimumDuration: integer("minimum_duration").default(30).notNull(), // minutes
  maximumDuration: integer("maximum_duration"), // minutes, NULL = no limit
  
  // Scheduling constraints
  bufferTimeBefore: integer("buffer_time_before").default(0), // minutes
  bufferTimeAfter: integer("buffer_time_after").default(0), // minutes
  advanceBookingHours: integer("advance_booking_hours").default(24),
  cancellationHours: integer("cancellation_hours").default(24),
  
  // Service configuration
  isActive: boolean("is_active").default(true),
  requiresApproval: boolean("requires_approval").default(false),
  maxGroupSize: integer("max_group_size").default(1),
  
  // Metadata
  tags: jsonb("tags").$type<string[]>().default([]),
  requirements: jsonb("requirements").$type<{
    equipment?: string[];
    preparation?: string;
    restrictions?: string[];
  }>().default({}),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ===== GUEST BOOKING SESSIONS =====
export const guestBookingSessionsTable = pgTable("guest_booking_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionToken: text("session_token").unique().notNull(),
  
  // Guest information
  email: text("email").notNull(),
  phone: text("phone"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  
  // Session data
  bookingData: jsonb("booking_data").$type<{
    providerId?: string;
    serviceId?: string;
    selectedDate?: string;
    selectedTime?: string;
    duration?: number;
    notes?: string;
  }>().default({}),
  paymentIntentId: text("payment_intent_id"),
  
  // Session lifecycle
  expiresAt: timestamp("expires_at").notNull(),
  completedAt: timestamp("completed_at"),
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ===== BOOKING STATE TRANSITIONS =====
export const bookingStateTransitionsTable = pgTable("booking_state_transitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id")
    .notNull()
    .references(() => bookingsTable.id, { onDelete: "cascade" }), // CASCADE: Delete transitions when booking is deleted
  
  // State change
  fromStatus: text("from_status"),
  toStatus: text("to_status", {
    enum: [
      "pending",
      "payment_failed", 
      "confirmed",
      "in_progress",
      "completed",
      "cancelled",
      "no_show",
      "refunded"
    ]
  }).notNull(),
  
  // Context
  triggeredBy: text("triggered_by"), // user_id or 'system'
  triggerReason: text("trigger_reason"),
  metadata: jsonb("metadata").$type<{
    error?: string;
    stripeErrorCode?: string;
    cancellationReason?: string;
    refundAmount?: number;
    notes?: string;
  }>().default({}),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ===== PAYOUT SCHEDULES =====
export const payoutSchedulesTable = pgTable("payout_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id")
    .notNull()
    .references(() => bookingsTable.id, { onDelete: "cascade" }), // CASCADE: Delete payout schedule when booking is deleted
  providerId: uuid("provider_id")
    .notNull()
    .references(() => providersTable.id, { onDelete: "cascade" }), // CASCADE: Delete payout schedules when provider is deleted
  
  // Payout details
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("usd").notNull(),
  platformFee: numeric("platform_fee", { precision: 10, scale: 2 }).notNull(),
  netPayout: numeric("net_payout", { precision: 10, scale: 2 }).notNull(),
  
  // Scheduling
  scheduledAt: timestamp("scheduled_at").notNull(),
  processedAt: timestamp("processed_at"),
  
  // Stripe integration
  stripeTransferId: text("stripe_transfer_id"),
  stripePayoutId: text("stripe_payout_id"),
  
  // Status tracking
  status: text("status", {
    enum: ["scheduled", "processing", "completed", "failed", "cancelled"]
  }).default("scheduled").notNull(),
  failureReason: text("failure_reason"),
  retryCount: integer("retry_count").default(0),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ===== AVAILABILITY CACHE =====
export const availabilityCacheTable = pgTable("availability_cache", {
  id: uuid("id").primaryKey().defaultRandom(),
  providerId: uuid("provider_id")
    .notNull()
    .references(() => providersTable.id, { onDelete: "cascade" }), // CASCADE: Delete cache when provider is deleted
  serviceId: uuid("service_id")
    .references(() => servicesTable.id, { onDelete: "cascade" }), // CASCADE: Delete cache when service is deleted
  
  // Time slot definition
  date: date("date").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  timezone: text("timezone").default("UTC").notNull(),
  
  // Availability status
  isAvailable: boolean("is_available").default(true).notNull(),
  isBooked: boolean("is_booked").default(false),
  bookingId: uuid("booking_id")
    .references(() => bookingsTable.id, { onDelete: "set null" }), // SET NULL: Clear booking reference when booking is deleted
  
  // Locking for concurrent booking prevention
  lockedUntil: timestamp("locked_until"),
  lockedBySession: text("locked_by_session"),
  
  // Cache metadata
  computedAt: timestamp("computed_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
}, (table) => ({
  // Unique constraint to prevent duplicate slots
  uniqueSlot: unique().on(table.providerId, table.date, table.startTime, table.endTime, table.timezone),
}));

// ===== BOOKING REMINDERS =====
export const bookingRemindersTable = pgTable("booking_reminders", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id")
    .notNull()
    .references(() => bookingsTable.id, { onDelete: "cascade" }), // CASCADE: Delete reminders when booking is deleted
  
  // Reminder configuration
  reminderType: text("reminder_type", {
    enum: ["confirmation", "reminder_24h", "reminder_2h", "follow_up"]
  }).notNull(),
  scheduledAt: timestamp("scheduled_at").notNull(),
  
  // Delivery method
  deliveryMethod: text("delivery_method", {
    enum: ["email", "sms", "push"]
  }).default("email").notNull(),
  recipientType: text("recipient_type", {
    enum: ["customer", "provider", "both"]
  }).notNull(),
  
  // Content
  subject: text("subject"),
  message: text("message"),
  templateId: text("template_id"),
  
  // Status
  status: text("status", {
    enum: ["scheduled", "sent", "failed", "cancelled"]
  }).default("scheduled").notNull(),
  sentAt: timestamp("sent_at"),
  failureReason: text("failure_reason"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ===== BOOKING PERFORMANCE LOG =====
export const bookingPerformanceLogTable = pgTable("booking_performance_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  operation: text("operation").notNull(),
  durationMs: integer("duration_ms").notNull(),
  metadata: jsonb("metadata").$type<{
    bookingId?: string;
    providerId?: string;
    serviceId?: string;
    errorMessage?: string;
    userAgent?: string;
    endpoint?: string;
  }>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ===== TYPE EXPORTS =====
export type Service = typeof servicesTable.$inferSelect;
export type NewService = typeof servicesTable.$inferInsert;

export type GuestBookingSession = typeof guestBookingSessionsTable.$inferSelect;
export type NewGuestBookingSession = typeof guestBookingSessionsTable.$inferInsert;

export type BookingStateTransition = typeof bookingStateTransitionsTable.$inferSelect;
export type NewBookingStateTransition = typeof bookingStateTransitionsTable.$inferInsert;

export type PayoutSchedule = typeof payoutSchedulesTable.$inferSelect;
export type NewPayoutSchedule = typeof payoutSchedulesTable.$inferInsert;

export type AvailabilityCache = typeof availabilityCacheTable.$inferSelect;
export type NewAvailabilityCache = typeof availabilityCacheTable.$inferInsert;

export type BookingReminder = typeof bookingRemindersTable.$inferSelect;
export type NewBookingReminder = typeof bookingRemindersTable.$inferInsert;

export type BookingPerformanceLog = typeof bookingPerformanceLogTable.$inferSelect;
export type NewBookingPerformanceLog = typeof bookingPerformanceLogTable.$inferInsert;

// ===== RELATIONS =====
export const servicesRelations = relations(servicesTable, ({ one, many }) => ({
  provider: one(providersTable, {
    fields: [servicesTable.providerId],
    references: [providersTable.id],
  }),
  bookings: many(bookingsTable),
  availabilityCache: many(availabilityCacheTable),
}));

export const guestBookingSessionsRelations = relations(guestBookingSessionsTable, ({ many }) => ({
  bookings: many(bookingsTable),
}));

export const bookingStateTransitionsRelations = relations(bookingStateTransitionsTable, ({ one }) => ({
  booking: one(bookingsTable, {
    fields: [bookingStateTransitionsTable.bookingId],
    references: [bookingsTable.id],
  }),
}));

export const payoutSchedulesRelations = relations(payoutSchedulesTable, ({ one }) => ({
  booking: one(bookingsTable, {
    fields: [payoutSchedulesTable.bookingId],
    references: [bookingsTable.id],
  }),
  provider: one(providersTable, {
    fields: [payoutSchedulesTable.providerId],
    references: [providersTable.id],
  }),
}));

export const availabilityCacheRelations = relations(availabilityCacheTable, ({ one }) => ({
  provider: one(providersTable, {
    fields: [availabilityCacheTable.providerId],
    references: [providersTable.id],
  }),
  service: one(servicesTable, {
    fields: [availabilityCacheTable.serviceId],
    references: [servicesTable.id],
  }),
  booking: one(bookingsTable, {
    fields: [availabilityCacheTable.bookingId],
    references: [bookingsTable.id],
  }),
}));

export const bookingRemindersRelations = relations(bookingRemindersTable, ({ one }) => ({
  booking: one(bookingsTable, {
    fields: [bookingRemindersTable.bookingId],
    references: [bookingsTable.id],
  }),
}));

// ===== ENHANCED BOOKING STATUS TYPES =====
export const BookingStatus = {
  PENDING: "pending",
  PAYMENT_FAILED: "payment_failed", 
  CONFIRMED: "confirmed",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  NO_SHOW: "no_show",
  REFUNDED: "refunded"
} as const;

export type BookingStatusType = typeof BookingStatus[keyof typeof BookingStatus];

// ===== BOOKING STATE MACHINE =====
export const VALID_STATUS_TRANSITIONS: Record<BookingStatusType, BookingStatusType[]> = {
  [BookingStatus.PENDING]: [BookingStatus.PAYMENT_FAILED, BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
  [BookingStatus.PAYMENT_FAILED]: [BookingStatus.PENDING, BookingStatus.CANCELLED],
  [BookingStatus.CONFIRMED]: [BookingStatus.IN_PROGRESS, BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
  [BookingStatus.IN_PROGRESS]: [BookingStatus.COMPLETED, BookingStatus.CANCELLED],
  [BookingStatus.COMPLETED]: [BookingStatus.REFUNDED],
  [BookingStatus.CANCELLED]: [BookingStatus.REFUNDED],
  [BookingStatus.NO_SHOW]: [BookingStatus.REFUNDED],
  [BookingStatus.REFUNDED]: [], // Terminal state
};

// ===== UTILITY TYPES =====
export interface TimeSlot {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  isBooked?: boolean;
  lockId?: string;
  lockedUntil?: Date;
}

export interface BookingConflictError {
  type: 'BOOKING_CONFLICT';
  message: string;
  conflictingBooking?: {
    id: string;
    startTime: string;
    endTime: string;
    status: BookingStatusType;
  };
  alternatives?: TimeSlot[];
}

export interface BookingValidationError {
  type: 'VALIDATION_ERROR';
  field: string;
  message: string;
  code: string;
}

export interface CreateBookingRequest {
  providerId: string;
  serviceId: string;
  customerId?: string; // Optional for guest bookings
  guestSessionId?: string; // Required for guest bookings
  
  // Timing
  bookingDate: Date;
  startTime: string;
  endTime: string;
  timezone: string;
  
  // Service details
  serviceName: string;
  servicePrice: number;
  serviceDuration: number; // minutes
  
  // Customer info
  customerNotes?: string;
  
  // Payment
  totalAmount: number;
  platformFee: number;
  providerPayout: number;
  isGuestBooking: boolean;
}

export interface BookingSearchFilters {
  location?: {
    city?: string;
    state?: string;
    radius?: number; // miles
  };
  category?: string;
  subcategory?: string;
  priceRange?: {
    min?: number;
    max?: number;
  };
  availability?: {
    date?: Date;
    startTime?: string;
    endTime?: string;
    duration?: number; // minutes
  };
  rating?: {
    min?: number;
  };
  sortBy?: 'price' | 'rating' | 'distance' | 'availability';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

// Re-export existing tables from their respective schemas
export { 
  providerAvailabilityTable,
  providerBlockedSlotsTable,
  providerTestimonialsTable,
  providersTable
} from './providers-schema';

export { bookingsTable } from './bookings-schema';