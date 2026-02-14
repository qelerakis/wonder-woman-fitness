# Architecture — Wonder Woman Fitness

## 1. Tech Stack

| Layer              | Choice                         | Version  | Why                                                                                                     |
|--------------------|--------------------------------|----------|---------------------------------------------------------------------------------------------------------|
| **Framework**      | Next.js (App Router)           | 15.x     | Full-stack React framework. Server components reduce client JS bundle. API routes co-located with UI. Single deployment unit on Vercel. |
| **Language**       | TypeScript                     | 5.x      | Type safety across the entire stack prevents an entire class of runtime bugs, especially important for role-based logic and payment calculations. |
| **Styling**        | Tailwind CSS                   | 4.x      | Utility-first CSS. Easy to enforce the purple/black brand palette via `tailwind.config`. No context-switching between files. |
| **Database**       | PostgreSQL                     | 16       | Relational data (users → payments → sessions → votes) is the core of this app. Postgres handles it natively with foreign keys, constraints, and transactional integrity. |
| **ORM**            | Prisma                         | 7.x      | Type-safe queries with adapter pattern (`PrismaPg`). Generated client at `@/generated/prisma`. Migrations are version-controlled. |
| **Auth**           | NextAuth.js (Auth.js) v5       | 5.x      | Credentials provider for email/password. Session strategy via JWT. Role field (`OWNER`, `TRAINER`, `MEMBER`) stored in the token for middleware-level access control. |
| **Email**          | Resend                         | Latest   | Simple API, excellent deliverability, built-in React Email support for templated emails. Free tier covers MVP volume. |
| **File Storage**   | Cloudinary                     | Latest   | Member photo uploads with automatic resizing/optimization. No need to manage S3 buckets and CDN configuration for a single-gym app. |
| **Cron / Jobs**    | Vercel Cron Jobs               | —        | Serverless cron for automated payment reminders (day 1, 7, 11) and trial expiration checks. No separate worker process to maintain. |
| **Charts**         | Recharts                       | 2.x      | React-native charting library. Composable, lightweight, good Tailwind integration. Covers line, bar, pie, and area charts needed for the dashboard. |
| **Validation**     | Zod                            | 3.x      | Runtime schema validation shared between client forms and API routes. Single source of truth for data shapes. |
| **Hosting**        | Vercel (app) + Neon (database) | —        | Vercel for zero-config Next.js deployment with edge functions. Neon for serverless Postgres with branching (useful for staging). Both have generous free tiers. |
| **Password Hash**  | bcrypt                         | 5.x      | Industry standard for password hashing with automatic salt generation.                                  |

---

## 2. Project Structure

