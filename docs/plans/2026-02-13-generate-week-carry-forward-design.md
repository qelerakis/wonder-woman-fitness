# Generate Week: Carry Forward Assignments + Remove Existing Slot Tab

## Date: 2026-02-13

## Summary

Two changes:
1. When owner clicks "Generate Week", newly created sessions copy trainer and member assignments from the previous week's session for each recurring slot.
2. Remove the "Existing Slot" tab from CreateSessionModal (redundant with Generate Week).

---

## Change 1: Carry Forward Assignments

### Current behavior
`generateSessionsForWeek()` creates sessions from recurring slots with no trainers or members assigned. They must be added manually every week.

### New behavior
After creating each new session, look up the previous week's session for the same recurring slot. If found, copy its `SessionTrainer` and `SessionMember` records into the new session.

### Rules
- Previous week = `weekDate - 7 days`
- If no previous-week session exists for a slot → session created empty
- If previous session was CANCELLED → still copy assignments (people are regulars)
- Departed members (status = DEPARTED) are skipped
- Idempotent: calling generate twice doesn't duplicate assignments (sessions already exist = skipped entirely)
- MAX_CLASS_SIZE is respected

### Implementation
Modify `generateSessionsForWeek()` in `lib/session-generation.ts`:
1. After creating a session, query for the previous week's session for the same `recurringSlotId`
2. If found, fetch its trainers and members (with user status)
3. Create `SessionTrainer` records for each trainer
4. Create `SessionMember` records for each non-DEPARTED member (up to MAX_CLASS_SIZE)

---

## Change 2: Remove "Existing Slot" Tab

### Rationale
Generate Week creates sessions for all recurring slots. The "Existing Slot" tab manually does the same thing one-at-a-time — redundant.

### Changes
- Remove `"existing"` from `TabMode` type
- Remove `existingSlotIds` prop from `CreateSessionModalProps`
- Default tab → `"oneoff"`
- Remove all `tab === "existing"` branches (submit handler, JSX)
- Update callers: `ScheduleClient.tsx`, `TrainerScheduleClient.tsx` — remove `existingSlotIds` computation and prop

---

## Testing

### session-generation.test.ts (~20-25 new tests)
- Carry-forward happy path (trainers + members copied)
- Multiple slots copy independently
- No previous session → empty session
- Departed member skipped
- Cancelled previous session → still copies
- Idempotent (no duplicate assignments)
- Partial data (trainers only, members only)
- Empty previous session → empty new session

### CreateSessionModal.test.tsx
- Remove "Existing Slot" tests
- Add test: "Existing Slot" tab doesn't render
- Verify default tab is "oneoff"
- Keep One-Off and New Recurring tests

### sessions.test.ts
- Keep recurring POST tests (used by "New Recurring" tab)
