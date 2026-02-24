/**
 * Shared attendance analytics computation.
 *
 * Used by both the dashboard server page (initial load) and the
 * analytics API route (month navigation). Keeps the two in sync and
 * avoids duplicating the logic.
 */

// ─── Types ──────────────────────────────────────────────────────────

/** Minimal attendance record shape required by the computation functions. */
export interface AttendanceRecordInput {
  sessionId: string;
  userId: string;
  present: boolean;
  session: {
    weekDate: Date | string;
    recurringSlotId: string | null;
    recurringSlot: { dayOfWeek: number; startHour: number } | null;
    customDay: number | null;
    customStartHour: number | null;
    votes: Array<{ userId: string; attending: boolean }>;
  };
}

/** Minimal member shape required for name lookups. */
export interface MemberInput {
  id: string;
  name: string;
}

export interface MemberRate {
  name: string;
  expected: number;
  attended: number;
  rate: number;
}

export interface SlotRate {
  day: string;
  hour: number;
  avgPresent: number;
  avgExpected: number;
  showUpRate: number;
  sessionCount: number;
}

export interface VoteVsActualData {
  totalVotedComing: number;
  totalActuallyAttended: number;
  reliability: number;
}

export interface TrendEntry {
  week: string;
  rate: number;
  present: number;
  total: number;
}

export interface AttendanceAnalyticsResult {
  memberRates: MemberRate[];
  slotRates: SlotRate[];
  voteVsActual: VoteVsActualData;
  trend: TrendEntry[];
}

// ─── Constants ──────────────────────────────────────────────────────

const DAY_NAMES = [
  "",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

// ─── Computation ────────────────────────────────────────────────────

/**
 * Compute all attendance analytics from raw attendance records.
 *
 * Returns per-member rates, per-slot rates, vote-vs-actual reliability,
 * and a weekly attendance trend.
 */
export function computeAttendanceAnalytics(
  attendanceRecords: AttendanceRecordInput[],
  members: MemberInput[]
): AttendanceAnalyticsResult {
  // a) Per-member attendance rates
  const memberAttendanceMap = new Map<
    string,
    { expected: number; attended: number }
  >();
  for (const rec of attendanceRecords) {
    const existing = memberAttendanceMap.get(rec.userId) || {
      expected: 0,
      attended: 0,
    };
    existing.expected += 1;
    if (rec.present) existing.attended += 1;
    memberAttendanceMap.set(rec.userId, existing);
  }

  const memberRates: MemberRate[] = Array.from(
    memberAttendanceMap.entries()
  )
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
  const slotAttendanceMap = new Map<
    string,
    { totalPresent: number; totalRecords: number; sessionIds: Set<string> }
  >();
  for (const rec of attendanceRecords) {
    const day =
      rec.session.recurringSlot?.dayOfWeek ?? rec.session.customDay ?? 0;
    const hour =
      rec.session.recurringSlot?.startHour ?? rec.session.customStartHour ?? 0;
    const key = `${day}-${hour}`;
    const existing = slotAttendanceMap.get(key) || {
      totalPresent: 0,
      totalRecords: 0,
      sessionIds: new Set<string>(),
    };
    if (rec.present) existing.totalPresent += 1;
    existing.totalRecords += 1;
    existing.sessionIds.add(rec.sessionId);
    slotAttendanceMap.set(key, existing);
  }

  const slotRates: SlotRate[] = Array.from(slotAttendanceMap.entries())
    .map(([key, data]) => {
      const [dayStr, hourStr] = key.split("-");
      const sessionCount = data.sessionIds.size;
      const avgPresent =
        sessionCount > 0 ? data.totalPresent / sessionCount : 0;
      const avgExpected =
        sessionCount > 0 ? data.totalRecords / sessionCount : 0;
      const showUpRate =
        data.totalRecords > 0
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
  const attendanceBySession = new Map<
    string,
    { votedComing: number; actuallyAttended: number }
  >();
  for (const rec of attendanceRecords) {
    if (!attendanceBySession.has(rec.sessionId)) {
      const votedComing = rec.session.votes.filter(
        (v) => v.attending
      ).length;
      attendanceBySession.set(rec.sessionId, {
        votedComing,
        actuallyAttended: 0,
      });
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

  const reliability =
    totalVotedComing > 0
      ? Math.round((totalActuallyAttended / totalVotedComing) * 100)
      : 0;

  const voteVsActual: VoteVsActualData = {
    totalVotedComing,
    totalActuallyAttended,
    reliability,
  };

  // d) Attendance trend (weekly)
  const weeklyAttendanceMap = new Map<
    string,
    { present: number; total: number }
  >();
  for (const rec of attendanceRecords) {
    const weekDate =
      rec.session.weekDate instanceof Date
        ? rec.session.weekDate.toISOString().split("T")[0]
        : new Date(rec.session.weekDate).toISOString().split("T")[0];
    const existing = weeklyAttendanceMap.get(weekDate) || {
      present: 0,
      total: 0,
    };
    existing.total += 1;
    if (rec.present) existing.present += 1;
    weeklyAttendanceMap.set(weekDate, existing);
  }

  const trend: TrendEntry[] = Array.from(weeklyAttendanceMap.entries())
    .map(([week, data]) => ({
      week,
      rate: Math.round((data.present / data.total) * 100),
      present: data.present,
      total: data.total,
    }))
    .sort((a, b) => a.week.localeCompare(b.week));

  return { memberRates, slotRates, voteVsActual, trend };
}
