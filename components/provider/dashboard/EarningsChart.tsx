"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Download,
  Filter,
  Info
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";

interface ChartData {
  date: string;
  earnings: number;
  bookings: number;
}

interface EarningsChartProps {
  providerId: string;
}

export function EarningsChart({ providerId }: EarningsChartProps) {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<"week" | "month" | "year">("month");
  const [metrics, setMetrics] = useState({
    total: 0,
    average: 0,
    growth: 0,
    bestDay: "",
  });

  useEffect(() => {
    const fetchChartData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/providers/${providerId}/metrics?period=${period}&includeCharts=true`
        );
        if (!response.ok) throw new Error("Failed to fetch chart data");
        
        const data = await response.json();
        
        if (data.chartData?.earnings) {
          setChartData(data.chartData.earnings);
          
          // Calculate metrics
          const earnings = data.chartData.earnings.map((d: ChartData) => d.earnings);
          const total = earnings.reduce((sum: number, val: number) => sum + val, 0);
          const average = total / earnings.length;
          
          // Find best day
          const bestDayData = data.chartData.earnings.reduce((best: ChartData, current: ChartData) => 
            current.earnings > best.earnings ? current : best
          , data.chartData.earnings[0]);
          
          setMetrics({
            total,
            average,
            growth: data.period.earningsGrowth || 0,
            bestDay: bestDayData?.date || "",
          });
        }
      } catch (error) {
        console.error("Error fetching chart data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchChartData();
  }, [providerId, period]);

  // Generate chart bars
  const maxEarnings = Math.max(...chartData.map(d => d.earnings), 1);
  
  const renderChart = () => {
    if (chartData.length === 0) {
      return (
        <div className="text-center py-12">
          <TrendingUp className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No earnings data available for this period</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-600">Total Earnings</p>
            <p className="text-lg font-bold">${metrics.total.toFixed(2)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-600">Daily Average</p>
            <p className="text-lg font-bold">${metrics.average.toFixed(2)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-600">Growth</p>
            <div className="flex items-center gap-1">
              {metrics.growth >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
              <p className={`text-lg font-bold ${
                metrics.growth >= 0 ? "text-green-600" : "text-red-600"
              }`}>
                {metrics.growth >= 0 ? "+" : ""}{metrics.growth.toFixed(1)}%
              </p>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-600">Best Day</p>
            <p className="text-sm font-bold">
              {metrics.bestDay ? format(parseISO(metrics.bestDay), "MMM d") : "N/A"}
            </p>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="relative">
          <div className="flex items-end gap-1 h-48">
            {chartData.map((data, index) => {
              const height = (data.earnings / maxEarnings) * 100;
              const isToday = format(new Date(), "yyyy-MM-dd") === data.date;
              
              return (
                <motion.div
                  key={data.date}
                  initial={{ height: 0 }}
                  animate={{ height: `${height}%` }}
                  transition={{ delay: index * 0.02, duration: 0.3 }}
                  className="flex-1 relative group"
                >
                  <div
                    className={`w-full h-full rounded-t-sm transition-colors ${
                      isToday 
                        ? "bg-blue-600" 
                        : data.earnings > metrics.average
                        ? "bg-green-500 hover:bg-green-600"
                        : "bg-gray-400 hover:bg-gray-500"
                    }`}
                  />
                  
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    <div className="bg-gray-900 text-white text-xs rounded py-2 px-3 whitespace-nowrap">
                      <p className="font-semibold">{format(parseISO(data.date), "MMM d")}</p>
                      <p>${data.earnings.toFixed(2)}</p>
                      <p>{data.bookings} bookings</p>
                    </div>
                    <div className="w-2 h-2 bg-gray-900 transform rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1" />
                  </div>
                </motion.div>
              );
            })}
          </div>
          
          {/* X-axis labels */}
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>{format(parseISO(chartData[0].date), "MMM d")}</span>
            <span>{format(parseISO(chartData[chartData.length - 1].date), "MMM d")}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Earnings Overview</CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Track your revenue performance
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={(value: any) => setPeriod(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Last 7 days</SelectItem>
                <SelectItem value="month">Last 30 days</SelectItem>
                <SelectItem value="year">Last year</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
            <Skeleton className="h-48" />
          </div>
        ) : (
          <Tabs defaultValue="chart" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="chart">Chart View</TabsTrigger>
              <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
            </TabsList>
            
            <TabsContent value="chart" className="space-y-4">
              {renderChart()}
            </TabsContent>
            
            <TabsContent value="breakdown" className="space-y-4">
              <div className="space-y-2">
                {chartData.slice(0, 10).map((data) => (
                  <div 
                    key={data.date}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="font-medium text-sm">
                          {format(parseISO(data.date), "EEEE, MMMM d")}
                        </p>
                        <p className="text-xs text-gray-600">
                          {data.bookings} booking{data.bookings !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">${data.earnings.toFixed(2)}</p>
                      {data.earnings > metrics.average && (
                        <Badge variant="secondary" className="text-xs">
                          Above avg
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        )}
        
        {/* Info Note */}
        <div className="mt-6 p-3 bg-blue-50 rounded-lg flex items-start gap-2">
          <Info className="h-4 w-4 text-blue-600 mt-0.5" />
          <div className="text-xs text-blue-800">
            <p className="font-medium">Platform Fee Information</p>
            <p className="mt-1">
              These earnings reflect your net amount after the 10% platform fee. 
              The amounts shown are what you'll receive in your payouts.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}