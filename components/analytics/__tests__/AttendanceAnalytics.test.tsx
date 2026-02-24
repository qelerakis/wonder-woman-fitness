/**
 * Attendance Analytics Components - Unit Tests
 *
 * Tests for MemberAttendanceTable, SlotAttendanceChart,
 * VoteVsActualCards, and AttendanceTrendChart components.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemberAttendanceTable } from "../MemberAttendanceTable";
import { SlotAttendanceChart } from "../SlotAttendanceChart";
import { VoteVsActualCards } from "../VoteVsActualCards";
import { AttendanceTrendChart } from "../AttendanceTrendChart";

// Mock Recharts components to avoid SSR/canvas issues in tests
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: () => null,
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}));

// ===== MemberAttendanceTable =====

describe("MemberAttendanceTable", () => {
  const sampleMembers = [
    { name: "Alice", expected: 10, attended: 3, rate: 30 },
    { name: "Bob", expected: 10, attended: 6, rate: 60 },
    { name: "Carol", expected: 10, attended: 9, rate: 90 },
  ];

  it("renders member rows with correct data", () => {
    render(<MemberAttendanceTable members={sampleMembers} />);

    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.getByText("Bob")).toBeTruthy();
    expect(screen.getByText("Carol")).toBeTruthy();
    expect(screen.getByText("30%")).toBeTruthy();
    expect(screen.getByText("60%")).toBeTruthy();
    expect(screen.getByText("90%")).toBeTruthy();
  });

  it("shows empty state when no members", () => {
    render(<MemberAttendanceTable members={[]} />);

    expect(screen.getByText("No attendance data available")).toBeTruthy();
  });

  it("color-codes rates green for >= 80%", () => {
    render(
      <MemberAttendanceTable
        members={[{ name: "Carol", expected: 10, attended: 9, rate: 90 }]}
      />
    );

    const rateCell = screen.getByText("90%");
    expect(rateCell.className).toContain("success");
  });

  it("color-codes rates yellow for 50-79%", () => {
    render(
      <MemberAttendanceTable
        members={[{ name: "Bob", expected: 10, attended: 6, rate: 60 }]}
      />
    );

    const rateCell = screen.getByText("60%");
    expect(rateCell.className).toContain("warning");
  });

  it("color-codes rates red for < 50%", () => {
    render(
      <MemberAttendanceTable
        members={[{ name: "Alice", expected: 10, attended: 3, rate: 30 }]}
      />
    );

    const rateCell = screen.getByText("30%");
    expect(rateCell.className).toContain("error");
  });

  it("renders the card header with correct title", () => {
    render(<MemberAttendanceTable members={sampleMembers} />);

    expect(screen.getByText("Member Attendance Rates")).toBeTruthy();
    expect(screen.getByText("Show-up rate per member")).toBeTruthy();
  });

  it("renders table headers", () => {
    render(<MemberAttendanceTable members={sampleMembers} />);

    expect(screen.getByText("Member")).toBeTruthy();
    expect(screen.getByText("Expected")).toBeTruthy();
    expect(screen.getByText("Attended")).toBeTruthy();
    expect(screen.getByText("Rate")).toBeTruthy();
  });

  it("renders expected and attended counts", () => {
    render(
      <MemberAttendanceTable
        members={[{ name: "Alice", expected: 12, attended: 8, rate: 67 }]}
      />
    );

    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("8")).toBeTruthy();
  });

  it("color-codes exactly 80% as green", () => {
    render(
      <MemberAttendanceTable
        members={[{ name: "Edge", expected: 10, attended: 8, rate: 80 }]}
      />
    );

    const rateCell = screen.getByText("80%");
    expect(rateCell.className).toContain("success");
  });

  it("color-codes exactly 50% as yellow", () => {
    render(
      <MemberAttendanceTable
        members={[{ name: "Mid", expected: 10, attended: 5, rate: 50 }]}
      />
    );

    const rateCell = screen.getByText("50%");
    expect(rateCell.className).toContain("warning");
  });
});

// ===== SlotAttendanceChart =====

describe("SlotAttendanceChart", () => {
  const sampleSlots = [
    {
      day: "Monday",
      hour: 9,
      avgPresent: 8,
      avgExpected: 10,
      showUpRate: 80,
      sessionCount: 4,
    },
    {
      day: "Wednesday",
      hour: 17,
      avgPresent: 5,
      avgExpected: 10,
      showUpRate: 50,
      sessionCount: 4,
    },
  ];

  it("renders the bar chart", () => {
    render(<SlotAttendanceChart slots={sampleSlots} />);

    expect(screen.getByTestId("bar-chart")).toBeTruthy();
  });

  it("shows empty state when no slots", () => {
    render(<SlotAttendanceChart slots={[]} />);

    expect(screen.getByText("No attendance data available")).toBeTruthy();
  });

  it("renders the card header with correct title", () => {
    render(<SlotAttendanceChart slots={sampleSlots} />);

    expect(screen.getByText("Slot Show-up Rates")).toBeTruthy();
    expect(
      screen.getByText("Average attendance rate by time slot")
    ).toBeTruthy();
  });

  it("does not render chart for empty data", () => {
    render(<SlotAttendanceChart slots={[]} />);

    expect(screen.queryByTestId("bar-chart")).toBeNull();
  });
});

// ===== VoteVsActualCards =====

describe("VoteVsActualCards", () => {
  it("renders three metric cards with correct values", () => {
    render(
      <VoteVsActualCards
        data={{
          totalVotedComing: 45,
          totalActuallyAttended: 38,
          reliability: 84,
        }}
      />
    );

    expect(screen.getByText("Voted Coming")).toBeTruthy();
    expect(screen.getByText("45")).toBeTruthy();
    expect(screen.getByText("Actually Attended")).toBeTruthy();
    expect(screen.getByText("38")).toBeTruthy();
    expect(screen.getByText("Vote Reliability")).toBeTruthy();
    expect(screen.getByText("84%")).toBeTruthy();
  });

  it("shows zeros correctly", () => {
    render(
      <VoteVsActualCards
        data={{
          totalVotedComing: 0,
          totalActuallyAttended: 0,
          reliability: 0,
        }}
      />
    );

    expect(screen.getByText("Voted Coming")).toBeTruthy();
    // 0 appears multiple times (voted coming and actually attended)
    const zeros = screen.getAllByText("0");
    expect(zeros.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("0%")).toBeTruthy();
  });

  it("renders all three card titles", () => {
    render(
      <VoteVsActualCards
        data={{
          totalVotedComing: 10,
          totalActuallyAttended: 8,
          reliability: 80,
        }}
      />
    );

    expect(screen.getByText("Voted Coming")).toBeTruthy();
    expect(screen.getByText("Actually Attended")).toBeTruthy();
    expect(screen.getByText("Vote Reliability")).toBeTruthy();
  });
});

// ===== AttendanceTrendChart =====

describe("AttendanceTrendChart", () => {
  const sampleTrend = [
    { week: "2026-02-03", rate: 75, present: 15, total: 20 },
    { week: "2026-02-10", rate: 80, present: 16, total: 20 },
    { week: "2026-02-17", rate: 85, present: 17, total: 20 },
  ];

  it("renders the line chart", () => {
    render(<AttendanceTrendChart trend={sampleTrend} />);

    expect(screen.getByTestId("line-chart")).toBeTruthy();
  });

  it("shows empty state when no trend data", () => {
    render(<AttendanceTrendChart trend={[]} />);

    expect(screen.getByText("No trend data available")).toBeTruthy();
  });

  it("renders the card header with correct title", () => {
    render(<AttendanceTrendChart trend={sampleTrend} />);

    expect(screen.getByText("Attendance Trend")).toBeTruthy();
    expect(screen.getByText("Weekly show-up rate over time")).toBeTruthy();
  });

  it("does not render chart for empty data", () => {
    render(<AttendanceTrendChart trend={[]} />);

    expect(screen.queryByTestId("line-chart")).toBeNull();
  });
});
