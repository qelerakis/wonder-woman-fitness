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
});
