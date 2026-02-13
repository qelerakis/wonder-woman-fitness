"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardHeader } from "@/components/ui/Card";

interface SlotData {
  day: string;
  hour: number;
  avgAttendance: number;
  avgFillRate: number;
  sessionCount: number;
}

interface AttendanceChartProps {
  slots: SlotData[];
}

function formatHour(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}${period}`;
}

export function AttendanceChart({
  slots,
}: AttendanceChartProps): React.ReactElement {
  const chartData = slots.map((slot) => ({
    name: `${slot.day.slice(0, 3)} ${formatHour(slot.hour)}`,
    attendance: Math.round(slot.avgAttendance * 10) / 10,
    fillRate: Math.round(slot.avgFillRate * 100),
  }));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader title="Class Attendance" description="Average attendance by time slot" />
        <div className="mt-4 flex h-48 items-center justify-center">
          <p className="text-sm text-surface-500">No session data available</p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Class Attendance" description="Average attendance by time slot" />
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
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
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "8px",
                color: "#f1f5f9",
                fontSize: "12px",
              }}
              formatter={(value: number | undefined, name: string | undefined) => {
                const v = value ?? 0;
                if (name === "fillRate") return [`${v}%`, "Fill Rate"];
                return [v, "Avg Attendance"];
              }}
            />
            <Bar
              dataKey="attendance"
              fill="#9333ea"
              radius={[4, 4, 0, 0]}
              name="attendance"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export type { AttendanceChartProps, SlotData };
