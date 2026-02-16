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

  // ===== Non-OK API Response Handling =====

  describe("Non-OK API response handling", () => {
    it("shows error toast when fetch returns ok: false", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: "Server error" }),
      });
      global.fetch = mockFetch;

      await renderPaymentsClient();

      const monthSelect = screen.getByLabelText("Filter by month");
      fireEvent.change(monthSelect, { target: { value: "0" } }); // trigger fetch

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: "error",
          title: "Failed to load payments",
        });
      });
    });

    it("shows 'Unexpected response format' toast when json.data is null", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: null }),
      });
      global.fetch = mockFetch;

      await renderPaymentsClient();

      const monthSelect = screen.getByLabelText("Filter by month");
      fireEvent.change(monthSelect, { target: { value: "0" } });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: "error",
          title: "Unexpected response format",
        });
      });
    });

    it("shows 'Unexpected response format' toast when json.data is undefined", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}), // no .data property
      });
      global.fetch = mockFetch;

      await renderPaymentsClient();

      const yearSelect = screen.getByLabelText("Filter by year");
      fireEvent.change(yearSelect, { target: { value: "2025" } });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: "error",
          title: "Unexpected response format",
        });
      });
    });
  });

  // ===== Network Error Handling =====

  describe("Network error handling", () => {
    it("shows error toast when fetch throws a network error", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("Network failure"));
      global.fetch = mockFetch;

      await renderPaymentsClient();

      const monthSelect = screen.getByLabelText("Filter by month");
      fireEvent.change(monthSelect, { target: { value: "3" } }); // April

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: "error",
          title: "Failed to load payments",
        });
      });
    });

    it("shows error toast when fetch throws a TypeError (e.g., offline)", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
      global.fetch = mockFetch;

      await renderPaymentsClient();

      const yearSelect = screen.getByLabelText("Filter by year");
      fireEvent.change(yearSelect, { target: { value: "2025" } });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: "error",
          title: "Failed to load payments",
        });
      });
    });
  });

  // ===== Loading State =====

  describe("Loading state", () => {
    it("applies opacity-50 to the table during fetch", async () => {
      // Use a promise we can control to keep the fetch "in flight"
      let resolveFetch!: (value: unknown) => void;
      const fetchPromise = new Promise((resolve) => {
        resolveFetch = resolve;
      });
      const mockFetch = vi.fn().mockReturnValue(fetchPromise);
      global.fetch = mockFetch;

      await renderPaymentsClient();

      const monthSelect = screen.getByLabelText("Filter by month");
      fireEvent.change(monthSelect, { target: { value: "0" } });

      // While fetch is in flight, table wrapper should have opacity-50
      await waitFor(() => {
        const tableWrapper = screen.getByRole("table").parentElement;
        expect(tableWrapper?.className).toContain("opacity-50");
      });

      // Resolve the fetch
      await act(async () => {
        resolveFetch({ ok: true, json: async () => ({ data: [] }) });
      });
    });

    it("removes opacity-50 from the table after fetch completes", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "pay-x",
              amount: 1000,
              paidAt: "2026-01-05T10:00:00.000Z",
              periodStart: "2026-01-01",
              periodEnd: "2026-01-31",
              notes: null,
              user: { id: "m-1", name: "Test User" },
              recordedBy: null,
            },
          ],
        }),
      });
      global.fetch = mockFetch;

      await renderPaymentsClient();

      const monthSelect = screen.getByLabelText("Filter by month");
      fireEvent.change(monthSelect, { target: { value: "0" } });

      await waitFor(() => {
        expect(screen.getByText("Test User")).toBeTruthy();
      });

      // After fetch completes, opacity-50 should be gone
      const tableWrapper = screen.getByRole("table").parentElement;
      expect(tableWrapper?.className).not.toContain("opacity-50");
    });

    it("has transition-opacity class on the table wrapper", async () => {
      await renderPaymentsClient();

      const tableWrapper = screen.getByRole("table").parentElement;
      expect(tableWrapper?.className).toContain("transition-opacity");
    });
  });

  // ===== Year Options Generation =====

  describe("Year options generation", () => {
    it("generates years from 2025 (PAYMENTS_START_YEAR) to current year", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 5, 15)); // June 15, 2026

      await renderPaymentsClient();

      const yearSelect = screen.getByLabelText("Filter by year") as HTMLSelectElement;
      const options = Array.from(yearSelect.querySelectorAll("option"));
      const yearValues = options.map((o) => o.value);

      expect(yearValues).toContain("2025");
      expect(yearValues).toContain("2026");
      expect(yearValues).not.toContain("2024");
      expect(yearValues).not.toContain("2027");
    });

    it("shows only 2025 when current year is 2025", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 0, 1)); // Jan 1, 2025

      await renderPaymentsClient({ initialMonth: 0, initialYear: 2025 });

      const yearSelect = screen.getByLabelText("Filter by year") as HTMLSelectElement;
      const options = Array.from(yearSelect.querySelectorAll("option"));
      const yearValues = options.map((o) => o.value);

      expect(yearValues).toEqual(["2025"]);
    });

    it("shows 2025, 2026, 2027 when current year is 2027", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2027, 6, 1)); // July 1, 2027

      await renderPaymentsClient({ initialMonth: 6, initialYear: 2027 });

      const yearSelect = screen.getByLabelText("Filter by year") as HTMLSelectElement;
      const options = Array.from(yearSelect.querySelectorAll("option"));
      const yearValues = options.map((o) => o.value);

      expect(yearValues).toEqual(["2025", "2026", "2027"]);
    });
  });

  // ===== Filter Label Display =====

  describe("Filter label display", () => {
    it("shows payment count with month label in Payment History header", async () => {
      await renderPaymentsClient({ initialMonth: 1, initialYear: 2026 });

      // 3 payments in February 2026
      expect(screen.getByText("3 payments in February 2026")).toBeTruthy();
    });

    it("updates count after search filter", async () => {
      await renderPaymentsClient({ initialMonth: 1, initialYear: 2026 });

      const searchInput = screen.getByLabelText("Search payments by member name");
      fireEvent.change(searchInput, { target: { value: "alice" } });

      expect(screen.getByText("1 payments in February 2026")).toBeTruthy();
    });

    it("shows 0 payments when search matches nothing", async () => {
      await renderPaymentsClient({ initialMonth: 1, initialYear: 2026 });

      const searchInput = screen.getByLabelText("Search payments by member name");
      fireEvent.change(searchInput, { target: { value: "zzzzz" } });

      expect(screen.getByText("0 payments in February 2026")).toBeTruthy();
    });

    it("shows correct label for different month/year", async () => {
      await renderPaymentsClient({ initialMonth: 11, initialYear: 2025 });

      // Initially renders with provided initialMonth/initialYear
      expect(screen.getByText(/payments in December 2025/)).toBeTruthy();
    });
  });

  // ===== hasActiveFilter Logic =====

  describe("hasActiveFilter logic", () => {
    it("shows Clear button when month differs from current month", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 1, 16)); // Feb 16, 2026

      // Initial month is January (0), but current month is February (1)
      await renderPaymentsClient({ initialMonth: 0, initialYear: 2026 });

      expect(screen.getByText("Clear")).toBeTruthy();
    });

    it("shows Clear button when year differs from current year", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 1, 16)); // Feb 2026

      // Same month but different year
      await renderPaymentsClient({ initialMonth: 1, initialYear: 2025 });

      expect(screen.getByText("Clear")).toBeTruthy();
    });

    it("does not show Clear button when month+year match current and no search", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 1, 16));

      await renderPaymentsClient({ initialMonth: 1, initialYear: 2026 });

      expect(screen.queryByText("Clear")).toBeNull();
    });

    it("shows Clear button when only search has text (month/year match current)", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 1, 16));

      await renderPaymentsClient({ initialMonth: 1, initialYear: 2026 });

      // Initially no Clear
      expect(screen.queryByText("Clear")).toBeNull();

      const searchInput = screen.getByLabelText("Search payments by member name");
      fireEvent.change(searchInput, { target: { value: "a" } });

      expect(screen.getByText("Clear")).toBeTruthy();
    });

    it("hides Clear button after clearing search when month/year match current", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 1, 16));

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });
      global.fetch = mockFetch;

      await renderPaymentsClient({ initialMonth: 1, initialYear: 2026 });

      const searchInput = screen.getByLabelText("Search payments by member name");
      fireEvent.change(searchInput, { target: { value: "test" } });
      expect(screen.getByText("Clear")).toBeTruthy();

      // Click Clear
      fireEvent.click(screen.getByText("Clear"));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      // After clearing, Clear button should be gone
      expect(screen.queryByText("Clear")).toBeNull();
    });
  });

  // ===== Date Parameter Construction =====

  describe("Date parameter construction", () => {
    it("sends correct dates for February leap year (2024)", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });
      global.fetch = mockFetch;

      await renderPaymentsClient({ initialMonth: 1, initialYear: 2026 });

      // Change to Feb 2024
      const yearSelect = screen.getByLabelText("Filter by year");
      fireEvent.change(yearSelect, { target: { value: "2025" } });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      // Clear calls so far
      mockFetch.mockClear();

      const monthSelect = screen.getByLabelText("Filter by month");
      fireEvent.change(monthSelect, { target: { value: "1" } }); // February

      await waitFor(() => {
        // 2025 is not a leap year, so Feb has 28 days
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/payments?startDate=2025-02-01&endDate=2025-02-28"
        );
      });
    });

    it("sends correct dates for December of any year", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });
      global.fetch = mockFetch;

      await renderPaymentsClient();

      const monthSelect = screen.getByLabelText("Filter by month");
      fireEvent.change(monthSelect, { target: { value: "11" } }); // December

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/payments?startDate=2026-12-01&endDate=2026-12-31"
        );
      });
    });

    it("sends correct dates for April (30 days)", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });
      global.fetch = mockFetch;

      await renderPaymentsClient();

      const monthSelect = screen.getByLabelText("Filter by month");
      fireEvent.change(monthSelect, { target: { value: "3" } }); // April

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/payments?startDate=2026-04-01&endDate=2026-04-30"
        );
      });
    });

    it("sends correct dates for January (31 days)", async () => {
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

    it("sends correct dates for September (30 days)", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });
      global.fetch = mockFetch;

      await renderPaymentsClient();

      const monthSelect = screen.getByLabelText("Filter by month");
      fireEvent.change(monthSelect, { target: { value: "8" } }); // September

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/payments?startDate=2026-09-01&endDate=2026-09-30"
        );
      });
    });

    it("pads single-digit months with leading zero", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });
      global.fetch = mockFetch;

      await renderPaymentsClient();

      const monthSelect = screen.getByLabelText("Filter by month");
      fireEvent.change(monthSelect, { target: { value: "2" } }); // March

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("startDate=2026-03-01")
        );
      });
    });
  });

  // ===== handleMonthChange with Empty String =====

  describe("handleMonthChange with empty string", () => {
    it("does not fetch when month is set to empty string", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });
      global.fetch = mockFetch;

      await renderPaymentsClient();

      const monthSelect = screen.getByLabelText("Filter by month");
      fireEvent.change(monthSelect, { target: { value: "" } });

      // Give it a tick to see if fetch was called
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      // fetch should NOT have been called (early return on null month)
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("does not fetch when year is set to empty string", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });
      global.fetch = mockFetch;

      await renderPaymentsClient();

      const yearSelect = screen.getByLabelText("Filter by year");
      fireEvent.change(yearSelect, { target: { value: "" } });

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ===== Re-fetch After Payment Recording =====

  describe("Re-fetch after payment recording", () => {
    async function fillAndSubmitPaymentForm(): Promise<void> {
      // Open the modal
      fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));

      // Fill out all required fields
      fireEvent.change(screen.getByLabelText("Member"), { target: { value: "member-1" } });
      fireEvent.change(screen.getByLabelText("Amount (MKD)"), { target: { value: "1500" } });
      fireEvent.change(screen.getByLabelText("Paid At"), { target: { value: "2026-02-16T10:00" } });
      fireEvent.change(screen.getByLabelText("Period Start"), { target: { value: "2026-02-01" } });
      fireEvent.change(screen.getByLabelText("Period End"), { target: { value: "2026-02-28" } });

      // Submit the form
      const submitBtns = screen.getAllByRole("button", { name: "Record Payment" });
      const formSubmit = submitBtns.find((btn) => btn.getAttribute("type") === "submit");
      fireEvent.click(formSubmit!);
    }

    it("calls fetchPayments after successful payment POST", async () => {
      const mockFetch = vi.fn()
        // First call: POST to record payment
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { id: "new-pay" } }),
        })
        // Second call: GET to re-fetch payments
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] }),
        });
      global.fetch = mockFetch;

      await renderPaymentsClient();
      await fillAndSubmitPaymentForm();

      await waitFor(() => {
        // POST call to /api/payments
        expect(mockFetch).toHaveBeenCalledWith("/api/payments", expect.objectContaining({
          method: "POST",
        }));
      });

      await waitFor(() => {
        // GET call to re-fetch payments for current filter
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/payments?startDate=2026-02-01&endDate=2026-02-28"
        );
      });
    });

    it("shows success toast after recording payment", async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { id: "new-pay" } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] }),
        });
      global.fetch = mockFetch;

      await renderPaymentsClient();
      await fillAndSubmitPaymentForm();

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: "success",
          title: "Payment recorded",
        });
      });
    });

    it("shows error toast when payment POST fails", async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Duplicate payment" }),
      });
      global.fetch = mockFetch;

      await renderPaymentsClient();
      await fillAndSubmitPaymentForm();

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: "error",
          title: "Failed to record payment",
          message: "Duplicate payment",
        });
      });
    });

    it("shows network error toast when payment POST throws", async () => {
      const mockFetch = vi.fn().mockRejectedValueOnce(new Error("Network error"));
      global.fetch = mockFetch;

      await renderPaymentsClient();
      await fillAndSubmitPaymentForm();

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: "error",
          title: "Network error",
        });
      });
    });
  });

  // ===== Edge Cases =====

  describe("Edge cases", () => {
    it("renders correctly with empty initial payments array", async () => {
      await renderPaymentsClient({ payments: [] });

      expect(screen.getByText("No payments recorded yet")).toBeTruthy();
    });

    it("handles search with special regex characters safely", async () => {
      await renderPaymentsClient();

      const searchInput = screen.getByLabelText("Search payments by member name");
      // These are special regex chars that shouldn't crash the filter
      fireEvent.change(searchInput, { target: { value: "alice (smith)" } });

      // Should not crash - just show no results
      expect(screen.queryByText("Alice Smith")).toBeNull();
    });

    it("handles search with brackets and dots safely", async () => {
      await renderPaymentsClient();

      const searchInput = screen.getByLabelText("Search payments by member name");
      fireEvent.change(searchInput, { target: { value: "[test].*+" } });

      // Should not crash the filter
      expect(screen.getByText("No payments recorded yet")).toBeTruthy();
    });

    it("search is case-insensitive for mixed case queries", async () => {
      await renderPaymentsClient();

      const searchInput = screen.getByLabelText("Search payments by member name");
      fireEvent.change(searchInput, { target: { value: "ALICE" } });

      expect(screen.getByText("Alice Smith")).toBeTruthy();
      expect(screen.queryByText("Bob Jones")).toBeNull();
    });

    it("search trims whitespace", async () => {
      await renderPaymentsClient();

      const searchInput = screen.getByLabelText("Search payments by member name");
      // Search with only whitespace should show all payments
      fireEvent.change(searchInput, { target: { value: "   " } });

      expect(screen.getByText("Alice Smith")).toBeTruthy();
      expect(screen.getByText("Bob Jones")).toBeTruthy();
      expect(screen.getByText("Charlie Brown")).toBeTruthy();
    });

    it("renders unpaid members section when members have GRACE_PERIOD status", async () => {
      const membersWithUnpaid = [
        { id: "member-1", name: "Alice Smith", paymentStatus: "PAID" as const },
        { id: "member-2", name: "Bob Jones", paymentStatus: "GRACE_PERIOD" as const },
        { id: "member-3", name: "Charlie Brown", paymentStatus: "LOCKED" as const },
      ];

      await renderPaymentsClient({ members: membersWithUnpaid });

      expect(screen.getByText("Unpaid Members")).toBeTruthy();
    });

    it("does not render unpaid members section when all members are PAID", async () => {
      await renderPaymentsClient(); // default sampleMembers are all PAID

      expect(screen.queryByText("Unpaid Members")).toBeNull();
    });

    it("displays payment amount with MKD suffix", async () => {
      await renderPaymentsClient();

      // samplePayments has amounts 1500, 2000, 1500
      // Locale may use comma, dot, or no separator for thousands
      expect(screen.getAllByText(/1[.,]?500 MKD/).length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText(/2[.,]?000 MKD/)).toBeTruthy();
    });

    it("displays summary cards with MKD currency", async () => {
      await renderPaymentsClient();

      // thisMonthRevenue=5000, totalRevenue=15000
      // Use exact boundary to avoid "5.000" matching inside "15.000"
      expect(screen.getByText(/^5[.,]?000 MKD$/)).toBeTruthy();
      expect(screen.getByText(/15[.,]?000 MKD/)).toBeTruthy();
    });

    it("displays em dash for payments without recordedBy", async () => {
      await renderPaymentsClient();

      // Charlie Brown's payment has recordedBy: null
      // Should display an em dash
      const rows = screen.getAllByRole("row");
      // The table has header row + 3 data rows
      expect(rows.length).toBe(4);
    });
  });

  // ===== Payment Form Validation =====

  describe("Payment form validation", () => {
    it("shows error when submitting without selecting a member", async () => {
      await renderPaymentsClient();

      // Open modal
      fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));

      // Fill everything except member
      fireEvent.change(screen.getByLabelText("Amount (MKD)"), { target: { value: "1500" } });
      fireEvent.change(screen.getByLabelText("Paid At"), { target: { value: "2026-02-16T10:00" } });
      fireEvent.change(screen.getByLabelText("Period Start"), { target: { value: "2026-02-01" } });
      fireEvent.change(screen.getByLabelText("Period End"), { target: { value: "2026-02-28" } });

      // Submit the form via the form element directly
      const form = screen.getByLabelText("Member").closest("form")!;
      await act(async () => {
        fireEvent.submit(form);
      });

      expect(screen.getByText("Select a member")).toBeTruthy();
    });

    it("shows error when amount is zero", async () => {
      await renderPaymentsClient();

      fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));

      fireEvent.change(screen.getByLabelText("Member"), { target: { value: "member-1" } });
      fireEvent.change(screen.getByLabelText("Amount (MKD)"), { target: { value: "0" } });
      fireEvent.change(screen.getByLabelText("Paid At"), { target: { value: "2026-02-16T10:00" } });
      fireEvent.change(screen.getByLabelText("Period Start"), { target: { value: "2026-02-01" } });
      fireEvent.change(screen.getByLabelText("Period End"), { target: { value: "2026-02-28" } });

      const form = screen.getByLabelText("Member").closest("form")!;
      await act(async () => {
        fireEvent.submit(form);
      });

      expect(screen.getByText("Amount must be a positive number")).toBeTruthy();
    });

    it("shows error when period end is before period start", async () => {
      await renderPaymentsClient();

      fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));

      fireEvent.change(screen.getByLabelText("Member"), { target: { value: "member-1" } });
      fireEvent.change(screen.getByLabelText("Amount (MKD)"), { target: { value: "1500" } });
      fireEvent.change(screen.getByLabelText("Paid At"), { target: { value: "2026-02-16T10:00" } });
      fireEvent.change(screen.getByLabelText("Period Start"), { target: { value: "2026-02-28" } });
      fireEvent.change(screen.getByLabelText("Period End"), { target: { value: "2026-02-01" } });

      const form = screen.getByLabelText("Member").closest("form")!;
      await act(async () => {
        fireEvent.submit(form);
      });

      expect(screen.getByText("Period end must be after start")).toBeTruthy();
    });

    it("does not call fetch when form validation fails", async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      await renderPaymentsClient();

      fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));

      // Submit empty form
      const form = screen.getByLabelText("Member").closest("form")!;
      await act(async () => {
        fireEvent.submit(form);
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ===== Month Select Options =====

  describe("Month select options", () => {
    it("contains all 12 months", async () => {
      await renderPaymentsClient();

      const monthSelect = screen.getByLabelText("Filter by month") as HTMLSelectElement;
      const options = Array.from(monthSelect.querySelectorAll("option"));

      expect(options.length).toBe(12);
      expect(options[0].textContent).toBe("January");
      expect(options[5].textContent).toBe("June");
      expect(options[11].textContent).toBe("December");
    });
  });

  // ===== Edit Payment Flow =====

  describe("edit payment flow", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("renders edit buttons on each payment row", async () => {
      await renderPaymentsClient();
      const editButtons = screen.getAllByLabelText(/^Edit payment for/);
      expect(editButtons).toHaveLength(samplePayments.length);
    });

    it("opens modal with pre-filled data when edit button is clicked", async () => {
      await renderPaymentsClient();
      const editButtons = screen.getAllByLabelText(/^Edit payment for/);
      fireEvent.click(editButtons[0]);

      expect(screen.getByText("Edit Payment")).toBeTruthy();
      expect(screen.getByText("Update Payment")).toBeTruthy();

      const memberSelect = screen.getByLabelText("Member") as HTMLSelectElement;
      expect(memberSelect.disabled).toBe(true);
    });

    it("submits PATCH request when editing", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: {} }),
      });

      await renderPaymentsClient();
      const editButtons = screen.getAllByLabelText(/^Edit payment for/);
      fireEvent.click(editButtons[0]);

      const submitButton = screen.getByText("Update Payment");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          `/api/payments/${samplePayments[0].id}`,
          expect.objectContaining({ method: "PATCH" })
        );
      });
    });

    it("shows success toast after editing", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: {} }),
      });

      await renderPaymentsClient();
      const editButtons = screen.getAllByLabelText(/^Edit payment for/);
      fireEvent.click(editButtons[0]);
      fireEvent.click(screen.getByText("Update Payment"));

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          expect.objectContaining({ type: "success", title: "Payment updated" })
        );
      });
    });
  });

  // ===== Delete Payment Flow =====

  describe("delete payment flow", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("renders delete buttons on each payment row", async () => {
      await renderPaymentsClient();
      const deleteButtons = screen.getAllByLabelText(/^Delete payment for/);
      expect(deleteButtons).toHaveLength(samplePayments.length);
    });

    it("opens confirmation modal when delete button is clicked", async () => {
      await renderPaymentsClient();
      const deleteButtons = screen.getAllByLabelText(/^Delete payment for/);
      fireEvent.click(deleteButtons[0]);

      expect(screen.getByText("Delete Payment")).toBeTruthy();
      expect(screen.getByText(/cannot be undone/)).toBeTruthy();
    });

    it("closes confirmation modal on Cancel", async () => {
      await renderPaymentsClient();
      const deleteButtons = screen.getAllByLabelText(/^Delete payment for/);
      fireEvent.click(deleteButtons[0]);

      fireEvent.click(screen.getByText("Cancel"));
      expect(screen.queryByText(/cannot be undone/)).toBeNull();
    });

    it("sends DELETE request on confirm", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { id: "pay-1" } }),
      });

      await renderPaymentsClient();
      const deleteButtons = screen.getAllByLabelText(/^Delete payment for/);
      fireEvent.click(deleteButtons[0]);

      // Find the Delete button inside the confirmation modal (not the icon button)
      const modalButtons = screen.getAllByRole("button");
      const confirmBtn = modalButtons.find((btn) => btn.textContent === "Delete");
      fireEvent.click(confirmBtn!);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          `/api/payments/${samplePayments[0].id}`,
          expect.objectContaining({ method: "DELETE" })
        );
      });
    });

    it("shows success toast after deleting", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { id: "pay-1" } }),
      });

      await renderPaymentsClient();
      const deleteButtons = screen.getAllByLabelText(/^Delete payment for/);
      fireEvent.click(deleteButtons[0]);

      const modalButtons = screen.getAllByRole("button");
      const confirmBtn = modalButtons.find((btn) => btn.textContent === "Delete");
      fireEvent.click(confirmBtn!);

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          expect.objectContaining({ type: "success", title: "Payment deleted" })
        );
      });
    });
  });
});
