# Email Verification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add email verification to member registration so accounts are only created after clicking a verification link, preventing database pollution from fake signups.

**Architecture:** Defer User creation until email is verified. A new `PendingVerification` table stores registration data temporarily. On registration, send a verification email via Resend. When the user clicks the link, create the real User record and delete the pending record. Expired records are cleaned up lazily on re-registration and daily via cron.

**Tech Stack:** Next.js 15 (App Router), Prisma 7, Resend, Zod, Vitest, Node `crypto` module

**Design doc:** `docs/plans/2026-02-19-email-verification-design.md`

---

### Task 1: Add PendingVerification Model to Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma` (after line 207, before the closing of the file)

**Step 1: Add the model to the schema**

Add at the end of `prisma/schema.prisma`:

```prisma
model PendingVerification {
  id           String    @id @default(cuid())
  email        String    @unique
  passwordHash String
  name         String
  phone        String?
  token        String    @unique
  expiresAt    DateTime
  resendCount  Int       @default(0)
  lastResentAt DateTime?
  createdAt    DateTime  @default(now())

  @@map("pending_verifications")
}
```

**Step 2: Generate Prisma client**

Run: `npx prisma generate`
Expected: "Generated Prisma Client" success message

**Step 3: Create migration**

Run: `npx prisma migrate dev --name add-pending-verification`
Expected: Migration created and applied successfully

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add PendingVerification model for email verification"
```

---

### Task 2: Add Verification Constants

**Files:**
- Modify: `lib/constants.ts` (after line 85, in the PASSWORD CONFIGURATION section)

**Step 1: Add constants**

Add after the `TEMP_PASSWORD_LENGTH` line (line 85) in `lib/constants.ts`:

```typescript
// ===== EMAIL VERIFICATION CONFIGURATION =====
export const VERIFICATION_TOKEN_BYTES = 32;
export const VERIFICATION_EXPIRY_HOURS = 24;
export const VERIFICATION_MAX_RESENDS = 5;
export const VERIFICATION_RESEND_COOLDOWN_MS = 60_000; // 60 seconds
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add lib/constants.ts
git commit -m "feat: add email verification constants"
```

---

### Task 3: Add Resend Verification Email Schema

**Files:**
- Modify: `types/index.ts` (after the `ResetPasswordSchema` block, around line 66)

**Step 1: Add the schema**

Add after line 66 in `types/index.ts`:

```typescript
export const ResendVerificationSchema = z.object({
  email: z.string().email('Invalid email address').max(MAX_EMAIL_LENGTH),
}).strict();

export type ResendVerificationInput = z.infer<typeof ResendVerificationSchema>;
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add types/index.ts
git commit -m "feat: add ResendVerificationSchema for email verification"
```

---

### Task 4: Add sendVerificationEmail Function

**Files:**
- Modify: `lib/email.ts` (add new function after `sendNotificationEmail`, around line 60)

**Step 1: Write the failing test**

Create `lib/__tests__/email-verification.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Resend before importing
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ id: 'test-id' }),
    },
  })),
}));

