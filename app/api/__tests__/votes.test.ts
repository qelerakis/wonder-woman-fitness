/**
 * Votes API Integration Tests
 *
 * Tests auth enforcement, validation, voting deadline checks,
 * session membership checks, and happy paths for POST/GET /api/votes.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ===== Mocks =====

vi.mock("@/lib/rate-limit", () => ({
  publicLimiter: { check: () => ({ allowed: true, remaining: 10, retryAfterMs: 0 }) },
  authWriteLimiter: { check: () => ({ allowed: true, remaining: 10, retryAfterMs: 0 }) },
  authReadLimiter: { check: () => ({ allowed: true, remaining: 10, retryAfterMs: 0 }) },
  cronLimiter: { check: () => ({ allowed: true, remaining: 10, retryAfterMs: 0 }) },
  getClientIp: () => "127.0.0.1",
  createRateLimitResponse: () => Response.json({ error: "Rate limited" }, { status: 429 }),
}));

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

const mockPrisma = {
  session: {
    findUnique: vi.fn(),
  },
  vote: {
    upsert: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    findFirst: vi.fn(),
  },
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
    // Execute the transaction callback with mockPrisma as the tx client
    return fn(mockPrisma);
  }),
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

// ===== POST /api/votes =====

describe("POST /api/votes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { POST } = await import("@/app/api/votes/route");
    const response = await POST(
      new Request("http://localhost/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "cm1234567890abcdef",
          attending: true,
        }),
      })
    );

    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid body (missing sessionId)", async () => {
    mockAuth.mockResolvedValue(memberSession());

    const { POST } = await import("@/app/api/votes/route");
    const response = await POST(
      new Request("http://localhost/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attending: true }),
      })
    );

    expect(response.status).toBe(400);
  });

  it("returns 400 for invalid body (non-boolean attending)", async () => {
    mockAuth.mockResolvedValue(memberSession());

    const { POST } = await import("@/app/api/votes/route");
    const response = await POST(
      new Request("http://localhost/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "cm1234567890abcdef",
          attending: "yes",
        }),
      })
    );

    expect(response.status).toBe(400);
  });

  it("returns 404 when session not found", async () => {
    mockAuth.mockResolvedValue(memberSession());
    mockPrisma.session.findUnique.mockResolvedValue(null);

    const { POST } = await import("@/app/api/votes/route");
    const response = await POST(
      new Request("http://localhost/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "cm1234567890abcdef",
          attending: true,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Session not found");
  });

  it("returns 400 when session is cancelled", async () => {
    mockAuth.mockResolvedValue(memberSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "cm1234567890abcdef",
      status: "CANCELLED",
      votingEnabled: true,
      votingDeadline: new Date("2099-01-01"),
    });

    const { POST } = await import("@/app/api/votes/route");
    const response = await POST(
      new Request("http://localhost/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "cm1234567890abcdef",
          attending: true,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("cancelled");
  });

  it("returns 400 when voting is not enabled", async () => {
    mockAuth.mockResolvedValue(memberSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "cm1234567890abcdef",
      status: "SCHEDULED",
      votingEnabled: false,
      votingDeadline: null,
    });

    const { POST } = await import("@/app/api/votes/route");
    const response = await POST(
      new Request("http://localhost/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "cm1234567890abcdef",
          attending: true,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("not enabled");
  });

  it("returns 400 when voting deadline has passed", async () => {
    mockAuth.mockResolvedValue(memberSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "cm1234567890abcdef",
      status: "SCHEDULED",
      votingEnabled: true,
      votingDeadline: new Date("2020-01-01"), // past deadline
    });

    const { POST } = await import("@/app/api/votes/route");
    const response = await POST(
      new Request("http://localhost/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "cm1234567890abcdef",
          attending: true,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("deadline");
  });

  it("allows any member to vote even if not assigned to session", async () => {
    mockAuth.mockResolvedValue(memberSession("member-1"));
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "cm1234567890abcdef",
      status: "SCHEDULED",
      votingEnabled: true,
      votingDeadline: new Date("2099-01-01"),
      weekDate: new Date("2026-03-09"),
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
    });
    mockPrisma.vote.count.mockResolvedValue(0);
    mockPrisma.vote.findFirst.mockResolvedValue(null);
    mockPrisma.vote.upsert.mockResolvedValue({
      id: "v-unassigned",
      sessionId: "cm1234567890abcdef",
      userId: "member-1",
      attending: true,
      votedAt: new Date(),
    });

    const { POST } = await import("@/app/api/votes/route");
    const response = await POST(
      new Request("http://localhost/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "cm1234567890abcdef",
          attending: true,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.attending).toBe(true);
  });

  it("requires MEMBER role to vote (rejects OWNER)", async () => {
    mockAuth.mockResolvedValue(ownerSession());

    const { POST } = await import("@/app/api/votes/route");
    const response = await POST(
      new Request("http://localhost/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "cm1234567890abcdef",
          attending: true,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("members");
    // Role check should short-circuit before hitting database
    expect(mockPrisma.session.findUnique).not.toHaveBeenCalled();
  });

  it("requires MEMBER role to vote (rejects TRAINER)", async () => {
    mockAuth.mockResolvedValue(trainerSession());

    const { POST } = await import("@/app/api/votes/route");
    const response = await POST(
      new Request("http://localhost/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "cm1234567890abcdef",
          attending: true,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("members");
    // Role check should short-circuit before hitting database
    expect(mockPrisma.session.findUnique).not.toHaveBeenCalled();
  });

  it("rejects DEPARTED members from voting", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "member-departed", email: "departed@test.com", role: "MEMBER", status: "DEPARTED" },
    });

    const { POST } = await import("@/app/api/votes/route");
    const response = await POST(
      new Request("http://localhost/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "cm1234567890abcdef",
          attending: true,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("active");
    expect(mockPrisma.session.findUnique).not.toHaveBeenCalled();
  });

  it("rejects LOCKED members from voting", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "member-locked", email: "locked@test.com", role: "MEMBER", status: "LOCKED" },
    });

    const { POST } = await import("@/app/api/votes/route");
    const response = await POST(
      new Request("http://localhost/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "cm1234567890abcdef",
          attending: true,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("active");
    expect(mockPrisma.session.findUnique).not.toHaveBeenCalled();
  });

  it("creates vote successfully (attending: true)", async () => {
    mockAuth.mockResolvedValue(memberSession("member-1"));
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "cm1234567890abcdef",
      status: "SCHEDULED",
      votingEnabled: true,
      votingDeadline: new Date("2099-01-01"),
      weekDate: new Date("2026-03-09"),
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
    });
    mockPrisma.vote.count.mockResolvedValue(0);
    mockPrisma.vote.findFirst.mockResolvedValue(null);
    mockPrisma.vote.upsert.mockResolvedValue({
      id: "v-1",
      sessionId: "cm1234567890abcdef",
      userId: "member-1",
      attending: true,
      votedAt: new Date(),
    });

    const { POST } = await import("@/app/api/votes/route");
    const response = await POST(
      new Request("http://localhost/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "cm1234567890abcdef",
          attending: true,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.attending).toBe(true);
    expect(mockPrisma.vote.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          sessionId_userId: {
            sessionId: "cm1234567890abcdef",
            userId: "member-1",
          },
        },
        update: expect.objectContaining({ attending: true }),
        create: expect.objectContaining({
          sessionId: "cm1234567890abcdef",
          userId: "member-1",
          attending: true,
        }),
      })
    );
  });

  it("creates vote successfully (attending: false)", async () => {
    mockAuth.mockResolvedValue(memberSession("member-1"));
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "cm1234567890abcdef",
      status: "SCHEDULED",
      votingEnabled: true,
      votingDeadline: new Date("2099-01-01"),
      weekDate: new Date("2026-03-09"),
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
    });
    mockPrisma.vote.count.mockResolvedValue(0);
    mockPrisma.vote.upsert.mockResolvedValue({
      id: "v-2",
      sessionId: "cm1234567890abcdef",
      userId: "member-1",
      attending: false,
      votedAt: new Date(),
    });

    const { POST } = await import("@/app/api/votes/route");
    const response = await POST(
      new Request("http://localhost/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "cm1234567890abcdef",
          attending: false,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.attending).toBe(false);
  });

  it("returns 400 when session is full (27 Coming votes) and attending=true", async () => {
    mockAuth.mockResolvedValue(memberSession("member-1"));
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "cm1234567890abcdef",
      status: "SCHEDULED",
      votingEnabled: true,
      votingDeadline: new Date("2099-01-01"),
    });
    mockPrisma.vote.count.mockResolvedValue(27);

    const { POST } = await import("@/app/api/votes/route");
    const response = await POST(
      new Request("http://localhost/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "cm1234567890abcdef",
          attending: true,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("full");
  });

  it("allows Not Coming vote even when session is full (to free a spot)", async () => {
    mockAuth.mockResolvedValue(memberSession("member-1"));
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "cm1234567890abcdef",
      status: "SCHEDULED",
      votingEnabled: true,
      votingDeadline: new Date("2099-01-01"),
      weekDate: new Date("2026-03-09"),
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
    });
    mockPrisma.vote.upsert.mockResolvedValue({
      id: "v-free-spot",
      sessionId: "cm1234567890abcdef",
      userId: "member-1",
      attending: false,
      votedAt: new Date(),
    });

    const { POST } = await import("@/app/api/votes/route");
    const response = await POST(
      new Request("http://localhost/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "cm1234567890abcdef",
          attending: false,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.attending).toBe(false);
    // Full-session check should be skipped for Not Coming votes
    expect(mockPrisma.vote.count).not.toHaveBeenCalled();
  });

  it("returns 400 when member already voted Coming on another session same day", async () => {
    mockAuth.mockResolvedValue(memberSession("member-1"));
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "cm9876543210abcdef",
      status: "SCHEDULED",
      votingEnabled: true,
      votingDeadline: new Date("2099-01-01"),
      weekDate: new Date("2026-03-09"),
      recurringSlot: { dayOfWeek: 1, startHour: 11 },
      customDay: null,
    });
    mockPrisma.vote.count.mockResolvedValue(5); // not full
    mockPrisma.vote.findFirst.mockResolvedValue({
      id: "existing-vote",
      sessionId: "cm1234567890abcdef",
      userId: "member-1",
      attending: true,
    });

    const { POST } = await import("@/app/api/votes/route");
    const response = await POST(
      new Request("http://localhost/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "cm9876543210abcdef",
          attending: true,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("already");
  });

  it("allows Not Coming vote even when already Coming to another session same day", async () => {
    mockAuth.mockResolvedValue(memberSession("member-1"));
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "cm9876543210abcdef",
      status: "SCHEDULED",
      votingEnabled: true,
      votingDeadline: new Date("2099-01-01"),
      weekDate: new Date("2026-03-09"),
      recurringSlot: { dayOfWeek: 1, startHour: 11 },
      customDay: null,
    });
    mockPrisma.vote.count.mockResolvedValue(5);
    mockPrisma.vote.upsert.mockResolvedValue({
      id: "v-new",
      sessionId: "cm9876543210abcdef",
      userId: "member-1",
      attending: false,
      votedAt: new Date(),
    });

    const { POST } = await import("@/app/api/votes/route");
    const response = await POST(
      new Request("http://localhost/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "cm9876543210abcdef",
          attending: false,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.attending).toBe(false);
  });

  // ===== Additional edge case tests for full-session and one-per-day =====

  it("allows vote when session has 19 Coming votes (one below max)", async () => {
    mockAuth.mockResolvedValue(memberSession("member-1"));
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "cm1234567890abcdef",
      status: "SCHEDULED",
      votingEnabled: true,
      votingDeadline: new Date("2099-01-01"),
      weekDate: new Date("2026-03-09"),
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
    });
    mockPrisma.vote.count.mockResolvedValue(19); // one below max
    mockPrisma.vote.findFirst.mockResolvedValue(null);
    mockPrisma.vote.upsert.mockResolvedValue({
      id: "v-boundary",
      sessionId: "cm1234567890abcdef",
      userId: "member-1",
      attending: true,
      votedAt: new Date(),
    });

    const { POST } = await import("@/app/api/votes/route");
    const response = await POST(
      new Request("http://localhost/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "cm1234567890abcdef",
          attending: true,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.attending).toBe(true);
  });

  it("rejects vote when Coming count exceeds MAX_CLASS_SIZE (28 > 27)", async () => {
    mockAuth.mockResolvedValue(memberSession("member-1"));
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "cm1234567890abcdef",
      status: "SCHEDULED",
      votingEnabled: true,
      votingDeadline: new Date("2099-01-01"),
    });
    mockPrisma.vote.count.mockResolvedValue(28); // over max

    const { POST } = await import("@/app/api/votes/route");
    const response = await POST(
      new Request("http://localhost/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "cm1234567890abcdef",
          attending: true,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("full");
  });

  it("allows TRIAL member to vote successfully", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "member-trial", email: "trial@test.com", role: "MEMBER", status: "TRIAL" },
    });
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "cm1234567890abcdef",
      status: "SCHEDULED",
      votingEnabled: true,
      votingDeadline: new Date("2099-01-01"),
      weekDate: new Date("2026-03-09"),
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
    });
    mockPrisma.vote.count.mockResolvedValue(0);
    mockPrisma.vote.findFirst.mockResolvedValue(null);
    mockPrisma.vote.upsert.mockResolvedValue({
      id: "v-trial",
      sessionId: "cm1234567890abcdef",
      userId: "member-trial",
      attending: true,
      votedAt: new Date(),
    });

    const { POST } = await import("@/app/api/votes/route");
    const response = await POST(
      new Request("http://localhost/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "cm1234567890abcdef",
          attending: true,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.attending).toBe(true);
  });

  it("enforces one-per-day on custom (one-off) sessions using customDay", async () => {
    mockAuth.mockResolvedValue(memberSession("member-1"));
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "cm2custom0session0a",
      status: "SCHEDULED",
      votingEnabled: true,
      votingDeadline: new Date("2099-01-01"),
      weekDate: new Date("2026-03-09"),
      recurringSlot: null, // one-off session
      customDay: 3, // Wednesday
    });
    mockPrisma.vote.count.mockResolvedValue(5);
    mockPrisma.vote.findFirst.mockResolvedValue({
      id: "existing-coming",
      sessionId: "cm0otherwednesday0",
      userId: "member-1",
      attending: true,
    });

    const { POST } = await import("@/app/api/votes/route");
    const response = await POST(
      new Request("http://localhost/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "cm2custom0session0a",
          attending: true,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("already");
  });

  it("allows Coming vote when existing Coming vote is on a cancelled session same day", async () => {
    mockAuth.mockResolvedValue(memberSession("member-1"));
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "cm9876543210abcdef",
      status: "SCHEDULED",
      votingEnabled: true,
      votingDeadline: new Date("2099-01-01"),
      weekDate: new Date("2026-03-09"),
      recurringSlot: { dayOfWeek: 1, startHour: 11 },
      customDay: null,
    });
    mockPrisma.vote.count.mockResolvedValue(5);
    // findFirst returns null because cancelled sessions are excluded from query
    mockPrisma.vote.findFirst.mockResolvedValue(null);
    mockPrisma.vote.upsert.mockResolvedValue({
      id: "v-after-cancel",
      sessionId: "cm9876543210abcdef",
      userId: "member-1",
      attending: true,
      votedAt: new Date(),
    });

    const { POST } = await import("@/app/api/votes/route");
    const response = await POST(
      new Request("http://localhost/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "cm9876543210abcdef",
          attending: true,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.attending).toBe(true);
    // Verify the query excludes cancelled sessions
    expect(mockPrisma.vote.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          session: expect.objectContaining({
            status: { not: "CANCELLED" },
          }),
        }),
      })
    );
  });

  it("allows Coming vote on custom (one-off) session when prior Coming was on a cancelled custom session same day", async () => {
    mockAuth.mockResolvedValue(memberSession("member-1"));
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "cm2custom0new0oneoff",
      status: "SCHEDULED",
      votingEnabled: true,
      votingDeadline: new Date("2099-01-01"),
      weekDate: new Date("2026-03-09"),
      recurringSlot: null, // one-off session
      customDay: 3, // Wednesday
    });
    mockPrisma.vote.count.mockResolvedValue(5);
    // findFirst returns null — the only existing Coming vote was on a cancelled custom session
    mockPrisma.vote.findFirst.mockResolvedValue(null);
    mockPrisma.vote.upsert.mockResolvedValue({
      id: "v-custom-after-cancel",
      sessionId: "cm2custom0new0oneoff",
      userId: "member-1",
      attending: true,
      votedAt: new Date(),
    });

    const { POST } = await import("@/app/api/votes/route");
    const response = await POST(
      new Request("http://localhost/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "cm2custom0new0oneoff",
          attending: true,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.attending).toBe(true);
    // Verify findFirst query excludes cancelled sessions for custom day sessions too
    expect(mockPrisma.vote.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          session: expect.objectContaining({
            status: { not: "CANCELLED" },
          }),
        }),
      })
    );
  });

  it("still blocks Coming vote when existing Coming is on a non-cancelled session same day", async () => {
    mockAuth.mockResolvedValue(memberSession("member-1"));
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "cm0new0session0today",
      status: "SCHEDULED",
      votingEnabled: true,
      votingDeadline: new Date("2099-01-01"),
      weekDate: new Date("2026-03-09"),
      recurringSlot: { dayOfWeek: 1, startHour: 14 },
      customDay: null,
    });
    mockPrisma.vote.count.mockResolvedValue(5);
    // findFirst returns a vote — existing Coming on a SCHEDULED (not cancelled) session
    mockPrisma.vote.findFirst.mockResolvedValue({
      id: "existing-active-vote",
      sessionId: "cm0other0active0ses",
      userId: "member-1",
      attending: true,
    });

    const { POST } = await import("@/app/api/votes/route");
    const response = await POST(
      new Request("http://localhost/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "cm0new0session0today",
          attending: true,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("already");
  });

  it("blocks Coming vote when existing Coming is on a COMPLETED session same day (not cancelled)", async () => {
    mockAuth.mockResolvedValue(memberSession("member-1"));
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "cm0new0session0today",
      status: "SCHEDULED",
      votingEnabled: true,
      votingDeadline: new Date("2099-01-01"),
      weekDate: new Date("2026-03-09"),
      recurringSlot: { dayOfWeek: 1, startHour: 16 },
      customDay: null,
    });
    mockPrisma.vote.count.mockResolvedValue(3);
    // findFirst returns a vote — COMPLETED sessions are NOT excluded (only CANCELLED are)
    mockPrisma.vote.findFirst.mockResolvedValue({
      id: "existing-completed-vote",
      sessionId: "cm0completed0sesion",
      userId: "member-1",
      attending: true,
    });

    const { POST } = await import("@/app/api/votes/route");
    const response = await POST(
      new Request("http://localhost/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "cm0new0session0today",
          attending: true,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("already");
  });

  it("allows Coming vote when multiple cancelled sessions exist on same day", async () => {
    mockAuth.mockResolvedValue(memberSession("member-1"));
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "cm0new0session0third",
      status: "SCHEDULED",
      votingEnabled: true,
      votingDeadline: new Date("2099-01-01"),
      weekDate: new Date("2026-03-09"),
      recurringSlot: { dayOfWeek: 1, startHour: 17 },
      customDay: null,
    });
    mockPrisma.vote.count.mockResolvedValue(2);
    // findFirst returns null — both existing Coming votes were on cancelled sessions
    mockPrisma.vote.findFirst.mockResolvedValue(null);
    mockPrisma.vote.upsert.mockResolvedValue({
      id: "v-after-multi-cancel",
      sessionId: "cm0new0session0third",
      userId: "member-1",
      attending: true,
      votedAt: new Date(),
    });

    const { POST } = await import("@/app/api/votes/route");
    const response = await POST(
      new Request("http://localhost/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "cm0new0session0third",
          attending: true,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.attending).toBe(true);
  });

  it("blocks Coming vote when one cancelled and one active Coming vote exist on same day", async () => {
    mockAuth.mockResolvedValue(memberSession("member-1"));
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "cm0yet0another0sess",
      status: "SCHEDULED",
      votingEnabled: true,
      votingDeadline: new Date("2099-01-01"),
      weekDate: new Date("2026-03-09"),
      recurringSlot: { dayOfWeek: 1, startHour: 18 },
      customDay: null,
    });
    mockPrisma.vote.count.mockResolvedValue(5);
    // findFirst returns a vote — one cancelled session is filtered out, but an active one remains
    mockPrisma.vote.findFirst.mockResolvedValue({
      id: "existing-active-vote",
      sessionId: "cm0still0active0ses",
      userId: "member-1",
      attending: true,
    });

    const { POST } = await import("@/app/api/votes/route");
    const response = await POST(
      new Request("http://localhost/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "cm0yet0another0sess",
          attending: true,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("already");
  });

  it("allows Coming vote on custom session when no existing Coming on that day", async () => {
    mockAuth.mockResolvedValue(memberSession("member-1"));
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "cm2custom0session0a",
      status: "SCHEDULED",
      votingEnabled: true,
      votingDeadline: new Date("2099-01-01"),
      weekDate: new Date("2026-03-09"),
      recurringSlot: null,
      customDay: 3,
    });
    mockPrisma.vote.count.mockResolvedValue(5);
    mockPrisma.vote.findFirst.mockResolvedValue(null); // no existing Coming
    mockPrisma.vote.upsert.mockResolvedValue({
      id: "v-custom-ok",
      sessionId: "cm2custom0session0a",
      userId: "member-1",
      attending: true,
      votedAt: new Date(),
    });

    const { POST } = await import("@/app/api/votes/route");
    const response = await POST(
      new Request("http://localhost/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "cm2custom0session0a",
          attending: true,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.attending).toBe(true);
  });

  it("skips one-per-day check when voting Not Coming (does not call findFirst)", async () => {
    mockAuth.mockResolvedValue(memberSession("member-1"));
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "cm1234567890abcdef",
      status: "SCHEDULED",
      votingEnabled: true,
      votingDeadline: new Date("2099-01-01"),
      weekDate: new Date("2026-03-09"),
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
    });
    mockPrisma.vote.count.mockResolvedValue(5);
    mockPrisma.vote.upsert.mockResolvedValue({
      id: "v-not-coming",
      sessionId: "cm1234567890abcdef",
      userId: "member-1",
      attending: false,
      votedAt: new Date(),
    });

    const { POST } = await import("@/app/api/votes/route");
    const response = await POST(
      new Request("http://localhost/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "cm1234567890abcdef",
          attending: false,
        }),
      })
    );

    expect(response.status).toBe(201);
    // findFirst should NOT have been called because attending=false skips the one-per-day check
    expect(mockPrisma.vote.findFirst).not.toHaveBeenCalled();
  });

  it("checks one-per-day uses correct Prisma query shape", async () => {
    mockAuth.mockResolvedValue(memberSession("member-1"));
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "cm2target0session0b",
      status: "SCHEDULED",
      votingEnabled: true,
      votingDeadline: new Date("2099-01-01"),
      weekDate: new Date("2026-03-09"),
      recurringSlot: { dayOfWeek: 2, startHour: 10 },
      customDay: null,
    });
    mockPrisma.vote.count.mockResolvedValue(0);
    mockPrisma.vote.findFirst.mockResolvedValue(null);
    mockPrisma.vote.upsert.mockResolvedValue({
      id: "v-query-check",
      sessionId: "cm2target0session0b",
      userId: "member-1",
      attending: true,
      votedAt: new Date(),
    });

    const { POST } = await import("@/app/api/votes/route");
    await POST(
      new Request("http://localhost/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "cm2target0session0b",
          attending: true,
        }),
      })
    );

    // Verify the findFirst query filters correctly
    expect(mockPrisma.vote.findFirst).toHaveBeenCalledWith({
      where: {
        userId: "member-1",
        attending: true,
        sessionId: { not: "cm2target0session0b" },
        session: {
          weekDate: new Date("2026-03-09"),
          status: { not: "CANCELLED" },
          OR: [
            { recurringSlot: { dayOfWeek: 2 } },
            { customDay: 2 },
          ],
        },
      },
    });
  });

  it("full-session check counts only attending:true votes", async () => {
    mockAuth.mockResolvedValue(memberSession("member-1"));
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "cm1234567890abcdef",
      status: "SCHEDULED",
      votingEnabled: true,
      votingDeadline: new Date("2099-01-01"),
      weekDate: new Date("2026-03-09"),
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
    });
    mockPrisma.vote.count.mockResolvedValue(10);
    mockPrisma.vote.findFirst.mockResolvedValue(null);
    mockPrisma.vote.upsert.mockResolvedValue({
      id: "v-count-check",
      sessionId: "cm1234567890abcdef",
      userId: "member-1",
      attending: true,
      votedAt: new Date(),
    });

    const { POST } = await import("@/app/api/votes/route");
    await POST(
      new Request("http://localhost/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "cm1234567890abcdef",
          attending: true,
        }),
      })
    );

    // Verify count query filters only attending:true
    expect(mockPrisma.vote.count).toHaveBeenCalledWith({
      where: { sessionId: "cm1234567890abcdef", attending: true },
    });
  });
});

// ===== GET /api/votes =====

describe("GET /api/votes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { GET } = await import("@/app/api/votes/route");
    const response = await GET(
      new Request("http://localhost/api/votes?sessionId=s-1")
    );

    expect(response.status).toBe(401);
  });

  it("returns 400 when sessionId is missing", async () => {
    mockAuth.mockResolvedValue(ownerSession());

    const { GET } = await import("@/app/api/votes/route");
    const response = await GET(new Request("http://localhost/api/votes"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("sessionId");
  });

  it("returns all votes for OWNER", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.vote.findMany.mockResolvedValue([
      {
        id: "v-1",
        userId: "m-1",
        attending: true,
        votedAt: new Date(),
        user: { id: "m-1", name: "Alice" },
      },
      {
        id: "v-2",
        userId: "m-2",
        attending: false,
        votedAt: new Date(),
        user: { id: "m-2", name: "Bob" },
      },
    ]);

    const { GET } = await import("@/app/api/votes/route");
    const response = await GET(
      new Request("http://localhost/api/votes?sessionId=s-1")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(2);
    // Owner query filters by sessionId only (not userId)
    expect(mockPrisma.vote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sessionId: "s-1" },
      })
    );
  });

  it("returns all votes for TRAINER", async () => {
    mockAuth.mockResolvedValue(trainerSession());
    mockPrisma.vote.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/votes/route");
    const response = await GET(
      new Request("http://localhost/api/votes?sessionId=s-1")
    );

    expect(response.status).toBe(200);
    // Trainer sees all votes (same filter as owner)
    expect(mockPrisma.vote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sessionId: "s-1" },
      })
    );
  });

  it("returns only own vote for MEMBER", async () => {
    mockAuth.mockResolvedValue(memberSession("m-1"));
    mockPrisma.vote.findMany.mockResolvedValue([
      {
        id: "v-1",
        userId: "m-1",
        attending: true,
        votedAt: new Date(),
        user: { id: "m-1", name: "Alice" },
      },
    ]);

    const { GET } = await import("@/app/api/votes/route");
    const response = await GET(
      new Request("http://localhost/api/votes?sessionId=s-1")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    // Member query filters by sessionId AND userId
    expect(mockPrisma.vote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sessionId: "s-1", userId: "m-1" },
      })
    );
  });
});

// ===== POST /api/votes — $transaction behavior =====

describe("POST /api/votes — $transaction behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore the default $transaction implementation after each test
    // (some tests override it with mockRejectedValueOnce)
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma)
    );
  });

  it("uses $transaction for attending=true votes", async () => {
    mockAuth.mockResolvedValue(memberSession("member-1"));
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "cm1234567890abcdef",
      status: "SCHEDULED",
      votingEnabled: true,
      votingDeadline: new Date("2099-01-01"),
      weekDate: new Date("2026-03-09"),
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
    });
    mockPrisma.vote.count.mockResolvedValue(0);
    mockPrisma.vote.findFirst.mockResolvedValue(null);
    mockPrisma.vote.upsert.mockResolvedValue({
      id: "v-tx-1",
      sessionId: "cm1234567890abcdef",
      userId: "member-1",
      attending: true,
      votedAt: new Date(),
    });

    const { POST } = await import("@/app/api/votes/route");
    const response = await POST(
      new Request("http://localhost/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "cm1234567890abcdef",
          attending: true,
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
  });

  it("does not use $transaction for attending=false votes", async () => {
    mockAuth.mockResolvedValue(memberSession("member-1"));
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "cm1234567890abcdef",
      status: "SCHEDULED",
      votingEnabled: true,
      votingDeadline: new Date("2099-01-01"),
      weekDate: new Date("2026-03-09"),
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
    });
    mockPrisma.vote.upsert.mockResolvedValue({
      id: "v-no-tx",
      sessionId: "cm1234567890abcdef",
      userId: "member-1",
      attending: false,
      votedAt: new Date(),
    });

    const { POST } = await import("@/app/api/votes/route");
    const response = await POST(
      new Request("http://localhost/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "cm1234567890abcdef",
          attending: false,
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.vote.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          sessionId_userId: {
            sessionId: "cm1234567890abcdef",
            userId: "member-1",
          },
        },
        update: expect.objectContaining({ attending: false }),
        create: expect.objectContaining({
          sessionId: "cm1234567890abcdef",
          userId: "member-1",
          attending: false,
        }),
      })
    );
  });

  it("performs capacity check inside the transaction callback", async () => {
    mockAuth.mockResolvedValue(memberSession("member-1"));
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "cm1234567890abcdef",
      status: "SCHEDULED",
      votingEnabled: true,
      votingDeadline: new Date("2099-01-01"),
      weekDate: new Date("2026-03-09"),
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
    });
    mockPrisma.vote.count.mockResolvedValue(5);
    mockPrisma.vote.findFirst.mockResolvedValue(null);
    mockPrisma.vote.upsert.mockResolvedValue({
      id: "v-cap-check",
      sessionId: "cm1234567890abcdef",
      userId: "member-1",
      attending: true,
      votedAt: new Date(),
    });

    const { POST } = await import("@/app/api/votes/route");
    await POST(
      new Request("http://localhost/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "cm1234567890abcdef",
          attending: true,
        }),
      })
    );

    // The $transaction mock passes mockPrisma as tx, so vote.count IS called through tx
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.vote.count).toHaveBeenCalledWith({
      where: { sessionId: "cm1234567890abcdef", attending: true },
    });
  });

  it("performs same-day check inside the transaction callback", async () => {
    mockAuth.mockResolvedValue(memberSession("member-1"));
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "cm1234567890abcdef",
      status: "SCHEDULED",
      votingEnabled: true,
      votingDeadline: new Date("2099-01-01"),
      weekDate: new Date("2026-03-09"),
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
    });
    mockPrisma.vote.count.mockResolvedValue(5);
    mockPrisma.vote.findFirst.mockResolvedValue(null);
    mockPrisma.vote.upsert.mockResolvedValue({
      id: "v-sameday-check",
      sessionId: "cm1234567890abcdef",
      userId: "member-1",
      attending: true,
      votedAt: new Date(),
    });

    const { POST } = await import("@/app/api/votes/route");
    await POST(
      new Request("http://localhost/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "cm1234567890abcdef",
          attending: true,
        }),
      })
    );

    // The $transaction mock passes mockPrisma as tx, so vote.findFirst IS called through tx
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.vote.findFirst).toHaveBeenCalledWith({
      where: {
        userId: "member-1",
        attending: true,
        sessionId: { not: "cm1234567890abcdef" },
        session: {
          weekDate: new Date("2026-03-09"),
          status: { not: "CANCELLED" },
          OR: [
            { recurringSlot: { dayOfWeek: 1 } },
            { customDay: 1 },
          ],
        },
      },
    });
  });

  it("performs vote upsert inside the transaction callback", async () => {
    mockAuth.mockResolvedValue(memberSession("member-1"));
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "cm1234567890abcdef",
      status: "SCHEDULED",
      votingEnabled: true,
      votingDeadline: new Date("2099-01-01"),
      weekDate: new Date("2026-03-09"),
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
    });
    mockPrisma.vote.count.mockResolvedValue(0);
    mockPrisma.vote.findFirst.mockResolvedValue(null);
    mockPrisma.vote.upsert.mockResolvedValue({
      id: "v-upsert-tx",
      sessionId: "cm1234567890abcdef",
      userId: "member-1",
      attending: true,
      votedAt: new Date(),
    });

    const { POST } = await import("@/app/api/votes/route");
    const response = await POST(
      new Request("http://localhost/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "cm1234567890abcdef",
          attending: true,
        }),
      })
    );

    expect(response.status).toBe(201);
    // Both $transaction and upsert must have been called
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.vote.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          sessionId_userId: {
            sessionId: "cm1234567890abcdef",
            userId: "member-1",
          },
        },
        update: expect.objectContaining({ attending: true }),
        create: expect.objectContaining({
          sessionId: "cm1234567890abcdef",
          userId: "member-1",
          attending: true,
        }),
      })
    );
  });

  it("returns error when transaction detects session is full", async () => {
    mockAuth.mockResolvedValue(memberSession("member-1"));
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "cm1234567890abcdef",
      status: "SCHEDULED",
      votingEnabled: true,
      votingDeadline: new Date("2099-01-01"),
      weekDate: new Date("2026-03-09"),
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
    });
    mockPrisma.vote.count.mockResolvedValue(27); // full (MAX_CLASS_SIZE)

    const { POST } = await import("@/app/api/votes/route");
    const response = await POST(
      new Request("http://localhost/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "cm1234567890abcdef",
          attending: true,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("full");
    // Transaction was called but returned an error object
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    // Upsert should NOT have been called because capacity check failed first
    expect(mockPrisma.vote.upsert).not.toHaveBeenCalled();
  });

  it("returns 500 when $transaction throws an error", async () => {
    mockAuth.mockResolvedValue(memberSession("member-1"));
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "cm1234567890abcdef",
      status: "SCHEDULED",
      votingEnabled: true,
      votingDeadline: new Date("2099-01-01"),
      weekDate: new Date("2026-03-09"),
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
    });
    mockPrisma.$transaction.mockRejectedValueOnce(new Error("DB error"));

    const { POST } = await import("@/app/api/votes/route");
    const response = await POST(
      new Request("http://localhost/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "cm1234567890abcdef",
          attending: true,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toContain("Internal server error");
  });
});
