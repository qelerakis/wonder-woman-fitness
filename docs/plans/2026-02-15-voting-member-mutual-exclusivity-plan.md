# Voting & Member Assignment Mutual Exclusivity — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make voting and member assignment mutually exclusive — enabling voting clears member assignments, disabling voting clears votes. UI hides the irrelevant section in each mode.

**Architecture:** Extend the existing PATCH `/api/sessions/[id]` handler to perform cleanup when `votingEnabled` is toggled. The cleanup deletes `SessionMember` records (when enabling voting) or `Vote` records (when disabling voting) inside a `$transaction`. UI components conditionally render based on `votingEnabled`.

**Tech Stack:** Next.js API routes, Prisma 7, Vitest, React client components

---

### Task 1: Add `sessionMember` and `vote` mock methods to sessions test

**Files:**
- Modify: `app/api/__tests__/sessions.test.ts:49-65` (mockPrisma object)

**Step 1: Add deleteMany mocks to mockPrisma**

In the `mockPrisma` object (line 49), add `sessionMember` and `vote` properties:

```typescript
const mockPrisma = {
  recurringSlot: {
    findUnique: vi.fn(),
  },
  session: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  sessionMember: {
    deleteMany: vi.fn(),
  },
  vote: {
    deleteMany: vi.fn(),
  },
  sessionTrainer: {
    create: vi.fn(),
  },
  // Interactive transaction: execute callback with same mock objects
  $transaction: vi.fn(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma)),
};
```

**Step 2: Run tests to verify nothing breaks**

Run: `npm test -- app/api/__tests__/sessions.test.ts`
Expected: All 54 existing tests PASS

**Step 3: Commit**

```bash
git add app/api/__tests__/sessions.test.ts
git commit -m "test: add sessionMember and vote deleteMany mocks to sessions test"
```

---

### Task 2: Write failing tests for enabling voting clears members

**Files:**
- Modify: `app/api/__tests__/sessions.test.ts` (add new describe block)

**Step 1: Write failing tests**

Add this new describe block after the existing "PATCH /api/sessions/[id] — trainer voting toggle" section (after line 1046):

```typescript
// ===== PATCH /api/sessions/[id] — Voting/Member Mutual Exclusivity =====

describe("PATCH /api/sessions/[id] — enabling voting clears members", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes all session members when voting is enabled by owner", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: false,
      workoutTitle: null,
      trainers: [],
      members: [
        { user: { id: "m-1", name: "Alice" } },
        { user: { id: "m-2", name: "Bob" } },
        { user: { id: "m-3", name: "Charlie" } },
      ],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
    });
    mockPrisma.sessionMember.deleteMany.mockResolvedValue({ count: 3 });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      votingEnabled: true,
      status: "SCHEDULED",
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: true }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.sessionMember.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: "s-1" },
    });
  });

  it("deletes all session members when voting is enabled by trainer", async () => {
    mockAuth.mockResolvedValue(trainerSession("trainer-1"));
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: false,
      workoutTitle: null,
      trainers: [{ userId: "trainer-1" }],
      members: [
        { user: { id: "m-1", name: "Alice" } },
        { user: { id: "m-2", name: "Bob" } },
      ],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
    });
    mockPrisma.sessionMember.deleteMany.mockResolvedValue({ count: 2 });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      votingEnabled: true,
      status: "SCHEDULED",
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: true }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.sessionMember.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: "s-1" },
    });
  });

  it("does NOT delete members when voting is already enabled (no-op toggle)", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: true,
      workoutTitle: null,
      trainers: [],
      members: [],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
    });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      votingEnabled: true,
      status: "SCHEDULED",
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: true }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(mockPrisma.sessionMember.deleteMany).not.toHaveBeenCalled();
  });

  it("does NOT delete members when only updating workout (no votingEnabled field)", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: false,
      workoutTitle: null,
      trainers: [],
      members: [{ user: { id: "m-1", name: "Alice" } }],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
    });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      votingEnabled: false,
      workoutTitle: "Leg Day",
      status: "SCHEDULED",
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [{ user: { id: "m-1", name: "Alice" } }],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workoutTitle: "Leg Day" }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(mockPrisma.sessionMember.deleteMany).not.toHaveBeenCalled();
  });

  it("clears members even when session has zero members (no error)", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: false,
      workoutTitle: null,
      trainers: [],
      members: [],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
    });
    mockPrisma.sessionMember.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      votingEnabled: true,
      status: "SCHEDULED",
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: true }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.sessionMember.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: "s-1" },
    });
  });

  it("clears members when enabling voting alongside workout update", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: false,
      workoutTitle: null,
      trainers: [],
      members: [{ user: { id: "m-1", name: "Alice" } }],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
    });
    mockPrisma.sessionMember.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      votingEnabled: true,
      workoutTitle: "HIIT",
      status: "SCHEDULED",
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: true, workoutTitle: "HIIT" }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.sessionMember.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: "s-1" },
    });
  });

  it("clears members with many members (capacity edge)", async () => {
    const manyMembers = Array.from({ length: 20 }, (_, i) => ({
      user: { id: `m-${i + 1}`, name: `Member${i + 1}` },
    }));
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-full",
      status: "SCHEDULED",
      votingEnabled: false,
      workoutTitle: null,
      trainers: [],
      members: manyMembers,
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
    });
    mockPrisma.sessionMember.deleteMany.mockResolvedValue({ count: 20 });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-full",
      votingEnabled: true,
      status: "SCHEDULED",
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-full", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: true }),
      }),
      { params: Promise.resolve({ id: "s-full" }) }
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.sessionMember.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: "s-full" },
    });
  });
});
```

