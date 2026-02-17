# Trainer Payment Recording — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow trainers to record member payments via a new `/trainer/payments` page, with record-only access (no edit/delete).

**Architecture:** Expand the POST `/api/payments` role check from OWNER-only to OWNER+TRAINER. Create a new trainer payments page (`app/(trainer)/trainer/payments/`) with a server component that computes payment statuses and a client component with summary cards, unpaid members list, payment history table, and a record-payment modal. Add a "Payments" nav link for trainers.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS 4, Prisma 7, Zod, Vitest

---

### Task 1: Update POST /api/payments to allow TRAINER role

**Files:**
- Modify: `app/api/payments/route.ts:99` (the role check line)

**Step 1: Write the failing test**

Add a new test to `app/api/__tests__/payments.test.ts` after line 266 (after the existing "returns 403 for non-OWNER roles" test in the POST section):

```typescript
it("allows TRAINER to create payments", async () => {
  mockAuth.mockResolvedValue(trainerSession());
  mockPrisma.user.findUnique.mockResolvedValue({
    id: "cm1234567890abcdef",
    role: "MEMBER",
  });
  const createdPayment = {
    id: "p-2",
    userId: "cm1234567890abcdef",
    amount: 1500,
    paidAt: new Date("2025-03-15"),
    periodStart: new Date("2025-03-01"),
    periodEnd: new Date("2025-03-31"),
    notes: null,
    createdAt: new Date(),
    user: { id: "cm1234567890abcdef", name: "Bob" },
  };
  mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
    const mockTx = {
      payment: {
        create: vi.fn().mockResolvedValue(createdPayment),
      },
    };
    return cb(mockTx);
  });

  const { POST } = await import("@/app/api/payments/route");
  const response = await POST(
    new Request("http://localhost/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: "cm1234567890abcdef",
        amount: 1500,
        paidAt: "2025-03-15T00:00:00.000Z",
        periodStart: "2025-03-01",
        periodEnd: "2025-03-31",
      }),
    })
  );
  const body = await response.json();

  expect(response.status).toBe(201);
  expect(body.data.amount).toBe(1500);
  expect(mockTransaction).toHaveBeenCalledOnce();
});
```

Also update the existing test "returns 403 for non-OWNER roles" description to "returns 403 for MEMBER role" and change it to use `memberSession()`:

```typescript
it("returns 403 for MEMBER role", async () => {
  mockAuth.mockResolvedValue(memberSession());

  const { POST } = await import("@/app/api/payments/route");
  const response = await POST(
    new Request("http://localhost/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: "cm1234567890abcdef",
        amount: 2000,
        paidAt: "2025-03-01T00:00:00.000Z",
        periodStart: "2025-03-01",
        periodEnd: "2025-03-31",
      }),
    })
  );

  expect(response.status).toBe(403);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- app/api/__tests__/payments.test.ts`
Expected: The new "allows TRAINER to create payments" test FAILS (403 instead of 201). The updated "returns 403 for MEMBER role" test should PASS.

**Step 3: Write minimal implementation**

In `app/api/payments/route.ts`, change line 99 from:

```typescript
if ((session.user.role as string) !== "OWNER") {
```

to:

```typescript
const role = session.user.role as string;
if (role !== "OWNER" && role !== "TRAINER") {
```

Also update the file header comment on lines 4-5 from:
```
 * POST /api/payments — Owner records a cash payment.
```
to:
```
 * POST /api/payments — Owner or Trainer records a cash payment.
```

**Step 4: Run test to verify it passes**

Run: `npm test -- app/api/__tests__/payments.test.ts`
Expected: ALL tests pass (13 existing + 1 new = 14 total in this file, minus the renamed one stays at 14).

**Step 5: Commit**

```bash
git add app/api/payments/route.ts app/api/__tests__/payments.test.ts
git commit -m "feat: allow trainers to record payments (POST /api/payments)"
```

---

### Task 2: Add "Payments" link to trainer navigation

**Files:**
- Modify: `components/layout/Navigation.tsx:73-77` (TRAINER navLinks array)

**Step 1: Write the change**

In `components/layout/Navigation.tsx`, modify the TRAINER nav links array (lines 73-77) from:

```typescript
TRAINER: [
  { href: "/my-schedule", label: "My Schedule", icon: icons.schedule },
  { href: "/trainer/private-sessions", label: "Private Sessions", icon: icons.privateSessions },
  { href: "/trainer/notifications", label: "Notifications", icon: icons.notifications },
],
```

to:

```typescript
TRAINER: [
  { href: "/my-schedule", label: "My Schedule", icon: icons.schedule },
  { href: "/trainer/payments", label: "Payments", icon: icons.payments },
  { href: "/trainer/private-sessions", label: "Private Sessions", icon: icons.privateSessions },
  { href: "/trainer/notifications", label: "Notifications", icon: icons.notifications },
],
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors (the `icons.payments` icon already exists on line 36-40).

**Step 3: Commit**

```bash
git add components/layout/Navigation.tsx
git commit -m "feat: add Payments link to trainer navigation"
```

---

### Task 3: Create trainer payments server component

**Files:**
- Create: `app/(trainer)/trainer/payments/page.tsx`

**Step 1: Create the server component**

Create `app/(trainer)/trainer/payments/page.tsx`:

```typescript
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth } from "date-fns";
import { getPaymentStatus } from "@/lib/payment-logic";
import type { PaymentRecord } from "@/lib/payment-logic";
import { TrainerPaymentsClient } from "./TrainerPaymentsClient";

export const metadata = {
  title: "Payments - Wonder Woman Fitness",
};

export default async function TrainerPaymentsPage(): Promise<React.ReactElement> {
  const session = await auth();
  if (!session?.user || (session.user.role as string) !== "TRAINER") {
    redirect("/login");
  }

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [payments, members, allMemberPayments] = await Promise.all([
    prisma.payment.findMany({
      where: {
        paidAt: { gte: monthStart, lte: monthEnd },
      },
      orderBy: { paidAt: "desc" },
      select: {
        id: true,
        amount: true,
        paidAt: true,
        periodStart: true,
        periodEnd: true,
        user: {
          select: { id: true, name: true },
        },
        recordedBy: {
          select: { name: true },
        },
      },
    }),
    prisma.user.findMany({
      where: { role: "MEMBER", status: { not: "DEPARTED" } },
      select: {
        id: true,
        name: true,
        status: true,
        trialEndsAt: true,
        departedAt: true,
        overrideActive: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.payment.findMany({
      where: {
        user: { role: "MEMBER", status: { not: "DEPARTED" } },
      },
      select: {
        userId: true,
        periodStart: true,
        periodEnd: true,
        paidAt: true,
        amount: true,
      },
    }),
  ]);

  // Compute payment status for each member
  const memberStatuses = members.map((member) => {
    const memberPayments: PaymentRecord[] = allMemberPayments
      .filter((p) => p.userId === member.id)
      .map((p) => ({
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        paidAt: p.paidAt,
      }));

    const paymentStatus = getPaymentStatus(
      {
        id: member.id,
        status: member.status as "TRIAL" | "ACTIVE" | "DEPARTED",
        trialEndsAt: member.trialEndsAt,
        departedAt: member.departedAt,
        overrideActive: member.overrideActive,
      },
      memberPayments,
      now
    );

    return {
      id: member.id,
      name: member.name,
      paymentStatus,
    };
  });

  // Summary stats — this month only
  const thisMonthRevenue = payments.reduce(
    (sum, p) => sum + Number(p.amount),
    0
  );

  const paidCount = memberStatuses.filter(
    (m) => m.paymentStatus === "PAID" || m.paymentStatus === "OVERRIDE"
  ).length;
  const unpaidCount = memberStatuses.filter(
    (m) =>
      m.paymentStatus === "GRACE_PERIOD" || m.paymentStatus === "LOCKED"
  ).length;

  return (
    <TrainerPaymentsClient
      payments={payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        paidAt: p.paidAt.toISOString(),
        periodStart: p.periodStart.toISOString(),
        periodEnd: p.periodEnd.toISOString(),
        memberName: p.user.name,
        memberId: p.user.id,
        recordedBy: p.recordedBy?.name || null,
      }))}
      members={memberStatuses}
      summary={{
        thisMonthRevenue,
        paidCount,
        unpaidCount,
        totalMembers: members.length,
      }}
      initialMonth={now.getMonth()}
      initialYear={now.getFullYear()}
    />
  );
}
```

**Step 2: Verify TypeScript compiles (will fail — TrainerPaymentsClient doesn't exist yet)**

Run: `npx tsc --noEmit`
Expected: Error about missing `TrainerPaymentsClient` module. This is expected — we create it in Task 4.

**Step 3: Do NOT commit yet** — this depends on Task 4.

---

### Task 4: Create trainer payments client component

**Files:**
- Create: `app/(trainer)/trainer/payments/TrainerPaymentsClient.tsx`

**Step 1: Create the client component**

Create `app/(trainer)/trainer/payments/TrainerPaymentsClient.tsx`. This mirrors the owner's `PaymentsClient.tsx` but without edit/delete/notes functionality:

```typescript
"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format, getDaysInMonth } from "date-fns";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { PaymentStatusBadge } from "@/components/payment/PaymentStatusBadge";
import { useToast } from "@/components/ui/Toast";
import { PAYMENTS_START_YEAR } from "@/lib/constants";
import type { PaymentStatus } from "@/lib/constants";