```
wonder-woman-fitness/
├── prisma/
│   ├── schema.prisma              # Database schema (9 models, 4 enums)
│   ├── migrations/                # Version-controlled migrations
│   └── seed.ts                    # Seed script (owner account, sample data)
├── generated/
│   └── prisma/                    # Prisma 7 generated client (adapter pattern)
├── app/                           # Next.js App Router (no src/ prefix)
│   ├── (auth)/                    # Auth routes
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── forgot-password/page.tsx
│   ├── (member)/                  # Member-facing routes
│   │   ├── member/
│   │   │   ├── schedule/page.tsx          # Weekly calendar with voting
│   │   │   ├── session/[id]/page.tsx      # Session detail + vote modal
│   │   │   ├── profile/page.tsx           # Edit profile + photo upload
│   │   │   ├── notifications/page.tsx     # Notification center
│   │   │   ├── stop-training/page.tsx     # Voluntary departure flow
│   │   │   ├── departed/page.tsx          # Motivational banner + rejoin
│   │   │   └── locked/page.tsx            # Payment lockout screen
│   ├── (trainer)/                 # Trainer-facing routes
│   │   ├── my-schedule/page.tsx           # Trainer's assigned sessions
│   │   └── trainer/
│   │       ├── session/[id]/page.tsx      # Session detail + workout editor
│   │       ├── notifications/page.tsx     # Trainer notifications
│   │       └── private-sessions/page.tsx  # View private sessions (read-only)
│   ├── (owner)/                   # Owner/admin routes
│   │   ├── dashboard/page.tsx             # Analytics dashboard
│   │   ├── owner/
│   │   │   ├── schedule/page.tsx          # Weekly calendar + create sessions
│   │   │   ├── session/[id]/page.tsx      # Full session management
│   │   │   └── notifications/page.tsx     # Owner notifications
│   │   ├── members/page.tsx               # Member list table
│   │   ├── members/[id]/page.tsx          # Member detail + payments
│   │   ├── members/inactive/page.tsx      # Departed members
│   │   ├── members/trial/page.tsx         # Trial members
│   │   ├── payments/page.tsx              # Payment tracking
│   │   ├── private-sessions/page.tsx      # Private session management
│   │   └── trainers/page.tsx              # Trainer account management
│   ├── api/                       # API route handlers (~30 endpoints)
│   │   ├── auth/
│   │   │   ├── [...nextauth]/route.ts     # NextAuth v5 handler
│   │   │   └── register/route.ts          # Member self-registration
│   │   ├── members/
│   │   │   ├── route.ts                   # GET (list), POST
│   │   │   └── [id]/
│   │   │       ├── route.ts               # GET, PATCH (profile/status)
│   │   │       └── payment-status/route.ts # Computed payment status
│   │   ├── sessions/
│   │   │   ├── route.ts                   # GET (list), POST (create)
│   │   │   ├── [id]/
│   │   │   │   ├── route.ts               # GET, PATCH, DELETE
│   │   │   │   ├── trainers/route.ts      # POST (assign/remove trainers)
│   │   │   │   ├── members/route.ts       # POST (assign/remove members)
│   │   │   │   └── move-members/route.ts  # POST (move between sessions)
│   │   │   └── generate-week/route.ts     # POST (generate from templates)
│   │   ├── recurring-slots/route.ts       # GET, POST, DELETE (with cascade)
│   │   ├── votes/route.ts                 # GET, POST, DELETE
│   │   ├── payments/
│   │   │   ├── route.ts                   # GET, POST
│   │   │   └── [id]/route.ts              # GET, DELETE
│   │   ├── private-sessions/
│   │   │   ├── route.ts                   # GET, POST
│   │   │   └── [id]/route.ts              # PATCH, DELETE
│   │   ├── notifications/
│   │   │   ├── route.ts                   # GET (list)
│   │   │   └── [id]/route.ts              # PATCH (mark read)
│   │   ├── analytics/route.ts             # GET (owner-only dashboard)
│   │   └── cron/                          # Secured with CRON_SECRET
│   │       ├── payment-reminders/route.ts # Daily at 9 AM
│   │       ├── trial-expiration/route.ts  # Daily at 6 AM
│   │       └── voting-deadline/route.ts   # Hourly
│   ├── globals.css                # Tailwind v4 CSS config (@theme directive)
│   ├── layout.tsx                 # Root layout (Header, auth provider)
│   └── middleware.ts              # Role-based routing + payment lockout
├── components/
│   ├── ui/                        # 9 primitives (Badge, Button, Card, Input, Modal, Select, Spinner, Textarea, Toast)
│   ├── schedule/                  # 9 components (WeeklyCalendar, SessionCard, CreateSessionModal,
│   │                              #   DeleteRecurringSlotModal, VotingPrompt, VoteSummary,
│   │                              #   WorkoutDisplay, WorkoutEditor, AssignmentToggleList)
│   ├── payment/                   # 5 components (PaymentBanner, LockoutScreen, PaymentForm,
│   │                              #   PaymentHistory, PaymentStatusBadge)
│   ├── member/                    # 3 components (MemberTable, MemberCard, TrialBadge)
│   ├── notification/              # 4 components (NotificationBell, NotificationList,
│   │                              #   NotificationItem, NotificationsClient)
│   ├── analytics/                 # 5 components (MetricCard, AttendanceChart, RevenueChart,
│   │                              #   RetentionChart, DateRangeFilter)
│   └── layout/                    # 2 components (Header, Navigation)
├── lib/
│   ├── prisma.ts                  # Prisma 7 singleton (PrismaPg adapter)
│   ├── auth.ts                    # NextAuth full config (server-only, uses Prisma)
│   ├── auth.config.ts             # NextAuth edge-compatible config (no Prisma)
│   ├── email.ts                   # Resend client + email templates
│   ├── cloudinary.ts              # Upload helper
│   ├── constants.ts               # All magic numbers (~167 lines)
│   ├── payment-logic.ts           # Computed payment status engine
│   ├── voting-logic.ts            # Voting deadline calculation, eligibility
│   ├── session-generation.ts      # generateSessionsForWeek() with carry-forward
│   ├── notifications.ts           # dispatchNotification() email + in-app
│   └── __tests__/                 # 4 business logic test files (103 tests)
├── types/
│   └── index.ts                   # Shared TypeScript types + Zod schemas
├── hooks/                         # Custom React hooks
├── docs/
│   └── plans/                     # 7 design/plan documents
├── public/
│   └── images/                    # Logo, branding assets
├── .env.local                     # Environment variables
├── next.config.ts                 # serverExternalPackages: prisma, pg, bcrypt
├── vercel.json                    # 3 cron job definitions
├── vitest.config.ts               # Test configuration
├── package.json
├── tsconfig.json
├── PRD.md
├── ARCHITECTURE.md
├── DEPLOYMENT.md
└── CLAUDE.md
```

