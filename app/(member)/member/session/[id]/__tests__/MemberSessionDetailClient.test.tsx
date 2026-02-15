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
        isFull={false}
        hasComingVoteOnSameDay={false}
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
        isFull={false}
        hasComingVoteOnSameDay={false}
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
        isFull={false}
        hasComingVoteOnSameDay={false}
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
        isFull={false}
        hasComingVoteOnSameDay={false}
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
        isFull={false}
        hasComingVoteOnSameDay={false}
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
        isFull={false}
        hasComingVoteOnSameDay={false}
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
        isFull={false}
        hasComingVoteOnSameDay={false}
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
        isFull={false}
        hasComingVoteOnSameDay={false}
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
        isFull={false}
        hasComingVoteOnSameDay={false}
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
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    // Should show the checked state, not the "must be assigned" message
    expect(screen.getByText("✓ I'm Coming")).toBeTruthy();
  });

  it("shows Full badge and hides voting buttons when session is full", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession()}
        myVote={null}
        userId="member-1"
        isFull={true}
        hasComingVoteOnSameDay={false}
      />
    );

    expect(screen.getByText("Full")).toBeTruthy();
    expect(screen.getByText("This session is full — voting is closed.")).toBeTruthy();
    expect(screen.queryByText("I'm Coming")).toBeNull();
    expect(screen.queryByText("Not Coming")).toBeNull();
  });

  it("disables 'I'm Coming' button when member has Coming vote on same day", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession()}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={true}
      />
    );

    const comingButton = screen.getByText("I'm Coming").closest("button");
    expect(comingButton).toBeTruthy();
    expect(comingButton!.disabled).toBe(true);
    // "Not Coming" should still be enabled
    const notComingButton = screen.getByText("Not Coming").closest("button");
    expect(notComingButton).toBeTruthy();
    expect(notComingButton!.disabled).toBe(false);
  });

  it("shows same-day warning when member has Coming vote on same day", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession()}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={true}
      />
    );

    expect(screen.getByText(/already coming to another session/i)).toBeTruthy();
  });

  it("does NOT disable 'I'm Coming' if member already voted Coming on this session (same-day = self)", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession()}
        myVote={true}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={true}
      />
    );

    // "✓ I'm Coming" button should NOT be disabled since currentVote === true
    const comingButton = screen.getByText("✓ I'm Coming").closest("button");
    expect(comingButton).toBeTruthy();
    expect(comingButton!.disabled).toBe(false);
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
        isFull={false}
        hasComingVoteOnSameDay={false}
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

  // ===== Additional edge case and display tests =====

  it("displays correct attendance counts (coming, not coming, no vote yet)", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession({
          totalMembers: 10,
          votesCount: { coming: 3, notComing: 2 },
        })}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    // Coming count
    expect(screen.getByText("3")).toBeTruthy();
    // Not coming count
    expect(screen.getByText("2")).toBeTruthy();
    // No vote yet = 10 - 3 - 2 = 5
    expect(screen.getByText("5")).toBeTruthy();
  });

  it("displays 'Voting Open' badge when voting is enabled and deadline not passed", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession({
          votingEnabled: true,
          votingDeadline: "2099-01-01T00:00:00.000Z",
        })}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    expect(screen.getByText("Voting Open")).toBeTruthy();
  });

  it("displays 'Voting Closed' badge when deadline has passed", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession({
          votingEnabled: true,
          votingDeadline: "2020-01-01T00:00:00.000Z",
        })}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    expect(screen.getByText("Voting Closed")).toBeTruthy();
  });

  it("shows error toast when vote API returns error", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Voting deadline has passed" }),
    });

    render(
      <MemberSessionDetailClient
        session={makeSession()}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    fireEvent.click(screen.getByText("I'm Coming"));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          title: "Failed to vote",
        })
      );
    });
  });

  it("shows network error toast when fetch throws", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network failure")
    );

    render(
      <MemberSessionDetailClient
        session={makeSession()}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    fireEvent.click(screen.getByText("I'm Coming"));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          title: "Network error",
        })
      );
    });
  });

  it("'Not Coming' button is NOT disabled when hasComingVoteOnSameDay is true and no existing vote", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession()}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={true}
      />
    );

    const notComingButton = screen.getByText("Not Coming").closest("button");
    expect(notComingButton).toBeTruthy();
    expect(notComingButton!.disabled).toBe(false);
  });

  it("displays workout title and details", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession({
          workoutTitle: "Strength & Power",
          workoutDetails: "Deadlifts, squats, bench press",
        })}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    expect(screen.getByText("Strength & Power")).toBeTruthy();
    expect(screen.getByText("Deadlifts, squats, bench press")).toBeTruthy();
  });

  it("renders Back button", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession()}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    expect(screen.getByText("Back")).toBeTruthy();
  });

  it("calls router.back when Back button is clicked", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession()}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    fireEvent.click(screen.getByText("Back"));
    expect(mockBack).toHaveBeenCalled();
  });

  it("shows 'You can change your vote' hint after voting", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession()}
        myVote={true}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    expect(screen.getByText("You can change your vote until the deadline.")).toBeTruthy();
  });

  it("shows '✓ Not Coming' button when already voted Not Coming", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession()}
        myVote={false}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    expect(screen.getByText("✓ Not Coming")).toBeTruthy();
  });

  it("displays group member names", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession({
          memberNames: ["Alice", "Bob", "Charlie"],
        })}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.getByText("Bob")).toBeTruthy();
    expect(screen.getByText("Charlie")).toBeTruthy();
    expect(screen.getByText("3 members")).toBeTruthy();
  });

  it("displays trainer names with avatar initial", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession({
          trainerNames: ["Coach Smith"],
        })}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    expect(screen.getByText("Coach Smith")).toBeTruthy();
    expect(screen.getByText("C")).toBeTruthy(); // avatar initial
  });

  it("shows 'No members assigned' when memberNames is empty", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession({ memberNames: [] })}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    expect(screen.getByText("No members assigned")).toBeTruthy();
  });

  it("shows 'No trainer assigned' when trainerNames is empty", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession({ trainerNames: [] })}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    expect(screen.getByText("No trainer assigned")).toBeTruthy();
  });

  it("shows success toast after successful Coming vote", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { attending: true } }),
    });

    render(
      <MemberSessionDetailClient
        session={makeSession()}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    fireEvent.click(screen.getByText("I'm Coming"));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "success",
          title: "You're marked as coming!",
        })
      );
    });
  });

  it("shows success toast after successful Not Coming vote", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { attending: false } }),
    });

    render(
      <MemberSessionDetailClient
        session={makeSession()}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    fireEvent.click(screen.getByText("Not Coming"));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "success",
          title: "You're marked as not coming",
        })
      );
    });
  });

  it("refreshes router after successful vote", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { attending: true } }),
    });

    render(
      <MemberSessionDetailClient
        session={makeSession()}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    fireEvent.click(screen.getByText("I'm Coming"));

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("shows CANCELLED badge and no voting section for cancelled sessions", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession({ status: "CANCELLED" })}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    expect(screen.getByText("CANCELLED")).toBeTruthy();
    expect(screen.queryByText("Your Attendance")).toBeNull();
  });

  it("shows 'Not coming' in vote display when previously voted Not Coming after deadline", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession({
          votingDeadline: "2020-01-01T00:00:00.000Z",
        })}
        myVote={false}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    expect(screen.getByText("You voted:")).toBeTruthy();
    const notComingSpans = screen.getAllByText("Not coming");
    const voteSpan = notComingSpans.find((el) =>
      el.classList.contains("text-error-400")
    );
    expect(voteSpan).toBeTruthy();
  });
});