describe('sendVerificationEmail', () => {
  beforeEach(() => {
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    vi.stubEnv('NEXTAUTH_URL', 'http://localhost:3000');
  });

  it('sends email with verification link containing the token', async () => {
    // Dynamic import to pick up mocked env
    const { sendVerificationEmail } = await import('../email');
    const result = await sendVerificationEmail('test@example.com', 'abc123token');
    expect(result).toBe(true);
  });

  it('returns false when RESEND_API_KEY is not configured', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    // Force re-import with new env
    vi.resetModules();
    const { sendVerificationEmail } = await import('../email');
    const result = await sendVerificationEmail('test@example.com', 'abc123token');
    expect(result).toBe(false);
  });

  it('returns false when email send throws', async () => {
    vi.resetModules();
    vi.mock('resend', () => ({
      Resend: vi.fn().mockImplementation(() => ({
        emails: {
          send: vi.fn().mockRejectedValue(new Error('Send failed')),
        },
      })),
    }));
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    const { sendVerificationEmail } = await import('../email');
    const result = await sendVerificationEmail('test@example.com', 'token');
    expect(result).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- lib/__tests__/email-verification.test.ts`
Expected: FAIL — `sendVerificationEmail` is not exported

**Step 3: Write the implementation**

Add to `lib/email.ts` after the `sendNotificationEmail` function (after line 60):

```typescript
/**
 * Send a verification email to a new registrant.
 *
 * @param to - Recipient email address
 * @param token - Verification token (URL-safe base64)
 * @returns true if email was sent successfully, false otherwise
 */
export async function sendVerificationEmail(
  to: string,
  token: string
): Promise<boolean> {
  try {
    const client = getResendClient();
    if (!client) {
      return false;
    }

    const verifyUrl = `${process.env.NEXTAUTH_URL}/verify-email?token=${token}`;
    const html = buildVerificationEmailHtml(verifyUrl);

    await client.emails.send({
      from: EMAIL_FROM,
      to,
      subject: 'Verify your email — Wonder Woman Fitness',
      html,
    });

    return true;
  } catch (error) {
    console.error(`Failed to send verification email to ${to}:`, error);
    return false;
  }
}
```

Then add the HTML builder function (before `escapeHtml`, around line 150):

```typescript
/**
 * Build HTML for verification email with a prominent "Verify Email" button.
 */
function buildVerificationEmailHtml(verifyUrl: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your email</title>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#1e293b;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background-color:#7c3aed;padding:24px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">
                &#128170; Wonder Woman Fitness
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 16px;color:#f1f5f9;font-size:18px;font-weight:600;">
                Verify your email address
              </h2>
              <p style="margin:0 0 24px;color:#cbd5e1;font-size:15px;line-height:1.6;">
                Thanks for signing up! Click the button below to verify your email and activate your account.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:8px;background-color:#7c3aed;">
                    <a href="${escapeHtml(verifyUrl)}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;">
                      Verify Email
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;color:#94a3b8;font-size:13px;line-height:1.5;">
                This link expires in 24 hours. If you didn&apos;t create an account, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px 24px;border-top:1px solid #334155;">
              <p style="margin:0;color:#64748b;font-size:12px;">
                This is an automated message from Wonder Woman Fitness.
                Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- lib/__tests__/email-verification.test.ts`
Expected: PASS (all 3 tests)

**Step 5: Commit**

```bash
git add lib/email.ts lib/__tests__/email-verification.test.ts
git commit -m "feat: add sendVerificationEmail function with tests"
```

---

### Task 5: Modify Register API Route (Defer User Creation)

**Files:**
- Modify: `app/api/auth/register/route.ts` (replace lines 1-74 entirely)
- Test: `lib/__tests__/register-verification.test.ts` (new)

**Step 1: Write the failing tests**

Create `lib/__tests__/register-verification.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
  },
  pendingVerification: {
    upsert: vi.fn(),
  },
};

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/email', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(true),
}));
vi.mock('@/lib/rate-limit', () => ({
  publicLimiter: { check: vi.fn().mockReturnValue({ allowed: true, remaining: 9, retryAfterMs: 0 }) },
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  createRateLimitResponse: vi.fn(),
}));
vi.mock('bcrypt', () => ({
  default: { hash: vi.fn().mockResolvedValue('hashed-password') },
}));

