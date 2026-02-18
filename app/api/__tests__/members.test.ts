/**
 * Members API Integration Tests
 *
 * Tests auth enforcement, role-based access, validation, and
 * happy paths for GET /api/members and GET/PATCH /api/members/[id].
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

// Mock auth — returns null by default, overridden per-test
const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

// Mock Prisma client
const mockPrisma = {
  user: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
};
vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

// Mock payment-logic
vi.mock("@/lib/payment-logic", () => ({
  getPaymentStatus: vi.fn(() => "PAID"),
}));

// ===== Helpers =====

function ownerSession() {
  return { user: { id: "owner-1", email: "owner@test.com", role: "OWNER", status: "ACTIVE" } };
}

function trainerSession() {
  return { user: { id: "trainer-1", email: "trainer@test.com", role: "TRAINER", status: "ACTIVE" } };
}

function memberSession(id = "member-1") {
  return { user: { id, email: "member@test.com", role: "MEMBER", status: "ACTIVE" } };
}

// ===== GET /api/members =====

describe("GET /api/members", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { GET } = await import("@/app/api/members/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 403 for MEMBER role", async () => {
    mockAuth.mockResolvedValue(memberSession());

    const { GET } = await import("@/app/api/members/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Forbidden");
  });

  it("returns member list for OWNER with full info", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: "m-1",
        name: "Alice",
        email: "alice@test.com",
        phone: "123",
        status: "ACTIVE",
        joinDate: new Date(),
        trialEndsAt: null,
        departedAt: null,
        departReason: null,
        monthlyRate: 2000,
        overrideActive: false,
        photo: null,
        payments: [],
      },
    ]);

    const { GET } = await import("@/app/api/members/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe("Alice");
    expect(body.data[0].paymentStatus).toBeDefined();
    // Owner gets full info including monthlyRate
    expect(body.data[0].monthlyRate).toBe(2000);
  });

  it("returns limited info for TRAINER role", async () => {
    mockAuth.mockResolvedValue(trainerSession());
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: "m-1",
        name: "Alice",
        email: "alice@test.com",
        phone: "123",
        status: "ACTIVE",
        joinDate: new Date(),
        trialEndsAt: null,
        departedAt: null,
        departReason: null,
        monthlyRate: 2000,
        overrideActive: false,
        photo: null,
        payments: [],
      },
    ]);

    const { GET } = await import("@/app/api/members/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe("Alice");
    // Trainer should NOT see monthlyRate
    expect(body.data[0].monthlyRate).toBeUndefined();
  });
});

// ===== GET /api/members/[id] =====

describe("GET /api/members/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { GET } = await import("@/app/api/members/[id]/route");
    const response = await GET(
      new Request("http://localhost/api/members/m-1"),
      { params: Promise.resolve({ id: "m-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 403 when member tries to view another member", async () => {
    mockAuth.mockResolvedValue(memberSession("member-1"));

    const { GET } = await import("@/app/api/members/[id]/route");
    const response = await GET(
      new Request("http://localhost/api/members/member-2"),
      { params: Promise.resolve({ id: "member-2" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Forbidden");
  });

  it("returns 404 when member not found", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const { GET } = await import("@/app/api/members/[id]/route");
    const response = await GET(
      new Request("http://localhost/api/members/nonexistent"),
      { params: Promise.resolve({ id: "nonexistent" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Member not found");
  });

  it("allows member to view their own profile", async () => {
    mockAuth.mockResolvedValue(memberSession("m-1"));
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "m-1",
      name: "Alice",
      email: "alice@test.com",
      phone: "123",
      status: "ACTIVE",
      role: "MEMBER",
      joinDate: new Date(),
      trialEndsAt: null,
      departedAt: null,
      departReason: null,
      monthlyRate: 2000,
      overrideActive: false,
      photo: null,
      payments: [],
    });

    const { GET } = await import("@/app/api/members/[id]/route");
    const response = await GET(
      new Request("http://localhost/api/members/m-1"),
      { params: Promise.resolve({ id: "m-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.name).toBe("Alice");
    // Member doesn't get payments array
    expect(body.data.payments).toBeUndefined();
  });

  it("returns full data with payments for OWNER", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "m-1",
      name: "Alice",
      email: "alice@test.com",
      phone: "123",
      status: "ACTIVE",
      role: "MEMBER",
      joinDate: new Date(),
      trialEndsAt: null,
      departedAt: null,
      departReason: null,
      monthlyRate: 2000,
      overrideActive: false,
      photo: null,
      payments: [{ id: "p-1", amount: 2000, paidAt: new Date() }],
    });

    const { GET } = await import("@/app/api/members/[id]/route");
    const response = await GET(
      new Request("http://localhost/api/members/m-1"),
      { params: Promise.resolve({ id: "m-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.payments).toHaveLength(1);
  });
});

// ===== PATCH /api/members/[id] =====

describe("PATCH /api/members/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { PATCH } = await import("@/app/api/members/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/members/m-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Name" }),
      }),
      { params: Promise.resolve({ id: "m-1" }) }
    );

    expect(response.status).toBe(401);
  });

  it("returns 403 when TRAINER tries to update a member", async () => {
    mockAuth.mockResolvedValue(trainerSession());

    const { PATCH } = await import("@/app/api/members/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/members/m-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Name" }),
      }),
      { params: Promise.resolve({ id: "m-1" }) }
    );

    expect(response.status).toBe(403);
  });

  it("returns 403 when member tries to update another member", async () => {
    mockAuth.mockResolvedValue(memberSession("member-1"));

    const { PATCH } = await import("@/app/api/members/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/members/member-2", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Name" }),
      }),
      { params: Promise.resolve({ id: "member-2" }) }
    );

    expect(response.status).toBe(403);
  });

  it("returns 400 for invalid update data", async () => {
    mockAuth.mockResolvedValue(memberSession("m-1"));

    const { PATCH } = await import("@/app/api/members/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/members/m-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "not-valid-email" }),
      }),
      { params: Promise.resolve({ id: "m-1" }) }
    );

    expect(response.status).toBe(400);
  });

  it("allows member to update their own name", async () => {
    mockAuth.mockResolvedValue(memberSession("m-1"));
    mockPrisma.user.findUnique.mockResolvedValue({ id: "m-1" });
    mockPrisma.user.update.mockResolvedValue({
      id: "m-1",
      name: "New Name",
      email: "alice@test.com",
      phone: "123",
      status: "ACTIVE",
      monthlyRate: 2000,
      overrideActive: false,
      photo: null,
    });

    const { PATCH } = await import("@/app/api/members/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/members/m-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Name" }),
      }),
      { params: Promise.resolve({ id: "m-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.name).toBe("New Name");
  });

  it("allows owner to update member status", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.user.findUnique.mockResolvedValue({ id: "m-1" });
    mockPrisma.user.update.mockResolvedValue({
      id: "m-1",
      name: "Alice",
      email: "alice@test.com",
      phone: "123",
      status: "DEPARTED",
      monthlyRate: 2000,
      overrideActive: false,
      photo: null,
    });

    const { PATCH } = await import("@/app/api/members/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/members/m-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DEPARTED" }),
      }),
      { params: Promise.resolve({ id: "m-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.status).toBe("DEPARTED");
  });

  it("returns 409 when email is already taken", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.user.findUnique.mockResolvedValue({ id: "m-1" });
    mockPrisma.user.findFirst.mockResolvedValue({ id: "m-2" }); // email taken

    const { PATCH } = await import("@/app/api/members/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/members/m-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "taken@test.com" }),
      }),
      { params: Promise.resolve({ id: "m-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("Email already in use");
  });
});
