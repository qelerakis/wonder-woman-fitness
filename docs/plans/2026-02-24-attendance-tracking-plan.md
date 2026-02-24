# Attendance Tracking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add post-session attendance marking (roll-call) for owners/trainers, plus four analytics views on the dashboard.

**Architecture:** New `AttendanceRecord` model with upsert-per-member pattern. New API route at `/api/sessions/[id]/attendance` (POST + GET). New `AttendanceChecklist` client component rendered in both owner and trainer session detail pages (only after session start time). Analytics API extended with an `attendance` key. Dashboard gets a new attendance analytics section with 4 charts/tables.

**Tech Stack:** Prisma 7, Next.js 15 App Router, TypeScript strict, Zod, Tailwind CSS 4, Recharts, Vitest + React Testing Library.

---

## Task 1: Prisma Schema — Add AttendanceRecord Model

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add the AttendanceRecord model and update relations**

Add after the `Vote` model (after line ~152 in schema). Also add relation fields to `User` and `Session` models.

In the `User` model, add these two relation fields after the `createdSessions` relation:

```prisma
  attendanceRecords      AttendanceRecord[] @relation("AttendanceUser")
  markedAttendanceRecords AttendanceRecord[] @relation("AttendanceMarkedBy")
```

In the `Session` model, add this relation field after `votes`:

```prisma
  attendanceRecords AttendanceRecord[]
```

Add the new model after `Vote`:

```prisma
model AttendanceRecord {
  id         String   @id @default(cuid())
  sessionId  String
  userId     String
  present    Boolean  @default(false)
  markedById String
  markedAt   DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  session  Session @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  user     User    @relation("AttendanceUser", fields: [userId], references: [id], onDelete: Cascade)
  markedBy User    @relation("AttendanceMarkedBy", fields: [markedById], references: [id])

  @@unique([sessionId, userId])
  @@index([sessionId])
  @@map("attendance_records")
}
```

**Step 2: Generate migration**

Run: `npx prisma migrate dev --name add-attendance-record-model`
Expected: Migration created and applied successfully.

**Step 3: Verify Prisma client generates**

Run: `npx prisma generate`
Expected: `Generated Prisma Client`

**Step 4: Commit**

```bash
git add prisma/
git commit -m "feat: add AttendanceRecord model to Prisma schema"
```

---

## Task 2: Zod Schema + Types

**Files:**
- Modify: `types/index.ts`

**Step 1: Add the AttendanceSchema**

Add after the `SessionMemberAssignmentSchema` section (around line 112) in `types/index.ts`:

```typescript
// ===== ATTENDANCE SCHEMA =====

export const AttendanceMarkSchema = z.object({
  userId: z.string().cuid('Invalid user ID'),
  present: z.boolean(),
}).strict();

export type AttendanceMarkInput = z.infer<typeof AttendanceMarkSchema>;
```

**Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add types/index.ts
git commit -m "feat: add AttendanceMarkSchema to Zod types"
```

---

## Task 3: Attendance API Route — Tests

**Files:**
- Create: `app/api/__tests__/attendance.test.ts`

**Step 1: Write the test file**

Follow the exact pattern from `session-members.test.ts`. Tests needed:

```typescript
/**
 * Attendance API Tests
 *
 * POST /api/sessions/[id]/attendance — Mark/unmark member attendance
 * GET /api/sessions/[id]/attendance — Get attendance records for a session
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Standard mocks (same pattern as session-members.test.ts)
vi.mock("@/lib/rate-limit", () => ({
  publicLimiter: { check: () => ({ allowed: true, remaining: 10, retryAfterMs: 0 }) },
  authWriteLimiter: { check: () => ({ allowed: true, remaining: 10, retryAfterMs: 0 }) },
  authReadLimiter: { check: () => ({ allowed: true, remaining: 10, retryAfterMs: 0 }) },
  cronLimiter: { check: () => ({ allowed: true, remaining: 10, retryAfterMs: 0 }) },
  getClientIp: () => "127.0.0.1",
  createRateLimitResponse: () => Response.json({ error: "Rate limited" }, { status: 429 }),
}));

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));

const mockPrisma = {
  session: { findUnique: vi.fn() },
  user: { findUnique: vi.fn(), findMany: vi.fn() },
  sessionTrainer: { findUnique: vi.fn() },
  sessionMember: { findMany: vi.fn() },
  attendanceRecord: {
    upsert: vi.fn(),
    findMany: vi.fn(),
  },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// Auth session helpers
function ownerSession() {
  return { user: { id: "owner-1", email: "owner@test.com", role: "OWNER", status: "ACTIVE" } };
}
function trainerSession(id = "trainer-1") {
  return { user: { id, email: "trainer@test.com", role: "TRAINER", status: "ACTIVE" } };
}
function memberSession(id = "member-1") {
  return { user: { id, email: "member@test.com", role: "MEMBER", status: "ACTIVE" } };
}

// Request helpers
const VALID_CUID = "cm1234567890abcdef";

function makePostRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/sessions/s-1/attendance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeGetRequest() {
  return new Request("http://localhost/api/sessions/s-1/attendance", {
    method: "GET",
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

// A session that started in the past (weekDate Monday, dayOfWeek=1, hour=9 → past)
function pastSession() {
  return {
    id: "s-1",
    status: "SCHEDULED",
    weekDate: new Date("2026-01-05T00:00:00.000Z"), // A Monday
    recurringSlotId: "slot-1",
    recurringSlot: { dayOfWeek: 1, startHour: 9 },
    customDay: null,
    customStartHour: null,
  };
}

// A session in the future
function futureSession() {
  return {
    id: "s-1",
    status: "SCHEDULED",
    weekDate: new Date("2099-01-05T00:00:00.000Z"),
    recurringSlotId: "slot-1",
    recurringSlot: { dayOfWeek: 1, startHour: 9 },
    customDay: null,
    customStartHour: null,
  };
}

describe("POST /api/sessions/[id]/attendance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const { POST } = await import("@/app/api/sessions/[id]/attendance/route");
    const res = await POST(makePostRequest({ userId: VALID_CUID, present: true }), makeParams("s-1"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when called by MEMBER role", async () => {
    mockAuth.mockResolvedValue(memberSession());
    const { POST } = await import("@/app/api/sessions/[id]/attendance/route");
    const res = await POST(makePostRequest({ userId: VALID_CUID, present: true }), makeParams("s-1"));
    expect(res.status).toBe(403);
  });

  it("returns 404 when session does not exist", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue(null);
    const { POST } = await import("@/app/api/sessions/[id]/attendance/route");
    const res = await POST(makePostRequest({ userId: VALID_CUID, present: true }), makeParams("s-1"));
    expect(res.status).toBe(404);
  });

  it("returns 400 when session is CANCELLED", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({ ...pastSession(), status: "CANCELLED" });
    const { POST } = await import("@/app/api/sessions/[id]/attendance/route");
    const res = await POST(makePostRequest({ userId: VALID_CUID, present: true }), makeParams("s-1"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when session has not started yet", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue(futureSession());
    const { POST } = await import("@/app/api/sessions/[id]/attendance/route");
    const res = await POST(makePostRequest({ userId: VALID_CUID, present: true }), makeParams("s-1"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("not started");
  });

  it("returns 400 with invalid body (missing userId)", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue(pastSession());
    const { POST } = await import("@/app/api/sessions/[id]/attendance/route");
    const res = await POST(makePostRequest({ present: true }), makeParams("s-1"));
    expect(res.status).toBe(400);
  });

  it("returns 400 with invalid body (missing present)", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue(pastSession());
    const { POST } = await import("@/app/api/sessions/[id]/attendance/route");
    const res = await POST(makePostRequest({ userId: VALID_CUID }), makeParams("s-1"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when target user does not exist", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue(pastSession());
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const { POST } = await import("@/app/api/sessions/[id]/attendance/route");
    const res = await POST(makePostRequest({ userId: VALID_CUID, present: true }), makeParams("s-1"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when target user is not a MEMBER", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue(pastSession());
    mockPrisma.user.findUnique.mockResolvedValue({ id: VALID_CUID, role: "TRAINER", status: "ACTIVE" });
    const { POST } = await import("@/app/api/sessions/[id]/attendance/route");
    const res = await POST(makePostRequest({ userId: VALID_CUID, present: true }), makeParams("s-1"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when target member is DEPARTED", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue(pastSession());
    mockPrisma.user.findUnique.mockResolvedValue({ id: VALID_CUID, role: "MEMBER", status: "DEPARTED" });
    const { POST } = await import("@/app/api/sessions/[id]/attendance/route");
    const res = await POST(makePostRequest({ userId: VALID_CUID, present: true }), makeParams("s-1"));
    expect(res.status).toBe(400);
  });

  it("successfully marks attendance as present (OWNER)", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue(pastSession());
    mockPrisma.user.findUnique.mockResolvedValue({ id: VALID_CUID, role: "MEMBER", status: "ACTIVE" });
    const record = { id: "ar-1", sessionId: "s-1", userId: VALID_CUID, present: true, markedById: "owner-1", markedAt: new Date() };
    mockPrisma.attendanceRecord.upsert.mockResolvedValue(record);
    const { POST } = await import("@/app/api/sessions/[id]/attendance/route");
    const res = await POST(makePostRequest({ userId: VALID_CUID, present: true }), makeParams("s-1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.present).toBe(true);
  });

  it("successfully marks attendance as absent", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue(pastSession());
    mockPrisma.user.findUnique.mockResolvedValue({ id: VALID_CUID, role: "MEMBER", status: "ACTIVE" });
    const record = { id: "ar-1", sessionId: "s-1", userId: VALID_CUID, present: false, markedById: "owner-1", markedAt: new Date() };
    mockPrisma.attendanceRecord.upsert.mockResolvedValue(record);
    const { POST } = await import("@/app/api/sessions/[id]/attendance/route");
    const res = await POST(makePostRequest({ userId: VALID_CUID, present: false }), makeParams("s-1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.present).toBe(false);
  });

  it("TRAINER assigned to session can mark attendance", async () => {
    mockAuth.mockResolvedValue(trainerSession());
    mockPrisma.session.findUnique.mockResolvedValue(pastSession());
    mockPrisma.sessionTrainer.findUnique.mockResolvedValue({ sessionId: "s-1", userId: "trainer-1" });
    mockPrisma.user.findUnique.mockResolvedValue({ id: VALID_CUID, role: "MEMBER", status: "ACTIVE" });
    const record = { id: "ar-1", sessionId: "s-1", userId: VALID_CUID, present: true, markedById: "trainer-1", markedAt: new Date() };
    mockPrisma.attendanceRecord.upsert.mockResolvedValue(record);
    const { POST } = await import("@/app/api/sessions/[id]/attendance/route");
    const res = await POST(makePostRequest({ userId: VALID_CUID, present: true }), makeParams("s-1"));
    expect(res.status).toBe(200);
  });

  it("returns 403 when TRAINER is not assigned to session", async () => {
    mockAuth.mockResolvedValue(trainerSession());
    mockPrisma.session.findUnique.mockResolvedValue(pastSession());
    mockPrisma.sessionTrainer.findUnique.mockResolvedValue(null);
    const { POST } = await import("@/app/api/sessions/[id]/attendance/route");
    const res = await POST(makePostRequest({ userId: VALID_CUID, present: true }), makeParams("s-1"));
    expect(res.status).toBe(403);
  });

  it("works with TRIAL member", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue(pastSession());
    mockPrisma.user.findUnique.mockResolvedValue({ id: VALID_CUID, role: "MEMBER", status: "TRIAL" });
    const record = { id: "ar-1", sessionId: "s-1", userId: VALID_CUID, present: true, markedById: "owner-1", markedAt: new Date() };
    mockPrisma.attendanceRecord.upsert.mockResolvedValue(record);
    const { POST } = await import("@/app/api/sessions/[id]/attendance/route");
    const res = await POST(makePostRequest({ userId: VALID_CUID, present: true }), makeParams("s-1"));
    expect(res.status).toBe(200);
  });

  it("rejects unknown fields in body (strict schema)", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue(pastSession());
    const { POST } = await import("@/app/api/sessions/[id]/attendance/route");
    const res = await POST(
      makePostRequest({ userId: VALID_CUID, present: true, extraField: "bad" }),
      makeParams("s-1")
    );
    expect(res.status).toBe(400);
  });

  it("works with one-off (custom) session", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    const customSession = {
      id: "s-1",
      status: "SCHEDULED",
      weekDate: new Date("2026-01-05T00:00:00.000Z"),
      recurringSlotId: null,
      recurringSlot: null,
      customDay: 3,
      customStartHour: 14,
    };
    mockPrisma.session.findUnique.mockResolvedValue(customSession);
    mockPrisma.user.findUnique.mockResolvedValue({ id: VALID_CUID, role: "MEMBER", status: "ACTIVE" });
    const record = { id: "ar-1", sessionId: "s-1", userId: VALID_CUID, present: true, markedById: "owner-1", markedAt: new Date() };
    mockPrisma.attendanceRecord.upsert.mockResolvedValue(record);
    const { POST } = await import("@/app/api/sessions/[id]/attendance/route");
    const res = await POST(makePostRequest({ userId: VALID_CUID, present: true }), makeParams("s-1"));
    expect(res.status).toBe(200);
  });
});

describe("GET /api/sessions/[id]/attendance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const { GET } = await import("@/app/api/sessions/[id]/attendance/route");
    const res = await GET(makeGetRequest(), makeParams("s-1"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when called by MEMBER role", async () => {
    mockAuth.mockResolvedValue(memberSession());
    const { GET } = await import("@/app/api/sessions/[id]/attendance/route");
    const res = await GET(makeGetRequest(), makeParams("s-1"));
    expect(res.status).toBe(403);
  });

  it("returns 404 when session does not exist", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue(null);
    const { GET } = await import("@/app/api/sessions/[id]/attendance/route");
    const res = await GET(makeGetRequest(), makeParams("s-1"));
    expect(res.status).toBe(404);
  });

  it("returns attendance records with user details", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue(pastSession());
    const records = [
      { id: "ar-1", sessionId: "s-1", userId: "m-1", present: true, markedById: "owner-1", markedAt: new Date(), user: { id: "m-1", name: "Alice", email: "alice@test.com" } },
      { id: "ar-2", sessionId: "s-1", userId: "m-2", present: false, markedById: "owner-1", markedAt: new Date(), user: { id: "m-2", name: "Bob", email: "bob@test.com" } },
    ];
    mockPrisma.attendanceRecord.findMany.mockResolvedValue(records);
    const { GET } = await import("@/app/api/sessions/[id]/attendance/route");
    const res = await GET(makeGetRequest(), makeParams("s-1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data).toHaveLength(2);
    expect(data.data[0].user.name).toBe("Alice");
  });

  it("TRAINER assigned to session can read attendance", async () => {
    mockAuth.mockResolvedValue(trainerSession());
    mockPrisma.session.findUnique.mockResolvedValue(pastSession());
    mockPrisma.sessionTrainer.findUnique.mockResolvedValue({ sessionId: "s-1", userId: "trainer-1" });
    mockPrisma.attendanceRecord.findMany.mockResolvedValue([]);
    const { GET } = await import("@/app/api/sessions/[id]/attendance/route");
    const res = await GET(makeGetRequest(), makeParams("s-1"));
    expect(res.status).toBe(200);
  });

  it("returns 403 when TRAINER is not assigned to session", async () => {
    mockAuth.mockResolvedValue(trainerSession());
    mockPrisma.session.findUnique.mockResolvedValue(pastSession());
    mockPrisma.sessionTrainer.findUnique.mockResolvedValue(null);
    const { GET } = await import("@/app/api/sessions/[id]/attendance/route");
    const res = await GET(makeGetRequest(), makeParams("s-1"));
    expect(res.status).toBe(403);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- app/api/__tests__/attendance.test.ts`
Expected: FAIL — module `@/app/api/sessions/[id]/attendance/route` not found.

**Step 3: Commit failing tests**

```bash
git add app/api/__tests__/attendance.test.ts
git commit -m "test: add attendance API route tests (red)"
```

---

## Task 4: Attendance API Route — Implementation

**Files:**
- Create: `app/api/sessions/[id]/attendance/route.ts`

**Step 1: Implement the route**

```typescript
/**
 * Attendance API — POST + GET
 *
 * POST /api/sessions/[id]/attendance — Mark/toggle member attendance
 * GET  /api/sessions/[id]/attendance — Get all attendance records for a session
 *
 * Only OWNER or assigned TRAINER can access.
 * Attendance can only be marked after the session has started.
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AttendanceMarkSchema } from "@/types";
import { authWriteLimiter, authReadLimiter, createRateLimitResponse } from "@/lib/rate-limit";
import { getSessionDateTime } from "@/lib/session-generation";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(
  req: Request,
  { params }: RouteParams
): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role as string;
    if (role !== "OWNER" && role !== "TRAINER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const writeRateCheck = authWriteLimiter.check(`write:${session.user.id}`);
    if (!writeRateCheck.allowed) return createRateLimitResponse(writeRateCheck.retryAfterMs);

    const { id: sessionId } = await params;

    const existingSession = await prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        status: true,
        weekDate: true,
        recurringSlotId: true,
        recurringSlot: { select: { dayOfWeek: true, startHour: true } },
        customDay: true,
        customStartHour: true,
      },
    });

    if (!existingSession) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    if (existingSession.status === "CANCELLED") {
      return Response.json(
        { error: "Cannot mark attendance on a cancelled session" },
        { status: 400 }
      );
    }

    // Check session has started
    const dayOfWeek = existingSession.recurringSlot?.dayOfWeek ?? existingSession.customDay ?? 1;
    const startHour = existingSession.recurringSlot?.startHour ?? existingSession.customStartHour ?? 0;
    const sessionStart = getSessionDateTime(existingSession.weekDate, dayOfWeek, startHour);
    if (new Date() < sessionStart) {
      return Response.json(
        { error: "Session has not started yet. Attendance can only be marked after the session begins." },
        { status: 400 }
      );
    }

    // If TRAINER, must be assigned to this session
    if (role === "TRAINER") {
      const trainerAssignment = await prisma.sessionTrainer.findUnique({
        where: {
          sessionId_userId: { sessionId, userId: session.user.id },
        },
      });
      if (!trainerAssignment) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const body = await req.json();
    const parsed = AttendanceMarkSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { userId, present } = parsed.data;

    // Validate target user
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true },
    });

    if (!targetUser) {
      return Response.json({ error: "User not found" }, { status: 400 });
    }
    if (targetUser.role !== "MEMBER") {
      return Response.json({ error: "User is not a member" }, { status: 400 });
    }
    if (targetUser.status === "DEPARTED") {
      return Response.json({ error: "Cannot mark attendance for a departed member" }, { status: 400 });
    }

    const record = await prisma.attendanceRecord.upsert({
      where: {
        sessionId_userId: { sessionId, userId },
      },
      create: {
        sessionId,
        userId,
        present,
        markedById: session.user.id,
        markedAt: new Date(),
      },
      update: {
        present,
        markedById: session.user.id,
        markedAt: new Date(),
      },
    });

    return Response.json({ data: record });
  } catch (error) {
    console.error("POST /api/sessions/[id]/attendance error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(
  req: Request,
  { params }: RouteParams
): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role as string;
    if (role !== "OWNER" && role !== "TRAINER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const readRateCheck = authReadLimiter.check(`read:${session.user.id}`);
    if (!readRateCheck.allowed) return createRateLimitResponse(readRateCheck.retryAfterMs);

    const { id: sessionId } = await params;

    const existingSession = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });

    if (!existingSession) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    // If TRAINER, must be assigned
    if (role === "TRAINER") {
      const trainerAssignment = await prisma.sessionTrainer.findUnique({
        where: {
          sessionId_userId: { sessionId, userId: session.user.id },
        },
      });
      if (!trainerAssignment) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const records = await prisma.attendanceRecord.findMany({
      where: { sessionId },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { user: { name: "asc" } },
    });

    return Response.json({ data: records });
  } catch (error) {
    console.error("GET /api/sessions/[id]/attendance error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

**Step 2: Run tests to verify they pass**

Run: `npm test -- app/api/__tests__/attendance.test.ts`
Expected: All tests PASS.

**Step 3: Run full test suite**

Run: `npm test`
Expected: All tests pass (no regressions).

**Step 4: Commit**

```bash
git add app/api/sessions/\[id\]/attendance/
git commit -m "feat: implement attendance API route (POST + GET)"
```

---

## Task 5: AttendanceChecklist Component — Tests

**Files:**
- Create: `components/schedule/__tests__/AttendanceChecklist.test.tsx`

**Step 1: Write the test file**

```typescript
/**
 * AttendanceChecklist Tests
 *
 * Tests the attendance roll-call UI component for owner/trainer views.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockAddToast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

// Import component after mocks
import { AttendanceChecklist } from "../AttendanceChecklist";

interface AttendanceMember {
  userId: string;
  name: string;
  present: boolean | null; // null = not yet marked
}

function makeMembers(): AttendanceMember[] {
  return [
    { userId: "m-1", name: "Alice", present: true },
    { userId: "m-2", name: "Bob", present: false },
    { userId: "m-3", name: "Charlie", present: null },
  ];
}

const allActiveMembers = [
  { id: "m-1", name: "Alice" },
  { id: "m-2", name: "Bob" },
  { id: "m-3", name: "Charlie" },
  { id: "m-4", name: "Diana" },
];

describe("AttendanceChecklist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders the title 'Attendance'", () => {
    render(
      <AttendanceChecklist
        sessionId="s-1"
        members={makeMembers()}
        allActiveMembers={allActiveMembers}
      />
    );
    expect(screen.getByText("Attendance")).toBeInTheDocument();
  });

  it("shows present count in header", () => {
    render(
      <AttendanceChecklist
        sessionId="s-1"
        members={makeMembers()}
        allActiveMembers={allActiveMembers}
      />
    );
    expect(screen.getByText("1 / 3 present")).toBeInTheDocument();
  });

  it("renders all member names", () => {
    render(
      <AttendanceChecklist
        sessionId="s-1"
        members={makeMembers()}
        allActiveMembers={allActiveMembers}
      />
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();
  });

  it("shows present indicator for present members", () => {
    render(
      <AttendanceChecklist
        sessionId="s-1"
        members={makeMembers()}
        allActiveMembers={allActiveMembers}
      />
    );
    // Alice is present — her row should have the present indicator
    const aliceRow = screen.getByText("Alice").closest("[data-testid]");
    expect(aliceRow).toHaveAttribute("data-testid", "attendance-row-m-1");
  });

  it("calls API on tap to toggle attendance", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { id: "ar-1", present: true } }),
    });
    vi.stubGlobal("fetch", mockFetch);

    render(
      <AttendanceChecklist
        sessionId="s-1"
        members={makeMembers()}
        allActiveMembers={allActiveMembers}
      />
    );

    // Tap Charlie (currently null/unmarked → should become present)
    const charlieRow = screen.getByTestId("attendance-row-m-3");
    fireEvent.click(charlieRow);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/sessions/s-1/attendance",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ userId: "m-3", present: true }),
        })
      );
    });
  });

  it("toggles present member to absent on tap", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { id: "ar-1", present: false } }),
    });
    vi.stubGlobal("fetch", mockFetch);

    render(
      <AttendanceChecklist
        sessionId="s-1"
        members={makeMembers()}
        allActiveMembers={allActiveMembers}
      />
    );

    // Tap Alice (currently present → should become absent)
    const aliceRow = screen.getByTestId("attendance-row-m-1");
    fireEvent.click(aliceRow);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/sessions/s-1/attendance",
        expect.objectContaining({
          body: JSON.stringify({ userId: "m-1", present: false }),
        })
      );
    });
  });

  it("shows optimistic UI update on tap", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { id: "ar-1", present: true } }),
    });
    vi.stubGlobal("fetch", mockFetch);

    render(
      <AttendanceChecklist
        sessionId="s-1"
        members={makeMembers()}
        allActiveMembers={allActiveMembers}
      />
    );

    // Count changes optimistically
    fireEvent.click(screen.getByTestId("attendance-row-m-3"));
    // Should now show 2/3 present (Alice + Charlie optimistically)
    await waitFor(() => {
      expect(screen.getByText("2 / 3 present")).toBeInTheDocument();
    });
  });

  it("shows error toast and rolls back on API failure", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Server error" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    render(
      <AttendanceChecklist
        sessionId="s-1"
        members={makeMembers()}
        allActiveMembers={allActiveMembers}
      />
    );

    fireEvent.click(screen.getByTestId("attendance-row-m-3"));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: "error" })
      );
    });

    // Should roll back to original count
    expect(screen.getByText("1 / 3 present")).toBeInTheDocument();
  });

  it("shows 'Add Member' button", () => {
    render(
      <AttendanceChecklist
        sessionId="s-1"
        members={makeMembers()}
        allActiveMembers={allActiveMembers}
      />
    );
    expect(screen.getByText("+ Add Member")).toBeInTheDocument();
  });

  it("'Add Member' dropdown only shows members not already in list", async () => {
    render(
      <AttendanceChecklist
        sessionId="s-1"
        members={makeMembers()}
        allActiveMembers={allActiveMembers}
      />
    );
    fireEvent.click(screen.getByText("+ Add Member"));
    // Diana is the only member not in the list
    expect(screen.getByText("Diana")).toBeInTheDocument();
    // Alice/Bob/Charlie should NOT appear in the dropdown
    expect(screen.queryAllByText("Alice")).toHaveLength(1); // Only in the main list
  });

  it("renders empty state when no members", () => {
    render(
      <AttendanceChecklist
        sessionId="s-1"
        members={[]}
        allActiveMembers={allActiveMembers}
      />
    );
    expect(screen.getByText("0 / 0 present")).toBeInTheDocument();
  });
});
```

**Step 2: Run to verify they fail**

Run: `npm test -- components/schedule/__tests__/AttendanceChecklist.test.tsx`
Expected: FAIL — module not found.

**Step 3: Commit**

```bash
git add components/schedule/__tests__/AttendanceChecklist.test.tsx
git commit -m "test: add AttendanceChecklist component tests (red)"
```

---

## Task 6: AttendanceChecklist Component — Implementation

**Files:**
- Create: `components/schedule/AttendanceChecklist.tsx`

**Step 1: Implement the component**

```tsx
"use client";

import { useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";

interface AttendanceMember {
  userId: string;
  name: string;
  present: boolean | null;
}

interface AttendanceChecklistProps {
  sessionId: string;
  members: AttendanceMember[];
  allActiveMembers: Array<{ id: string; name: string }>;
}

export function AttendanceChecklist({
  sessionId,
  members: initialMembers,
  allActiveMembers,
}: AttendanceChecklistProps): React.ReactElement {
  const { addToast } = useToast();
  const [members, setMembers] = useState<AttendanceMember[]>(initialMembers);
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [addingMemberId, setAddingMemberId] = useState<string | null>(null);

  const presentCount = members.filter((m) => m.present === true).length;
  const totalCount = members.length;

  // Members not already in the attendance list (for walk-in add)
  const availableMembers = allActiveMembers.filter(
    (am) => !members.some((m) => m.userId === am.id)
  );

  async function handleToggle(userId: string): Promise<void> {
    const member = members.find((m) => m.userId === userId);
    if (!member) return;

    // Current state: null or false → present (true), true → absent (false)
    const newPresent = member.present !== true;

    // Optimistic update
    setMembers((prev) =>
      prev.map((m) =>
        m.userId === userId ? { ...m, present: newPresent } : m
      )
    );

    try {
      const res = await fetch(`/api/sessions/${sessionId}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, present: newPresent }),
      });

      if (!res.ok) {
        throw new Error("Failed to update attendance");
      }
    } catch {
      // Rollback
      setMembers((prev) =>
        prev.map((m) =>
          m.userId === userId ? { ...m, present: member.present } : m
        )
      );
      addToast({ type: "error", title: "Failed to update attendance" });
    }
  }

  async function handleAddMember(memberId: string, memberName: string): Promise<void> {
    setAddingMemberId(memberId);
    try {
      // Step 1: Assign member to session
      const assignRes = await fetch(`/api/sessions/${sessionId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: memberId, action: "add" }),
      });

      if (!assignRes.ok) {
        const err = await assignRes.json().catch(() => ({ error: "Failed to assign member" }));
        throw new Error(err.error || "Failed to assign member");
      }

      // Step 2: Mark as present
      const attendanceRes = await fetch(`/api/sessions/${sessionId}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: memberId, present: true }),
      });

      if (!attendanceRes.ok) {
        throw new Error("Failed to mark attendance");
      }

      // Add to local state
      setMembers((prev) => [
        ...prev,
        { userId: memberId, name: memberName, present: true },
      ]);
      setShowAddDropdown(false);
      addToast({ type: "success", title: `${memberName} added and marked present` });
    } catch (err) {
      addToast({
        type: "error",
        title: err instanceof Error ? err.message : "Failed to add member",
      });
    } finally {
      setAddingMemberId(null);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Attendance"
        description={`${presentCount} / ${totalCount} present`}
      />
      <div className="mt-4 space-y-1">
        {members.map((member) => (
          <button
            key={member.userId}
            data-testid={`attendance-row-${member.userId}`}
            onClick={() => handleToggle(member.userId)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
              member.present === true
                ? "bg-success-500/10 hover:bg-success-500/20"
                : "bg-surface-900/50 hover:bg-surface-700"
            }`}
          >
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                member.present === true
                  ? "border-success-500 bg-success-500 text-white"
                  : "border-surface-500 text-transparent"
              }`}
            >
              {member.present === true && (
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>
            <span
              className={`text-sm font-medium ${
                member.present === true ? "text-surface-100" : "text-surface-400"
              }`}
            >
              {member.name}
            </span>
          </button>
        ))}
      </div>

      {/* Add Member */}
      <div className="mt-3 border-t border-surface-700 pt-3">
        {showAddDropdown ? (
          <div className="space-y-1">
            {availableMembers.length === 0 ? (
              <p className="px-3 py-2 text-sm text-surface-500">
                All members are already in the list
              </p>
            ) : (
              availableMembers.map((am) => (
                <button
                  key={am.id}
                  onClick={() => handleAddMember(am.id, am.name)}
                  disabled={addingMemberId === am.id}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-surface-300 hover:bg-surface-700 disabled:opacity-50"
                >
                  {am.name}
                </button>
              ))
            )}
            <button
              onClick={() => setShowAddDropdown(false)}
              className="px-3 py-1 text-xs text-surface-500 hover:text-surface-300"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowAddDropdown(true)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-primary-400 hover:bg-surface-700 transition-colors"
          >
            + Add Member
          </button>
        )}
      </div>
    </Card>
  );
}

