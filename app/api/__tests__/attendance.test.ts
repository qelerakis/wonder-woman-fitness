/**
 * Attendance API Integration Tests
 *
 * Tests auth enforcement, role-based access (owner/trainer/member),
 * trainer assignment checks, session-started validation, schema validation,
 * and happy paths for POST and GET /api/sessions/[id]/attendance.
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

vi.mock("@/lib/session-generation", () => ({
  getSessionDateTime: vi.fn(),
}));

const mockPrisma = {
  session: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  sessionTrainer: { findUnique: vi.fn() },
  attendanceRecord: {
    upsert: vi.fn(),
    findMany: vi.fn(),
  },
};
vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

// ===== Helpers =====

function ownerSession() {
  return { user: { id: "owner-1", email: "owner@test.com", role: "OWNER", status: "ACTIVE" } };
}

function trainerSession(id = "trainer-1") {
  return { user: { id, email: "trainer@test.com", role: "TRAINER", status: "ACTIVE" } };
}

function memberSession(id = "member-1") {
  return { user: { id, email: "member@test.com", role: "MEMBER", status: "ACTIVE" } };
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makePostRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/sessions/s-1/attendance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeGetRequest() {
  return new Request("http://localhost/api/sessions/s-1/attendance", {
    method: "GET",
  });
}

const VALID_CUID = "cm1234567890abcdef";

/** A session with a recurring slot (Monday 9 AM) */
const RECURRING_SESSION = {
  id: "s-1",
  status: "SCHEDULED",
  weekDate: new Date("2026-02-23T00:00:00.000Z"), // Monday
  recurringSlotId: "slot-1",
  recurringSlot: { dayOfWeek: 1, startHour: 9 },
  customDay: null,
  customStartHour: null,
};

/** A one-off custom session (Wednesday 14:00) */
const CUSTOM_SESSION = {
  id: "s-2",
  status: "SCHEDULED",
  weekDate: new Date("2026-02-23T00:00:00.000Z"),
  recurringSlotId: null,
  recurringSlot: null,
  customDay: 3,
  customStartHour: 14,
};

// ===== POST /api/sessions/[id]/attendance =====

