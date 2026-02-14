/**
 * Voting Logic Tests
 *
 * Tests voting deadline calculations, lock checks, vote summaries,
 * and low attendance detection.
 */

import { describe, it, expect } from "vitest";
import {
  getVotingDeadline,
  isVotingLocked,
  getTimeUntilDeadline,
  getVoteSummary,
  hasLowAttendance,
  isSessionFull,
} from "../voting-logic";

// ===== Test Helpers =====

/**
 * Create a UTC Monday at midnight for a given date string.
 * weekDate is always a Monday in the codebase.
 */
function monday(dateStr: string): Date {
  const d = new Date(dateStr);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

// ===== getVotingDeadline (overload 2: individual params) =====

describe("getVotingDeadline", () => {
  it("returns 24 hours before session time for Monday 9AM", () => {
    // Monday March 10, 2025 at 9AM UTC
    const weekDate = monday("2025-03-10");
    const deadline = getVotingDeadline(weekDate, 1, 9);

    // Should be Sunday March 9 at 9AM UTC
    expect(deadline.toISOString()).toBe("2025-03-09T09:00:00.000Z");
  });

  it("returns 24 hours before session time for Wednesday 6PM", () => {
    const weekDate = monday("2025-03-10");
    // Wednesday = dayOfWeek 3, startHour 18
    const deadline = getVotingDeadline(weekDate, 3, 18);

    // Session: Wednesday March 12 at 18:00 UTC
    // Deadline: Tuesday March 11 at 18:00 UTC
    expect(deadline.toISOString()).toBe("2025-03-11T18:00:00.000Z");
  });

  it("returns 24 hours before session time for Friday 7AM", () => {
    const weekDate = monday("2025-03-10");
    // Friday = dayOfWeek 5, startHour 7
    const deadline = getVotingDeadline(weekDate, 5, 7);

    // Session: Friday March 14 at 7:00 UTC
    // Deadline: Thursday March 13 at 7:00 UTC
    expect(deadline.toISOString()).toBe("2025-03-13T07:00:00.000Z");
  });

  it("handles Sunday sessions correctly", () => {
    const weekDate = monday("2025-03-10");
    // Sunday = dayOfWeek 7, startHour 10
    const deadline = getVotingDeadline(weekDate, 7, 10);

    // Session: Sunday March 16 at 10:00 UTC
    // Deadline: Saturday March 15 at 10:00 UTC
    expect(deadline.toISOString()).toBe("2025-03-15T10:00:00.000Z");
  });

  it("handles edge case: Monday 0:00 session → deadline is Sunday 0:00", () => {
    const weekDate = monday("2025-03-10");
    const deadline = getVotingDeadline(weekDate, 1, 0);

    // Session: Monday March 10 at 0:00 UTC
    // Deadline: Sunday March 9 at 0:00 UTC
    expect(deadline.toISOString()).toBe("2025-03-09T00:00:00.000Z");
  });
});

// ===== isVotingLocked =====

describe("isVotingLocked", () => {
  it("returns false when current time is before deadline", () => {
    const deadline = new Date("2025-03-10T09:00:00Z");
    const now = new Date("2025-03-10T08:00:00Z");

    expect(isVotingLocked(deadline, now)).toBe(false);
  });

  it("returns true when current time equals deadline", () => {
    const deadline = new Date("2025-03-10T09:00:00Z");
    const now = new Date("2025-03-10T09:00:00Z");

    expect(isVotingLocked(deadline, now)).toBe(true);
  });

  it("returns true when current time is after deadline", () => {
    const deadline = new Date("2025-03-10T09:00:00Z");
    const now = new Date("2025-03-10T10:00:00Z");

    expect(isVotingLocked(deadline, now)).toBe(true);
  });

  it("returns false when deadline is far in the future", () => {
    const deadline = new Date("2025-12-31T23:59:59Z");
    const now = new Date("2025-01-01T00:00:00Z");

    expect(isVotingLocked(deadline, now)).toBe(false);
  });
});

// ===== getTimeUntilDeadline =====

describe("getTimeUntilDeadline", () => {
  it("returns correct hours and minutes when deadline is in the future", () => {
    const deadline = new Date("2025-03-10T12:00:00Z");
    const now = new Date("2025-03-10T09:30:00Z");

    const result = getTimeUntilDeadline(deadline, now);

    expect(result.hours).toBe(2);
    expect(result.minutes).toBe(30);
    expect(result.isPast).toBe(false);
  });

  it("returns zeros and isPast=true when deadline has passed", () => {
    const deadline = new Date("2025-03-10T09:00:00Z");
    const now = new Date("2025-03-10T10:00:00Z");

    const result = getTimeUntilDeadline(deadline, now);

    expect(result.hours).toBe(0);
    expect(result.minutes).toBe(0);
    expect(result.isPast).toBe(true);
  });

  it("returns 0 hours and 0 minutes when deadline is now", () => {
    const deadline = new Date("2025-03-10T09:00:00Z");
    const now = new Date("2025-03-10T09:00:00Z");

    const result = getTimeUntilDeadline(deadline, now);

    // At exact deadline, diff = 0, which is not < 0
    expect(result.hours).toBe(0);
    expect(result.minutes).toBe(0);
    expect(result.isPast).toBe(false);
  });

  it("returns 24 hours when deadline is exactly 24h away", () => {
    const deadline = new Date("2025-03-11T09:00:00Z");
    const now = new Date("2025-03-10T09:00:00Z");

    const result = getTimeUntilDeadline(deadline, now);

    expect(result.hours).toBe(24);
    expect(result.minutes).toBe(0);
    expect(result.isPast).toBe(false);
  });

  it("handles large time differences", () => {
    const deadline = new Date("2025-03-17T09:00:00Z");
    const now = new Date("2025-03-10T09:00:00Z");

    const result = getTimeUntilDeadline(deadline, now);

    expect(result.hours).toBe(168); // 7 * 24
    expect(result.minutes).toBe(0);
    expect(result.isPast).toBe(false);
  });
});

// ===== getVoteSummary =====

describe("getVoteSummary", () => {
  it("calculates correct counts with mixed votes", () => {
    const votes = [
      { attending: true },
      { attending: true },
      { attending: false },
    ];

    const result = getVoteSummary(votes, 5);

    expect(result.coming).toBe(2);
    expect(result.notComing).toBe(1);
    expect(result.noVote).toBe(2);
    expect(result.total).toBe(5);
  });

  it("handles all members voting yes", () => {
    const votes = [
      { attending: true },
      { attending: true },
      { attending: true },
    ];

    const result = getVoteSummary(votes, 3);

    expect(result.coming).toBe(3);
    expect(result.notComing).toBe(0);
    expect(result.noVote).toBe(0);
    expect(result.total).toBe(3);
  });

  it("handles all members voting no", () => {
    const votes = [
      { attending: false },
      { attending: false },
    ];

    const result = getVoteSummary(votes, 2);

    expect(result.coming).toBe(0);
    expect(result.notComing).toBe(2);
    expect(result.noVote).toBe(0);
    expect(result.total).toBe(2);
  });

  it("handles no votes cast", () => {
    const result = getVoteSummary([], 5);

    expect(result.coming).toBe(0);
    expect(result.notComing).toBe(0);
    expect(result.noVote).toBe(5);
    expect(result.total).toBe(5);
  });

  it("handles zero total members", () => {
    const result = getVoteSummary([], 0);

    expect(result.coming).toBe(0);
    expect(result.notComing).toBe(0);
    expect(result.noVote).toBe(0);
    expect(result.total).toBe(0);
  });
});

// ===== hasLowAttendance =====

describe("hasLowAttendance", () => {
  it("returns true when 1 member is coming (at threshold)", () => {
    expect(hasLowAttendance(1)).toBe(true);
  });

  it("returns true when 2 members are coming (at threshold)", () => {
    expect(hasLowAttendance(2)).toBe(true);
  });

  it("returns false when 0 members are coming", () => {
    // 0 is NOT low attendance — it's "no attendance"
    expect(hasLowAttendance(0)).toBe(false);
  });

  it("returns false when 3 members are coming (above threshold)", () => {
    expect(hasLowAttendance(3)).toBe(false);
  });

  it("returns false when 10 members are coming", () => {
    expect(hasLowAttendance(10)).toBe(false);
  });

  it("returns false when 20 members are coming (max class size)", () => {
    expect(hasLowAttendance(20)).toBe(false);
  });
});

// ===== isSessionFull =====

describe("isSessionFull", () => {
  it("returns false when coming count is below max", () => {
    expect(isSessionFull(10)).toBe(false);
  });

  it("returns false when coming count is 19 (one below max)", () => {
    expect(isSessionFull(19)).toBe(false);
  });

  it("returns true when coming count equals MAX_CLASS_SIZE (20)", () => {
    expect(isSessionFull(20)).toBe(true);
  });

  it("returns true when coming count exceeds MAX_CLASS_SIZE", () => {
    expect(isSessionFull(25)).toBe(true);
  });

  it("returns false when coming count is 0", () => {
    expect(isSessionFull(0)).toBe(false);
  });
});
