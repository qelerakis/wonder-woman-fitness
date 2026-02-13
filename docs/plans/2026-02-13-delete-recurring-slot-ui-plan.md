# Delete Recurring Slot UI — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow the owner to permanently delete a recurring time slot from the session detail page, with the choice to also delete all upcoming sessions generated from it.

**Architecture:** Extend the existing `DELETE /api/recurring-slots` endpoint with an optional `deleteFutureSessions` flag. Add a `DeleteRecurringSlotModal` component using the existing `Modal` UI. Wire it into `SessionDetailClient` behind a conditional button that only shows for recurring sessions.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma (transactions), Zod, Tailwind CSS 4, Vitest

**Design doc:** `docs/plans/2026-02-13-delete-recurring-slot-ui-design.md`

---

### Task 1: Extend the DELETE /api/recurring-slots API

**Files:**
- Modify: `app/api/recurring-slots/route.ts` (the DELETE handler, lines 95-144)
- Test: `app/api/__tests__/recurring-slots.test.ts`

**Context:**
- The existing DELETE handler accepts `{ id }` and deletes the RecurringSlot only.
- Sessions have `onDelete: Cascade` on SessionMember, SessionTrainer, and Vote — so deleting a Session auto-cleans related records.
- Sessions do NOT cascade-delete when a RecurringSlot is deleted (no `onDelete: Cascade` on that relation).
- `dispatchNotificationToMany` is imported from `@/lib/notifications`.
- `getWeekStart` is imported from `@/lib/session-generation`.
- `DAY_NAMES` is imported from `@/lib/constants`.

**Step 1: Write the new tests for deleteFutureSessions behavior**

Add these tests to the existing `DELETE /api/recurring-slots` describe block in `app/api/__tests__/recurring-slots.test.ts`.

First, extend the mock at the top of the file — add session-related mocks and notification mock:

```typescript
// Add to the existing mockPrisma object (around line 14):
const mockPrisma = {
  recurringSlot: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  session: {
    findMany: vi.fn(),
    delete: vi.fn(),
  },
  $transaction: vi.fn((fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma)),
};

// Add notification mock after the prisma mock:
const mockDispatchNotificationToMany = vi.fn().mockResolvedValue([]);
vi.mock("@/lib/notifications", () => ({
  dispatchNotificationToMany: (...args: unknown[]) => mockDispatchNotificationToMany(...args),
}));

// Add session-generation mock:
vi.mock("@/lib/session-generation", () => ({
  getWeekStart: (date: Date) => {
    const d = new Date(date);
    const day = d.getUTCDay();
    const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
  },
}));
```

Then add these test cases inside the `DELETE /api/recurring-slots` describe block:

```typescript
it("deletes slot only when deleteFutureSessions is false", async () => {
  mockAuth.mockResolvedValue(ownerSession());
  mockPrisma.recurringSlot.findUnique.mockResolvedValue({
    id: "slot-1",
    dayOfWeek: 1,
    startHour: 9,
  });
  mockPrisma.recurringSlot.delete.mockResolvedValue({});

  const { DELETE } = await import("@/app/api/recurring-slots/route");
  const response = await DELETE(
    new Request("http://localhost/api/recurring-slots", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "slot-1", deleteFutureSessions: false }),
    })
  );
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(body.data.deletedSlot).toBe(true);
  expect(body.data.deletedSessionsCount).toBe(0);
  expect(mockPrisma.session.findMany).not.toHaveBeenCalled();
});

it("deletes slot and future sessions when deleteFutureSessions is true", async () => {
  mockAuth.mockResolvedValue(ownerSession());
  mockPrisma.recurringSlot.findUnique.mockResolvedValue({
    id: "slot-1",
    dayOfWeek: 1,
    startHour: 9,
  });
  mockPrisma.session.findMany.mockResolvedValue([
    {
      id: "session-1",
      members: [{ user: { id: "member-1" } }, { user: { id: "member-2" } }],
    },
    {
      id: "session-2",
      members: [{ user: { id: "member-3" } }],
    },
  ]);
  mockPrisma.session.delete.mockResolvedValue({});
  mockPrisma.recurringSlot.delete.mockResolvedValue({});

  const { DELETE } = await import("@/app/api/recurring-slots/route");
  const response = await DELETE(
    new Request("http://localhost/api/recurring-slots", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "slot-1", deleteFutureSessions: true }),
    })
  );
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(body.data.deletedSlot).toBe(true);
  expect(body.data.deletedSessionsCount).toBe(2);
  expect(mockPrisma.session.delete).toHaveBeenCalledTimes(2);
  expect(mockDispatchNotificationToMany).toHaveBeenCalled();
});

it("handles deleteFutureSessions true with no future sessions", async () => {
  mockAuth.mockResolvedValue(ownerSession());
  mockPrisma.recurringSlot.findUnique.mockResolvedValue({
    id: "slot-1",
    dayOfWeek: 1,
    startHour: 9,
  });
  mockPrisma.session.findMany.mockResolvedValue([]);
  mockPrisma.recurringSlot.delete.mockResolvedValue({});

  const { DELETE } = await import("@/app/api/recurring-slots/route");
  const response = await DELETE(
    new Request("http://localhost/api/recurring-slots", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "slot-1", deleteFutureSessions: true }),
    })
  );
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(body.data.deletedSessionsCount).toBe(0);
});

it("defaults deleteFutureSessions to false when not provided (backward compat)", async () => {
  mockAuth.mockResolvedValue(ownerSession());
  mockPrisma.recurringSlot.findUnique.mockResolvedValue({
    id: "slot-1",
    dayOfWeek: 1,
    startHour: 9,
  });
  mockPrisma.recurringSlot.delete.mockResolvedValue({});

  const { DELETE } = await import("@/app/api/recurring-slots/route");
  const response = await DELETE(
    new Request("http://localhost/api/recurring-slots", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "slot-1" }),
    })
  );
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(body.data.deletedSlot).toBe(true);
  expect(body.data.deletedSessionsCount).toBe(0);
  expect(mockPrisma.session.findMany).not.toHaveBeenCalled();
});
```

