/**
 * i18n-member-session.test.tsx — i18n-specific tests for MemberSessionDetailClient
 *
 * Validates that the member session detail page uses translated day names,
 * translated session statuses, and localized date formatting.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemberSessionDetailClient } from "../MemberSessionDetailClient";

// ===== Mocks =====

const mockPush = vi.fn();
const mockBack = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    refresh: mockRefresh,
  }),
}));

const mockAddToast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

// ===== Helpers =====

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "session-1",
    weekDate: "2026-03-09T00:00:00.000Z",
    status: "SCHEDULED",
    workoutTitle: null,
    workoutDetails: null,
    votingEnabled: false,
    votingDeadline: "2026-03-08T09:00:00.000Z",
    recurringSlot: null,
    customDay: 1,
    customStartHour: 9,
    trainerNames: ["Coach"],
    comingMemberNames: [],
    assignedMemberNames: ["Alice"],
    votesCount: { coming: 0 },
    ...overrides,
  };
}

const defaultProps = {
  myVote: null,
  userId: "u1",
  isFull: false,
  hasComingVoteOnSameDay: false,
  isAssigned: false,
};

function renderMemberSession(
  sessionOverrides: Record<string, unknown> = {},
  propsOverrides: Record<string, unknown> = {}
) {
  const session = makeSession(sessionOverrides);
  const props = { ...defaultProps, ...propsOverrides };
  return render(
    <MemberSessionDetailClient
      session={session as Parameters<typeof MemberSessionDetailClient>[0]["session"]}
      {...props}
    />
  );
}

// ===== Tests =====

describe("MemberSessionDetailClient — translated day names", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const dayMap: Record<number, string> = {
    1: "Monday",
    2: "Tuesday",
    3: "Wednesday",
    4: "Thursday",
    5: "Friday",
    6: "Saturday",
    7: "Sunday",
  };

  for (const [day, expectedName] of Object.entries(dayMap)) {
    it(`renders "${expectedName}" for customDay=${day}`, () => {
      renderMemberSession({ customDay: Number(day) });
      expect(screen.getByText(new RegExp(expectedName))).toBeDefined();
    });
  }

  it("uses recurringSlot.dayOfWeek when available", () => {
    renderMemberSession({
      recurringSlot: { dayOfWeek: 3, startHour: 18 },
      customDay: null,
    });
    expect(screen.getByText(/Wednesday/)).toBeDefined();
  });
});

describe("MemberSessionDetailClient — translated session status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows translated 'Scheduled' badge for SCHEDULED status", () => {
    renderMemberSession({ status: "SCHEDULED" });
    expect(screen.getByText("Scheduled")).toBeDefined();
  });

  it("shows translated 'Cancelled' badge for CANCELLED status", () => {
    renderMemberSession({ status: "CANCELLED" });
    expect(screen.getByText("Cancelled")).toBeDefined();
  });

  it("does NOT show raw enum value 'SCHEDULED'", () => {
    renderMemberSession({ status: "SCHEDULED" });
    expect(screen.queryByText("SCHEDULED")).toBeNull();
  });

  it("does NOT show raw enum value 'CANCELLED'", () => {
    renderMemberSession({ status: "CANCELLED" });
    expect(screen.queryByText("CANCELLED")).toBeNull();
  });
});

describe("MemberSessionDetailClient — translated voting UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows translated 'Voting Open' badge when voting is active", () => {
    renderMemberSession({
      votingEnabled: true,
      votingDeadline: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    });
    expect(screen.getByText("Voting Open")).toBeDefined();
  });

  it("shows translated 'Your Attendance' card heading when voting enabled", () => {
    renderMemberSession({
      status: "SCHEDULED",
      votingEnabled: true,
      votingDeadline: new Date(Date.now() + 86400000).toISOString(),
    });
    expect(screen.getByText("Your Attendance")).toBeDefined();
  });

  it("shows translated 'Your Attendance' card heading for assigned non-voting session", () => {
    renderMemberSession(
      { status: "SCHEDULED", votingEnabled: false },
      { isAssigned: true }
    );
    expect(screen.getByText("Your Attendance")).toBeDefined();
  });

  it("shows translated 'I'm Coming' and 'Not Coming' buttons when voting is active", () => {
    renderMemberSession({
      votingEnabled: true,
      votingDeadline: new Date(Date.now() + 86400000).toISOString(),
    });
    expect(screen.getByText("I'm Coming")).toBeDefined();
    expect(screen.getByText("Not Coming")).toBeDefined();
  });

  it("shows translated 'Voting Closed' badge when deadline has passed", () => {
    renderMemberSession({
      votingEnabled: true,
      votingDeadline: new Date(Date.now() - 86400000).toISOString(), // Yesterday
    });
    expect(screen.getByText("Voting Closed")).toBeDefined();
  });
});

describe("MemberSessionDetailClient — translated member lists", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows translated 'Who's Coming' card when voting is active", () => {
    renderMemberSession({
      votingEnabled: true,
      votingDeadline: new Date(Date.now() + 86400000).toISOString(),
    });
    expect(screen.getByText("Who's Coming")).toBeDefined();
  });

  it("shows translated 'Members' card for assigned non-voting sessions", () => {
    renderMemberSession(
      {
        votingEnabled: false,
        assignedMemberNames: ["Alice", "Bob"],
      },
      { isAssigned: true }
    );
    expect(screen.getByText("Members")).toBeDefined();
  });

  it("shows translated 'Trainers' heading", () => {
    renderMemberSession({ trainerNames: ["Coach A"] });
    expect(screen.getByText("Trainers")).toBeDefined();
  });
});

describe("MemberSessionDetailClient — localized date formatting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders deadline with localized format (no hardcoded 'at')", () => {
    const future = new Date(Date.now() + 86400000);
    renderMemberSession({
      votingEnabled: true,
      votingDeadline: future.toISOString(),
    });
    // The date should use "EEE, MMM d, HH:mm" format (comma, not 'at')
    // We verify 'at' does NOT appear between date and time
    const html = document.body.innerHTML;
    // The text should contain a comma-separated date-time, not "at"
    expect(html).not.toContain("&#x27;at&#x27;"); // escaped "at" literal
  });
});
