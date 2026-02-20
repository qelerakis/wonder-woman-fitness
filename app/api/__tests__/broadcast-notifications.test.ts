/**
 * Broadcast Notifications API Integration Tests
 *
 * Tests auth enforcement, role-based access, validation, audience targeting,
 * and happy paths for POST /api/notifications/broadcast and
 * GET /api/notifications/broadcast/recipients.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ===== Mocks =====

vi.mock("@/lib/rate-limit", () => {
  class MockRateLimiter {
    check() {
      return { allowed: true, remaining: 10, retryAfterMs: 0 };
    }
  }
  return {
    publicLimiter: { check: () => ({ allowed: true, remaining: 10, retryAfterMs: 0 }) },
    authWriteLimiter: { check: () => ({ allowed: true, remaining: 10, retryAfterMs: 0 }) },
    authReadLimiter: { check: () => ({ allowed: true, remaining: 10, retryAfterMs: 0 }) },
    cronLimiter: { check: () => ({ allowed: true, remaining: 10, retryAfterMs: 0 }) },
    RateLimiter: MockRateLimiter,
    getClientIp: () => "127.0.0.1",
    createRateLimitResponse: () => Response.json({ error: "Rate limited" }, { status: 429 }),
  };
});

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

const mockPrisma = {
  user: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  recurringSlot: {
    findUnique: vi.fn(),
  },
  sessionMember: {
    findMany: vi.fn(),
  },
  payment: {
    findMany: vi.fn(),
  },
  $transaction: vi.fn(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma)),
};
vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

const mockDispatchNotificationToMany = vi.fn().mockResolvedValue([]);
vi.mock("@/lib/notifications", () => ({
  dispatchNotificationToMany: vi.fn((...args: unknown[]) => mockDispatchNotificationToMany(...args)),
}));

const mockGetPaymentStatus = vi.fn().mockReturnValue("PAID");
vi.mock("@/lib/payment-logic", () => ({
  getPaymentStatus: vi.fn((...args: unknown[]) => mockGetPaymentStatus(...args)),
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

function makePostRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/notifications/broadcast", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeGetRequest(params: Record<string, string> = {}): Request {
  const url = new URL("http://localhost/api/notifications/broadcast/recipients");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new Request(url.toString());
}

// ===== POST /api/notifications/broadcast =====

describe("POST /api/notifications/broadcast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Auth ---

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { POST } = await import("@/app/api/notifications/broadcast/route");
    const response = await POST(makePostRequest({
      audience: "ALL",
      title: "Test",
      body: "Test message",
    }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 403 for TRAINER role", async () => {
    mockAuth.mockResolvedValue(trainerSession());

    const { POST } = await import("@/app/api/notifications/broadcast/route");
    const response = await POST(makePostRequest({
      audience: "ALL",
      title: "Test",
      body: "Test message",
    }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Forbidden");
  });

  it("returns 403 for MEMBER role", async () => {
    mockAuth.mockResolvedValue(memberSession());

    const { POST } = await import("@/app/api/notifications/broadcast/route");
    const response = await POST(makePostRequest({
      audience: "ALL",
      title: "Test",
      body: "Test message",
    }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Forbidden");
  });

  // --- Validation ---

  it("returns 400 when title is missing", async () => {
    mockAuth.mockResolvedValue(ownerSession());

    const { POST } = await import("@/app/api/notifications/broadcast/route");
    const response = await POST(makePostRequest({
      audience: "ALL",
      body: "Test message",
    }));

    expect(response.status).toBe(400);
  });

  it("returns 400 when body is missing", async () => {
    mockAuth.mockResolvedValue(ownerSession());

    const { POST } = await import("@/app/api/notifications/broadcast/route");
    const response = await POST(makePostRequest({
      audience: "ALL",
      title: "Test",
    }));

    expect(response.status).toBe(400);
  });

  it("returns 400 for invalid audience", async () => {
    mockAuth.mockResolvedValue(ownerSession());

    const { POST } = await import("@/app/api/notifications/broadcast/route");
    const response = await POST(makePostRequest({
      audience: "INVALID",
      title: "Test",
      body: "Test message",
    }));

    expect(response.status).toBe(400);
  });

  it("returns 400 when title exceeds 100 chars", async () => {
    mockAuth.mockResolvedValue(ownerSession());

    const { POST } = await import("@/app/api/notifications/broadcast/route");
    const response = await POST(makePostRequest({
      audience: "ALL",
      title: "A".repeat(101),
      body: "Test message",
    }));

    expect(response.status).toBe(400);
  });

  it("returns 400 when body exceeds 500 chars", async () => {
    mockAuth.mockResolvedValue(ownerSession());

    const { POST } = await import("@/app/api/notifications/broadcast/route");
    const response = await POST(makePostRequest({
      audience: "ALL",
      title: "Test",
      body: "A".repeat(501),
    }));

    expect(response.status).toBe(400);
  });

  // --- Conditional Validation ---

  it("returns 400 for SESSION_SLOT without slotId", async () => {
    mockAuth.mockResolvedValue(ownerSession());

    const { POST } = await import("@/app/api/notifications/broadcast/route");
    const response = await POST(makePostRequest({
      audience: "SESSION_SLOT",
      title: "Test",
      body: "Test message",
    }));

    expect(response.status).toBe(400);
  });

  it("returns 400 for PAYMENT_STATUS without paymentStatus", async () => {
    mockAuth.mockResolvedValue(ownerSession());

    const { POST } = await import("@/app/api/notifications/broadcast/route");
    const response = await POST(makePostRequest({
      audience: "PAYMENT_STATUS",
      title: "Test",
      body: "Test message",
    }));

    expect(response.status).toBe(400);
  });

  it("returns 400 for INDIVIDUAL without memberIds", async () => {
    mockAuth.mockResolvedValue(ownerSession());

    const { POST } = await import("@/app/api/notifications/broadcast/route");
    const response = await POST(makePostRequest({
      audience: "INDIVIDUAL",
      title: "Test",
      body: "Test message",
    }));

    expect(response.status).toBe(400);
  });

  it("returns 400 for INDIVIDUAL with empty memberIds array", async () => {
    mockAuth.mockResolvedValue(ownerSession());

    const { POST } = await import("@/app/api/notifications/broadcast/route");
    const response = await POST(makePostRequest({
      audience: "INDIVIDUAL",
      memberIds: [],
      title: "Test",
      body: "Test message",
    }));

    expect(response.status).toBe(400);
  });

  it("returns 400 when unknown fields are present", async () => {
    mockAuth.mockResolvedValue(ownerSession());

    const { POST } = await import("@/app/api/notifications/broadcast/route");
    const response = await POST(makePostRequest({
      audience: "ALL",
      title: "Test",
      body: "Test message",
      unknownField: "should be rejected",
    }));

    expect(response.status).toBe(400);
  });

  // --- ALL audience ---

  it("sends to all active and trial members for ALL audience", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "m-1" },
      { id: "m-2" },
      { id: "m-3" },
    ]);
    mockDispatchNotificationToMany.mockResolvedValue([
      { id: "n-1" }, { id: "n-2" }, { id: "n-3" },
    ]);

    const { POST } = await import("@/app/api/notifications/broadcast/route");
    const response = await POST(makePostRequest({
      audience: "ALL",
      title: "Gym Update",
      body: "New schedule next week",
    }));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.data.sentCount).toBe(3);
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
      where: { role: "MEMBER", status: { in: ["ACTIVE", "TRIAL"] } },
      select: { id: true },
    });
    expect(mockDispatchNotificationToMany).toHaveBeenCalledWith(
      ["m-1", "m-2", "m-3"],
      "MANUAL_REMINDER",
      "Gym Update",
      "New schedule next week"
    );
  });

  // --- TRIAL audience ---

  it("sends to trial members only for TRIAL audience", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "m-trial-1" },
    ]);
    mockDispatchNotificationToMany.mockResolvedValue([{ id: "n-1" }]);

    const { POST } = await import("@/app/api/notifications/broadcast/route");
    const response = await POST(makePostRequest({
      audience: "TRIAL",
      title: "Welcome!",
      body: "Welcome to the gym!",
    }));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.data.sentCount).toBe(1);
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
      where: { role: "MEMBER", status: "TRIAL" },
      select: { id: true },
    });
  });

  // --- SESSION_SLOT audience ---

  it("sends to slot members for SESSION_SLOT audience", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.recurringSlot.findUnique.mockResolvedValue({ id: "slot-1" });
    mockPrisma.sessionMember.findMany.mockResolvedValue([
      { userId: "m-1" },
      { userId: "m-2" },
    ]);
    mockDispatchNotificationToMany.mockResolvedValue([{ id: "n-1" }, { id: "n-2" }]);

    const { POST } = await import("@/app/api/notifications/broadcast/route");
    const response = await POST(makePostRequest({
      audience: "SESSION_SLOT",
      slotId: "cm1234567890abcdef1234567",
      title: "Class Update",
      body: "Your class has been moved",
    }));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.data.sentCount).toBe(2);
    expect(mockPrisma.recurringSlot.findUnique).toHaveBeenCalledWith({
      where: { id: "cm1234567890abcdef1234567" },
    });
  });

  it("returns 404 for invalid slotId in SESSION_SLOT audience", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.recurringSlot.findUnique.mockResolvedValue(null);

    const { POST } = await import("@/app/api/notifications/broadcast/route");
    const response = await POST(makePostRequest({
      audience: "SESSION_SLOT",
      slotId: "cm1234567890abcdef1234567",
      title: "Class Update",
      body: "Your class has been moved",
    }));
    const result = await response.json();

    expect(response.status).toBe(404);
    expect(result.error).toBe("Session slot not found");
  });

  // --- PAYMENT_STATUS audience ---

  it("filters by GRACE_PERIOD for PAYMENT_STATUS audience", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: "m-1", status: "ACTIVE", trialEndsAt: null, departedAt: null, overrideActive: false,
        payments: [{ periodStart: new Date(), periodEnd: new Date(), paidAt: new Date() }],
      },
      {
        id: "m-2", status: "ACTIVE", trialEndsAt: null, departedAt: null, overrideActive: false,
        payments: [],
      },
    ]);
    mockGetPaymentStatus
      .mockReturnValueOnce("PAID")
      .mockReturnValueOnce("GRACE_PERIOD");
    mockDispatchNotificationToMany.mockResolvedValue([{ id: "n-1" }]);

    const { POST } = await import("@/app/api/notifications/broadcast/route");
    const response = await POST(makePostRequest({
      audience: "PAYMENT_STATUS",
      paymentStatus: "GRACE_PERIOD",
      title: "Payment Reminder",
      body: "Please pay soon",
    }));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.data.sentCount).toBe(1);
    expect(mockDispatchNotificationToMany).toHaveBeenCalledWith(
      ["m-2"],
      "MANUAL_REMINDER",
      "Payment Reminder",
      "Please pay soon"
    );
  });

  it("filters by LOCKED for PAYMENT_STATUS audience", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: "m-1", status: "ACTIVE", trialEndsAt: null, departedAt: null, overrideActive: false,
        payments: [],
      },
      {
        id: "m-2", status: "ACTIVE", trialEndsAt: null, departedAt: null, overrideActive: false,
        payments: [],
      },
    ]);
    mockGetPaymentStatus
      .mockReturnValueOnce("LOCKED")
      .mockReturnValueOnce("LOCKED");
    mockDispatchNotificationToMany.mockResolvedValue([{ id: "n-1" }, { id: "n-2" }]);

    const { POST } = await import("@/app/api/notifications/broadcast/route");
    const response = await POST(makePostRequest({
      audience: "PAYMENT_STATUS",
      paymentStatus: "LOCKED",
      title: "Account Locked",
      body: "Your account is locked due to non-payment",
    }));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.data.sentCount).toBe(2);
    expect(mockDispatchNotificationToMany).toHaveBeenCalledWith(
      ["m-1", "m-2"],
      "MANUAL_REMINDER",
      "Account Locked",
      "Your account is locked due to non-payment"
    );
  });

  // --- INDIVIDUAL audience ---

  it("sends to selected members for INDIVIDUAL audience", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "m-1" },
      { id: "m-3" },
    ]);
    mockDispatchNotificationToMany.mockResolvedValue([{ id: "n-1" }, { id: "n-2" }]);

    const { POST } = await import("@/app/api/notifications/broadcast/route");
    const response = await POST(makePostRequest({
      audience: "INDIVIDUAL",
      memberIds: ["cm1234567890abcdef1234567", "cm1234567890abcdef1234568", "cm1234567890abcdef1234569"],
      title: "Personal Note",
      body: "Important info just for you",
    }));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.data.sentCount).toBe(2);
    // Verifies Prisma filters out non-existent and departed members
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["cm1234567890abcdef1234567", "cm1234567890abcdef1234568", "cm1234567890abcdef1234569"] },
        role: "MEMBER",
        status: { in: ["ACTIVE", "TRIAL"] },
      },
      select: { id: true },
    });
  });

  it("filters out non-existent and departed members for INDIVIDUAL", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    // Only one of three requested members exists and is active
    mockPrisma.user.findMany.mockResolvedValue([{ id: "m-1" }]);
    mockDispatchNotificationToMany.mockResolvedValue([{ id: "n-1" }]);

    const { POST } = await import("@/app/api/notifications/broadcast/route");
    const response = await POST(makePostRequest({
      audience: "INDIVIDUAL",
      memberIds: ["cm1234567890abcdef1234567", "cm1234567890abcdef1234568", "cm1234567890abcdef1234569"],
      title: "Note",
      body: "Hi there",
    }));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.data.sentCount).toBe(1);
  });

  // --- Edge cases ---

  it("returns 200 with sentCount 0 when no recipients", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockDispatchNotificationToMany.mockResolvedValue([]);

    const { POST } = await import("@/app/api/notifications/broadcast/route");
    const response = await POST(makePostRequest({
      audience: "ALL",
      title: "Empty Gym",
      body: "No one is here",
    }));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.data.sentCount).toBe(0);
  });
});

// ===== GET /api/notifications/broadcast/recipients =====

describe("GET /api/notifications/broadcast/recipients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { GET } = await import("@/app/api/notifications/broadcast/recipients/route");
    const response = await GET(makeGetRequest({ audience: "ALL" }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 403 for non-owner", async () => {
    mockAuth.mockResolvedValue(trainerSession());

    const { GET } = await import("@/app/api/notifications/broadcast/recipients/route");
    const response = await GET(makeGetRequest({ audience: "ALL" }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Forbidden");
  });

  it("returns count and members for ALL audience", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "m-1", name: "Alice" },
      { id: "m-2", name: "Bob" },
    ]);

    const { GET } = await import("@/app/api/notifications/broadcast/recipients/route");
    const response = await GET(makeGetRequest({ audience: "ALL" }));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.data.count).toBe(2);
    expect(result.data.members).toEqual([
      { id: "m-1", name: "Alice" },
      { id: "m-2", name: "Bob" },
    ]);
  });

  it("returns 400 for missing audience param", async () => {
    mockAuth.mockResolvedValue(ownerSession());

    const { GET } = await import("@/app/api/notifications/broadcast/recipients/route");
    const response = await GET(makeGetRequest({}));

    expect(response.status).toBe(400);
  });

  it("returns trial members for TRIAL audience", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "t1", name: "Trial Member" },
    ]);

    const { GET } = await import("@/app/api/notifications/broadcast/recipients/route");
    const res = await GET(new Request("http://localhost/api/notifications/broadcast/recipients?audience=TRIAL"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.count).toBe(1);
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { role: "MEMBER", status: "TRIAL" },
    }));
  });

  it("returns members for SESSION_SLOT audience", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.recurringSlot.findUnique.mockResolvedValue({ id: "cm1234567890abcdef1234567" });
    mockPrisma.sessionMember.findMany.mockResolvedValue([
      { user: { id: "m1", name: "Alice" } },
      { user: { id: "m2", name: "Bob" } },
    ]);

    const { GET } = await import("@/app/api/notifications/broadcast/recipients/route");
    const res = await GET(new Request("http://localhost/api/notifications/broadcast/recipients?audience=SESSION_SLOT&slotId=cm1234567890abcdef1234567"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.count).toBe(2);
    expect(data.data.members).toEqual([
      { id: "m1", name: "Alice" },
      { id: "m2", name: "Bob" },
    ]);
  });

  it("returns 400 when SESSION_SLOT without slotId", async () => {
    mockAuth.mockResolvedValue(ownerSession());

    const { GET } = await import("@/app/api/notifications/broadcast/recipients/route");
    const res = await GET(new Request("http://localhost/api/notifications/broadcast/recipients?audience=SESSION_SLOT"));
    expect(res.status).toBe(400);
  });

  it("returns members filtered by PAYMENT_STATUS", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    const users = [
      { id: "m1", name: "Alice", status: "ACTIVE", trialEndsAt: null, departedAt: null, overrideActive: false, payments: [] },
      { id: "m2", name: "Bob", status: "ACTIVE", trialEndsAt: null, departedAt: null, overrideActive: false, payments: [] },
    ];
    mockPrisma.user.findMany.mockResolvedValue(users);
    mockGetPaymentStatus
      .mockReturnValueOnce("GRACE_PERIOD")
      .mockReturnValueOnce("PAID");

    const { GET } = await import("@/app/api/notifications/broadcast/recipients/route");
    const res = await GET(new Request("http://localhost/api/notifications/broadcast/recipients?audience=PAYMENT_STATUS&paymentStatus=GRACE_PERIOD"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.count).toBe(1);
    expect(data.data.members).toEqual([{ id: "m1", name: "Alice" }]);
  });

  it("returns 400 when PAYMENT_STATUS without paymentStatus param", async () => {
    mockAuth.mockResolvedValue(ownerSession());

    const { GET } = await import("@/app/api/notifications/broadcast/recipients/route");
    const res = await GET(new Request("http://localhost/api/notifications/broadcast/recipients?audience=PAYMENT_STATUS"));
    expect(res.status).toBe(400);
  });

  it("returns all active members for INDIVIDUAL audience", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "m1", name: "Alice" },
      { id: "m2", name: "Bob" },
      { id: "m3", name: "Carol" },
    ]);

    const { GET } = await import("@/app/api/notifications/broadcast/recipients/route");
    const res = await GET(new Request("http://localhost/api/notifications/broadcast/recipients?audience=INDIVIDUAL"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.count).toBe(3);
  });
});
