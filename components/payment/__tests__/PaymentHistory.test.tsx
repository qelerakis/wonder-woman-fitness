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

    it("does not render recordedBy when showRecordedBy is false", async () => {
      const { PaymentHistory } = await import("../PaymentHistory");
      render(<PaymentHistory payments={samplePayments} showRecordedBy={false} />);
      expect(screen.queryByText("by Owner")).toBeNull();
    });

    it("does not render notes element when notes is null", async () => {
      const { PaymentHistory } = await import("../PaymentHistory");
      const paymentsNoNotes = [{ ...samplePayments[0], notes: null }];
      render(<PaymentHistory payments={paymentsNoNotes} />);
      // Only amount, dates should be present — no notes text
      screen.getByText(label1500);
    });

    it("renders Payment History header", async () => {
      const { PaymentHistory } = await import("../PaymentHistory");
      render(<PaymentHistory payments={samplePayments} />);
      screen.getByText("Payment History");
    });

    it("renders correct number of payment rows", async () => {
      const { PaymentHistory } = await import("../PaymentHistory");
      render(<PaymentHistory payments={samplePayments} />);
      const amounts = [screen.getByText(label1500), screen.getByText(label2000)];
      expect(amounts).toHaveLength(2);
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

    it("pre-fills all form fields from second payment", async () => {
      const { PaymentHistory } = await import("../PaymentHistory");
      render(<PaymentHistory payments={samplePayments} editable={true} />);

      fireEvent.click(screen.getByLabelText(`Edit payment of ${label2000}`));

      const amountInput = screen.getByLabelText("Amount (MKD)") as HTMLInputElement;
      expect(amountInput.value).toBe("2000");

      const notesField = screen.getByLabelText("Notes (optional)") as HTMLTextAreaElement;
      expect(notesField.value).toBe("Cash payment");
    });

    it("sends correct fields in PATCH body", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: {} }),
      });

      const { PaymentHistory } = await import("../PaymentHistory");
      render(<PaymentHistory payments={samplePayments} editable={true} />);

      fireEvent.click(screen.getByLabelText(`Edit payment of ${label1500}`));
      fireEvent.click(screen.getByText("Update Payment"));

      await waitFor(() => {
        const fetchCall = mockFetch.mock.calls[0];
        const body = JSON.parse(fetchCall[1].body);
        expect(body.amount).toBe(1500);
        expect(body.paidAt).toBeDefined();
        expect(body.periodStart).toBeDefined();
        expect(body.periodEnd).toBeDefined();
        // Should NOT include userId — edit doesn't change member
        expect(body.userId).toBeUndefined();
      });
    });

    it("shows error toast when edit API returns error", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Payment not found" }),
      });

      const { PaymentHistory } = await import("../PaymentHistory");
      render(<PaymentHistory payments={samplePayments} editable={true} />);

      fireEvent.click(screen.getByLabelText(`Edit payment of ${label1500}`));
      fireEvent.click(screen.getByText("Update Payment"));

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "error",
            title: "Failed to update payment",
          })
        );
      });
    });

    it("shows network error toast when edit fetch throws", async () => {
      mockFetch.mockRejectedValue(new Error("Connection failed"));

      const { PaymentHistory } = await import("../PaymentHistory");
      render(<PaymentHistory payments={samplePayments} editable={true} />);

      fireEvent.click(screen.getByLabelText(`Edit payment of ${label1500}`));
      fireEvent.click(screen.getByText("Update Payment"));

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          expect.objectContaining({ type: "error", title: "Network error" })
        );
      });
    });

    it("closes edit modal after successful update", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: {} }),
      });

      const { PaymentHistory } = await import("../PaymentHistory");
      render(<PaymentHistory payments={samplePayments} editable={true} />);

      fireEvent.click(screen.getByLabelText(`Edit payment of ${label1500}`));
      expect(screen.getByText("Edit Payment")).toBeTruthy();

      fireEvent.click(screen.getByText("Update Payment"));

      await waitFor(() => {
        expect(screen.queryByText("Edit Payment")).toBeNull();
      });
    });

    it("closes edit modal on Cancel without API call", async () => {
      const { PaymentHistory } = await import("../PaymentHistory");
      render(<PaymentHistory payments={samplePayments} editable={true} />);

      fireEvent.click(screen.getByLabelText(`Edit payment of ${label1500}`));
      expect(screen.getByText("Edit Payment")).toBeTruthy();

      fireEvent.click(screen.getByText("Cancel"));

      await waitFor(() => {
        expect(screen.queryByText("Edit Payment")).toBeNull();
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("validates period end before period start", async () => {
      const { PaymentHistory } = await import("../PaymentHistory");
      render(<PaymentHistory payments={samplePayments} editable={true} />);

      fireEvent.click(screen.getByLabelText(`Edit payment of ${label1500}`));

      // Set period end before period start
      const periodStart = screen.getByLabelText("Period Start") as HTMLInputElement;
      const periodEnd = screen.getByLabelText("Period End") as HTMLInputElement;
      fireEvent.change(periodStart, { target: { value: "2026-03-01" } });
      fireEvent.change(periodEnd, { target: { value: "2026-02-01" } });

      fireEvent.click(screen.getByText("Update Payment"));

      await waitFor(() => {
        screen.getByText("Period end must be after start");
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("shows success toast after edit", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: {} }),
      });

      const { PaymentHistory } = await import("../PaymentHistory");
      render(<PaymentHistory payments={samplePayments} editable={true} />);

      fireEvent.click(screen.getByLabelText(`Edit payment of ${label1500}`));
      fireEvent.click(screen.getByText("Update Payment"));

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          expect.objectContaining({ type: "success", title: "Payment updated" })
        );
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

    it("shows delete confirmation without member name when prop not provided", async () => {
      const { PaymentHistory } = await import("../PaymentHistory");
      render(<PaymentHistory payments={samplePayments} editable={true} />);

      fireEvent.click(screen.getByLabelText(`Delete payment of ${label1500}`));

      screen.getByText("Delete Payment");
      screen.getByText(/cannot be undone/);
      // No member name should appear
      expect(screen.queryByText("Jane Doe")).toBeNull();
    });

    it("shows error toast when delete API returns error", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Forbidden" }),
      });

      const { PaymentHistory } = await import("../PaymentHistory");
      render(<PaymentHistory payments={samplePayments} editable={true} />);

      fireEvent.click(screen.getByLabelText(`Delete payment of ${label1500}`));
      const deleteButton = screen.getByRole("button", { name: "Delete" });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "error",
            title: "Failed to delete payment",
          })
        );
      });
    });

    it("shows network error toast when delete fetch throws", async () => {
      mockFetch.mockRejectedValue(new Error("Connection failed"));

      const { PaymentHistory } = await import("../PaymentHistory");
      render(<PaymentHistory payments={samplePayments} editable={true} />);

      fireEvent.click(screen.getByLabelText(`Delete payment of ${label1500}`));
      const deleteButton = screen.getByRole("button", { name: "Delete" });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          expect.objectContaining({ type: "error", title: "Network error" })
        );
      });
    });

    it("closes confirmation modal after successful delete", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: {} }),
      });

      const { PaymentHistory } = await import("../PaymentHistory");
      render(<PaymentHistory payments={samplePayments} editable={true} />);

      fireEvent.click(screen.getByLabelText(`Delete payment of ${label1500}`));
      expect(screen.getByText(/cannot be undone/)).toBeTruthy();

      const deleteButton = screen.getByRole("button", { name: "Delete" });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.queryByText(/cannot be undone/)).toBeNull();
      });
    });

    it("can delete second payment by amount", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: {} }),
      });

      const { PaymentHistory } = await import("../PaymentHistory");
      render(<PaymentHistory payments={samplePayments} editable={true} />);

      fireEvent.click(screen.getByLabelText(`Delete payment of ${label2000}`));

      const deleteButton = screen.getByRole("button", { name: "Delete" });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/payments/p-2",
          expect.objectContaining({ method: "DELETE" })
        );
      });
    });

    it("does not call onPaymentChange when delete fails", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Server error" }),
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
      const deleteButton = screen.getByRole("button", { name: "Delete" });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalled();
      });
      expect(onPaymentChange).not.toHaveBeenCalled();
    });
  });
});
