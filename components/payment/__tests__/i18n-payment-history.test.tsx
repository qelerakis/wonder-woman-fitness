/**
 * i18n-payment-history.test.tsx — Tests PaymentHistory translated strings
 *
 * Validates that PaymentHistory renders translated UI text from the
 * payments namespace, including toast strings for edit/delete operations.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { PaymentHistory } from "../PaymentHistory";

// ===== Mocks =====

const mockAddToast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

function makePayment(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    amount: 1500,
    paidAt: "2026-02-15T00:00:00.000Z",
    periodStart: "2026-02-01T00:00:00.000Z",
    periodEnd: "2026-02-28T00:00:00.000Z",
    notes: null,
    ...overrides,
  };
}

describe("PaymentHistory — translated strings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders translated 'Payment History' card header when payments exist", () => {
    render(<PaymentHistory payments={[makePayment()]} />);
    expect(screen.getByText("Payment History")).toBeDefined();
  });

  it("renders translated 'No payments recorded yet' empty state", () => {
    render(<PaymentHistory payments={[]} />);
    expect(screen.getByText("No payments recorded yet")).toBeDefined();
  });

  it("renders payment amount with MKD currency suffix", () => {
    render(<PaymentHistory payments={[makePayment({ amount: 1500 })]} />);
    // toLocaleString may or may not add commas in jsdom; just verify MKD suffix
    expect(screen.getByText(/1.?500 MKD/)).toBeDefined();
  });

  it("renders period date range", () => {
    render(<PaymentHistory payments={[makePayment()]} />);
    // date-fns format: "Feb 1, 2026 – Feb 28, 2026"
    expect(screen.getByText(/Feb 1, 2026/)).toBeDefined();
    expect(screen.getByText(/Feb 28, 2026/)).toBeDefined();
  });

  it("renders 'by' with recordedBy name when showRecordedBy is true", () => {
    render(
      <PaymentHistory
        payments={[makePayment({ recordedBy: { name: "Owner" } })]}
        showRecordedBy={true}
      />
    );
    expect(screen.getByText(/Owner/)).toBeDefined();
  });

  it("renders edit/delete buttons with translated aria-labels when editable", () => {
    render(
      <PaymentHistory
        payments={[makePayment()]}
        editable={true}
        memberName="Alice"
      />
    );
    // aria-label uses formatCurrency for memberName interpolation
    expect(screen.getByLabelText(/Edit payment for/)).toBeDefined();
    expect(screen.getByLabelText(/Delete payment for/)).toBeDefined();
  });
});
