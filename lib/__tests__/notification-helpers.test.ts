/**
 * Notification Helper Function Tests
 *
 * Tests the two pure helper functions exported from lib/notifications.ts:
 * - getSessionNotificationRecipients: determines who to notify for session events
 * - formatSessionForNotification: formats session date info for notification messages
 *
 * These are pure functions with no database access. We mock Prisma/email/generated
 * imports (which the module imports but these functions don't use) and let date-fns,
 * session-generation, and constants run with real implementations.
 */

import { describe, it, expect, vi } from "vitest";

// ===== Mocks for DB-dependent imports =====

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

vi.mock("@/lib/email", () => ({
  sendNotificationEmail: vi.fn(),
}));

vi.mock("@/generated/prisma/client", () => ({
  NotificationType: {},
}));

// ===== Import under test (after mocks are declared) =====

import {
  getSessionNotificationRecipients,
  formatSessionForNotification,
} from "../notifications";

// ===== Test Helpers =====

/**
 * Create a UTC Monday at midnight for a given date string.
 * weekDate is always a Monday in the codebase.
 */
function monday(dateStr: string): Date {
  const d = new Date(dateStr);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

/**
 * Build a member entry for the session shape.
 */
function member(id: string): { user: { id: string } } {
  return { user: { id } };
}

/**
 * Build a vote entry.
 */
function vote(userId: string, attending: boolean): { userId: string; attending: boolean } {
  return { userId, attending };
}

// =====================================================
// getSessionNotificationRecipients
// =====================================================

describe("getSessionNotificationRecipients", () => {
  // --- Non-voting sessions (votingEnabled=false) ---

  it("returns all member IDs when votingEnabled is false", () => {
    const result = getSessionNotificationRecipients({
      votingEnabled: false,
      members: [member("m1"), member("m2"), member("m3")],
    });

    expect(result).toEqual(["m1", "m2", "m3"]);
  });

  it("returns empty array when votingEnabled is false and members is empty", () => {
    const result = getSessionNotificationRecipients({
      votingEnabled: false,
      members: [],
    });

    expect(result).toEqual([]);
  });

  it("returns single member ID for single-member session without voting", () => {
    const result = getSessionNotificationRecipients({
      votingEnabled: false,
      members: [member("solo")],
    });

    expect(result).toEqual(["solo"]);
  });

  it("returns all member IDs for many members (5+) in order", () => {
    const ids = ["m1", "m2", "m3", "m4", "m5", "m6"];
    const result = getSessionNotificationRecipients({
      votingEnabled: false,
      members: ids.map(member),
    });

    expect(result).toEqual(ids);
    expect(result).toHaveLength(6);
  });

  it("returns members and ignores votes when votingEnabled is false but votes are present", () => {
    // Shouldn't happen in practice, but test robustness
    const result = getSessionNotificationRecipients({
      votingEnabled: false,
      members: [member("m1"), member("m2")],
      votes: [vote("m1", true), vote("m2", false)],
    });

    // Should return all members, not just attending voters
    expect(result).toEqual(["m1", "m2"]);
  });

  // --- Voting sessions (votingEnabled=true) ---

  it("returns only attending voter IDs when votingEnabled is true with mixed votes", () => {
    const result = getSessionNotificationRecipients({
      votingEnabled: true,
      members: [member("m1"), member("m2"), member("m3")],
      votes: [
        vote("m1", true),
        vote("m2", false),
        vote("m3", true),
      ],
    });

    expect(result).toEqual(["m1", "m3"]);
  });

  it("returns all voter IDs when all voters are attending", () => {
    const result = getSessionNotificationRecipients({
      votingEnabled: true,
      members: [member("m1"), member("m2"), member("m3")],
      votes: [
        vote("m1", true),
        vote("m2", true),
        vote("m3", true),
      ],
    });

    expect(result).toEqual(["m1", "m2", "m3"]);
  });

  it("returns empty array when no voters are attending", () => {
    const result = getSessionNotificationRecipients({
      votingEnabled: true,
      members: [member("m1"), member("m2")],
      votes: [
        vote("m1", false),
        vote("m2", false),
      ],
    });

    expect(result).toEqual([]);
  });

  it("returns empty array when votes array is empty", () => {
    const result = getSessionNotificationRecipients({
      votingEnabled: true,
      members: [member("m1"), member("m2")],
      votes: [],
    });

    expect(result).toEqual([]);
  });

  it("falls back to members when votingEnabled is true but votes is undefined", () => {
    const result = getSessionNotificationRecipients({
      votingEnabled: true,
      members: [member("m1"), member("m2")],
      // votes is omitted (undefined)
    });

    // votes is undefined, so the condition `session.votingEnabled && session.votes`
    // is falsy, and it falls back to returning members
    expect(result).toEqual(["m1", "m2"]);
  });

  it("returns single attending voter for single-voter session", () => {
    const result = getSessionNotificationRecipients({
      votingEnabled: true,
      members: [member("solo")],
      votes: [vote("solo", true)],
    });

    expect(result).toEqual(["solo"]);
  });

  it("correctly filters many voters with mixed attending status", () => {
    const allVotes = [
      vote("v1", true),
      vote("v2", false),
      vote("v3", true),
      vote("v4", false),
      vote("v5", true),
      vote("v6", false),
      vote("v7", true),
    ];

    const result = getSessionNotificationRecipients({
      votingEnabled: true,
      members: allVotes.map((v) => member(v.userId)),
      votes: allVotes,
    });

    expect(result).toEqual(["v1", "v3", "v5", "v7"]);
    expect(result).toHaveLength(4);
  });
});

// =====================================================
// formatSessionForNotification
// =====================================================

describe("formatSessionForNotification", () => {
  // --- Day name mapping ---

  it("returns dayName='Monday' for dayOfWeek=1 with correct date", () => {
    // Monday March 10, 2025
    const weekDate = monday("2025-03-10");
    const result = formatSessionForNotification(weekDate, 1, 9);

    expect(result.dayName).toBe("Monday");
    expect(result.dateStr).toBe("Mar 10");
  });

  it("returns dayName='Wednesday' for dayOfWeek=3 with correct date offset", () => {
    // Week of March 10, Wednesday = March 12
    const weekDate = monday("2025-03-10");
    const result = formatSessionForNotification(weekDate, 3, 10);

    expect(result.dayName).toBe("Wednesday");
    expect(result.dateStr).toBe("Mar 12");
  });

  it("returns dayName='Friday' for dayOfWeek=5 with correct date offset", () => {
    // Week of March 10, Friday = March 14
    const weekDate = monday("2025-03-10");
    const result = formatSessionForNotification(weekDate, 5, 14);

    expect(result.dayName).toBe("Friday");
    expect(result.dateStr).toBe("Mar 14");
  });

  it("returns dayName='Sunday' for dayOfWeek=7 with correct date offset", () => {
    // Week of March 10, Sunday = March 16
    const weekDate = monday("2025-03-10");
    const result = formatSessionForNotification(weekDate, 7, 8);

    expect(result.dayName).toBe("Sunday");
    expect(result.dateStr).toBe("Mar 16");
  });

  // --- startHour does not affect dayName or dateStr ---

  it("produces same dayName and dateStr regardless of startHour=9", () => {
    const weekDate = monday("2025-03-10");
    const result = formatSessionForNotification(weekDate, 1, 9);

    expect(result.dayName).toBe("Monday");
    expect(result.dateStr).toBe("Mar 10");
  });

  it("produces same dayName and dateStr regardless of startHour=14", () => {
    const weekDate = monday("2025-03-10");
    const result = formatSessionForNotification(weekDate, 1, 14);

    expect(result.dayName).toBe("Monday");
    expect(result.dateStr).toBe("Mar 10");
  });

  it("produces same dayName and dateStr regardless of startHour=22", () => {
    const weekDate = monday("2025-03-10");
    const result = formatSessionForNotification(weekDate, 1, 22);

    expect(result.dayName).toBe("Monday");
    expect(result.dateStr).toBe("Mar 10");
  });

  // --- Month/year boundary edge cases ---

  it("formats correctly for week starting Jan 1", () => {
    // January 5, 2026 is a Monday
    const weekDate = monday("2026-01-05");
    const result = formatSessionForNotification(weekDate, 1, 9);

    expect(result.dayName).toBe("Monday");
    expect(result.dateStr).toBe("Jan 5");
  });

  it("handles week crossing month boundary (Jan 27 week, Friday = Jan 31)", () => {
    // January 27, 2025 is a Monday; Friday = Jan 31
    const weekDate = monday("2025-01-27");
    const result = formatSessionForNotification(weekDate, 5, 10);

    expect(result.dayName).toBe("Friday");
    expect(result.dateStr).toBe("Jan 31");
  });

  it("handles week crossing year boundary (Dec 29 week, Friday = Jan 2)", () => {
    // December 29, 2025 is a Monday; Friday = Jan 2, 2026
    const weekDate = monday("2025-12-29");
    const result = formatSessionForNotification(weekDate, 5, 10);

    expect(result.dayName).toBe("Friday");
    expect(result.dateStr).toBe("Jan 2");
  });

  // --- Invalid dayOfWeek ---

  it("returns dayName='Unknown' for invalid dayOfWeek=0", () => {
    const weekDate = monday("2025-03-10");
    // DAY_NAMES[0] is '', which is falsy, so || 'Unknown' kicks in
    const result = formatSessionForNotification(weekDate, 0, 9);

    expect(result.dayName).toBe("Unknown");
  });

  it("returns dayName='Unknown' for invalid dayOfWeek=8", () => {
    const weekDate = monday("2025-03-10");
    // DAY_NAMES[8] is undefined, which is falsy, so || 'Unknown' kicks in
    const result = formatSessionForNotification(weekDate, 8, 9);

    expect(result.dayName).toBe("Unknown");
  });

  // --- February leap year edge case ---

  it("handles February 28 in a non-leap year", () => {
    // Feb 24, 2025 is a Monday; Friday (dayOfWeek=5) = Feb 28
    const weekDate = monday("2025-02-24");
    const result = formatSessionForNotification(weekDate, 5, 9);

    expect(result.dayName).toBe("Friday");
    expect(result.dateStr).toBe("Feb 28");
  });

  // --- Date format: single-digit day has no leading zero ---

  it("formats single-digit day without leading zero (e.g., 'Mar 9' not 'Mar 09')", () => {
    // Week of March 3, 2025 is a Monday; Sunday (dayOfWeek=7) = March 9
    const weekDate = monday("2025-03-03");
    const result = formatSessionForNotification(weekDate, 7, 11);

    expect(result.dayName).toBe("Sunday");
    expect(result.dateStr).toBe("Mar 9");
    // Confirm no leading zero
    expect(result.dateStr).not.toMatch(/\d{2}$/);
    // Actually "Mar 9" ends with single digit, let's check explicitly
    expect(result.dateStr).not.toBe("Mar 09");
  });
});
