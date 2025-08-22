"use client";

import { motion } from "framer-motion";
import { 
  DollarSign, 
  TrendingUp, 
  Calendar, 
  Star,
  CreditCard,
  Users,
  Clock,
  AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface MetricsData {
  overview: {
    monthlyEarnings: number;
    totalEarnings: number;
    completedBookings: number;
    upcomingBookings: number;
    averageRating: number;
    totalReviews: number;
    pendingPayouts: number;
  };
  period: {
    earningsGrowth: number;
  };
}

interface MetricsGridProps {
  metrics: MetricsData | null;
  isLoading: boolean;
  error?: Error | null;
}

export function MetricsGrid({ metrics, isLoading, error }: MetricsGridProps) {
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-800">
          <AlertCircle className="h-5 w-5" />
          <p>Failed to load metrics. Please try again later.</p>
        </div>
      </div>
    );
  }

  const cards = [
    {
      title: "Monthly Earnings",
      value: metrics?.overview.monthlyEarnings || 0,
      format: "currency",
      icon: DollarSign,
      color: "text-green-600",
      bgColor: "bg-green-50",
      trend: metrics?.period.earningsGrowth || 0,
      description: "This month's revenue",
    },
    {
      title: "Total Earnings",
      value: metrics?.overview.totalEarnings || 0,
      format: "currency",
      icon: CreditCard,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      description: "All-time earnings",
    },
    {
      title: "Completed Bookings",
      value: metrics?.overview.completedBookings || 0,
      format: "number",
      icon: Calendar,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      description: `${metrics?.overview.upcomingBookings || 0} upcoming`,
    },
    {
      title: "Average Rating",
      value: metrics?.overview.averageRating || 0,
      format: "rating",
      icon: Star,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
      description: `From ${metrics?.overview.totalReviews || 0} reviews`,
    },
  ];

  const formatValue = (value: number, format: string) => {
    switch (format) {
      case "currency":
        return `$${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
      case "rating":
        return value > 0 ? value.toFixed(1) : "N/A";
      case "number":
        return value.toString();
      default:
        return value.toString();
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, index) => (
        <motion.div
          key={card.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <Card className="relative overflow-hidden">
            {/* Background decoration */}
            <div 
              className={`absolute top-0 right-0 w-24 h-24 ${card.bgColor} rounded-full blur-3xl opacity-20`}
            />
            
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {card.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${card.bgColor}`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {formatValue(card.value, card.format)}
                  </div>
                  
                  {card.trend !== undefined && card.trend !== 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      <TrendingUp 
                        className={`h-3 w-3 ${
                          card.trend > 0 ? "text-green-600" : "text-red-600"
                        }`} 
                      />
                      <span 
                        className={`text-xs font-medium ${
                          card.trend > 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {card.trend > 0 ? "+" : ""}{card.trend.toFixed(1)}%
                      </span>
                      <span className="text-xs text-gray-500">vs last period</span>
                    </div>
                  )}
                  
                  <p className="text-xs text-gray-600 mt-1">
                    {card.description}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ))}

      {/* Pending Payouts Card */}
      {metrics?.overview.pendingPayouts && metrics.overview.pendingPayouts > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: cards.length * 0.1 }}
          className="md:col-span-2 lg:col-span-4"
        >
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Clock className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Pending Payouts</CardTitle>
                  <p className="text-sm text-gray-600">Available for next payout</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600">
                  ${metrics.overview.pendingPayouts.toFixed(2)}
                </div>
                <p className="text-xs text-gray-500">Processing in 2-3 days</p>
              </div>
            </CardHeader>
          </Card>
        </motion.div>
      )}
    </div>
  );
}