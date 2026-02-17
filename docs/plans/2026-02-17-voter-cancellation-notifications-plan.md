# Voter Cancellation Notifications — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When a session is cancelled or deleted, notify attending voters (not just assigned members) and include the specific date in the notification message.

**Architecture:** The fix touches 3 existing API route files. Each route already sends notifications to `SessionMember` users on cancel/delete, but when `votingEnabled` is true, member assignments are empty (cleared when voting is enabled). The fix: check `votingEnabled` and pull recipients from the `votes` table (where `attending = true`) instead. Also adds the specific session date (e.g., "Monday, Mar 9") to all cancel/delete notification messages using `getSessionDateTime` from `lib/session-generation.ts` and `date-fns` `format`.

**Tech Stack:** Next.js API routes, Prisma, date-fns, Vitest

---

## Task 1: Add helper to format session date for notifications

**Files:**
- Modify: `app/api/sessions/[id]/route.ts:1-13` (add imports)

We need a small inline helper (or import) to format the session date. Since `getSessionDateTime(weekDate, dayOfWeek, startHour)` returns a `Date`, we can use `date-fns` `format` to produce `"Monday, Mar 9"`. We'll extract a shared helper to avoid duplication across the 2 route files.

**Step 1: Create a notification formatting helper**

Add a utility function in `lib/notifications.ts` since it's notification-specific:

```typescript
// Add to lib/notifications.ts

import { format } from 'date-fns';
import { getSessionDateTime } from './session-generation';
import { DAY_NAMES } from './constants';

/**
 * Build the recipient list for a session cancel/delete notification.
 * If votingEnabled, uses attending voters; otherwise uses assigned members.
 */
export function getSessionNotificationRecipients(
  session: {
    votingEnabled: boolean;
    members: { user: { id: string } }[];
    votes?: { userId: string; attending: boolean }[];
  }
): string[] {
  if (session.votingEnabled && session.votes) {
    return session.votes
      .filter((v) => v.attending)
      .map((v) => v.userId);
  }
  return session.members.map((m) => m.user.id);
}

/**
 * Format the session date for notification messages.
 * Returns e.g. "Monday, Mar 9 at 9:00"
 */
export function formatSessionForNotification(
  weekDate: Date,
  dayOfWeek: number,
  startHour: number
): { dayName: string; dateStr: string } {
  const dayName = DAY_NAMES[dayOfWeek] || 'Unknown';
  const sessionDate = getSessionDateTime(weekDate, dayOfWeek, startHour);
  const dateStr = format(sessionDate, 'MMM d');
  return { dayName, dateStr };
}
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS (no errors)

**Step 3: Commit**

```bash
git add lib/notifications.ts
git commit -m "feat: add helper functions for voter-aware notification recipients and date formatting"
```

---

## Task 2: Write failing tests for cancel (PATCH) with voting-enabled sessions

**Files:**
- Modify: `app/api/__tests__/sessions.test.ts`

**Step 1: Write the failing tests**

Add these tests inside the existing `describe("PATCH /api/sessions/[id]")` block, after the existing "allows owner to cancel session" test:

```typescript
it("cancelling a voting-enabled session notifies attending voters", async () => {
  const { dispatchNotificationToMany } = await import("@/lib/notifications");

  mockAuth.mockResolvedValue(ownerSession());
  mockPrisma.session.findUnique.mockResolvedValue({
    id: "s-1",
    status: "SCHEDULED",
    votingEnabled: true,
    weekDate: new Date("2026-03-09T00:00:00.000Z"), // Monday
    trainers: [],
    members: [], // empty when voting is enabled
    votes: [
      { userId: "m-1", attending: true, id: "v-1", votedAt: new Date() },
      { userId: "m-2", attending: false, id: "v-2", votedAt: new Date() },
      { userId: "m-3", attending: true, id: "v-3", votedAt: new Date() },
    ],
    recurringSlot: { dayOfWeek: 1, startHour: 9 },
  });
  mockPrisma.session.update.mockResolvedValue({
    id: "s-1",
    status: "CANCELLED",
    recurringSlot: { dayOfWeek: 1, startHour: 9 },
    members: [],
  });

  const { PATCH } = await import("@/app/api/sessions/[id]/route");
  await PATCH(
    new Request("http://localhost/api/sessions/s-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED" }),
    }),
    { params: Promise.resolve({ id: "s-1" }) }
  );

  // Should notify only attending voters (m-1, m-3), NOT m-2
  expect(dispatchNotificationToMany).toHaveBeenCalledWith(
    ["m-1", "m-3"],
    "CLASS_CANCELLED",
    expect.stringContaining("Monday"),
    expect.stringContaining("cancelled")
  );
});

