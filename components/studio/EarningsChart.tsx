"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { format, parseISO } from "date-fns";

interface EarningsChartProps {
  data: Array<{
    date: string;
    amount: number;
  }>;
}

export function EarningsChart({ data }: EarningsChartProps) {
  const chartData = useMemo(() => {
    // Fill in missing dates with 0 earnings
    const filledData = [];
    const dataMap = new Map(data.map(d => [d.date, d.amount]));
    
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    for (let d = new Date(thirtyDaysAgo); d <= today; d.setDate(d.getDate() + 1)) {
      const dateStr = format(d, 'yyyy-MM-dd');
      filledData.push({
        date: dateStr,
        amount: dataMap.get(dateStr) || 0,
        displayDate: format(d, 'MMM d'),
      });
    }
    
    return filledData;
  }, [data]);

  const totalEarnings = useMemo(() => {
    return chartData.reduce((sum, day) => sum + day.amount, 0);
  }, [chartData]);

  const averageDaily = useMemo(() => {
    return chartData.length > 0 ? totalEarnings / chartData.length : 0;
  }, [chartData, totalEarnings]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload[0]) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900">
            {format(parseISO(label), 'MMMM d, yyyy')}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Earnings: <span className="font-semibold text-gray-900">${payload[0].value.toFixed(2)}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-gray-500">Total (30 days)</p>
          <p className="text-2xl font-bold text-gray-900">
            ${totalEarnings.toFixed(2)}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Daily Average</p>
          <p className="text-2xl font-bold text-gray-900">
            ${averageDaily.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0066FF" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#0066FF" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="displayDate" 
              stroke="#9ca3af"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              stroke="#9ca3af"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `$${value}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="amount"
              stroke="#0066FF"
              strokeWidth={2}
              fill="url(#colorEarnings)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}