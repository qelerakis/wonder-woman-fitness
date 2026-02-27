# CLAUDE.md — Operating Manual for Claude Code

> This file tells Claude Code how to work in the Wonder Woman Fitness project. Read this before writing any code.

---

## 1. Project Overview

Wonder Woman Fitness is a web-based boutique fitness studio management platform. It has three user roles (Owner, Trainer, Member) and handles scheduling, attendance voting, cash payment tracking, notifications, and analytics for a single gym.

**Project status**: Feature-complete (February 18, 2026). All MVP features + post-MVP additions implemented and tested. 1,860 tests passing across 53 test files. Production build succeeds.

**Key documents** — read these first:
- `PRD.md` — What was built and why (includes implementation status)
- `ARCHITECTURE.md` — How the system is designed, tech stack, data flow, and design decisions
- `DEPLOYMENT.md` — Production deployment guide (Vercel + Neon + Resend + Cloudinary)
- `docs/plans/` — 23 design and implementation plan documents

---

## 2. Tech Stack (Quick Reference)

| What          | Tool                    |
|---------------|-------------------------|
| Framework     | Next.js 15 (App Router) |
| Language      | TypeScript (strict)     |
| Styling       | Tailwind CSS 4          |
| Database      | PostgreSQL (Neon)       |
| ORM           | Prisma 7 (adapter)      |
| Auth          | NextAuth.js v5          |
| Email         | Resend                  |
| File uploads  | Cloudinary              |
| Charts        | Recharts                |
| Validation    | Zod                     |
| Cron          | Vercel Cron Jobs        |
| Testing       | Vitest                  |

---

## 3. Commands

### Setup
```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Then fill in DATABASE_URL, NEXTAUTH_SECRET, RESEND_API_KEY, etc.

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Seed the database (creates owner account + sample data)
npx prisma db seed
```

### Development
```bash
# Start dev server
npm run dev

# Open Prisma Studio (visual database browser)
npx prisma studio

# Create a new migration after schema changes
npx prisma migrate dev --name <descriptive-name>

# Reset database (drops all data, re-runs migrations + seed)
npx prisma migrate reset

# Type check
npx tsc --noEmit

# Lint
npm run lint
```

### Testing
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- path/to/file.test.ts
```

### Production
```bash
# Build for production
npm run build

