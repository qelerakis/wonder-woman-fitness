# Pre-Launch Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all critical, important, and suggestion-level issues identified in the 4-agent pre-launch audit before production deployment.

**Architecture:** Fixes are grouped by area (security, business logic, frontend, deployment) and ordered by severity. Each task is self-contained with exact file paths, code snippets, and test commands. All fixes preserve existing test suite (1,373 tests).

**Tech Stack:** Next.js 15, TypeScript strict, Prisma 7, NextAuth v5, Tailwind CSS 4, Zod, Vitest

---

## Task 1: Generate Initial Database Migration (CRITICAL)

**Files:**
- Create: `prisma/migrations/YYYYMMDDHHMMSS_init/migration.sql` (auto-generated)

**Context:** The `prisma/migrations/` directory only has two incremental migrations but no initial migration that creates the base tables. `prisma migrate deploy` will fail on a fresh production database.

**Step 1: Generate the initial migration**

The existing two migrations need to be handled carefully. Since the DB already exists locally with all tables, we need to:

1. First, back up the two existing migration directories
2. Delete the `prisma/migrations/` directory
3. Run `npx prisma migrate dev --name init` to create a clean initial migration
4. Then re-run `npx prisma migrate dev --name add-private-session-audit-trail-and-cascade` and `npx prisma migrate dev --name add-pending-verification` if those changes aren't already in the schema

Actually, since the schema.prisma already reflects the FINAL state (including audit trail and pending verification), we should:

```bash
# Reset migrations and create a single clean initial migration
# First, delete the migrations folder
rm -rf prisma/migrations

# Then generate a fresh migration from the current schema
npx prisma migrate dev --name init
```

This will create one clean migration with ALL tables, enums, indexes, and constraints.

**Step 2: Verify the migration was created**

Check that `prisma/migrations/YYYYMMDDHHMMSS_init/migration.sql` exists and contains CREATE TABLE statements for all 10 models: User, RecurringSlot, Session, SessionMember, SessionTrainer, Vote, Payment, PrivateSession, Notification, PendingVerification.

**Step 3: Verify migrate deploy works**

```bash
npx prisma migrate reset --force
```

This drops the DB, re-runs all migrations from scratch, and re-seeds. It should complete without errors.

**Step 4: Run tests to confirm nothing broke**

```bash
npm test
```

Expected: All 1,373 tests pass.

**Step 5: Commit**

```bash
git add prisma/migrations/
git commit -m "fix: generate clean initial database migration for production deploy"
```

---

## Task 2: Add Environment Variable Validation + Fix CRON_SECRET Fallback (CRITICAL)

**Files:**
- Create: `lib/env.ts`
- Modify: `lib/cron-auth.ts`
- Modify: `lib/prisma.ts`
- Modify: `lib/email.ts` (line 79 — NEXTAUTH_URL usage)
- Modify: `lib/cloudinary.ts` (lines 17-19)

**Context:** No runtime validation for required env vars. Worst case: empty CRON_SECRET means `Bearer ` matches `Bearer ` — anyone can trigger cron jobs.

**Step 1: Create `lib/env.ts`**

```typescript
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `FATAL: Missing required environment variable: ${name}. ` +
        `Check your .env.local (dev) or Vercel environment variables (production).`
    );
  }
  return value;
}

export const env = {
  DATABASE_URL: requireEnv("DATABASE_URL"),
  NEXTAUTH_SECRET: requireEnv("NEXTAUTH_SECRET"),
  NEXTAUTH_URL: requireEnv("NEXTAUTH_URL"),
  CRON_SECRET: requireEnv("CRON_SECRET"),
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? null,
  EMAIL_FROM: process.env.EMAIL_FROM ?? "noreply@wonderwomanfitness.mk",
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ?? null,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ?? null,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ?? null,
};
```

**Step 2: Fix `lib/cron-auth.ts` to fail closed**

Replace:
```typescript
const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
```

