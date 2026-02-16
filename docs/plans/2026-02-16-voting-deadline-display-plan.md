# Voting Deadline Display Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show voting deadlines to members on session cards and session detail pages so they know when voting closes.

**Architecture:** Pure UI change. Add deadline text to SessionCard (server component, static) and MemberSessionDetailClient (client component, live countdown with 60s timer). Uses existing `getTimeUntilDeadline()` from voting-logic.ts and `votingDeadline` data already on every session. One new constant `VOTING_URGENCY_HOURS = 6`.

**Tech Stack:** React, date-fns, Vitest, Testing Library

---

### Task 1: Add VOTING_URGENCY_HOURS constant

**Files:**
- Modify: `lib/constants.ts:19` (after VOTING_DEADLINE_HOURS_BEFORE)

**Step 1: Add the constant**

In `lib/constants.ts`, after line 19 (`export const VOTING_DEADLINE_HOURS_BEFORE = 24;`), add:

```typescript
export const VOTING_URGENCY_HOURS = 6; // Switch to countdown format when deadline is this close
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 3: Commit**

```bash
git add lib/constants.ts
git commit -m "feat: add VOTING_URGENCY_HOURS constant"
```

---

### Task 2: Write failing tests for SessionCard deadline display

**Files:**
- Modify: `components/schedule/__tests__/SessionCard.test.tsx`

**Step 1: Write the failing tests**

Add a new `describe` block at the end of the `SessionCard` describe, before the closing `});`. These tests need to control "now" so the deadline comparison is deterministic. Since `SessionCard` is a server component that calls `new Date()` at render time, we use `vi.useFakeTimers()` to freeze time.

The test data helper `makeSession()` already sets `votingDeadline: new Date("2026-02-10T08:00:00.000Z")` — that's Mon Feb 10 at 8 AM UTC. The session is Mon 9 AM (dayOfWeek=1, startHour=9).

Add these tests after the `// ─── Styling ───` describe block (before the final `});`):