**Step 2: Run tests to verify they FAIL**

Run: `npm test -- app/api/__tests__/sessions.test.ts`
Expected: New tests FAIL because `sessionMember.deleteMany` is never called (not implemented yet)

---

### Task 3: Write failing tests for disabling voting clears votes

**Files:**
- Modify: `app/api/__tests__/sessions.test.ts` (add another describe block)

**Step 1: Write failing tests**

Add another describe block after the previous one:

```typescript
describe("PATCH /api/sessions/[id] — disabling voting clears votes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes all votes when voting is disabled by owner", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: true,
      workoutTitle: null,
      trainers: [],
      members: [],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
    });
    mockPrisma.vote.deleteMany.mockResolvedValue({ count: 5 });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      votingEnabled: false,
      status: "SCHEDULED",
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: false }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.vote.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: "s-1" },
    });
  });

  it("deletes all votes when voting is disabled by trainer", async () => {
    mockAuth.mockResolvedValue(trainerSession("trainer-1"));
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: true,
      workoutTitle: null,
      trainers: [{ userId: "trainer-1" }],
      members: [],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
    });
    mockPrisma.vote.deleteMany.mockResolvedValue({ count: 3 });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      votingEnabled: false,
      status: "SCHEDULED",
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: false }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.vote.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: "s-1" },
    });
  });

  it("does NOT delete votes when voting is already disabled (no-op toggle)", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: false,
      workoutTitle: null,
      trainers: [],
      members: [],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
    });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      votingEnabled: false,
      status: "SCHEDULED",
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: false }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(mockPrisma.vote.deleteMany).not.toHaveBeenCalled();
  });

  it("clears votes even when session has zero votes (no error)", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: true,
      workoutTitle: null,
      trainers: [],
      members: [],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
    });
    mockPrisma.vote.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      votingEnabled: false,
      status: "SCHEDULED",
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: false }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.vote.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: "s-1" },
    });
  });

  it("clears votes when disabling voting alongside workout update", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: true,
      workoutTitle: "Old Workout",
      trainers: [],
      members: [],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
    });
    mockPrisma.vote.deleteMany.mockResolvedValue({ count: 8 });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      votingEnabled: false,
      workoutTitle: "New Workout",
      status: "SCHEDULED",
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: false, workoutTitle: "New Workout" }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.vote.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: "s-1" },
    });
  });

  it("clears many votes (30 members all voted)", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-full",
      status: "SCHEDULED",
      votingEnabled: true,
      workoutTitle: null,
      trainers: [],
      members: [],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
    });
    mockPrisma.vote.deleteMany.mockResolvedValue({ count: 20 });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-full",
      votingEnabled: false,
      status: "SCHEDULED",
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-full", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: false }),
      }),
      { params: Promise.resolve({ id: "s-full" }) }
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.vote.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: "s-full" },
    });
  });
});
```

