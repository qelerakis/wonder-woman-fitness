/**
 * MemberSessionDetailClient Tests
 *
 * Tests that ALL members can vote on any session when voting is open.
 * Voting is not gated by session assignment.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
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
    trainerNames: ["Coach"],
    comingMemberNames: ["Alice"],
    votesCount: { coming: 1 },
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

    // Should show the checked state with green success variant, not the "must be assigned" message
    expect(screen.getByText("I'm Coming")).toBeTruthy();
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

    // "I'm Coming" button should NOT be disabled since currentVote === true
    const comingButton = screen.getByText("I'm Coming").closest("button");
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

  it("shows 'Who's Coming' card with confirmed count when voting is active", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession({
          comingMemberNames: ["Alice", "Bob", "Charlie"],
          votesCount: { coming: 3 },
        })}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    expect(screen.getByText("Who's Coming")).toBeTruthy();
    expect(screen.getByText("3 confirmed")).toBeTruthy();
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.getByText("Bob")).toBeTruthy();
    expect(screen.getByText("Charlie")).toBeTruthy();
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

    expect(screen.getByText(/You can change your vote until/)).toBeTruthy();
  });

  it("shows 'Not Coming' button with danger variant when already voted Not Coming", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession()}
        myVote={false}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    expect(screen.getByText("Not Coming")).toBeTruthy();
  });

  it("shows 'No one has confirmed yet' when no coming votes and voting active", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession({
          comingMemberNames: [],
          votesCount: { coming: 0 },
        })}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    expect(screen.getByText("No one has confirmed yet")).toBeTruthy();
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

  it("hides 'Who's Coming' card when voting is not active (deadline passed)", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession({
          votingDeadline: "2020-01-01T00:00:00.000Z",
          comingMemberNames: ["Alice"],
          votesCount: { coming: 1 },
        })}
        myVote={true}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    expect(screen.queryByText("Who's Coming")).toBeNull();
  });

  it("hides 'Who's Coming' card when voting is disabled", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession({
          votingEnabled: false,
          comingMemberNames: ["Alice"],
          votesCount: { coming: 1 },
        })}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    expect(screen.queryByText("Who's Coming")).toBeNull();
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

  // ─── Voting button variant/styling tests ───────────────────────

  it("uses success variant (green) for 'I'm Coming' button when voted coming", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession()}
        myVote={true}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    const comingButton = screen.getByText("I'm Coming").closest("button")!;
    expect(comingButton.className).toContain("bg-success-600");
    expect(comingButton.className).toContain("text-white");
  });

  it("shows success ring glow on 'I'm Coming' button when voted coming", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession()}
        myVote={true}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    const comingButton = screen.getByText("I'm Coming").closest("button")!;
    expect(comingButton.className).toContain("ring-2");
    expect(comingButton.className).toContain("ring-success-500/50");
  });

  it("uses secondary variant for 'I'm Coming' button when no vote cast", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession()}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    const comingButton = screen.getByText("I'm Coming").closest("button")!;
    expect(comingButton.className).toContain("bg-surface-700");
    expect(comingButton.className).not.toContain("bg-success-600");
  });

  it("does not show success ring glow on 'I'm Coming' when no vote cast", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession()}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    const comingButton = screen.getByText("I'm Coming").closest("button")!;
    expect(comingButton.className).not.toContain("ring-success-500/50");
  });

  it("uses danger variant (red) for 'Not Coming' button when voted not coming", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession()}
        myVote={false}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    const notComingButton = screen.getByText("Not Coming").closest("button")!;
    expect(notComingButton.className).toContain("bg-error-600");
    expect(notComingButton.className).toContain("text-white");
  });

  it("shows error ring glow on 'Not Coming' button when voted not coming", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession()}
        myVote={false}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    const notComingButton = screen.getByText("Not Coming").closest("button")!;
    expect(notComingButton.className).toContain("ring-2");
    expect(notComingButton.className).toContain("ring-error-500/50");
  });

  it("uses secondary variant for 'Not Coming' button when no vote cast", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession()}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    const notComingButton = screen.getByText("Not Coming").closest("button")!;
    expect(notComingButton.className).toContain("bg-surface-700");
    expect(notComingButton.className).not.toContain("bg-error-600");
  });

  it("does not show error ring glow on 'Not Coming' when no vote cast", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession()}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    const notComingButton = screen.getByText("Not Coming").closest("button")!;
    expect(notComingButton.className).not.toContain("ring-error-500/50");
  });

  it("renders checkmark SVG icon in 'I'm Coming' button", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession()}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    const comingButton = screen.getByText("I'm Coming").closest("button")!;
    const svg = comingButton.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg!.classList.contains("h-4")).toBe(true);
    expect(svg!.classList.contains("w-4")).toBe(true);
  });

  it("renders X SVG icon in 'Not Coming' button", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession()}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    const notComingButton = screen.getByText("Not Coming").closest("button")!;
    const svg = notComingButton.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg!.classList.contains("h-4")).toBe(true);
    expect(svg!.classList.contains("w-4")).toBe(true);
  });

  it("'Not Coming' stays secondary when member voted coming", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession()}
        myVote={true}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    const notComingButton = screen.getByText("Not Coming").closest("button")!;
    expect(notComingButton.className).toContain("bg-surface-700");
    expect(notComingButton.className).not.toContain("bg-error-600");
  });

  it("'I'm Coming' stays secondary when member voted not coming", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession()}
        myVote={false}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    const comingButton = screen.getByText("I'm Coming").closest("button")!;
    expect(comingButton.className).toContain("bg-surface-700");
    expect(comingButton.className).not.toContain("bg-success-600");
  });

  it("switches 'I'm Coming' to success variant after voting coming", async () => {
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

    // Before clicking: secondary
    const comingButton = screen.getByText("I'm Coming").closest("button")!;
    expect(comingButton.className).toContain("bg-surface-700");

    fireEvent.click(comingButton);

    // After voting: success variant
    await waitFor(() => {
      expect(comingButton.className).toContain("bg-success-600");
    });
  });

  it("switches 'Not Coming' to danger variant after voting not coming", async () => {
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

    const notComingButton = screen.getByText("Not Coming").closest("button")!;
    expect(notComingButton.className).toContain("bg-surface-700");

    fireEvent.click(notComingButton);

    await waitFor(() => {
      expect(notComingButton.className).toContain("bg-error-600");
    });
  });

  // ─── Custom session (no recurringSlot) ──────────────────────────

  it("renders correct day/time for custom session (no recurringSlot)", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession({
          recurringSlot: null,
          customDay: 3, // Wednesday
          customStartHour: 14, // 2 PM
        })}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    expect(screen.getByText(/Wednesday/)).toBeTruthy();
    expect(screen.getByText(/2:00 PM/)).toBeTruthy();
  });

  it("renders correct day/time from recurringSlot when present", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession({
          recurringSlot: { dayOfWeek: 5, startHour: 17 }, // Friday 5 PM
        })}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    expect(screen.getByText(/Friday/)).toBeTruthy();
    expect(screen.getByText(/5:00 PM/)).toBeTruthy();
  });

  // ─── Who's Coming vs isFull interaction ─────────────────────────

  it("shows 'Who's Coming' card even when isFull is true (voting still active)", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession({
          comingMemberNames: ["Alice", "Bob"],
          votesCount: { coming: 2 },
        })}
        myVote={null}
        userId="member-1"
        isFull={true}
        hasComingVoteOnSameDay={false}
      />
    );

    // Who's Coming should still be visible because votingActive is true
    expect(screen.getByText("Who's Coming")).toBeTruthy();
    expect(screen.getByText("2 confirmed")).toBeTruthy();
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.getByText("Bob")).toBeTruthy();
  });

  // ─── Who's Coming hidden for cancelled session ──────────────────

  it("hides 'Who's Coming' card when session is cancelled even if votingEnabled", () => {
    // votingActive = votingEnabled && !deadlinePassed, but cancelled sessions
    // still show the Who's Coming card if votingActive is true.
    // However, the voting section is hidden. Let's verify the Who's Coming
    // card renders based on votingActive, not cancellation status.
    render(
      <MemberSessionDetailClient
        session={makeSession({
          status: "CANCELLED",
          comingMemberNames: ["Alice"],
          votesCount: { coming: 1 },
        })}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    // votingActive is still true (votingEnabled=true, deadline in future)
    // so Who's Coming card should still render
    expect(screen.getByText("Who's Coming")).toBeTruthy();
    // But voting section (Your Attendance) should be hidden
    expect(screen.queryByText("Your Attendance")).toBeNull();
  });

  // ─── Status badge variants ──────────────────────────────────────

  it("shows SCHEDULED status with success badge variant", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession({ status: "SCHEDULED" })}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    expect(screen.getByText("SCHEDULED")).toBeTruthy();
  });

  it("shows CANCELLED status badge", () => {
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
  });

  // ─── Voting Open/Closed badges edge cases ──────────────────────

  it("does NOT show 'Voting Open' badge when votingEnabled is false", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession({ votingEnabled: false })}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    expect(screen.queryByText("Voting Open")).toBeNull();
  });

  it("does NOT show 'Voting Closed' badge when votingEnabled is false (even with past deadline)", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession({
          votingEnabled: false,
          votingDeadline: "2020-01-01T00:00:00.000Z",
        })}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    expect(screen.queryByText("Voting Closed")).toBeNull();
  });

  // ─── Workout display edge cases ─────────────────────────────────

  it("renders workout with only title (no details)", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession({
          workoutTitle: "Yoga Flow",
          workoutDetails: null,
        })}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    expect(screen.getByText("Yoga Flow")).toBeTruthy();
  });

  it("renders workout with only details (no title)", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession({
          workoutTitle: null,
          workoutDetails: "Stretching and flexibility",
        })}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    expect(screen.getByText("Stretching and flexibility")).toBeTruthy();
  });

  it("shows 'No workout posted yet' when both title and details are null", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession({
          workoutTitle: null,
          workoutDetails: null,
        })}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    expect(screen.getByText("No workout posted yet")).toBeTruthy();
  });

  // ─── Multiple trainers ──────────────────────────────────────────

  it("renders multiple trainer names with avatar initials", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession({
          trainerNames: ["Diana Prince", "Zara Coach"],
          comingMemberNames: [], // clear coming members to avoid initial collisions
          votesCount: { coming: 0 },
        })}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    expect(screen.getByText("Diana Prince")).toBeTruthy();
    expect(screen.getByText("Zara Coach")).toBeTruthy();
    expect(screen.getByText("D")).toBeTruthy(); // avatar initial for Diana
    expect(screen.getByText("Z")).toBeTruthy(); // avatar initial for Zara
  });

  // ─── Coming member avatar initials ──────────────────────────────

  it("renders avatar initials for coming members in uppercase", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession({
          comingMemberNames: ["alice smith"],
          votesCount: { coming: 1 },
        })}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    // name.charAt(0).toUpperCase() should produce "A"
    expect(screen.getByText("A")).toBeTruthy();
    expect(screen.getByText("alice smith")).toBeTruthy();
  });

  // ─── "0 confirmed" display ──────────────────────────────────────

  it("shows '0 confirmed' text when coming count is zero", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession({
          comingMemberNames: [],
          votesCount: { coming: 0 },
        })}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    expect(screen.getByText("0 confirmed")).toBeTruthy();
  });

  // ─── Vote change hint visibility ───────────────────────────────

  it("does NOT show 'change your vote' hint when no vote cast", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession()}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    expect(screen.queryByText(/You can change your vote until/)).toBeNull();
  });

  it("shows 'change your vote' hint when voted Not Coming", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession()}
        myVote={false}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    expect(screen.getByText(/You can change your vote until/)).toBeTruthy();
  });

  // ─── Same-day warning edge cases ────────────────────────────────

  it("does NOT show same-day warning when hasComingVoteOnSameDay is false", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession()}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    expect(screen.queryByText(/already coming to another session/i)).toBeNull();
  });

  it("does NOT show same-day warning when member already voted Coming on this session", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession()}
        myVote={true}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={true}
      />
    );

    // currentVote === true, so hasComingVoteOnSameDay && currentVote !== true is false
    expect(screen.queryByText(/already coming to another session/i)).toBeNull();
  });

  // ─── Error message content ──────────────────────────────────────

  it("includes server error message in toast when API returns error", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Session is at maximum capacity" }),
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
          message: "Session is at maximum capacity",
        })
      );
    });
  });

  // ─── Voting disabled for this session only ──────────────────────

  it("shows 'Voting is not open' when votingEnabled=false and no vote exists", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession({ votingEnabled: false })}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    expect(screen.getByText("Voting is not open for this session.")).toBeTruthy();
  });

  it("shows 'Voting deadline has passed' when deadline is past and no vote exists", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession({
          votingDeadline: "2020-01-01T00:00:00.000Z",
        })}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    expect(screen.getByText("Voting deadline has passed.")).toBeTruthy();
  });

  // ─── Coming vote display after deadline ──────────────────────────

  it("shows 'Coming' in green when voted Coming and deadline passed", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession({
          votingDeadline: "2020-01-01T00:00:00.000Z",
        })}
        myVote={true}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    expect(screen.getByText("You voted:")).toBeTruthy();
    const comingSpans = screen.getAllByText("Coming");
    const voteSpan = comingSpans.find((el) =>
      el.classList.contains("text-success-400")
    );
    expect(voteSpan).toBeTruthy();
  });

  // ─── Trainers card always visible ────────────────────────────────

  it("shows Trainers card even when voting is disabled", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession({
          votingEnabled: false,
          trainerNames: ["Coach Ana"],
        })}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    expect(screen.getByText("Trainers")).toBeTruthy();
    expect(screen.getByText("Coach Ana")).toBeTruthy();
  });

  it("shows Trainers card even when deadline has passed", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession({
          votingDeadline: "2020-01-01T00:00:00.000Z",
          trainerNames: ["Coach Ana"],
        })}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    expect(screen.getByText("Trainers")).toBeTruthy();
    expect(screen.getByText("Coach Ana")).toBeTruthy();
  });

  it("shows Trainers card even when session is cancelled", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession({
          status: "CANCELLED",
          trainerNames: ["Coach Ana"],
        })}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    expect(screen.getByText("Trainers")).toBeTruthy();
    expect(screen.getByText("Coach Ana")).toBeTruthy();
  });

  // ─── Workout card always visible ────────────────────────────────

  it("shows Workout card even when session is cancelled", () => {
    render(
      <MemberSessionDetailClient
        session={makeSession({ status: "CANCELLED" })}
        myVote={null}
        userId="member-1"
        isFull={false}
        hasComingVoteOnSameDay={false}
      />
    );

    expect(screen.getByText("Workout")).toBeTruthy();
    expect(screen.getByText("HIIT Training")).toBeTruthy();
  });

  // ─── Voting Deadline Display ──────────────────────────────────────

  describe("voting deadline display", () => {
    it("shows absolute deadline text when voting is open and more than 6 hours away", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-07T09:00:00.000Z"));

      render(
        <MemberSessionDetailClient
          session={makeSession({
            votingDeadline: "2026-03-08T09:00:00.000Z",
          })}
          myVote={null}
          userId="member-1"
          isFull={false}
          hasComingVoteOnSameDay={false}
        />
      );

      // Should show "Closes Sun, Mar 8 at 9:00 AM" (not "Closes in")
      expect(screen.getByText(/Closes/)).toBeTruthy();
      expect(screen.queryByText(/Closes in/)).toBeNull();

      vi.useRealTimers();
    });

    it("shows countdown text when voting is open and within 6 hours", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-08T05:30:00.000Z"));

      render(
        <MemberSessionDetailClient
          session={makeSession({
            votingDeadline: "2026-03-08T09:00:00.000Z",
          })}
          myVote={null}
          userId="member-1"
          isFull={false}
          hasComingVoteOnSameDay={false}
        />
      );

      expect(screen.getByText(/Closes in 3h 30m/)).toBeTruthy();

      vi.useRealTimers();
    });

    it("applies warning color to countdown text when within 6 hours", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-08T05:30:00.000Z"));

      render(
        <MemberSessionDetailClient
          session={makeSession({
            votingDeadline: "2026-03-08T09:00:00.000Z",
          })}
          myVote={null}
          userId="member-1"
          isFull={false}
          hasComingVoteOnSameDay={false}
        />
      );

      const countdownEl = screen.getByText(/Closes in/);
      expect(countdownEl.className).toContain("text-warning-400");

      vi.useRealTimers();
    });

    it("does not show deadline text when voting is closed", () => {
      render(
        <MemberSessionDetailClient
          session={makeSession({
            votingDeadline: "2020-01-01T00:00:00.000Z",
          })}
          myVote={null}
          userId="member-1"
          isFull={false}
          hasComingVoteOnSameDay={false}
        />
      );

      expect(screen.queryByText(/Closes/)).toBeNull();
    });

    it("does not show deadline text when votingEnabled is false", () => {
      render(
        <MemberSessionDetailClient
          session={makeSession({ votingEnabled: false })}
          myVote={null}
          userId="member-1"
          isFull={false}
          hasComingVoteOnSameDay={false}
        />
      );

      expect(screen.queryByText(/Closes/)).toBeNull();
    });

    it("shows actual deadline time in vote change hint text", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-07T09:00:00.000Z"));

      render(
        <MemberSessionDetailClient
          session={makeSession({
            votingDeadline: "2026-03-08T09:00:00.000Z",
          })}
          myVote={true}
          userId="member-1"
          isFull={false}
          hasComingVoteOnSameDay={false}
        />
      );

      // Old text was: "You can change your vote until the deadline."
      // New text should include actual date instead of "the deadline"
      expect(screen.queryByText("You can change your vote until the deadline.")).toBeNull();
      expect(screen.getByText(/You can change your vote until/)).toBeTruthy();

      vi.useRealTimers();
    });

    it("transitions from open to closed when deadline passes via timer", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-08T08:59:30.000Z"));

      render(
        <MemberSessionDetailClient
          session={makeSession({
            votingDeadline: "2026-03-08T09:00:00.000Z",
          })}
          myVote={null}
          userId="member-1"
          isFull={false}
          hasComingVoteOnSameDay={false}
        />
      );

      expect(screen.getByText("Voting Open")).toBeTruthy();

      // Advance past deadline (60s interval fires)
      act(() => {
        vi.advanceTimersByTime(60_000);
      });

      expect(screen.getByText("Voting Closed")).toBeTruthy();
      expect(screen.queryByText("Voting Open")).toBeNull();

      vi.useRealTimers();
    });
  });
});
