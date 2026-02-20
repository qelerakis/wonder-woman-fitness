"use client";

import { useState, useEffect } from "react";
import { addDays, format } from "date-fns";
import { SessionCard } from "./SessionCard";
import { DAY_NAMES } from "@/lib/constants";
import type { SessionWithDetails } from "@/lib/session-generation";

interface WeeklyCalendarProps {
  weekStart: Date;
  sessions: SessionWithDetails[];
  basePath: string;
  showVotingIndicator?: boolean;
  currentUserId?: string;
  onWeekChange?: (direction: "prev" | "next") => void;
}

/**
 * Groups sessions by day of week (1-7) for display.
 */
function groupSessionsByDay(
  sessions: SessionWithDetails[]
): Map<number, SessionWithDetails[]> {
  const grouped = new Map<number, SessionWithDetails[]>();
  for (const session of sessions) {
    const day = session.recurringSlot?.dayOfWeek ?? session.customDay ?? 1;
    const existing = grouped.get(day) || [];
    existing.push(session);
    grouped.set(day, existing);
  }
  // Sort sessions within each day by startHour
  for (const [day, daySessions] of grouped) {
    grouped.set(
      day,
      daySessions.sort((a, b) => {
        const hourA = a.recurringSlot?.startHour ?? a.customStartHour ?? 0;
        const hourB = b.recurringSlot?.startHour ?? b.customStartHour ?? 0;
        return hourA - hourB;
      })
    );
  }
  return grouped;
}

export function WeeklyCalendar({
  weekStart,
  sessions,
  basePath,
  showVotingIndicator = false,
  currentUserId,
  onWeekChange,
}: WeeklyCalendarProps): React.ReactElement {
  const grouped = groupSessionsByDay(sessions);

  // Use state + effect for today's date to avoid hydration mismatch
  // (new Date() differs between server render and client hydrate)
  const [todayStr, setTodayStr] = useState<string>("");
  useEffect(() => {
    setTodayStr(format(new Date(), "yyyy-MM-dd"));
  }, []);

  // Generate array for days 1-7 (Mon-Sun)
  const days = Array.from({ length: 7 }, (_, i) => {
    const dayNumber = i + 1; // 1=Monday, 7=Sunday
    const date = addDays(weekStart, i);
    const isToday = todayStr === format(date, "yyyy-MM-dd");
    return { dayNumber, date, isToday };
  });

  return (
    <div>
      {/* Week navigation */}
      {onWeekChange && (
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => onWeekChange("prev")}
            className="rounded-lg px-4 py-2.5 text-sm text-surface-400 hover:bg-surface-800 hover:text-surface-100 transition-colors"
          >
            <span className="flex items-center gap-1">
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              Prev
            </span>
          </button>
          <h2 className="text-sm font-medium text-surface-200">
            {format(weekStart, "MMM d")} –{" "}
            {format(addDays(weekStart, 6), "MMM d, yyyy")}
          </h2>
          <button
            onClick={() => onWeekChange("next")}
            className="rounded-lg px-4 py-2.5 text-sm text-surface-400 hover:bg-surface-800 hover:text-surface-100 transition-colors"
          >
            <span className="flex items-center gap-1">
              Next
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          </button>
        </div>
      )}

      {/* Desktop: columns for each day */}
      <div className="hidden md:grid md:grid-cols-7 gap-2">
        {days.map(({ dayNumber, date, isToday }) => (
          <div key={dayNumber} className="min-w-0">
            {/* Day header */}
            <div
              className={`
                mb-2 rounded-lg px-2 py-1.5 text-center
                ${isToday ? "bg-primary-600/20 border border-primary-600/30" : "bg-surface-800"}
              `}
            >
              <p
                className={`text-xs font-medium ${
                  isToday ? "text-primary-300" : "text-surface-400"
                }`}
              >
                {DAY_NAMES[dayNumber]}
              </p>
              <p
                className={`text-sm font-semibold ${
                  isToday ? "text-primary-200" : "text-surface-200"
                }`}
              >
                {format(date, "d")}
              </p>
            </div>
            {/* Sessions for this day */}
            <div className="flex flex-col gap-2">
              {(grouped.get(dayNumber) || []).map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  basePath={basePath}
                  showVotingIndicator={showVotingIndicator}
                  currentUserId={currentUserId}
                />
              ))}
              {!grouped.has(dayNumber) && (
                <div className="rounded-lg border border-dashed border-surface-700 py-6 text-center">
                  <p className="text-xs text-surface-500">No sessions</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Mobile: stacked list */}
      <div className="flex flex-col gap-4 md:hidden">
        {days.map(({ dayNumber, date, isToday }) => {
          const daySessions = grouped.get(dayNumber) || [];
          if (daySessions.length === 0) return null;
          return (
            <div key={dayNumber}>
              <div
                className={`
                  mb-2 flex items-center gap-2 rounded-lg px-3 py-2
                  ${isToday ? "bg-primary-600/20" : "bg-surface-800/50"}
                `}
              >
                <span
                  className={`text-sm font-medium ${
                    isToday ? "text-primary-300" : "text-surface-300"
                  }`}
                >
                  {DAY_NAMES[dayNumber]}
                </span>
                <span
                  className={`text-sm ${
                    isToday ? "text-primary-400" : "text-surface-500"
                  }`}
                >
                  {format(date, "MMM d")}
                </span>
                {isToday && (
                  <span className="ml-auto text-xs font-medium text-primary-400">
                    Today
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {daySessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    basePath={basePath}
                    showVotingIndicator={showVotingIndicator}
                    currentUserId={currentUserId}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export type { WeeklyCalendarProps };
