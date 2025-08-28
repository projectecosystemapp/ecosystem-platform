import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { conversationsTable, messagesTable } from "@/db/schema";
import { eq, or, and, desc } from "drizzle-orm";
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

    // Get all conversations where user is a participant (simplified query for build fix)
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
      })
      .from(conversationsTable)
      .where(
        and(
          or(
            eq(conversationsTable.participantOneId, userId),
            eq(conversationsTable.participantTwoId, userId)
          ),
          eq(conversationsTable.isActive, true)
        )
      )
      .orderBy(desc(conversationsTable.lastMessageAt))
      .limit(50);

    // Format the response (simplified without email details)
    const formattedConversations = conversations.map((conv) => ({
      id: conv.id,
      participantOne: {
        userId: conv.participantOneId,
      },
      participantTwo: {
        userId: conv.participantTwoId,
      },
      bookingId: conv.bookingId,
      lastMessageAt: conv.lastMessageAt,
      isActive: conv.isActive,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      // Will be enhanced later with proper joins
      lastMessage: null,
      unreadCount: 0,
    }));

    return NextResponse.json({
      conversations: formattedConversations,
      success: true,
    });

  } catch (error) {
    console.error("Error fetching conversations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
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

    const body = await request.json();
    const validatedData = SendMessageSchema.parse(body);

    // TODO: Need to implement proper conversation handling
    // For now, create a basic message with required fields only
    const message = await db
      .insert(messagesTable)
      .values({
        conversationId: "00000000-0000-0000-0000-000000000000", // TODO: Create proper conversation
        senderId: userId,
        recipientId: validatedData.recipientId,
        content: validatedData.content,
      })
      .returning();

    return NextResponse.json({
      message: message[0],
      success: true,
    });

  } catch (error) {
    console.error("Error sending message:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}