/**
 * MemberSessionDetailClient Tests
 *
 * Tests that ALL members can vote on any session when voting is open.
 * Voting is not gated by session assignment.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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
    workoutTitle: "HIIT Training",
    workoutDetails: "30 min cardio",
    votingEnabled: true,
    votingDeadline: "2099-01-01T00:00:00.000Z", // far future = voting open
    recurringSlot: { dayOfWeek: 1, startHour: 9 },
    customDay: null,
    customStartHour: null,
    memberNames: ["Alice", "Bob"],
    trainerNames: ["Coach"],
    totalMembers: 2,
    votesCount: { coming: 1, notComing: 0 },
    ...overrides,
  };
}

// ===== Tests =====

describe("MemberSessionDetailClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("shows voting buttons for an UNASSIGNED member when voting is open", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession()}
        myVote={null}
        userId="member-99"

      />
    );

    expect(screen.getByText("Will you attend this session?")).toBeTruthy();
    expect(screen.getByText("I'm Coming")).toBeTruthy();
    expect(screen.getByText("Not Coming")).toBeTruthy();
  });

  it("shows voting buttons for an ASSIGNED member when voting is open", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession()}
        myVote={null}
        userId="member-1"

      />
    );

    expect(screen.getByText("Will you attend this session?")).toBeTruthy();
    expect(screen.getByText("I'm Coming")).toBeTruthy();
    expect(screen.getByText("Not Coming")).toBeTruthy();
  });

  it("does NOT show 'not assigned' warning that blocks voting", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession()}
        myVote={null}
        userId="member-99"

      />
    );

    // Should NOT have the old "must be assigned to vote" message
    expect(screen.queryByText(/must be assigned.*to vote/i)).toBeNull();
  });

  it("does NOT show unassigned banner that discourages voting", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession()}
        myVote={null}
        userId="member-99"

      />
    );

    // Should NOT have the old "not assigned to this session" banner
    expect(screen.queryByText(/not assigned to this session/i)).toBeNull();
  });

  it("hides voting buttons when voting is disabled (regardless of assignment)", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession({ votingEnabled: false })}
        myVote={null}
        userId="member-1"

      />
    );

    expect(screen.queryByText("I'm Coming")).toBeNull();
    expect(screen.queryByText("Not Coming")).toBeNull();
    expect(screen.getByText("Voting is not open for this session.")).toBeTruthy();
  });

  it("hides voting buttons when deadline has passed (regardless of assignment)", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession({
          votingDeadline: "2020-01-01T00:00:00.000Z", // past
        })}
        myVote={null}
        userId="member-1"

      />
    );

    expect(screen.queryByText("I'm Coming")).toBeNull();
    expect(screen.getByText("Voting deadline has passed.")).toBeTruthy();
  });

  it("shows previous vote for unassigned member after deadline", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession({
          votingDeadline: "2020-01-01T00:00:00.000Z", // past
        })}
        myVote={true}
        userId="member-99"

      />
    );

    // The vote display shows "You voted: Coming" with "Coming" in a styled span
    expect(screen.getByText("You voted:")).toBeTruthy();
    const comingSpans = screen.getAllByText("Coming");
    const voteSpan = comingSpans.find((el) =>
      el.classList.contains("text-success-400")
    );
    expect(voteSpan).toBeTruthy();
  });

  it("does not show voting section when session is cancelled", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession({ status: "CANCELLED" })}
        myVote={null}
        userId="member-1"

      />
    );

    expect(screen.queryByText("Your Attendance")).toBeNull();
    expect(screen.queryByText("I'm Coming")).toBeNull();
  });

  it("submits vote via fetch when unassigned member clicks 'I'm Coming'", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { attending: true } }),
    });

    render(
      <MemberSessionDetailClient
        session={makeSession()}
        myVote={null}
        userId="member-99"

      />
    );

    fireEvent.click(screen.getByText("I'm Coming"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "session-1", attending: true }),
      });
    });
  });

  it("shows current vote state with checkmark for unassigned member", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession()}
        myVote={true}
        userId="member-99"

      />
    );

    // Should show the checked state, not the "must be assigned" message
    expect(screen.getByText("✓ I'm Coming")).toBeTruthy();
  });

  it("allows unassigned member to change vote to 'Not Coming'", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { attending: false } }),
    });

    render(
      <MemberSessionDetailClient
        session={makeSession()}
        myVote={true}
        userId="member-99"

      />
    );

    fireEvent.click(screen.getByText("Not Coming"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "session-1", attending: false }),
      });
    });
  });
});
