"use client";

import { useState, useCallback } from "react";
import { format } from "date-fns";
import Link from "next/link";
import dynamic from "next/dynamic";
import { MetricCard } from "@/components/analytics/MetricCard";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { SlotData } from "@/components/analytics/AttendanceChart";

const AttendanceChart = dynamic(
  () => import("@/components/analytics/AttendanceChart").then((m) => ({ default: m.AttendanceChart })),
  {
    ssr: false,
    loading: () => <div className="h-64 animate-pulse rounded-xl bg-surface-800" />,
  }
);

const RevenueChart = dynamic(
  () => import("@/components/analytics/RevenueChart").then((m) => ({ default: m.RevenueChart })),
  {
    ssr: false,
    loading: () => <div className="h-64 animate-pulse rounded-xl bg-surface-800" />,
  }
);

const MemberAttendanceTable = dynamic(
  () => import("@/components/analytics/MemberAttendanceTable").then((m) => ({ default: m.MemberAttendanceTable })),
  {
    ssr: false,
    loading: () => <div className="h-64 animate-pulse rounded-xl bg-surface-800" />,
  }
);

const VoteVsActualCards = dynamic(
  () => import("@/components/analytics/VoteVsActualCards").then((m) => ({ default: m.VoteVsActualCards })),
  {
    ssr: false,
    loading: () => <div className="h-64 animate-pulse rounded-xl bg-surface-800" />,
  }
);

interface MemberRate {
  name: string;
  expected: number;
  attended: number;
  rate: number;
}

interface VoteVsActualData {
  totalVotedComing: number;
  totalActuallyAttended: number;
  reliability: number;
}

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
  initialMonth: number;  // 0-11
  initialYear: number;   // e.g. 2026
  initialMemberRates: MemberRate[];
  initialVoteVsActual: VoteVsActualData;
}

function formatCurrency(amount: number): string {
  return `${amount.toLocaleString()} MKD`;
}

