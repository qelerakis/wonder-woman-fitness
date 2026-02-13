# Design: Delete Recurring Slot from Session Detail

**Date**: 2026-02-13
**Status**: Approved

## Problem

When the owner deletes a session from the schedule, it only removes that single week's instance. The underlying RecurringSlot template remains, so "Generate Week" recreates the session next time. There is no UI to permanently remove a recurring slot — the API exists (`DELETE /api/recurring-slots`) but is not exposed in the interface.

## Solution

Add a "Delete Recurring Slot" button to the session detail page. When clicked, the owner chooses between two cleanup modes via a confirmation modal.

## User Flow

1. Owner opens a **recurring** session's detail page (session has a `recurringSlotId`)
2. A new **"Delete Recurring Slot"** button appears alongside "Delete Session"
3. Clicking it opens a modal with:
   - Title: "Delete Recurring Slot"
   - Slot description (e.g., "Monday at 9:00 AM")
   - Two radio options:
     - **"Stop future generation only"** — deletes the template; already-generated sessions remain
     - **"Delete slot and all upcoming sessions"** — deletes template + all sessions from current week onward
   - "Delete" (danger) and "Cancel" buttons
4. On confirmation: API call, toast, redirect to schedule

The button does **not** appear on one-off/custom sessions (no recurring slot to delete).

## API Changes

### `DELETE /api/recurring-slots`

**Extended request body:**
```json
{
  "id": "slot-123",
  "deleteFutureSessions": true | false
}
```

`deleteFutureSessions` defaults to `false` (backward compatible).

**When `false`:**
- Delete the RecurringSlot record
- Existing sessions become orphaned (keep `recurringSlotId` reference but slot no longer exists)

**When `true`:**
- Find all sessions linked to this slot where `weekDate >= current week's Monday`
- Notify assigned members of each session (`SESSION_DELETED`)
- Cascade delete each session (votes, member assignments, trainer assignments, then session)
- Delete the RecurringSlot
- All within `prisma.$transaction()`

**Response (200):**
```json
{
  "data": {
    "deletedSlot": true,
    "deletedSessionsCount": 3
  }
}
```

## Component Changes

### New: `components/schedule/DeleteRecurringSlotModal.tsx`

Props:
```typescript
interface DeleteRecurringSlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  slotId: string;
  dayOfWeek: number;
  startHour: number;
  onDeleted: () => void;  // callback after successful deletion
}
```

Uses the existing `Modal` component. Contains:
- Two radio inputs for the deletion mode
- Loading state on the "Delete" button
- Calls `DELETE /api/recurring-slots` with chosen mode

### Modified: `SessionDetailClient.tsx`

- Add `recurringSlotId: string | null` to `SessionData` interface
- Add state: `showDeleteSlotModal`
- Render "Delete Recurring Slot" button (only when `recurringSlotId` is not null)
- Render `DeleteRecurringSlotModal`

### Modified: `page.tsx` (owner session detail)

- Pass `recurringSlotId` (from `session.recurringSlotId`) to client component

### Modified: `app/api/recurring-slots/route.ts`

- Extend `DeleteSchema` to include optional `deleteFutureSessions: z.boolean().default(false)`
- Add transaction logic for cascade deletion when `deleteFutureSessions` is true

## Files Changed

| File | Action |
|------|--------|
| `components/schedule/DeleteRecurringSlotModal.tsx` | Create |
| `app/(owner)/owner/session/[id]/SessionDetailClient.tsx` | Modify |
| `app/(owner)/owner/session/[id]/page.tsx` | Modify |
| `app/api/recurring-slots/route.ts` | Modify |
| Tests for DELETE recurring-slots API | Create |

## Not Changed

- Prisma schema (no model changes)
- Session generation logic
- Constants
- Member/Trainer views
- WeeklyCalendar component
