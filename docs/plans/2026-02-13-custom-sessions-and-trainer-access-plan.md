# Custom Sessions & Trainer Schedule Access — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow owners and trainers to create one-off sessions at custom times, create new recurring slots, and give trainers schedule management capabilities — all from a unified 3-tab "Add Session" modal.

**Architecture:** Extend the Session model to support optional `recurringSlotId` with new `customDay`/`customStartHour` fields for one-off sessions. Update the `POST /api/sessions` route to accept both creation modes with discriminated union validation. Expand auth on session/slot creation to include TRAINER role. Redesign the CreateSessionModal with 3 tabs. Add the modal to the trainer schedule page.

**Tech Stack:** Next.js 15 (App Router), Prisma 7, Zod validation, Vitest, TypeScript strict mode.

---

## Task 1: Update Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma:92-111`

**Step 1: Update the Session model**

Make `recurringSlotId` optional, add `customDay` and `customStartHour`, add `createdById` to track who created the session, update the relation, and add a new unique constraint:

```prisma
model Session {
  id              String        @id @default(cuid())
  recurringSlotId String?
  customDay       Int?          // 1-7 (ISO day), used for one-off sessions only
  customStartHour Int?          // 7-22, used for one-off sessions only
  weekDate        DateTime      // Always the Monday of the week
  workoutTitle    String?
  workoutDetails  String?
  votingEnabled   Boolean       @default(false)
  votingDeadline  DateTime?
  status          SessionStatus @default(SCHEDULED)
  createdById     String?
  createdAt       DateTime      @default(now())

  // Relations
  recurringSlot RecurringSlot?   @relation(fields: [recurringSlotId], references: [id])
  createdBy     User?            @relation("CreatedSessions", fields: [createdById], references: [id])
  members       SessionMember[]
  trainers      SessionTrainer[]
  votes         Vote[]

  @@unique([recurringSlotId, weekDate])
  @@unique([weekDate, customDay, customStartHour])
  @@map("sessions")
}
```

Also add the reverse relation on User model (after line 73):
```prisma
  createdSessions  Session[]    @relation("CreatedSessions")
```

**Step 2: Generate migration and client**

Run:
```bash
npx prisma migrate dev --name add-custom-session-fields
```
Expected: Migration created and applied. Prisma client regenerated.

**Step 3: Verify**

Run:
```bash
npx prisma generate
```
Expected: Prisma client regenerated at `@/generated/prisma/client` without errors.

**Step 4: Commit**

```bash
git add prisma/
git commit -m "feat: add customDay, customStartHour, createdById to Session model"
```

---

## Task 2: Update Zod Schemas and Types

**Files:**
- Modify: `types/index.ts:81-86`

**Step 1: Write failing tests for new schema validation**

Create test file `types/__tests__/session-schemas.test.ts`:

```typescript
/**
 * Session Schema Validation Tests
 *
 * Tests the SessionCreateSchema discriminated union:
 * - Recurring mode: { recurringSlotId, weekDate }
 * - One-off mode: { customDay, customStartHour, weekDate }
 * - Invalid: both set, neither set, out-of-range values
 */

import { describe, it, expect } from "vitest";
import {
  SessionCreateSchema,
  OneOffSessionCreateSchema,
} from "@/types";

describe("SessionCreateSchema (recurring mode)", () => {
  it("accepts valid recurring session input", () => {
    const result = SessionCreateSchema.safeParse({
      recurringSlotId: "cm1234567890abcdef",
      weekDate: "2025-03-10",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing weekDate", () => {
    const result = SessionCreateSchema.safeParse({
      recurringSlotId: "cm1234567890abcdef",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid recurringSlotId format", () => {
    const result = SessionCreateSchema.safeParse({
      recurringSlotId: "not-a-cuid",
      weekDate: "2025-03-10",
    });
    expect(result.success).toBe(false);
  });
});

describe("OneOffSessionCreateSchema", () => {
  it("accepts valid one-off session input", () => {
    const result = OneOffSessionCreateSchema.safeParse({
      customDay: 3,
      customStartHour: 14,
      weekDate: "2025-03-10",
    });
    expect(result.success).toBe(true);
  });

  it("rejects customDay < 1", () => {
    const result = OneOffSessionCreateSchema.safeParse({
      customDay: 0,
      customStartHour: 14,
      weekDate: "2025-03-10",
    });
    expect(result.success).toBe(false);
  });

  it("rejects customDay > 7", () => {
    const result = OneOffSessionCreateSchema.safeParse({
      customDay: 8,
      customStartHour: 14,
      weekDate: "2025-03-10",
    });
    expect(result.success).toBe(false);
  });

  it("rejects customStartHour < 7", () => {
    const result = OneOffSessionCreateSchema.safeParse({
      customDay: 1,
      customStartHour: 6,
      weekDate: "2025-03-10",
    });
    expect(result.success).toBe(false);
  });

  it("rejects customStartHour > 22", () => {
    const result = OneOffSessionCreateSchema.safeParse({
      customDay: 1,
      customStartHour: 23,
      weekDate: "2025-03-10",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing customDay", () => {
    const result = OneOffSessionCreateSchema.safeParse({
      customStartHour: 14,
      weekDate: "2025-03-10",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing customStartHour", () => {
    const result = OneOffSessionCreateSchema.safeParse({
      customDay: 3,
      weekDate: "2025-03-10",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer customDay", () => {
    const result = OneOffSessionCreateSchema.safeParse({
      customDay: 1.5,
      customStartHour: 14,
      weekDate: "2025-03-10",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer customStartHour", () => {
    const result = OneOffSessionCreateSchema.safeParse({
      customDay: 1,
      customStartHour: 9.5,
      weekDate: "2025-03-10",
    });
    expect(result.success).toBe(false);
  });

  it("accepts boundary values customDay=1, customStartHour=7", () => {
    const result = OneOffSessionCreateSchema.safeParse({
      customDay: 1,
      customStartHour: 7,
      weekDate: "2025-03-10",
    });
    expect(result.success).toBe(true);
  });

  it("accepts boundary values customDay=7, customStartHour=22", () => {
    const result = OneOffSessionCreateSchema.safeParse({
      customDay: 7,
      customStartHour: 22,
      weekDate: "2025-03-10",
    });
    expect(result.success).toBe(true);
  });
});
```