export function DashboardClient(props: DashboardClientProps): React.ReactElement {
  const {
    totalActive: initialTotalActive,
    trialCount: initialTrialCount,
    totalRevenue: initialTotalRevenue,
    membershipRevenue: initialMembershipRevenue,
    privateRevenue: initialPrivateRevenue,
    outstandingCount: initialOutstandingCount,
    gracePeriodCount: initialGracePeriodCount,
    lockedCount: initialLockedCount,
    popularSlots: initialPopularSlots,
    initialMonth,
    initialYear,
    initialMemberRates,
    initialVoteVsActual,
  } = props;

  const { addToast } = useToast();
  const [viewMonth, setViewMonth] = useState(initialMonth);
  const [viewYear, setViewYear] = useState(initialYear);
  const [loading, setLoading] = useState(false);

  // Dashboard data state
  const [totalActive, setTotalActive] = useState(initialTotalActive);
  const [trialCount, setTrialCount] = useState(initialTrialCount);
  const [totalRevenue, setTotalRevenue] = useState(initialTotalRevenue);
  const [membershipRevenue, setMembershipRevenue] = useState(initialMembershipRevenue);
  const [privateRevenue, setPrivateRevenue] = useState(initialPrivateRevenue);
  const [outstandingCount, setOutstandingCount] = useState(initialOutstandingCount);
  const [gracePeriodCount, setGracePeriodCount] = useState(initialGracePeriodCount);
  const [lockedCount, setLockedCount] = useState(initialLockedCount);
  const [popularSlots, setPopularSlots] = useState(initialPopularSlots);

  // Attendance analytics state
  const [memberRates, setMemberRates] = useState<MemberRate[]>(initialMemberRates);
  const [voteVsActual, setVoteVsActual] = useState<VoteVsActualData>(initialVoteVsActual);

  const [currentMonth] = useState(() => new Date().getMonth());
  const [currentYear] = useState(() => new Date().getFullYear());
  const isCurrentMonth = viewMonth === currentMonth && viewYear === currentYear;

  const monthLabel = format(new Date(viewYear, viewMonth, 1), "MMMM yyyy");

  const fetchDashboard = useCallback(async (month: number, year: number): Promise<void> => {
    setLoading(true);
    try {
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
      const res = await fetch(`/api/analytics?startDate=${startDate}&endDate=${endDate}`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data;
        if (!data) {
          addToast({ type: "error", title: "Unexpected response format" });
          return;
        }
        setTotalActive(data.memberEngagement.totalActiveMembers);
        setTrialCount(0); // Analytics API doesn't return trial count; only relevant for current month
        setTotalRevenue(data.financial.totalRevenue);
        setMembershipRevenue(data.financial.membershipRevenue);
        setPrivateRevenue(data.financial.privateSessionRevenue);
        setOutstandingCount(data.financial.latePayers.length + data.financial.outstandingMembers.length);
        setGracePeriodCount(data.financial.latePayers.length);
        setLockedCount(data.financial.outstandingMembers.length);
        setPopularSlots(
          data.classPerformance.popularSlots.map((s: { day: string; hour: number; avgAttendance: number; avgFillRate: number; sessionCount: number }) => ({
            day: s.day,
            hour: s.hour,
            avgAttendance: s.avgAttendance,
            avgFillRate: s.avgFillRate,
            sessionCount: s.sessionCount,
          }))
        );
        if (data.attendance) {
          setMemberRates(data.attendance.memberRates || []);
          setVoteVsActual(data.attendance.voteVsActual || { totalVotedComing: 0, totalActuallyAttended: 0, reliability: 0 });
        }
      } else {
        addToast({ type: "error", title: "Failed to load dashboard data" });
      }
    } catch {
      addToast({ type: "error", title: "Failed to load dashboard data" });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  function handlePrevMonth(): void {
    let newMonth = viewMonth - 1;
    let newYear = viewYear;
    if (newMonth < 0) {
      newMonth = 11;
      newYear -= 1;
    }
    setViewMonth(newMonth);
    setViewYear(newYear);
    fetchDashboard(newMonth, newYear);
  }

  function handleNextMonth(): void {
    if (isCurrentMonth) return;
    let newMonth = viewMonth + 1;
    let newYear = viewYear;
    if (newMonth > 11) {
      newMonth = 0;
      newYear += 1;
    }
    setViewMonth(newMonth);
    setViewYear(newYear);
    fetchDashboard(newMonth, newYear);
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-100">Dashboard</h1>
          <div className="mt-1 flex items-center gap-1">
            <button
              onClick={handlePrevMonth}
              disabled={loading}
              className="rounded p-0.5 text-surface-400 transition-colors hover:text-surface-100 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Previous month"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            <span className="text-sm text-surface-400">{monthLabel} overview</span>
            <button
              onClick={handleNextMonth}
              disabled={isCurrentMonth || loading}
              className="rounded p-0.5 text-surface-400 transition-colors hover:text-surface-100 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Next month"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
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
      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 transition-opacity ${loading ? "opacity-50" : ""}`}>
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
          subtitle={`Membership: ${formatCurrency(membershipRevenue)} | Private: ${formatCurrency(privateRevenue)}`}
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
      <div className={`grid grid-cols-1 gap-6 lg:grid-cols-2 transition-opacity ${loading ? "opacity-50" : ""}`}>
        <AttendanceChart slots={popularSlots} />
        <RevenueChart
          membershipRevenue={membershipRevenue}
          privateSessionRevenue={privateRevenue}
          totalRevenue={totalRevenue}
        />
      </div>

      {/* Attendance Analytics */}
      <div className={`space-y-6 transition-opacity ${loading ? "opacity-50" : ""}`}>
        <h2 className="text-lg font-semibold text-surface-100">Attendance Tracking</h2>
        <VoteVsActualCards data={voteVsActual} />
        <MemberAttendanceTable members={memberRates} />
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
