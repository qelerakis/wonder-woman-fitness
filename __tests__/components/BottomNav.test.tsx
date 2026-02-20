import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BottomNav } from "@/components/layout/BottomNav";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/member/schedule",
}));

describe("BottomNav", () => {
  it("renders member navigation items", () => {
    render(<BottomNav role="MEMBER" />);
    expect(screen.getByLabelText("Schedule")).toBeTruthy();
    expect(screen.getByLabelText("Notifications")).toBeTruthy();
    expect(screen.getByLabelText("Profile")).toBeTruthy();
  });

  it("renders trainer navigation items", () => {
    render(<BottomNav role="TRAINER" />);
    expect(screen.getByLabelText("Schedule")).toBeTruthy();
    expect(screen.getByLabelText("Payments")).toBeTruthy();
    expect(screen.getByLabelText("Notifications")).toBeTruthy();
  });

  it("does not render for owner role", () => {
    const { container } = render(<BottomNav role="OWNER" />);
    expect(container.firstChild).toBeNull();
  });

  it("highlights the active route", () => {
    render(<BottomNav role="MEMBER" />);
    const scheduleLink = screen.getByLabelText("Schedule");
    expect(scheduleLink.className).toContain("text-primary-400");
  });

  it("does not highlight inactive routes", () => {
    render(<BottomNav role="MEMBER" />);
    const notificationsLink = screen.getByLabelText("Notifications");
    expect(notificationsLink.className).toContain("text-surface-400");
    expect(notificationsLink.className).not.toContain("text-primary-400");
  });
});
