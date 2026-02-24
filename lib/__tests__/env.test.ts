import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

// Save original env so we can restore after all tests
const originalEnv = { ...process.env };

// Minimum required env vars for a successful access
const requiredEnv = {
  DATABASE_URL: "postgresql://test",
  NEXTAUTH_SECRET: "test-secret-32chars-minimum-value",
  NEXTAUTH_URL: "http://localhost:3000",
  CRON_SECRET: "test-cron-secret-32chars-minimum",
};

describe("lib/env", () => {
  beforeEach(() => {
    vi.resetModules();
    // Restore to a clean state before each test
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // ---------------------------------------------------------------------------
  // 1. Required env vars throw when accessed while missing
  // ---------------------------------------------------------------------------
  describe("required env vars throw when missing", () => {
    it("throws when DATABASE_URL is missing", async () => {
      process.env = { ...originalEnv, ...requiredEnv };
      delete process.env.DATABASE_URL;

      const { env } = await import("@/lib/env");

      expect(() => env.DATABASE_URL).toThrow(
        "Missing required environment variable: DATABASE_URL"
      );
    });

    it("throws when NEXTAUTH_SECRET is missing", async () => {
      process.env = { ...originalEnv, ...requiredEnv };
      delete process.env.NEXTAUTH_SECRET;

      const { env } = await import("@/lib/env");

      expect(() => env.NEXTAUTH_SECRET).toThrow(
        "Missing required environment variable: NEXTAUTH_SECRET"
      );
    });

    it("throws when NEXTAUTH_URL is missing", async () => {
      process.env = { ...originalEnv, ...requiredEnv };
      delete process.env.NEXTAUTH_URL;

      const { env } = await import("@/lib/env");

      expect(() => env.NEXTAUTH_URL).toThrow(
        "Missing required environment variable: NEXTAUTH_URL"
      );
    });

    it("throws when CRON_SECRET is missing", async () => {
      process.env = { ...originalEnv, ...requiredEnv };
      delete process.env.CRON_SECRET;

      const { env } = await import("@/lib/env");

      expect(() => env.CRON_SECRET).toThrow(
        "Missing required environment variable: CRON_SECRET"
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Required env vars are returned when present
  // ---------------------------------------------------------------------------
  describe("required env vars are returned when present", () => {
    it("returns correct values for all 4 required vars", async () => {
      process.env = { ...originalEnv, ...requiredEnv };

      const { env } = await import("@/lib/env");

      expect(env.DATABASE_URL).toBe("postgresql://test");
      expect(env.NEXTAUTH_SECRET).toBe("test-secret-32chars-minimum-value");
      expect(env.NEXTAUTH_URL).toBe("http://localhost:3000");
      expect(env.CRON_SECRET).toBe("test-cron-secret-32chars-minimum");
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Optional env vars default correctly
  // ---------------------------------------------------------------------------
  describe("optional env vars default correctly", () => {
    it("RESEND_API_KEY defaults to null when not set", async () => {
      process.env = { ...originalEnv, ...requiredEnv };
      delete process.env.RESEND_API_KEY;

      const { env } = await import("@/lib/env");

      expect(env.RESEND_API_KEY).toBeNull();
    });

    it('EMAIL_FROM defaults to "noreply@wonderwomanfitness.mk" when not set', async () => {
      process.env = { ...originalEnv, ...requiredEnv };
      delete process.env.EMAIL_FROM;

      const { env } = await import("@/lib/env");

      expect(env.EMAIL_FROM).toBe("noreply@wonderwomanfitness.mk");
    });

    it("CLOUDINARY_* vars default to null when not set", async () => {
      process.env = { ...originalEnv, ...requiredEnv };
      delete process.env.CLOUDINARY_CLOUD_NAME;
      delete process.env.CLOUDINARY_API_KEY;
      delete process.env.CLOUDINARY_API_SECRET;

      const { env } = await import("@/lib/env");

      expect(env.CLOUDINARY_CLOUD_NAME).toBeNull();
      expect(env.CLOUDINARY_API_KEY).toBeNull();
      expect(env.CLOUDINARY_API_SECRET).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Optional env vars use provided values
  // ---------------------------------------------------------------------------
  describe("optional env vars use provided values", () => {
    it("uses provided values for RESEND_API_KEY, EMAIL_FROM, and CLOUDINARY_*", async () => {
      process.env = {
        ...originalEnv,
        ...requiredEnv,
        RESEND_API_KEY: "re_test_abc123",
        EMAIL_FROM: "custom@example.com",
        CLOUDINARY_CLOUD_NAME: "my-cloud",
        CLOUDINARY_API_KEY: "123456789",
        CLOUDINARY_API_SECRET: "secret-abc",
      };

      const { env } = await import("@/lib/env");

      expect(env.RESEND_API_KEY).toBe("re_test_abc123");
      expect(env.EMAIL_FROM).toBe("custom@example.com");
      expect(env.CLOUDINARY_CLOUD_NAME).toBe("my-cloud");
      expect(env.CLOUDINARY_API_KEY).toBe("123456789");
      expect(env.CLOUDINARY_API_SECRET).toBe("secret-abc");
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Error message format
  // ---------------------------------------------------------------------------
  describe("error message format", () => {
    it("includes variable name and helpful instructions", async () => {
      process.env = { ...originalEnv, ...requiredEnv };
      delete process.env.DATABASE_URL;

      const { env } = await import("@/lib/env");

      expect(() => env.DATABASE_URL).toThrow(
        /FATAL: Missing required environment variable: DATABASE_URL\. Check your \.env\.local \(dev\) or Vercel environment variables \(production\)\./
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Empty string treated as missing
  // ---------------------------------------------------------------------------
  describe("empty string treated as missing", () => {
    it('treats "" as a missing required variable and throws', async () => {
      process.env = { ...originalEnv, ...requiredEnv, DATABASE_URL: "" };

      const { env } = await import("@/lib/env");

      expect(() => env.DATABASE_URL).toThrow(
        "Missing required environment variable: DATABASE_URL"
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Lazy getters - import succeeds even without env vars
  // ---------------------------------------------------------------------------
  describe("lazy getter behavior", () => {
    it("imports successfully without any env vars set (no eager throw)", async () => {
      process.env = { ...originalEnv };
      delete process.env.DATABASE_URL;
      delete process.env.NEXTAUTH_SECRET;
      delete process.env.NEXTAUTH_URL;
      delete process.env.CRON_SECRET;

      // Import should NOT throw — getters are lazy
      const { env } = await import("@/lib/env");
      expect(env).toBeDefined();

      // Only accessing required vars should throw
      expect(() => env.DATABASE_URL).toThrow();
    });
  });
});
