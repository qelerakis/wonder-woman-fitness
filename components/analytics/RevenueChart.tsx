"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { Card, CardHeader } from "@/components/ui/Card";

interface RevenueChartProps {
  membershipRevenue: number;
  privateSessionRevenue: number;
  totalRevenue: number;
}

const COLORS = ["#9333ea", "#7e22ce"];

function formatCurrency(amount: number): string {
  return `${amount.toLocaleString()} MKD`;
}

export function RevenueChart({
  membershipRevenue,
  privateSessionRevenue,
  totalRevenue,
}: RevenueChartProps): React.ReactElement {
  const data = [
    { name: "Membership", value: membershipRevenue },
    { name: "Private Sessions", value: privateSessionRevenue },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader title="Revenue Breakdown" description="Income by source" />
        <div className="mt-4 flex h-48 items-center justify-center">
          <p className="text-sm text-surface-500">No revenue data available</p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Revenue Breakdown"
        description={`Total: ${formatCurrency(totalRevenue)}`}
      />
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={3}
              dataKey="value"
              label={({ name, percent }: { name?: string; percent?: number }) =>
                `${name ?? ""}: ${((percent ?? 0) * 100).toFixed(0)}%`
              }
              labelLine={{ stroke: "#64748b" }}
            >
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "8px",
                color: "#f1f5f9",
                fontSize: "12px",
              }}
              formatter={(value: number | undefined) => [formatCurrency(value ?? 0), "Revenue"]}
            />
            <Legend
              wrapperStyle={{ fontSize: "12px", color: "#94a3b8" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export type { RevenueChartProps };
