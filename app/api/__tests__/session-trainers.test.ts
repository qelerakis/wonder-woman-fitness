/**
 * Session Trainers API Integration Tests
 *
 * Tests auth enforcement, role-based access, validation, duplicate prevention,
 * and happy paths for POST /api/sessions/[id]/trainers.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ===== Mocks =====

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

const mockPrisma = {
  session: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  sessionTrainer: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
};
vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

// ===== Helpers =====

function ownerSession() {
  return { user: { id: "owner-1", email: "owner@test.com", role: "OWNER", status: "ACTIVE" } };
}

function trainerSession() {
  return { user: { id: "trainer-1", email: "trainer@test.com", role: "TRAINER", status: "ACTIVE" } };
}

function memberSession() {
  return { user: { id: "member-1", email: "member@test.com", role: "MEMBER", status: "ACTIVE" } };
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/sessions/s-1/trainers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const updatedTrainerList = [
  {
    userId: "trainer-1",
    user: { id: "trainer-1", name: "Trainer One", email: "trainer1@test.com" },
  },
];

// ===== POST /api/sessions/[id]/trainers =====

describe("POST /api/sessions/[id]/trainers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { POST } = await import("@/app/api/sessions/[id]/trainers/route");
    const response = await POST(
      makeRequest({ userId: "cm1234567890abcdef", action: "add" }),
      makeParams("s-1")
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 403 when called by MEMBER", async () => {
    mockAuth.mockResolvedValue(memberSession());

    const { POST } = await import("@/app/api/sessions/[id]/trainers/route");
    const response = await POST(
      makeRequest({ userId: "cm1234567890abcdef", action: "add" }),
      makeParams("s-1")
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("Forbidden");
  });

  it("returns 403 when called by TRAINER", async () => {
    mockAuth.mockResolvedValue(trainerSession());

    const { POST } = await import("@/app/api/sessions/[id]/trainers/route");
    const response = await POST(
      makeRequest({ userId: "cm1234567890abcdef", action: "add" }),
      makeParams("s-1")
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("Forbidden");
  });

  it("returns 404 when session not found", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue(null);

    const { POST } = await import("@/app/api/sessions/[id]/trainers/route");
    const response = await POST(
      makeRequest({ userId: "cm1234567890abcdef", action: "add" }),
      makeParams("nonexistent")
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("Session not found");
  });

  it("returns 400 for invalid body (missing userId)", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({ id: "s-1", status: "SCHEDULED" });

    const { POST } = await import("@/app/api/sessions/[id]/trainers/route");
    const response = await POST(
      makeRequest({ action: "add" }),
      makeParams("s-1")
    );

    expect(response.status).toBe(400);
  });

  it("returns 400 for invalid body (invalid action value)", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({ id: "s-1", status: "SCHEDULED" });

    const { POST } = await import("@/app/api/sessions/[id]/trainers/route");
    const response = await POST(
      makeRequest({ userId: "cm1234567890abcdef", action: "replace" }),
      makeParams("s-1")
    );

    expect(response.status).toBe(400);
  });

  it("returns 400 when session is CANCELLED", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({ id: "s-1", status: "CANCELLED" });

    const { POST } = await import("@/app/api/sessions/[id]/trainers/route");
    const response = await POST(
      makeRequest({ userId: "cm1234567890abcdef", action: "add" }),
      makeParams("s-1")
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("cancelled");
  });

  it("returns 400 when target user is not a TRAINER", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({ id: "s-1", status: "SCHEDULED" });
    mockPrisma.user.findUnique.mockResolvedValue({ id: "member-1", role: "MEMBER" });

    const { POST } = await import("@/app/api/sessions/[id]/trainers/route");
    const response = await POST(
      makeRequest({ userId: "cm1234567890abcdef", action: "add" }),
      makeParams("s-1")
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("not a trainer");
  });

  it("returns 400 when target user not found", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({ id: "s-1", status: "SCHEDULED" });
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const { POST } = await import("@/app/api/sessions/[id]/trainers/route");
    const response = await POST(
      makeRequest({ userId: "cm1234567890abcdef", action: "add" }),
      makeParams("s-1")
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("not found");
  });

  it("creates SessionTrainer and returns updated list on add", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({ id: "s-1", status: "SCHEDULED" });
    mockPrisma.user.findUnique.mockResolvedValue({ id: "trainer-1", role: "TRAINER" });
    mockPrisma.sessionTrainer.findUnique.mockResolvedValue(null); // not yet assigned
    mockPrisma.sessionTrainer.create.mockResolvedValue({});
    mockPrisma.sessionTrainer.findMany.mockResolvedValue(updatedTrainerList);

    const { POST } = await import("@/app/api/sessions/[id]/trainers/route");
    const response = await POST(
      makeRequest({ userId: "cm1234567890abcdef", action: "add" }),
      makeParams("s-1")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].userId).toBe("trainer-1");
    expect(body.data[0].name).toBe("Trainer One");
    expect(body.data[0].email).toBe("trainer1@test.com");
    expect(mockPrisma.sessionTrainer.create).toHaveBeenCalledWith({
      data: { sessionId: "s-1", userId: "cm1234567890abcdef" },
    });
  });

  it("returns 409 when trainer is already assigned on add", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({ id: "s-1", status: "SCHEDULED" });
    mockPrisma.user.findUnique.mockResolvedValue({ id: "trainer-1", role: "TRAINER" });
    mockPrisma.sessionTrainer.findUnique.mockResolvedValue({
      sessionId: "s-1",
      userId: "cm1234567890abcdef",
    });

    const { POST } = await import("@/app/api/sessions/[id]/trainers/route");
    const response = await POST(
      makeRequest({ userId: "cm1234567890abcdef", action: "add" }),
      makeParams("s-1")
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toContain("already assigned");
  });

  it("deletes SessionTrainer and returns updated list on remove", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({ id: "s-1", status: "SCHEDULED" });
    mockPrisma.user.findUnique.mockResolvedValue({ id: "trainer-1", role: "TRAINER" });
    mockPrisma.sessionTrainer.findUnique.mockResolvedValue({
      sessionId: "s-1",
      userId: "cm1234567890abcdef",
    });
    mockPrisma.sessionTrainer.delete.mockResolvedValue({});
    mockPrisma.sessionTrainer.findMany.mockResolvedValue([]); // empty after removal

    const { POST } = await import("@/app/api/sessions/[id]/trainers/route");
    const response = await POST(
      makeRequest({ userId: "cm1234567890abcdef", action: "remove" }),
      makeParams("s-1")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(0);
    expect(mockPrisma.sessionTrainer.delete).toHaveBeenCalledWith({
      where: {
        sessionId_userId: { sessionId: "s-1", userId: "cm1234567890abcdef" },
      },
    });
  });

  it("returns 404 when trainer is not assigned on remove", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({ id: "s-1", status: "SCHEDULED" });
    mockPrisma.user.findUnique.mockResolvedValue({ id: "trainer-1", role: "TRAINER" });
    mockPrisma.sessionTrainer.findUnique.mockResolvedValue(null); // not assigned

    const { POST } = await import("@/app/api/sessions/[id]/trainers/route");
    const response = await POST(
      makeRequest({ userId: "cm1234567890abcdef", action: "remove" }),
      makeParams("s-1")
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toContain("not assigned");
  });

  it("returns 500 on unexpected error", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockRejectedValue(new Error("DB crash"));

    const { POST } = await import("@/app/api/sessions/[id]/trainers/route");
    const response = await POST(
      makeRequest({ userId: "cm1234567890abcdef", action: "add" }),
      makeParams("s-1")
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Internal server error");
  });
});
