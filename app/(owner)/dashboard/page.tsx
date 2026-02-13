import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPaymentStatus } from "@/lib/payment-logic";
import type { PaymentRecord } from "@/lib/payment-logic";
import { startOfMonth, endOfMonth, format } from "date-fns";
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
  const [members, payments, sessionsThisMonth, privateSessions] =
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
    (sum, ps) => sum + Number(ps.amount || 0),
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

  // Slot performance for attendance chart
  const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const slotPerformance = new Map<
    string,
    { total: number; totalAttending: number; count: number }
  >();

  const scheduledSessions = sessionsThisMonth.filter(
    (s) => s.status === "SCHEDULED"
  );

  for (const s of scheduledSessions) {
    const key = `${s.recurringSlot.dayOfWeek}-${s.recurringSlot.startHour}`;
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
      monthLabel={format(now, "MMMM yyyy")}
    />
  );
}
