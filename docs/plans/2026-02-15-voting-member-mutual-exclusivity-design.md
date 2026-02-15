# Voting & Member Assignment Mutual Exclusivity

**Date**: 2026-02-15
**Status**: Approved

## Problem

Currently, when voting is enabled on a session, the member assignment list (AssignmentToggleList) remains visible alongside vote results. Owners/trainers can assign members while voting is active, which creates conflicting mechanics — voting is meant to let members self-select attendance, while assignment is manual.

## Design

Voting and member assignment become **mutually exclusive** on the session detail page for both owner and trainer roles.

### Behavior

- **Voting ON**: Member assignment list is hidden. Only vote results (VoteSummary) are shown.
- **Voting OFF**: Member assignment list is shown. Vote results are hidden.

### Toggle Transitions

- **Enabling voting**: API clears all `SessionMember` records for the session (atomic transaction). Clean slate for voting.
- **Disabling voting**: API clears all `Vote` records for the session (atomic transaction). Clean slate for manual assignment.

No auto-assignment of "Coming" voters when disabling. No preservation of assignments when enabling. Both directions start fresh.

### What Doesn't Change

- Trainer assignment (AssignmentToggleList for trainers) — always visible regardless of voting state
- SessionCard component — no changes
- Member session detail page — no changes
- VoteSummary component — no changes
- AssignmentToggleList component — no changes

## Files to Modify

1. `app/api/sessions/[id]/route.ts` — add cleanup logic to PATCH handler when toggling `votingEnabled`
2. `app/(owner)/owner/session/[id]/SessionDetailClient.tsx` — conditionally hide member AssignmentToggleList when voting enabled
3. `app/(trainer)/trainer/session/[id]/TrainerSessionDetailClient.tsx` — conditionally hide member AssignmentToggleList when voting enabled
4. `__tests__/api/sessions.test.ts` — comprehensive tests for toggle cleanup behavior

## Test Plan

Extensive tests covering:
- Enabling voting clears member assignments
- Disabling voting clears votes
- Enabling voting on session with no members (no errors)
- Disabling voting on session with no votes (no errors)
- Toggle transitions preserve session integrity
- Edge cases: toggling on already-enabled, toggling on cancelled sessions, capacity checks after toggle
