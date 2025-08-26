'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Clock, MapPin, DollarSign, MessageSquare, Star } from 'lucide-react';
import { BookingCard } from './BookingCard';
import { BookingDetails } from './BookingDetails';
import { CancelBookingModal } from './CancelBookingModal';
import { formatDate, formatTime, formatCurrency } from '@/lib/utils';

export interface Booking {
  id: string;
  providerId: string;
  providerName: string;
  providerBusinessName?: string;
  serviceName: string;
  servicePrice: string;
  serviceDuration: number;
  bookingDate: Date;
  startTime: string;
  endTime: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rejected';
  totalAmount: string;
  platformFee: string;
  providerPayout: string;
  confirmationCode: string;
  customerNotes?: string;
  providerNotes?: string;
  isGuestBooking: boolean;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

interface BookingHistoryProps {
  customerId: string;
  initialBookings?: Booking[];
}

export function BookingHistory({ customerId, initialBookings = [] }: BookingHistoryProps) {
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [loading, setLoading] = useState(!initialBookings.length);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'upcoming' | 'past' | 'cancelled'>('all');

  // Fetch bookings from API
  useEffect(() => {
    if (initialBookings.length === 0) {
      fetchBookings();
    }
  }, [customerId, initialBookings.length]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/bookings/customer/${customerId}`);
      if (response.ok) {
        const data = await response.json();
        setBookings(data.bookings || []);
      } else {
        console.error('Failed to fetch bookings');
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter bookings by status
  const filterBookings = (bookings: Booking[], filter: string) => {
    const now = new Date();
    
    switch (filter) {
      case 'upcoming':
        return bookings.filter(booking => 
          new Date(booking.bookingDate) >= now && 
          !['cancelled', 'rejected', 'completed'].includes(booking.status)
        );
      case 'past':
        return bookings.filter(booking => 
          new Date(booking.bookingDate) < now || 
          booking.status === 'completed'
        );
      case 'cancelled':
        return bookings.filter(booking => 
          ['cancelled', 'rejected'].includes(booking.status)
        );
      default:
        return bookings;
    }
  };

  // Get filtered bookings for current tab
  const filteredBookings = filterBookings(bookings, activeTab);

  // Count bookings by category
  const bookingCounts = {
    all: bookings.length,
    upcoming: filterBookings(bookings, 'upcoming').length,
    past: filterBookings(bookings, 'past').length,
    cancelled: filterBookings(bookings, 'cancelled').length,
  };

  const handleBookingSelect = (booking: Booking) => {
    setSelectedBooking(booking);
    setShowDetails(true);
  };

  const handleCancelBooking = (booking: Booking) => {
    setSelectedBooking(booking);
    setShowCancelModal(true);
  };

  const handleBookingCancelled = (bookingId: string) => {
    setBookings(prev => prev.map(booking => 
      booking.id === bookingId 
        ? { ...booking, status: 'cancelled' as const }
        : booking
    ));
    setShowCancelModal(false);
    setSelectedBooking(null);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Booking Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Bookings</p>
                <p className="text-2xl font-bold">{bookingCounts.all}</p>
              </div>
              <Calendar className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Upcoming</p>
                <p className="text-2xl font-bold text-blue-600">{bookingCounts.upcoming}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-green-600">{bookingCounts.past}</p>
              </div>
              <Star className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Cancelled</p>
                <p className="text-2xl font-bold text-red-600">{bookingCounts.cancelled}</p>
              </div>
              <MessageSquare className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Booking Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>My Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="all">
                All ({bookingCounts.all})
              </TabsTrigger>
              <TabsTrigger value="upcoming">
                Upcoming ({bookingCounts.upcoming})
              </TabsTrigger>
              <TabsTrigger value="past">
                Past ({bookingCounts.past})
              </TabsTrigger>
              <TabsTrigger value="cancelled">
                Cancelled ({bookingCounts.cancelled})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value={activeTab} className="mt-6">
              {filteredBookings.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No bookings found
                  </h3>
                  <p className="text-gray-500 mb-4">
                    {activeTab === 'all' 
                      ? "You haven't made any bookings yet."
                      : `You don't have any ${activeTab} bookings.`
                    }
                  </p>
                  <Button>
                    Browse Services
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredBookings.map((booking) => (
                    <BookingCard
                      key={booking.id}
                      booking={booking}
                      onSelect={handleBookingSelect}
                      onCancel={handleCancelBooking}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Booking Details Modal */}
      {selectedBooking && showDetails && (
        <BookingDetails
          booking={selectedBooking}
          isOpen={showDetails}
          onClose={() => {
            setShowDetails(false);
            setSelectedBooking(null);
          }}
          onCancel={() => {
            setShowDetails(false);
            handleCancelBooking(selectedBooking);
          }}
        />
      )}

      {/* Cancel Booking Modal */}
      {selectedBooking && showCancelModal && (
        <CancelBookingModal
          booking={selectedBooking}
          isOpen={showCancelModal}
          onClose={() => {
            setShowCancelModal(false);
            setSelectedBooking(null);
          }}
          onCancelled={handleBookingCancelled}
        />
      )}
    </div>
  );
}