# Run production migrations
npx prisma migrate deploy
```

---

## 4. Code Conventions

### 4.1 File Naming
- **Components**: PascalCase — `SessionCard.tsx`, `PaymentBanner.tsx`
- **Utilities / lib**: camelCase — `paymentLogic.ts`, `notifications.ts`
- **API routes**: kebab-case folders — `api/private-sessions/route.ts`
- **Types**: PascalCase, co-located in `types/index.ts` or next to the feature

### 4.2 TypeScript
- **Strict mode** is enabled. Do not use `any`. Use `unknown` and narrow with type guards.
- All function parameters and return types must be explicitly typed.
- Use Zod schemas as the source of truth for data shapes. Infer TypeScript types from them:
  ```typescript
  const PaymentSchema = z.object({
    userId: z.string().uuid(),
    amount: z.number().positive(),
    paidAt: z.string().datetime(),
    periodStart: z.string().date(),
    periodEnd: z.string().date(),
  });
  type Payment = z.infer<typeof PaymentSchema>;
  ```

### 4.3 API Routes
- Every API route must:
  1. Verify the session (NextAuth)
  2. Check the user's role against the allowed roles for that endpoint
  3. Validate the request body with a Zod schema
  4. Return proper HTTP status codes (200, 201, 400, 401, 403, 404, 500)
  5. Return JSON responses with consistent shape: `{ data }` or `{ error: string }`
- Example:
  ```typescript
  export async function POST(req: Request) {
    const session = await auth();
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "OWNER") return Response.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const parsed = PaymentSchema.safeParse(body);
    if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

    // ... business logic with Prisma
  }
  ```

### 4.4 Prisma (v7 — Adapter Pattern)
- **Prisma 7** uses the adapter pattern: `PrismaPg` from `@prisma/adapter-pg`. Generated client lives at `@/generated/prisma`.
- Always use the singleton client from `lib/prisma.ts`. Never instantiate `new PrismaClient()` directly.
- Always use `select` or `include` to fetch only needed fields. No naked `findMany()` without field selection.
- All database writes that involve multiple tables must use `prisma.$transaction()`.
- **Client components cannot import from `@/generated/prisma/client`** — use local type aliases instead (e.g., `type UserRole = "OWNER" | "TRAINER" | "MEMBER"`).
- When adding/changing models, always create a migration with a descriptive name:
  ```bash
  npx prisma migrate dev --name add-payment-notes-field
  ```

### 4.5 Components
- Use **Server Components** by default. Only add `"use client"` when the component needs interactivity (event handlers, hooks, browser APIs).
- Client components should be as small as possible — extract interactive parts into leaf components.
- Props must be typed with an explicit interface:
  ```typescript
  interface SessionCardProps {
    session: SessionWithDetails;
    onVote?: (attending: boolean) => void;
    showVoting: boolean;
  }
  ```

### 4.6 Styling (Tailwind CSS 4)
- Use Tailwind utility classes exclusively. No CSS modules, no `style` props, no external CSS files.
- **Tailwind v4 uses CSS-based config** via `@theme` directive in `app/globals.css` (not `tailwind.config.ts`).
- Brand colors are defined in `app/globals.css`. Use semantic names:
  - `bg-primary` / `text-primary` — purple shades
  - `bg-surface` / `text-surface` — dark/black shades
  - `bg-success`, `bg-warning`, `bg-error` — state colors
- Responsive breakpoints: `sm:` (640px), `md:` (768px), `lg:` (1024px). **Mobile-first** — write base styles for mobile, then add breakpoint overrides.

### 4.7 Error Handling
- API routes: wrap in try/catch, log errors to console, return 500 with generic message.
- Client: use error boundaries for page-level errors. Use toast notifications for action-level errors.
- Never expose internal error details (stack traces, SQL errors) to the client.

### 4.8 Constants
- All magic numbers live in `lib/constants.ts`. Never hardcode numbers in business logic.
  ```typescript
  export const MAX_CLASS_SIZE = 27;
  export const GRACE_PERIOD_DAYS = 10;
  export const TRIAL_DAYS = 14;
  export const SLOT_START_HOUR = 7;
  export const SLOT_END_HOUR = 22;
  export const NOTIFICATION_POLL_INTERVAL_MS = 30_000;
  export const VOTING_DEADLINE_HOURS_BEFORE = 24;
  ```

---

## 5. Workflow After Completing a Task

Follow this checklist every time you finish a task from `TASKS.md`:

1. **Verify the code compiles**: Run `npx tsc --noEmit` — zero errors.
2. **Verify the app runs**: Run `npm run dev` and manually test the feature.
3. **Run the linter**: Run `npm run lint` — zero warnings.
4. **Check Prisma schema** (if changed): Run `npx prisma migrate dev` to create/apply migration.
5. **Write or update tests** for the feature you just built.
6. **Run the full test suite**: Run `npm test` — all tests pass.
7. **Update TASKS.md**: Check off the completed task (`- [x]`).
8. **Commit with a descriptive message**:
   ```
   feat(T-XXX): <short description>
   ```
   Examples:
   ```
   feat(T-110): configure NextAuth with credentials provider
   feat(T-200): implement payment status computation logic
   feat(T-306): build owner schedule management page
   fix(T-200): handle advance payments spanning year boundary
   ```

---

## 6. Key Business Logic to Know

These are the trickiest parts of the codebase. Understand them before touching related code.

### 6.1 Payment Status Computation
**File**: `lib/payment-logic.ts`

Payment status is **computed, never stored**. The function `getPaymentStatus()` takes a user, their payment records, and today's date, then returns: `PAID | GRACE_PERIOD | LOCKED | DEPARTED | OVERRIDE`.

Critical rules:
- The trial period IS the grace period — new members see "Payment due" from day 1 with a 14-day countdown
- Trial members (status=TRIAL) get a 14-day grace period starting from registration (trialEndsAt - TRIAL_DAYS)
- Active members get a 10-day grace period starting from the 1st of each month
- Advance payments: if a payment's periodEnd is in the future, the member is PAID
- Owner can set a manual override that bypasses lockout
- After grace period expires → LOCKED (app access restricted)

### 6.2 Voting Deadlines
Voting locks **24 hours before** the session time. The session time is computed from the RecurringSlot's `startHour` + the Session's `weekDate`. If a session is Monday 9 AM on 2026-03-09, the voting deadline is Sunday 9 AM on 2026-03-08.

### 6.3 Member Moves Are Final
When the owner moves a member from a cancelled/low-attendance session to another session, the move is final. The member is notified but does not confirm. The original session stays cancelled.

### 6.4 Departed Members
Departed members keep their historical data (payments, attendance) for analytics. They are excluded from:
- Active member counts
- Payment tracking and reminders
- Class capacity counts
- Projected earnings

They can request to rejoin, but the owner must approve.

---

## 7. Common Patterns

### Fetching data in Server Components
```typescript
// app/(owner)/members/page.tsx
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function MembersPage() {
  const session = await auth();
  if (!session || session.user.role !== "OWNER") redirect("/login");

  const members = await prisma.user.findMany({
    where: { role: "MEMBER", status: { not: "DEPARTED" } },
    select: { id: true, name: true, email: true, status: true, joinDate: true },
    orderBy: { name: "asc" },
  });

  return <MembersTable members={members} />;
}
```

### Dispatching a notification
```typescript
import { dispatchNotification } from "@/lib/notifications";

