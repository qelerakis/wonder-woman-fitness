# Owner Broadcast Notifications — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow the owner to compose and send custom notifications to targeted groups of members from a modal on the notifications page.

**Architecture:** New broadcast API endpoints (`POST /api/notifications/broadcast` for sending, `GET /api/notifications/broadcast/recipients` for live count) + a `SendNotificationModal` client component opened from the existing `NotificationsClient`. Uses existing `MANUAL_REMINDER` notification type and `dispatchNotificationToMany()`. No schema changes.

**Tech Stack:** Next.js 15 App Router, TypeScript, Zod validation, Prisma 7, Vitest

---

### Task 1: Add Zod schemas and constants for broadcast

**Files:**
- Modify: `types/index.ts` (add new schemas after line 261)
- Modify: `lib/constants.ts` (add broadcast-specific constants)

**Step 1: Add constants**

In `lib/constants.ts`, add after line 80 (after `MAX_RESET_TOKEN_LENGTH`):

```typescript
export const MAX_BROADCAST_TITLE_LENGTH = 100;
export const MAX_BROADCAST_BODY_LENGTH = 500;
export const BROADCAST_RATE_LIMIT_MAX = 10;
export const BROADCAST_RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
```

**Step 2: Add Zod schemas**

In `types/index.ts`, add the import for the new constants, then add after line 261 (after `NotificationsQuery`):

```typescript
import {
  // ... existing imports ...
  MAX_BROADCAST_TITLE_LENGTH,
  MAX_BROADCAST_BODY_LENGTH,
} from '@/lib/constants';

// ===== BROADCAST NOTIFICATION SCHEMAS =====

export const BroadcastAudienceSchema = z.enum([
  'ALL',
  'TRIAL',
  'SESSION_SLOT',
  'PAYMENT_STATUS',
  'INDIVIDUAL',
]);

export type BroadcastAudience = z.infer<typeof BroadcastAudienceSchema>;

export const BroadcastNotificationSchema = z.object({
  audience: BroadcastAudienceSchema,
  slotId: z.string().cuid('Invalid slot ID').optional(),
  paymentStatus: z.enum(['GRACE_PERIOD', 'LOCKED']).optional(),
  memberIds: z.array(z.string().cuid('Invalid member ID')).optional(),
  title: z.string().min(1, 'Title is required').max(MAX_BROADCAST_TITLE_LENGTH, `Title too long (max ${MAX_BROADCAST_TITLE_LENGTH} chars)`),
  body: z.string().min(1, 'Message is required').max(MAX_BROADCAST_BODY_LENGTH, `Message too long (max ${MAX_BROADCAST_BODY_LENGTH} chars)`),
}).strict().superRefine((data, ctx) => {
  if (data.audience === 'SESSION_SLOT' && !data.slotId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'slotId is required when audience is SESSION_SLOT',
      path: ['slotId'],
    });
  }
  if (data.audience === 'PAYMENT_STATUS' && !data.paymentStatus) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'paymentStatus is required when audience is PAYMENT_STATUS',
      path: ['paymentStatus'],
    });
  }
  if (data.audience === 'INDIVIDUAL' && (!data.memberIds || data.memberIds.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'memberIds is required when audience is INDIVIDUAL',
      path: ['memberIds'],
    });
  }
});

export type BroadcastNotificationInput = z.infer<typeof BroadcastNotificationSchema>;

export const BroadcastRecipientsQuerySchema = z.object({
  audience: BroadcastAudienceSchema,
  slotId: z.string().optional(),
  paymentStatus: z.enum(['GRACE_PERIOD', 'LOCKED']).optional(),
}).strict();

export type BroadcastRecipientsQuery = z.infer<typeof BroadcastRecipientsQuerySchema>;
```

**Step 3: Commit**

```
feat: add broadcast notification schemas and constants
```

---

### Task 2: Write tests for the broadcast send endpoint

**Files:**
- Create: `app/api/__tests__/broadcast-notifications.test.ts`

**Step 1: Write the test file**

Follow existing test patterns. All mocks at top, dynamic imports, `vi.clearAllMocks()` in `beforeEach`.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock rate limiter
vi.mock("@/lib/rate-limit", () => ({
  publicLimiter: { check: () => ({ allowed: true, remaining: 10, retryAfterMs: 0 }) },
  authWriteLimiter: { check: () => ({ allowed: true, remaining: 10, retryAfterMs: 0 }) },
  authReadLimiter: { check: () => ({ allowed: true, remaining: 10, retryAfterMs: 0 }) },
  cronLimiter: { check: () => ({ allowed: true, remaining: 10, retryAfterMs: 0 }) },
  RateLimiter: class { check() { return { allowed: true, remaining: 10, retryAfterMs: 0 }; } },
  getClientIp: () => "127.0.0.1",
  createRateLimitResponse: () => Response.json({ error: "Rate limited" }, { status: 429 }),
}));

