/**
 * Attendance Analytics Components - Unit Tests
 *
 * Tests for MemberAttendanceTable and VoteVsActualCards components.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemberAttendanceTable } from "../MemberAttendanceTable";
import { VoteVsActualCards } from "../VoteVsActualCards";

// Mock Recharts components to avoid SSR/canvas issues in tests
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: () => null,
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

// ===== Additional MemberAttendanceTable tests =====

describe("MemberAttendanceTable — additional coverage", () => {
  it("renders the correct number of rows", () => {
    const members = [
      { name: "Alice", expected: 10, attended: 9, rate: 90 },
      { name: "Bob", expected: 10, attended: 5, rate: 50 },
      { name: "Carol", expected: 10, attended: 3, rate: 30 },
      { name: "Dave", expected: 10, attended: 8, rate: 80 },
      { name: "Eve", expected: 10, attended: 1, rate: 10 },
    ];
    render(<MemberAttendanceTable members={members} />);

    // All 5 names rendered
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.getByText("Bob")).toBeTruthy();
    expect(screen.getByText("Carol")).toBeTruthy();
    expect(screen.getByText("Dave")).toBeTruthy();
    expect(screen.getByText("Eve")).toBeTruthy();
  });

  it("color-codes 79% as yellow (boundary below green)", () => {
    render(
      <MemberAttendanceTable
        members={[{ name: "BoundaryMember", expected: 100, attended: 79, rate: 79 }]}
      />
    );

    const rateCell = screen.getByText("79%");
    expect(rateCell.className).toContain("warning");
  });

  it("color-codes 49% as red (boundary below yellow)", () => {
    render(
      <MemberAttendanceTable
        members={[{ name: "LowMember", expected: 100, attended: 49, rate: 49 }]}
      />
    );

    const rateCell = screen.getByText("49%");
    expect(rateCell.className).toContain("error");
  });

  it("displays 0% rate correctly and with red color", () => {
    render(
      <MemberAttendanceTable
        members={[{ name: "NoShow", expected: 10, attended: 0, rate: 0 }]}
      />
    );

    expect(screen.getByText("NoShow")).toBeTruthy();
    expect(screen.getByText("0%")).toBeTruthy();
    const rateCell = screen.getByText("0%");
    expect(rateCell.className).toContain("error");
  });

  it("displays 100% rate correctly and with green color", () => {
    render(
      <MemberAttendanceTable
        members={[{ name: "PerfectMember", expected: 10, attended: 10, rate: 100 }]}
      />
    );

    expect(screen.getByText("PerfectMember")).toBeTruthy();
    expect(screen.getByText("100%")).toBeTruthy();
    const rateCell = screen.getByText("100%");
    expect(rateCell.className).toContain("success");
  });

  it("renders a large dataset with 20+ members", () => {
    const largeDataset = Array.from({ length: 25 }, (_, i) => ({
      name: `Member ${i + 1}`,
      expected: 10,
      attended: i % 10,
      rate: (i % 10) * 10,
    }));

    render(<MemberAttendanceTable members={largeDataset} />);

    // Verify all members rendered
    for (let i = 1; i <= 25; i++) {
      expect(screen.getByText(`Member ${i}`)).toBeTruthy();
    }
  });
});

// ===== Additional VoteVsActualCards tests =====

describe("VoteVsActualCards — additional coverage", () => {
  it("displays 0% reliability correctly", () => {
    render(
      <VoteVsActualCards
        data={{
          totalVotedComing: 10,
          totalActuallyAttended: 0,
          reliability: 0,
        }}
      />
    );

    expect(screen.getByText("10")).toBeTruthy();
    expect(screen.getByText("0%")).toBeTruthy();
  });

  it("displays 100% reliability correctly", () => {
    render(
      <VoteVsActualCards
        data={{
          totalVotedComing: 25,
          totalActuallyAttended: 25,
          reliability: 100,
        }}
      />
    );

    // Both voted and attended are 25
    const twentyFives = screen.getAllByText("25");
    expect(twentyFives.length).toBe(2);
    expect(screen.getByText("100%")).toBeTruthy();
  });

  it("handles mismatched voted vs attended numbers", () => {
    render(
      <VoteVsActualCards
        data={{
          totalVotedComing: 50,
          totalActuallyAttended: 35,
          reliability: 70,
        }}
      />
    );

    expect(screen.getByText("50")).toBeTruthy();
    expect(screen.getByText("35")).toBeTruthy();
    expect(screen.getByText("70%")).toBeTruthy();
  });
});

