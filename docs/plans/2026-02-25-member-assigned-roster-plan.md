# Assigned Members Roster Card — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show an "Members" card on the member session detail page listing assigned members — only for non-voting sessions, only visible to assigned members.

**Architecture:** Add `members` to the Prisma include in the server component, compute `isAssigned` and `assignedMemberNames`, pass to client. Client renders a new card conditionally: `!session.votingEnabled && isAssigned`. No API changes, no schema changes.

**Tech Stack:** Next.js 15 server component, React client component, Prisma query, Vitest + React Testing Library

---

### Task 1: Write failing tests for the Members card

**Files:**
- Modify: `app/(member)/member/session/[id]/__tests__/MemberSessionDetailClient.test.tsx`

**Step 1: Update the `makeSession` helper to include the new fields**

Add `assignedMemberNames: []` to the default session object in `makeSession()`:

```typescript
function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "session-1",
    weekDate: "2026-03-09T00:00:00.000Z",
    status: "SCHEDULED",
    workoutTitle: "HIIT Training",
    workoutDetails: "30 min cardio",
    votingEnabled: true,
    votingDeadline: "2099-01-01T00:00:00.000Z",
    recurringSlot: { dayOfWeek: 1, startHour: 9 },
    customDay: null,
    customStartHour: null,
    trainerNames: ["Coach"],
    comingMemberNames: ["Alice"],
    assignedMemberNames: [],    // <-- ADD THIS
    votesCount: { coming: 1 },
    ...overrides,
  };
}
```

Also update all render calls to include `isAssigned={false}` as a default prop. The existing tests should all continue to pass since:
- They all use voting-enabled sessions (`votingEnabled: true`)
- The Members card only shows when `!votingEnabled && isAssigned`
- Passing `isAssigned={false}` means the card won't appear in existing tests

**Step 2: Add new tests at the bottom of the describe block**

Add these tests inside the main `describe("MemberSessionDetailClient", ...)` block:

```typescript
// ─── Assigned Members card (non-voting sessions) ──────────────────

describe("Assigned Members card", () => {
  it("shows Members card with assigned member names for non-voting session when assigned", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession({
          votingEnabled: false,
          assignedMemberNames: ["Alice", "Bob", "Charlie"],
        })}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
        isAssigned={true}
      />
    );

    expect(screen.getByText("Members")).toBeTruthy();
    expect(screen.getByText("3 assigned")).toBeTruthy();
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.getByText("Bob")).toBeTruthy();
    expect(screen.getByText("Charlie")).toBeTruthy();
  });

  it("shows avatar initials for assigned members", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession({
          votingEnabled: false,
          assignedMemberNames: ["Diana Prince"],
        })}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
        isAssigned={true}
      />
    );

    expect(screen.getByText("D")).toBeTruthy();
    expect(screen.getByText("Diana Prince")).toBeTruthy();
  });

  it("hides Members card when session has voting enabled", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession({
          votingEnabled: true,
          assignedMemberNames: ["Alice"],
        })}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
        isAssigned={true}
      />
    );

    // "Members" as a card title should not appear
    // (Note: "Members" might appear elsewhere, so check for the card subtitle)
    expect(screen.queryByText(/assigned/)).toBeNull();
  });

  it("hides Members card when member is not assigned", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession({
          votingEnabled: false,
          assignedMemberNames: ["Alice", "Bob"],
        })}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
        isAssigned={false}
      />
    );

    expect(screen.queryByText(/assigned/)).toBeNull();
  });

  it("hides Members card when not assigned even if assignedMemberNames is populated", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession({
          votingEnabled: false,
          assignedMemberNames: ["Alice", "Bob", "Charlie"],
        })}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
        isAssigned={false}
      />
    );

    expect(screen.queryByText("3 assigned")).toBeNull();
  });

  it("shows empty state when assigned but no other members", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession({
          votingEnabled: false,
          assignedMemberNames: [],
        })}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
        isAssigned={true}
      />
    );

    expect(screen.getByText("Members")).toBeTruthy();
    expect(screen.getByText("0 assigned")).toBeTruthy();
    expect(screen.getByText("No members assigned yet")).toBeTruthy();
  });
});
```

**Step 3: Run tests to verify they fail**

Run: `npm test -- app/(member)/member/session/[id]/__tests__/MemberSessionDetailClient.test.tsx`

