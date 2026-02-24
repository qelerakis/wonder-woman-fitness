/**
 * Analytics Attendance Metrics Tests
 *
 * Tests the attendance analytics section of GET /api/analytics:
 * - memberRates: per-member attendance rates
 * - slotRates: per-slot attendance rates
 * - voteVsActual: vote reliability metric
 * - trend: weekly attendance trend
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

function defaultMocks(): void {
  mockAuth.mockResolvedValue(ownerSession());
  mockPrisma.user.findMany.mockResolvedValue([]);
  mockPrisma.session.findMany.mockResolvedValue([]);
  mockPrisma.payment.findMany.mockResolvedValue([]);
  mockPrisma.privateSession.findMany.mockResolvedValue([]);
  mockPrisma.attendanceRecord.findMany.mockResolvedValue([]);
}

// ===== Tests =====

describe("GET /api/analytics — attendance metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes attendance key in analytics response", async () => {
    defaultMocks();

    const { GET } = await import("@/app/api/analytics/route");
    const response = await GET(makeRequest("2026-01-01", "2026-01-31"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveProperty("attendance");
    expect(body.data.attendance).toHaveProperty("memberRates");
    expect(body.data.attendance).toHaveProperty("slotRates");
    expect(body.data.attendance).toHaveProperty("voteVsActual");
    expect(body.data.attendance).toHaveProperty("trend");
  });

  it("returns empty arrays and zero reliability for no attendance records", async () => {
    defaultMocks();

    const { GET } = await import("@/app/api/analytics/route");
    const response = await GET(makeRequest("2026-01-01", "2026-01-31"));
    const body = await response.json();

    const { attendance } = body.data;
    expect(attendance.memberRates).toEqual([]);
    expect(attendance.slotRates).toEqual([]);
    expect(attendance.voteVsActual).toEqual({
      totalVotedComing: 0,
      totalActuallyAttended: 0,
      reliability: 0,
    });
    expect(attendance.trend).toEqual([]);
  });

  it("computes correct per-member attendance rates", async () => {
    defaultMocks();

    mockPrisma.user.findMany.mockResolvedValue([
      { id: "m-1", name: "Alice", status: "ACTIVE", joinDate: new Date("2025-01-01"), trialEndsAt: null, departedAt: null, overrideActive: false },
      { id: "m-2", name: "Bob", status: "ACTIVE", joinDate: new Date("2025-01-01"), trialEndsAt: null, departedAt: null, overrideActive: false },
    ]);

    mockPrisma.attendanceRecord.findMany.mockResolvedValue([
      // Alice: 2 out of 3 sessions attended
      { sessionId: "s-1", userId: "m-1", present: true, session: { weekDate: new Date("2026-01-05"), recurringSlotId: "slot-1", recurringSlot: { dayOfWeek: 1, startHour: 9 }, customDay: null, customStartHour: null, votes: [{ userId: "m-1", attending: true }], members: [{ userId: "m-1" }] } },
      { sessionId: "s-2", userId: "m-1", present: true, session: { weekDate: new Date("2026-01-12"), recurringSlotId: "slot-1", recurringSlot: { dayOfWeek: 1, startHour: 9 }, customDay: null, customStartHour: null, votes: [{ userId: "m-1", attending: true }], members: [{ userId: "m-1" }] } },
      { sessionId: "s-3", userId: "m-1", present: false, session: { weekDate: new Date("2026-01-19"), recurringSlotId: "slot-1", recurringSlot: { dayOfWeek: 1, startHour: 9 }, customDay: null, customStartHour: null, votes: [{ userId: "m-1", attending: true }], members: [{ userId: "m-1" }] } },
      // Bob: 1 out of 3 sessions attended
      { sessionId: "s-1", userId: "m-2", present: true, session: { weekDate: new Date("2026-01-05"), recurringSlotId: "slot-1", recurringSlot: { dayOfWeek: 1, startHour: 9 }, customDay: null, customStartHour: null, votes: [{ userId: "m-2", attending: true }], members: [{ userId: "m-2" }] } },
      { sessionId: "s-2", userId: "m-2", present: false, session: { weekDate: new Date("2026-01-12"), recurringSlotId: "slot-1", recurringSlot: { dayOfWeek: 1, startHour: 9 }, customDay: null, customStartHour: null, votes: [{ userId: "m-2", attending: false }], members: [{ userId: "m-2" }] } },
      { sessionId: "s-3", userId: "m-2", present: false, session: { weekDate: new Date("2026-01-19"), recurringSlotId: "slot-1", recurringSlot: { dayOfWeek: 1, startHour: 9 }, customDay: null, customStartHour: null, votes: [{ userId: "m-2", attending: false }], members: [{ userId: "m-2" }] } },
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

  it("groups slot rates by dayOfWeek + startHour correctly", async () => {
    defaultMocks();

    mockPrisma.attendanceRecord.findMany.mockResolvedValue([
      // Slot 1: Monday 9 AM - session s-1 (2 records, 1 present)
      { sessionId: "s-1", userId: "m-1", present: true, session: { weekDate: new Date("2026-01-05"), recurringSlotId: "slot-1", recurringSlot: { dayOfWeek: 1, startHour: 9 }, customDay: null, customStartHour: null, votes: [], members: [] } },
      { sessionId: "s-1", userId: "m-2", present: false, session: { weekDate: new Date("2026-01-05"), recurringSlotId: "slot-1", recurringSlot: { dayOfWeek: 1, startHour: 9 }, customDay: null, customStartHour: null, votes: [], members: [] } },
      // Slot 2: Wednesday 17 PM - session s-2 (2 records, 2 present)
      { sessionId: "s-2", userId: "m-1", present: true, session: { weekDate: new Date("2026-01-05"), recurringSlotId: "slot-2", recurringSlot: { dayOfWeek: 3, startHour: 17 }, customDay: null, customStartHour: null, votes: [], members: [] } },
      { sessionId: "s-2", userId: "m-2", present: true, session: { weekDate: new Date("2026-01-05"), recurringSlotId: "slot-2", recurringSlot: { dayOfWeek: 3, startHour: 17 }, customDay: null, customStartHour: null, votes: [], members: [] } },
    ]);

    const { GET } = await import("@/app/api/analytics/route");
    const response = await GET(makeRequest("2026-01-01", "2026-01-31"));
    const body = await response.json();

    const { slotRates } = body.data.attendance;
    expect(slotRates).toHaveLength(2);

    // Sorted ascending by showUpRate: Monday 9AM (50%) first, then Wednesday 17 (100%)
    expect(slotRates[0].day).toBe("Monday");
    expect(slotRates[0].hour).toBe(9);
    expect(slotRates[0].showUpRate).toBe(50);
    expect(slotRates[0].avgPresent).toBe(1);
    expect(slotRates[0].avgExpected).toBe(2);

    expect(slotRates[1].day).toBe("Wednesday");
    expect(slotRates[1].hour).toBe(17);
    expect(slotRates[1].showUpRate).toBe(100);
    expect(slotRates[1].avgPresent).toBe(2);
    expect(slotRates[1].avgExpected).toBe(2);
  });

  it("uses customDay and customStartHour for one-off sessions in slotRates", async () => {
    defaultMocks();

    mockPrisma.attendanceRecord.findMany.mockResolvedValue([
      { sessionId: "s-custom", userId: "m-1", present: true, session: { weekDate: new Date("2026-01-05"), recurringSlotId: null, recurringSlot: null, customDay: 5, customStartHour: 14, votes: [], members: [] } },
      { sessionId: "s-custom", userId: "m-2", present: true, session: { weekDate: new Date("2026-01-05"), recurringSlotId: null, recurringSlot: null, customDay: 5, customStartHour: 14, votes: [], members: [] } },
    ]);

    const { GET } = await import("@/app/api/analytics/route");
    const response = await GET(makeRequest("2026-01-01", "2026-01-31"));
    const body = await response.json();

    const { slotRates } = body.data.attendance;
    expect(slotRates).toHaveLength(1);
    expect(slotRates[0].day).toBe("Friday");
    expect(slotRates[0].hour).toBe(14);
    expect(slotRates[0].showUpRate).toBe(100);
  });

  it("computes vote vs actual reliability correctly", async () => {
    defaultMocks();

    // Session s-1: 3 voted coming, 2 actually showed up
    // Session s-2: 2 voted coming, 1 actually showed up
    // Total: 5 voted coming, 3 actually attended => reliability = 60%
    mockPrisma.attendanceRecord.findMany.mockResolvedValue([
      // Session s-1
      { sessionId: "s-1", userId: "m-1", present: true, session: { weekDate: new Date("2026-01-05"), recurringSlotId: "slot-1", recurringSlot: { dayOfWeek: 1, startHour: 9 }, customDay: null, customStartHour: null, votes: [{ userId: "m-1", attending: true }, { userId: "m-2", attending: true }, { userId: "m-3", attending: true }], members: [] } },
      { sessionId: "s-1", userId: "m-2", present: true, session: { weekDate: new Date("2026-01-05"), recurringSlotId: "slot-1", recurringSlot: { dayOfWeek: 1, startHour: 9 }, customDay: null, customStartHour: null, votes: [{ userId: "m-1", attending: true }, { userId: "m-2", attending: true }, { userId: "m-3", attending: true }], members: [] } },
      { sessionId: "s-1", userId: "m-3", present: false, session: { weekDate: new Date("2026-01-05"), recurringSlotId: "slot-1", recurringSlot: { dayOfWeek: 1, startHour: 9 }, customDay: null, customStartHour: null, votes: [{ userId: "m-1", attending: true }, { userId: "m-2", attending: true }, { userId: "m-3", attending: true }], members: [] } },
      // Session s-2
      { sessionId: "s-2", userId: "m-1", present: true, session: { weekDate: new Date("2026-01-12"), recurringSlotId: "slot-1", recurringSlot: { dayOfWeek: 1, startHour: 9 }, customDay: null, customStartHour: null, votes: [{ userId: "m-1", attending: true }, { userId: "m-2", attending: true }], members: [] } },
      { sessionId: "s-2", userId: "m-2", present: false, session: { weekDate: new Date("2026-01-12"), recurringSlotId: "slot-1", recurringSlot: { dayOfWeek: 1, startHour: 9 }, customDay: null, customStartHour: null, votes: [{ userId: "m-1", attending: true }, { userId: "m-2", attending: true }], members: [] } },
    ]);

    const { GET } = await import("@/app/api/analytics/route");
    const response = await GET(makeRequest("2026-01-01", "2026-01-31"));
    const body = await response.json();

    const { voteVsActual } = body.data.attendance;
    expect(voteVsActual.totalVotedComing).toBe(5);
    expect(voteVsActual.totalActuallyAttended).toBe(3);
    expect(voteVsActual.reliability).toBe(60);
  });

  it("returns weekly attendance trend sorted chronologically", async () => {
    defaultMocks();

    mockPrisma.attendanceRecord.findMany.mockResolvedValue([
      // Week 2026-01-12: 2 records, 1 present => rate 50%
      { sessionId: "s-2", userId: "m-1", present: true, session: { weekDate: new Date("2026-01-12"), recurringSlotId: "slot-1", recurringSlot: { dayOfWeek: 1, startHour: 9 }, customDay: null, customStartHour: null, votes: [], members: [] } },
      { sessionId: "s-2", userId: "m-2", present: false, session: { weekDate: new Date("2026-01-12"), recurringSlotId: "slot-1", recurringSlot: { dayOfWeek: 1, startHour: 9 }, customDay: null, customStartHour: null, votes: [], members: [] } },
      // Week 2026-01-05: 2 records, 2 present => rate 100%
      { sessionId: "s-1", userId: "m-1", present: true, session: { weekDate: new Date("2026-01-05"), recurringSlotId: "slot-1", recurringSlot: { dayOfWeek: 1, startHour: 9 }, customDay: null, customStartHour: null, votes: [], members: [] } },
      { sessionId: "s-1", userId: "m-2", present: true, session: { weekDate: new Date("2026-01-05"), recurringSlotId: "slot-1", recurringSlot: { dayOfWeek: 1, startHour: 9 }, customDay: null, customStartHour: null, votes: [], members: [] } },
    ]);

    const { GET } = await import("@/app/api/analytics/route");
    const response = await GET(makeRequest("2026-01-01", "2026-01-31"));
    const body = await response.json();

    const { trend } = body.data.attendance;
    expect(trend).toHaveLength(2);

    // Sorted chronologically
    expect(trend[0].week).toBe("2026-01-05");
    expect(trend[0].rate).toBe(100);
    expect(trend[0].present).toBe(2);
    expect(trend[0].total).toBe(2);

    expect(trend[1].week).toBe("2026-01-12");
    expect(trend[1].rate).toBe(50);
    expect(trend[1].present).toBe(1);
    expect(trend[1].total).toBe(2);
  });

  it("members with no attendance records do not appear in memberRates", async () => {
    defaultMocks();

    mockPrisma.user.findMany.mockResolvedValue([
      { id: "m-1", name: "Alice", status: "ACTIVE", joinDate: new Date("2025-01-01"), trialEndsAt: null, departedAt: null, overrideActive: false },
      { id: "m-2", name: "Bob", status: "ACTIVE", joinDate: new Date("2025-01-01"), trialEndsAt: null, departedAt: null, overrideActive: false },
    ]);

    // Only Alice has attendance records
    mockPrisma.attendanceRecord.findMany.mockResolvedValue([
      { sessionId: "s-1", userId: "m-1", present: true, session: { weekDate: new Date("2026-01-05"), recurringSlotId: "slot-1", recurringSlot: { dayOfWeek: 1, startHour: 9 }, customDay: null, customStartHour: null, votes: [], members: [] } },
    ]);

    const { GET } = await import("@/app/api/analytics/route");
    const response = await GET(makeRequest("2026-01-01", "2026-01-31"));
    const body = await response.json();

    const { memberRates } = body.data.attendance;
    expect(memberRates).toHaveLength(1);
    expect(memberRates[0].name).toBe("Alice");
    expect(memberRates[0].rate).toBe(100);
  });

  it("includes attendance data in CSV export", async () => {
    defaultMocks();

    mockPrisma.attendanceRecord.findMany.mockResolvedValue([
      { sessionId: "s-1", userId: "m-1", present: true, session: { weekDate: new Date("2026-01-05"), recurringSlotId: "slot-1", recurringSlot: { dayOfWeek: 1, startHour: 9 }, customDay: null, customStartHour: null, votes: [{ userId: "m-1", attending: true }], members: [] } },
      { sessionId: "s-1", userId: "m-2", present: false, session: { weekDate: new Date("2026-01-05"), recurringSlotId: "slot-1", recurringSlot: { dayOfWeek: 1, startHour: 9 }, customDay: null, customStartHour: null, votes: [{ userId: "m-1", attending: true }], members: [] } },
    ]);

    const { GET } = await import("@/app/api/analytics/route");
    const response = await GET(
      new Request(
        "http://localhost/api/analytics?startDate=2026-01-01&endDate=2026-01-31",
        { headers: { Accept: "text/csv" } }
      )
    );

    expect(response.headers.get("Content-Type")).toBe("text/csv");
    const csv = await response.text();

    expect(csv).toContain("Attendance - Sessions Tracked,1");
    expect(csv).toContain("Attendance - Avg Show-up Rate,50%");
    expect(csv).toContain("Vote Reliability,100%");
  });

  it("handles multiple sessions per slot for slotRates averaging", async () => {
    defaultMocks();

    // Monday 9AM slot across 2 sessions:
    // Session s-1: 2 records, 2 present
    // Session s-3: 2 records, 0 present
    // avgPresent = (2+0)/2 = 1, avgExpected = (2+2)/2 = 2, showUpRate = 50%
    mockPrisma.attendanceRecord.findMany.mockResolvedValue([
      { sessionId: "s-1", userId: "m-1", present: true, session: { weekDate: new Date("2026-01-05"), recurringSlotId: "slot-1", recurringSlot: { dayOfWeek: 1, startHour: 9 }, customDay: null, customStartHour: null, votes: [], members: [] } },
      { sessionId: "s-1", userId: "m-2", present: true, session: { weekDate: new Date("2026-01-05"), recurringSlotId: "slot-1", recurringSlot: { dayOfWeek: 1, startHour: 9 }, customDay: null, customStartHour: null, votes: [], members: [] } },
      { sessionId: "s-3", userId: "m-1", present: false, session: { weekDate: new Date("2026-01-12"), recurringSlotId: "slot-1", recurringSlot: { dayOfWeek: 1, startHour: 9 }, customDay: null, customStartHour: null, votes: [], members: [] } },
      { sessionId: "s-3", userId: "m-2", present: false, session: { weekDate: new Date("2026-01-12"), recurringSlotId: "slot-1", recurringSlot: { dayOfWeek: 1, startHour: 9 }, customDay: null, customStartHour: null, votes: [], members: [] } },
    ]);

    const { GET } = await import("@/app/api/analytics/route");
    const response = await GET(makeRequest("2026-01-01", "2026-01-31"));
    const body = await response.json();

    const { slotRates } = body.data.attendance;
    expect(slotRates).toHaveLength(1);
    expect(slotRates[0].day).toBe("Monday");
    expect(slotRates[0].hour).toBe(9);
    expect(slotRates[0].avgPresent).toBe(1);
    expect(slotRates[0].avgExpected).toBe(2);
    expect(slotRates[0].showUpRate).toBe(50);
  });
});
