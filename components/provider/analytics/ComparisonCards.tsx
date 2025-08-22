'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign, Calendar, Star, Users } from 'lucide-react';
import { TimePeriod } from '@/db/queries/analytics-queries';

interface ComparisonCardsProps {
  summary: {
    totalEarnings: number;
    totalBookings: number;
    averageRating: number;
    completionRate: number;
    customerRetentionRate: number;
    periodComparison: {
      earningsChange: number;
      bookingsChange: number;
      ratingChange: number;
    };
  };
  period: TimePeriod;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercentage(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function TrendIcon({ value }: { value: number }) {
  if (Math.abs(value) < 0.1) {
    return null;
  }
  
  return value >= 0 ? (
    <TrendingUp className="h-4 w-4 text-green-600" />
  ) : (
    <TrendingDown className="h-4 w-4 text-red-600" />
  );
}

function TrendBadge({ value }: { value: number }) {
  if (Math.abs(value) < 0.1) {
    return (
      <Badge variant="secondary" className="text-xs">
        0%
      </Badge>
    );
  }
  
  const variant = value >= 0 ? 'default' : 'destructive';
  const bgColor = value >= 0 ? 'bg-green-100 text-green-800 hover:bg-green-100' : 'bg-red-100 text-red-800 hover:bg-red-100';
  
  return (
    <Badge variant={variant} className={`text-xs ${bgColor}`}>
      <TrendIcon value={value} />
      <span className="ml-1">{formatPercentage(value)}</span>
    </Badge>
  );
}

export default function ComparisonCards({ summary, period }: ComparisonCardsProps) {
  const periodLabels = {
    '7d': 'vs last 7 days',
    '30d': 'vs last 30 days',
    '90d': 'vs last 90 days',
    '1yr': 'vs last year',
    'all': 'vs previous period',
  };

  const metrics = [
    {
      title: 'Total Earnings',
      value: formatCurrency(summary.totalEarnings),
      change: summary.periodComparison.earningsChange,
      icon: DollarSign,
      color: 'text-green-600',
    },
    {
      title: 'Total Bookings',
      value: summary.totalBookings.toLocaleString(),
      change: summary.periodComparison.bookingsChange,
      icon: Calendar,
      color: 'text-blue-600',
    },
    {
      title: 'Average Rating',
      value: summary.averageRating > 0 ? summary.averageRating.toFixed(1) : 'N/A',
      change: summary.periodComparison.ratingChange,
      icon: Star,
      color: 'text-yellow-600',
    },
    {
      title: 'Completion Rate',
      value: `${summary.completionRate.toFixed(1)}%`,
      change: 0, // TODO: Add completion rate comparison
      icon: Users,
      color: 'text-purple-600',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => {
        const IconComponent = metric.icon;
        
        return (
          <Card key={metric.title} className="relative overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {metric.title}
                  </p>
                  <div className="flex items-baseline space-x-2">
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {metric.value}
                    </p>
                  </div>
                  <div className="flex items-center space-x-1">
                    <TrendBadge value={metric.change} />
                    <span className="text-xs text-gray-500">
                      {periodLabels[period]}
                    </span>
                  </div>
                </div>
                
                <div className="flex-shrink-0">
                  <div className={`p-3 rounded-lg bg-gray-50 dark:bg-gray-800 ${metric.color}`}>
                    <IconComponent className="h-6 w-6" />
                  </div>
                </div>
              </div>
            </CardContent>
            
            {/* Subtle gradient overlay for visual interest */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-gray-50/20 dark:to-gray-800/20 pointer-events-none" />
          </Card>
        );
      })}
    </div>
  );
}