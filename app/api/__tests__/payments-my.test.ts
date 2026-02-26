/**
 * Payments/My API Integration Tests
 *
 * Tests GET /api/payments/my — returns the authenticated user's own payment records.
 * Any authenticated role (OWNER, TRAINER, MEMBER) can access this endpoint.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ===== Mocks =====

const mockRateLimitModule = {
  publicLimiter: { check: () => ({ allowed: true, remaining: 10, retryAfterMs: 0 }) },
  authWriteLimiter: { check: () => ({ allowed: true, remaining: 10, retryAfterMs: 0 }) },
  authReadLimiter: { check: vi.fn().mockReturnValue({ allowed: true, remaining: 10, retryAfterMs: 0 }) },
  cronLimiter: { check: () => ({ allowed: true, remaining: 10, retryAfterMs: 0 }) },
  getClientIp: () => "127.0.0.1",
  createRateLimitResponse: (retryAfterMs: number) =>
    Response.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
    ),
};

vi.mock("@/lib/rate-limit", () => mockRateLimitModule);

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

const mockPrisma = {
  payment: {
    findMany: vi.fn(),
  },
};
vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

// ===== Helpers =====

function memberSession() {
  return { user: { id: "member-1", email: "member@test.com", role: "MEMBER", status: "ACTIVE" } };
}

function ownerSession() {
  return { user: { id: "owner-1", email: "owner@test.com", role: "OWNER", status: "ACTIVE" } };
}

function trainerSession() {
  return { user: { id: "trainer-1", email: "trainer@test.com", role: "TRAINER", status: "ACTIVE" } };
}

// ===== GET /api/payments/my =====

describe("GET /api/payments/my", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { GET } = await import("@/app/api/payments/my/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns member's own payments ordered by paidAt desc", async () => {
    mockAuth.mockResolvedValue(memberSession());
    const mockPayments = [
      {
        id: "p-2",
        amount: 2500,
        paidAt: new Date("2025-04-01T10:00:00Z"),
        periodStart: new Date("2025-04-01"),
        periodEnd: new Date("2025-04-30"),
      },
      {
        id: "p-1",
        amount: 2000,
        paidAt: new Date("2025-03-01T10:00:00Z"),
        periodStart: new Date("2025-03-01"),
        periodEnd: new Date("2025-03-31"),
      },
    ];
    mockPrisma.payment.findMany.mockResolvedValue(mockPayments);

    const { GET } = await import("@/app/api/payments/my/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].id).toBe("p-2");
    expect(body.data[1].id).toBe("p-1");

    // Verify findMany was called with the correct user filter and ordering
    expect(mockPrisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "member-1" },
        orderBy: { paidAt: "desc" },
      })
    );
  });

  it("converts Decimal amounts to numbers", async () => {
    mockAuth.mockResolvedValue(memberSession());
    // Prisma Decimal has valueOf() which Number() uses for conversion
    const decimalAmount = Object.assign(Object.create(null), {
      valueOf: () => 2000,
      toString: () => "2000",
    });
    mockPrisma.payment.findMany.mockResolvedValue([
      {
        id: "p-1",
        amount: decimalAmount,
        paidAt: new Date("2025-03-01T10:00:00Z"),
        periodStart: new Date("2025-03-01"),
        periodEnd: new Date("2025-03-31"),
      },
    ]);

    const { GET } = await import("@/app/api/payments/my/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data[0].amount).toBe(2000);
    expect(typeof body.data[0].amount).toBe("number");
  });

  it("serializes dates as ISO strings", async () => {
    mockAuth.mockResolvedValue(memberSession());
    const paidAt = new Date("2025-03-15T14:30:00Z");
    const periodStart = new Date("2025-03-01T00:00:00Z");
    const periodEnd = new Date("2025-03-31T00:00:00Z");

    mockPrisma.payment.findMany.mockResolvedValue([
      {
        id: "p-1",
        amount: 2000,
        paidAt,
        periodStart,
        periodEnd,
      },
    ]);

    const { GET } = await import("@/app/api/payments/my/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data[0].paidAt).toBe(paidAt.toISOString());
    expect(body.data[0].periodStart).toBe(periodStart.toISOString());
    expect(body.data[0].periodEnd).toBe(periodEnd.toISOString());
  });

  it("does not include recordedBy or notes in response", async () => {
    mockAuth.mockResolvedValue(memberSession());
    mockPrisma.payment.findMany.mockResolvedValue([
      {
        id: "p-1",
        amount: 2000,
        paidAt: new Date("2025-03-01T10:00:00Z"),
        periodStart: new Date("2025-03-01"),
        periodEnd: new Date("2025-03-31"),
      },
    ]);

    const { GET } = await import("@/app/api/payments/my/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    // Verify the select does not include sensitive fields
    const findManyCall = mockPrisma.payment.findMany.mock.calls[0][0];
    expect(findManyCall.select.notes).toBeUndefined();
    expect(findManyCall.select.recordedBy).toBeUndefined();
    expect(findManyCall.select.recordedById).toBeUndefined();
    expect(findManyCall.select.user).toBeUndefined();
    expect(findManyCall.select.userId).toBeUndefined();
    expect(findManyCall.select.createdAt).toBeUndefined();

    // Also verify the response object doesn't contain these fields
    expect(body.data[0]).not.toHaveProperty("notes");
    expect(body.data[0]).not.toHaveProperty("recordedBy");
    expect(body.data[0]).not.toHaveProperty("userId");
  });

  it("returns empty array when member has no payments", async () => {
    mockAuth.mockResolvedValue(memberSession());
    mockPrisma.payment.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/payments/my/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([]);
  });

  it("returns 500 when database error occurs", async () => {
    mockAuth.mockResolvedValue(memberSession());
    mockPrisma.payment.findMany.mockRejectedValue(new Error("DB connection lost"));

    const { GET } = await import("@/app/api/payments/my/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Failed to fetch payments");
  });

  it("works for OWNER role (returns owner's own payments)", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.payment.findMany.mockResolvedValue([
      {
        id: "p-1",
        amount: 1000,
        paidAt: new Date("2025-03-01T10:00:00Z"),
        periodStart: new Date("2025-03-01"),
        periodEnd: new Date("2025-03-31"),
      },
    ]);

    const { GET } = await import("@/app/api/payments/my/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(mockPrisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "owner-1" },
      })
    );
  });

  it("works for TRAINER role (returns trainer's own payments)", async () => {
    mockAuth.mockResolvedValue(trainerSession());
    mockPrisma.payment.findMany.mockResolvedValue([
      {
        id: "p-1",
        amount: 3000,
        paidAt: new Date("2025-03-01T10:00:00Z"),
        periodStart: new Date("2025-03-01"),
        periodEnd: new Date("2025-03-31"),
      },
    ]);

    const { GET } = await import("@/app/api/payments/my/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(mockPrisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "trainer-1" },
      })
    );
  });

  it("returns 429 when rate limited", async () => {
    mockAuth.mockResolvedValue(memberSession());
    mockRateLimitModule.authReadLimiter.check.mockReturnValueOnce({
      allowed: false,
      remaining: 0,
      retryAfterMs: 5000,
    });

    const { GET } = await import("@/app/api/payments/my/route");
    const response = await GET();

    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body).toEqual({ error: "Rate limited" });
  });

  it("only selects id, amount, paidAt, periodStart, periodEnd fields", async () => {
    mockAuth.mockResolvedValue(memberSession());
    mockPrisma.payment.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/payments/my/route");
    await GET();

    const findManyCall = mockPrisma.payment.findMany.mock.calls[0][0];
    expect(findManyCall.select).toEqual({
      id: true,
      amount: true,
      paidAt: true,
      periodStart: true,
      periodEnd: true,
    });
  });
});
