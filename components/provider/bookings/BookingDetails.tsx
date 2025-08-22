"use client";

import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Calendar,
  Clock,
  User,
  Mail,
  Phone,
  DollarSign,
  FileText,
  AlertCircle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { type Booking } from "@/db/schema/bookings-schema";
import BookingActions from "./BookingActions";

interface BookingDetailsProps {
  booking: Booking;
  onClose: () => void;
  onUpdate?: () => void;
}

export default function BookingDetails({
  booking,
  onClose,
  onUpdate,
}: BookingDetailsProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case "confirmed":
        return <CheckCircle className="h-5 w-5 text-blue-500" />;
      case "completed":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "cancelled":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusStyles = {
      pending: "bg-yellow-100 text-yellow-800",
      confirmed: "bg-blue-100 text-blue-800",
      completed: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
      no_show: "bg-gray-100 text-gray-800",
    };

    return (
      <Badge className={statusStyles[status as keyof typeof statusStyles] || ""}>
        {status.replace("_", " ").toUpperCase()}
      </Badge>
    );
  };

  const formatAmount = (amount: string | number) => {
    const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(numAmount);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getStatusIcon(booking.status)}
            Booking Details
          </DialogTitle>
          <DialogDescription>
            Confirmation Code: <strong>{booking.confirmationCode}</strong>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Status */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status</span>
              {getStatusBadge(booking.status)}
            </div>

            <Separator />

            {/* Service Information */}
            <div className="space-y-3">
              <h3 className="font-semibold">Service Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Service:</span>
                  <p className="font-medium">{booking.serviceName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Duration:</span>
                  <p className="font-medium">{booking.serviceDuration} minutes</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Date & Time */}
            <div className="space-y-3">
              <h3 className="font-semibold">Date & Time</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <span className="text-muted-foreground">Date:</span>
                    <p className="font-medium">
                      {format(new Date(booking.bookingDate), "MMMM dd, yyyy")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <span className="text-muted-foreground">Time:</span>
                    <p className="font-medium">
                      {booking.startTime} - {booking.endTime}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Customer Information */}
            <div className="space-y-3">
              <h3 className="font-semibold">Customer Information</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {booking.isGuestBooking ? "Guest Customer" : booking.customerId}
                  </span>
                </div>
                {/* Add customer email and phone if available */}
              </div>
              {booking.customerNotes && (
                <div className="mt-3">
                  <span className="text-sm text-muted-foreground">Customer Notes:</span>
                  <p className="text-sm mt-1 p-3 bg-gray-50 rounded-md">
                    {booking.customerNotes}
                  </p>
                </div>
              )}
            </div>

            <Separator />

            {/* Payment Information */}
            <div className="space-y-3">
              <h3 className="font-semibold">Payment Information</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service Price:</span>
                  <span className="font-medium">{formatAmount(booking.servicePrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Amount:</span>
                  <span className="font-medium">{formatAmount(booking.totalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Platform Fee:</span>
                  <span className="text-red-600">-{formatAmount(booking.platformFee)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Your Payout:</span>
                  <span className="text-green-600">{formatAmount(booking.providerPayout)}</span>
                </div>
              </div>
            </div>

            {/* Provider Notes */}
            {booking.providerNotes && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="font-semibold">Provider Notes</h3>
                  <p className="text-sm p-3 bg-gray-50 rounded-md">
                    {booking.providerNotes}
                  </p>
                </div>
              </>
            )}

            {/* Cancellation Information */}
            {booking.status === "cancelled" && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="font-semibold text-red-600">Cancellation Information</h3>
                  <div className="space-y-2 text-sm">
                    {booking.cancellationReason && (
                      <div>
                        <span className="text-muted-foreground">Reason:</span>
                        <p className="mt-1">{booking.cancellationReason}</p>
                      </div>
                    )}
                    {booking.cancelledAt && (
                      <div>
                        <span className="text-muted-foreground">Cancelled on:</span>
                        <p className="font-medium">
                          {format(new Date(booking.cancelledAt), "MMM dd, yyyy 'at' h:mm a")}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Timestamps */}
            <Separator />
            <div className="space-y-2 text-xs text-muted-foreground">
              <div>Created: {format(new Date(booking.createdAt), "MMM dd, yyyy 'at' h:mm a")}</div>
              <div>Updated: {format(new Date(booking.updatedAt), "MMM dd, yyyy 'at' h:mm a")}</div>
              {booking.completedAt && (
                <div>
                  Completed: {format(new Date(booking.completedAt), "MMM dd, yyyy 'at' h:mm a")}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <BookingActions
            booking={booking}
            onUpdate={() => {
              onUpdate?.();
              onClose();
            }}
            showLabel={true}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}