---

## 3. Database Schema (ERD Overview)

```
┌─────────────┐       ┌──────────────────┐       ┌──────────────────┐
│    User      │       │  RecurringSlot   │       │    Session       │
├─────────────┤       ├──────────────────┤       ├──────────────────┤
│ id           │       │ id               │       │ id               │
│ email        │       │ dayOfWeek (1-7)  │       │ recurringSlotId? │──→ RecurringSlot
│ passwordHash │       │ startHour (7-22) │       │ customDay?       │  (nullable for one-offs)
│ name         │       │ createdAt        │       │ customStartHour? │
│ phone        │       └──────────────────┘       │ weekDate         │
│ photo        │                                  │ workoutTitle     │
│ role (enum)  │                                  │ workoutDetails   │
│ status (enum)│                                  │ votingEnabled    │
│ joinDate     │                                  │ votingDeadline   │
│ trialEndsAt  │                                  │ status (enum)    │
│ departedAt   │       ┌──────────────────┐       │ createdById?     │──→ User
│ departReason │       │  SessionMember   │       │ createdAt        │
│ monthlyRate  │       ├──────────────────┤       └──────────────────┘
│ overrideActive│      │ sessionId        │──→ Session   │
│ createdAt    │       │ userId           │──→ User      │
│ updatedAt    │       └──────────────────┘              │
└──────┬───────┘                                         │
       │               ┌──────────────────┐              │
       │               │  SessionTrainer  │              │
       │               ├──────────────────┤              │
       │               │ sessionId        │──→ Session   │
       │               │ userId           │──→ User (trainer)
       │               └──────────────────┘
       │
       │               ┌──────────────────┐
       │               │     Vote         │
       │               ├──────────────────┤
       │               │ id               │
       │               │ sessionId        │──→ Session
       │               │ userId           │──→ User
       │               │ attending (bool) │
       │               │ votedAt          │
       │               └──────────────────┘
       │
       │               ┌──────────────────┐
       │               │    Payment       │
       │               ├──────────────────┤
       │               │ id               │
       │               │ userId           │──→ User
       │               │ amount           │
       │               │ paidAt           │
       │               │ periodStart      │  (e.g., 2026-03-01)
       │               │ periodEnd        │  (e.g., 2026-03-31, or 2026-05-31 for advance)
       │               │ recordedBy       │──→ User (owner/trainer)
       │               │ notes            │
       │               └──────────────────┘
       │
       │               ┌──────────────────┐
       │               │ PrivateSession   │
       │               ├──────────────────┤
       │               │ id               │
       │               │ clientName       │
       │               │ scheduledAt      │
       │               │ paid (bool)      │
       │               │ amount           │
       │               │ exerciseDetails  │
       │               │ notes            │
       │               │ createdBy        │──→ User (owner)
       │               └──────────────────┘
       │
       │               ┌──────────────────┐
       │               │  Notification    │
       │               ├──────────────────┤
       │               │ id               │
       │               │ userId           │──→ User
       │               │ type (enum)      │
       │               │ title            │
       │               │ body             │
       │               │ read (bool)      │
       │               │ emailSent (bool) │
       │               │ createdAt        │
       │               └──────────────────┘
```

### Key Enums

```
UserRole:     OWNER | TRAINER | MEMBER
UserStatus:   TRIAL | ACTIVE | DEPARTED  (LOCKED is computed, never stored)
SessionStatus: SCHEDULED | CANCELLED
NotificationType: WORKOUT_POSTED | VOTING_OPENED | CLASS_CANCELLED |
                  MEMBER_MOVED | PAYMENT_REMINDER | LOCKOUT |
                  MEMBER_DEPARTED | REJOIN_REQUEST | TRIAL_EXPIRING |
                  TRIAL_EXPIRED | SESSION_DELETED | MANUAL_REMINDER
```