Expected: New tests FAIL (component doesn't accept `isAssigned` or `assignedMemberNames` yet). Existing tests should still PASS since `isAssigned` is not yet a required prop.

---

### Task 2: Implement the client component changes

**Files:**
- Modify: `app/(member)/member/session/[id]/MemberSessionDetailClient.tsx`

**Step 1: Add `assignedMemberNames` to `SessionData` interface**

In the `SessionData` interface (line 25-44), add:

```typescript
assignedMemberNames: string[];
```

**Step 2: Add `isAssigned` to `MemberSessionDetailClientProps` interface**

In the `MemberSessionDetailClientProps` interface (line 46-52), add:

```typescript
isAssigned: boolean;
```

**Step 3: Destructure `isAssigned` from props**

On line 57, update the destructure:

```typescript
const { session, myVote, isFull, hasComingVoteOnSameDay, isAssigned } = props;
```

**Step 4: Add the Members card in the right column**

Insert the Members card between the "Who's Coming" card and the "Trainers" card (after line 297, before line 299). The card renders when `!session.votingEnabled && isAssigned`:

```tsx
{/* Assigned Members — shown for non-voting sessions when assigned */}
{!session.votingEnabled && isAssigned && (
  <Card>
    <CardHeader
      title="Members"
      description={`${session.assignedMemberNames.length} assigned`}
    />
    {session.assignedMemberNames.length === 0 ? (
      <p className="mt-4 text-sm text-surface-500">
        No members assigned yet
      </p>
    ) : (
      <div className="mt-4 space-y-1.5">
        {session.assignedMemberNames.map((name) => (
          <div
            key={name}
            className="flex items-center gap-2 rounded-md bg-surface-900/50 px-3 py-1.5"
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-700 text-xs font-bold text-white">
              {name.charAt(0).toUpperCase()}
            </div>
            <p className="text-sm text-surface-300">{name}</p>
          </div>
        ))}
      </div>
    )}
  </Card>
)}
```

**Step 5: Run the tests**

Run: `npm test -- app/(member)/member/session/[id]/__tests__/MemberSessionDetailClient.test.tsx`

Expected: All tests PASS (both new and existing).

---

### Task 3: Implement the server component changes

**Files:**
- Modify: `app/(member)/member/session/[id]/page.tsx`

**Step 1: Add `members` to the Prisma include**

In the `prisma.session.findUnique` call (line 25-53), add `members` to the `include`:

```typescript
members: {
  select: {
    user: {
      select: {
        id: true,
        name: true,
      },
    },
  },
},
```

**Step 2: Compute `isAssigned` and `assignedMemberNames`**

After the `comingMemberNames` computation (after line 67), add:

```typescript
// Check if this member is assigned to this session
const isAssigned = session.members.some(
  (m) => m.user.id === authSession.user.id
);

// Get assigned member names for non-voting sessions
const assignedMemberNames = session.members.map((m) => m.user.name);
```

**Step 3: Pass new props to the client component**

In the JSX return (line 90-117), add the new props to `MemberSessionDetailClient`:

```typescript
<MemberSessionDetailClient
  session={{
    // ... existing props ...
    assignedMemberNames,
  }}
  myVote={myVote ? myVote.attending : null}
  userId={authSession.user.id}
  isFull={comingVoteCount >= MAX_CLASS_SIZE}
  hasComingVoteOnSameDay={hasComingVoteOnSameDay}
  isAssigned={isAssigned}
/>
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: Zero errors.

---

### Task 4: Run full test suite and verify

**Step 1: Run all tests**

Run: `npm test`

Expected: All tests pass (existing 100 MemberSessionDetailClient tests + 6 new tests + all other test files).

**Step 2: Run linter**

Run: `npm run lint`

Expected: No new warnings (5 pre-existing warnings are acceptable).

**Step 3: Commit**

```bash
git add app/(member)/member/session/[id]/page.tsx app/(member)/member/session/[id]/MemberSessionDetailClient.tsx app/(member)/member/session/[id]/__tests__/MemberSessionDetailClient.test.tsx
git commit -m "feat: show assigned members card on member session detail page

For non-voting (assignment-based) sessions, assigned members now see
a 'Members' card listing all assigned members with avatar initials.
The card only appears when the member is assigned to the session."
```
