# Dashboard Attendance Refinements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix three dashboard attendance tracking issues: (1) VoteVsActual only counts voting sessions, (2) remove slot show-up rates and attendance trend charts, (3) member "Expected" includes sessions voted yes on.

**Architecture:** Modify the shared `computeAttendanceAnalytics()` function to accept a new `sessionVotes` parameter for vote-only sessions. Remove slot rates and trend computations. Update both consumers (dashboard page + analytics API) and the DashboardClient component to remove the two chart components.

**Tech Stack:** TypeScript, Vitest, Next.js App Router, Recharts (removed charts)

---

### Task 1: Update `computeAttendanceAnalytics` — remove slot rates & trend, add session votes param

**Files:**
- Modify: `lib/attendance-analytics.ts`

**Step 1: Update types — remove SlotRate, TrendEntry, add SessionVoteInput**

Remove these exported interfaces:
- `SlotRate` (lines 39–46)
- `TrendEntry` (lines 54–59)

Remove from `AttendanceAnalyticsResult`:
- `slotRates: SlotRate[]` (line 63)
- `trend: TrendEntry[]` (line 65)

Add new input interface:

```typescript
/** Minimal session-vote shape: one entry per session with its votes. */
export interface SessionVoteInput {
  sessionId: string;
  votes: Array<{ userId: string; attending: boolean }>;
}
```

Update `AttendanceAnalyticsResult`:

```typescript
export interface AttendanceAnalyticsResult {
  memberRates: MemberRate[];
  voteVsActual: VoteVsActualData;
}
```

**Step 2: Update function signature**

```typescript
export function computeAttendanceAnalytics(
  attendanceRecords: AttendanceRecordInput[],
  members: MemberInput[],
  sessionVotes: SessionVoteInput[]
): AttendanceAnalyticsResult {
```

**Step 3: Update member rates — merge attendance records + vote data**

Replace the current member rates computation (lines 93–120) with:

```typescript
// a) Per-member attendance rates
// "Expected" = unique sessions where member was assigned (has attendance record)
//              OR voted yes. The two paths are mutually exclusive.
// "Attended" = attendance records where present=true

// Track sessions from attendance records per member
const memberSessionsMap = new Map<string, Set<string>>();
const memberAttendedMap = new Map<string, number>();

for (const rec of attendanceRecords) {
  if (!memberSessionsMap.has(rec.userId)) {
    memberSessionsMap.set(rec.userId, new Set());
    memberAttendedMap.set(rec.userId, 0);
  }
  memberSessionsMap.get(rec.userId)!.add(rec.sessionId);
  if (rec.present) {
    memberAttendedMap.set(rec.userId, memberAttendedMap.get(rec.userId)! + 1);
  }
}

// Add sessions where member voted yes (mutually exclusive with assigned)
for (const sv of sessionVotes) {
  for (const vote of sv.votes) {
    if (vote.attending) {
      if (!memberSessionsMap.has(vote.userId)) {
        memberSessionsMap.set(vote.userId, new Set());
        memberAttendedMap.set(vote.userId, 0);
      }
      memberSessionsMap.get(vote.userId)!.add(sv.sessionId);
    }
  }
}

// Also count attendance for voting members who have attendance records
// (already handled above — attendance records cover both paths)

const memberRates: MemberRate[] = Array.from(memberSessionsMap.entries())
  .map(([userId, sessionIds]) => {
    const member = members.find((m) => m.id === userId);
    const expected = sessionIds.size;
    const attended = memberAttendedMap.get(userId) || 0;
    return {
      name: member?.name || "Unknown",
      expected,
      attended,
      rate: expected > 0 ? Math.round((attended / expected) * 100) : 0,
    };
  })
  .sort((a, b) => a.rate - b.rate);
```

**Step 4: Update VoteVsActual — only voting sessions**

Replace current VoteVsActual computation (lines 167–202) with:

```typescript
// b) Vote vs. Actual — only for voting sessions (sessions with ≥1 vote)
const votingSessionIds = new Set<string>();
for (const sv of sessionVotes) {
  if (sv.votes.length > 0) {
    votingSessionIds.add(sv.sessionId);
  }
}

let totalVotedComing = 0;
let totalActuallyAttended = 0;

// Count votes from voting sessions
for (const sv of sessionVotes) {
  if (votingSessionIds.has(sv.sessionId)) {
    totalVotedComing += sv.votes.filter((v) => v.attending).length;
  }
}

// Count actual attendance from voting sessions only
for (const rec of attendanceRecords) {
  if (votingSessionIds.has(rec.sessionId) && rec.present) {
    totalActuallyAttended += 1;
  }
}

const reliability =
  totalVotedComing > 0
    ? Math.round((totalActuallyAttended / totalVotedComing) * 100)
    : 0;

const voteVsActual: VoteVsActualData = {
  totalVotedComing,
  totalActuallyAttended,
  reliability,
};
```

**Step 5: Remove slot rates and trend computation entirely**

Delete the `DAY_NAMES` constant (lines 70–79), the entire slot rates section (b, lines 122–165), and the entire trend section (d, lines 204–231).

**Step 6: Update return value**

```typescript
return { memberRates, voteVsActual };
```

**Step 7: Run type check**

Run: `npx tsc --noEmit`
Expected: Errors in consumers (dashboard page, API route, DashboardClient, tests) — that's fine, we'll fix them next.

---

### Task 2: Update tests for `computeAttendanceAnalytics`

**Files:**
- Modify: `lib/__tests__/attendance-analytics.test.ts`

**Step 1: Update helper — add default sessionVotes param**

Update all `computeAttendanceAnalytics()` calls to pass a third argument `[]` (empty sessionVotes) where session votes aren't relevant. For tests that specifically test vote behavior, pass appropriate session vote data.

Update the `makeRecord` helper to remain as-is (still useful for attendance records).

Add a new helper:

```typescript
function makeSessionVote(
  sessionId: string,
  votes: Array<{ userId: string; attending: boolean }>
): { sessionId: string; votes: Array<{ userId: string; attending: boolean }> } {
  return { sessionId, votes };
}
```

**Step 2: Remove all `slotRates` tests**

Delete the entire `describe("slotRates", ...)` block (lines 112–226).

**Step 3: Remove all `trend` tests**

Delete the entire `describe("trend", ...)` block (lines 317–377).

**Step 4: Update empty input test**

```typescript
it("returns empty results for empty records", () => {
  const result = computeAttendanceAnalytics([], MEMBERS, []);
  expect(result.memberRates).toEqual([]);
  expect(result.voteVsActual).toEqual({
    totalVotedComing: 0,
    totalActuallyAttended: 0,
    reliability: 0,
  });
});
```

**Step 5: Update existing memberRates tests to pass `[]` as third arg**

Every `computeAttendanceAnalytics(records, MEMBERS)` becomes `computeAttendanceAnalytics(records, MEMBERS, [])`.

**Step 6: Add new tests for member rates with vote data**

