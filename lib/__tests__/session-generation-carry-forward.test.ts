/**
 * Session Generation — Carry-Forward Assignment Tests
 *
 * Tests that generateSessionsForWeek() correctly copies trainer and member
 * assignments from the previous week's sessions via copyAssignmentsFromPreviousWeek().
 *
 * This is a separate file from session-generation.test.ts because the pure
 * utility function tests there do not use Prisma mocks, and vi.mock() is
 * module-scoped — mixing mocked and unmocked imports of the same module
 * in a single file would cause conflicts.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ===== Mocks =====

const mockPrisma = vi.hoisted(() => ({
  recurringSlot: { findMany: vi.fn() },
  session: { create: vi.fn(), findUnique: vi.fn() },
  sessionTrainer: { createMany: vi.fn() },
  sessionMember: { createMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// ===== Import under test (after mocks are declared) =====

import { generateSessionsForWeek } from "../session-generation";

// ===== Test constants =====

const WEEK_DATE = new Date("2025-03-17T00:00:00.000Z"); // Monday
const PREV_WEEK_DATE = new Date("2025-03-10T00:00:00.000Z"); // Previous Monday

const SLOT_MON_9 = {
  id: "slot-mon-9",
  dayOfWeek: 1,
  startHour: 9,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const SLOT_WED_18 = {
  id: "slot-wed-18",
  dayOfWeek: 3,
  startHour: 18,
  createdAt: new Date(),
  updatedAt: new Date(),
};

/**
 * Helper to build a mock session returned by session.create.
 * Mirrors the shape of a Prisma Session record.
 */
function makeCreatedSession(
  id: string,
  slotId: string,
  weekDate: Date = WEEK_DATE
) {
  return {
    id,
    recurringSlotId: slotId,
    customDay: null,
    customStartHour: null,
    weekDate,
    workoutTitle: null,
    workoutDetails: null,
    votingEnabled: false,
    votingDeadline: new Date("2025-03-16T09:00:00.000Z"),
    status: "SCHEDULED",
    createdById: null,
    createdAt: new Date(),
  };
}

/**
 * Helper to build a mock previous session returned by session.findUnique,
 * including the trainers/members includes that copyAssignmentsFromPreviousWeek uses.
 */
function makePreviousSession(
  id: string,
  trainers: Array<{ userId: string }> = [],
  members: Array<{ userId: string; user: { id: string; status: string } }> = [],
  status = "SCHEDULED"
) {
  return {
    id,
    status,
    trainers,
    members,
  };
}

// ===== Tests =====