---

## 4. Data Flow

### 4.1 Request Lifecycle

```
Browser → Next.js Middleware → Page/API Route → Prisma → PostgreSQL
                │
                ├─ Checks JWT session (NextAuth)
                ├─ Checks user role (OWNER/TRAINER/MEMBER)
                ├─ Checks payment status (locks out unpaid members after day 10)
                └─ Redirects unauthorized users
```

### 4.2 Payment Status Resolution

Payment status is **computed, not stored** as a column on the User. This prevents stale data. The logic runs in `lib/payment-logic.ts` and is evaluated on every relevant request via middleware.

```
function getPaymentStatus(user, payments, today):

  1. If user.status === DEPARTED → return DEPARTED
  2. If user.status === TRIAL and today < user.trialEndsAt → return TRIAL
  3. If user.status === TRIAL and today >= user.trialEndsAt → transition to ACTIVE, treat as day 1
  4. Find the payment record covering the current month
     → if found → return PAID
  5. If no payment found:
     a. Calculate days since period start (1st of month, or trialEndsAt for first month)
     b. If days <= 10 → return GRACE_PERIOD
     c. If days > 10 → return LOCKED
  6. If owner has set a manual override → return OVERRIDE_ACTIVE
```

### 4.3 Voting Flow

```
Owner enables voting on Session → votingEnabled = true, votingDeadline = sessionDate - 1 day
  │
  ├─ Members see voting prompt → POST /api/votes { sessionId, attending: true/false }
  │
  ├─ Deadline passes → Cron or on-access: voting locked
  │   └─ Members who didn't vote → treated as attending: false
  │
  └─ Owner reviews results:
      ├─ Sufficient attendance → class proceeds as normal
      ├─ Low attendance (1-2) →
      │   ├─ Owner moves member(s) to different session → POST /api/sessions/:id/move
      │   │   └─ Notification sent to moved members (move is final)
      │   └─ Owner cancels class → PATCH /api/sessions/:id { status: CANCELLED }
      │       └─ Notification sent to all "coming" voters
      └─ Zero attendance → Owner cancels
```

### 4.4 Notification Dispatch

All notifications go through a single function `dispatchNotification()` in `lib/notifications.ts`:

```
dispatchNotification({ userId, type, title, body }):
  1. Create Notification record in DB (for in-app bell icon)
  2. Send email via Resend (fire-and-forget, log failures)
  3. Return notification ID
```

In-app notifications are fetched client-side by polling `GET /api/notifications?unread=true` every 30 seconds. This is simpler than WebSockets for the MVP and sufficient for a single-gym app with <100 users.

### 4.5 Cron Jobs

| Job                      | Schedule          | Action                                                                 |
|--------------------------|-------------------|------------------------------------------------------------------------|
| `payment-reminders`      | Daily at 9:00 AM  | Check all active members. Send reminders on day 1, 7. Lock out on day 11. |
| `trial-expiration`       | Daily at 6:00 AM  | Check trial members. Notify owner 2 days before. Transition expired trials to ACTIVE. |
| `voting-deadline`        | Hourly            | Lock voting on sessions where deadline has passed.                     |

Cron routes are secured with a `CRON_SECRET` header that Vercel injects automatically.

---

## 5. Key Design Decisions

### 5.1 Single Next.js App (No Separate Backend)

**Decision**: Everything lives in one Next.js application — pages, API routes, cron jobs.

**Why**: This is a single-gym app with one owner, a handful of trainers, and at most ~100 members. There is no need for a separate Express/NestJS server. Co-locating everything reduces deployment complexity, keeps the codebase navigable, and Vercel handles scaling automatically. If the app ever needs to go multi-tenant, the API routes can be extracted into a standalone service without rewriting business logic.

### 5.2 Computed Payment Status (Not Stored)

**Decision**: Payment status (PAID / GRACE / LOCKED) is computed on the fly from the `Payment` records, not stored as a field on the `User` table.

**Why**: Storing it would require a cron job to update it daily, introducing a window where it could be stale. Computing it means it's always accurate — when the owner records a payment at 3 PM, the member's access changes immediately. The only stored statuses on the user are role-based states (TRIAL, ACTIVE, DEPARTED) that change through explicit actions, not time.

### 5.3 RecurringSlot + Session (Two-Table Schedule)