export type { AttendanceChecklistProps, AttendanceMember };
```

**Step 2: Run component tests**

Run: `npm test -- components/schedule/__tests__/AttendanceChecklist.test.tsx`
Expected: All tests PASS.

**Step 3: Run full test suite**

Run: `npm test`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add components/schedule/AttendanceChecklist.tsx
git commit -m "feat: implement AttendanceChecklist component"
```

---

## Task 7: Integrate AttendanceChecklist into Session Detail Pages

**Files:**
- Modify: `app/(owner)/owner/session/[id]/page.tsx`
- Modify: `app/(owner)/owner/session/[id]/SessionDetailClient.tsx`
- Modify: `app/(trainer)/trainer/session/[id]/page.tsx`
- Modify: `app/(trainer)/trainer/session/[id]/TrainerSessionDetailClient.tsx`

**Step 1: Update the owner server page to fetch attendance + compute `hasStarted`**

In `app/(owner)/owner/session/[id]/page.tsx`, add to the Prisma `include`:

```typescript
attendanceRecords: {
  select: { userId: true, present: true },
},
```

Add after the `voteMembers` computation:

```typescript
// Compute session start time to determine if attendance can be shown
const dayOfWeek = session.recurringSlot?.dayOfWeek ?? session.customDay ?? 1;
const startHour = session.recurringSlot?.startHour ?? session.customStartHour ?? 0;
const { getSessionDateTime } = await import("@/lib/session-generation");
const sessionStart = getSessionDateTime(session.weekDate, dayOfWeek, startHour);
const hasStarted = new Date() >= sessionStart;

// Build attendance members list
// Combine assigned members (when voting off) or voted members (when voting on) with attendance records
const attendanceMembers = (session.votingEnabled
  ? session.votes
      .filter((v) => v.attending === true)
      .map((v) => {
        const member = allMembers.find((m) => m.id === v.userId);
        const record = session.attendanceRecords.find((ar) => ar.userId === v.userId);
        return { userId: v.userId, name: member?.name || "Unknown", present: record?.present ?? null };
      })
  : session.members.map((sm) => {
      const record = session.attendanceRecords.find((ar) => ar.userId === sm.userId);
      return { userId: sm.userId, name: sm.user.name, present: record?.present ?? null };
    })
).concat(
  // Also include anyone who has an attendance record but isn't in the above lists (walk-ins)
  session.attendanceRecords
    .filter((ar) => {
      if (session.votingEnabled) {
        return !session.votes.some((v) => v.attending && v.userId === ar.userId);
      }
      return !session.members.some((sm) => sm.userId === ar.userId);
    })
    .map((ar) => {
      const member = allMembers.find((m) => m.id === ar.userId);
      return { userId: ar.userId, name: member?.name || "Unknown", present: ar.present };
    })
);
```

