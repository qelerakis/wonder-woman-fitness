# Voting Deadline Display for Members — Design Document

**Date:** 2026-02-16

## Problem

Members see "Voting Open" or "Voting Closed" badges but never the actual deadline timestamp. They can't plan when to vote and get frustrated when they miss the window. The codebase already has the deadline data (`votingDeadline` on every session) and a `getTimeUntilDeadline()` helper in `voting-logic.ts` — neither is surfaced in the member UI.

## Design

### SessionCard (Server Component) — Static Deadline Text

Add a short deadline label in the card footer when voting is active and the member hasn't voted yet.

**Display logic:**
- Show only when: `votingEnabled && showVotingIndicator && deadline is in the future && no user vote`
- Format: `"by Sun 9 AM"` using `format(deadline, "EEE h a")` from date-fns
- When deadline is within `VOTING_URGENCY_HOURS` (6h): use `text-warning-400` instead of `text-surface-500`
- When user has already voted: hide the deadline text (their vote badge takes that space)

**Placement:** Right-aligned in the existing footer div, in the same position the vote badge occupies when present.

```
9:00 AM                    [Voting]
Upper Body Strength
Coach Ana
3/20 coming          by Sun 9 AM
```

No `"use client"` needed. Server components render at request time, so `new Date()` is accurate for the initial page load. The urgency color won't update dynamically without a refresh, which is acceptable for a card in a list.

### MemberSessionDetailClient (Client Component) — Live Countdown

Add deadline info in two places on the session detail page.

**Place 1 — Header badges (next to "Voting Open" badge):**
- More than 6h remaining: `"Closes Sun, Mar 8 at 9:00 AM"` in `text-surface-400`
- 6h or less remaining: `"Closes in 4h 32m"` in `text-warning-400`
- Deadline passed: text hidden (badge switches to "Voting Closed")

**Place 2 — "Your Attendance" card (existing hint text):**
- Replace `"You can change your vote until the deadline."` with `"You can change your vote until Sun, Mar 8 at 9:00 AM."`

**Timer implementation:**
- `const [now, setNow] = useState(() => new Date())`
- `useEffect` with `setInterval(() => setNow(new Date()), 60_000)` — once per minute
- Derive `deadlinePassed` from `now` state (replaces the current one-time `new Date()` check on line 56)
- Use `getTimeUntilDeadline(deadline, now)` from `voting-logic.ts` for the countdown
- When the deadline passes while the page is open, the UI auto-transitions: badge flips to "Voting Closed", countdown disappears, vote buttons disable

### New Constant

Add to `lib/constants.ts`:
```typescript
export const VOTING_URGENCY_HOURS = 6;
```

## Files to Change

| File | Change |
|---|---|
| `lib/constants.ts` | Add `VOTING_URGENCY_HOURS = 6` |
| `components/schedule/SessionCard.tsx` | Add deadline text in footer, import `format` + constant |
| `app/(member)/member/session/[id]/MemberSessionDetailClient.tsx` | Add `now` state + timer, deadline text in header + attendance card, import helpers |

No API changes. No schema changes. No new components.

## Testing

Add to `MemberSessionDetailClient.test.tsx`:
- Deadline text renders when voting is open with future deadline
- Countdown format used when under 6 hours
- Absolute format used when over 6 hours
- Deadline text hidden when voting is closed
- Hint text includes actual deadline time
- Timer causes UI to transition from open to closed when deadline passes (advance fake timers)

Add to `SessionCard.test.tsx`:
- Deadline label renders for member view with active voting and no user vote
- Warning color applied when deadline is within 6 hours
- Label hidden when user has already voted
- Label hidden when voting is closed
