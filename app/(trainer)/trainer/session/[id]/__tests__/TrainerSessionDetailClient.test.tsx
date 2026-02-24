/**
 * TrainerSessionDetailClient Tests — AttendanceChecklist Integration
 *
 * Tests that the AttendanceChecklist component renders or does not render
 * based on `hasStarted` prop and session status (cancelled vs scheduled).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrainerSessionDetailClient } from "../TrainerSessionDetailClient";

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
    workoutTitle: "Strength Training",
    workoutDetails: "Full body workout",
    votingEnabled: false,
    recurringSlot: null,
    customDay: 1,
    customStartHour: 9,
    members: [
      { userId: "m1", name: "Alice", email: "alice@test.com", status: "ACTIVE" },
    ],
    trainers: [
      { userId: "t1", name: "Coach", email: "coach@test.com" },
    ],
    ...overrides,
  };
}

const defaultProps = {
  voteMembers: [],
  allMembers: [{ id: "m1", name: "Alice" }],
  attendanceMembers: [] as Array<{ userId: string; name: string; present: boolean | null }>,
  hasStarted: false,
};

function renderTrainerDetail(
  sessionOverrides: Record<string, unknown> = {},
  propsOverrides: Record<string, unknown> = {}
) {
  const session = makeSession(sessionOverrides);
  const props = { ...defaultProps, ...propsOverrides };
  return render(
    <TrainerSessionDetailClient
      session={session as Parameters<typeof TrainerSessionDetailClient>[0]["session"]}
      {...props}
    />
  );
}

// ===== Tests =====

describe("TrainerSessionDetailClient — basic rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders the session day and time", () => {
    renderTrainerDetail();
    // customDay=1 is Monday, customStartHour=9 is 9:00 AM
    expect(screen.getByText(/Monday/)).toBeDefined();
  });

  it("renders Back button", () => {
    renderTrainerDetail();
    expect(screen.getByText("Back")).toBeDefined();
  });

  it("shows CANCELLED badge when session is cancelled", () => {
    renderTrainerDetail({ status: "CANCELLED" });
    expect(screen.getByText("CANCELLED")).toBeDefined();
  });

  it("shows SCHEDULED badge when session is scheduled", () => {
    renderTrainerDetail({ status: "SCHEDULED" });
    expect(screen.getByText("SCHEDULED")).toBeDefined();
  });

  it("renders workout title and details", () => {
    renderTrainerDetail();
    expect(screen.getByText("Strength Training")).toBeDefined();
    expect(screen.getByText("Full body workout")).toBeDefined();
  });

  it("renders trainer names", () => {
    renderTrainerDetail();
    expect(screen.getByText("Coach")).toBeDefined();
  });
});

describe("TrainerSessionDetailClient — AttendanceChecklist rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders AttendanceChecklist when hasStarted is true and session is not cancelled", () => {
    renderTrainerDetail({}, {
      hasStarted: true,
      attendanceMembers: [
        { userId: "m1", name: "Alice", present: true },
      ],
      allMembers: [{ id: "m1", name: "Alice" }],
    });

    expect(screen.getByText("Attendance")).toBeDefined();
  });

  it("does NOT render AttendanceChecklist when hasStarted is false", () => {
    renderTrainerDetail({}, {
      hasStarted: false,
      attendanceMembers: [
        { userId: "m1", name: "Alice", present: true },
      ],
    });

    expect(screen.queryByText("Attendance")).toBeNull();
  });

  it("does NOT render AttendanceChecklist when session is cancelled", () => {
    renderTrainerDetail({ status: "CANCELLED" }, {
      hasStarted: true,
      attendanceMembers: [
        { userId: "m1", name: "Alice", present: true },
      ],
    });

    expect(screen.queryByText("Attendance")).toBeNull();
  });

  it("does NOT render AttendanceChecklist when both hasStarted is false and session is cancelled", () => {
    renderTrainerDetail({ status: "CANCELLED" }, {
      hasStarted: false,
      attendanceMembers: [],
    });

    expect(screen.queryByText("Attendance")).toBeNull();
  });

  it("renders AttendanceChecklist with correct present count", () => {
    renderTrainerDetail({}, {
      hasStarted: true,
      attendanceMembers: [
        { userId: "m1", name: "Alice", present: true },
        { userId: "m2", name: "Bob", present: false },
        { userId: "m3", name: "Charlie", present: null },
      ],
      allMembers: [
        { id: "m1", name: "Alice" },
        { id: "m2", name: "Bob" },
        { id: "m3", name: "Charlie" },
      ],
    });

    expect(screen.getByText("Attendance")).toBeDefined();
    expect(screen.getByText("1 / 3 present")).toBeDefined();
  });

  it("renders AttendanceChecklist with empty attendance list", () => {
    renderTrainerDetail({}, {
      hasStarted: true,
      attendanceMembers: [],
      allMembers: [{ id: "m1", name: "Alice" }],
    });

    expect(screen.getByText("Attendance")).toBeDefined();
    expect(screen.getByText("0 / 0 present")).toBeDefined();
  });
});

describe("TrainerSessionDetailClient — voting display", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("shows Voting Open badge when voting is enabled", () => {
    renderTrainerDetail({ votingEnabled: true });
    expect(screen.getByText("Voting Open")).toBeDefined();
  });

  it("does not show Voting Open badge when voting is disabled", () => {
    renderTrainerDetail({ votingEnabled: false });
    expect(screen.queryByText("Voting Open")).toBeNull();
  });

  it("shows Enable Voting button when voting is off and session not cancelled", () => {
    renderTrainerDetail({ votingEnabled: false });
    expect(screen.getByText("Enable Voting")).toBeDefined();
  });

  it("shows Disable Voting button when voting is on and session not cancelled", () => {
    renderTrainerDetail({ votingEnabled: true });
    expect(screen.getByText("Disable Voting")).toBeDefined();
  });

  it("hides voting toggle when session is cancelled", () => {
    renderTrainerDetail({ status: "CANCELLED", votingEnabled: false });
    expect(screen.queryByText("Enable Voting")).toBeNull();
    expect(screen.queryByText("Disable Voting")).toBeNull();
  });
});
