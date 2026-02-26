/**
 * PaymentInfoSection Unit Tests
 *
 * Comprehensive tests covering:
 * - Status rendering (5 statuses: PAID, GRACE_PERIOD, LOCKED, OVERRIDE, DEPARTED)
 * - Grace period edge cases (0, 1, 10, 14 days; null daysRemaining)
 * - Date info grid (conditional rendering of 3 columns)
 * - Empty state (ACTIVE, TRIAL with/without trialEndsAt)
 * - Payment history rows (amounts, formatting, periods, dates)
 * - "Show all / Show recent" toggle (fetch, cache, error handling)
 * - Accessibility (role="alert" presence/absence)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ===== Mocks =====

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockAddToast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

// ===== Test Data =====

const samplePayments = [
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
];

const defaultProps = {
  status: "PAID" as const,
  daysRemaining: null,
  lastPaymentDate: "2026-02-05T10:00:00.000Z",
  paidThroughDate: "2026-02-28",
  nextPaymentDue: "2026-03-01",
  recentPayments: samplePayments,
  totalPaymentCount: 2,
  userStatus: "ACTIVE" as const,
  trialEndsAt: null,
};

const noPaymentProps = {
  ...defaultProps,
  lastPaymentDate: null,
  paidThroughDate: null,
  nextPaymentDue: null,
  recentPayments: [],
  totalPaymentCount: 0,
};

const allPaymentsFromServer = [
  ...samplePayments,
  {
    id: "p-3",
    amount: 1200,
    paidAt: "2025-12-05T10:00:00.000Z",
    periodStart: "2025-12-01",
    periodEnd: "2025-12-31",
  },
  {
    id: "p-4",
    amount: 2000,
    paidAt: "2025-11-03T09:00:00.000Z",
    periodStart: "2025-11-01",
    periodEnd: "2025-11-30",
  },
];

// ===== Tests =====

describe("PaymentInfoSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // Status rendering (5 statuses)
  // =========================================================================

  describe("status rendering", () => {
    it("PAID: shows 'Paid' badge and no alert bar", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(<PaymentInfoSection {...defaultProps} status="PAID" />);

      screen.getByText("Paid");
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("GRACE_PERIOD + ACTIVE: shows 'Grace Period' badge and yellow warning alert", async () => {
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
      const alert = screen.getByRole("alert");
      expect(alert).toBeTruthy();
      expect(alert.textContent).toContain("5 days remaining to pay");
    });

    it("GRACE_PERIOD + TRIAL: shows 'Grace Period' badge and yellow warning alert with trial message", async () => {
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
      const alert = screen.getByRole("alert");
      expect(alert).toBeTruthy();
      expect(alert.textContent).toContain("10 days remaining in trial");
    });

    it("LOCKED: shows 'Locked' badge and red error alert", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          status="LOCKED"
          daysRemaining={0}
        />
      );

      screen.getByText("Locked");
      const alert = screen.getByRole("alert");
      expect(alert).toBeTruthy();
      expect(alert.textContent).toContain(
        "Payment overdue — contact the owner"
      );
    });

    it("OVERRIDE: shows 'Override' badge and purple alert", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection {...defaultProps} status="OVERRIDE" />
      );

      screen.getByText("Override");
      const alert = screen.getByRole("alert");
      expect(alert).toBeTruthy();
      expect(alert.textContent).toContain("Payment override active");
    });

    it("DEPARTED: shows 'Departed' badge and no alert bar", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection {...defaultProps} status="DEPARTED" />
      );

      screen.getByText("Departed");
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("renders 'Payment Information' header for all statuses", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      const statuses = [
        "PAID",
        "GRACE_PERIOD",
        "LOCKED",
        "OVERRIDE",
        "DEPARTED",
      ] as const;

      for (const status of statuses) {
        const { unmount } = render(
          <PaymentInfoSection
            {...defaultProps}
            status={status}
            daysRemaining={status === "GRACE_PERIOD" ? 5 : null}
          />
        );
        screen.getByText("Payment Information");
        unmount();
      }
    });
  });

  // =========================================================================
  // Grace period edge cases
  // =========================================================================

  describe("grace period edge cases", () => {
    it("daysRemaining = 0 still shows alert for ACTIVE user", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          status="GRACE_PERIOD"
          daysRemaining={0}
          userStatus="ACTIVE"
        />
      );

      const alert = screen.getByRole("alert");
      expect(alert.textContent).toContain("0 days remaining to pay");
    });

    it("daysRemaining = 0 still shows alert for TRIAL user", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          status="GRACE_PERIOD"
          daysRemaining={0}
          userStatus="TRIAL"
          trialEndsAt="2026-02-26"
        />
      );

      const alert = screen.getByRole("alert");
      expect(alert.textContent).toContain("0 days remaining in trial");
    });

    it("daysRemaining = 1 shows singular 'day' for ACTIVE user", async () => {
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

    it("daysRemaining = 1 shows singular 'day' for TRIAL user", async () => {
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

    it("daysRemaining = 14 shows full trial period", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          status="GRACE_PERIOD"
          daysRemaining={14}
          userStatus="TRIAL"
          trialEndsAt="2026-03-12"
        />
      );

      screen.getByText("14 days remaining in trial");
    });

    it("daysRemaining = 10 shows full active grace period", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          status="GRACE_PERIOD"
          daysRemaining={10}
          userStatus="ACTIVE"
        />
      );

      screen.getByText("10 days remaining to pay");
    });

    it("daysRemaining = null with GRACE_PERIOD status does not render alert", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          status="GRACE_PERIOD"
          daysRemaining={null}
          userStatus="ACTIVE"
        />
      );

      // Badge still shows
      screen.getByText("Grace Period");
      // But no alert bar since daysRemaining is null
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  // =========================================================================
  // Date info grid
  // =========================================================================

  describe("date info grid", () => {
    it("renders all three date columns when all dates are provided", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(<PaymentInfoSection {...defaultProps} />);

      screen.getByText("Last payment");
      screen.getByText("Paid through");
      screen.getByText("Next payment due");

      // Verify date values
      const feb5Elements = screen.getAllByText("Feb 5, 2026");
      expect(feb5Elements.length).toBeGreaterThanOrEqual(1);
      screen.getByText("Feb 28, 2026");
      screen.getByText("Mar 1, 2026");
    });

    it("renders only lastPaymentDate column when others are null", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          paidThroughDate={null}
          nextPaymentDue={null}
        />
      );

      screen.getByText("Last payment");
      expect(screen.queryByText("Paid through")).toBeNull();
      expect(screen.queryByText("Next payment due")).toBeNull();
    });

    it("renders only paidThroughDate column when others are null", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          lastPaymentDate={null}
          nextPaymentDue={null}
        />
      );

      expect(screen.queryByText("Last payment")).toBeNull();
      screen.getByText("Paid through");
      expect(screen.queryByText("Next payment due")).toBeNull();
    });

    it("renders only nextPaymentDue column when others are null", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          lastPaymentDate={null}
          paidThroughDate={null}
        />
      );

      expect(screen.queryByText("Last payment")).toBeNull();
      expect(screen.queryByText("Paid through")).toBeNull();
      screen.getByText("Next payment due");
    });

    it("does not render lastPaymentDate column when null", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          lastPaymentDate={null}
        />
      );

      expect(screen.queryByText("Last payment")).toBeNull();
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

    it("does not render date grid when all dates are null but payments exist", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          lastPaymentDate={null}
          paidThroughDate={null}
          nextPaymentDue={null}
        />
      );

      expect(screen.queryByText("Last payment")).toBeNull();
      expect(screen.queryByText("Paid through")).toBeNull();
      expect(screen.queryByText("Next payment due")).toBeNull();

      // Payment history should still render
      screen.getByText("Recent Payments");
    });

    it("shows empty state when no dates and no payments", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(<PaymentInfoSection {...noPaymentProps} />);

      screen.getByText("No payments recorded yet");
      expect(screen.queryByText("Last payment")).toBeNull();
      expect(screen.queryByText("Paid through")).toBeNull();
      expect(screen.queryByText("Next payment due")).toBeNull();
    });

    it("does not show empty state when no dates but has payments", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          lastPaymentDate={null}
          paidThroughDate={null}
          nextPaymentDue={null}
        />
      );

      expect(screen.queryByText("No payments recorded yet")).toBeNull();
      // Payment history is still shown
      screen.getByText("Recent Payments");
    });
  });

  // =========================================================================
  // Empty state
  // =========================================================================

  describe("empty state", () => {
    it("ACTIVE user with no payments: shows empty message, no trial message", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection {...noPaymentProps} userStatus="ACTIVE" />
      );

      screen.getByText("No payments recorded yet");
      // Should not show any trial-related text
      expect(screen.queryByText(/Trial ends on/)).toBeNull();
    });

    it("TRIAL user with trialEndsAt: shows empty message and trial end date", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...noPaymentProps}
          status="GRACE_PERIOD"
          daysRemaining={14}
          userStatus="TRIAL"
          trialEndsAt="2026-03-10"
        />
      );

      screen.getByText("No payments recorded yet");
      screen.getByText("Trial ends on Mar 10, 2026");
    });

    it("TRIAL user without trialEndsAt (null): shows empty message, no trial date", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...noPaymentProps}
          status="GRACE_PERIOD"
          daysRemaining={14}
          userStatus="TRIAL"
          trialEndsAt={null}
        />
      );

      screen.getByText("No payments recorded yet");
      expect(screen.queryByText(/Trial ends on/)).toBeNull();
    });

    it("has payments but no dates: does NOT show empty state", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          lastPaymentDate={null}
          paidThroughDate={null}
          nextPaymentDue={null}
        />
      );

      expect(screen.queryByText("No payments recorded yet")).toBeNull();
    });

    it("DEPARTED user with no payments: shows empty message", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...noPaymentProps}
          status="DEPARTED"
          userStatus="DEPARTED"
        />
      );

      screen.getByText("No payments recorded yet");
      expect(screen.queryByText(/Trial ends on/)).toBeNull();
    });
  });

  // =========================================================================
  // Payment history rows
  // =========================================================================

  describe("payment history rows", () => {
    it("renders 'Recent Payments' header", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(<PaymentInfoSection {...defaultProps} />);

      screen.getByText("Recent Payments");
    });

    it("renders single payment with correct amount, period, and date", async () => {
      const singlePayment = [
        {
          id: "p-single",
          amount: 1500,
          paidAt: "2026-02-10T12:00:00.000Z",
          periodStart: "2026-02-01",
          periodEnd: "2026-02-28",
        },
      ];

      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          recentPayments={singlePayment}
          totalPaymentCount={1}
        />
      );

      screen.getByText("1,500 MKD");
      // Period range: "Feb 1, 2026 – Feb 28, 2026"
      screen.getByText(/Feb 1, 2026/);
      // Paid date
      screen.getByText("Feb 10, 2026");
    });

    it("renders multiple payments with all rows", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(<PaymentInfoSection {...defaultProps} />);

      // Both amounts should appear (both are 1,500 MKD)
      const amounts = screen.getAllByText("1,500 MKD");
      expect(amounts.length).toBe(2);
    });

    it("formats 1500 as '1,500 MKD'", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(<PaymentInfoSection {...defaultProps} />);

      const amounts = screen.getAllByText("1,500 MKD");
      expect(amounts.length).toBeGreaterThanOrEqual(1);
    });

    it("formats 2000 as '2,000 MKD'", async () => {
      const payment = [
        {
          id: "p-2k",
          amount: 2000,
          paidAt: "2026-02-01T10:00:00.000Z",
          periodStart: "2026-02-01",
          periodEnd: "2026-02-28",
        },
      ];

      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          recentPayments={payment}
          totalPaymentCount={1}
        />
      );

      screen.getByText("2,000 MKD");
    });

    it("formats 500 as '500 MKD' (no comma)", async () => {
      const payment = [
        {
          id: "p-500",
          amount: 500,
          paidAt: "2026-02-01T10:00:00.000Z",
          periodStart: "2026-02-01",
          periodEnd: "2026-02-28",
        },
      ];

      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          recentPayments={payment}
          totalPaymentCount={1}
        />
      );

      screen.getByText("500 MKD");
    });

    it("formats 10000 as '10,000 MKD'", async () => {
      const payment = [
        {
          id: "p-10k",
          amount: 10000,
          paidAt: "2026-02-01T10:00:00.000Z",
          periodStart: "2026-02-01",
          periodEnd: "2026-02-28",
        },
      ];

      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          recentPayments={payment}
          totalPaymentCount={1}
        />
      );

      screen.getByText("10,000 MKD");
    });

    it("formats 100000 as '100,000 MKD'", async () => {
      const payment = [
        {
          id: "p-100k",
          amount: 100000,
          paidAt: "2026-02-01T10:00:00.000Z",
          periodStart: "2026-02-01",
          periodEnd: "2026-02-28",
        },
      ];

      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          recentPayments={payment}
          totalPaymentCount={1}
        />
      );

      screen.getByText("100,000 MKD");
    });

    it("formats 0 as '0 MKD'", async () => {
      const payment = [
        {
          id: "p-zero",
          amount: 0,
          paidAt: "2026-02-01T10:00:00.000Z",
          periodStart: "2026-02-01",
          periodEnd: "2026-02-28",
        },
      ];

      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          recentPayments={payment}
          totalPaymentCount={1}
        />
      );

      screen.getByText("0 MKD");
    });

    it("does not render payment history card when no payments", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(<PaymentInfoSection {...noPaymentProps} />);

      expect(screen.queryByText("Recent Payments")).toBeNull();
    });

    it("renders period range for each payment row", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(<PaymentInfoSection {...defaultProps} />);

      // First payment: Feb 1, 2026 – Feb 28, 2026
      screen.getByText(/Feb 1, 2026 – Feb 28, 2026/);
      // Second payment: Jan 1, 2026 – Jan 31, 2026
      screen.getByText(/Jan 1, 2026 – Jan 31, 2026/);
    });

    it("renders paidAt date for each payment row", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(<PaymentInfoSection {...defaultProps} />);

      // paidAt for first: Feb 5, 2026
      const feb5Elements = screen.getAllByText("Feb 5, 2026");
      expect(feb5Elements.length).toBeGreaterThanOrEqual(1);
      // paidAt for second: Jan 5, 2026
      screen.getByText("Jan 5, 2026");
    });
  });

  // =========================================================================
  // Show all toggle
  // =========================================================================

  describe("show all toggle", () => {
    it("is not shown when totalPaymentCount === recentPayments.length", async () => {
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

    it("is not shown when totalPaymentCount < recentPayments.length (edge case)", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          totalPaymentCount={1}
        />
      );

      expect(screen.queryByText("Show all payments")).toBeNull();
      expect(screen.queryByText("Show recent")).toBeNull();
    });

    it("is shown when totalPaymentCount > recentPayments.length", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          totalPaymentCount={5}
        />
      );

      screen.getByText("Show all payments");
    });

    it("first click fetches /api/payments/my and shows 'Show recent' after success", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: allPaymentsFromServer }),
      });

      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          totalPaymentCount={4}
        />
      );

      fireEvent.click(screen.getByText("Show all payments"));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/payments/my");
      });

      await waitFor(() => {
        screen.getByText("Show recent");
      });

      // All payments from server should be displayed (including p-3 and p-4)
      screen.getByText("1,200 MKD");
      screen.getByText("2,000 MKD");
    });

    it("clicking 'Show recent' toggles back without re-fetching", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: allPaymentsFromServer }),
      });

      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          totalPaymentCount={4}
        />
      );

      // First click: "Show all"
      fireEvent.click(screen.getByText("Show all payments"));
      await waitFor(() => screen.getByText("Show recent"));

      // Click "Show recent"
      fireEvent.click(screen.getByText("Show recent"));
      await waitFor(() => screen.getByText("Show all payments"));

      // Only one fetch call
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("clicking 'Show all' again after toggling back uses cache, no new fetch", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: allPaymentsFromServer }),
      });

      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          totalPaymentCount={4}
        />
      );

      // First click: "Show all" — triggers fetch
      fireEvent.click(screen.getByText("Show all payments"));
      await waitFor(() => screen.getByText("Show recent"));
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Click "Show recent"
      fireEvent.click(screen.getByText("Show recent"));
      await waitFor(() => screen.getByText("Show all payments"));

      // Click "Show all" again — should use cached data, no new fetch
      fireEvent.click(screen.getByText("Show all payments"));
      await waitFor(() => screen.getByText("Show recent"));
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // All payments should still be visible from cache
      screen.getByText("1,200 MKD");
      screen.getByText("2,000 MKD");
    });

    it("fetch failure (res.ok = false): shows error toast, button returns to 'Show all payments'", async () => {
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

      // Button returns to "Show all payments" and is not disabled
      const button = screen.getByText("Show all payments");
      expect(button).toBeTruthy();
      expect(button.hasAttribute("disabled")).toBe(false);
    });

    it("network error (fetch rejects): shows error toast, button returns to 'Show all payments'", async () => {
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

      // Button returns to "Show all payments" and is not disabled
      const button = screen.getByText("Show all payments");
      expect(button).toBeTruthy();
      expect(button.hasAttribute("disabled")).toBe(false);
    });

    it("button is disabled during loading", async () => {
      // Use a promise that never resolves to keep loading state
      let resolveFetch: ((value: unknown) => void) | undefined;
      mockFetch.mockReturnValue(
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
      );

      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          totalPaymentCount={5}
        />
      );

      const button = screen.getByText("Show all payments");
      fireEvent.click(button);

      // Button should be disabled while loading
      await waitFor(() => {
        expect(
          screen.getByText("Show all payments").hasAttribute("disabled")
        ).toBe(true);
      });

      // Resolve the fetch to clean up
      resolveFetch!({
        ok: true,
        json: async () => ({ data: allPaymentsFromServer }),
      });

      await waitFor(() => {
        expect(
          screen.getByText("Show recent").hasAttribute("disabled")
        ).toBe(false);
      });
    });

    it("after successful fetch, displays all payments from response", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: allPaymentsFromServer }),
      });

      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          totalPaymentCount={4}
        />
      );

      fireEvent.click(screen.getByText("Show all payments"));
      await waitFor(() => screen.getByText("Show recent"));

      // Should display all 4 payments from the server response
      const amounts1500 = screen.getAllByText("1,500 MKD");
      expect(amounts1500.length).toBe(2);
      screen.getByText("1,200 MKD");
      screen.getByText("2,000 MKD");
    });

    it("after toggling to 'Show recent', only recent payments are displayed", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: allPaymentsFromServer }),
      });

      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          totalPaymentCount={4}
        />
      );

      // Show all
      fireEvent.click(screen.getByText("Show all payments"));
      await waitFor(() => screen.getByText("Show recent"));

      // Verify all 4 are visible
      screen.getByText("1,200 MKD");
      screen.getByText("2,000 MKD");

      // Toggle back to recent
      fireEvent.click(screen.getByText("Show recent"));
      await waitFor(() => screen.getByText("Show all payments"));

      // Extra payments from the server should not be visible
      expect(screen.queryByText("1,200 MKD")).toBeNull();
      expect(screen.queryByText("2,000 MKD")).toBeNull();

      // Recent payments should still be visible
      const amounts1500 = screen.getAllByText("1,500 MKD");
      expect(amounts1500.length).toBe(2);
    });
  });

  // =========================================================================
  // Accessibility
  // =========================================================================

  describe("accessibility", () => {
    it("GRACE_PERIOD alert has role='alert'", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          status="GRACE_PERIOD"
          daysRemaining={5}
          userStatus="ACTIVE"
        />
      );

      expect(screen.getByRole("alert")).toBeTruthy();
    });

    it("LOCKED alert has role='alert'", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection {...defaultProps} status="LOCKED" />
      );

      expect(screen.getByRole("alert")).toBeTruthy();
    });

    it("OVERRIDE alert has role='alert'", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection {...defaultProps} status="OVERRIDE" />
      );

      expect(screen.getByRole("alert")).toBeTruthy();
    });

    it("PAID status has no role='alert' element", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection {...defaultProps} status="PAID" />
      );

      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("DEPARTED status has no role='alert' element", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection {...defaultProps} status="DEPARTED" />
      );

      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("GRACE_PERIOD with null daysRemaining has no role='alert' element", async () => {
      const { PaymentInfoSection } = await import("../PaymentInfoSection");
      render(
        <PaymentInfoSection
          {...defaultProps}
          status="GRACE_PERIOD"
          daysRemaining={null}
        />
      );

      expect(screen.queryByRole("alert")).toBeNull();
    });
  });
});
