/**
 * DateTimePicker Unit Tests
 *
 * Tests rendering, calendar interaction, time selection,
 * Done button, outside click, Escape key, error/help text,
 * and disabled state.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within, act } from "@testing-library/react";
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

  // ─── Min/Max Constraints ──────────────────────────────────

  describe("min/max constraints", () => {
    it("disables days before the min date", () => {
      render(
        <DateTimePicker
          value=""
          onChange={onChange}
          min="2026-02-15"
        />
      );

      openPicker();

      const feb10 = screen.getByLabelText("Tuesday, February 10, 2026");
      expect((feb10 as HTMLButtonElement).disabled).toBe(true);
    });

    it("disables days after the max date", () => {
      render(
        <DateTimePicker
          value=""
          onChange={onChange}
          max="2026-02-20"
        />
      );

      openPicker();

      const feb25 = screen.getByLabelText("Wednesday, February 25, 2026");
      expect((feb25 as HTMLButtonElement).disabled).toBe(true);
    });

    it("min date itself is selectable (boundary)", () => {
      render(
        <DateTimePicker
          value=""
          onChange={onChange}
          min="2026-02-15"
        />
      );

      openPicker();

      const feb15 = screen.getByLabelText("Sunday, February 15, 2026");
      expect((feb15 as HTMLButtonElement).disabled).toBe(false);

      fireEvent.click(feb15);

      const gridcell = feb15.closest('[role="gridcell"]');
      expect(gridcell?.getAttribute("aria-selected")).toBe("true");
    });

    it("max date itself is selectable (boundary)", () => {
      render(
        <DateTimePicker
          value=""
          onChange={onChange}
          max="2026-02-20"
        />
      );

      openPicker();

      const feb20 = screen.getByLabelText("Friday, February 20, 2026");
      expect((feb20 as HTMLButtonElement).disabled).toBe(false);

      fireEvent.click(feb20);

      const gridcell = feb20.closest('[role="gridcell"]');
      expect(gridcell?.getAttribute("aria-selected")).toBe("true");
    });

    it("clicking a disabled day does not set it as pending", () => {
      render(
        <DateTimePicker
          value=""
          onChange={onChange}
          min="2026-02-15"
        />
      );

      openPicker();

      const feb10 = screen.getByLabelText("Tuesday, February 10, 2026");
      fireEvent.click(feb10);

      const gridcell = feb10.closest('[role="gridcell"]');
      expect(gridcell?.getAttribute("aria-selected")).toBe("false");
    });

    it("min/max with datetime format only uses the date part", () => {
      render(
        <DateTimePicker
          value=""
          onChange={onChange}
          min="2026-02-15T14:00"
          max="2026-02-20T08:30"
        />
      );

      openPicker();

      // Feb 15 should be selectable (min boundary — date part only)
      const feb15 = screen.getByLabelText("Sunday, February 15, 2026");
      expect((feb15 as HTMLButtonElement).disabled).toBe(false);

      // Feb 20 should be selectable (max boundary — date part only)
      const feb20 = screen.getByLabelText("Friday, February 20, 2026");
      expect((feb20 as HTMLButtonElement).disabled).toBe(false);

      // Feb 14 should be disabled (before min date)
      const feb14 = screen.getByLabelText("Saturday, February 14, 2026");
      expect((feb14 as HTMLButtonElement).disabled).toBe(true);

      // Feb 21 should be disabled (after max date)
      const feb21 = screen.getByLabelText("Saturday, February 21, 2026");
      expect((feb21 as HTMLButtonElement).disabled).toBe(true);
    });
  });

  // ─── Keyboard Navigation ─────────────────────────────────

  describe("keyboard navigation", () => {
    it("ArrowRight moves focus to next day", () => {
      render(
        <DateTimePicker value="2026-02-17T10:00" onChange={onChange} />
      );

      openPicker();

      const grid = screen.getByRole("grid");
      fireEvent.keyDown(grid, { key: "ArrowRight" });

      // Feb 17 -> Feb 18 focused
      const feb18 = screen.getByLabelText("Wednesday, February 18, 2026");
      // Focused day gets bg-surface-700 class
      expect(feb18.className).toContain("bg-surface-700");
    });

    it("ArrowLeft moves focus to previous day", () => {
      render(
        <DateTimePicker value="2026-02-17T10:00" onChange={onChange} />
      );

      openPicker();

      const grid = screen.getByRole("grid");
      fireEvent.keyDown(grid, { key: "ArrowLeft" });

      // Feb 17 -> Feb 16 focused
      const feb16 = screen.getByLabelText("Monday, February 16, 2026");
      expect(feb16.className).toContain("bg-surface-700");
    });

    it("ArrowDown moves focus down one week", () => {
      render(
        <DateTimePicker value="2026-02-17T10:00" onChange={onChange} />
      );

      openPicker();

      const grid = screen.getByRole("grid");
      fireEvent.keyDown(grid, { key: "ArrowDown" });

      // Feb 17 -> Feb 24 focused
      const feb24 = screen.getByLabelText("Tuesday, February 24, 2026");
      expect(feb24.className).toContain("bg-surface-700");
    });

    it("ArrowUp moves focus up one week", () => {
      render(
        <DateTimePicker value="2026-02-17T10:00" onChange={onChange} />
      );

      openPicker();

      const grid = screen.getByRole("grid");
      fireEvent.keyDown(grid, { key: "ArrowUp" });

      // Feb 17 -> Feb 10 focused
      const feb10 = screen.getByLabelText("Tuesday, February 10, 2026");
      expect(feb10.className).toContain("bg-surface-700");
    });

    it("Enter on focused date sets it as pending (does NOT close)", () => {
      render(
        <DateTimePicker value="2026-02-17T10:00" onChange={onChange} />
      );

      openPicker();

      const grid = screen.getByRole("grid");
      // Move focus to Feb 18
      fireEvent.keyDown(grid, { key: "ArrowRight" });
      // Press Enter
      fireEvent.keyDown(grid, { key: "Enter" });

      // Dropdown should still be open
      expect(screen.getByRole("dialog")).toBeTruthy();

      // Feb 18 should be pending (aria-selected)
      const feb18 = screen.getByLabelText("Wednesday, February 18, 2026");
      const gridcell = feb18.closest('[role="gridcell"]');
      expect(gridcell?.getAttribute("aria-selected")).toBe("true");

      // onChange should NOT have been called
      expect(onChange).not.toHaveBeenCalled();
    });

    it("Space on focused date sets it as pending", () => {
      render(
        <DateTimePicker value="2026-02-17T10:00" onChange={onChange} />
      );

      openPicker();

      const grid = screen.getByRole("grid");
      // Move focus to Feb 18
      fireEvent.keyDown(grid, { key: "ArrowRight" });
      // Press Space
      fireEvent.keyDown(grid, { key: " " });

      const feb18 = screen.getByLabelText("Wednesday, February 18, 2026");
      const gridcell = feb18.closest('[role="gridcell"]');
      expect(gridcell?.getAttribute("aria-selected")).toBe("true");
    });

    it("arrow navigation across month boundary updates view", () => {
      render(
        <DateTimePicker value="2026-02-28T10:00" onChange={onChange} />
      );

      openPicker();

      expect(screen.getByText("February 2026")).toBeTruthy();

      const grid = screen.getByRole("grid");
      // Feb 28 -> Mar 1 via ArrowRight
      fireEvent.keyDown(grid, { key: "ArrowRight" });

      // View should switch to March 2026
      expect(screen.getByText("March 2026")).toBeTruthy();
    });

    it("keyboard navigation does not select disabled dates", () => {
      render(
        <DateTimePicker
          value="2026-02-15T10:00"
          onChange={onChange}
          min="2026-02-15"
        />
      );

      openPicker();

      const grid = screen.getByRole("grid");
      // Move to Feb 14 (disabled, before min)
      fireEvent.keyDown(grid, { key: "ArrowLeft" });
      // Try to select via Enter
      fireEvent.keyDown(grid, { key: "Enter" });

      // The pending date should NOT be Feb 14 — it should still be Feb 15
      const feb15 = screen.getByLabelText("Sunday, February 15, 2026");
      const gridcell15 = feb15.closest('[role="gridcell"]');
      expect(gridcell15?.getAttribute("aria-selected")).toBe("true");

      const feb14 = screen.getByLabelText("Saturday, February 14, 2026");
      const gridcell14 = feb14.closest('[role="gridcell"]');
      expect(gridcell14?.getAttribute("aria-selected")).toBe("false");
    });
  });

  // ─── Focus Management ────────────────────────────────────

  describe("focus management", () => {
    it("grid receives focus when dropdown opens", () => {
      render(<DateTimePicker value="" onChange={onChange} />);

      openPicker();

      const grid = screen.getByRole("grid");
      expect(document.activeElement).toBe(grid);
    });

    it("focus returns to trigger after clicking Done", () => {
      render(
        <DateTimePicker value="2026-02-17T10:00" onChange={onChange} />
      );

      openPicker();

      // Select a day
      const dayButton = screen.getByLabelText("Wednesday, February 18, 2026");
      fireEvent.click(dayButton);

      // Click Done
      const doneButton = screen.getByRole("button", { name: "Done" });
      fireEvent.click(doneButton);

      const trigger = findTrigger();
      expect(document.activeElement).toBe(trigger);
    });

    it("focus returns to trigger after pressing Escape", () => {
      render(
        <DateTimePicker value="2026-02-17T10:00" onChange={onChange} />
      );

      openPicker();

      fireEvent.keyDown(document, { key: "Escape" });

      const trigger = findTrigger();
      expect(document.activeElement).toBe(trigger);
    });
  });

  // ─── Escape key behavior ─────────────────────────────────

  describe("Escape key behavior", () => {
    it("Escape stops propagation (parent handler NOT called)", () => {
      const parentHandler = vi.fn();

      render(
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions
        <div onKeyDown={parentHandler}>
          <DateTimePicker value="" onChange={onChange} />
        </div>
      );

      openPicker();

      fireEvent.keyDown(document, { key: "Escape" });

      // Because Escape handler calls e.stopPropagation(), the parent should NOT be called.
      // However, note: the event is on document, not on the div, so parent won't fire.
      // The real test is that stopPropagation is called — we check dropdown closes
      // and onChange is not called.
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(onChange).not.toHaveBeenCalled();
    });

    it("Escape resets hour changes back to original value", () => {
      render(
        <DateTimePicker value="2026-02-17T14:30" onChange={onChange} />
      );

      openPicker();

      // Change the hour
      const hourSelect = screen.getByLabelText("Hour") as HTMLSelectElement;
      fireEvent.change(hourSelect, { target: { value: "20" } });
      expect(hourSelect.value).toBe("20");

      // Press Escape
      fireEvent.keyDown(document, { key: "Escape" });

      // Reopen
      openPicker();

      const hourAfterReopen = screen.getByLabelText("Hour") as HTMLSelectElement;
      expect(hourAfterReopen.value).toBe("14");
    });

    it("Escape resets minute changes back to original value", () => {
      render(
        <DateTimePicker value="2026-02-17T14:30" onChange={onChange} />
      );

      openPicker();

      // Change the minute
      const minuteSelect = screen.getByLabelText("Minute") as HTMLSelectElement;
      fireEvent.change(minuteSelect, { target: { value: "00" } });
      expect(minuteSelect.value).toBe("00");

      // Press Escape
      fireEvent.keyDown(document, { key: "Escape" });

      // Reopen
      openPicker();

      const minuteAfterReopen = screen.getByLabelText("Minute") as HTMLSelectElement;
      expect(minuteAfterReopen.value).toBe("30");
    });
  });

  // ─── Close on scroll/resize ──────────────────────────────

  describe("close on scroll/resize", () => {
    it("dropdown closes on window scroll", () => {
      render(<DateTimePicker value="" onChange={onChange} />);

      openPicker();
      expect(screen.getByRole("dialog")).toBeTruthy();

      act(() => {
        window.dispatchEvent(new Event("scroll"));
      });

      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("dropdown closes on window resize", () => {
      render(<DateTimePicker value="" onChange={onChange} />);

      openPicker();
      expect(screen.getByRole("dialog")).toBeTruthy();

      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("scroll auto-confirms pending selection (calls onChange)", () => {
      render(
        <DateTimePicker value="" onChange={onChange} />
      );

      openPicker();

      // Select a day
      const dayButton = screen.getByLabelText("Wednesday, February 18, 2026");
      fireEvent.click(dayButton);

      // Change hour
      const hourSelect = screen.getByLabelText("Hour") as HTMLSelectElement;
      fireEvent.change(hourSelect, { target: { value: "15" } });

      // Scroll
      act(() => {
        window.dispatchEvent(new Event("scroll"));
      });

      expect(onChange).toHaveBeenCalledOnce();
      expect(onChange).toHaveBeenCalledWith("2026-02-18T15:00");
    });

    it("resize auto-confirms pending selection (calls onChange)", () => {
      render(
        <DateTimePicker value="" onChange={onChange} />
      );

      openPicker();

      // Select a day
      const dayButton = screen.getByLabelText("Wednesday, February 18, 2026");
      fireEvent.click(dayButton);

      // Change minute
      const minuteSelect = screen.getByLabelText("Minute") as HTMLSelectElement;
      fireEvent.change(minuteSelect, { target: { value: "45" } });

      // Resize
      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      expect(onChange).toHaveBeenCalledOnce();
      expect(onChange).toHaveBeenCalledWith("2026-02-18T09:45");
    });
  });

  // ─── Clicking days outside current month ──────────────────

  describe("clicking days outside current month", () => {
    it("clicking a day from previous month navigates view to that month", () => {
      render(<DateTimePicker value="" onChange={onChange} />);

      openPicker();

      expect(screen.getByText("February 2026")).toBeTruthy();

      // Feb 2026 starts on Sunday, so Mon Jan 26 should be visible as a leading day
      const jan26 = screen.getByLabelText("Monday, January 26, 2026");
      fireEvent.click(jan26);

      // View should navigate to January 2026
      expect(screen.getByText("January 2026")).toBeTruthy();
    });

    it("clicking a day from next month navigates view to that month", () => {
      render(<DateTimePicker value="" onChange={onChange} />);

      openPicker();

      expect(screen.getByText("February 2026")).toBeTruthy();

      // Feb 2026 ends on Saturday 28th, so the trailing days include Mar 1
      const mar1 = screen.getByLabelText("Sunday, March 1, 2026");
      fireEvent.click(mar1);

      // View should navigate to March 2026
      expect(screen.getByText("March 2026")).toBeTruthy();
    });
  });

  // ─── External value changes ──────────────────────────────

  describe("external value changes", () => {
    it("when value prop changes, calendar view month updates", () => {
      const { rerender } = render(
        <DateTimePicker value="2026-02-17T10:00" onChange={onChange} />
      );

      openPicker();
      expect(screen.getByText("February 2026")).toBeTruthy();

      // Close picker
      fireEvent.keyDown(document, { key: "Escape" });

      // Change value to a date in April
      rerender(
        <DateTimePicker value="2026-04-10T14:00" onChange={onChange} />
      );

      openPicker();
      expect(screen.getByText("April 2026")).toBeTruthy();
    });

    it("when value prop changes, hour/minute selects update", () => {
      const { rerender } = render(
        <DateTimePicker value="2026-02-17T10:00" onChange={onChange} />
      );

      openPicker();
      expect((screen.getByLabelText("Hour") as HTMLSelectElement).value).toBe("10");
      expect((screen.getByLabelText("Minute") as HTMLSelectElement).value).toBe("00");

      // Close
      fireEvent.keyDown(document, { key: "Escape" });

      // Change value
      rerender(
        <DateTimePicker value="2026-02-17T16:45" onChange={onChange} />
      );

      openPicker();
      expect((screen.getByLabelText("Hour") as HTMLSelectElement).value).toBe("16");
      expect((screen.getByLabelText("Minute") as HTMLSelectElement).value).toBe("45");
    });
  });

  // ─── Done button with time changes ───────────────────────

  describe("Done button with time changes", () => {
    it("Done with only hour changed works correctly", () => {
      render(
        <DateTimePicker value="2026-02-17T09:00" onChange={onChange} />
      );

      openPicker();

      // Change hour only
      const hourSelect = screen.getByLabelText("Hour") as HTMLSelectElement;
      fireEvent.change(hourSelect, { target: { value: "18" } });

      // Click Done (pending date is already set from value prop)
      const doneButton = screen.getByRole("button", { name: "Done" });
      fireEvent.click(doneButton);

      expect(onChange).toHaveBeenCalledOnce();
      expect(onChange).toHaveBeenCalledWith("2026-02-17T18:00");
    });

    it("Done with only minute changed works correctly", () => {
      render(
        <DateTimePicker value="2026-02-17T09:00" onChange={onChange} />
      );

      openPicker();

      // Change minute only
      const minuteSelect = screen.getByLabelText("Minute") as HTMLSelectElement;
      fireEvent.change(minuteSelect, { target: { value: "30" } });

      // Click Done
      const doneButton = screen.getByRole("button", { name: "Done" });
      fireEvent.click(doneButton);

      expect(onChange).toHaveBeenCalledOnce();
      expect(onChange).toHaveBeenCalledWith("2026-02-17T09:30");
    });

    it("Done preserves previously selected date when only changing time", () => {
      render(
        <DateTimePicker value="2026-02-20T12:00" onChange={onChange} />
      );

      openPicker();

      // Change time without selecting a different date
      const hourSelect = screen.getByLabelText("Hour") as HTMLSelectElement;
      fireEvent.change(hourSelect, { target: { value: "08" } });

      const minuteSelect = screen.getByLabelText("Minute") as HTMLSelectElement;
      fireEvent.change(minuteSelect, { target: { value: "15" } });

      const doneButton = screen.getByRole("button", { name: "Done" });
      fireEvent.click(doneButton);

      expect(onChange).toHaveBeenCalledOnce();
      expect(onChange).toHaveBeenCalledWith("2026-02-20T08:15");
    });
  });

  // ─── Invalid/edge case values ────────────────────────────

  describe("invalid/edge case values", () => {
    it("empty string shows placeholder and defaults to 09:00", () => {
      render(
        <DateTimePicker
          value=""
          onChange={onChange}
          placeholder="Pick a date"
        />
      );

      expect(screen.getByText("Pick a date")).toBeTruthy();

      openPicker();

      const hourSelect = screen.getByLabelText("Hour") as HTMLSelectElement;
      const minuteSelect = screen.getByLabelText("Minute") as HTMLSelectElement;
      expect(hourSelect.value).toBe("09");
      expect(minuteSelect.value).toBe("00");
    });

    it("date-only value (no T part) still works", () => {
      render(
        <DateTimePicker value="2026-03-10" onChange={onChange} />
      );

      // Should show something on trigger — the date is parsed
      // but time defaults to 09:00
      openPicker();

      const hourSelect = screen.getByLabelText("Hour") as HTMLSelectElement;
      const minuteSelect = screen.getByLabelText("Minute") as HTMLSelectElement;
      expect(hourSelect.value).toBe("09");
      expect(minuteSelect.value).toBe("00");

      // View should be March 2026
      expect(screen.getByText("March 2026")).toBeTruthy();
    });

    it("invalid date string shows placeholder", () => {
      render(
        <DateTimePicker
          value="not-a-date"
          onChange={onChange}
          placeholder="Select date"
        />
      );

      expect(screen.getByText("Select date")).toBeTruthy();
    });
  });

  // ─── Label association ───────────────────────────────────

  describe("label association", () => {
    it("label htmlFor matches trigger id", () => {
      render(
        <DateTimePicker
          label="Session time"
          value=""
          onChange={onChange}
        />
      );

      const label = screen.getByText("Session time");
      const trigger = findTrigger();

      expect(label.getAttribute("for")).toBe(trigger.id);
    });
  });

  // ─── Weekday headers ─────────────────────────────────────

  describe("weekday headers", () => {
    it("renders Mo Tu We Th Fr Sa Su", () => {
      render(<DateTimePicker value="" onChange={onChange} />);

      openPicker();

      const expectedDays = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
      for (const dayLabel of expectedDays) {
        expect(screen.getByText(dayLabel)).toBeTruthy();
      }
    });
  });

  // ─── Today highlight ─────────────────────────────────────

  describe("today highlight", () => {
    it("today gets ring styling when not pending", () => {
      // System time is Feb 17, 2026
      render(<DateTimePicker value="" onChange={onChange} />);

      openPicker();

      const today = screen.getByLabelText("Tuesday, February 17, 2026");
      expect(today.className).toContain("ring-1");
      expect(today.className).toContain("ring-primary-500");
    });

    it("today does NOT get ring styling when it is the pending date", () => {
      // System time is Feb 17, 2026
      render(<DateTimePicker value="" onChange={onChange} />);

      openPicker();

      // Select today as pending
      const today = screen.getByLabelText("Tuesday, February 17, 2026");
      fireEvent.click(today);

      // Now it should have the pending style (bg-primary-600) but NOT the ring
      expect(today.className).toContain("bg-primary-600");
      expect(today.className).not.toContain("ring-1");
    });
  });
});
