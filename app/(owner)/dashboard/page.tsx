import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPaymentStatus } from "@/lib/payment-logic";
import type { PaymentRecord } from "@/lib/payment-logic";
import { startOfMonth, endOfMonth } from "date-fns";
import { DashboardClient } from "./DashboardClient";

export const metadata = {
  title: "Dashboard - Wonder Woman Fitness",
};

export default async function DashboardPage(): Promise<React.ReactElement> {
  const session = await auth();
  if (!session?.user || (session.user.role as string) !== "OWNER") {
    redirect("/login");
  }

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  // Fetch all data in parallel
  const [members, payments, sessionsThisMonth, privateSessions, attendanceRecords] =
    await Promise.all([
      prisma.user.findMany({
        where: { role: "MEMBER" },
        select: {
          id: true,
          name: true,
          status: true,
          joinDate: true,
          trialEndsAt: true,
          departedAt: true,
          overrideActive: true,
        },
      }),
      prisma.payment.findMany({
        where: {
          paidAt: { gte: monthStart, lte: monthEnd },
        },
        select: {
          id: true,
          userId: true,
          amount: true,
          paidAt: true,
          periodStart: true,
          periodEnd: true,
        },
      }),
      prisma.session.findMany({
        where: {
          weekDate: { gte: monthStart, lte: monthEnd },
        },
        include: {
          recurringSlot: true,
          members: { select: { userId: true } },
          votes: { select: { userId: true, attending: true } },
        },
      }),
      prisma.privateSession.findMany({
        where: {
          scheduledAt: { gte: monthStart, lte: monthEnd },
          paid: true,
        },
        select: { amount: true },
      }),
      prisma.attendanceRecord.findMany({
        where: {
          session: {
            weekDate: { gte: monthStart, lte: monthEnd },
          },
        },
        select: {
          sessionId: true,
          userId: true,
          present: true,
          session: {
            select: {
              weekDate: true,
              recurringSlotId: true,
              recurringSlot: { select: { dayOfWeek: true, startHour: true } },
              customDay: true,
              customStartHour: true,
              votes: { select: { userId: true, attending: true } },
            },
          },
        },
      }),
    ]);

  // Compute metrics
  const activeMembers = members.filter((m) => m.status !== "DEPARTED");
  const totalActive = activeMembers.length;
  const trialMembers = activeMembers.filter((m) => m.status === "TRIAL");

  // Revenue this month
  const membershipRevenue = payments.reduce(
    (sum, p) => sum + Number(p.amount),
    0
  );
  const privateRevenue = privateSessions.reduce(
    (sum, ps) => sum + (ps.amount ? Number(ps.amount) : 0),
    0
  );
  const totalRevenue = membershipRevenue + privateRevenue;

  // Payment status breakdown
  let outstandingCount = 0;
  let gracePeriodCount = 0;
  let lockedCount = 0;

  for (const member of activeMembers) {
    const memberPayments: PaymentRecord[] = payments
      .filter((p) => p.userId === member.id)
      .map((p) => ({
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        paidAt: p.paidAt,
      }));

    const status = getPaymentStatus(
      {
        id: member.id,
        status: member.status as "TRIAL" | "ACTIVE" | "DEPARTED",
        trialEndsAt: member.trialEndsAt,
        departedAt: member.departedAt,
        overrideActive: member.overrideActive,
      },
      memberPayments,
      now
    );

    if (status === "GRACE_PERIOD") gracePeriodCount++;
    if (status === "LOCKED") lockedCount++;
    if (status === "GRACE_PERIOD" || status === "LOCKED") outstandingCount++;
  }

  // Day name mapping
  const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  // Slot performance for attendance chart
  const slotPerformance = new Map<
    string,
    { total: number; totalAttending: number; count: number }
  >();

  const scheduledSessions = sessionsThisMonth.filter(
    (s) => s.status === "SCHEDULED"
  );

  for (const s of scheduledSessions) {
    const day = s.recurringSlot?.dayOfWeek ?? s.customDay ?? 0;
    const hour = s.recurringSlot?.startHour ?? s.customStartHour ?? 0;
    const key = `${day}-${hour}`;
    const existing = slotPerformance.get(key) || {
      total: 0,
      totalAttending: 0,
      count: 0,
    };
    const attendingCount = s.votes.filter((v) => v.attending).length;
    existing.total += s.members.length;
    existing.totalAttending += attendingCount;
    existing.count += 1;
    slotPerformance.set(key, existing);
  }

  const popularSlots = Array.from(slotPerformance.entries())
    .map(([key, data]) => {
      const [dayStr, hourStr] = key.split("-");
      return {
        day: DAY_NAMES[parseInt(dayStr)] || "Unknown",
        hour: parseInt(hourStr),
        avgAttendance:
          data.count > 0 ? data.totalAttending / data.count : 0,
        avgFillRate:
          data.total > 0 ? data.totalAttending / data.total : 0,
        sessionCount: data.count,
      };
    })
    .sort((a, b) => b.avgAttendance - a.avgAttendance)
    .slice(0, 10);

  // ===== ATTENDANCE ANALYTICS =====

  // a) Per-member attendance rates
  const memberAttendanceMap = new Map<string, { expected: number; attended: number }>();
  for (const rec of attendanceRecords) {
    const existing = memberAttendanceMap.get(rec.userId) || { expected: 0, attended: 0 };
    existing.expected += 1;
    if (rec.present) existing.attended += 1;
    memberAttendanceMap.set(rec.userId, existing);
  }

  const memberRates = Array.from(memberAttendanceMap.entries())
    .map(([userId, data]) => {
      const member = members.find((m) => m.id === userId);
      return {
        name: member?.name || "Unknown",
        expected: data.expected,
        attended: data.attended,
        rate: Math.round((data.attended / data.expected) * 100),
      };
    })
    .sort((a, b) => a.rate - b.rate);

  // b) Per-slot attendance rates
  const slotAttendanceMap = new Map<string, { totalPresent: number; totalRecords: number; sessionIds: Set<string> }>();
  for (const rec of attendanceRecords) {
    const day = rec.session.recurringSlot?.dayOfWeek ?? rec.session.customDay ?? 0;
    const hour = rec.session.recurringSlot?.startHour ?? rec.session.customStartHour ?? 0;
    const key = `${day}-${hour}`;
    const existing = slotAttendanceMap.get(key) || { totalPresent: 0, totalRecords: 0, sessionIds: new Set<string>() };
    if (rec.present) existing.totalPresent += 1;
    existing.totalRecords += 1;
    existing.sessionIds.add(rec.sessionId);
    slotAttendanceMap.set(key, existing);
  }

  const slotRates = Array.from(slotAttendanceMap.entries())
    .map(([key, data]) => {
      const [dayStr, hourStr] = key.split("-");
      const sessionCount = data.sessionIds.size;
      const avgPresent = sessionCount > 0 ? data.totalPresent / sessionCount : 0;
      const avgExpected = sessionCount > 0 ? data.totalRecords / sessionCount : 0;
      const showUpRate = data.totalRecords > 0
        ? Math.round((data.totalPresent / data.totalRecords) * 100)
        : 0;
      return {
        day: DAY_NAMES[parseInt(dayStr)] || "Unknown",
        hour: parseInt(hourStr),
        avgPresent,
        avgExpected,
        showUpRate,
        sessionCount,
      };
    })
    .sort((a, b) => a.showUpRate - b.showUpRate);

  // c) Vote vs. Actual
  const attendanceBySession = new Map<string, { votedComing: number; actuallyAttended: number }>();
  for (const rec of attendanceRecords) {
    if (!attendanceBySession.has(rec.sessionId)) {
      const votedComing = rec.session.votes.filter((v) => v.attending).length;
      attendanceBySession.set(rec.sessionId, { votedComing, actuallyAttended: 0 });
    }
    const sessionData = attendanceBySession.get(rec.sessionId)!;
    if (rec.present) sessionData.actuallyAttended += 1;
  }

  let totalVotedComing = 0;
  let totalActuallyAttended = 0;
  for (const data of attendanceBySession.values()) {
    totalVotedComing += data.votedComing;
    totalActuallyAttended += data.actuallyAttended;
  }

  const reliability = totalVotedComing > 0
    ? Math.round((totalActuallyAttended / totalVotedComing) * 100)
    : 0;

  // d) Attendance trend (weekly)
  const weeklyAttendanceMap = new Map<string, { present: number; total: number }>();
  for (const rec of attendanceRecords) {
    const weekDate = rec.session.weekDate instanceof Date
      ? rec.session.weekDate.toISOString().split("T")[0]
      : new Date(rec.session.weekDate).toISOString().split("T")[0];
    const existing = weeklyAttendanceMap.get(weekDate) || { present: 0, total: 0 };
    existing.total += 1;
    if (rec.present) existing.present += 1;
    weeklyAttendanceMap.set(weekDate, existing);
  }

  const attendanceTrend = Array.from(weeklyAttendanceMap.entries())
    .map(([week, data]) => ({
      week,
      rate: Math.round((data.present / data.total) * 100),
      present: data.present,
      total: data.total,
    }))
    .sort((a, b) => a.week.localeCompare(b.week));

  return (
    <DashboardClient
      totalActive={totalActive}
      trialCount={trialMembers.length}
      totalRevenue={totalRevenue}
      membershipRevenue={membershipRevenue}
      privateRevenue={privateRevenue}
      outstandingCount={outstandingCount}
      gracePeriodCount={gracePeriodCount}
      lockedCount={lockedCount}
      popularSlots={popularSlots}
      initialMonth={now.getMonth()}
      initialYear={now.getFullYear()}
      initialMemberRates={memberRates}
      initialSlotRates={slotRates}
      initialVoteVsActual={{
        totalVotedComing,
        totalActuallyAttended,
        reliability,
      }}
      initialAttendanceTrend={attendanceTrend}
    />
  );
}