Pass new props to `SessionDetailClient`:

```typescript
attendanceMembers={attendanceMembers}
hasStarted={hasStarted}
```

**Step 2: Update `SessionDetailClient` to render AttendanceChecklist**

Add the import:

```typescript
import { AttendanceChecklist } from "@/components/schedule/AttendanceChecklist";
```

Update props interface to add:

```typescript
attendanceMembers: Array<{ userId: string; name: string; present: boolean | null }>;
hasStarted: boolean;
```

Add in the left column, after the voting toggle button:

```tsx
{/* Attendance — only shown after session has started */}
{hasStarted && !isCancelled && (
  <AttendanceChecklist
    sessionId={session.id}
    members={attendanceMembers}
    allActiveMembers={allMembers}
  />
)}
```

**Step 3: Do the same for the trainer page**

Repeat Steps 1-2 for:
- `app/(trainer)/trainer/session/[id]/page.tsx` — same data fetching additions
- `app/(trainer)/trainer/session/[id]/TrainerSessionDetailClient.tsx` — same component addition

The trainer client component should render the `AttendanceChecklist` in the left column after the voting toggle button, with the same visibility rule.

**Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 5: Run full test suite**

Run: `npm test`
Expected: All tests pass.

**Step 6: Commit**

```bash
git add app/(owner)/owner/session/[id]/ app/(trainer)/trainer/session/[id]/
git commit -m "feat: integrate AttendanceChecklist into session detail pages"
```

