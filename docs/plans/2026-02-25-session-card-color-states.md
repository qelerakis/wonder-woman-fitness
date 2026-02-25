# Session Card Color States Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Color-code session cards in the member schedule to highlight action-needed (yellow) and confirmed/assigned (green) states.

**Architecture:** Modify `SessionCard` to accept an `isAssigned` prop and compute card background color based on three mutually exclusive states: (1) voting enabled + not yet voted = yellow tint, (2) assigned or voted "Going" = green tint, (3) everything else = default dark. The states are mutually exclusive because sessions with assignments never have voting enabled.

**Tech Stack:** React, Tailwind CSS 4, Vitest + React Testing Library

---

### Task 1: Write failing tests for yellow (vote-needed) card background

**Files:**
- Modify: `components/schedule/__tests__/SessionCard.test.tsx`

**Step 1: Write the failing tests**

Add a new `describe("card background color states")` block with tests for the yellow state. Add these tests at the end of the file, before the closing of the top-level describe:

```typescript
describe("card background color states", () => {
  it("shows yellow background when voting enabled and user has not voted", () => {
    const session = makeSession({
      votingEnabled: true,
      votes: [], // no votes at all
    });
    render(
      <SessionCard
        session={session}
        basePath="/member/session"
        showVotingIndicator
        currentUserId="member-1"
      />
    );
    const card = screen.getByRole("link");
    expect(card.className).toContain("bg-warning-500/30");
    expect(card.className).toContain("border-warning-500/40");
  });

  it("shows yellow background when voting enabled and other users voted but current user has not", () => {
    const session = makeSession({
      votingEnabled: true,
      votes: [
        { id: "vote-1", userId: "member-2", attending: true, votedAt: new Date("2026-02-09T10:00:00Z") },
      ],
    });
    render(
      <SessionCard
        session={session}
        basePath="/member/session"
        showVotingIndicator
        currentUserId="member-1"
      />
    );
    const card = screen.getByRole("link");
    expect(card.className).toContain("bg-warning-500/30");
  });

  it("does not show yellow background when showVotingIndicator is false", () => {
    const session = makeSession({
      votingEnabled: true,
      votes: [],
    });
    render(
      <SessionCard
        session={session}
        basePath="/member/session"
        showVotingIndicator={false}
        currentUserId="member-1"
      />
    );
    const card = screen.getByRole("link");
    expect(card.className).not.toContain("bg-warning-500/30");
    expect(card.className).toContain("bg-surface-800");
  });

  it("does not show yellow background when no currentUserId provided", () => {
    const session = makeSession({
      votingEnabled: true,
      votes: [],
    });
    render(
      <SessionCard
        session={session}
        basePath="/member/session"
        showVotingIndicator
      />
    );
    const card = screen.getByRole("link");
    expect(card.className).not.toContain("bg-warning-500/30");
    expect(card.className).toContain("bg-surface-800");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- components/schedule/__tests__/SessionCard.test.tsx`
Expected: 4 FAIL — `bg-warning-500/30` not found in className

---

### Task 2: Write failing tests for green (going/assigned) card background

**Files:**
- Modify: `components/schedule/__tests__/SessionCard.test.tsx`

**Step 1: Add tests for the green state inside the same `describe("card background color states")` block**

```typescript
  it("shows green background when user voted Going", () => {
    const session = makeSession({
      votingEnabled: true,
      votes: [
        { id: "vote-1", userId: "member-1", attending: true, votedAt: new Date("2026-02-09T10:00:00Z") },
      ],
    });
    render(
      <SessionCard
        session={session}
        basePath="/member/session"
        showVotingIndicator
        currentUserId="member-1"
      />
    );
    const card = screen.getByRole("link");
    expect(card.className).toContain("bg-success-600/25");
    expect(card.className).toContain("border-success-600/40");
  });

  it("shows green background when user is assigned (no voting)", () => {
    const session = makeSession({
      votingEnabled: false,
      isAssigned: true,
      votes: [],
    });
    render(
      <SessionCard
        session={session}
        basePath="/member/session"
        showVotingIndicator
        currentUserId="member-1"
        isAssigned
      />
    );
    const card = screen.getByRole("link");
    expect(card.className).toContain("bg-success-600/25");
    expect(card.className).toContain("border-success-600/40");
  });

  it("shows default background when user voted Not Going", () => {
    const session = makeSession({
      votingEnabled: true,
      votes: [
        { id: "vote-1", userId: "member-1", attending: false, votedAt: new Date("2026-02-09T10:00:00Z") },
      ],
    });
    render(
      <SessionCard
        session={session}
        basePath="/member/session"
        showVotingIndicator
        currentUserId="member-1"
      />
    );
    const card = screen.getByRole("link");
    expect(card.className).not.toContain("bg-warning-500/30");
    expect(card.className).not.toContain("bg-success-600/25");
    expect(card.className).toContain("bg-surface-800");
  });

  it("shows default background for cancelled sessions even if voting enabled", () => {
    const session = makeSession({
      status: "CANCELLED",
      votingEnabled: true,
      votes: [],
    });
    render(
      <SessionCard
        session={session}
        basePath="/member/session"
        showVotingIndicator
        currentUserId="member-1"
      />
    );
    const card = screen.getByRole("link");
    expect(card.className).not.toContain("bg-warning-500/30");
    expect(card.className).not.toContain("bg-success-600/25");
  });
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- components/schedule/__tests__/SessionCard.test.tsx`
Expected: 4 more FAIL — `bg-success-600/25` not found in className

