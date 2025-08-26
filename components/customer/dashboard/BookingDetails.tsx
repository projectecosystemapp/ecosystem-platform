'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Calendar, 
  Clock, 
  User, 
  DollarSign, 
  MapPin, 
  Phone, 
  Mail,
  MessageSquare,
  Star,
  X,
  Download,
  ExternalLink
} from 'lucide-react';
import { formatDate, formatTime, formatCurrency } from '@/lib/utils';
import { Booking } from './BookingHistory';

interface BookingDetailsProps {
  booking: Booking;
  isOpen: boolean;
  onClose: () => void;
  onCancel: () => void;
}

export function BookingDetails({ booking, isOpen, onClose, onCancel }: BookingDetailsProps) {
  const [loading, setLoading] = useState(false);

  const getStatusColor = (status: Booking['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const canCancel = (booking: Booking) => {
    const bookingDateTime = new Date(`${booking.bookingDate.toISOString().split('T')[0]}T${booking.startTime}`);
    const now = new Date();
    const hoursDifference = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    return ['pending', 'confirmed'].includes(booking.status) && hoursDifference > 6;
  };

  const handleDownloadReceipt = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/bookings/${booking.id}/receipt`, {
        method: 'GET',
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `booking-receipt-${booking.confirmationCode}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error downloading receipt:', error);
    } finally {
      setLoading(false);
    }
  };

  const bookingDate = new Date(booking.bookingDate);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl font-semibold">
                Booking Details
              </DialogTitle>
              <p className="text-sm text-gray-500 mt-1">
                Confirmation Code: {booking.confirmationCode}
              </p>
            </div>
            <Badge className={getStatusColor(booking.status)}>
              {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Service Information */}
          <div>
            <h3 className="font-semibold mb-3">Service Information</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-lg">{booking.serviceName}</h4>
                <span className="text-lg font-semibold text-blue-600">
                  {formatCurrency(parseFloat(booking.servicePrice))}
                </span>
              </div>
              
              <div className="flex items-center text-gray-600">
                <User className="h-4 w-4 mr-2" />
                <span>{booking.providerBusinessName || booking.providerName}</span>
              </div>

              <div className="flex items-center text-gray-600">
                <Clock className="h-4 w-4 mr-2" />
                <span>{booking.serviceDuration} minutes</span>
              </div>
            </div>
          </div>

          {/* Booking Schedule */}
          <div>
            <h3 className="font-semibold mb-3">Schedule</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center text-gray-700">
                <Calendar className="h-5 w-5 mr-3 text-blue-500" />
                <div>
                  <p className="font-medium">{formatDate(bookingDate)}</p>
                  <p className="text-sm text-gray-600">
                    {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Information */}
          <div>
            <h3 className="font-semibold mb-3">Payment Summary</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between">
                <span>Service Amount</span>
                <span>{formatCurrency(parseFloat(booking.servicePrice))}</span>
              </div>
              
              {booking.isGuestBooking && (
                <div className="flex justify-between text-orange-600">
                  <span>Guest Service Fee (10%)</span>
                  <span>+{formatCurrency(parseFloat(booking.totalAmount) - parseFloat(booking.servicePrice))}</span>
                </div>
              )}
              
              <Separator />
              
              <div className="flex justify-between font-semibold">
                <span>Total Paid</span>
                <span>{formatCurrency(parseFloat(booking.totalAmount))}</span>
              </div>
              
              <div className="text-xs text-gray-500 space-y-1">
                <div className="flex justify-between">
                  <span>Platform Fee (10%)</span>
                  <span>{formatCurrency(parseFloat(booking.platformFee))}</span>
                </div>
                <div className="flex justify-between">
                  <span>Provider Payout (90%)</span>
                  <span>{formatCurrency(parseFloat(booking.providerPayout))}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          {(booking.customerNotes || booking.providerNotes) && (
            <div>
              <h3 className="font-semibold mb-3">Notes</h3>
              <div className="space-y-3">
                {booking.customerNotes && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">Your Note</h4>
                    <p className="text-gray-700 text-sm">{booking.customerNotes}</p>
                  </div>
                )}
                
                {booking.providerNotes && (
                  <div className="bg-green-50 rounded-lg p-4">
                    <h4 className="font-medium text-green-900 mb-2">Provider Note</h4>
                    <p className="text-gray-700 text-sm">{booking.providerNotes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Booking Timeline */}
          <div>
            <h3 className="font-semibold mb-3">Booking History</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span>Booking Created</span>
                  <span className="text-gray-600">
                    {formatDate(booking.createdAt)} at {formatTime(booking.createdAt.toTimeString().slice(0, 5))}
                  </span>
                </div>
                
                {booking.updatedAt !== booking.createdAt && (
                  <div className="flex justify-between">
                    <span>Last Updated</span>
                    <span className="text-gray-600">
                      {formatDate(booking.updatedAt)} at {formatTime(booking.updatedAt.toTimeString().slice(0, 5))}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={handleDownloadReceipt}
              disabled={loading}
            >
              <Download className="h-4 w-4 mr-2" />
              {loading ? 'Downloading...' : 'Receipt'}
            </Button>
            
            {booking.status === 'completed' && (
              <Button variant="outline">
                <Star className="h-4 w-4 mr-2" />
                Leave Review
              </Button>
            )}
          </div>

          <div className="flex space-x-2">
            {canCancel(booking) && (
              <Button
                variant="destructive"
                onClick={onCancel}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel Booking
              </Button>
            )}
            
            <Button onClick={onClose}>
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}