---

## Task 8: Extend Analytics API — Tests

**Files:**
- Modify: `app/api/__tests__/analytics.test.ts` (or create if not exists)

**Step 1: Check if analytics test file exists, then add attendance-specific tests**

Add tests that verify the analytics endpoint returns the new `attendance` key with:
- `memberRates` array
- `slotRates` array
- `voteVsActual` object
- `trend` array

The tests should verify the analytics computation correctly handles:
- Members with attendance records
- Sessions without attendance records (should be excluded)
- Vote vs. actual comparison math
- Weekly trend calculation

Follow the existing test pattern. The analytics route test should mock `prisma.attendanceRecord.findMany` in addition to existing mocks.

**Step 2: Run to verify they fail**

Run: `npm test -- app/api/__tests__/analytics.test.ts`
Expected: Tests related to attendance key FAIL.

**Step 3: Commit**

```bash
git add app/api/__tests__/
git commit -m "test: add attendance analytics tests (red)"
```

---

## Task 9: Extend Analytics API — Implementation

**Files:**
- Modify: `app/api/analytics/route.ts`

**Step 1: Add attendance data fetching**

In the `Promise.all` array, add a 5th query:

```typescript
// Attendance records in date range
prisma.attendanceRecord.findMany({
  where: {
    session: {
      weekDate: { gte: start, lte: end },
    },
  },
  select: {
    sessionId: true,
    userId: true,
    present: true,
    session: {
      select: {
        weekDate: true,
        recurringSlotId: true,
        recurringSlot: { select: { dayOfWeek: true, startHour: true } },
        customDay: true,
        customStartHour: true,
        votes: { select: { userId: true, attending: true } },
        members: { select: { userId: true } },
      },
    },
  },
}),
```