describe('POST /api/auth/register (with verification)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXTAUTH_URL', 'http://localhost:3000');
  });

  it('creates a PendingVerification record instead of a User', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.pendingVerification.upsert.mockResolvedValue({
      id: 'pv-1',
      email: 'test@example.com',
      token: 'test-token',
    });

    const { POST } = await import('@/app/api/auth/register/route');
    const req = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password1!',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.message).toContain('Verification email sent');
    expect(mockPrisma.pendingVerification.upsert).toHaveBeenCalled();
  });

  it('returns 400 when email already exists in User table', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

    const { POST } = await import('@/app/api/auth/register/route');
    const req = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User',
        email: 'existing@example.com',
        password: 'Password1!',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockPrisma.pendingVerification.upsert).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid input', async () => {
    const { POST } = await import('@/app/api/auth/register/route');
    const req = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '',
        email: 'not-an-email',
        password: 'short',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- lib/__tests__/register-verification.test.ts`
Expected: FAIL — current register route creates User, not PendingVerification

**Step 3: Rewrite the register route**

Replace the entire content of `app/api/auth/register/route.ts`:

```typescript
import crypto from "crypto";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { addHours } from "date-fns";
import { RegisterSchema } from "@/types";
import { BCRYPT_ROUNDS, VERIFICATION_TOKEN_BYTES, VERIFICATION_EXPIRY_HOURS } from "@/lib/constants";
import { publicLimiter, getClientIp, createRateLimitResponse } from "@/lib/rate-limit";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(req: Request): Promise<Response> {
  try {
    // Rate limit: 10 requests per 15 min per IP
    const ip = getClientIp(req);
    const rateCheck = publicLimiter.check(`register:${ip}`);
    if (!rateCheck.allowed) return createRateLimitResponse(rateCheck.retryAfterMs);

    const body: unknown = await req.json();
    const parsed = RegisterSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, phone, email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    // Hash password first to ensure constant-time response regardless of
    // whether the email exists (prevents timing-based email enumeration)
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Check if email already exists as a confirmed User
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingUser) {
      return Response.json(
        { error: "Registration failed. Please try again or contact support." },
        { status: 400 }
      );
    }

    // Generate verification token
    const token = crypto.randomBytes(VERIFICATION_TOKEN_BYTES).toString("base64url");
    const expiresAt = addHours(new Date(), VERIFICATION_EXPIRY_HOURS);

    // Upsert: replaces any existing pending record for this email (lazy cleanup)
    await prisma.pendingVerification.upsert({
      where: { email: normalizedEmail },
      update: {
        passwordHash,
        name,
        phone: phone || null,
        token,
        expiresAt,
        resendCount: 0,
        lastResentAt: null,
      },
      create: {
        email: normalizedEmail,
        passwordHash,
        name,
        phone: phone || null,
        token,
        expiresAt,
      },
    });

    // Send verification email (fire-and-forget — don't block registration on email failure)
    await sendVerificationEmail(normalizedEmail, token);

    return Response.json(
      { message: "Verification email sent. Please check your inbox." },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- lib/__tests__/register-verification.test.ts`
Expected: PASS (all 3 tests)

**Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add app/api/auth/register/route.ts lib/__tests__/register-verification.test.ts
git commit -m "feat: change register route to create PendingVerification instead of User"
```

---

### Task 6: Add Resend Verification API Route

**Files:**
- Create: `app/api/auth/resend-verification/route.ts`
- Test: `lib/__tests__/resend-verification.test.ts` (new)

**Step 1: Write the failing tests**

Create `lib/__tests__/resend-verification.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = {
  pendingVerification: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/email', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(true),
}));
vi.mock('@/lib/rate-limit', () => ({
  publicLimiter: { check: vi.fn().mockReturnValue({ allowed: true, remaining: 9, retryAfterMs: 0 }) },
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  createRateLimitResponse: vi.fn(),
}));

describe('POST /api/auth/resend-verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXTAUTH_URL', 'http://localhost:3000');
  });

  it('resends verification email for valid pending record', async () => {
    const futureDate = new Date(Date.now() + 86400000); // +24h
    mockPrisma.pendingVerification.findUnique.mockResolvedValue({
      id: 'pv-1',
      email: 'test@example.com',
      token: 'old-token',
      expiresAt: futureDate,
      resendCount: 0,
      lastResentAt: null,
    });
    mockPrisma.pendingVerification.update.mockResolvedValue({
      id: 'pv-1',
      token: 'new-token',
    });

    const { POST } = await import('@/app/api/auth/resend-verification/route');
    const req = new Request('http://localhost:3000/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockPrisma.pendingVerification.update).toHaveBeenCalled();
  });

  it('returns generic 200 when no pending record exists (no enumeration)', async () => {
    mockPrisma.pendingVerification.findUnique.mockResolvedValue(null);

    const { POST } = await import('@/app/api/auth/resend-verification/route');
    const req = new Request('http://localhost:3000/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent@example.com' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockPrisma.pendingVerification.update).not.toHaveBeenCalled();
  });

  it('returns 429 when cooldown has not elapsed', async () => {
    const futureDate = new Date(Date.now() + 86400000);
    const recentResent = new Date(Date.now() - 10000); // 10 seconds ago
    mockPrisma.pendingVerification.findUnique.mockResolvedValue({
      id: 'pv-1',
      email: 'test@example.com',
      expiresAt: futureDate,
      resendCount: 1,
      lastResentAt: recentResent,
    });

    const { POST } = await import('@/app/api/auth/resend-verification/route');
    const req = new Request('http://localhost:3000/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  it('returns 429 when max resends reached', async () => {
    const futureDate = new Date(Date.now() + 86400000);
    mockPrisma.pendingVerification.findUnique.mockResolvedValue({
      id: 'pv-1',
      email: 'test@example.com',
      expiresAt: futureDate,
      resendCount: 5,
      lastResentAt: new Date(Date.now() - 120000), // 2 min ago
    });

    const { POST } = await import('@/app/api/auth/resend-verification/route');
    const req = new Request('http://localhost:3000/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  it('returns 400 for invalid email format', async () => {
    const { POST } = await import('@/app/api/auth/resend-verification/route');
    const req = new Request('http://localhost:3000/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-valid' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- lib/__tests__/resend-verification.test.ts`
Expected: FAIL — route does not exist yet

**Step 3: Write the implementation**

Create `app/api/auth/resend-verification/route.ts`:

```typescript
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { addHours } from "date-fns";
import { ResendVerificationSchema } from "@/types";
import {
  VERIFICATION_TOKEN_BYTES,
  VERIFICATION_EXPIRY_HOURS,
  VERIFICATION_MAX_RESENDS,
  VERIFICATION_RESEND_COOLDOWN_MS,
} from "@/lib/constants";
import { publicLimiter, getClientIp, createRateLimitResponse } from "@/lib/rate-limit";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(req: Request): Promise<Response> {
  try {
    // Rate limit: 10 requests per 15 min per IP
    const ip = getClientIp(req);
    const rateCheck = publicLimiter.check(`resend-verify:${ip}`);
    if (!rateCheck.allowed) return createRateLimitResponse(rateCheck.retryAfterMs);

    const body: unknown = await req.json();
    const parsed = ResendVerificationSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const normalizedEmail = parsed.data.email.toLowerCase();

    // Look up pending record
    const pending = await prisma.pendingVerification.findUnique({
      where: { email: normalizedEmail },
    });

    // If not found or expired, return generic success (prevent email enumeration)
    if (!pending || pending.expiresAt < new Date()) {
      return Response.json({ message: "If an account is pending verification, a new email has been sent." });
    }

    // Check cooldown (60 seconds between resends)
    if (pending.lastResentAt) {
      const elapsed = Date.now() - pending.lastResentAt.getTime();
      if (elapsed < VERIFICATION_RESEND_COOLDOWN_MS) {
        return Response.json(
          { error: "Please wait before requesting another email." },
          { status: 429 }
        );
      }
    }

    // Check max resend limit
    if (pending.resendCount >= VERIFICATION_MAX_RESENDS) {
      return Response.json(
        { error: "Maximum resend attempts reached. Please register again." },
        { status: 429 }
      );
    }

    // Generate new token, extend expiry, increment count
    const newToken = crypto.randomBytes(VERIFICATION_TOKEN_BYTES).toString("base64url");
    const newExpiry = addHours(new Date(), VERIFICATION_EXPIRY_HOURS);

    await prisma.pendingVerification.update({
      where: { id: pending.id },
      data: {
        token: newToken,
        expiresAt: newExpiry,
        resendCount: pending.resendCount + 1,
        lastResentAt: new Date(),
      },
    });

    // Send verification email
    await sendVerificationEmail(normalizedEmail, newToken);

    return Response.json({ message: "If an account is pending verification, a new email has been sent." });
  } catch (error) {
    console.error("Resend verification error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- lib/__tests__/resend-verification.test.ts`
Expected: PASS (all 5 tests)

**Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add app/api/auth/resend-verification/route.ts lib/__tests__/resend-verification.test.ts
git commit -m "feat: add resend-verification API route with cooldown and max attempts"
```

---

### Task 7: Add Verify Email Page (Server Component)

**Files:**
- Create: `app/(auth)/verify-email/page.tsx`

**Step 1: Write the failing test**

Create `lib/__tests__/verify-email-page.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = {
  pendingVerification: {
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
  user: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

describe('verifyEmailToken (logic)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates user and deletes pending record for valid token', async () => {
    const futureDate = new Date(Date.now() + 86400000);
    const pendingRecord = {
      id: 'pv-1',
      email: 'test@example.com',
      passwordHash: 'hashed',
      name: 'Test User',
      phone: '+38970123456',
      token: 'valid-token',
      expiresAt: futureDate,
      resendCount: 0,
      lastResentAt: null,
      createdAt: new Date(),
    };

    mockPrisma.pendingVerification.findUnique.mockResolvedValue(pendingRecord);
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
      return fn(mockPrisma);
    });
    mockPrisma.user.create.mockResolvedValue({ id: 'user-1', email: 'test@example.com' });
    mockPrisma.pendingVerification.delete.mockResolvedValue(pendingRecord);

    const { verifyEmailToken } = await import('@/app/(auth)/verify-email/actions');
    const result = await verifyEmailToken('valid-token');

    expect(result.success).toBe(true);
    expect(mockPrisma.user.create).toHaveBeenCalled();
    expect(mockPrisma.pendingVerification.delete).toHaveBeenCalled();
  });

  it('returns error for expired token', async () => {
    const pastDate = new Date(Date.now() - 86400000);
    mockPrisma.pendingVerification.findUnique.mockResolvedValue({
      id: 'pv-1',
      token: 'expired-token',
      expiresAt: pastDate,
    });

    const { verifyEmailToken } = await import('@/app/(auth)/verify-email/actions');
    const result = await verifyEmailToken('expired-token');

    expect(result.success).toBe(false);
    expect(result.error).toContain('expired');
  });

  it('returns error for unknown token', async () => {
    mockPrisma.pendingVerification.findUnique.mockResolvedValue(null);

    const { verifyEmailToken } = await import('@/app/(auth)/verify-email/actions');
    const result = await verifyEmailToken('unknown-token');

    expect(result.success).toBe(false);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- lib/__tests__/verify-email-page.test.ts`
Expected: FAIL — module does not exist

**Step 3: Write the verification logic**

Create `app/(auth)/verify-email/actions.ts`:

```typescript
"use server";

import { prisma } from "@/lib/prisma";
import { addDays } from "date-fns";
import { TRIAL_DAYS } from "@/lib/constants";

interface VerifyResult {
  success: boolean;
  error?: string;
}

export async function verifyEmailToken(token: string): Promise<VerifyResult> {
  try {
    const pending = await prisma.pendingVerification.findUnique({
      where: { token },
    });

    if (!pending) {
      return { success: false, error: "Invalid or expired verification link." };
    }

    if (pending.expiresAt < new Date()) {
      return { success: false, error: "This verification link has expired. Please register again." };
    }

    // Create user and delete pending record in a transaction
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          email: pending.email,
          passwordHash: pending.passwordHash,
          name: pending.name,
          phone: pending.phone,
          role: "MEMBER",
          status: "TRIAL",
          joinDate: now,
          trialEndsAt: addDays(now, TRIAL_DAYS),
        },
      });

      await tx.pendingVerification.delete({
        where: { id: pending.id },
      });
    });

    return { success: true };
  } catch (error) {
    console.error("Email verification error:", error);
    return { success: false, error: "Verification failed. Please try again." };
  }
}
```

**Step 4: Write the page component**

Create `app/(auth)/verify-email/page.tsx`:

```typescript
import Link from "next/link";
import { verifyEmailToken } from "./actions";

