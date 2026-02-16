# Date Range Filters Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add month/year filtering to the Payments page and month navigation arrows to the Dashboard so the owner can view historical data.

**Architecture:** The APIs already support date filtering (`GET /api/payments?startDate&endDate` and `GET /api/analytics?startDate&endDate`). We add client-side state and fetch logic to `PaymentsClient.tsx` and `DashboardClient.tsx`. Server components pre-fetch current month data for instant first load; client takes over for navigation. No new files — all changes are inline in existing components.

**Tech Stack:** React (useState, useMemo, useCallback), fetch API, date-fns (format, startOfMonth, endOfMonth, getDaysInMonth), existing Select/Input UI components, Vitest + React Testing Library.

**Design doc:** `docs/plans/2026-02-16-date-range-filters-design.md`

---

### Task 1: Update Payments Server Component — Date-Bounded Initial Fetch

**Files:**
- Modify: `app/(owner)/payments/page.tsx:18-36` (add date bounds to payment query)

**Step 1: Add date bounds to the initial payments query**

Import `startOfMonth` and `endOfMonth` from `date-fns`. Compute `monthStart` and `monthEnd` from `now`. Add a `where` clause filtering `paidAt` between those dates. Also pass `initialMonth` and `initialYear` as props so the client knows which month is pre-loaded.

```typescript
// At top of file, add import:
import { startOfMonth, endOfMonth, format } from "date-fns";

// Inside the function, after `const now = new Date();` (line 60), replace the payments query:
// BEFORE (line 19-36):
//   prisma.payment.findMany({
//     orderBy: { paidAt: "desc" },
//     select: { ... },
//     take: 100,
//   }),
//
// AFTER:
const monthStart = startOfMonth(now);
const monthEnd = endOfMonth(now);

// In the Promise.all, replace the first query:
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
    notes: true,
    user: {
      select: { id: true, name: true },
    },
    recordedBy: {
      select: { name: true },
    },
  },
}),
```

Update the props passed to `PaymentsClient` to include `initialMonth` and `initialYear`:

```typescript
<PaymentsClient
  payments={/* ...existing mapping... */}
  members={memberStatuses}
  summary={{
    totalRevenue,
    thisMonthRevenue,
    paidCount,
    unpaidCount,
    totalMembers: members.length,
  }}
  currentUserId={session.user.id}
  initialMonth={now.getMonth()}
  initialYear={now.getFullYear()}
/>
```

**Step 2: Run type check to verify compilation**

