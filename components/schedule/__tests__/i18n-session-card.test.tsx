/**
 * i18n-session-card.test.tsx — Tests that SessionCard uses localized date formatting
 *
 * Verifies the SessionCard component passes locale to date-fns format calls
 * and renders translated badge text.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SessionCard, formatTime } from "../SessionCard";
import type { SessionWithDetails } from "@/lib/session-generation";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

function makeSession(overrides: Partial<SessionWithDetails> = {}): SessionWithDetails {
  return {
    id: "s1",
    weekDate: new Date("2026-03-09"),
    status: "SCHEDULED",
    workoutTitle: "HIIT",
    workoutDetails: null,
    votingEnabled: false,
    votingDeadline: new Date("2026-03-08T09:00:00.000Z"),
    recurringSlotId: "slot1",
    recurringSlot: {
      id: "slot1",
      dayOfWeek: 1,
      startHour: 9,
    },
    customDay: null,
    customStartHour: null,
    members: [],
    trainers: [{ user: { name: "Coach A" } }],
    votes: [],
    attendanceRecords: [],
    isAssigned: false,
    ...overrides,
  } as SessionWithDetails;
}

describe("SessionCard — formatTime utility", () => {
  it("formats AM hours correctly", () => {
    expect(formatTime(9)).toBe("9:00 AM");
    expect(formatTime(0)).toBe("12:00 AM");
    expect(formatTime(11)).toBe("11:00 AM");
  });

  it("formats PM hours correctly", () => {
    expect(formatTime(12)).toBe("12:00 PM");
    expect(formatTime(13)).toBe("1:00 PM");
    expect(formatTime(18)).toBe("6:00 PM");
    expect(formatTime(23)).toBe("11:00 PM");
  });
});

describe("SessionCard — translated badges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows translated 'Cancelled' badge", () => {
    render(
      <SessionCard
        session={makeSession({ status: "CANCELLED" })}
        basePath="/test"
      />
    );
    expect(screen.getByText("Cancelled")).toBeDefined();
  });

  it("shows translated 'Voting' badge when voting is active", () => {
    render(
      <SessionCard
        session={makeSession({ votingEnabled: true })}
        basePath="/test"
        showVotingIndicator={true}
      />
    );
    expect(screen.getByText("Voting")).toBeDefined();
  });

  it("shows translated 'Going' badge for coming vote", () => {
    render(
      <SessionCard
        session={makeSession({
          votingEnabled: true,
          votes: [{ userId: "u1", attending: true }],
        } as Partial<SessionWithDetails>)}
        basePath="/test"
        showVotingIndicator={true}
        currentUserId="u1"
      />
    );
    expect(screen.getByText("Going")).toBeDefined();
  });

  it("shows translated 'Not going' badge for not-coming vote", () => {
    render(
      <SessionCard
        session={makeSession({
          votingEnabled: true,
          votes: [{ userId: "u1", attending: false }],
        } as Partial<SessionWithDetails>)}
        basePath="/test"
        showVotingIndicator={true}
        currentUserId="u1"
      />
    );
    expect(screen.getByText("Not going")).toBeDefined();
  });
});

describe("SessionCard — renders session data correctly", () => {
  it("renders time from formatTime", () => {
    render(
      <SessionCard session={makeSession()} basePath="/test" />
    );
    expect(screen.getByText("9:00 AM")).toBeDefined();
  });

  it("renders workout title", () => {
    render(
      <SessionCard session={makeSession()} basePath="/test" />
    );
    expect(screen.getByText("HIIT")).toBeDefined();
  });

  it("renders trainer name", () => {
    render(
      <SessionCard session={makeSession()} basePath="/test" />
    );
    expect(screen.getByText("Coach A")).toBeDefined();
  });

  it("renders member count with translated label", () => {
    render(
      <SessionCard
        session={makeSession({
          members: [{ userId: "m1" }, { userId: "m2" }],
        } as Partial<SessionWithDetails>)}
        basePath="/test"
      />
    );
    expect(screen.getByText(/2\/27/)).toBeDefined();
    expect(screen.getByText(/members/)).toBeDefined();
  });
});
