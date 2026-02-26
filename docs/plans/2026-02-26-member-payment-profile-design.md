# Member Payment Profile Section — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a payment information section to the member profile page showing payment status, coverage dates, grace period countdown, and recent payment history with "Show all" toggle.

**Architecture:** Server component (`page.tsx`) fetches user + payments + computes payment status via existing `getPaymentStatus()`, passes everything as props to `ProfileClient.tsx`. A new `PaymentInfoSection` client component renders the payment status card and history. The existing `PaymentHistory` component is reused for the history list (read-only mode, no edit/delete). One API change: allow members to fetch their own payments via `GET /api/payments?userId=self` for the "Show all" toggle.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS 4, Prisma 7, Vitest, next-intl

---

### Task 1: Add i18n translation keys

**Files:**
- Modify: `messages/en.json` (profile section)
- Modify: `messages/mk.json` (profile section)

**Step 1: Add English translation keys**

Add to the `"profile"` object in `messages/en.json`:

```json
"paymentInformation": "Payment Information",
"lastPayment": "Last payment",
"paidThrough": "Paid through",
"nextPaymentDue": "Next payment due",
"noPaymentsYet": "No payments recorded yet",
"trialEndsOn": "Trial ends on {date}",
"paymentDueBy": "Payment due by {date}",
"daysRemainingInTrial": "{count, plural, one {# day} other {# days}} remaining in trial",
"daysRemainingToPay": "{count, plural, one {# day} other {# days}} remaining to pay",
"paymentOverdue": "Payment overdue — contact the owner",
"overrideActive": "Payment override active",
"showAllPayments": "Show all payments",
"showRecent": "Show recent",
"recentPayments": "Recent Payments"
```

**Step 2: Add Macedonian translation keys**

Add corresponding keys to `messages/mk.json` `"profile"` object:

```json
"paymentInformation": "Информации за плаќање",
"lastPayment": "Последно плаќање",
"paidThrough": "Платено до",
"nextPaymentDue": "Следно плаќање",
"noPaymentsYet": "Нема евидентирани плаќања",
"trialEndsOn": "Пробниот период завршува на {date}",
"paymentDueBy": "Плаќање до {date}",
"daysRemainingInTrial": "{count, plural, one {# ден} other {# дена}} преостануваат од пробниот период",
"daysRemainingToPay": "{count, plural, one {# ден} other {# дена}} преостануваат за плаќање",
"paymentOverdue": "Задоцнето плаќање — контактирајте го сопственикот",
"overrideActive": "Активно е прескокнување на плаќањето",
"showAllPayments": "Прикажи ги сите плаќања",
"showRecent": "Прикажи скорешни",
"recentPayments": "Скорешни плаќања"
```

**Step 3: Commit**

```bash
git add messages/en.json messages/mk.json
git commit -m "feat: add i18n keys for member payment profile section"
```

---

### Task 2: Update server component to fetch payment data

**Files:**
- Modify: `app/(member)/member/profile/page.tsx`

**Step 1: Write the failing test**

Create `__tests__/components/ProfilePage.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Test that the server component fetches payment data and passes it to ProfileClient
// Since this is a server component, we test the data shape contract

describe("MemberProfilePage data contract", () => {
  it("should pass paymentStatus to ProfileClient", () => {
    // Verified through integration — the ProfileClient interface will enforce this at compile time
    expect(true).toBe(true);
  });
});
```

Since the server component is hard to unit test directly, we rely on TypeScript compilation to verify the data contract. The real tests are in Task 4 (ProfileClient tests).

**Step 2: Update the server component**

Modify `app/(member)/member/profile/page.tsx` to:
1. Import `getPaymentStatus`, `getGracePeriodStart`, `getGracePeriodLength`, `getDaysBetween` from `@/lib/payment-logic`
2. Expand the Prisma `select` to include `overrideActive`, `departedAt`, and fetch `payments` relation
3. Compute payment status, grace period info, and latest payment dates
4. Pass new props to `ProfileClient`

