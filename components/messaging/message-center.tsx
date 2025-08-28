"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageSquare, Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ConversationView } from "./conversation-view";
import { formatDistanceToNow } from "date-fns";

interface Conversation {
  id: string;
  participantOne: { userId: string; email: string };
  participantTwo: { userId: string; email: string };
  bookingId?: string;
  lastMessageAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastMessage?: {
    id: string;
    content: string;
    senderId: string;
    createdAt: Date;
  };
  unreadCount: number;
  otherParticipant: { userId: string; email: string };
}

interface MessageCenterProps {
  onNewMessage?: () => void;
}

export function MessageCenter({ onNewMessage }: MessageCenterProps) {
  const { user } = useUser();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch conversations
  const fetchConversations = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/messages");
      
      if (!response.ok) {
        throw new Error("Failed to fetch conversations");
      }

      const data = await response.json();
      setConversations(data.conversations.map((conv: any) => ({
        ...conv,
        lastMessageAt: conv.lastMessageAt ? new Date(conv.lastMessageAt) : null,
        createdAt: new Date(conv.createdAt),
        updatedAt: new Date(conv.updatedAt),
        lastMessage: conv.lastMessage
          ? {
              ...conv.lastMessage,
              createdAt: new Date(conv.lastMessage.createdAt),
            }
          : null,
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [user]);

  // Filter conversations based on search term
  const filteredConversations = conversations.filter((conv) =>
    conv.otherParticipant.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get initials for avatar
  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase();
  };

  // Handle conversation selection
  const handleConversationSelect = (conversationId: string) => {
    setSelectedConversation(conversationId);
    
    // Mark conversation as read when selected
    fetch(`/api/messages/${conversationId}`, {
      method: "PUT",
    }).then(() => {
      // Update local state to reflect read status
      setConversations(prev => 
        prev.map(conv => 
          conv.id === conversationId 
            ? { ...conv, unreadCount: 0 }
            : conv
        )
      );
    }).catch(console.error);
  };

  // Handle new message sent
  const handleMessageSent = () => {
    fetchConversations(); // Refresh conversations
    onNewMessage?.();
  };

  if (loading) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-96">
          <div className="animate-pulse">Loading messages...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="text-destructive mb-2">Error loading messages</div>
            <Button onClick={fetchConversations} variant="outline" size="sm">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex h-full">
      {/* Conversations List */}
      <Card className="w-1/3 mr-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Messages
            {conversations.length > 0 && (
              <Badge variant="secondary">{conversations.length}</Badge>
            )}
          </CardTitle>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <ScrollArea className="h-96">
            {filteredConversations.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                {searchTerm ? "No conversations match your search" : "No conversations yet"}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredConversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    onClick={() => handleConversationSelect(conversation.id)}
                    className={`w-full p-4 text-left hover:bg-muted/50 transition-colors ${
                      selectedConversation === conversation.id ? "bg-muted" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar>
                        <AvatarFallback>
                          {getInitials(conversation.otherParticipant.email)}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="font-medium text-sm truncate">
                            {conversation.otherParticipant.email}
                          </div>
                          {conversation.unreadCount > 0 && (
                            <Badge variant="default" className="ml-2 text-xs">
                              {conversation.unreadCount}
                            </Badge>
                          )}
                        </div>
                        
                        {conversation.lastMessage ? (
                          <div className="text-xs text-muted-foreground truncate">
                            {conversation.lastMessage.content}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            New conversation
                          </div>
                        )}
                        
                        {conversation.lastMessageAt && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(conversation.lastMessageAt, { addSuffix: true })}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Conversation View */}
      <div className="flex-1">
        {selectedConversation ? (
          <ConversationView
            conversationId={selectedConversation}
            onMessageSent={handleMessageSent}
          />
        ) : (
          <Card className="h-full">
            <CardContent className="flex items-center justify-center h-96">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 text-muted-foreground mb-4 mx-auto" />
                <div className="text-lg font-medium mb-2">Select a conversation</div>
                <div className="text-muted-foreground">
                  Choose a conversation from the left to start messaging
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}