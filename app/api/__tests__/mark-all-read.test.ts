/**
 * Mark All Read API Tests
 *
 * Tests auth enforcement, rate limiting, happy paths, user isolation,
 * query correctness, error handling, and role-based access for
 * POST /api/notifications/mark-all-read.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ===== Mocks =====

const mockRateLimitModule = {
  publicLimiter: { check: () => ({ allowed: true, remaining: 10, retryAfterMs: 0 }) },
  authWriteLimiter: { check: vi.fn().mockReturnValue({ allowed: true, remaining: 10, retryAfterMs: 0 }) },
  authReadLimiter: { check: () => ({ allowed: true, remaining: 10, retryAfterMs: 0 }) },
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
  notification: {
    updateMany: vi.fn(),
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

function memberSession(id = "member-1") {
  return { user: { id, email: "member@test.com", role: "MEMBER", status: "ACTIVE" } };
}

// ===== POST /api/notifications/mark-all-read =====

describe("POST /api/notifications/mark-all-read", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the rate limiter to allow by default
    mockRateLimitModule.authWriteLimiter.check.mockReturnValue({
      allowed: true,
      remaining: 10,
      retryAfterMs: 0,
    });
  });

  // ----- Authentication -----

  describe("Authentication", () => {
    it("returns 401 when not authenticated (null session)", async () => {
      mockAuth.mockResolvedValue(null);

      const { POST } = await import("@/app/api/notifications/mark-all-read/route");
      const response = await POST();

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json).toEqual({ error: "Unauthorized" });
      expect(mockPrisma.notification.updateMany).not.toHaveBeenCalled();
    });

    it("returns 401 when session has no user", async () => {
      mockAuth.mockResolvedValue({ user: null });

      const { POST } = await import("@/app/api/notifications/mark-all-read/route");
      const response = await POST();

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json).toEqual({ error: "Unauthorized" });
      expect(mockPrisma.notification.updateMany).not.toHaveBeenCalled();
    });
  });

  // ----- Rate Limiting -----

  describe("Rate limiting", () => {
    it("returns 429 when rate limited", async () => {
      mockAuth.mockResolvedValue(memberSession());
      mockRateLimitModule.authWriteLimiter.check.mockReturnValue({
        allowed: false,
        remaining: 0,
        retryAfterMs: 30000,
      });

      const { POST } = await import("@/app/api/notifications/mark-all-read/route");
      const response = await POST();

      expect(response.status).toBe(429);
      const json = await response.json();
      expect(json).toEqual({ error: "Rate limited" });
      expect(mockPrisma.notification.updateMany).not.toHaveBeenCalled();
    });
  });

  // ----- Happy Path -----

  describe("Happy path", () => {
    it("successfully marks all unread notifications as read and returns count", async () => {
      mockAuth.mockResolvedValue(memberSession());
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 5 });

      const { POST } = await import("@/app/api/notifications/mark-all-read/route");
      const response = await POST();

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({ data: { count: 5 } });
    });

    it("returns count of 0 when no unread notifications exist", async () => {
      mockAuth.mockResolvedValue(memberSession());
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 0 });

      const { POST } = await import("@/app/api/notifications/mark-all-read/route");
      const response = await POST();

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({ data: { count: 0 } });
    });

    it("returns correct count when multiple unread notifications exist", async () => {
      mockAuth.mockResolvedValue(memberSession());
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 42 });

      const { POST } = await import("@/app/api/notifications/mark-all-read/route");
      const response = await POST();

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({ data: { count: 42 } });
    });
  });

  // ----- User Isolation -----

  describe("User isolation", () => {
    it("updateMany is called with the correct userId filter", async () => {
      const specificUserId = "user-specific-123";
      mockAuth.mockResolvedValue(memberSession(specificUserId));
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 3 });

      const { POST } = await import("@/app/api/notifications/mark-all-read/route");
      await POST();

      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: specificUserId,
          }),
        })
      );
    });
  });

  // ----- Query Correctness -----

  describe("Query correctness", () => {
    it("calls updateMany with exact where clause { userId, read: false } and data { read: true }", async () => {
      mockAuth.mockResolvedValue(memberSession("member-1"));
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 1 });

      const { POST } = await import("@/app/api/notifications/mark-all-read/route");
      await POST();

      expect(mockPrisma.notification.updateMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: {
          userId: "member-1",
          read: false,
        },
        data: { read: true },
      });
    });
  });

  // ----- Error Handling -----

  describe("Error handling", () => {
    it("returns 500 when prisma.notification.updateMany throws an error", async () => {
      mockAuth.mockResolvedValue(memberSession());
      mockPrisma.notification.updateMany.mockRejectedValue(new Error("Database connection failed"));

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { POST } = await import("@/app/api/notifications/mark-all-read/route");
      const response = await POST();

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json).toEqual({ error: "Internal server error" });
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to mark all notifications as read:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  // ----- Different User Roles -----

  describe("Different user roles", () => {
    it("OWNER can use the endpoint", async () => {
      mockAuth.mockResolvedValue(ownerSession());
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 2 });

      const { POST } = await import("@/app/api/notifications/mark-all-read/route");
      const response = await POST();

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({ data: { count: 2 } });
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: "owner-1", read: false },
        data: { read: true },
      });
    });

    it("TRAINER can use the endpoint", async () => {
      mockAuth.mockResolvedValue(trainerSession());
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 7 });

      const { POST } = await import("@/app/api/notifications/mark-all-read/route");
      const response = await POST();

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({ data: { count: 7 } });
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: "trainer-1", read: false },
        data: { read: true },
      });
    });

    it("MEMBER can use the endpoint", async () => {
      mockAuth.mockResolvedValue(memberSession());
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 10 });

      const { POST } = await import("@/app/api/notifications/mark-all-read/route");
      const response = await POST();

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({ data: { count: 10 } });
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: "member-1", read: false },
        data: { read: true },
      });
    });
  });
});
