/**
 * In-memory sliding-window rate limiter.
 *
 * Zero dependencies. Tracks requests per key (IP or user ID) within a
 * configurable time window. Designed for single-server / serverless
 * deployment where per-instance burst protection is sufficient.
 *
 * OWASP: Mitigates brute-force attacks (A07:2021 - Identification and
 * Authentication Failures) and API abuse.
 *
 * Usage:
 *   const limiter = new RateLimiter({ maxRequests: 10, windowMs: 60_000 });
 *   const result = limiter.check(clientIp);
 *   if (!result.allowed) return createRateLimitResponse(result.retryAfterMs);
 */

interface RateLimitEntry {
  /** Timestamps (ms) of requests within the current window */
  timestamps: number[];
}

interface RateLimitConfig {
  /** Maximum requests allowed per window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Requests remaining in the current window */
  remaining: number;
  /** Milliseconds until the client can retry (0 if allowed) */
  retryAfterMs: number;
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check whether a request identified by `key` is allowed.
   * Slides the window forward and prunes old timestamps.
   */
  check(key: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    let entry = this.store.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      this.store.set(key, entry);
    }

    // Prune timestamps outside the current window
    entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

    if (entry.timestamps.length >= this.config.maxRequests) {
      // Calculate when the oldest request in the window expires
      const oldestInWindow = entry.timestamps[0];
      const retryAfterMs = oldestInWindow + this.config.windowMs - now;
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(retryAfterMs, 0),
      };
    }

    entry.timestamps.push(now);
    return {
      allowed: true,
      remaining: this.config.maxRequests - entry.timestamps.length,
      retryAfterMs: 0,
    };
  }

  /**
   * Remove all expired entries from the store.
   * Call periodically to prevent memory growth.
   */
  cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    for (const [key, entry] of this.store) {
      entry.timestamps = entry.timestamps.filter((t) => t > windowStart);
      if (entry.timestamps.length === 0) {
        this.store.delete(key);
      }
    }
  }
}

/**
 * Create a standardized 429 Too Many Requests response.
 * Includes Retry-After header (seconds) per RFC 6585.
 */
export function createRateLimitResponse(retryAfterMs: number): Response {
  const retryAfterSec = Math.ceil(retryAfterMs / 1000);
  return Response.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSec),
        "X-RateLimit-Reset": new Date(Date.now() + retryAfterMs).toISOString(),
      },
    }
  );
}

/**
 * Extract the client IP from request headers.
 * Works behind reverse proxies (Vercel, Nginx) that set x-forwarded-for.
 */
export function getClientIp(req: Request): string {
  // x-forwarded-for may contain multiple IPs: "client, proxy1, proxy2"
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "unknown";
}

// ===== Pre-configured limiters for different endpoint categories =====

/** Public endpoints: stricter limits (registration, login) */
export const publicLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 15 * 60 * 1000, // 10 requests per 15 minutes per IP
});

/** Authenticated write endpoints (POST/PATCH/DELETE) */
export const authWriteLimiter = new RateLimiter({
  maxRequests: 30,
  windowMs: 60 * 1000, // 30 requests per minute per user
});

/** Authenticated read endpoints (GET) — more generous */
export const authReadLimiter = new RateLimiter({
  maxRequests: 60,
  windowMs: 60 * 1000, // 60 requests per minute per user
});

/** Cron endpoints: very strict (should only be called by Vercel Cron) */
export const cronLimiter = new RateLimiter({
  maxRequests: 5,
  windowMs: 60 * 1000, // 5 requests per minute per IP
});
