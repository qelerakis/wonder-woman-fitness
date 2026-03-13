# Voting System Fixes — Design Document

**Date:** 2026-02-14
**Branch:** fix/attendance-voting-enabled

## Problem

When voting is enabled on a session, the "No Vote Yet" count shows negative numbers. Three related issues:

1. **Negative "No Vote Yet":** `totalMembers` counts only assigned members, but any active/trial member can vote. Votes exceed assigned count → negative.
2. **No one-vote-per-day enforcement:** A member can vote "Coming" on multiple sessions in the same day. Business rule: one "Coming" per day.
3. **No full-session enforcement:** When 30 members vote "Coming", voting should be disabled entirely.

## Design

### Fix 1: Vote Count Display

When voting is enabled, the total member pool = ALL active/trial members in the gym.

- **Owner/Trainer session detail pages:** Build `voteMembers` from all active/trial members cross-referenced with votes (not just assigned members).
- **Member session detail page:** Pass `totalActiveMembers` count. Compute `noVoteYet = totalActiveMembers - coming - notComing`.
- **VoteSummary component:** No changes needed — it already works with whatever member list is passed.

### Fix 2: One Vote Per Day

A member can only vote "Coming" on one session per day. "Not Coming" votes are unrestricted.

**API enforcement (`POST /api/votes`):**
- When `attending: true`, query for other sessions on the same day where this member already voted "Coming"
- If found, return 400: "You're already coming to the [time] session on [day]. Change that vote first."

**UI enforcement:**
- When member already has a "Coming" vote on another session that day, disable the "I'm Coming" button with explanation
- "Not Coming" button remains available

### Fix 3: Full Session Disables Voting

When `comingVotes >= MAX_CLASS_SIZE (30)`, all voting is disabled.

**API enforcement (`POST /api/votes`):**
- Count "Coming" votes for the session
- If >= 30, reject ALL votes with "This session is full"

**UI enforcement:**
- Show "Full" badge on session
- Hide/disable all vote buttons with "This session is full — voting is closed"

### Edge Cases

- Member already voted "Coming" but session fills up from other votes → their existing vote stands, but they can't change it
- Member votes "Not Coming" on a full session → blocked (all voting disabled when full)
- "Same day" is determined by `weekDate` + `dayOfWeek`/`customDay`, not calendar date

## Files to Change

| File | Change |
|------|--------|
| `app/api/votes/route.ts` | One-vote-per-day check, full-session check |
| `app/(member)/member/session/[id]/page.tsx` | Fetch total active members, pass same-day vote info |
| `app/(member)/member/session/[id]/MemberSessionDetailClient.tsx` | Use totalActiveMembers, disable Coming when committed elsewhere, show Full state |
| `app/(owner)/owner/session/[id]/page.tsx` | Build voteMembers from ALL active/trial members |
| `app/(trainer)/trainer/session/[id]/page.tsx` | Same as owner |
| `lib/voting-logic.ts` | Add `isSessionFull()` helper |
| Tests | Update votes.test.ts, voting-logic.test.ts |
