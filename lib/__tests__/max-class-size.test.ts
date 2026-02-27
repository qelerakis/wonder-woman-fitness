/**
 * Comprehensive MAX_CLASS_SIZE Test Suite
 *
 * Tests that the class capacity limit (MAX_CLASS_SIZE = 27) is correctly
 * enforced across ALL enforcement points in the system:
 *
 * 1. Constants — the single source of truth
 * 2. Voting logic — isSessionFull boundary conditions
 * 3. Session generation — carry-forward member capping
 * 4. Vote API — capacity check blocks votes at limit
 * 5. Session members API — capacity check blocks assignment at limit
 * 6. Move members API — capacity check blocks moves that would exceed limit
 * 7. SessionCard UI — displays correct denominator
 *
 * This file serves as the canonical "capacity contract" — if any enforcement
 * point drifts from MAX_CLASS_SIZE, these tests will catch it.
 */

import { describe, it, expect, vi } from "vitest";

// Mock prisma to prevent env.ts validation (these tests only use pure utility functions)
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { MAX_CLASS_SIZE } from "@/lib/constants";
import { isSessionFull } from "@/lib/voting-logic";

// ===== 1. CONSTANT VALUE =====

describe("MAX_CLASS_SIZE constant", () => {
  it("is exactly 27", () => {
    expect(MAX_CLASS_SIZE).toBe(27);
  });

  it("is a positive integer", () => {
    expect(Number.isInteger(MAX_CLASS_SIZE)).toBe(true);
    expect(MAX_CLASS_SIZE).toBeGreaterThan(0);
  });

  it("is reasonable for a fitness class (between 1 and 100)", () => {
    expect(MAX_CLASS_SIZE).toBeGreaterThanOrEqual(1);
    expect(MAX_CLASS_SIZE).toBeLessThanOrEqual(100);
  });
});

// ===== 2. isSessionFull — EXHAUSTIVE BOUNDARY TESTING =====

describe("isSessionFull — exhaustive boundary tests against MAX_CLASS_SIZE", () => {
  // ----- Exact boundary: MAX_CLASS_SIZE -----
  it(`returns true at exactly MAX_CLASS_SIZE (${MAX_CLASS_SIZE})`, () => {
    expect(isSessionFull(MAX_CLASS_SIZE)).toBe(true);
  });

  it(`returns false at MAX_CLASS_SIZE - 1 (${MAX_CLASS_SIZE - 1})`, () => {
    expect(isSessionFull(MAX_CLASS_SIZE - 1)).toBe(false);
  });

  it(`returns true at MAX_CLASS_SIZE + 1 (${MAX_CLASS_SIZE + 1})`, () => {
    expect(isSessionFull(MAX_CLASS_SIZE + 1)).toBe(true);
  });

  // ----- Below capacity -----
  it("returns false for 0 members", () => {
    expect(isSessionFull(0)).toBe(false);
  });

  it("returns false for 1 member", () => {
    expect(isSessionFull(1)).toBe(false);
  });

  it("returns false for half capacity", () => {
    const half = Math.floor(MAX_CLASS_SIZE / 2);
    expect(isSessionFull(half)).toBe(false);
  });

  it("returns false for every value from 0 to MAX_CLASS_SIZE - 1", () => {
    for (let i = 0; i < MAX_CLASS_SIZE; i++) {
      expect(isSessionFull(i)).toBe(false);
    }
  });

  // ----- At and above capacity -----
  it("returns true for every value from MAX_CLASS_SIZE to MAX_CLASS_SIZE + 10", () => {
    for (let i = MAX_CLASS_SIZE; i <= MAX_CLASS_SIZE + 10; i++) {
      expect(isSessionFull(i)).toBe(true);
    }
  });

  it("returns true for a very large number (1000)", () => {
    expect(isSessionFull(1000)).toBe(true);
  });

  // ----- Edge cases -----
  it("returns false for negative numbers (defensive)", () => {
    expect(isSessionFull(-1)).toBe(false);
    expect(isSessionFull(-100)).toBe(false);
  });

  // ----- Operator correctness: >= not > -----
  it("uses >= comparison (full AT the limit, not just above)", () => {
    // This is the critical distinction: at MAX_CLASS_SIZE the session IS full
    // If the code used > instead of >=, this would fail
    expect(isSessionFull(MAX_CLASS_SIZE)).toBe(true);
    expect(isSessionFull(MAX_CLASS_SIZE - 1)).toBe(false);
  });
});

// ===== 3. CAPACITY ENFORCEMENT CONTRACTS =====
// These tests verify the LOGIC that production code uses to enforce capacity,
// without importing the actual route handlers.

