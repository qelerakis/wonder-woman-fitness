# Email Verification Design

> Date: 2026-02-19
> Status: Implemented

## Overview

Add email verification for new member registrations. Account creation is deferred until the user clicks a verification link sent to their email. This prevents database pollution from fake registrations and ensures valid email addresses.

## Data Model

New `PendingVerification` table:

```prisma
model PendingVerification {
  id           String    @id @default(cuid())
  email        String    @unique              // Lowercased
  passwordHash String                         // bcrypt hash
  name         String
  phone        String?
  token        String    @unique              // 32-byte crypto-random, base64url
  expiresAt    DateTime                       // createdAt + 24 hours
  resendCount  Int       @default(0)          // Max 5 resends
  lastResentAt DateTime?                      // For 60-second cooldown
  createdAt    DateTime  @default(now())
}
```

- Password hashed before storage (same bcrypt approach as User table)
- `@@unique([email])` — one pending record per email, upsert replaces old ones
- No relation to User — completely independent table
- Token: `crypto.randomBytes(32).toString('base64url')` — 256 bits of entropy

## Constants

```typescript
VERIFICATION_TOKEN_BYTES = 32
VERIFICATION_EXPIRY_HOURS = 24
VERIFICATION_MAX_RESENDS = 5
VERIFICATION_RESEND_COOLDOWN_MS = 60_000  // 60 seconds
```

## Registration Flow (Modified)

**POST `/api/auth/register`** — changes from "create user + auto-login" to "create pending record + send email":

1. Validate request body with existing `RegisterSchema`
2. Hash password with bcrypt (12 rounds) — done before email check (timing attack prevention)
3. Check if email exists in `User` table — if so, return generic error
4. Upsert into `PendingVerification` — new token, reset `resendCount`, `expiresAt` = now + 24h
5. Send verification email via Resend
6. Return 201 with `{ message: "Verification email sent" }`

**Client-side** (`app/(auth)/register/page.tsx`):

- On success, redirect to `/check-email?email={email}` instead of auto-login

## Check Email Page (New)

**`app/(auth)/check-email/page.tsx`**

- Shows: "We sent a verification link to **{email}**"
- "Resend" button with 60-second visible cooldown timer
- Link back to `/register` in case of mistyped email

## Resend Verification Endpoint (New)

**POST `/api/auth/resend-verification`**

1. Accept `{ email }` in request body
2. Look up `PendingVerification` by email
3. If not found or expired — return generic success (prevent email enumeration)
4. If `lastResentAt` < 60 seconds ago — return 429
5. If `resendCount` >= 5 — return 429
6. Generate new token, update `expiresAt`, increment `resendCount`, set `lastResentAt`
7. Send verification email with new token
8. Return 200 with generic success
9. Protected by `publicLimiter` (10 req / 15 min per IP)

## Verify Email Page (New)

**`app/(auth)/verify-email/page.tsx`** (server component)

1. Read `token` from URL search params
2. Look up `PendingVerification` by token
3. If not found or expired — render error with link to `/register`
4. If valid — in a `prisma.$transaction()`:
   - Create `User` record (role: MEMBER, status: TRIAL, trialEndsAt: now + 14 days)
   - Delete the `PendingVerification` record
5. Render success: "Email verified!" with link to `/login`

## Login Page Changes

**`app/(auth)/login/page.tsx`**

When login fails, check if a `PendingVerification` exists for that email:
- If yes — show: "This email hasn't been verified yet" with a "Resend verification email" link
- If no — show existing generic error

## Verification Email Template

New function in `lib/email.ts`: `sendVerificationEmail(to, token)`

- Subject: "Verify your email — Wonder Woman Fitness"
- Accent color: purple (#7c3aed) — brand color
- Body: Short message + prominent "Verify Email" button → `{NEXTAUTH_URL}/verify-email?token={token}`
- Footer: "This link expires in 24 hours"
- Same dark-themed HTML template as existing notification emails

## Cleanup

### Lazy Cleanup
- Upsert in register endpoint replaces expired pending records for the same email automatically

### Cron Job (New)
**GET `app/api/cron/cleanup-pending/route.ts`**

- Secured with `CRON_SECRET` header
- Deletes all `PendingVerification` where `expiresAt < now()`
- Logs deleted count
- Returns `{ deleted: count }`
- Runs daily via Vercel Cron (e.g. 3 AM UTC)

## Security

- Tokens: 256-bit crypto-random, URL-safe base64
- All responses are generic — no email enumeration
- Password hashed before pending table storage
- Verification link is one-time use (pending record deleted on success)
- `publicLimiter` on register and resend endpoints
- Resend: 60-second cooldown + max 5 attempts per pending record

## What Does NOT Change

- Owner/trainer account creation (seed script / owner action)
- Login flow for existing users
- Notification system, payment logic, all other features
- Existing test suite (all 1,373 tests continue passing)

## New/Modified Files

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `PendingVerification` model |
| `lib/constants.ts` | Add verification constants |
| `lib/email.ts` | Add `sendVerificationEmail()` |
| `app/api/auth/register/route.ts` | Create pending record + email instead of user |
| `app/(auth)/register/page.tsx` | Redirect to check-email instead of auto-login |
| `app/(auth)/check-email/page.tsx` | New — resend button + cooldown |
| `app/(auth)/verify-email/page.tsx` | New — processes token, creates user |
| `app/(auth)/login/page.tsx` | Add unverified state with resend link |
| `app/api/auth/resend-verification/route.ts` | New — resend endpoint |
| `app/api/cron/cleanup-pending/route.ts` | New — daily expired record cleanup |