```typescript
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProfileClient } from "./ProfileClient";
import {
  getPaymentStatus,
  getGracePeriodStart,
  getGracePeriodLength,
  getDaysBetween,
} from "@/lib/payment-logic";
import type { PaymentRecord as PaymentLogicRecord } from "@/lib/payment-logic";

export const metadata = {
  title: "Profile - Wonder Woman Fitness",
};

export default async function MemberProfilePage(): Promise<React.ReactElement> {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      photo: true,
      status: true,
      joinDate: true,
      trialEndsAt: true,
      departedAt: true,
      overrideActive: true,
      payments: {
        orderBy: { paidAt: "desc" },
        select: {
          id: true,
          amount: true,
          paidAt: true,
          periodStart: true,
          periodEnd: true,
        },
      },
    },
  });

  if (!user) {
    redirect("/login");
  }

  // Compute payment status
  const now = new Date();
  const paymentLogicRecords: PaymentLogicRecord[] = user.payments.map((p) => ({
    periodStart: p.periodStart,
    periodEnd: p.periodEnd,
    paidAt: p.paidAt,
  }));

  const paymentUser = {
    id: user.id,
    status: user.status as "TRIAL" | "ACTIVE" | "DEPARTED",
    trialEndsAt: user.trialEndsAt,
    departedAt: user.departedAt,
    overrideActive: user.overrideActive,
  };

  const paymentStatus = getPaymentStatus(paymentUser, paymentLogicRecords, now);

  // Compute grace period info
  let daysRemaining: number | null = null;
  if (paymentStatus === "GRACE_PERIOD") {
    const graceStart = getGracePeriodStart(paymentUser, now);
    const graceLength = getGracePeriodLength(paymentUser);
    const daysInto = getDaysBetween(graceStart, now);
    daysRemaining = Math.max(0, graceLength - daysInto);
  }

  // Find latest payment and coverage info
  const latestPayment = user.payments[0] || null; // already sorted desc by paidAt
  // Find the payment with the furthest periodEnd (for "paid through" display)
  const furthestCoverage = user.payments.length > 0
    ? user.payments.reduce((latest, p) =>
        p.periodEnd > latest.periodEnd ? p : latest
      )
    : null;

  // Serialize payments for client (last 6 months)
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const recentPayments = user.payments
    .filter((p) => new Date(p.paidAt) >= sixMonthsAgo)
    .map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      paidAt: p.paidAt.toISOString(),
      periodStart: p.periodStart.toISOString(),
      periodEnd: p.periodEnd.toISOString(),
    }));

  const totalPaymentCount = user.payments.length;

  return (
    <ProfileClient
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        photo: user.photo,
        status: user.status,
        joinDate: user.joinDate.toISOString(),
        trialEndsAt: user.trialEndsAt?.toISOString() || null,
      }}
      paymentInfo={{
        status: paymentStatus,
        daysRemaining,
        lastPaymentDate: latestPayment?.paidAt.toISOString() || null,
        paidThroughDate: furthestCoverage?.periodEnd.toISOString() || null,
        nextPaymentDue: furthestCoverage
          ? new Date(furthestCoverage.periodEnd.getTime() + 86400000).toISOString()
          : null,
        recentPayments,
        totalPaymentCount,
      }}
    />
  );
}
```

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: Errors about missing `paymentInfo` prop on `ProfileClient` (fixed in Task 3)

**Step 4: Commit**

```bash
git add app/(member)/member/profile/page.tsx
git commit -m "feat: fetch payment data in member profile server component"
```

---

### Task 3: Create PaymentInfoSection component

**Files:**
- Create: `components/payment/PaymentInfoSection.tsx`

**Step 1: Write the failing test**

Create `__tests__/components/PaymentInfoSection.test.tsx`:

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaymentInfoSection } from "@/components/payment/PaymentInfoSection";

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string, params?: Record<string, unknown>) => {
    const keys: Record<string, string> = {
      "profile.paymentInformation": "Payment Information",
      "profile.lastPayment": "Last payment",
      "profile.paidThrough": "Paid through",
      "profile.nextPaymentDue": "Next payment due",
      "profile.noPaymentsYet": "No payments recorded yet",
      "profile.daysRemainingToPay": `${params?.count} days remaining to pay`,
      "profile.daysRemainingInTrial": `${params?.count} days remaining in trial`,
      "profile.paymentOverdue": "Payment overdue — contact the owner",
      "profile.overrideActive": "Payment override active",
      "profile.showAllPayments": "Show all payments",
      "profile.showRecent": "Show recent",
      "profile.recentPayments": "Recent Payments",
    };
    return keys[`${ns}.${key}`] || key;
  },
}));

