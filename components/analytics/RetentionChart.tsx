"use client";

import { useTranslations } from "next-intl";
import { Card, CardHeader } from "@/components/ui/Card";

interface RetentionChartProps {
  retentionRate: number;
  churnRate: number;
  departedInPeriod: number;
  avgLifespanDays: number;
}

export function RetentionChart({
  retentionRate,
  churnRate,
  departedInPeriod,
  avgLifespanDays,
}: RetentionChartProps): React.ReactElement {
  const t = useTranslations("analytics");
  const retentionPct = Math.round(retentionRate * 100);
  const churnPct = Math.round(churnRate * 100);

  // Color based on retention rate
  const retentionColor =
    retentionPct >= 90
      ? "text-success-500"
      : retentionPct >= 75
        ? "text-warning-500"
        : "text-error-500";

  const barColor =
    retentionPct >= 90
      ? "bg-success-500"
      : retentionPct >= 75
        ? "bg-warning-500"
        : "bg-error-500";

  return (
    <Card>
      <CardHeader
        title={t("memberRetention")}
        description={t("howWellYouKeepMembers")}
      />

      <div className="mt-4 space-y-6">
        {/* Retention rate bar */}
        <div>
          <div className="flex items-end justify-between mb-2">
            <span className="text-sm text-surface-400">{t("retentionRate")}</span>
            <span className={`text-2xl font-bold ${retentionColor}`}>
              {retentionPct}%
            </span>
          </div>
          <div className="h-3 w-full rounded-full bg-surface-700">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${retentionPct}%` }}
            />
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-xl font-bold text-surface-100">{churnPct}%</p>
            <p className="text-xs text-surface-500">{t("churnRate")}</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-surface-100">
              {departedInPeriod}
            </p>
            <p className="text-xs text-surface-500">{t("departed")}</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-surface-100">
              {avgLifespanDays > 0 ? `${avgLifespanDays}d` : "N/A"}
            </p>
            <p className="text-xs text-surface-500">{t("avgLifespan")}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

export type { RetentionChartProps };
