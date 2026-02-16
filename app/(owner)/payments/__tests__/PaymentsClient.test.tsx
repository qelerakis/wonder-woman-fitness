/**
 * PaymentsClient Unit Tests
 *
 * Tests for the filter bar, month/year selection, member name search,
 * and clear filters functionality in PaymentsClient.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

// ===== Mocks =====

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const mockAddToast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

// ===== Test Data =====

// Use all-PAID members so the "Unpaid Members" section does not render.
// This avoids duplicate text nodes (member names appearing in both the
// unpaid list AND the payment table).

const samplePayments = [
  {
    id: "pay-1",
    amount: 1500,
    paidAt: "2026-02-05T10:00:00.000Z",
    periodStart: "2026-02-01",
    periodEnd: "2026-02-28",
    notes: null,
    memberName: "Alice Smith",
    memberId: "member-1",
    recordedBy: "Owner",
  },
  {
    id: "pay-2",
    amount: 2000,
    paidAt: "2026-02-10T14:00:00.000Z",
    periodStart: "2026-02-01",
    periodEnd: "2026-02-28",
    notes: "Paid in cash",
    memberName: "Bob Jones",
    memberId: "member-2",
    recordedBy: "Owner",
  },
  {
    id: "pay-3",
    amount: 1500,
    paidAt: "2026-02-12T09:00:00.000Z",
    periodStart: "2026-02-01",
    periodEnd: "2026-02-28",
    notes: null,
    memberName: "Charlie Brown",
    memberId: "member-3",
    recordedBy: null,
  },
];

const sampleMembers = [
  { id: "member-1", name: "Alice Smith", paymentStatus: "PAID" as const },
  { id: "member-2", name: "Bob Jones", paymentStatus: "PAID" as const },
  { id: "member-3", name: "Charlie Brown", paymentStatus: "PAID" as const },
];

const sampleSummary = {
  totalRevenue: 15000,
  thisMonthRevenue: 5000,
  paidCount: 3,
  unpaidCount: 0,
  totalMembers: 3,
};

const defaultProps = {
  payments: samplePayments,
  members: sampleMembers,
  summary: sampleSummary,
  currentUserId: "owner-1",
  initialMonth: 1, // February (0-indexed)
  initialYear: 2026,
};

// ===== Helpers =====

async function renderPaymentsClient(
  overrides: Partial<typeof defaultProps> = {}
): Promise<ReturnType<typeof render>> {
  const { PaymentsClient } = await import(
    "@/app/(owner)/payments/PaymentsClient"
  );
  return render(<PaymentsClient {...defaultProps} {...overrides} />);
}

// ===== Tests =====

describe("PaymentsClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ===== Filter Bar Rendering =====

  describe("Filter Bar rendering", () => {
    it("renders month and year select dropdowns", async () => {
      await renderPaymentsClient();

      const monthSelect = screen.getByLabelText("Filter by month");
      const yearSelect = screen.getByLabelText("Filter by year");

      expect(monthSelect).toBeTruthy();
      expect(yearSelect).toBeTruthy();
      expect(monthSelect.tagName).toBe("SELECT");
      expect(yearSelect.tagName).toBe("SELECT");
    });

    it("renders search input", async () => {
      await renderPaymentsClient();

      const searchInput = screen.getByLabelText(
        "Search payments by member name"
      );

      expect(searchInput).toBeTruthy();
      expect(searchInput.tagName).toBe("INPUT");
      expect(searchInput).toHaveProperty("type", "text");
    });

    it("defaults month select to initialMonth value", async () => {
      await renderPaymentsClient({ initialMonth: 1 });

      const monthSelect = screen.getByLabelText(
        "Filter by month"
      ) as HTMLSelectElement;

      expect(monthSelect.value).toBe("1"); // February
    });

    it("defaults year select to initialYear value", async () => {
      await renderPaymentsClient({ initialYear: 2026 });

      const yearSelect = screen.getByLabelText(
        "Filter by year"
      ) as HTMLSelectElement;

      expect(yearSelect.value).toBe("2026");
    });

    it("does not show Clear button when at defaults", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 1, 16)); // Feb 16, 2026

      await renderPaymentsClient({ initialMonth: 1, initialYear: 2026 });

      const clearButton = screen.queryByText("Clear");
      expect(clearButton).toBeNull();
    });

    it("shows all initial payments in table", async () => {
      await renderPaymentsClient();

      expect(screen.getByText("Alice Smith")).toBeTruthy();
      expect(screen.getByText("Bob Jones")).toBeTruthy();
      expect(screen.getByText("Charlie Brown")).toBeTruthy();
    });
  });

  // ===== Month/Year Change =====

  describe("Month/Year change", () => {
    it("fetches payments with date params when month changes", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });
      global.fetch = mockFetch;

      await renderPaymentsClient();

      const monthSelect = screen.getByLabelText("Filter by month");
      fireEvent.change(monthSelect, { target: { value: "0" } }); // January

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/payments?startDate=2026-01-01&endDate=2026-01-31"
        );
      });
    });

    it("fetches payments with date params when year changes", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });
      global.fetch = mockFetch;

      await renderPaymentsClient();

      const yearSelect = screen.getByLabelText("Filter by year");
      fireEvent.change(yearSelect, { target: { value: "2025" } }); // 2025

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/payments?startDate=2025-02-01&endDate=2025-02-28"
        );
      });
    });

    it("updates displayed payments after fetch", async () => {
      const newPayments = [
        {
          id: "pay-new-1",
          amount: 3000,
          paidAt: "2026-01-15T10:00:00.000Z",
          periodStart: "2026-01-01",
          periodEnd: "2026-01-31",
          notes: null,
          user: { id: "member-4", name: "Diana Prince" },
          recordedBy: { id: "owner-1", name: "Owner" },
        },
      ];

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: newPayments }),
      });
      global.fetch = mockFetch;

      await renderPaymentsClient();

      // Verify initial payments are shown
      expect(screen.getByText("Alice Smith")).toBeTruthy();

      const monthSelect = screen.getByLabelText("Filter by month");
      fireEvent.change(monthSelect, { target: { value: "0" } }); // January

      await waitFor(() => {
        expect(screen.getByText("Diana Prince")).toBeTruthy();
      });

      // Old payments should be gone from the table
      expect(screen.queryByText("Alice Smith")).toBeNull();
    });
  });

  // ===== Search =====

  describe("Search", () => {
    it("filters payments by member name (case-insensitive)", async () => {
      await renderPaymentsClient();

      const searchInput = screen.getByLabelText(
        "Search payments by member name"
      );
      fireEvent.change(searchInput, { target: { value: "alice" } });

      // Alice should be visible in the table
      expect(screen.getByText("Alice Smith")).toBeTruthy();

      // Bob and Charlie should be hidden from the table
      expect(screen.queryByText("Bob Jones")).toBeNull();
      expect(screen.queryByText("Charlie Brown")).toBeNull();
    });

    it("shows all payments when search is cleared", async () => {
      await renderPaymentsClient();

      const searchInput = screen.getByLabelText(
        "Search payments by member name"
      );

      // First filter
      fireEvent.change(searchInput, { target: { value: "alice" } });
      expect(screen.queryByText("Bob Jones")).toBeNull();

      // Clear search
      fireEvent.change(searchInput, { target: { value: "" } });

      // All should be visible again
      expect(screen.getByText("Alice Smith")).toBeTruthy();
      expect(screen.getByText("Bob Jones")).toBeTruthy();
      expect(screen.getByText("Charlie Brown")).toBeTruthy();
    });

    it("shows empty state when search matches nothing", async () => {
      await renderPaymentsClient();

      const searchInput = screen.getByLabelText(
        "Search payments by member name"
      );
      fireEvent.change(searchInput, { target: { value: "zzzzz" } });

      expect(screen.getByText("No payments recorded yet")).toBeTruthy();
    });
  });

  // ===== Clear Filters =====

  describe("Clear Filters", () => {
    it("shows Clear button when search has text", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 1, 16));

      await renderPaymentsClient({ initialMonth: 1, initialYear: 2026 });

      // No Clear initially
      expect(screen.queryByText("Clear")).toBeNull();

      const searchInput = screen.getByLabelText(
        "Search payments by member name"
      );
      fireEvent.change(searchInput, { target: { value: "alice" } });

      expect(screen.getByText("Clear")).toBeTruthy();
    });

    it("fetches payments for current month and resets search on Clear click", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 1, 16)); // Feb 16, 2026

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });
      global.fetch = mockFetch;

      await renderPaymentsClient({ initialMonth: 0, initialYear: 2025 });

      // Type a search query
      const searchInput = screen.getByLabelText(
        "Search payments by member name"
      ) as HTMLInputElement;
      fireEvent.change(searchInput, { target: { value: "test" } });

      // Clear button should be visible (month differs from current)
      const clearButton = screen.getByText("Clear");
      fireEvent.click(clearButton);

      // Search should be cleared
      expect(searchInput.value).toBe("");

      // Month/year selects should reset to current month/year
      const monthSelect = screen.getByLabelText(
        "Filter by month"
      ) as HTMLSelectElement;
      const yearSelect = screen.getByLabelText(
        "Filter by year"
      ) as HTMLSelectElement;
      expect(monthSelect.value).toBe("1"); // February (current month)
      expect(yearSelect.value).toBe("2026"); // Current year

      // Advance timers so the fetch promise resolves
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      // Should have fetched payments for Feb 2026
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/payments?startDate=2026-02-01&endDate=2026-02-28"
      );
    });
  });
});