describe("POST /api/sessions/[id]/attendance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { POST } = await import("@/app/api/sessions/[id]/attendance/route");
    const response = await POST(
      makePostRequest({ userId: VALID_CUID, present: true }),
      makeParams("s-1")
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 403 when called by MEMBER role", async () => {
    mockAuth.mockResolvedValue(memberSession());

    const { POST } = await import("@/app/api/sessions/[id]/attendance/route");
    const response = await POST(
      makePostRequest({ userId: VALID_CUID, present: true }),
      makeParams("s-1")
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("Forbidden");
  });

  it("returns 404 when session not found", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue(null);

    const { POST } = await import("@/app/api/sessions/[id]/attendance/route");
    const response = await POST(
      makePostRequest({ userId: VALID_CUID, present: true }),
      makeParams("nonexistent")
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("Session not found");
  });

  it("returns 400 when session is CANCELLED", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      ...RECURRING_SESSION,
      status: "CANCELLED",
    });

    const { POST } = await import("@/app/api/sessions/[id]/attendance/route");
    const response = await POST(
      makePostRequest({ userId: VALID_CUID, present: true }),
      makeParams("s-1")
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("cancelled");
  });

  it("returns 400 when session has not started yet", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue(RECURRING_SESSION);

    // Mock getSessionDateTime to return a future date
    const { getSessionDateTime } = await import("@/lib/session-generation");
    (getSessionDateTime as ReturnType<typeof vi.fn>).mockReturnValue(new Date("2099-01-01T09:00:00.000Z"));

    const { POST } = await import("@/app/api/sessions/[id]/attendance/route");
    const response = await POST(
      makePostRequest({ userId: VALID_CUID, present: true }),
      makeParams("s-1")
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("not started");
  });

  it("returns 400 with invalid body (missing userId)", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue(RECURRING_SESSION);

    const { getSessionDateTime } = await import("@/lib/session-generation");
    (getSessionDateTime as ReturnType<typeof vi.fn>).mockReturnValue(new Date("2020-01-01T09:00:00.000Z"));

    const { POST } = await import("@/app/api/sessions/[id]/attendance/route");
    const response = await POST(
      makePostRequest({ present: true }), // missing userId
      makeParams("s-1")
    );

    expect(response.status).toBe(400);
  });

  it("returns 400 with invalid body (missing present)", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue(RECURRING_SESSION);

    const { getSessionDateTime } = await import("@/lib/session-generation");
    (getSessionDateTime as ReturnType<typeof vi.fn>).mockReturnValue(new Date("2020-01-01T09:00:00.000Z"));

    const { POST } = await import("@/app/api/sessions/[id]/attendance/route");
    const response = await POST(
      makePostRequest({ userId: VALID_CUID }), // missing present
      makeParams("s-1")
    );

    expect(response.status).toBe(400);
  });

  it("returns 400 when target user not found", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue(RECURRING_SESSION);
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const { getSessionDateTime } = await import("@/lib/session-generation");
    (getSessionDateTime as ReturnType<typeof vi.fn>).mockReturnValue(new Date("2020-01-01T09:00:00.000Z"));

    const { POST } = await import("@/app/api/sessions/[id]/attendance/route");
    const response = await POST(
      makePostRequest({ userId: VALID_CUID, present: true }),
      makeParams("s-1")
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("not found");
  });

  it("returns 400 when target user is not MEMBER", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue(RECURRING_SESSION);
    mockPrisma.user.findUnique.mockResolvedValue({ id: VALID_CUID, role: "TRAINER", status: "ACTIVE" });

    const { getSessionDateTime } = await import("@/lib/session-generation");
    (getSessionDateTime as ReturnType<typeof vi.fn>).mockReturnValue(new Date("2020-01-01T09:00:00.000Z"));

    const { POST } = await import("@/app/api/sessions/[id]/attendance/route");
    const response = await POST(
      makePostRequest({ userId: VALID_CUID, present: true }),
      makeParams("s-1")
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("not a member");
  });

  it("returns 400 when target member is DEPARTED", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue(RECURRING_SESSION);
    mockPrisma.user.findUnique.mockResolvedValue({ id: VALID_CUID, role: "MEMBER", status: "DEPARTED" });

    const { getSessionDateTime } = await import("@/lib/session-generation");
    (getSessionDateTime as ReturnType<typeof vi.fn>).mockReturnValue(new Date("2020-01-01T09:00:00.000Z"));

    const { POST } = await import("@/app/api/sessions/[id]/attendance/route");
    const response = await POST(
      makePostRequest({ userId: VALID_CUID, present: true }),
      makeParams("s-1")
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("departed");
  });

  it("returns 200 when OWNER marks member as present", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue(RECURRING_SESSION);
    mockPrisma.user.findUnique.mockResolvedValue({ id: VALID_CUID, role: "MEMBER", status: "ACTIVE" });

    const { getSessionDateTime } = await import("@/lib/session-generation");
    (getSessionDateTime as ReturnType<typeof vi.fn>).mockReturnValue(new Date("2020-01-01T09:00:00.000Z"));

    const upsertedRecord = {
      id: "att-1",
      sessionId: "s-1",
      userId: VALID_CUID,
      present: true,
      markedById: "owner-1",
      markedAt: new Date(),
    };
    mockPrisma.attendanceRecord.upsert.mockResolvedValue(upsertedRecord);

    const { POST } = await import("@/app/api/sessions/[id]/attendance/route");
    const response = await POST(
      makePostRequest({ userId: VALID_CUID, present: true }),
      makeParams("s-1")
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.present).toBe(true);
    expect(body.data.userId).toBe(VALID_CUID);
    expect(mockPrisma.attendanceRecord.upsert).toHaveBeenCalledWith({
      where: { sessionId_userId: { sessionId: "s-1", userId: VALID_CUID } },
      create: expect.objectContaining({
        sessionId: "s-1",
        userId: VALID_CUID,
        present: true,
        markedById: "owner-1",
      }),
      update: expect.objectContaining({
        present: true,
        markedById: "owner-1",
      }),
    });
  });

  it("returns 200 when marking member as absent", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue(RECURRING_SESSION);
    mockPrisma.user.findUnique.mockResolvedValue({ id: VALID_CUID, role: "MEMBER", status: "ACTIVE" });

    const { getSessionDateTime } = await import("@/lib/session-generation");
    (getSessionDateTime as ReturnType<typeof vi.fn>).mockReturnValue(new Date("2020-01-01T09:00:00.000Z"));

    const upsertedRecord = {
      id: "att-1",
      sessionId: "s-1",
      userId: VALID_CUID,
      present: false,
      markedById: "owner-1",
      markedAt: new Date(),
    };
    mockPrisma.attendanceRecord.upsert.mockResolvedValue(upsertedRecord);

    const { POST } = await import("@/app/api/sessions/[id]/attendance/route");
    const response = await POST(
      makePostRequest({ userId: VALID_CUID, present: false }),
      makeParams("s-1")
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.present).toBe(false);
  });

  it("returns 200 when assigned TRAINER marks attendance", async () => {
    mockAuth.mockResolvedValue(trainerSession("trainer-1"));
    mockPrisma.session.findUnique.mockResolvedValue(RECURRING_SESSION);
    mockPrisma.sessionTrainer.findUnique.mockResolvedValue({ sessionId: "s-1", userId: "trainer-1" });
    mockPrisma.user.findUnique.mockResolvedValue({ id: VALID_CUID, role: "MEMBER", status: "ACTIVE" });

    const { getSessionDateTime } = await import("@/lib/session-generation");
    (getSessionDateTime as ReturnType<typeof vi.fn>).mockReturnValue(new Date("2020-01-01T09:00:00.000Z"));

    const upsertedRecord = {
      id: "att-2",
      sessionId: "s-1",
      userId: VALID_CUID,
      present: true,
      markedById: "trainer-1",
      markedAt: new Date(),
    };
    mockPrisma.attendanceRecord.upsert.mockResolvedValue(upsertedRecord);

    const { POST } = await import("@/app/api/sessions/[id]/attendance/route");
    const response = await POST(
      makePostRequest({ userId: VALID_CUID, present: true }),
      makeParams("s-1")
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.present).toBe(true);
    expect(body.data.markedById).toBe("trainer-1");
  });

  it("returns 403 when TRAINER is not assigned to session", async () => {
    mockAuth.mockResolvedValue(trainerSession("trainer-1"));
    mockPrisma.session.findUnique.mockResolvedValue(RECURRING_SESSION);
    mockPrisma.sessionTrainer.findUnique.mockResolvedValue(null); // not assigned

    const { getSessionDateTime } = await import("@/lib/session-generation");
    (getSessionDateTime as ReturnType<typeof vi.fn>).mockReturnValue(new Date("2020-01-01T09:00:00.000Z"));

    const { POST } = await import("@/app/api/sessions/[id]/attendance/route");
    const response = await POST(
      makePostRequest({ userId: VALID_CUID, present: true }),
      makeParams("s-1")
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("Forbidden");
  });

  it("returns 200 when marking attendance for TRIAL member", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue(RECURRING_SESSION);
    mockPrisma.user.findUnique.mockResolvedValue({ id: VALID_CUID, role: "MEMBER", status: "TRIAL" });

    const { getSessionDateTime } = await import("@/lib/session-generation");
    (getSessionDateTime as ReturnType<typeof vi.fn>).mockReturnValue(new Date("2020-01-01T09:00:00.000Z"));

    const upsertedRecord = {
      id: "att-3",
      sessionId: "s-1",
      userId: VALID_CUID,
      present: true,
      markedById: "owner-1",
      markedAt: new Date(),
    };
    mockPrisma.attendanceRecord.upsert.mockResolvedValue(upsertedRecord);

    const { POST } = await import("@/app/api/sessions/[id]/attendance/route");
    const response = await POST(
      makePostRequest({ userId: VALID_CUID, present: true }),
      makeParams("s-1")
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.present).toBe(true);
  });

  it("returns 400 when body has extra fields (strict schema)", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue(RECURRING_SESSION);

    const { getSessionDateTime } = await import("@/lib/session-generation");
    (getSessionDateTime as ReturnType<typeof vi.fn>).mockReturnValue(new Date("2020-01-01T09:00:00.000Z"));

    const { POST } = await import("@/app/api/sessions/[id]/attendance/route");
    const response = await POST(
      makePostRequest({ userId: VALID_CUID, present: true, extraField: "hack" }),
      makeParams("s-1")
    );

    expect(response.status).toBe(400);
  });

  it("returns 200 with one-off custom session", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue(CUSTOM_SESSION);
    mockPrisma.user.findUnique.mockResolvedValue({ id: VALID_CUID, role: "MEMBER", status: "ACTIVE" });

    const { getSessionDateTime } = await import("@/lib/session-generation");
    (getSessionDateTime as ReturnType<typeof vi.fn>).mockReturnValue(new Date("2020-01-01T14:00:00.000Z"));

    const upsertedRecord = {
      id: "att-4",
      sessionId: "s-2",
      userId: VALID_CUID,
      present: true,
      markedById: "owner-1",
      markedAt: new Date(),
    };
    mockPrisma.attendanceRecord.upsert.mockResolvedValue(upsertedRecord);

    const { POST } = await import("@/app/api/sessions/[id]/attendance/route");
    const response = await POST(
      makePostRequest({ userId: VALID_CUID, present: true }),
      makeParams("s-2")
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.present).toBe(true);

    // Verify getSessionDateTime was called with correct custom day/hour
    expect(getSessionDateTime).toHaveBeenCalledWith(
      CUSTOM_SESSION.weekDate,
      3, // customDay
      14  // customStartHour
    );
  });

  it("returns 500 on unexpected error", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockRejectedValue(new Error("DB crash"));

    const { POST } = await import("@/app/api/sessions/[id]/attendance/route");
    const response = await POST(
      makePostRequest({ userId: VALID_CUID, present: true }),
      makeParams("s-1")
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Internal server error");
  });
});

