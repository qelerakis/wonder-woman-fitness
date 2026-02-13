/**
 * Sessions API Integration Tests
 *
 * Tests auth enforcement, role-based access, validation, duplicate prevention,
 * and happy paths for GET/POST /api/sessions and GET/PATCH/DELETE /api/sessions/[id].
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ===== Mocks =====

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

const mockGetSessionsForWeek = vi.fn();
const mockGetWeekStart = vi.fn((d: Date) => {
  // Return the Monday of the week in UTC
  const date = new Date(d);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  date.setUTCHours(0, 0, 0, 0);
  return date;
});

vi.mock("@/lib/session-generation", () => ({
  getSessionsForWeek: (...args: unknown[]) => mockGetSessionsForWeek(...args),
  getWeekStart: (d: Date) => mockGetWeekStart(d),
}));

const mockPrisma = {
  recurringSlot: {
    findUnique: vi.fn(),
  },
  session: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};
vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/notifications", () => ({
  dispatchNotificationToMany: vi.fn().mockResolvedValue([]),
}));

// ===== Helpers =====

function ownerSession() {
  return { user: { id: "owner-1", email: "owner@test.com", role: "OWNER", status: "ACTIVE" } };
}

function trainerSession(id = "trainer-1") {
  return { user: { id, email: "trainer@test.com", role: "TRAINER", status: "ACTIVE" } };
}

function memberSession() {
  return { user: { id: "member-1", email: "member@test.com", role: "MEMBER", status: "ACTIVE" } };
}

// ===== GET /api/sessions =====

describe("GET /api/sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { GET } = await import("@/app/api/sessions/route");
    const response = await GET(new Request("http://localhost/api/sessions"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns sessions for the current week when no weekDate param", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockGetSessionsForWeek.mockResolvedValue([
      { id: "s-1", status: "SCHEDULED" },
    ]);

    const { GET } = await import("@/app/api/sessions/route");
    const response = await GET(new Request("http://localhost/api/sessions"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(mockGetSessionsForWeek).toHaveBeenCalled();
  });

  it("respects weekDate query parameter", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockGetSessionsForWeek.mockResolvedValue([]);

    const { GET } = await import("@/app/api/sessions/route");
    const response = await GET(
      new Request("http://localhost/api/sessions?weekDate=2025-03-10")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([]);
    // Verify getWeekStart was called with a date
    expect(mockGetWeekStart).toHaveBeenCalled();
  });

  it("allows any authenticated role to access sessions", async () => {
    mockAuth.mockResolvedValue(memberSession());
    mockGetSessionsForWeek.mockResolvedValue([]);

    const { GET } = await import("@/app/api/sessions/route");
    const response = await GET(new Request("http://localhost/api/sessions"));

    expect(response.status).toBe(200);
  });
});

// ===== POST /api/sessions =====

describe("POST /api/sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { POST } = await import("@/app/api/sessions/route");
    const response = await POST(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recurringSlotId: "slot-1", weekDate: "2025-03-10" }),
      })
    );

    expect(response.status).toBe(401);
  });

  it("returns 403 when non-OWNER tries to create", async () => {
    mockAuth.mockResolvedValue(trainerSession());

    const { POST } = await import("@/app/api/sessions/route");
    const response = await POST(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recurringSlotId: "slot-1", weekDate: "2025-03-10" }),
      })
    );

    expect(response.status).toBe(403);
  });

  it("returns 400 for invalid body", async () => {
    mockAuth.mockResolvedValue(ownerSession());

    const { POST } = await import("@/app/api/sessions/route");
    const response = await POST(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recurringSlotId: "not-a-cuid" }),
      })
    );

    expect(response.status).toBe(400);
  });

  it("returns 404 when recurring slot not found", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.recurringSlot.findUnique.mockResolvedValue(null);

    const { POST } = await import("@/app/api/sessions/route");
    const response = await POST(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recurringSlotId: "cm1234567890abcdef",
          weekDate: "2025-03-10",
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Recurring slot not found");
  });

  it("returns 409 when session already exists for slot+week", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.recurringSlot.findUnique.mockResolvedValue({
      id: "cm1234567890abcdef",
      dayOfWeek: 1,
      startHour: 9,
    });
    mockPrisma.session.findUnique.mockResolvedValue({ id: "existing-session" });

    const { POST } = await import("@/app/api/sessions/route");
    const response = await POST(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recurringSlotId: "cm1234567890abcdef",
          weekDate: "2025-03-10",
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain("already exists");
  });

  it("creates session successfully", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.recurringSlot.findUnique.mockResolvedValue({
      id: "cm1234567890abcdef",
      dayOfWeek: 1,
      startHour: 9,
    });
    mockPrisma.session.findUnique.mockResolvedValue(null); // no duplicate
    mockPrisma.session.create.mockResolvedValue({
      id: "new-session",
      recurringSlotId: "cm1234567890abcdef",
      status: "SCHEDULED",
      votingEnabled: false,
      recurringSlot: { id: "cm1234567890abcdef", dayOfWeek: 1, startHour: 9 },
    });

    const { POST } = await import("@/app/api/sessions/route");
    const response = await POST(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recurringSlotId: "cm1234567890abcdef",
          weekDate: "2025-03-10",
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.status).toBe("SCHEDULED");
    expect(body.data.votingEnabled).toBe(false);
  });
});

// ===== GET /api/sessions/[id] =====

describe("GET /api/sessions/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { GET } = await import("@/app/api/sessions/[id]/route");
    const response = await GET(
      new Request("http://localhost/api/sessions/s-1"),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(response.status).toBe(401);
  });

  it("returns 404 when session not found", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue(null);

    const { GET } = await import("@/app/api/sessions/[id]/route");
    const response = await GET(
      new Request("http://localhost/api/sessions/nonexistent"),
      { params: Promise.resolve({ id: "nonexistent" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Session not found");
  });

  it("returns session details with includes", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
      trainers: [],
      votes: [],
    });

    const { GET } = await import("@/app/api/sessions/[id]/route");
    const response = await GET(
      new Request("http://localhost/api/sessions/s-1"),
      { params: Promise.resolve({ id: "s-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.id).toBe("s-1");
    expect(body.data.recurringSlot).toBeDefined();
  });
});

// ===== PATCH /api/sessions/[id] =====

describe("PATCH /api/sessions/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 for MEMBER role", async () => {
    mockAuth.mockResolvedValue(memberSession());

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workoutTitle: "Test" }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(response.status).toBe(403);
  });

  it("returns 403 when trainer is not assigned to session", async () => {
    mockAuth.mockResolvedValue(trainerSession("trainer-1"));
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      trainers: [{ userId: "trainer-2" }], // different trainer
      members: [],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workoutTitle: "New Workout" }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(response.status).toBe(403);
  });

  it("allows assigned trainer to update workout", async () => {
    mockAuth.mockResolvedValue(trainerSession("trainer-1"));
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      workoutTitle: null,
      trainers: [{ userId: "trainer-1" }],
      members: [],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
    });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      workoutTitle: "New Workout",
      status: "SCHEDULED",
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workoutTitle: "New Workout" }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.workoutTitle).toBe("New Workout");
  });

  it("allows owner to cancel session", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      trainers: [],
      members: [{ user: { id: "m-1", name: "Alice" } }],
      recurringSlot: { dayOfWeek: 3, startHour: 18 },
    });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      status: "CANCELLED",
      recurringSlot: { dayOfWeek: 3, startHour: 18 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.status).toBe("CANCELLED");
  });
});

// ===== DELETE /api/sessions/[id] =====

describe("DELETE /api/sessions/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { DELETE } = await import("@/app/api/sessions/[id]/route");
    const response = await DELETE(
      new Request("http://localhost/api/sessions/s-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(response.status).toBe(401);
  });

  it("returns 403 for non-OWNER roles", async () => {
    mockAuth.mockResolvedValue(trainerSession());

    const { DELETE } = await import("@/app/api/sessions/[id]/route");
    const response = await DELETE(
      new Request("http://localhost/api/sessions/s-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(response.status).toBe(403);
  });

  it("returns 404 when session not found", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue(null);

    const { DELETE } = await import("@/app/api/sessions/[id]/route");
    const response = await DELETE(
      new Request("http://localhost/api/sessions/nonexistent", { method: "DELETE" }),
      { params: Promise.resolve({ id: "nonexistent" }) }
    );

    expect(response.status).toBe(404);
  });

  it("deletes session successfully", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      members: [],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
    });
    mockPrisma.session.delete.mockResolvedValue({});

    const { DELETE } = await import("@/app/api/sessions/[id]/route");
    const response = await DELETE(
      new Request("http://localhost/api/sessions/s-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "s-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.success).toBe(true);
  });

  it("returns 403 for MEMBER role", async () => {
    mockAuth.mockResolvedValue(memberSession());

    const { DELETE } = await import("@/app/api/sessions/[id]/route");
    const response = await DELETE(
      new Request("http://localhost/api/sessions/s-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(response.status).toBe(403);
  });

  it("calls prisma.session.delete with correct id", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-42",
      members: [],
      recurringSlot: { dayOfWeek: 5, startHour: 18 },
    });
    mockPrisma.session.delete.mockResolvedValue({});

    const { DELETE } = await import("@/app/api/sessions/[id]/route");
    await DELETE(
      new Request("http://localhost/api/sessions/s-42", { method: "DELETE" }),
      { params: Promise.resolve({ id: "s-42" }) }
    );

    expect(mockPrisma.session.delete).toHaveBeenCalledWith({ where: { id: "s-42" } });
  });

  it("notifies members before deleting", async () => {
    const { dispatchNotificationToMany } = await import("@/lib/notifications");

    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      members: [
        { user: { id: "m-1" } },
        { user: { id: "m-2" } },
      ],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
    });
    mockPrisma.session.delete.mockResolvedValue({});

    const { DELETE } = await import("@/app/api/sessions/[id]/route");
    await DELETE(
      new Request("http://localhost/api/sessions/s-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(dispatchNotificationToMany).toHaveBeenCalledWith(
      ["m-1", "m-2"],
      "SESSION_DELETED",
      expect.stringContaining("Monday"),
      expect.any(String)
    );
  });

  it("returns 500 on unexpected error", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockRejectedValue(new Error("DB crash"));

    const { DELETE } = await import("@/app/api/sessions/[id]/route");
    const response = await DELETE(
      new Request("http://localhost/api/sessions/s-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Internal server error");
  });
});

// ===== Additional POST /api/sessions Edge Cases =====

describe("POST /api/sessions — edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 500 on unexpected Prisma error during create", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.recurringSlot.findUnique.mockResolvedValue({
      id: "cm1234567890abcdef",
      dayOfWeek: 1,
      startHour: 9,
    });
    mockPrisma.session.findUnique.mockResolvedValue(null);
    mockPrisma.session.create.mockRejectedValue(new Error("DB error"));

    const { POST } = await import("@/app/api/sessions/route");
    const response = await POST(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recurringSlotId: "cm1234567890abcdef",
          weekDate: "2025-03-10",
        }),
      })
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Internal server error");
  });

  it("normalizes weekDate to Monday of that week", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.recurringSlot.findUnique.mockResolvedValue({
      id: "cm1234567890abcdef",
      dayOfWeek: 3,
      startHour: 18,
    });
    mockPrisma.session.findUnique.mockResolvedValue(null);
    mockPrisma.session.create.mockResolvedValue({
      id: "new-session",
      recurringSlotId: "cm1234567890abcdef",
      status: "SCHEDULED",
      recurringSlot: { id: "cm1234567890abcdef", dayOfWeek: 3, startHour: 18 },
    });

    const { POST } = await import("@/app/api/sessions/route");
    // Pass a Wednesday date — should be normalized to Monday
    await POST(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recurringSlotId: "cm1234567890abcdef",
          weekDate: "2025-03-12", // Wednesday
        }),
      })
    );

    // getWeekStart should have been called to normalize
    expect(mockGetWeekStart).toHaveBeenCalled();
    // The create should use the normalized Monday date
    expect(mockPrisma.session.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recurringSlotId: "cm1234567890abcdef",
        }),
      })
    );
  });
});

// ===== Additional PATCH /api/sessions/[id] Edge Cases =====

describe("PATCH /api/sessions/[id] — edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workoutTitle: "Test" }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(response.status).toBe(401);
  });

  it("returns 404 when session not found for update", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue(null);

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/nonexistent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workoutTitle: "Test" }),
      }),
      { params: Promise.resolve({ id: "nonexistent" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Session not found");
  });

  it("returns 400 for invalid body on PATCH", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      trainers: [],
      members: [],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "INVALID_STATUS" }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(response.status).toBe(400);
  });

  it("returns 500 on unexpected error during PATCH", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockRejectedValue(new Error("DB crash"));

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workoutTitle: "Test" }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Internal server error");
  });
});
