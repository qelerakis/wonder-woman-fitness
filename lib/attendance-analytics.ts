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
}

/** Minimal member shape required for name lookups. */
export interface MemberInput {
  id: string;
  name: string;
}

/** Minimal session-vote shape: one entry per session with its votes. */
export interface SessionVoteInput {
  sessionId: string;
  votes: Array<{ userId: string; attending: boolean }>;
}

export interface MemberRate {
  name: string;
  /** Number of unique sessions where the member has an attendance record OR voted yes. */
  expected: number;
  attended: number;
  /** Rounded integer percentage (0–100). */
  rate: number;
}

export interface VoteVsActualData {
  /** Count of votes with attending=true across all voting sessions. */
  totalVotedComing: number;
  /**
   * Count of all present attendance records in voting sessions.
   * Includes non-voters who were present, so this can exceed totalVotedComing.
   */
  totalActuallyAttended: number;
  /** Rounded integer percentage. Can exceed 100 if walk-ins attended. */
  reliability: number;
}

export interface AttendanceAnalyticsResult {
  memberRates: MemberRate[];
  voteVsActual: VoteVsActualData;
}

// ─── Computation ────────────────────────────────────────────────────

/**
 * Compute all attendance analytics from raw attendance records and
 * session votes.
 *
 * Returns per-member rates and vote-vs-actual reliability.
 */
export function computeAttendanceAnalytics(
  attendanceRecords: AttendanceRecordInput[],
  members: MemberInput[],
  sessionVotes: SessionVoteInput[]
): AttendanceAnalyticsResult {
  // Build O(1) member name lookup
  const memberNameMap = new Map<string, string>();
  for (const m of members) {
    memberNameMap.set(m.id, m.name);
  }

  // a) Per-member attendance rates
  const memberSessionsMap = new Map<string, Set<string>>();
  const memberAttendedMap = new Map<string, number>();

  for (const rec of attendanceRecords) {
    if (!memberSessionsMap.has(rec.userId)) {
      memberSessionsMap.set(rec.userId, new Set());
      memberAttendedMap.set(rec.userId, 0);
    }
    memberSessionsMap.get(rec.userId)!.add(rec.sessionId);
    if (rec.present) {
      memberAttendedMap.set(rec.userId, memberAttendedMap.get(rec.userId)! + 1);
    }
  }

  for (const sv of sessionVotes) {
    for (const vote of sv.votes) {
      if (vote.attending) {
        if (!memberSessionsMap.has(vote.userId)) {
          memberSessionsMap.set(vote.userId, new Set());
          memberAttendedMap.set(vote.userId, 0);
        }
        memberSessionsMap.get(vote.userId)!.add(sv.sessionId);
      }
    }
  }

  const memberRates: MemberRate[] = Array.from(memberSessionsMap.entries())
    .map(([userId, sessionIds]) => {
      const expected = sessionIds.size;
      const attended = memberAttendedMap.get(userId) || 0;
      return {
        name: memberNameMap.get(userId) || "Unknown",
        expected,
        attended,
        rate: expected > 0 ? Math.round((attended / expected) * 100) : 0,
      };
    })
    .sort((a, b) => a.rate - b.rate);

  // b) Vote vs. Actual
  const votingSessionIds = new Set<string>();
  let totalVotedComing = 0;
  for (const sv of sessionVotes) {
    if (sv.votes.length > 0) {
      votingSessionIds.add(sv.sessionId);
      totalVotedComing += sv.votes.filter((v) => v.attending).length;
    }
  }

  let totalActuallyAttended = 0;

  for (const rec of attendanceRecords) {
    if (votingSessionIds.has(rec.sessionId) && rec.present) {
      totalActuallyAttended += 1;
    }
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

  return { memberRates, voteVsActual };
}
