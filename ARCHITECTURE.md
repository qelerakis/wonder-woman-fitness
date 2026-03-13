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
| **Charts**         | Recharts                       | 3.x      | React-native charting library. Composable, lightweight, good Tailwind integration. Covers line, bar, pie, and area charts needed for the dashboard. |
| **Validation**     | Zod                            | 4.x      | Runtime schema validation shared between client forms and API routes. Single source of truth for data shapes. |
| **Hosting**        | Vercel (app) + Neon (database) | —        | Vercel for zero-config Next.js deployment with edge functions. Neon for serverless Postgres with branching (useful for staging). Both have generous free tiers. |
| **Password Hash**  | bcrypt                         | 6.x      | Industry standard for password hashing with automatic salt generation.                                  |

---

## 2. Project Structure

```
wonder-woman-fitness/
├── prisma/
│   ├── schema.prisma              # Database schema (9 models, 4 enums)
│   └── seed.ts                    # Seed script (owner account, sample data)
├── generated/
│   └── prisma/                    # Prisma 7 generated client (adapter pattern, gitignored)
├── app/                           # Next.js App Router (no src/ prefix)
│   ├── (auth)/                    # Auth routes
│   │   ├── layout.tsx                     # Auth layout wrapper
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── check-email/page.tsx           # Post-registration verification prompt
│   │   ├── verify-email/page.tsx          # Token verification landing page
│   │   └── forgot-password/page.tsx
│   ├── (locked)/                  # Locked member route group
│   │   └── member/
│   │       └── locked/page.tsx            # Payment lockout screen
│   ├── (member)/                  # Member-facing routes
│   │   ├── layout.tsx                     # Member layout with navigation
│   │   └── member/
│   │       ├── schedule/page.tsx          # Weekly calendar with voting
│   │       ├── session/[id]/page.tsx      # Session detail + vote modal
│   │       ├── profile/page.tsx           # Edit profile + photo upload
│   │       ├── notifications/page.tsx     # Notification center
│   │       ├── stop-training/page.tsx     # Voluntary departure flow
│   │       └── departed/page.tsx          # Motivational banner + rejoin
│   ├── (trainer)/                 # Trainer-facing routes
│   │   ├── my-schedule/page.tsx           # Trainer's assigned sessions
│   │   └── trainer/
│   │       ├── session/[id]/page.tsx      # Session detail + workout editor
│   │       ├── notifications/page.tsx     # Trainer notifications
│   │       ├── payments/page.tsx          # Trainer payment recording + member status
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
│   ├── api/                       # API route handlers (29 route files, all rate-limited)
│   │   ├── __tests__/                       # API route tests (12 files, 399 tests)
│   │   ├── auth/
│   │   │   ├── [...nextauth]/route.ts     # NextAuth v5 handler
│   │   │   ├── register/route.ts          # Member self-registration (creates PendingVerification)
│   │   │   ├── verify-email/route.ts      # GET: verify email token, create User
│   │   │   └── resend-verification/route.ts # POST: resend verification email with cooldown
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
│   │   │   │   ├── move-members/route.ts  # POST (move between sessions)
│   │   │   │   └── attendance/route.ts    # POST (mark present/absent)
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
│   │   │   ├── [id]/route.ts              # PATCH (mark read)
│   │   │   ├── mark-all-read/route.ts     # POST (mark all read)
│   │   │   └── broadcast/
│   │   │       ├── route.ts               # POST (send broadcast notification)
│   │   │       └── recipients/route.ts    # GET (preview recipient count)
│   │   ├── analytics/route.ts             # GET (owner-only dashboard)
│   │   └── cron/                          # Secured with CRON_SECRET
│   │       ├── payment-reminders/route.ts # Daily at 9 AM
│   │       ├── trial-expiration/route.ts  # Daily at 6 AM
│   │       ├── voting-deadline/route.ts   # Hourly
│   │       └── cleanup-pending/route.ts   # Daily at 3 AM (expired verifications)
│   ├── globals.css                # Tailwind v4 CSS config (@theme directive)
│   ├── manifest.ts                 # PWA web app manifest
│   └── layout.tsx                 # Root layout (Header, auth provider)
├── components/
│   ├── ui/                        # 13 primitives (Badge, Button, Card, ConfirmationModal,
│   │                              #   DatePicker, DateTimePicker, Input, Modal, Select,
│   │                              #   Spinner, Textarea, Toast)
│   ├── schedule/                  # 10 components (WeeklyCalendar, SessionCard, CreateSessionModal,
│   │                              #   DeleteRecurringSlotModal, VotingPrompt, VoteSummary,
│   │                              #   WorkoutDisplay, WorkoutEditor, AssignmentToggleList,
│   │                              #   AttendanceChecklist)
│   ├── payment/                   # 6 components (PaymentBanner, LockoutScreen, PaymentForm,
│   │                              #   PaymentHistory, PaymentStatusBadge, PaymentInfoSection)
│   ├── member/                    # 2 components (MemberTable, MemberCard)
│   ├── notification/              # 5 components (NotificationBell, NotificationList,
│   │                              #   NotificationItem, NotificationsClient, SendNotificationModal)
│   ├── analytics/                 # 7 components (MetricCard, AttendanceChart, RevenueChart,
│   │                              #   RetentionChart, DateRangeFilter, MemberAttendanceTable,
│   │                              #   VoteVsActualCards)
│   └── layout/                    # 6 components (Header, Navigation, BottomNav, Footer, AuthBackground, LanguageToggle)
├── lib/
│   ├── prisma.ts                  # Prisma 7 singleton (PrismaPg adapter)
│   ├── auth.ts                    # NextAuth full config (server-only, uses Prisma)
│   ├── auth.config.ts             # NextAuth edge-compatible config (no Prisma)
│   ├── email.ts                   # Resend client + email templates
│   ├── cloudinary.ts              # Upload helper
│   ├── constants.ts               # All magic numbers and enums (~177 lines)
│   ├── cron-auth.ts               # Timing-safe cron secret verification
│   ├── payment-logic.ts           # Computed payment status engine
│   ├── rate-limit.ts              # In-memory sliding-window rate limiter
│   ├── voting-logic.ts            # Voting deadline calculation, eligibility
│   ├── session-generation.ts      # generateSessionsForWeek() with carry-forward
│   ├── notifications.ts           # dispatchNotification() email + in-app
│   ├── env.ts                     # Centralized environment variable validation
│   ├── email-verification.ts      # Email verification helpers, token generation
│   ├── attendance-analytics.ts    # Shared attendance analytics computation
│   └── __tests__/                 # 15 business logic test files (297 tests)
├── types/
│   ├── index.ts                   # Shared TypeScript types + Zod schemas (strict, with length limits)
│   └── __tests__/
│       ├── session-schemas.test.ts # Zod validation tests
│       └── strict-schemas.test.ts  # Strict schema validation (unknown field rejection, length limits)
├── hooks/                         # Custom React hooks
│   ├── useNotifications.ts        # Real-time notification polling
│   ├── usePaymentStatus.ts        # Payment status fetching & display
│   └── useIsMobile.ts               # Mobile viewport detection hook (< 768px)
├── i18n/
│   └── request.ts                   # next-intl configuration, cookie-based locale
├── messages/
│   ├── en.json                      # English translations (~680 keys)
│   └── mk.json                      # Macedonian translations (~680 keys)
├── public/
│   ├── icon-192.png                 # PWA icon (192×192)
│   └── icon-512.png                 # PWA icon (512×512, maskable)
├── docs/
│   └── plans/                     # 40 design/plan documents
├── middleware.ts                   # Role-based routing + departed redirect
├── .env.local                     # Environment variables (gitignored)
├── next.config.ts                 # serverExternalPackages: prisma, pg, bcrypt
├── prisma.config.ts               # Prisma 7 configuration (adapter pattern)
├── vercel.json                    # 4 cron jobs + domain redirects
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
       │               │ paidAt           │
       │               │ createdBy        │──→ User (owner)
       │               │ paidMarkedBy?    │──→ User (audit trail)
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

       │               ┌──────────────────────┐
       │               │ PendingVerification  │
       │               ├──────────────────────┤
       │               │ id                   │
       │               │ email (unique)       │
       │               │ passwordHash         │
       │               │ name                 │
       │               │ phone?               │
       │               │ token (unique)       │
       │               │ expiresAt            │
       │               │ resendCount          │
       │               │ lastResentAt?        │
       │               │ createdAt            │
       │               └──────────────────────┘

       │               ┌──────────────────────┐
       │               │  AttendanceRecord    │
       │               ├──────────────────────┤
       │               │ id                   │
       │               │ sessionId            │──→ Session
       │               │ userId               │──→ User (member)
       │               │ present (bool)       │
       │               │ markedById           │──→ User (owner/trainer)
       │               │ markedAt             │
       │               │ createdAt            │
       │               └──────────────────────┘
```