```typescript
  // ─── Voting Deadline Display ──────────────────────────────────────

  describe("voting deadline display", () => {
    it("shows deadline text when voting is active and user has not voted", () => {
      // Freeze time to Feb 9, well before deadline of Feb 10 08:00 UTC
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-02-09T12:00:00.000Z"));

      const session = makeSession({
        votingEnabled: true,
        votingDeadline: new Date("2026-02-10T08:00:00.000Z"),
      });
      render(
        <SessionCard
          session={session}
          basePath="/member/session"
          showVotingIndicator={true}
          currentUserId="member-99" // no vote from this user
        />
      );

      // Should show "by" + short date (e.g., "by Tue 8 AM")
      expect(screen.getByText(/^by /i)).toBeDefined();

      vi.useRealTimers();
    });

    it("hides deadline text when user has already voted", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-02-09T12:00:00.000Z"));

      const session = makeSession({
        votingEnabled: true,
        votingDeadline: new Date("2026-02-10T08:00:00.000Z"),
      });
      render(
        <SessionCard
          session={session}
          basePath="/member/session"
          showVotingIndicator={true}
          currentUserId="member-1" // member-1 has a vote in makeSession
        />
      );

      expect(screen.queryByText(/^by /i)).toBeNull();

      vi.useRealTimers();
    });

    it("hides deadline text when showVotingIndicator is false", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-02-09T12:00:00.000Z"));

      const session = makeSession({
        votingEnabled: true,
        votingDeadline: new Date("2026-02-10T08:00:00.000Z"),
      });
      render(
        <SessionCard
          session={session}
          basePath="/member/session"
          showVotingIndicator={false}
          currentUserId="member-99"
        />
      );

      expect(screen.queryByText(/^by /i)).toBeNull();

      vi.useRealTimers();
    });

    it("hides deadline text when voting deadline has passed", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-02-11T00:00:00.000Z")); // after deadline

      const session = makeSession({
        votingEnabled: true,
        votingDeadline: new Date("2026-02-10T08:00:00.000Z"),
      });
      render(
        <SessionCard
          session={session}
          basePath="/member/session"
          showVotingIndicator={true}
          currentUserId="member-99"
        />
      );

      expect(screen.queryByText(/^by /i)).toBeNull();

      vi.useRealTimers();
    });

    it("applies warning color when deadline is within 6 hours", () => {
      vi.useFakeTimers();
      // 3 hours before deadline of Feb 10 08:00 UTC
      vi.setSystemTime(new Date("2026-02-10T05:00:00.000Z"));

      const session = makeSession({
        votingEnabled: true,
        votingDeadline: new Date("2026-02-10T08:00:00.000Z"),
      });
      render(
        <SessionCard
          session={session}
          basePath="/member/session"
          showVotingIndicator={true}
          currentUserId="member-99"
        />
      );

      const deadlineText = screen.getByText(/^by /i);
      expect(deadlineText.className).toContain("text-warning-400");

      vi.useRealTimers();
    });

    it("applies muted color when deadline is more than 6 hours away", () => {
      vi.useFakeTimers();
      // 20 hours before deadline
      vi.setSystemTime(new Date("2026-02-09T12:00:00.000Z"));

      const session = makeSession({
        votingEnabled: true,
        votingDeadline: new Date("2026-02-10T08:00:00.000Z"),
      });
      render(
        <SessionCard
          session={session}
          basePath="/member/session"
          showVotingIndicator={true}
          currentUserId="member-99"
        />
      );

      const deadlineText = screen.getByText(/^by /i);
      expect(deadlineText.className).toContain("text-surface-500");

      vi.useRealTimers();
    });

    it("hides deadline text when votingEnabled is false", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-02-09T12:00:00.000Z"));

      const session = makeSession({
        votingEnabled: false,
        votingDeadline: new Date("2026-02-10T08:00:00.000Z"),
      });
      render(
        <SessionCard
          session={session}
          basePath="/member/session"
          showVotingIndicator={true}
          currentUserId="member-99"
        />
      );

      expect(screen.queryByText(/^by /i)).toBeNull();

      vi.useRealTimers();
    });

    it("hides deadline text when votingDeadline is null", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-02-09T12:00:00.000Z"));

      const session = makeSession({
        votingEnabled: true,
        votingDeadline: null,
      });
      render(
        <SessionCard
          session={session}
          basePath="/member/session"
          showVotingIndicator={true}
          currentUserId="member-99"
        />
      );

      expect(screen.queryByText(/^by /i)).toBeNull();

      vi.useRealTimers();
    });
  });
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run components/schedule/__tests__/SessionCard.test.tsx`
Expected: FAIL — the "shows deadline text" test fails because no `by ...` text exists yet.

---

### Task 3: Implement SessionCard deadline display

**Files:**
- Modify: `components/schedule/SessionCard.tsx`

**Step 1: Add imports and deadline logic**

At the top of `SessionCard.tsx`, add:

```typescript
import { format } from "date-fns";
import { VOTING_URGENCY_HOURS } from "@/lib/constants";
```

Inside the `SessionCard` function, after the existing computed values (line 29, after `const isCancelled = ...`), add:

```typescript
  // Voting deadline display
  const deadline = session.votingDeadline ? new Date(session.votingDeadline) : null;
  const now = new Date();
  const deadlineInFuture = deadline ? deadline > now : false;
  const hoursUntilDeadline = deadline ? (deadline.getTime() - now.getTime()) / (1000 * 60 * 60) : Infinity;
  const isUrgent = hoursUntilDeadline <= VOTING_URGENCY_HOURS;
  const showDeadline = showVotingIndicator && session.votingEnabled && !isCancelled && deadlineInFuture && !userVote;
```

**Step 2: Add deadline text to the footer**

In the footer `div` (the one starting with `<div className="flex items-center justify-between gap-2">`), after the existing user vote `Badge` block (the `{showVotingIndicator && userVote !== undefined && userVote !== null && (` block), add:

```tsx
        {showDeadline && deadline && (
          <span className={`text-xs ${isUrgent ? "text-warning-400" : "text-surface-500"}`}>
            by {format(deadline, "EEE h a")}
          </span>
        )}
```

**Step 3: Run tests to verify they pass**

Run: `npx vitest run components/schedule/__tests__/SessionCard.test.tsx`
Expected: ALL PASS (58 existing + 8 new = 66 tests)

**Step 4: Commit**

```bash
git add components/schedule/SessionCard.tsx components/schedule/__tests__/SessionCard.test.tsx
git commit -m "feat: show voting deadline on SessionCard for members"
```