// Mock auth
const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

// Mock prisma
const mockPrisma = {
  user: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  recurringSlot: {
    findUnique: vi.fn(),
  },
  sessionMember: {
    findMany: vi.fn(),
  },
  payment: {
    findMany: vi.fn(),
  },
  $transaction: vi.fn(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma)),
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// Mock notifications
const mockDispatchToMany = vi.fn().mockResolvedValue([]);
vi.mock("@/lib/notifications", () => ({
  dispatchNotificationToMany: (...args: unknown[]) => mockDispatchToMany(...args),
}));

// Mock payment logic
const mockGetPaymentStatus = vi.fn().mockReturnValue("PAID");
vi.mock("@/lib/payment-logic", () => ({
  getPaymentStatus: (...args: unknown[]) => mockGetPaymentStatus(...args),
}));

function ownerSession() {
  return { user: { id: "owner-1", email: "owner@test.com", role: "OWNER", status: "ACTIVE" } };
}
function trainerSession() {
  return { user: { id: "trainer-1", email: "trainer@test.com", role: "TRAINER", status: "ACTIVE" } };
}
function memberSession() {
  return { user: { id: "member-1", email: "member@test.com", role: "MEMBER", status: "ACTIVE" } };
}

describe("POST /api/notifications/broadcast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Auth tests ---
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const { POST } = await import("@/app/api/notifications/broadcast/route");
    const res = await POST(new Request("http://localhost/api/notifications/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audience: "ALL", title: "Hi", body: "Hello" }),
    }));
    expect(res.status).toBe(401);
  });

  it("returns 403 for trainer", async () => {
    mockAuth.mockResolvedValue(trainerSession());
    const { POST } = await import("@/app/api/notifications/broadcast/route");
    const res = await POST(new Request("http://localhost/api/notifications/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audience: "ALL", title: "Hi", body: "Hello" }),
    }));
    expect(res.status).toBe(403);
  });

  it("returns 403 for member", async () => {
    mockAuth.mockResolvedValue(memberSession());
    const { POST } = await import("@/app/api/notifications/broadcast/route");
    const res = await POST(new Request("http://localhost/api/notifications/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audience: "ALL", title: "Hi", body: "Hello" }),
    }));
    expect(res.status).toBe(403);
  });

  // --- Validation tests ---
  it("returns 400 for missing title", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    const { POST } = await import("@/app/api/notifications/broadcast/route");
    const res = await POST(new Request("http://localhost/api/notifications/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audience: "ALL", body: "Hello" }),
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing body", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    const { POST } = await import("@/app/api/notifications/broadcast/route");
    const res = await POST(new Request("http://localhost/api/notifications/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audience: "ALL", title: "Hi" }),
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid audience", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    const { POST } = await import("@/app/api/notifications/broadcast/route");
    const res = await POST(new Request("http://localhost/api/notifications/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audience: "INVALID", title: "Hi", body: "Hello" }),
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for title exceeding 100 chars", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    const { POST } = await import("@/app/api/notifications/broadcast/route");
    const res = await POST(new Request("http://localhost/api/notifications/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audience: "ALL", title: "x".repeat(101), body: "Hello" }),
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for body exceeding 500 chars", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    const { POST } = await import("@/app/api/notifications/broadcast/route");
    const res = await POST(new Request("http://localhost/api/notifications/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audience: "ALL", title: "Hi", body: "x".repeat(501) }),
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when SESSION_SLOT audience but no slotId", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    const { POST } = await import("@/app/api/notifications/broadcast/route");
    const res = await POST(new Request("http://localhost/api/notifications/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audience: "SESSION_SLOT", title: "Hi", body: "Hello" }),
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when PAYMENT_STATUS audience but no paymentStatus", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    const { POST } = await import("@/app/api/notifications/broadcast/route");
    const res = await POST(new Request("http://localhost/api/notifications/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audience: "PAYMENT_STATUS", title: "Hi", body: "Hello" }),
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when INDIVIDUAL audience but no memberIds", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    const { POST } = await import("@/app/api/notifications/broadcast/route");
    const res = await POST(new Request("http://localhost/api/notifications/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audience: "INDIVIDUAL", title: "Hi", body: "Hello" }),
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when INDIVIDUAL audience with empty memberIds", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    const { POST } = await import("@/app/api/notifications/broadcast/route");
    const res = await POST(new Request("http://localhost/api/notifications/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audience: "INDIVIDUAL", title: "Hi", body: "Hello", memberIds: [] }),
    }));
    expect(res.status).toBe(400);
  });

  it("rejects unknown fields", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    const { POST } = await import("@/app/api/notifications/broadcast/route");
    const res = await POST(new Request("http://localhost/api/notifications/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audience: "ALL", title: "Hi", body: "Hello", extra: "field" }),
    }));
    expect(res.status).toBe(400);
  });

  // --- Audience resolution: ALL ---
  it("sends to all active+trial members for ALL audience", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "m1" }, { id: "m2" }, { id: "m3" },
    ]);
    mockDispatchToMany.mockResolvedValue([{}, {}, {}]);

    const { POST } = await import("@/app/api/notifications/broadcast/route");
    const res = await POST(new Request("http://localhost/api/notifications/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audience: "ALL", title: "Gym News", body: "Hello everyone!" }),
    }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.sentCount).toBe(3);
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { role: "MEMBER", status: { in: ["ACTIVE", "TRIAL"] } },
    }));
    expect(mockDispatchToMany).toHaveBeenCalledWith(
      ["m1", "m2", "m3"], "MANUAL_REMINDER", "Gym News", "Hello everyone!"
    );
  });

  // --- Audience resolution: TRIAL ---
  it("sends to trial members only for TRIAL audience", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.user.findMany.mockResolvedValue([{ id: "t1" }]);
    mockDispatchToMany.mockResolvedValue([{}]);

    const { POST } = await import("@/app/api/notifications/broadcast/route");
    const res = await POST(new Request("http://localhost/api/notifications/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audience: "TRIAL", title: "Welcome", body: "Trial info" }),
    }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.sentCount).toBe(1);
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { role: "MEMBER", status: "TRIAL" },
    }));
  });

  // --- Audience resolution: SESSION_SLOT ---
  it("sends to members assigned to a session slot", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.recurringSlot.findUnique.mockResolvedValue({ id: "slot-1" });
    mockPrisma.sessionMember.findMany.mockResolvedValue([
      { userId: "m1" }, { userId: "m2" },
    ]);
    mockDispatchToMany.mockResolvedValue([{}, {}]);

    const { POST } = await import("@/app/api/notifications/broadcast/route");
    const res = await POST(new Request("http://localhost/api/notifications/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audience: "SESSION_SLOT", slotId: "slot-1", title: "Slot Update", body: "Info" }),
    }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.sentCount).toBe(2);
  });

  it("returns 404 for invalid slotId", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.recurringSlot.findUnique.mockResolvedValue(null);

    const { POST } = await import("@/app/api/notifications/broadcast/route");
    const res = await POST(new Request("http://localhost/api/notifications/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audience: "SESSION_SLOT", slotId: "nonexistent123456789012345", title: "Hi", body: "Hello" }),
    }));
    expect(res.status).toBe(404);
  });

  // --- Audience resolution: PAYMENT_STATUS ---
  it("sends to members in GRACE_PERIOD", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    const members = [
      { id: "m1", status: "ACTIVE", trialEndsAt: null, departedAt: null, overrideActive: false, payments: [] },
      { id: "m2", status: "ACTIVE", trialEndsAt: null, departedAt: null, overrideActive: false, payments: [] },
      { id: "m3", status: "TRIAL", trialEndsAt: new Date(), departedAt: null, overrideActive: false, payments: [] },
    ];
    mockPrisma.user.findMany.mockResolvedValue(members);
    mockGetPaymentStatus
      .mockReturnValueOnce("GRACE_PERIOD")
      .mockReturnValueOnce("PAID")
      .mockReturnValueOnce("GRACE_PERIOD");
    mockDispatchToMany.mockResolvedValue([{}, {}]);

    const { POST } = await import("@/app/api/notifications/broadcast/route");
    const res = await POST(new Request("http://localhost/api/notifications/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audience: "PAYMENT_STATUS", paymentStatus: "GRACE_PERIOD", title: "Payment Due", body: "Please pay" }),
    }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.sentCount).toBe(2);
    expect(mockDispatchToMany).toHaveBeenCalledWith(
      ["m1", "m3"], "MANUAL_REMINDER", "Payment Due", "Please pay"
    );
  });

  it("sends to members with LOCKED status", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    const members = [
      { id: "m1", status: "ACTIVE", trialEndsAt: null, departedAt: null, overrideActive: false, payments: [] },
    ];
    mockPrisma.user.findMany.mockResolvedValue(members);
    mockGetPaymentStatus.mockReturnValue("LOCKED");
    mockDispatchToMany.mockResolvedValue([{}]);

    const { POST } = await import("@/app/api/notifications/broadcast/route");
    const res = await POST(new Request("http://localhost/api/notifications/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audience: "PAYMENT_STATUS", paymentStatus: "LOCKED", title: "Locked", body: "Pay now" }),
    }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.sentCount).toBe(1);
  });

  // --- Audience resolution: INDIVIDUAL ---
  it("sends to individually selected members", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "m1" }, { id: "m3" },
    ]);
    mockDispatchToMany.mockResolvedValue([{}, {}]);

    const { POST } = await import("@/app/api/notifications/broadcast/route");
    const res = await POST(new Request("http://localhost/api/notifications/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audience: "INDIVIDUAL", memberIds: ["m1", "m3"], title: "Hey", body: "Personal msg" }),
    }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.sentCount).toBe(2);
  });

  it("filters out non-existent/departed members for INDIVIDUAL", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    // Only m1 exists and is active; m2 doesn't exist
    mockPrisma.user.findMany.mockResolvedValue([{ id: "m1" }]);
    mockDispatchToMany.mockResolvedValue([{}]);

    const { POST } = await import("@/app/api/notifications/broadcast/route");
    const res = await POST(new Request("http://localhost/api/notifications/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audience: "INDIVIDUAL", memberIds: ["m1", "m2"], title: "Hey", body: "Hi" }),
    }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.sentCount).toBe(1);
  });

  // --- Edge case: 0 recipients ---
  it("returns 200 with sentCount 0 when no recipients match", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockDispatchToMany.mockResolvedValue([]);

    const { POST } = await import("@/app/api/notifications/broadcast/route");
    const res = await POST(new Request("http://localhost/api/notifications/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audience: "TRIAL", title: "Hi", body: "Hello" }),
    }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.sentCount).toBe(0);
  });
});

