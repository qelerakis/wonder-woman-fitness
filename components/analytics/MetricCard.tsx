import { Card } from "@/components/ui/Card";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    direction: "up" | "down" | "neutral";
    label: string;
  };
  icon?: React.ReactNode;
}

export function MetricCard({
  title,
  value,
  subtitle,
  trend,
  icon,
}: MetricCardProps): React.ReactElement {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">
            {title}
          </p>
          <p className="mt-1 text-2xl font-bold text-surface-100">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          {subtitle && (
            <p className="mt-0.5 text-sm text-surface-400">{subtitle}</p>
          )}
          {trend && (
            <div className="mt-2 flex items-center gap-1">
              {trend.direction === "up" && (
                <svg className="h-4 w-4 text-success-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              )}
              {trend.direction === "down" && (
                <svg className="h-4 w-4 text-error-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
              <span
                className={`text-xs font-medium ${
                  trend.direction === "up"
                    ? "text-success-500"
                    : trend.direction === "down"
                      ? "text-error-500"
                      : "text-surface-400"
                }`}
              >
                {trend.label}
              </span>
            </div>
          )}
        </div>
        {icon && (
          <div className="shrink-0 rounded-lg bg-primary-900/30 p-2.5 text-primary-400">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

export type { MetricCardProps };
