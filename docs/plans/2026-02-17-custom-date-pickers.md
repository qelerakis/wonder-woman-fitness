# Custom DatePicker & DateTimePicker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all native `<input type="date">` and `<input type="datetime-local">` fields with custom-built, dark-themed calendar components that match the Wonder Woman Fitness brand.

**Architecture:** Two new UI components — `DatePicker` (date only) and `DateTimePicker` (date + time). Both render a styled input that opens a dropdown calendar on click. The calendar uses the site's `surface-*` dark palette with `primary-*` purple accents. No new dependencies — built with React, date-fns (already installed), and Tailwind.

**Tech Stack:** React, TypeScript, Tailwind CSS 4, date-fns, Vitest + Testing Library

---

## Task 1: Build the DatePicker Component

**Files:**
- Create: `components/ui/DatePicker.tsx`

**Step 1: Create DatePicker with full implementation**

Create `components/ui/DatePicker.tsx` with:

```tsx
"use client";

import { useState, useRef, useEffect, useId, useCallback } from "react";
import {
  format,
  parse,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  isToday,
  isBefore,
  isAfter,
} from "date-fns";

interface DatePickerProps {
  label?: string;
  value: string;                // "YYYY-MM-DD"
  onChange: (value: string) => void;
  error?: string;
  helpText?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  placeholder?: string;
}

export function DatePicker({
  label,
  value,
  onChange,
  error,
  helpText,
  min,
  max,
  disabled = false,
  placeholder = "Select date",
}: DatePickerProps): React.ReactElement {
  const id = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    if (value) {
      return parse(value, "yyyy-MM-dd", new Date());
    }
    return new Date();
  });
  const [focusedDate, setFocusedDate] = useState<Date | null>(null);

  const selectedDate = value ? parse(value, "yyyy-MM-dd", new Date()) : null;
  const minDate = min ? parse(min, "yyyy-MM-dd", new Date()) : null;
  const maxDate = max ? parse(max, "yyyy-MM-dd", new Date()) : null;

  // Display text for the input
  const displayValue = selectedDate ? format(selectedDate, "MMM d, yyyy") : "";

  // Generate calendar grid days
  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  function isDateDisabled(date: Date): boolean {
    if (minDate && isBefore(date, minDate)) return true;
    if (maxDate && isAfter(date, maxDate)) return true;
    return false;
  }

  function handleSelectDay(day: Date): void {
    if (isDateDisabled(day)) return;
    onChange(format(day, "yyyy-MM-dd"));
    setIsOpen(false);
  }

  function handlePrevMonth(): void {
    setViewDate((d) => subMonths(d, 1));
  }

  function handleNextMonth(): void {
    setViewDate((d) => addMonths(d, 1));
  }

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Sync viewDate when value changes externally
  useEffect(() => {
    if (value) {
      setViewDate(parse(value, "yyyy-MM-dd", new Date()));
    }
  }, [value]);

  // Initialize focused date when opening
  useEffect(() => {
    if (isOpen) {
      setFocusedDate(selectedDate || new Date());
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard navigation within calendar
  const handleCalendarKeyDown = useCallback(
    (e: React.KeyboardEvent): void => {
      if (!focusedDate) return;

      let newDate: Date | null = null;

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          newDate = new Date(focusedDate);
          newDate.setDate(newDate.getDate() - 1);
          break;
        case "ArrowRight":
          e.preventDefault();
          newDate = new Date(focusedDate);
          newDate.setDate(newDate.getDate() + 1);
          break;
        case "ArrowUp":
          e.preventDefault();
          newDate = new Date(focusedDate);
          newDate.setDate(newDate.getDate() - 7);
          break;
        case "ArrowDown":
          e.preventDefault();
          newDate = new Date(focusedDate);
          newDate.setDate(newDate.getDate() + 7);
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (!isDateDisabled(focusedDate)) {
            handleSelectDay(focusedDate);
          }
          return;
      }

      if (newDate) {
        setFocusedDate(newDate);
        if (!isSameMonth(newDate, viewDate)) {
          setViewDate(startOfMonth(newDate));
        }
      }
    },
    [focusedDate, viewDate] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const weekDays = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

  return (
    <div className="w-full" ref={containerRef}>
      {label && (
        <label
          htmlFor={id}
          className="mb-1.5 block text-sm font-medium text-surface-200"
        >
          {label}
        </label>
      )}

      {/* Trigger input */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-invalid={!!error}
        aria-describedby={
          error ? `${id}-error` : helpText ? `${id}-help` : undefined
        }
        className={`
          flex w-full items-center rounded-lg border px-3 py-2 text-left text-sm
          bg-surface-800 transition-colors duration-150
          focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-surface-900
          disabled:cursor-not-allowed disabled:opacity-50
          ${
            error
              ? "border-error-500 focus:ring-error-500"
              : "border-surface-600 focus:ring-primary-500 hover:border-surface-500"
          }
        `.trim()}
      >
        <span className={displayValue ? "text-surface-100" : "text-surface-500"}>
          {displayValue || placeholder}
        </span>
        {/* Calendar icon */}
        <svg
          className="ml-auto h-4 w-4 text-surface-400"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Dropdown calendar */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Choose date"
          className="absolute z-50 mt-1 w-72 rounded-xl border border-surface-600 bg-surface-800 p-3 shadow-xl shadow-black/30"
          onKeyDown={handleCalendarKeyDown}
          tabIndex={-1}
        >
          {/* Month/year header */}
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-700 hover:text-surface-100 transition-colors"
              aria-label="Previous month"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-surface-100">
              {format(viewDate, "MMMM yyyy")}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-700 hover:text-surface-100 transition-colors"
              aria-label="Next month"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {/* Weekday headers */}
          <div className="mb-1 grid grid-cols-7 text-center">
            {weekDays.map((day) => (
              <div key={day} className="py-1 text-xs font-medium text-surface-500">
                {day}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day) => {
              const inCurrentMonth = isSameMonth(day, viewDate);
              const selected = selectedDate && isSameDay(day, selectedDate);
              const today = isToday(day);
              const disabled = isDateDisabled(day);
              const focused = focusedDate && isSameDay(day, focusedDate);

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleSelectDay(day)}
                  tabIndex={focused ? 0 : -1}
                  className={`
                    relative mx-auto flex h-8 w-8 items-center justify-center rounded-lg text-sm
                    transition-colors duration-100
                    ${disabled ? "cursor-not-allowed text-surface-600" : "cursor-pointer"}
                    ${!inCurrentMonth && !selected ? "text-surface-600" : ""}
                    ${inCurrentMonth && !selected && !disabled ? "text-surface-200 hover:bg-surface-700" : ""}
                    ${selected ? "bg-primary-600 text-white font-semibold" : ""}
                    ${today && !selected ? "ring-1 ring-primary-500" : ""}
                    ${focused && !selected ? "bg-surface-700" : ""}
                  `.trim()}
                  aria-label={format(day, "EEEE, MMMM d, yyyy")}
                  aria-selected={!!selected}
                  aria-current={today ? "date" : undefined}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>

          {/* Today shortcut */}
          <div className="mt-2 border-t border-surface-700 pt-2">
            <button
              type="button"
              onClick={() => {
                const today = new Date();
                if (!isDateDisabled(today)) {
                  handleSelectDay(today);
                }
              }}
              className="w-full rounded-lg py-1 text-xs font-medium text-primary-400 hover:bg-surface-700 transition-colors"
            >
              Today
            </button>
          </div>
        </div>
      )}

      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-error-500" role="alert">
          {error}
        </p>
      )}
      {!error && helpText && (
        <p id={`${id}-help`} className="mt-1.5 text-sm text-surface-400">
          {helpText}
        </p>
      )}
    </div>
  );
}

export type { DatePickerProps };
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: zero errors

**Step 3: Commit**

```bash
git add components/ui/DatePicker.tsx
git commit -m "feat: add custom DatePicker component with dark theme calendar"
```

---

## Task 2: Build the DateTimePicker Component

**Files:**
- Create: `components/ui/DateTimePicker.tsx`

**Step 1: Create DateTimePicker with full implementation**

Create `components/ui/DateTimePicker.tsx`. This wraps the same calendar UI as DatePicker but adds a time selector below. The value format is `"YYYY-MM-DDTHH:mm"` (same as `datetime-local`).

```tsx
"use client";

