"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  MoreHorizontal,
  CheckCircle,
  XCircle,
  UserX,
  MessageCircle,
} from "lucide-react";
import { type Booking } from "@/db/schema/bookings-schema";
import {
  completeBookingAction,
  cancelBookingAction,
  markBookingNoShowAction,
} from "@/actions/bookings-actions";

interface BookingActionsProps {
  booking: Booking;
  onUpdate?: () => void;
  showLabel?: boolean;
}

export default function BookingActions({
  booking,
  onUpdate,
  showLabel = false,
}: BookingActionsProps) {
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showNoShowDialog, setShowNoShowDialog] = useState(false);
  const [notes, setNotes] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleComplete = async () => {
    setIsLoading(true);
    try {
      const result = await completeBookingAction(booking.id, notes);
      if (result.isSuccess) {
        toast.success("Booking marked as completed");
        onUpdate?.();
        setShowCompleteDialog(false);
        setNotes("");
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Failed to complete booking");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      toast.error("Please provide a cancellation reason");
      return;
    }

    setIsLoading(true);
    try {
      const result = await cancelBookingAction(booking.id, cancelReason);
      if (result.isSuccess) {
        toast.success("Booking cancelled successfully");
        onUpdate?.();
        setShowCancelDialog(false);
        setCancelReason("");
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Failed to cancel booking");
    } finally {
      setIsLoading(false);
    }
  };

  const handleNoShow = async () => {
    setIsLoading(true);
    try {
      const result = await markBookingNoShowAction(booking.id, notes);
      if (result.isSuccess) {
        toast.success("Booking marked as no-show");
        onUpdate?.();
        setShowNoShowDialog(false);
        setNotes("");
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Failed to mark as no-show");
    } finally {
      setIsLoading(false);
    }
  };

  const canComplete = booking.status === "confirmed";
  const canCancel = booking.status !== "completed" && booking.status !== "cancelled";
  const canMarkNoShow = booking.status === "confirmed";

  if (!canComplete && !canCancel && !canMarkNoShow) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {canComplete && (
            <DropdownMenuItem onClick={() => setShowCompleteDialog(true)}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Mark Complete
            </DropdownMenuItem>
          )}
          
          {canMarkNoShow && (
            <DropdownMenuItem onClick={() => setShowNoShowDialog(true)}>
              <UserX className="mr-2 h-4 w-4" />
              Mark No-Show
            </DropdownMenuItem>
          )}
          
          {canCancel && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setShowCancelDialog(true)}
                className="text-red-600"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Cancel Booking
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Complete Booking Dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Booking</DialogTitle>
            <DialogDescription>
              Mark this booking as completed. The customer will be notified and payout will be processed.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="complete-notes">Notes (Optional)</Label>
              <Textarea
                id="complete-notes"
                placeholder="Add any notes about the service completion..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowCompleteDialog(false);
                setNotes("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleComplete} disabled={isLoading}>
              {isLoading ? "Completing..." : "Complete Booking"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Booking Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Booking</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the booking and notify the customer. 
              Refunds will be processed according to the cancellation policy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="cancel-reason">Cancellation Reason *</Label>
              <Textarea
                id="cancel-reason"
                placeholder="Please provide a reason for cancellation..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="mt-1"
                required
              />
            </div>
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCancelReason("")}>
              Keep Booking
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={isLoading || !cancelReason.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              {isLoading ? "Cancelling..." : "Cancel Booking"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* No-Show Dialog */}
      <Dialog open={showNoShowDialog} onOpenChange={setShowNoShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as No-Show</DialogTitle>
            <DialogDescription>
              Mark this booking as a no-show. The customer will be charged according to the no-show policy.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="noshow-notes">Notes (Optional)</Label>
              <Textarea
                id="noshow-notes"
                placeholder="Add any details about the no-show..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowNoShowDialog(false);
                setNotes("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleNoShow}
              disabled={isLoading}
              variant="destructive"
            >
              {isLoading ? "Processing..." : "Mark No-Show"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}