---

### Task 4: Write failing tests for MemberSessionDetailClient deadline display

**Files:**
- Modify: `app/(member)/member/session/[id]/__tests__/MemberSessionDetailClient.test.tsx`

**Step 1: Write the failing tests**

Add a new describe block at the end, before the final `});`. These tests use `vi.useFakeTimers()` to control time for the countdown. The test helper `makeSession()` uses `votingDeadline: "2099-01-01T00:00:00.000Z"` by default.

```typescript
  // ─── Voting Deadline Display ──────────────────────────────────────

  describe("voting deadline display", () => {
    it("shows absolute deadline text when voting is open and more than 6 hours away", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-07T09:00:00.000Z")); // ~2 days before deadline

      render(
        <MemberSessionDetailClient
          session={makeSession({
            votingDeadline: "2026-03-08T09:00:00.000Z",
          })}
          myVote={null}
          userId="member-1"
          isFull={false}
          hasComingVoteOnSameDay={false}
        />
      );

      // Should show "Closes Sun, Mar 8 at 9:00 AM"
      expect(screen.getByText(/Closes/)).toBeTruthy();
      expect(screen.queryByText(/Closes in/)).toBeNull();

      vi.useRealTimers();
    });

    it("shows countdown text when voting is open and within 6 hours", () => {
      vi.useFakeTimers();
      // 3 hours and 30 minutes before deadline
      vi.setSystemTime(new Date("2026-03-08T05:30:00.000Z"));

      render(
        <MemberSessionDetailClient
          session={makeSession({
            votingDeadline: "2026-03-08T09:00:00.000Z",
          })}
          myVote={null}
          userId="member-1"
          isFull={false}
          hasComingVoteOnSameDay={false}
        />
      );

      expect(screen.getByText(/Closes in 3h 30m/)).toBeTruthy();

      vi.useRealTimers();
    });

    it("applies warning color to countdown text when within 6 hours", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-08T05:30:00.000Z"));

      render(
        <MemberSessionDetailClient
          session={makeSession({
            votingDeadline: "2026-03-08T09:00:00.000Z",
          })}
          myVote={null}
          userId="member-1"
          isFull={false}
          hasComingVoteOnSameDay={false}
        />
      );

      const countdownEl = screen.getByText(/Closes in/);
      expect(countdownEl.className).toContain("text-warning-400");

      vi.useRealTimers();
    });

    it("does not show deadline text when voting is closed", () => {
      render(
        <MemberSessionDetailClient
          session={makeSession({
            votingDeadline: "2020-01-01T00:00:00.000Z",
          })}
          myVote={null}
          userId="member-1"
          isFull={false}
          hasComingVoteOnSameDay={false}
        />
      );

      expect(screen.queryByText(/Closes/)).toBeNull();
    });

    it("does not show deadline text when votingEnabled is false", () => {
      render(
        <MemberSessionDetailClient
          session={makeSession({ votingEnabled: false })}
          myVote={null}
          userId="member-1"
          isFull={false}
          hasComingVoteOnSameDay={false}
        />
      );

      expect(screen.queryByText(/Closes/)).toBeNull();
    });

    it("shows actual deadline time in vote change hint text", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-07T09:00:00.000Z"));

      render(
        <MemberSessionDetailClient
          session={makeSession({
            votingDeadline: "2026-03-08T09:00:00.000Z",
          })}
          myVote={true}
          userId="member-1"
          isFull={false}
          hasComingVoteOnSameDay={false}
        />
      );

      // Old text: "You can change your vote until the deadline."
      // New text: "You can change your vote until Sun, Mar 8 at 9:00 AM."
      expect(screen.queryByText("You can change your vote until the deadline.")).toBeNull();
      expect(screen.getByText(/You can change your vote until/)).toBeTruthy();

      vi.useRealTimers();
    });

    it("transitions from open to closed when deadline passes via timer", () => {
      vi.useFakeTimers();
      // 30 seconds before deadline
      vi.setSystemTime(new Date("2026-03-08T08:59:30.000Z"));

      render(
        <MemberSessionDetailClient
          session={makeSession({
            votingDeadline: "2026-03-08T09:00:00.000Z",
          })}
          myVote={null}
          userId="member-1"
          isFull={false}
          hasComingVoteOnSameDay={false}
        />
      );

      // Voting should be open
      expect(screen.getByText("Voting Open")).toBeTruthy();

      // Advance time past the deadline (60 seconds for the interval to fire)
      vi.advanceTimersByTime(60_000);

      // Now voting should be closed
      expect(screen.getByText("Voting Closed")).toBeTruthy();
      expect(screen.queryByText("Voting Open")).toBeNull();

      vi.useRealTimers();
    });
  });
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run "app/(member)/member/session/[id]/__tests__/MemberSessionDetailClient.test.tsx"`
Expected: FAIL — "Closes" text doesn't exist, hint text still says "until the deadline"