```typescript
it("includes sessions where member voted yes in expected count", () => {
  // Member m1 assigned to s1 (attendance record), voted yes on s2 (no attendance record)
  const records: AttendanceRecordInput[] = [
    makeRecord({ sessionId: "s1", userId: "m1", present: true }),
  ];
  const sessionVotes = [
    makeSessionVote("s2", [{ userId: "m1", attending: true }]),
  ];

  const result = computeAttendanceAnalytics(records, MEMBERS, sessionVotes);
  const alice = result.memberRates.find((m) => m.name === "Alice");

  expect(alice!.expected).toBe(2); // s1 + s2
  expect(alice!.attended).toBe(1); // only s1 has present=true
  expect(alice!.rate).toBe(50);
});

it("does not double-count sessions in expected when member has both attendance record and vote", () => {
  // In practice this shouldn't happen (mutually exclusive), but guard against it
  const session = {
    weekDate: new Date("2026-02-16"),
    recurringSlotId: "slot-1",
    recurringSlot: { dayOfWeek: 1, startHour: 9 },
    customDay: null,
    customStartHour: null,
    votes: [{ userId: "m1", attending: true }],
  };
  const records: AttendanceRecordInput[] = [
    makeRecord({ sessionId: "s1", userId: "m1", present: true, session }),
  ];
  const sessionVotes = [
    makeSessionVote("s1", [{ userId: "m1", attending: true }]),
  ];

  const result = computeAttendanceAnalytics(records, MEMBERS, sessionVotes);
  const alice = result.memberRates.find((m) => m.name === "Alice");

  expect(alice!.expected).toBe(1); // deduped via Set
  expect(alice!.attended).toBe(1);
  expect(alice!.rate).toBe(100);
});

it("counts member who only voted yes with no attendance record as expected=1 attended=0", () => {
  const records: AttendanceRecordInput[] = [];
  const sessionVotes = [
    makeSessionVote("s1", [{ userId: "m1", attending: true }]),
  ];

  const result = computeAttendanceAnalytics(records, MEMBERS, sessionVotes);
  const alice = result.memberRates.find((m) => m.name === "Alice");

  expect(alice!.expected).toBe(1);
  expect(alice!.attended).toBe(0);
  expect(alice!.rate).toBe(0);
});

it("does not include sessions where member voted no in expected", () => {
  const records: AttendanceRecordInput[] = [];
  const sessionVotes = [
    makeSessionVote("s1", [{ userId: "m1", attending: false }]),
  ];

  const result = computeAttendanceAnalytics(records, MEMBERS, sessionVotes);
  expect(result.memberRates).toHaveLength(0); // m1 not counted
});

it("counts attendance records for voting members who showed up", () => {
  // m1 voted yes on s1, and has an attendance record showing present
  const records: AttendanceRecordInput[] = [
    makeRecord({ sessionId: "s1", userId: "m1", present: true }),
  ];
  const sessionVotes = [
    makeSessionVote("s1", [{ userId: "m1", attending: true }]),
  ];

  const result = computeAttendanceAnalytics(records, MEMBERS, sessionVotes);
  const alice = result.memberRates.find((m) => m.name === "Alice");

  expect(alice!.expected).toBe(1);
  expect(alice!.attended).toBe(1);
  expect(alice!.rate).toBe(100);
});
```

**Step 7: Update VoteVsActual tests to use sessionVotes**

The voteVsActual now uses `sessionVotes` for counting votes, not `attendanceRecords.session.votes`. Update accordingly:

```typescript
describe("voteVsActual", () => {
  it("computes vote reliability from voting sessions only", () => {
    const records: AttendanceRecordInput[] = [
      makeRecord({ sessionId: "s1", userId: "m1", present: true }),
      makeRecord({ sessionId: "s1", userId: "m2", present: false }),
    ];
    const sessionVotes = [
      makeSessionVote("s1", [
        { userId: "m1", attending: true },
        { userId: "m2", attending: true },
        { userId: "m3", attending: false },
      ]),
    ];

    const result = computeAttendanceAnalytics(records, MEMBERS, sessionVotes);

    expect(result.voteVsActual.totalVotedComing).toBe(2);
    expect(result.voteVsActual.totalActuallyAttended).toBe(1);
    expect(result.voteVsActual.reliability).toBe(50);
  });

  it("returns 0 reliability when no one voted coming", () => {
    const records: AttendanceRecordInput[] = [
      makeRecord({ sessionId: "s1", userId: "m1", present: true }),
    ];
    const sessionVotes = [
      makeSessionVote("s1", [{ userId: "m1", attending: false }]),
    ];

    const result = computeAttendanceAnalytics(records, MEMBERS, sessionVotes);

    expect(result.voteVsActual.totalVotedComing).toBe(0);
    expect(result.voteVsActual.reliability).toBe(0);
  });

  it("returns 0 when sessionVotes is empty", () => {
    const records: AttendanceRecordInput[] = [
      makeRecord({ sessionId: "s1", userId: "m1", present: true }),
    ];

    const result = computeAttendanceAnalytics(records, MEMBERS, []);

    expect(result.voteVsActual.totalVotedComing).toBe(0);
    expect(result.voteVsActual.totalActuallyAttended).toBe(0);
    expect(result.voteVsActual.reliability).toBe(0);
  });

  it("excludes non-voting sessions from actually-attended count", () => {
    // s1 is a voting session, s2 is an assigned session (no votes)
    const records: AttendanceRecordInput[] = [
      makeRecord({ sessionId: "s1", userId: "m1", present: true }),
      makeRecord({ sessionId: "s2", userId: "m2", present: true }),
    ];
    const sessionVotes = [
      makeSessionVote("s1", [{ userId: "m1", attending: true }]),
      // s2 has no votes — it's an assigned session
    ];

    const result = computeAttendanceAnalytics(records, MEMBERS, sessionVotes);

    expect(result.voteVsActual.totalVotedComing).toBe(1);
    expect(result.voteVsActual.totalActuallyAttended).toBe(1); // only s1
    expect(result.voteVsActual.reliability).toBe(100);
  });

  it("aggregates across multiple voting sessions", () => {
    const records: AttendanceRecordInput[] = [
      makeRecord({ sessionId: "s1", userId: "m1", present: true }),
      makeRecord({ sessionId: "s1", userId: "m2", present: true }),
      makeRecord({ sessionId: "s2", userId: "m1", present: false }),
    ];
    const sessionVotes = [
      makeSessionVote("s1", [
        { userId: "m1", attending: true },
        { userId: "m2", attending: true },
      ]),
      makeSessionVote("s2", [
        { userId: "m1", attending: true },
      ]),
    ];

    const result = computeAttendanceAnalytics(records, MEMBERS, sessionVotes);

    expect(result.voteVsActual.totalVotedComing).toBe(3);
    expect(result.voteVsActual.totalActuallyAttended).toBe(2);
    expect(result.voteVsActual.reliability).toBe(67);
  });
});
```