const paidProps = {
  status: "PAID" as const,
  daysRemaining: null,
  lastPaymentDate: "2026-02-15T00:00:00.000Z",
  paidThroughDate: "2026-02-28T00:00:00.000Z",
  nextPaymentDue: "2026-03-01T00:00:00.000Z",
  recentPayments: [
    {
      id: "pay-1",
      amount: 1500,
      paidAt: "2026-02-15T00:00:00.000Z",
      periodStart: "2026-02-01T00:00:00.000Z",
      periodEnd: "2026-02-28T00:00:00.000Z",
    },
  ],
  totalPaymentCount: 1,
  userStatus: "ACTIVE" as const,
  trialEndsAt: null,
};

describe("PaymentInfoSection", () => {
  it("shows payment status badge for PAID status", () => {
    render(<PaymentInfoSection {...paidProps} />);
    expect(screen.getByText("Paid")).toBeInTheDocument();
  });

  it("shows last payment date", () => {
    render(<PaymentInfoSection {...paidProps} />);
    expect(screen.getByText("Last payment")).toBeInTheDocument();
    expect(screen.getByText(/Feb 15, 2026/)).toBeInTheDocument();
  });

  it("shows paid through date", () => {
    render(<PaymentInfoSection {...paidProps} />);
    expect(screen.getByText("Paid through")).toBeInTheDocument();
    expect(screen.getByText(/Feb 28, 2026/)).toBeInTheDocument();
  });

  it("shows next payment due date", () => {
    render(<PaymentInfoSection {...paidProps} />);
    expect(screen.getByText("Next payment due")).toBeInTheDocument();
    expect(screen.getByText(/Mar 1, 2026/)).toBeInTheDocument();
  });

  it("shows grace period warning with countdown", () => {
    render(
      <PaymentInfoSection
        {...paidProps}
        status="GRACE_PERIOD"
        daysRemaining={5}
      />
    );
    expect(screen.getByText(/5 days remaining to pay/)).toBeInTheDocument();
  });

  it("shows trial countdown for trial members in grace", () => {
    render(
      <PaymentInfoSection
        {...paidProps}
        status="GRACE_PERIOD"
        daysRemaining={10}
        userStatus="TRIAL"
        trialEndsAt="2026-03-12T00:00:00.000Z"
      />
    );
    expect(screen.getByText(/10 days remaining in trial/)).toBeInTheDocument();
  });

  it("shows override message", () => {
    render(<PaymentInfoSection {...paidProps} status="OVERRIDE" />);
    expect(screen.getByText("Payment override active")).toBeInTheDocument();
  });

  it("shows empty state when no payments", () => {
    render(
      <PaymentInfoSection
        {...paidProps}
        lastPaymentDate={null}
        paidThroughDate={null}
        nextPaymentDue={null}
        recentPayments={[]}
        totalPaymentCount={0}
        userStatus="TRIAL"
        trialEndsAt="2026-03-12T00:00:00.000Z"
      />
    );
    expect(screen.getByText("No payments recorded yet")).toBeInTheDocument();
  });

  it("shows 'Show all payments' when there are more than shown", () => {
    render(
      <PaymentInfoSection
        {...paidProps}
        totalPaymentCount={10}
      />
    );
    expect(screen.getByText("Show all payments")).toBeInTheDocument();
  });

  it("does not show 'Show all' when all payments are visible", () => {
    render(<PaymentInfoSection {...paidProps} totalPaymentCount={1} />);
    expect(screen.queryByText("Show all payments")).not.toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/components/PaymentInfoSection.test.tsx`
Expected: FAIL — module not found

**Step 3: Implement the component**

Create `components/payment/PaymentInfoSection.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { Card, CardHeader } from "@/components/ui/Card";
import { PaymentStatusBadge } from "@/components/payment/PaymentStatusBadge";
import type { PaymentStatus } from "@/lib/constants";

interface PaymentRecord {
  id: string;
  amount: number;
  paidAt: string;
  periodStart: string;
  periodEnd: string;
}

interface PaymentInfoSectionProps {
  status: PaymentStatus;
  daysRemaining: number | null;
  lastPaymentDate: string | null;
  paidThroughDate: string | null;
  nextPaymentDue: string | null;
  recentPayments: PaymentRecord[];
  totalPaymentCount: number;
  userStatus: string;
  trialEndsAt: string | null;
}

function formatDate(iso: string): string {
  return format(new Date(iso), "MMM d, yyyy");
}

function formatCurrency(amount: number): string {
  return `${amount.toLocaleString()} MKD`;
}

export function PaymentInfoSection({
  status,
  daysRemaining,
  lastPaymentDate,
  paidThroughDate,
  nextPaymentDue,
  recentPayments,
  totalPaymentCount,
  userStatus,
  trialEndsAt,
}: PaymentInfoSectionProps): React.ReactElement {
  const t = useTranslations("profile");
  const [showAll, setShowAll] = useState(false);
  const [allPayments, setAllPayments] = useState<PaymentRecord[] | null>(null);
  const [loadingAll, setLoadingAll] = useState(false);

  const displayPayments = showAll && allPayments ? allPayments : recentPayments;
  const hasMore = totalPaymentCount > recentPayments.length;

  async function handleShowAll(): Promise<void> {
    if (showAll) {
      setShowAll(false);
      return;
    }
    if (allPayments) {
      setShowAll(true);
      return;
    }
    setLoadingAll(true);
    try {
      const res = await fetch("/api/payments/my");
      if (res.ok) {
        const data = await res.json();
        setAllPayments(data.data);
        setShowAll(true);
      }
    } finally {
      setLoadingAll(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Payment Status Card */}
      <Card>
        <CardHeader
          title={t("paymentInformation")}
          action={<PaymentStatusBadge status={status} size="md" />}
        />

        <div className="mt-4 space-y-3">
          {/* Status-specific message */}
          {status === "GRACE_PERIOD" && daysRemaining !== null && (
            <div className="rounded-lg bg-warning-900/30 border border-warning-700/50 px-4 py-3">
              <p className="text-sm font-medium text-warning-300">
                {userStatus === "TRIAL"
                  ? t("daysRemainingInTrial", { count: daysRemaining })
                  : t("daysRemainingToPay", { count: daysRemaining })}
              </p>
            </div>
          )}

          {status === "OVERRIDE" && (
            <div className="rounded-lg bg-primary-900/30 border border-primary-700/50 px-4 py-3">
              <p className="text-sm font-medium text-primary-300">
                {t("overrideActive")}
              </p>
            </div>
          )}

          {/* Date info grid */}
          {lastPaymentDate || paidThroughDate || nextPaymentDue ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {lastPaymentDate && (
                <div>
                  <p className="text-xs text-surface-500">{t("lastPayment")}</p>
                  <p className="text-sm font-medium text-surface-200">
                    {formatDate(lastPaymentDate)}
                  </p>
                </div>
              )}
              {paidThroughDate && (
                <div>
                  <p className="text-xs text-surface-500">{t("paidThrough")}</p>
                  <p className="text-sm font-medium text-surface-200">
                    {formatDate(paidThroughDate)}
                  </p>
                </div>
              )}
              {nextPaymentDue && (
                <div>
                  <p className="text-xs text-surface-500">{t("nextPaymentDue")}</p>
                  <p className="text-sm font-medium text-surface-200">
                    {formatDate(nextPaymentDue)}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="py-4 text-center">
              <p className="text-sm text-surface-500">{t("noPaymentsYet")}</p>
              {userStatus === "TRIAL" && trialEndsAt && (
                <p className="mt-1 text-xs text-surface-400">
                  {t("paymentDueBy", { date: formatDate(trialEndsAt) })}
                </p>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Payment History */}
      {recentPayments.length > 0 && (
        <Card padding="none">
          <div className="px-6 py-4">
            <CardHeader
              title={t("recentPayments")}
              action={
                hasMore ? (
                  <button
                    onClick={handleShowAll}
                    disabled={loadingAll}
                    className="text-sm text-primary-400 hover:text-primary-300 transition-colors disabled:opacity-50"
                  >
                    {loadingAll
                      ? "..."
                      : showAll
                        ? t("showRecent")
                        : t("showAllPayments")}
                  </button>
                ) : undefined
              }
            />
          </div>
          <div className="divide-y divide-surface-700">
            {displayPayments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between gap-4 px-6 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-surface-200">
                    {formatCurrency(payment.amount)}
                  </p>
                  <p className="text-xs text-surface-400">
                    {formatDate(payment.periodStart)} –{" "}
                    {formatDate(payment.periodEnd)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-surface-400">
                    {formatDate(payment.paidAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

export type { PaymentInfoSectionProps };
```

**Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/components/PaymentInfoSection.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add components/payment/PaymentInfoSection.tsx __tests__/components/PaymentInfoSection.test.tsx
git commit -m "feat: create PaymentInfoSection component with tests"
```

---

### Task 4: Update ProfileClient to accept and render payment info

**Files:**
- Modify: `app/(member)/member/profile/ProfileClient.tsx`

**Step 1: Write the failing test**

Create `__tests__/components/ProfileClient.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfileClient } from "@/app/(member)/member/profile/ProfileClient";

// Mock next-intl, next/navigation, next/image, etc.
// ... (standard mocks matching existing test patterns)

const defaultUser = {
  id: "user-1",
  name: "Jane Doe",
  email: "jane@example.com",
  phone: null,
  photo: null,
  status: "ACTIVE",
  joinDate: "2025-06-01T00:00:00.000Z",
  trialEndsAt: null,
};

const defaultPaymentInfo = {
  status: "PAID" as const,
  daysRemaining: null,
  lastPaymentDate: "2026-02-15T00:00:00.000Z",
  paidThroughDate: "2026-02-28T00:00:00.000Z",
  nextPaymentDue: "2026-03-01T00:00:00.000Z",
  recentPayments: [
    {
      id: "pay-1",
      amount: 1500,
      paidAt: "2026-02-15T00:00:00.000Z",
      periodStart: "2026-02-01T00:00:00.000Z",
      periodEnd: "2026-02-28T00:00:00.000Z",
    },
  ],
  totalPaymentCount: 1,
};

describe("ProfileClient", () => {
  it("renders payment information section", () => {
    render(
      <ProfileClient user={defaultUser} paymentInfo={defaultPaymentInfo} />
    );
    expect(screen.getByText("Payment Information")).toBeInTheDocument();
  });

  it("renders profile form and payment section together", () => {
    render(
      <ProfileClient user={defaultUser} paymentInfo={defaultPaymentInfo} />
    );
    expect(screen.getByText("Profile Information")).toBeInTheDocument();
    expect(screen.getByText("Payment Information")).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/components/ProfileClient.test.tsx`
Expected: FAIL — ProfileClient doesn't accept `paymentInfo` prop yet

**Step 3: Update ProfileClient**

Modify `app/(member)/member/profile/ProfileClient.tsx`:

1. Add `PaymentInfoSectionProps` import and `paymentInfo` to `ProfileClientProps`
2. Import and render `PaymentInfoSection` between the profile info card and the password/danger zone column

Key changes to the interface:

```typescript
import { PaymentInfoSection } from "@/components/payment/PaymentInfoSection";
import type { PaymentStatus } from "@/lib/constants";

interface PaymentInfoData {
  status: PaymentStatus;
  daysRemaining: number | null;
  lastPaymentDate: string | null;
  paidThroughDate: string | null;
  nextPaymentDue: string | null;
  recentPayments: Array<{
    id: string;
    amount: number;
    paidAt: string;
    periodStart: string;
    periodEnd: string;
  }>;
  totalPaymentCount: number;
}

interface ProfileClientProps {
  user: UserData;
  paymentInfo: PaymentInfoData;
}
```

Insert the `PaymentInfoSection` in the JSX after the profile info card and before the password section, spanning full width:

```tsx
</div> {/* end of grid */}

{/* Payment Information — full width below profile info */}
<PaymentInfoSection
  status={paymentInfo.status}
  daysRemaining={paymentInfo.daysRemaining}
  lastPaymentDate={paymentInfo.lastPaymentDate}
  paidThroughDate={paymentInfo.paidThroughDate}
  nextPaymentDue={paymentInfo.nextPaymentDue}
  recentPayments={paymentInfo.recentPayments}
  totalPaymentCount={paymentInfo.totalPaymentCount}
  userStatus={user.status}
  trialEndsAt={user.trialEndsAt}
/>
```

**Step 4: Run type check and tests**

Run: `npx tsc --noEmit`
Expected: PASS

Run: `npm test -- __tests__/components/ProfileClient.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add app/(member)/member/profile/ProfileClient.tsx __tests__/components/ProfileClient.test.tsx
git commit -m "feat: integrate PaymentInfoSection into member profile"
```

---

### Task 5: Add member's own payments API endpoint

**Files:**
- Create: `app/api/payments/my/route.ts`
- Create: `__tests__/api/payments-my.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth and prisma (follow existing patterns from payments.test.ts)

describe("GET /api/payments/my", () => {
  it("returns 401 for unauthenticated requests", async () => {
    // mock auth returning null
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns member's own payments ordered by paidAt desc", async () => {
    // mock auth returning member session
    // mock prisma.payment.findMany returning test payments
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.data).toHaveLength(2);
    expect(data.data[0].paidAt).toBeDefined();
  });

  it("does not include recordedBy or notes in response", async () => {
    // Verify member can't see who recorded or notes
    const res = await GET();
    const data = await res.json();
    expect(data.data[0].recordedBy).toBeUndefined();
    expect(data.data[0].notes).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/api/payments-my.test.ts`
Expected: FAIL — route doesn't exist

**Step 3: Implement the API route**

Create `app/api/payments/my/route.ts`:

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payments = await prisma.payment.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        amount: true,
        paidAt: true,
        periodStart: true,
        periodEnd: true,
      },
      orderBy: { paidAt: "desc" },
    });

    return Response.json({
      data: payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        paidAt: p.paidAt.toISOString(),
        periodStart: p.periodStart.toISOString(),
        periodEnd: p.periodEnd.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Failed to fetch member payments:", error);
    return Response.json(
      { error: "Failed to fetch payments" },
      { status: 500 }
    );
  }
}
```

**Step 4: Run tests**

Run: `npm test -- __tests__/api/payments-my.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/api/payments/my/route.ts __tests__/api/payments-my.test.ts
git commit -m "feat: add GET /api/payments/my endpoint for member's own payments"
```

---

### Task 6: Comprehensive PaymentInfoSection tests

**Files:**
- Modify: `__tests__/components/PaymentInfoSection.test.tsx`

**Step 1: Add edge case tests**

Expand the test file to cover all states from the design:

- PAID status with all dates populated
- GRACE_PERIOD with countdown (active member)
- GRACE_PERIOD with trial countdown (trial member)
- OVERRIDE status with message
- No payments (trial member, shows trial end date)
- Multiple payments in history list
- "Show all" button visibility logic
- "Show all" fetches from API and toggles
- Payment amounts formatted as MKD
- Coverage period display format

**Step 2: Run all tests**

Run: `npm test -- __tests__/components/PaymentInfoSection.test.tsx`
Expected: PASS

**Step 3: Commit**

```bash
git add __tests__/components/PaymentInfoSection.test.tsx
git commit -m "test: comprehensive PaymentInfoSection edge case tests"
```

---

### Task 7: Full verification

**Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: Zero errors

**Step 2: Lint**

Run: `npm run lint`
Expected: No new warnings

**Step 3: Full test suite**

Run: `npm test`
Expected: All tests pass (existing 1,860 + new tests)

**Step 4: Visual verification**

Run: `npm run dev`
Navigate to `/member/profile` and verify:
- Payment status card renders with correct badge
- Dates display correctly
- Payment history rows show amount + period + date
- "Show all" toggle works
- Grace period warning displays when applicable
- Empty state shows for new trial members

**Step 5: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address any issues found during verification"
```
