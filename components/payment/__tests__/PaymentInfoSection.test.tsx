/**
 * PaymentInfoSection Unit Tests
 *
 * Tests rendering of payment status, grace period warnings,
 * date info grid, empty states, payment history rows,
 * and "Show all" toggle behavior.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ===== Mocks =====

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock useToast
const mockAddToast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

// ===== Helpers =====

function fmtCurrency(amount: number): string {
  return `${amount.toLocaleString()} MKD`;
}

// ===== Test Data =====

const defaultProps = {
  status: "PAID" as const,
  daysRemaining: null,
  lastPaymentDate: "2026-02-05T10:00:00.000Z",
  paidThroughDate: "2026-02-28",
  nextPaymentDue: "2026-03-01",
  recentPayments: [
    {
      id: "p-1",
      amount: 1500,
      paidAt: "2026-02-05T10:00:00.000Z",
      periodStart: "2026-02-01",
      periodEnd: "2026-02-28",
    },
    {
      id: "p-2",
      amount: 1500,
      paidAt: "2026-01-05T10:00:00.000Z",
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
    },
  ],
  totalPaymentCount: 2,
  userStatus: "ACTIVE" as const,
  trialEndsAt: null,
};

// ===== Tests =====

describe("PaymentInfoSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ----- PAID status -----

  describe("PAID status", () => {
    it("shows PaymentStatusBadge and all three dates", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(<PaymentInfoSection {...defaultProps} />);

      // Badge renders via PaymentStatusBadge (which renders translated text "Paid")
      screen.getByText("Paid");

      // Three date labels
      screen.getByText("Last payment");
      screen.getByText("Paid through");
      screen.getByText("Next payment due");

      // Date values rendered (date-fns format "MMM d, yyyy")
      // "Feb 5, 2026" appears in both the date grid and in a payment row's paidAt
      const feb5Elements = screen.getAllByText("Feb 5, 2026");
      expect(feb5Elements.length).toBeGreaterThanOrEqual(1);
      screen.getByText("Feb 28, 2026");
      screen.getByText("Mar 1, 2026");
    });

    it("renders Payment Information header", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(<PaymentInfoSection {...defaultProps} />);
      screen.getByText("Payment Information");
    });
  });

  // ----- GRACE_PERIOD status -----

  describe("GRACE_PERIOD status", () => {
    it("shows warning with countdown for active member", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          status="GRACE_PERIOD"
          daysRemaining={5}
          userStatus="ACTIVE"
        />
      );

      screen.getByText("Grace Period");
      screen.getByText("5 days remaining to pay");
      // Alert banner should have role="alert"
      expect(screen.getByRole("alert")).toBeTruthy();
    });

    it("shows singular day for 1 day remaining (active)", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          status="GRACE_PERIOD"
          daysRemaining={1}
          userStatus="ACTIVE"
        />
      );

      screen.getByText("1 day remaining to pay");
    });

    it("shows trial countdown for trial member", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          status="GRACE_PERIOD"
          daysRemaining={10}
          userStatus="TRIAL"
          trialEndsAt="2026-03-10"
        />
      );

      screen.getByText("Grace Period");
      screen.getByText("10 days remaining in trial");
    });

    it("shows singular day for 1 day remaining (trial)", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          status="GRACE_PERIOD"
          daysRemaining={1}
          userStatus="TRIAL"
          trialEndsAt="2026-03-01"
        />
      );

      screen.getByText("1 day remaining in trial");
    });
  });

  // ----- OVERRIDE status -----

  describe("OVERRIDE status", () => {
    it("shows override message with role='alert'", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          status="OVERRIDE"
        />
      );

      screen.getByText("Override");
      screen.getByText("Payment override active");
      expect(screen.getByRole("alert")).toBeTruthy();
    });
  });

  // ----- LOCKED status -----

  describe("LOCKED status", () => {
    it("shows locked badge and overdue message with role='alert'", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          status="LOCKED"
          daysRemaining={0}
        />
      );

      screen.getByText("Locked");
      screen.getByText("Payment overdue — contact the owner");
      expect(screen.getByRole("alert")).toBeTruthy();
    });
  });

  // ----- Empty state -----

  describe("empty state (no payments)", () => {
    it("shows empty message when no payments", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          lastPaymentDate={null}
          paidThroughDate={null}
          nextPaymentDue={null}
          recentPayments={[]}
          totalPaymentCount={0}
          userStatus="ACTIVE"
        />
      );

      screen.getByText("No payments recorded yet");
    });

    it("shows trial end date for trial member with no payments", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          status="GRACE_PERIOD"
          daysRemaining={14}
          lastPaymentDate={null}
          paidThroughDate={null}
          nextPaymentDue={null}
          recentPayments={[]}
          totalPaymentCount={0}
          userStatus="TRIAL"
          trialEndsAt="2026-03-10"
        />
      );

      screen.getByText("No payments recorded yet");
      // Trial end date message: "Trial ends on Mar 10, 2026"
      screen.getByText("Trial ends on Mar 10, 2026");
    });
  });

  // ----- Date columns conditional rendering -----

  describe("date column rendering", () => {
    it("does not render lastPaymentDate column when null", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          lastPaymentDate={null}
        />
      );

      expect(screen.queryByText("Last payment")).toBeNull();
      // Other dates should still appear
      screen.getByText("Paid through");
      screen.getByText("Next payment due");
    });

    it("does not render paidThroughDate column when null", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          paidThroughDate={null}
        />
      );

      screen.getByText("Last payment");
      expect(screen.queryByText("Paid through")).toBeNull();
      screen.getByText("Next payment due");
    });

    it("does not render nextPaymentDue column when null", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          nextPaymentDue={null}
        />
      );

      screen.getByText("Last payment");
      screen.getByText("Paid through");
      expect(screen.queryByText("Next payment due")).toBeNull();
    });
  });

  // ----- Payment history rows -----

  describe("payment history rows", () => {
    it("renders payment amounts and dates in rows", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(<PaymentInfoSection {...defaultProps} />);

      // Recent Payments header
      screen.getByText("Recent Payments");

      // Payment amount
      const amounts = screen.getAllByText(fmtCurrency(1500));
      expect(amounts.length).toBe(2);
    });
  });

  // ----- Show all / Show recent toggle -----

  describe("show all toggle", () => {
    it("shows 'Show all payments' button when totalPaymentCount > recentPayments.length", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          totalPaymentCount={5}
        />
      );

      screen.getByText("Show all payments");
    });

    it("does not show toggle when all payments are visible", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          totalPaymentCount={2}
        />
      );

      expect(screen.queryByText("Show all payments")).toBeNull();
      expect(screen.queryByText("Show recent")).toBeNull();
    });

    it("fetches all payments on first 'Show all' click", async () => {
      const allPayments = [
        {
          id: "p-1",
          amount: 1500,
          paidAt: "2026-02-05T10:00:00.000Z",
          periodStart: "2026-02-01",
          periodEnd: "2026-02-28",
        },
        {
          id: "p-2",
          amount: 1500,
          paidAt: "2026-01-05T10:00:00.000Z",
          periodStart: "2026-01-01",
          periodEnd: "2026-01-31",
        },
        {
          id: "p-3",
          amount: 1200,
          paidAt: "2025-12-05T10:00:00.000Z",
          periodStart: "2025-12-01",
          periodEnd: "2025-12-31",
        },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: allPayments }),
      });

      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          totalPaymentCount={3}
        />
      );

      fireEvent.click(screen.getByText("Show all payments"));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/payments/my");
      });

      // After fetching, button should change to "Show recent"
      await waitFor(() => {
        screen.getByText("Show recent");
      });

      // The third payment should now be visible
      screen.getByText(fmtCurrency(1200));
    });

    it("handles fetch failure gracefully (res.ok = false)", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          totalPaymentCount={5}
        />
      );

      fireEvent.click(screen.getByText("Show all payments"));

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: "error",
          title: "Failed to load payments",
        });
      });

      // Button should return to normal state — still says "Show all payments"
      const button = screen.getByText("Show all payments");
      expect(button.hasAttribute("disabled")).toBe(false);
    });

    it("handles network error gracefully", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          totalPaymentCount={5}
        />
      );

      fireEvent.click(screen.getByText("Show all payments"));

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: "error",
          title: "Failed to load payments",
        });
      });

      // Button should return to normal state — still says "Show all payments"
      const button = screen.getByText("Show all payments");
      expect(button.hasAttribute("disabled")).toBe(false);
    });

    it("toggles back to recent without re-fetching", async () => {
      const allPayments = [
        {
          id: "p-1",
          amount: 1500,
          paidAt: "2026-02-05T10:00:00.000Z",
          periodStart: "2026-02-01",
          periodEnd: "2026-02-28",
        },
        {
          id: "p-2",
          amount: 1500,
          paidAt: "2026-01-05T10:00:00.000Z",
          periodStart: "2026-01-01",
          periodEnd: "2026-01-31",
        },
        {
          id: "p-3",
          amount: 1200,
          paidAt: "2025-12-05T10:00:00.000Z",
          periodStart: "2025-12-01",
          periodEnd: "2025-12-31",
        },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: allPayments }),
      });

      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          totalPaymentCount={3}
        />
      );

      // Click "Show all"
      fireEvent.click(screen.getByText("Show all payments"));
      await waitFor(() => {
        screen.getByText("Show recent");
      });

      // Click "Show recent"
      fireEvent.click(screen.getByText("Show recent"));
      await waitFor(() => {
        screen.getByText("Show all payments");
      });

      // Should not have fetched a second time
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Click "Show all" again — no new fetch
      fireEvent.click(screen.getByText("Show all payments"));
      await waitFor(() => {
        screen.getByText("Show recent");
      });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
