/**
 * i18n-trainer-session.test.tsx — i18n-specific tests for TrainerSessionDetailClient
 *
 * Validates that the trainer session detail page uses translated day names,
 * translated session statuses, and localized strings.
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

describe("TrainerSessionDetailClient — translated day names", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
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
      renderTrainerDetail({ customDay: Number(day) });
      expect(screen.getByText(new RegExp(expectedName))).toBeDefined();
    });
  }

  it("uses recurringSlot.dayOfWeek when available", () => {
    renderTrainerDetail({
      recurringSlot: { dayOfWeek: 5, startHour: 17 },
      customDay: null,
    });
    expect(screen.getByText(/Friday/)).toBeDefined();
  });

  it("defaults to Monday when neither recurringSlot nor customDay set", () => {
    renderTrainerDetail({
      recurringSlot: null,
      customDay: null,
    });
    expect(screen.getByText(/Monday/)).toBeDefined();
  });
});

describe("TrainerSessionDetailClient — translated session status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("shows translated 'Scheduled' badge for SCHEDULED status", () => {
    renderTrainerDetail({ status: "SCHEDULED" });
    expect(screen.getByText("Scheduled")).toBeDefined();
  });

  it("shows translated 'Cancelled' badge for CANCELLED status", () => {
    renderTrainerDetail({ status: "CANCELLED" });
    expect(screen.getByText("Cancelled")).toBeDefined();
  });

  it("does NOT render raw 'SCHEDULED' enum value", () => {
    renderTrainerDetail({ status: "SCHEDULED" });
    expect(screen.queryByText("SCHEDULED")).toBeNull();
  });

  it("does NOT render raw 'CANCELLED' enum value", () => {
    renderTrainerDetail({ status: "CANCELLED" });
    expect(screen.queryByText("CANCELLED")).toBeNull();
  });
});

describe("TrainerSessionDetailClient — translated UI elements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders translated 'Back' button", () => {
    renderTrainerDetail();
    expect(screen.getByText("Back")).toBeDefined();
  });

  it("renders translated 'Workout' heading", () => {
    renderTrainerDetail();
    expect(screen.getByText("Workout")).toBeDefined();
  });

  it("renders translated 'Edit' button for workout", () => {
    renderTrainerDetail();
    expect(screen.getByText("Edit")).toBeDefined();
  });

  it("shows workout title and details", () => {
    renderTrainerDetail();
    expect(screen.getByText("Strength Training")).toBeDefined();
    expect(screen.getByText("Full body workout")).toBeDefined();
  });

  it("renders trainer name", () => {
    renderTrainerDetail();
    expect(screen.getByText("Coach")).toBeDefined();
  });
});

describe("TrainerSessionDetailClient — translated voting display", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("shows translated 'Voting Open' badge when voting is enabled", () => {
    renderTrainerDetail({ votingEnabled: true });
    expect(screen.getByText("Voting Open")).toBeDefined();
  });

  it("shows translated 'Enable Voting' button when voting is off", () => {
    renderTrainerDetail({ votingEnabled: false });
    expect(screen.getByText("Enable Voting")).toBeDefined();
  });

  it("shows translated 'Disable Voting' button when voting is on", () => {
    renderTrainerDetail({ votingEnabled: true });
    expect(screen.getByText("Disable Voting")).toBeDefined();
  });

  it("hides voting controls when session is cancelled", () => {
    renderTrainerDetail({ status: "CANCELLED", votingEnabled: false });
    expect(screen.queryByText("Enable Voting")).toBeNull();
    expect(screen.queryByText("Disable Voting")).toBeNull();
  });
});

describe("TrainerSessionDetailClient — attendance display", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders translated 'Attendance' heading when hasStarted is true", () => {
    renderTrainerDetail({}, {
      hasStarted: true,
      attendanceMembers: [
        { userId: "m1", name: "Alice", present: true },
      ],
    });
    expect(screen.getByText("Attendance")).toBeDefined();
  });

  it("renders translated present count", () => {
    renderTrainerDetail({}, {
      hasStarted: true,
      attendanceMembers: [
        { userId: "m1", name: "Alice", present: true },
        { userId: "m2", name: "Bob", present: false },
      ],
      allMembers: [
        { id: "m1", name: "Alice" },
        { id: "m2", name: "Bob" },
      ],
    });
    expect(screen.getByText("1 / 2 present")).toBeDefined();
  });

  it("does NOT render attendance when hasStarted is false", () => {
    renderTrainerDetail({}, { hasStarted: false });
    expect(screen.queryByText("Attendance")).toBeNull();
  });

  it("does NOT render attendance when session is cancelled", () => {
    renderTrainerDetail(
      { status: "CANCELLED" },
      { hasStarted: true, attendanceMembers: [{ userId: "m1", name: "Alice", present: true }] }
    );
    expect(screen.queryByText("Attendance")).toBeNull();
  });
});
