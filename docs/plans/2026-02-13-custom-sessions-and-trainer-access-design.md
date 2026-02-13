# Custom Sessions & Trainer Schedule Access — Design

**Date:** 2026-02-13
**Status:** Approved

## Problem

1. Owner can only create sessions from predefined recurring slots — no way to add one-off private sessions at custom times or create new recurring slots from the schedule UI.
2. Trainers have no schedule management capabilities — they can only view assigned sessions and edit workouts.

## Solution

### Data Model Changes

**Session model** — three new/modified fields:
- `recurringSlotId` becomes **optional** (currently required)
- `customDay Int?` — day of week (1-7), one-off sessions only
- `customStartHour Int?` — hour (7-22), one-off sessions only

A session is either **recurring** (`recurringSlotId` set, custom fields null) or **one-off** (custom fields set, `recurringSlotId` null). Enforced at application level — must have one or the other, never both, never neither.

**Unique constraints:**
- `@@unique([recurringSlotId, weekDate])` stays (nulls allowed by Prisma)
- New: `@@unique([weekDate, customDay, customStartHour])` prevents duplicate one-offs

**RecurringSlot model** — no changes.

### API Changes

**`POST /api/sessions`** — two creation modes:
- Recurring: `{ recurringSlotId, weekDate }` (unchanged)
- One-off: `{ customDay, customStartHour, weekDate }` (new)
- Auth: OWNER **and TRAINER** (was owner-only)
- When a trainer creates a session, they are auto-assigned to it

**`POST /api/recurring-slots`** — auth expanded to OWNER **and TRAINER** (was owner-only). No other changes.

**Cancel/Delete operations** remain owner-only.

**`GET /api/sessions`** — one-off sessions returned with `recurringSlot: null`, `customDay` and `customStartHour` populated.

### UI Changes

**CreateSessionModal** redesigned with three tabs:

1. **Existing Slot** — current behavior (dropdown of recurring slots)
2. **One-Off Session** — Day + Hour dropdowns, standalone session
3. **New Recurring Slot** — Day + Hour dropdowns, creates slot then session

**Trainer schedule page** gets the same "Add Session" button and modal.

**Session display** updated to read `customDay`/`customStartHour` when `recurringSlot` is null.

### Testing

30-40 new unit tests covering:
- One-off session CRUD and validation
- Mutual exclusivity (slot XOR custom fields)
- Duplicate prevention for one-offs
- Trainer auth on session and slot creation
- Trainer auto-assignment
- Generate week ignores one-offs
- Zod schema validation