**Step 2: Run tests — should fail (schemas don't exist yet)**

Run: `npx vitest run types/__tests__/session-schemas.test.ts`
Expected: FAIL — `OneOffSessionCreateSchema` not exported.

**Step 3: Add the new schema to types/index.ts**

Add after the existing `SessionCreateSchema` (line 86):

```typescript
export const OneOffSessionCreateSchema = z.object({
  customDay: z.number().int().min(1).max(7, 'Day of week must be 1-7'),
  customStartHour: z.number().int().min(7).max(22, 'Start hour must be 7-22'),
  weekDate: z.string().date('Invalid date format'),
});

export type OneOffSessionCreateInput = z.infer<typeof OneOffSessionCreateSchema>;
```

Note: `SessionCreateSchema` stays unchanged for the recurring mode. The API route will try parsing against each schema to determine the mode.

**Step 4: Run tests — should pass**

Run: `npx vitest run types/__tests__/session-schemas.test.ts`
Expected: All 12 tests PASS.

**Step 5: Commit**

```bash
git add types/
git commit -m "feat: add OneOffSessionCreateSchema for custom session validation"
```

---

## Task 3: Update `POST /api/sessions` to Support Both Modes + Trainer Auth

**Files:**
- Modify: `app/api/sessions/route.ts:41-115`

**Step 1: Write failing tests for new functionality**

Add to `app/api/__tests__/sessions.test.ts` — new describe blocks:

```typescript
// ===== POST /api/sessions — One-Off Sessions =====

describe("POST /api/sessions — one-off sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates one-off session with customDay and customStartHour", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findFirst.mockResolvedValue(null); // no duplicate
    mockPrisma.session.create.mockResolvedValue({
      id: "oneoff-1",
      recurringSlotId: null,
      customDay: 3,
      customStartHour: 14,
      status: "SCHEDULED",
      votingEnabled: false,
      createdById: "owner-1",
    });

    const { POST } = await import("@/app/api/sessions/route");
    const response = await POST(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customDay: 3,
          customStartHour: 14,
          weekDate: "2025-03-10",
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.customDay).toBe(3);
    expect(body.data.customStartHour).toBe(14);
    expect(body.data.recurringSlotId).toBeNull();
  });

  it("returns 409 when one-off session already exists at same day/hour/week", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findFirst.mockResolvedValue({ id: "existing-oneoff" });

    const { POST } = await import("@/app/api/sessions/route");
    const response = await POST(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customDay: 3,
          customStartHour: 14,
          weekDate: "2025-03-10",
        }),
      })
    );

    expect(response.status).toBe(409);
  });

  it("returns 409 when one-off conflicts with recurring session at same day/hour/week", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    // A recurring session exists at the same time
    mockPrisma.session.findFirst.mockResolvedValue({
      id: "existing-recurring",
      recurringSlotId: "slot-1",
    });

    const { POST } = await import("@/app/api/sessions/route");
    const response = await POST(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customDay: 1,
          customStartHour: 9,
          weekDate: "2025-03-10",
        }),
      })
    );

    expect(response.status).toBe(409);
  });

  it("rejects customDay out of range", async () => {
    mockAuth.mockResolvedValue(ownerSession());

    const { POST } = await import("@/app/api/sessions/route");
    const response = await POST(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customDay: 8,
          customStartHour: 14,
          weekDate: "2025-03-10",
        }),
      })
    );

    expect(response.status).toBe(400);
  });

  it("rejects customStartHour out of range", async () => {
    mockAuth.mockResolvedValue(ownerSession());

    const { POST } = await import("@/app/api/sessions/route");
    const response = await POST(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customDay: 3,
          customStartHour: 23,
          weekDate: "2025-03-10",
        }),
      })
    );

    expect(response.status).toBe(400);
  });

  it("rejects body with both recurringSlotId AND custom fields", async () => {
    mockAuth.mockResolvedValue(ownerSession());

    const { POST } = await import("@/app/api/sessions/route");
    const response = await POST(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recurringSlotId: "cm1234567890abcdef",
          customDay: 3,
          customStartHour: 14,
          weekDate: "2025-03-10",
        }),
      })
    );

    expect(response.status).toBe(400);
  });

  it("rejects body with neither recurringSlotId nor custom fields", async () => {
    mockAuth.mockResolvedValue(ownerSession());

    const { POST } = await import("@/app/api/sessions/route");
    const response = await POST(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekDate: "2025-03-10",
        }),
      })
    );

    expect(response.status).toBe(400);
  });
});

// ===== POST /api/sessions — Trainer Auth =====

describe("POST /api/sessions — trainer access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows TRAINER to create a recurring session", async () => {
    mockAuth.mockResolvedValue(trainerSession());
    mockPrisma.recurringSlot.findUnique.mockResolvedValue({
      id: "cm1234567890abcdef",
      dayOfWeek: 1,
      startHour: 9,
    });
    mockPrisma.session.findUnique.mockResolvedValue(null);
    mockPrisma.session.create.mockResolvedValue({
      id: "new-session",
      recurringSlotId: "cm1234567890abcdef",
      status: "SCHEDULED",
      votingEnabled: false,
      createdById: "trainer-1",
      recurringSlot: { id: "cm1234567890abcdef", dayOfWeek: 1, startHour: 9 },
    });
    mockPrisma.sessionTrainer = { create: vi.fn().mockResolvedValue({}) };

    const { POST } = await import("@/app/api/sessions/route");
    const response = await POST(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recurringSlotId: "cm1234567890abcdef",
          weekDate: "2025-03-10",
        }),
      })
    );

    expect(response.status).toBe(201);
  });

  it("allows TRAINER to create a one-off session", async () => {
    mockAuth.mockResolvedValue(trainerSession());
    mockPrisma.session.findFirst.mockResolvedValue(null);
    mockPrisma.session.create.mockResolvedValue({
      id: "oneoff-trainer",
      customDay: 5,
      customStartHour: 16,
      recurringSlotId: null,
      status: "SCHEDULED",
      createdById: "trainer-1",
    });
    mockPrisma.sessionTrainer = { create: vi.fn().mockResolvedValue({}) };

    const { POST } = await import("@/app/api/sessions/route");
    const response = await POST(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customDay: 5,
          customStartHour: 16,
          weekDate: "2025-03-10",
        }),
      })
    );

    expect(response.status).toBe(201);
  });

  it("auto-assigns trainer to session they create", async () => {
    mockAuth.mockResolvedValue(trainerSession("trainer-1"));
    mockPrisma.session.findFirst.mockResolvedValue(null);
    const createdSession = {
      id: "oneoff-trainer",
      customDay: 5,
      customStartHour: 16,
      recurringSlotId: null,
      status: "SCHEDULED",
      createdById: "trainer-1",
    };
    mockPrisma.session.create.mockResolvedValue(createdSession);
    mockPrisma.sessionTrainer = { create: vi.fn().mockResolvedValue({}) };

    const { POST } = await import("@/app/api/sessions/route");
    await POST(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customDay: 5,
          customStartHour: 16,
          weekDate: "2025-03-10",
        }),
      })
    );

    expect(mockPrisma.sessionTrainer.create).toHaveBeenCalledWith({
      data: {
        sessionId: "oneoff-trainer",
        userId: "trainer-1",
      },
    });
  });

  it("still rejects MEMBER role", async () => {
    mockAuth.mockResolvedValue(memberSession());

    const { POST } = await import("@/app/api/sessions/route");
    const response = await POST(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customDay: 3,
          customStartHour: 14,
          weekDate: "2025-03-10",
        }),
      })
    );

    expect(response.status).toBe(403);
  });
});
```

**Step 2: Run tests — should fail**

Run: `npx vitest run app/api/__tests__/sessions.test.ts`
Expected: New tests FAIL (POST still rejects trainers, no one-off support).

**Step 3: Implement the updated POST handler**

Rewrite `app/api/sessions/route.ts` POST handler:

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSessionsForWeek, getWeekStart, getSessionDateTime, calculateVotingDeadline } from "@/lib/session-generation";
import { SessionCreateSchema, OneOffSessionCreateSchema } from "@/types";
import type { UserRole } from "@/lib/constants";