With:
```typescript
export function verifyCronSecret(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("CRON_SECRET is not configured. Rejecting cron request.");
    return false;
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${cronSecret}`;

  if (authHeader.length !== expected.length) return false;

  const encoder = new TextEncoder();
  return crypto.timingSafeEqual(
    encoder.encode(authHeader),
    encoder.encode(expected)
  );
}
```

**Step 3: Update `lib/prisma.ts` to use env module**

Replace:
```typescript
connectionString: process.env.DATABASE_URL!,
```

With:
```typescript
import { env } from "@/lib/env";
// ...
connectionString: env.DATABASE_URL,
```

Also cache the Prisma client in production (currently only cached in dev):

Replace:
```typescript
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

With:
```typescript
// Cache in all environments:
// - Development: prevents connection leaks during HMR
// - Production: reuses client within warm serverless instances
globalForPrisma.prisma = prisma;
```

**Step 4: Run existing tests**

```bash
npm test -- __tests__/lib/cron-auth.test.ts
```

Expected: All 5 cron-auth tests pass (the test mocks process.env, so env.ts won't interfere).

**Step 5: Add tests for env validation**

Create or add to an appropriate test file:

```typescript
// Test that verifyCronSecret returns false when CRON_SECRET is empty
// Test that verifyCronSecret returns false when CRON_SECRET is undefined
```

**Step 6: Run full test suite**

```bash
npm test
```

**Step 7: Commit**

```bash
git add lib/env.ts lib/cron-auth.ts lib/prisma.ts
git commit -m "fix: add env var validation and fail-closed CRON_SECRET check"
```

---

## Task 3: Fix Vote Capacity Race Condition (CRITICAL)

**Files:**
- Modify: `app/api/votes/route.ts` (lines 99-158)
- Test: `__tests__/api/votes.test.ts`

**Context:** The capacity check (`vote.count`) and the upsert are separate operations. Two concurrent "Coming" votes can both pass the check and exceed MAX_CLASS_SIZE.

**Step 1: Wrap capacity check + same-day check + upsert in a transaction**

In `app/api/votes/route.ts`, replace the section from the capacity check through the upsert (approximately lines 99-158) with a single `prisma.$transaction()` block:

```typescript
if (attending) {
  const result = await prisma.$transaction(async (tx) => {
    // Capacity check inside transaction
    const comingCount = await tx.vote.count({
      where: { sessionId, attending: true },
    });

    if (comingCount >= MAX_CLASS_SIZE) {
      return { error: "This session is full", status: 400 } as const;
    }

    // Same-day check inside transaction
    const targetDay =
      targetSession.recurringSlot?.dayOfWeek ?? targetSession.customDay;

    if (targetDay !== null && targetDay !== undefined) {
      const existingComingVote = await tx.vote.findFirst({
        where: {
          userId,
          attending: true,
          sessionId: { not: sessionId },
          session: {
            weekDate: targetSession.weekDate,
            status: { not: "CANCELLED" },
            OR: [
              { recurringSlot: { dayOfWeek: targetDay } },
              { customDay: targetDay },
            ],
          },
        },
        select: { id: true },
      });

      if (existingComingVote) {
        return {
          error:
            "You're already marked as coming to another session on this day. Please change that vote first.",
          status: 400,
        } as const;
      }
    }

    // Upsert inside same transaction
    const vote = await tx.vote.upsert({
      where: {
        sessionId_userId: { sessionId, userId },
      },
      update: {
        attending,
        votedAt: new Date(),
      },
      create: {
        sessionId,
        userId,
        attending,
      },
      select: {
        id: true,
        sessionId: true,
        userId: true,
        attending: true,
        votedAt: true,
      },
    });

    return { data: vote };
  });

  if ("error" in result) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({ data: result.data }, { status: 201 });
}

// Not attending — no capacity concern, but still use upsert
const vote = await prisma.vote.upsert({
  where: {
    sessionId_userId: { sessionId, userId },
  },
  update: {
    attending: false,
    votedAt: new Date(),
  },
  create: {
    sessionId,
    userId,
    attending: false,
  },
  select: {
    id: true,
    sessionId: true,
    userId: true,
    attending: true,
    votedAt: true,
  },
});

return Response.json({ data: vote }, { status: 201 });
```

**Step 2: Run vote tests**

```bash
npm test -- __tests__/api/votes.test.ts
```

Expected: All 37 tests pass.

**Step 3: Commit**

```bash
git add app/api/votes/route.ts
git commit -m "fix: wrap vote capacity check in transaction to prevent race condition"
```

---

## Task 4: Fix Move-Members Capacity Race Condition (CRITICAL)

**Files:**
- Modify: `app/api/sessions/[id]/move-members/route.ts` (lines 96-145)

**Context:** Capacity check is outside the transaction. Move it inside.

**Step 1: Move capacity check inside the existing transaction**

Move the capacity check (lines 97-105) inside the `prisma.$transaction()` block (line 126), re-counting with `tx.sessionMember.count()`:

```typescript
const txResult = await prisma.$transaction(async (tx) => {
  // Re-check capacity inside the transaction
  const currentCount = await tx.sessionMember.count({
    where: { sessionId: targetSessionId },
  });

  if (currentCount + membersToMove.length > MAX_CLASS_SIZE) {
    return {
      error: `Target session would exceed max capacity of ${MAX_CLASS_SIZE}. Current: ${currentCount}, Moving: ${membersToMove.length}`,
      status: 400,
    } as const;
  }

  // Remove from source
  await tx.sessionMember.deleteMany({
    where: {
      sessionId: sourceSessionId,
      userId: { in: memberIds },
    },
  });

  // Remove votes from source
  await tx.vote.deleteMany({
    where: {
      sessionId: sourceSessionId,
      userId: { in: memberIds },
    },
  });

  // Add to target
  if (membersToMove.length > 0) {
    await tx.sessionMember.createMany({
      data: membersToMove.map((userId: string) => ({
        sessionId: targetSessionId,
        userId,
      })),
      skipDuplicates: true,
    });
  }

  return null;
});

if (txResult) {
  return Response.json({ error: txResult.error }, { status: txResult.status });
}
```

Remove the original pre-transaction capacity check.

**Step 2: Run session tests**

```bash
npm test -- __tests__/api/sessions.test.ts
```

Expected: All 96 tests pass.

**Step 3: Commit**

```bash
git add app/api/sessions/[id]/move-members/route.ts
git commit -m "fix: move capacity check inside transaction for move-members endpoint"
```

---

## Task 5: Fix Forgot Password Page (CRITICAL)

**Files:**
- Modify: `app/(auth)/forgot-password/page.tsx`
- Modify: `app/(auth)/login/page.tsx` (line 143-147 — link)

**Context:** The forgot-password page fakes a success message without sending any email. This is worse than no feature at all.

**Step 1: Replace the fake implementation with honest text**

Replace the entire forgot-password page with a simple redirect message since password reset is not yet implemented:

```typescript
"use client";

import Link from "next/link";

export default function ForgotPasswordPage(): React.ReactElement {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-950 px-4">
      <div className="w-full max-w-md rounded-xl border border-surface-800 bg-surface-900 p-8 text-center">
        <h1 className="text-2xl font-bold text-surface-100">
          Reset Password
        </h1>
        <p className="mt-4 text-surface-400">
          To reset your password, please contact the gym owner directly.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-500 transition-colors"
        >
          Back to Login
        </Link>
      </div>
    </div>
  );
}
```

**Step 2: Update the login page link text**

In `app/(auth)/login/page.tsx`, update the forgot password link (around line 143) to say "Reset Password" instead of implying email-based reset.

**Step 3: Run type check**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add app/(auth)/forgot-password/page.tsx app/(auth)/login/page.tsx
git commit -m "fix: replace fake forgot-password stub with honest contact-owner message"
```

---

## Task 6: Fix Auth Page UI Bugs (CRITICAL)

**Files:**
- Modify: `app/(auth)/login/page.tsx` (lines 19-52 and 62)
- Modify: `app/(auth)/register/page.tsx` (line 104)

**Context:** Three issues: (1) error banners use light-theme colors on dark background, (2) missing `role="alert"` on error banners, (3) login loading state never resets on success.

**Step 1: Fix login error banner styling + add role="alert"**

In `app/(auth)/login/page.tsx`, replace:
```typescript
<div className="mb-4 rounded-lg bg-error-50 p-3 text-sm text-error-700">
```

With:
```typescript
<div className="mb-4 rounded-lg border border-error-700/30 bg-error-700/20 p-3 text-sm text-error-500" role="alert">
```

**Step 2: Fix register error banner styling + add role="alert"**

In `app/(auth)/register/page.tsx`, replace:
```typescript
<div className="mb-4 rounded-lg bg-error-50 p-3 text-sm text-error-700">
```

With:
```typescript
<div className="mb-4 rounded-lg border border-error-700/30 bg-error-700/20 p-3 text-sm text-error-500" role="alert">
```

**Step 3: Fix login loading state — add finally block**

In `app/(auth)/login/page.tsx`, restructure the handleSubmit to use finally:

```typescript
try {
  setLoading(true);
  setError("");
  // ... signIn logic, role-based redirect ...
} catch {
  setError("An unexpected error occurred");
} finally {
  setLoading(false);
}
```

**Step 4: Add autocomplete attributes to login form**

Add to the email input: `autocomplete="email"`
Add to the password input: `autocomplete="current-password"`

**Step 5: Add autocomplete attributes to register form**

- Name input: `autocomplete="name"`
- Phone input: `autocomplete="tel"`
- Email input: `autocomplete="email"`
- Password input: `autocomplete="new-password"`
- Confirm password input: `autocomplete="new-password"`

**Step 6: Add role="alert" to register field-level errors**

For each field error `<p>` tag in register/page.tsx (name, email, password, confirmPassword), add `role="alert"`:

```typescript
{errors.name && (
  <p className="mt-1 text-sm text-error-500" role="alert">{errors.name}</p>
)}
```

**Step 7: Run type check and tests**

```bash
npx tsc --noEmit && npm test
```

**Step 8: Commit**

```bash
git add app/(auth)/login/page.tsx app/(auth)/register/page.tsx
git commit -m "fix: auth page error styling, loading state, autocomplete, and accessibility"
```

---

## Task 7: Fix Business Logic Issues (IMPORTANT)

**Files:**
- Modify: `types/index.ts` (lines 78-85, 106-107, 195-196)
- Modify: `app/api/members/[id]/route.ts` (lines 115-124)
- Modify: `app/api/payments/[id]/route.ts` (lines 73-79)
- Modify: `lib/session-generation.ts` (lines 25-31)
- Modify: `app/api/cron/payment-reminders/route.ts` (line 104)
- Modify: `app/api/cron/trial-expiration/route.ts` (lines 70, 78)

**Step 1: Add periodStart <= periodEnd validation to PaymentSchema**

In `types/index.ts`, add `.refine()` to PaymentSchema:

```typescript
export const PaymentSchema = z.object({
  userId: z.string().cuid('Invalid user ID'),
  amount: z.number().positive('Amount must be positive'),
  paidAt: z.string().datetime('Invalid date format'),
  periodStart: z.string().date('Invalid date format'),
  periodEnd: z.string().date('Invalid date format'),
  notes: z.string().max(MAX_PAYMENT_NOTES_LENGTH,
    `Notes too long (max ${MAX_PAYMENT_NOTES_LENGTH} chars)`).optional(),
}).strict().refine(
  (data) => data.periodStart <= data.periodEnd,
  { message: "periodStart must not be after periodEnd", path: ["periodEnd"] }
);
```

**Step 2: Replace hardcoded 7/22 with constants in Zod schemas**

In `types/index.ts`, update OneOffSessionCreateSchema and RecurringSlotSchema:

```typescript
import { SLOT_START_HOUR, SLOT_END_HOUR } from '@/lib/constants';

// In OneOffSessionCreateSchema:
customStartHour: z.number().int().min(SLOT_START_HOUR).max(SLOT_END_HOUR,
  `Start hour must be ${SLOT_START_HOUR}-${SLOT_END_HOUR}`),

// In RecurringSlotSchema:
startHour: z.number().int().min(SLOT_START_HOUR).max(SLOT_END_HOUR,
  `Start hour must be ${SLOT_START_HOUR}-${SLOT_END_HOUR}`),
```

**Step 3: Add `.strict()` and length limits to inline schemas**

In `app/api/members/[id]/route.ts`:

```typescript
import { MAX_NAME_LENGTH, MAX_EMAIL_LENGTH, MAX_PHONE_LENGTH } from "@/lib/constants";

const OwnerMemberUpdateSchema = z.object({
  name: z.string().min(1).max(MAX_NAME_LENGTH).optional(),
  email: z.string().email().max(MAX_EMAIL_LENGTH).optional(),
  phone: z.string().min(1).max(MAX_PHONE_LENGTH).optional(),
  status: z.enum(["TRIAL", "ACTIVE", "DEPARTED"]).optional(),
  monthlyRate: z.number().positive().optional(),
  overrideActive: z.boolean().optional(),
  departedAt: z.string().datetime().optional(),
  departReason: z.string().max(500).optional(),
}).strict();
```

In `app/api/payments/[id]/route.ts`:

```typescript
import { MAX_PAYMENT_NOTES_LENGTH } from "@/lib/constants";

const PaymentUpdateSchema = z.object({
  amount: z.number().positive().optional(),
  paidAt: z.string().datetime().optional(),
  periodStart: z.string().date().optional(),
  periodEnd: z.string().date().optional(),
  notes: z.string().max(MAX_PAYMENT_NOTES_LENGTH).optional(),
}).strict();
```

**Step 4: Fix getWeekStart() UTC getter mismatch**

In `lib/session-generation.ts`, replace:

```typescript
export function getWeekStart(date: Date): Date {
  const monday = startOfWeek(date, { weekStartsOn: 1 });
  return new Date(
    Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate())
  );
}
```

With:

```typescript
export function getWeekStart(date: Date): Date {
  const monday = startOfWeek(date, { weekStartsOn: 1 });
  return new Date(
    Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate())
  );
}
```

**Step 5: Fix payment reminder days-left for trial members**

In `app/api/cron/payment-reminders/route.ts`, replace the hardcoded `daysLeft` calculation:

```typescript
const daysLeft = GRACE_PERIOD_DAYS - dayOfMonth + 1;
```

With a calculation that accounts for trial members:

```typescript
let daysLeft: number;
if (member.status === "TRIAL" && member.trialEndsAt) {
  // Trial members: grace period = trial period, ends at trialEndsAt
  const msLeft = member.trialEndsAt.getTime() - today.getTime();
  daysLeft = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
} else {
  // Active members: grace period starts on 1st of month
  daysLeft = Math.max(0, GRACE_PERIOD_DAYS - dayOfMonth + 1);
}
```

**Step 6: Fix trial expiration locale-dependent date formatting**

In `app/api/cron/trial-expiration/route.ts`, add `import { format } from "date-fns";` and replace both `toLocaleDateString()` calls:

```typescript
// Line 70 (owner notification):
body: `${member.name}'s payment deadline is ${
  member.trialEndsAt ? format(member.trialEndsAt, "MMM d, yyyy") : "unknown"
}. They will be locked out if payment is not received.`,

