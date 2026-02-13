# Session Assignment Management — Design

## Overview
Add trainer and member management to workout sessions. Three capabilities:
1. Owner manages trainers AND members for any session
2. Trainers manage members for their assigned sessions
3. Members see all sessions on calendar with visual distinction (assigned vs available)

## API Endpoints

### POST /api/sessions/[id]/trainers (Owner only)
- Body: `{ userId: string, action: "add" | "remove" }`
- Validates: user is TRAINER, session exists, session not CANCELLED
- On add: creates SessionTrainer record
- On remove: deletes SessionTrainer record
- Returns updated trainer list

### POST /api/sessions/[id]/members (Owner + assigned Trainers)
- Body: `{ userId: string, action: "add" | "remove" }`
- Validates: user is active MEMBER (not DEPARTED), session exists, not CANCELLED
- On add: validates capacity < MAX_CLASS_SIZE (20), creates SessionMember record
- On remove: deletes SessionMember record + cleans up any Vote for that member
- Returns updated member list

## UI Changes

### Owner Session Detail (`/owner/session/[id]`)
- "Manage Trainers" section: inline toggle list of all trainers
- "Manage Members" section: inline toggle list of all active members
- Shows capacity count (current / 20)
- Optimistic toggle UI with rollback on error
- Uses existing `allTrainers` and `allMembers` props (currently unused)

### Trainer Session Detail (`/trainer/session/[id]`)
- "Manage Members" section: same toggle list pattern as owner
- Fetch allMembers in server component, pass to client
- No trainer management (owner-only)

### Member Schedule Calendar
- API returns ALL sessions for the week (not just assigned)
- Each session includes `isAssigned: boolean`
- Assigned sessions: full color cards (current style)
- Unassigned + voting enabled: outlined/semi-transparent with "Voting Open" badge
- Unassigned + no voting: outlined, no badge
- Member detail page: read-only for unassigned sessions, no vote buttons

## Testing
- ~40-50 new test cases in `__tests__/api/session-assignments.test.ts`
- Trainer add/remove, member add/remove, capacity, authorization, vote cleanup
- Update existing session GET tests for `isAssigned` flag
