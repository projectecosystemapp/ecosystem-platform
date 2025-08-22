"use client";

import { motion } from "framer-motion";
import {
  Award,
  Calendar,
  Star,
  Users,
  TrendingUp,
  Clock,
  CheckCircle,
  Shield,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ProviderStatsProps {
  provider: any;
}

export default function ProviderStats({ provider }: ProviderStatsProps) {
  const stats = [
    {
      icon: Calendar,
      label: "Years Experience",
      value: provider.yearsExperience || 0,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
      suffix: provider.yearsExperience === 1 ? "year" : "years",
    },
    {
      icon: CheckCircle,
      label: "Completed Bookings",
      value: provider.completedBookings || 0,
      color: "text-green-600",
      bgColor: "bg-green-100",
      suffix: "bookings",
    },
    {
      icon: Star,
      label: "Average Rating",
      value: Number(provider.averageRating || 0).toFixed(1),
      color: "text-yellow-600",
      bgColor: "bg-yellow-100",
      suffix: `(${provider.totalReviews || 0} reviews)`,
    },
    {
      icon: Clock,
      label: "Response Time",
      value: "< 2",
      color: "text-purple-600",
      bgColor: "bg-purple-100",
      suffix: "hours",
    },
  ];

  // Calculate satisfaction rate based on ratings
  const satisfactionRate = provider.averageRating
    ? Math.round((provider.averageRating / 5) * 100)
    : 0;

  // Achievement badges based on provider stats
  const achievements = [];
  
  if (provider.isVerified) {
    achievements.push({ label: "Verified Provider", icon: Shield, color: "blue" });
  }
  if (provider.completedBookings >= 100) {
    achievements.push({ label: "100+ Bookings", icon: Award, color: "gold" });
  }
  if (provider.averageRating >= 4.8) {
    achievements.push({ label: "Top Rated", icon: Star, color: "yellow" });
  }
  if (provider.yearsExperience >= 5) {
    achievements.push({ label: "5+ Years Pro", icon: TrendingUp, color: "green" });
  }

  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-6 border-b">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Provider Statistics</h2>
        <p className="text-sm text-gray-600">
          Track record and performance metrics
        </p>
      </div>
      <CardContent className="p-6">
        {/* Main Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="text-center"
            >
              <div
                className={cn(
                  "w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center",
                  stat.bgColor
                )}
              >
                <stat.icon className={cn("h-6 w-6", stat.color)} />
              </div>
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-xs text-gray-600 mt-1">{stat.suffix}</div>
              <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Satisfaction Rate */}
        {provider.averageRating > 0 && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Customer Satisfaction
              </span>
              <span className="text-sm font-bold text-gray-900">
                {satisfactionRate}%
              </span>
            </div>
            <Progress value={satisfactionRate} className="h-2" />
            <p className="text-xs text-gray-500 mt-2">
              Based on {provider.totalReviews} customer reviews
            </p>
          </div>
        )}

        {/* Achievement Badges */}
        {achievements.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Achievements
            </h3>
            <div className="flex flex-wrap gap-2">
              {achievements.map((achievement, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Badge
                    variant="secondary"
                    className={cn(
                      "gap-1.5 py-1.5 px-3",
                      achievement.color === "blue" && "bg-blue-100 text-blue-700",
                      achievement.color === "gold" && "bg-amber-100 text-amber-700",
                      achievement.color === "yellow" && "bg-yellow-100 text-yellow-700",
                      achievement.color === "green" && "bg-green-100 text-green-700"
                    )}
                  >
                    <achievement.icon className="h-3.5 w-3.5" />
                    {achievement.label}
                  </Badge>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Performance Metrics */}
        <div className="mt-6 pt-6 border-t">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            Performance Metrics
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">On-time arrival</span>
              <div className="flex items-center gap-2">
                <Progress value={95} className="w-24 h-2" />
                <span className="text-sm font-medium text-gray-900">95%</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Repeat customers</span>
              <div className="flex items-center gap-2">
                <Progress value={78} className="w-24 h-2" />
                <span className="text-sm font-medium text-gray-900">78%</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Profile completion</span>
              <div className="flex items-center gap-2">
                <Progress value={100} className="w-24 h-2" />
                <span className="text-sm font-medium text-gray-900">100%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Trust Indicators */}
        <div className="mt-6 pt-6 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Background Verified
                </p>
                <p className="text-xs text-gray-500">
                  Identity and credentials verified
                </p>
              </div>
            </div>
            <CheckCircle className="h-5 w-5 text-green-600" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}