// Line 78 (member notification):
body: `Your payment is due by ${
  member.trialEndsAt ? format(member.trialEndsAt, "MMM d, yyyy") : "unknown"
}. Your account will be locked if payment is not received.`,
```

**Step 7: Run all affected tests**

```bash
npm test -- __tests__/lib/payment-logic.test.ts __tests__/lib/session-generation.test.ts __tests__/api/payments.test.ts __tests__/api/votes.test.ts __tests__/types/strict-schemas.test.ts __tests__/types/session-schemas.test.ts
```

**Step 8: Run full test suite**

```bash
npm test
```

**Step 9: Commit**

```bash
git add types/index.ts app/api/members/[id]/route.ts app/api/payments/[id]/route.ts lib/session-generation.ts app/api/cron/payment-reminders/route.ts app/api/cron/trial-expiration/route.ts
git commit -m "fix: business logic issues - schema validation, timezone, payment reminders"
```

---

## Task 8: Add Database Indexes + Fix Deployment Config (IMPORTANT)

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `next.config.ts` (CSP unsafe-eval)
- Modify: `vercel.json` (voting deadline cron schedule)
- Modify: `DEPLOYMENT.md` (lockout documentation)
- Modify: `package.json` (devDependencies)

**Step 1: Add performance indexes to schema.prisma**

Add these `@@index` directives to the appropriate models:

```prisma
model Payment {
  // ... existing fields ...
  @@index([userId, paidAt])
}

