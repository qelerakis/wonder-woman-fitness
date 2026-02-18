/**
 * Rate Limit Integration Tests
 *
 * Tests that rate limiting is properly wired into API routes.
 * Tests the registration endpoint as the representative public route.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth (not needed for registration but imported by other modules)
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

// Mock Prisma
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// Mock bcrypt
vi.mock("bcrypt", () => ({
  default: { hash: vi.fn().mockResolvedValue("hashed-pw") },
}));

// Control the rate limiter
const mockPublicCheck = vi.fn();
const mockCreateRateLimitResponse = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  publicLimiter: { check: mockPublicCheck },
  authWriteLimiter: { check: vi.fn().mockReturnValue({ allowed: true, remaining: 10, retryAfterMs: 0 }) },
  authReadLimiter: { check: vi.fn().mockReturnValue({ allowed: true, remaining: 10, retryAfterMs: 0 }) },
  cronLimiter: { check: vi.fn().mockReturnValue({ allowed: true, remaining: 10, retryAfterMs: 0 }) },
  getClientIp: vi.fn().mockReturnValue("1.2.3.4"),
  createRateLimitResponse: (...args: unknown[]) => mockCreateRateLimitResponse(...args),
}));

describe("POST /api/auth/register — rate limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 429 when rate limited", async () => {
    mockPublicCheck.mockReturnValue({ allowed: false, remaining: 0, retryAfterMs: 30_000 });
    mockCreateRateLimitResponse.mockReturnValue(
      Response.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": "30" } }
      )
    );

    const { POST } = await import("@/app/api/auth/register/route");
    const response = await POST(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "1.2.3.4" },
        body: JSON.stringify({
          email: "test@test.com",
          password: "Test1234!",
          name: "Test User",
        }),
      })
    );

    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.error).toContain("Too many requests");
  });

  it("allows request when under rate limit", async () => {
    mockPublicCheck.mockReturnValue({ allowed: true, remaining: 9, retryAfterMs: 0 });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: "new-user",
      email: "test@test.com",
      name: "Test User",
      role: "MEMBER",
      status: "TRIAL",
    });

    const { POST } = await import("@/app/api/auth/register/route");
    const response = await POST(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "1.2.3.4" },
        body: JSON.stringify({
          email: "test@test.com",
          password: "Test1234!",
          name: "Test User",
        }),
      })
    );

    expect(response.status).toBe(201);
  });
});
