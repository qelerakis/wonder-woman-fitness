/**
 * Modal Unit Tests
 *
 * Tests focus management, keyboard handling, accessibility,
 * and critically: that typing in inputs inside modals works
 * without focus being stolen on every keystroke.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Modal } from "../Modal";

// ===== Helpers =====

function renderModal(
  props: Partial<React.ComponentProps<typeof Modal>> = {}
): ReturnType<typeof render> {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    title: "Test Modal",
    children: <p>Modal content</p>,
  };
  return render(<Modal {...defaultProps} {...props} />);
}

// ===== Tests =====

describe("Modal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore body overflow
    document.body.style.overflow = "";
  });

  // --- Rendering ---

  describe("rendering", () => {
    it("renders when isOpen is true", () => {
      renderModal({ isOpen: true });
      expect(screen.getByRole("dialog")).toBeDefined();
      expect(screen.getByText("Test Modal")).toBeDefined();
      expect(screen.getByText("Modal content")).toBeDefined();
    });

    it("does not render when isOpen is false", () => {
      renderModal({ isOpen: false });
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("renders title in the header", () => {
      renderModal({ title: "My Custom Title" });
      expect(screen.getByText("My Custom Title")).toBeDefined();
    });

    it("renders children in the body", () => {
      renderModal({
        children: <button>Click me</button>,
      });
      expect(screen.getByText("Click me")).toBeDefined();
    });

    it("renders close button with aria-label", () => {
      renderModal();
      const closeBtn = screen.getByLabelText("Close");
      expect(closeBtn).toBeDefined();
    });
  });

  // --- Accessibility ---

  describe("accessibility", () => {
    it("has role=dialog with aria-modal=true", () => {
      renderModal();
      const dialog = screen.getByRole("dialog");
      expect(dialog.getAttribute("aria-modal")).toBe("true");
    });

    it("has aria-labelledby pointing to the title", () => {
      renderModal({ title: "Accessible Title" });
      const dialog = screen.getByRole("dialog");
      const labelledBy = dialog.getAttribute("aria-labelledby");
      expect(labelledBy).toBeTruthy();
      const titleEl = document.getElementById(labelledBy!);
      expect(titleEl?.textContent).toBe("Accessible Title");
    });

    it("locks body scroll when open", () => {
      renderModal({ isOpen: true });
      expect(document.body.style.overflow).toBe("hidden");
    });

    it("restores body scroll when closed", () => {
      const { rerender } = render(
        <Modal isOpen={true} onClose={vi.fn()} title="Test">
          content
        </Modal>
      );
      expect(document.body.style.overflow).toBe("hidden");

      rerender(
        <Modal isOpen={false} onClose={vi.fn()} title="Test">
          content
        </Modal>
      );
      expect(document.body.style.overflow).toBe("");
    });
  });

  // --- Size variants ---

  describe("size variants", () => {
    it("applies max-w-lg for default (md) size", () => {
      renderModal();
      const dialog = screen.getByRole("dialog");
      expect(dialog.className).toContain("max-w-lg");
    });

    it("applies max-w-md for sm size", () => {
      renderModal({ size: "sm" });
      const dialog = screen.getByRole("dialog");
      expect(dialog.className).toContain("max-w-md");
    });

    it("applies max-w-2xl for lg size", () => {
      renderModal({ size: "lg" });
      const dialog = screen.getByRole("dialog");
      expect(dialog.className).toContain("max-w-2xl");
    });
  });

  // --- Close behavior ---

  describe("close behavior", () => {
    it("calls onClose when close button is clicked", () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      fireEvent.click(screen.getByLabelText("Close"));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when backdrop overlay is clicked", () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      // The overlay is the div with aria-hidden="true"
      const overlay = document.querySelector('[aria-hidden="true"]');
      expect(overlay).toBeTruthy();
      fireEvent.click(overlay!);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when Escape key is pressed", () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // --- Focus management ---

  describe("focus management", () => {
    it("focuses the dialog element on initial open", () => {
      renderModal({ isOpen: true });
      const dialog = screen.getByRole("dialog");
      expect(document.activeElement).toBe(dialog);
    });

    it("does NOT steal focus from input on re-render (root cause fix)", async () => {
      // This is THE critical test — the bug was that typing in an input
      // triggered re-render → useEffect → dialogRef.focus() → lost focus
      function TestForm(): React.ReactElement {
        const [isOpen, setIsOpen] = React.useState(true);
        const [value, setValue] = React.useState("");
        return (
          <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Form">
            <input
              data-testid="test-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </Modal>
        );
      }

      // Need React for the test component
      const React = await import("react");
      render(<TestForm />);

      const input = screen.getByTestId("test-input");

      // Focus the input (simulates user clicking into it)
      act(() => {
        input.focus();
      });
      expect(document.activeElement).toBe(input);

      // Type a character — this triggers state change → re-render
      fireEvent.change(input, { target: { value: "H" } });

      // CRITICAL: focus should still be on the input, not stolen by dialog
      expect(document.activeElement).toBe(input);

      // Type more characters
      fireEvent.change(input, { target: { value: "He" } });
      expect(document.activeElement).toBe(input);

      fireEvent.change(input, { target: { value: "Hel" } });
      expect(document.activeElement).toBe(input);

      fireEvent.change(input, { target: { value: "Hello" } });
      expect(document.activeElement).toBe(input);

      // Verify value was set correctly
      expect((input as HTMLInputElement).value).toBe("Hello");
    });

    it("does NOT steal focus when parent re-renders with new onClose", async () => {
      // Tests that changing onClose (inline arrow function) doesn't steal focus
      const React = await import("react");

      function TestComponent(): React.ReactElement {
        const [count, setCount] = React.useState(0);
        return (
          <Modal
            isOpen={true}
            onClose={() => {
              // This creates a new function reference each render
              console.log("close", count);
            }}
            title="Test"
          >
            <input data-testid="counter-input" />
            <button onClick={() => setCount((c) => c + 1)}>Increment</button>
          </Modal>
        );
      }

      render(<TestComponent />);

      const input = screen.getByTestId("counter-input");
      act(() => {
        input.focus();
      });
      expect(document.activeElement).toBe(input);

      // Click button to trigger re-render with new onClose
      fireEvent.click(screen.getByText("Increment"));

      // Focus should still be on the input
      expect(document.activeElement).toBe(input);
    });

    it("restores focus to previously focused element when closed", async () => {
      const React = await import("react");

      function TestComponent(): React.ReactElement {
        const [isOpen, setIsOpen] = React.useState(false);
        return (
          <div>
            <button data-testid="trigger" onClick={() => setIsOpen(true)}>
              Open
            </button>
            <Modal
              isOpen={isOpen}
              onClose={() => setIsOpen(false)}
              title="Test"
            >
              <p>Content</p>
            </Modal>
          </div>
        );
      }

      render(<TestComponent />);

      const trigger = screen.getByTestId("trigger");
      act(() => {
        trigger.focus();
      });
      expect(document.activeElement).toBe(trigger);

      // Open modal
      fireEvent.click(trigger);

      // Dialog should be focused
      const dialog = screen.getByRole("dialog");
      expect(document.activeElement).toBe(dialog);

      // Close via Escape
      fireEvent.keyDown(document, { key: "Escape" });

      // Focus should return to the trigger button
      expect(document.activeElement).toBe(trigger);
    });
  });

  // --- Focus trap ---

  describe("focus trap", () => {
    it("traps Tab forward: wraps from last to first element", () => {
      renderModal({
        children: (
          <div>
            <input data-testid="first-input" />
            <button data-testid="last-button">Submit</button>
          </div>
        ),
      });

      const lastButton = screen.getByTestId("last-button");
      act(() => {
        lastButton.focus();
      });

      fireEvent.keyDown(document, { key: "Tab" });

      // Should wrap to first focusable element (close button or first-input)
      // The close button is the first focusable element in the dialog
      const closeBtn = screen.getByLabelText("Close");
      expect(document.activeElement).toBe(closeBtn);
    });

    it("traps Shift+Tab backward: wraps from first to last element", () => {
      renderModal({
        children: (
          <div>
            <input data-testid="first-input" />
            <button data-testid="last-button">Submit</button>
          </div>
        ),
      });

      // Close button is the first focusable element in the dialog
      const closeBtn = screen.getByLabelText("Close");
      act(() => {
        closeBtn.focus();
      });

      fireEvent.keyDown(document, { key: "Tab", shiftKey: true });

      const lastButton = screen.getByTestId("last-button");
      expect(document.activeElement).toBe(lastButton);
    });

    it("does not trap Tab when focus is in the middle of elements", () => {
      renderModal({
        children: (
          <div>
            <input data-testid="input-1" />
            <input data-testid="input-2" />
            <button data-testid="button-3">Submit</button>
          </div>
        ),
      });

      const input1 = screen.getByTestId("input-1");
      act(() => {
        input1.focus();
      });

      // Tab from middle element should NOT be prevented
      const tabEvent = new KeyboardEvent("keydown", {
        key: "Tab",
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(tabEvent, "preventDefault");
      document.dispatchEvent(tabEvent);

      // Should not prevent default (let browser handle normal tab)
      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });
  });

  // --- Typing in form inputs (integration tests) ---

  describe("typing in form inputs", () => {
    it("allows continuous typing in a text input without focus loss", async () => {
      const React = await import("react");

      function FormModal(): React.ReactElement {
        const [isOpen] = React.useState(true);
        const [name, setName] = React.useState("");
        return (
          <Modal isOpen={isOpen} onClose={vi.fn()} title="Form">
            <input
              data-testid="name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter name"
            />
          </Modal>
        );
      }

      render(<FormModal />);
      const input = screen.getByTestId("name-input");

      act(() => {
        input.focus();
      });

      // Simulate typing "John Doe" character by character
      const chars = "John Doe";
      let accumulated = "";
      for (const char of chars) {
        accumulated += char;
        fireEvent.change(input, { target: { value: accumulated } });
        // After EACH character, focus must remain on input
        expect(document.activeElement).toBe(input);
      }

      expect((input as HTMLInputElement).value).toBe("John Doe");
    });

    it("allows typing in number input without focus loss", async () => {
      const React = await import("react");

      function AmountModal(): React.ReactElement {
        const [isOpen] = React.useState(true);
        const [amount, setAmount] = React.useState("");
        return (
          <Modal isOpen={isOpen} onClose={vi.fn()} title="Payment">
            <input
              data-testid="amount-input"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Modal>
        );
      }

      render(<AmountModal />);
      const input = screen.getByTestId("amount-input");

      act(() => {
        input.focus();
      });

      fireEvent.change(input, { target: { value: "1" } });
      expect(document.activeElement).toBe(input);

      fireEvent.change(input, { target: { value: "15" } });
      expect(document.activeElement).toBe(input);

      fireEvent.change(input, { target: { value: "150" } });
      expect(document.activeElement).toBe(input);

      fireEvent.change(input, { target: { value: "1500" } });
      expect(document.activeElement).toBe(input);

      expect((input as HTMLInputElement).value).toBe("1500");
    });

    it("allows typing in textarea without focus loss", async () => {
      const React = await import("react");

      function NotesModal(): React.ReactElement {
        const [isOpen] = React.useState(true);
        const [notes, setNotes] = React.useState("");
        return (
          <Modal isOpen={isOpen} onClose={vi.fn()} title="Notes">
            <textarea
              data-testid="notes-textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Modal>
        );
      }

      render(<NotesModal />);
      const textarea = screen.getByTestId("notes-textarea");

      act(() => {
        textarea.focus();
      });

      const text = "These are my notes about the session";
      let accumulated = "";
      for (const char of text) {
        accumulated += char;
        fireEvent.change(textarea, { target: { value: accumulated } });
        expect(document.activeElement).toBe(textarea);
      }

      expect((textarea as HTMLTextAreaElement).value).toBe(text);
    });

    it("allows typing in multiple inputs sequentially", async () => {
      const React = await import("react");

      function MultiInputModal(): React.ReactElement {
        const [isOpen] = React.useState(true);
        const [field1, setField1] = React.useState("");
        const [field2, setField2] = React.useState("");
        return (
          <Modal isOpen={isOpen} onClose={vi.fn()} title="Multi">
            <input
              data-testid="field-1"
              value={field1}
              onChange={(e) => setField1(e.target.value)}
            />
            <input
              data-testid="field-2"
              value={field2}
              onChange={(e) => setField2(e.target.value)}
            />
          </Modal>
        );
      }

      render(<MultiInputModal />);

      // Type in first input
      const input1 = screen.getByTestId("field-1");
      act(() => { input1.focus(); });
      fireEvent.change(input1, { target: { value: "Hello" } });
      expect(document.activeElement).toBe(input1);
      expect((input1 as HTMLInputElement).value).toBe("Hello");

      // Switch to second input and type
      const input2 = screen.getByTestId("field-2");
      act(() => { input2.focus(); });
      expect(document.activeElement).toBe(input2);
      fireEvent.change(input2, { target: { value: "World" } });
      expect(document.activeElement).toBe(input2);
      expect((input2 as HTMLInputElement).value).toBe("World");

      // First input should still have its value
      expect((input1 as HTMLInputElement).value).toBe("Hello");
    });

    it("handles rapid state changes without stealing focus", async () => {
      const React = await import("react");

      function RapidModal(): React.ReactElement {
        const [isOpen] = React.useState(true);
        const [val, setVal] = React.useState("");
        const [charCount, setCharCount] = React.useState(0);
        return (
          <Modal isOpen={isOpen} onClose={vi.fn()} title="Rapid">
            <input
              data-testid="rapid-input"
              value={val}
              onChange={(e) => {
                setVal(e.target.value);
                // Multiple state updates per keystroke
                setCharCount(e.target.value.length);
              }}
            />
            <span data-testid="count">{charCount}</span>
          </Modal>
        );
      }

      render(<RapidModal />);
      const input = screen.getByTestId("rapid-input");

      act(() => { input.focus(); });

      fireEvent.change(input, { target: { value: "A" } });
      expect(document.activeElement).toBe(input);
      expect(screen.getByTestId("count").textContent).toBe("1");

      fireEvent.change(input, { target: { value: "AB" } });
      expect(document.activeElement).toBe(input);
      expect(screen.getByTestId("count").textContent).toBe("2");

      fireEvent.change(input, { target: { value: "ABC" } });
      expect(document.activeElement).toBe(input);
      expect(screen.getByTestId("count").textContent).toBe("3");
    });
  });

  // --- Escape key with onClose ref ---

  describe("Escape key uses latest onClose", () => {
    it("calls the current onClose even when it changes between renders", async () => {
      const React = await import("react");
      const closeCalls: number[] = [];

      function ChangingCloseModal(): React.ReactElement {
        const [count, setCount] = React.useState(0);
        return (
          <Modal
            isOpen={true}
            onClose={() => closeCalls.push(count)}
            title="Test"
          >
            <button
              data-testid="increment"
              onClick={() => setCount((c) => c + 1)}
            >
              Count: {count}
            </button>
          </Modal>
        );
      }

      render(<ChangingCloseModal />);

      // Increment count to 3
      fireEvent.click(screen.getByTestId("increment"));
      fireEvent.click(screen.getByTestId("increment"));
      fireEvent.click(screen.getByTestId("increment"));

      // Now press Escape — should use the latest onClose (count=3)
      fireEvent.keyDown(document, { key: "Escape" });

      expect(closeCalls).toEqual([3]);
    });
  });

  // --- Mobile UX: responsive padding classes ---

  describe("mobile UX responsive padding", () => {
    it("close button has p-2.5 padding class", () => {
      renderModal();
      const closeBtn = screen.getByLabelText("Close");
      expect(closeBtn.className).toContain("p-2.5");
    });

    it("header has responsive horizontal padding (px-4 and sm:px-6)", () => {
      renderModal();
      const dialog = screen.getByRole("dialog");
      // The header is the first child div with border-b
      const header = dialog.querySelector(".border-b.border-surface-700");
      expect(header).toBeTruthy();
      expect(header!.className).toContain("px-4");
      expect(header!.className).toContain("sm:px-6");
    });

    it("body has responsive horizontal padding (px-4 and sm:px-6)", () => {
      renderModal({ children: <p data-testid="body-content">Body text</p> });
      const bodyContent = screen.getByTestId("body-content");
      const bodyDiv = bodyContent.parentElement;
      expect(bodyDiv).toBeTruthy();
      expect(bodyDiv!.className).toContain("px-4");
      expect(bodyDiv!.className).toContain("sm:px-6");
    });
  });
});
