/**
 * Recurring Slots API Tests
 *
 * Tests GET/POST/DELETE /api/recurring-slots with role-based access.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

const mockPrisma = {
  recurringSlot: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
};
vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

function ownerSession() {
  return { user: { id: "owner-1", role: "OWNER" } };
}
function trainerSession() {
  return { user: { id: "trainer-1", role: "TRAINER" } };
}
function memberSession() {
  return { user: { id: "member-1", role: "MEMBER" } };
}

// ===== GET /api/recurring-slots =====

describe("GET /api/recurring-slots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { GET } = await import("@/app/api/recurring-slots/route");
    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("allows OWNER to list slots", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.recurringSlot.findMany.mockResolvedValue([
      { id: "slot-1", dayOfWeek: 1, startHour: 9, _count: { sessions: 5 } },
    ]);

    const { GET } = await import("@/app/api/recurring-slots/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
  });

  it("allows TRAINER to list slots", async () => {
    mockAuth.mockResolvedValue(trainerSession());
    mockPrisma.recurringSlot.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/recurring-slots/route");
    const response = await GET();

    expect(response.status).toBe(200);
  });

  it("rejects MEMBER role", async () => {
    mockAuth.mockResolvedValue(memberSession());

    const { GET } = await import("@/app/api/recurring-slots/route");
    const response = await GET();

    expect(response.status).toBe(403);
  });
});

// ===== POST /api/recurring-slots =====

describe("POST /api/recurring-slots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { POST } = await import("@/app/api/recurring-slots/route");
    const response = await POST(
      new Request("http://localhost/api/recurring-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayOfWeek: 1, startHour: 9 }),
      })
    );

    expect(response.status).toBe(401);
  });

  it("allows OWNER to create a slot", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.recurringSlot.findUnique.mockResolvedValue(null);
    mockPrisma.recurringSlot.create.mockResolvedValue({
      id: "slot-1",
      dayOfWeek: 1,
      startHour: 9,
    });

    const { POST } = await import("@/app/api/recurring-slots/route");
    const response = await POST(
      new Request("http://localhost/api/recurring-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayOfWeek: 1, startHour: 9 }),
      })
    );

    expect(response.status).toBe(201);
  });

  it("allows TRAINER to create a slot", async () => {
    mockAuth.mockResolvedValue(trainerSession());
    mockPrisma.recurringSlot.findUnique.mockResolvedValue(null);
    mockPrisma.recurringSlot.create.mockResolvedValue({
      id: "slot-2",
      dayOfWeek: 2,
      startHour: 10,
    });

    const { POST } = await import("@/app/api/recurring-slots/route");
    const response = await POST(
      new Request("http://localhost/api/recurring-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayOfWeek: 2, startHour: 10 }),
      })
    );

    expect(response.status).toBe(201);
  });

  it("rejects MEMBER role", async () => {
    mockAuth.mockResolvedValue(memberSession());

    const { POST } = await import("@/app/api/recurring-slots/route");
    const response = await POST(
      new Request("http://localhost/api/recurring-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayOfWeek: 1, startHour: 9 }),
      })
    );

    expect(response.status).toBe(403);
  });

  it("returns 409 for duplicate slot", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.recurringSlot.findUnique.mockResolvedValue({
      id: "existing",
      dayOfWeek: 1,
      startHour: 9,
    });

    const { POST } = await import("@/app/api/recurring-slots/route");
    const response = await POST(
      new Request("http://localhost/api/recurring-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayOfWeek: 1, startHour: 9 }),
      })
    );

    expect(response.status).toBe(409);
  });

  it("rejects invalid dayOfWeek (> 7)", async () => {
    mockAuth.mockResolvedValue(ownerSession());

    const { POST } = await import("@/app/api/recurring-slots/route");
    const response = await POST(
      new Request("http://localhost/api/recurring-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayOfWeek: 8, startHour: 9 }),
      })
    );

    expect(response.status).toBe(400);
  });

  it("rejects invalid startHour (> 22)", async () => {
    mockAuth.mockResolvedValue(ownerSession());

    const { POST } = await import("@/app/api/recurring-slots/route");
    const response = await POST(
      new Request("http://localhost/api/recurring-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayOfWeek: 1, startHour: 23 }),
      })
    );

    expect(response.status).toBe(400);
  });

  it("rejects invalid startHour (< 7)", async () => {
    mockAuth.mockResolvedValue(ownerSession());

    const { POST } = await import("@/app/api/recurring-slots/route");
    const response = await POST(
      new Request("http://localhost/api/recurring-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayOfWeek: 1, startHour: 5 }),
      })
    );

    expect(response.status).toBe(400);
  });

  it("returns 500 on unexpected error", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.recurringSlot.findUnique.mockRejectedValue(new Error("DB crash"));

    const { POST } = await import("@/app/api/recurring-slots/route");
    const response = await POST(
      new Request("http://localhost/api/recurring-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayOfWeek: 1, startHour: 9 }),
      })
    );

    expect(response.status).toBe(500);
  });
});

// ===== DELETE /api/recurring-slots =====

describe("DELETE /api/recurring-slots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows OWNER to delete", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.recurringSlot.findUnique.mockResolvedValue({
      id: "slot-1",
      dayOfWeek: 1,
      startHour: 9,
    });
    mockPrisma.recurringSlot.delete.mockResolvedValue({});

    const { DELETE } = await import("@/app/api/recurring-slots/route");
    const response = await DELETE(
      new Request("http://localhost/api/recurring-slots", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "slot-1" }),
      })
    );

    expect(response.status).toBe(200);
  });

  it("rejects TRAINER for DELETE (owner-only operation)", async () => {
    mockAuth.mockResolvedValue(trainerSession());

    const { DELETE } = await import("@/app/api/recurring-slots/route");
    const response = await DELETE(
      new Request("http://localhost/api/recurring-slots", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "slot-1" }),
      })
    );

    expect(response.status).toBe(403);
  });

  it("rejects MEMBER for DELETE", async () => {
    mockAuth.mockResolvedValue(memberSession());

    const { DELETE } = await import("@/app/api/recurring-slots/route");
    const response = await DELETE(
      new Request("http://localhost/api/recurring-slots", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "slot-1" }),
      })
    );

    expect(response.status).toBe(403);
  });

  it("returns 404 when slot not found", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.recurringSlot.findUnique.mockResolvedValue(null);

    const { DELETE } = await import("@/app/api/recurring-slots/route");
    const response = await DELETE(
      new Request("http://localhost/api/recurring-slots", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "nonexistent" }),
      })
    );

    expect(response.status).toBe(404);
  });
});
