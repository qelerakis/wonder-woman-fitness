/**
 * PrivateSessionsClient Component Tests
 *
 * Comprehensive tests covering initial rendering, summary cards, session table,
 * paid toggle, create modal, month navigation, and filtered data display.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { PrivateSessionsClient } from "../PrivateSessionsClient";

// ===== Mocks =====

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

const mockAddToast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

// ===== Helpers =====

function fmtCurrency(n: number): string {
  return `${n.toLocaleString()} MKD`;
}

interface PrivateSessionItem {
  id: string;
  clientName: string;
  scheduledAt: string;
  paid: boolean;
  amount: number;
  exerciseDetails: string | null;
  notes: string | null;
  createdBy: string;
}

interface PrivateSessionsSummary {
  totalRevenue: number;
  thisMonthRevenue: number;
  unpaidCount: number;
  totalSessions: number;
}

const defaultSessions: PrivateSessionItem[] = [
  {
    id: "ps-1",
    clientName: "Jane Doe",
    scheduledAt: "2026-02-15T10:00:00.000Z",
    paid: true,
    amount: 500,
    exerciseDetails: "Upper body workout",
    notes: "Regular client",
    createdBy: "Trainer One",
  },
  {
    id: "ps-2",
    clientName: "John Smith",
    scheduledAt: "2026-02-20T14:00:00.000Z",
    paid: false,
    amount: 600,
    exerciseDetails: null,
    notes: null,
    createdBy: "Trainer Two",
  },
  {
    id: "ps-3",
    clientName: "Alice Wonder",
    scheduledAt: "2026-01-10T09:00:00.000Z",
    paid: true,
    amount: 0,
    exerciseDetails: "Leg day",
    notes: "Needs modification for knee",
    createdBy: "Trainer One",
  },
];

const defaultSummary: PrivateSessionsSummary = {
  totalRevenue: 1100,
  thisMonthRevenue: 500,
  unpaidCount: 1,
  totalSessions: 3,
};

const defaultProps = {
  sessions: defaultSessions,
  summary: defaultSummary,
};

/**
 * Helper to find the closest <button> parent wrapping a Badge element.
 * The paid/unpaid toggle in the table wraps a Badge in a <button>.
 */
function getToggleButtonByText(text: string): HTMLElement {
  const badge = screen.getByText(text, { selector: "span" });
  const button = badge.closest("button");
  if (!button) throw new Error(`No button parent found for badge with text "${text}"`);
  return button;
}

/**
 * Helper to get all toggle buttons by badge text.
 */
function getAllToggleButtonsByText(text: string): HTMLElement[] {
  const badges = screen.getAllByText(text, { selector: "span" });
  return badges.map((badge) => {
    const button = badge.closest("button");
    if (!button) throw new Error(`No button parent found for badge with text "${text}"`);
    return button;
  });
}

// ===== Setup / Teardown =====

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 1, 17)); // Feb 17, 2026
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ===== Tests =====

