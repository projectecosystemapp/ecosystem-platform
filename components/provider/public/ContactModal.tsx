"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, MessageCircle, Phone, Mail, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";

interface ContactModalProps {
  provider: any;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function ContactModal({ provider, isOpen = false, onClose }: ContactModalProps) {
  const { toast } = useToast();
  const [contactMethod, setContactMethod] = useState<"message" | "phone" | "email">("message");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast({
        title: "Message sent successfully!",
        description: `${provider.displayName} will respond within 2-4 hours.`,
      });
      
      // Reset form
      setFormData({
        name: "",
        email: "",
        phone: "",
        subject: "",
        message: "",
      });
      
      if (onClose) onClose();
    } catch (error) {
      toast({
        title: "Failed to send message",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl">Contact {provider?.displayName}</DialogTitle>
          <DialogDescription>
            Choose how you'd like to get in touch
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Response Time Alert */}
          <Alert className="bg-blue-50 border-blue-200">
            <Clock className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              Average response time: 2-4 hours during business hours
            </AlertDescription>
          </Alert>

          {/* Contact Method Selection */}
          <div>
            <Label className="text-base font-semibold mb-3 block">
              Preferred Contact Method
            </Label>
            <RadioGroup
              value={contactMethod}
              onValueChange={(value: any) => setContactMethod(value)}
            >
              <div className="grid grid-cols-3 gap-3">
                <label
                  htmlFor="message"
                  className={`flex flex-col items-center p-4 border rounded-lg cursor-pointer transition-all ${
                    contactMethod === "message"
                      ? "bg-blue-50 border-blue-500"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <RadioGroupItem value="message" id="message" className="sr-only" />
                  <MessageCircle className="h-6 w-6 mb-2 text-blue-600" />
                  <span className="text-sm font-medium">Message</span>
                </label>

                <label
                  htmlFor="phone"
                  className={`flex flex-col items-center p-4 border rounded-lg cursor-pointer transition-all ${
                    contactMethod === "phone"
                      ? "bg-blue-50 border-blue-500"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <RadioGroupItem value="phone" id="phone" className="sr-only" />
                  <Phone className="h-6 w-6 mb-2 text-blue-600" />
                  <span className="text-sm font-medium">Phone</span>
                </label>

                <label
                  htmlFor="email"
                  className={`flex flex-col items-center p-4 border rounded-lg cursor-pointer transition-all ${
                    contactMethod === "email"
                      ? "bg-blue-50 border-blue-500"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <RadioGroupItem value="email" id="email" className="sr-only" />
                  <Mail className="h-6 w-6 mb-2 text-blue-600" />
                  <span className="text-sm font-medium">Email</span>
                </label>
              </div>
            </RadioGroup>
          </div>

          {/* Contact Form */}
          <AnimatePresence mode="wait">
            {contactMethod === "message" && (
              <motion.form
                key="message"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                onSubmit={handleSubmit}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Your Name *</Label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      placeholder="john@example.com"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="subject">Subject *</Label>
                  <Input
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleInputChange}
                    required
                    placeholder="Inquiry about your services"
                  />
                </div>

                <div>
                  <Label htmlFor="message">Message *</Label>
                  <Textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    required
                    rows={5}
                    placeholder="Tell us more about what you need..."
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>Sending...</>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send Message
                    </>
                  )}
                </Button>
              </motion.form>
            )}

            {contactMethod === "phone" && (
              <motion.div
                key="phone"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <Alert>
                  <Phone className="h-4 w-4" />
                  <AlertDescription>
                    Phone support is available Monday-Friday, 9 AM - 6 PM
                  </AlertDescription>
                </Alert>
                
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                    <Phone className="h-8 w-8 text-blue-600" />
                  </div>
                  <p className="text-lg font-semibold mb-2">Call Provider</p>
                  <p className="text-3xl font-bold text-blue-600 mb-4">
                    (555) 123-4567
                  </p>
                  <p className="text-sm text-gray-600">
                    Best time to call: 10 AM - 5 PM
                  </p>
                  <Button
                    className="mt-6 bg-blue-600 hover:bg-blue-700"
                    onClick={() => window.location.href = "tel:+15551234567"}
                  >
                    <Phone className="mr-2 h-4 w-4" />
                    Call Now
                  </Button>
                </div>
              </motion.div>
            )}

            {contactMethod === "email" && (
              <motion.div
                key="email"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <Alert>
                  <Mail className="h-4 w-4" />
                  <AlertDescription>
                    Email responses typically within 24 hours
                  </AlertDescription>
                </Alert>
                
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                    <Mail className="h-8 w-8 text-blue-600" />
                  </div>
                  <p className="text-lg font-semibold mb-2">Email Provider</p>
                  <p className="text-xl font-bold text-blue-600 mb-4">
                    provider@ecosystem.com
                  </p>
                  <p className="text-sm text-gray-600 mb-6">
                    Include your contact details and service requirements
                  </p>
                  <Button
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={() => window.location.href = "mailto:provider@ecosystem.com"}
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    Send Email
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}