### Key Enums

```
UserRole:     OWNER | TRAINER | MEMBER
UserStatus:   TRIAL | ACTIVE | DEPARTED  (LOCKED is computed, never stored)
SessionStatus: SCHEDULED | CANCELLED
NotificationType: WORKOUT_POSTED | VOTING_OPENED | CLASS_CANCELLED |
                  MEMBER_MOVED | PAYMENT_REMINDER | LOCKOUT |
                  MEMBER_DEPARTED | REJOIN_REQUEST | TRIAL_EXPIRING |
                  TRIAL_EXPIRED | SESSION_DELETED | MANUAL_REMINDER |
                  BROADCAST | ROLE_CHANGED
```

---

## 4. Data Flow

### 4.1 Request Lifecycle

```
Browser → Next.js Middleware → Page/API Route → Prisma → PostgreSQL
                │
                ├─ Checks JWT session (NextAuth)
                ├─ Checks user role (OWNER/TRAINER/MEMBER)
                ├─ Checks payment status (locks out unpaid members after grace period)
                └─ Redirects unauthorized users
```

### 4.2 Payment Status Resolution

Payment status is **computed, not stored** as a column on the User. This prevents stale data. The logic runs in `lib/payment-logic.ts` and is evaluated on every relevant request via middleware. Note: the trial period IS the grace period — there is no separate TRIAL payment status.

