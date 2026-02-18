# Owner as Trainer — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Include the owner in all trainer selection lists so they can be assigned to sessions alongside trainers.

**Architecture:** The owner (role=OWNER) needs to appear in trainer lists in two places: the session detail trainer assignment toggle list, and the private sessions trainer dropdown. This requires changes to Prisma queries (include OWNER in trainer fetches), API validation (accept OWNER as a valid trainer assignee), and minor UI adjustments (remove the separate "Me (Owner)" default option from the private sessions dropdown since the owner will now appear in the list like any trainer).

**Tech Stack:** Next.js 15, TypeScript, Prisma 7, Vitest

---

### Task 1: Update session-trainers API to accept OWNER role

**Files:**
- Modify: `app/api/sessions/[id]/trainers/route.ts:81` (role check)
- Test: `app/api/__tests__/session-trainers.test.ts`

**Step 1: Write the failing test**

In `app/api/__tests__/session-trainers.test.ts`, add a new test inside the existing `describe` block, after the "returns 400 when target user is not a TRAINER" test:

```typescript
it("allows assigning a user with OWNER role as trainer", async () => {
  mockAuth.mockResolvedValue(ownerSession());
  mockPrisma.session.findUnique.mockResolvedValue({ id: "s-1", status: "SCHEDULED" });
  mockPrisma.user.findUnique.mockResolvedValue({ id: "owner-1", role: "OWNER" });
  mockPrisma.sessionTrainer.findUnique.mockResolvedValue(null);
  mockPrisma.sessionTrainer.create.mockResolvedValue({});
  mockPrisma.sessionTrainer.findMany.mockResolvedValue([
    {
      userId: "owner-1",
      user: { id: "owner-1", name: "Owner One", email: "owner@test.com" },
    },
  ]);

  const { POST } = await import("@/app/api/sessions/[id]/trainers/route");
  const response = await POST(
    makeRequest({ userId: "owner-1", action: "add" }),
    makeParams("s-1")
  );
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(body.data).toHaveLength(1);
  expect(body.data[0].userId).toBe("owner-1");
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- app/api/__tests__/session-trainers.test.ts`
Expected: FAIL — "User is not a trainer" 400 response because the route rejects non-TRAINER roles.

**Step 3: Update the route to accept OWNER role**

In `app/api/sessions/[id]/trainers/route.ts`, change line 81 from:

```typescript
if (targetUser.role !== "TRAINER") {
```

to:

```typescript
if (targetUser.role !== "TRAINER" && targetUser.role !== "OWNER") {
```

Also update the error message on line 83 from `"User is not a trainer"` to `"User is not a trainer or owner"`.

**Step 4: Run test to verify it passes**

Run: `npm test -- app/api/__tests__/session-trainers.test.ts`
Expected: ALL PASS (14 existing + 1 new = 15 tests)

**Step 5: Commit**

```bash
git add app/api/sessions/[id]/trainers/route.ts app/api/__tests__/session-trainers.test.ts
git commit -m "feat: allow owner to be assigned as trainer to sessions"
```

---

### Task 2: Update session detail page to include owner in trainer list

**Files:**
- Modify: `app/(owner)/owner/session/[id]/page.tsx:68-72` (Prisma query)

**Step 1: Update the Prisma query**

In `app/(owner)/owner/session/[id]/page.tsx`, change lines 68-72 from:

```typescript
prisma.user.findMany({
  where: { role: "TRAINER", status: { not: "DEPARTED" } },
  select: { id: true, name: true },
  orderBy: { name: "asc" },
}),
```

to:

```typescript
prisma.user.findMany({
  where: { role: { in: ["TRAINER", "OWNER"] }, status: { not: "DEPARTED" } },
  select: { id: true, name: true },
  orderBy: { name: "asc" },
}),
```

**Step 2: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: zero errors

**Step 3: Commit**

```bash
git add app/(owner)/owner/session/[id]/page.tsx
git commit -m "feat: include owner in session detail trainer list"
```

---

### Task 3: Update private sessions page to include owner in trainer list

**Files:**
- Modify: `app/(owner)/private-sessions/page.tsx:46-50` (Prisma query)

**Step 1: Update the Prisma query**

In `app/(owner)/private-sessions/page.tsx`, change lines 46-50 from:

```typescript
const trainers = await prisma.user.findMany({
  where: { role: "TRAINER" },
  select: { id: true, name: true },
  orderBy: { name: "asc" },
});
```

to:

```typescript
const trainers = await prisma.user.findMany({
  where: { role: { in: ["TRAINER", "OWNER"] } },
  select: { id: true, name: true },
  orderBy: { name: "asc" },
});
```

**Step 2: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: zero errors

**Step 3: Commit**

```bash
git add app/(owner)/private-sessions/page.tsx
git commit -m "feat: include owner in private sessions trainer list"
```

---

### Task 4: Update private sessions API to accept owner as trainerId

**Files:**
- Modify: `app/api/private-sessions/route.ts:115-124` (trainerId validation)
- Test: `app/api/__tests__/private-sessions.test.ts`

**Step 1: Write the failing test**

In `app/api/__tests__/private-sessions.test.ts`, add a new test in the POST describe block, after the "uses trainerId as createdById when provided by owner" test:

