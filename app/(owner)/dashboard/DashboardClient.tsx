"use client";

import Link from "next/link";
import { MetricCard } from "@/components/analytics/MetricCard";
import { AttendanceChart } from "@/components/analytics/AttendanceChart";
import { RevenueChart } from "@/components/analytics/RevenueChart";
import { Button } from "@/components/ui/Button";
import type { SlotData } from "@/components/analytics/AttendanceChart";

interface DashboardClientProps {
  totalActive: number;
  trialCount: number;
  totalRevenue: number;
  membershipRevenue: number;
  privateRevenue: number;
  outstandingCount: number;
  gracePeriodCount: number;
  lockedCount: number;
  popularSlots: SlotData[];
  monthLabel: string;
}

function formatCurrency(amount: number): string {
  return `${amount.toLocaleString()} MKD`;
}

export function DashboardClient({
  totalActive,
  trialCount,
  totalRevenue,
  membershipRevenue,
  privateRevenue,
  outstandingCount,
  gracePeriodCount,
  lockedCount,
  popularSlots,
  monthLabel,
}: DashboardClientProps): React.ReactElement {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-100">Dashboard</h1>
          <p className="mt-1 text-sm text-surface-400">{monthLabel} overview</p>
        </div>
        <div className="flex gap-2">
          <Link href="/owner/schedule">
            <Button variant="secondary" size="sm">
              Schedule
            </Button>
          </Link>
          <Link href="/members">
            <Button variant="primary" size="sm">
              Members
            </Button>
          </Link>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Active Members"
          value={totalActive}
          subtitle={trialCount > 0 ? `${trialCount} on trial` : undefined}
          icon={
            <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
            </svg>
          }
        />
        <MetricCard
          title="Revenue"
          value={formatCurrency(totalRevenue)}
          subtitle={`Membership: ${formatCurrency(membershipRevenue)}`}
          icon={
            <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
          }
        />
        <MetricCard
          title="Outstanding"
          value={outstandingCount}
          subtitle={
            outstandingCount > 0
              ? `${gracePeriodCount} grace, ${lockedCount} locked`
              : "All members current"
          }
          icon={
            <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          }
        />
        <MetricCard
          title="Trials"
          value={trialCount}
          subtitle={trialCount > 0 ? "Active trials" : "No active trials"}
          icon={
            <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
          }
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AttendanceChart slots={popularSlots} />
        <RevenueChart
          membershipRevenue={membershipRevenue}
          privateSessionRevenue={privateRevenue}
          totalRevenue={totalRevenue}
        />
      </div>

      {/* Quick actions */}
      <div className="rounded-xl border border-surface-700 bg-surface-800 p-6">
        <h2 className="mb-4 text-lg font-semibold text-surface-100">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Link href="/owner/schedule">
            <div className="flex flex-col items-center gap-2 rounded-lg border border-surface-600 p-4 text-center hover:border-primary-600/50 hover:bg-surface-700 transition-colors">
              <svg className="h-6 w-6 text-primary-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
              <span className="text-xs font-medium text-surface-300">Manage Schedule</span>
            </div>
          </Link>
          <Link href="/payments">
            <div className="flex flex-col items-center gap-2 rounded-lg border border-surface-600 p-4 text-center hover:border-primary-600/50 hover:bg-surface-700 transition-colors">
              <svg className="h-6 w-6 text-primary-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              <span className="text-xs font-medium text-surface-300">Record Payment</span>
            </div>
          </Link>
          <Link href="/private-sessions">
            <div className="flex flex-col items-center gap-2 rounded-lg border border-surface-600 p-4 text-center hover:border-primary-600/50 hover:bg-surface-700 transition-colors">
              <svg className="h-6 w-6 text-primary-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
              <span className="text-xs font-medium text-surface-300">Private Sessions</span>
            </div>
          </Link>
          <Link href="/trainers">
            <div className="flex flex-col items-center gap-2 rounded-lg border border-surface-600 p-4 text-center hover:border-primary-600/50 hover:bg-surface-700 transition-colors">
              <svg className="h-6 w-6 text-primary-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              <span className="text-xs font-medium text-surface-300">Manage Trainers</span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
