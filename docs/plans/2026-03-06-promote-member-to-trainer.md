# Promote Member to Trainer — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow the owner to promote an existing member to trainer role via a dropdown selector in the "Add Trainer" modal.

**Architecture:** Replace the current name/email/phone form in TrainersClient with a searchable member dropdown. Create the missing `POST /api/trainers` endpoint that changes a member's role to TRAINER, cleans up future session assignments/votes, and sends a notification. Add a new `ROLE_CHANGED` notification type to the schema.

**Tech Stack:** Next.js 15 App Router, Prisma 7, Zod, NextAuth v5, next-intl, Vitest

---

### Task 1: Add ROLE_CHANGED notification type to Prisma schema

**Files:**
- Modify: `prisma/schema.prisma:32-45` (NotificationType enum)
- Modify: `types/index.ts:186-204` (NotificationCreateSchema type enum)

**Step 1: Add ROLE_CHANGED to the Prisma enum**

In `prisma/schema.prisma`, add `ROLE_CHANGED` to the `NotificationType` enum:

```prisma
enum NotificationType {
  WORKOUT_POSTED
  VOTING_OPENED
  CLASS_CANCELLED
  MEMBER_MOVED
  PAYMENT_REMINDER
  LOCKOUT
  MEMBER_DEPARTED
  REJOIN_REQUEST
  TRIAL_EXPIRING
  TRIAL_EXPIRED
  SESSION_DELETED
  MANUAL_REMINDER
  ROLE_CHANGED
}
```

**Step 2: Add ROLE_CHANGED to the Zod schema**

In `types/index.ts`, update the `NotificationCreateSchema` type enum to include `'ROLE_CHANGED'`:

```typescript
export const NotificationCreateSchema = z.object({
  userId: z.string().cuid('Invalid user ID'),
  type: z.enum([
    'WORKOUT_POSTED',
    'VOTING_OPENED',
    'CLASS_CANCELLED',
    'MEMBER_MOVED',
    'PAYMENT_REMINDER',
    'LOCKOUT',
    'MEMBER_DEPARTED',
    'REJOIN_REQUEST',
    'TRIAL_EXPIRING',
    'TRIAL_EXPIRED',
    'SESSION_DELETED',
    'MANUAL_REMINDER',
    'ROLE_CHANGED',
  ]),
  // ... rest unchanged
```

**Step 3: Run migration**

Run: `npx prisma migrate dev --name add-role-changed-notification-type`
Expected: Migration created and applied successfully.

**Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ types/index.ts
git commit -m "feat: add ROLE_CHANGED notification type to schema"
```

---

### Task 2: Replace TrainerCreateSchema with PromoteMemberSchema

**Files:**
- Modify: `types/index.ts:215-223` (TrainerCreateSchema section)

**Step 1: Replace the schema**

In `types/index.ts`, replace the `TrainerCreateSchema` block with:

```typescript
// ===== TRAINER SCHEMA =====

export const PromoteMemberSchema = z.object({
  memberId: z.string().cuid('Invalid member ID'),
}).strict();

