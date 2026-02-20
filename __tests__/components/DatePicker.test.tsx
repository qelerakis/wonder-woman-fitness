/**
 * DatePicker Unit Tests
 *
 * Tests rendering, calendar interaction, date selection,
 * month navigation, min/max constraints, error/help text,
 * disabled state, and keyboard interaction.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { DatePicker } from "@/components/ui/DatePicker";

// ===== Helpers =====

/**
 * Open the calendar dropdown by clicking the trigger button.
 */
function openCalendar(): void {
  const trigger = screen.getByRole("button", { name: /select a date|feb 17, 2026/i });
  fireEvent.click(trigger);
}

// ===== Tests =====

describe("DatePicker", () => {
  beforeEach(() => {
    // Fix "today" to Tuesday, February 17, 2026
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 17)); // month is 0-indexed
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── Rendering ─────────────────────────────────────────────

  it("renders with label and placeholder", () => {
    render(
      <DatePicker
        label="Start Date"
        value=""
        onChange={vi.fn()}
        placeholder="Pick a date"
      />
    );

    expect(screen.getByText("Start Date")).toBeTruthy();
    // When a label is associated, the button's accessible name comes from the label
    const trigger = screen.getByRole("button", { name: "Start Date" });
    expect(trigger).toBeTruthy();
    // Verify placeholder text is shown inside the button
    expect(screen.getByText("Pick a date")).toBeTruthy();
  });

  it("displays formatted date when value is set", () => {
    render(
      <DatePicker label="Date" value="2026-02-17" onChange={vi.fn()} />
    );

    expect(screen.getByText("Feb 17, 2026")).toBeTruthy();
  });

  it("shows placeholder when value is empty", () => {
    render(
      <DatePicker value="" onChange={vi.fn()} placeholder="Select a date" />
    );

    const trigger = screen.getByRole("button", { name: "Select a date" });
    expect(trigger).toBeTruthy();
  });

  // ─── Opening and Closing ──────────────────────────────────

  it("opens calendar dropdown on click", () => {
    render(<DatePicker value="" onChange={vi.fn()} />);

    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Select a date" }));
    expect(screen.getByRole("dialog", { name: "Choose date" })).toBeTruthy();
  });

  it("closes on click outside", () => {
    render(
      <div>
        <DatePicker value="" onChange={vi.fn()} />
        <button>Outside</button>
      </div>
    );

    // Open
    fireEvent.click(screen.getByRole("button", { name: "Select a date" }));
    expect(screen.getByRole("dialog", { name: "Choose date" })).toBeTruthy();

    // Click outside
    fireEvent.mouseDown(screen.getByText("Outside"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on Escape key", () => {
    render(<DatePicker value="" onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Select a date" }));
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  // ─── Date Selection ───────────────────────────────────────

  it("selects a day and calls onChange with YYYY-MM-DD format", () => {
    const onChange = vi.fn();
    render(<DatePicker value="" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Select a date" }));

    // Click on February 20, 2026
    const dayButton = screen.getByLabelText("Friday, February 20, 2026");
    fireEvent.click(dayButton);

    expect(onChange).toHaveBeenCalledWith("2026-02-20");
  });

  it("closes the calendar after selecting a day", () => {
    const onChange = vi.fn();
    render(<DatePicker value="" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Select a date" }));
    fireEvent.click(screen.getByLabelText("Friday, February 20, 2026"));

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  // ─── Calendar Header ─────────────────────────────────────

  it("shows current month name and year in header", () => {
    render(<DatePicker value="2026-02-17" onChange={vi.fn()} />);

    fireEvent.click(screen.getByText("Feb 17, 2026"));
    expect(screen.getByText("February 2026")).toBeTruthy();
  });

  it("navigates to previous month via prev button", () => {
    render(<DatePicker value="2026-02-17" onChange={vi.fn()} />);

    fireEvent.click(screen.getByText("Feb 17, 2026"));
    expect(screen.getByText("February 2026")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Previous month"));
    expect(screen.getByText("January 2026")).toBeTruthy();
  });

  it("navigates to next month via next button", () => {
    render(<DatePicker value="2026-02-17" onChange={vi.fn()} />);

    fireEvent.click(screen.getByText("Feb 17, 2026"));
    expect(screen.getByText("February 2026")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Next month"));
    expect(screen.getByText("March 2026")).toBeTruthy();
  });

  // ─── Day Styling ──────────────────────────────────────────

  it("highlights today with ring styling", () => {
    render(<DatePicker value="" onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Select a date" }));

    // Today is Feb 17, 2026
    const todayButton = screen.getByLabelText("Tuesday, February 17, 2026");
    expect(todayButton.className).toContain("ring-1");
    expect(todayButton.className).toContain("ring-primary-500");
  });

  it("highlights selected date with primary background", () => {
    render(<DatePicker value="2026-02-17" onChange={vi.fn()} />);

    fireEvent.click(screen.getByText("Feb 17, 2026"));

    const selectedButton = screen.getByLabelText("Tuesday, February 17, 2026");
    expect(selectedButton.className).toContain("bg-primary-600");
    expect(selectedButton.className).toContain("text-white");
  });

  it("does not show ring styling on today when it is selected", () => {
    // When today is selected, it gets bg-primary-600 but NOT ring-1
    render(<DatePicker value="2026-02-17" onChange={vi.fn()} />);

    fireEvent.click(screen.getByText("Feb 17, 2026"));

    const todaySelected = screen.getByLabelText("Tuesday, February 17, 2026");
    expect(todaySelected.className).toContain("bg-primary-600");
    expect(todaySelected.className).not.toContain("ring-1");
  });

  it("dims days outside current month", () => {
    render(<DatePicker value="2026-02-17" onChange={vi.fn()} />);

    fireEvent.click(screen.getByText("Feb 17, 2026"));

    // Feb 2026 starts on Sunday. The calendar starts on Monday (week starts on Mon).
    // So the first row starts on Mon Jan 26, 2026.
    const outsideDay = screen.getByLabelText("Monday, January 26, 2026");
    expect(outsideDay.className).toContain("text-surface-600");
  });

  // ─── Min / Max Constraints ────────────────────────────────

  it("disables days before min date", () => {
    const onChange = vi.fn();
    render(
      <DatePicker value="" onChange={onChange} min="2026-02-15" />
    );

    fireEvent.click(screen.getByRole("button", { name: "Select a date" }));

    const disabledDay = screen.getByLabelText("Saturday, February 14, 2026");
    expect(disabledDay).toHaveProperty("disabled", true);
    expect(disabledDay.className).toContain("cursor-not-allowed");

    // Clicking disabled day should not call onChange
    fireEvent.click(disabledDay);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("disables days after max date", () => {
    const onChange = vi.fn();
    render(
      <DatePicker value="" onChange={onChange} max="2026-02-20" />
    );

    fireEvent.click(screen.getByRole("button", { name: "Select a date" }));

    const disabledDay = screen.getByLabelText("Saturday, February 21, 2026");
    expect(disabledDay).toHaveProperty("disabled", true);
    expect(disabledDay.className).toContain("cursor-not-allowed");

    fireEvent.click(disabledDay);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("allows selecting days within min/max range", () => {
    const onChange = vi.fn();
    render(
      <DatePicker
        value=""
        onChange={onChange}
        min="2026-02-10"
        max="2026-02-20"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Select a date" }));

    const enabledDay = screen.getByLabelText("Monday, February 16, 2026");
    expect(enabledDay).toHaveProperty("disabled", false);
    fireEvent.click(enabledDay);
    expect(onChange).toHaveBeenCalledWith("2026-02-16");
  });

  // ─── Error and Help Text ──────────────────────────────────

  it("shows error message with role='alert'", () => {
    render(
      <DatePicker
        value=""
        onChange={vi.fn()}
        error="Date is required"
      />
    );

    const errorEl = screen.getByRole("alert");
    expect(errorEl.textContent).toBe("Date is required");
  });

  it("applies error border styling on trigger when error is present", () => {
    render(
      <DatePicker value="" onChange={vi.fn()} error="Invalid date" />
    );

    const trigger = screen.getByRole("button", { name: "Select a date" });
    expect(trigger.className).toContain("border-error-500");
  });

  it("shows help text when no error is present", () => {
    render(
      <DatePicker
        value=""
        onChange={vi.fn()}
        helpText="Choose your preferred date"
      />
    );

    expect(screen.getByText("Choose your preferred date")).toBeTruthy();
  });

  it("does not show help text when error is present", () => {
    render(
      <DatePicker
        value=""
        onChange={vi.fn()}
        error="Required"
        helpText="Choose your preferred date"
      />
    );

    expect(screen.getByRole("alert").textContent).toBe("Required");
    expect(screen.queryByText("Choose your preferred date")).toBeNull();
  });

  // ─── Disabled State ───────────────────────────────────────

  it("disabled state prevents opening the calendar", () => {
    render(<DatePicker value="" onChange={vi.fn()} disabled />);

    const trigger = screen.getByRole("button", { name: "Select a date" });
    expect(trigger).toHaveProperty("disabled", true);
    expect(trigger.className).toContain("disabled:cursor-not-allowed");

    fireEvent.click(trigger);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  // ─── +1 Month Shortcut ───────────────────────────────────

  it("+1 Month shortcut selects the same day one month forward", () => {
    const onChange = vi.fn();
    render(<DatePicker value="2026-02-17" onChange={onChange} />);

    fireEvent.click(screen.getByText("Feb 17, 2026"));

    const plusMonthButton = screen.getByText("+1 Month");
    fireEvent.click(plusMonthButton);

    expect(onChange).toHaveBeenCalledWith("2026-03-17");
  });

  it("+1 Month shortcut closes the calendar", () => {
    render(<DatePicker value="2026-02-17" onChange={vi.fn()} />);

    fireEvent.click(screen.getByText("Feb 17, 2026"));
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.click(screen.getByText("+1 Month"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("+1 Month shortcut does nothing when target is after max date", () => {
    const onChange = vi.fn();
    render(
      <DatePicker value="2026-02-17" onChange={onChange} max="2026-02-28" />
    );

    fireEvent.click(screen.getByText("Feb 17, 2026"));

    const plusMonthButton = screen.getByText("+1 Month");
    fireEvent.click(plusMonthButton);

    expect(onChange).not.toHaveBeenCalled();
  });

  // ─── Weekday Headers ──────────────────────────────────────

  it("renders weekday labels starting with Monday", () => {
    render(<DatePicker value="2026-02-17" onChange={vi.fn()} />);

    fireEvent.click(screen.getByText("Feb 17, 2026"));

    const expectedLabels = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
    for (const label of expectedLabels) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  // ─── ARIA Attributes ──────────────────────────────────────

  it("sets aria-expanded on trigger when open", () => {
    render(<DatePicker value="" onChange={vi.fn()} />);

    const trigger = screen.getByRole("button", { name: "Select a date" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("sets aria-haspopup='dialog' on trigger", () => {
    render(<DatePicker value="" onChange={vi.fn()} />);

    const trigger = screen.getByRole("button", { name: "Select a date" });
    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
  });

  it("marks today with aria-current='date'", () => {
    render(<DatePicker value="" onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Select a date" }));

    const todayCell = screen.getByLabelText("Tuesday, February 17, 2026");
    expect(todayCell.getAttribute("aria-current")).toBe("date");
  });

  it("marks selected date with aria-selected on gridcell", () => {
    render(<DatePicker value="2026-02-17" onChange={vi.fn()} />);

    fireEvent.click(screen.getByText("Feb 17, 2026"));

    // aria-selected is on the gridcell (parent div), not the button
    const gridcells = screen.getAllByRole("gridcell");
    const selectedCell = gridcells.find(
      (cell) => cell.getAttribute("aria-selected") === "true"
    );
    expect(selectedCell).toBeTruthy();
  });

  // ─── aria-describedby ─────────────────────────────────────

  it("sets aria-describedby to error id when error is present", () => {
    render(
      <DatePicker
        value=""
        onChange={vi.fn()}
        error="Required"
        helpText="Some help"
      />
    );

    const trigger = screen.getByRole("button", { name: "Select a date" });
    const describedBy = trigger.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();

    // The referenced element should be the error message
    const errorEl = screen.getByRole("alert");
    expect(errorEl.id).toBe(describedBy);
  });

  it("sets aria-describedby to help id when only helpText is present", () => {
    render(
      <DatePicker
        value=""
        onChange={vi.fn()}
        helpText="Pick a date"
      />
    );

    const trigger = screen.getByRole("button", { name: "Select a date" });
    const describedBy = trigger.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();

    const helpEl = screen.getByText("Pick a date");
    expect(helpEl.id).toBe(describedBy);
  });

  // ─── Keyboard Navigation ─────────────────────────────────

  describe("keyboard navigation", () => {
    it("ArrowRight moves focus to the next day", () => {
      render(<DatePicker value="2026-02-17" onChange={vi.fn()} />);
      openCalendar();

      const grid = screen.getByRole("grid");
      fireEvent.keyDown(grid, { key: "ArrowRight" });

      // Focused date should now be Feb 18 — verify via visual highlight
      const feb18 = screen.getByLabelText("Wednesday, February 18, 2026");
      expect(feb18.className).toContain("bg-surface-700");
    });

    it("ArrowLeft moves focus to the previous day", () => {
      render(<DatePicker value="2026-02-17" onChange={vi.fn()} />);
      openCalendar();

      const grid = screen.getByRole("grid");
      fireEvent.keyDown(grid, { key: "ArrowLeft" });

      const feb16 = screen.getByLabelText("Monday, February 16, 2026");
      expect(feb16.className).toContain("bg-surface-700");
    });

    it("ArrowDown moves focus down one week (7 days)", () => {
      render(<DatePicker value="2026-02-17" onChange={vi.fn()} />);
      openCalendar();

      const grid = screen.getByRole("grid");
      fireEvent.keyDown(grid, { key: "ArrowDown" });

      const feb24 = screen.getByLabelText("Tuesday, February 24, 2026");
      expect(feb24.className).toContain("bg-surface-700");
    });

    it("ArrowUp moves focus up one week (7 days)", () => {
      render(<DatePicker value="2026-02-17" onChange={vi.fn()} />);
      openCalendar();

      const grid = screen.getByRole("grid");
      fireEvent.keyDown(grid, { key: "ArrowUp" });

      const feb10 = screen.getByLabelText("Tuesday, February 10, 2026");
      expect(feb10.className).toContain("bg-surface-700");
    });

    it("Enter on focused date selects it and calls onChange", () => {
      const onChange = vi.fn();
      render(<DatePicker value="2026-02-17" onChange={onChange} />);
      openCalendar();

      const grid = screen.getByRole("grid");
      // Move focus right to Feb 18
      fireEvent.keyDown(grid, { key: "ArrowRight" });
      // Press Enter to select
      fireEvent.keyDown(grid, { key: "Enter" });

      expect(onChange).toHaveBeenCalledWith("2026-02-18");
    });

    it("Space on focused date selects it and calls onChange", () => {
      const onChange = vi.fn();
      render(<DatePicker value="2026-02-17" onChange={onChange} />);
      openCalendar();

      const grid = screen.getByRole("grid");
      // Move focus right to Feb 18
      fireEvent.keyDown(grid, { key: "ArrowRight" });
      // Press Space to select
      fireEvent.keyDown(grid, { key: " " });

      expect(onChange).toHaveBeenCalledWith("2026-02-18");
    });

    it("arrow navigation across month boundary updates the view month", () => {
      // Feb 28, 2026 is the last day of February
      render(<DatePicker value="2026-02-28" onChange={vi.fn()} />);
      fireEvent.click(screen.getByText("Feb 28, 2026"));
      expect(screen.getByText("February 2026")).toBeTruthy();

      const grid = screen.getByRole("grid");
      // ArrowRight from Feb 28 goes to Mar 1
      fireEvent.keyDown(grid, { key: "ArrowRight" });

      // View should switch to March
      expect(screen.getByText("March 2026")).toBeTruthy();
    });

    it("arrow keys call preventDefault to avoid scroll", () => {
      render(<DatePicker value="2026-02-17" onChange={vi.fn()} />);
      openCalendar();

      const grid = screen.getByRole("grid");

      // fireEvent.keyDown creates and dispatches a real DOM event.
      // React's onKeyDown handler calls e.preventDefault() on arrow keys.
      // After dispatching, we can check the returned event's defaultPrevented.
      const prevented = fireEvent.keyDown(grid, { key: "ArrowRight" });
      // fireEvent returns false when preventDefault was called
      expect(prevented).toBe(false);
    });

    it("keyboard navigation does NOT select disabled dates with Enter", () => {
      const onChange = vi.fn();
      // min is Feb 17, value is Feb 17
      render(
        <DatePicker value="2026-02-17" onChange={onChange} min="2026-02-17" />
      );
      openCalendar();

      const grid = screen.getByRole("grid");
      // Move focus left to Feb 16 (disabled because before min)
      fireEvent.keyDown(grid, { key: "ArrowLeft" });
      // Try to select with Enter
      fireEvent.keyDown(grid, { key: "Enter" });

      expect(onChange).not.toHaveBeenCalled();
    });

    it("keyboard navigation does NOT select disabled dates with Space", () => {
      const onChange = vi.fn();
      render(
        <DatePicker value="2026-02-17" onChange={onChange} max="2026-02-17" />
      );
      openCalendar();

      const grid = screen.getByRole("grid");
      // Move focus right to Feb 18 (disabled because after max)
      fireEvent.keyDown(grid, { key: "ArrowRight" });
      // Try to select with Space
      fireEvent.keyDown(grid, { key: " " });

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  // ─── Focus Management ──────────────────────────────────────

  describe("focus management", () => {
    it("grid receives focus when dropdown opens", () => {
      render(<DatePicker value="2026-02-17" onChange={vi.fn()} />);
      openCalendar();

      const grid = screen.getByRole("grid");
      expect(document.activeElement).toBe(grid);
    });

    it("focus returns to trigger button after selecting a date", () => {
      const onChange = vi.fn();
      render(<DatePicker value="" onChange={onChange} />);
      openCalendar();

      const feb20 = screen.getByLabelText("Friday, February 20, 2026");
      fireEvent.click(feb20);

      const trigger = screen.getByRole("button");
      expect(document.activeElement).toBe(trigger);
    });

    it("focus returns to trigger button after pressing Escape", () => {
      render(<DatePicker value="2026-02-17" onChange={vi.fn()} />);
      openCalendar();

      fireEvent.keyDown(document, { key: "Escape" });

      const trigger = screen.getByRole("button");
      expect(document.activeElement).toBe(trigger);
    });

    it("focus returns to trigger button after +1 Month shortcut", () => {
      render(<DatePicker value="2026-02-17" onChange={vi.fn()} />);
      openCalendar();

      fireEvent.click(screen.getByText("+1 Month"));

      const trigger = screen.getByRole("button");
      expect(document.activeElement).toBe(trigger);
    });
  });

  // ─── Escape Key Behavior ───────────────────────────────────

  describe("Escape key behavior", () => {
    it("Escape calls stopPropagation on the event", () => {
      render(<DatePicker value="2026-02-17" onChange={vi.fn()} />);
      openCalendar();

      const escEvent = new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      });
      const stopSpy = vi.spyOn(escEvent, "stopPropagation");

      act(() => {
        document.dispatchEvent(escEvent);
      });

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(stopSpy).toHaveBeenCalled();
    });
  });

  // ─── +1 Month Edge Cases ───────────────────────────────────

  describe("+1 Month edge cases", () => {
    it("+1 Month with no value set uses today as base", () => {
      const onChange = vi.fn();
      // No value set — today is Feb 17, 2026
      render(<DatePicker value="" onChange={onChange} />);

      fireEvent.click(screen.getByRole("button", { name: "Select a date" }));
      fireEvent.click(screen.getByText("+1 Month"));

      // Today (Feb 17) + 1 month = Mar 17
      expect(onChange).toHaveBeenCalledWith("2026-03-17");
    });

    it("+1 Month on Jan 31 produces Feb 28 (date-fns wraps correctly)", () => {
      const onChange = vi.fn();
      render(<DatePicker value="2026-01-31" onChange={onChange} />);

      fireEvent.click(screen.getByText("Jan 31, 2026"));
      fireEvent.click(screen.getByText("+1 Month"));

      // date-fns addMonths(Jan 31, 1) => Feb 28, 2026 (non-leap year)
      expect(onChange).toHaveBeenCalledWith("2026-02-28");
    });

    it("+1 Month when target is within min/max range works", () => {
      const onChange = vi.fn();
      render(
        <DatePicker
          value="2026-02-17"
          onChange={onChange}
          min="2026-01-01"
          max="2026-12-31"
        />
      );

      fireEvent.click(screen.getByText("Feb 17, 2026"));
      fireEvent.click(screen.getByText("+1 Month"));

      expect(onChange).toHaveBeenCalledWith("2026-03-17");
    });
  });

  // ─── Clicking Days Outside Current Month ────────────────────

  describe("clicking days outside current month", () => {
    it("clicking a day from the previous month selects it and navigates to that month", () => {
      const onChange = vi.fn();
      // Feb 2026 starts on Sunday, calendar starts on Mon Jan 26
      render(<DatePicker value="2026-02-17" onChange={onChange} />);
      openCalendar();

      const jan26 = screen.getByLabelText("Monday, January 26, 2026");
      fireEvent.click(jan26);

      expect(onChange).toHaveBeenCalledWith("2026-01-26");
    });

    it("clicking a day from the next month selects it and navigates to that month", () => {
      const onChange = vi.fn();
      render(<DatePicker value="2026-02-17" onChange={onChange} />);
      openCalendar();

      // Feb 2026 ends on Saturday Feb 28. Calendar continues to Sunday Mar 1
      const mar1 = screen.getByLabelText("Sunday, March 1, 2026");
      fireEvent.click(mar1);

      expect(onChange).toHaveBeenCalledWith("2026-03-01");
    });
  });

  // ─── Min/Max Boundary Precision ─────────────────────────────

  describe("min/max boundary precision", () => {
    it("min date itself is selectable (not disabled)", () => {
      const onChange = vi.fn();
      render(
        <DatePicker value="" onChange={onChange} min="2026-02-15" />
      );
      openCalendar();

      const minDay = screen.getByLabelText("Sunday, February 15, 2026");
      expect(minDay).toHaveProperty("disabled", false);
      fireEvent.click(minDay);
      expect(onChange).toHaveBeenCalledWith("2026-02-15");
    });

    it("max date itself is selectable (not disabled)", () => {
      const onChange = vi.fn();
      render(
        <DatePicker value="" onChange={onChange} max="2026-02-20" />
      );
      openCalendar();

      const maxDay = screen.getByLabelText("Friday, February 20, 2026");
      expect(maxDay).toHaveProperty("disabled", false);
      fireEvent.click(maxDay);
      expect(onChange).toHaveBeenCalledWith("2026-02-20");
    });

    it("day exactly one day before min is disabled", () => {
      const onChange = vi.fn();
      render(
        <DatePicker value="" onChange={onChange} min="2026-02-15" />
      );
      openCalendar();

      const dayBeforeMin = screen.getByLabelText(
        "Saturday, February 14, 2026"
      );
      expect(dayBeforeMin).toHaveProperty("disabled", true);
      fireEvent.click(dayBeforeMin);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("day exactly one day after max is disabled", () => {
      const onChange = vi.fn();
      render(
        <DatePicker value="" onChange={onChange} max="2026-02-20" />
      );
      openCalendar();

      const dayAfterMax = screen.getByLabelText(
        "Saturday, February 21, 2026"
      );
      expect(dayAfterMax).toHaveProperty("disabled", true);
      fireEvent.click(dayAfterMax);
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  // ─── External Value Changes ─────────────────────────────────

  describe("external value changes", () => {
    it("when value prop changes externally, the view month updates", () => {
      const { rerender } = render(
        <DatePicker value="2026-02-17" onChange={vi.fn()} />
      );
      fireEvent.click(screen.getByText("Feb 17, 2026"));
      expect(screen.getByText("February 2026")).toBeTruthy();

      // Close calendar to reopen with new value
      fireEvent.keyDown(document, { key: "Escape" });

      // Change value to a March date
      rerender(<DatePicker value="2026-03-10" onChange={vi.fn()} />);
      fireEvent.click(screen.getByText("Mar 10, 2026"));

      expect(screen.getByText("March 2026")).toBeTruthy();
    });

    it("when value changes from one month to another, calendar shows new month", () => {
      const { rerender } = render(
        <DatePicker value="2026-01-15" onChange={vi.fn()} />
      );
      fireEvent.click(screen.getByText("Jan 15, 2026"));
      expect(screen.getByText("January 2026")).toBeTruthy();

      fireEvent.keyDown(document, { key: "Escape" });

      rerender(<DatePicker value="2026-06-20" onChange={vi.fn()} />);
      fireEvent.click(screen.getByText("Jun 20, 2026"));

      expect(screen.getByText("June 2026")).toBeTruthy();
    });
  });

  // ─── Close on Scroll/Resize ─────────────────────────────────

  describe("close on scroll/resize", () => {
    it("dropdown closes when window scroll event fires", () => {
      render(<DatePicker value="2026-02-17" onChange={vi.fn()} />);
      openCalendar();
      expect(screen.getByRole("dialog")).toBeTruthy();

      // The component listens with capture: true, so dispatch on window
      act(() => {
        window.dispatchEvent(new Event("scroll"));
      });

      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("dropdown closes when window resize event fires", () => {
      render(<DatePicker value="2026-02-17" onChange={vi.fn()} />);
      openCalendar();
      expect(screen.getByRole("dialog")).toBeTruthy();

      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  // ─── Invalid Value Handling ─────────────────────────────────

  describe("invalid value handling", () => {
    it("invalid date string shows placeholder", () => {
      render(
        <DatePicker
          value="not-a-date"
          onChange={vi.fn()}
          placeholder="Select a date"
        />
      );

      expect(screen.getByText("Select a date")).toBeTruthy();
    });

    it("empty string shows placeholder", () => {
      render(
        <DatePicker
          value=""
          onChange={vi.fn()}
          placeholder="Choose one"
        />
      );

      expect(screen.getByText("Choose one")).toBeTruthy();
    });
  });

  // ─── Label Association ──────────────────────────────────────

  describe("label association", () => {
    it("label's htmlFor matches trigger button's id", () => {
      render(
        <DatePicker label="Start Date" value="" onChange={vi.fn()} />
      );

      const label = screen.getByText("Start Date");
      const htmlFor = label.getAttribute("for");
      expect(htmlFor).toBeTruthy();

      const trigger = screen.getByRole("button", { name: "Start Date" });
      expect(trigger.id).toBe(htmlFor);
    });
  });

  // ─── Viewport Clamping ──────────────────────────────────────

  describe("viewport clamping of dropdown position", () => {
    it("clamps dropdown left position when near right edge of viewport", () => {
      // Mock the button to be positioned near the right edge
      const mockGetBoundingClientRect = vi.fn().mockReturnValue({
        bottom: 40,
        left: 900,
        right: 1000,
        top: 0,
        width: 100,
        height: 40,
        x: 900,
        y: 0,
        toJSON: vi.fn(),
      });

      // Mock window dimensions (small viewport)
      Object.defineProperty(window, "innerWidth", {
        value: 400,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, "innerHeight", {
        value: 800,
        writable: true,
        configurable: true,
      });

      render(<DatePicker value="" onChange={vi.fn()} />);

      // Get the trigger button and mock its getBoundingClientRect
      const trigger = screen.getByRole("button", { name: "Select a date" });
      trigger.getBoundingClientRect = mockGetBoundingClientRect;

      // Open the calendar
      fireEvent.click(trigger);

      // The dropdown should be clamped. With innerWidth=400, dropdownWidth=320,
      // max left = 400 - 320 - 8 = 72. And clampedLeft = min(900, 72) = 72.
      // Then finalLeft = max(8, 72) = 72.
      const dialog = screen.getByRole("dialog", { name: "Choose date" });
      const leftValue = parseInt(dialog.style.left, 10);
      expect(leftValue).toBeLessThanOrEqual(400 - 320);
    });

    it("clamps dropdown left position to minimum of 8px from left edge", () => {
      const mockGetBoundingClientRect = vi.fn().mockReturnValue({
        bottom: 40,
        left: -100, // Button positioned off-screen to the left
        right: 0,
        top: 0,
        width: 100,
        height: 40,
        x: -100,
        y: 0,
        toJSON: vi.fn(),
      });

      Object.defineProperty(window, "innerWidth", {
        value: 400,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, "innerHeight", {
        value: 800,
        writable: true,
        configurable: true,
      });

      render(<DatePicker value="" onChange={vi.fn()} />);

      const trigger = screen.getByRole("button", { name: "Select a date" });
      trigger.getBoundingClientRect = mockGetBoundingClientRect;

      fireEvent.click(trigger);

      const dialog = screen.getByRole("dialog", { name: "Choose date" });
      const leftValue = parseInt(dialog.style.left, 10);
      // finalLeft = max(8, clampedLeft) so it should be at least 8
      expect(leftValue).toBeGreaterThanOrEqual(8);
    });

    it("positions dropdown above trigger when near bottom of viewport", () => {
      const mockGetBoundingClientRect = vi.fn().mockReturnValue({
        bottom: 750, // Near bottom of viewport
        left: 50,
        right: 150,
        top: 710,
        width: 100,
        height: 40,
        x: 50,
        y: 710,
        toJSON: vi.fn(),
      });

      Object.defineProperty(window, "innerWidth", {
        value: 400,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, "innerHeight", {
        value: 800, // Viewport height
        writable: true,
        configurable: true,
      });

      render(<DatePicker value="" onChange={vi.fn()} />);

      const trigger = screen.getByRole("button", { name: "Select a date" });
      trigger.getBoundingClientRect = mockGetBoundingClientRect;

      fireEvent.click(trigger);

      const dialog = screen.getByRole("dialog", { name: "Choose date" });
      const topValue = parseInt(dialog.style.top, 10);
      // rawTop = 750 + 4 = 754
      // rawTop + dropdownHeight = 754 + 340 = 1094 > 800
      // So it should flip above: 754 - 340 - 4 = 410
      expect(topValue).toBeLessThan(750);
    });

    it("positions dropdown below trigger when there is enough space", () => {
      const mockGetBoundingClientRect = vi.fn().mockReturnValue({
        bottom: 40,
        left: 50,
        right: 150,
        top: 0,
        width: 100,
        height: 40,
        x: 50,
        y: 0,
        toJSON: vi.fn(),
      });

      Object.defineProperty(window, "innerWidth", {
        value: 800,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, "innerHeight", {
        value: 800,
        writable: true,
        configurable: true,
      });

      render(<DatePicker value="" onChange={vi.fn()} />);

      const trigger = screen.getByRole("button", { name: "Select a date" });
      trigger.getBoundingClientRect = mockGetBoundingClientRect;

      fireEvent.click(trigger);

      const dialog = screen.getByRole("dialog", { name: "Choose date" });
      const topValue = parseInt(dialog.style.top, 10);
      // rawTop = 40 + 4 = 44
      // 44 + 340 = 384 < 800, so should remain at 44
      expect(topValue).toBe(44);
    });
  });
});