it("cancelling a non-voting session still notifies assigned members", async () => {
  const { dispatchNotificationToMany } = await import("@/lib/notifications");

  mockAuth.mockResolvedValue(ownerSession());
  mockPrisma.session.findUnique.mockResolvedValue({
    id: "s-1",
    status: "SCHEDULED",
    votingEnabled: false,
    weekDate: new Date("2026-03-09T00:00:00.000Z"),
    trainers: [],
    members: [
      { user: { id: "m-1", name: "Alice" } },
      { user: { id: "m-2", name: "Bob" } },
    ],
    votes: [],
    recurringSlot: { dayOfWeek: 1, startHour: 9 },
  });
  mockPrisma.session.update.mockResolvedValue({
    id: "s-1",
    status: "CANCELLED",
    recurringSlot: { dayOfWeek: 1, startHour: 9 },
    members: [],
  });

  const { PATCH } = await import("@/app/api/sessions/[id]/route");
  await PATCH(
    new Request("http://localhost/api/sessions/s-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED" }),
    }),
    { params: Promise.resolve({ id: "s-1" }) }
  );

  expect(dispatchNotificationToMany).toHaveBeenCalledWith(
    ["m-1", "m-2"],
    "CLASS_CANCELLED",
    expect.stringContaining("Monday"),
    expect.stringContaining("cancelled")
  );
});