**Step 2: Run tests to verify they FAIL**

Run: `npm test -- app/api/__tests__/sessions.test.ts`
Expected: New tests FAIL because `vote.deleteMany` is never called

---

### Task 4: Write failing tests for transaction safety and cross-cutting edge cases

**Files:**
- Modify: `app/api/__tests__/sessions.test.ts` (add edge case describe block)

**Step 1: Write failing tests**

```typescript
describe("PATCH /api/sessions/[id] — voting toggle transaction & edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses $transaction when enabling voting (atomic cleanup)", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: false,
      workoutTitle: null,
      trainers: [],
      members: [{ user: { id: "m-1", name: "Alice" } }],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
    });
    mockPrisma.sessionMember.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      votingEnabled: true,
      status: "SCHEDULED",
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: true }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it("uses $transaction when disabling voting (atomic cleanup)", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: true,
      workoutTitle: null,
      trainers: [],
      members: [],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
    });
    mockPrisma.vote.deleteMany.mockResolvedValue({ count: 3 });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      votingEnabled: false,
      status: "SCHEDULED",
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: false }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it("does not use $transaction when not toggling voting", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: false,
      workoutTitle: null,
      trainers: [],
      members: [],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
    });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      votingEnabled: false,
      workoutTitle: "Cardio",
      status: "SCHEDULED",
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workoutTitle: "Cardio" }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("enabling voting on cancelled session still clears members", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-cancelled",
      status: "CANCELLED",
      votingEnabled: false,
      workoutTitle: null,
      trainers: [],
      members: [{ user: { id: "m-1", name: "Alice" } }],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
    });
    mockPrisma.sessionMember.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-cancelled",
      votingEnabled: true,
      status: "CANCELLED",
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-cancelled", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: true }),
      }),
      { params: Promise.resolve({ id: "s-cancelled" }) }
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.sessionMember.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: "s-cancelled" },
    });
  });

  it("disabling voting on cancelled session still clears votes", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-cancelled",
      status: "CANCELLED",
      votingEnabled: true,
      workoutTitle: null,
      trainers: [],
      members: [],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
    });
    mockPrisma.vote.deleteMany.mockResolvedValue({ count: 2 });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-cancelled",
      votingEnabled: false,
      status: "CANCELLED",
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-cancelled", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: false }),
      }),
      { params: Promise.resolve({ id: "s-cancelled" }) }
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.vote.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: "s-cancelled" },
    });
  });

  it("enabling voting does NOT clear votes (only members)", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: false,
      workoutTitle: null,
      trainers: [],
      members: [{ user: { id: "m-1", name: "Alice" } }],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
    });
    mockPrisma.sessionMember.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      votingEnabled: true,
      status: "SCHEDULED",
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: true }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(mockPrisma.vote.deleteMany).not.toHaveBeenCalled();
  });

  it("disabling voting does NOT clear members (only votes)", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: true,
      workoutTitle: null,
      trainers: [],
      members: [],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
    });
    mockPrisma.vote.deleteMany.mockResolvedValue({ count: 3 });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      votingEnabled: false,
      status: "SCHEDULED",
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: false }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(mockPrisma.sessionMember.deleteMany).not.toHaveBeenCalled();
  });

  it("cancellation with simultaneous voting toggle does not conflict", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-1",
      status: "SCHEDULED",
      votingEnabled: false,
      workoutTitle: null,
      trainers: [],
      members: [{ user: { id: "m-1", name: "Alice" } }],
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
    });
    mockPrisma.sessionMember.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-1",
      votingEnabled: true,
      status: "CANCELLED",
      recurringSlot: { dayOfWeek: 1, startHour: 9 },
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: true, status: "CANCELLED" }),
      }),
      { params: Promise.resolve({ id: "s-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.sessionMember.deleteMany).toHaveBeenCalled();
  });

  it("custom session (no recurringSlot) — enabling voting clears members", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-custom",
      status: "SCHEDULED",
      votingEnabled: false,
      workoutTitle: null,
      trainers: [],
      members: [{ user: { id: "m-1", name: "Alice" } }],
      recurringSlot: null,
      customDay: 3,
      customStartHour: 14,
    });
    mockPrisma.sessionMember.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-custom",
      votingEnabled: true,
      status: "SCHEDULED",
      recurringSlot: null,
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-custom", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: true }),
      }),
      { params: Promise.resolve({ id: "s-custom" }) }
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.sessionMember.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: "s-custom" },
    });
  });

  it("custom session — disabling voting clears votes", async () => {
    mockAuth.mockResolvedValue(ownerSession());
    mockPrisma.session.findUnique.mockResolvedValue({
      id: "s-custom",
      status: "SCHEDULED",
      votingEnabled: true,
      workoutTitle: null,
      trainers: [],
      members: [],
      recurringSlot: null,
      customDay: 3,
      customStartHour: 14,
    });
    mockPrisma.vote.deleteMany.mockResolvedValue({ count: 4 });
    mockPrisma.session.update.mockResolvedValue({
      id: "s-custom",
      votingEnabled: false,
      status: "SCHEDULED",
      recurringSlot: null,
      members: [],
    });

    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/sessions/s-custom", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: false }),
      }),
      { params: Promise.resolve({ id: "s-custom" }) }
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.vote.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: "s-custom" },
    });
  });
});
```

