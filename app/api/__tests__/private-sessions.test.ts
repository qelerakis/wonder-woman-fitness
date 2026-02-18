/**
 * Private Sessions API Integration Tests
 *
 * Tests auth enforcement, role-based access (owner/trainer/member),
 * trainer ownership checks, date filtering, validation, and happy paths
 * for GET, POST /api/private-sessions and PATCH, DELETE /api/private-sessions/[id].
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

const mockPrisma = {
  privateSession: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  user: {
    findFirst: vi.fn(),
  },
};
vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

// ===== Helpers =====

function ownerSession(): {
  user: { id: string; email: string; role: string; status: string };
} {
  return {
    user: {
      id: "owner-1",
      email: "owner@test.com",
      role: "OWNER",
      status: "ACTIVE",
    },
  };
}

function trainerSession(
  id = "trainer-1"
): {
  user: { id: string; email: string; role: string; status: string };
} {
  return {
    user: {
      id,
      email: "trainer@test.com",
      role: "TRAINER",
      status: "ACTIVE",
    },
  };
}

function memberSession(
  id = "member-1"
): {
  user: { id: string; email: string; role: string; status: string };
} {
  return {
    user: {
      id,
      email: "member@test.com",
      role: "MEMBER",
      status: "ACTIVE",
    },
  };
}

function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function makeGetRequest(queryString = ""): Request {
  return new Request(
    `http://localhost/api/private-sessions${queryString}`,
    { method: "GET" }
  );
}

function makePostRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/private-sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makePatchRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/private-sessions/ps-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeDeleteRequest(): Request {
  return new Request("http://localhost/api/private-sessions/ps-1", {
    method: "DELETE",
  });
}

const VALID_DATETIME = "2026-03-15T10:00:00.000Z";

const VALID_POST_BODY = {
  clientName: "Jane Doe",
  scheduledAt: VALID_DATETIME,
  paid: false,
  amount: 50,
  exerciseDetails: "Upper body workout",
  notes: "First time client",
};

const SAMPLE_PRIVATE_SESSION = {
  id: "ps-1",
  clientName: "Jane Doe",
  scheduledAt: new Date(VALID_DATETIME),
  paid: false,
  amount: 50,
  exerciseDetails: "Upper body workout",
  notes: "First time client",
  createdAt: new Date("2026-03-01T08:00:00.000Z"),
  createdBy: { id: "trainer-1", name: "Trainer One" },
};

const SAMPLE_PRIVATE_SESSION_2 = {
  id: "ps-2",
  clientName: "John Smith",
  scheduledAt: new Date("2026-03-20T14:00:00.000Z"),
  paid: true,
  amount: 60,
  exerciseDetails: "Leg day",
  notes: "",
  createdAt: new Date("2026-03-02T08:00:00.000Z"),
  createdBy: { id: "owner-1", name: "Owner One" },
};

// ===== GET /api/private-sessions =====

describe("GET /api/private-sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { GET } = await import("@/app/api/private-sessions/route");
    const response = await GET(makeGetRequest());

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 403 when role is MEMBER", async () => {
    mockAuth.mockResolvedValue(memberSession());

    const { GET } = await import("@/app/api/private-sessions/route");
    const response = await GET(makeGetRequest());

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("Forbidden");
  });

  it("owner sees ALL private sessions", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.privateSession.findMany.mockResolvedValue([
      SAMPLE_PRIVATE_SESSION,
      SAMPLE_PRIVATE_SESSION_2,
    ]);

    const { GET } = await import("@/app/api/private-sessions/route");
    const response = await GET(makeGetRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(2);
    // Owner query should NOT have createdById filter
    const callArgs = mockPrisma.privateSession.findMany.mock.calls[0][0];
    expect(callArgs.where).not.toHaveProperty("createdById");
  });

  it("trainer sees only their OWN private sessions (createdById filter)", async () => {
    mockAuth.mockResolvedValue(trainerSession("trainer-1"));
    mockPrisma.privateSession.findMany.mockResolvedValue([
      SAMPLE_PRIVATE_SESSION,
    ]);

    const { GET } = await import("@/app/api/private-sessions/route");
    const response = await GET(makeGetRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    // Trainer query MUST have createdById filter
    const callArgs = mockPrisma.privateSession.findMany.mock.calls[0][0];
    expect(callArgs.where.createdById).toBe("trainer-1");
  });

  it("supports startDate filter", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.privateSession.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/private-sessions/route");
    const response = await GET(
      makeGetRequest("?startDate=2026-03-10T00:00:00.000Z")
    );

    expect(response.status).toBe(200);
    const callArgs = mockPrisma.privateSession.findMany.mock.calls[0][0];
    expect(callArgs.where.scheduledAt).toBeDefined();
    expect(callArgs.where.scheduledAt.gte).toEqual(
      new Date("2026-03-10T00:00:00.000Z")
    );
  });

  it("supports endDate filter", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.privateSession.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/private-sessions/route");
    const response = await GET(
      makeGetRequest("?endDate=2026-03-31T23:59:59.000Z")
    );

    expect(response.status).toBe(200);
    const callArgs = mockPrisma.privateSession.findMany.mock.calls[0][0];
    expect(callArgs.where.scheduledAt).toBeDefined();
    expect(callArgs.where.scheduledAt.lte).toEqual(
      new Date("2026-03-31T23:59:59.000Z")
    );
  });

  it("supports both startDate and endDate filters", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.privateSession.findMany.mockResolvedValue([
      SAMPLE_PRIVATE_SESSION,
    ]);

    const { GET } = await import("@/app/api/private-sessions/route");
    const response = await GET(
      makeGetRequest(
        "?startDate=2026-03-01T00:00:00.000Z&endDate=2026-03-31T23:59:59.000Z"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    const callArgs = mockPrisma.privateSession.findMany.mock.calls[0][0];
    expect(callArgs.where.scheduledAt.gte).toEqual(
      new Date("2026-03-01T00:00:00.000Z")
    );
    expect(callArgs.where.scheduledAt.lte).toEqual(
      new Date("2026-03-31T23:59:59.000Z")
    );
  });

  it("trainer with date filters also applies createdById", async () => {
    mockAuth.mockResolvedValue(trainerSession("trainer-1"));
    mockPrisma.privateSession.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/private-sessions/route");
    await GET(
      makeGetRequest("?startDate=2026-03-01T00:00:00.000Z")
    );

    const callArgs = mockPrisma.privateSession.findMany.mock.calls[0][0];
    expect(callArgs.where.createdById).toBe("trainer-1");
    expect(callArgs.where.scheduledAt.gte).toEqual(
      new Date("2026-03-01T00:00:00.000Z")
    );
  });

  it("returns 500 on database error", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.privateSession.findMany.mockRejectedValue(
      new Error("DB error")
    );

    const { GET } = await import("@/app/api/private-sessions/route");
    const response = await GET(makeGetRequest());

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Internal server error");
  });
});

// ===== POST /api/private-sessions =====

describe("POST /api/private-sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { POST } = await import("@/app/api/private-sessions/route");
    const response = await POST(makePostRequest(VALID_POST_BODY));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 403 when role is MEMBER", async () => {
    mockAuth.mockResolvedValue(memberSession());

    const { POST } = await import("@/app/api/private-sessions/route");
    const response = await POST(makePostRequest(VALID_POST_BODY));

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("Forbidden");
  });

  it("returns 400 for invalid body (missing clientName)", async () => {
    mockAuth.mockResolvedValue(ownerSession());

    const { POST } = await import("@/app/api/private-sessions/route");
    const response = await POST(
      makePostRequest({
        scheduledAt: VALID_DATETIME,
        paid: false,
      })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 for invalid body (missing scheduledAt)", async () => {
    mockAuth.mockResolvedValue(ownerSession());

    const { POST } = await import("@/app/api/private-sessions/route");
    const response = await POST(
      makePostRequest({
        clientName: "Jane Doe",
        paid: false,
      })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 for invalid body (invalid scheduledAt format)", async () => {
    mockAuth.mockResolvedValue(ownerSession());

    const { POST } = await import("@/app/api/private-sessions/route");
    const response = await POST(
      makePostRequest({
        clientName: "Jane Doe",
        scheduledAt: "not-a-date",
        paid: false,
      })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 for invalid body (empty clientName)", async () => {
    mockAuth.mockResolvedValue(ownerSession());

    const { POST } = await import("@/app/api/private-sessions/route");
    const response = await POST(
      makePostRequest({
        clientName: "",
        scheduledAt: VALID_DATETIME,
        paid: false,
      })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("owner can create a private session", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    const createdSession = {
      id: "ps-new",
      clientName: "Jane Doe",
      scheduledAt: new Date(VALID_DATETIME),
      paid: false,
      amount: 50,
      exerciseDetails: "Upper body workout",
      notes: "First time client",
      createdAt: new Date(),
    };
    mockPrisma.privateSession.create.mockResolvedValue(createdSession);

    const { POST } = await import("@/app/api/private-sessions/route");
    const response = await POST(makePostRequest(VALID_POST_BODY));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.id).toBe("ps-new");
    expect(body.data.clientName).toBe("Jane Doe");
  });

  it("trainer can create a private session", async () => {
    mockAuth.mockResolvedValue(trainerSession("trainer-1"));
    const createdSession = {
      id: "ps-new-2",
      clientName: "Jane Doe",
      scheduledAt: new Date(VALID_DATETIME),
      paid: false,
      amount: 50,
      exerciseDetails: "Upper body workout",
      notes: "First time client",
      createdAt: new Date(),
    };
    mockPrisma.privateSession.create.mockResolvedValue(createdSession);

    const { POST } = await import("@/app/api/private-sessions/route");
    const response = await POST(makePostRequest(VALID_POST_BODY));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.id).toBe("ps-new-2");
  });

  it("sets createdById to the authenticated user's ID", async () => {
    mockAuth.mockResolvedValue(trainerSession("trainer-42"));
    mockPrisma.privateSession.create.mockResolvedValue({
      id: "ps-new-3",
      clientName: "Jane Doe",
      scheduledAt: new Date(VALID_DATETIME),
      paid: false,
      amount: 50,
      exerciseDetails: "Upper body workout",
      notes: "First time client",
      createdAt: new Date(),
    });

    const { POST } = await import("@/app/api/private-sessions/route");
    await POST(makePostRequest(VALID_POST_BODY));

    const createCallArgs = mockPrisma.privateSession.create.mock.calls[0][0];
    expect(createCallArgs.data.createdById).toBe("trainer-42");
  });

  it("creates with minimal required fields (clientName and scheduledAt)", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.privateSession.create.mockResolvedValue({
      id: "ps-minimal",
      clientName: "Minimal Client",
      scheduledAt: new Date(VALID_DATETIME),
      paid: false,
      amount: null,
      exerciseDetails: null,
      notes: null,
      createdAt: new Date(),
    });

    const { POST } = await import("@/app/api/private-sessions/route");
    const response = await POST(
      makePostRequest({
        clientName: "Minimal Client",
        scheduledAt: VALID_DATETIME,
      })
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data.clientName).toBe("Minimal Client");
  });

  it("uses trainerId as createdById when provided by owner", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.user.findFirst.mockResolvedValue({ id: "cm0trainer99000000" });
    mockPrisma.privateSession.create.mockResolvedValue({
      ...SAMPLE_PRIVATE_SESSION,
      createdById: "cm0trainer99000000",
    });

    const body = { ...VALID_POST_BODY, trainerId: "cm0trainer99000000" };
    const { POST } = await import("@/app/api/private-sessions/route");
    await POST(makePostRequest(body));

    const createCallArgs = mockPrisma.privateSession.create.mock.calls[0][0];
    expect(createCallArgs.data.createdById).toBe("cm0trainer99000000");
  });

  it("returns 400 when trainerId does not reference a valid trainer", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.user.findFirst.mockResolvedValue(null);

    const body = { ...VALID_POST_BODY, trainerId: "cm0nonexistent00000" };
    const { POST } = await import("@/app/api/private-sessions/route");
    const res = await POST(makePostRequest(body));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid trainer ID");
    expect(mockPrisma.privateSession.create).not.toHaveBeenCalled();
  });

  it("ignores trainerId when request is from a trainer (not owner)", async () => {
    mockAuth.mockResolvedValue(trainerSession("trainer-42"));
    mockPrisma.privateSession.create.mockResolvedValue(SAMPLE_PRIVATE_SESSION);

    const body = { ...VALID_POST_BODY, trainerId: "cm0trainer99000000" };
    const { POST } = await import("@/app/api/private-sessions/route");
    await POST(makePostRequest(body));

    const createCallArgs = mockPrisma.privateSession.create.mock.calls[0][0];
    expect(createCallArgs.data.createdById).toBe("trainer-42");
  });

  it("falls back to session.user.id when owner omits trainerId", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.privateSession.create.mockResolvedValue(SAMPLE_PRIVATE_SESSION);

    const { POST } = await import("@/app/api/private-sessions/route");
    await POST(makePostRequest(VALID_POST_BODY));

    const createCallArgs = mockPrisma.privateSession.create.mock.calls[0][0];
    expect(createCallArgs.data.createdById).toBe(ownerSession().user.id);
  });

  it("returns 500 on database error", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.privateSession.create.mockRejectedValue(
      new Error("DB error")
    );

    const { POST } = await import("@/app/api/private-sessions/route");
    const response = await POST(makePostRequest(VALID_POST_BODY));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Internal server error");
  });
});

// ===== PATCH /api/private-sessions/[id] =====

describe("PATCH /api/private-sessions/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { PATCH } = await import(
      "@/app/api/private-sessions/[id]/route"
    );
    const response = await PATCH(
      makePatchRequest({ clientName: "Updated" }),
      makeParams("ps-1")
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 403 when role is MEMBER", async () => {
    mockAuth.mockResolvedValue(memberSession());

    const { PATCH } = await import(
      "@/app/api/private-sessions/[id]/route"
    );
    const response = await PATCH(
      makePatchRequest({ clientName: "Updated" }),
      makeParams("ps-1")
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("Forbidden");
  });

  it("returns 404 when private session not found", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.privateSession.findUnique.mockResolvedValue(null);

    const { PATCH } = await import(
      "@/app/api/private-sessions/[id]/route"
    );
    const response = await PATCH(
      makePatchRequest({ clientName: "Updated" }),
      makeParams("nonexistent")
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("Private session not found");
  });

  it("returns 400 for invalid body (invalid amount)", async () => {
    mockAuth.mockResolvedValue(ownerSession());

    const { PATCH } = await import(
      "@/app/api/private-sessions/[id]/route"
    );
    const response = await PATCH(
      makePatchRequest({ amount: -10 }),
      makeParams("ps-1")
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 for invalid body (invalid scheduledAt format)", async () => {
    mockAuth.mockResolvedValue(ownerSession());

    const { PATCH } = await import(
      "@/app/api/private-sessions/[id]/route"
    );
    const response = await PATCH(
      makePatchRequest({ scheduledAt: "bad-date" }),
      makeParams("ps-1")
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("owner can update any private session", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    // Session created by a trainer, but owner can still update
    mockPrisma.privateSession.findUnique.mockResolvedValue({
      id: "ps-1",
      createdById: "trainer-1",
      amount: 50,
    });
    mockPrisma.privateSession.update.mockResolvedValue({
      id: "ps-1",
      clientName: "Updated Client",
      scheduledAt: new Date(VALID_DATETIME),
      paid: true,
      amount: 75,
      exerciseDetails: "Updated",
      notes: "Updated notes",
      createdAt: new Date(),
    });

    const { PATCH } = await import(
      "@/app/api/private-sessions/[id]/route"
    );
    const response = await PATCH(
      makePatchRequest({ clientName: "Updated Client", paid: true, amount: 75 }),
      makeParams("ps-1")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.clientName).toBe("Updated Client");
    expect(body.data.paid).toBe(true);
  });

  it("trainer can update their OWN private session", async () => {
    mockAuth.mockResolvedValue(trainerSession("trainer-1"));
    mockPrisma.privateSession.findUnique.mockResolvedValue({
      id: "ps-1",
      createdById: "trainer-1",
      amount: 50,
    });
    mockPrisma.privateSession.update.mockResolvedValue({
      id: "ps-1",
      clientName: "Updated by Trainer",
      scheduledAt: new Date(VALID_DATETIME),
      paid: false,
      amount: 50,
      exerciseDetails: "Updated",
      notes: "",
      createdAt: new Date(),
    });

    const { PATCH } = await import(
      "@/app/api/private-sessions/[id]/route"
    );
    const response = await PATCH(
      makePatchRequest({ clientName: "Updated by Trainer" }),
      makeParams("ps-1")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.clientName).toBe("Updated by Trainer");
  });

  it("trainer CANNOT update another user's private session (403)", async () => {
    mockAuth.mockResolvedValue(trainerSession("trainer-1"));
    // Session created by a different user
    mockPrisma.privateSession.findUnique.mockResolvedValue({
      id: "ps-1",
      createdById: "trainer-2",
      amount: 50,
    });

    const { PATCH } = await import(
      "@/app/api/private-sessions/[id]/route"
    );
    const response = await PATCH(
      makePatchRequest({ clientName: "Sneaky Update" }),
      makeParams("ps-1")
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("Forbidden");
    // Must not have called update
    expect(mockPrisma.privateSession.update).not.toHaveBeenCalled();
  });

  it("partial update works (only paid field)", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.privateSession.findUnique.mockResolvedValue({
      id: "ps-1",
      createdById: "owner-1",
      amount: 50,
    });
    mockPrisma.privateSession.update.mockResolvedValue({
      id: "ps-1",
      clientName: "Jane Doe",
      scheduledAt: new Date(VALID_DATETIME),
      paid: true,
      amount: 50,
      exerciseDetails: "Upper body workout",
      notes: "First time client",
      createdAt: new Date(),
    });

    const { PATCH } = await import(
      "@/app/api/private-sessions/[id]/route"
    );
    const response = await PATCH(
      makePatchRequest({ paid: true }),
      makeParams("ps-1")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.paid).toBe(true);
    // Verify paid field plus audit fields were in the update data
    const updateCallArgs = mockPrisma.privateSession.update.mock.calls[0][0];
    expect(updateCallArgs.data.paid).toBe(true);
    expect(updateCallArgs.data.paidAt).toBeInstanceOf(Date);
    expect(updateCallArgs.data.paidMarkedById).toBe("owner-1");
  });

  it("partial update works (only clientName)", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.privateSession.findUnique.mockResolvedValue({
      id: "ps-1",
      createdById: "owner-1",
      amount: 50,
    });
    mockPrisma.privateSession.update.mockResolvedValue({
      id: "ps-1",
      clientName: "New Name",
      scheduledAt: new Date(VALID_DATETIME),
      paid: false,
      amount: 50,
      exerciseDetails: "Upper body workout",
      notes: "First time client",
      createdAt: new Date(),
    });

    const { PATCH } = await import(
      "@/app/api/private-sessions/[id]/route"
    );
    const response = await PATCH(
      makePatchRequest({ clientName: "New Name" }),
      makeParams("ps-1")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.clientName).toBe("New Name");
    const updateCallArgs = mockPrisma.privateSession.update.mock.calls[0][0];
    expect(updateCallArgs.data).toEqual({ clientName: "New Name" });
  });

  it("partial update works (only scheduledAt)", async () => {
    const newDate = "2026-04-01T12:00:00.000Z";
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.privateSession.findUnique.mockResolvedValue({
      id: "ps-1",
      createdById: "owner-1",
      amount: 50,
    });
    mockPrisma.privateSession.update.mockResolvedValue({
      id: "ps-1",
      clientName: "Jane Doe",
      scheduledAt: new Date(newDate),
      paid: false,
      amount: 50,
      exerciseDetails: "Upper body workout",
      notes: "First time client",
      createdAt: new Date(),
    });

    const { PATCH } = await import(
      "@/app/api/private-sessions/[id]/route"
    );
    const response = await PATCH(
      makePatchRequest({ scheduledAt: newDate }),
      makeParams("ps-1")
    );

    expect(response.status).toBe(200);
    const updateCallArgs = mockPrisma.privateSession.update.mock.calls[0][0];
    expect(updateCallArgs.data).toEqual({
      scheduledAt: new Date(newDate),
    });
  });

  it("returns 500 on database error during findUnique", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.privateSession.findUnique.mockRejectedValue(
      new Error("DB error")
    );

    const { PATCH } = await import(
      "@/app/api/private-sessions/[id]/route"
    );
    const response = await PATCH(
      makePatchRequest({ clientName: "Updated" }),
      makeParams("ps-1")
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Internal server error");
  });

  it("returns 500 on database error during update", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.privateSession.findUnique.mockResolvedValue({
      id: "ps-1",
      createdById: "owner-1",
      amount: 50,
    });
    mockPrisma.privateSession.update.mockRejectedValue(
      new Error("DB error")
    );

    const { PATCH } = await import(
      "@/app/api/private-sessions/[id]/route"
    );
    const response = await PATCH(
      makePatchRequest({ clientName: "Updated" }),
      makeParams("ps-1")
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Internal server error");
  });

  it("sets paidAt and paidMarkedById when marking as paid", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.privateSession.findUnique.mockResolvedValue({
      id: "ps-1",
      createdById: "owner-1",
      amount: 50,
    });
    mockPrisma.privateSession.update.mockResolvedValue({
      id: "ps-1",
      clientName: "Jane Doe",
      scheduledAt: new Date(VALID_DATETIME),
      paid: true,
      amount: 50,
      exerciseDetails: null,
      notes: null,
      paidAt: new Date(),
      paidMarkedBy: { id: "owner-1", name: "Owner One" },
      createdAt: new Date(),
    });

    const { PATCH } = await import(
      "@/app/api/private-sessions/[id]/route"
    );
    const response = await PATCH(
      makePatchRequest({ paid: true }),
      makeParams("ps-1")
    );

    expect(response.status).toBe(200);
    const updateCallArgs = mockPrisma.privateSession.update.mock.calls[0][0];
    expect(updateCallArgs.data.paid).toBe(true);
    expect(updateCallArgs.data.paidAt).toBeInstanceOf(Date);
    expect(updateCallArgs.data.paidMarkedById).toBe("owner-1");
  });

  it("clears paidAt and paidMarkedById when marking as unpaid", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.privateSession.findUnique.mockResolvedValue({
      id: "ps-1",
      createdById: "owner-1",
      amount: 50,
    });
    mockPrisma.privateSession.update.mockResolvedValue({
      id: "ps-1",
      clientName: "Jane Doe",
      scheduledAt: new Date(VALID_DATETIME),
      paid: false,
      amount: 50,
      exerciseDetails: null,
      notes: null,
      paidAt: null,
      paidMarkedBy: null,
      createdAt: new Date(),
    });

    const { PATCH } = await import(
      "@/app/api/private-sessions/[id]/route"
    );
    const response = await PATCH(
      makePatchRequest({ paid: false }),
      makeParams("ps-1")
    );

    expect(response.status).toBe(200);
    const updateCallArgs = mockPrisma.privateSession.update.mock.calls[0][0];
    expect(updateCallArgs.data.paid).toBe(false);
    expect(updateCallArgs.data.paidAt).toBeNull();
    expect(updateCallArgs.data.paidMarkedById).toBeNull();
  });

  it("returns 400 when marking as paid without amount", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.privateSession.findUnique.mockResolvedValue({
      id: "ps-1",
      createdById: "owner-1",
      amount: null,
    });

    const { PATCH } = await import(
      "@/app/api/private-sessions/[id]/route"
    );
    const response = await PATCH(
      makePatchRequest({ paid: true }),
      makeParams("ps-1")
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Amount is required when marking as paid");
    expect(mockPrisma.privateSession.update).not.toHaveBeenCalled();
  });

  it("allows marking as paid when amount is provided in same request", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.privateSession.findUnique.mockResolvedValue({
      id: "ps-1",
      createdById: "owner-1",
      amount: null,
    });
    mockPrisma.privateSession.update.mockResolvedValue({
      id: "ps-1",
      clientName: "Jane Doe",
      scheduledAt: new Date("2026-03-15T10:00:00.000Z"),
      paid: true,
      amount: 100,
      exerciseDetails: null,
      notes: null,
      paidAt: new Date(),
      paidMarkedBy: { id: "owner-1", name: "Owner One" },
      createdAt: new Date(),
    });

    const { PATCH } = await import(
      "@/app/api/private-sessions/[id]/route"
    );
    const response = await PATCH(
      makePatchRequest({ paid: true, amount: 100 }),
      makeParams("ps-1")
    );

    expect(response.status).toBe(200);
  });

  it("allows marking as paid when session already has amount", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.privateSession.findUnique.mockResolvedValue({
      id: "ps-1",
      createdById: "owner-1",
      amount: 50,
    });
    mockPrisma.privateSession.update.mockResolvedValue({
      id: "ps-1",
      clientName: "Jane Doe",
      scheduledAt: new Date("2026-03-15T10:00:00.000Z"),
      paid: true,
      amount: 50,
      exerciseDetails: null,
      notes: null,
      paidAt: new Date(),
      paidMarkedBy: { id: "owner-1", name: "Owner One" },
      createdAt: new Date(),
    });

    const { PATCH } = await import(
      "@/app/api/private-sessions/[id]/route"
    );
    const response = await PATCH(
      makePatchRequest({ paid: true }),
      makeParams("ps-1")
    );

    expect(response.status).toBe(200);
  });
});

// ===== DELETE /api/private-sessions/[id] =====

describe("DELETE /api/private-sessions/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { DELETE } = await import(
      "@/app/api/private-sessions/[id]/route"
    );
    const response = await DELETE(makeDeleteRequest(), makeParams("ps-1"));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 403 when role is MEMBER", async () => {
    mockAuth.mockResolvedValue(memberSession());

    const { DELETE } = await import(
      "@/app/api/private-sessions/[id]/route"
    );
    const response = await DELETE(makeDeleteRequest(), makeParams("ps-1"));

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("Forbidden");
  });

  it("returns 404 when private session not found", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.privateSession.findUnique.mockResolvedValue(null);

    const { DELETE } = await import(
      "@/app/api/private-sessions/[id]/route"
    );
    const response = await DELETE(
      makeDeleteRequest(),
      makeParams("nonexistent")
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("Private session not found");
  });

  it("owner can delete any private session", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    // Session created by a trainer, but owner can still delete
    mockPrisma.privateSession.findUnique.mockResolvedValue({
      id: "ps-1",
      createdById: "trainer-1",
    });
    mockPrisma.privateSession.delete.mockResolvedValue({ id: "ps-1" });

    const { DELETE } = await import(
      "@/app/api/private-sessions/[id]/route"
    );
    const response = await DELETE(makeDeleteRequest(), makeParams("ps-1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.success).toBe(true);
    expect(mockPrisma.privateSession.delete).toHaveBeenCalledWith({
      where: { id: "ps-1" },
    });
  });

  it("trainer can delete their OWN private session", async () => {
    mockAuth.mockResolvedValue(trainerSession("trainer-1"));
    mockPrisma.privateSession.findUnique.mockResolvedValue({
      id: "ps-1",
      createdById: "trainer-1",
    });
    mockPrisma.privateSession.delete.mockResolvedValue({ id: "ps-1" });

    const { DELETE } = await import(
      "@/app/api/private-sessions/[id]/route"
    );
    const response = await DELETE(makeDeleteRequest(), makeParams("ps-1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.success).toBe(true);
  });

  it("trainer CANNOT delete another user's private session (403)", async () => {
    mockAuth.mockResolvedValue(trainerSession("trainer-1"));
    // Session created by a different trainer
    mockPrisma.privateSession.findUnique.mockResolvedValue({
      id: "ps-1",
      createdById: "trainer-2",
    });

    const { DELETE } = await import(
      "@/app/api/private-sessions/[id]/route"
    );
    const response = await DELETE(makeDeleteRequest(), makeParams("ps-1"));

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("Forbidden");
    // Must not have called delete
    expect(mockPrisma.privateSession.delete).not.toHaveBeenCalled();
  });

  it("successful delete returns { data: { success: true } }", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.privateSession.findUnique.mockResolvedValue({
      id: "ps-1",
      createdById: "owner-1",
    });
    mockPrisma.privateSession.delete.mockResolvedValue({ id: "ps-1" });

    const { DELETE } = await import(
      "@/app/api/private-sessions/[id]/route"
    );
    const response = await DELETE(makeDeleteRequest(), makeParams("ps-1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ data: { success: true } });
  });

  it("trainer CANNOT delete owner's private session (403)", async () => {
    mockAuth.mockResolvedValue(trainerSession("trainer-1"));
    // Session created by the owner
    mockPrisma.privateSession.findUnique.mockResolvedValue({
      id: "ps-1",
      createdById: "owner-1",
    });

    const { DELETE } = await import(
      "@/app/api/private-sessions/[id]/route"
    );
    const response = await DELETE(makeDeleteRequest(), makeParams("ps-1"));

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("Forbidden");
    expect(mockPrisma.privateSession.delete).not.toHaveBeenCalled();
  });

  it("returns 500 on database error during findUnique", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.privateSession.findUnique.mockRejectedValue(
      new Error("DB error")
    );

    const { DELETE } = await import(
      "@/app/api/private-sessions/[id]/route"
    );
    const response = await DELETE(makeDeleteRequest(), makeParams("ps-1"));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Internal server error");
  });

  it("returns 500 on database error during delete", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.privateSession.findUnique.mockResolvedValue({
      id: "ps-1",
      createdById: "owner-1",
    });
    mockPrisma.privateSession.delete.mockRejectedValue(
      new Error("DB error")
    );

    const { DELETE } = await import(
      "@/app/api/private-sessions/[id]/route"
    );
    const response = await DELETE(makeDeleteRequest(), makeParams("ps-1"));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Internal server error");
  });
});
