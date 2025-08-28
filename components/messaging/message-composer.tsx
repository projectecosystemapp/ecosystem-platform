"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MessageComposerProps {
  onSendMessage: (content: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
}

export function MessageComposer({
  onSendMessage,
  disabled = false,
  placeholder = "Type your message...",
  maxLength = 1000,
}: MessageComposerProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Handle sending message
  const handleSend = async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || sending || disabled) return;

    setSending(true);
    try {
      await onSendMessage(trimmedMessage);
      setMessage(""); // Clear input after sending
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } catch (error) {
      console.error("Error sending message:", error);
      // Could show error toast here
    } finally {
      setSending(false);
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }

    // Allow Shift+Enter for new lines
    if (e.key === "Enter" && e.shiftKey) {
      // Let the default behavior happen (new line)
      return;
    }
  };

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);

    // Auto-resize
    const textarea = e.target;
    textarea.style.height = "auto";
    const scrollHeight = Math.min(textarea.scrollHeight, 120); // Max height ~4 lines
    textarea.style.height = `${scrollHeight}px`;
  };

  const isDisabled = disabled || sending;
  const canSend = message.trim().length > 0 && !isDisabled;

  return (
    <div className="flex gap-3 items-end">
      <div className="flex-1 relative">
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isDisabled}
          maxLength={maxLength}
          className={cn(
            "min-h-[40px] max-h-[120px] resize-none",
            "focus:ring-2 focus:ring-primary/20",
            isDisabled && "opacity-50 cursor-not-allowed"
          )}
          style={{ height: "auto" }}
        />
        
        {/* Character count */}
        {message.length > maxLength * 0.8 && (
          <div className="absolute -bottom-6 right-0 text-xs text-muted-foreground">
            {message.length}/{maxLength}
          </div>
        )}
      </div>

      <Button
        onClick={handleSend}
        disabled={!canSend}
        size="sm"
        className={cn(
          "shrink-0 h-10 w-10 p-0",
          canSend 
            ? "bg-primary hover:bg-primary/90" 
            : "bg-muted text-muted-foreground cursor-not-allowed"
        )}
      >
        {sending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
      </Button>
    </div>
  );
}