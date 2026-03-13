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
  }, 15_000);

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
});
