# Private Sessions — Trainer Visibility for Owner

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show which trainer created each private session in the owner's table, and let the owner pick a trainer when creating a new private session.

**Architecture:** Two changes — (1) add a "Trainer" column to the session table between Client and Date, (2) add a trainer `<Select>` dropdown in the create modal (owner only). The API POST must accept an optional `trainerId` field so the owner can create sessions on behalf of a trainer. The `PrivateSessionsClient` receives a `trainers` prop (only when rendered for the owner) to populate the dropdown. The trainer page is unchanged.

**Tech Stack:** React, Tailwind CSS, Zod, Vitest, Next.js Server Components

---

### Task 1: Add "Trainer" column to the session table

**Files:**
- Modify: `app/(owner)/private-sessions/PrivateSessionsClient.tsx:368-431` (table)

**Step 1: Write failing tests for the Trainer column**

Add these tests to the "Session Table" describe block in `app/(owner)/private-sessions/__tests__/PrivateSessionsClient.test.tsx`:

```typescript
it("table has 'Trainer' column header", () => {
  render(<PrivateSessionsClient {...defaultProps} />);
  expect(screen.getByText("Trainer")).toBeDefined();
});

it("shows trainer name for each session", () => {
  render(<PrivateSessionsClient {...defaultProps} />);
  expect(screen.getAllByText("Trainer One").length).toBe(2); // Jane + Alice
  expect(screen.getByText("Trainer Two")).toBeDefined();
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- app/(owner)/private-sessions/__tests__/PrivateSessionsClient.test.tsx`
Expected: FAIL — "Trainer" column header not found

**Step 3: Add the Trainer column to the table**

In `PrivateSessionsClient.tsx`, add a `<th>` for "Trainer" after the Client header and a `<td>` showing `ps.createdBy` in each row.

In the `<thead>`, after the Client `<th>` (line ~371), add:

```tsx
<th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-surface-500">
  Trainer
</th>
```

In the `<tbody>`, after the Client `<td>` (line ~396), add:

```tsx
<td className="px-6 py-3 text-sm text-surface-400">
  {ps.createdBy}
</td>
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- app/(owner)/private-sessions/__tests__/PrivateSessionsClient.test.tsx`
Expected: PASS

**Step 5: Commit**

```
feat: add Trainer column to owner private sessions table
```

---

### Task 2: Add `trainerId` support to the Zod schema and API POST

**Files:**
- Modify: `types/index.ts:139-146` (PrivateSessionSchema)
- Modify: `app/api/private-sessions/route.ts:97-107` (POST handler)
- Test: `app/api/__tests__/private-sessions.test.ts`

**Step 1: Write failing tests for trainerId in the API**

Add to the POST describe block in `app/api/__tests__/private-sessions.test.ts`:

```typescript
it("uses trainerId as createdById when provided by owner", async () => {
  mockAuth.mockResolvedValue(ownerSession);
  mockPrisma.privateSession.create.mockResolvedValue({
    ...VALID_PRIVATE_SESSION,
    createdById: "trainer-99",
  });

  const body = { ...VALID_POST_BODY, trainerId: "trainer-99" };
  const { POST } = await import("@/app/api/private-sessions/route");
  await POST(makePostRequest(body));

  const createCallArgs = mockPrisma.privateSession.create.mock.calls[0][0];
  expect(createCallArgs.data.createdById).toBe("trainer-99");
});

it("ignores trainerId when request is from a trainer (not owner)", async () => {
  mockAuth.mockResolvedValue(trainerSession("trainer-42"));
  mockPrisma.privateSession.create.mockResolvedValue(VALID_PRIVATE_SESSION);

  const body = { ...VALID_POST_BODY, trainerId: "trainer-99" };
  const { POST } = await import("@/app/api/private-sessions/route");
  await POST(makePostRequest(body));

  const createCallArgs = mockPrisma.privateSession.create.mock.calls[0][0];
  expect(createCallArgs.data.createdById).toBe("trainer-42");
});

it("falls back to session.user.id when owner omits trainerId", async () => {
  mockAuth.mockResolvedValue(ownerSession);
  mockPrisma.privateSession.create.mockResolvedValue(VALID_PRIVATE_SESSION);

  const { POST } = await import("@/app/api/private-sessions/route");
  await POST(makePostRequest(VALID_POST_BODY));

  const createCallArgs = mockPrisma.privateSession.create.mock.calls[0][0];
  expect(createCallArgs.data.createdById).toBe(ownerSession.user.id);
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- app/api/__tests__/private-sessions.test.ts`
Expected: FAIL — trainerId not accepted / createdById not set correctly

