/**
 * Session Generation Logic Tests
 *
 * Tests pure utility functions: getWeekStart, getSessionDateTime,
 * calculateVotingDeadline. Does NOT test Prisma-dependent functions
 * (generateSessionsForWeek, getSessionsForWeek) which require DB mocking.
 */

import { describe, it, expect, vi } from "vitest";

// Mock prisma to prevent env.ts validation from running (these tests only use pure utility functions)
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import {
  getWeekStart,
  getSessionDateTime,
  calculateVotingDeadline,
  getSessionDayAndHour,
} from "../session-generation";

// ===== getWeekStart =====

describe("getWeekStart", () => {
  it("returns the same Monday when given a Monday", () => {
    // March 10, 2025 is a Monday
    const input = new Date("2025-03-10T12:00:00Z");
    const result = getWeekStart(input);

    expect(result.getUTCDay()).toBe(1); // Monday
    expect(result.toISOString()).toBe("2025-03-10T00:00:00.000Z");
  });

  it("returns the previous Monday when given a Wednesday", () => {
    // March 12, 2025 is a Wednesday
    const input = new Date("2025-03-12T15:30:00Z");
    const result = getWeekStart(input);

    expect(result.getUTCDay()).toBe(1);
    expect(result.toISOString()).toBe("2025-03-10T00:00:00.000Z");
  });

  it("returns the previous Monday when given a Sunday", () => {
    // March 16, 2025 is a Sunday
    const input = new Date("2025-03-16T20:00:00Z");
    const result = getWeekStart(input);

    expect(result.getUTCDay()).toBe(1);
    expect(result.toISOString()).toBe("2025-03-10T00:00:00.000Z");
  });

  it("returns the previous Monday when given a Saturday", () => {
    // March 15, 2025 is a Saturday
    const input = new Date("2025-03-15T08:00:00Z");
    const result = getWeekStart(input);

    expect(result.getUTCDay()).toBe(1);
    expect(result.toISOString()).toBe("2025-03-10T00:00:00.000Z");
  });

  it("handles year boundary (first week of January)", () => {
    // January 1, 2025 is a Wednesday
    const input = new Date("2025-01-01T00:00:00Z");
    const result = getWeekStart(input);

    // Monday of that week is December 30, 2024
    expect(result.getUTCDay()).toBe(1);
    expect(result.toISOString()).toBe("2024-12-30T00:00:00.000Z");
  });

  it("returns midnight UTC regardless of input time", () => {
    const input = new Date("2025-03-10T23:59:59.999Z");
    const result = getWeekStart(input);

    expect(result.getUTCHours()).toBe(0);
    expect(result.getUTCMinutes()).toBe(0);
    expect(result.getUTCSeconds()).toBe(0);
    expect(result.getUTCMilliseconds()).toBe(0);
  });

  it("handles February 29 (leap year)", () => {
    // Feb 29, 2024 is a Thursday (leap year)
    const input = new Date("2024-02-29T12:00:00Z");
    const result = getWeekStart(input);

    // Monday of that week is Feb 26, 2024
    expect(result.getUTCDay()).toBe(1);
    expect(result.toISOString()).toBe("2024-02-26T00:00:00.000Z");
  });
});

// ===== getSessionDateTime =====