describe("PrivateSessionsClient", () => {
  // ─── 1. Initial Rendering ─────────────────────────────────

  describe("Initial Rendering", () => {
    it("renders page title 'Private Sessions'", () => {
      render(<PrivateSessionsClient {...defaultProps} />);
      expect(screen.getByRole("heading", { name: "Private Sessions" })).toBeDefined();
    });

    it("shows 'All sessions' subtitle in default all-time mode", () => {
      render(<PrivateSessionsClient {...defaultProps} />);
      expect(screen.getByText("All sessions")).toBeDefined();
    });

    it("renders all 4 summary cards with correct labels", () => {
      render(<PrivateSessionsClient {...defaultProps} />);
      expect(screen.getByText("This Month")).toBeDefined();
      expect(screen.getByText("All Time")).toBeDefined();
      expect(screen.getByText("Total Sessions")).toBeDefined();
      // "Unpaid" appears both as a summary card label (p) and as a badge (span)
      expect(screen.getByText("Unpaid", { selector: "p" })).toBeDefined();
    });

    it("renders summary card values correctly", () => {
      render(<PrivateSessionsClient {...defaultProps} />);
      // thisMonthRevenue=500 appears in card and also in table row (Jane Doe 500 MKD).
      // All Time = 1,100 MKD is unique to the summary card.
      expect(screen.getByText(fmtCurrency(1100))).toBeDefined();
      // Total sessions count "3" also appears in "3 sessions" description —
      // verify the standalone "3" exists.
      const threeElements = screen.getAllByText("3");
      expect(threeElements.length).toBeGreaterThanOrEqual(1);
    });

    it("renders session table with all sessions", () => {
      render(<PrivateSessionsClient {...defaultProps} />);
      expect(screen.getByText("Jane Doe")).toBeDefined();
      expect(screen.getByText("John Smith")).toBeDefined();
      expect(screen.getByText("Alice Wonder")).toBeDefined();
    });

    it("shows 'New Session' button", () => {
      render(<PrivateSessionsClient {...defaultProps} />);
      expect(screen.getByRole("button", { name: "New Session" })).toBeDefined();
    });

    it("shows empty state when no sessions", () => {
      render(
        <PrivateSessionsClient
          sessions={[]}
          summary={{ totalRevenue: 0, thisMonthRevenue: 0, unpaidCount: 0, totalSessions: 0 }}
        />
      );
      expect(screen.getByText("No private sessions recorded yet")).toBeDefined();
    });

    it("formats currency with MKD suffix", () => {
      render(<PrivateSessionsClient {...defaultProps} />);
      // All Time revenue uses fmtCurrency(1100) — toLocaleString varies by environment
      expect(screen.getByText(fmtCurrency(1100))).toBeDefined();
    });

    it("shows sessions count in table header description", () => {
      render(<PrivateSessionsClient {...defaultProps} />);
      expect(screen.getByText("3 sessions")).toBeDefined();
    });
  });

  // ─── 2. Summary Cards ────────────────────────────────────

  describe("Summary Cards", () => {
    it("shows 'This Month' label", () => {
      render(<PrivateSessionsClient {...defaultProps} />);
      expect(screen.getByText("This Month")).toBeDefined();
    });

    it("shows 'All Time' revenue from summary", () => {
      render(<PrivateSessionsClient {...defaultProps} />);
      expect(screen.getByText("All Time")).toBeDefined();
      expect(screen.getByText(fmtCurrency(1100))).toBeDefined();
    });

    it("shows 'Total Sessions' count", () => {
      render(<PrivateSessionsClient {...defaultProps} />);
      expect(screen.getByText("Total Sessions")).toBeDefined();
    });

    it("shows 'Unpaid' label in summary card", () => {
      render(<PrivateSessionsClient {...defaultProps} />);
      // Use selector to distinguish from the badge span
      expect(screen.getByText("Unpaid", { selector: "p" })).toBeDefined();
    });

    it("uses warning color for unpaid count when count > 0", () => {
      const { container } = render(<PrivateSessionsClient {...defaultProps} />);
      const warningElement = container.querySelector(".text-warning-400");
      expect(warningElement).not.toBeNull();
      expect(warningElement?.textContent).toBe("1");
    });

    it("uses normal color for unpaid count when count is 0", () => {
      const { container } = render(
        <PrivateSessionsClient
          sessions={[]}
          summary={{ totalRevenue: 0, thisMonthRevenue: 0, unpaidCount: 0, totalSessions: 0 }}
        />
      );
      const warningElements = container.querySelectorAll(".text-warning-400");
      expect(warningElements.length).toBe(0);
    });

    it("displays zero revenue correctly", () => {
      render(
        <PrivateSessionsClient
          sessions={[]}
          summary={{ totalRevenue: 0, thisMonthRevenue: 0, unpaidCount: 0, totalSessions: 0 }}
        />
      );
      const zeroCurrency = screen.getAllByText(fmtCurrency(0));
      expect(zeroCurrency.length).toBeGreaterThanOrEqual(2);
    });

    it("displays large revenue with locale formatting", () => {
      render(
        <PrivateSessionsClient
          sessions={[]}
          summary={{
            totalRevenue: 123456,
            thisMonthRevenue: 78000,
            unpaidCount: 0,
            totalSessions: 0,
          }}
        />
      );
      expect(screen.getByText(fmtCurrency(123456))).toBeDefined();
      expect(screen.getByText(fmtCurrency(78000))).toBeDefined();
    });
  });

  // ─── 3. Session Table ─────────────────────────────────────

  describe("Session Table", () => {
    it("shows client name for each session", () => {
      render(<PrivateSessionsClient {...defaultProps} />);
      expect(screen.getByText("Jane Doe")).toBeDefined();
      expect(screen.getByText("John Smith")).toBeDefined();
      expect(screen.getByText("Alice Wonder")).toBeDefined();
    });

    it("shows formatted date for each session", () => {
      render(<PrivateSessionsClient {...defaultProps} />);
      expect(screen.getByText(/Feb 15, 2026/)).toBeDefined();
      expect(screen.getByText(/Feb 20, 2026/)).toBeDefined();
      expect(screen.getByText(/Jan 10, 2026/)).toBeDefined();
    });

    it("shows amount for each session", () => {
      render(<PrivateSessionsClient {...defaultProps} />);
      expect(screen.getByText("600 MKD")).toBeDefined();
      expect(screen.getByText("0 MKD")).toBeDefined();
    });

    it("shows exercise details when present", () => {
      render(<PrivateSessionsClient {...defaultProps} />);
      expect(screen.getByText("Upper body workout")).toBeDefined();
      expect(screen.getByText("Leg day")).toBeDefined();
    });

    it("shows dash when exercise details are empty", () => {
      render(<PrivateSessionsClient {...defaultProps} />);
      const dashes = screen.getAllByText("\u2014");
      expect(dashes.length).toBeGreaterThanOrEqual(1);
    });

    it("shows Paid badge for paid sessions", () => {
      render(<PrivateSessionsClient {...defaultProps} />);
      const paidBadges = screen.getAllByText("Paid");
      expect(paidBadges.length).toBe(2); // Jane and Alice
    });

    it("shows Unpaid badge for unpaid sessions", () => {
      render(<PrivateSessionsClient {...defaultProps} />);
      // Use selector to only find the badge span, not the summary card label
      const unpaidBadges = screen.getAllByText("Unpaid", { selector: "span" });
      expect(unpaidBadges.length).toBe(1); // John
    });

    it("table has correct column headers", () => {
      render(<PrivateSessionsClient {...defaultProps} />);
      expect(screen.getByText("Client")).toBeDefined();
      expect(screen.getByText("Date")).toBeDefined();
      expect(screen.getByText("Amount")).toBeDefined();
      expect(screen.getByText("Details")).toBeDefined();
      expect(screen.getByText("Status")).toBeDefined();
    });

    it("renders Sessions header in the card", () => {
      render(<PrivateSessionsClient {...defaultProps} />);
      expect(screen.getByText("Sessions")).toBeDefined();
    });
  });

  // ─── 4. Paid Toggle ──────────────────────────────────────

  describe("Paid Toggle", () => {
    it("calls PATCH API when clicking unpaid badge button", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: {} }),
      });
      global.fetch = mockFetch;

      render(<PrivateSessionsClient {...defaultProps} />);

      const unpaidButton = getToggleButtonByText("Unpaid");
      await act(async () => {
        fireEvent.click(unpaidButton);
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/private-sessions/ps-2", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid: true }),
      });
    });

    it("toggles from paid to unpaid (sends paid=false)", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: {} }),
      });
      global.fetch = mockFetch;

      render(<PrivateSessionsClient {...defaultProps} />);

      const paidButtons = getAllToggleButtonsByText("Paid");
      await act(async () => {
        fireEvent.click(paidButtons[0]);
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/private-sessions/ps-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid: false }),
      });
    });

    it("toggles from unpaid to paid (sends paid=true)", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: {} }),
      });
      global.fetch = mockFetch;

      render(<PrivateSessionsClient {...defaultProps} />);

      const unpaidButton = getToggleButtonByText("Unpaid");
      await act(async () => {
        fireEvent.click(unpaidButton);
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/private-sessions/ps-2", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid: true }),
      });
    });

    it("shows success toast on successful toggle to paid", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: {} }),
      });

      render(<PrivateSessionsClient {...defaultProps} />);

      const unpaidButton = getToggleButtonByText("Unpaid");
      await act(async () => {
        fireEvent.click(unpaidButton);
      });

      expect(mockAddToast).toHaveBeenCalledWith({
        type: "success",
        title: "Marked as paid",
      });
    });

    it("shows success toast on successful toggle to unpaid", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: {} }),
      });

      render(<PrivateSessionsClient {...defaultProps} />);

      const paidButtons = getAllToggleButtonsByText("Paid");
      await act(async () => {
        fireEvent.click(paidButtons[0]);
      });

      expect(mockAddToast).toHaveBeenCalledWith({
        type: "success",
        title: "Marked as unpaid",
      });
    });

    it("shows error toast on failed toggle", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Internal Server Error" }),
      });

      render(<PrivateSessionsClient {...defaultProps} />);

      const unpaidButton = getToggleButtonByText("Unpaid");
      await act(async () => {
        fireEvent.click(unpaidButton);
      });

      expect(mockAddToast).toHaveBeenCalledWith({
        type: "error",
        title: "Failed to update",
      });
    });

    it("shows error toast on network error", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      render(<PrivateSessionsClient {...defaultProps} />);

      const unpaidButton = getToggleButtonByText("Unpaid");
      await act(async () => {
        fireEvent.click(unpaidButton);
      });

      expect(mockAddToast).toHaveBeenCalledWith({
        type: "error",
        title: "Network error",
      });
    });

    it("calls router.refresh() after successful toggle", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: {} }),
      });

      render(<PrivateSessionsClient {...defaultProps} />);

      const unpaidButton = getToggleButtonByText("Unpaid");
      await act(async () => {
        fireEvent.click(unpaidButton);
      });

      expect(mockRefresh).toHaveBeenCalled();
    });

    it("does not call router.refresh() on failed toggle", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "fail" }),
      });

      render(<PrivateSessionsClient {...defaultProps} />);

      const unpaidButton = getToggleButtonByText("Unpaid");
      await act(async () => {
        fireEvent.click(unpaidButton);
      });

      expect(mockRefresh).not.toHaveBeenCalled();
    });
  });

  // ─── 5. Create Modal ─────────────────────────────────────

  describe("Create Modal", () => {
    it("opens modal when clicking 'New Session'", async () => {
      render(<PrivateSessionsClient {...defaultProps} />);

      const newBtn = screen.getByRole("button", { name: "New Session" });
      await act(async () => {
        fireEvent.click(newBtn);
      });

      expect(screen.getByRole("dialog")).toBeDefined();
    });

    it("modal has correct title", async () => {
      render(<PrivateSessionsClient {...defaultProps} />);

      const newBtn = screen.getByRole("button", { name: "New Session" });
      await act(async () => {
        fireEvent.click(newBtn);
      });

      expect(screen.getByText("New Private Session")).toBeDefined();
    });

    it("has client name input", async () => {
      render(<PrivateSessionsClient {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "New Session" }));
      });

      expect(screen.getByLabelText("Client Name")).toBeDefined();
    });

    it("has scheduled at datetime input", async () => {
      render(<PrivateSessionsClient {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "New Session" }));
      });

      expect(screen.getByLabelText("Scheduled At")).toBeDefined();
    });

    it("has amount input", async () => {
      render(<PrivateSessionsClient {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "New Session" }));
      });

      expect(screen.getByLabelText("Amount (MKD)")).toBeDefined();
    });

    it("has paid checkbox", async () => {
      render(<PrivateSessionsClient {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "New Session" }));
      });

      expect(screen.getByLabelText("Already paid")).toBeDefined();
    });

    it("has exercise details textarea", async () => {
      render(<PrivateSessionsClient {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "New Session" }));
      });

      expect(screen.getByLabelText("Exercise Details (optional)")).toBeDefined();
    });

    it("has notes textarea", async () => {
      render(<PrivateSessionsClient {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "New Session" }));
      });

      expect(screen.getByLabelText("Notes (optional)")).toBeDefined();
    });

    it("validates required client name", async () => {
      render(<PrivateSessionsClient {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "New Session" }));
      });

      fireEvent.change(screen.getByLabelText("Amount (MKD)"), { target: { value: "500" } });
      fireEvent.change(screen.getByLabelText("Scheduled At"), {
        target: { value: "2026-03-01T10:00" },
      });

      await act(async () => {
        fireEvent.submit(screen.getByRole("button", { name: "Create Session" }));
      });

      expect(screen.getByText("Client name is required")).toBeDefined();
    });

    it("validates required amount (positive number)", async () => {
      render(<PrivateSessionsClient {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "New Session" }));
      });

      fireEvent.change(screen.getByLabelText("Client Name"), { target: { value: "Test Client" } });
      fireEvent.change(screen.getByLabelText("Scheduled At"), {
        target: { value: "2026-03-01T10:00" },
      });

      await act(async () => {
        fireEvent.submit(screen.getByRole("button", { name: "Create Session" }));
      });

      expect(screen.getByText("Amount must be a positive number")).toBeDefined();
    });

    it("validates required scheduled at", async () => {
      render(<PrivateSessionsClient {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "New Session" }));
      });

      fireEvent.change(screen.getByLabelText("Client Name"), { target: { value: "Test Client" } });
      fireEvent.change(screen.getByLabelText("Amount (MKD)"), { target: { value: "500" } });

      await act(async () => {
        fireEvent.submit(screen.getByRole("button", { name: "Create Session" }));
      });

      expect(screen.getByText("Date/time is required")).toBeDefined();
    });

    it("validates amount is not zero", async () => {
      render(<PrivateSessionsClient {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "New Session" }));
      });

      fireEvent.change(screen.getByLabelText("Client Name"), { target: { value: "Test Client" } });
      fireEvent.change(screen.getByLabelText("Scheduled At"), {
        target: { value: "2026-03-01T10:00" },
      });
      fireEvent.change(screen.getByLabelText("Amount (MKD)"), { target: { value: "0" } });

      await act(async () => {
        fireEvent.submit(screen.getByRole("button", { name: "Create Session" }));
      });

      expect(screen.getByText("Amount must be a positive number")).toBeDefined();
    });

    it("validates amount is not negative", async () => {
      render(<PrivateSessionsClient {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "New Session" }));
      });

      fireEvent.change(screen.getByLabelText("Client Name"), { target: { value: "Test Client" } });
      fireEvent.change(screen.getByLabelText("Scheduled At"), {
        target: { value: "2026-03-01T10:00" },
      });
      fireEvent.change(screen.getByLabelText("Amount (MKD)"), { target: { value: "-100" } });

      await act(async () => {
        fireEvent.submit(screen.getByRole("button", { name: "Create Session" }));
      });

      expect(screen.getByText("Amount must be a positive number")).toBeDefined();
    });

    it("shows all validation errors simultaneously", async () => {
      render(<PrivateSessionsClient {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "New Session" }));
      });

      // Submit with all fields empty
      await act(async () => {
        fireEvent.submit(screen.getByRole("button", { name: "Create Session" }));
      });

      expect(screen.getByText("Client name is required")).toBeDefined();
      expect(screen.getByText("Date/time is required")).toBeDefined();
      expect(screen.getByText("Amount must be a positive number")).toBeDefined();
    });

    it("calls POST API with correct payload", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: {} }),
      });
      global.fetch = mockFetch;

      render(<PrivateSessionsClient {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "New Session" }));
      });

      fireEvent.change(screen.getByLabelText("Client Name"), { target: { value: "Test Client" } });
      fireEvent.change(screen.getByLabelText("Scheduled At"), {
        target: { value: "2026-03-01T10:00" },
      });
      fireEvent.change(screen.getByLabelText("Amount (MKD)"), { target: { value: "750" } });
      fireEvent.change(screen.getByLabelText("Exercise Details (optional)"), {
        target: { value: "Push ups" },
      });
      fireEvent.change(screen.getByLabelText("Notes (optional)"), {
        target: { value: "First session" },
      });

      await act(async () => {
        fireEvent.submit(screen.getByRole("button", { name: "Create Session" }));
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/private-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: "Test Client",
          scheduledAt: new Date("2026-03-01T10:00").toISOString(),
          amount: 750,
          paid: false,
          exerciseDetails: "Push ups",
          notes: "First session",
        }),
      });
    });

    it("sends paid=true when checkbox is checked", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: {} }),
      });
      global.fetch = mockFetch;

      render(<PrivateSessionsClient {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "New Session" }));
      });

      fireEvent.change(screen.getByLabelText("Client Name"), { target: { value: "Test Client" } });
      fireEvent.change(screen.getByLabelText("Scheduled At"), {
        target: { value: "2026-03-01T10:00" },
      });
      fireEvent.change(screen.getByLabelText("Amount (MKD)"), { target: { value: "500" } });
      fireEvent.click(screen.getByLabelText("Already paid"));

      await act(async () => {
        fireEvent.submit(screen.getByRole("button", { name: "Create Session" }));
      });

      const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      expect(body.paid).toBe(true);
    });

    it("omits empty optional fields from payload", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: {} }),
      });
      global.fetch = mockFetch;

      render(<PrivateSessionsClient {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "New Session" }));
      });

      fireEvent.change(screen.getByLabelText("Client Name"), { target: { value: "Test Client" } });
      fireEvent.change(screen.getByLabelText("Scheduled At"), {
        target: { value: "2026-03-01T10:00" },
      });
      fireEvent.change(screen.getByLabelText("Amount (MKD)"), { target: { value: "500" } });

      await act(async () => {
        fireEvent.submit(screen.getByRole("button", { name: "Create Session" }));
      });

      const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      expect(body.exerciseDetails).toBeUndefined();
      expect(body.notes).toBeUndefined();
    });

    it("shows success toast on creation", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: {} }),
      });

      render(<PrivateSessionsClient {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "New Session" }));
      });

      fireEvent.change(screen.getByLabelText("Client Name"), { target: { value: "Test Client" } });
      fireEvent.change(screen.getByLabelText("Scheduled At"), {
        target: { value: "2026-03-01T10:00" },
      });
      fireEvent.change(screen.getByLabelText("Amount (MKD)"), { target: { value: "500" } });

      await act(async () => {
        fireEvent.submit(screen.getByRole("button", { name: "Create Session" }));
      });

      expect(mockAddToast).toHaveBeenCalledWith({
        type: "success",
        title: "Private session created",
      });
    });

    it("shows error toast on creation failure", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Validation failed" }),
      });

      render(<PrivateSessionsClient {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "New Session" }));
      });

      fireEvent.change(screen.getByLabelText("Client Name"), { target: { value: "Test Client" } });
      fireEvent.change(screen.getByLabelText("Scheduled At"), {
        target: { value: "2026-03-01T10:00" },
      });
      fireEvent.change(screen.getByLabelText("Amount (MKD)"), { target: { value: "500" } });

      await act(async () => {
        fireEvent.submit(screen.getByRole("button", { name: "Create Session" }));
      });

      expect(mockAddToast).toHaveBeenCalledWith({
        type: "error",
        title: "Failed to create session",
        message: "Validation failed",
      });
    });

    it("shows error toast on network error during creation", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      render(<PrivateSessionsClient {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "New Session" }));
      });

      fireEvent.change(screen.getByLabelText("Client Name"), { target: { value: "Test Client" } });
      fireEvent.change(screen.getByLabelText("Scheduled At"), {
        target: { value: "2026-03-01T10:00" },
      });
      fireEvent.change(screen.getByLabelText("Amount (MKD)"), { target: { value: "500" } });

      await act(async () => {
        fireEvent.submit(screen.getByRole("button", { name: "Create Session" }));
      });

      expect(mockAddToast).toHaveBeenCalledWith({
        type: "error",
        title: "Network error",
      });
    });

    it("closes modal and refreshes on successful creation", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: {} }),
      });

      render(<PrivateSessionsClient {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "New Session" }));
      });

      expect(screen.getByRole("dialog")).toBeDefined();

      fireEvent.change(screen.getByLabelText("Client Name"), { target: { value: "Test Client" } });
      fireEvent.change(screen.getByLabelText("Scheduled At"), {
        target: { value: "2026-03-01T10:00" },
      });
      fireEvent.change(screen.getByLabelText("Amount (MKD)"), { target: { value: "500" } });

      await act(async () => {
        fireEvent.submit(screen.getByRole("button", { name: "Create Session" }));
      });

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(mockRefresh).toHaveBeenCalled();
    });

    it("cancel button closes modal", async () => {
      render(<PrivateSessionsClient {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "New Session" }));
      });

      expect(screen.getByRole("dialog")).toBeDefined();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      });

      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("resets form fields when modal is cancelled", async () => {
      render(<PrivateSessionsClient {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "New Session" }));
      });

      fireEvent.change(screen.getByLabelText("Client Name"), { target: { value: "Test Client" } });
      fireEvent.change(screen.getByLabelText("Amount (MKD)"), { target: { value: "999" } });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "New Session" }));
      });

      const clientInput = screen.getByLabelText("Client Name") as HTMLInputElement;
      const amountInput = screen.getByLabelText("Amount (MKD)") as HTMLInputElement;
      expect(clientInput.value).toBe("");
      expect(amountInput.value).toBe("");
    });

    it("does not call API when validation fails", async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      render(<PrivateSessionsClient {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "New Session" }));
      });

      await act(async () => {
        fireEvent.submit(screen.getByRole("button", { name: "Create Session" }));
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ─── 6. Month Navigation ─────────────────────────────────

  describe("Month Navigation", () => {
    it("'All' button is active by default", () => {
      render(<PrivateSessionsClient {...defaultProps} />);
      const allButton = screen.getByRole("button", { name: "All" });
      expect(allButton.className).toContain("bg-primary-900/50");
    });

    it("clicking 'Monthly' switches to month view", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: defaultSessions.map((s) => ({
            ...s,
            createdBy: { name: s.createdBy },
          })),
        }),
      });

      render(<PrivateSessionsClient {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
      });

      expect(screen.getByText("February 2026")).toBeDefined();
      expect(screen.queryByText("All sessions")).toBeNull();
    });

    it("shows current month/year label in month mode", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });

      render(<PrivateSessionsClient {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
      });

      expect(screen.getByText("February 2026")).toBeDefined();
    });

    it("shows prev/next month arrows in month mode", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });

      render(<PrivateSessionsClient {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
      });

      expect(screen.getByRole("button", { name: "Previous month" })).toBeDefined();
      expect(screen.getByRole("button", { name: "Next month" })).toBeDefined();
    });

    it("clicking prev month calls API with correct date range", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });
      global.fetch = mockFetch;

      render(<PrivateSessionsClient {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
      });

      mockFetch.mockClear();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/private-sessions?startDate=2026-01-01T00:00:00.000Z&endDate=2026-01-31T23:59:59.999Z"
      );
    });

    it("next month button is disabled when viewing current month", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });

      render(<PrivateSessionsClient {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
      });

      const nextBtn = screen.getByRole("button", { name: "Next month" });
      expect(nextBtn.hasAttribute("disabled")).toBe(true);
    });

    it("clicking 'All' button returns to all sessions view", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });

      render(<PrivateSessionsClient {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
      });

      expect(screen.queryByText("All sessions")).toBeNull();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "All" }));
      });

      expect(screen.getByText("All sessions")).toBeDefined();
    });

    it("month wraps from January to December of previous year", async () => {
      vi.setSystemTime(new Date(2026, 0, 15));

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });
      global.fetch = mockFetch;

      render(<PrivateSessionsClient {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
      });

      expect(screen.getByText("January 2026")).toBeDefined();

      mockFetch.mockClear();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
      });

      expect(screen.getByText("December 2025")).toBeDefined();
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/private-sessions?startDate=2025-12-01T00:00:00.000Z&endDate=2025-12-31T23:59:59.999Z"
      );
    });

    it("loading state shows opacity change on summary cards", async () => {
      let resolveFetch: (value: unknown) => void;
      const fetchPromise = new Promise((resolve) => {
        resolveFetch = resolve;
      });
      global.fetch = vi.fn().mockReturnValue(fetchPromise);

      const { container } = render(<PrivateSessionsClient {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
      });

      const grids = container.querySelectorAll(".transition-opacity");
      const loadingGrid = Array.from(grids).find((g) => g.className.includes("opacity-50"));
      expect(loadingGrid).toBeDefined();

      await act(async () => {
        resolveFetch!({
          ok: true,
          json: async () => ({ data: [] }),
        });
      });

      const updatedGrids = container.querySelectorAll(".transition-opacity");
      const stillLoading = Array.from(updatedGrids).find((g) =>
        g.className.includes("opacity-50")
      );
      expect(stillLoading).toBeUndefined();
    });

    it("shows error toast on failed fetch in month mode", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      render(<PrivateSessionsClient {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
      });

      expect(mockAddToast).toHaveBeenCalledWith({
        type: "error",
        title: "Failed to load sessions",
      });
    });

    it("shows network error toast on fetch throw in month mode", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      render(<PrivateSessionsClient {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
      });

      expect(mockAddToast).toHaveBeenCalledWith({
        type: "error",
        title: "Network error",
      });
    });

    it("'Monthly' button becomes active when in month mode", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });

      render(<PrivateSessionsClient {...defaultProps} />);

      const monthlyBtn = screen.getByRole("button", { name: "Monthly" });
      expect(monthlyBtn.className).not.toContain("bg-primary-900/50");

      await act(async () => {
        fireEvent.click(monthlyBtn);
      });

      expect(screen.getByRole("button", { name: "Monthly" }).className).toContain(
        "bg-primary-900/50"
      );
    });

    it("'All' button becomes inactive when in month mode", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });

      render(<PrivateSessionsClient {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
      });

      const allBtn = screen.getByRole("button", { name: "All" });
      expect(allBtn.className).not.toContain("bg-primary-900/50");
    });

    it("next month enables after navigating to previous month", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });
      global.fetch = mockFetch;

      render(<PrivateSessionsClient {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
      });

      // Initially at current month — next is disabled
      expect(screen.getByRole("button", { name: "Next month" }).hasAttribute("disabled")).toBe(true);

      // Navigate to prev month
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
      });

      // Next should now be enabled
      expect(screen.getByRole("button", { name: "Next month" }).hasAttribute("disabled")).toBe(false);
    });

    it("disables prev month button during loading", async () => {
      let resolveFetch: (value: unknown) => void;
      const fetchPromise = new Promise((resolve) => {
        resolveFetch = resolve;
      });
      global.fetch = vi.fn().mockReturnValue(fetchPromise);

      render(<PrivateSessionsClient {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
      });

      // During loading, prev button should be disabled
      expect(
        screen.getByRole("button", { name: "Previous month" }).hasAttribute("disabled")
      ).toBe(true);

      await act(async () => {
        resolveFetch!({
          ok: true,
          json: async () => ({ data: [] }),
        });
      });

      // After loading, prev button should be enabled
      expect(
        screen.getByRole("button", { name: "Previous month" }).hasAttribute("disabled")
      ).toBe(false);
    });
  });

  // ─── 7. Filtered Data Display ─────────────────────────────

  describe("Filtered Data Display", () => {
    it("after month filter, summary cards update with filtered data", async () => {
      const filteredData = [
        {
          id: "ps-filtered-1",
          clientName: "Filtered Client",
          scheduledAt: "2026-02-10T10:00:00.000Z",
          paid: true,
          amount: 300,
          exerciseDetails: null,
          notes: null,
          createdBy: { name: "Trainer One" },
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: filteredData }),
      });

      render(<PrivateSessionsClient {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
      });

      expect(screen.getByText("1 sessions")).toBeDefined();
    });

    it("after month filter, table shows filtered sessions", async () => {
      const filteredData = [
        {
          id: "ps-filtered-1",
          clientName: "Filtered Client",
          scheduledAt: "2026-02-10T10:00:00.000Z",
          paid: true,
          amount: 300,
          exerciseDetails: null,
          notes: null,
          createdBy: { name: "Trainer One" },
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: filteredData }),
      });

      render(<PrivateSessionsClient {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
      });

      expect(screen.getByText("Filtered Client")).toBeDefined();
      expect(screen.queryByText("Jane Doe")).toBeNull();
      expect(screen.queryByText("John Smith")).toBeNull();
    });

    it("after returning to 'All', original data is restored", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "ps-filtered-1",
              clientName: "Filtered Client",
              scheduledAt: "2026-02-10T10:00:00.000Z",
              paid: true,
              amount: 300,
              exerciseDetails: null,
              notes: null,
              createdBy: { name: "Trainer One" },
            },
          ],
        }),
      });

      render(<PrivateSessionsClient {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
      });

      expect(screen.queryByText("Jane Doe")).toBeNull();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "All" }));
      });

      expect(screen.getByText("Jane Doe")).toBeDefined();
      expect(screen.getByText("John Smith")).toBeDefined();
      expect(screen.getByText("Alice Wonder")).toBeDefined();
      expect(screen.getByText("3 sessions")).toBeDefined();
    });

    it("session count in table header updates with filter", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "ps-1",
              clientName: "One Client",
              scheduledAt: "2026-02-10T10:00:00.000Z",
              paid: true,
              amount: 100,
              exerciseDetails: null,
              notes: null,
              createdBy: { name: "Trainer" },
            },
            {
              id: "ps-2",
              clientName: "Two Client",
              scheduledAt: "2026-02-11T10:00:00.000Z",
              paid: false,
              amount: 200,
              exerciseDetails: null,
              notes: null,
              createdBy: { name: "Trainer" },
            },
          ],
        }),
      });

      render(<PrivateSessionsClient {...defaultProps} />);

      expect(screen.getByText("3 sessions")).toBeDefined();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
      });

      expect(screen.getByText("2 sessions")).toBeDefined();
    });

    it("filtered summary correctly counts unpaid sessions", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "ps-1",
              clientName: "Client A",
              scheduledAt: "2026-02-10T10:00:00.000Z",
              paid: true,
              amount: 500,
              exerciseDetails: null,
              notes: null,
              createdBy: { name: "Trainer" },
            },
            {
              id: "ps-2",
              clientName: "Client B",
              scheduledAt: "2026-02-11T10:00:00.000Z",
              paid: false,
              amount: 300,
              exerciseDetails: null,
              notes: null,
              createdBy: { name: "Trainer" },
            },
            {
              id: "ps-3",
              clientName: "Client C",
              scheduledAt: "2026-02-12T10:00:00.000Z",
              paid: false,
              amount: 400,
              exerciseDetails: null,
              notes: null,
              createdBy: { name: "Trainer" },
            },
          ],
        }),
      });

      const { container } = render(<PrivateSessionsClient {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
      });

      // Unpaid count should be 2 (Client B + Client C)
      const warningElement = container.querySelector(".text-warning-400");
      expect(warningElement).not.toBeNull();
      expect(warningElement?.textContent).toBe("2");
    });

    it("shows empty state when month filter returns no sessions", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });

      render(<PrivateSessionsClient {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
      });

      expect(screen.getByText("No private sessions recorded yet")).toBeDefined();
      expect(screen.getByText("0 sessions")).toBeDefined();
    });

    it("restores original summary values when switching back to 'All'", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });

      render(<PrivateSessionsClient {...defaultProps} />);

      // Switch to monthly (returns empty data)
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
      });

      // Should show zero sessions
      expect(screen.getByText("0 sessions")).toBeDefined();

      // Switch back to all
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "All" }));
      });

      // Original summary data restored
      expect(screen.getByText(fmtCurrency(1100))).toBeDefined(); // All Time revenue
      expect(screen.getByText("3 sessions")).toBeDefined();
    });
  });
});