**Step 3: Add trainerId to schema and POST handler**

In `types/index.ts`, add `trainerId` as an optional field to `PrivateSessionSchema`:

```typescript
export const PrivateSessionSchema = z.object({
  clientName: z.string().min(1, 'Client name is required'),
  scheduledAt: z.string().datetime('Invalid date format'),
  paid: z.boolean().default(false),
  amount: z.number().positive('Amount must be positive').optional(),
  exerciseDetails: z.string().max(MAX_PRIVATE_SESSION_EXERCISE_LENGTH, `Exercise details too long`).optional(),
  notes: z.string().max(MAX_PRIVATE_SESSION_NOTES_LENGTH, `Notes too long`).optional(),
  trainerId: z.string().cuid('Invalid trainer ID').optional(),
});
```

In `app/api/private-sessions/route.ts` POST handler, replace `createdById: session.user.id` with:

```typescript
createdById: (role === "OWNER" && parsed.data.trainerId)
  ? parsed.data.trainerId
  : session.user.id,
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- app/api/__tests__/private-sessions.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat: accept optional trainerId in private session creation API
```

---

### Task 3: Pass trainers list from owner page to client component

**Files:**
- Modify: `app/(owner)/private-sessions/page.tsx` (fetch trainers, pass as prop)
- Modify: `app/(owner)/private-sessions/PrivateSessionsClient.tsx` (accept trainers prop)

**Step 1: Write failing test for the trainer dropdown in the create modal**

Add to the "Create Modal" describe block in `app/(owner)/private-sessions/__tests__/PrivateSessionsClient.test.tsx`:

```typescript
it("shows trainer select dropdown when trainers are provided", async () => {
  render(
    <PrivateSessionsClient
      {...defaultProps}
      trainers={[
        { id: "t-1", name: "Trainer One" },
        { id: "t-2", name: "Trainer Two" },
      ]}
    />
  );

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "New Session" }));
  });

  expect(screen.getByLabelText("Trainer")).toBeDefined();
});

it("does not show trainer select when trainers prop is not provided", async () => {
  render(<PrivateSessionsClient {...defaultProps} />);

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "New Session" }));
  });

  expect(screen.queryByLabelText("Trainer")).toBeNull();
});

it("trainer select lists all trainers plus 'Me (Owner)' option", async () => {
  render(
    <PrivateSessionsClient
      {...defaultProps}
      trainers={[
        { id: "t-1", name: "Trainer One" },
        { id: "t-2", name: "Trainer Two" },
      ]}
    />
  );

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "New Session" }));
  });

  const select = screen.getByLabelText("Trainer") as HTMLSelectElement;
  const options = Array.from(select.options).map(o => o.text);
  expect(options).toContain("Me (Owner)");
  expect(options).toContain("Trainer One");
  expect(options).toContain("Trainer Two");
});

it("sends trainerId in POST when a trainer is selected", async () => {
  const mockFetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: {} }),
  });
  global.fetch = mockFetch;

  render(
    <PrivateSessionsClient
      {...defaultProps}
      trainers={[
        { id: "t-1", name: "Trainer One" },
        { id: "t-2", name: "Trainer Two" },
      ]}
    />
  );

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "New Session" }));
  });

  fireEvent.change(screen.getByLabelText("Client Name"), { target: { value: "Test Client" } });
  fireEvent.change(screen.getByLabelText("Scheduled At"), {
    target: { value: "2026-03-01T10:00" },
  });
  fireEvent.change(screen.getByLabelText("Amount (MKD)"), { target: { value: "500" } });
  fireEvent.change(screen.getByLabelText("Trainer"), { target: { value: "t-2" } });

  await act(async () => {
    fireEvent.submit(screen.getByRole("button", { name: "Create Session" }));
  });

  const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
  expect(body.trainerId).toBe("t-2");
});

it("does not send trainerId when 'Me (Owner)' is selected", async () => {
  const mockFetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: {} }),
  });
  global.fetch = mockFetch;

  render(
    <PrivateSessionsClient
      {...defaultProps}
      trainers={[
        { id: "t-1", name: "Trainer One" },
      ]}
    />
  );

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "New Session" }));
  });

  fireEvent.change(screen.getByLabelText("Client Name"), { target: { value: "Test Client" } });
  fireEvent.change(screen.getByLabelText("Scheduled At"), {
    target: { value: "2026-03-01T10:00" },
  });
  fireEvent.change(screen.getByLabelText("Amount (MKD)"), { target: { value: "500" } });
  // Leave trainer select on default ("" = Me/Owner)

  await act(async () => {
    fireEvent.submit(screen.getByRole("button", { name: "Create Session" }));
  });

  const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
  expect(body.trainerId).toBeUndefined();
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- app/(owner)/private-sessions/__tests__/PrivateSessionsClient.test.tsx`
Expected: FAIL

