/**
 * Header Unit Tests
 *
 * Tests mobile menu behavior including overlay backdrop,
 * body scroll lock, and overlay click-to-close.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Header } from "../Header";

// ===== Mocks =====

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/member/schedule",
}));

vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
}));

vi.mock("../Navigation", () => ({
  Navigation: ({
    mobile,
    onNavigate,
  }: {
    role: string;
    mobile?: boolean;
    onNavigate?: () => void;
  }) =>
    mobile ? (
      <nav data-testid="mobile-nav" onClick={onNavigate}>
        Mobile Nav
      </nav>
    ) : (
      <nav data-testid="desktop-nav">Desktop Nav</nav>
    ),
}));

// ===== Helpers =====

function renderHeader(
  props: Partial<React.ComponentProps<typeof Header>> = {}
): ReturnType<typeof render> {
  const defaultProps = {
    userName: "Alice",
    userRole: "MEMBER" as const,
    notificationCount: 0,
  };
  return render(<Header {...defaultProps} {...props} />);
}

function openMobileMenu(): void {
  const toggleBtn = screen.getByLabelText("Toggle menu");
  fireEvent.click(toggleBtn);
}

// ===== Tests =====

describe("Header", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.style.overflow = "";
  });

  afterEach(() => {
    document.body.style.overflow = "";
  });

  describe("mobile menu overlay", () => {
    it("renders overlay div with fixed inset-0 when mobile menu opens", () => {
      renderHeader();
      openMobileMenu();

      // The overlay is the div with aria-hidden="true" and class "fixed inset-0 z-50"
      const overlay = document.querySelector('[aria-hidden="true"].fixed');
      expect(overlay).toBeTruthy();
      expect(overlay!.className).toContain("fixed");
      expect(overlay!.className).toContain("inset-0");
    });

    it("does not render overlay when mobile menu is closed", () => {
      renderHeader();

      // No overlay should exist initially
      const overlays = document.querySelectorAll('[aria-hidden="true"].fixed');
      expect(overlays.length).toBe(0);
    });

    it("closes mobile menu when overlay is clicked", () => {
      renderHeader();
      openMobileMenu();

      // Verify menu is open
      expect(screen.getByTestId("mobile-nav")).toBeTruthy();

      // Click overlay
      const overlay = document.querySelector('[aria-hidden="true"].fixed');
      expect(overlay).toBeTruthy();
      fireEvent.click(overlay!);

      // Menu should be closed
      expect(screen.queryByTestId("mobile-nav")).toBeNull();
    });
  });

  describe("body scroll lock", () => {
    it("sets document.body.style.overflow to hidden when mobile menu opens", () => {
      renderHeader();
      expect(document.body.style.overflow).toBe("");

      openMobileMenu();
      expect(document.body.style.overflow).toBe("hidden");
    });

    it("resets document.body.style.overflow to empty when mobile menu closes", () => {
      renderHeader();
      openMobileMenu();
      expect(document.body.style.overflow).toBe("hidden");

      // Click toggle again to close
      const toggleBtn = screen.getByLabelText("Toggle menu");
      fireEvent.click(toggleBtn);
      expect(document.body.style.overflow).toBe("");
    });

    it("resets overflow on unmount", () => {
      const { unmount } = renderHeader();
      openMobileMenu();
      expect(document.body.style.overflow).toBe("hidden");

      unmount();
      expect(document.body.style.overflow).toBe("");
    });
  });

  describe("mobile menu toggle", () => {
    it("renders toggle button with correct aria-label", () => {
      renderHeader();
      const toggleBtn = screen.getByLabelText("Toggle menu");
      expect(toggleBtn).toBeTruthy();
    });

    it("sets aria-expanded=true when menu is open", () => {
      renderHeader();
      const toggleBtn = screen.getByLabelText("Toggle menu");
      expect(toggleBtn.getAttribute("aria-expanded")).toBe("false");

      fireEvent.click(toggleBtn);
      expect(toggleBtn.getAttribute("aria-expanded")).toBe("true");
    });

    it("shows mobile navigation when menu is open", () => {
      renderHeader();
      openMobileMenu();
      expect(screen.getByTestId("mobile-nav")).toBeTruthy();
    });

    it("hides mobile navigation when menu is closed", () => {
      renderHeader();
      expect(screen.queryByTestId("mobile-nav")).toBeNull();
    });
  });
});