```
function getPaymentStatus(user, payments, today):

  1. If user.status === DEPARTED → return DEPARTED
  2. If user.overrideActive → return OVERRIDE
  3. Find payment record covering today → if found → return PAID
  4. No covering payment — calculate grace period:
     a. Trial members (status=TRIAL): grace starts from registration date
        (trialEndsAt - TRIAL_DAYS), length = 14 days, shows "Payment due" from day 1
     b. Active members: grace starts from 1st of current month, length = 10 days
     c. If within grace period → return GRACE_PERIOD
     d. Otherwise → return LOCKED
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
| `trial-expiration`       | Daily at 6:00 AM  | Check trial members. Notify owner and member 2 days before payment deadline. |
| `voting-deadline`        | Daily at midnight | Lock voting on sessions where deadline has passed.                     |
| `cleanup-pending`        | Daily at 3:00 AM  | Delete expired PendingVerification records (token > 1 hour old).           |

Cron routes are secured with a `CRON_SECRET` header that Vercel injects automatically.

---

## 5. Key Design Decisions

### 5.1 Single Next.js App (No Separate Backend)

**Decision**: Everything lives in one Next.js application — pages, API routes, cron jobs.

**Why**: This is a single-gym app with one owner, a handful of trainers, and at most ~100 members. There is no need for a separate Express/NestJS server. Co-locating everything reduces deployment complexity, keeps the codebase navigable, and Vercel handles scaling automatically. If the app ever needs to go multi-tenant, the API routes can be extracted into a standalone service without rewriting business logic.

### 5.2 Computed Payment Status (Not Stored)

**Decision**: Payment status (PAID / GRACE / LOCKED) is computed on the fly from the `Payment` records, not stored as a field on the `User` table.

**Why**: Storing it would require a cron job to update it daily, introducing a window where it could be stale. Computing it means it's always accurate — when the owner records a payment at 3 PM, the member's access changes immediately. The only stored statuses on the user are role-based states (TRIAL, ACTIVE, DEPARTED) that change through explicit actions, not time. Note: TRIAL is a database status (user is new), not a payment status — trial members enter GRACE_PERIOD immediately from registration.

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

**Decision**: Use Next.js route groups — `(auth)`, `(locked)`, `(member)`, `(trainer)`, `(owner)` — to organize pages by role.

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
\** Trainers can read payment status and record payments on behalf of the owner.

### 6.3 API Security

- All API routes validate the session token and role before processing.
- All user inputs validated with strict Zod schemas (`.strict()` rejects unknown fields, string length limits enforced).
- Database queries use Prisma's parameterized queries (no SQL injection).
- File uploads validated for type (JPEG/PNG) and size (max 5 MB) before sending to Cloudinary.
- Cron job routes secured with timing-safe `CRON_SECRET` comparison (`lib/cron-auth.ts`).
- Rate limiting on all API endpoints via in-memory sliding-window limiter (`lib/rate-limit.ts`).
- Content-Security-Policy header mitigates XSS attacks.
- GET endpoints validate query parameters with Zod schemas.

---

## 7. Environment Variables

```bash
# Database
DATABASE_URL=postgresql://...@neon.tech/wwfitness

# Auth
NEXTAUTH_SECRET=<random-32-char-string>
NEXTAUTH_URL=https://wonderwomanfitness.org

# Email
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@wonderwomanfitness.org

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
                    │   Cloudflare    │  (DNS for wonderwomanfitness.org)
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
| Production  | Live app                | `main`           | https://wonderwomanfitness.org          |
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