import { useState, useRef, useEffect, useId, useCallback } from "react";
import {
  format,
  parse,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  isToday,
  isBefore,
  isAfter,
} from "date-fns";

interface DateTimePickerProps {
  label?: string;
  value: string;                // "YYYY-MM-DDTHH:mm"
  onChange: (value: string) => void;
  error?: string;
  helpText?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  placeholder?: string;
}

export function DateTimePicker({
  label,
  value,
  onChange,
  error,
  helpText,
  min,
  max,
  disabled = false,
  placeholder = "Select date and time",
}: DateTimePickerProps): React.ReactElement {
  const id = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Parse the value into date and time parts
  const [datePart, timePart] = value ? value.split("T") : ["", ""];
  const selectedDate = datePart ? parse(datePart, "yyyy-MM-dd", new Date()) : null;

  // Parse time into hour/minute
  const [initialHour, initialMinute] = timePart
    ? timePart.split(":").map(Number)
    : [new Date().getHours(), Math.floor(new Date().getMinutes() / 15) * 15];

  const [viewDate, setViewDate] = useState(() => {
    if (datePart) {
      return parse(datePart, "yyyy-MM-dd", new Date());
    }
    return new Date();
  });
  const [focusedDate, setFocusedDate] = useState<Date | null>(null);
  const [selectedHour, setSelectedHour] = useState(initialHour);
  const [selectedMinute, setSelectedMinute] = useState(initialMinute);

  // Track the selected date within the calendar (before Done is clicked)
  const [pendingDate, setPendingDate] = useState<string>(datePart || "");

  const minDate = min ? parse(min.split("T")[0], "yyyy-MM-dd", new Date()) : null;
  const maxDate = max ? parse(max.split("T")[0], "yyyy-MM-dd", new Date()) : null;

  // Display text
  const displayValue = selectedDate
    ? format(selectedDate, "MMM d, yyyy") +
      ` at ${String(selectedHour).padStart(2, "0")}:${String(selectedMinute).padStart(2, "0")}`
    : "";

  // Generate calendar grid
  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  function isDateDisabled(date: Date): boolean {
    if (minDate && isBefore(date, minDate)) return true;
    if (maxDate && isAfter(date, maxDate)) return true;
    return false;
  }

  function handleSelectDay(day: Date): void {
    if (isDateDisabled(day)) return;
    setPendingDate(format(day, "yyyy-MM-dd"));
  }

  function handleDone(): void {
    if (!pendingDate) return;
    const hh = String(selectedHour).padStart(2, "0");
    const mm = String(selectedMinute).padStart(2, "0");
    onChange(`${pendingDate}T${hh}:${mm}`);
    setIsOpen(false);
  }

  function handlePrevMonth(): void {
    setViewDate((d) => subMonths(d, 1));
  }

  function handleNextMonth(): void {
    setViewDate((d) => addMonths(d, 1));
  }

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        // Auto-confirm on close if a date is pending
        if (pendingDate) {
          const hh = String(selectedHour).padStart(2, "0");
          const mm = String(selectedMinute).padStart(2, "0");
          onChange(`${pendingDate}T${hh}:${mm}`);
        }
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, pendingDate, selectedHour, selectedMinute, onChange]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Sync viewDate when value changes externally
  useEffect(() => {
    if (value) {
      const [dp, tp] = value.split("T");
      if (dp) setViewDate(parse(dp, "yyyy-MM-dd", new Date()));
      if (tp) {
        const [h, m] = tp.split(":").map(Number);
        setSelectedHour(h);
        setSelectedMinute(m);
      }
      setPendingDate(dp || "");
    }
  }, [value]);

  // Initialize focused date when opening
  useEffect(() => {
    if (isOpen) {
      setFocusedDate(selectedDate || new Date());
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard navigation
  const handleCalendarKeyDown = useCallback(
    (e: React.KeyboardEvent): void => {
      if (!focusedDate) return;

      let newDate: Date | null = null;

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          newDate = new Date(focusedDate);
          newDate.setDate(newDate.getDate() - 1);
          break;
        case "ArrowRight":
          e.preventDefault();
          newDate = new Date(focusedDate);
          newDate.setDate(newDate.getDate() + 1);
          break;
        case "ArrowUp":
          e.preventDefault();
          newDate = new Date(focusedDate);
          newDate.setDate(newDate.getDate() - 7);
          break;
        case "ArrowDown":
          e.preventDefault();
          newDate = new Date(focusedDate);
          newDate.setDate(newDate.getDate() + 7);
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (!isDateDisabled(focusedDate)) {
            handleSelectDay(focusedDate);
          }
          return;
      }

      if (newDate) {
        setFocusedDate(newDate);
        if (!isSameMonth(newDate, viewDate)) {
          setViewDate(startOfMonth(newDate));
        }
      }
    },
    [focusedDate, viewDate] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Pending date as Date object for highlighting
  const pendingDateObj = pendingDate
    ? parse(pendingDate, "yyyy-MM-dd", new Date())
    : null;

  const weekDays = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = [0, 15, 30, 45];

  return (
    <div className="w-full" ref={containerRef}>
      {label && (
        <label
          htmlFor={id}
          className="mb-1.5 block text-sm font-medium text-surface-200"
        >
          {label}
        </label>
      )}

      {/* Trigger button */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-invalid={!!error}
        aria-describedby={
          error ? `${id}-error` : helpText ? `${id}-help` : undefined
        }
        className={`
          flex w-full items-center rounded-lg border px-3 py-2 text-left text-sm
          bg-surface-800 transition-colors duration-150
          focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-surface-900
          disabled:cursor-not-allowed disabled:opacity-50
          ${
            error
              ? "border-error-500 focus:ring-error-500"
              : "border-surface-600 focus:ring-primary-500 hover:border-surface-500"
          }
        `.trim()}
      >
        <span className={displayValue ? "text-surface-100" : "text-surface-500"}>
          {displayValue || placeholder}
        </span>
        <svg
          className="ml-auto h-4 w-4 text-surface-400"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Dropdown calendar + time */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Choose date and time"
          className="absolute z-50 mt-1 w-72 rounded-xl border border-surface-600 bg-surface-800 p-3 shadow-xl shadow-black/30"
          onKeyDown={handleCalendarKeyDown}
          tabIndex={-1}
        >
          {/* Month/year header */}
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-700 hover:text-surface-100 transition-colors"
              aria-label="Previous month"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-surface-100">
              {format(viewDate, "MMMM yyyy")}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-700 hover:text-surface-100 transition-colors"
              aria-label="Next month"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {/* Weekday headers */}
          <div className="mb-1 grid grid-cols-7 text-center">
            {weekDays.map((day) => (
              <div key={day} className="py-1 text-xs font-medium text-surface-500">
                {day}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day) => {
              const inCurrentMonth = isSameMonth(day, viewDate);
              const selected = pendingDateObj && isSameDay(day, pendingDateObj);
              const today = isToday(day);
              const dayDisabled = isDateDisabled(day);
              const focused = focusedDate && isSameDay(day, focusedDate);

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  disabled={dayDisabled}
                  onClick={() => handleSelectDay(day)}
                  tabIndex={focused ? 0 : -1}
                  className={`
                    relative mx-auto flex h-8 w-8 items-center justify-center rounded-lg text-sm
                    transition-colors duration-100
                    ${dayDisabled ? "cursor-not-allowed text-surface-600" : "cursor-pointer"}
                    ${!inCurrentMonth && !selected ? "text-surface-600" : ""}
                    ${inCurrentMonth && !selected && !dayDisabled ? "text-surface-200 hover:bg-surface-700" : ""}
                    ${selected ? "bg-primary-600 text-white font-semibold" : ""}
                    ${today && !selected ? "ring-1 ring-primary-500" : ""}
                    ${focused && !selected ? "bg-surface-700" : ""}
                  `.trim()}
                  aria-label={format(day, "EEEE, MMMM d, yyyy")}
                  aria-selected={!!selected}
                  aria-current={today ? "date" : undefined}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>

          {/* Time selector */}
          <div className="mt-2 border-t border-surface-700 pt-2">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-surface-400">Time</label>
              <select
                value={selectedHour}
                onChange={(e) => setSelectedHour(Number(e.target.value))}
                className="flex-1 rounded-lg border border-surface-600 bg-surface-900 px-2 py-1 text-sm text-surface-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                aria-label="Hour"
              >
                {hours.map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}
                  </option>
                ))}
              </select>
              <span className="text-surface-400 font-medium">:</span>
              <select
                value={selectedMinute}
                onChange={(e) => setSelectedMinute(Number(e.target.value))}
                className="flex-1 rounded-lg border border-surface-600 bg-surface-900 px-2 py-1 text-sm text-surface-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                aria-label="Minute"
              >
                {minutes.map((m) => (
                  <option key={m} value={m}>
                    {String(m).padStart(2, "0")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Done button */}
          <div className="mt-2">
            <button
              type="button"
              onClick={handleDone}
              disabled={!pendingDate}
              className="w-full rounded-lg bg-primary-600 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-error-500" role="alert">
          {error}
        </p>
      )}
      {!error && helpText && (
        <p id={`${id}-help`} className="mt-1.5 text-sm text-surface-400">
          {helpText}
        </p>
      )}
    </div>
  );
}

export type { DateTimePickerProps };
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: zero errors

**Step 3: Commit**

```bash
git add components/ui/DateTimePicker.tsx
git commit -m "feat: add custom DateTimePicker component with dark theme calendar + time selector"
```

---

## Task 3: Write Tests for DatePicker

**Files:**
- Create: `__tests__/components/DatePicker.test.tsx`

**Step 1: Write test file**

Tests to cover:
1. Renders with label and placeholder
2. Displays formatted date when value is set
3. Opens calendar on click
4. Closes on outside click
5. Closes on Escape
6. Selects a day and calls onChange with YYYY-MM-DD format
7. Shows current month name and year
8. Navigates to previous month
9. Navigates to next month
10. Highlights today with ring
11. Highlights selected date with primary background
12. Dims days outside current month
13. Disables days before min
14. Disables days after max
15. Shows error message
16. Shows help text
17. Disabled state prevents opening
18. Today shortcut selects today's date

Use `@testing-library/react` and `vitest`. Follow existing test patterns from `__tests__/components/Button.test.tsx`.

**Step 2: Run tests**

Run: `npm test -- __tests__/components/DatePicker.test.tsx`
Expected: all tests pass

**Step 3: Commit**

```bash
git add __tests__/components/DatePicker.test.tsx
git commit -m "test: add DatePicker component tests"
```

---

## Task 4: Write Tests for DateTimePicker

**Files:**
- Create: `__tests__/components/DateTimePicker.test.tsx`

**Step 1: Write test file**

Tests to cover:
1. Renders with label and placeholder
2. Displays formatted date and time when value is set
3. Opens calendar on click
4. Selects a day (does NOT close — stays open for time)
5. Shows hour and minute selects
6. Done button calls onChange with YYYY-MM-DDTHH:mm format
7. Done button is disabled when no date selected
8. Changes hour via select
9. Changes minute via select (15-min increments)
10. Closing via outside click auto-confirms pending selection
11. Shows error message
12. Disabled state prevents opening

**Step 2: Run tests**

Run: `npm test -- __tests__/components/DateTimePicker.test.tsx`
Expected: all tests pass

**Step 3: Commit**

```bash
git add __tests__/components/DateTimePicker.test.tsx
git commit -m "test: add DateTimePicker component tests"
```

---

## Task 5: Integrate into PaymentForm.tsx

**Files:**
- Modify: `components/payment/PaymentForm.tsx:1-162`

**Step 1: Swap inputs**

Replace the import and the 3 date inputs:

1. Add imports: `import { DatePicker } from "@/components/ui/DatePicker";` and `import { DateTimePicker } from "@/components/ui/DateTimePicker";`
2. Line 109-115: Replace `<Input label="Paid At" type="datetime-local" ...>` with `<DateTimePicker label="Paid At" value={paidAt} onChange={(v) => setPaidAt(v)} error={errors.paidAt} />`
3. Lines 118-131: Replace the two `<Input type="date">` with `<DatePicker>`:
   - `<DatePicker label="Period Start" value={periodStart} onChange={(v) => setPeriodStart(v)} error={errors.periodStart} />`
   - `<DatePicker label="Period End" value={periodEnd} onChange={(v) => setPeriodEnd(v)} error={errors.periodEnd} />`

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: zero errors

**Step 3: Commit**

```bash
git add components/payment/PaymentForm.tsx
git commit -m "feat: use custom DatePicker/DateTimePicker in PaymentForm"
```

---

## Task 6: Integrate into PaymentHistory.tsx

**Files:**
- Modify: `components/payment/PaymentHistory.tsx:259-280`

**Step 1: Swap inputs in edit modal**

1. Add imports for `DatePicker` and `DateTimePicker`
2. Line 259-265: Replace `<Input label="Paid At" type="datetime-local" ...>` with `<DateTimePicker>`
3. Lines 267-280: Replace the two `<Input type="date">` with `<DatePicker>`

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: zero errors

**Step 3: Commit**

```bash
git add components/payment/PaymentHistory.tsx
git commit -m "feat: use custom DatePicker/DateTimePicker in PaymentHistory edit modal"
```

---

## Task 7: Integrate into MemberDetailClient.tsx

**Files:**
- Modify: `app/(owner)/members/[id]/MemberDetailClient.tsx:451-473`

**Step 1: Swap inputs in Record Payment modal**

1. Add imports for `DatePicker` and `DateTimePicker`
2. Line 451-457: Replace `<Input label="Paid At" type="datetime-local" ...>` with `<DateTimePicker>`
3. Lines 460-473: Replace the two `<Input type="date">` with `<DatePicker>`

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: zero errors

**Step 3: Commit**

```bash
git add app/(owner)/members/[id]/MemberDetailClient.tsx
git commit -m "feat: use custom DatePicker/DateTimePicker in member detail payment modal"
```

---

## Task 8: Integrate into TrainerPaymentsClient.tsx

**Files:**
- Modify: `app/(trainer)/trainer/payments/TrainerPaymentsClient.tsx:472-494`

**Step 1: Swap inputs**

1. Add imports for `DatePicker` and `DateTimePicker`
2. Line 472-478: Replace `<Input label="Paid At" type="datetime-local" ...>` with `<DateTimePicker>`
3. Lines 481-494: Replace the two `<Input type="date">` with `<DatePicker>`

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: zero errors

**Step 3: Commit**

```bash
git add app/(trainer)/trainer/payments/TrainerPaymentsClient.tsx
git commit -m "feat: use custom DatePicker/DateTimePicker in trainer payment modal"
```

---

## Task 9: Integrate into PaymentsClient.tsx

**Files:**
- Modify: `app/(owner)/payments/PaymentsClient.tsx:583-605`

**Step 1: Swap inputs**

1. Add imports for `DatePicker` and `DateTimePicker`
2. Line 583-589: Replace `<Input label="Paid At" type="datetime-local" ...>` with `<DateTimePicker>`
3. Lines 592-605: Replace the two `<Input type="date">` with `<DatePicker>`

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: zero errors

**Step 3: Commit**

```bash
git add app/(owner)/payments/PaymentsClient.tsx
git commit -m "feat: use custom DatePicker/DateTimePicker in owner payments modal"
```

---

## Task 10: Integrate into PrivateSessionsClient.tsx

**Files:**
- Modify: `app/(owner)/private-sessions/PrivateSessionsClient.tsx:471-477`

**Step 1: Swap input**

1. Add import for `DateTimePicker`
2. Lines 471-477: Replace `<Input label="Scheduled At" type="datetime-local" ...>` with `<DateTimePicker>`

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: zero errors

**Step 3: Commit**

```bash
git add app/(owner)/private-sessions/PrivateSessionsClient.tsx
git commit -m "feat: use custom DateTimePicker in private sessions modal"
```

---

## Task 11: Integrate into DateRangeFilter.tsx

**Files:**
- Modify: `components/analytics/DateRangeFilter.tsx:106-117`

**Step 1: Swap inputs**

1. Add import for `DatePicker`
2. Lines 106-111: Replace `<Input label="From" type="date" ...>` with `<DatePicker label="From" value={localStart} onChange={(v) => setLocalStart(v)} />`
3. Lines 112-117: Replace `<Input label="To" type="date" ...>` with `<DatePicker label="To" value={localEnd} onChange={(v) => setLocalEnd(v)} />`

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: zero errors

**Step 3: Commit**

```bash
git add components/analytics/DateRangeFilter.tsx
git commit -m "feat: use custom DatePicker in analytics date range filter"
```

---

## Task 12: Run Full Test Suite & Fix Any Breakages

**Step 1: Run full test suite**

Run: `npm test`
Expected: all tests pass (615 existing + new DatePicker/DateTimePicker tests)

**Step 2: Fix any failing tests**

Existing tests may need updates if they query by `<input type="date">` or `<input type="datetime-local">`. The new components use `<button>` triggers instead of `<input>` elements. Check failing tests and update selectors:
- Instead of finding `input[type="date"]`, find by label text
- Instead of simulating `change` event on an input, click the trigger button + click a day cell

**Step 3: Run lint**

Run: `npm run lint`
Expected: zero new warnings

**Step 4: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: zero errors

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: update tests for custom date picker integration"
```

---

## Task 13: Relative Positioning Fix

**Step 1: Ensure dropdown positioning works inside modals**

The calendar dropdown uses `position: absolute`. The parent container (`<div className="w-full">`) needs `position: relative` so the dropdown positions correctly. Add `relative` to the container div in both DatePicker and DateTimePicker.

Also, inside modals with `overflow-y: auto` (the Modal component has `max-h-[85vh] overflow-y-auto`), absolute dropdowns can get clipped. If this is an issue, add `overflow-visible` to the calendar's parent or use a portal approach. Test this in the actual modal by opening a date picker near the bottom of the modal.

**Step 2: Verify visually**

Run: `npm run dev`
Open a payment modal, click a date picker, verify the calendar:
- Positions correctly below the input
- Is not clipped by the modal's overflow
- Closes when clicking outside
- Matches the dark theme

**Step 3: Commit if changes made**

```bash
git add components/ui/DatePicker.tsx components/ui/DateTimePicker.tsx
git commit -m "fix: ensure date picker dropdown positions correctly inside modals"
```
