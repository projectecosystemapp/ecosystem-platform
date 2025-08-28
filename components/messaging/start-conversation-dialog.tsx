"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send, Loader2 } from "lucide-react";
import { z } from "zod";

const StartConversationSchema = z.object({
  recipientEmail: z.string().email("Please enter a valid email address"),
  message: z.string().min(1, "Message is required").max(1000, "Message is too long"),
});

interface StartConversationDialogProps {
  trigger?: React.ReactNode;
  recipientId?: string;
  recipientEmail?: string;
  bookingId?: string;
  onConversationStarted?: (conversationId: string) => void;
}

export function StartConversationDialog({
  trigger,
  recipientId,
  recipientEmail,
  bookingId,
  onConversationStarted,
}: StartConversationDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(recipientEmail || "");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const validation = StartConversationSchema.safeParse({
      recipientEmail: email,
      message,
    });

    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.issues.forEach((issue) => {
        const field = issue.path[0] as string;
        fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setSending(true);

    try {
      // If we have recipientId, use it directly. Otherwise, we need to find the user by email
      let targetRecipientId = recipientId;
      
      if (!targetRecipientId) {
        // In a real app, you might have an endpoint to find users by email
        // For now, we'll assume the email IS the userId (as per Clerk's setup)
        targetRecipientId = email;
      }

      const response = await fetch("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipientId: targetRecipientId,
          content: message.trim(),
          bookingId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to send message");
      }

      const data = await response.json();
      
      // Close dialog and reset form
      setOpen(false);
      setEmail(recipientEmail || "");
      setMessage("");
      
      // Notify parent component
      onConversationStarted?.(data.conversationId);
      
    } catch (error) {
      console.error("Error starting conversation:", error);
      setErrors({ 
        form: error instanceof Error ? error.message : "Failed to start conversation" 
      });
    } finally {
      setSending(false);
    }
  };

  // Reset form when dialog opens/closes
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setErrors({});
      setMessage("");
      if (!recipientEmail) {
        setEmail("");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="default" size="sm">
            <MessageSquare className="w-4 h-4 mr-2" />
            Start Conversation
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Start New Conversation
            </DialogTitle>
            <DialogDescription>
              Send a message to start a new conversation.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {/* Recipient Email */}
            <div className="grid gap-2">
              <Label htmlFor="email">Recipient Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!!recipientEmail || sending}
                className={errors.recipientEmail ? "border-destructive" : ""}
              />
              {errors.recipientEmail && (
                <div className="text-sm text-destructive">{errors.recipientEmail}</div>
              )}
            </div>

            {/* Message */}
            <div className="grid gap-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                placeholder="Type your message here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={sending}
                maxLength={1000}
                className={`min-h-[100px] ${errors.message ? "border-destructive" : ""}`}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                {errors.message && (
                  <span className="text-destructive">{errors.message}</span>
                )}
                <span className="ml-auto">{message.length}/1000</span>
              </div>
            </div>

            {/* Booking Context */}
            {bookingId && (
              <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                This message will be linked to your booking.
              </div>
            )}

            {/* Form-level error */}
            {errors.form && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                {errors.form}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={sending}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={sending || !email.trim() || !message.trim()}
            >
              {sending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Send Message
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}