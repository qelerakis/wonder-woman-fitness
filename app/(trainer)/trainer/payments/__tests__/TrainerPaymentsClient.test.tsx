/**
 * TrainerPaymentsClient Unit Tests
 *
 * Tests the trainer-specific payments page: summary cards, unpaid members list,
 * payment history table, record payment modal, filters, and search.
 * Verifies trainer restrictions: no edit/delete, no notes, no member links.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import type { PaymentStatus } from "@/lib/constants";

// ===== Mocks =====

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const mockAddToast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

// Mock DatePicker to render a simple input for testing
vi.mock("@/components/ui/DatePicker", () => ({
  DatePicker: ({ label, value, onChange, error }: { label?: string; value: string; onChange: (v: string) => void; error?: string }) => (
    <div>
      {label && <label htmlFor={label}>{label}</label>}
      <input
        id={label}
        aria-label={label}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && <span role="alert">{error}</span>}
    </div>
  ),
}));

// Mock DateTimePicker to render a simple input for testing
vi.mock("@/components/ui/DateTimePicker", () => ({
  DateTimePicker: ({ label, value, onChange, error }: { label?: string; value: string; onChange: (v: string) => void; error?: string }) => (
    <div>
      {label && <label htmlFor={label}>{label}</label>}
      <input
        id={label}
        aria-label={label}
        type="datetime-local"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && <span role="alert">{error}</span>}
    </div>
  ),
}));

// ===== Test Data =====

const samplePayments = [
  {
    id: "pay-1",
    amount: 1500,
    paidAt: "2026-02-05T10:00:00.000Z",
    periodStart: "2026-02-01T00:00:00.000Z",
    periodEnd: "2026-02-28T00:00:00.000Z",
    memberName: "Alice Smith",
    recordedBy: "Trainer Jane",
  },
  {
    id: "pay-2",
    amount: 2000,
    paidAt: "2026-02-10T14:00:00.000Z",
    periodStart: "2026-02-01T00:00:00.000Z",
    periodEnd: "2026-02-28T00:00:00.000Z",
    memberName: "Bob Jones",
    recordedBy: "Owner",
  },
  {
    id: "pay-3",
    amount: 1500,
    paidAt: "2026-02-12T09:00:00.000Z",
    periodStart: "2026-02-01T00:00:00.000Z",
    periodEnd: "2026-02-28T00:00:00.000Z",
    memberName: "Charlie Brown",
    recordedBy: null,
  },
];

type MemberStatusItem = { id: string; name: string; paymentStatus: PaymentStatus };

const sampleMembers: MemberStatusItem[] = [
  { id: "member-1", name: "Alice Smith", paymentStatus: "PAID" },
  { id: "member-2", name: "Bob Jones", paymentStatus: "PAID" },
  { id: "member-3", name: "Charlie Brown", paymentStatus: "PAID" },
];

const sampleSummary = {
  thisMonthRevenue: 5000,
  paidCount: 3,
  unpaidCount: 0,
  totalMembers: 3,
};

const defaultProps = {
  payments: samplePayments,
  members: sampleMembers,
  summary: sampleSummary,
  initialMonth: 1, // February (0-indexed)
  initialYear: 2026,
};

// ===== Helpers =====

async function renderTrainerPayments(
  overrides: Partial<typeof defaultProps> = {}
): Promise<ReturnType<typeof render>> {
  const { TrainerPaymentsClient } = await import(
    "@/app/(trainer)/trainer/payments/TrainerPaymentsClient"
  );
  return render(<TrainerPaymentsClient {...defaultProps} {...overrides} />);
}

// ===== Tests =====

describe("TrainerPaymentsClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  // ===== RENDERING =====

  describe("Rendering", () => {
    it("renders the page heading and description", async () => {
      await renderTrainerPayments();

      expect(screen.getByText("Payments")).toBeTruthy();
      expect(screen.getByText("Track and record member payments")).toBeTruthy();
    });

    it("renders the Record Payment button", async () => {
      await renderTrainerPayments();

      expect(screen.getByText("Record Payment")).toBeTruthy();
    });

    it("renders filter bar with month and year selects", async () => {
      await renderTrainerPayments();

      expect(screen.getByLabelText("Filter by month")).toBeTruthy();
      expect(screen.getByLabelText("Filter by year")).toBeTruthy();
    });

    it("renders search input", async () => {
      await renderTrainerPayments();

      expect(screen.getByLabelText("Search payments by member name")).toBeTruthy();
    });
  });

  // ===== SUMMARY CARDS =====

  describe("Summary Cards", () => {
    it("renders exactly 3 summary cards (no all-time)", async () => {
      await renderTrainerPayments();

      expect(screen.getByText("This Month")).toBeTruthy();
      expect(screen.getByText("Paid Members")).toBeTruthy();
      expect(screen.getByText("Unpaid")).toBeTruthy();
      expect(screen.queryByText("All Time")).toBeNull();
    });

    it("displays this month revenue in MKD", async () => {
      await renderTrainerPayments();

      // toLocaleString() may or may not add commas in test env — match flexible
      expect(screen.getByText(/5[,.]?000 MKD/)).toBeTruthy();
    });

    it("displays paid count with total", async () => {
      await renderTrainerPayments();

      expect(screen.getByText("3")).toBeTruthy();
      expect(screen.getByText("/ 3")).toBeTruthy();
    });

    it("displays unpaid count", async () => {
      await renderTrainerPayments({ summary: { ...sampleSummary, unpaidCount: 2 } });

      const unpaidCard = screen.getByText("Unpaid").closest("div");
      expect(unpaidCard).toBeTruthy();
      expect(screen.getByText("2")).toBeTruthy();
    });

    it("styles unpaid count in red when > 0", async () => {
      await renderTrainerPayments({ summary: { ...sampleSummary, unpaidCount: 2 } });

      // The unpaid number should have the error color class
      const unpaidValues = screen.getAllByText("2");
      const styledUnpaid = unpaidValues.find((el) =>
        el.className.includes("text-error-400")
      );
      expect(styledUnpaid).toBeTruthy();
    });

    it("styles unpaid count in normal color when 0", async () => {
      await renderTrainerPayments();

      // All "0" values should not have error styling
      const zeroValues = screen.getAllByText("0");
      const errorStyled = zeroValues.find((el) =>
        el.className.includes("text-error-400")
      );
      expect(errorStyled).toBeUndefined();
    });
  });

  // ===== UNPAID MEMBERS LIST =====

  describe("Unpaid Members List", () => {
    it("does not render unpaid section when all members are PAID", async () => {
      await renderTrainerPayments();

      expect(screen.queryByText("Unpaid Members")).toBeNull();
    });

    it("renders unpaid section when members have GRACE_PERIOD or LOCKED status", async () => {
      const membersWithUnpaid = [
        { id: "member-1", name: "Alice Smith", paymentStatus: "PAID" as const },
        { id: "member-2", name: "Bob Jones", paymentStatus: "GRACE_PERIOD" as const },
        { id: "member-3", name: "Charlie Brown", paymentStatus: "LOCKED" as const },
      ];

      await renderTrainerPayments({ members: membersWithUnpaid });

      expect(screen.getByText("Unpaid Members")).toBeTruthy();
      expect(screen.getByText("Members with outstanding payments")).toBeTruthy();
    });

    it("shows only GRACE_PERIOD and LOCKED members in unpaid list", async () => {
      const membersWithUnpaid = [
        { id: "member-1", name: "Alice Smith", paymentStatus: "PAID" as const },
        { id: "member-2", name: "Bob Jones", paymentStatus: "GRACE_PERIOD" as const },
        { id: "member-3", name: "Charlie Brown", paymentStatus: "LOCKED" as const },
        { id: "member-4", name: "Diana Prince", paymentStatus: "TRIAL" as const },
      ];

      await renderTrainerPayments({ members: membersWithUnpaid });

      // The Card containing "Unpaid Members" heading — walk up to the Card boundary
      const unpaidHeading = screen.getByText("Unpaid Members");
      // CardHeader is inside Card -> walk up to the Card root (rounded-xl border)
      let unpaidCard: HTMLElement | null = unpaidHeading.closest("div");
      while (unpaidCard && !unpaidCard.classList.contains("rounded-xl")) {
        unpaidCard = unpaidCard.parentElement;
      }
      expect(unpaidCard).toBeTruthy();

      // Bob and Charlie should appear in the unpaid section
      expect(unpaidCard!.textContent).toContain("Bob Jones");
      expect(unpaidCard!.textContent).toContain("Charlie Brown");
      // Alice (PAID) and Diana (TRIAL) should NOT appear
      expect(unpaidCard!.textContent).not.toContain("Alice Smith");
      expect(unpaidCard!.textContent).not.toContain("Diana Prince");
    });

    it("does NOT render member names as links in unpaid list", async () => {
      const membersWithUnpaid = [
        { id: "member-2", name: "Bob Jones", paymentStatus: "GRACE_PERIOD" as const },
      ];

      await renderTrainerPayments({ members: membersWithUnpaid });

      // There should be no <a> tags wrapping unpaid member names
      const links = document.querySelectorAll("a");
      const memberLinks = Array.from(links).filter((link) =>
        link.textContent?.includes("Bob Jones")
      );
      expect(memberLinks).toHaveLength(0);
    });
  });

  // ===== PAYMENT HISTORY TABLE =====

  describe("Payment History Table", () => {
    it("renders payment table with correct columns", async () => {
      await renderTrainerPayments();

      expect(screen.getByText("Member")).toBeTruthy();
      expect(screen.getByText("Amount")).toBeTruthy();
      expect(screen.getByText("Period")).toBeTruthy();
      expect(screen.getByText("Paid")).toBeTruthy();
      expect(screen.getByText("Recorded By")).toBeTruthy();
    });

    it("does NOT render Notes column", async () => {
      await renderTrainerPayments();

      // Check table headers for Notes
      const headers = document.querySelectorAll("th");
      const notesHeader = Array.from(headers).find((h) =>
        h.textContent?.includes("Notes")
      );
      expect(notesHeader).toBeUndefined();
    });

    it("does NOT render Actions column or edit/delete buttons", async () => {
      await renderTrainerPayments();

      // No "Actions" header
      const headers = document.querySelectorAll("th");
      const actionsHeader = Array.from(headers).find((h) =>
        h.textContent?.includes("Actions")
      );
      expect(actionsHeader).toBeUndefined();

      // No edit or delete aria labels
      expect(screen.queryByLabelText(/Edit payment/)).toBeNull();
      expect(screen.queryByLabelText(/Delete payment/)).toBeNull();
    });

    it("renders payment rows with member name, amount, and dates", async () => {
      await renderTrainerPayments();

      expect(screen.getByText("Alice Smith")).toBeTruthy();
      expect(screen.getByText("Bob Jones")).toBeTruthy();
      expect(screen.getByText("Charlie Brown")).toBeTruthy();
      // Two payments have 1500 MKD (Alice + Charlie), so use getAllByText
      expect(screen.getAllByText(/1[,.]?500 MKD/).length).toBe(2);
      expect(screen.getByText(/2[,.]?000 MKD/)).toBeTruthy();
    });

    it("renders member names as plain text, NOT as links", async () => {
      await renderTrainerPayments();

      const links = document.querySelectorAll("a");
      const memberLinks = Array.from(links).filter((link) =>
        link.textContent?.includes("Alice Smith") ||
        link.textContent?.includes("Bob Jones")
      );
      expect(memberLinks).toHaveLength(0);
    });

    it("displays Recorded By name or dash for null", async () => {
      await renderTrainerPayments();

      expect(screen.getByText("Trainer Jane")).toBeTruthy();
      expect(screen.getByText("Owner")).toBeTruthy();
      expect(screen.getByText("\u2014")).toBeTruthy(); // em dash for null
    });

    it("shows empty state when no payments", async () => {
      await renderTrainerPayments({ payments: [] });

      expect(screen.getByText("No payments recorded yet")).toBeTruthy();
    });

    it("displays payment count in table header", async () => {
      await renderTrainerPayments();

      expect(screen.getByText("Payment History")).toBeTruthy();
      expect(screen.getByText(/3 payments/)).toBeTruthy();
    });
  });

  // ===== SEARCH FUNCTIONALITY =====

  describe("Search", () => {
    it("filters payments by member name", async () => {
      await renderTrainerPayments();

      const searchInput = screen.getByLabelText("Search payments by member name");
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: "Alice" } });
      });

      expect(screen.getByText("Alice Smith")).toBeTruthy();
      expect(screen.queryByText("Bob Jones")).toBeNull();
      expect(screen.queryByText("Charlie Brown")).toBeNull();
    });

    it("search is case-insensitive", async () => {
      await renderTrainerPayments();

      const searchInput = screen.getByLabelText("Search payments by member name");
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: "alice" } });
      });

      expect(screen.getByText("Alice Smith")).toBeTruthy();
    });

    it("shows empty state when search matches nothing", async () => {
      await renderTrainerPayments();

      const searchInput = screen.getByLabelText("Search payments by member name");
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: "zzz-no-match" } });
      });

      expect(screen.getByText("No payments recorded yet")).toBeTruthy();
    });

    it("shows Clear button when search is active", async () => {
      await renderTrainerPayments();

      // No clear button initially (current month is default)
      expect(screen.queryByText("Clear")).toBeNull();

      const searchInput = screen.getByLabelText("Search payments by member name");
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: "Alice" } });
      });

      expect(screen.getByText("Clear")).toBeTruthy();
    });
  });

  // ===== FILTER FUNCTIONALITY =====

  describe("Filters", () => {
    it("fetches payments when month filter changes", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      await renderTrainerPayments();

      const monthSelect = screen.getByLabelText("Filter by month");
      await act(async () => {
        fireEvent.change(monthSelect, { target: { value: "0" } }); // January
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/payments?startDate=2026-01-01")
        );
      });
    });

    it("fetches payments when year filter changes", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      await renderTrainerPayments();

      const yearSelect = screen.getByLabelText("Filter by year");
      await act(async () => {
        fireEvent.change(yearSelect, { target: { value: "2025" } });
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/payments?startDate=2025-02")
        );
      });
    });

    it("shows toast on fetch error", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
      });

      await renderTrainerPayments();

      const monthSelect = screen.getByLabelText("Filter by month");
      await act(async () => {
        fireEvent.change(monthSelect, { target: { value: "0" } });
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          expect.objectContaining({ type: "error", title: "Failed to load payments" })
        );
      });
    });

    it("shows toast on network error during fetch", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Network error")
      );

      await renderTrainerPayments();

      const monthSelect = screen.getByLabelText("Filter by month");
      await act(async () => {
        fireEvent.change(monthSelect, { target: { value: "0" } });
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          expect.objectContaining({ type: "error", title: "Failed to load payments" })
        );
      });
    });

    it("applies opacity during loading", async () => {
      let resolvePromise: (value: unknown) => void;
      const fetchPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(fetchPromise);

      await renderTrainerPayments();

      const monthSelect = screen.getByLabelText("Filter by month");
      await act(async () => {
        fireEvent.change(monthSelect, { target: { value: "0" } });
      });

      // Table container should have opacity-50 while loading
      const tableContainer = document.querySelector(".opacity-50");
      expect(tableContainer).toBeTruthy();

      // Resolve the fetch
      await act(async () => {
        resolvePromise!({ ok: true, json: () => Promise.resolve({ data: [] }) });
      });
    });
  });

  // ===== RECORD PAYMENT MODAL =====

  describe("Record Payment Modal", () => {
    it("opens modal when Record Payment button is clicked", async () => {
      await renderTrainerPayments();

      const button = screen.getByText("Record Payment");
      await act(async () => {
        fireEvent.click(button);
      });

      // Modal should have the member select
      expect(screen.getByText("Select a member...")).toBeTruthy();
      expect(screen.getByText("Amount (MKD)")).toBeTruthy();
      expect(screen.getByText("Paid At")).toBeTruthy();
      expect(screen.getByText("Period Start")).toBeTruthy();
      expect(screen.getByText("Period End")).toBeTruthy();
    });

    it("does NOT render notes field in modal", async () => {
      await renderTrainerPayments();

      const button = screen.getByText("Record Payment");
      await act(async () => {
        fireEvent.click(button);
      });

      expect(screen.queryByText("Notes")).toBeNull();
      expect(screen.queryByText("notes")).toBeNull();
      expect(screen.queryByPlaceholderText("Any additional notes...")).toBeNull();
    });

    it("lists all members in the member dropdown", async () => {
      await renderTrainerPayments();

      const button = screen.getByText("Record Payment");
      await act(async () => {
        fireEvent.click(button);
      });

      const memberSelect = screen.getByLabelText("Member");
      const options = memberSelect.querySelectorAll("option");
      // "Select a member..." + 3 members
      expect(options).toHaveLength(4);
      expect(options[1].textContent).toBe("Alice Smith");
      expect(options[2].textContent).toBe("Bob Jones");
      expect(options[3].textContent).toBe("Charlie Brown");
    });

    it("validates required fields on submit", async () => {
      await renderTrainerPayments();

      const button = screen.getByText("Record Payment");
      await act(async () => {
        fireEvent.click(button);
      });

      // Submit without filling anything
      // Page button [0], modal title h2 [1], form submit button [2]
      const submitButton = screen.getAllByText("Record Payment")[2];
      await act(async () => {
        fireEvent.click(submitButton);
      });

      expect(screen.getByText("Select a member")).toBeTruthy();
      expect(screen.getByText("Amount must be a positive number")).toBeTruthy();
      expect(screen.getByText("Period end is required")).toBeTruthy();
    });

    it("validates period end must be after period start", async () => {
      await renderTrainerPayments();

      const button = screen.getByText("Record Payment");
      await act(async () => {
        fireEvent.click(button);
      });

      // Fill in member and amount
      const memberSelect = screen.getByLabelText("Member");
      await act(async () => {
        fireEvent.change(memberSelect, { target: { value: "member-1" } });
      });

      const amountInput = screen.getByLabelText("Amount (MKD)");
      await act(async () => {
        fireEvent.change(amountInput, { target: { value: "1500" } });
      });

      // Set period end before period start
      const periodStart = screen.getByLabelText("Period Start");
      const periodEnd = screen.getByLabelText("Period End");
      await act(async () => {
        fireEvent.change(periodStart, { target: { value: "2026-03-01" } });
        fireEvent.change(periodEnd, { target: { value: "2026-02-01" } });
      });

      // Page button [0], modal title h2 [1], form submit button [2]
      const submitButton = screen.getAllByText("Record Payment")[2];
      await act(async () => {
        fireEvent.click(submitButton);
      });

      expect(screen.getByText("Period end must be after start")).toBeTruthy();
    });

    it("submits payment successfully and shows toast", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { id: "new-pay" } }),
      });

      await renderTrainerPayments();

      const button = screen.getByText("Record Payment");
      await act(async () => {
        fireEvent.click(button);
      });

      // Fill in the form
      const memberSelect = screen.getByLabelText("Member");
      await act(async () => {
        fireEvent.change(memberSelect, { target: { value: "member-1" } });
      });

      const amountInput = screen.getByLabelText("Amount (MKD)");
      await act(async () => {
        fireEvent.change(amountInput, { target: { value: "1500" } });
      });

      const periodEnd = screen.getByLabelText("Period End");
      await act(async () => {
        fireEvent.change(periodEnd, { target: { value: "2026-02-28" } });
      });

      // Page button [0], modal title h2 [1], form submit button [2]
      const submitButton = screen.getAllByText("Record Payment")[2];
      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("/api/payments", expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }));
        expect(mockAddToast).toHaveBeenCalledWith(
          expect.objectContaining({ type: "success", title: "Payment recorded" })
        );
      });
    });

    it("does NOT send notes field in POST body", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { id: "new-pay" } }),
      });

      await renderTrainerPayments();

      const button = screen.getByText("Record Payment");
      await act(async () => {
        fireEvent.click(button);
      });

      // Fill in required fields
      const memberSelect = screen.getByLabelText("Member");
      await act(async () => {
        fireEvent.change(memberSelect, { target: { value: "member-1" } });
      });

      const amountInput = screen.getByLabelText("Amount (MKD)");
      await act(async () => {
        fireEvent.change(amountInput, { target: { value: "1500" } });
      });

      const periodEnd = screen.getByLabelText("Period End");
      await act(async () => {
        fireEvent.change(periodEnd, { target: { value: "2026-02-28" } });
      });

      // Page button [0], modal title h2 [1], form submit button [2]
      const submitButton = screen.getAllByText("Record Payment")[2];
      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
        const body = JSON.parse(fetchCall[1].body as string);
        expect(body).not.toHaveProperty("notes");
        expect(body).toHaveProperty("userId", "member-1");
        expect(body).toHaveProperty("amount", 1500);
      });
    });

    it("shows error toast when payment POST fails", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Server error" }),
      });

      await renderTrainerPayments();

      const button = screen.getByText("Record Payment");
      await act(async () => {
        fireEvent.click(button);
      });

      // Fill in required fields
      const memberSelect = screen.getByLabelText("Member");
      await act(async () => {
        fireEvent.change(memberSelect, { target: { value: "member-1" } });
      });

      const amountInput = screen.getByLabelText("Amount (MKD)");
      await act(async () => {
        fireEvent.change(amountInput, { target: { value: "1500" } });
      });

      const periodEnd = screen.getByLabelText("Period End");
      await act(async () => {
        fireEvent.change(periodEnd, { target: { value: "2026-02-28" } });
      });

      // Page button [0], modal title h2 [1], form submit button [2]
      const submitButton = screen.getAllByText("Record Payment")[2];
      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          expect.objectContaining({ type: "error", title: "Failed to record payment" })
        );
      });
    });

    it("shows network error toast when fetch throws", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Network error")
      );

      await renderTrainerPayments();

      const button = screen.getByText("Record Payment");
      await act(async () => {
        fireEvent.click(button);
      });

      // Fill in required fields
      const memberSelect = screen.getByLabelText("Member");
      await act(async () => {
        fireEvent.change(memberSelect, { target: { value: "member-1" } });
      });

      const amountInput = screen.getByLabelText("Amount (MKD)");
      await act(async () => {
        fireEvent.change(amountInput, { target: { value: "1500" } });
      });

      const periodEnd = screen.getByLabelText("Period End");
      await act(async () => {
        fireEvent.change(periodEnd, { target: { value: "2026-02-28" } });
      });

      // Page button [0], modal title h2 [1], form submit button [2]
      const submitButton = screen.getAllByText("Record Payment")[2];
      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          expect.objectContaining({ type: "error", title: "Network error" })
        );
      });
    });

    it("resets form and closes modal on Cancel", async () => {
      await renderTrainerPayments();

      // Open modal
      const button = screen.getByText("Record Payment");
      await act(async () => {
        fireEvent.click(button);
      });

      // Fill in amount
      const amountInput = screen.getByLabelText("Amount (MKD)");
      await act(async () => {
        fireEvent.change(amountInput, { target: { value: "1500" } });
      });

      // Click Cancel
      const cancelButton = screen.getByText("Cancel");
      await act(async () => {
        fireEvent.click(cancelButton);
      });

      // Modal should be closed - "Select a member..." only appears in modal
      expect(screen.queryByText("Select a member...")).toBeNull();
    });
  });

  // ===== TRAINER-SPECIFIC RESTRICTIONS =====

  describe("Trainer Restrictions", () => {
    it("has no <a> or <Link> elements anywhere on the page", async () => {
      await renderTrainerPayments();

      const links = document.querySelectorAll("a");
      expect(links).toHaveLength(0);
    });

    it("has no edit buttons", async () => {
      await renderTrainerPayments();

      expect(screen.queryByLabelText(/edit/i)).toBeNull();
    });

    it("has no delete buttons", async () => {
      await renderTrainerPayments();

      expect(screen.queryByLabelText(/delete/i)).toBeNull();
    });

    it("has no notes-related elements anywhere", async () => {
      await renderTrainerPayments();

      // Open modal to check there too
      const button = screen.getByText("Record Payment");
      await act(async () => {
        fireEvent.click(button);
      });

      // No notes label, placeholder, or textarea
      expect(screen.queryByLabelText(/notes/i)).toBeNull();
      expect(screen.queryByPlaceholderText(/notes/i)).toBeNull();
    });
  });
});
