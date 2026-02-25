/**
 * Analytics Attendance Metrics Tests
 *
 * Tests the attendance analytics section of GET /api/analytics:
 * - memberRates: per-member attendance rates (from attendance records + session votes)
 * - voteVsActual: vote reliability metric (only counts voting sessions)
 *
 * The analytics route delegates to computeAttendanceAnalytics() which receives:
 *   - attendanceRecords: { sessionId, userId, present }[]
 *   - members: { id, name }[]
 *   - sessionVotes: { sessionId, votes: { userId, attending }[] }[]
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ===== Mocks =====

vi.mock("@/lib/rate-limit", () => ({
  publicLimiter: { check: () => ({ allowed: true, remaining: 10, retryAfterMs: 0 }) },
  authWriteLimiter: { check: () => ({ allowed: true, remaining: 10, retryAfterMs: 0 }) },
  authReadLimiter: { check: () => ({ allowed: true, remaining: 10, retryAfterMs: 0 }) },
  cronLimiter: { check: () => ({ allowed: true, remaining: 10, retryAfterMs: 0 }) },
  getClientIp: () => "127.0.0.1",
  createRateLimitResponse: () => Response.json({ error: "Rate limited" }, { status: 429 }),
}));

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/payment-logic", () => ({
  getPaymentStatus: vi.fn().mockReturnValue("PAID"),
}));

const mockPrisma = {
  user: { findMany: vi.fn() },
  session: { findMany: vi.fn() },
  payment: { findMany: vi.fn() },
  privateSession: { findMany: vi.fn() },
  attendanceRecord: { findMany: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

// ===== Helpers =====

function ownerSession(): { user: { id: string; email: string; role: string; status: string } } {
  return { user: { id: "owner-1", email: "owner@test.com", role: "OWNER", status: "ACTIVE" } };
}

function makeRequest(startDate: string, endDate: string): Request {
  return new Request(
    `http://localhost/api/analytics?startDate=${startDate}&endDate=${endDate}`
  );
}

function makeCsvRequest(startDate: string, endDate: string): Request {
  return new Request(
    `http://localhost/api/analytics?startDate=${startDate}&endDate=${endDate}`,
    { headers: { Accept: "text/csv" } }
  );
}

function defaultMocks(): void {
  mockAuth.mockResolvedValue(ownerSession());
  mockPrisma.user.findMany.mockResolvedValue([]);
  mockPrisma.session.findMany.mockResolvedValue([]);
  mockPrisma.payment.findMany.mockResolvedValue([]);
  mockPrisma.privateSession.findMany.mockResolvedValue([]);
  mockPrisma.attendanceRecord.findMany.mockResolvedValue([]);
}

// ===== Tests =====

describe("GET /api/analytics — attendance response shape", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes attendance key with memberRates and voteVsActual", async () => {
    defaultMocks();

    const { GET } = await import("@/app/api/analytics/route");
    const response = await GET(makeRequest("2026-01-01", "2026-01-31"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveProperty("attendance");
    expect(body.data.attendance).toHaveProperty("memberRates");
    expect(body.data.attendance).toHaveProperty("voteVsActual");
  });

  it("does NOT include slotRates or trend (removed features)", async () => {
    defaultMocks();

    const { GET } = await import("@/app/api/analytics/route");
    const response = await GET(makeRequest("2026-01-01", "2026-01-31"));
    const body = await response.json();

    expect(body.data.attendance).not.toHaveProperty("slotRates");
    expect(body.data.attendance).not.toHaveProperty("trend");
  });

  it("returns empty memberRates and zero reliability for no data", async () => {
    defaultMocks();

    const { GET } = await import("@/app/api/analytics/route");
    const response = await GET(makeRequest("2026-01-01", "2026-01-31"));
    const body = await response.json();

    const { attendance } = body.data;
    expect(attendance.memberRates).toEqual([]);
    expect(attendance.voteVsActual).toEqual({
      totalVotedComing: 0,
      totalActuallyAttended: 0,
      reliability: 0,
    });
  });
});

describe("GET /api/analytics — memberRates from attendance records", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("computes correct per-member rates from attendance records", async () => {
    defaultMocks();

    mockPrisma.user.findMany.mockResolvedValue([
      { id: "m-1", name: "Alice", status: "ACTIVE", joinDate: new Date("2025-01-01"), trialEndsAt: null, departedAt: null, overrideActive: false },
      { id: "m-2", name: "Bob", status: "ACTIVE", joinDate: new Date("2025-01-01"), trialEndsAt: null, departedAt: null, overrideActive: false },
    ]);

    // Sessions with no votes (non-voting sessions)
    mockPrisma.session.findMany.mockResolvedValue([
      { id: "s-1", weekDate: new Date("2026-01-05"), status: "SCHEDULED", recurringSlotId: "slot-1", recurringSlot: { dayOfWeek: 1, startHour: 9 }, customDay: null, customStartHour: null, votes: [], members: [{ userId: "m-1" }, { userId: "m-2" }] },
      { id: "s-2", weekDate: new Date("2026-01-12"), status: "SCHEDULED", recurringSlotId: "slot-1", recurringSlot: { dayOfWeek: 1, startHour: 9 }, customDay: null, customStartHour: null, votes: [], members: [{ userId: "m-1" }, { userId: "m-2" }] },
      { id: "s-3", weekDate: new Date("2026-01-19"), status: "SCHEDULED", recurringSlotId: "slot-1", recurringSlot: { dayOfWeek: 1, startHour: 9 }, customDay: null, customStartHour: null, votes: [], members: [{ userId: "m-1" }, { userId: "m-2" }] },
    ]);

    mockPrisma.attendanceRecord.findMany.mockResolvedValue([
      // Alice: 2 out of 3 sessions present
      { sessionId: "s-1", userId: "m-1", present: true },
      { sessionId: "s-2", userId: "m-1", present: true },
      { sessionId: "s-3", userId: "m-1", present: false },
      // Bob: 1 out of 3 sessions present
      { sessionId: "s-1", userId: "m-2", present: true },
      { sessionId: "s-2", userId: "m-2", present: false },
      { sessionId: "s-3", userId: "m-2", present: false },
    ]);

    const { GET } = await import("@/app/api/analytics/route");
    const response = await GET(makeRequest("2026-01-01", "2026-01-31"));
    const body = await response.json();

    const { memberRates } = body.data.attendance;
    expect(memberRates).toHaveLength(2);

    // Sorted ascending by rate: Bob (33%) first, then Alice (67%)
    expect(memberRates[0].name).toBe("Bob");
    expect(memberRates[0].expected).toBe(3);
    expect(memberRates[0].attended).toBe(1);
    expect(memberRates[0].rate).toBe(33);

    expect(memberRates[1].name).toBe("Alice");
    expect(memberRates[1].expected).toBe(3);
    expect(memberRates[1].attended).toBe(2);
    expect(memberRates[1].rate).toBe(67);
  });

  it("members with no attendance records and no votes do not appear in memberRates", async () => {
    defaultMocks();

    mockPrisma.user.findMany.mockResolvedValue([
      { id: "m-1", name: "Alice", status: "ACTIVE", joinDate: new Date("2025-01-01"), trialEndsAt: null, departedAt: null, overrideActive: false },
      { id: "m-2", name: "Bob", status: "ACTIVE", joinDate: new Date("2025-01-01"), trialEndsAt: null, departedAt: null, overrideActive: false },
    ]);

    mockPrisma.session.findMany.mockResolvedValue([]);

    // Only Alice has attendance records
    mockPrisma.attendanceRecord.findMany.mockResolvedValue([
      { sessionId: "s-1", userId: "m-1", present: true },
    ]);

    const { GET } = await import("@/app/api/analytics/route");
    const response = await GET(makeRequest("2026-01-01", "2026-01-31"));
    const body = await response.json();

    const { memberRates } = body.data.attendance;
    expect(memberRates).toHaveLength(1);
    expect(memberRates[0].name).toBe("Alice");
    expect(memberRates[0].rate).toBe(100);
  });

  it("departed member with attendance records still appears in memberRates", async () => {
    defaultMocks();

    mockPrisma.user.findMany.mockResolvedValue([
      { id: "m-1", name: "Alice", status: "DEPARTED", joinDate: new Date("2025-01-01"), trialEndsAt: null, departedAt: new Date("2026-01-15"), overrideActive: false },
      { id: "m-2", name: "Bob", status: "ACTIVE", joinDate: new Date("2025-01-01"), trialEndsAt: null, departedAt: null, overrideActive: false },
    ]);

    mockPrisma.session.findMany.mockResolvedValue([]);

    mockPrisma.attendanceRecord.findMany.mockResolvedValue([
      { sessionId: "s-1", userId: "m-1", present: true },
      { sessionId: "s-2", userId: "m-1", present: false },
      { sessionId: "s-1", userId: "m-2", present: true },
      { sessionId: "s-2", userId: "m-2", present: true },
    ]);

    const { GET } = await import("@/app/api/analytics/route");
    const response = await GET(makeRequest("2026-01-01", "2026-01-31"));
    const body = await response.json();

    const { memberRates } = body.data.attendance;
    expect(memberRates).toHaveLength(2);

    const alice = memberRates.find((m: { name: string }) => m.name === "Alice");
    expect(alice).toBeDefined();
    expect(alice.expected).toBe(2);
    expect(alice.attended).toBe(1);
    expect(alice.rate).toBe(50);
  });

  it("handles all-present attendance records correctly (100% rate)", async () => {
    defaultMocks();

    mockPrisma.user.findMany.mockResolvedValue([
      { id: "m-1", name: "Perfect Alice", status: "ACTIVE", joinDate: new Date("2025-01-01"), trialEndsAt: null, departedAt: null, overrideActive: false },
    ]);

    mockPrisma.session.findMany.mockResolvedValue([]);

    mockPrisma.attendanceRecord.findMany.mockResolvedValue([
      { sessionId: "s-1", userId: "m-1", present: true },
      { sessionId: "s-2", userId: "m-1", present: true },
      { sessionId: "s-3", userId: "m-1", present: true },
    ]);

    const { GET } = await import("@/app/api/analytics/route");
    const response = await GET(makeRequest("2026-01-01", "2026-01-31"));
    const body = await response.json();

    const { memberRates } = body.data.attendance;
    expect(memberRates).toHaveLength(1);
    expect(memberRates[0].name).toBe("Perfect Alice");
    expect(memberRates[0].rate).toBe(100);
    expect(memberRates[0].expected).toBe(3);
    expect(memberRates[0].attended).toBe(3);
  });

  it("handles all-absent attendance records correctly (0% rate)", async () => {
    defaultMocks();

    mockPrisma.user.findMany.mockResolvedValue([
      { id: "m-1", name: "Absent Bob", status: "ACTIVE", joinDate: new Date("2025-01-01"), trialEndsAt: null, departedAt: null, overrideActive: false },
    ]);

    mockPrisma.session.findMany.mockResolvedValue([]);

    mockPrisma.attendanceRecord.findMany.mockResolvedValue([
      { sessionId: "s-1", userId: "m-1", present: false },
      { sessionId: "s-2", userId: "m-1", present: false },
    ]);

    const { GET } = await import("@/app/api/analytics/route");
    const response = await GET(makeRequest("2026-01-01", "2026-01-31"));
    const body = await response.json();

    const { memberRates } = body.data.attendance;
    expect(memberRates).toHaveLength(1);
    expect(memberRates[0].name).toBe("Absent Bob");
    expect(memberRates[0].rate).toBe(0);
    expect(memberRates[0].expected).toBe(2);
    expect(memberRates[0].attended).toBe(0);
  });
});

describe("GET /api/analytics — memberRates from session votes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes sessions where member voted yes in expected count", async () => {
    defaultMocks();

    mockPrisma.user.findMany.mockResolvedValue([
      { id: "m-1", name: "Alice", status: "ACTIVE", joinDate: new Date("2025-01-01"), trialEndsAt: null, departedAt: null, overrideActive: false },
    ]);

    // Session with vote but no attendance record for m-1
    mockPrisma.session.findMany.mockResolvedValue([
      { id: "s-1", weekDate: new Date("2026-01-05"), status: "SCHEDULED", recurringSlotId: "slot-1", recurringSlot: { dayOfWeek: 1, startHour: 9 }, customDay: null, customStartHour: null, votes: [{ userId: "m-1", attending: true }], members: [] },
    ]);

    // No attendance records
    mockPrisma.attendanceRecord.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/analytics/route");
    const response = await GET(makeRequest("2026-01-01", "2026-01-31"));
    const body = await response.json();

    const { memberRates } = body.data.attendance;
    expect(memberRates).toHaveLength(1);
    expect(memberRates[0].name).toBe("Alice");
    expect(memberRates[0].expected).toBe(1);
    expect(memberRates[0].attended).toBe(0);
    expect(memberRates[0].rate).toBe(0);
  });

  it("does not count sessions where member voted no", async () => {
    defaultMocks();

    mockPrisma.user.findMany.mockResolvedValue([
      { id: "m-1", name: "Alice", status: "ACTIVE", joinDate: new Date("2025-01-01"), trialEndsAt: null, departedAt: null, overrideActive: false },
    ]);

    // Session where Alice voted "no"
    mockPrisma.session.findMany.mockResolvedValue([
      { id: "s-1", weekDate: new Date("2026-01-05"), status: "SCHEDULED", recurringSlotId: "slot-1", recurringSlot: { dayOfWeek: 1, startHour: 9 }, customDay: null, customStartHour: null, votes: [{ userId: "m-1", attending: false }], members: [] },
    ]);

    mockPrisma.attendanceRecord.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/analytics/route");
    const response = await GET(makeRequest("2026-01-01", "2026-01-31"));
    const body = await response.json();

    const { memberRates } = body.data.attendance;
    // Alice voted no, so should not appear at all
    expect(memberRates).toHaveLength(0);
  });

  it("does not double-count when member has both attendance record and vote for same session", async () => {
    defaultMocks();

    mockPrisma.user.findMany.mockResolvedValue([
      { id: "m-1", name: "Alice", status: "ACTIVE", joinDate: new Date("2025-01-01"), trialEndsAt: null, departedAt: null, overrideActive: false },
    ]);

    // Session with vote
    mockPrisma.session.findMany.mockResolvedValue([
      { id: "s-1", weekDate: new Date("2026-01-05"), status: "SCHEDULED", recurringSlotId: "slot-1", recurringSlot: { dayOfWeek: 1, startHour: 9 }, customDay: null, customStartHour: null, votes: [{ userId: "m-1", attending: true }], members: [] },
    ]);

    // Same session also has attendance record
    mockPrisma.attendanceRecord.findMany.mockResolvedValue([
      { sessionId: "s-1", userId: "m-1", present: true },
    ]);

    const { GET } = await import("@/app/api/analytics/route");
    const response = await GET(makeRequest("2026-01-01", "2026-01-31"));
    const body = await response.json();

    const { memberRates } = body.data.attendance;
    expect(memberRates).toHaveLength(1);
    // Expected should be 1, not 2 (Set dedup)
    expect(memberRates[0].expected).toBe(1);
    expect(memberRates[0].attended).toBe(1);
    expect(memberRates[0].rate).toBe(100);
  });

  it("combines attendance records and votes for expected count", async () => {
    defaultMocks();

    mockPrisma.user.findMany.mockResolvedValue([
      { id: "m-1", name: "Alice", status: "ACTIVE", joinDate: new Date("2025-01-01"), trialEndsAt: null, departedAt: null, overrideActive: false },
    ]);

    // s-1 has attendance record, s-2 has only a vote (no attendance record yet)
    mockPrisma.session.findMany.mockResolvedValue([
      { id: "s-1", weekDate: new Date("2026-01-05"), status: "SCHEDULED", recurringSlotId: "slot-1", recurringSlot: { dayOfWeek: 1, startHour: 9 }, customDay: null, customStartHour: null, votes: [], members: [] },
      { id: "s-2", weekDate: new Date("2026-01-12"), status: "SCHEDULED", recurringSlotId: "slot-1", recurringSlot: { dayOfWeek: 1, startHour: 9 }, customDay: null, customStartHour: null, votes: [{ userId: "m-1", attending: true }], members: [] },
    ]);

    mockPrisma.attendanceRecord.findMany.mockResolvedValue([
      { sessionId: "s-1", userId: "m-1", present: true },
    ]);

    const { GET } = await import("@/app/api/analytics/route");
    const response = await GET(makeRequest("2026-01-01", "2026-01-31"));
    const body = await response.json();

    const { memberRates } = body.data.attendance;
    expect(memberRates).toHaveLength(1);
    // Expected: s-1 (from record) + s-2 (from vote) = 2
    expect(memberRates[0].expected).toBe(2);
    // Attended: only s-1 where present=true
    expect(memberRates[0].attended).toBe(1);
    expect(memberRates[0].rate).toBe(50);
  });
});

describe("GET /api/analytics — voteVsActual", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("computes vote reliability from voting sessions only", async () => {
    defaultMocks();

    // s-1: voting session (3 voted coming, 2 showed up)
    // s-2: voting session (2 voted coming, 1 showed up)
    mockPrisma.session.findMany.mockResolvedValue([
      { id: "s-1", weekDate: new Date("2026-01-05"), status: "SCHEDULED", recurringSlotId: "slot-1", recurringSlot: { dayOfWeek: 1, startHour: 9 }, customDay: null, customStartHour: null, votes: [{ userId: "m-1", attending: true }, { userId: "m-2", attending: true }, { userId: "m-3", attending: true }], members: [] },
      { id: "s-2", weekDate: new Date("2026-01-12"), status: "SCHEDULED", recurringSlotId: "slot-1", recurringSlot: { dayOfWeek: 1, startHour: 9 }, customDay: null, customStartHour: null, votes: [{ userId: "m-1", attending: true }, { userId: "m-2", attending: true }], members: [] },
    ]);

    mockPrisma.user.findMany.mockResolvedValue([
      { id: "m-1", name: "Alice", status: "ACTIVE", joinDate: new Date("2025-01-01"), trialEndsAt: null, departedAt: null, overrideActive: false },
      { id: "m-2", name: "Bob", status: "ACTIVE", joinDate: new Date("2025-01-01"), trialEndsAt: null, departedAt: null, overrideActive: false },
      { id: "m-3", name: "Charlie", status: "ACTIVE", joinDate: new Date("2025-01-01"), trialEndsAt: null, departedAt: null, overrideActive: false },
    ]);

    mockPrisma.attendanceRecord.findMany.mockResolvedValue([
      { sessionId: "s-1", userId: "m-1", present: true },
      { sessionId: "s-1", userId: "m-2", present: true },
      { sessionId: "s-1", userId: "m-3", present: false },
      { sessionId: "s-2", userId: "m-1", present: true },
      { sessionId: "s-2", userId: "m-2", present: false },
    ]);

    const { GET } = await import("@/app/api/analytics/route");
    const response = await GET(makeRequest("2026-01-01", "2026-01-31"));
    const body = await response.json();

    const { voteVsActual } = body.data.attendance;
    expect(voteVsActual.totalVotedComing).toBe(5);
    expect(voteVsActual.totalActuallyAttended).toBe(3);
    expect(voteVsActual.reliability).toBe(60);
  });

  it("excludes non-voting sessions from voteVsActual counts", async () => {
    defaultMocks();

    // s-1: voting session, s-2: non-voting session (no votes)
    mockPrisma.session.findMany.mockResolvedValue([
      { id: "s-1", weekDate: new Date("2026-01-05"), status: "SCHEDULED", recurringSlotId: "slot-1", recurringSlot: { dayOfWeek: 1, startHour: 9 }, customDay: null, customStartHour: null, votes: [{ userId: "m-1", attending: true }], members: [] },
      { id: "s-2", weekDate: new Date("2026-01-12"), status: "SCHEDULED", recurringSlotId: "slot-1", recurringSlot: { dayOfWeek: 1, startHour: 9 }, customDay: null, customStartHour: null, votes: [], members: [{ userId: "m-2" }] },
    ]);

    mockPrisma.attendanceRecord.findMany.mockResolvedValue([
      { sessionId: "s-1", userId: "m-1", present: true },
      // s-2 attendance should NOT count for voteVsActual
      { sessionId: "s-2", userId: "m-2", present: true },
    ]);

    const { GET } = await import("@/app/api/analytics/route");
    const response = await GET(makeRequest("2026-01-01", "2026-01-31"));
    const body = await response.json();

    const { voteVsActual } = body.data.attendance;
    // Only s-1 is a voting session
    expect(voteVsActual.totalVotedComing).toBe(1);
    expect(voteVsActual.totalActuallyAttended).toBe(1);
    expect(voteVsActual.reliability).toBe(100);
  });

  it("returns 0 reliability when no one voted coming", async () => {
    defaultMocks();

    // Session with votes but all voted "no"
    mockPrisma.session.findMany.mockResolvedValue([
      { id: "s-1", weekDate: new Date("2026-01-05"), status: "SCHEDULED", recurringSlotId: "slot-1", recurringSlot: { dayOfWeek: 1, startHour: 9 }, customDay: null, customStartHour: null, votes: [{ userId: "m-1", attending: false }], members: [] },
    ]);

    mockPrisma.attendanceRecord.findMany.mockResolvedValue([
      { sessionId: "s-1", userId: "m-1", present: true },
    ]);

    const { GET } = await import("@/app/api/analytics/route");
    const response = await GET(makeRequest("2026-01-01", "2026-01-31"));
    const body = await response.json();

    const { voteVsActual } = body.data.attendance;
    // The session has votes (length > 0) so it IS a voting session,
    // but no one voted "attending: true", so totalVotedComing = 0
    expect(voteVsActual.totalVotedComing).toBe(0);
    expect(voteVsActual.reliability).toBe(0);
  });

  it("returns 0 when sessionVotes is empty (no sessions with votes)", async () => {
    defaultMocks();

    // Sessions without votes
    mockPrisma.session.findMany.mockResolvedValue([
      { id: "s-1", weekDate: new Date("2026-01-05"), status: "SCHEDULED", recurringSlotId: "slot-1", recurringSlot: { dayOfWeek: 1, startHour: 9 }, customDay: null, customStartHour: null, votes: [], members: [{ userId: "m-1" }] },
    ]);

    mockPrisma.attendanceRecord.findMany.mockResolvedValue([
      { sessionId: "s-1", userId: "m-1", present: true },
    ]);

    const { GET } = await import("@/app/api/analytics/route");
    const response = await GET(makeRequest("2026-01-01", "2026-01-31"));
    const body = await response.json();

    const { voteVsActual } = body.data.attendance;
    expect(voteVsActual.totalVotedComing).toBe(0);
    expect(voteVsActual.totalActuallyAttended).toBe(0);
    expect(voteVsActual.reliability).toBe(0);
  });

  it("100% reliability when all voters attended", async () => {
    defaultMocks();

    mockPrisma.session.findMany.mockResolvedValue([
      { id: "s-1", weekDate: new Date("2026-01-05"), status: "SCHEDULED", recurringSlotId: "slot-1", recurringSlot: { dayOfWeek: 1, startHour: 9 }, customDay: null, customStartHour: null, votes: [{ userId: "m-1", attending: true }, { userId: "m-2", attending: true }, { userId: "m-3", attending: true }], members: [] },
    ]);

    mockPrisma.attendanceRecord.findMany.mockResolvedValue([
      { sessionId: "s-1", userId: "m-1", present: true },
      { sessionId: "s-1", userId: "m-2", present: true },
      { sessionId: "s-1", userId: "m-3", present: true },
    ]);

    const { GET } = await import("@/app/api/analytics/route");
    const response = await GET(makeRequest("2026-01-01", "2026-01-31"));
    const body = await response.json();

    const { voteVsActual } = body.data.attendance;
    expect(voteVsActual.totalVotedComing).toBe(3);
    expect(voteVsActual.totalActuallyAttended).toBe(3);
    expect(voteVsActual.reliability).toBe(100);
  });

  it("aggregates across multiple voting sessions", async () => {
    defaultMocks();

    mockPrisma.session.findMany.mockResolvedValue([
      { id: "s-1", weekDate: new Date("2026-01-05"), status: "SCHEDULED", recurringSlotId: "slot-1", recurringSlot: { dayOfWeek: 1, startHour: 9 }, customDay: null, customStartHour: null, votes: [{ userId: "m-1", attending: true }, { userId: "m-2", attending: true }], members: [] },
      { id: "s-2", weekDate: new Date("2026-01-12"), status: "SCHEDULED", recurringSlotId: "slot-1", recurringSlot: { dayOfWeek: 1, startHour: 9 }, customDay: null, customStartHour: null, votes: [{ userId: "m-1", attending: true }], members: [] },
    ]);

    mockPrisma.attendanceRecord.findMany.mockResolvedValue([
      { sessionId: "s-1", userId: "m-1", present: true },
      { sessionId: "s-1", userId: "m-2", present: true },
      { sessionId: "s-2", userId: "m-1", present: false },
    ]);

    const { GET } = await import("@/app/api/analytics/route");
    const response = await GET(makeRequest("2026-01-01", "2026-01-31"));
    const body = await response.json();

    const { voteVsActual } = body.data.attendance;
    // s-1: 2 voted, s-2: 1 voted = 3 total
    expect(voteVsActual.totalVotedComing).toBe(3);
    // s-1: 2 attended, s-2: 0 attended = 2 total
    expect(voteVsActual.totalActuallyAttended).toBe(2);
    // 2/3 = 67%
    expect(voteVsActual.reliability).toBe(67);
  });
});

describe("GET /api/analytics — CSV export with attendance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes Vote Reliability in CSV export", async () => {
    defaultMocks();

    mockPrisma.session.findMany.mockResolvedValue([
      { id: "s-1", weekDate: new Date("2026-01-05"), status: "SCHEDULED", recurringSlotId: "slot-1", recurringSlot: { dayOfWeek: 1, startHour: 9 }, customDay: null, customStartHour: null, votes: [{ userId: "m-1", attending: true }], members: [] },
    ]);

    mockPrisma.attendanceRecord.findMany.mockResolvedValue([
      { sessionId: "s-1", userId: "m-1", present: true },
    ]);

    const { GET } = await import("@/app/api/analytics/route");
    const response = await GET(makeCsvRequest("2026-01-01", "2026-01-31"));

    expect(response.headers.get("Content-Type")).toBe("text/csv");
    const csv = await response.text();

    expect(csv).toContain("Vote Reliability,100%");
  });

  it("does NOT include Attendance Weeks Tracked or Avg Show-up Rate (removed)", async () => {
    defaultMocks();

    const { GET } = await import("@/app/api/analytics/route");
    const response = await GET(makeCsvRequest("2026-01-01", "2026-01-31"));

    const csv = await response.text();

    expect(csv).not.toContain("Attendance - Weeks Tracked");
    expect(csv).not.toContain("Attendance - Avg Show-up Rate");
  });

  it("CSV has correct Content-Disposition header with date range", async () => {
    defaultMocks();

    const { GET } = await import("@/app/api/analytics/route");
    const response = await GET(makeCsvRequest("2026-01-01", "2026-01-31"));

    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="analytics-2026-01-01-2026-01-31.csv"'
    );
  });
});

describe("GET /api/analytics — auth and rate limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for unauthenticated request", async () => {
    mockAuth.mockResolvedValue(null);

    const { GET } = await import("@/app/api/analytics/route");
    const response = await GET(makeRequest("2026-01-01", "2026-01-31"));

    expect(response.status).toBe(401);
  });

  it("returns 403 for non-owner role", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "m-1", email: "member@test.com", role: "MEMBER", status: "ACTIVE" },
    });

    const { GET } = await import("@/app/api/analytics/route");
    const response = await GET(makeRequest("2026-01-01", "2026-01-31"));

    expect(response.status).toBe(403);
  });

  it("returns 429 when rate limit is exceeded", async () => {
    mockAuth.mockResolvedValue(ownerSession());

    const rateLimitModule = await import("@/lib/rate-limit");
    const originalCheck = rateLimitModule.authReadLimiter.check;
    rateLimitModule.authReadLimiter.check = () => ({ allowed: false, remaining: 0, retryAfterMs: 3000 });

    const { GET } = await import("@/app/api/analytics/route");
    const response = await GET(makeRequest("2026-01-01", "2026-01-31"));

    expect(response.status).toBe(429);

    rateLimitModule.authReadLimiter.check = originalCheck;
  });

  it("returns 400 for invalid date parameters", async () => {
    mockAuth.mockResolvedValue(ownerSession());

    const { GET } = await import("@/app/api/analytics/route");
    const response = await GET(
      new Request("http://localhost/api/analytics?startDate=invalid&endDate=2026-01-31")
    );

    expect(response.status).toBe(400);
  });
});
