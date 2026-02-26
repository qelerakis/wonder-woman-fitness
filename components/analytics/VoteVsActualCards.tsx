"use client";

import { useTranslations } from "next-intl";
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
  const t = useTranslations("analytics");

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <MetricCard title={t("votedComing")} value={data.totalVotedComing} />
      <MetricCard
        title={t("actuallyAttended")}
        value={data.totalActuallyAttended}
      />
      <MetricCard title={t("voteReliability")} value={`${data.reliability}%`} />
    </div>
  );
}

export type { VoteVsActualCardsProps };