describe("GET /api/notifications/broadcast/recipients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const { GET } = await import("@/app/api/notifications/broadcast/recipients/route");
    const res = await GET(new Request("http://localhost/api/notifications/broadcast/recipients?audience=ALL"));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-owner", async () => {
    mockAuth.mockResolvedValue(memberSession());
    const { GET } = await import("@/app/api/notifications/broadcast/recipients/route");
    const res = await GET(new Request("http://localhost/api/notifications/broadcast/recipients?audience=ALL"));
    expect(res.status).toBe(403);
  });

  it("returns count and members for ALL audience", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "m1", name: "Alice" },
      { id: "m2", name: "Bob" },
    ]);

    const { GET } = await import("@/app/api/notifications/broadcast/recipients/route");
    const res = await GET(new Request("http://localhost/api/notifications/broadcast/recipients?audience=ALL"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.count).toBe(2);
    expect(data.data.members).toEqual([
      { id: "m1", name: "Alice" },
      { id: "m2", name: "Bob" },
    ]);
  });

  it("returns 400 for missing audience param", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    const { GET } = await import("@/app/api/notifications/broadcast/recipients/route");
    const res = await GET(new Request("http://localhost/api/notifications/broadcast/recipients"));
    expect(res.status).toBe(400);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- app/api/__tests__/broadcast-notifications.test.ts`
Expected: ALL FAIL (routes don't exist yet)

**Step 3: Commit**

```
test: add broadcast notification endpoint tests
```

---

### Task 3: Implement the broadcast send endpoint

**Files:**
- Create: `app/api/notifications/broadcast/route.ts`

**Step 1: Write the route handler**

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dispatchNotificationToMany } from "@/lib/notifications";
import { getPaymentStatus } from "@/lib/payment-logic";
import { BroadcastNotificationSchema } from "@/types";
import { RateLimiter, createRateLimitResponse } from "@/lib/rate-limit";
import { BROADCAST_RATE_LIMIT_MAX, BROADCAST_RATE_LIMIT_WINDOW_MS } from "@/lib/constants";

const broadcastLimiter = new RateLimiter({
  maxRequests: BROADCAST_RATE_LIMIT_MAX,
  windowMs: BROADCAST_RATE_LIMIT_WINDOW_MS,
});

export async function POST(req: Request): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Rate limit
    const rateLimitResult = broadcastLimiter.check(`broadcast:${session.user.id}`);
    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(rateLimitResult.retryAfterMs);
    }

    const body = await req.json();
    const parsed = BroadcastNotificationSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { audience, slotId, paymentStatus, memberIds, title, body: messageBody } = parsed.data;

    // Resolve audience to user IDs
    let recipientIds: string[] = [];

    switch (audience) {
      case "ALL": {
        const users = await prisma.user.findMany({
          where: { role: "MEMBER", status: { in: ["ACTIVE", "TRIAL"] } },
          select: { id: true },
        });
        recipientIds = users.map((u) => u.id);
        break;
      }
      case "TRIAL": {
        const users = await prisma.user.findMany({
          where: { role: "MEMBER", status: "TRIAL" },
          select: { id: true },
        });
        recipientIds = users.map((u) => u.id);
        break;
      }
      case "SESSION_SLOT": {
        const slot = await prisma.recurringSlot.findUnique({
          where: { id: slotId! },
        });
        if (!slot) {
          return Response.json({ error: "Session slot not found" }, { status: 404 });
        }
        const sessionMembers = await prisma.sessionMember.findMany({
          where: {
            session: { recurringSlotId: slotId! },
          },
          select: { userId: true },
          distinct: ["userId"],
        });
        recipientIds = sessionMembers.map((sm) => sm.userId);
        break;
      }
      case "PAYMENT_STATUS": {
        const users = await prisma.user.findMany({
          where: { role: "MEMBER", status: { in: ["ACTIVE", "TRIAL"] } },
          select: {
            id: true,
            status: true,
            trialEndsAt: true,
            departedAt: true,
            overrideActive: true,
            payments: {
              select: { periodStart: true, periodEnd: true, paidAt: true },
            },
          },
        });
        const today = new Date();
        recipientIds = users
          .filter((u) => {
            const computed = getPaymentStatus(u, u.payments, today);
            return computed === paymentStatus!;
          })
          .map((u) => u.id);
        break;
      }
      case "INDIVIDUAL": {
        // Validate that the provided member IDs exist and are active members
        const users = await prisma.user.findMany({
          where: {
            id: { in: memberIds! },
            role: "MEMBER",
            status: { in: ["ACTIVE", "TRIAL"] },
          },
          select: { id: true },
        });
        recipientIds = users.map((u) => u.id);
        break;
      }
    }

    // Dispatch notifications
    const notifications = await dispatchNotificationToMany(
      recipientIds,
      "MANUAL_REMINDER",
      title,
      messageBody
    );

    return Response.json({ data: { sentCount: notifications.length } });
  } catch (error) {
    console.error("Broadcast notification error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Step 2: Run tests to verify they pass**

Run: `npm test -- app/api/__tests__/broadcast-notifications.test.ts`
Expected: POST tests PASS

**Step 3: Commit**

```
feat: implement broadcast notification send endpoint
```

---

### Task 4: Implement the recipients count endpoint

**Files:**
- Create: `app/api/notifications/broadcast/recipients/route.ts`

**Step 1: Write the route handler**

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPaymentStatus } from "@/lib/payment-logic";
import { BroadcastRecipientsQuerySchema } from "@/types";
import { authReadLimiter, createRateLimitResponse } from "@/lib/rate-limit";

export async function GET(req: Request): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const rateLimitResult = authReadLimiter.check(`read:${session.user.id}`);
    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(rateLimitResult.retryAfterMs);
    }

    const { searchParams } = new URL(req.url);
    const queryObj = Object.fromEntries(searchParams.entries());
    const parsed = BroadcastRecipientsQuerySchema.safeParse(queryObj);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { audience, slotId, paymentStatus } = parsed.data;
    let members: { id: string; name: string }[] = [];

    switch (audience) {
      case "ALL": {
        members = await prisma.user.findMany({
          where: { role: "MEMBER", status: { in: ["ACTIVE", "TRIAL"] } },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        });
        break;
      }
      case "TRIAL": {
        members = await prisma.user.findMany({
          where: { role: "MEMBER", status: "TRIAL" },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        });
        break;
      }
      case "SESSION_SLOT": {
        if (!slotId) {
          return Response.json({ error: "slotId is required for SESSION_SLOT audience" }, { status: 400 });
        }
        const sessionMembers = await prisma.sessionMember.findMany({
          where: { session: { recurringSlotId: slotId } },
          select: { user: { select: { id: true, name: true } } },
          distinct: ["userId"],
        });
        members = sessionMembers.map((sm) => sm.user);
        break;
      }
      case "PAYMENT_STATUS": {
        if (!paymentStatus) {
          return Response.json({ error: "paymentStatus is required for PAYMENT_STATUS audience" }, { status: 400 });
        }
        const users = await prisma.user.findMany({
          where: { role: "MEMBER", status: { in: ["ACTIVE", "TRIAL"] } },
          select: {
            id: true,
            name: true,
            status: true,
            trialEndsAt: true,
            departedAt: true,
            overrideActive: true,
            payments: {
              select: { periodStart: true, periodEnd: true, paidAt: true },
            },
          },
          orderBy: { name: "asc" },
        });
        const today = new Date();
        members = users
          .filter((u) => getPaymentStatus(u, u.payments, today) === paymentStatus)
          .map((u) => ({ id: u.id, name: u.name }));
        break;
      }
      case "INDIVIDUAL": {
        // Return all active members for the checklist
        members = await prisma.user.findMany({
          where: { role: "MEMBER", status: { in: ["ACTIVE", "TRIAL"] } },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        });
        break;
      }
    }

    return Response.json({ data: { count: members.length, members } });
  } catch (error) {
    console.error("Broadcast recipients error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Step 2: Run tests to verify they pass**

Run: `npm test -- app/api/__tests__/broadcast-notifications.test.ts`
Expected: ALL tests PASS

**Step 3: Commit**

```
feat: implement broadcast recipients count endpoint
```

---

### Task 5: Build the SendNotificationModal component

**Files:**
- Create: `components/notification/SendNotificationModal.tsx`

**Step 1: Write the modal component**

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { useToast } from "@/components/ui/Toast";
import { useRouter } from "next/navigation";
import { MAX_BROADCAST_TITLE_LENGTH, MAX_BROADCAST_BODY_LENGTH } from "@/lib/constants";
import { DAY_NAMES } from "@/lib/constants";

type AudienceType = "ALL" | "TRIAL" | "SESSION_SLOT" | "PAYMENT_STATUS" | "INDIVIDUAL";

interface RecurringSlotOption {
  id: string;
  dayOfWeek: number;
  startHour: number;
}

interface MemberOption {
  id: string;
  name: string;
}

interface SendNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  recurringSlots: RecurringSlotOption[];
}

export function SendNotificationModal({
  isOpen,
  onClose,
  recurringSlots,
}: SendNotificationModalProps): React.ReactElement | null {
  const router = useRouter();
  const { addToast } = useToast();

  const [audience, setAudience] = useState<AudienceType>("ALL");
  const [slotId, setSlotId] = useState<string>("");
  const [paymentStatus, setPaymentStatus] = useState<"GRACE_PERIOD" | "LOCKED">("GRACE_PERIOD");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [memberSearch, setMemberSearch] = useState("");

  const [recipientCount, setRecipientCount] = useState<number>(0);
  const [allMembers, setAllMembers] = useState<MemberOption[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sending, setSending] = useState(false);

  // Fetch recipient count when audience/params change
  const fetchRecipients = useCallback(async (): Promise<void> => {
    setLoadingRecipients(true);
    try {
      const params = new URLSearchParams({ audience });
      if (audience === "SESSION_SLOT" && slotId) {
        params.set("slotId", slotId);
      }
      if (audience === "PAYMENT_STATUS") {
        params.set("paymentStatus", paymentStatus);
      }

      const res = await fetch(`/api/notifications/broadcast/recipients?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRecipientCount(data.data.count);
        if (audience === "INDIVIDUAL") {
          setAllMembers(data.data.members);
        }
      }
    } catch {
      // Silently fail — count will show as 0
    } finally {
      setLoadingRecipients(false);
    }
  }, [audience, slotId, paymentStatus]);

  useEffect(() => {
    if (isOpen) {
      fetchRecipients();
    }
  }, [isOpen, fetchRecipients]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setAudience("ALL");
      setSlotId("");
      setPaymentStatus("GRACE_PERIOD");
      setSelectedMemberIds([]);
      setTitle("");
      setBody("");
      setMemberSearch("");
      setRecipientCount(0);
      setAllMembers([]);
    }
  }, [isOpen]);

  function toggleMember(memberId: string): void {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  }

  const effectiveCount = audience === "INDIVIDUAL" ? selectedMemberIds.length : recipientCount;
  const canSend = title.trim().length > 0 && body.trim().length > 0 && effectiveCount > 0;

  async function handleSend(): Promise<void> {
    setSending(true);
    try {
      const payload: Record<string, unknown> = {
        audience,
        title: title.trim(),
        body: body.trim(),
      };
      if (audience === "SESSION_SLOT") payload.slotId = slotId;
      if (audience === "PAYMENT_STATUS") payload.paymentStatus = paymentStatus;
      if (audience === "INDIVIDUAL") payload.memberIds = selectedMemberIds;

      const res = await fetch("/api/notifications/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        addToast({ type: "success", title: `Notification sent to ${data.data.sentCount} member${data.data.sentCount !== 1 ? "s" : ""}` });
        onClose();
        router.refresh();
      } else {
        const data = await res.json();
        addToast({ type: "error", title: data.error || "Failed to send notification" });
      }
    } catch {
      addToast({ type: "error", title: "Failed to send notification" });
    } finally {
      setSending(false);
      setShowConfirm(false);
    }
  }

  const filteredMembers = allMembers.filter((m) =>
    m.name.toLowerCase().includes(memberSearch.toLowerCase())
  );

  function formatSlotLabel(slot: RecurringSlotOption): string {
    const day = DAY_NAMES[slot.dayOfWeek] || "Unknown";
    const hour = slot.startHour.toString().padStart(2, "0") + ":00";
    return `${day} ${hour}`;
  }

  const audienceOptions: { value: AudienceType; label: string }[] = [
    { value: "ALL", label: "All active members" },
    { value: "TRIAL", label: "Trial members only" },
    { value: "SESSION_SLOT", label: "Members from a session slot" },
    { value: "PAYMENT_STATUS", label: "Members by payment status" },
    { value: "INDIVIDUAL", label: "Select specific members" },
  ];

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Send Notification" size="lg">
        <div className="space-y-5">
          {/* Audience selector */}
          <div>
            <label className="mb-2 block text-sm font-medium text-surface-200">
              Audience
            </label>
            <div className="space-y-2">
              {audienceOptions.map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-surface-700 px-4 py-2.5 transition-colors hover:border-surface-600 has-[:checked]:border-primary-500 has-[:checked]:bg-primary-900/10"
                >
                  <input
                    type="radio"
                    name="audience"
                    value={opt.value}
                    checked={audience === opt.value}
                    onChange={() => setAudience(opt.value)}
                    className="accent-primary-500"
                  />
                  <span className="text-sm text-surface-200">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Conditional: session slot picker */}
          {audience === "SESSION_SLOT" && (
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-200">
                Session Slot
              </label>
              <select
                value={slotId}
                onChange={(e) => setSlotId(e.target.value)}
                className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm text-surface-200 focus:border-primary-500 focus:outline-none"
              >
                <option value="">Select a slot...</option>
                {recurringSlots.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {formatSlotLabel(slot)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Conditional: payment status picker */}
          {audience === "PAYMENT_STATUS" && (
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-200">
                Payment Status
              </label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value as "GRACE_PERIOD" | "LOCKED")}
                className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm text-surface-200 focus:border-primary-500 focus:outline-none"
              >
                <option value="GRACE_PERIOD">Grace Period</option>
                <option value="LOCKED">Locked</option>
              </select>
            </div>
          )}

          {/* Conditional: individual member picker */}
          {audience === "INDIVIDUAL" && (
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-200">
                Select Members
              </label>
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search members..."
                className="mb-2 w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm text-surface-200 placeholder:text-surface-500 focus:border-primary-500 focus:outline-none"
              />
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-surface-700 p-2">
                {filteredMembers.length === 0 ? (
                  <p className="py-2 text-center text-xs text-surface-500">
                    {loadingRecipients ? "Loading..." : "No members found"}
                  </p>
                ) : (
                  filteredMembers.map((member) => (
                    <label
                      key={member.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-surface-200 hover:bg-surface-700"
                    >
                      <input
                        type="checkbox"
                        checked={selectedMemberIds.includes(member.id)}
                        onChange={() => toggleMember(member.id)}
                        className="accent-primary-500"
                      />
                      {member.name}
                    </label>
                  ))
                )}
              </div>
              {selectedMemberIds.length > 0 && (
                <p className="mt-1 text-xs text-surface-400">
                  {selectedMemberIds.length} selected
                </p>
              )}
            </div>
          )}

          {/* Recipient count */}
          {audience !== "INDIVIDUAL" && (
            <p className="text-sm text-surface-400">
              {loadingRecipients
                ? "Counting recipients..."
                : `Will notify ${recipientCount} member${recipientCount !== 1 ? "s" : ""}`}
            </p>
          )}

          {/* Title */}
          <div>
            <label className="mb-1 block text-sm font-medium text-surface-200">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Studio closed this Friday"
              maxLength={MAX_BROADCAST_TITLE_LENGTH}
              className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm text-surface-200 placeholder:text-surface-500 focus:border-primary-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-surface-500">
              {title.length}/{MAX_BROADCAST_TITLE_LENGTH}
            </p>
          </div>

          {/* Message body */}
          <div>
            <label className="mb-1 block text-sm font-medium text-surface-200">
              Message
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message here..."
              maxLength={MAX_BROADCAST_BODY_LENGTH}
              rows={4}
              className="w-full resize-none rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm text-surface-200 placeholder:text-surface-500 focus:border-primary-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-surface-500">
              {body.length}/{MAX_BROADCAST_BODY_LENGTH}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowConfirm(true)}
              disabled={!canSend}
            >
              Send Notification
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirmation modal */}
      <ConfirmationModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleSend}
        title="Confirm Send"
        message={`Send this notification to ${effectiveCount} member${effectiveCount !== 1 ? "s" : ""}?`}
        confirmLabel="Send"
        loading={sending}
      />
    </>
  );
}
```

**Step 2: Commit**

```
feat: build SendNotificationModal component
```

---

### Task 6: Integrate modal into the owner notifications page

**Files:**
- Modify: `components/notification/NotificationsClient.tsx` (add button + modal state)
- Modify: `app/(owner)/owner/notifications/page.tsx` (pass recurring slots data)

**Step 1: Update the server page to fetch recurring slots**

In `app/(owner)/owner/notifications/page.tsx`, add the recurring slots query and pass as prop:

After the `notifications` query (line 28), add:

```typescript
const recurringSlots = await prisma.recurringSlot.findMany({
  select: { id: true, dayOfWeek: true, startHour: true },
  orderBy: [{ dayOfWeek: "asc" }, { startHour: "asc" }],
});
```

Update the JSX to pass the new prop plus the `isOwner` flag:

```typescript
return (
  <NotificationsClient
    notifications={notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    }))}
    unreadCount={unreadCount}
    isOwner={true}
    recurringSlots={recurringSlots}
  />
);
```

**Step 2: Update NotificationsClient to accept new props and render modal**

In `components/notification/NotificationsClient.tsx`:

Add imports at the top:
```typescript
import { SendNotificationModal } from "@/components/notification/SendNotificationModal";
```

Update the props interface:
```typescript
interface RecurringSlotOption {
  id: string;
  dayOfWeek: number;
  startHour: number;
}

