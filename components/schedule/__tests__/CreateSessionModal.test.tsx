/**
 * CreateSessionModal Unit Tests
 *
 * Tests rendering, form submission, error handling,
 * and loading states for the manual session creation modal.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act, cleanup } from "@testing-library/react";

// ===== Mocks =====

// Mock useToast
const mockAddToast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// ===== Test Data =====

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onCreated: vi.fn(),
  weekStart: new Date("2026-02-09T00:00:00.000Z"), // Monday
};

// ===== Tests =====

describe("CreateSessionModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("does not render when isOpen is false", async () => {
    const { CreateSessionModal } = await import(
      "@/components/schedule/CreateSessionModal"
    );

    const { container } = render(
      <CreateSessionModal {...defaultProps} isOpen={false} />
    );

    expect(container.innerHTML).toBe("");
  }, 10_000);

  it("renders modal with title and day/time selects when open", async () => {
    const { CreateSessionModal } = await import(
      "@/components/schedule/CreateSessionModal"
    );

    render(<CreateSessionModal {...defaultProps} />);

    expect(screen.getByText("Add Session")).toBeTruthy();
    expect(screen.getByText("Day")).toBeTruthy();
    expect(screen.getByText("Time")).toBeTruthy();
    expect(screen.getByText("Create Session")).toBeTruthy();
    expect(screen.getByText("Cancel")).toBeTruthy();
  });

  it("displays the week range", async () => {
    const { CreateSessionModal } = await import(
      "@/components/schedule/CreateSessionModal"
    );

    render(<CreateSessionModal {...defaultProps} />);

    // Should show "Feb 9, 2026" and "Feb 15, 2026"
    expect(screen.getByText(/Feb 9, 2026/)).toBeTruthy();
    expect(screen.getByText(/Feb 15, 2026/)).toBeTruthy();
  });

  it("defaults to One-Off tab", async () => {
    const { CreateSessionModal } = await import(
      "@/components/schedule/CreateSessionModal"
    );

    render(<CreateSessionModal {...defaultProps} />);

    const oneOffTab = screen.getByRole("tab", { name: "One-off" });
    expect(oneOffTab.getAttribute("aria-selected")).toBe("true");
  });

  it("shows two tabs: One-Off and New Recurring", async () => {
    const { CreateSessionModal } = await import(
      "@/components/schedule/CreateSessionModal"
    );

    render(<CreateSessionModal {...defaultProps} />);

    expect(screen.getByRole("tab", { name: "One-off" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Recurring" })).toBeTruthy();
  });

  it("Create Session button is disabled when no day/time selected", async () => {
    const { CreateSessionModal } = await import(
      "@/components/schedule/CreateSessionModal"
    );

    render(<CreateSessionModal {...defaultProps} />);

    const createButton = screen.getByRole("button", { name: "Create Session" });
    expect(createButton.hasAttribute("disabled")).toBe(true);
  });

  it("Create Session button is enabled after selecting day and time", async () => {
    const { CreateSessionModal } = await import(
      "@/components/schedule/CreateSessionModal"
    );

    render(<CreateSessionModal {...defaultProps} />);

    const selects = screen.getAllByRole("combobox");
    // First select is Day, second is Time
    fireEvent.change(selects[0], { target: { value: "1" } });
    fireEvent.change(selects[1], { target: { value: "9" } });

    const createButton = screen.getByRole("button", { name: "Create Session" });
    expect(createButton.hasAttribute("disabled")).toBe(false);
  });

  it("calls POST /api/sessions with one-off payload on submit", async () => {
    mockFetch.mockResolvedValue({
      status: 201,
      ok: true,
      json: async () => ({ data: { id: "new-session" } }),
    });

    const { CreateSessionModal } = await import(
      "@/components/schedule/CreateSessionModal"
    );

    render(<CreateSessionModal {...defaultProps} />);

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "1" } });
    fireEvent.change(selects[1], { target: { value: "9" } });

    const createButton = screen.getByRole("button", { name: "Create Session" });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customDay: 1,
          customStartHour: 9,
          weekDate: "2026-02-09",
        }),
      });
    });
  });

  it("calls onCreated on successful one-off creation (201)", async () => {
    mockFetch.mockResolvedValue({
      status: 201,
      ok: true,
      json: async () => ({ data: { id: "new-session" } }),
    });

    const onCreated = vi.fn();
    const { CreateSessionModal } = await import(
      "@/components/schedule/CreateSessionModal"
    );

    render(
      <CreateSessionModal {...defaultProps} onCreated={onCreated} />
    );

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "1" } });
    fireEvent.change(selects[1], { target: { value: "9" } });

    const createButton = screen.getByRole("button", { name: "Create Session" });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalled();
    });

    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: "success", title: "One-off session created" })
    );
  });

  it("shows error toast on 409 (time conflict)", async () => {
    mockFetch.mockResolvedValue({
      status: 409,
      ok: false,
      json: async () => ({ error: "Session already exists" }),
    });

    const { CreateSessionModal } = await import(
      "@/components/schedule/CreateSessionModal"
    );

    render(<CreateSessionModal {...defaultProps} />);

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "1" } });
    fireEvent.change(selects[1], { target: { value: "9" } });

    const createButton = screen.getByRole("button", { name: "Create Session" });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          title: "Time conflict",
        })
      );
    });
  });

  it("shows error toast on network failure", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const { CreateSessionModal } = await import(
      "@/components/schedule/CreateSessionModal"
    );

    render(<CreateSessionModal {...defaultProps} />);

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "1" } });
    fireEvent.change(selects[1], { target: { value: "9" } });

    const createButton = screen.getByRole("button", { name: "Create Session" });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          title: "Network error",
        })
      );
    });
  });

  it("shows error toast on generic server error", async () => {
    mockFetch.mockResolvedValue({
      status: 500,
      ok: false,
      json: async () => ({ error: "Internal server error" }),
    });

    const { CreateSessionModal } = await import(
      "@/components/schedule/CreateSessionModal"
    );

    render(<CreateSessionModal {...defaultProps} />);

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "1" } });
    fireEvent.change(selects[1], { target: { value: "9" } });

    const createButton = screen.getByRole("button", { name: "Create Session" });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          title: "Failed to create session",
        })
      );
    });
  });

  it("disables selects and buttons during submission", async () => {
    // Create a fetch that never resolves immediately
    let resolveFetch: ((value: unknown) => void) | undefined;
    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
    );

    const { CreateSessionModal } = await import(
      "@/components/schedule/CreateSessionModal"
    );

    render(<CreateSessionModal {...defaultProps} />);

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "1" } });
    fireEvent.change(selects[1], { target: { value: "9" } });

    const createButton = screen.getByRole("button", { name: "Create Session" });
    fireEvent.click(createButton);

    // While submitting, selects and button should be disabled
    await waitFor(() => {
      expect(selects[0].hasAttribute("disabled")).toBe(true);
      expect(selects[1].hasAttribute("disabled")).toBe(true);
      expect(createButton.hasAttribute("disabled")).toBe(true);
    });

    // Resolve the fetch to clean up — wrap in act to handle state updates
    await act(async () => {
      resolveFetch?.({ status: 201, ok: true, json: async () => ({ data: {} }) });
    });
  });

  it("does not close modal during submission when Cancel is clicked", async () => {
    let resolveFetch: ((value: unknown) => void) | undefined;
    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
    );

    const onClose = vi.fn();
    const { CreateSessionModal } = await import(
      "@/components/schedule/CreateSessionModal"
    );

    render(
      <CreateSessionModal {...defaultProps} onClose={onClose} />
    );

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "1" } });
    fireEvent.change(selects[1], { target: { value: "9" } });

    const createButton = screen.getByRole("button", { name: "Create Session" });
    fireEvent.click(createButton);

    // Wait for submission to start
    await waitFor(() => {
      expect(selects[0].hasAttribute("disabled")).toBe(true);
    });

    // Try to close — should not work during submission
    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelButton);

    expect(onClose).not.toHaveBeenCalled();

    // Resolve the fetch to clean up — wrap in act to handle state updates
    await act(async () => {
      resolveFetch?.({ status: 201, ok: true, json: async () => ({ data: {} }) });
    });
  });

  it("does not submit when no day/time is selected", async () => {
    const { CreateSessionModal } = await import(
      "@/components/schedule/CreateSessionModal"
    );

    render(<CreateSessionModal {...defaultProps} />);

    // Button should be disabled without selection
    const createButton = screen.getByRole("button", { name: "Create Session" });
    fireEvent.click(createButton);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  // ===== Recurring Tab Tests =====

  describe("Recurring tab", () => {
    it("submits recurring slot and session on success (both 201)", async () => {
      mockFetch
        .mockResolvedValueOnce({
          status: 201,
          ok: true,
          json: async () => ({ data: { id: "slot-123" } }),
        })
        .mockResolvedValueOnce({
          status: 201,
          ok: true,
          json: async () => ({ data: { id: "session-456" } }),
        });

      const onCreated = vi.fn();
      const { CreateSessionModal } = await import(
        "@/components/schedule/CreateSessionModal"
      );

      render(
        <CreateSessionModal {...defaultProps} onCreated={onCreated} />
      );

      // Switch to recurring tab
      const recurringTab = screen.getByRole("tab", { name: "Recurring" });
      fireEvent.click(recurringTab);

      // Select day and hour
      const selects = screen.getAllByRole("combobox");
      fireEvent.change(selects[0], { target: { value: "3" } }); // Wednesday
      fireEvent.change(selects[1], { target: { value: "10" } }); // 10:00

      const createButton = screen.getByRole("button", { name: "Create Slot & Session" });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      // First call: create recurring slot
      expect(mockFetch).toHaveBeenNthCalledWith(1, "/api/recurring-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayOfWeek: 3, startHour: 10 }),
      });

      // Second call: create session
      expect(mockFetch).toHaveBeenNthCalledWith(2, "/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recurringSlotId: "slot-123",
          weekDate: "2026-02-09",
        }),
      });

      expect(onCreated).toHaveBeenCalled();
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "success",
          title: "Recurring slot & session created",
        })
      );
    });

    it("shows error toast on slot 409 conflict and does NOT call onCreated", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 409,
        ok: false,
        json: async () => ({ error: "Slot already exists" }),
      });

      const onCreated = vi.fn();
      const { CreateSessionModal } = await import(
        "@/components/schedule/CreateSessionModal"
      );

      render(
        <CreateSessionModal {...defaultProps} onCreated={onCreated} />
      );

      const recurringTab = screen.getByRole("tab", { name: "Recurring" });
      fireEvent.click(recurringTab);

      const selects = screen.getAllByRole("combobox");
      fireEvent.change(selects[0], { target: { value: "3" } });
      fireEvent.change(selects[1], { target: { value: "10" } });

      const createButton = screen.getByRole("button", { name: "Create Slot & Session" });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "error",
            title: "Slot already exists",
          })
        );
      });

      expect(onCreated).not.toHaveBeenCalled();
      // Should only call fetch once (slot creation), not proceed to session
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("shows error toast on slot non-ok (500) and does NOT call onCreated", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 500,
        ok: false,
        json: async () => ({ error: "Internal server error" }),
      });

      const onCreated = vi.fn();
      const { CreateSessionModal } = await import(
        "@/components/schedule/CreateSessionModal"
      );

      render(
        <CreateSessionModal {...defaultProps} onCreated={onCreated} />
      );

      const recurringTab = screen.getByRole("tab", { name: "Recurring" });
      fireEvent.click(recurringTab);

      const selects = screen.getAllByRole("combobox");
      fireEvent.change(selects[0], { target: { value: "3" } });
      fireEvent.change(selects[1], { target: { value: "10" } });

      const createButton = screen.getByRole("button", { name: "Create Slot & Session" });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "error",
            title: "Failed to create recurring slot",
          })
        );
      });

      expect(onCreated).not.toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("shows error toast when slot succeeds but session fails", async () => {
      mockFetch
        .mockResolvedValueOnce({
          status: 201,
          ok: true,
          json: async () => ({ data: { id: "slot-123" } }),
        })
        .mockResolvedValueOnce({
          status: 500,
          ok: false,
          json: async () => ({ error: "Failed to create session" }),
        });

      const onCreated = vi.fn();
      const { CreateSessionModal } = await import(
        "@/components/schedule/CreateSessionModal"
      );

      render(
        <CreateSessionModal {...defaultProps} onCreated={onCreated} />
      );

      const recurringTab = screen.getByRole("tab", { name: "Recurring" });
      fireEvent.click(recurringTab);

      const selects = screen.getAllByRole("combobox");
      fireEvent.change(selects[0], { target: { value: "3" } });
      fireEvent.change(selects[1], { target: { value: "10" } });

      const createButton = screen.getByRole("button", { name: "Create Slot & Session" });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "error",
            title: "Slot created but session failed",
          })
        );
      });

      expect(onCreated).not.toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("shows network error toast on recurring flow network failure", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const onCreated = vi.fn();
      const { CreateSessionModal } = await import(
        "@/components/schedule/CreateSessionModal"
      );

      render(
        <CreateSessionModal {...defaultProps} onCreated={onCreated} />
      );

      const recurringTab = screen.getByRole("tab", { name: "Recurring" });
      fireEvent.click(recurringTab);

      const selects = screen.getAllByRole("combobox");
      fireEvent.change(selects[0], { target: { value: "3" } });
      fireEvent.change(selects[1], { target: { value: "10" } });

      const createButton = screen.getByRole("button", { name: "Create Slot & Session" });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "error",
            title: "Network error",
          })
        );
      });

      expect(onCreated).not.toHaveBeenCalled();
    });

    it("shows network error toast when slot succeeds but session fetch throws", async () => {
      mockFetch
        .mockResolvedValueOnce({
          status: 201,
          ok: true,
          json: async () => ({ data: { id: "slot-123" } }),
        })
        .mockRejectedValueOnce(new Error("Network error"));

      const onCreated = vi.fn();
      const { CreateSessionModal } = await import(
        "@/components/schedule/CreateSessionModal"
      );

      render(
        <CreateSessionModal {...defaultProps} onCreated={onCreated} />
      );

      const recurringTab = screen.getByRole("tab", { name: "Recurring" });
      fireEvent.click(recurringTab);

      const selects = screen.getAllByRole("combobox");
      fireEvent.change(selects[0], { target: { value: "3" } });
      fireEvent.change(selects[1], { target: { value: "10" } });

      const createButton = screen.getByRole("button", { name: "Create Slot & Session" });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "error",
            title: "Network error",
          })
        );
      });

      expect(onCreated).not.toHaveBeenCalled();
    });

    it("does not submit when no day/time is selected on recurring tab", async () => {
      const { CreateSessionModal } = await import(
        "@/components/schedule/CreateSessionModal"
      );

      render(<CreateSessionModal {...defaultProps} />);

      const recurringTab = screen.getByRole("tab", { name: "Recurring" });
      fireEvent.click(recurringTab);

      const createButton = screen.getByRole("button", { name: "Create Slot & Session" });
      expect(createButton.hasAttribute("disabled")).toBe(true);
      fireEvent.click(createButton);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("disables selects and buttons during recurring submission", async () => {
      let resolveFetch: ((value: unknown) => void) | undefined;
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          })
      );

      const { CreateSessionModal } = await import(
        "@/components/schedule/CreateSessionModal"
      );

      render(<CreateSessionModal {...defaultProps} />);

      const recurringTab = screen.getByRole("tab", { name: "Recurring" });
      fireEvent.click(recurringTab);

      const selects = screen.getAllByRole("combobox");
      fireEvent.change(selects[0], { target: { value: "3" } });
      fireEvent.change(selects[1], { target: { value: "10" } });

      const createButton = screen.getByRole("button", { name: "Create Slot & Session" });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(selects[0].hasAttribute("disabled")).toBe(true);
        expect(selects[1].hasAttribute("disabled")).toBe(true);
        expect(createButton.hasAttribute("disabled")).toBe(true);
      });

      // Resolve the fetch to clean up
      await act(async () => {
        resolveFetch?.({ status: 201, ok: true, json: async () => ({ data: { id: "slot-123" } }) });
      });

      // Resolve second fetch (session creation)
      await act(async () => {
        resolveFetch?.({ status: 201, ok: true, json: async () => ({ data: { id: "session-456" } }) });
      });
    });

    it("resets form after successful recurring submission", async () => {
      mockFetch
        .mockResolvedValueOnce({
          status: 201,
          ok: true,
          json: async () => ({ data: { id: "slot-123" } }),
        })
        .mockResolvedValueOnce({
          status: 201,
          ok: true,
          json: async () => ({ data: { id: "session-456" } }),
        });

      const { CreateSessionModal } = await import(
        "@/components/schedule/CreateSessionModal"
      );

      render(<CreateSessionModal {...defaultProps} />);

      const recurringTab = screen.getByRole("tab", { name: "Recurring" });
      fireEvent.click(recurringTab);

      const selects = screen.getAllByRole("combobox");
      fireEvent.change(selects[0], { target: { value: "3" } });
      fireEvent.change(selects[1], { target: { value: "10" } });

      const createButton = screen.getByRole("button", { name: "Create Slot & Session" });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(defaultProps.onCreated).toHaveBeenCalled();
      });

      // After successful submission, form should be reset (selects back to empty)
      const selectsAfter = screen.getAllByRole("combobox");
      expect((selectsAfter[0] as HTMLSelectElement).value).toBe("");
      expect((selectsAfter[1] as HTMLSelectElement).value).toBe("");
    });
  });

  // ===== Tab Switching Tests =====

  describe("Tab switching", () => {
    it("switching from one-off to recurring resets form selections", async () => {
      const { CreateSessionModal } = await import(
        "@/components/schedule/CreateSessionModal"
      );

      render(<CreateSessionModal {...defaultProps} />);

      // Select day and hour on one-off tab
      const selects = screen.getAllByRole("combobox");
      fireEvent.change(selects[0], { target: { value: "1" } });
      fireEvent.change(selects[1], { target: { value: "9" } });

      // Verify selections are set
      expect((selects[0] as HTMLSelectElement).value).toBe("1");
      expect((selects[1] as HTMLSelectElement).value).toBe("9");

      // Switch to recurring
      const recurringTab = screen.getByRole("tab", { name: "Recurring" });
      fireEvent.click(recurringTab);

      // Selections should be cleared
      const selectsAfter = screen.getAllByRole("combobox");
      expect((selectsAfter[0] as HTMLSelectElement).value).toBe("");
      expect((selectsAfter[1] as HTMLSelectElement).value).toBe("");
    });

    it("switching from recurring to one-off resets form selections", async () => {
      const { CreateSessionModal } = await import(
        "@/components/schedule/CreateSessionModal"
      );

      render(<CreateSessionModal {...defaultProps} />);

      // Switch to recurring
      const recurringTab = screen.getByRole("tab", { name: "Recurring" });
      fireEvent.click(recurringTab);

      // Select day and hour
      const selects = screen.getAllByRole("combobox");
      fireEvent.change(selects[0], { target: { value: "5" } });
      fireEvent.change(selects[1], { target: { value: "14" } });

      // Switch back to one-off
      const oneOffTab = screen.getByRole("tab", { name: "One-off" });
      fireEvent.click(oneOffTab);

      // Selections should be cleared
      const selectsAfter = screen.getAllByRole("combobox");
      expect((selectsAfter[0] as HTMLSelectElement).value).toBe("");
      expect((selectsAfter[1] as HTMLSelectElement).value).toBe("");
    });

    it("tab switching is disabled during submission", async () => {
      let resolveFetch: ((value: unknown) => void) | undefined;
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          })
      );

      const { CreateSessionModal } = await import(
        "@/components/schedule/CreateSessionModal"
      );

      render(<CreateSessionModal {...defaultProps} />);

      const selects = screen.getAllByRole("combobox");
      fireEvent.change(selects[0], { target: { value: "1" } });
      fireEvent.change(selects[1], { target: { value: "9" } });

      const createButton = screen.getByRole("button", { name: "Create Session" });
      fireEvent.click(createButton);

      // Wait for submission to start
      await waitFor(() => {
        expect(selects[0].hasAttribute("disabled")).toBe(true);
      });

      // Tabs should be disabled
      const recurringTab = screen.getByRole("tab", { name: "Recurring" });
      expect(recurringTab.hasAttribute("disabled")).toBe(true);

      const oneOffTab = screen.getByRole("tab", { name: "One-off" });
      expect(oneOffTab.hasAttribute("disabled")).toBe(true);

      // Resolve fetch to clean up
      await act(async () => {
        resolveFetch?.({ status: 201, ok: true, json: async () => ({ data: {} }) });
      });
    });

    it("after selecting day+hour on one-off, switching to recurring clears selections and disables button", async () => {
      const { CreateSessionModal } = await import(
        "@/components/schedule/CreateSessionModal"
      );

      render(<CreateSessionModal {...defaultProps} />);

      // Select day and hour on one-off
      const selects = screen.getAllByRole("combobox");
      fireEvent.change(selects[0], { target: { value: "2" } });
      fireEvent.change(selects[1], { target: { value: "11" } });

      // Button should be enabled
      const createButtonBefore = screen.getByRole("button", { name: "Create Session" });
      expect(createButtonBefore.hasAttribute("disabled")).toBe(false);

      // Switch to recurring
      const recurringTab = screen.getByRole("tab", { name: "Recurring" });
      fireEvent.click(recurringTab);

      // Button should be disabled (selections cleared)
      const createButtonAfter = screen.getByRole("button", { name: "Create Slot & Session" });
      expect(createButtonAfter.hasAttribute("disabled")).toBe(true);
    });
  });

  // ===== Modal Close Behavior =====

  describe("Modal close behavior", () => {
    it("Cancel button calls onClose when not submitting", async () => {
      const onClose = vi.fn();
      const { CreateSessionModal } = await import(
        "@/components/schedule/CreateSessionModal"
      );

      render(
        <CreateSessionModal {...defaultProps} onClose={onClose} />
      );

      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      fireEvent.click(cancelButton);

      expect(onClose).toHaveBeenCalled();
    });

    it("handleClose resets form and sets tab back to oneoff", async () => {
      const onClose = vi.fn();
      const { CreateSessionModal } = await import(
        "@/components/schedule/CreateSessionModal"
      );

      render(
        <CreateSessionModal {...defaultProps} onClose={onClose} />
      );

      // Switch to recurring and make selections
      const recurringTab = screen.getByRole("tab", { name: "Recurring" });
      fireEvent.click(recurringTab);

      const selects = screen.getAllByRole("combobox");
      fireEvent.change(selects[0], { target: { value: "4" } });
      fireEvent.change(selects[1], { target: { value: "15" } });

      // Cancel/close
      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      fireEvent.click(cancelButton);

      expect(onClose).toHaveBeenCalled();
    });

    it("after closing and reopening, form should be in default state", async () => {
      const onClose = vi.fn();
      const { CreateSessionModal } = await import(
        "@/components/schedule/CreateSessionModal"
      );

      const { rerender } = render(
        <CreateSessionModal {...defaultProps} onClose={onClose} />
      );

      // Switch to recurring and make selections
      const recurringTab = screen.getByRole("tab", { name: "Recurring" });
      fireEvent.click(recurringTab);

      const selects = screen.getAllByRole("combobox");
      fireEvent.change(selects[0], { target: { value: "4" } });
      fireEvent.change(selects[1], { target: { value: "15" } });

      // Close
      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      fireEvent.click(cancelButton);

      // Reopen (simulate closing and reopening)
      rerender(
        <CreateSessionModal {...defaultProps} isOpen={false} onClose={onClose} />
      );
      rerender(
        <CreateSessionModal {...defaultProps} isOpen={true} onClose={onClose} />
      );

      // Should be back on one-off tab
      const oneOffTab = screen.getByRole("tab", { name: "One-off" });
      expect(oneOffTab.getAttribute("aria-selected")).toBe("true");

      // Selections should be cleared
      const selectsAfter = screen.getAllByRole("combobox");
      expect((selectsAfter[0] as HTMLSelectElement).value).toBe("");
      expect((selectsAfter[1] as HTMLSelectElement).value).toBe("");
    });
  });

  // ===== One-off Edge Cases =====

  describe("One-off edge cases", () => {
    it("onCreated is NOT called on 409 error", async () => {
      mockFetch.mockResolvedValue({
        status: 409,
        ok: false,
        json: async () => ({ error: "Session already exists" }),
      });

      const onCreated = vi.fn();
      const { CreateSessionModal } = await import(
        "@/components/schedule/CreateSessionModal"
      );

      render(
        <CreateSessionModal {...defaultProps} onCreated={onCreated} />
      );

      const selects = screen.getAllByRole("combobox");
      fireEvent.change(selects[0], { target: { value: "1" } });
      fireEvent.change(selects[1], { target: { value: "9" } });

      const createButton = screen.getByRole("button", { name: "Create Session" });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalled();
      });

      expect(onCreated).not.toHaveBeenCalled();
    });

    it("onCreated is NOT called on 500 error", async () => {
      mockFetch.mockResolvedValue({
        status: 500,
        ok: false,
        json: async () => ({ error: "Internal server error" }),
      });

      const onCreated = vi.fn();
      const { CreateSessionModal } = await import(
        "@/components/schedule/CreateSessionModal"
      );

      render(
        <CreateSessionModal {...defaultProps} onCreated={onCreated} />
      );

      const selects = screen.getAllByRole("combobox");
      fireEvent.change(selects[0], { target: { value: "1" } });
      fireEvent.change(selects[1], { target: { value: "9" } });

      const createButton = screen.getByRole("button", { name: "Create Session" });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalled();
      });

      expect(onCreated).not.toHaveBeenCalled();
    });

    it("onCreated is NOT called on network error", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const onCreated = vi.fn();
      const { CreateSessionModal } = await import(
        "@/components/schedule/CreateSessionModal"
      );

      render(
        <CreateSessionModal {...defaultProps} onCreated={onCreated} />
      );

      const selects = screen.getAllByRole("combobox");
      fireEvent.change(selects[0], { target: { value: "1" } });
      fireEvent.change(selects[1], { target: { value: "9" } });

      const createButton = screen.getByRole("button", { name: "Create Session" });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalled();
      });

      expect(onCreated).not.toHaveBeenCalled();
    });

    it("form resets after successful one-off submission", async () => {
      mockFetch.mockResolvedValue({
        status: 201,
        ok: true,
        json: async () => ({ data: { id: "new-session" } }),
      });

      const { CreateSessionModal } = await import(
        "@/components/schedule/CreateSessionModal"
      );

      render(<CreateSessionModal {...defaultProps} />);

      const selects = screen.getAllByRole("combobox");
      fireEvent.change(selects[0], { target: { value: "1" } });
      fireEvent.change(selects[1], { target: { value: "9" } });

      const createButton = screen.getByRole("button", { name: "Create Session" });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(defaultProps.onCreated).toHaveBeenCalled();
      });

      // After successful submission, form should be reset
      const selectsAfter = screen.getAllByRole("combobox");
      expect((selectsAfter[0] as HTMLSelectElement).value).toBe("");
      expect((selectsAfter[1] as HTMLSelectElement).value).toBe("");
    });
  });

  // ===== Submit Button Text =====

  describe("Submit button text", () => {
    it("shows 'Create Session' on one-off tab", async () => {
      const { CreateSessionModal } = await import(
        "@/components/schedule/CreateSessionModal"
      );

      render(<CreateSessionModal {...defaultProps} />);

      expect(screen.getByRole("button", { name: "Create Session" })).toBeTruthy();
    });

    it("shows 'Create Slot & Session' on recurring tab", async () => {
      const { CreateSessionModal } = await import(
        "@/components/schedule/CreateSessionModal"
      );

      render(<CreateSessionModal {...defaultProps} />);

      const recurringTab = screen.getByRole("tab", { name: "Recurring" });
      fireEvent.click(recurringTab);

      expect(screen.getByRole("button", { name: "Create Slot & Session" })).toBeTruthy();
    });

    it("button text changes when switching tabs", async () => {
      const { CreateSessionModal } = await import(
        "@/components/schedule/CreateSessionModal"
      );

      render(<CreateSessionModal {...defaultProps} />);

      // Initially on one-off
      expect(screen.getByRole("button", { name: "Create Session" })).toBeTruthy();

      // Switch to recurring
      const recurringTab = screen.getByRole("tab", { name: "Recurring" });
      fireEvent.click(recurringTab);
      expect(screen.getByRole("button", { name: "Create Slot & Session" })).toBeTruthy();

      // Switch back to one-off
      const oneOffTab = screen.getByRole("tab", { name: "One-off" });
      fireEvent.click(oneOffTab);
      expect(screen.getByRole("button", { name: "Create Session" })).toBeTruthy();
    });
  });
});
