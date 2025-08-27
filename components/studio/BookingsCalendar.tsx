"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Clock, DollarSign, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, isToday, addMonths, subMonths } from "date-fns";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface Booking {
  id: string;
  customerName: string;
  customerEmail: string;
  serviceType: string;
  scheduledFor: Date;
  duration?: number;
  status: string;
  totalAmount: number;
  notes?: string | null;
}

interface BookingsCalendarProps {
  bookings: Booking[];
  providerId: string;
}

export function BookingsCalendar({ bookings, providerId }: BookingsCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Get days in current month
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get starting day of week (0 = Sunday)
  const startingDayOfWeek = monthStart.getDay();

  // Create padding for days before month starts
  const paddingDays = Array(startingDayOfWeek).fill(null);

  // Group bookings by date
  const bookingsByDate = useMemo(() => {
    const grouped = new Map<string, Booking[]>();
    
    bookings.forEach(booking => {
      const date = format(new Date(booking.scheduledFor), 'yyyy-MM-dd');
      if (!grouped.has(date)) {
        grouped.set(date, []);
      }
      grouped.get(date)?.push(booking);
    });
    
    return grouped;
  }, [bookings]);

  const getBookingsForDate = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return bookingsByDate.get(dateKey) || [];
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setCurrentMonth(subMonths(currentMonth, 1));
    } else {
      setCurrentMonth(addMonths(currentMonth, 1));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'PAYMENT_SUCCEEDED':
      case 'ACCEPTED':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'PENDING_PROVIDER':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'CANCELLED':
      case 'REJECTED':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigateMonth('prev')}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentMonth(new Date())}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigateMonth('next')}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Days of Week Headers */}
      <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div
            key={day}
            className="bg-gray-50 py-2 text-center text-xs font-medium text-gray-700"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
        {/* Padding days */}
        {paddingDays.map((_, index) => (
          <div key={`padding-${index}`} className="bg-gray-50 min-h-[100px]" />
        ))}
        
        {/* Month days */}
        {monthDays.map(day => {
          const dayBookings = getBookingsForDate(day);
          const hasBookings = dayBookings.length > 0;
          const isCurrentDay = isToday(day);
          
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "bg-white min-h-[100px] p-2 relative",
                isCurrentDay && "bg-blue-50",
                "hover:bg-gray-50 transition-colors cursor-pointer"
              )}
              onClick={() => setSelectedDate(day)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={cn(
                  "text-sm font-medium",
                  isCurrentDay ? "text-blue-600" : "text-gray-900",
                  !isSameMonth(day, currentMonth) && "text-gray-400"
                )}>
                  {format(day, 'd')}
                </span>
                {hasBookings && (
                  <Badge variant="secondary" className="h-5 px-1 text-xs">
                    {dayBookings.length}
                  </Badge>
                )}
              </div>
              
              {/* Show first 2 bookings */}
              <div className="space-y-1">
                {dayBookings.slice(0, 2).map(booking => (
                  <Popover key={booking.id}>
                    <PopoverTrigger asChild>
                      <div
                        className={cn(
                          "text-xs p-1 rounded border truncate cursor-pointer hover:opacity-80",
                          getStatusColor(booking.status)
                        )}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">
                            {format(new Date(booking.scheduledFor), 'HH:mm')}
                          </span>
                        </div>
                        <p className="truncate font-medium">
                          {booking.customerName}
                        </p>
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-80" align="start">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-sm">Booking Details</h3>
                          <Badge className={getStatusColor(booking.status)}>
                            {booking.status.toLowerCase().replace(/_/g, ' ')}
                          </Badge>
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-400" />
                            <span>{booking.customerName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-gray-400" />
                            <span>
                              {format(new Date(booking.scheduledFor), 'MMM d, yyyy HH:mm')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-gray-400" />
                            <span>${booking.totalAmount}</span>
                          </div>
                        </div>
                        
                        <div className="pt-2 border-t">
                          <Link href={`/studio/bookings/${booking.id}`}>
                            <Button size="sm" className="w-full">
                              View Details
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                ))}
                
                {dayBookings.length > 2 && (
                  <p className="text-xs text-gray-500 pl-1">
                    +{dayBookings.length - 2} more
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Date Details */}
      {selectedDate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {getBookingsForDate(selectedDate).length === 0 ? (
              <p className="text-gray-500">No bookings for this date</p>
            ) : (
              <div className="space-y-2">
                {getBookingsForDate(selectedDate).map(booking => (
                  <Link
                    key={booking.id}
                    href={`/studio/bookings/${booking.id}`}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                  >
                    <div>
                      <p className="font-medium">{booking.customerName}</p>
                      <p className="text-sm text-gray-500">
                        {format(new Date(booking.scheduledFor), 'HH:mm')} - {booking.serviceType}
                      </p>
                    </div>
                    <Badge className={getStatusColor(booking.status)}>
                      {booking.status.toLowerCase().replace(/_/g, ' ')}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}