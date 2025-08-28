import { pgTable, text, uuid, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { profilesTable } from "./profiles-schema";
import { bookingsTable } from "./bookings-schema";

// Conversations table - represents a messaging thread between two users
export const conversationsTable = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Participants in the conversation
  participantOneId: text("participant_one_id")
    .notNull()
    .references(() => profilesTable.userId, { onDelete: "cascade" }),
  participantTwoId: text("participant_two_id")
    .notNull()
    .references(() => profilesTable.userId, { onDelete: "cascade" }),
  
  // Optional booking context
  bookingId: uuid("booking_id")
    .references(() => bookingsTable.id, { onDelete: "set null" }), // Allow conversation to exist without booking
  
  // Conversation metadata
  lastMessageAt: timestamp("last_message_at"),
  isActive: boolean("is_active").default(true).notNull(),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
}, (table) => {
  return {
    // Ensure unique conversation between two participants
    uniqueParticipants: sql`
      CREATE UNIQUE INDEX conversations_participants_unique 
      ON ${table} (GREATEST(participant_one_id, participant_two_id), LEAST(participant_one_id, participant_two_id))
      WHERE is_active = true;
    `,
    
    // Index for finding conversations by participant
    participantOneIdx: sql`CREATE INDEX conversations_participant_one_idx ON ${table} (participant_one_id);`,
    participantTwoIdx: sql`CREATE INDEX conversations_participant_two_idx ON ${table} (participant_two_id);`,
    
    // Index for booking-related conversations
    bookingIdx: sql`CREATE INDEX conversations_booking_idx ON ${table} (booking_id);`,
    
    // Index for active conversations sorted by last message
    activeConversationsIdx: sql`
      CREATE INDEX conversations_active_last_message_idx 
      ON ${table} (last_message_at DESC) 
      WHERE is_active = true;
    `,
  };
});

// Messages table - individual messages within conversations
export const messagesTable = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Conversation this message belongs to
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversationsTable.id, { onDelete: "cascade" }),
  
  // Message sender
  senderId: text("sender_id")
    .notNull()
    .references(() => profilesTable.userId, { onDelete: "cascade" }),
  
  // Message content
  content: text("content").notNull(),
  messageType: text("message_type", { 
    enum: ["text", "system"] 
  }).default("text").notNull(),
  
  // Read status tracking
  isRead: boolean("is_read").default(false).notNull(),
  readAt: timestamp("read_at"),
  
  // Message metadata
  isEdited: boolean("is_edited").default(false).notNull(),
  editedAt: timestamp("edited_at"),
  
  // Soft delete for message history
  isDeleted: boolean("is_deleted").default(false).notNull(),
  deletedAt: timestamp("deleted_at"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
}, (table) => {
  return {
    // Index for finding messages in a conversation
    conversationIdx: sql`CREATE INDEX messages_conversation_idx ON ${table} (conversation_id, created_at DESC);`,
    
    // Index for unread messages by user
    unreadIdx: sql`
      CREATE INDEX messages_unread_idx 
      ON ${table} (conversation_id, is_read, created_at) 
      WHERE is_read = false AND is_deleted = false;
    `,
    
    // Index for sender
    senderIdx: sql`CREATE INDEX messages_sender_idx ON ${table} (sender_id);`,
    
    // Index for non-deleted messages
    activeMessagesIdx: sql`
      CREATE INDEX messages_active_idx 
      ON ${table} (conversation_id, created_at DESC) 
      WHERE is_deleted = false;
    `,
  };
});

// Message read receipts - track when each participant read messages
export const messageReadReceiptsTable = pgTable("message_read_receipts", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // User and conversation
  userId: text("user_id")
    .notNull()
    .references(() => profilesTable.userId, { onDelete: "cascade" }),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversationsTable.id, { onDelete: "cascade" }),
  
  // Last read message and timestamp
  lastReadMessageId: uuid("last_read_message_id")
    .references(() => messagesTable.id, { onDelete: "set null" }),
  lastReadAt: timestamp("last_read_at").defaultNow().notNull(),
  
  // Unread message count (cached for performance)
  unreadCount: integer("unread_count").default(0).notNull(),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
}, (table) => {
  return {
    // Unique receipt per user per conversation
    uniqueUserConversation: sql`
      CREATE UNIQUE INDEX message_read_receipts_user_conversation_unique 
      ON ${table} (user_id, conversation_id);
    `,
    
    // Index for finding receipts by user
    userIdx: sql`CREATE INDEX message_read_receipts_user_idx ON ${table} (user_id);`,
    
    // Index for unread count queries
    unreadCountIdx: sql`
      CREATE INDEX message_read_receipts_unread_idx 
      ON ${table} (user_id, unread_count) 
      WHERE unread_count > 0;
    `,
  };
});

// Type exports for TypeScript
export type Conversation = typeof conversationsTable.$inferSelect;
export type NewConversation = typeof conversationsTable.$inferInsert;
export type Message = typeof messagesTable.$inferSelect;
export type NewMessage = typeof messagesTable.$inferInsert;
export type MessageReadReceipt = typeof messageReadReceiptsTable.$inferSelect;
export type NewMessageReadReceipt = typeof messageReadReceiptsTable.$inferInsert;

// Helper types for API responses
export interface ConversationWithParticipants extends Conversation {
  participantOne: {
    userId: string;
    email: string;
  };
  participantTwo: {
    userId: string;
    email: string;
  };
  lastMessage?: Message;
  unreadCount: number;
}

export interface MessageWithSender extends Message {
  sender: {
    userId: string;
    email: string;
  };
}