interface VerifyEmailPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="text-center">
        <h2 className="mb-4 text-xl font-semibold text-error-400">
          Invalid Link
        </h2>
        <p className="mb-6 text-surface-400">
          No verification token provided.
        </p>
        <Link
          href="/register"
          className="text-primary-400 hover:text-primary-300"
        >
          Back to Register
        </Link>
      </div>
    );
  }

  const result = await verifyEmailToken(token);

  if (!result.success) {
    return (
      <div className="text-center">
        <h2 className="mb-4 text-xl font-semibold text-error-400">
          Verification Failed
        </h2>
        <p className="mb-6 text-surface-400">
          {result.error}
        </p>
        <Link
          href="/register"
          className="text-primary-400 hover:text-primary-300"
        >
          Register Again
        </Link>
      </div>
    );
  }

  return (
    <div className="text-center">
      <h2 className="mb-4 text-xl font-semibold text-success-400">
        Email Verified!
      </h2>
      <p className="mb-6 text-surface-400">
        Your account has been created successfully. You can now sign in.
      </p>
      <Link
        href="/login"
        className="inline-block rounded-lg bg-primary-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-primary-700"
      >
        Sign In
      </Link>
    </div>
  );
}
```

**Step 5: Run tests to verify they pass**

Run: `npm test -- lib/__tests__/verify-email-page.test.ts`
Expected: PASS (all 3 tests)

**Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 7: Commit**

```bash
git add app/(auth)/verify-email/
git commit -m "feat: add verify-email page with token validation and user creation"
```

---

### Task 8: Add Check Email Page

**Files:**
- Create: `app/(auth)/check-email/page.tsx`

**Step 1: Write the page component**

Create `app/(auth)/check-email/page.tsx`:

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { VERIFICATION_RESEND_COOLDOWN_MS } from "@/lib/constants";

const COOLDOWN_SECONDS = VERIFICATION_RESEND_COOLDOWN_MS / 1000;

export default function CheckEmailPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const [cooldown, setCooldown] = useState(0);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleResend = useCallback(async () => {
    if (cooldown > 0 || status === "sending") return;

    setStatus("sending");
    setErrorMessage("");

    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.status === 429) {
        const data = await res.json();
        setErrorMessage(data.error || "Please wait before resending.");
        setStatus("error");
        return;
      }

      setStatus("sent");
      setCooldown(COOLDOWN_SECONDS);
    } catch {
      setErrorMessage("Failed to resend. Please try again.");
      setStatus("error");
    }
  }, [email, cooldown, status]);

  return (
    <div className="text-center">
      <h2 className="mb-4 text-xl font-semibold text-surface-100">
        Check Your Email
      </h2>

      <p className="mb-6 text-surface-400">
        We sent a verification link to{" "}
        <span className="font-medium text-surface-200">{email || "your email"}</span>.
        Click the link to activate your account.
      </p>

      {errorMessage && (
        <div className="mb-4 rounded-lg bg-error-50 p-3 text-sm text-error-700">
          {errorMessage}
        </div>
      )}

      {status === "sent" && (
        <div className="mb-4 rounded-lg bg-success-50 p-3 text-sm text-success-700">
          Verification email resent!
        </div>
      )}

      <button
        onClick={handleResend}
        disabled={cooldown > 0 || status === "sending"}
        className="mb-4 w-full rounded-lg bg-primary-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === "sending"
          ? "Sending..."
          : cooldown > 0
            ? `Resend in ${cooldown}s`
            : "Resend Verification Email"}
      </button>

      <p className="text-sm text-surface-500">
        Wrong email?{" "}
        <Link href="/register" className="text-primary-400 hover:text-primary-300">
          Register again
        </Link>
      </p>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add app/(auth)/check-email/page.tsx
git commit -m "feat: add check-email page with resend button and cooldown timer"
```