// ... GET handler stays the same ...

export async function POST(req: Request): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role as string;
    if (role !== "OWNER" && role !== "TRAINER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();

    // Determine mode: recurring (has recurringSlotId) vs one-off (has customDay+customStartHour)
    const hasSlotId = "recurringSlotId" in body && body.recurringSlotId;
    const hasCustom = "customDay" in body || "customStartHour" in body;

    // Reject ambiguous: both or neither
    if (hasSlotId && hasCustom) {
      return Response.json(
        { error: "Cannot specify both recurringSlotId and custom day/hour" },
        { status: 400 }
      );
    }
    if (!hasSlotId && !hasCustom) {
      return Response.json(
        { error: "Must specify either recurringSlotId or customDay and customStartHour" },
        { status: 400 }
      );
    }

    if (hasSlotId) {
      // === RECURRING MODE ===
      const parsed = SessionCreateSchema.safeParse(body);
      if (!parsed.success) {
        return Response.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      const { recurringSlotId, weekDate } = parsed.data;
      const slot = await prisma.recurringSlot.findUnique({
        where: { id: recurringSlotId },
      });
      if (!slot) {
        return Response.json({ error: "Recurring slot not found" }, { status: 404 });
      }

      const normalizedWeekDate = getWeekStart(new Date(weekDate));

      const existing = await prisma.session.findUnique({
        where: {
          recurringSlotId_weekDate: { recurringSlotId, weekDate: normalizedWeekDate },
        },
      });
      if (existing) {
        return Response.json(
          { error: "Session already exists for this slot and week" },
          { status: 409 }
        );
      }

      const sessionDateTime = getSessionDateTime(normalizedWeekDate, slot.dayOfWeek, slot.startHour);
      const votingDeadline = calculateVotingDeadline(sessionDateTime);

      const newSession = await prisma.session.create({
        data: {
          recurringSlotId,
          weekDate: normalizedWeekDate,
          votingDeadline,
          status: "SCHEDULED",
          votingEnabled: false,
          createdById: session.user.id,
        },
        include: { recurringSlot: true },
      });

      // Auto-assign trainer if created by a trainer
      if (role === "TRAINER") {
        await prisma.sessionTrainer.create({
          data: { sessionId: newSession.id, userId: session.user.id },
        });
      }

      return Response.json({ data: newSession }, { status: 201 });
    } else {
      // === ONE-OFF MODE ===
      const parsed = OneOffSessionCreateSchema.safeParse(body);
      if (!parsed.success) {
        return Response.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      const { customDay, customStartHour, weekDate } = parsed.data;
      const normalizedWeekDate = getWeekStart(new Date(weekDate));

      // Check for any session (recurring or one-off) at the same day/hour/week
      const conflict = await prisma.session.findFirst({
        where: {
          weekDate: normalizedWeekDate,
          OR: [
            { customDay, customStartHour },
            {
              recurringSlot: {
                dayOfWeek: customDay,
                startHour: customStartHour,
              },
            },
          ],
        },
      });
      if (conflict) {
        return Response.json(
          { error: "A session already exists at this day and time for this week" },
          { status: 409 }
        );
      }

      const sessionDateTime = getSessionDateTime(normalizedWeekDate, customDay, customStartHour);
      const votingDeadline = calculateVotingDeadline(sessionDateTime);

      const newSession = await prisma.session.create({
        data: {
          customDay,
          customStartHour,
          weekDate: normalizedWeekDate,
          votingDeadline,
          status: "SCHEDULED",
          votingEnabled: false,
          createdById: session.user.id,
        },
      });

      // Auto-assign trainer if created by a trainer
      if (role === "TRAINER") {
        await prisma.sessionTrainer.create({
          data: { sessionId: newSession.id, userId: session.user.id },
        });
      }

      return Response.json({ data: newSession }, { status: 201 });
    }
  } catch (error) {
    console.error("POST /api/sessions error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Step 4: Update mock setup in sessions.test.ts**

Add `sessionTrainer` and `session.findFirst` to the mock setup (top of test file):

```typescript
const mockPrisma = {
  recurringSlot: {
    findUnique: vi.fn(),
  },
  session: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  sessionTrainer: {
    create: vi.fn(),
  },
};
```

**Step 5: Run tests — should pass**

Run: `npx vitest run app/api/__tests__/sessions.test.ts`
Expected: All tests PASS (old + new).

**Step 6: Commit**

```bash
git add app/api/sessions/route.ts app/api/__tests__/sessions.test.ts
git commit -m "feat: support one-off sessions and trainer auth in POST /api/sessions"
```

---

## Task 4: Update `POST /api/recurring-slots` for Trainer Auth

**Files:**
- Modify: `app/api/recurring-slots/route.ts:46-93`

**Step 1: Write failing tests**

Create `app/api/__tests__/recurring-slots.test.ts`:

```typescript
/**
 * Recurring Slots API Tests
 *
 * Tests for POST /api/recurring-slots — trainer access, validation, duplicates.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

const mockPrisma = {
  recurringSlot: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
};
vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

function ownerSession() {
  return { user: { id: "owner-1", role: "OWNER" } };
}
function trainerSession() {
  return { user: { id: "trainer-1", role: "TRAINER" } };
}
function memberSession() {
  return { user: { id: "member-1", role: "MEMBER" } };
}

describe("POST /api/recurring-slots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { POST } = await import("@/app/api/recurring-slots/route");
    const response = await POST(
      new Request("http://localhost/api/recurring-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayOfWeek: 1, startHour: 9 }),
      })
    );

    expect(response.status).toBe(401);
  });

  it("allows OWNER to create a slot", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.recurringSlot.findUnique.mockResolvedValue(null);
    mockPrisma.recurringSlot.create.mockResolvedValue({
      id: "slot-1",
      dayOfWeek: 1,
      startHour: 9,
    });

    const { POST } = await import("@/app/api/recurring-slots/route");
    const response = await POST(
      new Request("http://localhost/api/recurring-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayOfWeek: 1, startHour: 9 }),
      })
    );

    expect(response.status).toBe(201);
  });

  it("allows TRAINER to create a slot", async () => {
    mockAuth.mockResolvedValue(trainerSession());
    mockPrisma.recurringSlot.findUnique.mockResolvedValue(null);
    mockPrisma.recurringSlot.create.mockResolvedValue({
      id: "slot-2",
      dayOfWeek: 2,
      startHour: 10,
    });

    const { POST } = await import("@/app/api/recurring-slots/route");
    const response = await POST(
      new Request("http://localhost/api/recurring-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayOfWeek: 2, startHour: 10 }),
      })
    );

    expect(response.status).toBe(201);
  });

  it("rejects MEMBER role", async () => {
    mockAuth.mockResolvedValue(memberSession());

    const { POST } = await import("@/app/api/recurring-slots/route");
    const response = await POST(
      new Request("http://localhost/api/recurring-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayOfWeek: 1, startHour: 9 }),
      })
    );

    expect(response.status).toBe(403);
  });

  it("returns 409 for duplicate slot", async () => {
    mockAuth.mockResolvedValue(trainerSession());
    mockPrisma.recurringSlot.findUnique.mockResolvedValue({
      id: "existing",
      dayOfWeek: 1,
      startHour: 9,
    });

    const { POST } = await import("@/app/api/recurring-slots/route");
    const response = await POST(
      new Request("http://localhost/api/recurring-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayOfWeek: 1, startHour: 9 }),
      })
    );

    expect(response.status).toBe(409);
  });

  it("rejects invalid dayOfWeek", async () => {
    mockAuth.mockResolvedValue(ownerSession());

    const { POST } = await import("@/app/api/recurring-slots/route");
    const response = await POST(
      new Request("http://localhost/api/recurring-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayOfWeek: 8, startHour: 9 }),
      })
    );

    expect(response.status).toBe(400);
  });

  it("rejects invalid startHour", async () => {
    mockAuth.mockResolvedValue(ownerSession());

    const { POST } = await import("@/app/api/recurring-slots/route");
    const response = await POST(
      new Request("http://localhost/api/recurring-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayOfWeek: 1, startHour: 23 }),
      })
    );

    expect(response.status).toBe(400);
  });
});

describe("GET /api/recurring-slots — trainer access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows TRAINER to list slots", async () => {
    mockAuth.mockResolvedValue(trainerSession());
    mockPrisma.recurringSlot.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/recurring-slots/route");
    const response = await GET();

    expect(response.status).toBe(200);
  });
});

describe("DELETE /api/recurring-slots — owner only", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects TRAINER for DELETE", async () => {
    mockAuth.mockResolvedValue(trainerSession());

    const { DELETE } = await import("@/app/api/recurring-slots/route");
    const response = await DELETE(
      new Request("http://localhost/api/recurring-slots", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "slot-1" }),
      })
    );

    expect(response.status).toBe(403);
  });
});
```

**Step 2: Run tests — should fail**

Run: `npx vitest run app/api/__tests__/recurring-slots.test.ts`
Expected: FAIL — trainer gets 403 on POST and GET.

**Step 3: Update the recurring-slots route**

Change auth checks in `app/api/recurring-slots/route.ts`:
- **GET**: allow OWNER and TRAINER
- **POST**: allow OWNER and TRAINER
- **DELETE**: keep OWNER only

For GET (line 23-25), change:
```typescript
    if ((session.user.role as string) !== "OWNER") {
```
to:
```typescript
    const role = session.user.role as string;
    if (role !== "OWNER" && role !== "TRAINER") {
```

For POST (line 53-55), same change.

DELETE stays as-is (OWNER only).

**Step 4: Run tests — should pass**

Run: `npx vitest run app/api/__tests__/recurring-slots.test.ts`
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add app/api/recurring-slots/route.ts app/api/__tests__/recurring-slots.test.ts
git commit -m "feat: allow trainers to create recurring slots and list them"
```

---

## Task 5: Update `SessionWithDetails` Type and `getSessionsForWeek`

**Files:**
- Modify: `lib/session-generation.ts:149-241`

**Step 1: Update the `SessionWithDetails` type**

The `recurringSlot` field becomes optional (null for one-off sessions). Add `customDay`, `customStartHour`, `createdById`:

```typescript
export type SessionWithDetails = Omit<Session, 'recurringSlotId'> & {
  recurringSlotId: string | null;
  customDay: number | null;
  customStartHour: number | null;
  createdById: string | null;
  recurringSlot: RecurringSlot | null;
  members: Array<{
    sessionId: string;
    userId: string;
    user: {
      id: string;
      name: string;
      email: string;
      status: string;
    };
  }>;
  trainers: Array<{
    sessionId: string;
    userId: string;
    user: {
      id: string;
      name: string;
      email: string;
    };
  }>;
  votes: Array<{
    id: string;
    userId: string;
    attending: boolean;
    votedAt: Date;
  }>;
};
```

**Step 2: Update `getSessionsForWeek` ordering**

The current `orderBy` uses `recurringSlot.dayOfWeek` and `recurringSlot.startHour`. For one-off sessions with `recurringSlot: null`, this will push them to the end or cause issues. Update the query to handle both types.

Since Prisma doesn't support conditional ordering easily, we'll order by `createdAt` as a fallback and sort in application code:

```typescript
export async function getSessionsForWeek(
  weekDate: Date,
  userId?: string,
  role?: UserRole
): Promise<SessionWithDetails[]> {
  const normalizedWeekDate = getWeekStart(weekDate);

  const sessions = await prisma.session.findMany({
    where: {
      weekDate: normalizedWeekDate,
      ...(role === 'MEMBER' && userId
        ? { members: { some: { userId } } }
        : {}),
      ...(role === 'TRAINER' && userId
        ? { trainers: { some: { userId } } }
        : {}),
    },
    include: {
      recurringSlot: true,
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              status: true,
            },
          },
        },
      },
      trainers: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      votes: {
        select: {
          id: true,
          userId: true,
          attending: true,
          votedAt: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Sort in application code: by day then by hour
  // For recurring sessions: use slot's dayOfWeek/startHour
  // For one-off sessions: use customDay/customStartHour
  sessions.sort((a, b) => {
    const dayA = a.recurringSlot?.dayOfWeek ?? a.customDay ?? 0;
    const dayB = b.recurringSlot?.dayOfWeek ?? b.customDay ?? 0;
    if (dayA !== dayB) return dayA - dayB;
    const hourA = a.recurringSlot?.startHour ?? a.customStartHour ?? 0;
    const hourB = b.recurringSlot?.startHour ?? b.customStartHour ?? 0;
    return hourA - hourB;
  });

  return sessions as SessionWithDetails[];
}
```

**Step 3: Add tests for sorting**

Add to `lib/__tests__/session-generation.test.ts`:

```typescript
import { getSessionDayAndHour } from "../session-generation";

describe("getSessionDayAndHour", () => {
  it("returns recurringSlot day/hour for recurring sessions", () => {
    const session = {
      recurringSlot: { dayOfWeek: 3, startHour: 14 },
      customDay: null,
      customStartHour: null,
    };
    expect(getSessionDayAndHour(session as any)).toEqual({ day: 3, hour: 14 });
  });

  it("returns customDay/customStartHour for one-off sessions", () => {
    const session = {
      recurringSlot: null,
      customDay: 5,
      customStartHour: 16,
    };
    expect(getSessionDayAndHour(session as any)).toEqual({ day: 5, hour: 16 });
  });

  it("falls back to 0/0 when no data", () => {
    const session = {
      recurringSlot: null,
      customDay: null,
      customStartHour: null,
    };
    expect(getSessionDayAndHour(session as any)).toEqual({ day: 0, hour: 0 });
  });
});
```

**Step 4: Export the helper function from session-generation.ts**

```typescript
/**
 * Get the effective day and hour for a session,
 * whether it's recurring (from slot) or one-off (custom fields).
 */
export function getSessionDayAndHour(
  session: { recurringSlot?: { dayOfWeek: number; startHour: number } | null; customDay?: number | null; customStartHour?: number | null }
): { day: number; hour: number } {
  return {
    day: session.recurringSlot?.dayOfWeek ?? session.customDay ?? 0,
    hour: session.recurringSlot?.startHour ?? session.customStartHour ?? 0,
  };
}
```

**Step 5: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS.

**Step 6: Commit**

```bash
git add lib/session-generation.ts lib/__tests__/session-generation.test.ts
git commit -m "feat: update SessionWithDetails and getSessionsForWeek for one-off sessions"
```

---

## Task 6: Update UI Components (SessionCard, WeeklyCalendar)

**Files:**
- Modify: `components/schedule/SessionCard.tsx:19-26`
- Modify: `components/schedule/WeeklyCalendar.tsx:20-38`

**Step 1: Update SessionCard to handle null recurringSlot**

Change line 25 from:
```typescript
const time = formatTime(session.recurringSlot.startHour);
```
to:
```typescript
const time = formatTime(session.recurringSlot?.startHour ?? session.customStartHour ?? 0);
```

**Step 2: Update WeeklyCalendar `groupSessionsByDay`**

Change line 25 from:
```typescript
const day = session.recurringSlot.dayOfWeek;
```
to:
```typescript
const day = session.recurringSlot?.dayOfWeek ?? session.customDay ?? 1;
```

Change lines 33-34 (sort within day) from:
```typescript
daySessions.sort((a, b) => a.recurringSlot.startHour - b.recurringSlot.startHour)
```
to:
```typescript
daySessions.sort((a, b) => {
  const hourA = a.recurringSlot?.startHour ?? a.customStartHour ?? 0;
  const hourB = b.recurringSlot?.startHour ?? b.customStartHour ?? 0;
  return hourA - hourB;
})
```

**Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: No type errors.

**Step 4: Commit**

```bash
git add components/schedule/SessionCard.tsx components/schedule/WeeklyCalendar.tsx
git commit -m "feat: update SessionCard and WeeklyCalendar for one-off sessions"
```

---

## Task 7: Redesign CreateSessionModal with 3 Tabs

**Files:**
- Modify: `components/schedule/CreateSessionModal.tsx`

**Step 1: Rewrite the modal with tab-based UI**

Replace the entire file. The new modal has:
1. Tab navigation: "Existing Slot" | "One-Off" | "New Recurring"
2. Existing Slot tab: same dropdown as before
3. One-Off tab: Day + Hour dropdowns, creates session with customDay/customStartHour
4. New Recurring tab: Day + Hour dropdowns, creates slot via `/api/recurring-slots` first, then session via `/api/sessions`

Key props change: add `existingSessions` (the full session list for conflict detection in the UI) alongside `existingSlotIds`.

Update the `CreateSessionModalProps` interface:
```typescript
interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  weekStart: Date;
  recurringSlots: SlotInfo[];
  existingSlotIds: string[];
  existingSessions: Array<{
    recurringSlot?: { dayOfWeek: number; startHour: number } | null;
    customDay?: number | null;
    customStartHour?: number | null;
  }>;
}
```

The implementation code should use `DAY_NAMES` and `SLOT_START_HOUR`/`SLOT_END_HOUR` from constants for the dropdowns.

**Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: No type errors.

**Step 3: Commit**

```bash
git add components/schedule/CreateSessionModal.tsx
git commit -m "feat: redesign CreateSessionModal with 3 tabs (existing, one-off, recurring)"
```

---

## Task 8: Update Owner ScheduleClient to Pass New Props

**Files:**
- Modify: `app/(owner)/owner/schedule/ScheduleClient.tsx:38,176-186`

**Step 1: Update existingSlotIds computation**

Change line 38 from:
```typescript
const existingSlotIds = sessions.map((s) => s.recurringSlotId);
```
to:
```typescript
const existingSlotIds = sessions
  .filter((s) => s.recurringSlotId != null)
  .map((s) => s.recurringSlotId as string);
```

**Step 2: Pass `existingSessions` to the modal**

Add the new prop to the CreateSessionModal invocation:
```typescript
<CreateSessionModal
  isOpen={showCreateModal}
  onClose={() => setShowCreateModal(false)}
  onCreated={() => {
    setShowCreateModal(false);
    fetchSessions();
  }}
  weekStart={weekStart}
  recurringSlots={recurringSlots}
  existingSlotIds={existingSlotIds}
  existingSessions={sessions}
/>
```

**Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: No type errors.

**Step 4: Commit**

```bash
git add app/(owner)/owner/schedule/ScheduleClient.tsx
git commit -m "feat: pass existingSessions to CreateSessionModal in owner schedule"
```

---

## Task 9: Add Schedule Management to Trainer Page

**Files:**
- Modify: `app/(trainer)/my-schedule/page.tsx`
- Modify: `app/(trainer)/my-schedule/TrainerScheduleClient.tsx`

**Step 1: Update trainer page server component to fetch recurring slots**

```typescript
import { prisma } from "@/lib/prisma";

// Add after auth check:
const recurringSlots = await prisma.recurringSlot.findMany({
  orderBy: [{ dayOfWeek: "asc" }, { startHour: "asc" }],
});

// Pass to client:
<TrainerScheduleClient
  initialWeekStart={weekStart.toISOString()}
  userId={session.user.id}
  recurringSlots={recurringSlots.map((s) => ({
    id: s.id,
    dayOfWeek: s.dayOfWeek,
    startHour: s.startHour,
    trainerName: null,
  }))}
/>
```

**Step 2: Update TrainerScheduleClient to include the "Add Session" button and modal**

Add to props interface:
```typescript
interface TrainerScheduleClientProps {
  initialWeekStart: string;
  userId: string;
  recurringSlots: SlotInfo[];
}
```

Add state and import for `CreateSessionModal`, `Button`. Add the "Add Session" button in the header and the modal component.

The trainer should also see ALL sessions for the week (not just their assigned ones) in the modal's conflict detection. But the calendar still only shows their assigned sessions.

Change `fetchSessions` to store all sessions separately for conflict checking:
```typescript
const [allSessions, setAllSessions] = useState<SessionWithDetails[]>([]);
const [mySessions, setMySessions] = useState<SessionWithDetails[]>([]);

// In fetchSessions:
setAllSessions(data.data);
setMySessions(data.data.filter((s) => s.trainers.some((t) => t.userId === userId)));
```

Wait — the GET endpoint already filters by role for trainers. We need trainers to see all sessions for conflict detection. Two options:
- Option A: Add a separate fetch for all sessions (needs API change)
- Option B: Pass `existingSessions` as the trainer's sessions only (good enough — server-side conflict detection via 409 handles the rest)

Go with **Option B** — the server already returns 409 for conflicts, so the modal just needs to show the trainer's sessions for UX hints. The server is the source of truth.

**Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: No type errors.

**Step 4: Commit**

```bash
git add app/(trainer)/my-schedule/page.tsx app/(trainer)/my-schedule/TrainerScheduleClient.tsx
git commit -m "feat: add session creation capability to trainer schedule page"
```

---

## Task 10: Run Full Test Suite, Lint, Type Check

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS (~170+ tests).

**Step 2: Run linter**

Run: `npm run lint`
Expected: Only the pre-existing known warnings (see MEMORY.md).

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 4: Commit any test/lint fixes**

```bash
git add -A
git commit -m "chore: fix lint and type errors from custom sessions feature"
```

---

## Task 11: Final Integration Commit

**Step 1: Run production build**

Run: `npm run build`
Expected: Build succeeds.

**Step 2: Final commit if needed**

```bash
git add -A
git commit -m "feat: complete custom sessions and trainer schedule access"
```