---

### Task 5: Implement MemberSessionDetailClient deadline display

**Files:**
- Modify: `app/(member)/member/session/[id]/MemberSessionDetailClient.tsx`

**Step 1: Add imports**

Update the imports at the top of the file. Change:

```typescript
import { useState } from "react";
```

To:

```typescript
import { useState, useEffect } from "react";
```

Add new imports:

```typescript
import { format } from "date-fns";
import { getTimeUntilDeadline } from "@/lib/voting-logic";
import { VOTING_URGENCY_HOURS } from "@/lib/constants";
```

**Step 2: Add `now` state and timer, replace static deadline check**

Inside the component function, after the existing state declarations (line 49, after `const [currentVote, setCurrentVote] = useState<boolean | null>(myVote);`), add:

```typescript
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);
```

Replace the existing deadline check on line 56:

```typescript
  const deadlinePassed = new Date(session.votingDeadline) <= new Date();
```

With:

```typescript
  const deadline = new Date(session.votingDeadline);
  const deadlinePassed = deadline <= now;
  const timeUntil = getTimeUntilDeadline(deadline, now);
  const isUrgent = !timeUntil.isPast && timeUntil.hours < VOTING_URGENCY_HOURS;
```

**Step 3: Add deadline text to header badges**

In the badges area, after the "Voting Open" badge block (lines 111-115), add the deadline text. Replace:

```tsx
            {session.votingEnabled && !deadlinePassed && (
              <Badge variant="info" size="sm">
                Voting Open
              </Badge>
            )}
```

With:

```tsx
            {session.votingEnabled && !deadlinePassed && (
              <>
                <Badge variant="info" size="sm">
                  Voting Open
                </Badge>
                <span className={`text-xs ${isUrgent ? "text-warning-400" : "text-surface-400"}`}>
                  {isUrgent
                    ? `Closes in ${timeUntil.hours}h ${timeUntil.minutes}m`
                    : `Closes ${format(deadline, "EEE, MMM d 'at' h:mm a")}`}
                </span>
              </>
            )}
```

**Step 4: Update the vote change hint text**

Find the hint text (currently around line 204-206):

```tsx
                      <p className="text-xs text-surface-500">
                        You can change your vote until the deadline.
                      </p>
```

Replace with:

```tsx
                      <p className="text-xs text-surface-500">
                        You can change your vote until{" "}
                        {format(deadline, "EEE, MMM d 'at' h:mm a")}.
                      </p>
```

**Step 5: Run tests to verify they pass**

Run: `npx vitest run "app/(member)/member/session/[id]/__tests__/MemberSessionDetailClient.test.tsx"`
Expected: ALL PASS (76 existing + 7 new = 83 tests)

**Step 6: Commit**

```bash
git add "app/(member)/member/session/[id]/MemberSessionDetailClient.tsx" "app/(member)/member/session/[id]/__tests__/MemberSessionDetailClient.test.tsx"
git commit -m "feat: show voting deadline and live countdown on session detail page"
```

---

### Task 6: Run full test suite and verify build

**Step 1: Run all tests**

Run: `npm test`
Expected: ALL 622+ tests pass (615 existing + 7-8 new SessionCard + 7 new detail)

**Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 3: Lint**

Run: `npm run lint`
Expected: Only the 4 pre-existing warnings (ScheduleClient trainers/members, members API _payments, notifications _user)

**Step 4: Final commit if any fixes needed, otherwise done**

```bash
git log --oneline -5
```

Expected: 3 commits from this feature:
1. `feat: add VOTING_URGENCY_HOURS constant`
2. `feat: show voting deadline on SessionCard for members`
3. `feat: show voting deadline and live countdown on session detail page`
