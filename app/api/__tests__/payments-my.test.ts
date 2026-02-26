/**
 * Payments/My API Integration Tests
 *
 * Tests GET /api/payments/my — returns the authenticated user's own payment records.
 * Any authenticated role (OWNER, TRAINER, MEMBER) can access this endpoint.
 *
 * Categories:
 *   - Authentication
 *   - Authorization (role-based access)
 *   - Rate limiting
 *   - Data filtering & select
 *   - Response format & data serialization
 *   - Error handling
 *   - Edge cases
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
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(retryAfterMs / 1000)),
          "X-RateLimit-Reset": new Date(Date.now() + retryAfterMs).toISOString(),
        },
      }
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

function memberSession(id = "member-1") {
  return { user: { id, email: "member@test.com", role: "MEMBER", status: "ACTIVE" } };
}

function ownerSession() {
  return { user: { id: "owner-1", email: "owner@test.com", role: "OWNER", status: "ACTIVE" } };
}

function trainerSession() {
  return { user: { id: "trainer-1", email: "trainer@test.com", role: "TRAINER", status: "ACTIVE" } };
}

function makePayment(overrides: Record<string, unknown> = {}) {
  return {
    id: "p-1",
    amount: 2000,
    paidAt: new Date("2025-03-15T14:30:00Z"),
    periodStart: new Date("2025-03-01T00:00:00Z"),
    periodEnd: new Date("2025-03-31T00:00:00Z"),
    ...overrides,
  };
}

// ===== GET /api/payments/my =====

describe("GET /api/payments/my", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimitModule.authReadLimiter.check.mockReturnValue({
      allowed: true,
      remaining: 10,
      retryAfterMs: 0,
    });
  });

  // ----- Authentication -----

  describe("Authentication", () => {
    it("returns 401 when session is null", async () => {
      mockAuth.mockResolvedValue(null);

      const { GET } = await import("@/app/api/payments/my/route");
      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body).toEqual({ error: "Unauthorized" });
      expect(mockPrisma.payment.findMany).not.toHaveBeenCalled();
    });

    it("returns 401 when session.user is undefined", async () => {
      mockAuth.mockResolvedValue({ user: undefined });

      const { GET } = await import("@/app/api/payments/my/route");
      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body).toEqual({ error: "Unauthorized" });
      expect(mockPrisma.payment.findMany).not.toHaveBeenCalled();
    });

    it("returns 401 when session.user is null", async () => {
      mockAuth.mockResolvedValue({ user: null });

      const { GET } = await import("@/app/api/payments/my/route");
      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body).toEqual({ error: "Unauthorized" });
      expect(mockPrisma.payment.findMany).not.toHaveBeenCalled();
    });

    it("returns 200 with valid member session", async () => {
      mockAuth.mockResolvedValue(memberSession());
      mockPrisma.payment.findMany.mockResolvedValue([]);

      const { GET } = await import("@/app/api/payments/my/route");
      const response = await GET();

      expect(response.status).toBe(200);
    });

    it("does not call findMany when unauthenticated", async () => {
      mockAuth.mockResolvedValue(null);

      const { GET } = await import("@/app/api/payments/my/route");
      await GET();

      expect(mockPrisma.payment.findMany).not.toHaveBeenCalled();
    });
  });

  // ----- Authorization (all roles can access) -----

  describe("Authorization", () => {
    it("MEMBER role can access own payments", async () => {
      mockAuth.mockResolvedValue(memberSession());
      mockPrisma.payment.findMany.mockResolvedValue([
        makePayment({ id: "p-m1", amount: 2000 }),
      ]);

      const { GET } = await import("@/app/api/payments/my/route");
      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data).toHaveLength(1);
      expect(mockPrisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "member-1" },
        })
      );
    });

    it("OWNER role can access own payments", async () => {
      mockAuth.mockResolvedValue(ownerSession());
      mockPrisma.payment.findMany.mockResolvedValue([
        makePayment({ id: "p-o1", amount: 1000 }),
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

    it("TRAINER role can access own payments", async () => {
      mockAuth.mockResolvedValue(trainerSession());
      mockPrisma.payment.findMany.mockResolvedValue([
        makePayment({ id: "p-t1", amount: 3000 }),
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
  });

  // ----- Rate Limiting -----

  describe("Rate limiting", () => {
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
      expect(body.error).toBeDefined();
    });

    it("includes Retry-After header when rate limited", async () => {
      mockAuth.mockResolvedValue(memberSession());
      mockRateLimitModule.authReadLimiter.check.mockReturnValueOnce({
        allowed: false,
        remaining: 0,
        retryAfterMs: 10000,
      });

      const { GET } = await import("@/app/api/payments/my/route");
      const response = await GET();

      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBe("10");
    });

    it("rate limit key includes user ID (called with read:{userId})", async () => {
      mockAuth.mockResolvedValue(memberSession("user-abc-123"));
      mockPrisma.payment.findMany.mockResolvedValue([]);

      const { GET } = await import("@/app/api/payments/my/route");
      await GET();

      expect(mockRateLimitModule.authReadLimiter.check).toHaveBeenCalledWith("read:user-abc-123");
    });

    it("does not call findMany when rate limited", async () => {
      mockAuth.mockResolvedValue(memberSession());
      mockRateLimitModule.authReadLimiter.check.mockReturnValueOnce({
        allowed: false,
        remaining: 0,
        retryAfterMs: 5000,
      });

      const { GET } = await import("@/app/api/payments/my/route");
      await GET();

      expect(mockPrisma.payment.findMany).not.toHaveBeenCalled();
    });

    it("rate limit check happens after auth check", async () => {
      mockAuth.mockResolvedValue(null);

      const { GET } = await import("@/app/api/payments/my/route");
      await GET();

      // Rate limiter should not be called if not authenticated
      expect(mockRateLimitModule.authReadLimiter.check).not.toHaveBeenCalled();
    });
  });

  // ----- Data Filtering -----

  describe("Data filtering", () => {
    it("filters payments by session.user.id", async () => {
      const userId = "specific-user-42";
      mockAuth.mockResolvedValue(memberSession(userId));
      mockPrisma.payment.findMany.mockResolvedValue([]);

      const { GET } = await import("@/app/api/payments/my/route");
      await GET();

      expect(mockPrisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId },
        })
      );
    });

    it("select includes only id, amount, paidAt, periodStart, periodEnd", async () => {
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

    it("does NOT include notes in select", async () => {
      mockAuth.mockResolvedValue(memberSession());
      mockPrisma.payment.findMany.mockResolvedValue([]);

      const { GET } = await import("@/app/api/payments/my/route");
      await GET();

      const findManyCall = mockPrisma.payment.findMany.mock.calls[0][0];
      expect(findManyCall.select.notes).toBeUndefined();
    });

    it("does NOT include recordedById in select", async () => {
      mockAuth.mockResolvedValue(memberSession());
      mockPrisma.payment.findMany.mockResolvedValue([]);

      const { GET } = await import("@/app/api/payments/my/route");
      await GET();

      const findManyCall = mockPrisma.payment.findMany.mock.calls[0][0];
      expect(findManyCall.select.recordedById).toBeUndefined();
    });

    it("does NOT include userId in select", async () => {
      mockAuth.mockResolvedValue(memberSession());
      mockPrisma.payment.findMany.mockResolvedValue([]);

      const { GET } = await import("@/app/api/payments/my/route");
      await GET();

      const findManyCall = mockPrisma.payment.findMany.mock.calls[0][0];
      expect(findManyCall.select.userId).toBeUndefined();
    });

    it("does NOT include createdAt in select", async () => {
      mockAuth.mockResolvedValue(memberSession());
      mockPrisma.payment.findMany.mockResolvedValue([]);

      const { GET } = await import("@/app/api/payments/my/route");
      await GET();

      const findManyCall = mockPrisma.payment.findMany.mock.calls[0][0];
      expect(findManyCall.select.createdAt).toBeUndefined();
    });

    it("does NOT include user relation in select", async () => {
      mockAuth.mockResolvedValue(memberSession());
      mockPrisma.payment.findMany.mockResolvedValue([]);

      const { GET } = await import("@/app/api/payments/my/route");
      await GET();

      const findManyCall = mockPrisma.payment.findMany.mock.calls[0][0];
      expect(findManyCall.select.user).toBeUndefined();
    });

    it("does NOT include recordedBy relation in select", async () => {
      mockAuth.mockResolvedValue(memberSession());
      mockPrisma.payment.findMany.mockResolvedValue([]);

      const { GET } = await import("@/app/api/payments/my/route");
      await GET();

      const findManyCall = mockPrisma.payment.findMany.mock.calls[0][0];
      expect(findManyCall.select.recordedBy).toBeUndefined();
    });

    it("orders payments by paidAt desc", async () => {
      mockAuth.mockResolvedValue(memberSession());
      mockPrisma.payment.findMany.mockResolvedValue([]);

      const { GET } = await import("@/app/api/payments/my/route");
      await GET();

      expect(mockPrisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { paidAt: "desc" },
        })
      );
    });
  });

  // ----- Response Format -----

  describe("Response format", () => {
    it("returns { data: [...] } shape", async () => {
      mockAuth.mockResolvedValue(memberSession());
      mockPrisma.payment.findMany.mockResolvedValue([makePayment()]);

      const { GET } = await import("@/app/api/payments/my/route");
      const response = await GET();
      const body = await response.json();

      expect(body).toHaveProperty("data");
      expect(Array.isArray(body.data)).toBe(true);
    });

    it("returns empty array for user with no payments", async () => {
      mockAuth.mockResolvedValue(memberSession());
      mockPrisma.payment.findMany.mockResolvedValue([]);

      const { GET } = await import("@/app/api/payments/my/route");
      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data).toEqual([]);
    });

    it("each payment has exactly id, amount, paidAt, periodStart, periodEnd", async () => {
      mockAuth.mockResolvedValue(memberSession());
      mockPrisma.payment.findMany.mockResolvedValue([makePayment()]);

      const { GET } = await import("@/app/api/payments/my/route");
      const response = await GET();
      const body = await response.json();

      const payment = body.data[0];
      const keys = Object.keys(payment).sort();
      expect(keys).toEqual(["amount", "id", "paidAt", "periodEnd", "periodStart"]);
    });

    it("response payment objects do not contain notes", async () => {
      mockAuth.mockResolvedValue(memberSession());
      mockPrisma.payment.findMany.mockResolvedValue([makePayment()]);

      const { GET } = await import("@/app/api/payments/my/route");
      const response = await GET();
      const body = await response.json();

      expect(body.data[0]).not.toHaveProperty("notes");
    });

    it("response payment objects do not contain recordedBy", async () => {
      mockAuth.mockResolvedValue(memberSession());
      mockPrisma.payment.findMany.mockResolvedValue([makePayment()]);

      const { GET } = await import("@/app/api/payments/my/route");
      const response = await GET();
      const body = await response.json();

      expect(body.data[0]).not.toHaveProperty("recordedBy");
    });

    it("response payment objects do not contain userId", async () => {
      mockAuth.mockResolvedValue(memberSession());
      mockPrisma.payment.findMany.mockResolvedValue([makePayment()]);

      const { GET } = await import("@/app/api/payments/my/route");
      const response = await GET();
      const body = await response.json();

      expect(body.data[0]).not.toHaveProperty("userId");
    });
  });

  // ----- Data Serialization -----

  describe("Data serialization", () => {
    it("serializes dates as ISO strings", async () => {
      mockAuth.mockResolvedValue(memberSession());
      const paidAt = new Date("2025-03-15T14:30:00Z");
      const periodStart = new Date("2025-03-01T00:00:00Z");
      const periodEnd = new Date("2025-03-31T00:00:00Z");

      mockPrisma.payment.findMany.mockResolvedValue([
        makePayment({ paidAt, periodStart, periodEnd }),
      ]);

      const { GET } = await import("@/app/api/payments/my/route");
      const response = await GET();
      const body = await response.json();

      expect(body.data[0].paidAt).toBe(paidAt.toISOString());
      expect(body.data[0].periodStart).toBe(periodStart.toISOString());
      expect(body.data[0].periodEnd).toBe(periodEnd.toISOString());
    });

    it("converts Decimal amount to number via Number()", async () => {
      mockAuth.mockResolvedValue(memberSession());
      // Simulate Prisma Decimal object with valueOf
      const decimalAmount = Object.assign(Object.create(null), {
        valueOf: () => 2500,
        toString: () => "2500",
      });
      mockPrisma.payment.findMany.mockResolvedValue([
        makePayment({ amount: decimalAmount }),
      ]);

      const { GET } = await import("@/app/api/payments/my/route");
      const response = await GET();
      const body = await response.json();

      expect(body.data[0].amount).toBe(2500);
      expect(typeof body.data[0].amount).toBe("number");
    });

    it("converts plain number amount correctly", async () => {
      mockAuth.mockResolvedValue(memberSession());
      mockPrisma.payment.findMany.mockResolvedValue([
        makePayment({ amount: 1500 }),
      ]);

      const { GET } = await import("@/app/api/payments/my/route");
      const response = await GET();
      const body = await response.json();

      expect(body.data[0].amount).toBe(1500);
      expect(typeof body.data[0].amount).toBe("number");
    });

    it("multiple payments returned in correct order (most recent first)", async () => {
      mockAuth.mockResolvedValue(memberSession());
      // Prisma returns pre-sorted by orderBy, so mock reflects that
      const payments = [
        makePayment({ id: "p-3", paidAt: new Date("2025-05-01T10:00:00Z") }),
        makePayment({ id: "p-2", paidAt: new Date("2025-04-01T10:00:00Z") }),
        makePayment({ id: "p-1", paidAt: new Date("2025-03-01T10:00:00Z") }),
      ];
      mockPrisma.payment.findMany.mockResolvedValue(payments);

      const { GET } = await import("@/app/api/payments/my/route");
      const response = await GET();
      const body = await response.json();

      expect(body.data).toHaveLength(3);
      expect(body.data[0].id).toBe("p-3");
      expect(body.data[1].id).toBe("p-2");
      expect(body.data[2].id).toBe("p-1");
    });

    it("single payment returned correctly", async () => {
      mockAuth.mockResolvedValue(memberSession());
      const payment = makePayment({
        id: "p-only",
        amount: 3500,
        paidAt: new Date("2025-06-15T09:00:00Z"),
        periodStart: new Date("2025-06-01T00:00:00Z"),
        periodEnd: new Date("2025-06-30T00:00:00Z"),
      });
      mockPrisma.payment.findMany.mockResolvedValue([payment]);

      const { GET } = await import("@/app/api/payments/my/route");
      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0]).toEqual({
        id: "p-only",
        amount: 3500,
        paidAt: "2025-06-15T09:00:00.000Z",
        periodStart: "2025-06-01T00:00:00.000Z",
        periodEnd: "2025-06-30T00:00:00.000Z",
      });
    });

    it("Decimal with fractional value serializes correctly", async () => {
      mockAuth.mockResolvedValue(memberSession());
      const decimalAmount = Object.assign(Object.create(null), {
        valueOf: () => 1999.99,
        toString: () => "1999.99",
      });
      mockPrisma.payment.findMany.mockResolvedValue([
        makePayment({ amount: decimalAmount }),
      ]);

      const { GET } = await import("@/app/api/payments/my/route");
      const response = await GET();
      const body = await response.json();

      expect(body.data[0].amount).toBe(1999.99);
    });
  });

  // ----- Error Handling -----

  describe("Error handling", () => {
    it("returns 500 with generic error message on database error", async () => {
      mockAuth.mockResolvedValue(memberSession());
      mockPrisma.payment.findMany.mockRejectedValue(new Error("DB connection lost"));

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { GET } = await import("@/app/api/payments/my/route");
      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({ error: "Failed to fetch payments" });

      consoleSpy.mockRestore();
    });

    it("returns 500 on database timeout", async () => {
      mockAuth.mockResolvedValue(memberSession());
      mockPrisma.payment.findMany.mockRejectedValue(
        new Error("Query timed out")
      );

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { GET } = await import("@/app/api/payments/my/route");
      const response = await GET();

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body).toEqual({ error: "Failed to fetch payments" });

      consoleSpy.mockRestore();
    });

    it("logs error to console.error on failure", async () => {
      mockAuth.mockResolvedValue(memberSession());
      const dbError = new Error("Connection refused");
      mockPrisma.payment.findMany.mockRejectedValue(dbError);

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { GET } = await import("@/app/api/payments/my/route");
      await GET();

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to fetch member payments:",
        dbError
      );

      consoleSpy.mockRestore();
    });

    it("does not expose internal error details in response", async () => {
      mockAuth.mockResolvedValue(memberSession());
      mockPrisma.payment.findMany.mockRejectedValue(
        new Error("FATAL: password authentication failed for user 'admin'")
      );

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { GET } = await import("@/app/api/payments/my/route");
      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe("Failed to fetch payments");
      expect(JSON.stringify(body)).not.toContain("FATAL");
      expect(JSON.stringify(body)).not.toContain("password");

      consoleSpy.mockRestore();
    });
  });

  // ----- Edge Cases -----

  describe("Edge cases", () => {
    it("returns all payments for user with many (10+) payments", async () => {
      mockAuth.mockResolvedValue(memberSession());
      const manyPayments = Array.from({ length: 12 }, (_, i) =>
        makePayment({
          id: `p-${i + 1}`,
          amount: 2000 + i * 100,
          paidAt: new Date(`2025-${String(i + 1).padStart(2, "0")}-15T10:00:00Z`),
          periodStart: new Date(`2025-${String(i + 1).padStart(2, "0")}-01T00:00:00Z`),
          periodEnd: new Date(`2025-${String(i + 1).padStart(2, "0")}-28T00:00:00Z`),
        })
      );
      mockPrisma.payment.findMany.mockResolvedValue(manyPayments);

      const { GET } = await import("@/app/api/payments/my/route");
      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data).toHaveLength(12);
    });

    it("correctly serializes very large amount (999999)", async () => {
      mockAuth.mockResolvedValue(memberSession());
      mockPrisma.payment.findMany.mockResolvedValue([
        makePayment({ amount: 999999 }),
      ]);

      const { GET } = await import("@/app/api/payments/my/route");
      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data[0].amount).toBe(999999);
    });

    it("correctly serializes zero amount (0)", async () => {
      mockAuth.mockResolvedValue(memberSession());
      mockPrisma.payment.findMany.mockResolvedValue([
        makePayment({ amount: 0 }),
      ]);

      const { GET } = await import("@/app/api/payments/my/route");
      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data[0].amount).toBe(0);
    });

    it("different users get different data (user isolation)", async () => {
      // First call for member-1
      mockAuth.mockResolvedValue(memberSession("member-1"));
      mockPrisma.payment.findMany.mockResolvedValue([]);

      const { GET } = await import("@/app/api/payments/my/route");
      await GET();

      expect(mockPrisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "member-1" },
        })
      );

      vi.clearAllMocks();
      mockRateLimitModule.authReadLimiter.check.mockReturnValue({
        allowed: true,
        remaining: 10,
        retryAfterMs: 0,
      });

      // Second call for member-2
      mockAuth.mockResolvedValue(memberSession("member-2"));
      mockPrisma.payment.findMany.mockResolvedValue([]);

      await GET();

      expect(mockPrisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "member-2" },
        })
      );
    });

    it("Decimal amount with string valueOf serializes via Number()", async () => {
      mockAuth.mockResolvedValue(memberSession());
      // Some Prisma Decimal implementations return string valueOf
      const decimalAmount = Object.assign(Object.create(null), {
        valueOf: () => "4200",
        toString: () => "4200",
      });
      mockPrisma.payment.findMany.mockResolvedValue([
        makePayment({ amount: decimalAmount }),
      ]);

      const { GET } = await import("@/app/api/payments/my/route");
      const response = await GET();
      const body = await response.json();

      expect(body.data[0].amount).toBe(4200);
      expect(typeof body.data[0].amount).toBe("number");
    });
  });
});
