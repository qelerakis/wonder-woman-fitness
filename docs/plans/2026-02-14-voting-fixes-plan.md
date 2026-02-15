# Voting System Fixes — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix negative "No Vote Yet" numbers, enforce one-Coming-vote-per-day, and disable voting when session is full.

**Architecture:** Three server-side validations added to the votes API, plus updated data assembly on three session detail pages (owner, trainer, member) so vote counts use all active/trial members as the pool.

**Tech Stack:** Next.js 15 App Router, Prisma 7, Vitest, Zod, TypeScript

---

### Task 1: Add `isSessionFull()` helper to voting-logic.ts

**Files:**
- Modify: `lib/voting-logic.ts`
- Test: `lib/__tests__/voting-logic.test.ts`

**Step 1: Write the failing tests**

Add to `lib/__tests__/voting-logic.test.ts` at the end, before the closing of the file:

```typescript
// ===== isSessionFull =====

describe("isSessionFull", () => {
  it("returns false when coming count is below max", () => {
    expect(isSessionFull(10)).toBe(false);
  });

  it("returns false when coming count is 19 (one below max)", () => {
    expect(isSessionFull(19)).toBe(false);
  });

  it("returns true when coming count equals MAX_CLASS_SIZE (20)", () => {
    expect(isSessionFull(20)).toBe(true);
  });

  it("returns true when coming count exceeds MAX_CLASS_SIZE", () => {
    expect(isSessionFull(25)).toBe(true);
  });

  it("returns false when coming count is 0", () => {
    expect(isSessionFull(0)).toBe(false);
  });
});
```

Also update the import at the top of the test file to include `isSessionFull`:
```typescript
import {
  getVotingDeadline,
  isVotingLocked,
  getTimeUntilDeadline,
  getVoteSummary,
  hasLowAttendance,
  isSessionFull,
} from "../voting-logic";
```

**Step 2: Run test to verify it fails**

Run: `npm test -- lib/__tests__/voting-logic.test.ts`
Expected: FAIL — `isSessionFull` is not exported

**Step 3: Write minimal implementation**

Add to `lib/voting-logic.ts` at the end:

```typescript
/**
 * Check if session is full (coming votes >= MAX_CLASS_SIZE)
 */
export function isSessionFull(comingCount: number): boolean {
  return comingCount >= MAX_CLASS_SIZE;
}
```

Also add `MAX_CLASS_SIZE` to the imports at the top:
```typescript
import { LOW_ATTENDANCE_THRESHOLD, MAX_CLASS_SIZE } from './constants';
```

**Step 4: Run test to verify it passes**

Run: `npm test -- lib/__tests__/voting-logic.test.ts`
Expected: ALL PASS (30 tests: 25 existing + 5 new)

**Step 5: Commit**

```bash
git add lib/voting-logic.ts lib/__tests__/voting-logic.test.ts
git commit -m "feat: add isSessionFull helper to voting-logic"
```

---

### Task 2: Add one-vote-per-day and full-session checks to votes API

**Files:**
- Modify: `app/api/votes/route.ts`
- Test: `app/api/__tests__/votes.test.ts`

**Step 1: Write the failing tests**

Add these tests to the `POST /api/votes` describe block in `app/api/__tests__/votes.test.ts`:

