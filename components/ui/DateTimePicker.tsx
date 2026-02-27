"use client";

import { useState, useRef, useEffect, useId, useCallback, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { getDateLocale } from "@/lib/date-locale";
import { useIsMobile } from "@/hooks/useIsMobile";
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

interface DateTimePickerProps {
  label?: string;
  value: string; // "YYYY-MM-DDTHH:mm" format
  onChange: (value: string) => void;
  error?: string;
  helpText?: string;
  min?: string; // "YYYY-MM-DDTHH:mm"
  max?: string; // "YYYY-MM-DDTHH:mm"
  disabled?: boolean;
  placeholder?: string;
}

const HOUR_OPTIONS: string[] = Array.from({ length: 24 }, (_, i) =>
  String(i).padStart(2, "0")
);

const MINUTE_OPTIONS: string[] = ["00", "15", "30", "45"];

function parseDateTimeValue(dateTimeStr: string): {
  date: Date | null;
  hour: string;
  minute: string;
} {
  if (!dateTimeStr) return { date: null, hour: "09", minute: "00" };

  // Expected format: "YYYY-MM-DDTHH:mm"
  const [datePart, timePart] = dateTimeStr.split("T");
  const parsedDate = datePart
    ? parse(datePart, "yyyy-MM-dd", new Date())
    : null;
  const validDate =
    parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : null;

  let hour = "09";
  let minute = "00";
  if (timePart) {
    const [h, m] = timePart.split(":");
    if (h && h.length === 2) hour = h;
    if (m && m.length === 2) minute = m;
  }

  return { date: validDate, hour, minute };
}

function parseDateOnly(dateStr: string): Date | null {
  if (!dateStr) return null;
  // Handle both "YYYY-MM-DD" and "YYYY-MM-DDTHH:mm"
  const datePart = dateStr.split("T")[0];
  const parsed = parse(datePart, "yyyy-MM-dd", new Date());
  if (isNaN(parsed.getTime())) return null;
  return parsed;
}

function formatISODate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function formatDateTime(dateStr: string, hour: string, minute: string): string {
  return `${dateStr}T${hour}:${minute}`;
}

function DateTimePicker({
  label,
  value,
  onChange,
  error,
  helpText,
  min,
  max,
  disabled = false,
  placeholder,
}: DateTimePickerProps): React.ReactElement {
  const t = useTranslations("datePicker");
  const locale = useLocale();
  const dateLocale = useMemo(() => getDateLocale(locale), [locale]);
  const isMobile = useIsMobile();
  const resolvedPlaceholder = placeholder ?? t("selectDateTime");

  const weekdayLabels = useMemo(() => {
    const baseDate = new Date(2024, 0, 1); // A Monday
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(baseDate, i);
      return format(day, "EEEEEE", { locale: dateLocale });
    });
  }, [dateLocale]);

  const generatedId = useId();
  const triggerId = `datetimepicker-trigger-${generatedId}`;
  const errorId = `${triggerId}-error`;
  const helpId = `${triggerId}-help`;

  const parsed = useMemo(() => parseDateTimeValue(value), [value]);

  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState<Date>(() => {
    return parsed.date ?? new Date();
  });
  const [focusedDate, setFocusedDate] = useState<Date | null>(null);
  const [pendingDate, setPendingDate] = useState<Date | null>(null);
  const [selectedHour, setSelectedHour] = useState<string>(parsed.hour);
  const [selectedMinute, setSelectedMinute] = useState<string>(parsed.minute);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const selectedDate = parsed.date;
  const minDate = useMemo(() => (min ? parseDateOnly(min) : null), [min]);
  const maxDate = useMemo(() => (max ? parseDateOnly(max) : null), [max]);

  // Sync state when value changes externally
  useEffect(() => {
    const ext = parseDateTimeValue(value);
    if (ext.date) {
      setViewDate(ext.date);
      setPendingDate(ext.date);
    }
    setSelectedHour(ext.hour);
    setSelectedMinute(ext.minute);
  }, [value]);

  // Commit the pending selection and close
  const commitAndClose = useCallback((): void => {
    if (pendingDate) {
      onChange(
        formatDateTime(formatISODate(pendingDate), selectedHour, selectedMinute)
      );
    }
    setIsOpen(false);
    setFocusedDate(null);
    triggerRef.current?.focus();
  }, [pendingDate, selectedHour, selectedMinute, onChange]);

  // Close on outside click — auto-confirms pending selection
  useEffect(() => {
    if (!isOpen || isMobile) return;

    function handleClickOutside(e: MouseEvent): void {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        // Auto-confirm pending selection on outside click
        if (pendingDate) {
          onChange(
            formatDateTime(
              formatISODate(pendingDate),
              selectedHour,
              selectedMinute
            )
          );
        }
        setIsOpen(false);
        setFocusedDate(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, isMobile, pendingDate, selectedHour, selectedMinute, onChange]);

  // Close on Escape — without confirming (stopPropagation prevents parent modal from closing too)
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        e.stopPropagation();
        setIsOpen(false);
        setFocusedDate(null);
        // Reset pending date to the currently committed value
        setPendingDate(selectedDate);
        setSelectedHour(parsed.hour);
        setSelectedMinute(parsed.minute);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedDate, parsed.hour, parsed.minute]);

  // Close on scroll/resize to prevent stale fixed positioning
  useEffect(() => {
    if (!isOpen || isMobile) return;

    const close = (): void => {
      // Auto-confirm pending selection on scroll/resize
      if (pendingDate) {
        onChange(
          formatDateTime(formatISODate(pendingDate), selectedHour, selectedMinute)
        );
      }
      setIsOpen(false);
      setFocusedDate(null);
    };

    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [isOpen, isMobile, pendingDate, selectedHour, selectedMinute, onChange]);

  // Focus the grid when dropdown opens
  useEffect(() => {
    if (isOpen && gridRef.current) {
      gridRef.current.focus();
    }
  }, [isOpen]);

  const isDayDisabled = useCallback(
    (date: Date): boolean => {
      if (minDate && isBefore(date, minDate)) return true;
      if (maxDate && isAfter(date, maxDate)) return true;
      return false;
    },
    [minDate, maxDate]
  );

  // Click a day -> set as pending (don't close)
  const handleSelectDay = useCallback(
    (date: Date): void => {
      if (isDayDisabled(date)) return;
      setPendingDate(date);
    },
    [isDayDisabled]
  );

  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>): void => {
      const current = focusedDate ?? pendingDate ?? selectedDate ?? new Date();
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
    [focusedDate, pendingDate, selectedDate, viewDate, isDayDisabled, handleSelectDay]
  );

  // Generate calendar days for the current view month (memoized)
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(viewDate);
    const monthEnd = endOfMonth(viewDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [viewDate]);

  const displayValue = selectedDate
    ? format(selectedDate, "MMM d, yyyy", { locale: dateLocale }) +
      ` ${parsed.hour}:${parsed.minute}`
    : "";

  const describedBy = error
    ? errorId
    : helpText
      ? helpId
      : undefined;

  const calendarContent = (
    <>
      {/* Month/Year header with nav arrows */}
      <div className="flex items-center justify-between px-2 py-1.5">
        <button
          type="button"
          onClick={() => setViewDate((d) => subMonths(d, 1))}
          className="rounded-lg p-1 text-surface-400 transition-colors duration-100 hover:bg-surface-700 hover:text-surface-100"
          aria-label={t("previousMonth")}
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
          {format(viewDate, "MMMM yyyy", { locale: dateLocale })}
        </span>
        <button
          type="button"
          onClick={() => setViewDate((d) => addMonths(d, 1))}
          className="rounded-lg p-1 text-surface-400 transition-colors duration-100 hover:bg-surface-700 hover:text-surface-100"
          aria-label={t("nextMonth")}
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
      <div className="grid grid-cols-7 px-1.5">
        {weekdayLabels.map((day, i) => (
          <div
            key={i}
            className="flex h-6 items-center justify-center text-xs font-medium text-surface-500"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div
        ref={gridRef}
        className="grid grid-cols-7 px-1.5 pb-1"
        role="grid"
        tabIndex={0}
        onKeyDown={handleGridKeyDown}
      >
        {calendarDays.map((day) => {
          const isCurrentMonth = isSameMonth(day, viewDate);
          const isPending =
            pendingDate !== null && isSameDay(day, pendingDate);
          const isTodayDate = isToday(day);
          const isDisabled = isDayDisabled(day);
          const isFocused =
            focusedDate !== null && isSameDay(day, focusedDate);

          let dayClasses =
            "flex h-7 w-7 items-center justify-center rounded-md text-xs transition-colors duration-100";

          if (isDisabled) {
            dayClasses += " text-surface-600 cursor-not-allowed";
          } else if (isPending) {
            dayClasses +=
              " bg-primary-600 text-white font-semibold cursor-pointer";
          } else if (!isCurrentMonth) {
            dayClasses +=
              " text-surface-600 hover:bg-surface-700 cursor-pointer";
          } else {
            dayClasses +=
              " text-surface-200 hover:bg-surface-700 cursor-pointer";
          }

          if (isTodayDate && !isPending) {
            dayClasses += " ring-1 ring-primary-500";
          }

          if (isFocused && !isPending) {
            dayClasses += " bg-surface-700";
          }

          return (
            <div
              key={day.toISOString()}
              role="gridcell"
              aria-selected={isPending}
              className="flex items-center justify-center"
            >
              <button
                type="button"
                tabIndex={-1}
                disabled={isDisabled}
                aria-label={format(day, "EEEE, MMMM d, yyyy", { locale: dateLocale })}
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

      {/* Time selector */}
      <div className="border-t border-surface-700 px-2 py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-surface-400">
            {t("time")}
          </span>
          <select
            value={selectedHour}
            onChange={(e) => setSelectedHour(e.target.value)}
            aria-label="Hour"
            className="rounded-md border border-surface-600 bg-surface-900 px-1.5 py-0.5 text-xs text-surface-100 focus:ring-1 focus:ring-primary-500"
          >
            {HOUR_OPTIONS.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
          <span className="text-surface-400 font-medium text-xs">:</span>
          <select
            value={selectedMinute}
            onChange={(e) => setSelectedMinute(e.target.value)}
            aria-label="Minute"
            className="rounded-md border border-surface-600 bg-surface-900 px-1.5 py-0.5 text-xs text-surface-100 focus:ring-1 focus:ring-primary-500"
          >
            {MINUTE_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* Done button */}
        <div className="mt-2">
          <button
            type="button"
            onClick={commitAndClose}
            disabled={!pendingDate}
            className="w-full rounded-md bg-primary-600 py-1 text-xs font-semibold text-white hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("done")}
          </button>
        </div>
      </div>
    </>
  );

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
          ref={triggerRef}
          onClick={() => {
            if (!disabled) {
              if (!isOpen && triggerRef.current && !isMobile) {
                const rect = triggerRef.current.getBoundingClientRect();
                setDropdownPos({ top: rect.bottom + 4, left: rect.left });
              }
              setIsOpen((prev) => !prev);
              if (!isOpen) {
                setFocusedDate(selectedDate ?? new Date());
                setPendingDate(selectedDate);
                setSelectedHour(parsed.hour);
                setSelectedMinute(parsed.minute);
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
            {displayValue || resolvedPlaceholder}
          </span>
          {/* Calendar + clock icon */}
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

        {/* Dropdown calendar + time — mobile: centered with backdrop */}
        {isOpen && isMobile && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                if (pendingDate) {
                  onChange(formatDateTime(formatISODate(pendingDate), selectedHour, selectedMinute));
                }
                setIsOpen(false);
                setFocusedDate(null);
              }
            }}
          >
            <div
              role="dialog"
              aria-label={t("chooseDateAndTime")}
              className="w-[232px] rounded-xl border border-surface-600 bg-surface-800 shadow-xl shadow-black/30"
            >
              {calendarContent}
            </div>
          </div>
        )}
        {/* Dropdown calendar + time — desktop: fixed position near trigger */}
        {isOpen && !isMobile && (
          <div
            role="dialog"
            aria-label={t("chooseDateAndTime")}
            style={{ top: dropdownPos.top, left: dropdownPos.left }}
            className="fixed z-[100] w-[232px] rounded-xl border border-surface-600 bg-surface-800 shadow-xl shadow-black/30"
          >
            {calendarContent}
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

DateTimePicker.displayName = "DateTimePicker";

export { DateTimePicker };
export type { DateTimePickerProps };
