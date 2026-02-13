# Session Assignment Management — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable owner and trainer management of session trainer/member assignments, and let members see all sessions on the calendar with visual distinction.

**Architecture:** Two new API routes (`/api/sessions/[id]/trainers` and `/api/sessions/[id]/members`) handle add/remove operations. Owner session detail page gets inline toggle lists for both trainers and members. Trainer session detail page gets inline toggle list for members only. Member schedule API returns all sessions with an `isAssigned` flag, and SessionCard renders differently based on assignment.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma 7, Zod validation, Vitest for testing

---

### Task 1: Add Zod schemas for assignment endpoints

**Files:**
- Modify: `types/index.ts`

**Step 1: Add the schemas**

Add to `types/index.ts` after the VoteSchema section:

```typescript
// ===== SESSION ASSIGNMENT SCHEMAS =====

export const SessionTrainerAssignmentSchema = z.object({
  userId: z.string().cuid('Invalid user ID'),
  action: z.enum(['add', 'remove']),
});

export type SessionTrainerAssignmentInput = z.infer<typeof SessionTrainerAssignmentSchema>;

export const SessionMemberAssignmentSchema = z.object({
  userId: z.string().cuid('Invalid user ID'),
  action: z.enum(['add', 'remove']),
});

export type SessionMemberAssignmentInput = z.infer<typeof SessionMemberAssignmentSchema>;
```

**Step 2: Commit**

```bash
git add types/index.ts
git commit -m "feat: add Zod schemas for session trainer/member assignment"
```

---

### Task 2: Create trainer assignment API route

**Files:**
- Create: `app/api/sessions/[id]/trainers/route.ts`

**Step 1: Write the failing tests**

Create `app/api/__tests__/session-trainers.test.ts` with these test cases:

1. POST returns 401 when not authenticated
2. POST returns 403 when called by MEMBER
3. POST returns 403 when called by TRAINER
4. POST returns 404 when session not found
5. POST returns 400 for invalid body (missing userId)
6. POST returns 400 for invalid body (bad action)
7. POST returns 400 when session is CANCELLED
8. POST returns 400 when user is not a TRAINER role
9. POST add: creates SessionTrainer and returns updated list
10. POST add: returns 409 when trainer already assigned
11. POST remove: deletes SessionTrainer and returns updated list
12. POST remove: returns 404 when trainer not assigned

Use the same mock pattern as `sessions.test.ts`:
- Mock `@/lib/auth` with `mockAuth`
- Mock `@/lib/prisma` with `mockPrisma` (add `sessionTrainer.create`, `sessionTrainer.delete`, `sessionTrainer.findUnique`, and `session.findUnique`)
- Mock `@/lib/notifications` with `dispatchNotification`
- Helper functions: `ownerSession()`, `trainerSession()`, `memberSession()`

**Step 2: Run tests to verify they fail**

```bash
npm test -- app/api/__tests__/session-trainers.test.ts
```

**Step 3: Implement the route**