```typescript
it("returns 400 when session is full (20 Coming votes) and attending=true", async () => {
  mockAuth.mockResolvedValue(memberSession("member-1"));
  mockPrisma.session.findUnique.mockResolvedValue({
    id: "cm1234567890abcdef",
    status: "SCHEDULED",
    votingEnabled: true,
    votingDeadline: new Date("2099-01-01"),
  });
  mockPrisma.vote.count.mockResolvedValue(20);

  const { POST } = await import("@/app/api/votes/route");
  const response = await POST(
    new Request("http://localhost/api/votes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "cm1234567890abcdef",
        attending: true,
      }),
    })
  );
  const body = await response.json();

  expect(response.status).toBe(400);
  expect(body.error).toContain("full");
});

it("returns 400 when session is full and attending=false", async () => {
  mockAuth.mockResolvedValue(memberSession("member-1"));
  mockPrisma.session.findUnique.mockResolvedValue({
    id: "cm1234567890abcdef",
    status: "SCHEDULED",
    votingEnabled: true,
    votingDeadline: new Date("2099-01-01"),
  });
  mockPrisma.vote.count.mockResolvedValue(20);

  const { POST } = await import("@/app/api/votes/route");
  const response = await POST(
    new Request("http://localhost/api/votes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "cm1234567890abcdef",
        attending: false,
      }),
    })
  );
  const body = await response.json();

  expect(response.status).toBe(400);
  expect(body.error).toContain("full");
});

it("returns 400 when member already voted Coming on another session same day", async () => {
  mockAuth.mockResolvedValue(memberSession("member-1"));
  mockPrisma.session.findUnique.mockResolvedValue({
    id: "session-2",
    status: "SCHEDULED",
    votingEnabled: true,
    votingDeadline: new Date("2099-01-01"),
    weekDate: new Date("2026-03-09"),
    recurringSlot: { dayOfWeek: 1, startHour: 11 },
    customDay: null,
  });
  mockPrisma.vote.count.mockResolvedValue(5); // not full
  mockPrisma.vote.findFirst.mockResolvedValue({
    id: "existing-vote",
    sessionId: "session-1",
    userId: "member-1",
    attending: true,
    session: {
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      customDay: null,
    },
  });

  const { POST } = await import("@/app/api/votes/route");
  const response = await POST(
    new Request("http://localhost/api/votes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "session-2",
        attending: true,
      }),
    })
  );
  const body = await response.json();

  expect(response.status).toBe(400);
  expect(body.error).toContain("already");
});

it("allows Not Coming vote even when already Coming to another session same day", async () => {
  mockAuth.mockResolvedValue(memberSession("member-1"));
  mockPrisma.session.findUnique.mockResolvedValue({
    id: "session-2",
    status: "SCHEDULED",
    votingEnabled: true,
    votingDeadline: new Date("2099-01-01"),
    weekDate: new Date("2026-03-09"),
    recurringSlot: { dayOfWeek: 1, startHour: 11 },
    customDay: null,
  });
  mockPrisma.vote.count.mockResolvedValue(5);
  mockPrisma.vote.upsert.mockResolvedValue({
    id: "v-new",
    sessionId: "session-2",
    userId: "member-1",
    attending: false,
    votedAt: new Date(),
  });

  const { POST } = await import("@/app/api/votes/route");
  const response = await POST(
    new Request("http://localhost/api/votes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "session-2",
        attending: false,
      }),
    })
  );
  const body = await response.json();

  expect(response.status).toBe(201);
  expect(body.data.attending).toBe(false);
});
```

Also add `count` and `findFirst` to the mockPrisma.vote object:
```typescript
const mockPrisma = {
  session: {
    findUnique: vi.fn(),
  },
  vote: {
    upsert: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    findFirst: vi.fn(),
  },
};
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- app/api/__tests__/votes.test.ts`
Expected: FAIL — new tests fail because API doesn't have these checks yet

**Step 3: Implement the checks in votes API**

Modify `app/api/votes/route.ts`. After the voting deadline check (line 84), add:

```typescript
    // Check if session is full (coming votes >= MAX_CLASS_SIZE)
    const comingCount = await prisma.vote.count({
      where: { sessionId, attending: true },
    });

    if (comingCount >= MAX_CLASS_SIZE) {
      return Response.json(
        { error: "This session is full" },
        { status: 400 }
      );
    }

    // One-Coming-per-day: if voting Coming, check no other Coming vote on same day
    if (attending) {
      const targetDay = targetSession.recurringSlot?.dayOfWeek
        ?? targetSession.customDay;

      const existingComing = await prisma.vote.findFirst({
        where: {
          userId,
          attending: true,
          sessionId: { not: sessionId },
          session: {
            weekDate: targetSession.weekDate,
            OR: [
              { recurringSlot: { dayOfWeek: targetDay } },
              { customDay: targetDay },
            ],
          },
        },
      });

      if (existingComing) {
        return Response.json(
          { error: "You're already marked as coming to another session on this day. Change that vote first." },
          { status: 400 }
        );
      }
    }
```