---

### Task 9: Update Register Page (Redirect to Check Email)

**Files:**
- Modify: `app/(auth)/register/page.tsx` (lines 57-95, the handleSubmit success path)

**Step 1: Update the handleSubmit function**

In `app/(auth)/register/page.tsx`, replace the success path inside `handleSubmit` (lines 69-95). Remove the `signIn` import and the auto-login logic. The new success path should redirect to the check-email page:

Remove `import { signIn } from "next-auth/react";` from line 4.

Replace lines 69-95 (from `const data = await res.json();` onward inside the try block) with:

```typescript
      const data = await res.json();

      if (!res.ok) {
        setServerError(typeof data.error === 'string' ? data.error : "Registration failed");
        setLoading(false);
        return;
      }

      // Redirect to check-email page
      router.push(`/check-email?email=${encodeURIComponent(formData.email.trim().toLowerCase())}`);
```

Also update the button text on line 237 from `"Creating account..."` to `"Creating account..."` (keep same) and from `"Create Account"` to `"Create Account"` (keep same — no change needed here).

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add app/(auth)/register/page.tsx
git commit -m "feat: update register page to redirect to check-email instead of auto-login"
```

---

### Task 10: Update Login Page (Unverified State)

**Files:**
- Modify: `app/(auth)/login/page.tsx` (add pending verification check on login failure)

**Step 1: Update login to check for pending verification**

In `app/(auth)/login/page.tsx`, update the `handleSubmit` function's error handling (around line 27). After `if (result?.error)`, add a fetch to check if the email has a pending verification:

Replace lines 27-30 with:

```typescript
      if (result?.error) {
        // Check if this email is pending verification
        try {
          const checkRes = await fetch("/api/auth/resend-verification", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
          });
          // If 429 with cooldown/max-resends, or 200, it means pending exists
          // But we can't distinguish from "not found" (also 200) to prevent enumeration
          // So just show the generic message with a link
        } catch {
          // Ignore — we'll show the generic error below
        }

        setError("Invalid email or password. If you recently registered, check your email for a verification link.");
        setLoading(false);
        return;
      }
