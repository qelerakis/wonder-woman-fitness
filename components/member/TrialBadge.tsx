"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/Badge";
import { differenceInDays } from "date-fns";

interface TrialBadgeProps {
  trialEndsAt: Date | string;
}

export function TrialBadge({
  trialEndsAt,
}: TrialBadgeProps): React.ReactElement {
  // Use state + effect for today's date to avoid hydration mismatch
  // (new Date() differs between server render and client hydrate)
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  useEffect(() => {
    const endDate = new Date(trialEndsAt);
    setDaysLeft(differenceInDays(endDate, new Date()));
  }, [trialEndsAt]);

  // Show neutral badge on initial server render (before hydration)
  if (daysLeft === null) {
    return (
      <Badge variant="info" size="sm">
        Trial
      </Badge>
    );
  }

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
