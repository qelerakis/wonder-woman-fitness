/**
 * MemberTable.test.tsx — MemberTable i18n + functionality tests
 *
 * Tests that MemberTable renders translated strings from the
 * memberTable and paymentStatus namespaces, handles search/filter,
 * and shows correct empty states.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemberTable } from "../MemberTable";
import type { MemberTableData } from "../MemberTable";
import type { PaymentStatus } from "@/lib/constants";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock next/image
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: (props: Record<string, unknown>) => <img {...props} />,
}));

function makeMember(overrides: Partial<MemberTableData> = {}): MemberTableData {
  return {
    id: "m1",
    name: "Alice Smith",
    email: "alice@test.com",
    phone: null,
    photo: null,
    status: "ACTIVE",
    joinDate: "2026-01-15T00:00:00.000Z",
    trialEndsAt: null,
    paymentStatus: "PAID" as PaymentStatus,
    ...overrides,
  };
}

const members: MemberTableData[] = [
  makeMember({ id: "m1", name: "Alice Smith", email: "alice@test.com", paymentStatus: "PAID" as PaymentStatus }),
  makeMember({ id: "m2", name: "Bob Jones", email: "bob@test.com", paymentStatus: "GRACE_PERIOD" as PaymentStatus }),
  makeMember({ id: "m3", name: "Charlie Brown", email: "charlie@test.com", paymentStatus: "LOCKED" as PaymentStatus }),
];

describe("MemberTable — translated strings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders translated column headers", () => {
    render(<MemberTable members={members} />);
    expect(screen.getByText("Member")).toBeDefined();
    expect(screen.getByText("Email")).toBeDefined();
    expect(screen.getByText("Status")).toBeDefined();
    expect(screen.getByText("Joined")).toBeDefined();
  });

  it("renders translated search placeholder", () => {
    render(<MemberTable members={members} />);
    const input = screen.getByPlaceholderText("Search by name or email...");
    expect(input).toBeDefined();
  });

  it("renders translated showing count", () => {
    render(<MemberTable members={members} />);
    expect(screen.getByText(/Showing 3 of 3/)).toBeDefined();
  });

  it("renders translated empty state when no members", () => {
    render(<MemberTable members={[]} />);
    expect(screen.getByText("No members yet")).toBeDefined();
  });

  it("renders translated no-match state when search finds nothing", () => {
    render(<MemberTable members={members} />);
    const input = screen.getByPlaceholderText("Search by name or email...");
    fireEvent.change(input, { target: { value: "zzzzz" } });
    expect(screen.getByText("No members match your filters")).toBeDefined();
  });

  it("renders member names", () => {
    render(<MemberTable members={members} />);
    expect(screen.getByText("Alice Smith")).toBeDefined();
    expect(screen.getByText("Bob Jones")).toBeDefined();
    expect(screen.getByText("Charlie Brown")).toBeDefined();
  });

  it("renders avatar initial when no photo", () => {
    render(<MemberTable members={[makeMember({ name: "Diana" })]} />);
    expect(screen.getByText("D")).toBeDefined();
  });

  it("renders member links with correct basePath", () => {
    render(<MemberTable members={[makeMember()]} basePath="/owner/members" />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/owner/members/m1");
  });
});

describe("MemberTable — search filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters members by name search", () => {
    render(<MemberTable members={members} />);
    const input = screen.getByPlaceholderText("Search by name or email...");
    fireEvent.change(input, { target: { value: "alice" } });
    expect(screen.getByText("Alice Smith")).toBeDefined();
    expect(screen.queryByText("Bob Jones")).toBeNull();
  });

  it("filters members by email search", () => {
    render(<MemberTable members={members} />);
    const input = screen.getByPlaceholderText("Search by name or email...");
    fireEvent.change(input, { target: { value: "bob@" } });
    expect(screen.getByText("Bob Jones")).toBeDefined();
    expect(screen.queryByText("Alice Smith")).toBeNull();
  });

  it("search is case insensitive", () => {
    render(<MemberTable members={members} />);
    const input = screen.getByPlaceholderText("Search by name or email...");
    fireEvent.change(input, { target: { value: "CHARLIE" } });
    expect(screen.getByText("Charlie Brown")).toBeDefined();
  });

  it("updates showing count after filtering", () => {
    render(<MemberTable members={members} />);
    const input = screen.getByPlaceholderText("Search by name or email...");
    fireEvent.change(input, { target: { value: "alice" } });
    expect(screen.getByText(/Showing 1 of 3/)).toBeDefined();
  });
});

describe("MemberTable — status filter dropdown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders All Statuses option in the select", () => {
    render(<MemberTable members={members} />);
    // The select should contain the "All Statuses" default
    const select = screen.getByDisplayValue("All Statuses");
    expect(select).toBeDefined();
  });

  it("filters by payment status when a status is selected", () => {
    render(<MemberTable members={members} />);
    const select = screen.getByDisplayValue("All Statuses");
    fireEvent.change(select, { target: { value: "PAID" } });
    expect(screen.getByText("Alice Smith")).toBeDefined();
    expect(screen.queryByText("Bob Jones")).toBeNull();
    expect(screen.queryByText("Charlie Brown")).toBeNull();
  });

  it("shows all members when All Statuses is selected", () => {
    render(<MemberTable members={members} />);
    const select = screen.getByDisplayValue("All Statuses");
    // Select a specific status first
    fireEvent.change(select, { target: { value: "PAID" } });
    // Then reset to all
    fireEvent.change(screen.getByDisplayValue("Paid"), { target: { value: "all" } });
    expect(screen.getByText("Alice Smith")).toBeDefined();
    expect(screen.getByText("Bob Jones")).toBeDefined();
    expect(screen.getByText("Charlie Brown")).toBeDefined();
  });
});

describe("MemberTable — date formatting", () => {
  it("formats join dates", () => {
    render(<MemberTable members={[makeMember({ joinDate: "2026-01-15T00:00:00.000Z" })]} />);
    // date-fns format with en locale: "Jan 15, 2026"
    expect(screen.getByText("Jan 15, 2026")).toBeDefined();
  });
});