describe("generateSessionsForWeek — carry-forward assignments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ----- Happy path -----

  describe("happy path", () => {
    it("copies trainers from previous week's session to new session", async () => {
      mockPrisma.recurringSlot.findMany.mockResolvedValue([SLOT_MON_9]);
      mockPrisma.session.create.mockResolvedValue(
        makeCreatedSession("new-s1", SLOT_MON_9.id)
      );
      mockPrisma.session.findUnique.mockResolvedValue(
        makePreviousSession("prev-s1", [{ userId: "trainer-1" }], [])
      );
      mockPrisma.sessionTrainer.createMany.mockResolvedValue({ count: 1 });

      await generateSessionsForWeek(WEEK_DATE);

      expect(mockPrisma.sessionTrainer.createMany).toHaveBeenCalledWith({
        data: [{ sessionId: "new-s1", userId: "trainer-1" }],
      });
    });

    it("copies members from previous week's session to new session", async () => {
      mockPrisma.recurringSlot.findMany.mockResolvedValue([SLOT_MON_9]);
      mockPrisma.session.create.mockResolvedValue(
        makeCreatedSession("new-s1", SLOT_MON_9.id)
      );
      mockPrisma.session.findUnique.mockResolvedValue(
        makePreviousSession(
          "prev-s1",
          [],
          [{ userId: "member-1", user: { id: "member-1", status: "ACTIVE" } }]
        )
      );
      mockPrisma.sessionMember.createMany.mockResolvedValue({ count: 1 });

      await generateSessionsForWeek(WEEK_DATE);

      expect(mockPrisma.sessionMember.createMany).toHaveBeenCalledWith({
        data: [{ sessionId: "new-s1", userId: "member-1" }],
      });
    });

    it("copies both trainers and members together", async () => {
      mockPrisma.recurringSlot.findMany.mockResolvedValue([SLOT_MON_9]);
      mockPrisma.session.create.mockResolvedValue(
        makeCreatedSession("new-s1", SLOT_MON_9.id)
      );
      mockPrisma.session.findUnique.mockResolvedValue(
        makePreviousSession(
          "prev-s1",
          [{ userId: "trainer-1" }],
          [{ userId: "member-1", user: { id: "member-1", status: "ACTIVE" } }]
        )
      );
      mockPrisma.sessionTrainer.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.sessionMember.createMany.mockResolvedValue({ count: 1 });

      await generateSessionsForWeek(WEEK_DATE);

      expect(mockPrisma.sessionTrainer.createMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.sessionMember.createMany).toHaveBeenCalledTimes(1);
    });

    it("multiple slots copy independently from their own previous sessions", async () => {
      mockPrisma.recurringSlot.findMany.mockResolvedValue([
        SLOT_MON_9,
        SLOT_WED_18,
      ]);

      // session.create returns different sessions for each slot
      mockPrisma.session.create
        .mockResolvedValueOnce(makeCreatedSession("new-mon", SLOT_MON_9.id))
        .mockResolvedValueOnce(makeCreatedSession("new-wed", SLOT_WED_18.id));

      // session.findUnique returns different previous sessions per slot
      mockPrisma.session.findUnique
        .mockResolvedValueOnce(
          makePreviousSession(
            "prev-mon",
            [{ userId: "trainer-A" }],
            [{ userId: "member-A", user: { id: "member-A", status: "ACTIVE" } }]
          )
        )
        .mockResolvedValueOnce(
          makePreviousSession(
            "prev-wed",
            [{ userId: "trainer-B" }],
            [{ userId: "member-B", user: { id: "member-B", status: "ACTIVE" } }]
          )
        );

      mockPrisma.sessionTrainer.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.sessionMember.createMany.mockResolvedValue({ count: 1 });

      const result = await generateSessionsForWeek(WEEK_DATE);

      expect(result).toHaveLength(2);

      // First slot: trainer-A -> new-mon
      expect(mockPrisma.sessionTrainer.createMany).toHaveBeenCalledWith({
        data: [{ sessionId: "new-mon", userId: "trainer-A" }],
      });
      // Second slot: trainer-B -> new-wed
      expect(mockPrisma.sessionTrainer.createMany).toHaveBeenCalledWith({
        data: [{ sessionId: "new-wed", userId: "trainer-B" }],
      });

      // First slot: member-A -> new-mon
      expect(mockPrisma.sessionMember.createMany).toHaveBeenCalledWith({
        data: [{ sessionId: "new-mon", userId: "member-A" }],
      });
      // Second slot: member-B -> new-wed
      expect(mockPrisma.sessionMember.createMany).toHaveBeenCalledWith({
        data: [{ sessionId: "new-wed", userId: "member-B" }],
      });
    });
  });

  // ----- No previous session -----

  describe("no previous session", () => {
    it("creates session when no previous week session exists", async () => {
      mockPrisma.recurringSlot.findMany.mockResolvedValue([SLOT_MON_9]);
      mockPrisma.session.create.mockResolvedValue(
        makeCreatedSession("new-s1", SLOT_MON_9.id)
      );
      mockPrisma.session.findUnique.mockResolvedValue(null);

      const result = await generateSessionsForWeek(WEEK_DATE);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("new-s1");
    });

    it("does not call createMany for trainers when no previous session", async () => {
      mockPrisma.recurringSlot.findMany.mockResolvedValue([SLOT_MON_9]);
      mockPrisma.session.create.mockResolvedValue(
        makeCreatedSession("new-s1", SLOT_MON_9.id)
      );
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await generateSessionsForWeek(WEEK_DATE);

      expect(mockPrisma.sessionTrainer.createMany).not.toHaveBeenCalled();
    });

    it("does not call createMany for members when no previous session", async () => {
      mockPrisma.recurringSlot.findMany.mockResolvedValue([SLOT_MON_9]);
      mockPrisma.session.create.mockResolvedValue(
        makeCreatedSession("new-s1", SLOT_MON_9.id)
      );
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await generateSessionsForWeek(WEEK_DATE);

      expect(mockPrisma.sessionMember.createMany).not.toHaveBeenCalled();
    });
  });

  // ----- Departed members -----

  describe("departed members", () => {
    it("skips departed members during copy", async () => {
      mockPrisma.recurringSlot.findMany.mockResolvedValue([SLOT_MON_9]);
      mockPrisma.session.create.mockResolvedValue(
        makeCreatedSession("new-s1", SLOT_MON_9.id)
      );
      mockPrisma.session.findUnique.mockResolvedValue(
        makePreviousSession("prev-s1", [], [
          { userId: "departed-1", user: { id: "departed-1", status: "DEPARTED" } },
        ])
      );

      await generateSessionsForWeek(WEEK_DATE);

      expect(mockPrisma.sessionMember.createMany).not.toHaveBeenCalled();
    });

    it("copies non-departed members while skipping departed ones in same session", async () => {
      mockPrisma.recurringSlot.findMany.mockResolvedValue([SLOT_MON_9]);
      mockPrisma.session.create.mockResolvedValue(
        makeCreatedSession("new-s1", SLOT_MON_9.id)
      );
      mockPrisma.session.findUnique.mockResolvedValue(
        makePreviousSession("prev-s1", [], [
          { userId: "active-1", user: { id: "active-1", status: "ACTIVE" } },
          { userId: "departed-1", user: { id: "departed-1", status: "DEPARTED" } },
          { userId: "trial-1", user: { id: "trial-1", status: "TRIAL" } },
        ])
      );
      mockPrisma.sessionMember.createMany.mockResolvedValue({ count: 2 });

      await generateSessionsForWeek(WEEK_DATE);

      expect(mockPrisma.sessionMember.createMany).toHaveBeenCalledWith({
        data: [
          { sessionId: "new-s1", userId: "active-1" },
          { sessionId: "new-s1", userId: "trial-1" },
        ],
      });
    });

    it("still copies trainers even when all members are departed", async () => {
      mockPrisma.recurringSlot.findMany.mockResolvedValue([SLOT_MON_9]);
      mockPrisma.session.create.mockResolvedValue(
        makeCreatedSession("new-s1", SLOT_MON_9.id)
      );
      mockPrisma.session.findUnique.mockResolvedValue(
        makePreviousSession(
          "prev-s1",
          [{ userId: "trainer-1" }],
          [
            { userId: "departed-1", user: { id: "departed-1", status: "DEPARTED" } },
            { userId: "departed-2", user: { id: "departed-2", status: "DEPARTED" } },
          ]
        )
      );
      mockPrisma.sessionTrainer.createMany.mockResolvedValue({ count: 1 });

      await generateSessionsForWeek(WEEK_DATE);

      expect(mockPrisma.sessionTrainer.createMany).toHaveBeenCalledWith({
        data: [{ sessionId: "new-s1", userId: "trainer-1" }],
      });
      expect(mockPrisma.sessionMember.createMany).not.toHaveBeenCalled();
    });
  });

  // ----- Cancelled previous session -----

  describe("cancelled previous session", () => {
    it("copies assignments even when previous session was CANCELLED", async () => {
      mockPrisma.recurringSlot.findMany.mockResolvedValue([SLOT_MON_9]);
      mockPrisma.session.create.mockResolvedValue(
        makeCreatedSession("new-s1", SLOT_MON_9.id)
      );
      mockPrisma.session.findUnique.mockResolvedValue(
        makePreviousSession(
          "prev-cancelled",
          [{ userId: "trainer-1" }],
          [{ userId: "member-1", user: { id: "member-1", status: "ACTIVE" } }],
          "CANCELLED"
        )
      );
      mockPrisma.sessionTrainer.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.sessionMember.createMany.mockResolvedValue({ count: 1 });

      await generateSessionsForWeek(WEEK_DATE);

      expect(mockPrisma.sessionTrainer.createMany).toHaveBeenCalledWith({
        data: [{ sessionId: "new-s1", userId: "trainer-1" }],
      });
      expect(mockPrisma.sessionMember.createMany).toHaveBeenCalledWith({
        data: [{ sessionId: "new-s1", userId: "member-1" }],
      });
    });
  });

  // ----- Idempotent behavior (P2002 unique violation) -----

  describe("idempotent behavior", () => {
    it("skips session creation when session already exists (P2002 unique violation)", async () => {
      mockPrisma.recurringSlot.findMany.mockResolvedValue([SLOT_MON_9]);

      const p2002Error = { code: "P2002", message: "Unique constraint failed" };
      mockPrisma.session.create.mockRejectedValue(p2002Error);

      const result = await generateSessionsForWeek(WEEK_DATE);

      expect(result).toHaveLength(0);
    });

    it("does NOT call copyAssignments when session already exists (P2002)", async () => {
      mockPrisma.recurringSlot.findMany.mockResolvedValue([SLOT_MON_9]);

      const p2002Error = { code: "P2002", message: "Unique constraint failed" };
      mockPrisma.session.create.mockRejectedValue(p2002Error);

      await generateSessionsForWeek(WEEK_DATE);

      expect(mockPrisma.session.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.sessionTrainer.createMany).not.toHaveBeenCalled();
      expect(mockPrisma.sessionMember.createMany).not.toHaveBeenCalled();
    });
  });

  // ----- Partial data -----

  describe("partial data", () => {
    it("copies only trainers when previous session has trainers but no members", async () => {
      mockPrisma.recurringSlot.findMany.mockResolvedValue([SLOT_MON_9]);
      mockPrisma.session.create.mockResolvedValue(
        makeCreatedSession("new-s1", SLOT_MON_9.id)
      );
      mockPrisma.session.findUnique.mockResolvedValue(
        makePreviousSession("prev-s1", [{ userId: "trainer-1" }], [])
      );
      mockPrisma.sessionTrainer.createMany.mockResolvedValue({ count: 1 });

      await generateSessionsForWeek(WEEK_DATE);

      expect(mockPrisma.sessionTrainer.createMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.sessionMember.createMany).not.toHaveBeenCalled();
    });

    it("copies only members when previous session has members but no trainers", async () => {
      mockPrisma.recurringSlot.findMany.mockResolvedValue([SLOT_MON_9]);
      mockPrisma.session.create.mockResolvedValue(
        makeCreatedSession("new-s1", SLOT_MON_9.id)
      );
      mockPrisma.session.findUnique.mockResolvedValue(
        makePreviousSession("prev-s1", [], [
          { userId: "member-1", user: { id: "member-1", status: "ACTIVE" } },
        ])
      );
      mockPrisma.sessionMember.createMany.mockResolvedValue({ count: 1 });

      await generateSessionsForWeek(WEEK_DATE);

      expect(mockPrisma.sessionTrainer.createMany).not.toHaveBeenCalled();
      expect(mockPrisma.sessionMember.createMany).toHaveBeenCalledTimes(1);
    });
  });

  // ----- Empty previous session -----

  describe("empty previous session", () => {
    it("does nothing when previous session exists but has no trainers or members", async () => {
      mockPrisma.recurringSlot.findMany.mockResolvedValue([SLOT_MON_9]);
      mockPrisma.session.create.mockResolvedValue(
        makeCreatedSession("new-s1", SLOT_MON_9.id)
      );
      mockPrisma.session.findUnique.mockResolvedValue(
        makePreviousSession("prev-s1", [], [])
      );

      await generateSessionsForWeek(WEEK_DATE);

      expect(mockPrisma.sessionTrainer.createMany).not.toHaveBeenCalled();
      expect(mockPrisma.sessionMember.createMany).not.toHaveBeenCalled();
    });
  });

  // ----- MAX_CLASS_SIZE cap -----

  describe("MAX_CLASS_SIZE cap", () => {
    it("caps member copy at MAX_CLASS_SIZE (20) when previous session has more", async () => {
      // Create 25 active members
      const members = Array.from({ length: 25 }, (_, i) => ({
        userId: `member-${i + 1}`,
        user: { id: `member-${i + 1}`, status: "ACTIVE" },
      }));

      mockPrisma.recurringSlot.findMany.mockResolvedValue([SLOT_MON_9]);
      mockPrisma.session.create.mockResolvedValue(
        makeCreatedSession("new-s1", SLOT_MON_9.id)
      );
      mockPrisma.session.findUnique.mockResolvedValue(
        makePreviousSession("prev-s1", [], members)
      );
      mockPrisma.sessionMember.createMany.mockResolvedValue({ count: 20 });

      await generateSessionsForWeek(WEEK_DATE);

      expect(mockPrisma.sessionMember.createMany).toHaveBeenCalledTimes(1);
      const createManyArgs = mockPrisma.sessionMember.createMany.mock.calls[0][0];
      expect(createManyArgs.data).toHaveLength(20);
      // Should be the first 20 members (slice preserves order)
      expect(createManyArgs.data[0].userId).toBe("member-1");
      expect(createManyArgs.data[19].userId).toBe("member-20");
    });

    it("copies all members when count is exactly MAX_CLASS_SIZE", async () => {
      const members = Array.from({ length: 20 }, (_, i) => ({
        userId: `member-${i + 1}`,
        user: { id: `member-${i + 1}`, status: "ACTIVE" },
      }));

      mockPrisma.recurringSlot.findMany.mockResolvedValue([SLOT_MON_9]);
      mockPrisma.session.create.mockResolvedValue(
        makeCreatedSession("new-s1", SLOT_MON_9.id)
      );
      mockPrisma.session.findUnique.mockResolvedValue(
        makePreviousSession("prev-s1", [], members)
      );
      mockPrisma.sessionMember.createMany.mockResolvedValue({ count: 20 });

      await generateSessionsForWeek(WEEK_DATE);

      const createManyArgs = mockPrisma.sessionMember.createMany.mock.calls[0][0];
      expect(createManyArgs.data).toHaveLength(20);
    });

    it("copies all members when count is below MAX_CLASS_SIZE", async () => {
      const members = Array.from({ length: 5 }, (_, i) => ({
        userId: `member-${i + 1}`,
        user: { id: `member-${i + 1}`, status: "ACTIVE" },
      }));

      mockPrisma.recurringSlot.findMany.mockResolvedValue([SLOT_MON_9]);
      mockPrisma.session.create.mockResolvedValue(
        makeCreatedSession("new-s1", SLOT_MON_9.id)
      );
      mockPrisma.session.findUnique.mockResolvedValue(
        makePreviousSession("prev-s1", [], members)
      );
      mockPrisma.sessionMember.createMany.mockResolvedValue({ count: 5 });

      await generateSessionsForWeek(WEEK_DATE);

      const createManyArgs = mockPrisma.sessionMember.createMany.mock.calls[0][0];
      expect(createManyArgs.data).toHaveLength(5);
    });
  });

  // ----- Multiple trainers/members -----

  describe("multiple trainers and members", () => {
    it("handles multiple trainers correctly", async () => {
      mockPrisma.recurringSlot.findMany.mockResolvedValue([SLOT_MON_9]);
      mockPrisma.session.create.mockResolvedValue(
        makeCreatedSession("new-s1", SLOT_MON_9.id)
      );
      mockPrisma.session.findUnique.mockResolvedValue(
        makePreviousSession(
          "prev-s1",
          [{ userId: "trainer-1" }, { userId: "trainer-2" }, { userId: "trainer-3" }],
          []
        )
      );
      mockPrisma.sessionTrainer.createMany.mockResolvedValue({ count: 3 });

      await generateSessionsForWeek(WEEK_DATE);

      expect(mockPrisma.sessionTrainer.createMany).toHaveBeenCalledWith({
        data: [
          { sessionId: "new-s1", userId: "trainer-1" },
          { sessionId: "new-s1", userId: "trainer-2" },
          { sessionId: "new-s1", userId: "trainer-3" },
        ],
      });
    });

    it("handles multiple members correctly", async () => {
      mockPrisma.recurringSlot.findMany.mockResolvedValue([SLOT_MON_9]);
      mockPrisma.session.create.mockResolvedValue(
        makeCreatedSession("new-s1", SLOT_MON_9.id)
      );
      mockPrisma.session.findUnique.mockResolvedValue(
        makePreviousSession("prev-s1", [], [
          { userId: "member-1", user: { id: "member-1", status: "ACTIVE" } },
          { userId: "member-2", user: { id: "member-2", status: "ACTIVE" } },
          { userId: "member-3", user: { id: "member-3", status: "TRIAL" } },
        ])
      );
      mockPrisma.sessionMember.createMany.mockResolvedValue({ count: 3 });

      await generateSessionsForWeek(WEEK_DATE);

      expect(mockPrisma.sessionMember.createMany).toHaveBeenCalledWith({
        data: [
          { sessionId: "new-s1", userId: "member-1" },
          { sessionId: "new-s1", userId: "member-2" },
          { sessionId: "new-s1", userId: "member-3" },
        ],
      });
    });
  });

  // ----- Edge cases -----

  describe("edge cases", () => {
    it("handles a mix of slots: some with previous sessions, some without", async () => {
      mockPrisma.recurringSlot.findMany.mockResolvedValue([
        SLOT_MON_9,
        SLOT_WED_18,
      ]);

      mockPrisma.session.create
        .mockResolvedValueOnce(makeCreatedSession("new-mon", SLOT_MON_9.id))
        .mockResolvedValueOnce(makeCreatedSession("new-wed", SLOT_WED_18.id));

      // Mon slot has a previous session with assignments; Wed slot does not
      mockPrisma.session.findUnique
        .mockResolvedValueOnce(
          makePreviousSession(
            "prev-mon",
            [{ userId: "trainer-1" }],
            [{ userId: "member-1", user: { id: "member-1", status: "ACTIVE" } }]
          )
        )
        .mockResolvedValueOnce(null); // No previous session for Wed

      mockPrisma.sessionTrainer.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.sessionMember.createMany.mockResolvedValue({ count: 1 });

      const result = await generateSessionsForWeek(WEEK_DATE);

      expect(result).toHaveLength(2);
      // Only Mon slot should have copy calls
      expect(mockPrisma.sessionTrainer.createMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.sessionMember.createMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.sessionTrainer.createMany).toHaveBeenCalledWith({
        data: [{ sessionId: "new-mon", userId: "trainer-1" }],
      });
    });

    it("returns empty array when there are no recurring slots", async () => {
      mockPrisma.recurringSlot.findMany.mockResolvedValue([]);

      const result = await generateSessionsForWeek(WEEK_DATE);

      expect(result).toEqual([]);
      expect(mockPrisma.session.create).not.toHaveBeenCalled();
      expect(mockPrisma.session.findUnique).not.toHaveBeenCalled();
    });

    it("previous week date is calculated as weekDate minus 7 days", async () => {
      mockPrisma.recurringSlot.findMany.mockResolvedValue([SLOT_MON_9]);
      mockPrisma.session.create.mockResolvedValue(
        makeCreatedSession("new-s1", SLOT_MON_9.id)
      );
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await generateSessionsForWeek(WEEK_DATE);

      // Verify the findUnique lookup used the correct previous week date
      expect(mockPrisma.session.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            recurringSlotId_weekDate: {
              recurringSlotId: SLOT_MON_9.id,
              weekDate: PREV_WEEK_DATE,
            },
          },
        })
      );
    });
  });

  // ----- Error handling -----

  describe("error handling", () => {
    it("rethrows non-P2002 errors from session.create", async () => {
      mockPrisma.recurringSlot.findMany.mockResolvedValue([SLOT_MON_9]);

      const dbError = new Error("Connection refused");
      mockPrisma.session.create.mockRejectedValue(dbError);

      await expect(generateSessionsForWeek(WEEK_DATE)).rejects.toThrow(
        "Connection refused"
      );
    });
  });
});