**Step 8: Update edge case tests**

Remove or update edge cases that reference `slotRates` or `trend`:

```typescript
it("handles single record", () => {
  const records: AttendanceRecordInput[] = [
    makeRecord({ sessionId: "s1", userId: "m1", present: true }),
  ];

  const result = computeAttendanceAnalytics(records, MEMBERS, []);

  expect(result.memberRates).toHaveLength(1);
});
```

Remove the `"handles session with null recurringSlot and null customDay"` test (only relevant to slot rates).

**Step 9: Run tests**

Run: `npm test -- lib/__tests__/attendance-analytics.test.ts`
Expected: All tests PASS.

---

### Task 3: Update dashboard page — pass sessionVotes to analytics

**Files:**
- Modify: `app/(owner)/dashboard/page.tsx`

**Step 1: Build sessionVotes from sessionsThisMonth**

After the existing `sessionsThisMonth` fetch, create the session votes array:

```typescript
// Build session votes for attendance analytics
const sessionVotes = sessionsThisMonth.map((s) => ({
  sessionId: s.id,
  votes: s.votes,
}));
```

**Step 2: Pass sessionVotes to computeAttendanceAnalytics**

```typescript
const { memberRates, voteVsActual } =
  computeAttendanceAnalytics(attendanceRecords, members, sessionVotes);
```

(Remove destructuring of `slotRates` and `trend: attendanceTrend`.)

**Step 3: Remove slotRates and attendanceTrend from DashboardClient props**

```typescript
return (
  <DashboardClient
    totalActive={totalActive}
    trialCount={trialMembers.length}
    totalRevenue={totalRevenue}
    membershipRevenue={membershipRevenue}
    privateRevenue={privateRevenue}
    outstandingCount={outstandingCount}
    gracePeriodCount={gracePeriodCount}
    lockedCount={lockedCount}
    popularSlots={popularSlots}
    initialMonth={now.getMonth()}
    initialYear={now.getFullYear()}
    initialMemberRates={memberRates}
    initialVoteVsActual={voteVsActual}
  />
);
```

**Step 4: Verify sessions query includes `id` field**

The current query uses `include` which returns all scalar fields including `id`. Confirmed — no change needed.

---

### Task 4: Update analytics API route — pass sessionVotes

**Files:**
- Modify: `app/api/analytics/route.ts`

**Step 1: Build sessionVotes from sessions**

```typescript
const sessionVotes = sessions.map((s) => ({
  sessionId: s.id,
  votes: s.votes,
}));
```

**Step 2: Update computeAttendanceAnalytics call**

```typescript
const { memberRates, voteVsActual } =
  computeAttendanceAnalytics(attendanceRecords, members, sessionVotes);
```

**Step 3: Remove slotRates and trend from response**

```typescript
attendance: {
  memberRates,
  voteVsActual,
},
```

**Step 4: Update CSV export — remove trend/slot references**

