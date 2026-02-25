import { describe, it, expect } from "vitest";
import {
  computeAttendanceAnalytics,
  type AttendanceRecordInput,
  type MemberInput,
  type SessionVoteInput,
} from "../attendance-analytics";

// ── Helpers ─────────────────────────────────────────────────────────

function makeMember(id: string, name: string): MemberInput {
  return { id, name };
}

function makeRecord(
  sessionId: string,
  userId: string,
  present: boolean
): AttendanceRecordInput {
  return { sessionId, userId, present };
}

function makeSessionVote(
  sessionId: string,
  votes: Array<{ userId: string; attending: boolean }>
): SessionVoteInput {
  return { sessionId, votes };
}

const MEMBERS: MemberInput[] = [
  makeMember("m1", "Alice"),
  makeMember("m2", "Bob"),
  makeMember("m3", "Charlie"),
];

// ── Empty input ─────────────────────────────────────────────────────

describe("computeAttendanceAnalytics", () => {
  it("returns empty results for empty records", () => {
    const result = computeAttendanceAnalytics([], MEMBERS, []);
    expect(result.memberRates).toEqual([]);
    expect(result.voteVsActual).toEqual({
      totalVotedComing: 0,
      totalActuallyAttended: 0,
      reliability: 0,
    });
  });

  // ── Member rates ────────────────────────────────────────────────

  describe("memberRates", () => {
    it("computes per-member attendance rate correctly", () => {
      const records: AttendanceRecordInput[] = [
        makeRecord("s1","m1",true),
        makeRecord("s2","m1",true),
        makeRecord("s1","m2",false),
        makeRecord("s2","m2",true),
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS, []);

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
        makeRecord("s1","m1",true),
        makeRecord("s2","m1",true),
        makeRecord("s1","m2",false),
        makeRecord("s2","m2",false),
        makeRecord("s1","m3",true),
        makeRecord("s2","m3",false),
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS, []);

      expect(result.memberRates[0].name).toBe("Bob"); // 0%
      expect(result.memberRates[1].name).toBe("Charlie"); // 50%
      expect(result.memberRates[2].name).toBe("Alice"); // 100%
    });

    it("shows 'Unknown' for members not in the lookup list", () => {
      const records: AttendanceRecordInput[] = [
        makeRecord("s1","unknown-id",true),
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS, []);
      expect(result.memberRates[0].name).toBe("Unknown");
    });

    it("includes sessions where member voted yes in expected count", () => {
      // Member has 1 attendance record (s1) + 1 vote-yes session (s2) = expected 2, attended 1
      const records: AttendanceRecordInput[] = [
        makeRecord("s1","m1",true),
      ];
      const votes = [
        makeSessionVote("s2", [{ userId: "m1", attending: true }]),
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS, votes);

      const alice = result.memberRates.find((m) => m.name === "Alice");
      expect(alice).toBeDefined();
      expect(alice!.expected).toBe(2);
      expect(alice!.attended).toBe(1);
      expect(alice!.rate).toBe(50);
    });

    it("does not double-count sessions in expected when member has both attendance record and vote", () => {
      // Same sessionId in both attendance record and vote = expected 1
      const records: AttendanceRecordInput[] = [
        makeRecord("s1","m1",true),
      ];
      const votes = [
        makeSessionVote("s1", [{ userId: "m1", attending: true }]),
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS, votes);

      const alice = result.memberRates.find((m) => m.name === "Alice");
      expect(alice).toBeDefined();
      expect(alice!.expected).toBe(1);
      expect(alice!.attended).toBe(1);
      expect(alice!.rate).toBe(100);
    });

    it("counts member who only voted yes with no attendance record as expected=1 attended=0", () => {
      const records: AttendanceRecordInput[] = [];
      const votes = [
        makeSessionVote("s1", [{ userId: "m1", attending: true }]),
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS, votes);

      const alice = result.memberRates.find((m) => m.name === "Alice");
      expect(alice).toBeDefined();
      expect(alice!.expected).toBe(1);
      expect(alice!.attended).toBe(0);
      expect(alice!.rate).toBe(0);
    });

    it("does not include sessions where member voted no in expected", () => {
      const records: AttendanceRecordInput[] = [];
      const votes = [
        makeSessionVote("s1", [{ userId: "m1", attending: false }]),
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS, votes);

      // m1 voted no, so should not appear in memberRates at all
      expect(result.memberRates).toHaveLength(0);
    });

    it("counts attendance records for voting members who showed up", () => {
      // m1 voted yes for s1 and also has an attendance record showing present
      const records: AttendanceRecordInput[] = [
        makeRecord("s1","m1",true),
        makeRecord("s1","m2",false),
      ];
      const votes = [
        makeSessionVote("s1", [
          { userId: "m1", attending: true },
          { userId: "m2", attending: true },
        ]),
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS, votes);

      const alice = result.memberRates.find((m) => m.name === "Alice");
      expect(alice!.expected).toBe(1);
      expect(alice!.attended).toBe(1);
      expect(alice!.rate).toBe(100);

      const bob = result.memberRates.find((m) => m.name === "Bob");
      expect(bob!.expected).toBe(1);
      expect(bob!.attended).toBe(0);
      expect(bob!.rate).toBe(0);
    });
  });

  // ── Vote vs. Actual ─────────────────────────────────────────────

  describe("voteVsActual", () => {
    it("computes vote reliability from voting sessions only", () => {
      const records: AttendanceRecordInput[] = [
        makeRecord("s1","m1",true),
        makeRecord("s1","m2",false),
        makeRecord("s1","m3",false),
      ];
      const votes = [
        makeSessionVote("s1", [
          { userId: "m1", attending: true },
          { userId: "m2", attending: true },
          { userId: "m3", attending: false },
        ]),
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS, votes);

      expect(result.voteVsActual.totalVotedComing).toBe(2);
      expect(result.voteVsActual.totalActuallyAttended).toBe(1);
      expect(result.voteVsActual.reliability).toBe(50); // 1/2 = 50%
    });

    it("returns 0 reliability when no one voted coming", () => {
      const records: AttendanceRecordInput[] = [
        makeRecord("s1","m1",true),
      ];
      const votes = [
        makeSessionVote("s1", [{ userId: "m1", attending: false }]),
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS, votes);

      expect(result.voteVsActual.totalVotedComing).toBe(0);
      expect(result.voteVsActual.reliability).toBe(0);
    });

    it("returns 0 when sessionVotes is empty", () => {
      const records: AttendanceRecordInput[] = [
        makeRecord("s1","m1",true),
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS, []);

      expect(result.voteVsActual.totalVotedComing).toBe(0);
      expect(result.voteVsActual.totalActuallyAttended).toBe(0);
      expect(result.voteVsActual.reliability).toBe(0);
    });

    it("excludes non-voting sessions from actually-attended count", () => {
      // s1 has votes (voting session), s2 has no votes (non-voting session)
      const records: AttendanceRecordInput[] = [
        makeRecord("s1","m1",true),
        makeRecord("s2","m2",true),
      ];
      const votes = [
        makeSessionVote("s1", [{ userId: "m1", attending: true }]),
        // s2 is not in sessionVotes at all, so it's a non-voting session
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS, votes);

      // Only s1 counts: 1 voted coming, 1 actually attended
      expect(result.voteVsActual.totalVotedComing).toBe(1);
      expect(result.voteVsActual.totalActuallyAttended).toBe(1);
      expect(result.voteVsActual.reliability).toBe(100);
    });

    it("aggregates across multiple voting sessions", () => {
      const records: AttendanceRecordInput[] = [
        makeRecord("s1","m1",true),
        makeRecord("s1","m2",true),
        makeRecord("s2","m1",false),
      ];
      const votes = [
        makeSessionVote("s1", [
          { userId: "m1", attending: true },
          { userId: "m2", attending: true },
        ]),
        makeSessionVote("s2", [{ userId: "m1", attending: true }]),
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS, votes);

      expect(result.voteVsActual.totalVotedComing).toBe(3); // 2 + 1
      expect(result.voteVsActual.totalActuallyAttended).toBe(2);
      expect(result.voteVsActual.reliability).toBe(67); // 2/3 = 67%
    });
  });

  // ── Edge cases ──────────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles all members absent (0% rate)", () => {
      const records: AttendanceRecordInput[] = [
        makeRecord("s1","m1",false),
        makeRecord("s1","m2",false),
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS, []);

      for (const rate of result.memberRates) {
        expect(rate.rate).toBe(0);
      }
    });

    it("handles all members present (100% rate)", () => {
      const records: AttendanceRecordInput[] = [
        makeRecord("s1","m1",true),
        makeRecord("s1","m2",true),
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS, []);

      for (const rate of result.memberRates) {
        expect(rate.rate).toBe(100);
      }
    });

    it("handles single record", () => {
      const records: AttendanceRecordInput[] = [
        makeRecord("s1","m1",true),
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS, []);

      expect(result.memberRates).toHaveLength(1);
    });

    it("handles empty members array (all names show as Unknown)", () => {
      const records: AttendanceRecordInput[] = [
        makeRecord("s1","m1",true),
        makeRecord("s1","m2",false),
      ];

      const result = computeAttendanceAnalytics(records, [], []);

      expect(result.memberRates).toHaveLength(2);
      for (const rate of result.memberRates) {
        expect(rate.name).toBe("Unknown");
      }
    });

    it("rounds rate correctly for 1/3 (33%, not 33.333)", () => {
      const records: AttendanceRecordInput[] = [
        makeRecord("s1","m1",true),
        makeRecord("s2","m1",false),
        makeRecord("s3","m1",false),
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS, []);

      const alice = result.memberRates.find((m) => m.name === "Alice");
      expect(alice!.rate).toBe(33);
    });

    it("rounds rate correctly for 2/3 (67%, not 66.666)", () => {
      const records: AttendanceRecordInput[] = [
        makeRecord("s1","m1",true),
        makeRecord("s2","m1",true),
        makeRecord("s3","m1",false),
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS, []);

      const alice = result.memberRates.find((m) => m.name === "Alice");
      expect(alice!.rate).toBe(67);
    });

    it("rounds rate correctly for 1/6 (17%)", () => {
      const records: AttendanceRecordInput[] = [
        makeRecord("s1","m1",true),
        makeRecord("s2","m1",false),
        makeRecord("s3","m1",false),
        makeRecord("s4","m1",false),
        makeRecord("s5","m1",false),
        makeRecord("s6","m1",false),
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS, []);

      const alice = result.memberRates.find((m) => m.name === "Alice");
      expect(alice!.rate).toBe(17);
    });
  });

  // ── Session votes with empty votes array ────────────────────────

  describe("sessionVotes with empty votes array", () => {
    it("ignores sessions with votes.length === 0 in voteVsActual", () => {
      const records: AttendanceRecordInput[] = [
        makeRecord("s1","m1",true),
      ];
      // s1 has an empty votes array (not a voting session)
      const votes = [
        makeSessionVote("s1", []),
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS, votes);

      // Empty votes array means this is NOT a voting session
      expect(result.voteVsActual.totalVotedComing).toBe(0);
      expect(result.voteVsActual.totalActuallyAttended).toBe(0);
      expect(result.voteVsActual.reliability).toBe(0);
    });

    it("ignores empty votes in memberRates expected count", () => {
      const records: AttendanceRecordInput[] = [
        makeRecord("s1","m1",true),
      ];
      const votes = [
        makeSessionVote("s2", []), // empty votes — should NOT add to anyone's expected
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS, votes);

      expect(result.memberRates).toHaveLength(1);
      const alice = result.memberRates.find((m) => m.name === "Alice");
      expect(alice!.expected).toBe(1); // only s1 from records
    });
  });

  // ── Multiple members voting across sessions ─────────────────────

  describe("complex multi-member multi-session scenarios", () => {
    it("handles mix of vote-only, record-only, and both members", () => {
      // m1: has attendance records (s1, s2) and votes yes on s3 → expected 3, attended 2
      // m2: only voted yes on s3, no attendance records → expected 1, attended 0
      // m3: only has attendance record for s1 → expected 1, attended 1
      const records: AttendanceRecordInput[] = [
        makeRecord("s1","m1",true),
        makeRecord("s2","m1",true),
        makeRecord("s1","m3",true),
      ];
      const votes = [
        makeSessionVote("s3", [
          { userId: "m1", attending: true },
          { userId: "m2", attending: true },
        ]),
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS, votes);

      expect(result.memberRates).toHaveLength(3);

      const alice = result.memberRates.find((m) => m.name === "Alice");
      expect(alice!.expected).toBe(3);
      expect(alice!.attended).toBe(2);
      expect(alice!.rate).toBe(67);

      const bob = result.memberRates.find((m) => m.name === "Bob");
      expect(bob!.expected).toBe(1);
      expect(bob!.attended).toBe(0);
      expect(bob!.rate).toBe(0);

      const charlie = result.memberRates.find((m) => m.name === "Charlie");
      expect(charlie!.expected).toBe(1);
      expect(charlie!.attended).toBe(1);
      expect(charlie!.rate).toBe(100);
    });

    it("handles member voting yes across multiple sessions", () => {
      // m1 voted yes on s1, s2, s3 — has attendance for s1 (present), s2 (absent)
      const records: AttendanceRecordInput[] = [
        makeRecord("s1","m1",true),
        makeRecord("s2","m1",false),
      ];
      const votes = [
        makeSessionVote("s1", [{ userId: "m1", attending: true }]),
        makeSessionVote("s2", [{ userId: "m1", attending: true }]),
        makeSessionVote("s3", [{ userId: "m1", attending: true }]),
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS, votes);

      const alice = result.memberRates.find((m) => m.name === "Alice");
      expect(alice!.expected).toBe(3); // s1, s2, s3 (Set dedup)
      expect(alice!.attended).toBe(1); // only s1 present
      expect(alice!.rate).toBe(33);
    });

    it("handles large dataset with 50 members", () => {
      const members: MemberInput[] = Array.from({ length: 50 }, (_, i) =>
        makeMember(`m${i}`, `Member ${i}`)
      );

      const records: AttendanceRecordInput[] = members.map((m, i) =>
        makeRecord("s1", m.id, i % 2 === 0)
      );

      const result = computeAttendanceAnalytics(records, members, []);

      expect(result.memberRates).toHaveLength(50);
      // First in sorted order should be 0% members
      expect(result.memberRates[0].rate).toBe(0);
      // Last should be 100% members
      expect(result.memberRates[result.memberRates.length - 1].rate).toBe(100);
    });

    it("correctly separates voteVsActual from non-voting session attendance", () => {
      // s1: voting session (2 voted yes), s2: non-voting session
      // Both have attendance records
      const records: AttendanceRecordInput[] = [
        makeRecord("s1","m1",true),
        makeRecord("s1","m2",true),
        makeRecord("s2","m1",true), // non-voting session — should NOT count for voteVsActual
        makeRecord("s2","m2",false),
      ];
      const votes = [
        makeSessionVote("s1", [
          { userId: "m1", attending: true },
          { userId: "m2", attending: true },
        ]),
        // s2 not in votes at all — non-voting session
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS, votes);

      // voteVsActual: only s1 counts
      expect(result.voteVsActual.totalVotedComing).toBe(2);
      expect(result.voteVsActual.totalActuallyAttended).toBe(2);
      expect(result.voteVsActual.reliability).toBe(100);

      // memberRates: both sessions count for expected
      const alice = result.memberRates.find((m) => m.name === "Alice");
      expect(alice!.expected).toBe(2); // s1 + s2
      expect(alice!.attended).toBe(2); // present in both
    });

    it("voteVsActual reliability rounding: 1/3 = 33%", () => {
      const records: AttendanceRecordInput[] = [
        makeRecord("s1","m1",true),
        makeRecord("s1","m2",false),
        makeRecord("s1","m3",false),
      ];
      const votes = [
        makeSessionVote("s1", [
          { userId: "m1", attending: true },
          { userId: "m2", attending: true },
          { userId: "m3", attending: true },
        ]),
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS, votes);

      expect(result.voteVsActual.totalVotedComing).toBe(3);
      expect(result.voteVsActual.totalActuallyAttended).toBe(1);
      expect(result.voteVsActual.reliability).toBe(33);
    });

    it("voteVsActual counts attendance of non-voters in voting sessions", () => {
      // s1 is a voting session (m1 voted yes)
      // m2 has an attendance record in s1 (present) but did NOT vote
      // m2's attendance should still count in totalActuallyAttended
      const records: AttendanceRecordInput[] = [
        makeRecord("s1","m1",true),
        makeRecord("s1","m2",true), // m2 present but didn't vote
      ];
      const votes = [
        makeSessionVote("s1", [
          { userId: "m1", attending: true },
        ]),
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS, votes);

      expect(result.voteVsActual.totalVotedComing).toBe(1);
      // Both m1 and m2 were present in the voting session
      expect(result.voteVsActual.totalActuallyAttended).toBe(2);
    });

    it("reliability can exceed 100% when walk-ins attend voting sessions", () => {
      // s1: 1 voted coming, but 3 members actually attended (2 walk-ins)
      const records: AttendanceRecordInput[] = [
        makeRecord("s1","m1",true),
        makeRecord("s1","m2",true),
        makeRecord("s1","m3",true),
      ];
      const votes = [
        makeSessionVote("s1", [
          { userId: "m1", attending: true },
        ]),
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS, votes);

      expect(result.voteVsActual.totalVotedComing).toBe(1);
      expect(result.voteVsActual.totalActuallyAttended).toBe(3);
      // 3/1 = 300% — intentional: includes non-voters who showed up
      expect(result.voteVsActual.reliability).toBe(300);
    });

    it("does not include vote-no members in expected for memberRates", () => {
      // m1 voted yes, m2 voted no, m3 has attendance record
      const records: AttendanceRecordInput[] = [
        makeRecord("s1","m3",true),
      ];
      const votes = [
        makeSessionVote("s1", [
          { userId: "m1", attending: true },
          { userId: "m2", attending: false },
        ]),
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS, votes);

      // m1 and m3 should be in memberRates, m2 should NOT
      expect(result.memberRates).toHaveLength(2);
      const memberNames = result.memberRates.map((m) => m.name);
      expect(memberNames).toContain("Alice"); // m1
      expect(memberNames).toContain("Charlie"); // m3
      expect(memberNames).not.toContain("Bob"); // m2 voted no
    });
  });

  // ── Return type structure ────────────────────────────────────────

  describe("return type structure", () => {
    it("returns AttendanceAnalyticsResult with correct shape", () => {
      const result = computeAttendanceAnalytics([], MEMBERS, []);

      expect(result).toHaveProperty("memberRates");
      expect(result).toHaveProperty("voteVsActual");
      expect(Array.isArray(result.memberRates)).toBe(true);
      expect(result.voteVsActual).toHaveProperty("totalVotedComing");
      expect(result.voteVsActual).toHaveProperty("totalActuallyAttended");
      expect(result.voteVsActual).toHaveProperty("reliability");
    });

    it("memberRates entries have correct shape", () => {
      const records: AttendanceRecordInput[] = [
        makeRecord("s1","m1",true),
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS, []);

      expect(result.memberRates[0]).toHaveProperty("name");
      expect(result.memberRates[0]).toHaveProperty("expected");
      expect(result.memberRates[0]).toHaveProperty("attended");
      expect(result.memberRates[0]).toHaveProperty("rate");
      expect(typeof result.memberRates[0].name).toBe("string");
      expect(typeof result.memberRates[0].expected).toBe("number");
      expect(typeof result.memberRates[0].attended).toBe("number");
      expect(typeof result.memberRates[0].rate).toBe("number");
    });

    it("rate is always an integer (no decimals)", () => {
      const records: AttendanceRecordInput[] = [
        makeRecord("s1","m1",true),
        makeRecord("s2","m1",false),
        makeRecord("s3","m1",false),
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS, []);

      const alice = result.memberRates.find((m) => m.name === "Alice");
      expect(Number.isInteger(alice!.rate)).toBe(true);
    });

    it("reliability is always an integer (no decimals)", () => {
      const records: AttendanceRecordInput[] = [
        makeRecord("s1","m1",true),
        makeRecord("s1","m2",false),
        makeRecord("s1","m3",false),
      ];
      const votes = [
        makeSessionVote("s1", [
          { userId: "m1", attending: true },
          { userId: "m2", attending: true },
          { userId: "m3", attending: true },
        ]),
      ];

      const result = computeAttendanceAnalytics(records, MEMBERS, votes);

      expect(Number.isInteger(result.voteVsActual.reliability)).toBe(true);
    });
  });
});
