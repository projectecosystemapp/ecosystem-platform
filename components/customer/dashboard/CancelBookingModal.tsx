'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  DollarSign, 
  Clock, 
  Info,
  Loader2
} from 'lucide-react';
import { formatDate, formatTime, formatCurrency } from '@/lib/utils';
import { Booking } from './BookingHistory';

interface CancelBookingModalProps {
  booking: Booking;
  isOpen: boolean;
  onClose: () => void;
  onCancelled: (bookingId: string) => void;
}

// Cancellation policy structure
const CANCELLATION_POLICY = {
  48: { fee: 0, refund: 100 },     // 48+ hours: No fee (100% refund)
  24: { fee: 25, refund: 75 },     // 24-48 hours: 25% fee (75% refund)
  12: { fee: 50, refund: 50 },     // 12-24 hours: 50% fee (50% refund)
  6: { fee: 75, refund: 25 },      // 6-12 hours: 75% fee (25% refund)
  0: { fee: 100, refund: 0 }       // <6 hours: 100% fee (no refund)
};

export function CancelBookingModal({ booking, isOpen, onClose, onCancelled }: CancelBookingModalProps) {
  const [reason, setReason] = useState('');
  const [urgency, setUrgency] = useState<'planned' | 'immediate'>('planned');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Calculate refund amount based on time until booking
  const calculateRefund = () => {
    const bookingDateTime = new Date(`${booking.bookingDate.toISOString().split('T')[0]}T${booking.startTime}`);
    const now = new Date();
    const hoursDifference = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    let policy = CANCELLATION_POLICY[0]; // Default to no refund
    
    for (const [hours, policyRule] of Object.entries(CANCELLATION_POLICY)) {
      if (hoursDifference >= parseInt(hours)) {
        policy = policyRule;
        break;
      }
    }
    
    const totalAmount = parseFloat(booking.totalAmount);
    const refundAmount = (totalAmount * policy.refund) / 100;
    const feeAmount = totalAmount - refundAmount;
    
    return {
      totalAmount,
      refundAmount,
      feeAmount,
      refundPercentage: policy.refund,
      feePercentage: policy.fee,
      hoursDifference: Math.ceil(hoursDifference)
    };
  };

  const refundInfo = calculateRefund();

  const handleCancel = async () => {
    if (!reason.trim()) {
      setError('Please provide a reason for cancellation');
      return;
    }

    if (reason.trim().length < 10) {
      setError('Reason must be at least 10 characters long');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const response = await fetch(`/api/bookings/${booking.id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: reason.trim(),
          urgency,
          requestRefund: true,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        onCancelled(booking.id);
        // Show success message or redirect
      } else {
        setError(data.error || 'Failed to cancel booking. Please try again.');
      }
    } catch (error) {
      console.error('Error cancelling booking:', error);
      setError('Failed to cancel booking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const bookingDate = new Date(booking.bookingDate);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
            Cancel Booking
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Booking Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium mb-2">{booking.serviceName}</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-2" />
                {formatDate(bookingDate)} at {formatTime(booking.startTime)}
              </div>
              <div className="flex items-center">
                <DollarSign className="h-4 w-4 mr-2" />
                Total Paid: {formatCurrency(parseFloat(booking.totalAmount))}
              </div>
            </div>
          </div>

          {/* Refund Information */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <Info className="h-5 w-5 text-blue-500 mt-0.5 mr-3 shrink-0" />
              <div className="space-y-2">
                <h4 className="font-medium text-blue-900">Refund Information</h4>
                <div className="text-sm text-blue-800 space-y-1">
                  <p>Cancelling {refundInfo.hoursDifference} hours before your booking</p>
                  
                  {refundInfo.refundPercentage > 0 ? (
                    <>
                      <div className="flex justify-between">
                        <span>Refund ({refundInfo.refundPercentage}%):</span>
                        <span className="font-medium text-green-700">
                          {formatCurrency(refundInfo.refundAmount)}
                        </span>
                      </div>
                      {refundInfo.feePercentage > 0 && (
                        <div className="flex justify-between">
                          <span>Cancellation fee ({refundInfo.feePercentage}%):</span>
                          <span className="font-medium text-red-700">
                            -{formatCurrency(refundInfo.feeAmount)}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="font-medium text-red-700">
                      No refund available - too close to booking time
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Cancellation Reason */}
          <div className="space-y-3">
            <Label htmlFor="reason">Reason for cancellation *</Label>
            <Textarea
              id="reason"
              placeholder="Please provide a reason for cancelling this booking..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className={error && !reason.trim() ? 'border-red-300' : ''}
            />
          </div>

          {/* Urgency Selection */}
          <div className="space-y-3">
            <Label>Cancellation type</Label>
            <RadioGroup value={urgency} onValueChange={(value) => setUrgency(value as any)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="planned" id="planned" />
                <Label htmlFor="planned">Planned cancellation</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="immediate" id="immediate" />
                <Label htmlFor="immediate">Emergency cancellation</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Cancellation Policy Notice */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Refunds are processed within 3-5 business days. The cancellation fee helps cover provider preparation costs.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Keep Booking
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleCancel}
            disabled={loading || !reason.trim()}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Cancelling...
              </>
            ) : (
              'Cancel Booking'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}