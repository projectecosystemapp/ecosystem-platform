"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: number; // Percentage change
  className?: string;
}

export function MetricsCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  className,
}: MetricsCardProps) {
  const isPositiveTrend = trend && trend > 0;
  const isNegativeTrend = trend && trend < 0;

  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">
          {title}
        </CardTitle>
        <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
          <Icon className="h-5 w-5 text-blue-600" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        {(description || trend !== undefined) && (
          <div className="mt-1 flex items-center justify-between">
            {description && (
              <p className="text-xs text-gray-500">{description}</p>
            )}
            {trend !== undefined && (
              <div className={cn(
                "flex items-center text-xs font-medium",
                isPositiveTrend && "text-green-600",
                isNegativeTrend && "text-red-600",
                !isPositiveTrend && !isNegativeTrend && "text-gray-500"
              )}>
                {isPositiveTrend && <TrendingUp className="mr-1 h-3 w-3" />}
                {isNegativeTrend && <TrendingDown className="mr-1 h-3 w-3" />}
                {Math.abs(trend)}%
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}