interface TrainerPaymentItem {
  id: string;
  amount: number;
  paidAt: string;
  periodStart: string;
  periodEnd: string;
  memberName: string;
  memberId: string;
  recordedBy: string | null;
}

interface MemberStatus {
  id: string;
  name: string;
  paymentStatus: PaymentStatus;
}

interface TrainerPaymentsSummary {
  thisMonthRevenue: number;
  paidCount: number;
  unpaidCount: number;
  totalMembers: number;
}

interface TrainerPaymentsClientProps {
  payments: TrainerPaymentItem[];
  members: MemberStatus[];
  summary: TrainerPaymentsSummary;
  initialMonth: number;
  initialYear: number;
}

const MONTH_OPTIONS = [
  { value: "0", label: "January" },
  { value: "1", label: "February" },
  { value: "2", label: "March" },
  { value: "3", label: "April" },
  { value: "4", label: "May" },
  { value: "5", label: "June" },
  { value: "6", label: "July" },
  { value: "7", label: "August" },
  { value: "8", label: "September" },
  { value: "9", label: "October" },
  { value: "10", label: "November" },
  { value: "11", label: "December" },
];

export function TrainerPaymentsClient(
  props: TrainerPaymentsClientProps
): React.ReactElement {
  const { payments: initialPayments, members, summary, initialMonth, initialYear } = props;
  const router = useRouter();
  const { addToast } = useToast();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Filter state
  const [filterMonth, setFilterMonth] = useState<number | null>(initialMonth);
  const [filterYear, setFilterYear] = useState<number | null>(initialYear);
  const [searchQuery, setSearchQuery] = useState("");
  const [displayedPayments, setDisplayedPayments] = useState<TrainerPaymentItem[]>(initialPayments);
  const [loadingPayments, setLoadingPayments] = useState(false);

  const [currentMonth] = useState(() => new Date().getMonth());
  const [currentYear] = useState(() => new Date().getFullYear());

  const yearOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    for (let y = PAYMENTS_START_YEAR; y <= currentYear; y++) {
      options.push({ value: String(y), label: String(y) });
    }
    return options;
  }, [currentYear]);

  const monthOptions = MONTH_OPTIONS;

  const fetchPayments = useCallback(async (month: number | null, year: number | null): Promise<void> => {
    if (month === null || year === null) return;
    setLoadingPayments(true);
    try {
      const daysInMonth = getDaysInMonth(new Date(year, month));
      const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
      const res = await fetch(`/api/payments?startDate=${startDate}&endDate=${endDate}`);
      if (res.ok) {
        const json = await res.json();
        if (!json.data) {
          addToast({ type: "error", title: "Unexpected response format" });
          return;
        }
        const data = json.data as Array<{
          id: string;
          amount: number | string;
          paidAt: string;
          periodStart: string;
          periodEnd: string;
          user: { id: string; name: string };
          recordedBy: { id: string; name: string } | null;
        }>;
        setDisplayedPayments(data.map((p) => ({
          id: p.id,
          amount: Number(p.amount),
          paidAt: p.paidAt,
          periodStart: p.periodStart,
          periodEnd: p.periodEnd,
          memberName: p.user.name,
          memberId: p.user.id,
          recordedBy: p.recordedBy?.name || null,
        })));
      } else {
        addToast({ type: "error", title: "Failed to load payments" });
      }
    } catch {
      addToast({ type: "error", title: "Failed to load payments" });
    } finally {
      setLoadingPayments(false);
    }
  }, [addToast]);

  function handleMonthChange(value: string): void {
    const month = value === "" ? null : Number(value);
    setFilterMonth(month);
    fetchPayments(month, filterYear);
  }

  function handleYearChange(value: string): void {
    const year = value === "" ? null : Number(value);
    setFilterYear(year);
    fetchPayments(filterMonth, year);
  }

  function handleClearFilters(): void {
    setFilterMonth(currentMonth);
    setFilterYear(currentYear);
    setSearchQuery("");
    fetchPayments(currentMonth, currentYear);
  }

  const visiblePayments = useMemo(() => {
    if (!searchQuery.trim()) return displayedPayments;
    const q = searchQuery.toLowerCase();
    return displayedPayments.filter((p) => p.memberName.toLowerCase().includes(q));
  }, [displayedPayments, searchQuery]);

  const hasActiveFilter = filterMonth !== currentMonth || filterYear !== currentYear || searchQuery.trim() !== "";

  const filterLabel = filterMonth !== null && filterYear !== null
    ? `${MONTH_OPTIONS[filterMonth].label} ${filterYear}`
    : "";

  // Payment form state
  const [selectedMember, setSelectedMember] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(
    format(new Date(), "yyyy-MM-dd'T'HH:mm")
  );
  const [payPeriodStart, setPayPeriodStart] = useState(
    format(new Date(), "yyyy-MM-dd")
  );
  const [payPeriodEnd, setPayPeriodEnd] = useState("");
  const [payErrors, setPayErrors] = useState<Record<string, string>>({});

  function resetForm(): void {
    setSelectedMember("");
    setPayAmount("");
    setPayDate(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    setPayPeriodStart(format(new Date(), "yyyy-MM-dd"));
    setPayPeriodEnd("");
    setPayErrors({});
  }

  async function handleRecordPayment(
    e: React.FormEvent
  ): Promise<void> {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!selectedMember) errors.member = "Select a member";
    const parsedAmount = parseFloat(payAmount);
    if (!payAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
      errors.amount = "Amount must be a positive number";
    }
    if (!payDate) errors.paidAt = "Payment date is required";
    if (!payPeriodStart) errors.periodStart = "Period start is required";
    if (!payPeriodEnd) errors.periodEnd = "Period end is required";
    if (payPeriodStart && payPeriodEnd && payPeriodStart > payPeriodEnd) {
      errors.periodEnd = "Period end must be after start";
    }

    if (Object.keys(errors).length > 0) {
      setPayErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedMember,
          amount: parsedAmount,
          paidAt: new Date(payDate).toISOString(),
          periodStart: payPeriodStart,
          periodEnd: payPeriodEnd,
        }),
      });

      if (res.ok) {
        addToast({ type: "success", title: "Payment recorded" });
        setShowPaymentModal(false);
        resetForm();
        router.refresh();
        fetchPayments(filterMonth, filterYear);
      } else {
        const data: { error: string } = await res.json();
        addToast({
          type: "error",
          title: "Failed to record payment",
          message: data.error,
        });
      }
    } catch {
      addToast({ type: "error", title: "Network error" });
    } finally {
      setLoading(false);
    }
  }

  function formatCurrency(amount: number): string {
    return `${amount.toLocaleString()} MKD`;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-100">Payments</h1>
          <p className="mt-1 text-sm text-surface-400">
            Track and record member payments
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowPaymentModal(true)}
        >
          Record Payment
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-surface-700 bg-surface-800/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Select
            options={monthOptions}
            value={filterMonth !== null ? String(filterMonth) : ""}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="w-[130px] !py-1.5 text-sm"
            aria-label="Filter by month"
          />
          <Select
            options={yearOptions}
            value={filterYear !== null ? String(filterYear) : ""}
            onChange={(e) => handleYearChange(e.target.value)}
            className="w-[90px] !py-1.5 text-sm"
            aria-label="Filter by year"
          />
        </div>
        <div className="ml-auto flex items-center gap-3">
          <input
            type="text"
            placeholder="Search by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-[180px] rounded-lg border border-surface-600 bg-surface-800 px-3 py-1.5 text-sm text-surface-100 placeholder:text-surface-500 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 focus:ring-offset-surface-900 hover:border-surface-500"
            aria-label="Search payments by member name"
          />
          {hasActiveFilter && (
            <button
              onClick={handleClearFilters}
              className="text-sm text-surface-500 transition-colors hover:text-primary-300"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Summary cards — 3 cards, no all-time */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">
            This Month
          </p>
          <p className="mt-1 text-xl font-bold text-surface-100">
            {formatCurrency(summary.thisMonthRevenue)}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">
            Paid Members
          </p>
          <p className="mt-1 text-xl font-bold text-success-400">
            {summary.paidCount}
            <span className="text-sm font-normal text-surface-500">
              {" "}
              / {summary.totalMembers}
            </span>
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">
            Unpaid
          </p>
          <p
            className={`mt-1 text-xl font-bold ${
              summary.unpaidCount > 0 ? "text-error-400" : "text-surface-100"
            }`}
          >
            {summary.unpaidCount}
          </p>
        </Card>
      </div>

      {/* Unpaid members quick list */}
      {members.some(
        (m) =>
          m.paymentStatus === "GRACE_PERIOD" ||
          m.paymentStatus === "LOCKED"
      ) && (
        <Card>
          <CardHeader
            title="Unpaid Members"
            description="Members with outstanding payments"
          />
          <div className="mt-3 space-y-2">
            {members
              .filter(
                (m) =>
                  m.paymentStatus === "GRACE_PERIOD" ||
                  m.paymentStatus === "LOCKED"
              )
              .map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-lg bg-surface-900/50 px-3 py-2"
                >
                  <span className="text-sm text-surface-200">{m.name}</span>
                  <PaymentStatusBadge status={m.paymentStatus} />
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* Payments table */}
      <Card padding="none">
        <div className="px-6 py-4">
          <CardHeader
            title="Payment History"
            description={`${visiblePayments.length} payments${filterMonth !== null ? ` in ${filterLabel}` : ""}`}
          />
        </div>

        {visiblePayments.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-surface-500">
              No payments recorded yet
            </p>
          </div>
        ) : (
          <div className={`overflow-x-auto transition-opacity ${loadingPayments ? "opacity-50" : ""}`}>
            <table className="w-full">
              <thead>
                <tr className="border-y border-surface-700 text-left">
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-surface-500">
                    Member
                  </th>
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-surface-500">
                    Amount
                  </th>
                  <th className="hidden px-6 py-3 text-xs font-medium uppercase tracking-wide text-surface-500 sm:table-cell">
                    Period
                  </th>
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-surface-500">
                    Paid
                  </th>
                  <th className="hidden px-6 py-3 text-xs font-medium uppercase tracking-wide text-surface-500 md:table-cell">
                    Recorded By
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700/50">
                {visiblePayments.map((payment) => (
                  <tr
                    key={payment.id}
                    className="transition-colors hover:bg-surface-800/80"
                  >
                    <td className="px-6 py-3">
                      <span className="text-sm font-medium text-surface-200">
                        {payment.memberName}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm font-medium text-surface-200">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="hidden px-6 py-3 text-sm text-surface-400 sm:table-cell">
                      {format(new Date(payment.periodStart), "MMM d")} –{" "}
                      {format(new Date(payment.periodEnd), "MMM d, yyyy")}
                    </td>
                    <td className="px-6 py-3 text-sm text-surface-400">
                      {format(new Date(payment.paidAt), "MMM d, yyyy")}
                    </td>
                    <td className="hidden px-6 py-3 text-sm text-surface-500 md:table-cell">
                      {payment.recordedBy || "\u2014"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Record Payment Modal */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          resetForm();
        }}
        title="Record Payment"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <Select
            label="Member"
            options={[
              { value: "", label: "Select a member..." },
              ...members.map((m) => ({ value: m.id, label: m.name })),
            ]}
            value={selectedMember}
            onChange={(e) => setSelectedMember(e.target.value)}
            error={payErrors.member}
          />

          <Input
            label="Amount (MKD)"
            type="number"
            step="1"
            min="1"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
            placeholder="e.g., 1500"
            error={payErrors.amount}
          />

          <Input
            label="Paid At"
            type="datetime-local"
            value={payDate}
            onChange={(e) => setPayDate(e.target.value)}
            error={payErrors.paidAt}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Period Start"
              type="date"
              value={payPeriodStart}
              onChange={(e) => setPayPeriodStart(e.target.value)}
              error={payErrors.periodStart}
            />
            <Input
              label="Period End"
              type="date"
              value={payPeriodEnd}
              onChange={(e) => setPayPeriodEnd(e.target.value)}
              error={payErrors.periodEnd}
            />
          </div>

          {payErrors.form && (
            <p className="text-sm text-error-500" role="alert">
              {payErrors.form}
            </p>
          )}

          <div className="flex items-center gap-2 pt-2">
            <Button type="submit" variant="primary" loading={loading}>
              Record Payment
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowPaymentModal(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit Tasks 3 + 4 together**

```bash
git add app/(trainer)/trainer/payments/page.tsx app/(trainer)/trainer/payments/TrainerPaymentsClient.tsx
git commit -m "feat: add trainer payments page with record-only access"
```

---

### Task 5: Run full verification

**Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass (615 existing + 1 new = 616 total).

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3: Run linter**

Run: `npm run lint`
Expected: No new warnings (only the 4 pre-existing ones).

**Step 4: Run production build**

Run: `npm run build`
Expected: Build succeeds.
