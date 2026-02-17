/**
 * SessionDetailClient Tests — Confirmation Modal Integration
 *
 * Tests the cancel and delete session flows using ConfirmationModal
 * instead of window.confirm(). Covers:
 * - Modal opens when action button is clicked
 * - Modal closes when cancelled
 * - Confirm triggers the API call
 * - API success/failure handling
 * - Loading state during API calls
 * - Cancelled sessions hide the cancel button
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SessionDetailClient } from "../SessionDetailClient";

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
    votingEnabled: false,
    recurringSlotId: null,
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
  allTrainers: [{ id: "t1", name: "Coach" }],
  allMembers: [{ id: "m1", name: "Alice" }],
};

function renderSessionDetail(sessionOverrides: Record<string, unknown> = {}) {
  const session = makeSession(sessionOverrides);
  return render(
    <SessionDetailClient
      session={session as Parameters<typeof SessionDetailClient>[0]["session"]}
      {...defaultProps}
    />
  );
}

// ===== Tests =====

describe("SessionDetailClient — Confirmation Modals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  // --- Cancel Session Modal ---

  describe("cancel session modal", () => {
    it("does not show cancel modal initially", () => {
      renderSessionDetail();
      expect(screen.queryByText("Cancel this session? All assigned members will be notified.")).toBeNull();
    });

    it("opens cancel modal when Cancel Session button is clicked", () => {
      renderSessionDetail();
      fireEvent.click(screen.getByText("Cancel Session"));
      expect(screen.getByText("Cancel this session? All assigned members will be notified.")).toBeDefined();
      expect(screen.getByRole("dialog")).toBeDefined();
    });

    it("cancel modal has correct title", () => {
      renderSessionDetail();
      fireEvent.click(screen.getByText("Cancel Session"));
      // The modal title is rendered inside the dialog
      const dialog = screen.getByRole("dialog");
      expect(dialog.textContent).toContain("Cancel Session");
    });

    it("cancel modal has a danger-styled confirm button labeled Cancel Session", () => {
      renderSessionDetail();
      fireEvent.click(screen.getByText("Cancel Session"));
      // Inside the modal, there's a second "Cancel Session" button (the confirm action)
      const buttons = screen.getAllByText("Cancel Session");
      // First is the trigger button, second is inside the modal
      const confirmBtn = buttons[buttons.length - 1];
      expect(confirmBtn.className).toContain("bg-error-600");
    });

    it("closes cancel modal when Cancel (dismiss) button is clicked", () => {
      renderSessionDetail();
      fireEvent.click(screen.getByText("Cancel Session"));
      expect(screen.getByRole("dialog")).toBeDefined();

      // Click the "Cancel" dismiss button inside the modal
      fireEvent.click(screen.getByText("Cancel"));
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("closes cancel modal when Escape is pressed", () => {
      renderSessionDetail();
      fireEvent.click(screen.getByText("Cancel Session"));
      expect(screen.getByRole("dialog")).toBeDefined();

      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("calls PATCH API on confirm and shows success toast", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", mockFetch);

      renderSessionDetail();
      fireEvent.click(screen.getByText("Cancel Session"));

      // Click the confirm button inside the modal
      const buttons = screen.getAllByText("Cancel Session");
      fireEvent.click(buttons[buttons.length - 1]);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/sessions/session-1",
          expect.objectContaining({
            method: "PATCH",
            body: JSON.stringify({ status: "CANCELLED" }),
          })
        );
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: "success",
          title: "Session cancelled",
        });
      });

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled();
      });
    });

    it("closes the modal after successful cancel", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

      renderSessionDetail();
      fireEvent.click(screen.getByText("Cancel Session"));
      expect(screen.getByRole("dialog")).toBeDefined();

      const buttons = screen.getAllByText("Cancel Session");
      fireEvent.click(buttons[buttons.length - 1]);

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
    });

    it("shows error toast when cancel API fails", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

      renderSessionDetail();
      fireEvent.click(screen.getByText("Cancel Session"));

      const buttons = screen.getAllByText("Cancel Session");
      fireEvent.click(buttons[buttons.length - 1]);

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: "error",
          title: "Failed to cancel session",
        });
      });
    });

    it("shows network error toast on fetch exception", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network down")));

      renderSessionDetail();
      fireEvent.click(screen.getByText("Cancel Session"));

      const buttons = screen.getAllByText("Cancel Session");
      fireEvent.click(buttons[buttons.length - 1]);

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: "error",
          title: "Network error",
        });
      });
    });

    it("hides Cancel Session button when session is already cancelled", () => {
      renderSessionDetail({ status: "CANCELLED" });
      // "Cancel Session" should not appear as an action button
      // Only "Delete Session" should be visible
      const cancelButtons = screen.queryAllByText("Cancel Session");
      expect(cancelButtons.length).toBe(0);
    });
  });

  // --- Delete Session Modal ---

  describe("delete session modal", () => {
    it("does not show delete modal initially", () => {
      renderSessionDetail();
      expect(screen.queryByText("Permanently delete this session? This cannot be undone.")).toBeNull();
    });

    it("opens delete modal when Delete Session button is clicked", () => {
      renderSessionDetail();
      fireEvent.click(screen.getByText("Delete Session"));
      expect(screen.getByText("Permanently delete this session? This cannot be undone.")).toBeDefined();
      expect(screen.getByRole("dialog")).toBeDefined();
    });

    it("delete modal has correct title", () => {
      renderSessionDetail();
      fireEvent.click(screen.getByText("Delete Session"));
      const dialog = screen.getByRole("dialog");
      expect(dialog.textContent).toContain("Delete Session");
    });

    it("delete modal has a danger-styled Delete confirm button", () => {
      renderSessionDetail();
      fireEvent.click(screen.getByText("Delete Session"));
      // The confirm button inside the modal is labeled "Delete"
      const deleteBtn = screen.getByText("Delete");
      expect(deleteBtn.className).toContain("bg-error-600");
    });

    it("closes delete modal when Cancel button is clicked", () => {
      renderSessionDetail();
      fireEvent.click(screen.getByText("Delete Session"));
      expect(screen.getByRole("dialog")).toBeDefined();

      fireEvent.click(screen.getByText("Cancel"));
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("closes delete modal when Escape is pressed", () => {
      renderSessionDetail();
      fireEvent.click(screen.getByText("Delete Session"));
      expect(screen.getByRole("dialog")).toBeDefined();

      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("calls DELETE API on confirm and shows success toast", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", mockFetch);

      renderSessionDetail();
      fireEvent.click(screen.getByText("Delete Session"));
      fireEvent.click(screen.getByText("Delete"));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/sessions/session-1",
          expect.objectContaining({ method: "DELETE" })
        );
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: "success",
          title: "Session deleted",
        });
      });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/owner/schedule");
      });
    });

    it("closes the modal after successful delete", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

      renderSessionDetail();
      fireEvent.click(screen.getByText("Delete Session"));
      expect(screen.getByRole("dialog")).toBeDefined();

      fireEvent.click(screen.getByText("Delete"));

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
    });

    it("shows error toast when delete API fails", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

      renderSessionDetail();
      fireEvent.click(screen.getByText("Delete Session"));
      fireEvent.click(screen.getByText("Delete"));

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: "error",
          title: "Failed to delete session",
        });
      });
    });

    it("shows network error toast on fetch exception", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Offline")));

      renderSessionDetail();
      fireEvent.click(screen.getByText("Delete Session"));
      fireEvent.click(screen.getByText("Delete"));

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: "error",
          title: "Network error",
        });
      });
    });

    it("delete button is available even when session is cancelled", () => {
      renderSessionDetail({ status: "CANCELLED" });
      expect(screen.getByText("Delete Session")).toBeDefined();
    });

    it("navigates to /owner/schedule after successful delete", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

      renderSessionDetail();
      fireEvent.click(screen.getByText("Delete Session"));
      fireEvent.click(screen.getByText("Delete"));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/owner/schedule");
      });
    });
  });

  // --- No confirm() usage ---

  describe("no window.confirm() usage", () => {
    it("does not call window.confirm for cancel action", () => {
      const confirmSpy = vi.spyOn(window, "confirm");
      renderSessionDetail();
      fireEvent.click(screen.getByText("Cancel Session"));
      expect(confirmSpy).not.toHaveBeenCalled();
      confirmSpy.mockRestore();
    });

    it("does not call window.confirm for delete action", () => {
      const confirmSpy = vi.spyOn(window, "confirm");
      renderSessionDetail();
      fireEvent.click(screen.getByText("Delete Session"));
      expect(confirmSpy).not.toHaveBeenCalled();
      confirmSpy.mockRestore();
    });
  });

  // --- Modal isolation ---

  describe("modal isolation", () => {
    it("opening cancel modal does not open delete modal", () => {
      renderSessionDetail();
      fireEvent.click(screen.getByText("Cancel Session"));
      // Should see the cancel message, not the delete message
      expect(screen.getByText("Cancel this session? All assigned members will be notified.")).toBeDefined();
      expect(screen.queryByText("Permanently delete this session? This cannot be undone.")).toBeNull();
    });

    it("opening delete modal does not open cancel modal", () => {
      renderSessionDetail();
      fireEvent.click(screen.getByText("Delete Session"));
      expect(screen.getByText("Permanently delete this session? This cannot be undone.")).toBeDefined();
      expect(screen.queryByText("Cancel this session? All assigned members will be notified.")).toBeNull();
    });
  });
});