**Step 2: Compute attendance analytics**

Add after the retention section, before building the `analytics` object:

```typescript
// ===== ATTENDANCE (Actual) =====

// Group attendance records by session
const attendanceBySession = new Map<string, { present: number; total: number; votedComing: number }>();
for (const record of attendanceRecords) {
  const existing = attendanceBySession.get(record.sessionId) || { present: 0, total: 0, votedComing: 0 };
  existing.total += 1;
  if (record.present) existing.present += 1;
  attendanceBySession.set(record.sessionId, existing);
}

// Count voted coming per session (only for sessions that have attendance records)
for (const record of attendanceRecords) {
  const sessionData = attendanceBySession.get(record.sessionId);
  if (sessionData && sessionData.votedComing === 0) {
    // Count once per session
    const votedComing = record.session.votes.filter((v) => v.attending).length;
    sessionData.votedComing = votedComing;
  }
}

// 1. Per-member attendance rates
const memberAttendanceActual = new Map<string, { attended: number; expected: number }>();
for (const record of attendanceRecords) {
  const existing = memberAttendanceActual.get(record.userId) || { attended: 0, expected: 0 };
  existing.expected += 1;
  if (record.present) existing.attended += 1;
  memberAttendanceActual.set(record.userId, existing);
}

const memberRates = Array.from(memberAttendanceActual.entries())
  .map(([userId, data]) => {
    const member = members.find((m) => m.id === userId);
    return {
      name: member?.name || "Unknown",
      expected: data.expected,
      attended: data.attended,
      rate: data.expected > 0 ? Math.round((data.attended / data.expected) * 100) : 0,
    };
  })
  .sort((a, b) => a.rate - b.rate);

// 2. Per-slot attendance rates
const slotAttendance = new Map<string, { totalPresent: number; totalRecords: number; sessionCount: number }>();
for (const record of attendanceRecords) {
  const day = record.session.recurringSlot?.dayOfWeek ?? record.session.customDay ?? 0;
  const hour = record.session.recurringSlot?.startHour ?? record.session.customStartHour ?? 0;
  const key = `${day}-${hour}`;
  const existing = slotAttendance.get(key) || { totalPresent: 0, totalRecords: 0, sessionCount: 0 };
  existing.totalRecords += 1;
  if (record.present) existing.totalPresent += 1;
  slotAttendance.set(key, existing);
}
// Count unique sessions per slot
const slotSessionIds = new Map<string, Set<string>>();
for (const record of attendanceRecords) {
  const day = record.session.recurringSlot?.dayOfWeek ?? record.session.customDay ?? 0;
  const hour = record.session.recurringSlot?.startHour ?? record.session.customStartHour ?? 0;
  const key = `${day}-${hour}`;
  if (!slotSessionIds.has(key)) slotSessionIds.set(key, new Set());
  slotSessionIds.get(key)!.add(record.sessionId);
}

const slotRates = Array.from(slotAttendance.entries())
  .map(([key, data]) => {
    const [dayStr, hourStr] = key.split("-");
    const sessionCount = slotSessionIds.get(key)?.size ?? 0;
    return {
      day: DAY_NAMES[parseInt(dayStr)] || "Unknown",
      hour: parseInt(hourStr),
      avgPresent: sessionCount > 0 ? Math.round((data.totalPresent / sessionCount) * 10) / 10 : 0,
      avgExpected: sessionCount > 0 ? Math.round((data.totalRecords / sessionCount) * 10) / 10 : 0,
      showUpRate: data.totalRecords > 0 ? Math.round((data.totalPresent / data.totalRecords) * 100) : 0,
      sessionCount,
    };
  })
  .sort((a, b) => a.showUpRate - b.showUpRate);

// 3. Vote vs. Actual comparison
let totalVotedComing = 0;
let totalActuallyAttended = 0;
for (const [, data] of attendanceBySession) {
  totalVotedComing += data.votedComing;
  totalActuallyAttended += data.present;
}
const voteReliability = totalVotedComing > 0
  ? Math.round((totalActuallyAttended / totalVotedComing) * 100)
  : 0;

const voteVsActual = {
  totalVotedComing,
  totalActuallyAttended,
  reliability: voteReliability,
};

// 4. Attendance trend (weekly)
const weeklyAttendance = new Map<string, { present: number; total: number }>();
for (const record of attendanceRecords) {
  const weekKey = record.session.weekDate.toISOString().split("T")[0];
  const existing = weeklyAttendance.get(weekKey) || { present: 0, total: 0 };
  existing.total += 1;
  if (record.present) existing.present += 1;
  weeklyAttendance.set(weekKey, existing);
}

const trend = Array.from(weeklyAttendance.entries())
  .map(([week, data]) => ({
    week,
    rate: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0,
    present: data.present,
    total: data.total,
  }))
  .sort((a, b) => a.week.localeCompare(b.week));
```

