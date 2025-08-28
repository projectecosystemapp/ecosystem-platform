"use client";

import { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Send, MoreVertical } from "lucide-react";
import { MessageBubble } from "./message-bubble";
import { MessageComposer } from "./message-composer";
import { formatDistanceToNow } from "date-fns";

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  messageType: string;
  isRead: boolean;
  readAt?: Date;
  isEdited: boolean;
  editedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  sender: {
    userId: string;
    email: string;
  };
  isOwnMessage: boolean;
}

interface Conversation {
  id: string;
  participantOneId: string;
  participantTwoId: string;
  bookingId?: string;
  lastMessageAt?: Date;
  createdAt: Date;
}

interface ConversationData {
  messages: Message[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  conversation: Conversation;
}

interface ConversationViewProps {
  conversationId: string;
  onMessageSent?: () => void;
  onBack?: () => void;
}

export function ConversationView({ 
  conversationId, 
  onMessageSent,
  onBack 
}: ConversationViewProps) {
  const { user } = useUser();
  const [conversationData, setConversationData] = useState<ConversationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get other participant info
  const otherParticipant = conversationData?.conversation 
    ? conversationData.conversation.participantOneId === user?.id
      ? conversationData.messages[0]?.sender?.userId === conversationData.conversation.participantOneId 
        ? null 
        : conversationData.messages.find(m => m.sender.userId === conversationData.conversation.participantTwoId)?.sender
      : conversationData.messages.find(m => m.sender.userId === conversationData.conversation.participantOneId)?.sender
    : null;

  // Fetch messages for conversation
  const fetchMessages = async (page = 1) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/messages/${conversationId}?page=${page}&limit=50`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch messages");
      }

      const data = await response.json();
      setConversationData({
        ...data,
        messages: data.messages.map((msg: any) => ({
          ...msg,
          createdAt: new Date(msg.createdAt),
          updatedAt: new Date(msg.updatedAt),
          readAt: msg.readAt ? new Date(msg.readAt) : null,
          editedAt: msg.editedAt ? new Date(msg.editedAt) : null,
        })),
        conversation: {
          ...data.conversation,
          createdAt: new Date(data.conversation.createdAt),
          lastMessageAt: data.conversation.lastMessageAt 
            ? new Date(data.conversation.lastMessageAt) 
            : null,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (conversationId) {
      fetchMessages();
    }
  }, [conversationId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [conversationData?.messages]);

  // Handle sending message
  const handleSendMessage = async (content: string) => {
    if (!content.trim() || !otherParticipant || sending) return;

    setSending(true);
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipientId: otherParticipant.userId,
          content: content.trim(),
          bookingId: conversationData?.conversation.bookingId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      // Refresh messages
      await fetchMessages();
      onMessageSent?.();
    } catch (err) {
      console.error("Error sending message:", err);
      // You could show a toast notification here
    } finally {
      setSending(false);
    }
  };

  // Get initials for avatar
  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-96">
          <div className="animate-pulse">Loading conversation...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="text-destructive mb-2">Error loading conversation</div>
            <Button onClick={() => fetchMessages()} variant="outline" size="sm">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!conversationData) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-96">
          <div>Conversation not found</div>
        </CardContent>
      </Card>
    );
  }

  // Get the other participant from messages
  const otherParticipantFromMessages = conversationData.messages.find(
    m => m.sender.userId !== user?.id
  )?.sender;

  const displayParticipant = otherParticipant || otherParticipantFromMessages;

  return (
    <Card className="h-full flex flex-col">
      {/* Header */}
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          
          <Avatar>
            <AvatarFallback>
              {displayParticipant ? getInitials(displayParticipant.email) : "??"}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1">
            <CardTitle className="text-lg">
              {displayParticipant?.email || "Unknown User"}
            </CardTitle>
            {conversationData.conversation.lastMessageAt && (
              <div className="text-sm text-muted-foreground">
                Last active {formatDistanceToNow(conversationData.conversation.lastMessageAt, { addSuffix: true })}
              </div>
            )}
          </div>

          <Button variant="ghost" size="sm">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      {/* Messages */}
      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
          {conversationData.messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No messages yet. Start the conversation!
            </div>
          ) : (
            <div className="space-y-4">
              {conversationData.messages.map((message, index) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  showSender={
                    index === 0 || 
                    conversationData.messages[index - 1].senderId !== message.senderId
                  }
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>
      </CardContent>

      {/* Message Composer */}
      <div className="border-t p-4">
        <MessageComposer
          onSendMessage={handleSendMessage}
          disabled={sending}
          placeholder={`Message ${displayParticipant?.email || "user"}...`}
        />
      </div>
    </Card>
  );
}