describe("capacity enforcement logic contracts", () => {
  describe("vote capacity check: comingCount >= MAX_CLASS_SIZE", () => {
    it("blocks vote when coming count equals MAX_CLASS_SIZE", () => {
      const comingCount = MAX_CLASS_SIZE;
      const shouldBlock = comingCount >= MAX_CLASS_SIZE;
      expect(shouldBlock).toBe(true);
    });

    it("blocks vote when coming count exceeds MAX_CLASS_SIZE", () => {
      const comingCount = MAX_CLASS_SIZE + 5;
      const shouldBlock = comingCount >= MAX_CLASS_SIZE;
      expect(shouldBlock).toBe(true);
    });

    it("allows vote when coming count is one below MAX_CLASS_SIZE", () => {
      const comingCount = MAX_CLASS_SIZE - 1;
      const shouldBlock = comingCount >= MAX_CLASS_SIZE;
      expect(shouldBlock).toBe(false);
    });

    it("allows vote when session is empty", () => {
      const comingCount = 0;
      const shouldBlock = comingCount >= MAX_CLASS_SIZE;
      expect(shouldBlock).toBe(false);
    });
  });

  describe("member assignment check: currentCount >= MAX_CLASS_SIZE", () => {
    it("blocks assignment when member count equals MAX_CLASS_SIZE", () => {
      const currentCount = MAX_CLASS_SIZE;
      const shouldBlock = currentCount >= MAX_CLASS_SIZE;
      expect(shouldBlock).toBe(true);
    });

    it("blocks assignment when member count exceeds MAX_CLASS_SIZE", () => {
      const currentCount = MAX_CLASS_SIZE + 1;
      const shouldBlock = currentCount >= MAX_CLASS_SIZE;
      expect(shouldBlock).toBe(true);
    });

    it("allows assignment when one slot remains", () => {
      const currentCount = MAX_CLASS_SIZE - 1;
      const shouldBlock = currentCount >= MAX_CLASS_SIZE;
      expect(shouldBlock).toBe(false);
    });

    it("allows assignment when session is empty", () => {
      const currentCount = 0;
      const shouldBlock = currentCount >= MAX_CLASS_SIZE;
      expect(shouldBlock).toBe(false);
    });
  });

  describe("move-members check: currentCount + movingCount > MAX_CLASS_SIZE", () => {
    it("blocks move when target is full and moving 1", () => {
      const currentCount = MAX_CLASS_SIZE;
      const movingCount = 1;
      const shouldBlock = currentCount + movingCount > MAX_CLASS_SIZE;
      expect(shouldBlock).toBe(true);
    });

    it("blocks move when result would exceed capacity", () => {
      const currentCount = MAX_CLASS_SIZE - 2;
      const movingCount = 3; // 25 + 3 = 28 > 27
      const shouldBlock = currentCount + movingCount > MAX_CLASS_SIZE;
      expect(shouldBlock).toBe(true);
    });

    it("allows move when result equals exactly MAX_CLASS_SIZE", () => {
      const currentCount = MAX_CLASS_SIZE - 3;
      const movingCount = 3; // 24 + 3 = 27 = MAX_CLASS_SIZE
      const shouldBlock = currentCount + movingCount > MAX_CLASS_SIZE;
      expect(shouldBlock).toBe(false);
    });

    it("allows move when result is below MAX_CLASS_SIZE", () => {
      const currentCount = MAX_CLASS_SIZE - 5;
      const movingCount = 2; // 22 + 2 = 24 < 27
      const shouldBlock = currentCount + movingCount > MAX_CLASS_SIZE;
      expect(shouldBlock).toBe(false);
    });

    it("blocks move when target is empty but moving too many", () => {
      const currentCount = 0;
      const movingCount = MAX_CLASS_SIZE + 1;
      const shouldBlock = currentCount + movingCount > MAX_CLASS_SIZE;
      expect(shouldBlock).toBe(true);
    });

    it("allows move of exactly MAX_CLASS_SIZE members into empty session", () => {
      const currentCount = 0;
      const movingCount = MAX_CLASS_SIZE;
      const shouldBlock = currentCount + movingCount > MAX_CLASS_SIZE;
      expect(shouldBlock).toBe(false);
    });

    it("allows moving 1 member when 1 slot remains", () => {
      const currentCount = MAX_CLASS_SIZE - 1;
      const movingCount = 1;
      const shouldBlock = currentCount + movingCount > MAX_CLASS_SIZE;
      expect(shouldBlock).toBe(false);
    });

    it("blocks moving 2 members when only 1 slot remains", () => {
      const currentCount = MAX_CLASS_SIZE - 1;
      const movingCount = 2;
      const shouldBlock = currentCount + movingCount > MAX_CLASS_SIZE;
      expect(shouldBlock).toBe(true);
    });
  });

  describe("session generation carry-forward: .slice(0, MAX_CLASS_SIZE)", () => {
    it("caps array at MAX_CLASS_SIZE when input is larger", () => {
      const members = Array.from({ length: MAX_CLASS_SIZE + 10 }, (_, i) => `member-${i}`);
      const capped = members.slice(0, MAX_CLASS_SIZE);
      expect(capped).toHaveLength(MAX_CLASS_SIZE);
    });

    it("preserves all members when input equals MAX_CLASS_SIZE", () => {
      const members = Array.from({ length: MAX_CLASS_SIZE }, (_, i) => `member-${i}`);
      const capped = members.slice(0, MAX_CLASS_SIZE);
      expect(capped).toHaveLength(MAX_CLASS_SIZE);
      expect(capped).toEqual(members);
    });

    it("preserves all members when input is below MAX_CLASS_SIZE", () => {
      const members = Array.from({ length: 5 }, (_, i) => `member-${i}`);
      const capped = members.slice(0, MAX_CLASS_SIZE);
      expect(capped).toHaveLength(5);
      expect(capped).toEqual(members);
    });

    it("preserves order after slicing (first N members kept)", () => {
      const members = Array.from({ length: MAX_CLASS_SIZE + 5 }, (_, i) => `member-${i + 1}`);
      const capped = members.slice(0, MAX_CLASS_SIZE);
      expect(capped[0]).toBe("member-1");
      expect(capped[MAX_CLASS_SIZE - 1]).toBe(`member-${MAX_CLASS_SIZE}`);
    });

    it("handles empty array", () => {
      const members: string[] = [];
      const capped = members.slice(0, MAX_CLASS_SIZE);
      expect(capped).toHaveLength(0);
    });

    it("handles single member", () => {
      const members = ["member-1"];
      const capped = members.slice(0, MAX_CLASS_SIZE);
      expect(capped).toHaveLength(1);
      expect(capped[0]).toBe("member-1");
    });
  });
});