it("cancel notification includes the specific date", async () => {
  const { dispatchNotificationToMany } = await import("@/lib/notifications");

  mockAuth.mockResolvedValue(ownerSession());
  mockPrisma.session.findUnique.mockResolvedValue({
    id: "s-1",
    status: "SCHEDULED",
    votingEnabled: false,
    weekDate: new Date("2026-03-09T00:00:00.000Z"), // Monday March 9
    trainers: [],
    members: [{ user: { id: "m-1", name: "Alice" } }],
    votes: [],
    recurringSlot: { dayOfWeek: 3, startHour: 18 }, // Wednesday
  });
  mockPrisma.session.update.mockResolvedValue({
    id: "s-1",
    status: "CANCELLED",
    recurringSlot: { dayOfWeek: 3, startHour: 18 },
    members: [],
  });

  const { PATCH } = await import("@/app/api/sessions/[id]/route");
  await PATCH(
    new Request("http://localhost/api/sessions/s-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED" }),
    }),
    { params: Promise.resolve({ id: "s-1" }) }
  );

  // Title should include "Mar 11" (Wednesday of week starting March 9)
  expect(dispatchNotificationToMany).toHaveBeenCalledWith(
    ["m-1"],
    "CLASS_CANCELLED",
    expect.stringContaining("Mar 11"),
    expect.stringContaining("cancelled")
  );
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- app/api/__tests__/sessions.test.ts`
Expected: FAIL — the current code doesn't include `votes` in the fetch, doesn't check `votingEnabled`, and doesn't include the date in the notification title.

---

## Task 3: Implement cancel (PATCH) voter notifications + date formatting

**Files:**
- Modify: `app/api/sessions/[id]/route.ts:1-14` (add imports)
- Modify: `app/api/sessions/[id]/route.ts:94-105` (add votes to findUnique include)
- Modify: `app/api/sessions/[id]/route.ts:144-159` (update cancel notification logic)

**Step 1: Add imports**

Add at the top of `app/api/sessions/[id]/route.ts`:

```typescript
import { getSessionNotificationRecipients, formatSessionForNotification } from "@/lib/notifications";
```

**Step 2: Include `votes` and `weekDate` in the PATCH handler's `findUnique`**

In the PATCH handler, the existing `findUnique` on line 94 already includes `members` and `recurringSlot`. Add `votes` and ensure the session-level fields are available:

```typescript
const existingSession = await prisma.session.findUnique({
  where: { id },
  include: {
    trainers: { select: { userId: true } },
    members: {
      include: {
        user: { select: { id: true, name: true } },
      },
    },
    votes: {
      select: { userId: true, attending: true },
    },
    recurringSlot: true,
  },
});
```

**Step 3: Update the cancellation notification block (lines 144-159)**

Replace the existing cancellation block:

```typescript
// Handle cancellation with notifications
if (parsed.data.status === "CANCELLED" && existingSession.status !== "CANCELLED") {
  updateData.status = "CANCELLED";

  // Notify: assigned members (non-voting) or attending voters (voting-enabled)
  const recipientIds = getSessionNotificationRecipients(existingSession);
  if (recipientIds.length > 0) {
    const dayOfWeek = existingSession.recurringSlot?.dayOfWeek ?? existingSession.customDay ?? 0;
    const startHour = existingSession.recurringSlot?.startHour ?? existingSession.customStartHour ?? 0;
    const { dayName, dateStr } = formatSessionForNotification(existingSession.weekDate, dayOfWeek, startHour);
    await dispatchNotificationToMany(
      recipientIds,
      "CLASS_CANCELLED",
      `${dayName}, ${dateStr} at ${startHour}:00 class cancelled`,
      `The ${dayName}, ${dateStr} at ${startHour}:00 class has been cancelled. Please check the schedule for alternatives.`
    );
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- app/api/__tests__/sessions.test.ts`
Expected: PASS — all new tests should pass, and the existing cancel test should also pass (it uses `expect.stringContaining("Monday")` which still matches)

**Step 5: Commit**

```bash
git add app/api/sessions/[id]/route.ts app/api/__tests__/sessions.test.ts
git commit -m "feat: notify attending voters on session cancel, include date in notification"
```

---

## Task 4: Write failing tests for delete (DELETE) with voting-enabled sessions

**Files:**
- Modify: `app/api/__tests__/sessions.test.ts`

**Step 1: Write the failing tests**

Add inside the existing `describe("DELETE /api/sessions/[id]")` block:

```typescript
it("deleting a voting-enabled session notifies attending voters", async () => {
  const { dispatchNotificationToMany } = await import("@/lib/notifications");

  mockAuth.mockResolvedValue(ownerSession());
  mockPrisma.session.findUnique.mockResolvedValue({
    id: "s-1",
    votingEnabled: true,
    weekDate: new Date("2026-03-09T00:00:00.000Z"),
    members: [],
    votes: [
      { userId: "m-1", attending: true },
      { userId: "m-2", attending: false },
    ],
    recurringSlot: { dayOfWeek: 1, startHour: 9 },
  });
  mockPrisma.session.delete.mockResolvedValue({});

  const { DELETE } = await import("@/app/api/sessions/[id]/route");
  await DELETE(
    new Request("http://localhost/api/sessions/s-1", { method: "DELETE" }),
    { params: Promise.resolve({ id: "s-1" }) }
  );

  // Should only notify m-1 (attending), not m-2
  expect(dispatchNotificationToMany).toHaveBeenCalledWith(
    ["m-1"],
    "SESSION_DELETED",
    expect.stringContaining("Monday"),
    expect.any(String)
  );
});

it("delete notification includes the specific date", async () => {
  const { dispatchNotificationToMany } = await import("@/lib/notifications");

  mockAuth.mockResolvedValue(ownerSession());
  mockPrisma.session.findUnique.mockResolvedValue({
    id: "s-1",
    votingEnabled: false,
    weekDate: new Date("2026-03-09T00:00:00.000Z"),
    members: [{ user: { id: "m-1" } }],
    votes: [],
    recurringSlot: { dayOfWeek: 5, startHour: 14 }, // Friday
  });
  mockPrisma.session.delete.mockResolvedValue({});

  const { DELETE } = await import("@/app/api/sessions/[id]/route");
  await DELETE(
    new Request("http://localhost/api/sessions/s-1", { method: "DELETE" }),
    { params: Promise.resolve({ id: "s-1" }) }
  );

  // Friday of week starting March 9 = March 13
  expect(dispatchNotificationToMany).toHaveBeenCalledWith(
    ["m-1"],
    "SESSION_DELETED",
    expect.stringContaining("Mar 13"),
    expect.any(String)
  );
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- app/api/__tests__/sessions.test.ts`
Expected: FAIL — DELETE handler doesn't include `votes` in its fetch, doesn't check `votingEnabled`

---

## Task 5: Implement delete (DELETE) voter notifications + date formatting

**Files:**
- Modify: `app/api/sessions/[id]/route.ts:241-269` (DELETE handler)

**Step 1: Include `votes` in the DELETE handler's `findUnique`**

Update the `findUnique` in the DELETE handler to also fetch `votes` and ensure `votingEnabled`/`weekDate` are read:

```typescript
const existing = await prisma.session.findUnique({
  where: { id },
  include: {
    members: {
      include: {
        user: { select: { id: true } },
      },
    },
    votes: {
      select: { userId: true, attending: true },
    },
    recurringSlot: true,
  },
});
```

**Step 2: Update the notification block**

Replace lines 258-269:

```typescript
// Notify: assigned members (non-voting) or attending voters (voting-enabled)
const recipientIds = getSessionNotificationRecipients(existing);
if (recipientIds.length > 0) {
  const dayOfWeek = existing.recurringSlot?.dayOfWeek ?? existing.customDay ?? 0;
  const startHour = existing.recurringSlot?.startHour ?? existing.customStartHour ?? 0;
  const { dayName, dateStr } = formatSessionForNotification(existing.weekDate, dayOfWeek, startHour);
  await dispatchNotificationToMany(
    recipientIds,
    "SESSION_DELETED",
    `${dayName}, ${dateStr} at ${startHour}:00 class removed`,
    `The ${dayName}, ${dateStr} at ${startHour}:00 class has been removed from the schedule.`
  );
}
```

**Step 3: Run tests to verify they pass**

Run: `npm test -- app/api/__tests__/sessions.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add app/api/sessions/[id]/route.ts app/api/__tests__/sessions.test.ts
git commit -m "feat: notify attending voters on session delete, include date in notification"
```

---

## Task 6: Write failing tests for recurring slot deletion with voters

**Files:**
- Modify: `app/api/__tests__/recurring-slots.test.ts`

**Step 1: Write the failing test**

Add inside the `describe("DELETE /api/recurring-slots")` block:

```typescript
it("notifies attending voters when deleting future voting-enabled sessions", async () => {
  mockAuth.mockResolvedValue(ownerSession());
  mockPrisma.recurringSlot.findUnique.mockResolvedValue({
    id: "slot-1",
    dayOfWeek: 1,
    startHour: 9,
  });
  mockPrisma.session.findMany.mockResolvedValue([
    {
      id: "session-1",
      votingEnabled: true,
      weekDate: new Date("2026-03-09T00:00:00.000Z"),
      members: [],
      votes: [
        { userId: "m-1", attending: true },
        { userId: "m-2", attending: false },
      ],
    },
    {
      id: "session-2",
      votingEnabled: false,
      weekDate: new Date("2026-03-16T00:00:00.000Z"),
      members: [{ user: { id: "m-3" } }],
      votes: [],
    },
  ]);
  mockPrisma.session.delete.mockResolvedValue({});
  mockPrisma.recurringSlot.delete.mockResolvedValue({});

  const { DELETE } = await import("@/app/api/recurring-slots/route");
  await DELETE(
    new Request("http://localhost/api/recurring-slots", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "slot-1", deleteFutureSessions: true }),
    })
  );

  // First session: voting-enabled, should notify only m-1 (attending)
  expect(mockDispatchNotificationToMany).toHaveBeenCalledWith(
    ["m-1"],
    "SESSION_DELETED",
    expect.stringContaining("Monday"),
    expect.any(String)
  );
  // Second session: not voting, should notify m-3 (assigned member)
  expect(mockDispatchNotificationToMany).toHaveBeenCalledWith(
    ["m-3"],
    "SESSION_DELETED",
    expect.stringContaining("Monday"),
    expect.any(String)
  );
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- app/api/__tests__/recurring-slots.test.ts`
Expected: FAIL — recurring-slots DELETE doesn't fetch `votes` or check `votingEnabled`

---

## Task 7: Implement recurring slot deletion voter notifications + date formatting

**Files:**
- Modify: `app/api/recurring-slots/route.ts:1-15` (add imports)
- Modify: `app/api/recurring-slots/route.ts:143-155` (update findMany include)
- Modify: `app/api/recurring-slots/route.ts:158-169` (update notification loop)

**Step 1: Add imports**

```typescript
import { getSessionNotificationRecipients, formatSessionForNotification } from "@/lib/notifications";
```

**Step 2: Include `votes` in the `findMany` for future sessions**

Update lines 143-155:

```typescript
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
    votes: {
      select: { userId: true, attending: true },
    },
  },
});
```

**Step 3: Update the notification loop**

Replace the notification loop inside the `$transaction` (lines 159-169):

```typescript
await prisma.$transaction(async (tx) => {
  for (const sess of futureSessions) {
    const recipientIds = getSessionNotificationRecipients(sess);
    if (recipientIds.length > 0) {
      const { dayName, dateStr } = formatSessionForNotification(
        sess.weekDate,
        existing.dayOfWeek,
        existing.startHour
      );
      await dispatchNotificationToMany(
        recipientIds,
        "SESSION_DELETED",
        `${dayName}, ${dateStr} at ${existing.startHour}:00 class removed`,
        `The ${dayName}, ${dateStr} at ${existing.startHour}:00 recurring class has been permanently removed from the schedule.`
      );
    }
    await tx.session.delete({ where: { id: sess.id } });
  }

  await tx.recurringSlot.delete({ where: { id } });
});
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- app/api/__tests__/recurring-slots.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/api/recurring-slots/route.ts app/api/__tests__/recurring-slots.test.ts
git commit -m "feat: notify attending voters on recurring slot deletion, include date in notification"
```

---

## Task 8: Update the existing workout-posted notification to use voter-aware recipients

**Files:**
- Modify: `app/api/sessions/[id]/route.ts:164-175` (workout posted notification)

The "workout posted" notification at lines 164-175 also uses `existingSession.members.map(...)`. Since votes are now included in the fetch, we should update this too — when voting is enabled, the workout-posted notification should go to attending voters.

**Step 1: Update the workout notification block**

Replace:

```typescript
if (parsed.data.workoutTitle && !existingSession.workoutTitle) {
  const memberIds = existingSession.members.map((m) => m.user.id);
  if (memberIds.length > 0) {
```

With:

```typescript
if (parsed.data.workoutTitle && !existingSession.workoutTitle) {
  const recipientIds = getSessionNotificationRecipients(existingSession);
  if (recipientIds.length > 0) {
```

And update the `dispatchNotificationToMany` call to use `recipientIds`.

**Step 2: Run full test suite**

Run: `npm test`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add app/api/sessions/[id]/route.ts
git commit -m "feat: workout-posted notification also uses voter-aware recipients"
```

---

## Task 9: Run full verification suite

**Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: PASS (0 errors)

**Step 2: Lint**

Run: `npm run lint`
Expected: PASS (only pre-existing warnings)

**Step 3: Full test suite**

Run: `npm test`
Expected: ALL PASS (615 + new tests)

**Step 4: Final commit (if any fixes needed)**

Only if adjustments were required during verification.

---

## Summary of all changes

| File | Change |
|---|---|
| `lib/notifications.ts` | Add `getSessionNotificationRecipients()` and `formatSessionForNotification()` |
| `app/api/sessions/[id]/route.ts` | PATCH: fetch `votes`, use voter-aware recipients for cancel + workout-posted notifications, add date to cancel message |
| `app/api/sessions/[id]/route.ts` | DELETE: fetch `votes`, use voter-aware recipients, add date to delete message |
| `app/api/recurring-slots/route.ts` | DELETE: fetch `votes` in future session query, use voter-aware recipients per session, add date to delete message |
| `app/api/__tests__/sessions.test.ts` | ~5 new tests for cancel/delete with voting-enabled sessions and date in messages |
| `app/api/__tests__/recurring-slots.test.ts` | ~1 new test for recurring slot deletion with mixed voting/non-voting sessions |

**No schema changes. No new notification types. No new email templates. No UI changes needed.**