model Session {
  // ... existing fields ...
  @@index([weekDate])
}

model Vote {
  // ... existing fields ...
  @@index([sessionId])
}

model PrivateSession {
  // ... existing fields ...
  @@index([createdById])
}

model User {
  // ... existing fields ...
  @@index([role, status])
}
```

**Step 2: Generate migration**

```bash
npx prisma migrate dev --name add-performance-indexes
```

**Step 3: Remove unsafe-eval from production CSP**

In `next.config.ts`, make CSP environment-aware:

```typescript
const isDev = process.env.NODE_ENV === "development";

// In the CSP header value:
`script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
```

**Step 4: Fix voting deadline cron to run hourly**

In `vercel.json`, change the voting-deadline schedule:

```json
{ "path": "/api/cron/voting-deadline", "schedule": "0 * * * *" }
```

Also fix the comment in `app/api/cron/voting-deadline/route.ts` from "Hourly" to match the actual schedule, or update it to say "Hourly" now that it IS hourly.

**Step 5: Fix DEPLOYMENT.md lockout documentation**

Replace the line about middleware enforcing lockout:
```
- Check middleware is enforcing lockout (returns 403)
```

With:
```
- Verify the member layout Server Component (app/(member)/layout.tsx) calls getPaymentStatus() and redirects to /member/locked when status is LOCKED
- Note: Middleware does NOT enforce lockout (edge runtime cannot access Prisma). Lockout is enforced at the layout level.
```

