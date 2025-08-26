'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  DollarSign, 
  User, 
  MoreHorizontal,
  Eye,
  X,
  MessageSquare
} from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { formatDate, formatTime, formatCurrency } from '@/lib/utils';
import { Booking } from './BookingHistory';

interface BookingCardProps {
  booking: Booking;
  onSelect: (booking: Booking) => void;
  onCancel: (booking: Booking) => void;
}

export function BookingCard({ booking, onSelect, onCancel }: BookingCardProps) {
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

  const getStatusText = (status: Booking['status']) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'confirmed':
        return 'Confirmed';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      case 'rejected':
        return 'Rejected';
      default:
        return status;
    }
  };

  const canCancel = (booking: Booking) => {
    const bookingDateTime = new Date(`${booking.bookingDate.toISOString().split('T')[0]}T${booking.startTime}`);
    const now = new Date();
    const hoursDifference = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    return ['pending', 'confirmed'].includes(booking.status) && hoursDifference > 6; // Can cancel up to 6 hours before
  };

  const bookingDate = new Date(booking.bookingDate);
  const isUpcoming = bookingDate >= new Date() && !['cancelled', 'rejected', 'completed'].includes(booking.status);

  return (
    <Card className={`transition-shadow hover:shadow-md ${isUpcoming ? 'border-blue-200' : ''}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-4">
            {/* Header with Service & Provider */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-lg text-gray-900">
                  {booking.serviceName}
                </h3>
                <div className="flex items-center text-sm text-gray-600 mt-1">
                  <User className="h-4 w-4 mr-1" />
                  {booking.providerBusinessName || booking.providerName}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Badge className={getStatusColor(booking.status)}>
                  {getStatusText(booking.status)}
                </Badge>
                {booking.isGuestBooking && (
                  <Badge variant="outline" className="text-xs">
                    Guest
                  </Badge>
                )}
              </div>
            </div>

            {/* Booking Details */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center text-gray-600">
                <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                <span>{formatDate(bookingDate)}</span>
              </div>
              
              <div className="flex items-center text-gray-600">
                <Clock className="h-4 w-4 mr-2 text-gray-400" />
                <span>{formatTime(booking.startTime)} - {formatTime(booking.endTime)}</span>
              </div>
              
              <div className="flex items-center text-gray-600">
                <DollarSign className="h-4 w-4 mr-2 text-gray-400" />
                <span>{formatCurrency(parseFloat(booking.totalAmount))}</span>
              </div>
              
              <div className="flex items-center text-gray-600">
                <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                  {booking.confirmationCode}
                </span>
              </div>
            </div>

            {/* Notes */}
            {(booking.customerNotes || booking.providerNotes) && (
              <div className="space-y-2">
                {booking.customerNotes && (
                  <div className="text-sm">
                    <span className="font-medium text-gray-700">Your note: </span>
                    <span className="text-gray-600">{booking.customerNotes}</span>
                  </div>
                )}
                {booking.providerNotes && (
                  <div className="text-sm">
                    <span className="font-medium text-gray-700">Provider note: </span>
                    <span className="text-gray-600">{booking.providerNotes}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2 ml-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSelect(booking)}
              className="shrink-0"
            >
              <Eye className="h-4 w-4 mr-1" />
              Details
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="p-2">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onSelect(booking)}>
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </DropdownMenuItem>
                
                {canCancel(booking) && (
                  <DropdownMenuItem 
                    onClick={() => onCancel(booking)}
                    className="text-red-600"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel Booking
                  </DropdownMenuItem>
                )}

                {booking.status === 'completed' && (
                  <DropdownMenuItem>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Leave Review
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Quick Status Info */}
        {isUpcoming && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center text-blue-800">
                <Clock className="h-4 w-4 mr-2" />
                <span className="text-sm font-medium">
                  Upcoming in {Math.ceil((bookingDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days
                </span>
              </div>
              {canCancel(booking) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onCancel(booking)}
                  className="text-red-600 border-red-300 hover:bg-red-50"
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}

        {booking.status === 'cancelled' && (
          <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
            <div className="flex items-center text-red-800">
              <X className="h-4 w-4 mr-2" />
              <span className="text-sm">
                This booking was cancelled
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}