Create `app/api/sessions/[id]/trainers/route.ts`:

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SessionTrainerAssignmentSchema } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, { params }: RouteParams): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if ((session.user.role as string) !== "OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const existingSession = await prisma.session.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!existingSession) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    if (existingSession.status === "CANCELLED") {
      return Response.json({ error: "Cannot modify cancelled session" }, { status: 400 });
    }

    const body = await req.json();
    const parsed = SessionTrainerAssignmentSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { userId, action } = parsed.data;

    // Validate user is a trainer
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!user || user.role !== "TRAINER") {
      return Response.json({ error: "User is not a trainer" }, { status: 400 });
    }

    if (action === "add") {
      const existing = await prisma.sessionTrainer.findUnique({
        where: { sessionId_userId: { sessionId: id, userId } },
      });
      if (existing) {
        return Response.json({ error: "Trainer already assigned" }, { status: 409 });
      }
      await prisma.sessionTrainer.create({
        data: { sessionId: id, userId },
      });
    } else {
      const existing = await prisma.sessionTrainer.findUnique({
        where: { sessionId_userId: { sessionId: id, userId } },
      });
      if (!existing) {
        return Response.json({ error: "Trainer not assigned to this session" }, { status: 404 });
      }
      await prisma.sessionTrainer.delete({
        where: { sessionId_userId: { sessionId: id, userId } },
      });
    }

    // Return updated trainer list
    const trainers = await prisma.sessionTrainer.findMany({
      where: { sessionId: id },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    return Response.json({
      data: trainers.map((t) => ({
        userId: t.userId,
        name: t.user.name,
        email: t.user.email,
      })),
    });
  } catch (error) {
    console.error("POST /api/sessions/[id]/trainers error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test -- app/api/__tests__/session-trainers.test.ts
```

**Step 5: Commit**

```bash
git add app/api/sessions/[id]/trainers/route.ts app/api/__tests__/session-trainers.test.ts
git commit -m "feat: add trainer assignment API with tests"
```

---

### Task 3: Create member assignment API route

**Files:**
- Create: `app/api/sessions/[id]/members/route.ts`

**Step 1: Write the failing tests**

Create `app/api/__tests__/session-members.test.ts` with these test cases:

1. POST returns 401 when not authenticated
2. POST returns 403 when called by MEMBER
3. POST returns 404 when session not found
4. POST returns 400 for invalid body
5. POST returns 400 when session is CANCELLED
6. POST returns 400 when user is not a MEMBER role
7. POST returns 400 when member has DEPARTED status
8. POST add: creates SessionMember and returns updated list (owner)
9. POST add: works for assigned trainer
10. POST add: returns 409 when member already assigned
11. POST add: returns 400 when at MAX_CLASS_SIZE capacity
12. POST remove: deletes SessionMember and returns updated list
13. POST remove: also deletes the member's Vote if one exists
14. POST remove: returns 404 when member not assigned
15. POST: trainer can only manage sessions they're assigned to (403 otherwise)

Use the same mock pattern. Add `sessionMember`, `vote`, and `user` to mockPrisma.

**Step 2: Run tests to verify they fail**

```bash
npm test -- app/api/__tests__/session-members.test.ts
```

**Step 3: Implement the route**

Create `app/api/sessions/[id]/members/route.ts`:

- Owner OR assigned trainer can call
- Validates user is MEMBER role with status != DEPARTED
- On add: checks MAX_CLASS_SIZE, creates SessionMember
- On remove: deletes SessionMember + deletes Vote if exists (in $transaction)
- Returns updated member list

**Step 4: Run tests to verify they pass**

```bash
npm test -- app/api/__tests__/session-members.test.ts
```

**Step 5: Commit**

```bash
git add app/api/sessions/[id]/members/route.ts app/api/__tests__/session-members.test.ts
git commit -m "feat: add member assignment API with tests"
```

---

### Task 4: Update session GET API for member calendar

**Files:**
- Modify: `lib/session-generation.ts:162-231` (getSessionsForWeek function)

**Step 1: Write failing tests**

Add tests to `lib/__tests__/session-generation.test.ts`:

1. `getSessionsForWeek` for MEMBER role returns all sessions (not filtered)
2. Each session has `isAssigned` boolean set correctly

Note: The actual change is to remove the member filter from getSessionsForWeek. Instead, we fetch ALL sessions and add an `isAssigned` field. Update the `SessionWithDetails` type to include `isAssigned?: boolean`.

**Step 2: Implement the change**

In `getSessionsForWeek`:
- Remove the MEMBER filter (`members: { some: { userId } }`)
- After fetching, add `isAssigned` field for MEMBER role:
  ```typescript
  if (role === 'MEMBER' && userId) {
    for (const s of sessions) {
      (s as SessionWithDetails & { isAssigned?: boolean }).isAssigned =
        s.members.some(m => m.userId === userId);
    }
  }
  ```
- Update `SessionWithDetails` type to add `isAssigned?: boolean`

**Step 3: Run tests**

```bash
npm test -- lib/__tests__/session-generation.test.ts
```

**Step 4: Commit**

```bash
git add lib/session-generation.ts lib/__tests__/session-generation.test.ts
git commit -m "feat: return all sessions for members with isAssigned flag"
```

---

### Task 5: Add AssignmentToggleList component

**Files:**
- Create: `components/schedule/AssignmentToggleList.tsx`

**Step 1: Create the component**

A reusable client component that renders a list of people with toggle switches:

Props:
```typescript
interface AssignmentToggleListProps {
  title: string;
  description?: string;
  people: Array<{ id: string; name: string }>;
  assignedIds: Set<string>;
  onToggle: (userId: string, assigned: boolean) => Promise<void>;
  disabled?: boolean;
  maxCapacity?: number;
  currentCount?: number;
}
```

- Renders a Card with CardHeader showing title + description
- Lists each person with a toggle button (assigned = filled primary, unassigned = outline/ghost)
- Shows loading spinner on the specific toggle being changed
- Disables "add" when at capacity
- Shows "N / MAX members" when maxCapacity is provided

**Step 2: Commit**

```bash
git add components/schedule/AssignmentToggleList.tsx
git commit -m "feat: add AssignmentToggleList component"
```

---

### Task 6: Wire up owner session detail page

**Files:**
- Modify: `app/(owner)/owner/session/[id]/SessionDetailClient.tsx`

**Step 1: Add trainer/member management sections**

In `SessionDetailClient`:
- Add state for `currentTrainers` and `currentMembers` (initialized from session props)
- Add `loadingTrainer` and `loadingMember` state for per-item loading
- Add `handleToggleTrainer(userId, currentlyAssigned)` function that calls `POST /api/sessions/[id]/trainers`
- Add `handleToggleMember(userId, currentlyAssigned)` function that calls `POST /api/sessions/[id]/members`
- Replace the static "Trainers" card with `AssignmentToggleList` for trainers (all trainers from `allTrainers` prop)
- Replace the static "Members" card with `AssignmentToggleList` for members (all members from `allMembers` prop)
- Show capacity count for members

**Step 2: Verify by running dev server and manually testing**

**Step 3: Commit**

```bash
git add app/(owner)/owner/session/[id]/SessionDetailClient.tsx
git commit -m "feat: add trainer/member toggle lists to owner session detail"
```

---

### Task 7: Wire up trainer session detail page

**Files:**
- Modify: `app/(trainer)/trainer/session/[id]/page.tsx`
- Modify: `app/(trainer)/trainer/session/[id]/TrainerSessionDetailClient.tsx`

**Step 1: Update server component to fetch allMembers**

In `page.tsx`, add:
```typescript
const allMembers = await prisma.user.findMany({
  where: { role: "MEMBER", status: { not: "DEPARTED" } },
  select: { id: true, name: true },
  orderBy: { name: "asc" },
});
```

Pass `allMembers` to `TrainerSessionDetailClient`.

**Step 2: Update client component**

In `TrainerSessionDetailClient`:
- Add `allMembers` to props interface
- Add member toggle handling (same pattern as owner but calls `/api/sessions/[id]/members`)
- Replace static "Members" card with `AssignmentToggleList`
- Show capacity count

**Step 3: Commit**

```bash
git add app/(trainer)/trainer/session/[id]/page.tsx app/(trainer)/trainer/session/[id]/TrainerSessionDetailClient.tsx
git commit -m "feat: add member management to trainer session detail"
```

---

### Task 8: Update member calendar to show all sessions

**Files:**
- Modify: `components/schedule/SessionCard.tsx`
- Modify: `app/(member)/member/schedule/MemberScheduleClient.tsx`
- Modify: `app/(member)/member/session/[id]/page.tsx`
- Modify: `app/(member)/member/session/[id]/MemberSessionDetailClient.tsx`

**Step 1: Add `isAssigned` prop to SessionCard**

In `SessionCard.tsx`:
- Add `isAssigned?: boolean` to `SessionCardProps`
- When `isAssigned === false`, render with outlined/semi-transparent style:
  - `border-dashed border-surface-600 bg-surface-800/30 opacity-70` instead of solid border
  - Add "Voting Open" badge if voting is enabled
- Keep existing style when `isAssigned` is true or undefined

**Step 2: Update WeeklyCalendar to pass isAssigned**

The `SessionWithDetails` type already has `isAssigned?: boolean` from Task 4. Pass it through to SessionCard.

**Step 3: Update MemberScheduleClient**

Pass `isAssigned` from session data to SessionCard via WeeklyCalendar.

**Step 4: Update member session detail page**

In `page.tsx`:
- Check if the member is assigned to the session
- Pass `isAssigned` to the client component

In `MemberSessionDetailClient.tsx`:
- Add `isAssigned` to props
- When not assigned: hide voting buttons, show "You are not assigned to this session" info
- Still show workout details, trainers, and attendance summary (read-only)

**Step 5: Commit**

```bash
git add components/schedule/SessionCard.tsx components/schedule/WeeklyCalendar.tsx app/(member)/member/schedule/MemberScheduleClient.tsx app/(member)/member/session/[id]/page.tsx app/(member)/member/session/[id]/MemberSessionDetailClient.tsx
git commit -m "feat: show all sessions on member calendar with visual distinction"
```

---

### Task 9: Run full test suite and lint

**Step 1: Run all tests**

```bash
npm test
```

Expected: All existing 138 tests + new ~40-50 tests pass.

**Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: Zero errors.

**Step 3: Run linter**

```bash
npm run lint
```

Expected: Only the known pre-existing warnings (6).

**Step 4: Fix any issues found**

**Step 5: Final commit if any fixes were needed**

---

### Task 10: Verification build

**Step 1: Run production build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

**Step 2: Commit any remaining fixes**