**Step 6: Move @types packages to devDependencies**

In `package.json`, move `@types/node` and `@types/react-dom` from `dependencies` to `devDependencies`.

**Step 7: Run tests**

```bash
npm test
```

**Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ next.config.ts vercel.json DEPLOYMENT.md package.json
git commit -m "fix: add DB indexes, tighten CSP, fix cron schedule, update docs"
```

---

## Task 9: Add loading.tsx Files + Lazy-Load Recharts (IMPORTANT)

**Files:**
- Create: `app/(owner)/loading.tsx`
- Create: `app/(member)/loading.tsx`
- Create: `app/(trainer)/loading.tsx`
- Modify: `app/(owner)/dashboard/DashboardClient.tsx` (dynamic imports for charts)

**Step 1: Create loading.tsx for each role group**

Each file should be identical:

```typescript
export default function Loading(): React.ReactElement {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-400 border-t-transparent" />
    </div>
  );
}
```

Create at:
- `app/(owner)/loading.tsx`
- `app/(member)/loading.tsx`
- `app/(trainer)/loading.tsx`

**Step 2: Lazy-load Recharts components**

In `app/(owner)/dashboard/DashboardClient.tsx`, replace the static imports of AttendanceChart and RevenueChart with dynamic imports:

```typescript
import dynamic from "next/dynamic";

