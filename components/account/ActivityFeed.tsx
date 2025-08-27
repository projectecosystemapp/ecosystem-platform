"use client";

import { format, formatDistanceToNow } from "date-fns";
import { 
  Calendar, 
  Trophy, 
  Heart, 
  CreditCard,
  Star,
  Package,
  CheckCircle,
  XCircle,
  AlertCircle,
  Gift,
  TrendingUp,
  Users
} from "lucide-react";

interface Activity {
  id: string;
  type: string;
  title: string;
  message?: string | null;
  metadata?: any;
  createdAt: Date;
  read: boolean;
}

interface ActivityFeedProps {
  activities: Activity[];
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  const getActivityIcon = (type: string) => {
    const iconMap: Record<string, React.ElementType> = {
      // Subscription
      subscription_confirmed: CheckCircle,
      subscription_renewed: CreditCard,
      subscription_cancelled: XCircle,
      subscription_expiring: AlertCircle,
      subscription_failed: XCircle,
      
      // Payments
      payment_received: CreditCard,
      payment_failed: XCircle,
      payment_refunded: CreditCard,
      payout_processed: TrendingUp,
      
      // Loyalty
      points_earned: Trophy,
      points_redeemed: Gift,
      points_expiring: AlertCircle,
      tier_upgraded: TrendingUp,
      tier_downgraded: TrendingUp,
      special_offer: Gift,
      
      // Bookings
      booking_confirmed: CheckCircle,
      booking_reminder: Calendar,
      booking_cancelled: XCircle,
      booking_completed: Star,
      
      // Group
      group_booking_invitation: Users,
      group_booking_confirmed: Users,
      group_member_joined: Users,
      
      // General
      review_reminder: Star,
      favorite_available: Heart,
      new_message: Package,
    };
    
    const Icon = iconMap[type] || Package;
    return Icon;
  };

  const getActivityColor = (type: string) => {
    if (type.includes("confirmed") || type.includes("completed") || type.includes("earned")) {
      return "text-green-600 bg-green-50";
    }
    if (type.includes("failed") || type.includes("cancelled")) {
      return "text-red-600 bg-red-50";
    }
    if (type.includes("expiring") || type.includes("reminder")) {
      return "text-yellow-600 bg-yellow-50";
    }
    if (type.includes("loyalty") || type.includes("points") || type.includes("tier")) {
      return "text-purple-600 bg-purple-50";
    }
    return "text-blue-600 bg-blue-50";
  };

  const formatActivityTitle = (activity: Activity) => {
    if (activity.title) return activity.title;
    
    // Format type to readable title if no title provided
    return activity.type
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  if (activities.length === 0) {
    return (
      <div className="text-center py-8">
        <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No recent activity</p>
        <p className="text-sm text-gray-400 mt-1">
          Your marketplace activities will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activities.map((activity) => {
        const Icon = getActivityIcon(activity.type);
        const colorClass = getActivityColor(activity.type);
        
        return (
          <div
            key={activity.id}
            className={cn(
              "flex gap-3 p-3 rounded-lg transition-colors",
              !activity.read && "bg-blue-50/50"
            )}
          >
            <div className={cn("p-2 rounded-lg flex-shrink-0", colorClass)}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-gray-900">
                {formatActivityTitle(activity)}
              </p>
              {activity.message && (
                <p className="text-sm text-gray-600 mt-1">
                  {activity.message}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
              </p>
            </div>
            {!activity.read && (
              <div className="flex-shrink-0">
                <div className="h-2 w-2 bg-blue-600 rounded-full" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ');
}