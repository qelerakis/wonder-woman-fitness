/**
 * DateTimePicker Unit Tests
 *
 * Tests rendering, calendar interaction, time selection,
 * Done button, outside click, Escape key, error/help text,
 * and disabled state.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { DateTimePicker } from "../DateTimePicker";

// ===== Helpers =====

/** Find the trigger button by its aria-haspopup attribute (works regardless of displayed text). */
function findTrigger(): HTMLButtonElement {
  const buttons = screen.getAllByRole("button");
  const trigger = buttons.find(
    (btn) => btn.getAttribute("aria-haspopup") === "dialog"
  );
  if (!trigger) throw new Error("Could not find DateTimePicker trigger button");
  return trigger as HTMLButtonElement;
}

function openPicker(): void {
  fireEvent.click(findTrigger());
}

// ===== Tests =====

describe("DateTimePicker", () => {
  let onChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onChange = vi.fn();
    // Fix "now" to Feb 17, 2026 at 10:00 for deterministic tests
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 17, 10, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── Rendering ─────────────────────────────────────────────

  describe("rendering", () => {
    it("renders with label and placeholder", () => {
      render(
        <DateTimePicker
          label="Start time"
          value=""
          onChange={onChange}
          placeholder="Pick a date and time"
        />
      );

      expect(screen.getByText("Start time")).toBeTruthy();
      expect(screen.getByText("Pick a date and time")).toBeTruthy();
    });

    it("renders with default placeholder when none provided", () => {
      render(<DateTimePicker value="" onChange={onChange} />);
      expect(screen.getByText("Select date and time")).toBeTruthy();
    });

    it("displays formatted date and time when value is set", () => {
      render(
        <DateTimePicker value="2026-02-17T14:30" onChange={onChange} />
      );

      expect(screen.getByText("Feb 17, 2026 at 14:30")).toBeTruthy();
    });

    it("displays formatted date with different time", () => {
      render(
        <DateTimePicker value="2026-03-05T09:15" onChange={onChange} />
      );

      expect(screen.getByText("Mar 5, 2026 at 09:15")).toBeTruthy();
    });
  });

  // ─── Calendar dropdown ─────────────────────────────────────

  describe("calendar dropdown", () => {
    it("opens calendar dropdown on click", () => {
      render(<DateTimePicker value="" onChange={onChange} />);

      expect(screen.queryByRole("dialog")).toBeNull();

      openPicker();

      expect(screen.getByRole("dialog")).toBeTruthy();
      expect(
        screen.getByText("February 2026")
      ).toBeTruthy();
    });

    it("closes dropdown when clicking the trigger again", () => {
      render(<DateTimePicker value="" onChange={onChange} />);

      openPicker();
      expect(screen.getByRole("dialog")).toBeTruthy();

      // Click trigger again to close
      fireEvent.click(
        screen.getAllByRole("button").find(
          (btn) => btn.getAttribute("aria-haspopup") === "dialog"
        )!
      );

      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("selects a day and does NOT close the dropdown", () => {
      render(<DateTimePicker value="" onChange={onChange} />);

      openPicker();

      const dayButton = screen.getByLabelText("Wednesday, February 18, 2026");
      fireEvent.click(dayButton);

      // Dropdown must stay open
      expect(screen.getByRole("dialog")).toBeTruthy();

      // onChange should NOT be called yet (user hasn't clicked Done)
      expect(onChange).not.toHaveBeenCalled();
    });

    it("marks selected day as pending with aria-selected", () => {
      render(<DateTimePicker value="" onChange={onChange} />);

      openPicker();

      const dayButton = screen.getByLabelText("Wednesday, February 18, 2026");
      fireEvent.click(dayButton);

      // The gridcell containing the day should have aria-selected=true
      const gridcell = dayButton.closest('[role="gridcell"]');
      expect(gridcell?.getAttribute("aria-selected")).toBe("true");
    });
  });

  // ─── Time selection ────────────────────────────────────────

  describe("time selection", () => {
    it("shows hour and minute select elements", () => {
      render(<DateTimePicker value="" onChange={onChange} />);

      openPicker();

      const hourSelect = screen.getByLabelText("Hour") as HTMLSelectElement;
      const minuteSelect = screen.getByLabelText("Minute") as HTMLSelectElement;

      expect(hourSelect).toBeTruthy();
      expect(minuteSelect).toBeTruthy();
    });

    it("has 24 hour options (00-23)", () => {
      render(<DateTimePicker value="" onChange={onChange} />);

      openPicker();

      const hourSelect = screen.getByLabelText("Hour") as HTMLSelectElement;
      const options = within(hourSelect).getAllByRole("option");

      expect(options).toHaveLength(24);
      expect(options[0].textContent).toBe("00");
      expect(options[23].textContent).toBe("23");
    });

    it("has 15-minute increment options (00, 15, 30, 45)", () => {
      render(<DateTimePicker value="" onChange={onChange} />);

      openPicker();

      const minuteSelect = screen.getByLabelText("Minute") as HTMLSelectElement;
      const options = within(minuteSelect).getAllByRole("option");

      expect(options).toHaveLength(4);
      expect(options[0].textContent).toBe("00");
      expect(options[1].textContent).toBe("15");
      expect(options[2].textContent).toBe("30");
      expect(options[3].textContent).toBe("45");
    });

    it("changes hour via select", () => {
      render(
        <DateTimePicker value="2026-02-17T09:00" onChange={onChange} />
      );

      openPicker();

      const hourSelect = screen.getByLabelText("Hour") as HTMLSelectElement;
      fireEvent.change(hourSelect, { target: { value: "14" } });

      expect(hourSelect.value).toBe("14");
    });

    it("changes minute via select", () => {
      render(
        <DateTimePicker value="2026-02-17T09:00" onChange={onChange} />
      );

      openPicker();

      const minuteSelect = screen.getByLabelText("Minute") as HTMLSelectElement;
      fireEvent.change(minuteSelect, { target: { value: "45" } });

      expect(minuteSelect.value).toBe("45");
    });

    it("initializes time selects from value prop", () => {
      render(
        <DateTimePicker value="2026-02-17T14:30" onChange={onChange} />
      );

      openPicker();

      const hourSelect = screen.getByLabelText("Hour") as HTMLSelectElement;
      const minuteSelect = screen.getByLabelText("Minute") as HTMLSelectElement;

      expect(hourSelect.value).toBe("14");
      expect(minuteSelect.value).toBe("30");
    });

    it("defaults to 09:00 when no value is provided", () => {
      render(<DateTimePicker value="" onChange={onChange} />);

      openPicker();

      const hourSelect = screen.getByLabelText("Hour") as HTMLSelectElement;
      const minuteSelect = screen.getByLabelText("Minute") as HTMLSelectElement;

      expect(hourSelect.value).toBe("09");
      expect(minuteSelect.value).toBe("00");
    });
  });

  // ─── Done button ───────────────────────────────────────────

  describe("Done button", () => {
    it("calls onChange with YYYY-MM-DDTHH:mm format on Done click", () => {
      render(<DateTimePicker value="" onChange={onChange} />);

      openPicker();

      // Select a day
      const dayButton = screen.getByLabelText("Wednesday, February 18, 2026");
      fireEvent.click(dayButton);

      // Change the hour to 14
      const hourSelect = screen.getByLabelText("Hour") as HTMLSelectElement;
      fireEvent.change(hourSelect, { target: { value: "14" } });

      // Change the minute to 30
      const minuteSelect = screen.getByLabelText("Minute") as HTMLSelectElement;
      fireEvent.change(minuteSelect, { target: { value: "30" } });

      // Click Done
      const doneButton = screen.getByRole("button", { name: "Done" });
      fireEvent.click(doneButton);

      expect(onChange).toHaveBeenCalledOnce();
      expect(onChange).toHaveBeenCalledWith("2026-02-18T14:30");
    });

    it("is disabled when no date is selected", () => {
      render(<DateTimePicker value="" onChange={onChange} />);

      openPicker();

      const doneButton = screen.getByRole("button", { name: "Done" });
      expect(doneButton).toBeInstanceOf(HTMLButtonElement);
      expect((doneButton as HTMLButtonElement).disabled).toBe(true);
    });

    it("is enabled after selecting a date", () => {
      render(<DateTimePicker value="" onChange={onChange} />);

      openPicker();

      // Select a day
      const dayButton = screen.getByLabelText("Wednesday, February 18, 2026");
      fireEvent.click(dayButton);

      const doneButton = screen.getByRole("button", {
        name: "Done",
      }) as HTMLButtonElement;
      expect(doneButton.disabled).toBe(false);
    });

    it("closes the dropdown after clicking Done", () => {
      render(<DateTimePicker value="" onChange={onChange} />);

      openPicker();

      const dayButton = screen.getByLabelText("Wednesday, February 18, 2026");
      fireEvent.click(dayButton);

      const doneButton = screen.getByRole("button", { name: "Done" });
      fireEvent.click(doneButton);

      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("uses default time 09:00 if only a day is selected without changing time", () => {
      render(<DateTimePicker value="" onChange={onChange} />);

      openPicker();

      const dayButton = screen.getByLabelText("Wednesday, February 18, 2026");
      fireEvent.click(dayButton);

      const doneButton = screen.getByRole("button", { name: "Done" });
      fireEvent.click(doneButton);

      expect(onChange).toHaveBeenCalledWith("2026-02-18T09:00");
    });
  });

  // ─── Outside click ─────────────────────────────────────────

  describe("outside click", () => {
    it("auto-confirms pending selection on click outside", () => {
      render(
        <div>
          <DateTimePicker value="" onChange={onChange} />
          <button data-testid="outside">Outside</button>
        </div>
      );

      openPicker();

      // Select a day
      const dayButton = screen.getByLabelText("Wednesday, February 18, 2026");
      fireEvent.click(dayButton);

      // Change hour
      const hourSelect = screen.getByLabelText("Hour") as HTMLSelectElement;
      fireEvent.change(hourSelect, { target: { value: "16" } });

      // Click outside
      fireEvent.mouseDown(screen.getByTestId("outside"));

      expect(onChange).toHaveBeenCalledOnce();
      expect(onChange).toHaveBeenCalledWith("2026-02-18T16:00");
    });

    it("closes dropdown on click outside without calling onChange when no date pending", () => {
      render(
        <div>
          <DateTimePicker value="" onChange={onChange} />
          <button data-testid="outside">Outside</button>
        </div>
      );

      openPicker();

      // Click outside without selecting any date
      fireEvent.mouseDown(screen.getByTestId("outside"));

      expect(onChange).not.toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  // ─── Escape key ────────────────────────────────────────────

  describe("Escape key", () => {
    it("closes without confirming when Escape is pressed", () => {
      render(<DateTimePicker value="" onChange={onChange} />);

      openPicker();

      // Select a day (pending)
      const dayButton = screen.getByLabelText("Wednesday, February 18, 2026");
      fireEvent.click(dayButton);

      // Press Escape
      fireEvent.keyDown(document, { key: "Escape" });

      // Should close
      expect(screen.queryByRole("dialog")).toBeNull();

      // Should NOT call onChange
      expect(onChange).not.toHaveBeenCalled();
    });

    it("resets pending state after Escape so reopening shows original value", () => {
      render(
        <DateTimePicker value="2026-02-17T10:00" onChange={onChange} />
      );

      openPicker();

      // Change the hour
      const hourSelect = screen.getByLabelText("Hour") as HTMLSelectElement;
      fireEvent.change(hourSelect, { target: { value: "20" } });

      // Press Escape
      fireEvent.keyDown(document, { key: "Escape" });

      // Reopen
      fireEvent.click(
        screen.getAllByRole("button").find(
          (btn) => btn.getAttribute("aria-haspopup") === "dialog"
        )!
      );

      // Hour should be reset to original value
      const hourAfterReopen = screen.getByLabelText("Hour") as HTMLSelectElement;
      expect(hourAfterReopen.value).toBe("10");
    });
  });

  // ─── Error message ─────────────────────────────────────────

  describe("error message", () => {
    it("shows error message with role='alert'", () => {
      render(
        <DateTimePicker
          value=""
          onChange={onChange}
          error="Date is required"
        />
      );

      const alert = screen.getByRole("alert");
      expect(alert.textContent).toBe("Date is required");
    });

    it("associates error with trigger via aria-describedby", () => {
      render(
        <DateTimePicker
          value=""
          onChange={onChange}
          error="Date is required"
        />
      );

      const trigger = screen.getAllByRole("button").find(
        (btn) => btn.getAttribute("aria-haspopup") === "dialog"
      )!;
      const describedBy = trigger.getAttribute("aria-describedby");
      const alert = screen.getByRole("alert");

      expect(describedBy).toBeTruthy();
      expect(alert.id).toBe(describedBy);
    });
  });

  // ─── Disabled state ────────────────────────────────────────

  describe("disabled state", () => {
    it("prevents opening when disabled", () => {
      render(<DateTimePicker value="" onChange={onChange} disabled />);

      const trigger = screen.getAllByRole("button").find(
        (btn) => btn.getAttribute("aria-haspopup") === "dialog"
      )!;

      expect((trigger as HTMLButtonElement).disabled).toBe(true);

      fireEvent.click(trigger);

      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("shows disabled styling", () => {
      render(<DateTimePicker value="" onChange={onChange} disabled />);

      const trigger = screen.getAllByRole("button").find(
        (btn) => btn.getAttribute("aria-haspopup") === "dialog"
      )!;

      expect(trigger.className).toContain("disabled:cursor-not-allowed");
      expect(trigger.className).toContain("disabled:opacity-50");
    });
  });

  // ─── Help text ─────────────────────────────────────────────

  describe("help text", () => {
    it("shows help text when no error", () => {
      render(
        <DateTimePicker
          value=""
          onChange={onChange}
          helpText="Choose a session time"
        />
      );

      expect(screen.getByText("Choose a session time")).toBeTruthy();
    });

    it("does not show help text when error is present", () => {
      render(
        <DateTimePicker
          value=""
          onChange={onChange}
          helpText="Choose a session time"
          error="Required"
        />
      );

      expect(screen.queryByText("Choose a session time")).toBeNull();
      expect(screen.getByText("Required")).toBeTruthy();
    });

    it("associates help text with trigger via aria-describedby", () => {
      render(
        <DateTimePicker
          value=""
          onChange={onChange}
          helpText="Choose a session time"
        />
      );

      const trigger = screen.getAllByRole("button").find(
        (btn) => btn.getAttribute("aria-haspopup") === "dialog"
      )!;
      const describedBy = trigger.getAttribute("aria-describedby");
      const helpText = screen.getByText("Choose a session time");

      expect(describedBy).toBeTruthy();
      expect(helpText.id).toBe(describedBy);
    });
  });

  // ─── Month navigation ──────────────────────────────────────

  describe("month navigation", () => {
    it("navigates to next month", () => {
      render(<DateTimePicker value="" onChange={onChange} />);

      openPicker();

      expect(screen.getByText("February 2026")).toBeTruthy();

      const nextButton = screen.getByLabelText("Next month");
      fireEvent.click(nextButton);

      expect(screen.getByText("March 2026")).toBeTruthy();
    });

    it("navigates to previous month", () => {
      render(<DateTimePicker value="" onChange={onChange} />);

      openPicker();

      expect(screen.getByText("February 2026")).toBeTruthy();

      const prevButton = screen.getByLabelText("Previous month");
      fireEvent.click(prevButton);

      expect(screen.getByText("January 2026")).toBeTruthy();
    });
  });

  // ─── aria-expanded ─────────────────────────────────────────

  describe("aria attributes", () => {
    it("sets aria-expanded=false when closed", () => {
      render(<DateTimePicker value="" onChange={onChange} />);

      const trigger = screen.getAllByRole("button").find(
        (btn) => btn.getAttribute("aria-haspopup") === "dialog"
      )!;

      expect(trigger.getAttribute("aria-expanded")).toBe("false");
    });

    it("sets aria-expanded=true when open", () => {
      render(<DateTimePicker value="" onChange={onChange} />);

      openPicker();

      const trigger = screen.getAllByRole("button").find(
        (btn) => btn.getAttribute("aria-haspopup") === "dialog"
      )!;

      expect(trigger.getAttribute("aria-expanded")).toBe("true");
    });
  });
});
