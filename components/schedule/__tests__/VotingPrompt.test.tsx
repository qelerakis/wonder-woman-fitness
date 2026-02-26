/**
 * VotingPrompt Unit Tests
 *
 * Tests voting button styling: green (success) for "I'm coming",
 * red (danger) for "I'm not coming", ring glows, icons, and
 * all interaction states (unselected, selected, disabled, past deadline).
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { VotingPrompt } from "../VotingPrompt";

// ===== Helpers =====

const FUTURE_DEADLINE = new Date("2099-01-01T00:00:00.000Z");
const PAST_DEADLINE = new Date("2020-01-01T00:00:00.000Z");

function renderVotingPrompt(
  overrides: Partial<React.ComponentProps<typeof VotingPrompt>> = {}
) {
  const defaultProps = {
    sessionId: "session-1",
    votingDeadline: FUTURE_DEADLINE,
    currentVote: null as boolean | null | undefined,
    onVote: vi.fn().mockResolvedValue(undefined),
    disabled: false,
  };
  return render(<VotingPrompt {...defaultProps} {...overrides} />);
}

function getComingButton(): HTMLButtonElement {
  return screen.getByText("I'm coming").closest("button")!;
}

function getNotComingButton(): HTMLButtonElement {
  return screen.getByText("I'm not coming").closest("button")!;
}

// ===== Tests =====

describe("VotingPrompt", () => {
  // ─── Button text and presence ─────────────────────────────────

  it("renders both voting buttons", () => {
    renderVotingPrompt();
    expect(screen.getByText("I'm coming")).toBeTruthy();
    expect(screen.getByText("I'm not coming")).toBeTruthy();
  });

  it("renders the question heading", () => {
    renderVotingPrompt();
    expect(screen.getByText("Will you attend this session?")).toBeTruthy();
  });

  // ─── Unselected state (no vote) ──────────────────────────────

  it("uses secondary variant for 'I'm coming' when no vote cast", () => {
    renderVotingPrompt({ currentVote: null });
    const btn = getComingButton();
    expect(btn.className).toContain("bg-surface-700");
    expect(btn.className).not.toContain("bg-success-600");
  });

  it("uses secondary variant for 'I'm not coming' when no vote cast", () => {
    renderVotingPrompt({ currentVote: null });
    const btn = getNotComingButton();
    expect(btn.className).toContain("bg-surface-700");
    expect(btn.className).not.toContain("bg-error-600");
  });

  it("does not show success ring glow when no vote cast", () => {
    renderVotingPrompt({ currentVote: null });
    const btn = getComingButton();
    expect(btn.className).not.toContain("ring-success-500/50");
  });

  it("does not show error ring glow when no vote cast", () => {
    renderVotingPrompt({ currentVote: null });
    const btn = getNotComingButton();
    expect(btn.className).not.toContain("ring-error-500/50");
  });

  // ─── Selected: Coming (green) ────────────────────────────────

  it("uses success variant (green) for 'I'm coming' when voted coming", () => {
    renderVotingPrompt({ currentVote: true });
    const btn = getComingButton();
    expect(btn.className).toContain("bg-success-600");
    expect(btn.className).toContain("text-white");
  });

  it("shows success ring glow when voted coming", () => {
    renderVotingPrompt({ currentVote: true });
    const btn = getComingButton();
    expect(btn.className).toContain("ring-2");
    expect(btn.className).toContain("ring-success-500/50");
  });

  it("keeps 'I'm not coming' as secondary when voted coming", () => {
    renderVotingPrompt({ currentVote: true });
    const btn = getNotComingButton();
    expect(btn.className).toContain("bg-surface-700");
    expect(btn.className).not.toContain("bg-error-600");
  });

  // ─── Selected: Not Coming (red) ──────────────────────────────

  it("uses danger variant (red) for 'I'm not coming' when voted not coming", () => {
    renderVotingPrompt({ currentVote: false });
    const btn = getNotComingButton();
    expect(btn.className).toContain("bg-error-600");
    expect(btn.className).toContain("text-white");
  });

  it("shows error ring glow when voted not coming", () => {
    renderVotingPrompt({ currentVote: false });
    const btn = getNotComingButton();
    expect(btn.className).toContain("ring-2");
    expect(btn.className).toContain("ring-error-500/50");
  });

  it("keeps 'I'm coming' as secondary when voted not coming", () => {
    renderVotingPrompt({ currentVote: false });
    const btn = getComingButton();
    expect(btn.className).toContain("bg-surface-700");
    expect(btn.className).not.toContain("bg-success-600");
  });

  // ─── SVG icons ───────────────────────────────────────────────

  it("renders checkmark SVG icon in 'I'm coming' button", () => {
    renderVotingPrompt();
    const btn = getComingButton();
    const svg = btn.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg!.classList.contains("h-4")).toBe(true);
    expect(svg!.classList.contains("w-4")).toBe(true);
  });

  it("renders X SVG icon in 'I'm not coming' button", () => {
    renderVotingPrompt();
    const btn = getNotComingButton();
    const svg = btn.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg!.classList.contains("h-4")).toBe(true);
    expect(svg!.classList.contains("w-4")).toBe(true);
  });

  // ─── Disabled state ──────────────────────────────────────────

  it("disables both buttons when disabled prop is true", () => {
    renderVotingPrompt({ disabled: true });
    expect(getComingButton().disabled).toBe(true);
    expect(getNotComingButton().disabled).toBe(true);
  });

  it("disables both buttons when voting deadline has passed", () => {
    renderVotingPrompt({ votingDeadline: PAST_DEADLINE });
    expect(getComingButton().disabled).toBe(true);
    expect(getNotComingButton().disabled).toBe(true);
  });

  it("shows 'Voting has closed' text when deadline passed", () => {
    renderVotingPrompt({ votingDeadline: PAST_DEADLINE });
    expect(screen.getByText("Voting has closed")).toBeTruthy();
  });

  // ─── Click interactions ──────────────────────────────────────

  it("calls onVote with (sessionId, true) when 'I'm coming' clicked", async () => {
    const onVote = vi.fn().mockResolvedValue(undefined);
    renderVotingPrompt({ onVote });

    fireEvent.click(getComingButton());

    await waitFor(() => {
      expect(onVote).toHaveBeenCalledWith("session-1", true);
    });
  });

  it("calls onVote with (sessionId, false) when 'I'm not coming' clicked", async () => {
    const onVote = vi.fn().mockResolvedValue(undefined);
    renderVotingPrompt({ onVote });

    fireEvent.click(getNotComingButton());

    await waitFor(() => {
      expect(onVote).toHaveBeenCalledWith("session-1", false);
    });
  });

  it("shows error message when onVote throws", async () => {
    const onVote = vi.fn().mockRejectedValue(new Error("fail"));
    renderVotingPrompt({ onVote });

    fireEvent.click(getComingButton());

    await waitFor(() => {
      expect(
        screen.getByText("Failed to submit your vote. Please try again.")
      ).toBeTruthy();
    });
  });

  // ─── Variant transitions after vote ──────────────────────────

  it("does not change variant until parent updates currentVote prop", () => {
    // currentVote=null means both buttons stay secondary
    // The VotingPrompt itself does not locally update the variant;
    // it relies on the parent passing new currentVote after onVote succeeds
    renderVotingPrompt({ currentVote: null });
    const comingBtn = getComingButton();
    const notComingBtn = getNotComingButton();

    expect(comingBtn.className).toContain("bg-surface-700");
    expect(notComingBtn.className).toContain("bg-surface-700");
  });

  // ─── Button enabled states ─────────────────────────────────────

  it("both buttons are enabled when not disabled and deadline not passed", () => {
    renderVotingPrompt({ disabled: false, votingDeadline: FUTURE_DEADLINE });
    expect(getComingButton().disabled).toBe(false);
    expect(getNotComingButton().disabled).toBe(false);
  });

  // ─── Deadline text display ─────────────────────────────────────

  it("shows 'Vote by' deadline text when deadline is in the future", () => {
    renderVotingPrompt({ votingDeadline: FUTURE_DEADLINE });
    expect(screen.getByText(/Vote by/)).toBeTruthy();
  });

  it("does not show 'Vote by' text when deadline has passed", () => {
    renderVotingPrompt({ votingDeadline: PAST_DEADLINE });
    expect(screen.queryByText(/Vote by/)).toBeNull();
  });

  // ─── Error display ─────────────────────────────────────────────

  it("does not show error message initially", () => {
    renderVotingPrompt();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows error message with role=alert for accessibility", async () => {
    const onVote = vi.fn().mockRejectedValue(new Error("fail"));
    renderVotingPrompt({ onVote });

    fireEvent.click(getComingButton());

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toBeTruthy();
      expect(alert.textContent).toContain("Failed to submit your vote");
    });
  });

  // ─── Both variants when currentVote is undefined ───────────────

  it("treats undefined currentVote same as null (both secondary)", () => {
    renderVotingPrompt({ currentVote: undefined });
    const comingBtn = getComingButton();
    const notComingBtn = getNotComingButton();

    expect(comingBtn.className).toContain("bg-surface-700");
    expect(notComingBtn.className).toContain("bg-surface-700");
    expect(comingBtn.className).not.toContain("ring-success-500/50");
    expect(notComingBtn.className).not.toContain("ring-error-500/50");
  });

  // ─── Both buttons use sm size ──────────────────────────────────

  it("renders both buttons with sm size", () => {
    renderVotingPrompt();
    const comingBtn = getComingButton();
    const notComingBtn = getNotComingButton();

    expect(comingBtn.className).toContain("px-3");
    expect(comingBtn.className).toContain("py-1.5");
    expect(notComingBtn.className).toContain("px-3");
    expect(notComingBtn.className).toContain("py-1.5");
  });

  // ─── SessionId passed through correctly ────────────────────────

  it("uses the correct sessionId when calling onVote", async () => {
    const onVote = vi.fn().mockResolvedValue(undefined);
    renderVotingPrompt({ sessionId: "custom-session-id", onVote });

    fireEvent.click(getComingButton());

    await waitFor(() => {
      expect(onVote).toHaveBeenCalledWith("custom-session-id", true);
    });
  });

  // ─── Opposite button not called ────────────────────────────────

  it("does NOT call onVote for opposite button when clicking 'I'm coming'", async () => {
    const onVote = vi.fn().mockResolvedValue(undefined);
    renderVotingPrompt({ onVote });

    fireEvent.click(getComingButton());

    await waitFor(() => {
      expect(onVote).toHaveBeenCalledTimes(1);
      expect(onVote).toHaveBeenCalledWith("session-1", true);
      expect(onVote).not.toHaveBeenCalledWith("session-1", false);
    });
  });
});