// ===== GET /api/sessions/[id]/attendance =====

describe("GET /api/sessions/[id]/attendance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { GET } = await import("@/app/api/sessions/[id]/attendance/route");
    const response = await GET(
      makeGetRequest(),
      makeParams("s-1")
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 403 when called by MEMBER role", async () => {
    mockAuth.mockResolvedValue(memberSession());

    const { GET } = await import("@/app/api/sessions/[id]/attendance/route");
    const response = await GET(
      makeGetRequest(),
      makeParams("s-1")
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("Forbidden");
  });

  it("returns 404 when session not found", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue(null);

    const { GET } = await import("@/app/api/sessions/[id]/attendance/route");
    const response = await GET(
      makeGetRequest(),
      makeParams("nonexistent")
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("Session not found");
  });

  it("returns 200 with attendance records and user details", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({ id: "s-1" });

    const records = [
      {
        id: "att-1",
        sessionId: "s-1",
        userId: "m-1",
        present: true,
        markedById: "owner-1",
        markedAt: new Date(),
        user: { id: "m-1", name: "Alice", email: "alice@test.com" },
      },
      {
        id: "att-2",
        sessionId: "s-1",
        userId: "m-2",
        present: false,
        markedById: "owner-1",
        markedAt: new Date(),
        user: { id: "m-2", name: "Bob", email: "bob@test.com" },
      },
    ];
    mockPrisma.attendanceRecord.findMany.mockResolvedValue(records);

    const { GET } = await import("@/app/api/sessions/[id]/attendance/route");
    const response = await GET(
      makeGetRequest(),
      makeParams("s-1")
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toHaveLength(2);
    expect(body.data[0].user.name).toBe("Alice");
    expect(body.data[0].present).toBe(true);
    expect(body.data[1].user.name).toBe("Bob");
    expect(body.data[1].present).toBe(false);
  });

  it("returns 200 when assigned TRAINER reads attendance", async () => {
    mockAuth.mockResolvedValue(trainerSession("trainer-1"));
    mockPrisma.session.findUnique.mockResolvedValue({ id: "s-1" });
    mockPrisma.sessionTrainer.findUnique.mockResolvedValue({ sessionId: "s-1", userId: "trainer-1" });
    mockPrisma.attendanceRecord.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/sessions/[id]/attendance/route");
    const response = await GET(
      makeGetRequest(),
      makeParams("s-1")
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toHaveLength(0);
  });

  it("returns 403 when TRAINER is not assigned to session", async () => {
    mockAuth.mockResolvedValue(trainerSession("trainer-1"));
    mockPrisma.session.findUnique.mockResolvedValue({ id: "s-1" });
    mockPrisma.sessionTrainer.findUnique.mockResolvedValue(null); // not assigned

    const { GET } = await import("@/app/api/sessions/[id]/attendance/route");
    const response = await GET(
      makeGetRequest(),
      makeParams("s-1")
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("Forbidden");
  });

  it("returns 500 on unexpected error", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockRejectedValue(new Error("DB crash"));

    const { GET } = await import("@/app/api/sessions/[id]/attendance/route");
    const response = await GET(
      makeGetRequest(),
      makeParams("s-1")
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Internal server error");
  });
});
