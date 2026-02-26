"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import type { PaymentStatus } from "@/lib/constants";
import type { BadgeVariant } from "@/components/ui/Badge";

interface PaymentStatusBadgeProps {
  status: PaymentStatus;
  size?: "sm" | "md";
}

const statusVariant: Record<PaymentStatus, BadgeVariant> = {
  PAID: "success",
  GRACE_PERIOD: "warning",
  LOCKED: "error",
  OVERRIDE: "primary",
  DEPARTED: "default",
};

const statusKey: Record<PaymentStatus, string> = {
  PAID: "paid",
  GRACE_PERIOD: "gracePeriod",
  LOCKED: "locked",
  OVERRIDE: "override",
  DEPARTED: "departed",
};

export function PaymentStatusBadge({
  status,
  size = "sm",
}: PaymentStatusBadgeProps): React.ReactElement {
  const t = useTranslations("paymentStatus");

  return (
    <Badge variant={statusVariant[status]} size={size}>
      {t(statusKey[status])}
    </Badge>
  );
}

export type { PaymentStatusBadgeProps };