Also update the session findUnique select to include the fields we need:
```typescript
    const targetSession = await prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        votingEnabled: true,
        votingDeadline: true,
        status: true,
        weekDate: true,
        customDay: true,
        recurringSlot: {
          select: { dayOfWeek: true, startHour: true },
        },
      },
    });
```

Add import at the top:
```typescript
import { MAX_CLASS_SIZE } from "@/lib/constants";
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- app/api/__tests__/votes.test.ts`
Expected: ALL PASS (19 tests: 15 existing + 4 new)

**Step 5: Commit**

```bash
git add app/api/votes/route.ts app/api/__tests__/votes.test.ts
git commit -m "feat: enforce one-Coming-per-day and full-session checks in votes API"
```

---

### Task 3: Fix Owner session detail — use all active/trial members for vote pool

**Files:**
- Modify: `app/(owner)/owner/session/[id]/page.tsx`

**Step 1: Update the voteMembers construction**

In `app/(owner)/owner/session/[id]/page.tsx`, the `voteMembers` list currently builds from `session.members` (assigned only). Change it to build from `allMembers` (already fetched on line 73):

Replace the voteMembers block (lines 80-88):
```typescript
  // Build vote members list from ALL active/trial members (not just assigned)
  // because any member can vote when voting is enabled
  const voteMembers = session.votingEnabled
    ? allMembers.map((m) => {
        const vote = session.votes.find((v) => v.userId === m.id);
        return {
          userId: m.id,
          name: m.name,
          attending: vote ? vote.attending : null,
        };
      })
    : session.members.map((sm) => {
        const vote = session.votes.find((v) => v.userId === sm.userId);
        return {
          userId: sm.userId,
          name: sm.user.name,
          attending: vote ? vote.attending : null,
        };
      });
```

**Step 2: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add "app/(owner)/owner/session/[id]/page.tsx"
git commit -m "fix: owner session detail uses all active members for vote pool"
```

---

### Task 4: Fix Trainer session detail — same change as owner

**Files:**
- Modify: `app/(trainer)/trainer/session/[id]/page.tsx`

**Step 1: Update the voteMembers construction**

Replace the voteMembers block (lines 78-85):
```typescript
  // Build vote members list from ALL active/trial members when voting is enabled
  const voteMembers = session.votingEnabled
    ? allMembers.map((m) => {
        const vote = session.votes.find((v) => v.userId === m.id);
        return {
          userId: m.id,
          name: m.name,
          attending: vote ? vote.attending : null,
        };
      })
    : session.members.map((sm) => {
        const vote = session.votes.find((v) => v.userId === sm.userId);
        return {
          userId: sm.userId,
          name: sm.user.name,
          attending: vote ? vote.attending : null,
        };
      });
```

**Step 2: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add "app/(trainer)/trainer/session/[id]/page.tsx"
git commit -m "fix: trainer session detail uses all active members for vote pool"
```

---

### Task 5: Fix Member session detail — use totalActiveMembers and add same-day/full checks

**Files:**
- Modify: `app/(member)/member/session/[id]/page.tsx`
- Modify: `app/(member)/member/session/[id]/MemberSessionDetailClient.tsx`

**Step 1: Update the server page to pass totalActiveMembers, isFull, and comingOnSameDay**

In `app/(member)/member/session/[id]/page.tsx`, add queries after the session fetch:

```typescript
  // Count all active/trial members for the vote pool
  const totalActiveMembers = await prisma.user.count({
    where: {
      role: "MEMBER",
      status: { in: ["ACTIVE", "TRIAL"] },
    },
  });

  // Count "Coming" votes for this session to check if full
  const comingVoteCount = session.votes.filter((v) => v.attending).length;

  // Check if this member already voted "Coming" on another session on the same day
  const sessionDay = session.recurringSlot?.dayOfWeek ?? session.customDay;
  const hasComingVoteOnSameDay = sessionDay != null
    ? await prisma.vote.findFirst({
        where: {
          userId: authSession.user.id,
          attending: true,
          sessionId: { not: session.id },
          session: {
            weekDate: session.weekDate,
            OR: [
              { recurringSlot: { dayOfWeek: sessionDay } },
              { customDay: sessionDay },
            ],
          },
        },
      }).then((v) => v !== null)
    : false;
```

