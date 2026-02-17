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

// toLocaleString() output varies by environment. Pre-compute for assertions.
function fmtCurrency(n: number): string {
  return `${n.toLocaleString()} MKD`;
}

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

  // ─── Non-OK API response ───────────────────────────────────

  it("shows error toast on non-OK API response (e.g., 500)", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "Internal Server Error" }),
    });
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

  it("does not update metric values when API returns non-OK response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "Bad Request" }),
    });
    global.fetch = mockFetch;

    render(<DashboardClient {...defaultProps} />);

    const prevBtn = screen.getByRole("button", { name: "Previous month" });
    await act(async () => {
      fireEvent.click(prevBtn);
    });

    // Original values should remain
    expect(screen.getByText("25")).toBeDefined(); // totalActive unchanged
  });

  // ─── Null data guard ───────────────────────────────────────

  it("shows 'Unexpected response format' toast when data is null", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: null }),
    });
    global.fetch = mockFetch;

    render(<DashboardClient {...defaultProps} />);

    const prevBtn = screen.getByRole("button", { name: "Previous month" });
    await act(async () => {
      fireEvent.click(prevBtn);
    });

    expect(mockAddToast).toHaveBeenCalledWith({
      type: "error",
      title: "Unexpected response format",
    });
  });

  it("shows 'Unexpected response format' toast when data is undefined", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    global.fetch = mockFetch;

    render(<DashboardClient {...defaultProps} />);

    const prevBtn = screen.getByRole("button", { name: "Previous month" });
    await act(async () => {
      fireEvent.click(prevBtn);
    });

    expect(mockAddToast).toHaveBeenCalledWith({
      type: "error",
      title: "Unexpected response format",
    });
  });

  it("does not crash when API returns null data", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: null }),
    });
    global.fetch = mockFetch;

    render(<DashboardClient {...defaultProps} />);

    const prevBtn = screen.getByRole("button", { name: "Previous month" });
    await act(async () => {
      fireEvent.click(prevBtn);
    });

    // Component should still be rendered
    expect(screen.getByText("Dashboard")).toBeDefined();
    expect(screen.getByText("25")).toBeDefined(); // original values intact
  });

  // ─── Metric value updates after navigation ─────────────────

  it("updates Active Members value after fetching previous month", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeApiResponse({ memberEngagement: { totalActiveMembers: 18 } }),
    });
    global.fetch = mockFetch;

    render(<DashboardClient {...defaultProps} />);
    expect(screen.getByText("25")).toBeDefined(); // initial

    const prevBtn = screen.getByRole("button", { name: "Previous month" });
    await act(async () => {
      fireEvent.click(prevBtn);
    });

    expect(screen.getByText("18")).toBeDefined(); // updated
  });

  it("updates Revenue value after fetching previous month", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeApiResponse({
        financial: {
          totalRevenue: 75000,
          membershipRevenue: 60000,
          privateSessionRevenue: 15000,
          latePayers: [],
          outstandingMembers: [],
        },
      }),
    });
    global.fetch = mockFetch;

    render(<DashboardClient {...defaultProps} />);

    const prevBtn = screen.getByRole("button", { name: "Previous month" });
    await act(async () => {
      fireEvent.click(prevBtn);
    });

    expect(screen.getByText(fmtCurrency(75000))).toBeDefined();
    expect(screen.getByText(`Membership: ${fmtCurrency(60000)} | Private: ${fmtCurrency(15000)}`)).toBeDefined();
  });

  it("updates Outstanding values after fetching previous month", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeApiResponse({
        financial: {
          totalRevenue: 30000,
          membershipRevenue: 25000,
          privateSessionRevenue: 5000,
          latePayers: [{ id: "a" }, { id: "b" }],
          outstandingMembers: [{ id: "c" }],
        },
      }),
    });
    global.fetch = mockFetch;

    render(<DashboardClient {...defaultProps} />);

    const prevBtn = screen.getByRole("button", { name: "Previous month" });
    await act(async () => {
      fireEvent.click(prevBtn);
    });

    // outstandingCount = latePayers.length + outstandingMembers.length = 3
    expect(screen.getByText("3")).toBeDefined();
    expect(screen.getByText("2 grace, 1 locked")).toBeDefined();
  });

  it("sets trial count to 0 for non-current months", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeApiResponse(),
    });
    global.fetch = mockFetch;

    render(<DashboardClient {...defaultProps} />);
    // Initial trial count is 3
    expect(screen.getByText("3 on trial")).toBeDefined();

    const prevBtn = screen.getByRole("button", { name: "Previous month" });
    await act(async () => {
      fireEvent.click(prevBtn);
    });

    // After navigating away, trial count should be 0
    expect(screen.getByText("No active trials")).toBeDefined();
  });

  // ─── Loading state: opacity on grids ───────────────────────

  it("applies opacity-50 to metric cards grid during loading", async () => {
    let resolveFetch: (value: unknown) => void;
    const fetchPromise = new Promise((resolve) => { resolveFetch = resolve; });
    const mockFetch = vi.fn().mockReturnValue(fetchPromise);
    global.fetch = mockFetch;

    const { container } = render(<DashboardClient {...defaultProps} />);

    const prevBtn = screen.getByRole("button", { name: "Previous month" });
    // Start navigation but don't resolve fetch yet
    await act(async () => {
      fireEvent.click(prevBtn);
    });

    // While loading, grids should have opacity-50
    const grids = container.querySelectorAll(".grid");
    const metricGrid = grids[0];
    expect(metricGrid?.className).toContain("opacity-50");

    // Resolve the fetch
    await act(async () => {
      resolveFetch!({
        ok: true,
        json: async () => makeApiResponse(),
      });
    });

    // After loading, opacity-50 should be removed
    const updatedGrids = container.querySelectorAll(".grid");
    expect(updatedGrids[0]?.className).not.toContain("opacity-50");
  });

  it("applies opacity-50 to charts grid during loading", async () => {
    let resolveFetch: (value: unknown) => void;
    const fetchPromise = new Promise((resolve) => { resolveFetch = resolve; });
    const mockFetch = vi.fn().mockReturnValue(fetchPromise);
    global.fetch = mockFetch;

    const { container } = render(<DashboardClient {...defaultProps} />);

    const prevBtn = screen.getByRole("button", { name: "Previous month" });
    await act(async () => {
      fireEvent.click(prevBtn);
    });

    // The charts grid is the second .grid element with transition-opacity
    const transitionGrids = container.querySelectorAll(".transition-opacity");
    // Both metric grid and chart grid have transition-opacity
    expect(transitionGrids.length).toBeGreaterThanOrEqual(2);
    expect(transitionGrids[1]?.className).toContain("opacity-50");

    await act(async () => {
      resolveFetch!({
        ok: true,
        json: async () => makeApiResponse(),
      });
    });

    const updatedGrids = container.querySelectorAll(".transition-opacity");
    expect(updatedGrids[1]?.className).not.toContain("opacity-50");
  });

  // ─── Both nav buttons disabled while loading ──────────────

  it("disables both nav buttons during fetch", async () => {
    let resolveFetch: (value: unknown) => void;
    const fetchPromise = new Promise((resolve) => { resolveFetch = resolve; });
    const mockFetch = vi.fn().mockReturnValue(fetchPromise);
    global.fetch = mockFetch;

    // Start from a past month so next button is normally enabled
    render(
      <DashboardClient {...defaultProps} initialMonth={0} initialYear={2026} />
    );

    const prevBtn = screen.getByRole("button", { name: "Previous month" });
    const nextBtn = screen.getByRole("button", { name: "Next month" });

    // Before click, prev is enabled, next is enabled (not current month)
    expect(prevBtn.hasAttribute("disabled")).toBe(false);
    expect(nextBtn.hasAttribute("disabled")).toBe(false);

    // Navigate back (triggers loading)
    await act(async () => {
      fireEvent.click(prevBtn);
    });

    // During loading, both should be disabled
    expect(screen.getByRole("button", { name: "Previous month" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Next month" }).hasAttribute("disabled")).toBe(true);

    // Resolve fetch
    await act(async () => {
      resolveFetch!({
        ok: true,
        json: async () => makeApiResponse(),
      });
    });

    // After loading, both should be re-enabled (now viewing Dec 2025, not current month)
    expect(screen.getByRole("button", { name: "Previous month" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("button", { name: "Next month" }).hasAttribute("disabled")).toBe(false);
  });

  // ─── December to January forward wrap ──────────────────────

  it("wraps from December to January of next year when navigating forward", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeApiResponse(),
    });
    global.fetch = mockFetch;

    // Start at December 2025 (not current month, so next is enabled)
    render(
      <DashboardClient {...defaultProps} initialMonth={11} initialYear={2025} />
    );

    expect(screen.getByText("December 2025 overview")).toBeDefined();

    const nextBtn = screen.getByRole("button", { name: "Next month" });
    await act(async () => {
      fireEvent.click(nextBtn);
    });

    expect(screen.getByText("January 2026 overview")).toBeDefined();
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/analytics?startDate=2026-01-01&endDate=2026-01-31"
    );
  });

  // ─── Multiple backward navigations ─────────────────────────

  it("navigates back 3 times with correct labels and fetch calls", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeApiResponse(),
    });
    global.fetch = mockFetch;

    render(<DashboardClient {...defaultProps} />);
    expect(screen.getByText("February 2026 overview")).toBeDefined();

    const prevBtn = screen.getByRole("button", { name: "Previous month" });

    // Navigate back 1: Feb → Jan 2026
    await act(async () => { fireEvent.click(prevBtn); });
    expect(screen.getByText("January 2026 overview")).toBeDefined();
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/analytics?startDate=2026-01-01&endDate=2026-01-31"
    );

    // Navigate back 2: Jan → Dec 2025
    await act(async () => { fireEvent.click(prevBtn); });
    expect(screen.getByText("December 2025 overview")).toBeDefined();
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/analytics?startDate=2025-12-01&endDate=2025-12-31"
    );

    // Navigate back 3: Dec → Nov 2025
    await act(async () => { fireEvent.click(prevBtn); });
    expect(screen.getByText("November 2025 overview")).toBeDefined();
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/analytics?startDate=2025-11-01&endDate=2025-11-30"
    );

    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  // ─── Initial metric card values ────────────────────────────

  it("displays initial Active Members value from props", () => {
    render(<DashboardClient {...defaultProps} />);
    expect(screen.getByText("25")).toBeDefined();
  });

  it("displays initial Revenue value formatted as currency", () => {
    render(<DashboardClient {...defaultProps} />);
    expect(screen.getByText(fmtCurrency(50000))).toBeDefined();
  });

  it("displays initial membership revenue subtitle", () => {
    render(<DashboardClient {...defaultProps} />);
    expect(screen.getByText(`Membership: ${fmtCurrency(40000)} | Private: ${fmtCurrency(10000)}`)).toBeDefined();
  });

  it("displays both membership and private revenue in Revenue card subtitle", () => {
    render(<DashboardClient {...defaultProps} />);
    const subtitle = screen.getByText(`Membership: ${fmtCurrency(40000)} | Private: ${fmtCurrency(10000)}`);
    expect(subtitle).toBeDefined();
  });

  it("displays initial Outstanding count from props", () => {
    render(<DashboardClient {...defaultProps} />);
    expect(screen.getByText("2")).toBeDefined();
  });

  it("displays initial Trials count from props", () => {
    render(<DashboardClient {...defaultProps} />);
    // trialCount=3 appears as the Trials card value
    const trialElements = screen.getAllByText("3");
    expect(trialElements.length).toBeGreaterThanOrEqual(1);
  });

  it("displays 'X on trial' subtitle when trialCount > 0", () => {
    render(<DashboardClient {...defaultProps} />);
    expect(screen.getByText("3 on trial")).toBeDefined();
  });

  it("displays 'grace, locked' subtitle when outstandingCount > 0", () => {
    render(<DashboardClient {...defaultProps} />);
    expect(screen.getByText("1 grace, 1 locked")).toBeDefined();
  });

  // ─── Quick action links ────────────────────────────────────

  it("renders Schedule quick action link to /owner/schedule", () => {
    render(<DashboardClient {...defaultProps} />);
    const scheduleLinks = screen.getAllByRole("link").filter(
      (link) => link.getAttribute("href") === "/owner/schedule"
    );
    expect(scheduleLinks.length).toBeGreaterThanOrEqual(1);
  });

  it("renders Members link to /members", () => {
    render(<DashboardClient {...defaultProps} />);
    const membersLinks = screen.getAllByRole("link").filter(
      (link) => link.getAttribute("href") === "/members"
    );
    expect(membersLinks.length).toBeGreaterThanOrEqual(1);
  });

  it("renders Payments quick action link to /payments", () => {
    render(<DashboardClient {...defaultProps} />);
    const paymentsLinks = screen.getAllByRole("link").filter(
      (link) => link.getAttribute("href") === "/payments"
    );
    expect(paymentsLinks.length).toBeGreaterThanOrEqual(1);
  });

  it("renders Private Sessions quick action link to /private-sessions", () => {
    render(<DashboardClient {...defaultProps} />);
    const privateLinks = screen.getAllByRole("link").filter(
      (link) => link.getAttribute("href") === "/private-sessions"
    );
    expect(privateLinks.length).toBeGreaterThanOrEqual(1);
  });

  it("renders Trainers quick action link to /trainers", () => {
    render(<DashboardClient {...defaultProps} />);
    const trainerLinks = screen.getAllByRole("link").filter(
      (link) => link.getAttribute("href") === "/trainers"
    );
    expect(trainerLinks.length).toBeGreaterThanOrEqual(1);
  });

  // ─── Outstanding subtitle logic ────────────────────────────

  it("shows 'All members current' when outstandingCount is 0", () => {
    render(
      <DashboardClient
        {...defaultProps}
        outstandingCount={0}
        gracePeriodCount={0}
        lockedCount={0}
      />
    );
    expect(screen.getByText("All members current")).toBeDefined();
  });

  it("shows grace and locked breakdown when outstandingCount > 0", () => {
    render(
      <DashboardClient
        {...defaultProps}
        outstandingCount={5}
        gracePeriodCount={3}
        lockedCount={2}
      />
    );
    expect(screen.getByText("3 grace, 2 locked")).toBeDefined();
  });

  // ─── Trial card subtitle logic ─────────────────────────────

  it("shows 'Active trials' when trialCount > 0", () => {
    render(<DashboardClient {...defaultProps} trialCount={5} />);
    expect(screen.getByText("Active trials")).toBeDefined();
  });

  it("shows 'No active trials' when trialCount is 0", () => {
    render(<DashboardClient {...defaultProps} trialCount={0} />);
    expect(screen.getByText("No active trials")).toBeDefined();
  });

  it("does not show 'X on trial' subtitle when trialCount is 0", () => {
    render(<DashboardClient {...defaultProps} trialCount={0} />);
    const trialSubtitle = screen.queryByText(/on trial/);
    expect(trialSubtitle).toBeNull();
  });

  // ─── Date parameter construction ──────────────────────────

  it("constructs correct date params for a 31-day month (March)", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeApiResponse(),
    });
    global.fetch = mockFetch;

    // Start at April 2025 so navigating back goes to March
    render(
      <DashboardClient {...defaultProps} initialMonth={3} initialYear={2025} />
    );

    const prevBtn = screen.getByRole("button", { name: "Previous month" });
    await act(async () => {
      fireEvent.click(prevBtn);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/analytics?startDate=2025-03-01&endDate=2025-03-31"
    );
  });

  it("constructs correct date params for a 30-day month (April)", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeApiResponse(),
    });
    global.fetch = mockFetch;

    // Start at May 2025 so navigating back goes to April
    render(
      <DashboardClient {...defaultProps} initialMonth={4} initialYear={2025} />
    );

    const prevBtn = screen.getByRole("button", { name: "Previous month" });
    await act(async () => {
      fireEvent.click(prevBtn);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/analytics?startDate=2025-04-01&endDate=2025-04-30"
    );
  });

  it("constructs correct date params for February in a non-leap year (2025)", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeApiResponse(),
    });
    global.fetch = mockFetch;

    // Start at March 2025 so navigating back goes to February
    render(
      <DashboardClient {...defaultProps} initialMonth={2} initialYear={2025} />
    );

    const prevBtn = screen.getByRole("button", { name: "Previous month" });
    await act(async () => {
      fireEvent.click(prevBtn);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/analytics?startDate=2025-02-01&endDate=2025-02-28"
    );
  });

  it("constructs correct date params for February in a leap year (2024)", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeApiResponse(),
    });
    global.fetch = mockFetch;

    // Start at March 2024 so navigating back goes to February 2024
    render(
      <DashboardClient {...defaultProps} initialMonth={2} initialYear={2024} />
    );

    const prevBtn = screen.getByRole("button", { name: "Previous month" });
    await act(async () => {
      fireEvent.click(prevBtn);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/analytics?startDate=2024-02-01&endDate=2024-02-29"
    );
  });

  // ─── Dashboard heading ─────────────────────────────────────

  it("renders the Dashboard heading", () => {
    render(<DashboardClient {...defaultProps} />);
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeDefined();
  });

  // ─── Chart section rendering ───────────────────────────────

  it("renders attendance chart section header", () => {
    render(<DashboardClient {...defaultProps} />);
    expect(screen.getByText("Class Attendance")).toBeDefined();
  });

  it("renders revenue chart section header", () => {
    render(<DashboardClient {...defaultProps} />);
    expect(screen.getByText("Revenue Breakdown")).toBeDefined();
  });

  it("shows 'No session data available' when popularSlots is empty", () => {
    render(<DashboardClient {...defaultProps} popularSlots={[]} />);
    expect(screen.getByText("No session data available")).toBeDefined();
  });

  // ─── Quick Actions section heading ─────────────────────────

  it("renders Quick Actions section heading", () => {
    render(<DashboardClient {...defaultProps} />);
    expect(screen.getByText("Quick Actions")).toBeDefined();
  });

  // ─── Next month button remains disabled at current month ──

  it("next button stays disabled even after navigating back and forward to current month", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeApiResponse(),
    });
    global.fetch = mockFetch;

    render(<DashboardClient {...defaultProps} />);

    // Navigate back
    const prevBtn = screen.getByRole("button", { name: "Previous month" });
    await act(async () => { fireEvent.click(prevBtn); });

    // Navigate forward back to current month
    const nextBtn = screen.getByRole("button", { name: "Next month" });
    await act(async () => { fireEvent.click(nextBtn); });

    // Should now be at current month again, next should be disabled
    expect(screen.getByText("February 2026 overview")).toBeDefined();
    expect(screen.getByRole("button", { name: "Next month" }).hasAttribute("disabled")).toBe(true);
  });

  // ─── handleNextMonth no-op at current month ───────────────

  it("clicking next month at current month does not trigger fetch", () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    render(<DashboardClient {...defaultProps} />);

    const nextBtn = screen.getByRole("button", { name: "Next month" });
    fireEvent.click(nextBtn);

    expect(mockFetch).not.toHaveBeenCalled();
    expect(screen.getByText("February 2026 overview")).toBeDefined();
  });

  // ─── Popular slots updated after fetch ─────────────────────

  it("updates popular slots data after navigation", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeApiResponse({
        classPerformance: {
          popularSlots: [
            { day: "Monday", hour: 9, avgAttendance: 15, avgFillRate: 0.75, sessionCount: 4 },
          ],
        },
      }),
    });
    global.fetch = mockFetch;

    render(<DashboardClient {...defaultProps} popularSlots={[]} />);

    // Initially empty
    expect(screen.getByText("No session data available")).toBeDefined();

    const prevBtn = screen.getByRole("button", { name: "Previous month" });
    await act(async () => {
      fireEvent.click(prevBtn);
    });

    // After fetch, attendance chart should now have data (the "No session data" message should be gone)
    expect(screen.queryByText("No session data available")).toBeNull();
  });

  // ─── Loading clears after error responses ──────────────────

  it("clears loading state after non-OK response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });
    global.fetch = mockFetch;

    const { container } = render(
      <DashboardClient {...defaultProps} initialMonth={0} initialYear={2026} />
    );

    const prevBtn = screen.getByRole("button", { name: "Previous month" });
    await act(async () => {
      fireEvent.click(prevBtn);
    });

    // After error, loading should be false — buttons re-enabled
    expect(screen.getByRole("button", { name: "Previous month" }).hasAttribute("disabled")).toBe(false);
    // opacity should be cleared
    const grids = container.querySelectorAll(".transition-opacity");
    for (const grid of grids) {
      expect(grid.className).not.toContain("opacity-50");
    }
  });

  it("clears loading state after network error (fetch throws)", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
    global.fetch = mockFetch;

    render(
      <DashboardClient {...defaultProps} initialMonth={0} initialYear={2026} />
    );

    const prevBtn = screen.getByRole("button", { name: "Previous month" });
    await act(async () => {
      fireEvent.click(prevBtn);
    });

    // After error, prev button should be re-enabled
    expect(screen.getByRole("button", { name: "Previous month" }).hasAttribute("disabled")).toBe(false);
  });

  // ─── MetricCard titles ─────────────────────────────────────

  it("renders all four metric card titles", () => {
    render(<DashboardClient {...defaultProps} />);
    expect(screen.getByText("Active Members")).toBeDefined();
    expect(screen.getByText("Revenue")).toBeDefined();
    expect(screen.getByText("Outstanding")).toBeDefined();
    expect(screen.getByText("Trials")).toBeDefined();
  });

  // ─── Quick action label text ───────────────────────────────

  it("renders quick action label text", () => {
    render(<DashboardClient {...defaultProps} />);
    expect(screen.getByText("Manage Schedule")).toBeDefined();
    expect(screen.getByText("Record Payment")).toBeDefined();
    expect(screen.getByText("Private Sessions")).toBeDefined();
    expect(screen.getByText("Manage Trainers")).toBeDefined();
  });

  // ─── Zero revenue display ─────────────────────────────────

  it("displays zero revenue correctly", () => {
    render(
      <DashboardClient
        {...defaultProps}
        totalRevenue={0}
        membershipRevenue={0}
        privateRevenue={0}
      />
    );
    expect(screen.getByText(fmtCurrency(0))).toBeDefined();
    expect(screen.getByText(`Membership: ${fmtCurrency(0)} | Private: ${fmtCurrency(0)}`)).toBeDefined();
  });

  // ─── Revenue chart total description ───────────────────────

  it("displays revenue chart total in description", () => {
    render(<DashboardClient {...defaultProps} />);
    expect(screen.getByText(`Total: ${fmtCurrency(50000)}`)).toBeDefined();
  });
});