**Step 2: Run tests to verify they FAIL**

Run: `npm test -- app/api/__tests__/sessions.test.ts`
Expected: New tests FAIL

---

### Task 5: Implement API cleanup logic in PATCH handler

**Files:**
- Modify: `app/api/sessions/[id]/route.ts:131-192` (PATCH handler body)

**Step 1: Implement the voting toggle cleanup logic**

Replace the section from line 131 (`const updateData`) through line 192 (`return Response.json({ data: updated })`) with:

```typescript
    const updateData: Record<string, unknown> = {};

    if (parsed.data.workoutTitle !== undefined) {
      updateData.workoutTitle = parsed.data.workoutTitle;
    }
    if (parsed.data.workoutDetails !== undefined) {
      updateData.workoutDetails = parsed.data.workoutDetails;
    }
    if (parsed.data.votingEnabled !== undefined) {
      updateData.votingEnabled = parsed.data.votingEnabled;
    }

    // Handle cancellation with notifications
    if (parsed.data.status === "CANCELLED" && existingSession.status !== "CANCELLED") {
      updateData.status = "CANCELLED";

      // Notify all members of cancellation
      const memberIds = existingSession.members.map((m) => m.user.id);
      if (memberIds.length > 0) {
        const dayOfWeek = existingSession.recurringSlot?.dayOfWeek ?? existingSession.customDay ?? 0;
        const startHour = existingSession.recurringSlot?.startHour ?? existingSession.customStartHour ?? 0;
        const dayName = DAY_NAMES[dayOfWeek] || "Unknown";
        await dispatchNotificationToMany(
          memberIds,
          "CLASS_CANCELLED",
          `${dayName} ${startHour}:00 class cancelled`,
          `The ${dayName} ${startHour}:00 class has been cancelled. Please check the schedule for alternatives.`
        );
      }
    } else if (parsed.data.status !== undefined) {
      updateData.status = parsed.data.status;
    }

    // Notify members when workout is posted
    if (parsed.data.workoutTitle && !existingSession.workoutTitle) {
      const memberIds = existingSession.members.map((m) => m.user.id);
      if (memberIds.length > 0) {
        await dispatchNotificationToMany(
          memberIds,
          "WORKOUT_POSTED",
          "Workout posted for your upcoming class",
          `New workout: ${parsed.data.workoutTitle}`
        );
      }
    }

    // Determine if voting is being toggled (actual state change)
    const isEnablingVoting =
      parsed.data.votingEnabled === true && !existingSession.votingEnabled;
    const isDisablingVoting =
      parsed.data.votingEnabled === false && existingSession.votingEnabled;

    // If voting is being toggled, use a transaction for atomic cleanup
    if (isEnablingVoting || isDisablingVoting) {
      const updated = await prisma.$transaction(async (tx) => {
        if (isEnablingVoting) {
          // Clear all member assignments when enabling voting
          await tx.sessionMember.deleteMany({
            where: { sessionId: id },
          });
        } else {
          // Clear all votes when disabling voting
          await tx.vote.deleteMany({
            where: { sessionId: id },
          });
        }

        return tx.session.update({
          where: { id },
          data: updateData,
          include: {
            recurringSlot: true,
            members: {
              include: {
                user: {
                  select: { id: true, name: true, email: true },
                },
              },
            },
          },
        });
      });

      return Response.json({ data: updated });
    }

    // No voting toggle — simple update
    const updated = await prisma.session.update({
      where: { id },
      data: updateData,
      include: {
        recurringSlot: true,
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    return Response.json({ data: updated });
```

