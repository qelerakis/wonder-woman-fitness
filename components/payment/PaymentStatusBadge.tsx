import { Badge } from "@/components/ui/Badge";
import type { PaymentStatus } from "@/lib/constants";
import type { BadgeVariant } from "@/components/ui/Badge";

interface PaymentStatusBadgeProps {
  status: PaymentStatus;
  size?: "sm" | "md";
}

const statusConfig: Record<PaymentStatus, { label: string; variant: BadgeVariant }> = {
  TRIAL: { label: "Trial", variant: "info" },
  PAID: { label: "Paid", variant: "success" },
  GRACE_PERIOD: { label: "Grace Period", variant: "warning" },
  LOCKED: { label: "Locked", variant: "error" },
  OVERRIDE: { label: "Override", variant: "primary" },
  DEPARTED: { label: "Departed", variant: "default" },
};

export function PaymentStatusBadge({
  status,
  size = "sm",
}: PaymentStatusBadgeProps): React.ReactElement {
  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} size={size}>
      {config.label}
    </Badge>
  );
}

export type { PaymentStatusBadgeProps };