**Step 3: Add to analytics response object**

Add the `attendance` key to the `analytics` object:

```typescript
attendance: {
  memberRates,
  slotRates,
  voteVsActual,
  trend,
},
```

Also add `attendance` data to CSV export if needed.

**Step 4: Run tests**

Run: `npm test`
Expected: All tests pass.

**Step 5: Commit**

```bash
git add app/api/analytics/route.ts
git commit -m "feat: extend analytics API with attendance metrics"
```

---

## Task 10: Dashboard Attendance Analytics — Tests

**Files:**
- Create or modify: `app/(owner)/dashboard/__tests__/DashboardClient.test.tsx`

**Step 1: Add tests for the new attendance analytics section**

Test that:
- Member attendance rate table renders with correct data
- Per-slot attendance bar chart renders
- Vote vs. Actual summary cards render
- Attendance trend line chart renders
- Analytics section updates when month changes
- Empty state shown when no attendance data

**Step 2: Commit**

```bash
git add app/(owner)/dashboard/__tests__/
git commit -m "test: add attendance analytics dashboard tests (red)"
```

---

## Task 11: Dashboard Attendance Analytics — Implementation

**Files:**
- Create: `components/analytics/MemberAttendanceTable.tsx`
- Create: `components/analytics/SlotAttendanceChart.tsx`
- Create: `components/analytics/VoteVsActualCards.tsx`
- Create: `components/analytics/AttendanceTrendChart.tsx`
- Modify: `app/(owner)/dashboard/DashboardClient.tsx`
- Modify: `app/(owner)/dashboard/page.tsx`