Run: `npx tsc --noEmit`
Expected: Error about missing `initialMonth`/`initialYear` in `PaymentsClientProps` (expected — we'll fix in Task 2)

**Step 3: Commit**

```bash
git add app/(owner)/payments/page.tsx
git commit -m "feat: add date bounds to payments page initial query"
```

---

### Task 2: Add Filter Bar to PaymentsClient

**Files:**
- Modify: `app/(owner)/payments/PaymentsClient.tsx`

**Step 1: Add `initialMonth` and `initialYear` to PaymentsClientProps**

```typescript
interface PaymentsClientProps {
  payments: PaymentItem[];
  members: MemberStatus[];
  summary: PaymentsSummary;
  currentUserId: string;
  initialMonth: number;  // 0-11
  initialYear: number;   // e.g. 2026
}
```

**Step 2: Add filter state and fetch logic**

Add these imports at the top:

```typescript
import { format, getDaysInMonth } from "date-fns";
import { useCallback, useMemo } from "react"; // add useCallback, useMemo to existing import
```

Inside the component, add state and fetch logic after destructuring props:

```typescript
const { payments: initialPayments, members, summary, initialMonth, initialYear } = props;

// Filter state
const [filterMonth, setFilterMonth] = useState<number | null>(initialMonth);
const [filterYear, setFilterYear] = useState<number | null>(initialYear);
const [searchQuery, setSearchQuery] = useState("");
const [displayedPayments, setDisplayedPayments] = useState<PaymentItem[]>(initialPayments);
const [loadingPayments, setLoadingPayments] = useState(false);

const now = new Date();
const currentMonth = now.getMonth();
const currentYear = now.getFullYear();

// Year options: 2025 through current year
const yearOptions = useMemo(() => {
  const years: Array<{ value: string; label: string }> = [];
  for (let y = 2025; y <= currentYear; y++) {
    years.push({ value: String(y), label: String(y) });
  }
  return years;
}, [currentYear]);

// Month options
const monthOptions = [
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

// Fetch payments for a given month/year
const fetchPayments = useCallback(async (month: number | null, year: number | null): Promise<void> => {
  setLoadingPayments(true);
  try {
    let url = "/api/payments";
    if (month !== null && year !== null) {
      const daysInMonth = getDaysInMonth(new Date(year, month));
      const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
      url += `?startDate=${startDate}&endDate=${endDate}`;
    }
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      const data = json.data as Array<{
        id: string;
        amount: number;
        paidAt: string;
        periodStart: string;
        periodEnd: string;
        notes: string | null;
        user: { id: string; name: string };
        recordedBy: { name: string } | null;
      }>;
      setDisplayedPayments(
        data.map((p) => ({
          id: p.id,
          amount: Number(p.amount),
          paidAt: p.paidAt,
          periodStart: p.periodStart,
          periodEnd: p.periodEnd,
          notes: p.notes,
          memberName: p.user.name,
          memberId: p.user.id,
          recordedBy: p.recordedBy?.name || null,
        }))
      );
    }
  } catch {
    addToast({ type: "error", title: "Failed to load payments" });
  } finally {
    setLoadingPayments(false);
  }
}, [addToast]);

// Handle month change
function handleMonthChange(value: string): void {
  const month = parseInt(value);
  setFilterMonth(month);
  fetchPayments(month, filterYear);
}

// Handle year change
function handleYearChange(value: string): void {
  const year = parseInt(value);
  setFilterYear(year);
  fetchPayments(filterMonth, year);
}

// Clear filters — fetch latest 100 (no date filter)
function handleClearFilters(): void {
  setFilterMonth(null);
  setFilterYear(null);
  setSearchQuery("");
  fetchPayments(null, null);
}

// Client-side search filter
const visiblePayments = useMemo(() => {
  if (!searchQuery.trim()) return displayedPayments;
  const q = searchQuery.toLowerCase();
  return displayedPayments.filter((p) =>
    p.memberName.toLowerCase().includes(q)
  );
}, [displayedPayments, searchQuery]);

// Whether any filter is active (different from default)
const hasActiveFilter =
  filterMonth !== currentMonth ||
  filterYear !== currentYear ||
  searchQuery.trim() !== "";

// Label for table description
const filterLabel = filterMonth !== null && filterYear !== null
  ? `${monthOptions[filterMonth].label} ${filterYear}`
  : "all time";
```

**Step 3: Add the filter bar JSX**

Insert this block between the `{/* Header */}` section and `{/* Summary cards */}` section (after line 161):

```tsx
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
```

**Step 4: Update the payments table to use `visiblePayments` and show loading state**

Replace `{payments.map(` with `{visiblePayments.map(` in the table body.

Replace `{payments.length === 0 ?` with `{visiblePayments.length === 0 ?`.

Update the CardHeader description:

```tsx
<CardHeader
  title="Payment History"
  description={`${visiblePayments.length} payments${filterMonth !== null ? ` in ${filterLabel}` : ""}`}
/>
```

Add opacity fade on the table during loading. Wrap the `<div className="overflow-x-auto">` in:

```tsx
<div className={`overflow-x-auto transition-opacity ${loadingPayments ? "opacity-50" : ""}`}>
```

**Step 5: After recording a payment, re-fetch the current filter**

In the `handleRecordPayment` success branch, after `router.refresh()`, also re-fetch:

```typescript
if (res.ok) {
  addToast({ type: "success", title: "Payment recorded" });
  setShowPaymentModal(false);
  resetForm();
  router.refresh();
  fetchPayments(filterMonth, filterYear);
}
```

**Step 6: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS (zero errors)

**Step 7: Commit**

```bash
git add app/(owner)/payments/PaymentsClient.tsx
git commit -m "feat: add month/year filter bar and member search to payments page"
```

---

### Task 3: Add Month Navigator to DashboardClient

**Files:**
- Modify: `app/(owner)/dashboard/DashboardClient.tsx`
- Modify: `app/(owner)/dashboard/page.tsx`

**Step 1: Update DashboardClient props to include initial data and month/year**

Add imports:

```typescript
import { useState, useCallback } from "react";
import { format } from "date-fns";
import { useToast } from "@/components/ui/Toast";
```

Update the props interface:

```typescript
interface DashboardClientProps {
  totalActive: number;
  trialCount: number;
  totalRevenue: number;
  membershipRevenue: number;
  privateRevenue: number;
  outstandingCount: number;
  gracePeriodCount: number;
  lockedCount: number;
  popularSlots: SlotData[];
  monthLabel: string;
  initialMonth: number;  // 0-11
  initialYear: number;   // e.g. 2026
}
```

**Step 2: Add state and fetch logic inside DashboardClient**

```typescript
export function DashboardClient(props: DashboardClientProps): React.ReactElement {
  const {
    totalActive: initialTotalActive,
    trialCount: initialTrialCount,
    totalRevenue: initialTotalRevenue,
    membershipRevenue: initialMembershipRevenue,
    privateRevenue: initialPrivateRevenue,
    outstandingCount: initialOutstandingCount,
    gracePeriodCount: initialGracePeriodCount,
    lockedCount: initialLockedCount,
    popularSlots: initialPopularSlots,
    initialMonth,
    initialYear,
  } = props;

  const { addToast } = useToast();
  const [viewMonth, setViewMonth] = useState(initialMonth);
  const [viewYear, setViewYear] = useState(initialYear);
  const [loading, setLoading] = useState(false);

  // Dashboard data state
  const [totalActive, setTotalActive] = useState(initialTotalActive);
  const [trialCount, setTrialCount] = useState(initialTrialCount);
  const [totalRevenue, setTotalRevenue] = useState(initialTotalRevenue);
  const [membershipRevenue, setMembershipRevenue] = useState(initialMembershipRevenue);
  const [privateRevenue, setPrivateRevenue] = useState(initialPrivateRevenue);
  const [outstandingCount, setOutstandingCount] = useState(initialOutstandingCount);
  const [gracePeriodCount, setGracePeriodCount] = useState(initialGracePeriodCount);
  const [lockedCount, setLockedCount] = useState(initialLockedCount);
  const [popularSlots, setPopularSlots] = useState(initialPopularSlots);

  const now = new Date();
  const isCurrentMonth = viewMonth === now.getMonth() && viewYear === now.getFullYear();

  const monthLabel = format(new Date(viewYear, viewMonth, 1), "MMMM yyyy");

  const fetchDashboard = useCallback(async (month: number, year: number): Promise<void> => {
    setLoading(true);
    try {
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
      const res = await fetch(`/api/analytics?startDate=${startDate}&endDate=${endDate}`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data;
        setTotalActive(data.memberEngagement.totalActiveMembers);
        setTrialCount(0); // Analytics API doesn't return trial count; only relevant for current month
        setTotalRevenue(data.financial.totalRevenue);
        setMembershipRevenue(data.financial.membershipRevenue);
        setPrivateRevenue(data.financial.privateSessionRevenue);
        setOutstandingCount(data.financial.latePayers.length + data.financial.outstandingMembers.length);
        setGracePeriodCount(data.financial.latePayers.length);
        setLockedCount(data.financial.outstandingMembers.length);
        setPopularSlots(
          data.classPerformance.popularSlots.map((s: { day: string; hour: number; avgAttendance: number; avgFillRate: number; sessionCount: number }) => ({
            day: s.day,
            hour: s.hour,
            avgAttendance: s.avgAttendance,
            avgFillRate: s.avgFillRate,
            sessionCount: s.sessionCount,
          }))
        );
      }
    } catch {
      addToast({ type: "error", title: "Failed to load dashboard data" });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  function handlePrevMonth(): void {
    let newMonth = viewMonth - 1;
    let newYear = viewYear;
    if (newMonth < 0) {
      newMonth = 11;
      newYear -= 1;
    }
    setViewMonth(newMonth);
    setViewYear(newYear);
    fetchDashboard(newMonth, newYear);
  }

  function handleNextMonth(): void {
    if (isCurrentMonth) return;
    let newMonth = viewMonth + 1;
    let newYear = viewYear;
    if (newMonth > 11) {
      newMonth = 0;
      newYear += 1;
    }
    setViewMonth(newMonth);
    setViewYear(newYear);
    fetchDashboard(newMonth, newYear);
  }
```

**Step 3: Replace the page header subtitle with the month navigator**

Replace the existing subtitle:

```tsx
{/* BEFORE: */}
<p className="mt-1 text-sm text-surface-400">{monthLabel} overview</p>

{/* AFTER: */}
<div className="mt-1 flex items-center gap-1">
  <button
    onClick={handlePrevMonth}
    className="rounded p-0.5 text-surface-400 transition-colors hover:text-surface-100"
    aria-label="Previous month"
  >
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  </button>
  <span className="text-sm text-surface-400">{monthLabel} overview</span>
  <button
    onClick={handleNextMonth}
    disabled={isCurrentMonth}
    className="rounded p-0.5 text-surface-400 transition-colors hover:text-surface-100 disabled:opacity-30 disabled:cursor-not-allowed"
    aria-label="Next month"
  >
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
    </svg>
  </button>
</div>
```

**Step 4: Add opacity transition to metric cards and charts during loading**

Wrap the metric cards grid:

```tsx
<div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 transition-opacity ${loading ? "opacity-50" : ""}`}>
```

Wrap the charts grid:

```tsx
<div className={`grid grid-cols-1 gap-6 lg:grid-cols-2 transition-opacity ${loading ? "opacity-50" : ""}`}>
```

**Step 5: Update dashboard page.tsx to pass initialMonth and initialYear**

In `app/(owner)/dashboard/page.tsx`, add props to the `DashboardClient`:

```tsx
<DashboardClient
  totalActive={totalActive}
  trialCount={trialMembers.length}
  totalRevenue={totalRevenue}
  membershipRevenue={membershipRevenue}
  privateRevenue={privateRevenue}
  outstandingCount={outstandingCount}
  gracePeriodCount={gracePeriodCount}
  lockedCount={lockedCount}
  popularSlots={popularSlots}
  monthLabel={format(now, "MMMM yyyy")}
  initialMonth={now.getMonth()}
  initialYear={now.getFullYear()}