export type PromoteMemberInput = z.infer<typeof PromoteMemberSchema>;
```

**Step 2: Verify no other files import TrainerCreateSchema**

Run: `grep -r "TrainerCreateSchema" --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".next"`
Expected: Only `types/index.ts` and possibly test files. No API route imports it (since the route doesn't exist yet).

**Step 3: Commit**

```bash
git add types/index.ts
git commit -m "feat: replace TrainerCreateSchema with PromoteMemberSchema"
```

---

### Task 3: Create POST /api/trainers endpoint

**Files:**
- Create: `app/api/trainers/route.ts`

**Step 1: Write the failing test**

Create `app/api/__tests__/trainers.test.ts`:

```typescript
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
  });

  // --- Auth ---

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest({ memberId: "m-1" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is TRAINER", async () => {
    mockAuth.mockResolvedValue(trainerSession());
    const res = await POST(makeRequest({ memberId: "m-1" }));
    expect(res.status).toBe(403);
  });

  it("returns 403 when user is MEMBER", async () => {
    mockAuth.mockResolvedValue(memberSession());
    const res = await POST(makeRequest({ memberId: "m-1" }));
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

  // --- Happy path ---

  it("promotes a member to trainer successfully", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    const member = { id: "cm1234567890abcdef", role: "MEMBER", status: "ACTIVE", name: "Ana Trainer" };
    mockPrisma.user.findUnique.mockResolvedValue(member);
    mockPrisma.user.update.mockResolvedValue({ ...member, role: "TRAINER" });
    mockPrisma.sessionMember.deleteMany.mockResolvedValue({ count: 2 });
    mockPrisma.vote.deleteMany.mockResolvedValue({ count: 1 });
    mockDispatchNotification.mockResolvedValue({});
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
    mockDispatchNotification.mockResolvedValue({});
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
    mockDispatchNotification.mockResolvedValue({});
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
    mockDispatchNotification.mockResolvedValue({});
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
    mockDispatchNotification.mockResolvedValue({});
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "cm1234567890abcdef", name: "Ana", email: "ana@test.com", phone: null, status: "ACTIVE", createdAt: new Date() },
    ]);

    const res = await POST(makeRequest({ memberId: "cm1234567890abcdef" }));
    const data = await res.json();
    expect(data.data.trainers).toHaveLength(1);
    expect(data.data.trainers[0].name).toBe("Ana");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- app/api/__tests__/trainers.test.ts`
Expected: FAIL — module `@/app/api/trainers/route` not found.

**Step 3: Create the API route**

Create `app/api/trainers/route.ts`:

```typescript
/**
 * Trainers API — POST (Promote Member to Trainer)
 *
 * POST /api/trainers — Promote an existing member to trainer role
 * Owner only. Changes role from MEMBER to TRAINER, cleans up
 * future session assignments and votes, sends notification.
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PromoteMemberSchema } from "@/types";
import { dispatchNotification } from "@/lib/notifications";
import { authWriteLimiter, createRateLimitResponse } from "@/lib/rate-limit";
import { startOfWeek } from "date-fns";

export async function POST(req: Request): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if ((session.user.role as string) !== "OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Rate limit
    const writeRateCheck = authWriteLimiter.check(`write:${session.user.id}`);
    if (!writeRateCheck.allowed) return createRateLimitResponse(writeRateCheck.retryAfterMs);

    // Validate request body
    const body = await req.json();
    const parsed = PromoteMemberSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { memberId } = parsed.data;

    // Look up the member
    const member = await prisma.user.findUnique({
      where: { id: memberId },
      select: { id: true, role: true, status: true, name: true },
    });

    if (!member) {
      return Response.json({ error: "Member not found" }, { status: 404 });
    }

    if (member.role !== "MEMBER") {
      return Response.json(
        { error: "User is already a trainer or owner" },
        { status: 400 }
      );
    }

    if (member.status === "DEPARTED") {
      return Response.json(
        { error: "Cannot promote a departed member" },
        { status: 400 }
      );
    }

    // Use a transaction to atomically promote + clean up
    const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

    const updatedUser = await prisma.$transaction(async (tx) => {
      // 1. Change role to TRAINER, set status to ACTIVE
      const updated = await tx.user.update({
        where: { id: memberId },
        data: { role: "TRAINER", status: "ACTIVE" },
      });

      // 2. Remove future session member assignments
      await tx.sessionMember.deleteMany({
        where: {
          userId: memberId,
          session: { weekDate: { gte: currentWeekStart } },
        },
      });

      // 3. Remove future votes
      await tx.vote.deleteMany({
        where: {
          userId: memberId,
          session: { weekDate: { gte: currentWeekStart } },
        },
      });

      return updated;
    });

    // Send notification (fire-and-forget, outside transaction)
    dispatchNotification({
      userId: memberId,
      type: "ROLE_CHANGED",
      title: "You are now a Trainer",
      body: "Your role has been changed from Member to Trainer. You now have access to trainer features including posting workouts, tracking attendance, and managing private sessions.",
    }).catch((err) => console.error("Failed to send role change notification:", err));

    // Return updated trainer list
    const trainers = await prisma.user.findMany({
      where: { role: "TRAINER" },
      select: { id: true, name: true, email: true, phone: true, status: true, createdAt: true },
      orderBy: { name: "asc" },
    });

    return Response.json({
      data: {
        role: updatedUser.role,
        trainers: trainers.map((t) => ({
          id: t.id,
          name: t.name,
          email: t.email,
          phone: t.phone,
          status: t.status,
          createdAt: t.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error("POST /api/trainers error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- app/api/__tests__/trainers.test.ts`
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add app/api/trainers/route.ts app/api/__tests__/trainers.test.ts
git commit -m "feat: create POST /api/trainers endpoint for member-to-trainer promotion"
```

---

### Task 4: Update i18n translations for new modal

**Files:**
- Modify: `messages/en.json` (trainers section)
- Modify: `messages/mk.json` (trainers section)

**Step 1: Update English translations**

Replace the `trainers` section in `messages/en.json`:

```json
"trainers": {
  "title": "Trainers",
  "count": "{count} trainer(s)",
  "addTrainer": "Add Trainer",
  "noTrainers": "No trainers yet",
  "name": "Name",
  "email": "Email",
  "phone": "Phone",
  "status": "Status",
  "added": "Added",
  "selectMember": "Select a member to promote",
  "searchMembers": "Search members...",
  "noMembers": "No members available to promote",
  "confirmPromote": "Promote {name} to Trainer?",
  "confirmPromoteMessage": "They will no longer appear as a member and won't need to pay membership fees. This action cannot be undone.",
  "promote": "Promote to Trainer",
  "trainerCreated": "Trainer added",
  "trainerCreatedMessage": "{name} has been promoted to trainer.",
  "failedToCreate": "Failed to promote member",
  "loadingMembers": "Loading members..."
}
```

**Step 2: Update Macedonian translations**

Replace the `trainers` section in `messages/mk.json`:

```json
"trainers": {
  "title": "Тренери",
  "count": "{count} тренер(и)",
  "addTrainer": "Додај тренер",
  "noTrainers": "Сè уште нема тренери",
  "name": "Име",
  "email": "Е-пошта",
  "phone": "Телефон",
  "status": "Статус",
  "added": "Додаден",
  "selectMember": "Изберете член за промоција",
  "searchMembers": "Пребарувај членови...",
  "noMembers": "Нема достапни членови за промоција",
  "confirmPromote": "Промовирај го/ја {name} во Тренер?",
  "confirmPromoteMessage": "Повеќе нема да се појавува како член и нема да треба да плаќа членарина. Оваа акција не може да се поврати.",
  "promote": "Промовирај во Тренер",
  "trainerCreated": "Тренерот е додаден",
  "trainerCreatedMessage": "{name} е промовиран/а во тренер.",
  "failedToCreate": "Неуспешна промоција на член",
  "loadingMembers": "Вчитување членови..."
}
```

**Step 3: Commit**

```bash
git add messages/en.json messages/mk.json
git commit -m "feat: update i18n translations for promote-member-to-trainer modal"
```

---

### Task 5: Rewrite TrainersClient modal UI

**Files:**
- Modify: `app/(owner)/trainers/TrainersClient.tsx`

**Step 1: Rewrite the component**

Replace the entire `TrainersClient.tsx` with the new implementation that:
- Fetches active members from `/api/members` when modal opens
- Shows a searchable list of members (filter by name/email)
- On member selection, shows a confirmation step
- On confirm, calls `POST /api/trainers` with `{ memberId }`
- On success, refreshes the trainer list

```typescript
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

interface TrainerData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  createdAt: string;
}

interface MemberOption {
  id: string;
  name: string;
  email: string;
  status: string;
}

interface TrainersClientProps {
  trainers: TrainerData[];
}

export function TrainersClient({
  trainers,
}: TrainersClientProps): React.ReactElement {
  const router = useRouter();
  const { addToast } = useToast();
  const t = useTranslations("trainers");
  const tCommon = useTranslations("common");
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<MemberOption | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Fetch members when modal opens
  useEffect(() => {
    if (!showModal) return;
    setLoadingMembers(true);
    fetch("/api/members")
      .then((res) => res.json())
      .then((data: { data: MemberOption[] }) => {
        const active = data.data.filter(
          (m: MemberOption) => m.status !== "DEPARTED"
        );
        setMembers(active);
      })
      .catch(() => {
        addToast({ type: "error", title: tCommon("networkError") });
      })
      .finally(() => setLoadingMembers(false));
  }, [showModal, addToast, tCommon]);

  const filteredMembers = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.toLowerCase();
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
    );
  }, [members, search]);

  function resetModal(): void {
    setSearch("");
    setSelectedMember(null);
    setShowConfirm(false);
    setMembers([]);
  }

  function handleClose(): void {
    setShowModal(false);
    resetModal();
  }

  function handleSelectMember(member: MemberOption): void {
    setSelectedMember(member);
    setShowConfirm(true);
  }

  function handleBackToList(): void {
    setSelectedMember(null);
    setShowConfirm(false);
  }

  async function handlePromote(): Promise<void> {
    if (!selectedMember) return;
    setLoading(true);
    try {
      const res = await fetch("/api/trainers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: selectedMember.id }),
      });

      if (res.ok) {
        addToast({
          type: "success",
          title: t("trainerCreated"),
          message: t("trainerCreatedMessage", { name: selectedMember.name }),
        });
        handleClose();
        router.refresh();
      } else {
        const data: { error: string } = await res.json();
        addToast({
          type: "error",
          title: t("failedToCreate"),
          message: data.error,
        });
      }
    } catch {
      addToast({ type: "error", title: tCommon("networkError") });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-100">{t("title")}</h1>
          <p className="mt-1 text-sm text-surface-400">
            {t("count", { count: trainers.length })}
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowModal(true)}
        >
          {t("addTrainer")}
        </Button>
      </div>

      {/* Trainers list */}
      {trainers.length === 0 ? (
        <Card>
          <div className="py-12 text-center">
            <svg
              className="mx-auto mb-3 h-10 w-10 text-surface-600"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
            </svg>
            <p className="text-sm text-surface-500">{t("noTrainers")}</p>
          </div>
        </Card>
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-700 text-left">
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-surface-500">
                    {t("name")}
                  </th>
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-surface-500">
                    {t("email")}
                  </th>
                  <th className="hidden px-6 py-3 text-xs font-medium uppercase tracking-wide text-surface-500 sm:table-cell">
                    {t("phone")}
                  </th>
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-surface-500">
                    {t("status")}
                  </th>
                  <th className="hidden px-6 py-3 text-xs font-medium uppercase tracking-wide text-surface-500 md:table-cell">
                    {t("added")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700/50">
                {trainers.map((trainer) => (
                  <tr
                    key={trainer.id}
                    className="transition-colors hover:bg-surface-800/80"
                  >
                    <td className="px-6 py-3">
                      <p className="text-sm font-medium text-surface-200">
                        {trainer.name}
                      </p>
                    </td>
                    <td className="px-6 py-3 text-sm text-surface-400">
                      {trainer.email}
                    </td>
                    <td className="hidden px-6 py-3 text-sm text-surface-400 sm:table-cell">
                      {trainer.phone || "—"}
                    </td>
                    <td className="px-6 py-3">
                      <Badge
                        variant={
                          trainer.status === "ACTIVE" ? "success" : "default"
                        }
                        size="sm"
                      >
                        {trainer.status}
                      </Badge>
                    </td>
                    <td className="hidden px-6 py-3 text-sm text-surface-500 md:table-cell">
                      {format(new Date(trainer.createdAt), "MMM d, yyyy")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Promote Member Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleClose}
        title={t("addTrainer")}
      >
        {showConfirm && selectedMember ? (
          /* Confirmation step */
          <div className="space-y-4">
            <p className="text-sm font-medium text-surface-200">
              {t("confirmPromote", { name: selectedMember.name })}
            </p>
            <p className="text-sm text-surface-400">
              {t("confirmPromoteMessage")}
            </p>
            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="primary"
                loading={loading}
                onClick={handlePromote}
              >
                {t("promote")}
              </Button>
              <Button variant="ghost" onClick={handleBackToList}>
                {tCommon("cancel")}
              </Button>
            </div>
          </div>
        ) : (
          /* Member selection step */
          <div className="space-y-4">
            <p className="text-sm text-surface-400">{t("selectMember")}</p>
            <Input
              placeholder={t("searchMembers")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {loadingMembers ? (
              <p className="py-4 text-center text-sm text-surface-500">
                {t("loadingMembers")}
              </p>
            ) : filteredMembers.length === 0 ? (
              <p className="py-4 text-center text-sm text-surface-500">
                {t("noMembers")}
              </p>
            ) : (
              <div className="max-h-60 overflow-y-auto rounded-lg border border-surface-700">
                {filteredMembers.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-surface-800/80 border-b border-surface-700/50 last:border-b-0"
                    onClick={() => handleSelectMember(member)}
                  >
                    <div>
                      <p className="text-sm font-medium text-surface-200">
                        {member.name}
                      </p>
                      <p className="text-xs text-surface-400">{member.email}</p>
                    </div>
                    <Badge
                      variant={member.status === "ACTIVE" ? "success" : "default"}
                      size="sm"
                    >
                      {member.status}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 pt-2">
              <Button variant="ghost" onClick={handleClose}>
                {tCommon("cancel")}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add app/(owner)/trainers/TrainersClient.tsx
git commit -m "feat: rewrite TrainersClient modal to promote members to trainers"
```

---

### Task 6: Run full test suite and verify build

**Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass.

**Step 2: Run lint**

Run: `npm run lint`
Expected: No new warnings beyond the known pre-existing ones.

**Step 3: Run production build**

Run: `npm run build`
Expected: Build succeeds.

**Step 4: Commit (if any fixes were needed)**

Only commit if Task 6 required fixes. Otherwise skip.

---

### Task 7: Manual verification

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Test the feature**

1. Log in as owner
2. Navigate to `/owner/trainers`
3. Click "Add Trainer"
4. Verify member list appears with search
5. Select a member
6. Verify confirmation dialog appears
7. Click "Promote to Trainer"
8. Verify success toast and trainer list updates
9. Log out and log in as the promoted user — verify they see the trainer dashboard

**Step 3: Final commit if needed**