await dispatchNotification({
  userId: member.id,
  type: "CLASS_CANCELLED",
  title: "Your Monday 9 AM class has been cancelled",
  body: "The class on March 9 has been cancelled due to low attendance. Please check the schedule for alternatives.",
});
```

### Recording a payment
```typescript
// Always use a transaction when creating a payment
await prisma.$transaction(async (tx) => {
  const payment = await tx.payment.create({
    data: {
      userId: memberId,
      amount: parsedData.amount,
      paidAt: new Date(parsedData.paidAt),
      periodStart: new Date(parsedData.periodStart),
      periodEnd: new Date(parsedData.periodEnd),
      recordedById: session.user.id,
    },
  });

  // If member was locked, transitioning back happens automatically
  // because payment status is computed, not stored
  return payment;
});
```

---

## 8. Environment Variables

Required in `.env.local` for development:

```bash
DATABASE_URL=             # Neon PostgreSQL connection string
NEXTAUTH_SECRET=          # Random 32+ char string (run: openssl rand -base64 32)
NEXTAUTH_URL=             # http://localhost:3000 in dev
RESEND_API_KEY=           # From resend.com dashboard
EMAIL_FROM=               # noreply@wonderwomanfitness.mk
CLOUDINARY_CLOUD_NAME=    # From Cloudinary dashboard
CLOUDINARY_API_KEY=       # From Cloudinary dashboard
CLOUDINARY_API_SECRET=    # From Cloudinary dashboard
CRON_SECRET=              # Random 32+ char string for securing cron endpoints
```

---

## 9. Important Gotchas

1. **Never store payment status on the User model.** It's computed. See section 6.1.
2. **Prisma's DateTime is UTC.** Always convert to the gym's local timezone when displaying to users. Use `date-fns-tz` if needed.
3. **NextAuth v5 uses `auth()` not `getServerSession()`.** The v4 API is different.
4. **Auth is split**: `lib/auth.config.ts` (edge-compatible, no Prisma) + `lib/auth.ts` (full, server-only). Middleware uses `auth.config.ts`.
5. **Vercel Cron routes must be GET requests** and secured with the `CRON_SECRET` header.
6. **Tailwind v4 uses CSS-based config** via `@theme` directive in `app/globals.css`, not `tailwind.config.js`.
7. **Cloudinary unsigned uploads are insecure.** Always upload from the server (API route), never directly from the client.
8. **The owner account is created via seed script, not via the registration page.** The registration page always creates MEMBER accounts.
9. **Session weekDate** is always the Monday of that week, regardless of which day the session falls on. The actual day comes from the RecurringSlot's `dayOfWeek` or Session's `customDay`.
10. **Max class size is 27.** Always validate before adding members to a session. The constant is in `lib/constants.ts`.
11. **Trial period is exactly 14 days.** After that, the first grace period starts from `trialEndsAt`, not from the 1st of the month.
12. **Client components cannot import from `@/generated/prisma/client`** — use local type aliases instead.
13. **Route groups are invisible in URL.** `(auth)`, `(locked)`, `(owner)`, `(trainer)`, `(member)` don't appear in paths. Use role-prefixed paths: `/owner/schedule`, `/member/schedule`, `/trainer/session/[id]`. The `(locked)` group handles the payment lockout screen at `/member/locked`.
14. **Next.js 15 params are async.** Page props use `Promise<{ id: string }>` pattern — always `await` params.
15. **`serverExternalPackages`** in `next.config.ts` includes `["@prisma/client", "@prisma/adapter-pg", "bcrypt"]`.
16. **Sessions can be one-off (custom).** When `recurringSlotId` is null, the session uses `customDay` + `customStartHour`.
17. **Email verification is required for registration.** New members go through PendingVerification → email link → User creation. The `PendingVerification` model holds temporary registration data until verified.

---

## 10. Test Suite

1,860 tests across 53 files, all passing (~17s). Run with `npm test`.

### Business Logic & Utilities (15 files, 297 tests)
| File | Tests | What it covers |
|---|---|---|
| `payment-logic.test.ts` | 51 | Trial-as-grace-period, grace period, lockout, overrides, advance payments |
| `voting-logic.test.ts` | 38 | Deadline calculation, eligibility, isFull, same-day constraints |
| `attendance-analytics.test.ts` | 35 | Member attendance rates, vote-vs-actual reliability, analytics computation |
| `notification-helpers.test.ts` | 26 | Notification dispatch helpers, formatting |
| `session-generation-carry-forward.test.ts` | 25 | Assignment carryover, departed member exclusion |
| `session-generation.test.ts` | 24 | Week generation from recurring slots |
| `rate-limit.test.ts` | 24 | Sliding-window rate limiter, key isolation, cleanup |
| `resend-verification.test.ts` | 14 | Resend verification email, cooldown, rate limiting |
| `register-verification.test.ts` | 13 | Registration with email verification, pending records |
| `env.test.ts` | 12 | Environment variable validation, lazy getters |
| `verify-email-page.test.ts` | 11 | Email verification page, token validation |
| `email-verification.test.ts` | 10 | Email verification helpers, token generation |
| `cron-auth.test.ts` | 5 | Timing-safe cron secret verification |
| `cleanup-pending.test.ts` | 5 | Expired pending verification cleanup cron |
| `rate-limit-integration.test.ts` | 4 | Rate limit integration with API routes |

### API Routes (12 files, 399 tests)
| File | Tests | What it covers |
|---|---|---|
| `sessions.test.ts` | 96 | Recurring, one-off, voting, cancel, generate week, rate limiting |
| `private-sessions.test.ts` | 52 | Full CRUD, payment status, audit trail |
| `votes.test.ts` | 44 | Cast, update, deadline enforcement, full/same-day |
| `attendance.test.ts` | 38 | Mark present/absent, auth, session validation |
| `broadcast-notifications.test.ts` | 32 | Targeted broadcast, audience types, auth, rate limiting |
| `payments.test.ts` | 26 | Record, advance payments, edit, delete, validation |
| `analytics-attendance.test.ts` | 25 | Attendance analytics API, CSV export, member rates |
| `recurring-slots.test.ts` | 24 | Create, delete, cascade |
| `session-members.test.ts` | 19 | Assign/remove members, capacity, vote cleanup |
| `members.test.ts` | 16 | CRUD, status transitions |
| `session-trainers.test.ts` | 15 | Assign/remove trainers, auth, owner-as-trainer |
| `mark-all-read.test.ts` | 12 | Mark all notifications as read |

### UI Components (24 files, 1,078 tests)
| File | Tests | What it covers |
|---|---|---|
| `MemberSessionDetailClient.test.tsx` | 113 | Session detail, voting UI, full/same-day constraints, assigned members |
| `SessionCard.test.tsx` | 100 | Display, voting, assignments, color states, role-based behavior |
| `PrivateSessionsClient.test.tsx` | 88 | Private sessions CRUD, payment tracking, trainer visibility |
| `PaymentsClient.test.tsx` | 82 | Payment list, filters, edit/delete, date range |
| `SendNotificationModal.test.tsx` | 75 | Broadcast modal, audience targeting, recipient preview |
| `DateTimePicker.test.tsx` | 73 | Calendar, time selection, dark theme, accessibility |
| `DashboardClient.test.tsx` | 68 | Analytics metrics, date range filters, attendance data |
| `DatePicker.test.tsx` | 64 | Calendar navigation, date selection, custom styling |
| `TrainerPaymentsClient.test.tsx` | 45 | Trainer payment recording, member status view |
| `Button.test.tsx` | 40 | Variants, sizes, states, accessibility |
| `ConfirmationModal.test.tsx` | 37 | Confirm/cancel actions, keyboard nav, focus trap |
| `CheckEmailPage.test.tsx` | 34 | Email verification check page, resend button |
| `SessionDetailClient.test.tsx` | 33 | Owner session management, assignments, workouts, attendance |
| `PaymentHistory.test.tsx` | 31 | Payment records display, filtering |
| `VotingPrompt.test.tsx` | 30 | Inline voting modal, vote states, constraints |
| `Modal.test.tsx` | 28 | Keyboard nav, accessibility, focus trap |
| `AttendanceChecklist.test.tsx` | 27 | Attendance marking UI, present/absent toggles |
| `AttendanceAnalytics.test.tsx` | 22 | Attendance analytics display, member rates |
| `PaymentBanner.test.tsx` | 17 | Grace period banner, countdown display |
| `TrainerSessionDetailClient.test.tsx` | 17 | Trainer session view, workout editor |
| `CreateSessionModal.test.tsx` | 15 | One-off, new recurring, validation |
| `LoginPage.test.tsx` | 15 | Sign-in form, verification hint |
| `PaymentStatusBadge.test.tsx` | 12 | Status badge rendering, color coding |
| `NotificationsClient.test.tsx` | 12 | Notification list, filters, send button |

### Type Validation (2 files, 86 tests)
| File | Tests | What it covers |
|---|---|---|
| `strict-schemas.test.ts` | 69 | Strict Zod schemas with length limits, unknown field rejection |
| `session-schemas.test.ts` | 17 | Zod validation for session creation schemas |

### Known Lint Warnings (5, pre-existing)
- `ScheduleClient.tsx`: trainers, members unused
- `members` API route: `_payments` unused
- `notifications` lib: `_user` unused
- `DateTimePicker.test.tsx`: unused eslint-disable directive
