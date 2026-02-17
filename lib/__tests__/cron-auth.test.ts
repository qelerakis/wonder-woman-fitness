import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("verifyCronSecret", () => {
  const REAL_SECRET = "test-cron-secret-abc123";

  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", REAL_SECRET);
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns true for valid Bearer token", async () => {
    const { verifyCronSecret } = await import("../cron-auth");
    const req = new Request("http://localhost/api/cron/test", {
      headers: { authorization: `Bearer ${REAL_SECRET}` },
    });
    expect(verifyCronSecret(req)).toBe(true);
  });

  it("returns false for missing authorization header", async () => {
    const { verifyCronSecret } = await import("../cron-auth");
    const req = new Request("http://localhost/api/cron/test");
    expect(verifyCronSecret(req)).toBe(false);
  });

  it("returns false for wrong secret", async () => {
    const { verifyCronSecret } = await import("../cron-auth");
    const req = new Request("http://localhost/api/cron/test", {
      headers: { authorization: "Bearer wrong-secret" },
    });
    expect(verifyCronSecret(req)).toBe(false);
  });

  it("returns false for missing Bearer prefix", async () => {
    const { verifyCronSecret } = await import("../cron-auth");
    const req = new Request("http://localhost/api/cron/test", {
      headers: { authorization: REAL_SECRET },
    });
    expect(verifyCronSecret(req)).toBe(false);
  });

  it("returns false when CRON_SECRET env is undefined", async () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.resetModules();
    const { verifyCronSecret } = await import("../cron-auth");
    const req = new Request("http://localhost/api/cron/test", {
      headers: { authorization: "Bearer something" },
    });
    expect(verifyCronSecret(req)).toBe(false);
  });
});
