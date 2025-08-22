"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CustomerAnalyticsProps {
  totalCustomers: number;
  repeatCustomers: number;
  averageRating: number;
  totalReviews: number;
}

export function CustomerAnalytics({
  totalCustomers,
  repeatCustomers,
  averageRating,
  totalReviews,
}: CustomerAnalyticsProps) {
  const repeatRate = totalCustomers > 0 ? (repeatCustomers / totalCustomers * 100).toFixed(1) : 0;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer Analytics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Total Customers</span>
          <span className="font-medium">{totalCustomers}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Repeat Customers</span>
          <span className="font-medium">{repeatCustomers} ({repeatRate}%)</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Average Rating</span>
          <span className="font-medium">{averageRating.toFixed(1)} ⭐</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Total Reviews</span>
          <span className="font-medium">{totalReviews}</span>
        </div>
      </CardContent>
    </Card>
  );
}