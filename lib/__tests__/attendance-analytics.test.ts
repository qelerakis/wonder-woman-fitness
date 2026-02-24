import { describe, it, expect } from "vitest";
import {
  computeAttendanceAnalytics,
  type AttendanceRecordInput,
  type MemberInput,
} from "../attendance-analytics";

// ── Helpers ─────────────────────────────────────────────────────────

function makeMember(id: string, name: string): MemberInput {
  return { id, name };
}

function makeRecord(
  overrides: Partial<AttendanceRecordInput> & {
    sessionId: string;
    userId: string;
    present: boolean;
  }
): AttendanceRecordInput {
  return {
    sessionId: overrides.sessionId,
    userId: overrides.userId,
    present: overrides.present,
    session: overrides.session ?? {
      weekDate: new Date("2026-02-16"),
      recurringSlotId: "slot-1",
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
      customStartHour: null,
      votes: [],
    },
  };
}

const MEMBERS: MemberInput[] = [
  makeMember("m1", "Alice"),
  makeMember("m2", "Bob"),
  makeMember("m3", "Charlie"),
];

// ── Empty input ─────────────────────────────────────────────────────

describe("computeAttendanceAnalytics", () => {
  it("returns empty results for empty records", () => {
    const result = computeAttendanceAnalytics([], MEMBERS);
    expect(result.memberRates).toEqual([]);
    expect(result.slotRates).toEqual([]);
    expect(result.voteVsActual).toEqual({
      totalVotedComing: 0,
      totalActuallyAttended: 0,
      reliability: 0,
    });
    expect(result.trend).toEqual([]);
  });

  // ── Member rates ────────────────────────────────────────────────

  describe("memberRates", () => {
    it("computes per-member attendance rate correctly", () => {
      const records: AttendanceRecordInput[] = [
        makeRecord({ sessionId: "s1", userId: "m1", present: true }),
        makeRecord({ sessionId: "s2", userId: "m1", present: true }),
        makeRecord({ sessionId: "s1", userId: "m2", present: false }),
        makeRecord({ sessionId: "s2", userId: "m2", present: true }),
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS);

      const alice = result.memberRates.find((m) => m.name === "Alice");
      expect(alice).toBeDefined();
      expect(alice!.expected).toBe(2);
      expect(alice!.attended).toBe(2);
      expect(alice!.rate).toBe(100);

      const bob = result.memberRates.find((m) => m.name === "Bob");
      expect(bob).toBeDefined();
      expect(bob!.expected).toBe(2);
      expect(bob!.attended).toBe(1);
      expect(bob!.rate).toBe(50);
    });

    it("sorts member rates ascending by rate (worst first)", () => {
      const records: AttendanceRecordInput[] = [
        makeRecord({ sessionId: "s1", userId: "m1", present: true }),
        makeRecord({ sessionId: "s2", userId: "m1", present: true }),
        makeRecord({ sessionId: "s1", userId: "m2", present: false }),
        makeRecord({ sessionId: "s2", userId: "m2", present: false }),
        makeRecord({ sessionId: "s1", userId: "m3", present: true }),
        makeRecord({ sessionId: "s2", userId: "m3", present: false }),
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS);

      expect(result.memberRates[0].name).toBe("Bob"); // 0%
      expect(result.memberRates[1].name).toBe("Charlie"); // 50%
      expect(result.memberRates[2].name).toBe("Alice"); // 100%
    });

    it("shows 'Unknown' for members not in the lookup list", () => {
      const records: AttendanceRecordInput[] = [
        makeRecord({ sessionId: "s1", userId: "unknown-id", present: true }),
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS);
      expect(result.memberRates[0].name).toBe("Unknown");
    });
  });

  // ── Slot rates ──────────────────────────────────────────────────

  describe("slotRates", () => {
    it("computes per-slot show-up rate", () => {
      const session = {
        weekDate: new Date("2026-02-16"),
        recurringSlotId: "slot-1",
        recurringSlot: { dayOfWeek: 1, startHour: 9 },
        customDay: null,
        customStartHour: null,
        votes: [],
      };

      const records: AttendanceRecordInput[] = [
        makeRecord({ sessionId: "s1", userId: "m1", present: true, session }),
        makeRecord({ sessionId: "s1", userId: "m2", present: false, session }),
        makeRecord({ sessionId: "s1", userId: "m3", present: true, session }),
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS);

      expect(result.slotRates).toHaveLength(1);
      expect(result.slotRates[0].day).toBe("Monday");
      expect(result.slotRates[0].hour).toBe(9);
      expect(result.slotRates[0].showUpRate).toBe(67); // 2/3 = 67%
      expect(result.slotRates[0].sessionCount).toBe(1);
    });

    it("aggregates across multiple sessions in the same slot", () => {
      const session1 = {
        weekDate: new Date("2026-02-16"),
        recurringSlotId: "slot-1",
        recurringSlot: { dayOfWeek: 3, startHour: 18 },
        customDay: null,
        customStartHour: null,
        votes: [],
      };
      const session2 = {
        weekDate: new Date("2026-02-23"),
        recurringSlotId: "slot-1",
        recurringSlot: { dayOfWeek: 3, startHour: 18 },
        customDay: null,
        customStartHour: null,
        votes: [],
      };

      const records: AttendanceRecordInput[] = [
        // Session 1: 1/2 present
        makeRecord({ sessionId: "s1", userId: "m1", present: true, session: session1 }),
        makeRecord({ sessionId: "s1", userId: "m2", present: false, session: session1 }),
        // Session 2: 2/2 present
        makeRecord({ sessionId: "s2", userId: "m1", present: true, session: session2 }),
        makeRecord({ sessionId: "s2", userId: "m2", present: true, session: session2 }),
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS);

      expect(result.slotRates).toHaveLength(1);
      expect(result.slotRates[0].day).toBe("Wednesday");
      expect(result.slotRates[0].hour).toBe(18);
      expect(result.slotRates[0].showUpRate).toBe(75); // 3/4 = 75%
      expect(result.slotRates[0].sessionCount).toBe(2);
      expect(result.slotRates[0].avgPresent).toBe(1.5); // 3 present / 2 sessions
    });

    it("handles custom sessions (no recurring slot)", () => {
      const session = {
        weekDate: new Date("2026-02-16"),
        recurringSlotId: null,
        recurringSlot: null,
        customDay: 5,
        customStartHour: 14,
        votes: [],
      };

      const records: AttendanceRecordInput[] = [
        makeRecord({ sessionId: "s1", userId: "m1", present: true, session }),
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS);

      expect(result.slotRates[0].day).toBe("Friday");
      expect(result.slotRates[0].hour).toBe(14);
    });

    it("sorts slot rates ascending by showUpRate (worst first)", () => {
      const goodSlot = {
        weekDate: new Date("2026-02-16"),
        recurringSlotId: "slot-1",
        recurringSlot: { dayOfWeek: 1, startHour: 9 },
        customDay: null,
        customStartHour: null,
        votes: [],
      };
      const badSlot = {
        weekDate: new Date("2026-02-16"),
        recurringSlotId: "slot-2",
        recurringSlot: { dayOfWeek: 3, startHour: 18 },
        customDay: null,
        customStartHour: null,
        votes: [],
      };

      const records: AttendanceRecordInput[] = [
        makeRecord({ sessionId: "s1", userId: "m1", present: true, session: goodSlot }),
        makeRecord({ sessionId: "s1", userId: "m2", present: true, session: goodSlot }),
        makeRecord({ sessionId: "s2", userId: "m1", present: false, session: badSlot }),
        makeRecord({ sessionId: "s2", userId: "m2", present: false, session: badSlot }),
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS);

      expect(result.slotRates).toHaveLength(2);
      expect(result.slotRates[0].day).toBe("Wednesday"); // 0%
      expect(result.slotRates[1].day).toBe("Monday"); // 100%
    });
  });

  // ── Vote vs. Actual ─────────────────────────────────────────────

  describe("voteVsActual", () => {
    it("computes vote reliability", () => {
      const session = {
        weekDate: new Date("2026-02-16"),
        recurringSlotId: "slot-1",
        recurringSlot: { dayOfWeek: 1, startHour: 9 },
        customDay: null,
        customStartHour: null,
        votes: [
          { userId: "m1", attending: true },
          { userId: "m2", attending: true },
          { userId: "m3", attending: false },
        ],
      };

      const records: AttendanceRecordInput[] = [
        makeRecord({ sessionId: "s1", userId: "m1", present: true, session }),
        makeRecord({ sessionId: "s1", userId: "m2", present: false, session }),
        makeRecord({ sessionId: "s1", userId: "m3", present: false, session }),
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS);

      expect(result.voteVsActual.totalVotedComing).toBe(2);
      expect(result.voteVsActual.totalActuallyAttended).toBe(1);
      expect(result.voteVsActual.reliability).toBe(50); // 1/2 = 50%
    });

    it("returns 0 reliability when no one voted coming", () => {
      const session = {
        weekDate: new Date("2026-02-16"),
        recurringSlotId: "slot-1",
        recurringSlot: { dayOfWeek: 1, startHour: 9 },
        customDay: null,
        customStartHour: null,
        votes: [{ userId: "m1", attending: false }],
      };

      const records: AttendanceRecordInput[] = [
        makeRecord({ sessionId: "s1", userId: "m1", present: true, session }),
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS);

      expect(result.voteVsActual.totalVotedComing).toBe(0);
      expect(result.voteVsActual.reliability).toBe(0);
    });

    it("aggregates across multiple sessions", () => {
      const session1 = {
        weekDate: new Date("2026-02-16"),
        recurringSlotId: "slot-1",
        recurringSlot: { dayOfWeek: 1, startHour: 9 },
        customDay: null,
        customStartHour: null,
        votes: [
          { userId: "m1", attending: true },
          { userId: "m2", attending: true },
        ],
      };
      const session2 = {
        weekDate: new Date("2026-02-23"),
        recurringSlotId: "slot-1",
        recurringSlot: { dayOfWeek: 1, startHour: 9 },
        customDay: null,
        customStartHour: null,
        votes: [
          { userId: "m1", attending: true },
        ],
      };

      const records: AttendanceRecordInput[] = [
        makeRecord({ sessionId: "s1", userId: "m1", present: true, session: session1 }),
        makeRecord({ sessionId: "s1", userId: "m2", present: true, session: session1 }),
        makeRecord({ sessionId: "s2", userId: "m1", present: false, session: session2 }),
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS);

      expect(result.voteVsActual.totalVotedComing).toBe(3); // 2 + 1
      expect(result.voteVsActual.totalActuallyAttended).toBe(2);
      expect(result.voteVsActual.reliability).toBe(67); // 2/3 = 67%
    });
  });

  // ── Attendance trend ────────────────────────────────────────────

  describe("trend", () => {
    it("groups attendance by week and sorts chronologically", () => {
      const week1Session = {
        weekDate: new Date("2026-02-09"),
        recurringSlotId: "slot-1",
        recurringSlot: { dayOfWeek: 1, startHour: 9 },
        customDay: null,
        customStartHour: null,
        votes: [],
      };
      const week2Session = {
        weekDate: new Date("2026-02-16"),
        recurringSlotId: "slot-1",
        recurringSlot: { dayOfWeek: 1, startHour: 9 },
        customDay: null,
        customStartHour: null,
        votes: [],
      };

      const records: AttendanceRecordInput[] = [
        // Week 1: 1/2 present
        makeRecord({ sessionId: "s1", userId: "m1", present: true, session: week1Session }),
        makeRecord({ sessionId: "s1", userId: "m2", present: false, session: week1Session }),
        // Week 2: 2/2 present
        makeRecord({ sessionId: "s2", userId: "m1", present: true, session: week2Session }),
        makeRecord({ sessionId: "s2", userId: "m2", present: true, session: week2Session }),
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS);

      expect(result.trend).toHaveLength(2);
      expect(result.trend[0].week).toBe("2026-02-09");
      expect(result.trend[0].rate).toBe(50);
      expect(result.trend[0].present).toBe(1);
      expect(result.trend[0].total).toBe(2);
      expect(result.trend[1].week).toBe("2026-02-16");
      expect(result.trend[1].rate).toBe(100);
      expect(result.trend[1].present).toBe(2);
      expect(result.trend[1].total).toBe(2);
    });

    it("handles string weekDate (API response format)", () => {
      const session = {
        weekDate: "2026-02-16T00:00:00.000Z" as unknown as Date,
        recurringSlotId: "slot-1",
        recurringSlot: { dayOfWeek: 1, startHour: 9 },
        customDay: null,
        customStartHour: null,
        votes: [],
      };

      const records: AttendanceRecordInput[] = [
        makeRecord({ sessionId: "s1", userId: "m1", present: true, session }),
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS);

      expect(result.trend).toHaveLength(1);
      expect(result.trend[0].week).toBe("2026-02-16");
    });
  });

  // ── Edge cases ──────────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles all members absent (0% rate)", () => {
      const records: AttendanceRecordInput[] = [
        makeRecord({ sessionId: "s1", userId: "m1", present: false }),
        makeRecord({ sessionId: "s1", userId: "m2", present: false }),
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS);

      for (const rate of result.memberRates) {
        expect(rate.rate).toBe(0);
      }
    });

    it("handles all members present (100% rate)", () => {
      const records: AttendanceRecordInput[] = [
        makeRecord({ sessionId: "s1", userId: "m1", present: true }),
        makeRecord({ sessionId: "s1", userId: "m2", present: true }),
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS);

      for (const rate of result.memberRates) {
        expect(rate.rate).toBe(100);
      }
    });

    it("handles single record", () => {
      const records: AttendanceRecordInput[] = [
        makeRecord({ sessionId: "s1", userId: "m1", present: true }),
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS);

      expect(result.memberRates).toHaveLength(1);
      expect(result.slotRates).toHaveLength(1);
      expect(result.trend).toHaveLength(1);
    });

    it("handles session with null recurringSlot and null customDay (defaults to 0)", () => {
      const session = {
        weekDate: new Date("2026-02-16"),
        recurringSlotId: null,
        recurringSlot: null,
        customDay: null,
        customStartHour: null,
        votes: [],
      };

      const records: AttendanceRecordInput[] = [
        makeRecord({ sessionId: "s1", userId: "m1", present: true, session }),
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS);

      // dayOfWeek 0 maps to "" in DAY_NAMES → "Unknown"
      expect(result.slotRates[0].day).toBe("Unknown");
      expect(result.slotRates[0].hour).toBe(0);
    });
  });
});