/>
```

**Step 6: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS (zero errors)

**Step 7: Run lint**

Run: `npm run lint`
Expected: PASS (only the 4 known pre-existing warnings)

**Step 8: Commit**

```bash
git add app/(owner)/dashboard/DashboardClient.tsx app/(owner)/dashboard/page.tsx
git commit -m "feat: add month navigation arrows to dashboard"
```

---

### Task 4: Write Tests for PaymentsClient Filters

**Files:**
- Create: `app/(owner)/payments/__tests__/PaymentsClient.test.tsx`

**Step 1: Write the test file**

```tsx
/**
 * PaymentsClient Filter Tests
 *
 * Tests the month/year filter bar, member name search, and clear filters.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PaymentsClient } from "../PaymentsClient";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Mock Toast
const mockAddToast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

// ===== Test Data =====

const mockPayments = [
  {
    id: "pay-1",
    amount: 1500,
    paidAt: "2026-02-05T10:00:00.000Z",
    periodStart: "2026-02-01T00:00:00.000Z",
    periodEnd: "2026-02-28T00:00:00.000Z",
    notes: null,
    memberName: "Ana Petrova",
    memberId: "m-1",
    recordedBy: "Owner",
  },
  {
    id: "pay-2",
    amount: 1500,
    paidAt: "2026-02-10T10:00:00.000Z",
    periodStart: "2026-02-01T00:00:00.000Z",
    periodEnd: "2026-02-28T00:00:00.000Z",
    notes: null,
    memberName: "Maria Johnson",
    memberId: "m-2",
    recordedBy: "Owner",
  },
];

const mockMembers = [
  { id: "m-1", name: "Ana Petrova", paymentStatus: "PAID" as const },
  { id: "m-2", name: "Maria Johnson", paymentStatus: "GRACE_PERIOD" as const },
];

const mockSummary = {
  totalRevenue: 30000,
  thisMonthRevenue: 3000,
  paidCount: 1,
  unpaidCount: 1,
  totalMembers: 2,
};

function renderPayments() {
  return render(
    <PaymentsClient
      payments={mockPayments}
      members={mockMembers}
      summary={mockSummary}
      currentUserId="owner-1"
      initialMonth={1}
      initialYear={2026}
    />
  );
}

// ===== Tests =====

describe("PaymentsClient - Filter Bar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("renders month and year select dropdowns", () => {
    renderPayments();
    expect(screen.getByLabelText("Filter by month")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by year")).toBeInTheDocument();
  });

  it("renders search input", () => {
    renderPayments();
    expect(screen.getByLabelText("Search payments by member name")).toBeInTheDocument();
  });

  it("defaults month to February (index 1)", () => {
    renderPayments();
    const monthSelect = screen.getByLabelText("Filter by month") as HTMLSelectElement;
    expect(monthSelect.value).toBe("1");
  });

  it("defaults year to 2026", () => {
    renderPayments();
    const yearSelect = screen.getByLabelText("Filter by year") as HTMLSelectElement;
    expect(yearSelect.value).toBe("2026");
  });

  it("does not show Clear button when default filters are active", () => {
    renderPayments();
    expect(screen.queryByText("Clear")).not.toBeInTheDocument();
  });

  it("shows all initial payments", () => {
    renderPayments();
    expect(screen.getByText("Ana Petrova")).toBeInTheDocument();
    expect(screen.getByText("Maria Johnson")).toBeInTheDocument();
  });
});

describe("PaymentsClient - Month/Year Change", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches payments with date params when month changes", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });
    global.fetch = mockFetch;

    renderPayments();
    const monthSelect = screen.getByLabelText("Filter by month") as HTMLSelectElement;
    fireEvent.change(monthSelect, { target: { value: "0" } }); // January

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/payments?startDate=2026-01-01&endDate=2026-01-31"
      );
    });
  });

  it("fetches payments with date params when year changes", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });
    global.fetch = mockFetch;

    renderPayments();
    const yearSelect = screen.getByLabelText("Filter by year") as HTMLSelectElement;
    fireEvent.change(yearSelect, { target: { value: "2025" } });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/payments?startDate=2025-02-01&endDate=2025-02-28"
      );
    });
  });

  it("updates displayed payments after fetch", async () => {
    const newPayments = [
      {
        id: "pay-3",
        amount: 2000,
        paidAt: "2026-01-15T10:00:00.000Z",
        periodStart: "2026-01-01T00:00:00.000Z",
        periodEnd: "2026-01-31T00:00:00.000Z",
        notes: null,
        user: { id: "m-3", name: "Elena Ivanova" },
        recordedBy: { name: "Owner" },
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: newPayments }),
    });

    renderPayments();
    const monthSelect = screen.getByLabelText("Filter by month") as HTMLSelectElement;
    fireEvent.change(monthSelect, { target: { value: "0" } });

    await waitFor(() => {
      expect(screen.getByText("Elena Ivanova")).toBeInTheDocument();
    });
    expect(screen.queryByText("Ana Petrova")).not.toBeInTheDocument();
  });
});

describe("PaymentsClient - Search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("filters payments by member name (case-insensitive)", () => {
    renderPayments();
    const searchInput = screen.getByLabelText("Search payments by member name");
    fireEvent.change(searchInput, { target: { value: "ana" } });

    expect(screen.getByText("Ana Petrova")).toBeInTheDocument();
    expect(screen.queryByText("Maria Johnson")).not.toBeInTheDocument();
  });

  it("shows all payments when search is cleared", () => {
    renderPayments();
    const searchInput = screen.getByLabelText("Search payments by member name");

    fireEvent.change(searchInput, { target: { value: "ana" } });
    expect(screen.queryByText("Maria Johnson")).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "" } });
    expect(screen.getByText("Ana Petrova")).toBeInTheDocument();
    expect(screen.getByText("Maria Johnson")).toBeInTheDocument();
  });

  it("shows empty state when search matches nothing", () => {
    renderPayments();
    const searchInput = screen.getByLabelText("Search payments by member name");
    fireEvent.change(searchInput, { target: { value: "zzzzz" } });

    expect(screen.getByText("No payments recorded yet")).toBeInTheDocument();
  });
});

describe("PaymentsClient - Clear Filters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows Clear button when search has text", () => {
    renderPayments();
    const searchInput = screen.getByLabelText("Search payments by member name");
    fireEvent.change(searchInput, { target: { value: "ana" } });

    expect(screen.getByText("Clear")).toBeInTheDocument();
  });

  it("fetches all payments and resets search on Clear", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });
    global.fetch = mockFetch;

    renderPayments();
    const searchInput = screen.getByLabelText("Search payments by member name");
    fireEvent.change(searchInput, { target: { value: "ana" } });
    fireEvent.click(screen.getByText("Clear"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/payments");
    });

    expect((searchInput as HTMLInputElement).value).toBe("");
  });
});
```

**Step 2: Run tests to verify they pass**

Run: `npm test -- app/(owner)/payments/__tests__/PaymentsClient.test.tsx`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add app/(owner)/payments/__tests__/PaymentsClient.test.tsx
git commit -m "test: add filter bar and search tests for payments page"
```

---

### Task 5: Write Tests for DashboardClient Month Navigator

**Files:**
- Create: `app/(owner)/dashboard/__tests__/DashboardClient.test.tsx`

**Step 1: Write the test file**

```tsx
/**
 * DashboardClient Month Navigator Tests
 *
 * Tests the left/right month navigation arrows and data fetching.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DashboardClient } from "../DashboardClient";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Mock Toast
const mockAddToast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

// Mock Recharts to avoid canvas issues in jsdom
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => null,
  Cell: () => null,
  Legend: () => null,
}));

// ===== Test Data =====

const defaultProps = {
  totalActive: 15,
  trialCount: 2,
  totalRevenue: 25000,
  membershipRevenue: 20000,
  privateRevenue: 5000,
  outstandingCount: 3,
  gracePeriodCount: 2,
  lockedCount: 1,
  popularSlots: [],
  monthLabel: "February 2026",
  initialMonth: 1,  // February
  initialYear: 2026,
};

function renderDashboard(overrides = {}) {
  return render(<DashboardClient {...defaultProps} {...overrides} />);
}

// ===== Tests =====

describe("DashboardClient - Month Navigator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    // Mock current date to February 2026
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 16)); // Feb 16, 2026
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders previous month button", () => {
    renderDashboard();
    expect(screen.getByLabelText("Previous month")).toBeInTheDocument();
  });

  it("renders next month button", () => {
    renderDashboard();
    expect(screen.getByLabelText("Next month")).toBeInTheDocument();
  });

  it("shows current month label", () => {
    renderDashboard();
    expect(screen.getByText("February 2026 overview")).toBeInTheDocument();
  });

  it("disables next month button when viewing current month", () => {
    renderDashboard();
    const nextBtn = screen.getByLabelText("Next month");
    expect(nextBtn).toBeDisabled();
  });

  it("navigates to previous month on left arrow click", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: {
          memberEngagement: { totalActiveMembers: 14 },
          classPerformance: { popularSlots: [] },
          financial: {
            totalRevenue: 22000,
            membershipRevenue: 18000,
            privateSessionRevenue: 4000,
            latePayers: [],
            outstandingMembers: [],
          },
        },
      }),
    });
    global.fetch = mockFetch;

    renderDashboard();
    fireEvent.click(screen.getByLabelText("Previous month"));

    await waitFor(() => {
      expect(screen.getByText("January 2026 overview")).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/analytics?startDate=2026-01-01&endDate=2026-01-31"
    );
  });

  it("enables next month button after navigating to previous month", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: {
          memberEngagement: { totalActiveMembers: 14 },
          classPerformance: { popularSlots: [] },
          financial: {
            totalRevenue: 22000,
            membershipRevenue: 18000,
            privateSessionRevenue: 4000,
            latePayers: [],
            outstandingMembers: [],
          },
        },
      }),
    });

    renderDashboard();
    fireEvent.click(screen.getByLabelText("Previous month"));

    await waitFor(() => {
      expect(screen.getByLabelText("Next month")).not.toBeDisabled();
    });
  });

  it("wraps from January to December of previous year", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: {
          memberEngagement: { totalActiveMembers: 14 },
          classPerformance: { popularSlots: [] },
          financial: {
            totalRevenue: 22000,
            membershipRevenue: 18000,
            privateSessionRevenue: 4000,
            latePayers: [],
            outstandingMembers: [],
          },
        },
      }),
    });

    renderDashboard({ initialMonth: 0, initialYear: 2026 });
    fireEvent.click(screen.getByLabelText("Previous month"));

    await waitFor(() => {
      expect(screen.getByText("December 2025 overview")).toBeInTheDocument();
    });
  });

  it("shows error toast on fetch failure", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    renderDashboard();
    fireEvent.click(screen.getByLabelText("Previous month"));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith({
        type: "error",
        title: "Failed to load dashboard data",
      });
    });
  });

  it("updates revenue metric after navigation", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: {
          memberEngagement: { totalActiveMembers: 10 },
          classPerformance: { popularSlots: [] },
          financial: {
            totalRevenue: 12000,
            membershipRevenue: 10000,
            privateSessionRevenue: 2000,
            latePayers: [],
            outstandingMembers: [],
          },
        },
      }),
    });

    renderDashboard();
    fireEvent.click(screen.getByLabelText("Previous month"));

    await waitFor(() => {
      expect(screen.getByText("12,000 MKD")).toBeInTheDocument();
    });
  });
});
```

**Step 2: Run tests to verify they pass**

Run: `npm test -- app/(owner)/dashboard/__tests__/DashboardClient.test.tsx`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add app/(owner)/dashboard/__tests__/DashboardClient.test.tsx
git commit -m "test: add month navigator tests for dashboard"
```

---

### Task 6: Run Full Suite and Final Verification

**Step 1: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS (zero errors)

**Step 2: Run linter**

Run: `npm run lint`
Expected: PASS (only 4 known pre-existing warnings)

**Step 3: Run full test suite**

Run: `npm test`
Expected: All tests pass (615 existing + new tests)

**Step 4: Run production build**

Run: `npm run build`
Expected: PASS

**Step 5: Final commit if any fixups needed, then done**
