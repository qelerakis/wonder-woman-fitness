import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmationModal } from "../ConfirmationModal";

function renderConfirmModal(
  props: Partial<React.ComponentProps<typeof ConfirmationModal>> = {}
): ReturnType<typeof render> {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    title: "Confirm Action",
    message: "Are you sure?",
    confirmLabel: "Confirm",
  };
  return render(<ConfirmationModal {...defaultProps} {...props} />);
}

describe("ConfirmationModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders the modal with title and message when open", () => {
      renderConfirmModal({
        title: "Delete Item",
        message: "This cannot be undone.",
      });
      expect(screen.getByRole("dialog")).toBeDefined();
      expect(screen.getByText("Delete Item")).toBeDefined();
      expect(screen.getByText("This cannot be undone.")).toBeDefined();
    });

    it("does not render when isOpen is false", () => {
      renderConfirmModal({ isOpen: false });
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("renders the confirm button with the given label", () => {
      renderConfirmModal({ confirmLabel: "Delete Forever" });
      expect(screen.getByText("Delete Forever")).toBeDefined();
    });

    it("renders a Cancel button", () => {
      renderConfirmModal();
      expect(screen.getByText("Cancel")).toBeDefined();
    });
  });

  describe("confirm variant", () => {
    it("defaults to danger variant on the confirm button", () => {
      renderConfirmModal({ confirmLabel: "Delete" });
      const btn = screen.getByText("Delete");
      expect(btn.className).toContain("bg-error-600");
    });

    it("applies danger classes to the confirm button", () => {
      renderConfirmModal({ confirmLabel: "Proceed", confirmVariant: "danger" });
      const btn = screen.getByText("Proceed");
      expect(btn.className).toContain("bg-error-600");
    });
  });

  describe("interactions", () => {
    it("calls onConfirm when the confirm button is clicked", () => {
      const onConfirm = vi.fn();
      renderConfirmModal({ onConfirm, confirmLabel: "Delete" });
      fireEvent.click(screen.getByText("Delete"));
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when the Cancel button is clicked", () => {
      const onClose = vi.fn();
      renderConfirmModal({ onClose });
      fireEvent.click(screen.getByText("Cancel"));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when Escape is pressed", () => {
      const onClose = vi.fn();
      renderConfirmModal({ onClose });
      fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("loading state", () => {
    it("disables both buttons when loading is true", () => {
      renderConfirmModal({ loading: true, confirmLabel: "Delete" });
      const confirmBtn = screen.getByText("Delete").closest("button");
      const cancelBtn = screen.getByText("Cancel").closest("button");
      expect(confirmBtn?.disabled).toBe(true);
      expect(cancelBtn?.disabled).toBe(true);
    });

    it("does not disable buttons when loading is false", () => {
      renderConfirmModal({ loading: false, confirmLabel: "Delete" });
      const confirmBtn = screen.getByText("Delete").closest("button");
      const cancelBtn = screen.getByText("Cancel").closest("button");
      expect(confirmBtn?.disabled).toBe(false);
      expect(cancelBtn?.disabled).toBe(false);
    });
  });
});