**Decision**: The schedule is modeled as two tables: `RecurringSlot` (the template — e.g., "Monday 9 AM") and `Session` (the instance — e.g., "Monday 9 AM, week of March 3, with workout X and trainer Y").

**Why**: The owner said the time slots are the same every week but workouts change weekly. Separating the template from the instance means:
- Creating a new week's sessions is a simple copy from RecurringSlots.
- Each session has its own workout, votes, trainer, and member list.
- Deleting a RecurringSlot doesn't retroactively destroy historical sessions.
- Adding or removing a time slot from the recurring schedule only affects future weeks.

### 5.4 Middleware-Level Access Control

**Decision**: The Next.js middleware (`middleware.ts`) handles three things: authentication, role-based routing, and payment lockout.

**Why**: This is the single chokepoint for every request. Rather than scattering auth checks across 20 API routes and 15 pages, the middleware ensures:
- Unauthenticated users can only access `/login` and `/register`.
- Members can't access `/owner/*` or `/trainer/*` routes.
- Locked-out members are redirected to the payment banner page regardless of which URL they try to visit.
- This is enforced before the page or API route even starts rendering/executing.

### 5.5 Polling for Notifications (Not WebSockets)

**Decision**: In-app notifications use client-side polling (every 30 seconds) rather than WebSockets or Server-Sent Events.

**Why**: The app has a small user base (<100 concurrent users). WebSockets add complexity (connection management, reconnection logic, server state) that isn't justified. Polling every 30 seconds means at most ~3 requests/minute per active user. With Vercel's serverless architecture, this is trivial. If the app grows, this can be upgraded to SSE with minimal changes.

### 5.6 Resend for Email (Not SendGrid)

**Decision**: Use Resend over SendGrid.

**Why**: Resend has a simpler API, first-class support for React Email (lets us write email templates as React components), and a generous free tier (100 emails/day — more than enough for a single gym). The developer experience is significantly better than SendGrid's legacy API.

### 5.7 Neon for PostgreSQL (Not Railway/Supabase)

**Decision**: Use Neon for the database.

**Why**: Neon provides serverless Postgres that scales to zero (no cost when idle), database branching for staging/preview environments, and a generous free tier. It integrates natively with Vercel and Prisma. Railway would also work but doesn't offer branching.

### 5.8 Cloudinary for Photos (Not S3)

**Decision**: Use Cloudinary for member photo uploads.

**Why**: Cloudinary provides upload, storage, transformation (resize, crop, compress), and CDN delivery in one service. For a single-gym app with optional profile photos, S3 + CloudFront + Lambda@Edge for resizing is massive overkill. Cloudinary's free tier (25 credits/month) is more than sufficient.

### 5.9 Route Groups for Role Separation

**Decision**: Use Next.js route groups — `(auth)`, `(member)`, `(trainer)`, `(owner)` — to organize pages by role.

**Why**: This keeps each role's UI cleanly separated in the codebase while sharing a single `layout.tsx`. The parentheses in the folder name mean these don't affect the URL structure. Middleware maps the user's role to the allowed route group. This makes it impossible to accidentally expose an owner page to a member.

### 5.10 Zod for Validation (Shared Client + Server)

**Decision**: Use Zod schemas as the single source of truth for form validation (client-side) and API validation (server-side).

**Why**: Defining a payment schema once (`PaymentSchema = z.object({ amount: z.number().positive(), ... })`) and using it in both the form component and the API route eliminates the bug class of "client allows it but server rejects it" (or vice versa). TypeScript types are inferred from the Zod schemas, so there's zero duplication.

---

## 6. Security Model

### 6.1 Authentication

- All passwords hashed with bcrypt (12 salt rounds).
- JWT-based sessions via NextAuth.js. Token contains: `userId`, `role`, `status`.
- Session token stored in an HTTP-only, secure, SameSite cookie.
- Password reset via time-limited email token (expires in 1 hour).

### 6.2 Authorization Matrix

| Route Pattern         | OWNER | TRAINER | MEMBER | UNAUTHENTICATED |
|-----------------------|-------|---------|--------|-----------------|
| `/login`, `/register` | ✅    | ✅      | ✅     | ✅              |
| `/owner/*`            | ✅    | ❌      | ❌     | ❌              |
| `/trainer/*`          | ✅    | ✅      | ❌     | ❌              |
| `/member/*` (PAID)    | ✅    | ✅      | ✅     | ❌              |
| `/member/*` (LOCKED)  | ❌    | ❌      | 🔒 *   | ❌              |
| `/api/payments/*`     | ✅    | 🔍 **  | ❌     | ❌              |
| `/api/analytics/*`    | ✅    | ❌      | ❌     | ❌              |

