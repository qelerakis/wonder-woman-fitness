# Design: Assigned Members Card for Member Session Detail

**Date:** 2026-02-25
**Status:** Approved

## Problem

Members in assignment-based (non-voting) sessions cannot see who else is in their group. The session detail page shows trainers and workout info but no member roster. Members want to know who they'll be training with.

## Decision

Add a "Members" card to the member session detail page that shows the roster of assigned members — names and avatar initials.

## Constraints

- Sessions are either voting-based or assignment-based, never both.
- For voting sessions, the existing "Who's Coming" card already shows attendee names. No changes needed there.
- The new card only appears for assignment-based sessions.
- Only members who are themselves assigned to the session can see the roster.

## Design

### What the card shows

- Header: "Members" with subtitle "X assigned"
- List of assigned members: avatar initial circle + full name
- Uses the same visual pattern as the existing "Who's Coming" card

### Visibility rules

The card renders when ALL of these are true:
1. The session is non-voting (`votingEnabled === false`)
2. The current user is assigned to this session (`isAssigned === true`)

### Where it appears

Right column of `/member/session/[id]`, alongside the Trainers card.

## Implementation

### Server component (`app/(member)/member/session/[id]/page.tsx`)

- The session query already includes `members` with `name`.
- Compute `isAssigned`: is the current user's ID in the session's members list?
- Extract `assignedMemberNames`: array of member name strings.
- Pass both to the client component.

### Client component (`MemberSessionDetailClient.tsx`)

- New card in the right column, conditionally rendered: `!votingEnabled && isAssigned`
- Renders avatar-initial + name list, same pattern as "Who's Coming" card.

## Out of scope

- No changes to SessionCard (weekly schedule view) — count stays as-is.
- No changes to voting-based sessions.
- No changes to owner/trainer views.
