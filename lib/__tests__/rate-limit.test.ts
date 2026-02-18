/**
 * Rate Limiter Tests
 *
 * Tests the in-memory sliding-window rate limiter used across all API routes.
 * Covers: basic limiting, window expiry, IP-based keys, user-based keys,
 * 429 response format, and memory cleanup.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RateLimiter, createRateLimitResponse, getClientIp } from "@/lib/rate-limit";

describe("RateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests under the limit", () => {
    const limiter = new RateLimiter({ maxRequests: 5, windowMs: 60_000 });
    for (let i = 0; i < 5; i++) {
      expect(limiter.check("test-key").allowed).toBe(true);
    }
  });

  it("blocks requests over the limit", () => {
    const limiter = new RateLimiter({ maxRequests: 3, windowMs: 60_000 });
    limiter.check("key");
    limiter.check("key");
    limiter.check("key");
    const result = limiter.check("key");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("resets after the window expires", () => {
    const limiter = new RateLimiter({ maxRequests: 2, windowMs: 60_000 });
    limiter.check("key");
    limiter.check("key");
    expect(limiter.check("key").allowed).toBe(false);

    vi.advanceTimersByTime(60_001);
    expect(limiter.check("key").allowed).toBe(true);
  });

  it("tracks different keys independently", () => {
    const limiter = new RateLimiter({ maxRequests: 1, windowMs: 60_000 });
    expect(limiter.check("user-1").allowed).toBe(true);
    expect(limiter.check("user-2").allowed).toBe(true);
    expect(limiter.check("user-1").allowed).toBe(false);
    expect(limiter.check("user-2").allowed).toBe(false);
  });

  it("returns remaining count", () => {
    const limiter = new RateLimiter({ maxRequests: 5, windowMs: 60_000 });
    const r1 = limiter.check("key");
    expect(r1.remaining).toBe(4);
    limiter.check("key");
    limiter.check("key");
    const r4 = limiter.check("key");
    expect(r4.remaining).toBe(1);
  });

  it("cleans up expired entries", () => {
    const limiter = new RateLimiter({ maxRequests: 5, windowMs: 1_000 });
    limiter.check("old-key");
    vi.advanceTimersByTime(2_000);
    limiter.cleanup();
    const result = limiter.check("old-key");
    expect(result.remaining).toBe(4);
  });
});

describe("createRateLimitResponse", () => {
  it("returns a 429 Response with correct headers and body", async () => {
    const response = createRateLimitResponse(30_000);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("30");
    expect(response.headers.get("X-RateLimit-Reset")).toBeDefined();
    const body = await response.json();
    expect(body.error).toContain("Too many requests");
  });
});

describe("getClientIp", () => {
  it("extracts IP from x-forwarded-for header", () => {
    const req = new Request("http://localhost/api/test", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("extracts IP from x-real-ip header", () => {
    const req = new Request("http://localhost/api/test", {
      headers: { "x-real-ip": "9.8.7.6" },
    });
    expect(getClientIp(req)).toBe("9.8.7.6");
  });

  it("falls back to 'unknown' when no IP headers present", () => {
    const req = new Request("http://localhost/api/test");
    expect(getClientIp(req)).toBe("unknown");
  });

  it("handles x-forwarded-for with spaces around commas", () => {
    const req = new Request("http://localhost/api/test", {
      headers: { "x-forwarded-for": "  10.0.0.1 , 10.0.0.2 , 10.0.0.3 " },
    });
    expect(getClientIp(req)).toBe("10.0.0.1");
  });

  it("handles empty x-forwarded-for header gracefully", () => {
    const req = new Request("http://localhost/api/test", {
      headers: { "x-forwarded-for": "" },
    });
    // Empty string is falsy, so falls through to x-real-ip then "unknown"
    expect(getClientIp(req)).toBe("unknown");
  });

  it("prefers x-forwarded-for over x-real-ip when both present", () => {
    const req = new Request("http://localhost/api/test", {
      headers: {
        "x-forwarded-for": "1.1.1.1, 2.2.2.2",
        "x-real-ip": "3.3.3.3",
      },
    });
    expect(getClientIp(req)).toBe("1.1.1.1");
  });
});

describe("RateLimiter — advanced sliding window behavior", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sliding window: allows request after oldest entry expires (not entire window)", () => {
    const limiter = new RateLimiter({ maxRequests: 2, windowMs: 10_000 });

    // First request at t=0
    expect(limiter.check("key").allowed).toBe(true);

    // Second request at t=3000
    vi.advanceTimersByTime(3_000);
    expect(limiter.check("key").allowed).toBe(true);

    // Third request at t=3000 — blocked (2 requests in last 10s)
    expect(limiter.check("key").allowed).toBe(false);

    // Advance past the first request's expiry (t=10001) but not the second (which expires at t=13000)
    vi.advanceTimersByTime(7_001);
    // Now at t=10001: first request (t=0) is outside window, second (t=3000) is still in
    const result = limiter.check("key");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0); // 2 in window now (t=3000 and t=10001)
  });

  it("handles very high maxRequests (1000)", () => {
    const limiter = new RateLimiter({ maxRequests: 1000, windowMs: 60_000 });
    for (let i = 0; i < 1000; i++) {
      expect(limiter.check("key").allowed).toBe(true);
    }
    expect(limiter.check("key").allowed).toBe(false);
  });

  it("handles very small windowMs (1ms)", () => {
    const limiter = new RateLimiter({ maxRequests: 1, windowMs: 1 });
    expect(limiter.check("key").allowed).toBe(true);
    expect(limiter.check("key").allowed).toBe(false);
    vi.advanceTimersByTime(2);
    expect(limiter.check("key").allowed).toBe(true);
  });

  it("returns retryAfterMs=0 when allowed", () => {
    const limiter = new RateLimiter({ maxRequests: 5, windowMs: 60_000 });
    const result = limiter.check("key");
    expect(result.allowed).toBe(true);
    expect(result.retryAfterMs).toBe(0);
  });

  it("concurrent keys don't interfere with each other's counts", () => {
    const limiter = new RateLimiter({ maxRequests: 2, windowMs: 60_000 });

    // Fill up key-a
    limiter.check("key-a");
    limiter.check("key-a");
    expect(limiter.check("key-a").allowed).toBe(false);

    // key-b should still be fully available
    const resultB1 = limiter.check("key-b");
    expect(resultB1.allowed).toBe(true);
    expect(resultB1.remaining).toBe(1);

    const resultB2 = limiter.check("key-b");
    expect(resultB2.allowed).toBe(true);
    expect(resultB2.remaining).toBe(0);

    // key-c untouched
    const resultC = limiter.check("key-c");
    expect(resultC.allowed).toBe(true);
    expect(resultC.remaining).toBe(1);
  });

  it("check() with empty key works", () => {
    const limiter = new RateLimiter({ maxRequests: 1, windowMs: 60_000 });
    const result = limiter.check("");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
    expect(limiter.check("").allowed).toBe(false);
  });

  it("cleanup() on empty store doesn't throw", () => {
    const limiter = new RateLimiter({ maxRequests: 5, windowMs: 60_000 });
    expect(() => limiter.cleanup()).not.toThrow();
  });

  it("cleanup() only removes fully expired keys, keeps partially valid ones", () => {
    const limiter = new RateLimiter({ maxRequests: 5, windowMs: 10_000 });

    // Add a request for key-old at t=0
    limiter.check("key-old");

    // Advance 5 seconds — key-old has a request at t=0 (still in window)
    vi.advanceTimersByTime(5_000);

    // Add a request for key-fresh at t=5000
    limiter.check("key-fresh");

    // Advance another 6 seconds — now at t=11000
    // key-old's timestamp (t=0) is outside window (11000-10000=1000 > 0)
    // key-fresh's timestamp (t=5000) is inside window (11000-10000=1000 < 5000)
    vi.advanceTimersByTime(6_000);

    limiter.cleanup();

    // key-old should be removed (all timestamps expired), so a new check gets full quota
    const resultOld = limiter.check("key-old");
    expect(resultOld.allowed).toBe(true);
    expect(resultOld.remaining).toBe(4); // 5 max - 1 new = 4

    // key-fresh should retain its timestamp, so remaining is 5-1(existing)-1(new)=3
    const resultFresh = limiter.check("key-fresh");
    expect(resultFresh.allowed).toBe(true);
    expect(resultFresh.remaining).toBe(3);
  });
});

describe("createRateLimitResponse — edge cases", () => {
  it("Retry-After rounds up (e.g., 1500ms → 2 seconds)", async () => {
    const response = createRateLimitResponse(1_500);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("2");
  });

  it("retryAfterMs of 0 produces Retry-After: 0", async () => {
    const response = createRateLimitResponse(0);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("0");
  });

  it("Response body is valid JSON with error field", async () => {
    const response = createRateLimitResponse(5_000);
    const body = await response.json();
    expect(body).toHaveProperty("error");
    expect(typeof body.error).toBe("string");
    expect(body.error).toContain("Too many requests");
  });
});
