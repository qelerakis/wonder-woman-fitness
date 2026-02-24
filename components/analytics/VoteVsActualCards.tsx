"use client";

import { MetricCard } from "@/components/analytics/MetricCard";

interface VoteVsActualCardsProps {
  data: {
    totalVotedComing: number;
    totalActuallyAttended: number;
    reliability: number;
  };
}

export function VoteVsActualCards({
  data,
}: VoteVsActualCardsProps): React.ReactElement {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <MetricCard title="Voted Coming" value={data.totalVotedComing} />
      <MetricCard
        title="Actually Attended"
        value={data.totalActuallyAttended}
      />
      <MetricCard title="Vote Reliability" value={`${data.reliability}%`} />
    </div>
  );
}

export type { VoteVsActualCardsProps };