---

### Task 3: Implement card background color logic in SessionCard

**Files:**
- Modify: `components/schedule/SessionCard.tsx`

**Step 1: Add `isAssigned` prop to SessionCardProps**

In the `SessionCardProps` interface, add:

```typescript
interface SessionCardProps {
  session: SessionWithDetails;
  basePath: string;
  showVotingIndicator?: boolean;
  currentUserId?: string;
  isAssigned?: boolean;
}
```

**Step 2: Add the `isAssigned` parameter to the destructured props**

```typescript
export function SessionCard({
  session,
  basePath,
  showVotingIndicator = false,
  currentUserId,
  isAssigned = false,
}: SessionCardProps): React.ReactElement {
```

**Step 3: Compute card background class**

After the existing `userVote` computation (around line 42), add:

```typescript
// Card background color based on member state
const needsVote = showVotingIndicator && currentUserId && session.votingEnabled && !isCancelled && !userVote;
const isGoing = (userVote?.attending === true) || isAssigned;

function getCardClasses(): string {
  if (isCancelled) {
    return "border-surface-700 bg-surface-800/50 opacity-60";
  }
  if (needsVote) {
    return "border-warning-500/40 bg-warning-500/30 hover:border-warning-400/50 hover:bg-warning-500/40";
  }
  if (isGoing) {
    return "border-success-600/40 bg-success-600/25 hover:border-success-500/50 hover:bg-success-600/35";
  }
  return "border-surface-700 bg-surface-800 hover:border-primary-600/50 hover:bg-surface-700";
}
```

**Step 4: Replace the existing className logic on the `<Link>`**

Replace the ternary in the className:

```tsx
<Link
  href={`${basePath}/${session.id}`}
  className={`
    group block rounded-lg border p-3
    transition-all duration-150
    ${getCardClasses()}
  `}
>
```

**Step 5: Run tests to verify they pass**

Run: `npm test -- components/schedule/__tests__/SessionCard.test.tsx`
Expected: ALL PASS (including existing 79 tests + 8 new tests)

**Step 6: Commit**

```bash
git add components/schedule/SessionCard.tsx components/schedule/__tests__/SessionCard.test.tsx
git commit -m "feat: add yellow/green background color states to SessionCard"
```

---

### Task 4: Pass `isAssigned` from WeeklyCalendar to SessionCard

**Files:**
- Modify: `components/schedule/WeeklyCalendar.tsx`

**Step 1: Pass `isAssigned` prop to SessionCard**

In `WeeklyCalendar.tsx`, find both places where `<SessionCard>` is rendered (desktop grid and mobile list) and add the `isAssigned` prop:

```tsx
<SessionCard
  key={session.id}
  session={session}
  basePath={basePath}
  showVotingIndicator={showVotingIndicator}
  currentUserId={currentUserId}
  isAssigned={session.isAssigned}
/>
```

Do this in **both** the desktop (`hidden md:grid`) and mobile (`md:hidden`) sections.

**Step 2: Run full test suite**

Run: `npm test`
Expected: ALL PASS

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add components/schedule/WeeklyCalendar.tsx
git commit -m "feat: pass isAssigned from WeeklyCalendar to SessionCard"
```

---

### Task 5: Verify visually and clean up

**Step 1: Run linter**

Run: `npm run lint`
Expected: No new warnings (existing 5 are pre-existing)

**Step 2: Delete the color demo page**

Remove: `app/color-demo/page.tsx`

**Step 3: Commit cleanup**

```bash
git rm app/color-demo/page.tsx
git commit -m "chore: remove color demo page"
```