### 9.6 Security Hardening (OWASP)

Multiple security improvements were added post-MVP:
- **Rate Limiting**: In-memory sliding-window rate limiter on all 21 API endpoints. Registration limited to 10 req/15min per IP. General endpoints use configurable limits. Implemented in `lib/rate-limit.ts`.
- **Content-Security-Policy**: CSP header added via `next.config.ts` to mitigate XSS (OWASP A03:2021).
- **Strict Zod Schemas**: All Zod schemas use `.strict()` to reject unexpected fields, preventing mass assignment (OWASP A01:2021). String length limits on all text fields.
- **Zod-Validated Query Parameters**: GET endpoints validate query params with Zod schemas instead of raw string access.
- **Timing-Safe Cron Auth**: `lib/cron-auth.ts` uses `crypto.timingSafeEqual` for cron secret verification to prevent timing attacks.

### 9.7 Custom Date Pickers

Dark-themed DatePicker and DateTimePicker components replace native browser date inputs. Features calendar navigation, month/year dropdowns, +1 Month shortcut, keyboard accessibility, and fixed positioning to avoid container overflow.

### 9.8 Trainer Payment Recording

Trainers can view member payment status and record payments on behalf of the owner via `/trainer/payments`. The `Payment.recordedById` field tracks who recorded each payment for audit purposes.

### 9.9 Private Session Audit Trail

`PrivateSession` model gained `paidAt` (when payment was marked) and `paidMarkedById` (who marked it as paid) fields for complete audit trail. Trainers can view private sessions in read-only mode.

### 9.10 Trial-as-Grace-Period

The TRIAL payment status was removed. Trial members now enter GRACE_PERIOD immediately from registration, seeing "Payment due" with a 14-day countdown from day 1. The trial page was repurposed as "New Members" and the TrialBadge component was removed.

### 9.11 Owner as Trainer

The owner can be assigned as a trainer to sessions, appearing in all trainer selection lists. This allows the owner to lead classes directly.

### 9.12 Test Suite

2,881 automated tests across 78 files using Vitest (~27s):
- **Business logic & utilities** (20 files, 632 tests): i18n-translation-keys (170), max-class-size (78), profile-payment-info (56), payment-logic (51), voting-logic (38), attendance-analytics (35), notification-helpers (26), carry-forward (25), time-format (25), rate-limit (24), session-generation (24), resend-verification (14), register-verification (13), env (12), verify-email-page (11), email-verification (10), date-locale (6), cron-auth (5), cleanup-pending (5), rate-limit-integration (4)
- **API routes** (14 files, 458 tests): sessions (96), private-sessions (52), votes (44), payments-my (43), attendance (38), broadcast-notifications (32), payments (26), analytics-attendance (25), recurring-slots (24), session-members (19), members (16), trainers (16), session-trainers (15), mark-all-read (12)
- **UI components** (42 files, 1,640 tests): MemberSessionDetailClient (154), SessionCard (107), DateTimePicker (91), PrivateSessionsClient (88), PaymentsClient (82), DatePicker (80), SendNotificationModal (75), DashboardClient (68), ProfileClient (65), PaymentInfoSection (58), TrainersClient (54), AssignmentToggleList (51), TrainerPaymentsClient (45), Button (40), ConfirmationModal (37), CheckEmailPage (34), SessionDetailClient (33), PaymentHistory (31), generated-icons (30), icon-svg (30), VotingPrompt (30), Modal (28), AttendanceChecklist (27), manifest (26), i18n-trainer-session (26), AttendanceAnalytics (22), AuthLayout (21), i18n-member-session (21), i18n-components (17), PaymentBanner (17), next-intl-mock (17), TrainerSessionDetailClient (17), MemberTable (16), CreateSessionModal (15), LoginPage (15), layout-metadata (13), Footer (12), i18n-session-card (12), PaymentStatusBadge (12), NotificationsClient (12), i18n-payment-history (6), LanguageToggle (5)
- **Type validation** (2 files, 86 tests): strict-schemas (69), session-schemas (17)

### 9.13 Email Verification

New member registration uses a two-step verification flow:
1. `POST /api/auth/register` creates a `PendingVerification` record (not a User) with a hashed password, a unique token, and a 1-hour expiry.
2. Verification email sent via Resend with a link to `/verify-email?token=...`.
3. `GET /api/auth/verify-email` validates the token, creates the User, deletes the PendingVerification record.
4. Resend endpoint (`POST /api/auth/resend-verification`) with 60-second cooldown and max 5 resend attempts.
5. Daily cron job (`/api/cron/cleanup-pending`) deletes expired records at 3 AM.

