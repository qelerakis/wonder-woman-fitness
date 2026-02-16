/**
 * SessionCard Unit Tests
 *
 * Comprehensive tests for the SessionCard component covering:
 * - Link/navigation behavior
 * - Time display (recurring, custom, edge cases)
 * - Workout title rendering
 * - Trainer name rendering
 * - Member count display
 * - Cancelled session behavior
 * - Voting indicator display
 * - User vote badge display
 * - Vote count removal (no yes/no counts shown)
 * - formatTime utility
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SessionCard, formatTime } from "../SessionCard";
import type { SessionWithDetails } from "@/lib/session-generation";

// Mock next/link to render a plain anchor
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// ===== Test Data =====

function makeSession(
  overrides: Partial<SessionWithDetails> = {}
): SessionWithDetails {
  return {
    id: "session-1",
    recurringSlotId: "slot-1",
    customDay: null,
    customStartHour: null,
    weekDate: new Date("2026-02-09T00:00:00.000Z"),
    workoutTitle: "Upper Body",
    workoutDetails: null,
    votingEnabled: true,
    votingDeadline: new Date("2026-02-10T08:00:00.000Z"),
    status: "SCHEDULED",
    createdById: "owner-1",
    createdAt: new Date("2026-02-01T00:00:00.000Z"),
    recurringSlot: {
      id: "slot-1",
      dayOfWeek: 1,
      startHour: 9,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    members: [
      {
        sessionId: "session-1",
        userId: "member-1",
        user: {
          id: "member-1",
          name: "Alice",
          email: "alice@example.com",
          status: "ACTIVE",
        },
      },
      {
        sessionId: "session-1",
        userId: "member-2",
        user: {
          id: "member-2",
          name: "Bob",
          email: "bob@example.com",
          status: "ACTIVE",
        },
      },
    ],
    trainers: [
      {
        sessionId: "session-1",
        userId: "trainer-1",
        user: {
          id: "trainer-1",
          name: "Coach Dana",
          email: "dana@example.com",
        },
      },
    ],
    votes: [
      {
        id: "vote-1",
        userId: "member-1",
        attending: true,
        votedAt: new Date("2026-02-09T10:00:00.000Z"),
      },
      {
        id: "vote-2",
        userId: "member-2",
        attending: false,
        votedAt: new Date("2026-02-09T11:00:00.000Z"),
      },
    ],
    ...overrides,
  };
}

// ===== Tests =====

describe("SessionCard", () => {
  // ─── Link / Navigation ───────────────────────────────────────────

  describe("link behavior", () => {
    it("renders a link to the session detail page", () => {
      const session = makeSession();
      render(<SessionCard session={session} basePath="/member/session" />);

      const link = screen.getByRole("link");
      expect(link.getAttribute("href")).toBe("/member/session/session-1");
    });

    it("constructs the correct href with a different basePath", () => {
      const session = makeSession({ id: "abc-123" });
      render(<SessionCard session={session} basePath="/owner/schedule" />);

      const link = screen.getByRole("link");
      expect(link.getAttribute("href")).toBe("/owner/schedule/abc-123");
    });
  });

  // ─── Time Display ────────────────────────────────────────────────

  describe("time display", () => {
    it("displays time from recurring slot startHour", () => {
      const session = makeSession();
      // recurringSlot.startHour = 9
      render(<SessionCard session={session} basePath="/member/session" />);

      expect(screen.getByText("9:00 AM")).toBeDefined();
    });

    it("displays time from customStartHour when no recurring slot", () => {
      const session = makeSession({
        recurringSlotId: null,
        recurringSlot: null,
        customStartHour: 14,
      });
      render(<SessionCard session={session} basePath="/member/session" />);

      expect(screen.getByText("2:00 PM")).toBeDefined();
    });

    it("displays 12:00 PM for noon", () => {
      const session = makeSession({
        recurringSlot: {
          id: "slot-1",
          dayOfWeek: 1,
          startHour: 12,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      });
      render(<SessionCard session={session} basePath="/member/session" />);

      expect(screen.getByText("12:00 PM")).toBeDefined();
    });

    it("displays 12:00 AM for midnight (hour 0)", () => {
      const session = makeSession({
        recurringSlotId: null,
        recurringSlot: null,
        customStartHour: 0,
      });
      render(<SessionCard session={session} basePath="/member/session" />);

      expect(screen.getByText("12:00 AM")).toBeDefined();
    });

    it("displays PM times correctly for afternoon hours", () => {
      const session = makeSession({
        recurringSlot: {
          id: "slot-1",
          dayOfWeek: 1,
          startHour: 17,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      });
      render(<SessionCard session={session} basePath="/member/session" />);

      expect(screen.getByText("5:00 PM")).toBeDefined();
    });

    it("falls back to hour 0 when neither slot nor custom hour exists", () => {
      const session = makeSession({
        recurringSlotId: null,
        recurringSlot: null,
        customStartHour: null,
      });
      render(<SessionCard session={session} basePath="/member/session" />);

      expect(screen.getByText("12:00 AM")).toBeDefined();
    });
  });

  // ─── Workout Title ───────────────────────────────────────────────

  describe("workout title", () => {
    it("displays workout title when present", () => {
      const session = makeSession({ workoutTitle: "Leg Day" });
      render(<SessionCard session={session} basePath="/member/session" />);

      expect(screen.getByText("Leg Day")).toBeDefined();
    });

    it("does not render workout title when null", () => {
      const session = makeSession({ workoutTitle: null });
      render(<SessionCard session={session} basePath="/member/session" />);

      expect(screen.queryByText("Upper Body")).toBeNull();
      expect(screen.queryByText("Leg Day")).toBeNull();
    });

    it("applies truncate class for long titles", () => {
      const session = makeSession({
        workoutTitle: "Super Long Workout Title That Should Be Truncated",
      });
      render(<SessionCard session={session} basePath="/member/session" />);

      const titleEl = screen.getByText(
        "Super Long Workout Title That Should Be Truncated"
      );
      expect(titleEl.className).toContain("truncate");
    });
  });

  // ─── Trainer Names ───────────────────────────────────────────────

  describe("trainer names", () => {
    it("displays a single trainer name", () => {
      const session = makeSession();
      render(<SessionCard session={session} basePath="/member/session" />);

      expect(screen.getByText("Coach Dana")).toBeDefined();
    });

    it("displays multiple trainer names comma-separated", () => {
      const session = makeSession({
        trainers: [
          {
            sessionId: "session-1",
            userId: "trainer-1",
            user: { id: "trainer-1", name: "Coach Dana", email: "d@e.com" },
          },
          {
            sessionId: "session-1",
            userId: "trainer-2",
            user: { id: "trainer-2", name: "Coach Mike", email: "m@e.com" },
          },
        ],
      });
      render(<SessionCard session={session} basePath="/member/session" />);

      expect(screen.getByText("Coach Dana, Coach Mike")).toBeDefined();
    });

    it("does not render trainer section when no trainers assigned", () => {
      const session = makeSession({ trainers: [] });
      render(<SessionCard session={session} basePath="/member/session" />);

      expect(screen.queryByText("Coach Dana")).toBeNull();
    });

    it("applies truncate class for trainer names", () => {
      const session = makeSession();
      render(<SessionCard session={session} basePath="/member/session" />);

      const trainerEl = screen.getByText("Coach Dana");
      expect(trainerEl.className).toContain("truncate");
    });
  });

  // ─── Member Count (voting disabled) ─────────────────────────────

  describe("member count (voting disabled)", () => {
    it("shows assigned member count when voting is disabled", () => {
      const session = makeSession({ votingEnabled: false });
      render(<SessionCard session={session} basePath="/member/session" />);

      expect(screen.getByText("2/20 members")).toBeDefined();
    });

    it("shows 0/20 members when no members assigned and voting disabled", () => {
      const session = makeSession({ members: [], votingEnabled: false });
      render(<SessionCard session={session} basePath="/member/session" />);

      expect(screen.getByText("0/20 members")).toBeDefined();
    });

    it("shows correct assigned count with many members", () => {
      const members = Array.from({ length: 15 }, (_, i) => ({
        sessionId: "session-1",
        userId: `member-${i}`,
        user: {
          id: `member-${i}`,
          name: `Member ${i}`,
          email: `m${i}@e.com`,
          status: "ACTIVE",
        },
      }));
      const session = makeSession({ members, votingEnabled: false });
      render(<SessionCard session={session} basePath="/member/session" />);

      expect(screen.getByText("15/20 members")).toBeDefined();
    });
  });

  // ─── Coming Count (voting enabled) ────────────────────────────

  describe("coming count (voting enabled)", () => {
    it("shows coming vote count instead of member count when voting is enabled", () => {
      // 2 assigned members, but only 1 attending vote
      const session = makeSession({ votingEnabled: true });
      render(<SessionCard session={session} basePath="/member/session" />);

      // Should show 1 (coming votes), NOT 2 (assigned members)
      expect(screen.getByText("1/20 coming")).toBeDefined();
      expect(screen.queryByText("2/20 members")).toBeNull();
    });

    it("shows 0/20 coming when voting enabled but no attending votes", () => {
      const session = makeSession({
        votingEnabled: true,
        votes: [
          {
            id: "vote-1",
            userId: "member-1",
            attending: false,
            votedAt: new Date("2026-02-09T10:00:00.000Z"),
          },
        ],
      });
      render(<SessionCard session={session} basePath="/member/session" />);

      expect(screen.getByText("0/20 coming")).toBeDefined();
    });

    it("shows 0/20 coming when voting enabled and no votes at all", () => {
      const session = makeSession({
        votingEnabled: true,
        votes: [],
      });
      render(<SessionCard session={session} basePath="/member/session" />);

      expect(screen.getByText("0/20 coming")).toBeDefined();
    });

    it("counts only attending=true votes for the coming count", () => {
      const votes = [
        { id: "v1", userId: "m1", attending: true, votedAt: new Date("2026-02-09T10:00:00.000Z") },
        { id: "v2", userId: "m2", attending: true, votedAt: new Date("2026-02-09T10:00:00.000Z") },
        { id: "v3", userId: "m3", attending: false, votedAt: new Date("2026-02-09T10:00:00.000Z") },
        { id: "v4", userId: "m4", attending: true, votedAt: new Date("2026-02-09T10:00:00.000Z") },
        { id: "v5", userId: "m5", attending: false, votedAt: new Date("2026-02-09T10:00:00.000Z") },
      ];
      const session = makeSession({ votingEnabled: true, votes });
      render(<SessionCard session={session} basePath="/member/session" />);

      // 3 attending out of 5 votes
      expect(screen.getByText("3/20 coming")).toBeDefined();
    });

    it("shows high coming count correctly when many are attending", () => {
      const votes = Array.from({ length: 18 }, (_, i) => ({
        id: `vote-${i}`,
        userId: `member-${i}`,
        attending: true,
        votedAt: new Date("2026-02-09T10:00:00.000Z"),
      }));
      const session = makeSession({ votingEnabled: true, votes });
      render(<SessionCard session={session} basePath="/member/session" />);

      expect(screen.getByText("18/20 coming")).toBeDefined();
    });

    it("uses 'coming' label not 'members' when voting is enabled", () => {
      const session = makeSession({ votingEnabled: true });
      render(<SessionCard session={session} basePath="/member/session" />);

      // Should say "coming" not "members"
      expect(screen.queryByText(/\/20 members/)).toBeNull();
      expect(screen.getByText(/\/20 coming/)).toBeDefined();
    });
  });

  // ─── Cancelled Session ───────────────────────────────────────────

  describe("cancelled session", () => {
    it("shows Cancelled badge when session is cancelled", () => {
      const session = makeSession({ status: "CANCELLED" });
      render(<SessionCard session={session} basePath="/member/session" />);

      expect(screen.getByText("Cancelled")).toBeDefined();
    });

    it("does NOT show Voting badge when cancelled even if votingEnabled", () => {
      const session = makeSession({
        status: "CANCELLED",
        votingEnabled: true,
      });
      render(
        <SessionCard
          session={session}
          basePath="/member/session"
          showVotingIndicator={true}
        />
      );

      expect(screen.getByText("Cancelled")).toBeDefined();
      expect(screen.queryByText("Voting")).toBeNull();
    });

    it("applies opacity class for cancelled cards", () => {
      const session = makeSession({ status: "CANCELLED" });
      render(<SessionCard session={session} basePath="/member/session" />);

      const link = screen.getByRole("link");
      expect(link.className).toContain("opacity-60");
    });

    it("does NOT apply opacity for non-cancelled cards", () => {
      const session = makeSession({ status: "SCHEDULED" });
      render(<SessionCard session={session} basePath="/member/session" />);

      const link = screen.getByRole("link");
      expect(link.className).not.toContain("opacity-60");
    });

    it("does not show Cancelled badge for scheduled sessions", () => {
      const session = makeSession({ status: "SCHEDULED" });
      render(<SessionCard session={session} basePath="/member/session" />);

      expect(screen.queryByText("Cancelled")).toBeNull();
    });
  });

  // ─── Voting Indicator Badge ──────────────────────────────────────

  describe("voting indicator badge", () => {
    it("shows Voting badge when votingEnabled and showVotingIndicator", () => {
      const session = makeSession({ votingEnabled: true });
      render(
        <SessionCard
          session={session}
          basePath="/member/session"
          showVotingIndicator={true}
        />
      );

      expect(screen.getByText("Voting")).toBeDefined();
    });

    it("does NOT show Voting badge when showVotingIndicator is false", () => {
      const session = makeSession({ votingEnabled: true });
      render(
        <SessionCard
          session={session}
          basePath="/member/session"
          showVotingIndicator={false}
        />
      );

      expect(screen.queryByText("Voting")).toBeNull();
    });

    it("does NOT show Voting badge when showVotingIndicator is omitted (defaults false)", () => {
      const session = makeSession({ votingEnabled: true });
      render(<SessionCard session={session} basePath="/member/session" />);

      expect(screen.queryByText("Voting")).toBeNull();
    });

    it("does NOT show Voting badge when votingEnabled is false", () => {
      const session = makeSession({ votingEnabled: false });
      render(
        <SessionCard
          session={session}
          basePath="/member/session"
          showVotingIndicator={true}
        />
      );

      expect(screen.queryByText("Voting")).toBeNull();
    });
  });

  // ─── User Vote Badge ─────────────────────────────────────────────

  describe("user vote badge", () => {
    it("shows 'Going' badge when user voted attending", () => {
      const session = makeSession();
      render(
        <SessionCard
          session={session}
          basePath="/member/session"
          showVotingIndicator={true}
          currentUserId="member-1"
        />
      );

      expect(screen.getByText("Going")).toBeDefined();
    });

    it("shows 'Not going' badge when user voted not attending", () => {
      const session = makeSession();
      render(
        <SessionCard
          session={session}
          basePath="/member/session"
          showVotingIndicator={true}
          currentUserId="member-2"
        />
      );

      expect(screen.getByText("Not going")).toBeDefined();
    });

    it("does NOT show vote badge when user has not voted", () => {
      const session = makeSession();
      render(
        <SessionCard
          session={session}
          basePath="/member/session"
          showVotingIndicator={true}
          currentUserId="member-99"
        />
      );

      expect(screen.queryByText("Going")).toBeNull();
      expect(screen.queryByText("Not going")).toBeNull();
    });

    it("does NOT show vote badge when currentUserId is not provided", () => {
      const session = makeSession();
      render(
        <SessionCard
          session={session}
          basePath="/member/session"
          showVotingIndicator={true}
        />
      );

      expect(screen.queryByText("Going")).toBeNull();
      expect(screen.queryByText("Not going")).toBeNull();
    });

    it("does NOT show vote badge when showVotingIndicator is false", () => {
      const session = makeSession();
      render(
        <SessionCard
          session={session}
          basePath="/member/session"
          showVotingIndicator={false}
          currentUserId="member-1"
        />
      );

      expect(screen.queryByText("Going")).toBeNull();
      expect(screen.queryByText("Not going")).toBeNull();
    });

    it("does NOT show vote badge when showVotingIndicator defaults to false", () => {
      const session = makeSession();
      render(
        <SessionCard
          session={session}
          basePath="/member/session"
          currentUserId="member-1"
        />
      );

      expect(screen.queryByText("Going")).toBeNull();
      expect(screen.queryByText("Not going")).toBeNull();
    });

    it("does NOT show vote badge when session has no votes", () => {
      const session = makeSession({ votes: [] });
      render(
        <SessionCard
          session={session}
          basePath="/member/session"
          showVotingIndicator={true}
          currentUserId="member-1"
        />
      );

      expect(screen.queryByText("Going")).toBeNull();
      expect(screen.queryByText("Not going")).toBeNull();
    });
  });

  // ─── Vote Count Removal ──────────────────────────────────────────

  describe("vote count removal", () => {
    it("does NOT show yes/no vote counts when voting is enabled", () => {
      const session = makeSession();
      render(
        <SessionCard
          session={session}
          basePath="/member/session"
          showVotingIndicator={true}
          currentUserId="member-1"
        />
      );

      expect(screen.queryByText(/\d+\s*yes/i)).toBeNull();
      expect(screen.queryByText(/\d+\s*no/i)).toBeNull();
    });

    it("does NOT show vote counts even with many votes", () => {
      const votes = Array.from({ length: 10 }, (_, i) => ({
        id: `vote-${i}`,
        userId: `member-${i}`,
        attending: i < 7, // 7 yes, 3 no
        votedAt: new Date("2026-02-09T10:00:00.000Z"),
      }));
      const session = makeSession({ votes });
      render(
        <SessionCard
          session={session}
          basePath="/member/session"
          showVotingIndicator={true}
          currentUserId="member-0"
        />
      );

      expect(screen.queryByText(/\d+\s*yes/i)).toBeNull();
      expect(screen.queryByText(/\d+\s*no/i)).toBeNull();
      expect(screen.queryByText("7 yes")).toBeNull();
      expect(screen.queryByText("3 no")).toBeNull();
    });

    it("does NOT show vote counts when all votes are yes", () => {
      const votes = [
        {
          id: "vote-1",
          userId: "member-1",
          attending: true,
          votedAt: new Date("2026-02-09T10:00:00.000Z"),
        },
        {
          id: "vote-2",
          userId: "member-2",
          attending: true,
          votedAt: new Date("2026-02-09T11:00:00.000Z"),
        },
      ];
      const session = makeSession({ votes });
      render(
        <SessionCard
          session={session}
          basePath="/member/session"
          showVotingIndicator={true}
          currentUserId="member-1"
        />
      );

      expect(screen.queryByText(/\d+\s*yes/i)).toBeNull();
      expect(screen.queryByText(/\d+\s*no/i)).toBeNull();
    });

    it("does NOT show vote counts when all votes are no", () => {
      const votes = [
        {
          id: "vote-1",
          userId: "member-1",
          attending: false,
          votedAt: new Date("2026-02-09T10:00:00.000Z"),
        },
        {
          id: "vote-2",
          userId: "member-2",
          attending: false,
          votedAt: new Date("2026-02-09T11:00:00.000Z"),
        },
      ];
      const session = makeSession({ votes });
      render(
        <SessionCard
          session={session}
          basePath="/member/session"
          showVotingIndicator={true}
          currentUserId="member-1"
        />
      );

      expect(screen.queryByText(/\d+\s*yes/i)).toBeNull();
      expect(screen.queryByText(/\d+\s*no/i)).toBeNull();
    });

    it("does NOT show vote counts even without showVotingIndicator", () => {
      const session = makeSession();
      render(
        <SessionCard
          session={session}
          basePath="/member/session"
          showVotingIndicator={false}
          currentUserId="member-1"
        />
      );

      expect(screen.queryByText(/\d+\s*yes/i)).toBeNull();
      expect(screen.queryByText(/\d+\s*no/i)).toBeNull();
    });
  });

  // ─── Voting Deadline Display ──────────────────────────────────────

  describe("voting deadline display", () => {
    it("shows deadline text when voting is active and user has not voted", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-02-09T12:00:00.000Z"));

      const session = makeSession({
        votingEnabled: true,
        votingDeadline: new Date("2026-02-10T08:00:00.000Z"),
      });
      render(
        <SessionCard
          session={session}
          basePath="/member/session"
          showVotingIndicator={true}
          currentUserId="member-99"
        />
      );

      expect(screen.getByText(/^by /i)).toBeDefined();

      vi.useRealTimers();
    });

    it("hides deadline text when user has already voted", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-02-09T12:00:00.000Z"));

      const session = makeSession({
        votingEnabled: true,
        votingDeadline: new Date("2026-02-10T08:00:00.000Z"),
      });
      render(
        <SessionCard
          session={session}
          basePath="/member/session"
          showVotingIndicator={true}
          currentUserId="member-1"
        />
      );

      expect(screen.queryByText(/^by /i)).toBeNull();

      vi.useRealTimers();
    });

    it("hides deadline text when showVotingIndicator is false", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-02-09T12:00:00.000Z"));

      const session = makeSession({
        votingEnabled: true,
        votingDeadline: new Date("2026-02-10T08:00:00.000Z"),
      });
      render(
        <SessionCard
          session={session}
          basePath="/member/session"
          showVotingIndicator={false}
          currentUserId="member-99"
        />
      );

      expect(screen.queryByText(/^by /i)).toBeNull();

      vi.useRealTimers();
    });

    it("hides deadline text when voting deadline has passed", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-02-11T00:00:00.000Z"));

      const session = makeSession({
        votingEnabled: true,
        votingDeadline: new Date("2026-02-10T08:00:00.000Z"),
      });
      render(
        <SessionCard
          session={session}
          basePath="/member/session"
          showVotingIndicator={true}
          currentUserId="member-99"
        />
      );

      expect(screen.queryByText(/^by /i)).toBeNull();

      vi.useRealTimers();
    });

    it("applies warning color when deadline is within 6 hours", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-02-10T05:00:00.000Z"));

      const session = makeSession({
        votingEnabled: true,
        votingDeadline: new Date("2026-02-10T08:00:00.000Z"),
      });
      render(
        <SessionCard
          session={session}
          basePath="/member/session"
          showVotingIndicator={true}
          currentUserId="member-99"
        />
      );

      const deadlineText = screen.getByText(/^by /i);
      expect(deadlineText.className).toContain("text-warning-400");

      vi.useRealTimers();
    });

    it("applies muted color when deadline is more than 6 hours away", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-02-09T12:00:00.000Z"));

      const session = makeSession({
        votingEnabled: true,
        votingDeadline: new Date("2026-02-10T08:00:00.000Z"),
      });
      render(
        <SessionCard
          session={session}
          basePath="/member/session"
          showVotingIndicator={true}
          currentUserId="member-99"
        />
      );

      const deadlineText = screen.getByText(/^by /i);
      expect(deadlineText.className).toContain("text-surface-500");

      vi.useRealTimers();
    });

    it("hides deadline text when votingEnabled is false", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-02-09T12:00:00.000Z"));

      const session = makeSession({
        votingEnabled: false,
        votingDeadline: new Date("2026-02-10T08:00:00.000Z"),
      });
      render(
        <SessionCard
          session={session}
          basePath="/member/session"
          showVotingIndicator={true}
          currentUserId="member-99"
        />
      );

      expect(screen.queryByText(/^by /i)).toBeNull();

      vi.useRealTimers();
    });

    it("hides deadline text when votingDeadline is null", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-02-09T12:00:00.000Z"));

      const session = makeSession({
        votingEnabled: true,
        votingDeadline: null,
      });
      render(
        <SessionCard
          session={session}
          basePath="/member/session"
          showVotingIndicator={true}
          currentUserId="member-99"
        />
      );

      expect(screen.queryByText(/^by /i)).toBeNull();

      vi.useRealTimers();
    });
  });

  // ─── formatTime Utility ──────────────────────────────────────────

  describe("formatTime", () => {
    it("formats midnight (0) as 12:00 AM", () => {
      expect(formatTime(0)).toBe("12:00 AM");
    });

    it("formats 1 AM", () => {
      expect(formatTime(1)).toBe("1:00 AM");
    });

    it("formats 11 AM", () => {
      expect(formatTime(11)).toBe("11:00 AM");
    });

    it("formats noon (12) as 12:00 PM", () => {
      expect(formatTime(12)).toBe("12:00 PM");
    });

    it("formats 1 PM (13)", () => {
      expect(formatTime(13)).toBe("1:00 PM");
    });

    it("formats 5 PM (17)", () => {
      expect(formatTime(17)).toBe("5:00 PM");
    });

    it("formats 9 PM (21)", () => {
      expect(formatTime(21)).toBe("9:00 PM");
    });

    it("formats 11 PM (23)", () => {
      expect(formatTime(23)).toBe("11:00 PM");
    });

    it("formats early morning hours correctly", () => {
      expect(formatTime(7)).toBe("7:00 AM");
      expect(formatTime(8)).toBe("8:00 AM");
      expect(formatTime(9)).toBe("9:00 AM");
      expect(formatTime(10)).toBe("10:00 AM");
    });

    it("formats afternoon hours correctly", () => {
      expect(formatTime(14)).toBe("2:00 PM");
      expect(formatTime(15)).toBe("3:00 PM");
      expect(formatTime(16)).toBe("4:00 PM");
      expect(formatTime(18)).toBe("6:00 PM");
      expect(formatTime(19)).toBe("7:00 PM");
      expect(formatTime(20)).toBe("8:00 PM");
      expect(formatTime(22)).toBe("10:00 PM");
    });
  });

  // ─── Styling ─────────────────────────────────────────────────────

  describe("styling", () => {
    it("applies hover styles for scheduled sessions", () => {
      const session = makeSession({ status: "SCHEDULED" });
      render(<SessionCard session={session} basePath="/member/session" />);

      const link = screen.getByRole("link");
      expect(link.className).toContain("hover:border-primary-600/50");
      expect(link.className).toContain("hover:bg-surface-700");
    });

    it("does NOT apply hover styles for cancelled sessions", () => {
      const session = makeSession({ status: "CANCELLED" });
      render(<SessionCard session={session} basePath="/member/session" />);

      const link = screen.getByRole("link");
      expect(link.className).not.toContain("hover:border-primary-600/50");
      expect(link.className).not.toContain("hover:bg-surface-700");
    });

    it("applies base card styles", () => {
      const session = makeSession();
      render(<SessionCard session={session} basePath="/member/session" />);

      const link = screen.getByRole("link");
      expect(link.className).toContain("rounded-lg");
      expect(link.className).toContain("border");
      expect(link.className).toContain("p-3");
    });
  });
});