```

Actually, this approach is problematic — it would fire a resend on every failed login. A better approach is to simply update the error message to mention verification, and add a visible link:

Replace lines 27-30 with:

```typescript
      if (result?.error) {
        setError("Invalid email or password");
        setShowVerificationHint(true);
        setLoading(false);
        return;
      }
```

Add a new state variable after line 13:

```typescript
const [showVerificationHint, setShowVerificationHint] = useState(false);
```

Add below the error div (after line 63, inside the return):

```typescript
      {showVerificationHint && (
        <div className="mb-4 rounded-lg bg-surface-800 p-3 text-sm text-surface-400">
          Recently registered?{" "}
          <Link
            href={`/check-email?email=${encodeURIComponent(email)}`}
            className="text-primary-400 hover:text-primary-300"
          >
            Resend verification email
          </Link>
        </div>
      )}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add app/(auth)/login/page.tsx
git commit -m "feat: add verification hint link on login page after failed login"
```

---

### Task 11: Add Cleanup Cron Job

**Files:**
- Create: `app/api/cron/cleanup-pending/route.ts`
- Modify: `vercel.json` (add cron schedule)

**Step 1: Write the failing test**

Create `lib/__tests__/cleanup-pending.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = {
  pendingVerification: {
    deleteMany: vi.fn(),
  },
};

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/cron-auth', () => ({
  verifyCronSecret: vi.fn().mockReturnValue(true),
}));
vi.mock('@/lib/rate-limit', () => ({
  cronLimiter: { check: vi.fn().mockReturnValue({ allowed: true, remaining: 4, retryAfterMs: 0 }) },
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  createRateLimitResponse: vi.fn(),
}));

