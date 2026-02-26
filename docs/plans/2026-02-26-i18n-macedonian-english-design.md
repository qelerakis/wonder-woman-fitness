# Internationalization (i18n) — Macedonian & English

**Date**: 2026-02-26
**Status**: Design approved

---

## Overview

Add Macedonian (default) and English language support to Wonder Woman Fitness. Every role (Owner, Trainer, Member) can switch between languages via a toggle in the Header. The preference is stored in a cookie and persists across authenticated and unauthenticated pages.

---

## Architecture

- **Library**: `next-intl` — cookie-based locale detection, no URL rewriting
- **Languages**: `mk` (default), `en`
- **Locale storage**: `NEXT_LOCALE` cookie
- **Server Components**: `getTranslations()` from `next-intl/server`
- **Client Components**: `useTranslations()` from `next-intl`
- **Date/time localization**: `date-fns` with `mk` and `enUS` locales
- **URLs**: Unchanged — no `[locale]` prefix in routes

---

## What Changes

### New Files

| File | Purpose |
|------|---------|
| `messages/en.json` | English translations (~500-640 keys) |
| `messages/mk.json` | Macedonian translations (~500-640 keys) |
| `lib/i18n.ts` | next-intl request config (locale detection, message loading) |
| `components/layout/LanguageToggle.tsx` | "MK \| EN" toggle in the Header |

### Modified Files

| File | Change |
|------|--------|
| `middleware.ts` | Add next-intl locale detection from cookie |
| `app/layout.tsx` | Wrap with `NextIntlClientProvider`, dynamic `lang` attribute |
| `next.config.ts` | Add `next-intl` plugin if needed |
| `components/layout/Header.tsx` | Add `LanguageToggle` component |
| ~56 components | Replace hardcoded strings with `t()` calls |

### Unchanged

- All URL paths (`/owner/dashboard`, `/member/schedule`, etc.)
- Route group structure
- API routes (return data, not user-facing strings)
- Business logic
- Database schema

---

## Translation Key Structure

```json
{
  "common": { "save", "cancel", "delete", "loading", "confirm", ... },
  "auth": { "login": { "title", "email", "password", ... }, "register": { ... } },
  "navigation": { "schedule", "members", "payments", "signOut", ... },
  "schedule": { "cancelled", "voting", "going", "notGoing", ... },
  "payments": { "banner": { ... }, "form": { ... }, "status": { ... } },
  "dashboard": { "activeMembers", "revenue", "outstanding", ... },
  "notifications": { "title", "markAllRead", "send": { ... } },
  "members": { "assign", "remove", "departed", ... },
  "sessions": { "create": { ... }, "detail": { ... }, "attendance": { ... } },
  "profile": { "title", "name", "email", ... },
  "validation": { "required", "invalidEmail", "positiveAmount", ... }
}
```

---

## Component Refactoring Pattern

**Server Components**:
```typescript
import { getTranslations } from "next-intl/server";

export default async function MembersPage() {
  const t = await getTranslations("members");
  return <h1>{t("title")}</h1>;
}
```

**Client Components**:
```typescript
import { useTranslations } from "next-intl";

export default function SessionCard({ ... }) {
  const t = useTranslations("schedule");
  return <Badge>{t("cancelled")}</Badge>;
}
```

**Interpolation & Pluralization**:
```typescript
// en.json: "daysRemaining": "{count, plural, one {# day} other {# days}} remaining"
// mk.json: "daysRemaining": "Преостануваат {count, plural, one {# ден} other {# дена}}"
t("daysRemaining", { count: 5 })
```

**Date Formatting**:
```typescript
import { mk, enUS } from "date-fns/locale";

function getDateLocale(locale: string) {
  return locale === "mk" ? mk : enUS;
}
format(date, "EEEE, d MMMM", { locale: getDateLocale(locale) })
```

**Language Toggle**: Small client component in the Header. Reads current locale, renders "MK | EN" buttons, sets `NEXT_LOCALE` cookie, reloads the page.

---

## Scope

### In Scope

- All user-facing text in ~56 components
- Page titles and metadata
- Form labels, placeholders, validation errors
- Toast messages, confirmation dialogs
- Status badges (Paid, Locked, Grace Period, etc.)
- Navigation items and header text
- Date/time formatting with locale-aware output
- Pluralization (days remaining, member counts, etc.)
- Language toggle in Header
- Cookie-based persistence across auth and app pages

### Out of Scope

- API route error messages (client code translates them)
- Email templates (Resend — separate effort)
- Database seed data
- Prisma schema changes (no DB-stored preference)
- URL structure changes
- Test file string translations

---

## Testing Strategy

- Mock `next-intl` in existing tests so 1,860 tests keep passing with English strings
- Add tests for the LanguageToggle component
- Add tests verifying `t()` is called in key components
- Existing tests use English assertions — the mock returns the translation key or English text