interface NotificationsClientProps {
  notifications: NotificationData[];
  unreadCount: number;
  isOwner?: boolean;
  recurringSlots?: RecurringSlotOption[];
}
```

Update the component function signature to destructure:
```typescript
export function NotificationsClient({
  notifications,
  unreadCount,
  isOwner = false,
  recurringSlots = [],
}: NotificationsClientProps): React.ReactElement {
```

Add state for modal:
```typescript
const [showSendModal, setShowSendModal] = useState(false);
```

In the header section (after the "Mark all read" button, around line 130), add:
```typescript
{isOwner && (
  <Button
    variant="primary"
    size="sm"
    onClick={() => setShowSendModal(true)}
  >
    Send Notification
  </Button>
)}
```

At the end of the return, before the closing `</div>`, add the modal:
```typescript
{isOwner && (
  <SendNotificationModal
    isOpen={showSendModal}
    onClose={() => setShowSendModal(false)}
    recurringSlots={recurringSlots}
  />
)}
```

**Step 3: Commit**

```
feat: integrate SendNotificationModal into owner notifications page
```

---

### Task 7: Run full verification

**Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 2: Lint**

Run: `npm run lint`
Expected: No new warnings

**Step 3: Run broadcast tests**

Run: `npm test -- app/api/__tests__/broadcast-notifications.test.ts`
Expected: ALL PASS

**Step 4: Run full test suite**

Run: `npm test`
Expected: ALL PASS (no regressions)

**Step 5: Build**

Run: `npm run build`
Expected: Build succeeds

**Step 6: Commit any fixes needed**

If any issues found, fix and commit with descriptive message.

---

### Task 8: Final commit and wrap-up

**Step 1: Verify all changes are committed**

Run: `git status`
Expected: clean working tree

**Step 2: Review commit log**

Run: `git log --oneline -10`
Verify the sequence of commits is clean and descriptive.
