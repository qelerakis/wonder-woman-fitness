# Auth Animated Background Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a floating gradient orb animation behind all auth pages (login, register, etc.) for an Apple-inspired premium feel.

**Architecture:** A new `AuthBackground` client component renders 3 blurred gradient orbs with independent CSS keyframe animations. It is placed inside the existing `app/(auth)/layout.tsx` behind the card. `prefers-reduced-motion` disables animation for accessibility.

**Tech Stack:** React client component, Tailwind CSS, CSS `@keyframes`

---

### Task 1: Add keyframe animations to globals.css

**Files:**
- Modify: `app/globals.css:64-74` (after existing slideIn keyframes)

**Step 1: Add the 3 orb keyframes and reduced-motion rule**

Add immediately after the existing `slideIn` keyframe block (after line 74):

```css
/* Auth background orb animations */
@keyframes orb1 {
  0%, 100% {
    transform: translate(0, 0) scale(1);
    opacity: 0.45;
  }
  33% {
    transform: translate(30px, -40px) scale(1.1);
    opacity: 0.55;
  }
  66% {
    transform: translate(-20px, 20px) scale(1.05);
    opacity: 0.4;
  }
}

@keyframes orb2 {
  0%, 100% {
    transform: translate(0, 0) scale(1);
    opacity: 0.35;
  }
  33% {
    transform: translate(-35px, 25px) scale(1.08);
    opacity: 0.45;
  }
  66% {
    transform: translate(25px, -30px) scale(1.02);
    opacity: 0.3;
  }
}

@keyframes orb3 {
  0%, 100% {
    transform: translate(0, 0) scale(0.95);
    opacity: 0.3;
  }
  50% {
    transform: translate(10px, -30px) scale(1.1);
    opacity: 0.45;
  }
}

@media (prefers-reduced-motion: reduce) {
  .auth-orb {
    animation: none !important;
  }
}
```

**Step 2: Verify CSS is valid**

Run: `npx tsc --noEmit`
Expected: PASS (CSS changes don't affect TS)

**Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat: add CSS keyframes for auth background orb animations"
```

---

### Task 2: Create AuthBackground component

**Files:**
- Create: `components/layout/AuthBackground.tsx`

**Step 1: Create the component**

```tsx
"use client";

export function AuthBackground(): React.ReactElement {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* Orb 1 — Large, top-right */}
      <div
        className="auth-orb absolute -top-32 -right-32 h-[500px] w-[500px] rounded-full opacity-45 blur-[100px] sm:h-[600px] sm:w-[600px]"
        style={{
          background:
            "radial-gradient(circle, var(--color-primary-600), var(--color-primary-800) 70%, transparent)",
          animation: "orb1 20s ease-in-out infinite",
          willChange: "transform, opacity",
        }}
      />

      {/* Orb 2 — Medium, bottom-left */}
      <div
        className="auth-orb absolute -bottom-24 -left-24 h-[350px] w-[350px] rounded-full opacity-35 blur-[100px] sm:h-[450px] sm:w-[450px]"
        style={{
          background:
            "radial-gradient(circle, var(--color-primary-500), var(--color-primary-700) 70%, transparent)",
          animation: "orb2 25s ease-in-out infinite",
          willChange: "transform, opacity",
        }}
      />

      {/* Orb 3 — Small, center-left accent */}
      <div
        className="auth-orb absolute top-1/3 -left-12 h-[250px] w-[250px] rounded-full opacity-30 blur-[80px] sm:h-[300px] sm:w-[300px]"
        style={{
          background:
            "radial-gradient(circle, var(--color-primary-400), var(--color-surface-900) 70%, transparent)",
          animation: "orb3 18s ease-in-out infinite",
          willChange: "transform, opacity",
        }}
      />
    </div>
  );
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add components/layout/AuthBackground.tsx
git commit -m "feat: create AuthBackground component with floating gradient orbs"
```

---

### Task 3: Integrate AuthBackground into auth layout

**Files:**
- Modify: `app/(auth)/layout.tsx`

**Step 1: Add AuthBackground to layout**

The current layout outer div is:
```tsx
<div className="relative flex min-h-screen items-center justify-center bg-surface-950 px-4">
```

Change it to add `overflow-hidden`, import and render `<AuthBackground />`, and add `relative z-10` to the content wrapper:

```tsx
import { getTranslations } from "next-intl/server";
import { LanguageToggle } from "@/components/layout/LanguageToggle";
import { AuthBackground } from "@/components/layout/AuthBackground";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tBrand = await getTranslations("brand");

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface-950 px-4">
      {/* Animated Background */}
      <AuthBackground />

      {/* Language Toggle */}
      <div className="absolute top-4 right-4 z-10">
        <LanguageToggle />
      </div>

      <div className="relative z-10 w-full max-w-md pt-14 sm:pt-0">
        {/* Brand Logo */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-primary-400">
            {tBrand("name")}
          </h1>
          <p className="mt-2 text-sm text-surface-400">
            {tBrand("tagline")}
          </p>
        </div>

        {/* Auth Card */}
        <div className="rounded-xl border border-surface-700 bg-surface-900 p-8 shadow-lg">
          {children}
        </div>
      </div>
    </div>
  );
}
```

Key changes:
- Added `overflow-hidden` to outer div (prevents orb bleed scrollbars)
- Added `<AuthBackground />` as first child
- Added `relative z-10` to content wrapper so card sits above orbs

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Run existing auth layout tests**

Run: `npm test -- app/(auth)/__tests__/AuthLayout.test.tsx`
Expected: All 20+ tests PASS (AuthBackground is `aria-hidden` and `pointer-events-none`, so no functional impact)

**Step 4: Run login page tests**

Run: `npm test -- app/(auth)/login/__tests__/LoginPage.test.tsx`
Expected: All 15 tests PASS

**Step 5: Run lint**

Run: `npm run lint`
Expected: No new warnings

**Step 6: Commit**

```bash
git add app/(auth)/layout.tsx
git commit -m "feat: integrate animated background into auth layout"
```

---

### Task 4: Visual verification

**Step 1: Start dev server and verify**

Run: `npm run dev`

Verify on the login page (`/login`):
- 3 purple gradient orbs visible behind the card
- Orbs animate slowly and independently
- Card and form remain fully readable
- No horizontal scrollbar appears
- Language toggle still visible and clickable

**Step 2: Check other auth pages**

Navigate to `/register`, `/forgot-password`, `/check-email` — all should show the same animated background.

**Step 3: Check mobile viewport**

Resize to ~375px width — orbs should scale down, no overflow, card still centered.

**Step 4: Run full test suite**

Run: `npm test`
Expected: All 1,860 tests PASS

**Step 5: Final commit (if any tweaks were needed)**

```bash
git commit -m "fix: polish auth background animation"
```
