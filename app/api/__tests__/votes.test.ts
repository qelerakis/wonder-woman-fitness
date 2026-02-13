/**
 * Votes API Integration Tests
 *
 * Tests auth enforcement, validation, voting deadline checks,
 * session membership checks, and happy paths for POST/GET /api/votes.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ===== Mocks =====

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
      members: [{ userId: "member-1" }],
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
      members: [{ userId: "member-1" }],
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
      members: [{ userId: "member-1" }],
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

  it("returns 403 when user is not assigned to session", async () => {
    mockAuth.mockResolvedValue(memberSession("member-1"));
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "cm1234567890abcdef",
      status: "SCHEDULED",
      votingEnabled: true,
      votingDeadline: new Date("2099-01-01"),
      members: [], // user not in members list
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
    expect(body.error).toContain("not assigned");
  });

  it("creates vote successfully (attending: true)", async () => {
    mockAuth.mockResolvedValue(memberSession("member-1"));
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "cm1234567890abcdef",
      status: "SCHEDULED",
      votingEnabled: true,
      votingDeadline: new Date("2099-01-01"),
      members: [{ userId: "member-1" }],
    });
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
      members: [{ userId: "member-1" }],
    });
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
