/**
 * Analytics API — GET metrics
 *
 * GET /api/analytics?startDate=X&endDate=Y
 * Owner only. Returns member engagement, class performance, financial, and retention metrics.
 *
 * Supports CSV export via Accept header: Accept: text/csv
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPaymentStatus } from "@/lib/payment-logic";
import type { PaymentRecord } from "@/lib/payment-logic";
import { authReadLimiter, createRateLimitResponse } from "@/lib/rate-limit";
import { AnalyticsQuerySchema } from "@/types";

export async function GET(req: Request): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if ((session.user.role as string) !== "OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Rate limit: 60 read requests per minute per user
    const readRateCheck = authReadLimiter.check(`read:${session.user.id}`);
    if (!readRateCheck.allowed) return createRateLimitResponse(readRateCheck.retryAfterMs);

    const url = new URL(req.url);
    const queryParams: Record<string, string> = {};
    for (const [key, value] of url.searchParams.entries()) {
      queryParams[key] = value;
    }
    const parsedQuery = AnalyticsQuerySchema.safeParse(queryParams);
    if (!parsedQuery.success) {
      return Response.json({ error: parsedQuery.error.flatten() }, { status: 400 });
    }

    const { startDate, endDate } = parsedQuery.data;
    const start = new Date(startDate);
    const end = new Date(endDate);

    const acceptHeader = req.headers.get("Accept") || "";
    const wantsCsv = acceptHeader.includes("text/csv");

    // Fetch all data in parallel
    const [members, sessions, payments, privateSessions, attendanceRecords] = await Promise.all([
      // All members (including departed for retention analysis)
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
      // Sessions in date range with votes
      prisma.session.findMany({
        where: {
          weekDate: { gte: start, lte: end },
        },
        include: {
          recurringSlot: true,
          members: { select: { userId: true } },
          votes: { select: { userId: true, attending: true } },
        },
      }),
      // Payments in date range
      prisma.payment.findMany({
        where: {
          paidAt: { gte: start, lte: end },
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
      // Private sessions in date range
      prisma.privateSession.findMany({
        where: {
          scheduledAt: { gte: start, lte: end },
        },
        select: {
          id: true,
          amount: true,
          paid: true,
        },
      }),
      // Attendance records in date range
      prisma.attendanceRecord.findMany({
        where: {
          session: {
            weekDate: { gte: start, lte: end },
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
              members: { select: { userId: true } },
            },
          },
        },
      }),
    ]);

    // ===== MEMBER ENGAGEMENT =====
    const activeMembers = members.filter((m) => m.status !== "DEPARTED");
    const totalMembers = activeMembers.length;

    // Attendance by member (sessions where they voted "attending")
    const memberAttendance = new Map<string, number>();
    for (const s of sessions) {
      for (const vote of s.votes) {
        if (vote.attending) {
          memberAttendance.set(
            vote.userId,
            (memberAttendance.get(vote.userId) || 0) + 1
          );
        }
      }
    }

    const attendanceSorted = Array.from(memberAttendance.entries())
      .sort((a, b) => b[1] - a[1]);

    const mostConsistent = attendanceSorted.slice(0, 5).map(([userId, count]) => {
      const member = members.find((m) => m.id === userId);
      return { name: member?.name || "Unknown", attendanceCount: count };
    });

    const leastConsistent = attendanceSorted.slice(-5).reverse().map(([userId, count]) => {
      const member = members.find((m) => m.id === userId);
      return { name: member?.name || "Unknown", attendanceCount: count };
    });

    // ===== CLASS PERFORMANCE =====
    const scheduledSessions = sessions.filter((s) => s.status === "SCHEDULED");
    const cancelledSessions = sessions.filter((s) => s.status === "CANCELLED");

    const totalSessions = sessions.length;
    const cancellationRate = totalSessions > 0
      ? cancelledSessions.length / totalSessions
      : 0;

    // Fill rate per slot
    const slotPerformance = new Map<string, { total: number; totalAttending: number; count: number }>();
    for (const s of scheduledSessions) {
      const day = s.recurringSlot?.dayOfWeek ?? s.customDay ?? 0;
      const hour = s.recurringSlot?.startHour ?? s.customStartHour ?? 0;
      const key = `${day}-${hour}`;
      const existing = slotPerformance.get(key) || { total: 0, totalAttending: 0, count: 0 };
      const attendingCount = s.votes.filter((v) => v.attending).length;
      existing.total += s.members.length;
      existing.totalAttending += attendingCount;
      existing.count += 1;
      slotPerformance.set(key, existing);
    }

    const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

    const popularSlots = Array.from(slotPerformance.entries())
      .map(([key, data]) => {
        const [dayStr, hourStr] = key.split("-");
        return {
          day: DAY_NAMES[parseInt(dayStr)] || "Unknown",
          hour: parseInt(hourStr),
          avgAttendance: data.count > 0 ? data.totalAttending / data.count : 0,
          avgFillRate: data.total > 0 ? data.totalAttending / data.total : 0,
          sessionCount: data.count,
        };
      })
      .sort((a, b) => b.avgAttendance - a.avgAttendance);

    // ===== FINANCIAL =====
    const totalPaymentRevenue = payments.reduce(
      (sum, p) => sum + Number(p.amount),
      0
    );

    const privateSessionRevenue = privateSessions
      .filter((ps) => ps.paid && ps.amount)
      .reduce((sum, ps) => sum + Number(ps.amount), 0);

    const totalRevenue = totalPaymentRevenue + privateSessionRevenue;

    // Late payers (members currently in GRACE_PERIOD or LOCKED)
    const today = new Date();
    const latePayers: Array<{ name: string; paymentStatus: string }> = [];
    const outstandingMembers: Array<{ name: string; paymentStatus: string }> = [];

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
        today
      );

      if (status === "GRACE_PERIOD") {
        latePayers.push({ name: member.name, paymentStatus: status });
      }
      if (status === "LOCKED") {
        outstandingMembers.push({ name: member.name, paymentStatus: status });
      }
    }

    // ===== RETENTION =====
    const departedMembers = members.filter((m) => m.status === "DEPARTED");
    const departedInRange = departedMembers.filter(
      (m) => m.departedAt && m.departedAt >= start && m.departedAt <= end
    );

    const retentionRate = totalMembers + departedInRange.length > 0
      ? totalMembers / (totalMembers + departedInRange.length)
      : 1;

    const churnRate = 1 - retentionRate;

    // Average member lifespan (in days)
    const lifespans = departedMembers
      .filter((m) => m.departedAt)
      .map((m) => {
        const join = new Date(m.joinDate);
        const depart = new Date(m.departedAt!);
        return (depart.getTime() - join.getTime()) / (1000 * 60 * 60 * 24);
      });

    const avgLifespanDays = lifespans.length > 0
      ? lifespans.reduce((a, b) => a + b, 0) / lifespans.length
      : 0;

    // ===== ATTENDANCE =====

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
        const votedComing = rec.session.votes.filter((v: { attending: boolean }) => v.attending).length;
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

    const voteVsActual = {
      totalVotedComing,
      totalActuallyAttended,
      reliability,
    };

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

    const trend = Array.from(weeklyAttendanceMap.entries())
      .map(([week, data]) => ({
        week,
        rate: Math.round((data.present / data.total) * 100),
        present: data.present,
        total: data.total,
      }))
      .sort((a, b) => a.week.localeCompare(b.week));

    const analytics = {
      dateRange: { startDate, endDate },
      memberEngagement: {
        totalActiveMembers: totalMembers,
        mostConsistent,
        leastConsistent,
      },
      classPerformance: {
        totalSessions,
        scheduledSessions: scheduledSessions.length,
        cancelledSessions: cancelledSessions.length,
        cancellationRate: Math.round(cancellationRate * 100) / 100,
        popularSlots: popularSlots.slice(0, 10),
      },
      financial: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        membershipRevenue: Math.round(totalPaymentRevenue * 100) / 100,
        privateSessionRevenue: Math.round(privateSessionRevenue * 100) / 100,
        latePayers,
        outstandingMembers,
      },
      retention: {
        retentionRate: Math.round(retentionRate * 100) / 100,
        churnRate: Math.round(churnRate * 100) / 100,
        departedInPeriod: departedInRange.length,
        avgLifespanDays: Math.round(avgLifespanDays),
      },
      attendance: {
        memberRates,
        slotRates,
        voteVsActual,
        trend,
      },
    };

    // CSV export
    if (wantsCsv) {
      const csvRows: string[] = [];
      csvRows.push("Metric,Value");
      csvRows.push(`Total Active Members,${totalMembers}`);
      csvRows.push(`Total Sessions,${totalSessions}`);
      csvRows.push(`Cancelled Sessions,${cancelledSessions.length}`);
      csvRows.push(`Cancellation Rate,${Math.round(cancellationRate * 100)}%`);
      csvRows.push(`Total Revenue,${totalRevenue.toFixed(2)}`);
      csvRows.push(`Membership Revenue,${totalPaymentRevenue.toFixed(2)}`);
      csvRows.push(`Private Session Revenue,${privateSessionRevenue.toFixed(2)}`);
      csvRows.push(`Late Payers,${latePayers.length}`);
      csvRows.push(`Outstanding (Locked),${outstandingMembers.length}`);
      csvRows.push(`Retention Rate,${Math.round(retentionRate * 100)}%`);
      csvRows.push(`Churn Rate,${Math.round(churnRate * 100)}%`);
      csvRows.push(`Avg Member Lifespan (days),${Math.round(avgLifespanDays)}`);
      csvRows.push(`Attendance - Sessions Tracked,${attendanceBySession.size}`);
      csvRows.push(`Attendance - Avg Show-up Rate,${trend.length > 0 ? Math.round(trend.reduce((s, t) => s + t.rate, 0) / trend.length) : 0}%`);
      csvRows.push(`Vote Reliability,${voteVsActual.reliability}%`);

      const csvContent = csvRows.join("\n");
      return new Response(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="analytics-${startDate}-${endDate}.csv"`,
        },
      });
    }

    return Response.json({ data: analytics });
  } catch (error) {
    console.error("GET /api/analytics error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
