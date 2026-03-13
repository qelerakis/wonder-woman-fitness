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
  it("formats morning hours correctly", () => {
    expect(formatTime(9)).toBe("09:00");
    expect(formatTime(0)).toBe("00:00");
    expect(formatTime(11)).toBe("11:00");
  });

  it("formats afternoon/evening hours correctly", () => {
    expect(formatTime(12)).toBe("12:00");
    expect(formatTime(13)).toBe("13:00");
    expect(formatTime(18)).toBe("18:00");
    expect(formatTime(23)).toBe("23:00");
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

describe("SessionCard — deadline uses 24-hour format", () => {
  it("deadline text uses 'EEE HH:mm' 24-hour format (e.g., 'by Mon 09:00')", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-08T12:00:00.000Z"));

    render(
      <SessionCard
        session={makeSession({
          votingEnabled: true,
          votingDeadline: new Date("2026-03-09T15:00:00.000Z"),
        })}
        basePath="/test"
        showVotingIndicator={true}
        currentUserId="unvoted-user"
      />
    );

    const deadlineText = screen.getByText(/^by /i);
    // Format should be "by <DayAbbrev> HH:mm" with no AM/PM
    expect(deadlineText.textContent).toMatch(/^by \w{3} \d{2}:\d{2}$/);
    expect(deadlineText.textContent).not.toMatch(/AM/i);
    expect(deadlineText.textContent).not.toMatch(/PM/i);

    vi.useRealTimers();
  });

  it("deadline for evening time shows 24-hour format not 12-hour", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-08T12:00:00.000Z"));

    render(
      <SessionCard
        session={makeSession({
          votingEnabled: true,
          votingDeadline: new Date("2026-03-09T20:00:00.000Z"),
        })}
        basePath="/test"
        showVotingIndicator={true}
        currentUserId="unvoted-user"
      />
    );

    const deadlineText = screen.getByText(/^by /i);
    // Should show 20:00 not 8:00 PM
    expect(deadlineText.textContent).toMatch(/\d{2}:\d{2}$/);
    expect(deadlineText.textContent).not.toMatch(/PM/i);

    vi.useRealTimers();
  });
});

describe("SessionCard — renders session data correctly", () => {
  it("renders time from formatTime", () => {
    render(
      <SessionCard session={makeSession()} basePath="/test" />
    );
    expect(screen.getByText("09:00")).toBeDefined();
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
    expect(screen.getByText(/2\/30/)).toBeDefined();
    expect(screen.getByText(/members/)).toBeDefined();
  });
});