describe('GET /api/cron/cleanup-pending', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes expired pending verifications', async () => {
    mockPrisma.pendingVerification.deleteMany.mockResolvedValue({ count: 3 });

    const { GET } = await import('@/app/api/cron/cleanup-pending/route');
    const req = new Request('http://localhost:3000/api/cron/cleanup-pending', {
      headers: { authorization: 'Bearer test-secret' },
    });

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.deleted).toBe(3);
    expect(mockPrisma.pendingVerification.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: expect.any(Date) } },
    });
  });

  it('returns 401 with invalid cron secret', async () => {
    const { verifyCronSecret } = await import('@/lib/cron-auth');
    vi.mocked(verifyCronSecret).mockReturnValue(false);

    const { GET } = await import('@/app/api/cron/cleanup-pending/route');
    const req = new Request('http://localhost:3000/api/cron/cleanup-pending', {
      headers: { authorization: 'Bearer wrong' },
    });

    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- lib/__tests__/cleanup-pending.test.ts`
Expected: FAIL — route does not exist

**Step 3: Write the cron route**

Create `app/api/cron/cleanup-pending/route.ts`:

```typescript
/**
 * Cleanup Pending Verifications Cron — Daily at 3 AM UTC
 *
 * GET /api/cron/cleanup-pending
 * Secured with CRON_SECRET header.
 *
 * Deletes all PendingVerification records whose expiresAt has passed.
 */

import { prisma } from "@/lib/prisma";
import { verifyCronSecret } from "@/lib/cron-auth";
import { cronLimiter, getClientIp, createRateLimitResponse } from "@/lib/rate-limit";

export async function GET(req: Request): Promise<Response> {
  // Rate limit: 5 requests per minute per IP
  const ip = getClientIp(req);
  const cronRateCheck = cronLimiter.check(`cron:${ip}`);
  if (!cronRateCheck.allowed) return createRateLimitResponse(cronRateCheck.retryAfterMs);

  // Verify cron secret (timing-safe)
  if (!verifyCronSecret(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await prisma.pendingVerification.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    console.log(`Cleanup: deleted ${result.count} expired pending verifications`);

    return Response.json({
      data: {
        message: "Cleanup complete",
        deleted: result.count,
      },
    });
  } catch (error) {
    console.error("Cron cleanup-pending error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

**Step 4: Add cron schedule to vercel.json**

Add to the `crons` array in `vercel.json`:

```json
{
  "path": "/api/cron/cleanup-pending",
  "schedule": "0 3 * * *"
}
```

**Step 5: Run tests to verify they pass**

Run: `npm test -- lib/__tests__/cleanup-pending.test.ts`
Expected: PASS (all 2 tests)

**Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 7: Commit**

```bash
git add app/api/cron/cleanup-pending/route.ts vercel.json lib/__tests__/cleanup-pending.test.ts
git commit -m "feat: add daily cron job to clean up expired pending verifications"
```

---

### Task 12: Run Full Test Suite and Fix Any Breakage

**Step 1: Run the full test suite**

Run: `npm test`
Expected: All tests pass. Some existing register tests may break because the register route now returns a different response shape. Fix those tests to match the new behavior.

**Step 2: Fix broken existing tests**

The existing test file `lib/__tests__/sessions.test.ts` or similar may mock the register route. Check `lib/__tests__/` for any test files that test registration and update them to expect `{ message: "Verification email sent..." }` instead of `{ data: { id, email, ... } }`.

Run: `npm test` again after fixes.
Expected: All tests pass

**Step 3: Run linter**

Run: `npm run lint`
Expected: Only the 5 pre-existing warnings

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit any test fixes**

```bash
git add -A
git commit -m "fix: update existing tests for new registration verification flow"
```

---

### Task 13: Update Design Doc with Final Status

**Files:**
- Modify: `docs/plans/2026-02-19-email-verification-design.md` (change status to Implemented)

**Step 1: Update the status**

Change the status line from `> Status: Approved` to `> Status: Implemented`

**Step 2: Commit**

```bash
git add docs/plans/2026-02-19-email-verification-design.md
git commit -m "docs: mark email verification design as implemented"
```
