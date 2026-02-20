/**
 * MemberScheduleClient Unit Tests
 *
 * Tests rendering, refresh button behavior, and loading states.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemberScheduleClient } from "../MemberScheduleClient";

// ===== Mocks =====

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    refresh: mockRefresh,
  }),
}));

vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

// Mock WeeklyCalendar to avoid complex rendering
vi.mock("@/components/schedule/WeeklyCalendar", () => ({
  WeeklyCalendar: (props: { weekStart: Date; sessions: unknown[] }) => (
    <div data-testid="weekly-calendar">
      Calendar with {props.sessions.length} sessions
    </div>
  ),
}));

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

// ===== Tests =====

describe("MemberScheduleClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });
  });

  it("renders the page heading", async () => {
    render(
      <MemberScheduleClient
        initialWeekStart="2026-02-09T00:00:00.000Z"
        userId="member-1"
      />
    );

    expect(screen.getByText("My Schedule")).toBeTruthy();
  });

  it("renders the subtitle text", async () => {
    render(
      <MemberScheduleClient
        initialWeekStart="2026-02-09T00:00:00.000Z"
        userId="member-1"
      />
    );

    expect(
      screen.getByText("View your upcoming classes and vote on attendance")
    ).toBeTruthy();
  });

  describe("refresh button", () => {
    it("renders a refresh button with correct aria-label", () => {
      render(
        <MemberScheduleClient
          initialWeekStart="2026-02-09T00:00:00.000Z"
          userId="member-1"
        />
      );

      const refreshBtn = screen.getByLabelText("Refresh schedule");
      expect(refreshBtn).toBeTruthy();
    });

    it("refresh button contains an SVG icon", () => {
      render(
        <MemberScheduleClient
          initialWeekStart="2026-02-09T00:00:00.000Z"
          userId="member-1"
        />
      );

      const refreshBtn = screen.getByLabelText("Refresh schedule");
      const svg = refreshBtn.querySelector("svg");
      expect(svg).toBeTruthy();
      expect(svg!.classList.contains("h-5")).toBe(true);
      expect(svg!.classList.contains("w-5")).toBe(true);
    });

    it("refresh button is a button element", () => {
      render(
        <MemberScheduleClient
          initialWeekStart="2026-02-09T00:00:00.000Z"
          userId="member-1"
        />
      );

      const refreshBtn = screen.getByLabelText("Refresh schedule");
      expect(refreshBtn.tagName).toBe("BUTTON");
    });
  });

  describe("loading state", () => {
    it("shows loading text while fetching sessions", () => {
      // Don't resolve the fetch immediately
      global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));

      render(
        <MemberScheduleClient
          initialWeekStart="2026-02-09T00:00:00.000Z"
          userId="member-1"
        />
      );

      expect(screen.getByText("Loading schedule...")).toBeTruthy();
    });

    it("shows calendar after sessions load", async () => {
      render(
        <MemberScheduleClient
          initialWeekStart="2026-02-09T00:00:00.000Z"
          userId="member-1"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId("weekly-calendar")).toBeTruthy();
      });
    });
  });
});
