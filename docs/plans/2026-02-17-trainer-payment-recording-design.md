# Trainer Payment Recording — Design

**Date:** 2026-02-17
**Status:** Approved

## Goal

Allow trainers to record member payments. Members pay trainers directly (cash), and trainers need a way to log those payments in the system.

## Design Decisions

- **Record only** — Trainers can record new payments but cannot edit or delete them. Owner retains full control for corrections.
- **All active members** — Trainers can see payment status and record payments for any member, not scoped to their assigned sessions.
- **Dedicated page** — New `/trainer/payments` page, mirroring the owner's payments page with reduced capabilities.
- **Revenue visible** — Trainers see this-month revenue amounts (MKD), not just counts.
- **No all-time stats** — Summary cards show this-month revenue, paid count, unpaid count (3 cards).
- **No notes** — Trainers cannot add or see payment notes.

## Changes

### 1. API: `POST /api/payments`

Expand the role check from `OWNER`-only to `OWNER || TRAINER`. No other logic changes — `recordedById` already captures who recorded the payment.

No changes to `GET` (already allows TRAINER), `PATCH`, or `DELETE` (stay OWNER-only).

### 2. New Page: `/trainer/payments`

**Server Component** (`app/(trainer)/trainer/payments/page.tsx`):
- Auth check: must be TRAINER
- Fetch this month's payments
- Fetch all active members with their payment records
- Compute payment status for each via `getPaymentStatus()`
- Pass to `TrainerPaymentsClient`

**Client Component** (`TrainerPaymentsClient.tsx`):

Summary cards (3):
- This Month revenue (MKD)
- Paid Members count
- Unpaid Members count

Unpaid Members section:
- Members in GRACE_PERIOD or LOCKED status
- Name + status badge (no link to member detail)

Payment History table:
- Columns: Member (name only), Amount, Period, Paid Date, Recorded By
- No edit/delete buttons
- No notes column
- Filterable by month/year, searchable by member name

"Record Payment" modal:
- Member dropdown (all active/trial members)
- Amount (MKD)
- Paid At (datetime-local)
- Period Start (date)
- Period End (date)
- No notes field

### 3. Navigation

Add "Payments" link to the trainer sidebar/navigation.

## What Does NOT Change

- Prisma schema (no migration needed)
- `lib/payment-logic.ts` (status computation is role-agnostic)
- Owner payments pages (full edit/delete/notes retained)
- `PATCH /api/payments/[id]` (OWNER-only)
- `DELETE /api/payments/[id]` (OWNER-only)
