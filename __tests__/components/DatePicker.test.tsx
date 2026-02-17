/**
 * DatePicker Unit Tests
 *
 * Tests rendering, calendar interaction, date selection,
 * month navigation, min/max constraints, error/help text,
 * disabled state, and keyboard interaction.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

  // ─── Today Shortcut ───────────────────────────────────────

  it("Today shortcut button selects today's date", () => {
    const onChange = vi.fn();
    render(<DatePicker value="" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Select a date" }));

    const todayButton = screen.getByRole("button", { name: "Today" });
    fireEvent.click(todayButton);

    expect(onChange).toHaveBeenCalledWith("2026-02-17");
  });

  it("Today shortcut closes the calendar", () => {
    render(<DatePicker value="" onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Select a date" }));
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Today shortcut is disabled when today is before min date", () => {
    render(
      <DatePicker value="" onChange={vi.fn()} min="2026-03-01" />
    );

    fireEvent.click(screen.getByRole("button", { name: "Select a date" }));

    const todayButton = screen.getByRole("button", { name: "Today" });
    expect(todayButton).toHaveProperty("disabled", true);
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
});
