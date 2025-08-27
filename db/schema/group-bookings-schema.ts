import { 
  pgTable, 
  text, 
  uuid, 
  timestamp, 
  integer,
  boolean,
  jsonb,
  decimal,
  pgEnum
} from "drizzle-orm/pg-core";
import { bookingsTable } from "./bookings-schema";
import { profilesTable } from "./profiles-schema";
import { providersTable } from "./providers-schema";

// Enums
export const paymentMethodEnum = pgEnum("group_payment_method", [
  "organizer_pays",     // Organizer pays full amount
  "split_equal",        // Split equally among all participants
  "custom_split",       // Custom amounts per participant
  "pay_own",           // Each pays for themselves
  "deposit_split",     // Split deposit, rest later
  "corporate"          // Corporate billing
]);

export const participantStatusEnum = pgEnum("participant_status", [
  "invited",
  "accepted",
  "declined", 
  "pending_payment",
  "paid",
  "cancelled",
  "refunded",
  "waitlisted"
]);

export const groupBookingStatusEnum = pgEnum("group_booking_status", [
  "draft",
  "collecting",       // Collecting participants/payments
  "pending_confirmation", // Waiting for min participants
  "confirmed",
  "cancelled",
  "completed"
]);

// Group Bookings - Main group booking entity
export const groupBookingsTable = pgTable("group_bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id")
    .unique()
    .references(() => bookingsTable.id, { onDelete: "cascade" }),
  
  // Organizer
  organizerId: text("organizer_id")
    .notNull()
    .references(() => profilesTable.userId, { onDelete: "restrict" }),
  organizerName: text("organizer_name"),
  organizerEmail: text("organizer_email").notNull(),
  organizerPhone: text("organizer_phone"),
  
  // Group details
  groupName: text("group_name"),
  groupDescription: text("group_description"),
  eventType: text("event_type"), // birthday, corporate, team_building, etc.
  
  // Participants
  minParticipants: integer("min_participants").default(1),
  maxParticipants: integer("max_participants").notNull(),
  currentParticipants: integer("current_participants").default(0),
  confirmedParticipants: integer("confirmed_participants").default(0),
  
  // Payment
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  totalAmountCents: integer("total_amount_cents").notNull(),
  perPersonAmountCents: integer("per_person_amount_cents"),
  depositAmountCents: integer("deposit_amount_cents"),
  
  // Collected amounts
  collectedAmountCents: integer("collected_amount_cents").default(0),
  refundedAmountCents: integer("refunded_amount_cents").default(0),
  
  // Deadlines
  registrationDeadline: timestamp("registration_deadline"),
  paymentDeadline: timestamp("payment_deadline"),
  
  // Status
  status: groupBookingStatusEnum("status").default("draft").notNull(),
  
  // Options
  allowWaitlist: boolean("allow_waitlist").default(false),
  allowPartialPayment: boolean("allow_partial_payment").default(false),
  requiresApproval: boolean("requires_approval").default(false),
  isPublic: boolean("is_public").default(false), // Can be discovered/joined by anyone
  
  // Communication
  welcomeMessage: text("welcome_message"),
  instructions: text("instructions"),
  
  // Metadata
  customFields: jsonb("custom_fields").default('{}'), // Custom form fields
  metadata: jsonb("metadata").default('{}'),
  
  // Timestamps
  confirmedAt: timestamp("confirmed_at"),
  cancelledAt: timestamp("cancelled_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Group Participants - Individual participants in a group
export const groupParticipantsTable = pgTable("group_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupBookingId: uuid("group_booking_id")
    .notNull()
    .references(() => groupBookingsTable.id, { onDelete: "cascade" }),
  
  // Participant info
  email: text("email").notNull(),
  name: text("name"),
  phone: text("phone"),
  userId: text("user_id")
    .references(() => profilesTable.userId, { onDelete: "set null" }),
  
  // Payment
  amountCents: integer("amount_cents").notNull(),
  paidAmountCents: integer("paid_amount_cents").default(0),
  refundedAmountCents: integer("refunded_amount_cents").default(0),
  
  // Stripe
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeRefundId: text("stripe_refund_id"),
  
  // Status
  status: participantStatusEnum("status").default("invited").notNull(),
  
  // Invitation
  invitationToken: text("invitation_token").unique(),
  invitationSentAt: timestamp("invitation_sent_at"),
  invitationViewedAt: timestamp("invitation_viewed_at"),
  
  // Response
  respondedAt: timestamp("responded_at"),
  declineReason: text("decline_reason"),
  
  // Payment tracking
  paymentDueDate: timestamp("payment_due_date"),
  paidAt: timestamp("paid_at"),
  paymentRemindersSent: integer("payment_reminders_sent").default(0),
  lastReminderAt: timestamp("last_reminder_at"),
  
  // Attendance
  attendanceConfirmed: boolean("attendance_confirmed").default(false),
  checkedInAt: timestamp("checked_in_at"),
  noShow: boolean("no_show").default(false),
  
  // Special requirements
  dietaryRestrictions: text("dietary_restrictions"),
  specialRequests: text("special_requests"),
  emergencyContact: jsonb("emergency_contact"), // {name, phone, relationship}
  
  // Metadata
  customResponses: jsonb("custom_responses").default('{}'), // Responses to custom fields
  metadata: jsonb("metadata").default('{}'),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Split Payment Sessions - Track split payment progress
export const splitPaymentSessionsTable = pgTable("split_payment_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupBookingId: uuid("group_booking_id")
    .notNull()
    .references(() => groupBookingsTable.id, { onDelete: "cascade" }),
  
  // Session details
  sessionToken: text("session_token").unique().notNull(),
  
  // Amount tracking
  totalAmountCents: integer("total_amount_cents").notNull(),
  collectedAmountCents: integer("collected_amount_cents").default(0),
  remainingAmountCents: integer("remaining_amount_cents").notNull(),
  
  // Participants
  totalParticipants: integer("total_participants").notNull(),
  paidParticipants: integer("paid_participants").default(0),
  
  // Stripe
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  
  // Status
  status: text("status").default("active").notNull(), // active, completed, expired, cancelled
  
  // Timing
  expiresAt: timestamp("expires_at").notNull(),
  completedAt: timestamp("completed_at"),
  
  // Metadata
  paymentSplits: jsonb("payment_splits").default('[]'), // [{email, amount, paid}]
  metadata: jsonb("metadata").default('{}'),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Group Messages - Communication with group
export const groupMessagesTable = pgTable("group_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupBookingId: uuid("group_booking_id")
    .notNull()
    .references(() => groupBookingsTable.id, { onDelete: "cascade" }),
  
  // Sender
  senderId: text("sender_id")
    .references(() => profilesTable.userId, { onDelete: "set null" }),
  senderType: text("sender_type").notNull(), // organizer, participant, provider, system
  senderName: text("sender_name"),
  
  // Message
  subject: text("subject"),
  content: text("content").notNull(),
  messageType: text("message_type").notNull(), // announcement, reminder, update, question
  
  // Recipients
  recipientType: text("recipient_type").notNull(), // all, unpaid, confirmed, specific
  specificRecipients: jsonb("specific_recipients").default('[]'), // Array of participant IDs
  
  // Delivery
  sentViaEmail: boolean("sent_via_email").default(false),
  sentViaSms: boolean("sent_via_sms").default(false),
  sentViaApp: boolean("sent_via_app").default(true),
  
  // Tracking
  deliveredCount: integer("delivered_count").default(0),
  readCount: integer("read_count").default(0),
  
  // Metadata
  attachments: jsonb("attachments").default('[]'), // Array of URLs
  metadata: jsonb("metadata").default('{}'),
  
  // Timestamps
  scheduledFor: timestamp("scheduled_for"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Group Activities - Track group booking activities
export const groupActivitiesTable = pgTable("group_activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupBookingId: uuid("group_booking_id")
    .notNull()
    .references(() => groupBookingsTable.id, { onDelete: "cascade" }),
  
  // Activity
  activityType: text("activity_type").notNull(), // participant_joined, payment_received, message_sent, etc.
  actorId: text("actor_id"),
  actorType: text("actor_type"), // participant, organizer, system
  
  // Details
  description: text("description").notNull(),
  details: jsonb("details").default('{}'),
  
  // Related entities
  participantId: uuid("participant_id")
    .references(() => groupParticipantsTable.id, { onDelete: "set null" }),
  
  // Visibility
  isPublic: boolean("is_public").default(true), // Visible to all participants
  
  // Timestamps
  occurredAt: timestamp("occurred_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Type exports
export type GroupBooking = typeof groupBookingsTable.$inferSelect;
export type NewGroupBooking = typeof groupBookingsTable.$inferInsert;
export type GroupParticipant = typeof groupParticipantsTable.$inferSelect;
export type NewGroupParticipant = typeof groupParticipantsTable.$inferInsert;
export type SplitPaymentSession = typeof splitPaymentSessionsTable.$inferSelect;
export type NewSplitPaymentSession = typeof splitPaymentSessionsTable.$inferInsert;
export type GroupMessage = typeof groupMessagesTable.$inferSelect;
export type NewGroupMessage = typeof groupMessagesTable.$inferInsert;
export type GroupActivity = typeof groupActivitiesTable.$inferSelect;
export type NewGroupActivity = typeof groupActivitiesTable.$inferInsert;