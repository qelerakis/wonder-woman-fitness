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

const COLORS = ["#9333ea", "#14b8a6"];

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
              innerRadius={50}
              outerRadius={75}
              paddingAngle={3}
              dataKey="value"
              label={({ percent }: { percent?: number }) =>
                `${((percent ?? 0) * 100).toFixed(0)}%`
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
              content={({ active, payload }: { active?: boolean; payload?: Array<{ name?: string; value?: number; payload?: { fill?: string } }> }) => {
                if (!active || !payload || payload.length === 0) return null;
                const entry = payload[0];
                const color = entry?.payload?.fill ?? "#f1f5f9";
                return (
                  <div style={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    fontSize: "12px",
                  }}>
                    <span style={{ color }}>{entry?.name}: {formatCurrency(entry?.value ?? 0)}</span>
                  </div>
                );
              }}
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
