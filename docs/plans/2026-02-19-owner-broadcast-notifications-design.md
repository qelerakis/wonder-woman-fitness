# Owner Broadcast Notifications — Design Document

**Date**: 2026-02-19
**Status**: Approved

## Overview

Add the ability for the owner to compose and send custom notifications to targeted groups of members. A "Send Notification" button on the owner's notifications page opens a modal with a single-step form for audience selection and message composition.

## Audience Targeting

Radio button selector with five options:

| Option | Label | Additional UI |
|---|---|---|
| `ALL` | All active members | None — targets status `ACTIVE` or `TRIAL` |
| `TRIAL` | Trial members only | None — filters to status `TRIAL` |
| `SESSION_SLOT` | Members from a session slot | Dropdown of recurring slots (e.g., "Monday 9:00 AM") |
| `PAYMENT_STATUS` | Members by payment status | Dropdown: Grace Period, Locked |
| `INDIVIDUAL` | Select specific members | Checklist of active members with search/filter |

A label below the selector shows the live recipient count: *"Will notify 8 members"*.

## Message Composition

- **Title**: single-line text input, required, 1-100 characters
- **Message**: multi-line textarea, required, 1-500 characters, with character count

## Send Flow

1. Owner fills in audience + message, clicks "Send Notification"
2. Button disabled if 0 recipients or empty title/body
3. `ConfirmationModal` appears: "Send this notification to X members?"
4. On confirm: `POST /api/notifications/broadcast`
5. Success: toast "Notification sent to X members", modal closes, list refreshes
6. Error: toast with error message, modal stays open

## Notification Delivery

- Uses existing `MANUAL_REMINDER` notification type (already in schema, never dispatched)
- Both in-app and email (consistent with all other notifications)
- Uses `dispatchNotificationToMany()` for fan-out with `Promise.allSettled()`
- Purple accent color and bell icon in email template (already configured)

## API Endpoints

### POST /api/notifications/broadcast

- **Auth**: Owner only
- **Rate limit**: 10 requests per minute

**Request body** (Zod-validated):
```json
{
  "audience": "ALL | TRIAL | SESSION_SLOT | PAYMENT_STATUS | INDIVIDUAL",
  "slotId": "string (required when audience = SESSION_SLOT)",
  "paymentStatus": "GRACE_PERIOD | LOCKED (required when audience = PAYMENT_STATUS)",
  "memberIds": ["string[] (required when audience = INDIVIDUAL)"],
  "title": "string (1-100 chars)",
  "body": "string (1-500 chars)"
}
```

**Logic**:
1. Validate request body
2. Resolve audience to user IDs:
   - `ALL`: query members with status `ACTIVE` or `TRIAL`
   - `TRIAL`: query members with status `TRIAL`
   - `SESSION_SLOT`: query members assigned to sessions with the given `recurringSlotId`
   - `PAYMENT_STATUS`: compute payment status for all active members via `getPaymentStatus()`, filter by requested status
   - `INDIVIDUAL`: use provided `memberIds` (validate they exist and are active members)
3. Call `dispatchNotificationToMany(userIds, "MANUAL_REMINDER", title, body)`
4. Return `{ data: { sentCount: number } }`

### GET /api/notifications/broadcast/recipients

- **Auth**: Owner only
- **Query params**: `audience`, `slotId`, `paymentStatus`
- **Response**: `{ data: { count: number, members: { id: string, name: string }[] } }`

Used by the modal to show live recipient count and populate the individual member checklist.

## New Files

- `components/notification/SendNotificationModal.tsx` — client component (form + audience UI)
- `app/api/notifications/broadcast/route.ts` — POST send endpoint
- `app/api/notifications/broadcast/recipients/route.ts` — GET recipients endpoint

## Modified Files

- `app/(owner)/owner/notifications/page.tsx` — pass data for modal
- `app/(owner)/owner/notifications/NotificationsClient.tsx` — add button + modal state

## Schema Changes

None. `MANUAL_REMINDER` already exists in the `NotificationType` enum.

## Testing

New test file `__tests__/broadcast-notifications.test.ts`:

- Auth/role checks (only owner can access)
- All 5 audience types resolve correct recipients
- Zod validation (missing fields, invalid audience, too-long title/body)
- Payment status computation for GRACE_PERIOD/LOCKED targeting
- Conditional field requirements (slotId, paymentStatus, memberIds)
- Rate limiting (10/min)
- Recipient count endpoint
- Empty audience returns 0 / prevents send