Update the returned props to pass these:
```typescript
  return (
    <MemberSessionDetailClient
      session={{
        // ...existing fields...
        totalMembers: totalActiveMembers,
        votesCount: {
          coming: comingVoteCount,
          notComing: session.votes.filter((v) => !v.attending).length,
        },
      }}
      myVote={myVote ? myVote.attending : null}
      userId={authSession.user.id}
      isFull={comingVoteCount >= MAX_CLASS_SIZE}
      hasComingVoteOnSameDay={hasComingVoteOnSameDay}
    />
  );
```

Add import at the top:
```typescript
import { MAX_CLASS_SIZE } from "@/lib/constants";
```

**Step 2: Update MemberSessionDetailClient to use the new props**

In `MemberSessionDetailClient.tsx`:

Add `isFull` and `hasComingVoteOnSameDay` to the props interface:
```typescript
interface MemberSessionDetailClientProps {
  session: SessionData;
  myVote: boolean | null;
  userId: string;
  isFull: boolean;
  hasComingVoteOnSameDay: boolean;
}
```

Update destructuring:
```typescript
export function MemberSessionDetailClient(
  props: MemberSessionDetailClientProps
): React.ReactElement {
  const { session, myVote, isFull, hasComingVoteOnSameDay } = props;
```

Update `canVote` logic:
```typescript
  const canVote = session.votingEnabled && !deadlinePassed && !isCancelled && !isFull;
```

Update the "I'm Coming" button to be disabled when `hasComingVoteOnSameDay`:
```typescript
  <Button
    variant={currentVote === true ? "primary" : "secondary"}
    size="sm"
    onClick={() => handleVote(true)}
    loading={voting}
    disabled={hasComingVoteOnSameDay && currentVote !== true}
  >
    {currentVote === true ? "✓ I'm Coming" : "I'm Coming"}
  </Button>
```

Add a message when `hasComingVoteOnSameDay`:
```typescript
  {hasComingVoteOnSameDay && currentVote !== true && (
    <p className="text-xs text-warning-400">
      You&apos;re already coming to another session on this day.
    </p>
  )}
```

Add Full state display when `isFull`:
```typescript
  {isFull && (
    <div>
      <Badge variant="warning" size="sm">Full</Badge>
      <p className="mt-2 text-sm text-surface-500">
        This session is full — voting is closed.
      </p>
    </div>
  )}
```

The Attendance section at the bottom already uses:
```
{session.totalMembers - session.votesCount.coming - session.votesCount.notComing}
```
Since we're now passing `totalActiveMembers` as `totalMembers`, this will automatically be correct.

**Step 3: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add "app/(member)/member/session/[id]/page.tsx" "app/(member)/member/session/[id]/MemberSessionDetailClient.tsx"
git commit -m "fix: member session detail uses all active members for vote pool, shows full/same-day constraints"
```

---

### Task 6: Run full test suite and verify

**Step 1: Run all tests**

Run: `npm test`
Expected: ALL PASS (363+ tests)

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Run linter**

Run: `npm run lint`
Expected: Only the 4 pre-existing warnings

**Step 4: Final commit if any cleanup needed**

---

### Task 7: Update existing test for getVoteSummary to handle the new totalMembers semantics

**Files:**
- Modify: `lib/__tests__/voting-logic.test.ts`

The existing `getVoteSummary` tests still pass because the function itself doesn't change — only what `totalMembers` value is passed to it changes. But we should add a test that documents the new behavior:

```typescript
  it("handles totalMembers larger than votes (all-members pool)", () => {
    // Simulates voting-enabled: 30 total active members, only 5 voted
    const votes = [
      { attending: true },
      { attending: true },
      { attending: false },
      { attending: false },
      { attending: true },
    ];

    const result = getVoteSummary(votes, 30);

    expect(result.coming).toBe(3);
    expect(result.notComing).toBe(2);
    expect(result.noVote).toBe(25);
    expect(result.total).toBe(30);
  });
```
