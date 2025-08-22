"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ServicePerformanceProps {
  services: Array<{
    name: string;
    bookings: number;
    revenue: number;
    rating: number;
  }>;
}

export function ServicePerformance({ services }: ServicePerformanceProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Service Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {services.map((service) => (
            <div key={service.name} className="flex items-center justify-between">
              <div className="flex-1">
                <p className="font-medium">{service.name}</p>
                <p className="text-sm text-muted-foreground">
                  {service.bookings} bookings · ${service.revenue}
                </p>
              </div>
              <div className="text-right">
                <span className="font-medium">{service.rating.toFixed(1)} ⭐</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}