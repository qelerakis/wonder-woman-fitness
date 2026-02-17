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

const mockGetSessionDateTime = vi.fn(
  (weekDate: Date, dayOfWeek: number, startHour: number) => {
    const d = new Date(weekDate);
    d.setUTCDate(d.getUTCDate() + dayOfWeek - 1);
    d.setUTCHours(startHour, 0, 0, 0);
    return d;
  }
);
const mockCalculateVotingDeadline = vi.fn(
  (sessionDateTime: Date) =>
    new Date(sessionDateTime.getTime() - 24 * 60 * 60 * 1000)
);

vi.mock("@/lib/session-generation", () => ({
  getSessionsForWeek: (...args: unknown[]) => mockGetSessionsForWeek(...args),
  getWeekStart: (d: Date) => mockGetWeekStart(d),
  getSessionDateTime: (weekDate: Date, dayOfWeek: number, startHour: number) => mockGetSessionDateTime(weekDate, dayOfWeek, startHour),
  calculateVotingDeadline: (sessionDateTime: Date) =>
    mockCalculateVotingDeadline(sessionDateTime),
}));

const mockPrisma = {
  recurringSlot: {
    findUnique: vi.fn(),
  },
  session: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  sessionMember: {
    deleteMany: vi.fn(),
  },
  vote: {
    deleteMany: vi.fn(),
  },
  sessionTrainer: {
    create: vi.fn(),
  },
  // Interactive transaction: execute callback with same mock objects
  $transaction: vi.fn(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma)),
};
vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/notifications", () => {
  // Inline DAY_NAMES to avoid importing from modules that depend on Prisma
  const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return {
    dispatchNotificationToMany: vi.fn().mockResolvedValue([]),
    getSessionNotificationRecipients: (session: {
      votingEnabled: boolean;
      members: { user: { id: string } }[];
      votes?: { userId: string; attending: boolean }[];
    }): string[] => {
      if (session.votingEnabled && session.votes) {
        return session.votes
          .filter((v: { attending: boolean }) => v.attending)
          .map((v: { userId: string }) => v.userId);
      }
      return session.members.map((m: { user: { id: string } }) => m.user.id);
    },
    formatSessionForNotification: (
      weekDate: Date,
      dayOfWeek: number,
      startHour: number
    ): { dayName: string; dateStr: string } => {
      const dayName = DAY_NAMES[dayOfWeek] || "Unknown";
      // Replicate getSessionDateTime logic (same as mockGetSessionDateTime)
      const d = new Date(weekDate);
      d.setUTCDate(d.getUTCDate() + dayOfWeek - 1);
      d.setUTCHours(startHour, 0, 0, 0);
      // Format as "MMM d" (e.g., "Mar 11")
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const dateStr = `${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
      return { dayName, dateStr };
    },
  };
});

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

  it("returns 403 when MEMBER tries to create", async () => {
    mockAuth.mockResolvedValue(memberSession());

    const { POST } = await import("@/app/api/sessions/route");
    const response = await POST(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recurringSlotId: "cm1234567890abcdef", weekDate: "2025-03-10" }),
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
      votingEnabled: false,
      weekDate: new Date("2026-03-09T00:00:00.000Z"),
      trainers: [],
      members: [{ user: { id: "m-1", name: "Alice" } }],
      votes: [],
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

  it("cancelling a voting-enabled session notifies attending voters", async () => {
    const { dispatchNotificationToMany } = await import("@/lib/notifications");

    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: true,
      weekDate: new Date("2026-03-09T00:00:00.000Z"),
      trainers: [],
      members: [],
      votes: [
        { userId: "m-1", attending: true, id: "v-1", votedAt: new Date() },
        { userId: "m-2", attending: false, id: "v-2", votedAt: new Date() },
        { userId: "m-3", attending: true, id: "v-3", votedAt: new Date() },
      ],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
    });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      status: "CANCELLED",
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(dispatchNotificationToMany).toHaveBeenCalledWith(
      ["m-1", "m-3"],
      "CLASS_CANCELLED",
      expect.stringContaining("Monday"),
      expect.stringContaining("cancelled")
    );
  });

  it("cancelling a non-voting session still notifies assigned members", async () => {
    const { dispatchNotificationToMany } = await import("@/lib/notifications");

    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: false,
      weekDate: new Date("2026-03-09T00:00:00.000Z"),
      trainers: [],
      members: [
        { user: { id: "m-1", name: "Alice" } },
        { user: { id: "m-2", name: "Bob" } },
      ],
      votes: [],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
    });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      status: "CANCELLED",
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(dispatchNotificationToMany).toHaveBeenCalledWith(
      ["m-1", "m-2"],
      "CLASS_CANCELLED",
      expect.stringContaining("Monday"),
      expect.stringContaining("cancelled")
    );
  });

  it("cancel notification includes the specific date", async () => {
    const { dispatchNotificationToMany } = await import("@/lib/notifications");

    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: false,
      weekDate: new Date("2026-03-09T00:00:00.000Z"),
      trainers: [],
      members: [{ user: { id: "m-1", name: "Alice" } }],
      votes: [],
      recurringSlot: { dayOfWeek: 3, startHour: 18 },
    });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      status: "CANCELLED",
      recurringSlot: { dayOfWeek: 3, startHour: 18 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    // Wednesday of week starting March 9 = March 11
    expect(dispatchNotificationToMany).toHaveBeenCalledWith(
      ["m-1"],
      "CLASS_CANCELLED",
      expect.stringContaining("Mar 11"),
      expect.stringContaining("cancelled")
    );
  });

  it("cancelling a voting-enabled session with no attending voters sends no notification", async () => {
    const { dispatchNotificationToMany } = await import("@/lib/notifications");

    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: true,
      weekDate: new Date("2026-03-09T00:00:00.000Z"),
      trainers: [],
      members: [],
      votes: [
        { userId: "m-1", attending: false },
        { userId: "m-2", attending: false },
        { userId: "m-3", attending: false },
      ],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
    });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      status: "CANCELLED",
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(dispatchNotificationToMany).not.toHaveBeenCalled();
  });

  it("cancelling a voting-enabled session with all voters attending notifies all", async () => {
    const { dispatchNotificationToMany } = await import("@/lib/notifications");

    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: true,
      weekDate: new Date("2026-03-09T00:00:00.000Z"),
      trainers: [],
      members: [],
      votes: [
        { userId: "m-1", attending: true },
        { userId: "m-2", attending: true },
        { userId: "m-3", attending: true },
      ],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
    });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      status: "CANCELLED",
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(dispatchNotificationToMany).toHaveBeenCalledWith(
      ["m-1", "m-2", "m-3"],
      "CLASS_CANCELLED",
      expect.stringContaining("Monday"),
      expect.stringContaining("cancelled")
    );
  });

  it("cancelling a custom (one-off) session uses customDay and customStartHour", async () => {
    const { dispatchNotificationToMany } = await import("@/lib/notifications");

    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: true,
      weekDate: new Date("2026-03-09T00:00:00.000Z"),
      trainers: [],
      members: [],
      votes: [
        { userId: "m-1", attending: true },
      ],
      recurringSlot: null,
      customDay: 5,
      customStartHour: 14,
    });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      status: "CANCELLED",
      recurringSlot: null,
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    // Friday of week starting March 9 = March 13
    expect(dispatchNotificationToMany).toHaveBeenCalledWith(
      ["m-1"],
      "CLASS_CANCELLED",
      expect.stringContaining("Friday"),
      expect.stringContaining("cancelled")
    );
    expect(dispatchNotificationToMany).toHaveBeenCalledWith(
      ["m-1"],
      "CLASS_CANCELLED",
      expect.stringContaining("Mar 13"),
      expect.stringContaining("cancelled")
    );
  });

  it("cancelling an already-cancelled session does not re-notify", async () => {
    const { dispatchNotificationToMany } = await import("@/lib/notifications");

    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "CANCELLED",
      votingEnabled: false,
      weekDate: new Date("2026-03-09T00:00:00.000Z"),
      trainers: [],
      members: [{ user: { id: "m-1", name: "Alice" } }],
      votes: [],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
    });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      status: "CANCELLED",
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(dispatchNotificationToMany).not.toHaveBeenCalled();
  });

  it("returns 403 when trainer tries to cancel a session", async () => {
    mockAuth.mockResolvedValue(trainerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      trainers: [{ userId: "trainer-1" }],
      members: [],
      votes: [],
      recurringSlot: null,
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

    expect(response.status).toBe(403);
    expect(body.error).toBe("Trainers can only update workout details");
  });

  it("returns 403 when trainer tries to toggle voting", async () => {
    mockAuth.mockResolvedValue(trainerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      trainers: [{ userId: "trainer-1" }],
      members: [],
      votes: [],
      recurringSlot: null,
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: true }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Trainers can only update workout details");
  });

  it("allows trainer to update workout details only", async () => {
    mockAuth.mockResolvedValue(trainerSession());
    const sessionData = {
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: false,
      workoutTitle: null,
      workoutDetails: null,
      trainers: [{ userId: "trainer-1" }],
      members: [],
      votes: [],
      recurringSlot: null,
    };
    mockPrisma.session.findUnique.mockResolvedValue(sessionData);
    mockPrisma.session.update.mockResolvedValue({
      ...sessionData,
      workoutTitle: "AMRAP 20",
      workoutDetails: "Burpees and deadlifts",
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workoutTitle: "AMRAP 20", workoutDetails: "Burpees and deadlifts" }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(response.status).toBe(200);
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
      votingEnabled: false,
      weekDate: new Date("2026-03-09T00:00:00.000Z"),
      members: [],
      votes: [],
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
      votingEnabled: false,
      weekDate: new Date("2026-03-09T00:00:00.000Z"),
      members: [],
      votes: [],
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
      votingEnabled: false,
      weekDate: new Date("2026-03-09T00:00:00.000Z"),
      members: [
        { user: { id: "m-1" } },
        { user: { id: "m-2" } },
      ],
      votes: [],
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

  it("deleting a voting-enabled session notifies attending voters", async () => {
    const { dispatchNotificationToMany } = await import("@/lib/notifications");

    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      votingEnabled: true,
      weekDate: new Date("2026-03-09T00:00:00.000Z"),
      members: [],
      votes: [
        { userId: "m-1", attending: true },
        { userId: "m-2", attending: false },
      ],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
    });
    mockPrisma.session.delete.mockResolvedValue({});

    const { DELETE } = await import("@/app/api/sessions/[id]/route");
    await DELETE(
      new Request("http://localhost/api/sessions/s-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    // Should only notify m-1 (attending), not m-2
    expect(dispatchNotificationToMany).toHaveBeenCalledWith(
      ["m-1"],
      "SESSION_DELETED",
      expect.stringContaining("Monday"),
      expect.any(String)
    );
  });

  it("delete notification includes the specific date", async () => {
    const { dispatchNotificationToMany } = await import("@/lib/notifications");

    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      votingEnabled: false,
      weekDate: new Date("2026-03-09T00:00:00.000Z"),
      members: [{ user: { id: "m-1" } }],
      votes: [],
      recurringSlot: { dayOfWeek: 5, startHour: 14 },
    });
    mockPrisma.session.delete.mockResolvedValue({});

    const { DELETE } = await import("@/app/api/sessions/[id]/route");
    await DELETE(
      new Request("http://localhost/api/sessions/s-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    // Friday of week starting March 9 = March 13
    expect(dispatchNotificationToMany).toHaveBeenCalledWith(
      ["m-1"],
      "SESSION_DELETED",
      expect.stringContaining("Mar 13"),
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

  it("deleting a voting-enabled session with no voters sends no notification", async () => {
    const { dispatchNotificationToMany } = await import("@/lib/notifications");

    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      votingEnabled: true,
      weekDate: new Date("2026-03-09T00:00:00.000Z"),
      members: [],
      votes: [],
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
    expect(dispatchNotificationToMany).not.toHaveBeenCalled();
  });

  it("deleting a custom (one-off) session uses customDay and customStartHour", async () => {
    const { dispatchNotificationToMany } = await import("@/lib/notifications");

    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      votingEnabled: false,
      weekDate: new Date("2026-03-09T00:00:00.000Z"),
      members: [{ user: { id: "m-1" } }],
      votes: [],
      recurringSlot: null,
      customDay: 3,
      customStartHour: 18,
    });
    mockPrisma.session.delete.mockResolvedValue({});

    const { DELETE } = await import("@/app/api/sessions/[id]/route");
    await DELETE(
      new Request("http://localhost/api/sessions/s-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    // Wednesday of week starting March 9 = March 11
    expect(dispatchNotificationToMany).toHaveBeenCalledWith(
      ["m-1"],
      "SESSION_DELETED",
      expect.stringContaining("Wednesday"),
      expect.any(String)
    );
    expect(dispatchNotificationToMany).toHaveBeenCalledWith(
      ["m-1"],
      "SESSION_DELETED",
      expect.stringContaining("Mar 11"),
      expect.any(String)
    );
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

// ===== PATCH /api/sessions/[id] — Trainer Voting Toggle =====

describe("PATCH /api/sessions/[id] — trainer voting toggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("trainer cannot enable voting on their assigned session", async () => {
    mockAuth.mockResolvedValue(trainerSession("trainer-1"));
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: false,
      workoutTitle: null,
      trainers: [{ userId: "trainer-1" }],
      members: [],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
      customStartHour: null,
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: true }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Trainers can only update workout details");
    expect(mockPrisma.session.update).not.toHaveBeenCalled();
  });

  it("trainer cannot disable voting on their assigned session", async () => {
    mockAuth.mockResolvedValue(trainerSession("trainer-1"));
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: true,
      workoutTitle: null,
      trainers: [{ userId: "trainer-1" }],
      members: [],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
      customStartHour: null,
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: false }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Trainers can only update workout details");
    expect(mockPrisma.session.update).not.toHaveBeenCalled();
  });

  it("trainer cannot toggle voting on session they are NOT assigned to", async () => {
    mockAuth.mockResolvedValue(trainerSession("trainer-1"));
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: false,
      trainers: [{ userId: "trainer-2" }], // different trainer
      members: [],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
      customStartHour: null,
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: true }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(response.status).toBe(403);
    expect(mockPrisma.session.update).not.toHaveBeenCalled();
  });

  it("member cannot toggle voting", async () => {
    mockAuth.mockResolvedValue(memberSession());

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: true }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(response.status).toBe(403);
    expect(mockPrisma.session.update).not.toHaveBeenCalled();
  });

  it("owner can toggle voting (control test)", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: false,
      workoutTitle: null,
      trainers: [],
      members: [],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
      customStartHour: null,
    });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: true,
      workoutTitle: null,
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: true }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.votingEnabled).toBe(true);
  });

  it("trainer cannot update workout AND voting in same PATCH", async () => {
    mockAuth.mockResolvedValue(trainerSession("trainer-1"));
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: false,
      workoutTitle: null,
      trainers: [{ userId: "trainer-1" }],
      members: [],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
      customStartHour: null,
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workoutTitle: "Leg Day", votingEnabled: true }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Trainers can only update workout details");
    expect(mockPrisma.session.update).not.toHaveBeenCalled();
  });

  it("PATCH returns updated session data with votingEnabled value (owner)", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: false,
      workoutTitle: null,
      trainers: [],
      members: [],
      recurringSlot: { dayOfWeek: 2, startHour: 10 },
      customDay: null,
      customStartHour: null,
    });
    const updatedSession = {
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: true,
      workoutTitle: null,
      recurringSlot: { dayOfWeek: 2, startHour: 10 },
      members: [],
    };
    mockPrisma.session.update.mockResolvedValue(updatedSession);

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: true }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual(updatedSession);
    expect(body.data.votingEnabled).toBe(true);
    expect(body.data.id).toBe("s-1");
    expect(body.data.recurringSlot).toBeDefined();
  });

  it("trainer cannot toggle voting on a cancelled session", async () => {
    mockAuth.mockResolvedValue(trainerSession("trainer-1"));
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "CANCELLED",
      votingEnabled: false,
      workoutTitle: null,
      trainers: [{ userId: "trainer-1" }],
      members: [],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
      customStartHour: null,
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: true }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Trainers can only update workout details");
    expect(mockPrisma.session.update).not.toHaveBeenCalled();
  });
});

// ===== POST /api/sessions — One-Off Sessions =====

describe("POST /api/sessions — one-off sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates one-off session with customDay and customStartHour", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findFirst.mockResolvedValue(null);
    mockPrisma.session.create.mockResolvedValue({
      id: "oneoff-1",
      recurringSlotId: null,
      customDay: 3,
      customStartHour: 14,
      status: "SCHEDULED",
      votingEnabled: false,
      createdById: "owner-1",
    });

    const { POST } = await import("@/app/api/sessions/route");
    const response = await POST(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customDay: 3,
          customStartHour: 14,
          weekDate: "2025-03-10",
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.customDay).toBe(3);
    expect(body.data.customStartHour).toBe(14);
    expect(body.data.recurringSlotId).toBeNull();
  });

  it("returns 409 when one-off session already exists at same day/hour/week", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findFirst.mockResolvedValue({ id: "existing-oneoff" });

    const { POST } = await import("@/app/api/sessions/route");
    const response = await POST(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customDay: 3,
          customStartHour: 14,
          weekDate: "2025-03-10",
        }),
      })
    );

    expect(response.status).toBe(409);
  });

  it("returns 409 when one-off conflicts with recurring session at same day/hour/week", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findFirst.mockResolvedValue({
      id: "existing-recurring",
      recurringSlotId: "slot-1",
    });

    const { POST } = await import("@/app/api/sessions/route");
    const response = await POST(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customDay: 1,
          customStartHour: 9,
          weekDate: "2025-03-10",
        }),
      })
    );

    expect(response.status).toBe(409);
  });

  it("rejects customDay out of range", async () => {
    mockAuth.mockResolvedValue(ownerSession());

    const { POST } = await import("@/app/api/sessions/route");
    const response = await POST(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customDay: 8,
          customStartHour: 14,
          weekDate: "2025-03-10",
        }),
      })
    );

    expect(response.status).toBe(400);
  });

  it("rejects customStartHour out of range", async () => {
    mockAuth.mockResolvedValue(ownerSession());

    const { POST } = await import("@/app/api/sessions/route");
    const response = await POST(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customDay: 3,
          customStartHour: 23,
          weekDate: "2025-03-10",
        }),
      })
    );

    expect(response.status).toBe(400);
  });

  it("rejects body with both recurringSlotId AND custom fields", async () => {
    mockAuth.mockResolvedValue(ownerSession());

    const { POST } = await import("@/app/api/sessions/route");
    const response = await POST(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recurringSlotId: "cm1234567890abcdef",
          customDay: 3,
          customStartHour: 14,
          weekDate: "2025-03-10",
        }),
      })
    );

    expect(response.status).toBe(400);
  });

  it("rejects body with neither recurringSlotId nor custom fields", async () => {
    mockAuth.mockResolvedValue(ownerSession());

    const { POST } = await import("@/app/api/sessions/route");
    const response = await POST(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekDate: "2025-03-10",
        }),
      })
    );

    expect(response.status).toBe(400);
  });

  it("sets createdById on one-off session", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findFirst.mockResolvedValue(null);
    mockPrisma.session.create.mockResolvedValue({
      id: "oneoff-2",
      createdById: "owner-1",
    });

    const { POST } = await import("@/app/api/sessions/route");
    await POST(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customDay: 5,
          customStartHour: 16,
          weekDate: "2025-03-10",
        }),
      })
    );

    expect(mockPrisma.session.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdById: "owner-1",
          customDay: 5,
          customStartHour: 16,
        }),
      })
    );
  });

  it("returns 500 on unexpected error in one-off creation", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findFirst.mockRejectedValue(new Error("DB crash"));

    const { POST } = await import("@/app/api/sessions/route");
    const response = await POST(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customDay: 3,
          customStartHour: 14,
          weekDate: "2025-03-10",
        }),
      })
    );

    expect(response.status).toBe(500);
  });
});

// ===== POST /api/sessions — Trainer Access =====

describe("POST /api/sessions — trainer access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows TRAINER to create a recurring session", async () => {
    mockAuth.mockResolvedValue(trainerSession());
    mockPrisma.recurringSlot.findUnique.mockResolvedValue({
      id: "cm1234567890abcdef",
      dayOfWeek: 1,
      startHour: 9,
    });
    mockPrisma.session.findUnique.mockResolvedValue(null);
    mockPrisma.session.create.mockResolvedValue({
      id: "new-session",
      recurringSlotId: "cm1234567890abcdef",
      status: "SCHEDULED",
      votingEnabled: false,
      createdById: "trainer-1",
      recurringSlot: { id: "cm1234567890abcdef", dayOfWeek: 1, startHour: 9 },
    });
    mockPrisma.sessionTrainer.create.mockResolvedValue({});

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

    expect(response.status).toBe(201);
  });

  it("allows TRAINER to create a one-off session", async () => {
    mockAuth.mockResolvedValue(trainerSession());
    mockPrisma.session.findFirst.mockResolvedValue(null);
    mockPrisma.session.create.mockResolvedValue({
      id: "oneoff-trainer",
      customDay: 5,
      customStartHour: 16,
      recurringSlotId: null,
      status: "SCHEDULED",
      createdById: "trainer-1",
    });
    mockPrisma.sessionTrainer.create.mockResolvedValue({});

    const { POST } = await import("@/app/api/sessions/route");
    const response = await POST(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customDay: 5,
          customStartHour: 16,
          weekDate: "2025-03-10",
        }),
      })
    );

    expect(response.status).toBe(201);
  });

  it("auto-assigns trainer to session they create", async () => {
    mockAuth.mockResolvedValue(trainerSession("trainer-1"));
    mockPrisma.session.findFirst.mockResolvedValue(null);
    mockPrisma.session.create.mockResolvedValue({
      id: "oneoff-trainer",
      customDay: 5,
      customStartHour: 16,
      recurringSlotId: null,
      status: "SCHEDULED",
      createdById: "trainer-1",
    });
    mockPrisma.sessionTrainer.create.mockResolvedValue({});

    const { POST } = await import("@/app/api/sessions/route");
    await POST(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customDay: 5,
          customStartHour: 16,
          weekDate: "2025-03-10",
        }),
      })
    );

    expect(mockPrisma.sessionTrainer.create).toHaveBeenCalledWith({
      data: {
        sessionId: "oneoff-trainer",
        userId: "trainer-1",
      },
    });
  });

  it("does NOT auto-assign owner as trainer", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findFirst.mockResolvedValue(null);
    mockPrisma.session.create.mockResolvedValue({
      id: "oneoff-owner",
      customDay: 2,
      customStartHour: 10,
      createdById: "owner-1",
    });

    const { POST } = await import("@/app/api/sessions/route");
    await POST(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customDay: 2,
          customStartHour: 10,
          weekDate: "2025-03-10",
        }),
      })
    );

    expect(mockPrisma.sessionTrainer.create).not.toHaveBeenCalled();
  });

  it("still rejects MEMBER role for one-off sessions", async () => {
    mockAuth.mockResolvedValue(memberSession());

    const { POST } = await import("@/app/api/sessions/route");
    const response = await POST(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customDay: 3,
          customStartHour: 14,
          weekDate: "2025-03-10",
        }),
      })
    );

    expect(response.status).toBe(403);
  });

  it("auto-assigns trainer to recurring session they create", async () => {
    mockAuth.mockResolvedValue(trainerSession("trainer-1"));
    mockPrisma.recurringSlot.findUnique.mockResolvedValue({
      id: "cm1234567890abcdef",
      dayOfWeek: 1,
      startHour: 9,
    });
    mockPrisma.session.findUnique.mockResolvedValue(null);
    mockPrisma.session.create.mockResolvedValue({
      id: "recurring-trainer",
      recurringSlotId: "cm1234567890abcdef",
      status: "SCHEDULED",
      createdById: "trainer-1",
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
    });
    mockPrisma.sessionTrainer.create.mockResolvedValue({});

    const { POST } = await import("@/app/api/sessions/route");
    await POST(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recurringSlotId: "cm1234567890abcdef",
          weekDate: "2025-03-10",
        }),
      })
    );

    expect(mockPrisma.sessionTrainer.create).toHaveBeenCalledWith({
      data: {
        sessionId: "recurring-trainer",
        userId: "trainer-1",
      },
    });
  });
});

// ===== PATCH /api/sessions/[id] — enabling voting clears members =====

describe("PATCH /api/sessions/[id] — enabling voting clears members", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes all session members when voting is enabled by owner", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: false,
      workoutTitle: null,
      trainers: [],
      members: [
        { user: { id: "m-1", name: "Alice" } },
        { user: { id: "m-2", name: "Bob" } },
        { user: { id: "m-3", name: "Carol" } },
      ],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
      customStartHour: null,
    });
    mockPrisma.sessionMember.deleteMany.mockResolvedValue({ count: 3 });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: true,
      workoutTitle: null,
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: true }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.sessionMember.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: "s-1" },
    });
  });

  it("trainer cannot enable voting (restricted to workout fields)", async () => {
    mockAuth.mockResolvedValue(trainerSession("trainer-1"));
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: false,
      workoutTitle: null,
      trainers: [{ userId: "trainer-1" }],
      members: [
        { user: { id: "m-1", name: "Alice" } },
        { user: { id: "m-2", name: "Bob" } },
        { user: { id: "m-3", name: "Carol" } },
      ],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
      customStartHour: null,
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: true }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("Trainers can only update workout details");
    expect(mockPrisma.sessionMember.deleteMany).not.toHaveBeenCalled();
  });

  it("does NOT delete members when voting is already enabled (no-op toggle)", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: true,
      workoutTitle: null,
      trainers: [],
      members: [{ user: { id: "m-1", name: "Alice" } }],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
      customStartHour: null,
    });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: true,
      workoutTitle: null,
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [{ user: { id: "m-1", name: "Alice" } }],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: true }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.sessionMember.deleteMany).not.toHaveBeenCalled();
  });

  it("does NOT delete members when only updating workout (no votingEnabled field)", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: false,
      workoutTitle: null,
      trainers: [],
      members: [{ user: { id: "m-1", name: "Alice" } }],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
      customStartHour: null,
    });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: false,
      workoutTitle: "Leg Day",
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [{ user: { id: "m-1", name: "Alice" } }],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workoutTitle: "Leg Day" }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.sessionMember.deleteMany).not.toHaveBeenCalled();
  });

  it("clears members even when session has zero members (no error)", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: false,
      workoutTitle: null,
      trainers: [],
      members: [],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
      customStartHour: null,
    });
    mockPrisma.sessionMember.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: true,
      workoutTitle: null,
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: true }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.sessionMember.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: "s-1" },
    });
  });

  it("clears members when enabling voting alongside workout update", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: false,
      workoutTitle: null,
      trainers: [],
      members: [{ user: { id: "m-1", name: "Alice" } }],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
      customStartHour: null,
    });
    mockPrisma.sessionMember.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: true,
      workoutTitle: "Upper Body",
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: true, workoutTitle: "Upper Body" }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.sessionMember.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: "s-1" },
    });
  });

  it("clears members with many members (capacity edge)", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    const twentyMembers = Array.from({ length: 20 }, (_, i) => ({
      user: { id: `m-${i + 1}`, name: `Member ${i + 1}` },
    }));
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: false,
      workoutTitle: null,
      trainers: [],
      members: twentyMembers,
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
      customStartHour: null,
    });
    mockPrisma.sessionMember.deleteMany.mockResolvedValue({ count: 20 });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: true,
      workoutTitle: null,
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: true }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.sessionMember.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: "s-1" },
    });
  });
});

// ===== PATCH /api/sessions/[id] — disabling voting clears votes =====

describe("PATCH /api/sessions/[id] — disabling voting clears votes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes all votes when voting is disabled by owner", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: true,
      workoutTitle: null,
      trainers: [],
      members: [],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
      customStartHour: null,
    });
    mockPrisma.vote.deleteMany.mockResolvedValue({ count: 5 });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: false,
      workoutTitle: null,
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: false }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.vote.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: "s-1" },
    });
  });

  it("trainer cannot disable voting (restricted to workout fields)", async () => {
    mockAuth.mockResolvedValue(trainerSession("trainer-1"));
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: true,
      workoutTitle: null,
      trainers: [{ userId: "trainer-1" }],
      members: [],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
      customStartHour: null,
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: false }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("Trainers can only update workout details");
    expect(mockPrisma.vote.deleteMany).not.toHaveBeenCalled();
  });

  it("does NOT delete votes when voting is already disabled (no-op toggle)", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: false,
      workoutTitle: null,
      trainers: [],
      members: [],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
      customStartHour: null,
    });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: false,
      workoutTitle: null,
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: false }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.vote.deleteMany).not.toHaveBeenCalled();
  });

  it("clears votes even when session has zero votes (no error)", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: true,
      workoutTitle: null,
      trainers: [],
      members: [],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
      customStartHour: null,
    });
    mockPrisma.vote.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: false,
      workoutTitle: null,
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: false }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.vote.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: "s-1" },
    });
  });

  it("clears votes when disabling voting alongside workout update", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: true,
      workoutTitle: null,
      trainers: [],
      members: [],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
      customStartHour: null,
    });
    mockPrisma.vote.deleteMany.mockResolvedValue({ count: 2 });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: false,
      workoutTitle: "Cardio Blast",
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: false, workoutTitle: "Cardio Blast" }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.vote.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: "s-1" },
    });
  });

  it("clears many votes (20 members all voted)", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: true,
      workoutTitle: null,
      trainers: [],
      members: [],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
      customStartHour: null,
    });
    mockPrisma.vote.deleteMany.mockResolvedValue({ count: 20 });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: false,
      workoutTitle: null,
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: false }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.vote.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: "s-1" },
    });
  });
});

// ===== PATCH /api/sessions/[id] — voting toggle transaction & edge cases =====

describe("PATCH /api/sessions/[id] — voting toggle transaction & edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses $transaction when enabling voting (atomic cleanup)", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: false,
      workoutTitle: null,
      trainers: [],
      members: [],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
      customStartHour: null,
    });
    mockPrisma.sessionMember.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: true,
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: true }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it("uses $transaction when disabling voting (atomic cleanup)", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: true,
      workoutTitle: null,
      trainers: [],
      members: [],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
      customStartHour: null,
    });
    mockPrisma.vote.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: false,
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: false }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it("does not use $transaction when not toggling voting", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: false,
      workoutTitle: null,
      trainers: [],
      members: [],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
      customStartHour: null,
    });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: false,
      workoutTitle: "Leg Day",
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workoutTitle: "Leg Day" }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("enabling voting on cancelled session still clears members", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "CANCELLED",
      votingEnabled: false,
      workoutTitle: null,
      trainers: [],
      members: [{ user: { id: "m-1", name: "Alice" } }],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
      customStartHour: null,
    });
    mockPrisma.sessionMember.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      status: "CANCELLED",
      votingEnabled: true,
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: true }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.sessionMember.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: "s-1" },
    });
  });

  it("disabling voting on cancelled session still clears votes", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "CANCELLED",
      votingEnabled: true,
      workoutTitle: null,
      trainers: [],
      members: [],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
      customStartHour: null,
    });
    mockPrisma.vote.deleteMany.mockResolvedValue({ count: 3 });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      status: "CANCELLED",
      votingEnabled: false,
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: false }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.vote.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: "s-1" },
    });
  });

  it("enabling voting does NOT clear votes (only members)", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: false,
      workoutTitle: null,
      trainers: [],
      members: [{ user: { id: "m-1", name: "Alice" } }],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
      customStartHour: null,
    });
    mockPrisma.sessionMember.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: true,
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: true }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(mockPrisma.sessionMember.deleteMany).toHaveBeenCalled();
    expect(mockPrisma.vote.deleteMany).not.toHaveBeenCalled();
  });

  it("disabling voting does NOT clear members (only votes)", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: true,
      workoutTitle: null,
      trainers: [],
      members: [{ user: { id: "m-1", name: "Alice" } }],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
      customStartHour: null,
    });
    mockPrisma.vote.deleteMany.mockResolvedValue({ count: 2 });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: false,
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [{ user: { id: "m-1", name: "Alice" } }],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: false }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(mockPrisma.vote.deleteMany).toHaveBeenCalled();
    expect(mockPrisma.sessionMember.deleteMany).not.toHaveBeenCalled();
  });

  it("cancellation with simultaneous voting toggle does not conflict", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: false,
      workoutTitle: null,
      trainers: [],
      members: [{ user: { id: "m-1", name: "Alice" } }],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
      customStartHour: null,
    });
    mockPrisma.sessionMember.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      status: "CANCELLED",
      votingEnabled: true,
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: true, status: "CANCELLED" }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.sessionMember.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: "s-1" },
    });
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it("custom session (no recurringSlot) — enabling voting clears members", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: false,
      workoutTitle: null,
      trainers: [],
      members: [{ user: { id: "m-1", name: "Alice" } }],
      recurringSlot: null,
      customDay: 3,
      customStartHour: 14,
    });
    mockPrisma.sessionMember.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: true,
      recurringSlot: null,
      customDay: 3,
      customStartHour: 14,
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: true }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.sessionMember.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: "s-1" },
    });
  });

  it("custom session — disabling voting clears votes", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: true,
      workoutTitle: null,
      trainers: [],
      members: [],
      recurringSlot: null,
      customDay: 5,
      customStartHour: 16,
    });
    mockPrisma.vote.deleteMany.mockResolvedValue({ count: 4 });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: false,
      recurringSlot: null,
      customDay: 5,
      customStartHour: 16,
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: false }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.vote.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: "s-1" },
    });
  });

  it("enabling voting still allows session update to succeed", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: false,
      workoutTitle: null,
      trainers: [],
      members: [{ user: { id: "m-1", name: "Alice" } }],
      recurringSlot: { dayOfWeek: 2, startHour: 10 },
      customDay: null,
      customStartHour: null,
    });
    mockPrisma.sessionMember.deleteMany.mockResolvedValue({ count: 1 });
    const updatedSession = {
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: true,
      workoutTitle: "HIIT Circuit",
      recurringSlot: { dayOfWeek: 2, startHour: 10 },
      members: [],
    };
    mockPrisma.session.update.mockResolvedValue(updatedSession);

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: true, workoutTitle: "HIIT Circuit" }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual(updatedSession);
    expect(body.data.votingEnabled).toBe(true);
    expect(body.data.workoutTitle).toBe("HIIT Circuit");
    expect(body.data.members).toEqual([]);
  });
});

// ===== PATCH /api/sessions/[id] — workout-posted notification edge cases =====

describe("PATCH /api/sessions/[id] — workout-posted notification edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("workout posted on voting-enabled session notifies ALL voters including non-attending", async () => {
    const { dispatchNotificationToMany } = await import("@/lib/notifications");

    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: true,
      workoutTitle: null,
      weekDate: new Date("2026-03-09T00:00:00.000Z"),
      trainers: [],
      members: [],
      votes: [
        { userId: "m-1", attending: true },
        { userId: "m-2", attending: false },
      ],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
      customStartHour: null,
    });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: true,
      workoutTitle: "New WOD",
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workoutTitle: "New WOD" }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(dispatchNotificationToMany).toHaveBeenCalledWith(
      ["m-1", "m-2"],
      "WORKOUT_POSTED",
      "Workout posted for your upcoming class",
      "New workout: New WOD"
    );
  });

  it("workout posted on non-voting session notifies assigned members only", async () => {
    const { dispatchNotificationToMany } = await import("@/lib/notifications");

    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: false,
      workoutTitle: null,
      weekDate: new Date("2026-03-09T00:00:00.000Z"),
      trainers: [],
      members: [
        { user: { id: "m-1", name: "Alice" } },
        { user: { id: "m-2", name: "Bob" } },
      ],
      votes: [],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
      customStartHour: null,
    });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: false,
      workoutTitle: "New WOD",
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workoutTitle: "New WOD" }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(dispatchNotificationToMany).toHaveBeenCalledWith(
      ["m-1", "m-2"],
      "WORKOUT_POSTED",
      "Workout posted for your upcoming class",
      "New workout: New WOD"
    );
  });

  it("workout posted on voting session with no voters sends no notification", async () => {
    const { dispatchNotificationToMany } = await import("@/lib/notifications");

    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: true,
      workoutTitle: null,
      weekDate: new Date("2026-03-09T00:00:00.000Z"),
      trainers: [],
      members: [],
      votes: [],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
      customStartHour: null,
    });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: true,
      workoutTitle: "New WOD",
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workoutTitle: "New WOD" }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(dispatchNotificationToMany).not.toHaveBeenCalledWith(
      expect.anything(),
      "WORKOUT_POSTED",
      expect.anything(),
      expect.anything()
    );
  });

  it("workout update (not first post) does not trigger notification", async () => {
    const { dispatchNotificationToMany } = await import("@/lib/notifications");

    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: true,
      workoutTitle: "Old WOD",
      weekDate: new Date("2026-03-09T00:00:00.000Z"),
      trainers: [],
      members: [],
      votes: [
        { userId: "m-1", attending: true },
        { userId: "m-2", attending: false },
      ],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
      customStartHour: null,
    });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: true,
      workoutTitle: "New WOD",
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workoutTitle: "New WOD" }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(dispatchNotificationToMany).not.toHaveBeenCalledWith(
      expect.anything(),
      "WORKOUT_POSTED",
      expect.anything(),
      expect.anything()
    );
  });
});
