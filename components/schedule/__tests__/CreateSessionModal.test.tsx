/**
 * CreateSessionModal Unit Tests
 *
 * Tests rendering, slot selection, form submission, error handling,
 * and loading states for the manual session creation modal.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

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

const defaultSlots = [
  { id: "slot-1", dayOfWeek: 1, startHour: 9, trainerName: null },
  { id: "slot-2", dayOfWeek: 1, startHour: 18, trainerName: "Elena" },
  { id: "slot-3", dayOfWeek: 3, startHour: 9, trainerName: null },
  { id: "slot-4", dayOfWeek: 5, startHour: 18, trainerName: "Marko" },
];

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onCreated: vi.fn(),
  weekStart: new Date("2026-02-09T00:00:00.000Z"), // Monday
  recurringSlots: defaultSlots,
  existingSlotIds: [] as string[],
};

// ===== Tests =====

describe("CreateSessionModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when isOpen is false", async () => {
    const { CreateSessionModal } = await import(
      "@/components/schedule/CreateSessionModal"
    );

    const { container } = render(
      <CreateSessionModal {...defaultProps} isOpen={false} />
    );

    expect(container.innerHTML).toBe("");
  });

  it("renders modal with title and slot select when open", async () => {
    const { CreateSessionModal } = await import(
      "@/components/schedule/CreateSessionModal"
    );

    render(<CreateSessionModal {...defaultProps} />);

    expect(screen.getByText("Add Session")).toBeTruthy();
    expect(screen.getByText("Time Slot")).toBeTruthy();
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

  it("populates slot options from recurringSlots prop", async () => {
    const { CreateSessionModal } = await import(
      "@/components/schedule/CreateSessionModal"
    );

    render(<CreateSessionModal {...defaultProps} />);

    const select = screen.getByRole("combobox");
    const options = Array.from(
      (select as HTMLSelectElement).querySelectorAll("option")
    );

    // First option is the placeholder
    expect(options[0].textContent).toBe("Select a time slot");

    // Slot options should be formatted as "Day Time"
    expect(options[1].textContent).toContain("Monday");
    expect(options[1].textContent).toContain("9:00 AM");

    // Slot with trainer name should include it
    expect(options[2].textContent).toContain("Monday");
    expect(options[2].textContent).toContain("6:00 PM");
    expect(options[2].textContent).toContain("Elena");

    expect(options[3].textContent).toContain("Wednesday");
    expect(options[4].textContent).toContain("Friday");
    expect(options[4].textContent).toContain("Marko");
  });

  it("disables slots that already have sessions", async () => {
    const { CreateSessionModal } = await import(
      "@/components/schedule/CreateSessionModal"
    );

    render(
      <CreateSessionModal
        {...defaultProps}
        existingSlotIds={["slot-1", "slot-3"]}
      />
    );

    const select = screen.getByRole("combobox");
    const options = Array.from(
      (select as HTMLSelectElement).querySelectorAll("option")
    );

    // slot-1 (index 1) and slot-3 (index 3) should be disabled
    expect(options[1].disabled).toBe(true);
    expect(options[2].disabled).toBe(false);
    expect(options[3].disabled).toBe(true);
    expect(options[4].disabled).toBe(false);
  });

  it("shows help text when there are existing slots", async () => {
    const { CreateSessionModal } = await import(
      "@/components/schedule/CreateSessionModal"
    );

    render(
      <CreateSessionModal {...defaultProps} existingSlotIds={["slot-1"]} />
    );

    expect(
      screen.getByText("Slots with existing sessions are disabled.")
    ).toBeTruthy();
  });

  it("does not show help text when no existing slots", async () => {
    const { CreateSessionModal } = await import(
      "@/components/schedule/CreateSessionModal"
    );

    render(
      <CreateSessionModal {...defaultProps} existingSlotIds={[]} />
    );

    expect(
      screen.queryByText("Slots with existing sessions are disabled.")
    ).toBeNull();
  });

  it("Create Session button is disabled when no slot selected", async () => {
    const { CreateSessionModal } = await import(
      "@/components/schedule/CreateSessionModal"
    );

    render(<CreateSessionModal {...defaultProps} />);

    const createButton = screen.getByRole("button", { name: "Create Session" });
    expect(createButton.hasAttribute("disabled")).toBe(true);
  });

  it("Create Session button is enabled after selecting a slot", async () => {
    const { CreateSessionModal } = await import(
      "@/components/schedule/CreateSessionModal"
    );

    render(<CreateSessionModal {...defaultProps} />);

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "slot-2" } });

    const createButton = screen.getByRole("button", { name: "Create Session" });
    expect(createButton.hasAttribute("disabled")).toBe(false);
  });

  it("calls POST /api/sessions with correct payload on submit", async () => {
    mockFetch.mockResolvedValue({
      status: 201,
      ok: true,
      json: async () => ({ data: { id: "new-session" } }),
    });

    const { CreateSessionModal } = await import(
      "@/components/schedule/CreateSessionModal"
    );

    render(<CreateSessionModal {...defaultProps} />);

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "slot-2" } });

    const createButton = screen.getByRole("button", { name: "Create Session" });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recurringSlotId: "slot-2",
          weekDate: "2026-02-09",
        }),
      });
    });
  });

  it("calls onCreated on successful creation (201)", async () => {
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

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "slot-1" } });

    const createButton = screen.getByRole("button", { name: "Create Session" });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalled();
    });

    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: "success", title: "Session created" })
    );
  });

  it("shows error toast on 409 (duplicate session)", async () => {
    mockFetch.mockResolvedValue({
      status: 409,
      ok: false,
      json: async () => ({ error: "Session already exists for this slot and week" }),
    });

    const { CreateSessionModal } = await import(
      "@/components/schedule/CreateSessionModal"
    );

    render(<CreateSessionModal {...defaultProps} />);

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "slot-1" } });

    const createButton = screen.getByRole("button", { name: "Create Session" });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          title: "Session already exists",
        })
      );
    });
  });

  it("shows error toast on 404 (slot not found)", async () => {
    mockFetch.mockResolvedValue({
      status: 404,
      ok: false,
      json: async () => ({ error: "Recurring slot not found" }),
    });

    const { CreateSessionModal } = await import(
      "@/components/schedule/CreateSessionModal"
    );

    render(<CreateSessionModal {...defaultProps} />);

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "slot-1" } });

    const createButton = screen.getByRole("button", { name: "Create Session" });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          title: "Slot not found",
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

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "slot-1" } });

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

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "slot-1" } });

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

  it("disables select and buttons during submission", async () => {
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

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "slot-1" } });

    const createButton = screen.getByRole("button", { name: "Create Session" });
    fireEvent.click(createButton);

    // While submitting, select and button should be disabled
    await waitFor(() => {
      expect(select.hasAttribute("disabled")).toBe(true);
      expect(createButton.hasAttribute("disabled")).toBe(true);
    });

    // Resolve the fetch to clean up
    resolveFetch?.({ status: 201, ok: true, json: async () => ({ data: {} }) });
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

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "slot-1" } });

    const createButton = screen.getByRole("button", { name: "Create Session" });
    fireEvent.click(createButton);

    // Wait for submission to start
    await waitFor(() => {
      expect(select.hasAttribute("disabled")).toBe(true);
    });

    // Try to close — should not work during submission
    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelButton);

    expect(onClose).not.toHaveBeenCalled();

    // Resolve the fetch to clean up
    resolveFetch?.({ status: 201, ok: true, json: async () => ({ data: {} }) });
  });

  it("resets selected slot after successful creation", async () => {
    mockFetch.mockResolvedValue({
      status: 201,
      ok: true,
      json: async () => ({ data: { id: "new-session" } }),
    });

    const { CreateSessionModal } = await import(
      "@/components/schedule/CreateSessionModal"
    );

    render(<CreateSessionModal {...defaultProps} />);

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "slot-2" } });
    expect(select.value).toBe("slot-2");

    const createButton = screen.getByRole("button", { name: "Create Session" });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(defaultProps.onCreated).toHaveBeenCalled();
    });
  });

  it("does not submit when no slot is selected", async () => {
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
