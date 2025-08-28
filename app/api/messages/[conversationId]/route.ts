import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { conversationsTable, messagesTable, messageReadReceiptsTable, profilesTable } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { ratelimit } from "@/lib/redis";

interface RouteParams {
  params: {
    conversationId: string;
  };
}

// GET /api/messages/[conversationId] - Get all messages in a conversation
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    const { conversationId } = params;

    // Verify user is a participant in this conversation
    const conversation = await db
      .select()
      .from(conversationsTable)
      .where(
        and(
          eq(conversationsTable.id, conversationId),
          eq(conversationsTable.isActive, true),
          sql`(participant_one_id = ${userId} OR participant_two_id = ${userId})`
        )
      )
      .limit(1);

    if (conversation.length === 0) {
      return NextResponse.json(
        { error: "Conversation not found or access denied" },
        { status: 404 }
      );
    }

    // Get pagination parameters
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 100);
    const offset = (page - 1) * limit;

    // Get messages with sender information
    const messages = await db
      .select({
        id: messagesTable.id,
        conversationId: messagesTable.conversationId,
        senderId: messagesTable.senderId,
        content: messagesTable.content,
        messageType: messagesTable.messageType,
        isRead: messagesTable.isRead,
        readAt: messagesTable.readAt,
        isEdited: messagesTable.isEdited,
        editedAt: messagesTable.editedAt,
        createdAt: messagesTable.createdAt,
        updatedAt: messagesTable.updatedAt,
        senderEmail: profilesTable.email,
      })
      .from(messagesTable)
      .leftJoin(profilesTable, eq(messagesTable.senderId, profilesTable.userId))
      .where(
        and(
          eq(messagesTable.conversationId, conversationId),
          eq(messagesTable.isDeleted, false)
        )
      )
      .orderBy(desc(messagesTable.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const [{ count: totalCount }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(messagesTable)
      .where(
        and(
          eq(messagesTable.conversationId, conversationId),
          eq(messagesTable.isDeleted, false)
        )
      );

    // Format messages
    const formattedMessages = messages.map((message) => ({
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      content: message.content,
      messageType: message.messageType,
      isRead: message.isRead,
      readAt: message.readAt,
      isEdited: message.isEdited,
      editedAt: message.editedAt,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      sender: {
        userId: message.senderId,
        email: message.senderEmail,
      },
      isOwnMessage: message.senderId === userId,
    }));

    return NextResponse.json({
      messages: formattedMessages.reverse(), // Reverse to show oldest first
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: page * limit < totalCount,
        hasPrev: page > 1,
      },
      conversation: {
        id: conversation[0].id,
        participantOneId: conversation[0].participantOneId,
        participantTwoId: conversation[0].participantTwoId,
        bookingId: conversation[0].bookingId,
        lastMessageAt: conversation[0].lastMessageAt,
        createdAt: conversation[0].createdAt,
      },
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

// PUT /api/messages/[conversationId] - Mark messages as read
export async function PUT(request: NextRequest, { params }: RouteParams) {
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

    const { conversationId } = params;

    // Verify user is a participant in this conversation
    const conversation = await db
      .select()
      .from(conversationsTable)
      .where(
        and(
          eq(conversationsTable.id, conversationId),
          eq(conversationsTable.isActive, true),
          sql`(participant_one_id = ${userId} OR participant_two_id = ${userId})`
        )
      )
      .limit(1);

    if (conversation.length === 0) {
      return NextResponse.json(
        { error: "Conversation not found or access denied" },
        { status: 404 }
      );
    }

    // Mark all unread messages as read in a transaction
    const result = await db.transaction(async (tx) => {
      // Get the latest message ID in this conversation
      const latestMessage = await tx
        .select({ id: messagesTable.id })
        .from(messagesTable)
        .where(
          and(
            eq(messagesTable.conversationId, conversationId),
            eq(messagesTable.isDeleted, false)
          )
        )
        .orderBy(desc(messagesTable.createdAt))
        .limit(1);

      if (latestMessage.length === 0) {
        return { updatedMessages: 0 };
      }

      // Mark all messages from other participants as read
      const updatedMessages = await tx
        .update(messagesTable)
        .set({
          isRead: true,
          readAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(messagesTable.conversationId, conversationId),
            eq(messagesTable.isRead, false),
            eq(messagesTable.isDeleted, false),
            sql`sender_id != ${userId}` // Only mark messages from others as read
          )
        )
        .returning({ id: messagesTable.id });

      // Update read receipt
      await tx
        .update(messageReadReceiptsTable)
        .set({
          lastReadMessageId: latestMessage[0].id,
          lastReadAt: new Date(),
          unreadCount: 0,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(messageReadReceiptsTable.conversationId, conversationId),
            eq(messageReadReceiptsTable.userId, userId)
          )
        );

      return { updatedMessages: updatedMessages.length };
    });

    return NextResponse.json({
      success: true,
      markedAsRead: result.updatedMessages,
      message: `Marked ${result.updatedMessages} messages as read`,
    });
  } catch (error) {
    console.error("Error marking messages as read:", error);
    return NextResponse.json(
      { error: "Failed to mark messages as read" },
      { status: 500 }
    );
  }
}