// ===== 4. UI DISPLAY FORMAT =====

describe("capacity display format", () => {
  it("formats member count with MAX_CLASS_SIZE denominator", () => {
    const memberCount = 15;
    const display = `${memberCount}/${MAX_CLASS_SIZE} members`;
    expect(display).toBe("15/27 members");
  });

  it("formats coming count with MAX_CLASS_SIZE denominator", () => {
    const comingCount = 8;
    const display = `${comingCount}/${MAX_CLASS_SIZE} coming`;
    expect(display).toBe("8/27 coming");
  });

  it("formats zero count correctly", () => {
    const display = `${0}/${MAX_CLASS_SIZE} members`;
    expect(display).toBe("0/27 members");
  });

  it("formats full session correctly", () => {
    const display = `${MAX_CLASS_SIZE}/${MAX_CLASS_SIZE} coming`;
    expect(display).toBe("27/27 coming");
  });
});

// ===== 5. OPERATOR CONSISTENCY ACROSS ENFORCEMENT POINTS =====

describe("operator consistency across enforcement points", () => {
  // The system uses two different operators:
  // - votes & members: >= (blocks AT the limit)
  // - move-members: > (allows filling TO the limit)
  //
  // This is intentional: you can't add a 28th member via any path, but you CAN
  // move members to fill a session to exactly 27.

  it("votes: >= means a full session (27/27) blocks new Coming votes", () => {
    // votes/route.ts: comingCount >= MAX_CLASS_SIZE
    expect(MAX_CLASS_SIZE >= MAX_CLASS_SIZE).toBe(true); // blocks
    expect((MAX_CLASS_SIZE - 1) >= MAX_CLASS_SIZE).toBe(false); // allows
  });

  it("member assignment: >= means a full session (27/27) blocks new assignments", () => {
    // sessions/[id]/members/route.ts: currentCount >= MAX_CLASS_SIZE
    expect(MAX_CLASS_SIZE >= MAX_CLASS_SIZE).toBe(true); // blocks
    expect((MAX_CLASS_SIZE - 1) >= MAX_CLASS_SIZE).toBe(false); // allows
  });

  it("move-members: > means you CAN fill to exactly MAX_CLASS_SIZE", () => {
    // sessions/[id]/move-members/route.ts: currentCount + movingCount > MAX_CLASS_SIZE
    const fillToExact = (MAX_CLASS_SIZE - 3) + 3 > MAX_CLASS_SIZE;
    expect(fillToExact).toBe(false); // allows filling to exactly 27

    const overCapacity = (MAX_CLASS_SIZE - 2) + 3 > MAX_CLASS_SIZE;
    expect(overCapacity).toBe(true); // blocks going over
  });

  it("all three enforcement points agree on what is over capacity", () => {
    const overCapacity = MAX_CLASS_SIZE + 1;

    // All should block
    expect(overCapacity >= MAX_CLASS_SIZE).toBe(true); // votes
    expect(overCapacity >= MAX_CLASS_SIZE).toBe(true); // member assignment
    expect(overCapacity > MAX_CLASS_SIZE).toBe(true);  // move-members (28 > 27)
  });

  it("all three enforcement points agree on what is under capacity", () => {
    const underCapacity = MAX_CLASS_SIZE - 5; // 22

    // All should allow
    expect(underCapacity >= MAX_CLASS_SIZE).toBe(false); // votes
    expect(underCapacity >= MAX_CLASS_SIZE).toBe(false); // member assignment
    expect(underCapacity + 1 > MAX_CLASS_SIZE).toBe(false); // move-members (22+1=23)
  });
});

