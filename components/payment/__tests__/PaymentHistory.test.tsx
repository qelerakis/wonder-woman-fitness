/**
 * PaymentHistory Unit Tests
 *
 * Tests rendering, edit flow (modal, PATCH, validation),
 * and delete flow (confirmation, DELETE, toast) for the
 * PaymentHistory component.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ===== Mocks =====

const mockAddToast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// ===== Helpers =====

/** Mirrors the formatCurrency helper inside PaymentHistory */
function fmtCurrency(amount: number): string {
  return `${amount.toLocaleString()} MKD`;
}

// ===== Test Data =====

const samplePayments = [
  {
    id: "p-1",
    amount: 1500,
    paidAt: "2026-02-05T10:00:00.000Z",
    periodStart: "2026-02-01",
    periodEnd: "2026-02-28",
    notes: null,
    recordedBy: { name: "Owner" },
  },
  {
    id: "p-2",
    amount: 2000,
    paidAt: "2026-01-05T10:00:00.000Z",
    periodStart: "2026-01-01",
    periodEnd: "2026-01-31",
    notes: "Cash payment",
    recordedBy: { name: "Owner" },
  },
];

// Pre-compute formatted labels (jsdom locale may differ from browser)
const label1500 = fmtCurrency(1500);
const label2000 = fmtCurrency(2000);

// ===== Tests =====

describe("PaymentHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ----- Rendering -----

  describe("rendering", () => {
    it("shows empty state when no payments", async () => {
      const { PaymentHistory } = await import("../PaymentHistory");
      render(<PaymentHistory payments={[]} />);
      screen.getByText("No payments recorded yet");
    });

    it("renders payment amounts", async () => {
      const { PaymentHistory } = await import("../PaymentHistory");
      render(<PaymentHistory payments={samplePayments} />);
      screen.getByText(label1500);
      screen.getByText(label2000);
    });

    it("renders notes when present", async () => {
      const { PaymentHistory } = await import("../PaymentHistory");
      render(<PaymentHistory payments={samplePayments} />);
      screen.getByText("Cash payment");
    });

    it("renders recordedBy when showRecordedBy is true", async () => {
      const { PaymentHistory } = await import("../PaymentHistory");
      render(
        <PaymentHistory payments={samplePayments} showRecordedBy={true} />
      );
      const byOwnerElements = screen.getAllByText("by Owner");
      expect(byOwnerElements.length).toBe(2);
    });

    it("does not render action buttons when editable is false", async () => {
      const { PaymentHistory } = await import("../PaymentHistory");
      render(<PaymentHistory payments={samplePayments} editable={false} />);
      expect(
        screen.queryByLabelText(`Edit payment of ${label1500}`)
      ).toBeNull();
      expect(
        screen.queryByLabelText(`Delete payment of ${label1500}`)
      ).toBeNull();
    });

    it("renders action buttons when editable is true", async () => {
      const { PaymentHistory } = await import("../PaymentHistory");
      render(<PaymentHistory payments={samplePayments} editable={true} />);
      screen.getByLabelText(`Edit payment of ${label1500}`);
      screen.getByLabelText(`Delete payment of ${label1500}`);
      screen.getByLabelText(`Edit payment of ${label2000}`);
      screen.getByLabelText(`Delete payment of ${label2000}`);
    });
  });

  // ----- Edit Flow -----

  describe("edit flow", () => {
    it("opens edit modal with pre-filled data", async () => {
      const { PaymentHistory } = await import("../PaymentHistory");
      render(<PaymentHistory payments={samplePayments} editable={true} />);

      fireEvent.click(screen.getByLabelText(`Edit payment of ${label1500}`));

      // Modal title
      screen.getByText("Edit Payment");
      // Submit button
      screen.getByText("Update Payment");
      // Amount field should have the value pre-filled
      const amountInput = screen.getByLabelText("Amount (MKD)") as HTMLInputElement;
      expect(amountInput.value).toBe("1500");
    });

    it("submits PATCH request on edit", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: {} }),
      });

      const onPaymentChange = vi.fn();
      const { PaymentHistory } = await import("../PaymentHistory");
      render(
        <PaymentHistory
          payments={samplePayments}
          editable={true}
          onPaymentChange={onPaymentChange}
        />
      );

      fireEvent.click(screen.getByLabelText(`Edit payment of ${label1500}`));

      // Submit the form
      fireEvent.click(screen.getByText("Update Payment"));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/payments/p-1",
          expect.objectContaining({ method: "PATCH" })
        );
      });

      await waitFor(() => {
        expect(onPaymentChange).toHaveBeenCalled();
      });
    });

    it("shows validation error for empty amount", async () => {
      const { PaymentHistory } = await import("../PaymentHistory");
      render(<PaymentHistory payments={samplePayments} editable={true} />);

      fireEvent.click(screen.getByLabelText(`Edit payment of ${label1500}`));

      // Clear the amount field
      const amountInput = screen.getByLabelText("Amount (MKD)") as HTMLInputElement;
      fireEvent.change(amountInput, { target: { value: "" } });

      // Submit
      fireEvent.click(screen.getByText("Update Payment"));

      await waitFor(() => {
        screen.getByText("Amount must be a positive number");
      });
    });
  });

  // ----- Delete Flow -----

  describe("delete flow", () => {
    it("opens delete confirmation modal", async () => {
      const { PaymentHistory } = await import("../PaymentHistory");
      render(
        <PaymentHistory
          payments={samplePayments}
          editable={true}
          memberName="Jane Doe"
        />
      );

      fireEvent.click(screen.getByLabelText(`Delete payment of ${label1500}`));

      screen.getByText("Delete Payment");
      screen.getByText(/cannot be undone/);
      screen.getByText("Jane Doe");
    });

    it("closes on Cancel", async () => {
      const { PaymentHistory } = await import("../PaymentHistory");
      render(<PaymentHistory payments={samplePayments} editable={true} />);

      fireEvent.click(screen.getByLabelText(`Delete payment of ${label1500}`));

      // Confirm the modal is open
      screen.getByText("Delete Payment");

      // Click Cancel
      fireEvent.click(screen.getByText("Cancel"));

      // Modal should be closed
      await waitFor(() => {
        expect(screen.queryByText("Delete Payment")).toBeNull();
      });
    });

    it("sends DELETE request on confirm", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: {} }),
      });

      const onPaymentChange = vi.fn();
      const { PaymentHistory } = await import("../PaymentHistory");
      render(
        <PaymentHistory
          payments={samplePayments}
          editable={true}
          onPaymentChange={onPaymentChange}
        />
      );

      fireEvent.click(screen.getByLabelText(`Delete payment of ${label1500}`));

      // Click the Delete button in the modal (not the icon button)
      const deleteButton = screen.getByRole("button", { name: "Delete" });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/payments/p-1",
          expect.objectContaining({ method: "DELETE" })
        );
      });

      await waitFor(() => {
        expect(onPaymentChange).toHaveBeenCalled();
      });
    });

    it("shows success toast after delete", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: {} }),
      });

      const { PaymentHistory } = await import("../PaymentHistory");
      render(<PaymentHistory payments={samplePayments} editable={true} />);

      fireEvent.click(screen.getByLabelText(`Delete payment of ${label1500}`));

      const deleteButton = screen.getByRole("button", { name: "Delete" });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "success",
            title: "Payment deleted",
          })
        );
      });
    });
  });
});