```typescript
it("accepts owner's own ID as trainerId", async () => {
  mockAuth.mockResolvedValue(ownerSession());
  mockPrisma.user.findFirst.mockResolvedValue({ id: "owner-1" });
  mockPrisma.privateSession.create.mockResolvedValue({
    ...SAMPLE_PRIVATE_SESSION,
    createdById: "owner-1",
  });

  const body = { ...VALID_POST_BODY, trainerId: "owner-1" };
  const { POST } = await import("@/app/api/private-sessions/route");
  await POST(makePostRequest(body));

  const createCallArgs = mockPrisma.privateSession.create.mock.calls[0][0];
  expect(createCallArgs.data.createdById).toBe("owner-1");
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- app/api/__tests__/private-sessions.test.ts`
Expected: FAIL — `findFirst` is called with `{ role: "TRAINER" }` which won't match the owner, so it returns null and the API returns 400 "Invalid trainer ID". But wait — the mock returns `{ id: "owner-1" }` so the test will actually pass with the mock. We need a more targeted test.

Instead, add this test that verifies the Prisma query includes OWNER:

```typescript
it("accepts owner's own ID as trainerId (validates query includes OWNER role)", async () => {
  mockAuth.mockResolvedValue(ownerSession());
  mockPrisma.user.findFirst.mockResolvedValue(null); // simulate no match
  mockPrisma.privateSession.create.mockResolvedValue(SAMPLE_PRIVATE_SESSION);

  const body = { ...VALID_POST_BODY, trainerId: "owner-1" };
  const { POST } = await import("@/app/api/private-sessions/route");
  await POST(makePostRequest(body));

  // Verify the findFirst query accepts both TRAINER and OWNER roles
  const findFirstCallArgs = mockPrisma.user.findFirst.mock.calls[0][0];
  expect(findFirstCallArgs.where.role).toEqual({ in: ["TRAINER", "OWNER"] });
});
```

Actually, since this is a mock-based test and we can't easily verify the query shape changes without it being brittle, the better approach is to just change the code and verify existing tests still pass. The existing test "returns 400 when trainerId does not reference a valid trainer" already covers the negative case.

**Step 1 (revised): Update the API route**

In `app/api/private-sessions/route.ts`, change lines 116-118 from:

```typescript
const trainer = await prisma.user.findFirst({
  where: { id: parsed.data.trainerId, role: "TRAINER" },
  select: { id: true },
});
```

to:

```typescript
const trainer = await prisma.user.findFirst({
  where: { id: parsed.data.trainerId, role: { in: ["TRAINER", "OWNER"] } },
  select: { id: true },
});
```

**Step 2: Run tests to verify all pass**

Run: `npm test -- app/api/__tests__/private-sessions.test.ts`
Expected: ALL PASS (43 tests)

**Step 3: Commit**

```bash
git add app/api/private-sessions/route.ts
git commit -m "feat: accept owner as valid trainerId in private sessions API"
```

---

### Task 5: Remove "Me (Owner)" default option from private sessions dropdown

**Files:**
- Modify: `app/(owner)/private-sessions/PrivateSessionsClient.tsx:490-499` (dropdown options)

Since the owner now appears in the trainer list fetched from the server, the hardcoded "Me (Owner)" default option is redundant. Replace it with a neutral "Select trainer" placeholder.

**Step 1: Update the dropdown**

In `app/(owner)/private-sessions/PrivateSessionsClient.tsx`, change lines 490-499 from:

```tsx
{trainers && trainers.length > 0 && (
  <Select
    label="Trainer"
    value={trainerId}
    onChange={(e) => setTrainerId(e.target.value)}
    options={[
      { value: "", label: "Me (Owner)" },
      ...trainers.map((t) => ({ value: t.id, label: t.name })),
    ]}
  />
)}
```

to:

```tsx
{trainers && trainers.length > 0 && (
  <Select
    label="Trainer"
    value={trainerId}
    onChange={(e) => setTrainerId(e.target.value)}
    options={[
      { value: "", label: "Select trainer" },
      ...trainers.map((t) => ({ value: t.id, label: t.name })),
    ]}
  />
)}
```

**Step 2: Update the handleCreate logic**

Currently when `trainerId` is empty string, the API uses the logged-in user's ID as `createdById`. With the owner now in the list, an empty `trainerId` should still default to the owner (the logged-in user). Check `handleCreate` at line 199:

```typescript
...(trainerId ? { trainerId } : {}),
```

This already works correctly — if no trainer is selected, `trainerId` is not sent, and the API defaults to `session.user.id` (the owner). No change needed here.

**Step 3: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: zero errors

**Step 4: Commit**

```bash
git add app/(owner)/private-sessions/PrivateSessionsClient.tsx
git commit -m "feat: replace hardcoded 'Me (Owner)' with 'Select trainer' in dropdown"
```

---

### Task 6: Update schedule page trainer query (unused but should be consistent)

**Files:**
- Modify: `app/(owner)/owner/schedule/page.tsx:22-27` (Prisma query)

The schedule page fetches trainers but doesn't currently use them (known lint warning). Update the query for consistency so if the prop is used in the future, it includes the owner.

**Step 1: Update the Prisma query**

In `app/(owner)/owner/schedule/page.tsx`, change lines 22-27 from:

```typescript
const trainers = await prisma.user.findMany({
  where: { role: "TRAINER" },
  select: { id: true, name: true, email: true },
  orderBy: { name: "asc" },
});
```

to:

```typescript
const trainers = await prisma.user.findMany({
  where: { role: { in: ["TRAINER", "OWNER"] } },
  select: { id: true, name: true, email: true },
  orderBy: { name: "asc" },
});
```

**Step 2: Commit**

```bash
git add app/(owner)/owner/schedule/page.tsx
git commit -m "feat: include owner in schedule page trainer query for consistency"
```

---

### Task 7: Run full verification

**Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: zero errors

**Step 2: Lint**

Run: `npm run lint`
Expected: only the 4 pre-existing warnings

**Step 3: Run full test suite**

Run: `npm test`
Expected: ALL PASS (615 + 1 new = 616 tests)

**Step 4: Final commit (squash if desired)**

All changes are already committed. Optionally squash into a single commit if preferred.