\* Locked members are redirected to the payment banner page.
\** Trainers can read payment status but cannot create/edit payment records.

### 6.3 API Security

- All API routes validate the session token and role before processing.
- All user inputs validated with Zod schemas.
- Database queries use Prisma's parameterized queries (no SQL injection).
- File uploads validated for type (JPEG/PNG) and size (max 5 MB) before sending to Cloudinary.
- Cron job routes secured with `CRON_SECRET` header verification.

---

## 7. Environment Variables

```bash
# Database
DATABASE_URL=postgresql://...@neon.tech/wwfitness

# Auth
NEXTAUTH_SECRET=<random-32-char-string>
NEXTAUTH_URL=https://wonderwomanfitness.mk

# Email
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@wonderwomanfitness.mk

# File Storage
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Cron
CRON_SECRET=<random-32-char-string>
```

---

## 8. Deployment Architecture

```
                    ┌─────────────────┐
                    │   Cloudflare    │  (DNS for wonderwomanfitness.mk)
                    │   or Vercel DNS │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │     Vercel      │
                    │                 │
                    │  ┌───────────┐  │
                    │  │  Next.js  │  │  ← Pages + API Routes + Cron
                    │  │   App     │  │
                    │  └─────┬─────┘  │
                    │        │        │
                    └────────┼────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼──────┐ ┌────▼─────┐ ┌──────▼──────┐
     │   Neon        │ │  Resend  │ │ Cloudinary  │
     │  PostgreSQL   │ │  (Email) │ │  (Photos)   │
     └───────────────┘ └──────────┘ └─────────────┘
```

### Environments

| Environment  | Purpose                 | Database Branch  | URL                                    |
|-------------|-------------------------|------------------|----------------------------------------|
| Production  | Live app                | `main`           | https://wonderwomanfitness.mk          |
| Preview     | PR previews             | `preview`        | https://preview-*.vercel.app           |
| Development | Local dev               | `dev` (or local) | http://localhost:3000                   |

---

## 9. Post-MVP Architectural Additions

These features were added after the initial 10-phase build:

### 9.1 Custom One-Off Sessions

Sessions can now exist without a `RecurringSlot`. The `Session` model gained nullable `customDay` (1-7) and `customStartHour` (7-22) fields. When `recurringSlotId` is null, these fields define the session's day/time. Two unique constraints enforce no duplicates for either session type.

### 9.2 Session Assignment Management

Two new API endpoints handle trainer and member assignment at the individual session level:
- `POST /api/sessions/[id]/trainers` — Owner-only, toggle trainers on/off
- `POST /api/sessions/[id]/members` — Owner + assigned trainers, toggle members on/off

The `AssignmentToggleList` component provides an inline toggle UI used by the session detail page.

### 9.3 Carry-Forward on Week Generation

`generateSessionsForWeek()` in `lib/session-generation.ts` now copies trainer and member assignments from the previous week's matching recurring slot sessions. Departed members are automatically excluded from carry-forward.

### 9.4 Auth Split Pattern (Prisma 7 + Edge)

NextAuth v5's middleware runs on the Edge runtime, which cannot import Prisma. The auth config is split:
- `lib/auth.config.ts` — Edge-compatible config (callbacks, pages, providers without DB calls)
- `lib/auth.ts` — Full server config that imports Prisma for the `authorize()` function

Middleware uses `auth.config.ts`. Server components and API routes use `auth.ts`.

### 9.5 Delete Recurring Slot with Cascade

`DELETE /api/recurring-slots` accepts an optional `deleteFutureSessions` flag. When true, it deletes all future sessions (weekDate >= current week Monday) generated from the slot before deleting the slot itself. The `DeleteRecurringSlotModal` component provides the UI.

### 9.6 Test Suite

358 automated tests across 15 files using Vitest:
- **Business logic** (4 files, 103 tests): payment-logic, voting-logic, session-generation, carry-forward
- **API routes** (8 files, 200 tests): members, sessions, payments, votes, session-trainers, session-members, private-sessions, recurring-slots
- **UI components** (3 files, 55 tests): Modal, CreateSessionModal, session-schemas, SessionCard, VoteModal, MemberScheduleClient
