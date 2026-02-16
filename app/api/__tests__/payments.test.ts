/**
 * Payments API Integration Tests
 *
 * Tests auth enforcement, role-based access, validation,
 * and happy paths for GET/POST /api/payments.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ===== Mocks =====

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

const mockTransaction = vi.fn();
const mockPrisma = {
  payment: {
    findMany: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  $transaction: mockTransaction,
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

// ===== GET /api/payments =====

describe("GET /api/payments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { GET } = await import("@/app/api/payments/route");
    const response = await GET(new Request("http://localhost/api/payments"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 403 for MEMBER role", async () => {
    mockAuth.mockResolvedValue(memberSession());

    const { GET } = await import("@/app/api/payments/route");
    const response = await GET(new Request("http://localhost/api/payments"));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Forbidden");
  });

  it("returns payments list for OWNER", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.payment.findMany.mockResolvedValue([
      {
        id: "p-1",
        userId: "m-1",
        amount: 2000,
        paidAt: new Date("2025-03-01"),
        periodStart: new Date("2025-03-01"),
        periodEnd: new Date("2025-03-31"),
        notes: null,
        createdAt: new Date(),
        user: { id: "m-1", name: "Alice", email: "alice@test.com" },
        recordedBy: { id: "owner-1", name: "Owner" },
      },
    ]);

    const { GET } = await import("@/app/api/payments/route");
    const response = await GET(new Request("http://localhost/api/payments"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].amount).toBe(2000);
  });

  it("allows TRAINER to view payments (read-only)", async () => {
    mockAuth.mockResolvedValue(trainerSession());
    mockPrisma.payment.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/payments/route");
    const response = await GET(new Request("http://localhost/api/payments"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([]);
  });

  it("filters by userId query parameter", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.payment.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/payments/route");
    await GET(new Request("http://localhost/api/payments?userId=m-1"));

    expect(mockPrisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "m-1" }),
      })
    );
  });

  it("filters by date range", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.payment.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/payments/route");
    await GET(
      new Request(
        "http://localhost/api/payments?startDate=2025-01-01&endDate=2025-03-31"
      )
    );

    expect(mockPrisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          paidAt: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
      })
    );
  });
});

// ===== POST /api/payments =====

describe("POST /api/payments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { POST } = await import("@/app/api/payments/route");
    const response = await POST(
      new Request("http://localhost/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );

    expect(response.status).toBe(401);
  });

  it("returns 403 for non-OWNER roles", async () => {
    mockAuth.mockResolvedValue(trainerSession());

    const { POST } = await import("@/app/api/payments/route");
    const response = await POST(
      new Request("http://localhost/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "cm1234567890abcdef",
          amount: 2000,
          paidAt: "2025-03-01T00:00:00.000Z",
          periodStart: "2025-03-01",
          periodEnd: "2025-03-31",
        }),
      })
    );

    expect(response.status).toBe(403);
  });

  it("returns 400 for invalid body (missing required fields)", async () => {
    mockAuth.mockResolvedValue(ownerSession());

    const { POST } = await import("@/app/api/payments/route");
    const response = await POST(
      new Request("http://localhost/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: -100 }),
      })
    );

    expect(response.status).toBe(400);
  });

  it("returns 400 for negative amount", async () => {
    mockAuth.mockResolvedValue(ownerSession());

    const { POST } = await import("@/app/api/payments/route");
    const response = await POST(
      new Request("http://localhost/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "cm1234567890abcdef",
          amount: -500,
          paidAt: "2025-03-01T00:00:00.000Z",
          periodStart: "2025-03-01",
          periodEnd: "2025-03-31",
        }),
      })
    );

    expect(response.status).toBe(400);
  });

  it("returns 404 when member not found", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const { POST } = await import("@/app/api/payments/route");
    const response = await POST(
      new Request("http://localhost/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "cm1234567890abcdef",
          amount: 2000,
          paidAt: "2025-03-01T00:00:00.000Z",
          periodStart: "2025-03-01",
          periodEnd: "2025-03-31",
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Member not found");
  });

  it("returns 400 when user is not a MEMBER", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "cm1234567890abcdef",
      role: "TRAINER",
    });

    const { POST } = await import("@/app/api/payments/route");
    const response = await POST(
      new Request("http://localhost/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "cm1234567890abcdef",
          amount: 2000,
          paidAt: "2025-03-01T00:00:00.000Z",
          periodStart: "2025-03-01",
          periodEnd: "2025-03-31",
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("members");
  });

  it("creates payment successfully via transaction", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "cm1234567890abcdef",
      role: "MEMBER",
    });
    const createdPayment = {
      id: "p-1",
      userId: "cm1234567890abcdef",
      amount: 2000,
      paidAt: new Date("2025-03-01"),
      periodStart: new Date("2025-03-01"),
      periodEnd: new Date("2025-03-31"),
      notes: null,
      createdAt: new Date(),
      user: { id: "cm1234567890abcdef", name: "Alice" },
    };
    // Mock $transaction to execute the callback with a mock tx
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const mockTx = {
        payment: {
          create: vi.fn().mockResolvedValue(createdPayment),
        },
      };
      return cb(mockTx);
    });

    const { POST } = await import("@/app/api/payments/route");
    const response = await POST(
      new Request("http://localhost/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "cm1234567890abcdef",
          amount: 2000,
          paidAt: "2025-03-01T00:00:00.000Z",
          periodStart: "2025-03-01",
          periodEnd: "2025-03-31",
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.amount).toBe(2000);
    expect(mockTransaction).toHaveBeenCalledOnce();
  });
});

// ===== DELETE /api/payments/[id] =====

function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

describe("DELETE /api/payments/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { DELETE } = await import("@/app/api/payments/[id]/route");
    const response = await DELETE(
      new Request("http://localhost/api/payments/p-1", { method: "DELETE" }),
      makeParams("p-1")
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 403 for non-OWNER roles", async () => {
    mockAuth.mockResolvedValue(trainerSession());

    const { DELETE } = await import("@/app/api/payments/[id]/route");
    const response = await DELETE(
      new Request("http://localhost/api/payments/p-1", { method: "DELETE" }),
      makeParams("p-1")
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Forbidden");
  });

  it("returns 404 when payment not found", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.payment.findUnique.mockResolvedValue(null);

    const { DELETE } = await import("@/app/api/payments/[id]/route");
    const response = await DELETE(
      new Request("http://localhost/api/payments/p-1", { method: "DELETE" }),
      makeParams("p-1")
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Payment not found");
  });

  it("returns 200 with deleted payment id on success", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.payment.findUnique.mockResolvedValue({ id: "p-1" });
    mockPrisma.payment.delete.mockResolvedValue({ id: "p-1" });

    const { DELETE } = await import("@/app/api/payments/[id]/route");
    const response = await DELETE(
      new Request("http://localhost/api/payments/p-1", { method: "DELETE" }),
      makeParams("p-1")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ id: "p-1" });
    expect(mockPrisma.payment.delete).toHaveBeenCalledWith({
      where: { id: "p-1" },
    });
  });

  it("returns 500 on unexpected error", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.payment.findUnique.mockRejectedValue(new Error("DB down"));

    const { DELETE } = await import("@/app/api/payments/[id]/route");
    const response = await DELETE(
      new Request("http://localhost/api/payments/p-1", { method: "DELETE" }),
      makeParams("p-1")
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Internal server error");
  });
});
