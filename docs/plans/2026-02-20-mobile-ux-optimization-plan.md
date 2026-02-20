# Mobile UX Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Optimize the mobile experience for members and trainers who primarily use phones to vote on sessions and interact with the app.

**Architecture:** Pure frontend changes — CSS/Tailwind adjustments, one new component (BottomNav), and minor component refactors. No API, database, or business logic changes. All changes are mobile-first with `sm:` / `md:` breakpoint overrides to preserve existing desktop behavior.

**Tech Stack:** Tailwind CSS 4 (CSS-based config via `@theme` in `globals.css`), React/Next.js 15 (App Router), Vitest for testing.

---

## Task 1: Increase `sm` Button Touch Target

**Files:**
- Modify: `components/ui/Button.tsx:31`
- Modify: `__tests__/components/Button.test.tsx` (update any snapshot/class assertions)

**Context:** The WCAG 2.1 AA minimum touch target is 44x44px. The `sm` button size currently produces ~36px height (`py-1.5` = 6px top + 6px bottom + ~24px text = 36px). This button size is used for voting, back buttons, and actions across the app.

**Step 1: Update the sm size class**

In `components/ui/Button.tsx`, change line 31:

```typescript
// Before
sm: "px-3 py-1.5 text-sm",

// After
sm: "px-3 py-2 text-sm",
```

This changes vertical padding from 6px to 8px per side, producing ~40px height. A 4px total increase — subtle but meaningful for thumb tapping.

**Step 2: Run existing Button tests**

Run: `npm test -- __tests__/components/Button.test.tsx`
Expected: All 40 tests pass. If any tests assert on exact class strings containing `py-1.5`, update them to `py-2`.

**Step 3: Run full test suite to check for cascade effects**

Run: `npm test`
Expected: All tests pass. The `sm` size is used in many components, so verify no snapshot or class assertion breaks.

**Step 4: Commit**

```bash
git add components/ui/Button.tsx
git commit -m "fix: increase sm button touch target from py-1.5 to py-2"
```

---

## Task 2: Increase Modal Close Button Touch Target

**Files:**
- Modify: `components/ui/Modal.tsx:132`
- Test: `__tests__/components/Modal.test.tsx`

**Context:** The modal close (X) button has `p-1.5` padding, producing a ~32px touch target. Increasing to `p-2.5` gets it to ~44px — the WCAG minimum.

**Step 1: Update close button padding**

In `components/ui/Modal.tsx`, change line 132:

```typescript
// Before
className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-700 hover:text-surface-200 transition-colors"

// After
className="rounded-lg p-2.5 text-surface-400 hover:bg-surface-700 hover:text-surface-200 transition-colors"
```

**Step 2: Run Modal tests**

Run: `npm test -- __tests__/components/Modal.test.tsx`
Expected: All 28 tests pass. If any test asserts on `p-1.5`, update to `p-2.5`.

**Step 3: Commit**

```bash
git add components/ui/Modal.tsx
git commit -m "fix: increase modal close button touch target to 44px"
```

---

## Task 3: Stack Voting Buttons Vertically on Mobile

**Files:**
- Modify: `app/(member)/member/session/[id]/MemberSessionDetailClient.tsx:188-226`
- Test: `__tests__/components/MemberSessionDetailClient.test.tsx`

**Context:** The "I'm Coming" / "Not Coming" buttons are the #1 member action. They currently sit side-by-side (`flex gap-3`) with `size="sm"`. On a 320px phone, each button gets ~140px — tight with icon + text. Stacking them full-width on mobile makes them much easier to tap.

**Step 1: Change button container to stack on mobile**

In `MemberSessionDetailClient.tsx`, find the voting button container (around line 188):

```tsx
// Before
<div className="flex gap-3">

// After
<div className="flex flex-col sm:flex-row gap-3">
```

**Step 2: Make voting buttons full-width on mobile, change size to md**

