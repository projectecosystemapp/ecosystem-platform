'use client';

import { useState, useEffect } from 'react';
import { TimePeriod } from '@/db/queries/analytics-queries';
import { AnalyticsOverview } from '@/app/api/providers/[providerId]/analytics/overview/route';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, TrendingUp, TrendingDown, Download, RefreshCw } from 'lucide-react';
import { EarningsChart } from './EarningsChart';
import { BookingMetrics } from './BookingMetrics';
import { CustomerAnalytics } from './CustomerAnalytics';
import { ServicePerformance } from './ServicePerformance';
import ComparisonCards from './ComparisonCards';
import { ExportButtons } from './ExportButtons';

interface ProviderAnalyticsDashboardProps {
  providerId: string;
}

export default function ProviderAnalyticsDashboard({ providerId }: ProviderAnalyticsDashboardProps) {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<TimePeriod>('30d');
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const periodLabels = {
    '7d': 'Last 7 days',
    '30d': 'Last 30 days',
    '90d': 'Last 90 days',
    '1yr': 'Last year',
    'all': 'All time',
  };

  const fetchAnalytics = async (selectedPeriod: TimePeriod) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/providers/${providerId}/analytics/overview?period=${selectedPeriod}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch analytics: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch analytics data');
      }
      
      setData(result.data);
      setLastUpdated(new Date(result.timestamp).toLocaleString());
    } catch (err) {
      console.error('Analytics fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(period);
  }, [providerId, period]);

  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod as TimePeriod);
  };

  const handleRefresh = () => {
    fetchAnalytics(period);
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <p className="text-gray-600 dark:text-gray-400">Loading analytics data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="max-w-md mx-auto">
        <AlertDescription>
          {error}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            className="mt-2 w-full"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!data) {
    return (
      <Alert className="max-w-md mx-auto">
        <AlertDescription>
          No analytics data available. This might be because you haven't received any bookings yet.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Controls */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex items-center gap-4">
          {/* Time Period Selector */}
          <Select value={period} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(periodLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Refresh Button */}
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        
        {/* Export Controls */}
        <div className="flex items-center gap-2">
          <ExportButtons />
          {lastUpdated && (
            <span className="text-xs text-gray-500">
              Updated: {lastUpdated}
            </span>
          )}
        </div>
      </div>

      {/* Key Metrics Overview */}
      <ComparisonCards summary={data.summary} period={period} />

      {/* Main Analytics Content */}
      <Tabs defaultValue="earnings" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="earnings">Earnings</TabsTrigger>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
        </TabsList>

        {/* Earnings Tab */}
        <TabsContent value="earnings" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <EarningsChart data={data?.earnings?.monthlyTrend || []} />
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Revenue Breakdown
                  <Badge variant="secondary">
                    ${data.earnings.totalEarnings.toLocaleString()}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Platform Fee</span>
                    <span className="font-medium text-red-600">
                      -${data.earnings.platformFees.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Pending Payouts</span>
                    <span className="font-medium text-yellow-600">
                      ${data.earnings.pendingPayouts.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-t pt-2">
                    <span className="font-medium">Net Earnings</span>
                    <span className="font-bold text-green-600">
                      ${(data.earnings.totalEarnings - data.earnings.platformFees).toLocaleString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Revenue Breakdown Charts */}
          <div className="grid gap-6 md:grid-cols-2">
            <ServicePerformance 
              services={data?.topServices || []}
            />
          </div>
        </TabsContent>

        {/* Bookings Tab */}
        <TabsContent value="bookings" className="space-y-6">
          <BookingMetrics 
            totalBookings={data?.bookings?.total || 0}
            completedBookings={data?.bookings?.completed || 0}
            cancelledBookings={data?.bookings?.cancelled || 0}
            upcomingBookings={data?.bookings?.upcoming || 0}
          />
        </TabsContent>

        {/* Customers Tab */}
        <TabsContent value="customers" className="space-y-6">
          <CustomerAnalytics 
            totalCustomers={data?.customers?.total || 0}
            repeatCustomers={data?.customers?.repeat || 0}
            averageRating={data?.customers?.averageRating || 0}
            totalReviews={data?.customers?.totalReviews || 0}
          />
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value="services" className="space-y-6">
          <ServicePerformance 
            services={data?.topServices || []}
          />
        </TabsContent>
      </Tabs>
      
      {/* Performance Metrics Footer */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {data.performance.averageRating.toFixed(1)}
              </div>
              <div className="text-sm text-gray-600">Average Rating</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {data.summary.completionRate.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600">Completion Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {data.performance.responseTime.toFixed(1)}h
              </div>
              <div className="text-sm text-gray-600">Avg Response Time</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}