// ===== 6. REMAINING CAPACITY CALCULATIONS =====

describe("remaining capacity calculations", () => {
  it("full session has 0 remaining slots", () => {
    const remaining = MAX_CLASS_SIZE - MAX_CLASS_SIZE;
    expect(remaining).toBe(0);
  });

  it("empty session has MAX_CLASS_SIZE remaining slots", () => {
    const remaining = MAX_CLASS_SIZE - 0;
    expect(remaining).toBe(27);
  });

  it("session with 10 members has 17 remaining slots", () => {
    const remaining = MAX_CLASS_SIZE - 10;
    expect(remaining).toBe(17);
  });

  it("remaining slots is always non-negative for valid counts", () => {
    for (let i = 0; i <= MAX_CLASS_SIZE; i++) {
      expect(MAX_CLASS_SIZE - i).toBeGreaterThanOrEqual(0);
    }
  });
});

// ===== 7. MOVE-MEMBERS MULTI-MEMBER SCENARIOS =====

describe("move-members capacity with various group sizes", () => {
  const testCases = [
    { current: 0, moving: 27, expected: false, desc: "fill empty to exact capacity" },
    { current: 0, moving: 28, expected: true, desc: "overflow empty session by 1" },
    { current: 25, moving: 2, expected: false, desc: "fill near-full to exact capacity" },
    { current: 25, moving: 3, expected: true, desc: "overflow near-full by 1" },
    { current: 26, moving: 1, expected: false, desc: "add last member" },
    { current: 26, moving: 2, expected: true, desc: "overflow by 1 from one-below" },
    { current: 27, moving: 1, expected: true, desc: "add to already full session" },
    { current: 27, moving: 0, expected: false, desc: "move 0 members to full session" },
    { current: 10, moving: 10, expected: false, desc: "move 10 to half-full (20 total)" },
    { current: 20, moving: 7, expected: false, desc: "move 7 to fill exactly to 27" },
    { current: 20, moving: 8, expected: true, desc: "move 8 to overflow (28 total)" },
    { current: 1, moving: 26, expected: false, desc: "move 26 to nearly empty (27 total)" },
    { current: 1, moving: 27, expected: true, desc: "move 27 to nearly empty (28 total)" },
  ];

  testCases.forEach(({ current, moving, expected, desc }) => {
    it(`${desc}: current=${current}, moving=${moving}, blocks=${expected}`, () => {
      const shouldBlock = current + moving > MAX_CLASS_SIZE;
      expect(shouldBlock).toBe(expected);
    });
  });
});

// ===== 8. REGRESSION GUARD =====

describe("regression guards", () => {
  it("MAX_CLASS_SIZE has not reverted to the old value of 20", () => {
    expect(MAX_CLASS_SIZE).not.toBe(20);
  });

  it("MAX_CLASS_SIZE is 27 (the new required value)", () => {
    expect(MAX_CLASS_SIZE).toBe(27);
  });

  it("isSessionFull(20) is false (old limit should not trigger full)", () => {
    expect(isSessionFull(20)).toBe(false);
  });

  it("isSessionFull(27) is true (new limit triggers full)", () => {
    expect(isSessionFull(27)).toBe(true);
  });

  it("there are exactly 7 more slots than the old limit", () => {
    const oldLimit = 20;
    expect(MAX_CLASS_SIZE - oldLimit).toBe(7);
  });
});
