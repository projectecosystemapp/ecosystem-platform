"use client";

import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Package,
  Star,
  MoreVertical,
  Eye,
  MessageSquare,
  RefreshCw
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";

interface BookingCardProps {
  booking: {
    id: string;
    serviceName: string;
    servicePrice: string;
    bookingDate: Date;
    startTime: string;
    status: string;
    bookingType: string;
    providerId: string;
    providerName?: string | null;
  };
  showActions?: boolean;
}

export function BookingCard({ booking, showActions = true }: BookingCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-green-100 text-green-800 border-green-200";
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "completed":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getBookingTypeIcon = () => {
    switch (booking.bookingType) {
      case "service":
        return <Package className="h-4 w-4" />;
      case "event":
        return <Calendar className="h-4 w-4" />;
      case "space":
        return <MapPin className="h-4 w-4" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  const formatPrice = (price: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(parseFloat(price));
  };

  return (
    <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              {getBookingTypeIcon()}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-gray-900">
                  {booking.serviceName}
                </h3>
                <Badge 
                  variant="outline" 
                  className={cn("text-xs", getStatusColor(booking.status))}
                >
                  {booking.status}
                </Badge>
              </div>
              
              {booking.providerName && (
                <p className="text-sm text-gray-600 mb-2">
                  by {booking.providerName}
                </p>
              )}

              <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{format(new Date(booking.bookingDate), "MMM dd, yyyy")}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{booking.startTime}</span>
                </div>
                <div className="font-medium text-gray-900">
                  {formatPrice(booking.servicePrice)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {showActions && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link href={`/account/bookings/${booking.id}`} className="cursor-pointer">
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </Link>
              </DropdownMenuItem>
              
              {booking.status === "completed" && (
                <>
                  <DropdownMenuItem>
                    <Star className="mr-2 h-4 w-4" />
                    Leave Review
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Book Again
                  </DropdownMenuItem>
                </>
              )}
              
              {(booking.status === "pending" || booking.status === "confirmed") && (
                <DropdownMenuItem>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Contact Provider
                </DropdownMenuItem>
              )}
              
              <DropdownMenuSeparator />
              
              {booking.status === "pending" && (
                <DropdownMenuItem className="text-red-600">
                  Cancel Booking
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ');
}