**Step 2: Run tests to verify they PASS**

Run: `npm test -- app/api/__tests__/sessions.test.ts`
Expected: ALL tests PASS (existing + new)

**Step 3: Commit**

```bash
git add app/api/sessions/[id]/route.ts app/api/__tests__/sessions.test.ts
git commit -m "feat: voting toggle clears members/votes atomically with tests"
```

---

### Task 6: Update owner SessionDetailClient — hide member list when voting enabled

**Files:**
- Modify: `app/(owner)/owner/session/[id]/SessionDetailClient.tsx:345-353`

**Step 1: Wrap member AssignmentToggleList in conditional**

Replace lines 345-353:

```typescript
          <AssignmentToggleList
            title="Members"
            people={allMembers}
            assignedIds={currentMemberIds}
            onToggle={handleToggleMember}
            disabled={isCancelled}
            maxCapacity={MAX_CLASS_SIZE}
            currentCount={currentMemberIds.length}
          />
```

With:

```typescript
          {!session.votingEnabled && (
            <AssignmentToggleList
              title="Members"
              people={allMembers}
              assignedIds={currentMemberIds}
              onToggle={handleToggleMember}
              disabled={isCancelled}
              maxCapacity={MAX_CLASS_SIZE}
              currentCount={currentMemberIds.length}
            />
          )}
```

**Step 2: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add "app/(owner)/owner/session/[id]/SessionDetailClient.tsx"
git commit -m "feat: hide member assignment list when voting enabled (owner)"
```

---

### Task 7: Update trainer TrainerSessionDetailClient — hide member list when voting enabled, show votes only when voting enabled

**Files:**
- Modify: `app/(trainer)/trainer/session/[id]/TrainerSessionDetailClient.tsx:218-227` and `239-245`

**Step 1: Wrap member AssignmentToggleList in conditional**

Replace lines 218-227:

```typescript
          {/* Members */}
          <AssignmentToggleList
            title="Members"
            people={allMembers}
            assignedIds={currentMemberIds}
            onToggle={handleToggleMember}
            disabled={isCancelled}
            maxCapacity={MAX_CLASS_SIZE}
            currentCount={currentMemberIds.length}
          />
```

With:

```typescript
          {/* Members — only shown when voting is disabled */}
          {!session.votingEnabled && (
            <AssignmentToggleList
              title="Members"
              people={allMembers}
              assignedIds={currentMemberIds}
              onToggle={handleToggleMember}
              disabled={isCancelled}
              maxCapacity={MAX_CLASS_SIZE}
              currentCount={currentMemberIds.length}
            />
          )}
```

**Step 2: Wrap Voting Results card in conditional**

Replace lines 239-245:

```typescript
          {/* Voting Results (read-only) */}
          <Card>
            <CardHeader title="Voting Results" />
            <div className="mt-4">
              <VoteSummary members={voteMembers} />
            </div>
          </Card>
```

With:

```typescript
          {/* Voting Results — only shown when voting is enabled */}
          {session.votingEnabled && (
            <Card>
              <CardHeader title="Voting Results" />
              <div className="mt-4">
                <VoteSummary members={voteMembers} />
              </div>
            </Card>
          )}
```

**Step 3: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add "app/(trainer)/trainer/session/[id]/TrainerSessionDetailClient.tsx"
git commit -m "feat: hide member list when voting enabled, hide votes when disabled (trainer)"
```

---

### Task 8: Run full test suite and lint

**Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass

**Step 2: Run linter**

Run: `npm run lint`
Expected: No new warnings (only pre-existing 4)

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

---

### Task 9: Final commit with all changes

If any uncommitted changes remain, create a final commit summarizing the feature.

```bash
git add -A
git commit -m "feat: voting and member assignment mutual exclusivity — complete implementation"
```