### 9.14 Attendance Tracking

Owner and trainers can mark members as present or absent after a session occurs:
- `POST /api/sessions/[id]/attendance` — records or updates attendance for a member
- `AttendanceRecord` model tracks: session, member, present/absent, who marked it, when
- `AttendanceChecklist` component shows assigned members with toggles on the session detail page
- Attendance data integrated into dashboard analytics via shared `lib/attendance-analytics.ts`

### 9.15 Broadcast Notifications

Owner can send custom notifications to targeted member groups:
- `POST /api/notifications/broadcast` — sends notification to selected audience
- `GET /api/notifications/broadcast/recipients` — previews recipient count for audience type
- Audience types: ALL (active members), TRIAL, SESSION_SLOT (specific recurring slot), PAYMENT_STATUS, INDIVIDUAL
- `SendNotificationModal` component with audience selector, live recipient count, and confirmation step

### 9.16 Session Card Color States

Session cards display color-coded backgrounds based on member state:
- Yellow/amber: Session needs voting (votingEnabled but user hasn't voted)
- Green: User is going (voted yes or assigned to session)
- Grey/dimmed: Cancelled sessions (60% opacity)
- Mobile: Colored left border for compact visual status

### 9.17 Mobile UX Enhancements

- `BottomNav` component for mobile members and trainers (replaces sidebar on small screens)
- Haptic feedback on successful vote submission
- Refresh button on member schedule page
- Compact horizontal chips for who's-coming list on mobile

### 9.18 Internationalization (i18n)

Full Macedonian and English language support via `next-intl`:
- `messages/en.json` and `messages/mk.json` contain ~680 translation keys each
- `i18n/request.ts` configures locale detection from `NEXT_LOCALE` cookie
- `LanguageToggle` component in header and auth pages switches locale via cookie + page reload
- Client components use `useTranslations(namespace)` hook
- Server components use `getTranslations(namespace)`
- Test mock in `test/mocks/next-intl.ts` loads English translations for all tests (auto-loaded by vitest setup)

### 9.19 PWA Support

Progressive Web App configuration for mobile home screen installation:
- `app/manifest.ts` generates web app manifest with `display: "standalone"`, theme color `#9333ea`
- Icons: `public/icon-192.png` (192×192) and `public/icon-512.png` (512×512, maskable)
- Root layout metadata includes `themeColor` for browser chrome coloring

### 9.20 Footer Component

Minimal footer component (`components/layout/Footer.tsx`) rendered in root layout. Uses i18n translations from `footer` namespace. Sticks to viewport bottom via flex layout (`flex-1` on content, `shrink-0` on footer).

### 9.21 Search in Assignment Lists

`AssignmentToggleList` component gained an optional `showSearch` prop that displays a search input for filtering people by name. Case-insensitive filtering, shows "No members found" for empty results, disabled when component is disabled.

### 9.22 24-Hour Time Format

All time displays converted from 12-hour (AM/PM) to 24-hour format. The `formatTime(hour)` helper pads hours with zero and appends `:00` (e.g., 9 → "09:00", 13 → "13:00"). `TIME_FORMAT = 'HH:mm'` constant in `lib/constants.ts` used with date-fns.

### 9.23 Member-to-Trainer Promotion

`POST /api/trainers` endpoint (owner-only) promotes a member to trainer role:
- Atomically changes role MEMBER → TRAINER, sets status ACTIVE
- Removes future session member assignments and votes (from current week forward)
- Sends ROLE_CHANGED notification to promoted user
- `TrainersClient` component provides the promotion UI with member selector

### 9.24 Animated Auth Background

`AuthBackground` component renders three overlapping gradient orbs with CSS keyframe animations (10s, 13s, 8s cycles). Applied to `(auth)` route group layout. Respects `prefers-reduced-motion`. Uses `willChange: "transform, opacity"` for GPU acceleration.

### 9.25 Member Payment Profile

Members can view their own payment status and history:
- `GET /api/payments/my` endpoint returns the member's own payment records
- `PaymentInfoSection` component displays status badge, date grid (last payment, paid through, next due), and payment history with "Show all" toggle
- Integrated into member profile page

### 9.26 Domain Redirect Configuration

`vercel.json` includes three 301 redirect rules:
- `www.wonderwomanfitness.org` → `wonderwomanfitness.org`
- `wonder-woman-fitness.vercel.app` → `wonderwomanfitness.org`
- `*.vercel.app` → `wonderwomanfitness.org` (catch-all)