**Step 1: Create MemberAttendanceTable component**

A sortable table inside a `Card`:
- Columns: Member Name | Expected | Attended | Rate %
- Sorted by rate ascending (lowest first to highlight issues)
- Uses existing `Card`/`CardHeader` components
- Shows "No attendance data" empty state

**Step 2: Create SlotAttendanceChart component**

A Recharts `BarChart` inside a `Card`:
- X-axis: slot names ("Mon 9AM")
- Y-axis: show-up rate %
- Uses same dark theme styling as existing `AttendanceChart`
- Empty state when no data

**Step 3: Create VoteVsActualCards component**

Three `MetricCard` components in a row:
- "Voted Coming" with total count
- "Actually Attended" with total count
- "Reliability" with percentage

**Step 4: Create AttendanceTrendChart component**

A Recharts `LineChart` inside a `Card`:
- X-axis: week dates
- Y-axis: attendance rate %
- Single purple line
- Same dark theme tooltip styling

**Step 5: Update DashboardClient**

Add new state for attendance data. Update `fetchDashboard` to read the new `attendance` key from the analytics response. Add a new section below existing charts:

```tsx
{/* Attendance Analytics */}
<div className="space-y-6">
  <h2 className="text-lg font-semibold text-surface-100">Attendance Tracking</h2>
  <VoteVsActualCards data={voteVsActual} />
  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
    <SlotAttendanceChart slots={slotRates} />
    <AttendanceTrendChart trend={attendanceTrend} />
  </div>
  <MemberAttendanceTable members={memberRates} />
</div>
```

**Step 6: Update dashboard server page**

In `app/(owner)/dashboard/page.tsx`, fetch attendance data from the sessions query (add `attendanceRecords` to the include) OR rely on the client-side `fetchDashboard` which already calls the analytics API. For the initial server render, compute the attendance metrics server-side and pass as initial props.

**Step 7: Type check**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 8: Run full test suite**

Run: `npm test`
Expected: All tests pass.

**Step 9: Commit**

```bash
git add components/analytics/ app/(owner)/dashboard/
git commit -m "feat: add attendance analytics to dashboard"
```

---

## Task 12: Final Verification

**Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

**Step 2: Lint**

Run: `npm run lint`
Expected: Only pre-existing warnings.

**Step 3: Full test suite**

Run: `npm test`
Expected: All tests pass.

**Step 4: Build**

Run: `npm run build`
Expected: Build succeeds.

**Step 5: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "chore: final verification and cleanup"
```
