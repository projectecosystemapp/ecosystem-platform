"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Calendar,
  DollarSign,
  Star,
  XCircle,
  CheckCircle,
  Clock,
  User,
  ArrowRight,
  RefreshCw
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface Activity {
  id: string;
  type: string;
  title: string;
  description: string;
  metadata: {
    amount?: number;
    status?: string;
    bookingDate?: string;
    startTime?: string;
    customerName?: string;
  };
  timestamp: string;
  timeAgo: string;
}

interface RecentActivityProps {
  providerId: string;
}

export function RecentActivity({ providerId }: RecentActivityProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchActivities = async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    
    try {
      const response = await fetch(`/api/providers/${providerId}/activity?limit=10`);
      if (!response.ok) throw new Error("Failed to fetch activities");
      
      const data = await response.json();
      setActivities(data.activities);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchActivities();
    
    // Refresh every 30 seconds
    const interval = setInterval(() => fetchActivities(false), 30000);
    return () => clearInterval(interval);
  }, [providerId]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "booking_created":
      case "booking_confirmed":
        return { icon: Calendar, color: "text-blue-600", bg: "bg-blue-100" };
      case "booking_completed":
        return { icon: CheckCircle, color: "text-green-600", bg: "bg-green-100" };
      case "booking_cancelled":
        return { icon: XCircle, color: "text-red-600", bg: "bg-red-100" };
      case "payment_received":
        return { icon: DollarSign, color: "text-green-600", bg: "bg-green-100" };
      case "review_received":
        return { icon: Star, color: "text-yellow-600", bg: "bg-yellow-100" };
      default:
        return { icon: Clock, color: "text-gray-600", bg: "bg-gray-100" };
    }
  };

  const getStatusBadge = (status?: string) => {
    if (!status) return null;
    
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "outline",
      confirmed: "secondary",
      completed: "default",
      cancelled: "destructive",
    };

    return (
      <Badge variant={variants[status] || "outline"} className="text-xs">
        {status}
      </Badge>
    );
  };

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <p>Failed to load activities</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={() => fetchActivities()}
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
        <CardTitle>Recent Activity</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchActivities(true)}
          disabled={isRefreshing}
          className="h-8 w-8 p-0"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No recent activity</p>
            <p className="text-sm mt-1">Activities will appear here as they happen</p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {activities.map((activity, index) => {
                const iconConfig = getActivityIcon(activity.type);
                const IconComponent = iconConfig.icon;

                return (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className={`p-2 rounded-full ${iconConfig.bg} flex-shrink-0`}>
                      <IconComponent className={`h-4 w-4 ${iconConfig.color}`} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{activity.title}</p>
                        {getStatusBadge(activity.metadata?.status)}
                      </div>
                      
                      <p className="text-sm text-gray-600 mt-1">
                        {activity.description}
                      </p>
                      
                      {activity.metadata?.amount && (
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="secondary" className="text-xs">
                            ${activity.metadata.amount.toFixed(2)}
                          </Badge>
                        </div>
                      )}
                      
                      {activity.metadata?.bookingDate && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {new Date(activity.metadata.bookingDate).toLocaleDateString()}
                          </span>
                          {activity.metadata.startTime && (
                            <>
                              <span className="mx-1">•</span>
                              <span>{activity.metadata.startTime}</span>
                            </>
                          )}
                        </div>
                      )}
                      
                      <p className="text-xs text-gray-400 mt-2">
                        {activity.timeAgo}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            
            {activities.length >= 10 && (
              <Button 
                variant="ghost" 
                className="w-full"
                onClick={() => {/* Navigate to full activity page */}}
              >
                View All Activity
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}