Remove these CSV rows:
```
csvRows.push(`Attendance - Weeks Tracked,${trend.length}`);
csvRows.push(`Attendance - Avg Show-up Rate,...`);
```

---

### Task 5: Update DashboardClient — remove charts and state

**Files:**
- Modify: `app/(owner)/dashboard/DashboardClient.tsx`

**Step 1: Remove dynamic imports for SlotAttendanceChart and AttendanceTrendChart**

Delete lines 36–42 (SlotAttendanceChart) and lines 52–58 (AttendanceTrendChart).

**Step 2: Remove SlotRate and TrendEntry interfaces**

Delete the `SlotRate` interface (lines 67–74) and `TrendEntry` interface (lines 82–87).

**Step 3: Remove from DashboardClientProps**

Remove:
- `initialSlotRates: SlotRate[]`
- `initialAttendanceTrend: TrendEntry[]`

**Step 4: Remove state variables**

Remove:
- `const [slotRates, setSlotRates] = useState<SlotRate[]>(initialSlotRates);`
- `const [attendanceTrend, setAttendanceTrend] = useState<TrendEntry[]>(initialAttendanceTrend);`

**Step 5: Update fetchDashboard — remove slot/trend state updates**

In the `fetchDashboard` callback, remove:
```typescript
setSlotRates(data.attendance.slotRates || []);
setAttendanceTrend(data.attendance.trend || []);
```

**Step 6: Remove the two-column chart grid from the Attendance Tracking section**

Remove:
```tsx
<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
  <SlotAttendanceChart slots={slotRates} />
  <AttendanceTrendChart trend={attendanceTrend} />
</div>
```

The Attendance Tracking section should now be:
```tsx
<div className={`space-y-6 transition-opacity ${loading ? "opacity-50" : ""}`}>
  <h2 className="text-lg font-semibold text-surface-100">Attendance Tracking</h2>
  <VoteVsActualCards data={voteVsActual} />
  <MemberAttendanceTable members={memberRates} />
</div>
```

---

### Task 6: Update DashboardClient tests

**Files:**
- Modify: `app/(owner)/dashboard/__tests__/DashboardClient.test.tsx`

**Step 1: Remove SlotRate and TrendEntry from defaultProps**

Remove:
- `initialSlotRates`
- `initialAttendanceTrend`

**Step 2: Remove `slotRates` and `trend` from `makeApiResponse`**

Update the attendance section in `makeApiResponse`:
```typescript
attendance: {
  memberRates: [],
  voteVsActual: { totalVotedComing: 0, totalActuallyAttended: 0, reliability: 0 },
  ...((overrides.attendance as object) || {}),
},
```

**Step 3: Update opacity tests if they count `.transition-opacity` elements**

The test at line 467 checks `transitionGrids.length >= 2` and indexes `[1]`. With the slot/trend charts removed, the attendance section is still `transition-opacity` but has fewer grids inside. Verify the indexes still work. The three `transition-opacity` elements are:
1. Metric cards grid
2. Charts grid (AttendanceChart + RevenueChart)
3. Attendance tracking section (VoteVsActual + MemberAttendanceTable)

With our changes, element [2] (attendance tracking) loses the inner grid but the outer `div.space-y-6.transition-opacity` remains. The test should still pass since it checks `[1]` which is the charts grid.

**Step 4: Run tests**

Run: `npm test -- app/(owner)/dashboard/__tests__/DashboardClient.test.tsx`
Expected: All tests PASS.

---

### Task 7: Delete unused component files

**Files:**
- Delete: `components/analytics/SlotAttendanceChart.tsx`
- Delete: `components/analytics/AttendanceTrendChart.tsx`

These are no longer imported anywhere.

---

### Task 8: Full verification

**Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: Zero errors.

**Step 2: Lint**

Run: `npm run lint`
Expected: No new warnings (pre-existing 5 are acceptable).

**Step 3: Full test suite**

Run: `npm test`
Expected: All tests pass. Test count will decrease slightly (removed slot rate + trend tests).

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: refine dashboard attendance tracking

- VoteVsActual now only counts voting sessions (sessions with ≥1 vote)
- Member 'Expected' includes sessions voted yes on + assigned sessions
- Remove SlotAttendanceChart and AttendanceTrendChart from dashboard

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```
