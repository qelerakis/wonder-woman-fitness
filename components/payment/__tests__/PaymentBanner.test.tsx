/**
 * PaymentBanner Unit Tests
 *
 * Tests rendering behavior for all payment statuses,
 * grace period countdown display, pluralization,
 * custom totalGraceDays prop, and navigation link.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PaymentBanner } from "../PaymentBanner";

// ===== Tests =====

describe("PaymentBanner", () => {
  // ----- Statuses that render nothing -----

  describe("statuses that render nothing", () => {
    it("renders nothing when status is PAID", () => {
      const { container } = render(<PaymentBanner status="PAID" />);
      expect(container.innerHTML).toBe("");
    });

    it("renders nothing when status is OVERRIDE", () => {
      const { container } = render(<PaymentBanner status="OVERRIDE" />);
      expect(container.innerHTML).toBe("");
    });

    it("renders nothing when status is DEPARTED", () => {
      const { container } = render(<PaymentBanner status="DEPARTED" />);
      expect(container.innerHTML).toBe("");
    });
  });

  // ----- GRACE_PERIOD banner -----

  describe("GRACE_PERIOD banner", () => {
    it("renders a warning banner for GRACE_PERIOD", () => {
      render(<PaymentBanner status="GRACE_PERIOD" daysIntoGracePeriod={3} />);
      expect(screen.getByText("Payment due.")).toBeTruthy();
    });

    it("shows correct days remaining with default totalGraceDays (10)", () => {
      // 10 total - 3 into = 7 remaining
      render(<PaymentBanner status="GRACE_PERIOD" daysIntoGracePeriod={3} />);
      expect(
        screen.getByText(
          "You have 7 days remaining before your account is locked."
        )
      ).toBeTruthy();
    });

    it("shows correct countdown with custom totalGraceDays (14) for trial members", () => {
      // 14 total - 5 into = 9 remaining
      render(
        <PaymentBanner
          status="GRACE_PERIOD"
          daysIntoGracePeriod={5}
          totalGraceDays={14}
        />
      );
      expect(
        screen.getByText(
          "You have 9 days remaining before your account is locked."
        )
      ).toBeTruthy();
    });

    it("shows correct plural: '1 day' (singular)", () => {
      // 10 total - 9 into = 1 remaining
      render(<PaymentBanner status="GRACE_PERIOD" daysIntoGracePeriod={9} />);
      expect(
        screen.getByText(
          "You have 1 day remaining before your account is locked."
        )
      ).toBeTruthy();
    });

    it("shows correct plural: '5 days' (plural)", () => {
      // 10 total - 5 into = 5 remaining
      render(<PaymentBanner status="GRACE_PERIOD" daysIntoGracePeriod={5} />);
      expect(
        screen.getByText(
          "You have 5 days remaining before your account is locked."
        )
      ).toBeTruthy();
    });

    it("shows 'Your account will be locked tomorrow.' when daysRemaining is 0", () => {
      // 10 total - 10 into = 0 remaining
      render(<PaymentBanner status="GRACE_PERIOD" daysIntoGracePeriod={10} />);
      expect(
        screen.getByText(
          "Your account will be locked tomorrow. Please make your payment."
        )
      ).toBeTruthy();
    });

    it("clamps daysRemaining to 0 when daysIntoGracePeriod exceeds totalGraceDays", () => {
      // 10 total - 15 into = -5, clamped to 0
      render(<PaymentBanner status="GRACE_PERIOD" daysIntoGracePeriod={15} />);
      expect(
        screen.getByText(
          "Your account will be locked tomorrow. Please make your payment."
        )
      ).toBeTruthy();
    });

    it("renders 'Pay Now' link pointing to /profile#payment", () => {
      render(<PaymentBanner status="GRACE_PERIOD" daysIntoGracePeriod={3} />);
      const link = screen.getByText("Pay Now");
      expect(link).toBeTruthy();
      expect(link.getAttribute("href")).toBe("/profile#payment");
    });

    it("shows full 10 days when daysIntoGracePeriod defaults to 0", () => {
      // Default daysIntoGracePeriod is 0 → 10 remaining
      render(<PaymentBanner status="GRACE_PERIOD" />);
      expect(
        screen.getByText(
          "You have 10 days remaining before your account is locked."
        )
      ).toBeTruthy();
    });

    it("shows full 14 days for trial member on day 0 with custom totalGraceDays", () => {
      render(
        <PaymentBanner
          status="GRACE_PERIOD"
          daysIntoGracePeriod={0}
          totalGraceDays={14}
        />
      );
      expect(
        screen.getByText(
          "You have 14 days remaining before your account is locked."
        )
      ).toBeTruthy();
    });
  });

  // ----- LOCKED banner -----

  describe("LOCKED banner", () => {
    it("renders error banner for LOCKED status", () => {
      render(<PaymentBanner status="LOCKED" />);
      expect(screen.getByText("Account locked.")).toBeTruthy();
    });

    it("shows restriction message for LOCKED", () => {
      render(<PaymentBanner status="LOCKED" />);
      expect(
        screen.getByText(
          "Your access is restricted until payment is received. Please contact the gym owner."
        )
      ).toBeTruthy();
    });

    it("does NOT show 'Pay Now' link for LOCKED status", () => {
      render(<PaymentBanner status="LOCKED" />);
      expect(screen.queryByText("Pay Now")).toBeNull();
    });

    it("renders LOCKED banner regardless of daysIntoGracePeriod value", () => {
      render(
        <PaymentBanner status="LOCKED" daysIntoGracePeriod={5} totalGraceDays={14} />
      );
      expect(screen.getByText("Account locked.")).toBeTruthy();
    });
  });
});
