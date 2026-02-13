import { Badge } from "@/components/ui/Badge";
import { differenceInDays } from "date-fns";

interface TrialBadgeProps {
  trialEndsAt: Date | string;
}

export function TrialBadge({
  trialEndsAt,
}: TrialBadgeProps): React.ReactElement {
  const endDate = new Date(trialEndsAt);
  const daysLeft = differenceInDays(endDate, new Date());

  if (daysLeft <= 0) {
    return (
      <Badge variant="error" size="sm">
        Trial expired
      </Badge>
    );
  }

  if (daysLeft <= 3) {
    return (
      <Badge variant="warning" size="sm">
        Trial: {daysLeft}d left
      </Badge>
    );
  }

  return (
    <Badge variant="info" size="sm">
      Trial: {daysLeft}d left
    </Badge>
  );
}

export type { TrialBadgeProps };