Change both voting buttons from `size="sm"` to `size="md"`. No `fullWidth` prop needed — the `flex-col` container with block-level children will stretch them naturally.

```tsx
// "I'm Coming" button — around line 190
// Before
size="sm"

// After
size="md"

// "Not Coming" button — around line 208
// Before
size="sm"

// After
size="md"
```

**Step 3: Run tests**

Run: `npm test -- __tests__/components/MemberSessionDetailClient.test.tsx`
Expected: All 100 tests pass.

**Step 4: Commit**

```bash
git add app/(member)/member/session/[id]/MemberSessionDetailClient.tsx
git commit -m "fix: stack voting buttons vertically on mobile with larger touch targets"
```

---

## Task 4: Tighten Modal Padding on Mobile

**Files:**
- Modify: `components/ui/Modal.tsx:123,151`
- Test: `__tests__/components/Modal.test.tsx`

**Context:** Modal header and body both use `px-6` (24px per side). On a 375px phone inside a `p-4` container, the modal content gets only ~275px. Changing to `px-4 sm:px-6` saves 16px on mobile.

**Step 1: Update modal header padding**

In `components/ui/Modal.tsx`, line 123:

```tsx
// Before
<div className="flex items-center justify-between border-b border-surface-700 px-6 py-4">

// After
<div className="flex items-center justify-between border-b border-surface-700 px-4 py-4 sm:px-6">
```

**Step 2: Update modal body padding**

In `components/ui/Modal.tsx`, line 151:

```tsx
// Before
<div className="px-6 py-4">{children}</div>

// After
<div className="px-4 py-4 sm:px-6">{children}</div>
```

**Step 3: Run tests**

Run: `npm test -- __tests__/components/Modal.test.tsx`
Expected: All 28 tests pass.

**Step 4: Commit**

```bash
git add components/ui/Modal.tsx
git commit -m "fix: reduce modal horizontal padding on mobile for more content space"
```

---

## Task 5: Restructure Session Detail Header for Mobile

**Files:**
- Modify: `app/(member)/member/session/[id]/MemberSessionDetailClient.tsx:119-155`
- Test: `__tests__/components/MemberSessionDetailClient.test.tsx`

**Context:** The session detail header puts the title left and "Back" button right in a `flex justify-between`. On mobile, the badges below can wrap onto multiple lines. Moving "Back" to its own row above the title frees full width for the title + badges.

**Step 1: Restructure the header**

Replace the header section (lines ~119-155):

```tsx
// Before
<div className="flex items-start justify-between gap-4">
  <div>
    <h1 className="text-2xl font-bold text-surface-100">
      {dayName} {time}
    </h1>
    <div className="mt-1 flex items-center gap-2">
      {/* ...badges... */}
    </div>
  </div>
  <Button variant="ghost" size="sm" onClick={() => router.back()}>
    Back
  </Button>
</div>

// After
<div className="space-y-3">
  <button
    onClick={() => router.back()}
    className="flex items-center gap-1 text-sm text-surface-400 hover:text-surface-200 transition-colors"
  >
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
    Back to schedule
  </button>
  <div>
    <h1 className="text-2xl font-bold text-surface-100">
      {dayName} {time}
    </h1>
    <div className="mt-1 flex flex-wrap items-center gap-2">
      {/* ...badges unchanged... */}
    </div>
  </div>
</div>
```

Note: Also add `flex-wrap` to the badges container so they wrap cleanly on narrow screens.

**Step 2: Run tests**

