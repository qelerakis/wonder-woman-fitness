/**
 * WeeklyCalendar Unit Tests
 *
 * Tests navigation button padding and overall rendering behavior.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WeeklyCalendar } from "../WeeklyCalendar";
import type { SessionWithDetails } from "@/lib/session-generation";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// ===== Helpers =====

function makeSession(
  overrides: Partial<SessionWithDetails> = {}
): SessionWithDetails {
  return {
    id: "session-1",
    recurringSlotId: "slot-1",
    customDay: null,
    customStartHour: null,
    weekDate: new Date("2026-02-09T00:00:00.000Z"),
    workoutTitle: "Upper Body",
    workoutDetails: null,
    votingEnabled: false,
    votingDeadline: new Date("2026-02-10T08:00:00.000Z"),
    status: "SCHEDULED",
    createdById: "owner-1",
    createdAt: new Date("2026-02-01T00:00:00.000Z"),
    recurringSlot: {
      id: "slot-1",
      dayOfWeek: 1,
      startHour: 9,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    members: [],
    trainers: [],
    votes: [],
    ...overrides,
  };
}

// ===== Tests =====

describe("WeeklyCalendar", () => {
  describe("navigation buttons", () => {
    it("renders prev and next buttons when onWeekChange is provided", () => {
      render(
        <WeeklyCalendar
          weekStart={new Date("2026-02-09T00:00:00.000Z")}
          sessions={[]}
          basePath="/member/session"
          onWeekChange={vi.fn()}
        />
      );

      expect(screen.getByText("Prev")).toBeTruthy();
      expect(screen.getByText("Next")).toBeTruthy();
    });

    it("prev button has updated padding classes (px-4 py-2.5)", () => {
      render(
        <WeeklyCalendar
          weekStart={new Date("2026-02-09T00:00:00.000Z")}
          sessions={[]}
          basePath="/member/session"
          onWeekChange={vi.fn()}
        />
      );

      const prevButton = screen.getByText("Prev").closest("button")!;
      expect(prevButton.className).toContain("px-4");
      expect(prevButton.className).toContain("py-2.5");
    });

    it("next button has updated padding classes (px-4 py-2.5)", () => {
      render(
        <WeeklyCalendar
          weekStart={new Date("2026-02-09T00:00:00.000Z")}
          sessions={[]}
          basePath="/member/session"
          onWeekChange={vi.fn()}
        />
      );

      const nextButton = screen.getByText("Next").closest("button")!;
      expect(nextButton.className).toContain("px-4");
      expect(nextButton.className).toContain("py-2.5");
    });

    it("calls onWeekChange with 'prev' when prev button is clicked", () => {
      const onWeekChange = vi.fn();
      render(
        <WeeklyCalendar
          weekStart={new Date("2026-02-09T00:00:00.000Z")}
          sessions={[]}
          basePath="/member/session"
          onWeekChange={onWeekChange}
        />
      );

      fireEvent.click(screen.getByText("Prev").closest("button")!);
      expect(onWeekChange).toHaveBeenCalledWith("prev");
    });

    it("calls onWeekChange with 'next' when next button is clicked", () => {
      const onWeekChange = vi.fn();
      render(
        <WeeklyCalendar
          weekStart={new Date("2026-02-09T00:00:00.000Z")}
          sessions={[]}
          basePath="/member/session"
          onWeekChange={onWeekChange}
        />
      );

      fireEvent.click(screen.getByText("Next").closest("button")!);
      expect(onWeekChange).toHaveBeenCalledWith("next");
    });

    it("does not render navigation buttons when onWeekChange is not provided", () => {
      render(
        <WeeklyCalendar
          weekStart={new Date("2026-02-09T00:00:00.000Z")}
          sessions={[]}
          basePath="/member/session"
        />
      );

      expect(screen.queryByText("Prev")).toBeNull();
      expect(screen.queryByText("Next")).toBeNull();
    });
  });

  describe("session rendering", () => {
    it("renders sessions within the calendar", () => {
      const session = makeSession();
      render(
        <WeeklyCalendar
          weekStart={new Date("2026-02-09T00:00:00.000Z")}
          sessions={[session]}
          basePath="/member/session"
        />
      );

      // Session renders in both desktop and mobile views
      expect(screen.getAllByText("Upper Body").length).toBeGreaterThanOrEqual(1);
    });
  });
});
