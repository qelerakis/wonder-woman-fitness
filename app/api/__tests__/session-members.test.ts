/**
 * Session Members API Integration Tests
 *
 * Tests auth enforcement, role-based access (owner/trainer/member),
 * trainer assignment checks, validation, capacity limits, duplicate prevention,
 * and happy paths for POST /api/sessions/[id]/members.
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
  sessionMember: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  sessionTrainer: {
    findUnique: vi.fn(),
  },
  vote: {
    deleteMany: vi.fn(),
  },
  $transaction: vi.fn(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma)),
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

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/sessions/s-1/members", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_CUID = "cm1234567890abcdef";

const UPDATED_MEMBER_LIST = [
  {
    userId: "m-1",
    user: { id: "m-1", name: "Alice", email: "alice@test.com", status: "ACTIVE" },
  },
];

// ===== POST /api/sessions/[id]/members =====

describe("POST /api/sessions/[id]/members", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: return the updated member list after any mutation
    mockPrisma.sessionMember.findMany.mockResolvedValue(UPDATED_MEMBER_LIST);
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { POST } = await import("@/app/api/sessions/[id]/members/route");
    const response = await POST(
      makeRequest({ userId: VALID_CUID, action: "add" }),
      makeParams("s-1")
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 403 when called by MEMBER role", async () => {
    mockAuth.mockResolvedValue(memberSession());

    const { POST } = await import("@/app/api/sessions/[id]/members/route");
    const response = await POST(
      makeRequest({ userId: VALID_CUID, action: "add" }),
      makeParams("s-1")
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("Forbidden");
  });

  it("returns 404 when session not found", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue(null);

    const { POST } = await import("@/app/api/sessions/[id]/members/route");
    const response = await POST(
      makeRequest({ userId: VALID_CUID, action: "add" }),
      makeParams("nonexistent")
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("Session not found");
  });

  it("returns 400 for invalid body (missing fields)", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({ id: "s-1", status: "SCHEDULED" });

    const { POST } = await import("@/app/api/sessions/[id]/members/route");
    const response = await POST(
      makeRequest({ action: "add" }), // missing userId
      makeParams("s-1")
    );

    expect(response.status).toBe(400);
  });

  it("returns 400 when session is CANCELLED", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({ id: "s-1", status: "CANCELLED" });

    const { POST } = await import("@/app/api/sessions/[id]/members/route");
    const response = await POST(
      makeRequest({ userId: VALID_CUID, action: "add" }),
      makeParams("s-1")
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("cancelled");
  });

  it("returns 400 when target user not found", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({ id: "s-1", status: "SCHEDULED" });
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const { POST } = await import("@/app/api/sessions/[id]/members/route");
    const response = await POST(
      makeRequest({ userId: VALID_CUID, action: "add" }),
      makeParams("s-1")
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("not found");
  });

  it("returns 400 when target user is not MEMBER role", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({ id: "s-1", status: "SCHEDULED" });
    mockPrisma.user.findUnique.mockResolvedValue({ id: VALID_CUID, role: "TRAINER", status: "ACTIVE" });

    const { POST } = await import("@/app/api/sessions/[id]/members/route");
    const response = await POST(
      makeRequest({ userId: VALID_CUID, action: "add" }),
      makeParams("s-1")
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("not a member");
  });

  it("returns 400 when target member has DEPARTED status", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({ id: "s-1", status: "SCHEDULED" });
    mockPrisma.user.findUnique.mockResolvedValue({ id: VALID_CUID, role: "MEMBER", status: "DEPARTED" });

    const { POST } = await import("@/app/api/sessions/[id]/members/route");
    const response = await POST(
      makeRequest({ userId: VALID_CUID, action: "add" }),
      makeParams("s-1")
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("departed");
  });

  it("owner add: creates SessionMember and returns updated list", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({ id: "s-1", status: "SCHEDULED" });
    mockPrisma.user.findUnique.mockResolvedValue({ id: VALID_CUID, role: "MEMBER", status: "ACTIVE" });
    mockPrisma.sessionMember.count.mockResolvedValue(5);
    mockPrisma.sessionMember.findUnique.mockResolvedValue(null); // not yet assigned
    mockPrisma.sessionMember.create.mockResolvedValue({ sessionId: "s-1", userId: VALID_CUID });

    const { POST } = await import("@/app/api/sessions/[id]/members/route");
    const response = await POST(
      makeRequest({ userId: VALID_CUID, action: "add" }),
      makeParams("s-1")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].userId).toBe("m-1");
    expect(mockPrisma.sessionMember.create).toHaveBeenCalledWith({
      data: { sessionId: "s-1", userId: VALID_CUID },
    });
  });

  it("trainer add: works when trainer is assigned to session", async () => {
    mockAuth.mockResolvedValue(trainerSession("trainer-1"));
    mockPrisma.session.findUnique.mockResolvedValue({ id: "s-1", status: "SCHEDULED" });
    mockPrisma.sessionTrainer.findUnique.mockResolvedValue({ sessionId: "s-1", userId: "trainer-1" });
    mockPrisma.user.findUnique.mockResolvedValue({ id: VALID_CUID, role: "MEMBER", status: "ACTIVE" });
    mockPrisma.sessionMember.count.mockResolvedValue(3);
    mockPrisma.sessionMember.findUnique.mockResolvedValue(null);
    mockPrisma.sessionMember.create.mockResolvedValue({ sessionId: "s-1", userId: VALID_CUID });

    const { POST } = await import("@/app/api/sessions/[id]/members/route");
    const response = await POST(
      makeRequest({ userId: VALID_CUID, action: "add" }),
      makeParams("s-1")
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.sessionMember.create).toHaveBeenCalled();
  });

  it("trainer add: returns 403 when trainer is NOT assigned to session", async () => {
    mockAuth.mockResolvedValue(trainerSession("trainer-1"));
    mockPrisma.session.findUnique.mockResolvedValue({ id: "s-1", status: "SCHEDULED" });
    mockPrisma.sessionTrainer.findUnique.mockResolvedValue(null); // not assigned

    const { POST } = await import("@/app/api/sessions/[id]/members/route");
    const response = await POST(
      makeRequest({ userId: VALID_CUID, action: "add" }),
      makeParams("s-1")
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("Forbidden");
  });

  it("trainer remove: works when trainer is assigned to session", async () => {
    mockAuth.mockResolvedValue(trainerSession("trainer-1"));
    mockPrisma.session.findUnique.mockResolvedValue({ id: "s-1", status: "SCHEDULED" });
    mockPrisma.sessionTrainer.findUnique.mockResolvedValue({ sessionId: "s-1", userId: "trainer-1" }); // assigned
    mockPrisma.user.findUnique.mockResolvedValue({ id: VALID_CUID, role: "MEMBER", status: "ACTIVE" });
    mockPrisma.sessionMember.findUnique.mockResolvedValue({ sessionId: "s-1", userId: VALID_CUID });
    mockPrisma.sessionMember.delete.mockResolvedValue({});
    mockPrisma.vote.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.sessionMember.findMany.mockResolvedValue([]);

    const { POST } = await import("@/app/api/sessions/[id]/members/route");
    const response = await POST(
      makeRequest({ userId: VALID_CUID, action: "remove" }),
      makeParams("s-1")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(0);
  });

  it("add: returns 409 when member already assigned", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({ id: "s-1", status: "SCHEDULED" });
    mockPrisma.user.findUnique.mockResolvedValue({ id: VALID_CUID, role: "MEMBER", status: "ACTIVE" });
    mockPrisma.sessionMember.count.mockResolvedValue(5);
    mockPrisma.sessionMember.findUnique.mockResolvedValue({ sessionId: "s-1", userId: VALID_CUID }); // already assigned

    const { POST } = await import("@/app/api/sessions/[id]/members/route");
    const response = await POST(
      makeRequest({ userId: VALID_CUID, action: "add" }),
      makeParams("s-1")
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toContain("already assigned");
  });

  it("add: returns 400 when at MAX_CLASS_SIZE capacity", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({ id: "s-1", status: "SCHEDULED" });
    mockPrisma.user.findUnique.mockResolvedValue({ id: VALID_CUID, role: "MEMBER", status: "ACTIVE" });
    mockPrisma.sessionMember.count.mockResolvedValue(20); // at capacity

    const { POST } = await import("@/app/api/sessions/[id]/members/route");
    const response = await POST(
      makeRequest({ userId: VALID_CUID, action: "add" }),
      makeParams("s-1")
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("capacity");
  });

  it("owner remove: deletes SessionMember and returns updated list", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({ id: "s-1", status: "SCHEDULED" });
    mockPrisma.user.findUnique.mockResolvedValue({ id: VALID_CUID, role: "MEMBER", status: "ACTIVE" });
    mockPrisma.sessionMember.findUnique.mockResolvedValue({ sessionId: "s-1", userId: VALID_CUID });
    mockPrisma.sessionMember.delete.mockResolvedValue({});
    mockPrisma.vote.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.sessionMember.findMany.mockResolvedValue([]); // empty after removal

    const { POST } = await import("@/app/api/sessions/[id]/members/route");
    const response = await POST(
      makeRequest({ userId: VALID_CUID, action: "remove" }),
      makeParams("s-1")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(0);
  });

  it("remove: also deletes the member's Vote via $transaction", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({ id: "s-1", status: "SCHEDULED" });
    mockPrisma.user.findUnique.mockResolvedValue({ id: VALID_CUID, role: "MEMBER", status: "ACTIVE" });
    mockPrisma.sessionMember.findUnique.mockResolvedValue({ sessionId: "s-1", userId: VALID_CUID });
    mockPrisma.sessionMember.delete.mockResolvedValue({});
    mockPrisma.vote.deleteMany.mockResolvedValue({ count: 1 });

    const { POST } = await import("@/app/api/sessions/[id]/members/route");
    await POST(
      makeRequest({ userId: VALID_CUID, action: "remove" }),
      makeParams("s-1")
    );

    // Verify $transaction was called
    expect(mockPrisma.$transaction).toHaveBeenCalled();

    // Verify both operations were called with correct args
    expect(mockPrisma.sessionMember.delete).toHaveBeenCalledWith({
      where: {
        sessionId_userId: { sessionId: "s-1", userId: VALID_CUID },
      },
    });
    expect(mockPrisma.vote.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: "s-1", userId: VALID_CUID },
    });
  });

  it("remove: returns 404 when member not assigned", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({ id: "s-1", status: "SCHEDULED" });
    mockPrisma.user.findUnique.mockResolvedValue({ id: VALID_CUID, role: "MEMBER", status: "ACTIVE" });
    mockPrisma.sessionMember.findUnique.mockResolvedValue(null); // not assigned

    const { POST } = await import("@/app/api/sessions/[id]/members/route");
    const response = await POST(
      makeRequest({ userId: VALID_CUID, action: "remove" }),
      makeParams("s-1")
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toContain("not assigned");
  });

  it("returns 500 on unexpected error", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockRejectedValue(new Error("DB crash"));

    const { POST } = await import("@/app/api/sessions/[id]/members/route");
    const response = await POST(
      makeRequest({ userId: VALID_CUID, action: "add" }),
      makeParams("s-1")
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Internal server error");
  });

  it("returns 400 for invalid action value", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({ id: "s-1", status: "SCHEDULED" });

    const { POST } = await import("@/app/api/sessions/[id]/members/route");
    const response = await POST(
      makeRequest({ userId: VALID_CUID, action: "transfer" }), // invalid action
      makeParams("s-1")
    );

    expect(response.status).toBe(400);
  });
});
