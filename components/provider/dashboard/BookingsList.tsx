"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Calendar,
  Clock,
  User,
  MapPin,
  DollarSign,
  ChevronRight,
  Phone,
  Mail,
  AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO, isToday, isTomorrow } from "date-fns";

interface Booking {
  id: string;
  serviceName: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  customer: {
    name: string;
    email: string | null;
  };
  amount: number;
}

interface BookingsListProps {
  providerId: string;
}

export function BookingsList({ providerId }: BookingsListProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const response = await fetch(`/api/providers/${providerId}/activity?type=all`);
        if (!response.ok) throw new Error("Failed to fetch bookings");
        
        const data = await response.json();
        setBookings(data.upcomingBookings || []);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBookings();
  }, [providerId]);

  const getDateLabel = (dateString: string) => {
    const date = parseISO(dateString);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "EEE, MMM d");
  };

  const getDateBadgeVariant = (dateString: string) => {
    const date = parseISO(dateString);
    if (isToday(date)) return "destructive";
    if (isTomorrow(date)) return "secondary";
    return "outline";
  };

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">Failed to load bookings</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={() => window.location.reload()}
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Upcoming Bookings</CardTitle>
          <p className="text-sm text-gray-600 mt-1">
            Your next scheduled appointments
          </p>
        </div>
        <Button variant="outline" size="sm">
          View Calendar
          <Calendar className="h-4 w-4 ml-2" />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-6 w-20" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-36" />
                </div>
              </div>
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium mb-2">No upcoming bookings</h3>
            <p className="text-gray-600 text-sm">
              New bookings will appear here when customers schedule appointments
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking, index) => (
              <motion.div
                key={booking.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-base">{booking.serviceName}</h4>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                      <Badge variant={getDateBadgeVariant(booking.bookingDate)}>
                        {getDateLabel(booking.bookingDate)}
                      </Badge>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{booking.startTime} - {booking.endTime}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-lg text-green-600">
                      ${booking.amount.toFixed(2)}
                    </div>
                    <p className="text-xs text-gray-500">Your earnings</p>
                  </div>
                </div>

                <div className="border-t pt-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-3 w-3 text-gray-400" />
                        <span className="font-medium">{booking.customer.name}</span>
                      </div>
                      {booking.customer.email && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Mail className="h-3 w-3 text-gray-400" />
                          <span>{booking.customer.email}</span>
                        </div>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
                  </div>
                </div>

                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="outline" className="flex-1">
                    <Phone className="h-3 w-3 mr-1" />
                    Contact
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1">
                    View Details
                  </Button>
                </div>
              </motion.div>
            ))}

            {bookings.length > 0 && (
              <Button 
                variant="ghost" 
                className="w-full"
                onClick={() => {/* Navigate to bookings page */}}
              >
                View All Bookings
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}