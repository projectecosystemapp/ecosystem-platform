"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookingCard } from "@/components/account/BookingCard";
import { 
  Search, 
  Filter, 
  Calendar, 
  Package,
  MapPin,
  DollarSign,
  CheckCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Download,
  SlidersHorizontal
} from "lucide-react";
import { format } from "date-fns";

interface BookingHistoryClientProps {
  bookings: Array<{
    id: string;
    serviceName: string;
    servicePrice: string;
    serviceDuration: number;
    bookingDate: Date;
    startTime: string;
    endTime: string;
    status: string;
    bookingType: string;
    customerNotes?: string | null;
    totalAmount: string;
    confirmationCode?: string | null;
    createdAt: Date;
    completedAt?: Date | null;
    providerId: string;
    providerName?: string | null;
    providerEmail?: string | null;
    providerPhone?: string | null;
    providerImage?: string | null;
  }>;
  stats: {
    totalBookings: number;
    completedBookings: number;
    upcomingBookings: number;
    totalSpent: number;
  };
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  searchParams: {
    filter?: string;
    type?: string;
    status?: string;
    search?: string;
    sort?: string;
    page?: string;
  };
}

export function BookingHistoryClient({
  bookings,
  stats,
  pagination,
  searchParams,
}: BookingHistoryClientProps) {
  const router = useRouter();
  const urlSearchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.search || "");
  const [showFilters, setShowFilters] = useState(false);

  const updateSearchParams = (key: string, value: string) => {
    const params = new URLSearchParams(urlSearchParams);
    if (value === "all" || !value) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    if (key !== "page") {
      params.delete("page"); // Reset to first page when changing filters
    }
    router.push(`/account/bookings?${params.toString()}`);
  };

  const handleSearch = () => {
    updateSearchParams("search", searchQuery);
  };

  const formatPrice = (price: string | number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(typeof price === 'string' ? parseFloat(price) : price);
  };

  const exportBookings = () => {
    // Create CSV content
    const headers = ["Date", "Service", "Provider", "Type", "Status", "Amount"];
    const rows = bookings.map((booking) => [
      format(new Date(booking.bookingDate), "yyyy-MM-dd"),
      booking.serviceName,
      booking.providerName || "N/A",
      booking.bookingType,
      booking.status,
      booking.totalAmount,
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(","))
    ].join("\n");
    
    // Download CSV
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bookings-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Bookings</p>
                <p className="text-2xl font-bold">{stats.totalBookings}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold">{stats.completedBookings}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Upcoming</p>
                <p className="text-2xl font-bold">{stats.upcomingBookings}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Spent</p>
                <p className="text-2xl font-bold">{formatPrice(stats.totalSpent || 0)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Booking History</CardTitle>
              <CardDescription>View and manage all your bookings</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={exportBookings}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Time Filter Tabs */}
          <Tabs
            value={searchParams.filter || "all"}
            onValueChange={(value) => updateSearchParams("filter", value)}
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="past">Past</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Search and Advanced Filters */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search bookings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-9"
              />
            </div>
            <Button onClick={handleSearch}>Search</Button>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="text-sm font-medium mb-2 block">Type</label>
                <Select
                  value={searchParams.type || "all"}
                  onValueChange={(value) => updateSearchParams("type", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="service">Services</SelectItem>
                    <SelectItem value="event">Events</SelectItem>
                    <SelectItem value="space">Spaces</SelectItem>
                    <SelectItem value="thing">Things</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select
                  value={searchParams.status || "all"}
                  onValueChange={(value) => updateSearchParams("status", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Sort By</label>
                <Select
                  value={searchParams.sort || "date-desc"}
                  onValueChange={(value) => updateSearchParams("sort", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sort By" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date-desc">Date (Newest)</SelectItem>
                    <SelectItem value="date-asc">Date (Oldest)</SelectItem>
                    <SelectItem value="price-desc">Price (High to Low)</SelectItem>
                    <SelectItem value="price-asc">Price (Low to High)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bookings List */}
      <div className="space-y-4">
        {bookings.length > 0 ? (
          bookings.map((booking) => (
            <BookingCard 
              key={booking.id} 
              booking={{
                ...booking,
                servicePrice: booking.totalAmount,
              }} 
            />
          ))
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No bookings found</p>
              <Button onClick={() => router.push("/marketplace")}>
                Browse Marketplace
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Showing {((pagination.currentPage - 1) * 10) + 1} - {Math.min(pagination.currentPage * 10, pagination.totalCount)} of {pagination.totalCount} bookings
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.hasPrev}
              onClick={() => updateSearchParams("page", String(pagination.currentPage - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.hasNext}
              onClick={() => updateSearchParams("page", String(pagination.currentPage + 1))}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}