**Step 2: Run the tests to verify they fail**

Run: `npm test -- app/api/__tests__/recurring-slots.test.ts`
Expected: New tests FAIL (response shape doesn't match, transaction not used yet)

**Step 3: Implement the extended DELETE handler**

Replace the DELETE function in `app/api/recurring-slots/route.ts`:

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RecurringSlotSchema } from "@/types";
import { z } from "zod";
import { getWeekStart } from "@/lib/session-generation";
import { dispatchNotificationToMany } from "@/lib/notifications";
import { DAY_NAMES } from "@/lib/constants";

// ... GET and POST stay the same ...

const DeleteSchema = z.object({
  id: z.string().min(1, "Slot ID is required"),
  deleteFutureSessions: z.boolean().default(false),
});

export async function DELETE(req: Request): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if ((session.user.role as string) !== "OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = DeleteSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { id, deleteFutureSessions } = parsed.data;

    const existing = await prisma.recurringSlot.findUnique({
      where: { id },
    });

    if (!existing) {
      return Response.json(
        { error: "Recurring slot not found" },
        { status: 404 }
      );
    }

    let deletedSessionsCount = 0;

    if (deleteFutureSessions) {
      const currentWeekStart = getWeekStart(new Date());

      // Find all sessions from current week onward for this slot
      const futureSessions = await prisma.session.findMany({
        where: {
          recurringSlotId: id,
          weekDate: { gte: currentWeekStart },
        },
        include: {
          members: {
            include: {
              user: { select: { id: true } },
            },
          },
        },
      });

      // Notify members and delete sessions within a transaction
      await prisma.$transaction(async (tx) => {
        const dayName = DAY_NAMES[existing.dayOfWeek] || "Unknown";
        for (const sess of futureSessions) {
          const memberIds = sess.members.map((m) => m.user.id);
          if (memberIds.length > 0) {
            await dispatchNotificationToMany(
              memberIds,
              "SESSION_DELETED",
              `${dayName} ${existing.startHour}:00 class removed`,
              `The ${dayName} ${existing.startHour}:00 recurring class has been permanently removed from the schedule.`
            );
          }
          // Cascade delete handles votes, session_members, session_trainers
          await tx.session.delete({ where: { id: sess.id } });
        }

        await tx.recurringSlot.delete({ where: { id } });
      });

      deletedSessionsCount = futureSessions.length;
    } else {
      await prisma.recurringSlot.delete({ where: { id } });
    }

    return Response.json({
      data: { deletedSlot: true, deletedSessionsCount },
    });
  } catch (error) {
    console.error("DELETE /api/recurring-slots error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

**Step 4: Run the tests to verify they pass**

Run: `npm test -- app/api/__tests__/recurring-slots.test.ts`
Expected: ALL tests pass (existing + new)

**Step 5: Run the full test suite to check for regressions**

Run: `npm test`
Expected: All 281+ tests pass

**Step 6: Commit**

```bash
git add app/api/recurring-slots/route.ts app/api/__tests__/recurring-slots.test.ts
git commit -m "feat: extend DELETE /api/recurring-slots with deleteFutureSessions option"
```

---

### Task 2: Pass recurringSlotId to SessionDetailClient

**Files:**
- Modify: `app/(owner)/owner/session/[id]/page.tsx` (line 100-103, the serialization block)
- Modify: `app/(owner)/owner/session/[id]/SessionDetailClient.tsx` (lines 17-41, SessionData interface)

**Context:**
- The server page already fetches `recurringSlot` via `include: { recurringSlot: true }`.
- The client gets `recurringSlot: { dayOfWeek, startHour } | null` but NOT the slot's `id`.
- We need the slot `id` to call `DELETE /api/recurring-slots`.
- The session record itself has `recurringSlotId` which is a direct field.

**Step 1: Add `recurringSlotId` to the SessionData interface**

In `SessionDetailClient.tsx`, update the `SessionData` interface (line 17):

```typescript
interface SessionData {
  id: string;
  weekDate: string;
  status: string;
  workoutTitle: string | null;
  workoutDetails: string | null;
  votingEnabled: boolean;
  recurringSlotId: string | null;        // <-- ADD THIS
  recurringSlot: {
    dayOfWeek: number;
    startHour: number;
  } | null;
  customDay: number | null;
  customStartHour: number | null;
  members: Array<{
    userId: string;
    name: string;
    email: string;
    status: string;
  }>;
  trainers: Array<{
    userId: string;
    name: string;
    email: string;
  }>;
}
```

**Step 2: Pass the value from the server page**

In `page.tsx`, add `recurringSlotId` to the serialized session object (around line 93-103):

```typescript
  return (
    <SessionDetailClient
      session={{
        id: session.id,
        weekDate: session.weekDate.toISOString(),
        status: session.status,
        workoutTitle: session.workoutTitle,
        workoutDetails: session.workoutDetails,
        votingEnabled: session.votingEnabled,
        recurringSlotId: session.recurringSlotId,  // <-- ADD THIS
        recurringSlot: session.recurringSlot ? {
          dayOfWeek: session.recurringSlot.dayOfWeek,
          startHour: session.recurringSlot.startHour,
        } : null,
        customDay: session.customDay,
        customStartHour: session.customStartHour,
        // ... rest stays same
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: Zero errors

**Step 4: Commit**

```bash
git add "app/(owner)/owner/session/[id]/page.tsx" "app/(owner)/owner/session/[id]/SessionDetailClient.tsx"
git commit -m "feat: pass recurringSlotId to SessionDetailClient"
```

---

### Task 3: Create DeleteRecurringSlotModal component

**Files:**
- Create: `components/schedule/DeleteRecurringSlotModal.tsx`

**Context:**
- Use the existing `Modal` component from `@/components/ui/Modal`.
- Use the existing `Button` component from `@/components/ui/Button`.
- `DAY_NAMES` from `@/lib/constants` maps 1-7 to day names.
- `formatTime` from `@/components/schedule/SessionCard` formats hours to "9:00 AM" style.
- The component calls `DELETE /api/recurring-slots` with `{ id, deleteFutureSessions }`.
- After success it calls `onDeleted()` which the parent uses to redirect.

**Step 1: Create the modal component**

Create `components/schedule/DeleteRecurringSlotModal.tsx`:

```typescript
"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { DAY_NAMES } from "@/lib/constants";
import { formatTime } from "@/components/schedule/SessionCard";

interface DeleteRecurringSlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  slotId: string;
  dayOfWeek: number;
  startHour: number;
  onDeleted: () => void;
}

export function DeleteRecurringSlotModal({
  isOpen,
  onClose,
  slotId,
  dayOfWeek,
  startHour,
  onDeleted,
}: DeleteRecurringSlotModalProps): React.ReactElement | null {
  const [deleteFutureSessions, setDeleteFutureSessions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dayName = DAY_NAMES[dayOfWeek] || "Unknown";
  const time = formatTime(startHour);

  async function handleDelete(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/recurring-slots", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: slotId, deleteFutureSessions }),
      });

      if (res.ok) {
        onDeleted();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to delete recurring slot");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleClose(): void {
    if (!loading) {
      setDeleteFutureSessions(false);
      setError(null);
      onClose();
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Delete Recurring Slot" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-surface-300">
          Permanently remove the <span className="font-semibold text-surface-100">{dayName} {time}</span> recurring slot.
        </p>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-surface-200">What should happen?</legend>

          <label className="flex items-start gap-3 rounded-lg border border-surface-700 p-3 cursor-pointer hover:border-surface-500 transition-colors">
            <input
              type="radio"
              name="deleteMode"
              checked={!deleteFutureSessions}
              onChange={() => setDeleteFutureSessions(false)}
              className="mt-0.5 accent-primary-500"
            />
            <div>
              <p className="text-sm font-medium text-surface-100">Stop future generation only</p>
              <p className="text-xs text-surface-400 mt-0.5">
                The slot template will be removed. Already scheduled sessions stay on the calendar.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-surface-700 p-3 cursor-pointer hover:border-surface-500 transition-colors">
            <input
              type="radio"
              name="deleteMode"
              checked={deleteFutureSessions}
              onChange={() => setDeleteFutureSessions(true)}
              className="mt-0.5 accent-primary-500"
            />
            <div>
              <p className="text-sm font-medium text-surface-100">Delete slot and all upcoming sessions</p>
              <p className="text-xs text-surface-400 mt-0.5">
                Removes the template and all sessions from this week onward. Past sessions are kept for records. Members will be notified.
              </p>
            </div>
          </label>
        </fieldset>

        {error && (
          <p className="text-sm text-error-400">{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={handleDelete} loading={loading}>
            Delete
          </Button>
        </div>
      </div>
    </Modal>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: Zero errors

**Step 3: Commit**

```bash
git add components/schedule/DeleteRecurringSlotModal.tsx
git commit -m "feat: add DeleteRecurringSlotModal component"
```

---

### Task 4: Wire the modal into SessionDetailClient

**Files:**
- Modify: `app/(owner)/owner/session/[id]/SessionDetailClient.tsx`

**Context:**
- Import and render `DeleteRecurringSlotModal`.
- Add a "Delete Recurring Slot" button that only shows when `session.recurringSlotId` is not null.
- On successful deletion: show toast and redirect to `/owner/schedule`.
- Place the button next to the existing "Delete Session" button (line 254-261).

**Step 1: Add import, state, and handler**

At the top of `SessionDetailClient.tsx`, add the import (after line 13):

```typescript
import { DeleteRecurringSlotModal } from "@/components/schedule/DeleteRecurringSlotModal";
```

Inside the component function (around line 60, after the existing state declarations), add:

```typescript
const [showDeleteSlotModal, setShowDeleteSlotModal] = useState(false);
```

Add a handler function (after `handleDeleteSession`, around line 154):

```typescript
function handleSlotDeleted(): void {
  setShowDeleteSlotModal(false);
  addToast({ type: "success", title: "Recurring slot deleted" });
  router.push("/owner/schedule");
}
```

**Step 2: Add the button to the header actions**

After the "Delete Session" button (after line 261, before the closing `</div>`), add:

```typescript
{session.recurringSlotId && session.recurringSlot && (
  <Button
    variant="secondary"
    size="sm"
    onClick={() => setShowDeleteSlotModal(true)}
  >
    Delete Recurring Slot
  </Button>
)}
```

**Step 3: Render the modal**

At the very end of the component's return JSX, just before the final closing `</div>` (line 338), add:

```typescript
{session.recurringSlotId && session.recurringSlot && (
  <DeleteRecurringSlotModal
    isOpen={showDeleteSlotModal}
    onClose={() => setShowDeleteSlotModal(false)}
    slotId={session.recurringSlotId}
    dayOfWeek={session.recurringSlot.dayOfWeek}
    startHour={session.recurringSlot.startHour}
    onDeleted={handleSlotDeleted}
  />
)}
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: Zero errors

**Step 5: Verify lint passes**

Run: `npm run lint`
Expected: Zero warnings/errors (besides pre-existing ones)

**Step 6: Commit**

```bash
git add "app/(owner)/owner/session/[id]/SessionDetailClient.tsx"
git commit -m "feat: wire DeleteRecurringSlotModal into session detail page"
```

---

### Task 5: Manual testing and final verification

**Step 1: Run the full test suite**

Run: `npm test`
Expected: All tests pass (existing 281+ new tests)

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: Zero errors

**Step 3: Run lint**

Run: `npm run lint`
Expected: No new warnings

**Step 4: Manual smoke test**

1. Open http://localhost:3000 and log in as `owner@wonderwomanfitness.mk` / `Owner123!`
2. Go to the schedule page, click on a recurring session (e.g. Monday 9 AM)
3. Verify "Delete Recurring Slot" button appears
4. Click it — verify the modal opens with two radio options
5. Test "Stop future generation only" — slot should be removed, session stays
6. Re-seed the database (`npx prisma migrate reset`) to restore data
7. Test "Delete slot and all upcoming sessions" — slot + future sessions should be removed
8. Navigate to a one-off session (if any) — verify "Delete Recurring Slot" button does NOT appear

**Step 5: Final commit with all changes**

If any fixes were needed during testing, commit them:

```bash
git add -A
git commit -m "feat: complete delete recurring slot UI feature"
```
