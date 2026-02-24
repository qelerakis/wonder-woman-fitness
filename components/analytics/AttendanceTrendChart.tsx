"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardHeader } from "@/components/ui/Card";
import { format } from "date-fns";

interface AttendanceTrendChartProps {
  trend: Array<{
    week: string;
    rate: number;
    present: number;
    total: number;
  }>;
}

export function AttendanceTrendChart({
  trend,
}: AttendanceTrendChartProps): React.ReactElement {
  const chartData = trend.map((entry) => ({
    name: format(new Date(entry.week), "MMM d"),
    rate: entry.rate,
    present: entry.present,
    total: entry.total,
  }));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader
          title="Attendance Trend"
          description="Weekly show-up rate over time"
        />
        <div className="mt-4 flex h-48 items-center justify-center">
          <p className="text-sm text-surface-500">No trend data available</p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Attendance Trend"
        description="Weekly show-up rate over time"
      />
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 5, bottom: 5, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="name"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={{ stroke: "#475569" }}
              tickLine={{ stroke: "#475569" }}
            />
            <YAxis
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={{ stroke: "#475569" }}
              tickLine={{ stroke: "#475569" }}
              domain={[0, 100]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "8px",
                color: "#f1f5f9",
                fontSize: "12px",
              }}
              formatter={(value: number | undefined) => [
                `${value ?? 0}%`,
                "Show-up Rate",
              ]}
            />
            <Line
              type="monotone"
              dataKey="rate"
              stroke="#9333ea"
              strokeWidth={2}
              dot={{ r: 4, fill: "#9333ea" }}
              activeDot={{ r: 6, fill: "#9333ea" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export type { AttendanceTrendChartProps };
