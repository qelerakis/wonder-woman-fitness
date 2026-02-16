# Payment Edit/Delete Capability — Design

**Date:** 2026-02-16
**Status:** Approved

## Problem

Once a payment is recorded, the owner can't fix mistakes or remove duplicates. For a cash-based business where amounts are manually typed, this is a real pain point.

## Current State

- `PATCH /api/payments/[id]` exists and works for editing (amount, paidAt, periodStart, periodEnd, notes)
- No DELETE endpoint
- No edit or delete buttons in the UI anywhere

## Design

### API: DELETE endpoint

Add `DELETE` handler to `app/api/payments/[id]/route.ts`:
- Auth: Owner only
- Verify payment exists → 404 if not
- Hard delete via `prisma.payment.delete()`
- Return `{ data: { id } }` with 200

No schema changes. No migration. No soft delete complexity.

### PaymentsClient.tsx (Owner payments table)

**Edit flow:**
- Pencil icon button on each payment row
- Clicking opens the existing "Record Payment" modal, pre-filled with payment data
- Member select is disabled (can't reassign a payment)
- Title changes to "Edit Payment", button to "Update Payment"
- Submits via `PATCH /api/payments/{id}` instead of `POST /api/payments`
- On close/success: clears editing state, resets form

**Delete flow:**
- Trash icon button next to the pencil
- Opens a confirmation modal (using existing Modal component)
- Body: "Are you sure you want to delete this payment of {amount} MKD for {member name}? This action cannot be undone."
- Cancel (secondary) + Delete (danger) buttons
- On confirm: `DELETE /api/payments/{id}`, success toast, refresh data

**State additions:**
- `editingPayment: Payment | null`
- `showDeleteConfirm: boolean` + `deletingPayment: Payment | null`

### PaymentHistory.tsx (Member detail page)

- Convert to client component
- Add pencil and trash icon buttons on each payment row
- Self-contained: edit modal + delete confirmation + API calls all inside the component
- Same edit/delete UX as PaymentsClient (reuse modal for edit, confirmation for delete)
- Receives `members` list prop for the member select (disabled during edit)

## Files to Touch

| File | Change |
|---|---|
| `app/api/payments/[id]/route.ts` | Add DELETE handler |
| `app/(owner)/payments/PaymentsClient.tsx` | Edit/delete buttons, reuse modal for edit, delete confirmation |
| `components/payment/PaymentHistory.tsx` | Convert to client component, add edit/delete UI |
| `app/api/__tests__/payments.test.ts` | Tests for DELETE endpoint |
| `app/(owner)/payments/__tests__/PaymentsClient.test.ts` | Tests for edit/delete flows |
| `components/payment/__tests__/PaymentHistory.test.ts` | New test file |

## Not Touched

- `prisma/schema.prisma` — no schema changes
- No migration
- No changes to existing payment queries
- `types/index.ts` — existing schemas are sufficient