Run: `npm test -- __tests__/components/MemberSessionDetailClient.test.tsx`
Expected: Tests that look for the "Back" button may need selector updates (it's now a `<button>` not a `<Button>` with specific variant). Update assertions if needed.

**Step 3: Commit**

```bash
git add app/(member)/member/session/[id]/MemberSessionDetailClient.tsx
git commit -m "fix: restructure session detail header with breadcrumb-style back nav"
```

---

## Task 6: Full-Width Lockout Screen Button on Mobile

**Files:**
- Modify: `components/payment/LockoutScreen.tsx:78-90`
- Test: `__tests__/components/PaymentBanner.test.tsx` (lockout tests may be here)

**Context:** The "Log Out" button on the lockout screen is inline-sized. Since this screen is the only thing locked members see, the button should be prominent on mobile.

**Step 1: Add responsive width to the Log Out button**

In `LockoutScreen.tsx`, line 80:

```tsx
// Before
className="mt-6 inline-flex items-center gap-2 rounded-lg border border-surface-600 bg-surface-800 px-4 py-2 text-sm font-medium text-surface-300 transition-colors hover:bg-surface-700 hover:text-surface-100"

// After
className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-surface-600 bg-surface-800 px-4 py-2.5 text-sm font-medium text-surface-300 transition-colors hover:bg-surface-700 hover:text-surface-100 sm:w-auto sm:justify-start"
```

Changes: `w-full` + `justify-center` on mobile, `sm:w-auto` + `sm:justify-start` on tablet+. Also bumped `py-2` to `py-2.5` for better touch target.

**Step 2: Run tests**

Run: `npm test -- __tests__/components/PaymentBanner.test.tsx`
Expected: All tests pass.

**Step 3: Commit**

```bash
git add components/payment/LockoutScreen.tsx
git commit -m "fix: make lockout screen button full-width on mobile"
```

---

## Task 7: Close Mobile Menu on Outside Tap

**Files:**
- Modify: `components/layout/Header.tsx:169-211`
- Test: Should add a test for this behavior

**Context:** The mobile hamburger menu only closes via the X button or link navigation. Tapping outside doesn't dismiss it. The desktop user menu already has this pattern (line 110-113).

**Step 1: Add overlay backdrop behind mobile menu**

In `Header.tsx`, wrap the mobile menu (line 169) with a backdrop:

```tsx
// Before
{mobileMenuOpen && (
  <div className="border-t border-surface-700 md:hidden">
    {/* ...menu content... */}
  </div>
)}

// After
{mobileMenuOpen && (
  <>
    <div
      className="fixed inset-0 z-30 md:hidden"
      onClick={() => setMobileMenuOpen(false)}
      aria-hidden="true"
    />
    <div className="relative z-40 border-t border-surface-700 md:hidden">
      {/* ...menu content unchanged... */}
    </div>
  </>
)}
```

**Step 2: Lock body scroll when mobile menu is open**

Add a `useEffect` to lock scroll:

```tsx
useEffect(() => {
  if (mobileMenuOpen) {
    document.body.style.overflow = "hidden";
  } else {
    document.body.style.overflow = "";
  }
  return () => {
    document.body.style.overflow = "";
  };
}, [mobileMenuOpen]);
```

**Step 3: Run any existing header/navigation tests**

Run: `npm test`
Expected: All tests pass. There may not be existing Header tests — that's fine, this is a behavioral fix.

**Step 4: Commit**

```bash
git add components/layout/Header.tsx
git commit -m "fix: close mobile menu on outside tap and lock body scroll"
```

---

## Task 8: Improve Week Navigation Touch Targets

**Files:**
- Modify: `components/schedule/WeeklyCalendar.tsx:76-108`

**Context:** Prev/Next week navigation buttons have `px-3 py-2` — adequate height but narrow hit area. Adding minimum dimensions ensures 44px touch targets.

**Step 1: Update navigation button classes**

In `WeeklyCalendar.tsx`, update both navigation buttons (lines 76 and 95):

```tsx
// Before (both buttons)
className="rounded-lg px-3 py-2 text-sm text-surface-400 hover:bg-surface-800 hover:text-surface-100 transition-colors"

// After (both buttons)
className="rounded-lg px-4 py-2.5 text-sm text-surface-400 hover:bg-surface-800 hover:text-surface-100 transition-colors"
```

**Step 2: Run tests**

Run: `npm test`
Expected: All tests pass.

**Step 3: Commit**

```bash
git add components/schedule/WeeklyCalendar.tsx
git commit -m "fix: increase week navigation button touch targets"
```

---

## Task 9: Add Colored Left Border for Vote Status on Session Cards

**Files:**
- Modify: `components/schedule/SessionCard.tsx:49-57`
- Test: `__tests__/components/SessionCard.test.tsx`

**Context:** A member's vote status ("Going" / "Not going") is a tiny badge in the card footer. Adding a colored left border provides at-a-glance status when scanning the weekly schedule — green for going, red for not going.

**Step 1: Add vote status border logic**

In `SessionCard.tsx`, add border class computation after the existing `userVote` logic (around line 42):

```tsx
// After line 43 (const showDeadline = ...)
const voteBorderClass = userVote
  ? userVote.attending
    ? "border-l-4 border-l-success-500"
    : "border-l-4 border-l-error-500"
  : "";
```

**Step 2: Apply the border class to the card**

In the Link's className (line 49), add the border class:

```tsx
// Before
className={`
  group block rounded-lg border p-3
  transition-all duration-150
  ${
    isCancelled
      ? "border-surface-700 bg-surface-800/50 opacity-60"
      : "border-surface-700 bg-surface-800 hover:border-primary-600/50 hover:bg-surface-700"
  }
`}

// After
className={`
  group block rounded-lg border p-3
  transition-all duration-150
  ${
    isCancelled
      ? "border-surface-700 bg-surface-800/50 opacity-60"
      : "border-surface-700 bg-surface-800 hover:border-primary-600/50 hover:bg-surface-700"
  }
  ${!isCancelled ? voteBorderClass : ""}
`}
```

**Step 3: Write a test for the vote border**

In `__tests__/components/SessionCard.test.tsx`, add:

```tsx
it("shows green left border when user voted coming", () => {
  // Render SessionCard with a session that has currentUserId matching a vote with attending=true
  // Assert the link element has classes containing "border-l-success-500"
});

it("shows red left border when user voted not coming", () => {
  // Render SessionCard with a session that has currentUserId matching a vote with attending=false
  // Assert the link element has classes containing "border-l-error-500"
});

it("shows no left border when user has not voted", () => {
  // Render SessionCard with no matching vote
  // Assert the link element does NOT have "border-l-4" class
});
```

**Step 4: Run tests**

Run: `npm test -- __tests__/components/SessionCard.test.tsx`
Expected: All tests pass including the new ones.

**Step 5: Commit**

```bash
git add components/schedule/SessionCard.tsx __tests__/components/SessionCard.test.tsx
git commit -m "feat: add colored left border to session cards based on vote status"
```

---

## Task 10: Align Payment Banner Icon to Top on Mobile

**Files:**
- Modify: `components/payment/PaymentBanner.tsx`
- Test: `__tests__/components/PaymentBanner.test.tsx`

**Context:** The payment banner uses `items-center` alignment. On narrow screens, long text wraps and the icon floats mid-height. Changing to `items-start` keeps the icon top-aligned.

**Step 1: Update alignment**

Find the flex container in `PaymentBanner.tsx`:

```tsx
// Before
className="mx-auto flex max-w-7xl items-center gap-3"

// After
className="mx-auto flex max-w-7xl items-start gap-3 sm:items-center"
```

**Step 2: Add top margin to icon for visual alignment**

The icon with `shrink-0` may need `mt-0.5` to align with the first line of text when using `items-start`:

```tsx
// Before
className="h-5 w-5 shrink-0"

// After
className="mt-0.5 h-5 w-5 shrink-0 sm:mt-0"
```

**Step 3: Run tests**

Run: `npm test -- __tests__/components/PaymentBanner.test.tsx`
Expected: All 17 tests pass.

**Step 4: Commit**

```bash
git add components/payment/PaymentBanner.tsx
git commit -m "fix: top-align payment banner icon on mobile when text wraps"
```

---

## Task 11: Add Refresh Button to Schedule Page

**Files:**
- Modify: `app/(member)/member/schedule/MemberScheduleClient.tsx`

**Context:** Mobile users instinctively pull down to refresh. Since true pull-to-refresh is complex in Next.js App Router, add a visible "Refresh" button near the week navigation.

**Step 1: Add a refresh button**

In `MemberScheduleClient.tsx`, add a refresh button in the page header area:

```tsx
import { useRouter } from "next/navigation";

// Inside the component:
const router = useRouter();

// In the JSX, near the page header:
<button
  onClick={() => router.refresh()}
  className="rounded-lg p-2 text-surface-400 hover:bg-surface-800 hover:text-surface-200 transition-colors"
  aria-label="Refresh schedule"
>
  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
      clipRule="evenodd"
    />
  </svg>
</button>
```

**Step 2: Run tests**

Run: `npm test`
Expected: All tests pass.

**Step 3: Commit**

```bash
git add app/(member)/member/schedule/MemberScheduleClient.tsx
git commit -m "feat: add refresh button to member schedule page"
```

---

## Task 12: Compact "Who's Coming" List on Mobile

**Files:**
- Modify: `app/(member)/member/session/[id]/MemberSessionDetailClient.tsx:282-294`
- Test: `__tests__/components/MemberSessionDetailClient.test.tsx`

**Context:** Each name in the "Who's Coming" list takes a full row. With 15+ members, this creates a long scroll. On mobile, use horizontal wrapping chips instead.

**Step 1: Change list layout to responsive chips**

Replace the "Who's Coming" list (around line 282):

```tsx
// Before
<div className="mt-4 space-y-1.5">
  {session.comingMemberNames.map((name) => (
    <div
      key={name}
      className="flex items-center gap-2 rounded-md bg-success-600/10 px-3 py-1.5"
    >
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-success-700 text-xs font-bold text-white">
        {name.charAt(0).toUpperCase()}
      </div>
      <p className="text-sm text-surface-200">{name}</p>
    </div>
  ))}
</div>

// After
<div className="mt-4 flex flex-wrap gap-2 sm:flex-col sm:gap-1.5">
  {session.comingMemberNames.map((name) => (
    <div
      key={name}
      className="flex items-center gap-1.5 rounded-full bg-success-600/10 px-3 py-1.5 sm:rounded-md sm:gap-2"
    >
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-success-700 text-xs font-bold text-white shrink-0">
        {name.charAt(0).toUpperCase()}
      </div>
      <p className="text-sm text-surface-200 truncate">{name}</p>
    </div>
  ))}
</div>
```

On mobile: horizontal wrapping pills. On `sm:` and up: vertical list (original layout).

**Step 2: Run tests**

Run: `npm test -- __tests__/components/MemberSessionDetailClient.test.tsx`
Expected: All tests pass. Tests check for name text, not layout classes.

**Step 3: Commit**

```bash
git add app/(member)/member/session/[id]/MemberSessionDetailClient.tsx
git commit -m "feat: compact who's-coming list as horizontal chips on mobile"
```

---

## Task 13: DatePicker Viewport Clamping

**Files:**
- Modify: `components/ui/DatePicker.tsx`
- Test: `__tests__/components/DatePicker.test.tsx`

**Context:** The calendar dropdown uses `fixed` positioning calculated from the input's bounding rect. On small screens, it can extend off-screen. Add viewport boundary clamping.

**Step 1: Add viewport clamping to dropdown positioning**

Find the positioning logic in `DatePicker.tsx` where `top` and `left` are calculated. After the calculation, add clamping:

```tsx
// After calculating top and left from getBoundingClientRect():
const dropdownWidth = 320; // approximate calendar width
const dropdownHeight = 340; // approximate calendar height

// Clamp left so dropdown doesn't overflow right edge
const clampedLeft = Math.min(left, window.innerWidth - dropdownWidth - 8);
// Clamp left so dropdown doesn't go off left edge
const finalLeft = Math.max(8, clampedLeft);

// If dropdown would overflow bottom, show above the input instead
const finalTop = top + dropdownHeight > window.innerHeight
  ? top - dropdownHeight - 4
  : top;
```

Use `finalLeft` and `finalTop` for the dropdown position.

**Step 2: Run tests**

Run: `npm test -- __tests__/components/DatePicker.test.tsx`
Expected: All 64 tests pass.

**Step 3: Commit**

```bash
git add components/ui/DatePicker.tsx
git commit -m "fix: clamp DatePicker dropdown position to viewport boundaries"
```

---

## Task 14: Add Bottom Navigation Bar for Mobile

**Files:**
- Create: `components/layout/BottomNav.tsx`
- Modify: `app/(member)/layout.tsx`
- Modify: `app/(trainer)/layout.tsx` (if exists, otherwise the trainer route group layout)
- Create: `__tests__/components/BottomNav.test.tsx`

**Context:** This is the highest-impact change. Members and trainers currently need the hamburger menu for every navigation action. A fixed bottom nav bar (3-4 items) visible only on mobile (`md:hidden`) follows the standard mobile app pattern.

**Step 1: Write the failing test**

Create `__tests__/components/BottomNav.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BottomNav } from "@/components/layout/BottomNav";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/member/schedule",
}));

describe("BottomNav", () => {
  it("renders member navigation items", () => {
    render(<BottomNav role="MEMBER" />);
    expect(screen.getByLabelText("Schedule")).toBeInTheDocument();
    expect(screen.getByLabelText("Notifications")).toBeInTheDocument();
    expect(screen.getByLabelText("Profile")).toBeInTheDocument();
  });

  it("renders trainer navigation items", () => {
    render(<BottomNav role="TRAINER" />);
    expect(screen.getByLabelText("Schedule")).toBeInTheDocument();
    expect(screen.getByLabelText("Payments")).toBeInTheDocument();
    expect(screen.getByLabelText("Notifications")).toBeInTheDocument();
  });

  it("does not render for owner role", () => {
    const { container } = render(<BottomNav role="OWNER" />);
    expect(container.firstChild).toBeNull();
  });

  it("highlights the active route", () => {
    render(<BottomNav role="MEMBER" />);
    const scheduleLink = screen.getByLabelText("Schedule");
    expect(scheduleLink.className).toContain("text-primary-400");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/components/BottomNav.test.tsx`
Expected: FAIL — module not found.

**Step 3: Create the BottomNav component**

Create `components/layout/BottomNav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type UserRole = "OWNER" | "TRAINER" | "MEMBER";

interface BottomNavProps {
  role: UserRole;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const MEMBER_ITEMS: NavItem[] = [
  {
    href: "/member/schedule",
    label: "Schedule",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  {
    href: "/member/notifications",
    label: "Notifications",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
      </svg>
    ),
  },
  {
    href: "/member/profile",
    label: "Profile",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
];

const TRAINER_ITEMS: NavItem[] = [
  {
    href: "/trainer/schedule",
    label: "Schedule",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  {
    href: "/trainer/payments",
    label: "Payments",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
        <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
        <path
          fillRule="evenodd"
          d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  {
    href: "/trainer/notifications",
    label: "Notifications",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
      </svg>
    ),
  },
];

export function BottomNav({ role }: BottomNavProps): React.ReactElement | null {
  const pathname = usePathname();

  if (role === "OWNER") return null;

  const items = role === "MEMBER" ? MEMBER_ITEMS : TRAINER_ITEMS;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-surface-700 bg-surface-900/95 backdrop-blur-sm md:hidden"
      aria-label="Mobile navigation"
    >
      <div className="mx-auto flex max-w-md items-center justify-around">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className={`flex flex-col items-center gap-1 px-3 py-2.5 text-xs transition-colors ${
                isActive
                  ? "text-primary-400"
                  : "text-surface-400 hover:text-surface-200"
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export type { BottomNavProps };
```

**Step 4: Add BottomNav to member layout**

In `app/(member)/layout.tsx`, import and render BottomNav. Also add `pb-16 md:pb-0` to the main content area so content isn't hidden behind the nav.

```tsx
import { BottomNav } from "@/components/layout/BottomNav";

// In the layout JSX, after the main content container:
<BottomNav role="MEMBER" />

// Add to the main content wrapper:
<main className="mx-auto max-w-7xl px-4 py-6 pb-20 sm:px-6 md:pb-6 lg:px-8">
```

**Step 5: Add BottomNav to trainer layout**

Same pattern as member layout but with `role="TRAINER"`.

**Step 6: Run tests**

Run: `npm test -- __tests__/components/BottomNav.test.tsx`
Expected: All 4 tests pass.

Run: `npm test`
Expected: Full suite passes.

**Step 7: Commit**

```bash
git add components/layout/BottomNav.tsx __tests__/components/BottomNav.test.tsx app/(member)/layout.tsx app/(trainer)/layout.tsx
git commit -m "feat: add bottom navigation bar for mobile members and trainers"
```

---

## Task 15: Add Haptic Feedback on Vote Confirmation

**Files:**
- Modify: `app/(member)/member/session/[id]/MemberSessionDetailClient.tsx:94-96`

**Context:** After tapping "I'm Coming", the only feedback is a toast. On Android, `navigator.vibrate(50)` adds tactile confirmation. Degrades gracefully on iOS.

**Step 1: Add haptic feedback in vote success handler**

In `MemberSessionDetailClient.tsx`, after line 96 (the `setCurrentVote` call inside the success branch):

```tsx
if (res.ok) {
  setCurrentVote(attending);
  // Haptic feedback on mobile (supported on Android)
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(50);
  }
  addToast({
    // ...existing toast
  });
```

**Step 2: Run tests**

Run: `npm test -- __tests__/components/MemberSessionDetailClient.test.tsx`
Expected: All tests pass. `navigator.vibrate` won't exist in jsdom but the `"vibrate" in navigator` check handles that.

**Step 3: Commit**

```bash
git add app/(member)/member/session/[id]/MemberSessionDetailClient.tsx
git commit -m "feat: add haptic feedback on successful vote for mobile"
```

---

## Execution Order

Tasks are ordered by dependency and impact:

1. **Tasks 1-2** (button touch targets) — foundation, affects everything downstream
2. **Tasks 3-4** (voting stack + modal padding) — member-critical
3. **Task 5** (session header restructure) — member-critical
4. **Tasks 6-8** (lockout, mobile menu, week nav) — quick wins
5. **Task 9** (vote status border) — visual enhancement
6. **Tasks 10-11** (banner alignment, refresh button) — polish
7. **Task 12** (compact who's coming) — layout improvement
8. **Task 13** (DatePicker clamping) — edge case fix
9. **Task 14** (bottom nav) — biggest structural change, do last so all other changes are stable
10. **Task 15** (haptic feedback) — final polish

---

## Verification Checklist

After all tasks are complete:

- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm run lint` — zero new warnings (5 pre-existing are OK)
- [ ] `npm test` — all tests pass (1,373+ existing + new BottomNav + SessionCard tests)
- [ ] Manual test on mobile viewport (Chrome DevTools, 375px width):
  - [ ] Voting buttons stack and are easy to tap
  - [ ] Modal content doesn't feel cramped
  - [ ] Session cards show colored left border for votes
  - [ ] Bottom nav appears on member/trainer pages
  - [ ] Bottom nav hides on desktop (>768px)
  - [ ] Mobile hamburger menu closes on outside tap
  - [ ] DatePicker dropdown stays within viewport
  - [ ] Payment banner text wraps with icon top-aligned
