"use client";

import { useTranslations } from "next-intl";
import { Card, CardHeader } from "@/components/ui/Card";

interface MemberAttendanceTableProps {
  members: Array<{
    name: string;
    expected: number;
    attended: number;
    rate: number;
  }>;
}

function getRateColor(rate: number): string {
  if (rate >= 80) return "text-success-500";
  if (rate >= 50) return "text-warning-500";
  return "text-error-500";
}

export function MemberAttendanceTable({
  members,
}: MemberAttendanceTableProps): React.ReactElement {
  const t = useTranslations("analytics");

  if (members.length === 0) {
    return (
      <Card>
        <CardHeader
          title={t("memberAttendanceRates")}
          description={t("showUpRatePerMember")}
        />
        <div className="mt-4 flex h-48 items-center justify-center">
          <p className="text-sm text-surface-500">
            {t("noAttendanceData")}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title={t("memberAttendanceRates")}
        description={t("showUpRatePerMember")}
      />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-700">
              <th className="pb-2 text-left font-medium text-surface-500">
                {t("member")}
              </th>
              <th className="pb-2 text-right font-medium text-surface-500">
                {t("expected")}
              </th>
              <th className="pb-2 text-right font-medium text-surface-500">
                {t("attended")}
              </th>
              <th className="pb-2 text-right font-medium text-surface-500">
                {t("rate")}
              </th>
            </tr>
          </thead>
          <tbody>
            {members.map((member, index) => (
              <tr
                key={`${member.name}-${index}`}
                className="border-b border-surface-700 last:border-b-0"
              >
                <td className="py-2 text-surface-300">{member.name}</td>
                <td className="py-2 text-right text-surface-300">
                  {member.expected}
                </td>
                <td className="py-2 text-right text-surface-300">
                  {member.attended}
                </td>
                <td
                  className={`py-2 text-right font-medium ${getRateColor(member.rate)}`}
                >
                  {member.rate}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export type { MemberAttendanceTableProps };
