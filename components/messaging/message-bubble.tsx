"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday, formatDistanceToNow } from "date-fns";
import { Check, CheckCheck, Edit } from "lucide-react";

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

interface MessageBubbleProps {
  message: Message;
  showSender?: boolean;
}

export function MessageBubble({ message, showSender = true }: MessageBubbleProps) {
  // Get initials for avatar
  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase();
  };

  // Format timestamp
  const formatMessageTime = (date: Date) => {
    if (isToday(date)) {
      return format(date, "HH:mm");
    } else if (isYesterday(date)) {
      return `Yesterday ${format(date, "HH:mm")}`;
    } else {
      return format(date, "MMM dd, HH:mm");
    }
  };

  // System messages (like "User joined the conversation")
  if (message.messageType === "system") {
    return (
      <div className="flex justify-center">
        <Badge variant="secondary" className="text-xs px-3 py-1">
          {message.content}
        </Badge>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex gap-3 max-w-[80%]",
        message.isOwnMessage ? "ml-auto flex-row-reverse" : "mr-auto"
      )}
    >
      {/* Avatar - only show for other users and when showSender is true */}
      {!message.isOwnMessage && showSender && (
        <Avatar className="w-8 h-8 flex-shrink-0">
          <AvatarFallback className="text-xs">
            {getInitials(message.sender.email)}
          </AvatarFallback>
        </Avatar>
      )}

      {/* Message content */}
      <div
        className={cn(
          "flex flex-col gap-1",
          message.isOwnMessage ? "items-end" : "items-start"
        )}
      >
        {/* Sender name - only show for other users when showSender is true */}
        {!message.isOwnMessage && showSender && (
          <div className="text-xs text-muted-foreground px-1">
            {message.sender.email}
          </div>
        )}

        {/* Message bubble */}
        <div
          className={cn(
            "rounded-2xl px-4 py-2 max-w-full break-words",
            message.isOwnMessage
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-muted rounded-bl-md"
          )}
        >
          <div className="text-sm leading-relaxed">{message.content}</div>
          
          {/* Message metadata */}
          <div
            className={cn(
              "flex items-center gap-1 mt-1 text-xs",
              message.isOwnMessage
                ? "text-primary-foreground/70 justify-end"
                : "text-muted-foreground"
            )}
          >
            {/* Edited indicator */}
            {message.isEdited && (
              <Edit className="w-3 h-3" />
            )}
            
            {/* Timestamp */}
            <span>{formatMessageTime(message.createdAt)}</span>
            
            {/* Read receipt for own messages */}
            {message.isOwnMessage && (
              <div className="ml-1">
                {message.isRead ? (
                  <CheckCheck className="w-3 h-3 text-blue-400" />
                ) : (
                  <Check className="w-3 h-3" />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Read timestamp for own messages */}
        {message.isOwnMessage && message.isRead && message.readAt && (
          <div className="text-xs text-muted-foreground px-1">
            Read {formatDistanceToNow(message.readAt, { addSuffix: true })}
          </div>
        )}
      </div>
    </div>
  );
}