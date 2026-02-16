/**
 * DashboardClient Month Navigator Tests
 *
 * Tests the left/right month navigation arrows, month label display,
 * data fetching on navigation, month wrapping, and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { DashboardClient } from "../DashboardClient";

// ===== Mocks =====

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

const mockAddToast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

// Mock Recharts to avoid canvas issues in jsdom
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => null,
  Cell: () => null,
  Legend: () => null,
}));

// ===== Helpers =====

const defaultProps = {
  totalActive: 25,
  trialCount: 3,
  totalRevenue: 50000,
  membershipRevenue: 40000,
  privateRevenue: 10000,
  outstandingCount: 2,
  gracePeriodCount: 1,
  lockedCount: 1,
  popularSlots: [],
  initialMonth: 1,  // February (0-indexed)
  initialYear: 2026,
};

function makeApiResponse(overrides: Record<string, unknown> = {}): object {
  return {
    data: {
      memberEngagement: { totalActiveMembers: 20, ...((overrides.memberEngagement as object) || {}) },
      classPerformance: { popularSlots: [], ...((overrides.classPerformance as object) || {}) },
      financial: {
        totalRevenue: 30000,
        membershipRevenue: 25000,
        privateSessionRevenue: 5000,
        latePayers: [],
        outstandingMembers: [],
        ...((overrides.financial as object) || {}),
      },
    },
  };
}

// ===== Tests =====

describe("DashboardClient month navigator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 16)); // Feb 16, 2026
    mockAddToast.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ─── Rendering ───────────────────────────────────────────────

  it("renders previous month button", () => {
    render(<DashboardClient {...defaultProps} />);
    const prevBtn = screen.getByRole("button", { name: "Previous month" });
    expect(prevBtn).toBeDefined();
  });

  it("renders next month button", () => {
    render(<DashboardClient {...defaultProps} />);
    const nextBtn = screen.getByRole("button", { name: "Next month" });
    expect(nextBtn).toBeDefined();
  });

  it("shows current month label", () => {
    render(<DashboardClient {...defaultProps} />);
    expect(screen.getByText("February 2026 overview")).toBeDefined();
  });

  // ─── Navigation ──────────────────────────────────────────────

  it("disables next month button when viewing current month", () => {
    render(<DashboardClient {...defaultProps} />);
    const nextBtn = screen.getByRole("button", { name: "Next month" });
    expect(nextBtn.hasAttribute("disabled")).toBe(true);
  });

  it("navigates to previous month on left arrow click", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeApiResponse(),
    });
    global.fetch = mockFetch;

    render(<DashboardClient {...defaultProps} />);

    const prevBtn = screen.getByRole("button", { name: "Previous month" });

    await act(async () => {
      fireEvent.click(prevBtn);
    });

    expect(screen.getByText("January 2026 overview")).toBeDefined();
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/analytics?startDate=2026-01-01&endDate=2026-01-31"
    );
  });

  it("enables next month button after navigating to previous month", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeApiResponse(),
    });
    global.fetch = mockFetch;

    render(<DashboardClient {...defaultProps} />);

    // Initially disabled (current month)
    const nextBtn = screen.getByRole("button", { name: "Next month" });
    expect(nextBtn.hasAttribute("disabled")).toBe(true);

    // Navigate to previous month and wait for fetch to complete
    const prevBtn = screen.getByRole("button", { name: "Previous month" });
    await act(async () => {
      fireEvent.click(prevBtn);
    });

    // After navigation and fetch, next month should be enabled
    const updatedNextBtn = screen.getByRole("button", { name: "Next month" });
    expect(updatedNextBtn.hasAttribute("disabled")).toBe(false);
  });

  // ─── Edge cases ──────────────────────────────────────────────

  it("wraps from January to December of previous year", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeApiResponse(),
    });
    global.fetch = mockFetch;

    render(
      <DashboardClient
        {...defaultProps}
        initialMonth={0}   // January
        initialYear={2026}
      />
    );

    expect(screen.getByText("January 2026 overview")).toBeDefined();

    const prevBtn = screen.getByRole("button", { name: "Previous month" });
    await act(async () => {
      fireEvent.click(prevBtn);
    });

    expect(screen.getByText("December 2025 overview")).toBeDefined();
  });

  // ─── Error handling ──────────────────────────────────────────

  it("shows error toast on fetch failure", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
    global.fetch = mockFetch;

    render(<DashboardClient {...defaultProps} />);

    const prevBtn = screen.getByRole("button", { name: "Previous month" });
    await act(async () => {
      fireEvent.click(prevBtn);
    });

    expect(mockAddToast).toHaveBeenCalledWith({
      type: "error",
      title: "Failed to load dashboard data",
    });
  });
});
