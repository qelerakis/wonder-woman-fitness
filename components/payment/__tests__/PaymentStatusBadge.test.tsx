/**
 * PaymentStatusBadge Unit Tests
 *
 * Tests rendering of correct label and variant for each
 * PaymentStatus value. Verifies that TRIAL is NOT a valid
 * PaymentStatus (removed in trial-is-grace-period feature).
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PaymentStatusBadge } from "../PaymentStatusBadge";
import { PAYMENT_STATUSES } from "@/lib/constants";
import type { PaymentStatus } from "@/lib/constants";

// ===== Tests =====

describe("PaymentStatusBadge", () => {
  // ----- Individual status rendering -----

  it("renders 'Paid' with success variant for PAID", () => {
    render(<PaymentStatusBadge status="PAID" />);
    const badge = screen.getByText("Paid");
    expect(badge).toBeTruthy();
    expect(badge.className).toContain("success");
  });

  it("renders 'Grace Period' with warning variant for GRACE_PERIOD", () => {
    render(<PaymentStatusBadge status="GRACE_PERIOD" />);
    const badge = screen.getByText("Grace Period");
    expect(badge).toBeTruthy();
    expect(badge.className).toContain("warning");
  });

  it("renders 'Locked' with error variant for LOCKED", () => {
    render(<PaymentStatusBadge status="LOCKED" />);
    const badge = screen.getByText("Locked");
    expect(badge).toBeTruthy();
    expect(badge.className).toContain("error");
  });

  it("renders 'Override' with primary variant for OVERRIDE", () => {
    render(<PaymentStatusBadge status="OVERRIDE" />);
    const badge = screen.getByText("Override");
    expect(badge).toBeTruthy();
    expect(badge.className).toContain("primary");
  });

  it("renders 'Departed' with default variant for DEPARTED", () => {
    render(<PaymentStatusBadge status="DEPARTED" />);
    const badge = screen.getByText("Departed");
    expect(badge).toBeTruthy();
    // default variant uses surface classes
    expect(badge.className).toContain("surface");
  });

  // ----- Size prop -----

  it("renders small size by default", () => {
    render(<PaymentStatusBadge status="PAID" />);
    const badge = screen.getByText("Paid");
    expect(badge.className).toContain("text-xs");
  });

  it("renders medium size when size='md'", () => {
    render(<PaymentStatusBadge status="PAID" size="md" />);
    const badge = screen.getByText("Paid");
    expect(badge.className).toContain("text-sm");
  });

  // ----- TRIAL is NOT a PaymentStatus -----

  it("PAYMENT_STATUSES does NOT include TRIAL", () => {
    const statuses = Object.keys(PAYMENT_STATUSES);
    expect(statuses).not.toContain("TRIAL");
  });

  it("PAYMENT_STATUSES contains exactly 5 statuses", () => {
    const statuses = Object.keys(PAYMENT_STATUSES);
    expect(statuses).toHaveLength(5);
    expect(statuses).toEqual(
      expect.arrayContaining([
        "PAID",
        "GRACE_PERIOD",
        "LOCKED",
        "OVERRIDE",
        "DEPARTED",
      ])
    );
  });

  // ----- All statuses render correctly -----

  it("renders a badge for every PaymentStatus value", () => {
    const allStatuses: PaymentStatus[] = [
      "PAID",
      "GRACE_PERIOD",
      "LOCKED",
      "OVERRIDE",
      "DEPARTED",
    ];

    for (const status of allStatuses) {
      const { unmount } = render(<PaymentStatusBadge status={status} />);
      // Should render without throwing
      expect(screen.getByText(/.+/)).toBeTruthy();
      unmount();
    }
  });

  // ----- Renders as inline element -----

  it("renders as a span element (inline badge)", () => {
    render(<PaymentStatusBadge status="PAID" />);
    const badge = screen.getByText("Paid");
    expect(badge.tagName).toBe("SPAN");
  });

  it("has rounded-full class for pill shape", () => {
    render(<PaymentStatusBadge status="GRACE_PERIOD" />);
    const badge = screen.getByText("Grace Period");
    expect(badge.className).toContain("rounded-full");
  });
});
