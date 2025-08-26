"use client";

import { BookingFlow } from "@/components/booking";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  provider: any;
  selectedService?: any;
}

export function BookingModal({
  isOpen,
  onClose,
  provider,
  selectedService,
}: BookingModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Book with {provider.displayName}</DialogTitle>
              <DialogDescription>
                Complete your booking in a few simple steps
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="mt-4">
          <BookingFlow
            provider={provider}
            selectedService={selectedService}
            onServiceSelect={(service) => {
              // Handle service selection if needed
              console.log("Service selected:", service);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}