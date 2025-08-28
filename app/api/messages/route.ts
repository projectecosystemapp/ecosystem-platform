import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { conversationsTable, messagesTable, messageReadReceiptsTable, profilesTable } from "@/db/schema";
import { eq, or, and, desc, sql, count } from "drizzle-orm";
import { z } from "zod";
import { ratelimit } from "@/lib/redis";

// Validation schemas
const SendMessageSchema = z.object({
  recipientId: z.string().min(1, "Recipient ID is required"),
  content: z.string().min(1, "Message content is required").max(1000, "Message too long"),
  bookingId: z.string().uuid().optional(),
});

// GET /api/messages - Get all conversations for the current user
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting
    const ip = request.ip ?? "127.0.0.1";
    const { success } = await ratelimit.limit(ip);
    if (!success) {
      return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
    }

    // Get all conversations where user is a participant
    const conversations = await db
      .select({
        id: conversationsTable.id,
        participantOneId: conversationsTable.participantOneId,
        participantTwoId: conversationsTable.participantTwoId,
        bookingId: conversationsTable.bookingId,
        lastMessageAt: conversationsTable.lastMessageAt,
        isActive: conversationsTable.isActive,
        createdAt: conversationsTable.createdAt,
        updatedAt: conversationsTable.updatedAt,
        // Get participant details
        participantOneEmail: sql<string>`p1.email`,
        participantTwoEmail: sql<string>`p2.email`,
        // Get last message
        lastMessageId: sql<string>`lm.id`,
        lastMessageContent: sql<string>`lm.content`,
        lastMessageSenderId: sql<string>`lm.sender_id`,
        lastMessageCreatedAt: sql<Date>`lm.created_at`,
        // Get unread count
        unreadCount: sql<number>`COALESCE(mrr.unread_count, 0)`,
      })
      .from(conversationsTable)
      .leftJoin(
        profilesTable.alias("p1"),
        eq(conversationsTable.participantOneId, sql`p1.user_id`)
      )
      .leftJoin(
        profilesTable.alias("p2"),
        eq(conversationsTable.participantTwoId, sql`p2.user_id`)
      )
      .leftJoin(
        messagesTable.alias("lm"),
        and(
          eq(sql`lm.conversation_id`, conversationsTable.id),
          eq(sql`lm.created_at`, conversationsTable.lastMessageAt),
          eq(sql`lm.is_deleted`, false)
        )
      )
      .leftJoin(
        messageReadReceiptsTable.alias("mrr"),
        and(
          eq(sql`mrr.conversation_id`, conversationsTable.id),
          eq(sql`mrr.user_id`, userId)
        )
      )
      .where(
        and(
          or(
            eq(conversationsTable.participantOneId, userId),
            eq(conversationsTable.participantTwoId, userId)
          ),
          eq(conversationsTable.isActive, true)
        )
      )
      .orderBy(desc(conversationsTable.lastMessageAt));

    // Format the response
    const formattedConversations = conversations.map((conv) => ({
      id: conv.id,
      participantOne: {
        userId: conv.participantOneId,
        email: conv.participantOneEmail,
      },
      participantTwo: {
        userId: conv.participantTwoId,
        email: conv.participantTwoEmail,
      },
      bookingId: conv.bookingId,
      lastMessageAt: conv.lastMessageAt,
      isActive: conv.isActive,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      lastMessage: conv.lastMessageId
        ? {
            id: conv.lastMessageId,
            content: conv.lastMessageContent,
            senderId: conv.lastMessageSenderId,
            createdAt: conv.lastMessageCreatedAt,
          }
        : null,
      unreadCount: conv.unreadCount,
      // Helper to get the other participant
      otherParticipant:
        conv.participantOneId === userId
          ? {
              userId: conv.participantTwoId,
              email: conv.participantTwoEmail,
            }
          : {
              userId: conv.participantOneId,
              email: conv.participantOneEmail,
            },
    }));

    return NextResponse.json({
      conversations: formattedConversations,
      total: formattedConversations.length,
    });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}

// POST /api/messages - Send a new message
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting
    const ip = request.ip ?? "127.0.0.1";
    const { success } = await ratelimit.limit(ip);
    if (!success) {
      return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
    }

    // Validate request body
    const body = await request.json();
    const validation = SendMessageSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { 
          error: "Invalid request data", 
          details: validation.error.issues 
        },
        { status: 400 }
      );
    }

    const { recipientId, content, bookingId } = validation.data;

    // Ensure user isn't trying to message themselves
    if (userId === recipientId) {
      return NextResponse.json(
        { error: "Cannot send message to yourself" },
        { status: 400 }
      );
    }

    // Verify recipient exists
    const recipient = await db
      .select({ userId: profilesTable.userId })
      .from(profilesTable)
      .where(eq(profilesTable.userId, recipientId))
      .limit(1);

    if (recipient.length === 0) {
      return NextResponse.json(
        { error: "Recipient not found" },
        { status: 404 }
      );
    }

    // Start transaction to create conversation and message
    const result = await db.transaction(async (tx) => {
      // Find existing conversation or create new one
      const participants = [userId, recipientId].sort(); // Normalize participant order
      
      let conversation = await tx
        .select()
        .from(conversationsTable)
        .where(
          and(
            or(
              and(
                eq(conversationsTable.participantOneId, participants[0]),
                eq(conversationsTable.participantTwoId, participants[1])
              ),
              and(
                eq(conversationsTable.participantOneId, participants[1]),
                eq(conversationsTable.participantTwoId, participants[0])
              )
            ),
            eq(conversationsTable.isActive, true)
          )
        )
        .limit(1);

      let conversationId: string;

      if (conversation.length === 0) {
        // Create new conversation
        const newConversation = await tx
          .insert(conversationsTable)
          .values({
            participantOneId: participants[0],
            participantTwoId: participants[1],
            bookingId,
            lastMessageAt: new Date(),
          })
          .returning();

        conversationId = newConversation[0].id;

        // Create initial read receipts for both participants
        await tx.insert(messageReadReceiptsTable).values([
          {
            userId: participants[0],
            conversationId: conversationId,
            unreadCount: participants[0] === userId ? 0 : 1, // Sender has 0 unread, recipient has 1
          },
          {
            userId: participants[1],
            conversationId: conversationId,
            unreadCount: participants[1] === userId ? 0 : 1, // Sender has 0 unread, recipient has 1
          },
        ]);
      } else {
        conversationId = conversation[0].id;

        // Update conversation's last message time
        await tx
          .update(conversationsTable)
          .set({ 
            lastMessageAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(conversationsTable.id, conversationId));

        // Update read receipt for recipient (increment unread count)
        await tx
          .update(messageReadReceiptsTable)
          .set({ 
            unreadCount: sql`unread_count + 1`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(messageReadReceiptsTable.conversationId, conversationId),
              eq(messageReadReceiptsTable.userId, recipientId)
            )
          );
      }

      // Create the message
      const newMessage = await tx
        .insert(messagesTable)
        .values({
          conversationId,
          senderId: userId,
          content,
          messageType: "text",
        })
        .returning();

      return {
        conversation: conversation[0] || { id: conversationId },
        message: newMessage[0],
      };
    });

    return NextResponse.json({
      success: true,
      conversationId: result.conversation.id,
      message: {
        id: result.message.id,
        content: result.message.content,
        senderId: result.message.senderId,
        createdAt: result.message.createdAt,
        isRead: result.message.isRead,
      },
    });
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}