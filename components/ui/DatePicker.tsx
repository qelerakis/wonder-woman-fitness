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
  addDays,
  subDays,
} from "date-fns";

interface DatePickerProps {
  label?: string;
  value: string; // "YYYY-MM-DD" format
  onChange: (value: string) => void;
  error?: string;
  helpText?: string;
  min?: string; // min date "YYYY-MM-DD"
  max?: string; // max date "YYYY-MM-DD"
  disabled?: boolean;
  placeholder?: string;
}

const WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parsed = parse(dateStr, "yyyy-MM-dd", new Date());
  if (isNaN(parsed.getTime())) return null;
  return parsed;
}

function formatISO(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function DatePicker({
  label,
  value,
  onChange,
  error,
  helpText,
  min,
  max,
  disabled = false,
  placeholder = "Select a date",
}: DatePickerProps): React.ReactElement {
  const generatedId = useId();
  const triggerId = `datepicker-trigger-${generatedId}`;
  const errorId = `${triggerId}-error`;
  const helpId = `${triggerId}-help`;

  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState<Date>(() => {
    const parsed = parseDate(value);
    return parsed ?? new Date();
  });
  const [focusedDate, setFocusedDate] = useState<Date | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const selectedDate = parseDate(value);
  const minDate = min ? parseDate(min) : null;
  const maxDate = max ? parseDate(max) : null;

  // Sync viewDate when value changes externally
  useEffect(() => {
    const parsed = parseDate(value);
    if (parsed) {
      setViewDate(parsed);
    }
  }, [value]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent): void {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setFocusedDate(null);
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
        setFocusedDate(null);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const isDayDisabled = useCallback(
    (date: Date): boolean => {
      if (minDate && isBefore(date, minDate)) return true;
      if (maxDate && isAfter(date, maxDate)) return true;
      return false;
    },
    [minDate, maxDate]
  );

  const handleSelectDay = useCallback(
    (date: Date): void => {
      if (isDayDisabled(date)) return;
      onChange(formatISO(date));
      setIsOpen(false);
      setFocusedDate(null);
    },
    [onChange, isDayDisabled]
  );

  const handleSelectToday = useCallback((): void => {
    const today = new Date();
    if (isDayDisabled(today)) return;
    onChange(formatISO(today));
    setViewDate(today);
    setIsOpen(false);
    setFocusedDate(null);
  }, [onChange, isDayDisabled]);

  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>): void => {
      const current = focusedDate ?? selectedDate ?? new Date();
      let next: Date | null = null;

      switch (e.key) {
        case "ArrowLeft":
          next = subDays(current, 1);
          break;
        case "ArrowRight":
          next = addDays(current, 1);
          break;
        case "ArrowUp":
          next = subDays(current, 7);
          break;
        case "ArrowDown":
          next = addDays(current, 7);
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (focusedDate && !isDayDisabled(focusedDate)) {
            handleSelectDay(focusedDate);
          }
          return;
        default:
          return;
      }

      e.preventDefault();

      if (next) {
        // Update view month if navigated outside current month
        if (!isSameMonth(next, viewDate)) {
          setViewDate(startOfMonth(next));
        }
        setFocusedDate(next);
      }
    },
    [focusedDate, selectedDate, viewDate, isDayDisabled, handleSelectDay]
  );

  // Generate calendar days for the current view month
  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  // Week starts on Monday (weekStartsOn: 1)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  const displayValue = selectedDate
    ? format(selectedDate, "MMM d, yyyy")
    : "";

  const describedBy = error
    ? errorId
    : helpText
      ? helpId
      : undefined;

  return (
    <div className="relative w-full" ref={containerRef}>
      {label && (
        <label
          htmlFor={triggerId}
          className="mb-1.5 block text-sm font-medium text-surface-200"
        >
          {label}
        </label>
      )}

      {/* Trigger button */}
      <div className="relative">
        <button
          type="button"
          id={triggerId}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-describedby={describedBy}
          disabled={disabled}
          onClick={() => {
            if (!disabled) {
              setIsOpen((prev) => !prev);
              if (!isOpen) {
                setFocusedDate(selectedDate ?? new Date());
              }
            }
          }}
          className={`
            flex w-full items-center rounded-lg border px-3 py-2 text-left
            bg-surface-800
            transition-colors duration-150
            focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-surface-900
            disabled:cursor-not-allowed disabled:opacity-50
            ${
              error
                ? "border-error-500 focus:ring-error-500"
                : "border-surface-600 focus:ring-primary-500 hover:border-surface-500"
            }
          `.trim()}
        >
          <span
            className={
              displayValue ? "text-surface-100" : "text-surface-500"
            }
          >
            {displayValue || placeholder}
          </span>
          {/* Calendar icon */}
          <svg
            className="ml-auto h-4 w-4 text-surface-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
            />
          </svg>
        </button>

        {/* Dropdown calendar */}
        {isOpen && (
          <div
            role="dialog"
            aria-label="Choose date"
            className="absolute left-0 top-full z-50 mt-1 w-[280px] rounded-xl border border-surface-600 bg-surface-800 shadow-xl shadow-black/30"
          >
            {/* Month/Year header with nav arrows */}
            <div className="flex items-center justify-between px-3 py-2">
              <button
                type="button"
                onClick={() => setViewDate((d) => subMonths(d, 1))}
                className="rounded-lg p-1 text-surface-400 transition-colors duration-100 hover:bg-surface-700 hover:text-surface-100"
                aria-label="Previous month"
              >
                <svg
                  className="h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 19.5 8.25 12l7.5-7.5"
                  />
                </svg>
              </button>
              <span className="text-sm font-semibold text-surface-100">
                {format(viewDate, "MMMM yyyy")}
              </span>
              <button
                type="button"
                onClick={() => setViewDate((d) => addMonths(d, 1))}
                className="rounded-lg p-1 text-surface-400 transition-colors duration-100 hover:bg-surface-700 hover:text-surface-100"
                aria-label="Next month"
              >
                <svg
                  className="h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m8.25 4.5 7.5 7.5-7.5 7.5"
                  />
                </svg>
              </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 px-2">
              {WEEKDAY_LABELS.map((day) => (
                <div
                  key={day}
                  className="flex h-8 items-center justify-center text-xs font-medium text-surface-500"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Day grid */}
            <div
              ref={gridRef}
              className="grid grid-cols-7 px-2 pb-1"
              role="grid"
              tabIndex={0}
              onKeyDown={handleGridKeyDown}
            >
              {calendarDays.map((day) => {
                const isCurrentMonth = isSameMonth(day, viewDate);
                const isSelected =
                  selectedDate !== null && isSameDay(day, selectedDate);
                const isTodayDate = isToday(day);
                const isDisabled = isDayDisabled(day);
                const isFocused =
                  focusedDate !== null && isSameDay(day, focusedDate);

                let dayClasses =
                  "flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-colors duration-100";

                if (isDisabled) {
                  dayClasses += " text-surface-600 cursor-not-allowed";
                } else if (isSelected) {
                  dayClasses +=
                    " bg-primary-600 text-white font-semibold cursor-pointer";
                } else if (!isCurrentMonth) {
                  dayClasses +=
                    " text-surface-600 hover:bg-surface-700 cursor-pointer";
                } else {
                  dayClasses +=
                    " text-surface-200 hover:bg-surface-700 cursor-pointer";
                }

                if (isTodayDate && !isSelected) {
                  dayClasses += " ring-1 ring-primary-500";
                }

                if (isFocused && !isSelected) {
                  dayClasses += " bg-surface-700";
                }

                return (
                  <div
                    key={day.toISOString()}
                    role="gridcell"
                    aria-selected={isSelected}
                    className="flex items-center justify-center"
                  >
                    <button
                      type="button"
                      tabIndex={-1}
                      disabled={isDisabled}
                      aria-label={format(day, "EEEE, MMMM d, yyyy")}
                      aria-current={isTodayDate ? "date" : undefined}
                      onClick={() => {
                        if (!isCurrentMonth) {
                          // Navigate to that month before selecting
                          setViewDate(startOfMonth(day));
                        }
                        handleSelectDay(day);
                      }}
                      className={dayClasses}
                    >
                      {format(day, "d")}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Today shortcut */}
            <div className="border-t border-surface-700 px-3 py-2">
              <button
                type="button"
                onClick={handleSelectToday}
                disabled={isDayDisabled(new Date())}
                className="w-full rounded-lg px-2 py-1 text-center text-sm text-primary-400 transition-colors duration-100 hover:bg-surface-700 hover:text-primary-300 disabled:cursor-not-allowed disabled:text-surface-600"
              >
                Today
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p id={errorId} className="mt-1.5 text-sm text-error-500" role="alert">
          {error}
        </p>
      )}

      {/* Help text */}
      {!error && helpText && (
        <p id={helpId} className="mt-1.5 text-sm text-surface-400">
          {helpText}
        </p>
      )}
    </div>
  );
}

DatePicker.displayName = "DatePicker";

export { DatePicker };
export type { DatePickerProps };
