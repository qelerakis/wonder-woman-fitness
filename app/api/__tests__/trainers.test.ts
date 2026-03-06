/**
 * Trainers API Integration Tests
 *
 * Tests auth enforcement, role-based access, validation, and
 * happy paths for POST /api/trainers (promote member to trainer).
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

const mockDispatchNotification = vi.fn();
vi.mock("@/lib/notifications", () => ({
  dispatchNotification: (...args: unknown[]) => mockDispatchNotification(...args),
}));

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
  sessionMember: {
    deleteMany: vi.fn(),
  },
  vote: {
    deleteMany: vi.fn(),
  },
  $transaction: vi.fn((fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma)),
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

function memberSession() {
  return { user: { id: "member-1", email: "member@test.com", role: "MEMBER", status: "ACTIVE" } };
}

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/trainers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ===== Import route handler =====

const { POST } = await import("@/app/api/trainers/route");

// ===== Tests =====

describe("POST /api/trainers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDispatchNotification.mockResolvedValue({});
  });

  // --- Auth ---

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest({ memberId: "cm1234567890abcdef" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is TRAINER", async () => {
    mockAuth.mockResolvedValue(trainerSession());
    const res = await POST(makeRequest({ memberId: "cm1234567890abcdef" }));
    expect(res.status).toBe(403);
  });

  it("returns 403 when user is MEMBER", async () => {
    mockAuth.mockResolvedValue(memberSession());
    const res = await POST(makeRequest({ memberId: "cm1234567890abcdef" }));
    expect(res.status).toBe(403);
  });

  // --- Validation ---

  it("returns 400 for missing memberId", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid memberId format", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    const res = await POST(makeRequest({ memberId: "not-a-cuid" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for extra unknown fields", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    const res = await POST(makeRequest({ memberId: "cm1234567890abcdef", extra: "field" }));
    expect(res.status).toBe(400);
  });

  // --- Business logic ---

  it("returns 404 when member does not exist", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = await POST(makeRequest({ memberId: "cm1234567890abcdef" }));
    expect(res.status).toBe(404);
  });

  it("returns 400 when user is not a MEMBER role", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.user.findUnique.mockResolvedValue({ id: "cm1234567890abcdef", role: "TRAINER", status: "ACTIVE", name: "Test" });
    const res = await POST(makeRequest({ memberId: "cm1234567890abcdef" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("already a trainer");
  });

  it("returns 400 when member is DEPARTED", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.user.findUnique.mockResolvedValue({ id: "cm1234567890abcdef", role: "MEMBER", status: "DEPARTED", name: "Gone" });
    const res = await POST(makeRequest({ memberId: "cm1234567890abcdef" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("departed");
  });

  it("returns 400 when user is OWNER role (not MEMBER)", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.user.findUnique.mockResolvedValue({ id: "cm1234567890abcdef", role: "OWNER", status: "ACTIVE", name: "Boss" });
    const res = await POST(makeRequest({ memberId: "cm1234567890abcdef" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("already a trainer or owner");
  });

  it("promotes a TRIAL member to trainer (sets status to ACTIVE)", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    const member = { id: "cm1234567890abcdef", role: "MEMBER", status: "TRIAL", name: "New Member" };
    mockPrisma.user.findUnique.mockResolvedValue(member);
    mockPrisma.user.update.mockResolvedValue({ ...member, role: "TRAINER", status: "ACTIVE" });
    mockPrisma.sessionMember.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.vote.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.user.findMany.mockResolvedValue([]);

    const res = await POST(makeRequest({ memberId: "cm1234567890abcdef" }));
    expect(res.status).toBe(200);

    // Verify status was set to ACTIVE (not left as TRIAL)
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "cm1234567890abcdef" },
      data: { role: "TRAINER", status: "ACTIVE" },
    });
  });

  // --- Happy path ---

  it("promotes a member to trainer successfully", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    const member = { id: "cm1234567890abcdef", role: "MEMBER", status: "ACTIVE", name: "Ana Trainer" };
    mockPrisma.user.findUnique.mockResolvedValue(member);
    mockPrisma.user.update.mockResolvedValue({ ...member, role: "TRAINER" });
    mockPrisma.sessionMember.deleteMany.mockResolvedValue({ count: 2 });
    mockPrisma.vote.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.user.findMany.mockResolvedValue([]);

    const res = await POST(makeRequest({ memberId: "cm1234567890abcdef" }));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.data.role).toBe("TRAINER");
  });

  it("cleans up future session member assignments", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    const member = { id: "cm1234567890abcdef", role: "MEMBER", status: "ACTIVE", name: "Ana" };
    mockPrisma.user.findUnique.mockResolvedValue(member);
    mockPrisma.user.update.mockResolvedValue({ ...member, role: "TRAINER" });
    mockPrisma.sessionMember.deleteMany.mockResolvedValue({ count: 3 });
    mockPrisma.vote.deleteMany.mockResolvedValue({ count: 2 });
    mockPrisma.user.findMany.mockResolvedValue([]);

    await POST(makeRequest({ memberId: "cm1234567890abcdef" }));

    expect(mockPrisma.sessionMember.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: "cm1234567890abcdef",
        session: { weekDate: { gte: expect.any(Date) } },
      },
    });
  });

  it("cleans up future votes", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    const member = { id: "cm1234567890abcdef", role: "MEMBER", status: "ACTIVE", name: "Ana" };
    mockPrisma.user.findUnique.mockResolvedValue(member);
    mockPrisma.user.update.mockResolvedValue({ ...member, role: "TRAINER" });
    mockPrisma.sessionMember.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.vote.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.user.findMany.mockResolvedValue([]);

    await POST(makeRequest({ memberId: "cm1234567890abcdef" }));

    expect(mockPrisma.vote.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: "cm1234567890abcdef",
        session: { weekDate: { gte: expect.any(Date) } },
      },
    });
  });

  it("dispatches a notification to the promoted user", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    const member = { id: "cm1234567890abcdef", role: "MEMBER", status: "ACTIVE", name: "Ana" };
    mockPrisma.user.findUnique.mockResolvedValue(member);
    mockPrisma.user.update.mockResolvedValue({ ...member, role: "TRAINER" });
    mockPrisma.sessionMember.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.vote.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.user.findMany.mockResolvedValue([]);

    await POST(makeRequest({ memberId: "cm1234567890abcdef" }));

    expect(mockDispatchNotification).toHaveBeenCalledWith({
      userId: "cm1234567890abcdef",
      type: "ROLE_CHANGED",
      title: expect.stringContaining("Trainer"),
      body: expect.any(String),
    });
  });

  it("returns updated trainer list after promotion", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    const member = { id: "cm1234567890abcdef", role: "MEMBER", status: "ACTIVE", name: "Ana" };
    mockPrisma.user.findUnique.mockResolvedValue(member);
    mockPrisma.user.update.mockResolvedValue({ ...member, role: "TRAINER" });
    mockPrisma.sessionMember.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.vote.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "cm1234567890abcdef", name: "Ana", email: "ana@test.com", phone: null, status: "ACTIVE", createdAt: new Date() },
    ]);

    const res = await POST(makeRequest({ memberId: "cm1234567890abcdef" }));
    const data = await res.json();
    expect(data.data.trainers).toHaveLength(1);
    expect(data.data.trainers[0].name).toBe("Ana");
  });
});