**Step 3: Update the component to accept trainers and show the dropdown**

In `PrivateSessionsClient.tsx`:

1. Add to interface and props:

```typescript
interface TrainerOption {
  id: string;
  name: string;
}

interface PrivateSessionsClientProps {
  sessions: PrivateSessionItem[];
  summary: PrivateSessionsSummary;
  trainers?: TrainerOption[];
}
```

2. Import `Select`:

```typescript
import { Select } from "@/components/ui/Select";
```

3. Add form state for `trainerId`:

```typescript
const [trainerId, setTrainerId] = useState("");
```

4. Reset `trainerId` in `resetForm()`:

```typescript
setTrainerId("");
```

5. Add to `handleCreate` payload (before `exerciseDetails`):

```typescript
...(trainerId ? { trainerId } : {}),
```

6. Add the `<Select>` in the modal form, right after the Amount input and before the paid checkbox:

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

**Step 4: Update the owner page to fetch and pass trainers**

In `app/(owner)/private-sessions/page.tsx`, add a query to fetch trainers and pass them as a prop:

```typescript
const trainers = await prisma.user.findMany({
  where: { role: "TRAINER" },
  select: { id: true, name: true },
  orderBy: { name: "asc" },
});
```

Pass to component:

```tsx
<PrivateSessionsClient
  sessions={...}
  summary={...}
  trainers={trainers}
/>
```

**Step 5: Run tests to verify they pass**

Run: `npm test -- app/(owner)/private-sessions/__tests__/PrivateSessionsClient.test.tsx`
Expected: PASS

**Step 6: Commit**

```
feat: add trainer selection dropdown to owner private session creation
```

---

### Task 4: Update existing tests for the new Trainer column header

**Files:**
- Modify: `app/(owner)/private-sessions/__tests__/PrivateSessionsClient.test.tsx`

**Step 1: Update the column headers test**

The existing test "table has correct column headers" (line ~318) asserts 5 headers. Update it to include "Trainer":

```typescript
it("table has correct column headers", () => {
  render(<PrivateSessionsClient {...defaultProps} />);
  expect(screen.getByText("Client")).toBeDefined();
  expect(screen.getByText("Trainer")).toBeDefined();
  expect(screen.getByText("Date")).toBeDefined();
  expect(screen.getByText("Amount")).toBeDefined();
  expect(screen.getByText("Details")).toBeDefined();
  expect(screen.getByText("Status")).toBeDefined();
});
```

**Step 2: Run full test suite**

Run: `npm test`
Expected: ALL PASS

**Step 3: Commit**

```
test: update column header assertions for trainer column
```

---

### Task 5: Type-check, lint, and final verification

**Step 1: Type-check**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 2: Lint**

Run: `npm run lint`
Expected: 0 new warnings

**Step 3: Run full test suite**

Run: `npm test`
Expected: ALL PASS

**Step 4: Final commit (if any fixes needed)**

```
fix: address type/lint issues from trainer visibility feature
```
