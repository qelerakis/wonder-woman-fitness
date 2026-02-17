/**
 * ConfirmationModal Unit Tests
 *
 * Tests the reusable confirmation dialog wrapper around Modal.
 * Covers rendering, interactions, loading state, accessibility,
 * focus management, and integration with Modal's keyboard handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ConfirmationModal } from "../ConfirmationModal";

// ===== Helpers =====

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

// ===== Tests =====

describe("ConfirmationModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.style.overflow = "";
  });

  // --- Rendering ---

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

    it("renders the message as a paragraph", () => {
      renderConfirmModal({ message: "All data will be lost." });
      const msg = screen.getByText("All data will be lost.");
      expect(msg.tagName).toBe("P");
    });

    it("uses small modal size", () => {
      renderConfirmModal();
      const dialog = screen.getByRole("dialog");
      expect(dialog.className).toContain("max-w-md");
    });

    it("renders confirm button before cancel button in DOM order", () => {
      renderConfirmModal({ confirmLabel: "Delete" });
      const buttons = screen.getAllByRole("button").filter(
        (btn) => btn.textContent === "Delete" || btn.textContent === "Cancel"
      );
      expect(buttons[0].textContent).toBe("Delete");
      expect(buttons[1].textContent).toBe("Cancel");
    });
  });

  // --- Button styling ---

  describe("button styling", () => {
    it("uses danger variant on the confirm button", () => {
      renderConfirmModal({ confirmLabel: "Delete" });
      const btn = screen.getByText("Delete");
      expect(btn.className).toContain("bg-error-600");
    });

    it("uses ghost variant on the cancel button", () => {
      renderConfirmModal();
      const btn = screen.getByText("Cancel");
      expect(btn.className).toContain("bg-transparent");
    });

    it("uses sm size on both buttons", () => {
      renderConfirmModal({ confirmLabel: "Delete" });
      const confirmBtn = screen.getByText("Delete");
      const cancelBtn = screen.getByText("Cancel");
      expect(confirmBtn.className).toContain("px-3");
      expect(cancelBtn.className).toContain("px-3");
    });
  });

  // --- Interactions ---

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

    it("calls onClose when backdrop overlay is clicked", () => {
      const onClose = vi.fn();
      renderConfirmModal({ onClose });
      const overlay = document.querySelector('[aria-hidden="true"]');
      expect(overlay).toBeTruthy();
      fireEvent.click(overlay!);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when the X close button is clicked", () => {
      const onClose = vi.fn();
      renderConfirmModal({ onClose });
      fireEvent.click(screen.getByLabelText("Close"));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("does not call onConfirm when Cancel is clicked", () => {
      const onConfirm = vi.fn();
      renderConfirmModal({ onConfirm });
      fireEvent.click(screen.getByText("Cancel"));
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it("does not call onClose when confirm button is clicked", () => {
      const onClose = vi.fn();
      renderConfirmModal({ onClose, confirmLabel: "Delete" });
      fireEvent.click(screen.getByText("Delete"));
      // onClose should not be called — only onConfirm
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // --- Loading state ---

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

    it("shows spinner on the confirm button when loading", () => {
      renderConfirmModal({ loading: true, confirmLabel: "Delete" });
      const confirmBtn = screen.getByText("Delete").closest("button");
      // Button component renders Spinner with role="status" when loading
      const spinner = confirmBtn?.querySelector('[role="status"]');
      expect(spinner).toBeTruthy();
    });

    it("does not show spinner on the cancel button when loading", () => {
      renderConfirmModal({ loading: true });
      const cancelBtn = screen.getByText("Cancel").closest("button");
      const spinner = cancelBtn?.querySelector('[role="status"]');
      expect(spinner).toBeNull();
    });

    it("prevents confirm click when loading", () => {
      const onConfirm = vi.fn();
      renderConfirmModal({ loading: true, onConfirm, confirmLabel: "Delete" });
      fireEvent.click(screen.getByText("Delete"));
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it("prevents cancel click when loading", () => {
      const onClose = vi.fn();
      renderConfirmModal({ loading: true, onClose });
      fireEvent.click(screen.getByText("Cancel"));
      // Cancel button is disabled, so onClick doesn't fire
      // But Escape and backdrop still work (via Modal)
      expect(onClose).not.toHaveBeenCalled();
    });

    it("defaults loading to false when not provided", () => {
      renderConfirmModal({ confirmLabel: "Delete" });
      const confirmBtn = screen.getByText("Delete").closest("button");
      const cancelBtn = screen.getByText("Cancel").closest("button");
      expect(confirmBtn?.disabled).toBe(false);
      expect(cancelBtn?.disabled).toBe(false);
    });
  });

  // --- Accessibility (delegated from Modal) ---

  describe("accessibility", () => {
    it("has role=dialog with aria-modal=true", () => {
      renderConfirmModal();
      const dialog = screen.getByRole("dialog");
      expect(dialog.getAttribute("aria-modal")).toBe("true");
    });

    it("has aria-labelledby pointing to the title", () => {
      renderConfirmModal({ title: "Delete Session" });
      const dialog = screen.getByRole("dialog");
      const labelledBy = dialog.getAttribute("aria-labelledby");
      expect(labelledBy).toBeTruthy();
      const titleEl = document.getElementById(labelledBy!);
      expect(titleEl?.textContent).toBe("Delete Session");
    });

    it("locks body scroll when open", () => {
      renderConfirmModal({ isOpen: true });
      expect(document.body.style.overflow).toBe("hidden");
    });

    it("restores body scroll when closed", () => {
      const { rerender } = render(
        <ConfirmationModal
          isOpen={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          title="Test"
          message="msg"
          confirmLabel="OK"
        />
      );
      expect(document.body.style.overflow).toBe("hidden");

      rerender(
        <ConfirmationModal
          isOpen={false}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          title="Test"
          message="msg"
          confirmLabel="OK"
        />
      );
      expect(document.body.style.overflow).toBe("");
    });
  });

  // --- Focus management (delegated from Modal) ---

  describe("focus management", () => {
    it("focuses the dialog on open", () => {
      renderConfirmModal();
      const dialog = screen.getByRole("dialog");
      expect(document.activeElement).toBe(dialog);
    });

    it("restores focus to previously focused element when closed", async () => {
      const React = await import("react");

      function TestWrapper(): React.ReactElement {
        const [isOpen, setIsOpen] = React.useState(false);
        return (
          <div>
            <button data-testid="trigger" onClick={() => setIsOpen(true)}>
              Open
            </button>
            <ConfirmationModal
              isOpen={isOpen}
              onClose={() => setIsOpen(false)}
              onConfirm={vi.fn()}
              title="Confirm"
              message="Sure?"
              confirmLabel="Yes"
            />
          </div>
        );
      }

      render(<TestWrapper />);
      const trigger = screen.getByTestId("trigger");

      act(() => { trigger.focus(); });
      expect(document.activeElement).toBe(trigger);

      fireEvent.click(trigger);
      const dialog = screen.getByRole("dialog");
      expect(document.activeElement).toBe(dialog);

      fireEvent.keyDown(document, { key: "Escape" });
      expect(document.activeElement).toBe(trigger);
    });

    it("traps Tab within the modal", () => {
      renderConfirmModal({ confirmLabel: "Delete" });

      // Get the last button in the dialog (Cancel)
      const cancelBtn = screen.getByText("Cancel");
      act(() => { cancelBtn.focus(); });

      // Tab from last element should wrap to first
      fireEvent.keyDown(document, { key: "Tab" });
      const closeBtn = screen.getByLabelText("Close");
      expect(document.activeElement).toBe(closeBtn);
    });

    it("traps Shift+Tab within the modal", () => {
      renderConfirmModal({ confirmLabel: "Delete" });

      // Focus the first focusable element (Close button)
      const closeBtn = screen.getByLabelText("Close");
      act(() => { closeBtn.focus(); });

      // Shift+Tab from first should wrap to last
      fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
      const cancelBtn = screen.getByText("Cancel");
      expect(document.activeElement).toBe(cancelBtn);
    });
  });

  // --- Open/close transitions ---

  describe("open/close transitions", () => {
    it("renders when toggled from closed to open", () => {
      const { rerender } = render(
        <ConfirmationModal
          isOpen={false}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          title="Test"
          message="msg"
          confirmLabel="OK"
        />
      );
      expect(screen.queryByRole("dialog")).toBeNull();

      rerender(
        <ConfirmationModal
          isOpen={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          title="Test"
          message="msg"
          confirmLabel="OK"
        />
      );
      expect(screen.getByRole("dialog")).toBeDefined();
    });

    it("removes dialog when toggled from open to closed", () => {
      const { rerender } = render(
        <ConfirmationModal
          isOpen={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          title="Test"
          message="msg"
          confirmLabel="OK"
        />
      );
      expect(screen.getByRole("dialog")).toBeDefined();

      rerender(
        <ConfirmationModal
          isOpen={false}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          title="Test"
          message="msg"
          confirmLabel="OK"
        />
      );
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  // --- Props rendering ---

  describe("props rendering", () => {
    it("renders different titles correctly", () => {
      const { rerender } = render(
        <ConfirmationModal
          isOpen={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          title="Cancel Session"
          message="msg"
          confirmLabel="OK"
        />
      );
      expect(screen.getByText("Cancel Session")).toBeDefined();

      rerender(
        <ConfirmationModal
          isOpen={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          title="Delete Session"
          message="msg"
          confirmLabel="OK"
        />
      );
      expect(screen.getByText("Delete Session")).toBeDefined();
    });

    it("renders different messages correctly", () => {
      renderConfirmModal({
        message: "Cancel this session? All assigned members will be notified.",
      });
      expect(
        screen.getByText(
          "Cancel this session? All assigned members will be notified."
        )
      ).toBeDefined();
    });

    it("renders different confirm labels correctly", () => {
      renderConfirmModal({ confirmLabel: "Cancel Session" });
      expect(screen.getByText("Cancel Session")).toBeDefined();
    });
  });
});
