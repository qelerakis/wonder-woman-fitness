# CLAUDE.md — Operating Manual for Claude Code

> This file tells Claude Code how to work in the Wonder Woman Fitness project. Read this before writing any code.

---

## 1. Project Overview

Wonder Woman Fitness is a web-based boutique fitness studio management platform. It has three user roles (Owner, Trainer, Member) and handles scheduling, attendance voting, cash payment tracking, notifications, and analytics for a single gym.

**Project status**: Feature-complete (February 14, 2026). All MVP features + post-MVP additions implemented and tested. 358 tests passing. Production build succeeds.

**Key documents** — read these first:
- `PRD.md` — What was built and why (includes implementation status)
- `ARCHITECTURE.md` — How the system is designed, tech stack, data flow, and design decisions
- `DEPLOYMENT.md` — Production deployment guide (Vercel + Neon + Resend + Cloudinary)
- `docs/plans/` — 7 design and implementation plan documents

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
  export const MAX_CLASS_SIZE = 20;
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

Payment status is **computed, never stored**. The function `getPaymentStatus()` takes a user, their payment records, and today's date, then returns: `TRIAL | PAID | GRACE_PERIOD | LOCKED | DEPARTED | OVERRIDE`.

Critical rules:
- Trial members (status=TRIAL, today < trialEndsAt) → always TRIAL, no banners
- When trial ends, the first payment grace period starts from trialEndsAt (not from the 1st of the month)
- Subsequent months follow the standard 1st-of-month cycle
- Advance payments: if a payment's periodEnd is in the future, the member is PAID
- Owner can set a manual override that bypasses lockout

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
10. **Max class size is 20.** Always validate before adding members to a session. The constant is in `lib/constants.ts`.
11. **Trial period is exactly 14 days.** After that, the first grace period starts from `trialEndsAt`, not from the 1st of the month.
12. **Client components cannot import from `@/generated/prisma/client`** — use local type aliases instead.
13. **Route groups are invisible in URL.** `(owner)`, `(trainer)`, `(member)` don't appear in paths. Use role-prefixed paths: `/owner/schedule`, `/member/schedule`, `/trainer/session/[id]`.
14. **Next.js 15 params are async.** Page props use `Promise<{ id: string }>` pattern — always `await` params.
15. **`serverExternalPackages`** in `next.config.ts` includes `["@prisma/client", "@prisma/adapter-pg", "bcrypt"]`.
16. **Sessions can be one-off (custom).** When `recurringSlotId` is null, the session uses `customDay` + `customStartHour`.

---

## 10. Test Suite

358 tests across 15 files, all passing (~3.7s). Run with `npm test`.

### Business Logic (4 files, 103 tests)
| File | Tests | What it covers |
|---|---|---|
| `payment-logic.test.ts` | 29 | Trial, grace period, lockout, overrides, edge cases |
| `voting-logic.test.ts` | 25 | Deadline calculation, eligibility checks |
| `session-generation.test.ts` | 24 | Week generation from recurring slots |
| `session-generation-carry-forward.test.ts` | 25 | Assignment carryover, departed member exclusion |

### API Routes (8 files, 200 tests)
| File | Tests | What it covers |
|---|---|---|
| `sessions.test.ts` | 54 | Recurring, one-off, voting, cancel, generate week |
| `private-sessions.test.ts` | 43 | Full CRUD, payment status |
| `recurring-slots.test.ts` | 21 | Create, delete, cascade |
| `session-members.test.ts` | 19 | Assign/remove members, capacity, vote cleanup |
| `members.test.ts` | 16 | CRUD, status transitions |
| `votes.test.ts` | 15 | Cast, update, deadline enforcement |
| `session-trainers.test.ts` | 14 | Assign/remove trainers, auth |
| `payments.test.ts` | 13 | Record, advance payments, validation |

### UI Components (3 files, 55 tests)
| File | Tests | What it covers |
|---|---|---|
| `SessionCard.test.tsx` | 39 | Display, voting, assignments, role-based behavior |
| `Modal.test.tsx` | 28 | Keyboard nav, accessibility, focus trap |
| `session-schemas.test.tsx` | 17 | Zod validation for sessions |
| `CreateSessionModal.test.tsx` | 15 | One-off, new recurring, validation |
| `VoteModal.test.tsx` | 11 | Inline voting modal |
| `MemberScheduleClient.test.tsx` | 7 | Calendar rendering, assigned vs unassigned |

### Known Lint Warnings (4, pre-existing)
- `ScheduleClient.tsx`: trainers, members unused
- `members` API route: `_payments` unused
- `notifications` lib: `_user` unused
