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

  // ─── Navigation hrefs ────────────────────────────────────────

  describe("member navigation hrefs", () => {
    it("Schedule links to /member/schedule", () => {
      render(<BottomNav role="MEMBER" />);
      const link = screen.getByLabelText("Schedule");
      expect(link.getAttribute("href")).toBe("/member/schedule");
    });

    it("Notifications links to /member/notifications", () => {
      render(<BottomNav role="MEMBER" />);
      const link = screen.getByLabelText("Notifications");
      expect(link.getAttribute("href")).toBe("/member/notifications");
    });

    it("Profile links to /member/profile", () => {
      render(<BottomNav role="MEMBER" />);
      const link = screen.getByLabelText("Profile");
      expect(link.getAttribute("href")).toBe("/member/profile");
    });
  });

  describe("trainer navigation hrefs", () => {
    it("Schedule links to /trainer/schedule", () => {
      render(<BottomNav role="TRAINER" />);
      const link = screen.getByLabelText("Schedule");
      expect(link.getAttribute("href")).toBe("/trainer/schedule");
    });

    it("Payments links to /trainer/payments", () => {
      render(<BottomNav role="TRAINER" />);
      const link = screen.getByLabelText("Payments");
      expect(link.getAttribute("href")).toBe("/trainer/payments");
    });

    it("Notifications links to /trainer/notifications", () => {
      render(<BottomNav role="TRAINER" />);
      const link = screen.getByLabelText("Notifications");
      expect(link.getAttribute("href")).toBe("/trainer/notifications");
    });
  });

  // ─── Accessibility ──────────────────────────────────────────

  describe("accessibility", () => {
    it("nav has aria-label 'Mobile navigation'", () => {
      render(<BottomNav role="MEMBER" />);
      const nav = screen.getByLabelText("Mobile navigation");
      expect(nav).toBeTruthy();
      expect(nav.tagName).toBe("NAV");
    });
  });

  // ─── CSS classes for positioning and responsiveness ──────────

  describe("positioning and responsiveness", () => {
    it("has md:hidden class (hidden on desktop)", () => {
      render(<BottomNav role="MEMBER" />);
      const nav = screen.getByLabelText("Mobile navigation");
      expect(nav.className).toContain("md:hidden");
    });

    it("has fixed positioning (fixed bottom-0)", () => {
      render(<BottomNav role="MEMBER" />);
      const nav = screen.getByLabelText("Mobile navigation");
      expect(nav.className).toContain("fixed");
      expect(nav.className).toContain("bottom-0");
    });

    it("has left-0 and right-0 for full-width span", () => {
      render(<BottomNav role="MEMBER" />);
      const nav = screen.getByLabelText("Mobile navigation");
      expect(nav.className).toContain("left-0");
      expect(nav.className).toContain("right-0");
    });

    it("has z-40 for proper stacking", () => {
      render(<BottomNav role="MEMBER" />);
      const nav = screen.getByLabelText("Mobile navigation");
      expect(nav.className).toContain("z-40");
    });
  });
});