describe("getSessionDateTime", () => {
  const mondayWeekDate = new Date("2025-03-10T00:00:00.000Z");

  it("returns Monday at startHour for dayOfWeek=1", () => {
    const result = getSessionDateTime(mondayWeekDate, 1, 9);

    expect(result.toISOString()).toBe("2025-03-10T09:00:00.000Z");
  });

  it("returns Wednesday at startHour for dayOfWeek=3", () => {
    const result = getSessionDateTime(mondayWeekDate, 3, 18);

    // Wednesday = Monday + 2 days
    expect(result.toISOString()).toBe("2025-03-12T18:00:00.000Z");
  });

  it("returns Friday at startHour for dayOfWeek=5", () => {
    const result = getSessionDateTime(mondayWeekDate, 5, 7);

    // Friday = Monday + 4 days
    expect(result.toISOString()).toBe("2025-03-14T07:00:00.000Z");
  });

  it("returns Sunday at startHour for dayOfWeek=7", () => {
    const result = getSessionDateTime(mondayWeekDate, 7, 10);

    // Sunday = Monday + 6 days
    expect(result.toISOString()).toBe("2025-03-16T10:00:00.000Z");
  });

  it("handles startHour=7 (earliest slot)", () => {
    const result = getSessionDateTime(mondayWeekDate, 1, 7);

    expect(result.getUTCHours()).toBe(7);
  });

  it("handles startHour=22 (latest slot)", () => {
    const result = getSessionDateTime(mondayWeekDate, 1, 22);

    expect(result.getUTCHours()).toBe(22);
  });

  it("returns UTC datetime with zero minutes/seconds/ms", () => {
    const result = getSessionDateTime(mondayWeekDate, 3, 15);

    expect(result.getUTCMinutes()).toBe(0);
    expect(result.getUTCSeconds()).toBe(0);
    expect(result.getUTCMilliseconds()).toBe(0);
  });
});

// ===== calculateVotingDeadline =====

describe("calculateVotingDeadline", () => {
  it("returns exactly 24 hours before session time", () => {
    const sessionTime = new Date("2025-03-12T18:00:00.000Z");
    const deadline = calculateVotingDeadline(sessionTime);

    expect(deadline.toISOString()).toBe("2025-03-11T18:00:00.000Z");
  });

  it("crosses day boundary correctly", () => {
    // Session at 2:00 AM
    const sessionTime = new Date("2025-03-12T02:00:00.000Z");
    const deadline = calculateVotingDeadline(sessionTime);

    // 24h before 2AM Wednesday = 2AM Tuesday
    expect(deadline.toISOString()).toBe("2025-03-11T02:00:00.000Z");
  });

  it("crosses month boundary correctly", () => {
    // Session at April 1, 9:00 AM
    const sessionTime = new Date("2025-04-01T09:00:00.000Z");
    const deadline = calculateVotingDeadline(sessionTime);

    // 24h before = March 31, 9:00 AM
    expect(deadline.toISOString()).toBe("2025-03-31T09:00:00.000Z");
  });

  it("crosses year boundary correctly", () => {
    // Session at January 1, 10:00 AM
    const sessionTime = new Date("2025-01-01T10:00:00.000Z");
    const deadline = calculateVotingDeadline(sessionTime);

    // 24h before = December 31, 10:00 AM
    expect(deadline.toISOString()).toBe("2024-12-31T10:00:00.000Z");
  });

  it("difference is exactly 86400000ms (24 hours)", () => {
    const sessionTime = new Date("2025-03-10T09:00:00.000Z");
    const deadline = calculateVotingDeadline(sessionTime);

    const diff = sessionTime.getTime() - deadline.getTime();

    expect(diff).toBe(24 * 60 * 60 * 1000);
  });
});

// ===== getSessionDayAndHour =====

describe("getSessionDayAndHour", () => {
  it("returns recurringSlot day/hour for recurring sessions", () => {
    const session = {
      recurringSlot: { dayOfWeek: 3, startHour: 14 },
      customDay: null,
      customStartHour: null,
    };
    expect(getSessionDayAndHour(session)).toEqual({ day: 3, hour: 14 });
  });

  it("returns customDay/customStartHour for one-off sessions", () => {
    const session = {
      recurringSlot: null,
      customDay: 5,
      customStartHour: 16,
    };
    expect(getSessionDayAndHour(session)).toEqual({ day: 5, hour: 16 });
  });

  it("falls back to 0/0 when no data", () => {
    const session = {
      recurringSlot: null,
      customDay: null,
      customStartHour: null,
    };
    expect(getSessionDayAndHour(session)).toEqual({ day: 0, hour: 0 });
  });

  it("prefers recurringSlot over custom fields when both present", () => {
    const session = {
      recurringSlot: { dayOfWeek: 2, startHour: 10 },
      customDay: 5,
      customStartHour: 16,
    };
    expect(getSessionDayAndHour(session)).toEqual({ day: 2, hour: 10 });
  });

  it("handles undefined fields gracefully", () => {
    const session = {};
    expect(getSessionDayAndHour(session)).toEqual({ day: 0, hour: 0 });
  });
});