const AttendanceChart = dynamic(
  () => import("@/components/analytics/AttendanceChart").then((m) => ({ default: m.AttendanceChart })),
  {
    ssr: false,
    loading: () => <div className="h-64 animate-pulse rounded-xl bg-surface-800" />,
  }
);

const RevenueChart = dynamic(
  () => import("@/components/analytics/RevenueChart").then((m) => ({ default: m.RevenueChart })),
  {
    ssr: false,
    loading: () => <div className="h-64 animate-pulse rounded-xl bg-surface-800" />,
  }
);
```

Note: Verify the component names are correct (may be default exports). Adjust the `.then()` mapping accordingly.

**Step 3: Run type check and tests**

```bash
npx tsc --noEmit && npm test
```

**Step 4: Commit**

```bash
git add app/(owner)/loading.tsx app/(member)/loading.tsx app/(trainer)/loading.tsx app/(owner)/dashboard/DashboardClient.tsx
git commit -m "feat: add loading.tsx skeletons and lazy-load Recharts for performance"
```

---

## Task 10: Fix Frontend Accessibility + Error Handling (IMPORTANT)

**Files:**
- Modify: `components/layout/Navigation.tsx` (lines 130-145)
- Modify: `app/(owner)/owner/session/[id]/SessionDetailClient.tsx` (lines 160-175)
- Modify: `components/notification/NotificationsClient.tsx` (lines 82-101)
- Modify: `components/layout/Header.tsx` (lines 87-144)
- Modify: `components/payment/PaymentBanner.tsx`
- Modify: `components/payment/LockoutScreen.tsx`
- Modify: `app/(member)/member/profile/ProfileClient.tsx` (lines 154-160)

**Step 1: Add screen-reader labels to navigation icons**

In `components/layout/Navigation.tsx`, inside the link mapping, add a sr-only label:

```typescript
{link.icon}
<span className="hidden lg:inline">{link.label}</span>
<span className="sr-only lg:hidden">{link.label}</span>
```

**Step 2: Add try/catch to handleToggleVoting**

In `SessionDetailClient.tsx`, wrap the fetch in try/catch:

```typescript
async function handleToggleVoting(): Promise<void> {
  try {
    const res = await fetch(`/api/sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ votingEnabled: !session.votingEnabled }),
    });
    if (res.ok) {
      addToast({
        type: "success",
        title: session.votingEnabled ? "Voting disabled" : "Voting enabled",
      });
      router.refresh();
    } else {
      addToast({ type: "error", title: "Failed to update voting" });
    }
  } catch {
    addToast({ type: "error", title: "Network error" });
  }
}
```

**Step 3: Create batch mark-all-read API endpoint**

Create `app/api/notifications/mark-all-read/route.ts`:

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { authWriteLimiter } from "@/lib/rate-limit";

export async function POST(req: Request): Promise<Response> {
  const rateLimitResponse = await authWriteLimiter.check(req);
  if (rateLimitResponse) return rateLimitResponse;

  const session = await auth();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await prisma.notification.updateMany({
      where: {
        userId: session.user.id,
        read: false,
      },
      data: { read: true },
    });

    return Response.json({ data: { count: result.count } });
  } catch (error) {
    console.error("Failed to mark all notifications as read:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Step 4: Update NotificationsClient to use batch endpoint**

In `components/notification/NotificationsClient.tsx`, replace `handleMarkAllRead`:

```typescript
async function handleMarkAllRead(): Promise<void> {
  setLoading(true);
  try {
    const res = await fetch("/api/notifications/mark-all-read", {
      method: "POST",
    });
    if (res.ok) {
      addToast({ type: "success", title: "All marked as read" });
      router.refresh();
    } else {
      addToast({ type: "error", title: "Failed to mark all as read" });
    }
  } catch {
    addToast({ type: "error", title: "Network error" });
  } finally {
    setLoading(false);
  }
}
```

**Step 5: Add ARIA roles to Header dropdown**

In `components/layout/Header.tsx`, add `role="menu"` to the dropdown div and `role="menuitem"` to each item inside.

**Step 6: Add role="alert" to PaymentBanner and LockoutScreen**

In `PaymentBanner.tsx`, add `role="alert"` to the outer wrapper divs for both GRACE_PERIOD and LOCKED states.

In `LockoutScreen.tsx`, add `role="alert"` to the main content wrapper.

**Step 7: Fix profile photo alt text**

In `ProfileClient.tsx`, change `alt=""` to `alt={user.name}`.

**Step 8: Run type check and tests**

```bash
npx tsc --noEmit && npm test
```

**Step 9: Commit**

```bash
git add components/layout/Navigation.tsx app/(owner)/owner/session/[id]/SessionDetailClient.tsx components/notification/NotificationsClient.tsx app/api/notifications/mark-all-read/route.ts components/layout/Header.tsx components/payment/PaymentBanner.tsx components/payment/LockoutScreen.tsx app/(member)/member/profile/ProfileClient.tsx
git commit -m "fix: accessibility improvements, error handling, and batch mark-all-read"
```

---

## Task 11: Suggestions & Polish (NICE TO HAVE)

**Files:**
- Modify: `app/page.tsx` (redirect or remove)
- Modify: `app/layout.tsx` (add Open Graph metadata)
- Modify: `components/schedule/WeeklyCalendar.tsx` (mobile empty day indicator)
- Modify: `app/(owner)/dashboard/DashboardClient.tsx` (consolidate useState)
- Modify: `next.config.ts` (add HSTS preload)
- Modify: `vercel.json` (add region)

**Step 1: Replace root page.tsx with redirect**

```typescript
import { redirect } from "next/navigation";

export default function Home(): never {
  redirect("/login");
}
```

**Step 2: Add Open Graph metadata to layout.tsx**

```typescript
export const metadata: Metadata = {
  title: "Wonder Woman Fitness",
  description: "Studio management platform for Wonder Woman Fitness",
  openGraph: {
    title: "Wonder Woman Fitness",
    description: "Studio management platform for Wonder Woman Fitness",
    type: "website",
  },
};
```

**Step 3: Add HSTS preload directive**

In `next.config.ts`, update HSTS header:

```typescript
value: "max-age=31536000; includeSubDomains; preload",
```

**Step 4: Add Vercel function region**

In `vercel.json`, add:

```json
{
  "regions": ["fra1"],
  "crons": [...]
}
```

**Step 5: Show empty days on mobile calendar**

In `WeeklyCalendar.tsx`, replace the early return for empty days on mobile:

```typescript
if (daySessions.length === 0) {
  return (
    <div key={dayNumber} className="rounded-lg border border-surface-800 bg-surface-900/50 p-3 text-center text-sm text-surface-500">
      No sessions
    </div>
  );
}
```

**Step 6: Run all checks**

```bash
npx tsc --noEmit && npm run lint && npm test
```

**Step 7: Commit**

```bash
git add app/page.tsx app/layout.tsx next.config.ts vercel.json components/schedule/WeeklyCalendar.tsx
git commit -m "fix: polish items - redirect root, OG metadata, HSTS preload, mobile calendar"
```

---

## Task 12: Document Rate Limiting Limitation (IMPORTANT)

**Files:**
- Modify: `DEPLOYMENT.md`
- Modify: `lib/rate-limit.ts` (enhance existing comment)

**Step 1: Add a warning section to DEPLOYMENT.md**

Add a "Known Limitations" section:

```markdown
### Known Limitations

#### In-Memory Rate Limiting
The rate limiter (`lib/rate-limit.ts`) uses an in-memory `Map` for storing request counts. On Vercel's serverless platform, each function instance has its own memory space. This means:

- Rate limits provide **per-instance burst protection** only
- Concurrent requests to different instances bypass the limit
- Rate limit state is lost on cold starts

**For a single-gym app with low traffic, this is acceptable.** If you need stronger protection:
- Use [Upstash Redis](https://upstash.com/) with `@upstash/ratelimit` (free tier: 10,000 requests/day)
- Or enable Vercel WAF/Firewall rules (Pro plan) to rate-limit at the edge
```

**Step 2: Commit**

```bash
git add DEPLOYMENT.md lib/rate-limit.ts
git commit -m "docs: document in-memory rate limiting limitation for serverless"
```

---

## Task 13: Final Verification

**Step 1: Type check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

**Step 2: Lint**

```bash
npm run lint
```

Expected: Only the 5 pre-existing warnings (per CLAUDE.md section 10).

**Step 3: Full test suite**

```bash
npm test
```

Expected: All tests pass (1,373+ with any new tests added).

**Step 4: Production build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

**Step 5: Commit any remaining changes**

If tests or build revealed issues, fix and commit individually.

---

## Summary

| Task | Severity | Estimated Time |
|------|----------|---------------|
| 1. Initial migration | CRITICAL | 5 min |
| 2. Env validation + CRON fix | CRITICAL | 30 min |
| 3. Vote race condition | CRITICAL | 20 min |
| 4. Move-members race condition | CRITICAL | 15 min |
| 5. Forgot password page | CRITICAL | 10 min |
| 6. Auth page UI bugs | CRITICAL | 20 min |
| 7. Business logic fixes | IMPORTANT | 40 min |
| 8. DB indexes + deploy config | IMPORTANT | 25 min |
| 9. Loading + lazy Recharts | IMPORTANT | 15 min |
| 10. Accessibility + error handling | IMPORTANT | 40 min |
| 11. Polish suggestions | NICE-TO-HAVE | 20 min |
| 12. Rate limit documentation | IMPORTANT | 10 min |
| 13. Final verification | REQUIRED | 10 min |
| **Total** | | **~4.5 hours** |
