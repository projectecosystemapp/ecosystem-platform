"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  AlertCircle, 
  Clock, 
  CheckCircle, 
  XCircle, 
  DollarSign,
  TrendingUp,
  Calendar,
  Download,
  RefreshCw
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { format, formatDistanceToNow } from "date-fns";

interface PayoutSummary {
  totalEarnings: number;
  pendingPayouts: number;
  availableForPayout: number;
  completedPayouts: number;
  lastPayoutDate?: string;
  nextPayoutDate?: string;
}

interface Booking {
  id: string;
  serviceName: string;
  customerName: string;
  bookingDate: string;
  completedAt?: string;
  totalAmount: number;
  platformFee: number;
  providerPayout: number;
  status: "pending" | "completed" | "cancelled" | "refunded";
  payoutStatus?: "pending" | "available" | "processing" | "completed";
  stripeTransferId?: string;
}

interface PayoutDashboardProps {
  providerId: string;
}

export function PayoutDashboard({ providerId }: PayoutDashboardProps) {
  const [summary, setSummary] = useState<PayoutSummary | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [releasing, setReleasing] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("pending");

  const fetchPayoutData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch payout summary
      const summaryRes = await fetch(`/api/providers/${providerId}/payouts/summary`);
      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setSummary(summaryData);
      }

      // Fetch bookings with payout status
      const bookingsRes = await fetch(`/api/providers/${providerId}/bookings?includePayouts=true`);
      if (bookingsRes.ok) {
        const bookingsData = await bookingsRes.json();
        setBookings(bookingsData);
      }
    } catch (error) {
      console.error("Error fetching payout data:", error);
      toast({
        title: "Error",
        description: "Failed to load payout information",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    fetchPayoutData();
  }, [fetchPayoutData]);

  const releasePayout = async (bookingId: string) => {
    try {
      setReleasing(bookingId);
      
      const response = await fetch("/api/stripe/payouts/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Payout Released",
          description: `$${data.payout.amount.toFixed(2)} has been transferred to your account`,
        });
        
        // Refresh data
        await fetchPayoutData();
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to release payout",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error releasing payout:", error);
      toast({
        title: "Error",
        description: "Failed to release payout",
        variant: "destructive",
      });
    } finally {
      setReleasing(null);
    }
  };

  const releaseAllPayouts = async () => {
    try {
      setReleasing("all");
      
      const response = await fetch("/api/stripe/payouts/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Payouts Released",
          description: `${data.summary.totalReleased} payouts totaling $${data.summary.totalAmount.toFixed(2)} have been transferred`,
        });
        
        // Refresh data
        await fetchPayoutData();
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to release payouts",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error releasing payouts:", error);
      toast({
        title: "Error",
        description: "Failed to release payouts",
        variant: "destructive",
      });
    } finally {
      setReleasing(null);
    }
  };

  const getPayoutStatusBadge = (booking: Booking) => {
    if (booking.status === "cancelled" || booking.status === "refunded") {
      return <Badge variant="outline" className="bg-gray-50"><XCircle className="w-3 h-3 mr-1" />N/A</Badge>;
    }

    if (booking.stripeTransferId) {
      return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Paid</Badge>;
    }

    if (booking.status !== "completed") {
      return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Pending Service</Badge>;
    }

    const completedAt = new Date(booking.completedAt!);
    const holdEndTime = new Date(completedAt.getTime() + 24 * 60 * 60 * 1000);
    const now = new Date();

    if (now < holdEndTime) {
      const hoursRemaining = Math.ceil((holdEndTime.getTime() - now.getTime()) / (1000 * 60 * 60));
      return (
        <Badge variant="outline" className="bg-yellow-50">
          <Clock className="w-3 h-3 mr-1" />
          Hold ({hoursRemaining}h)
        </Badge>
      );
    }

    return <Badge className="bg-blue-500"><DollarSign className="w-3 h-3 mr-1" />Available</Badge>;
  };

  const canReleasePayout = (booking: Booking) => {
    if (booking.status !== "completed" || booking.stripeTransferId) {
      return false;
    }

    const completedAt = new Date(booking.completedAt!);
    const holdEndTime = new Date(completedAt.getTime() + 24 * 60 * 60 * 1000);
    
    return new Date() >= holdEndTime;
  };

  const filteredBookings = bookings.filter(booking => {
    switch (activeTab) {
      case "pending":
        return booking.status === "completed" && !booking.stripeTransferId;
      case "completed":
        return booking.stripeTransferId;
      case "all":
        return true;
      default:
        return false;
    }
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${summary?.totalEarnings.toFixed(2) || "0.00"}
            </div>
            <p className="text-xs text-muted-foreground">
              All time earnings after fees
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${summary?.pendingPayouts.toFixed(2) || "0.00"}
            </div>
            <p className="text-xs text-muted-foreground">
              In 24-hour hold period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Now</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${summary?.availableForPayout.toFixed(2) || "0.00"}
            </div>
            <p className="text-xs text-muted-foreground">
              Ready for payout
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Payouts</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${summary?.completedPayouts.toFixed(2) || "0.00"}
            </div>
            <p className="text-xs text-muted-foreground">
              Successfully transferred
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Button 
            onClick={releaseAllPayouts}
            disabled={!summary?.availableForPayout || releasing === "all"}
          >
            {releasing === "all" ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <DollarSign className="w-4 h-4 mr-2" />
                Release All Available
              </>
            )}
          </Button>
          <Button variant="outline" onClick={fetchPayoutData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
        
        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Bookings Table */}
      <Card>
        <CardHeader>
          <CardTitle>Booking Payouts</CardTitle>
          <CardDescription>
            Manage payouts for your completed bookings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
            
            <TabsContent value={activeTab} className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Your Earnings</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBookings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No bookings found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredBookings.map((booking) => (
                      <TableRow key={booking.id}>
                        <TableCell className="font-medium">
                          {booking.serviceName}
                        </TableCell>
                        <TableCell>{booking.customerName}</TableCell>
                        <TableCell>
                          {format(new Date(booking.bookingDate), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>${booking.totalAmount.toFixed(2)}</TableCell>
                        <TableCell className="font-semibold">
                          ${booking.providerPayout.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {getPayoutStatusBadge(booking)}
                        </TableCell>
                        <TableCell>
                          {canReleasePayout(booking) && (
                            <Button
                              size="sm"
                              onClick={() => releasePayout(booking.id)}
                              disabled={releasing === booking.id}
                            >
                              {releasing === booking.id ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                "Release"
                              )}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Information Alert */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center text-blue-900">
            <AlertCircle className="w-5 h-5 mr-2" />
            Payout Information
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-800">
          <ul className="space-y-2">
            <li>• Payouts are held for 24 hours after service completion for security</li>
            <li>• Available funds can be released manually or will be paid out automatically</li>
            <li>• Platform fees ({summary ? "10-20%" : "varies"}) are deducted from each booking</li>
            <li>• Transfers typically arrive in your bank account within 2-3 business days</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}